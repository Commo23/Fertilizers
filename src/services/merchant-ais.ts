import type { MerchantCargoVessel } from "@/types";
import { config } from "@/config/environment";
import { mmsiToCountry } from "@/utils/mmsi-mid";

const MAX_VESSELS = 8000;
const FLUSH_MS = 450;
const TRACK_POINTS = 24;

/** AIS IMO / ITU ship type buckets (simplified). */
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
): MerchantCargoVessel | null {
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
  const shipTypeLabel = aisTypeLabel(resolvedType);
  const name = names.get(mmsi) ?? `MMSI ${mmsi}`;

  return {
    id: mmsi,
    mmsi,
    name,
    country: mmsiToCountry(mmsi),
    lat,
    lon,
    sog,
    cog,
    heading,
    shipTypeLabel,
    destination: dest.get(mmsi),
    updatedAt: new Date(),
  };
}

function trimStore(map: Map<string, MerchantCargoVessel>): void {
  if (map.size <= MAX_VESSELS) return;
  const entries = [...map.values()].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const drop = entries.slice(0, map.size - MAX_VESSELS);
  for (const v of drop) map.delete(v.mmsi);
}

export function getMerchantAisWebSocketUrl(): string {
  const configured = String(import.meta.env.VITE_AIS_RELAY_URL ?? "").trim();
  if (configured) return configured;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ais-relay`;
}

export function getMerchantAisSseUrl(): string | null {
  const configured = String(import.meta.env.VITE_AIS_SSE_URL ?? "").trim();
  return configured ? configured : null;
}

/** Supabase Edge Function `ais-sse` — même projet que `environment.ts`. */
export function resolveMerchantAisSseUrl(): string {
  const explicit = getMerchantAisSseUrl();
  if (explicit) return explicit;
  const base = config.supabase.url.replace(/\/$/, "");
  return `${base}/functions/v1/ais-sse`;
}

const SSE_RECONNECT_MS = 3000;

async function consumeAisSseStream(
  body: ReadableStream<Uint8Array>,
  onData: (line: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) break;
      pending += dec.decode(value, { stream: true });
      let sep: number;
      while ((sep = pending.indexOf("\n\n")) !== -1) {
        const block = pending.slice(0, sep);
        pending = pending.slice(sep + 2);
        const trimmed = block.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        for (const line of trimmed.split("\n")) {
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trimStart();
            if (payload) onData(payload);
          }
        }
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

function connectMerchantAisSseFetch(
  url: string,
  onRawMessage: (raw: string) => void,
  onDisconnect: () => void,
): () => void {
  const anonKey = config.supabase.anonKey;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  };
  const token = String(import.meta.env.VITE_AIS_SSE_TOKEN ?? "").trim();
  const requestUrl = token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;

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
      try {
        const res = await fetch(requestUrl, {
          method: "GET",
          headers,
          signal: abort.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) {
          await new Promise((r) => setTimeout(r, SSE_RECONNECT_MS));
          continue;
        }
        await consumeAisSseStream(res.body, onRawMessage, abort.signal);
      } catch {
        /* aborted or network */
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
    onDisconnect();
  };
}

/**
 * Subscribes to the dev AIS relay, parses AIS JSON, and pushes throttled vessel lists.
 * @returns disconnect function
 */
export function connectMerchantAisStream(onUpdate: (vessels: MerchantCargoVessel[]) => void): () => void {
  const byMmsi = new Map<string, MerchantCargoVessel>();
  const names = new Map<string, string>();
  const destinations = new Map<string, string>();
  const staticAisTypeByMmsi = new Map<string, number>();
  const tracksByMmsi = new Map<string, Array<[number, number]>>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const onRawMessage = (raw: string) => {
    const v = parseEnvelope(raw, names, destinations, staticAisTypeByMmsi);
    if (v) {
      const pt: [number, number] = [v.lon, v.lat];
      const track = tracksByMmsi.get(v.mmsi) ?? [];
      const last = track[track.length - 1];
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
        track.push(pt);
        if (track.length > TRACK_POINTS) track.splice(0, track.length - TRACK_POINTS);
        tracksByMmsi.set(v.mmsi, track);
      }
      v.track = tracksByMmsi.get(v.mmsi);
      byMmsi.set(v.mmsi, v);
    }
    scheduleFlush();
  };

  const scheduleFlush = () => {
    if (flushTimer != null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      trimStore(byMmsi);
      onUpdate([...byMmsi.values()]);
    }, FLUSH_MS);
  };

  // ── Production: Supabase Edge `ais-sse` (fetch + stream; EventSource cannot send apikey) ──
  if (!import.meta.env.DEV) {
    const sseUrl = resolveMerchantAisSseUrl();
    return connectMerchantAisSseFetch(sseUrl, onRawMessage, () => {
      if (flushTimer != null) clearTimeout(flushTimer);
    });
  }

  // ── Dev: WebSocket relay (Vite plugin) ─────────────────────────────────────
  let ws: WebSocket;
  try {
    ws = new WebSocket(getMerchantAisWebSocketUrl());
  } catch {
    return () => undefined;
  }

  if (import.meta.env.DEV) {
    ws.addEventListener("open", () => {
      console.debug("[merchant-ais] WebSocket connected to dev relay");
    });
    ws.addEventListener("close", (ev) => {
      if (ev.code === 1000) return;
      // 1005 = no close frame (connection dropped); often relay/upstream closing, not a missing .env key.
      if (ev.code === 1005) {
        console.warn(
          "[merchant-ais] WebSocket closed (1005). Usually the dev relay or AISStream ended the connection — check the terminal for [ais-relay] lines, then restart `npm run dev`.",
        );
        return;
      }
      console.warn(
        "[merchant-ais] WebSocket closed (code=%s). Check terminal [ais-relay] logs, AISSTREAM_API_KEY in .env, cargo layer on, then restart dev.",
        ev.code,
      );
    });
  }

  ws.onmessage = (ev) => {
    onRawMessage(String(ev.data));
  };

  ws.onerror = () => {
    /* dev relay may be unavailable */
  };

  return () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    if (flushTimer != null) clearTimeout(flushTimer);
  };
}
