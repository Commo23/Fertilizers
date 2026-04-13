/**
 * MMSI-only AIS table stream — separate from Live cargo AIS / merchant-ais / world map.
 * Uses Edge Function `ais-mmsi-sse` (FiltersShipMMSI + world bbox).
 */
import { config } from "@/config/environment";
import { mmsiToCountry } from "@/utils/mmsi-mid";

export type MmsiAisTableRow = {
  mmsi: string;
  name: string;
  country: string | undefined;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  heading: number;
  shipTypeLabel: string | undefined;
  destination: string | undefined;
  updatedAt: Date;
};

const FLUSH_MS = 400;
const MAX_ROWS = 50;

function aisTypeLabel(code: number | undefined): string | undefined {
  if (code == null || !Number.isFinite(code)) return undefined;
  if (code >= 70 && code <= 79) return "Cargo";
  if (code >= 80 && code <= 89) return "Tanker";
  if (code >= 60 && code <= 69) return "Passenger";
  if (code >= 30 && code <= 39) return "Fishing";
  if (code === 51 || code === 52 || code === 53 || code === 54 || code === 55) return "Special";
  return `Type ${code}`;
}

function mmsiFromPayload(meta: Record<string, unknown>, inner: Record<string, unknown>): string {
  const m = meta.MMSI ?? meta.UserID ?? inner.UserID ?? inner.MMSI;
  return String(m ?? "");
}

function parseEnvelope(
  raw: string,
  names: Map<string, string>,
  dest: Map<string, string>,
  staticAisTypeByMmsi: Map<string, number>,
): MmsiAisTableRow | null {
  let j: {
    MessageType?: string;
    Metadata?: Record<string, unknown>;
    Message?: Record<string, Record<string, unknown>>;
  };
  try {
    j = JSON.parse(raw) as typeof j;
  } catch {
    return null;
  }

  const meta = j.Metadata ?? {};
  const msg = j.Message ?? {};
  const mt = j.MessageType ?? "";

  if (mt === "ShipStaticData" && msg.ShipStaticData) {
    const s = msg.ShipStaticData;
    const mmsi = mmsiFromPayload(meta, s);
    if (!mmsi) return null;
    const nameRaw = typeof s.Name === "string" ? s.Name.trim() : "";
    const name = nameRaw.replace(/@+$/g, "").trim() || `MMSI ${mmsi}`;
    names.set(mmsi, name);
    if (typeof s.Destination === "string" && s.Destination.trim()) {
      dest.set(mmsi, s.Destination.replace(/@+$/g, "").trim());
    }
    if (typeof s.Type === "number") staticAisTypeByMmsi.set(mmsi, s.Type);
    return null;
  }

  let lat: number | undefined;
  let lon: number | undefined;
  let sog = 0;
  let cog = 0;
  let heading = 0;
  let typeCode: number | undefined;

  const applyPos = (o: Record<string, unknown>) => {
    const la = o.Latitude ?? meta.Latitude;
    const lo = o.Longitude ?? meta.Longitude;
    if (typeof la === "number" && typeof lo === "number") {
      lat = la;
      lon = lo;
    }
    if (typeof o.Sog === "number") sog = o.Sog;
    if (typeof o.Cog === "number") cog = o.Cog;
    if (typeof o.TrueHeading === "number" && o.TrueHeading < 360) heading = o.TrueHeading;
    else if (typeof o.Cog === "number") heading = o.Cog;
    if (typeof o.Type === "number") typeCode = o.Type;
  };

  if (mt === "PositionReport" && msg.PositionReport) applyPos(msg.PositionReport);
  else if (mt === "ExtendedClassBPositionReport" && msg.ExtendedClassBPositionReport)
    applyPos(msg.ExtendedClassBPositionReport);
  else if (mt === "StandardClassBPositionReport" && msg.StandardClassBPositionReport)
    applyPos(msg.StandardClassBPositionReport);
  else return null;

  if (lat == null || lon == null) return null;
  const inner = (msg.PositionReport ??
    msg.ExtendedClassBPositionReport ??
    msg.StandardClassBPositionReport ??
    {}) as Record<string, unknown>;
  const mmsi = mmsiFromPayload(meta, inner);
  if (!mmsi) return null;

  const resolvedType = typeCode ?? staticAisTypeByMmsi.get(mmsi);
  return {
    mmsi,
    name: names.get(mmsi) ?? `MMSI ${mmsi}`,
    country: mmsiToCountry(mmsi),
    lat,
    lon,
    sog,
    cog,
    heading,
    shipTypeLabel: aisTypeLabel(resolvedType),
    destination: dest.get(mmsi),
    updatedAt: new Date(),
  };
}

/** AISStream expects FiltersShipMMSI strings of length 9 (OpenAPI). */
export function parseMmsiInput(raw: string): string[] {
  const tokens = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!/^\d{9}$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * Dev: same-origin `/api/ais-mmsi-sse` (Vite relay, reads `.env`).
 * Prod / override: `VITE_AIS_MMSI_SSE_URL` or Supabase Edge `ais-mmsi-sse`.
 */
export function resolveMmsiAisSseUrl(mmsiList: string[]): string {
  const explicit = String(import.meta.env.VITE_AIS_MMSI_SSE_URL ?? "").trim();
  const q = new URLSearchParams();
  q.set("mmsi", mmsiList.join(","));
  const qs = q.toString();
  if (explicit) {
    const sep = explicit.includes("?") ? "&" : "?";
    return `${explicit}${sep}${qs}`;
  }
  if (import.meta.env.DEV) {
    return `/api/ais-mmsi-sse?${qs}`;
  }
  const base = config.supabase.url.replace(/\/$/, "");
  return `${base}/functions/v1/ais-mmsi-sse?${qs}`;
}

function normalizeSseText(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

async function consumeAisSseStream(
  body: ReadableStream<Uint8Array>,
  onData: (line: string) => void,
  onSseError: (payload: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let pending = "";

  const emitBlocks = (): void => {
    let sep: number;
    while ((sep = pending.indexOf("\n\n")) !== -1) {
      const block = pending.slice(0, sep);
      pending = pending.slice(sep + 2);
      const trimmed = block.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      let eventName = "message";
      for (const line of trimmed.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (eventName === "error") onSseError(payload);
          else onData(payload);
        }
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        pending = normalizeSseText(pending + dec.decode(value, { stream: true }));
        if (signal.aborted) break;
        emitBlocks();
      }
      if (done) {
        pending = normalizeSseText(pending + dec.decode());
        emitBlocks();
        break;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

const SSE_RECONNECT_MS = 4000;

/**
 * Opens SSE to `ais-mmsi-sse` and updates rows by MMSI. Call disconnect when leaving the page.
 */
export function connectMmsiAisTableStream(
  mmsiList: string[],
  onUpdate: (rows: MmsiAisTableRow[]) => void,
  onStreamError?: (message: string) => void,
): () => void {
  if (mmsiList.length === 0) {
    return () => undefined;
  }

  const byMmsi = new Map<string, MmsiAisTableRow>();
  const names = new Map<string, string>();
  const destinations = new Map<string, string>();
  const staticAisTypeByMmsi = new Map<string, number>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleFlush = () => {
    if (flushTimer != null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const list = [...byMmsi.values()].sort((a, b) => a.mmsi.localeCompare(b.mmsi));
      onUpdate(list.slice(0, MAX_ROWS));
    }, FLUSH_MS);
  };

  const onRaw = (raw: string) => {
    const row = parseEnvelope(raw, names, destinations, staticAisTypeByMmsi);
    if (row) byMmsi.set(row.mmsi, row);
    scheduleFlush();
  };

  const sseUrl = resolveMmsiAisSseUrl(mmsiList);
  /** Local Vite relay — no Supabase JWT (uses AISSTREAM_API_KEY from server .env). */
  const isLocalDevRelay = import.meta.env.DEV && sseUrl.startsWith("/api/ais-mmsi-sse");
  const anonKey = config.supabase.anonKey;
  const headers: Record<string, string> = isLocalDevRelay
    ? {}
    : {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      };
  const token = String(import.meta.env.VITE_AIS_SSE_TOKEN ?? "").trim();
  const requestUrl =
    !isLocalDevRelay && token
      ? `${sseUrl}${sseUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
      : sseUrl;

  let cancelled = false;
  let abort: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearReconnect = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const run = async () => {
    while (!cancelled) {
      abort?.abort();
      abort = new AbortController();
      console.info("[mmsi-ais-table] connecting:", requestUrl.replace(/token=[^&]+/, "token=***"));
      try {
        const res = await fetch(requestUrl, {
          method: "GET",
          mode: "cors",
          headers,
          signal: abort.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) {
          console.warn("[mmsi-ais-table] HTTP", res.status, res.statusText);
          const errText = await res.text().catch(() => "");
          let msg = `HTTP ${res.status}`;
          try {
            const j = JSON.parse(errText) as { error?: string; hint?: string };
            if (j.error) msg = j.error + (j.hint ? ` — ${j.hint}` : "");
          } catch {
            if (errText) msg = errText.slice(0, 200);
          }
          onStreamError?.(msg);
          await new Promise((r) => setTimeout(r, SSE_RECONNECT_MS));
          continue;
        }
        let warned = false;
        const onSseError = (payload: string) => {
          if (warned) return;
          warned = true;
          let detail = payload;
          try {
            const j = JSON.parse(payload) as {
              kind?: string;
              code?: number;
              reason?: string;
              rawCode?: number;
              hint?: string;
            };
            if (j.kind === "aisstream_error" && typeof (j as { message?: string }).message === "string") {
              detail = `AISStream: ${(j as { message: string }).message}`;
            } else if (j.kind === "aisstream_close" && typeof j.code === "number") {
              const bit = `${j.code}${j.reason ? `: ${j.reason}` : ""}`;
              detail =
                j.hint ??
                `AISStream closed (${bit}). Confirm AISSTREAM_API_KEY on Supabase for ais-mmsi-sse; if the vessel is outside the default bbox, set secret AIS_MMSI_BOUNDING_BOXES (JSON, same format as AIS_BOUNDING_BOXES).`;
            }
          } catch {
            /* keep detail */
          }
          onStreamError?.(detail);
          console.warn("[mmsi-ais-table]", detail);
        };
        await consumeAisSseStream(res.body, onRaw, onSseError, abort.signal);
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[mmsi-ais-table] fetch/stream error:", msg);
          onStreamError?.(`Connection error: ${msg}`);
        }
      }
      if (cancelled) break;
      await new Promise<void>((r) => {
        reconnectTimer = setTimeout(r, SSE_RECONNECT_MS);
      });
    }
  };

  void run();

  return () => {
    cancelled = true;
    clearReconnect();
    try {
      abort?.abort();
    } catch {
      /* ignore */
    }
    if (flushTimer != null) clearTimeout(flushTimer);
  };
}
