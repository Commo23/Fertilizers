/// <reference path="../supabase-edge.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function corsHeaders(origin: string | null) {
  const allowOrigin = origin ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info, x-supabase-authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

function jsonOrDefault<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_BBOX: number[][][] = [
  [[30, -80], [60, 0]],
  [[25, -5], [50, 45]],
  [[-10, -70], [30, 20]],
  [[-10, 30], [35, 80]],
  [[0, 80], [50, 145]],
  [[10, -180], [60, -100]],
];

const DEFAULT_TYPES = [
  "PositionReport",
  "ShipStaticData",
  "ExtendedClassBPositionReport",
  "StandardClassBPositionReport",
];

const MAX_MMSI = 50;

/** AISStream OpenAPI: FiltersShipMMSI entries are length 9. */
function parseMmsiQuery(url: URL): string[] {
  const raw = (url.searchParams.get("mmsi") ?? "").trim();
  const tokens = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!/^\d{9}$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_MMSI) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const baseCors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: baseCors });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...baseCors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const mmsiList = parseMmsiQuery(url);
  if (mmsiList.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Missing or invalid mmsi",
        hint: "Use ?mmsi=123456789,987654321 (exactly 9 digits per MMSI, max 50)",
      }),
      { status: 400, headers: { ...baseCors, "Content-Type": "application/json" } },
    );
  }

  const apiKey = (Deno.env.get("AISSTREAM_API_KEY") ?? "").trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AISSTREAM_API_KEY missing" }), {
      status: 500,
      headers: { ...baseCors, "Content-Type": "application/json" },
    });
  }

  const tokenRequired = (Deno.env.get("AIS_SSE_TOKEN") ?? "").trim();
  if (tokenRequired) {
    const token = url.searchParams.get("token") ?? "";
    if (token !== tokenRequired) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }
  }

  const boundingBoxes = jsonOrDefault<number[][][]>(
    Deno.env.get("AIS_MMSI_BOUNDING_BOXES"),
    DEFAULT_BBOX,
  );

  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

  let shutdown: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      let keepAliveId: number | null = null;
      let closed = false;
      let gotAisMessage = false;

      const send = (chunk: string) => {
        if (closed || req.signal.aborted) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          closeAll();
        }
      };

      const closeAll = () => {
        if (closed) return;
        closed = true;
        try {
          if (keepAliveId != null) clearInterval(keepAliveId);
        } catch {
          /* ignore */
        }
        keepAliveId = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      shutdown = closeAll;
      req.signal.addEventListener("abort", closeAll);

      keepAliveId = setInterval(() => {
        if (closed || req.signal.aborted) {
          closeAll();
          return;
        }
        send(`: ping ${Date.now()}\n\n`);
      }, 15000) as unknown as number;

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            Apikey: apiKey,
            BoundingBoxes: boundingBoxes,
            FiltersShipMMSI: mmsiList,
            FilterMessageTypes: DEFAULT_TYPES,
          }),
        );
      });

      ws.addEventListener("message", (ev) => {
        const data = typeof ev.data === "string" ? ev.data : "";
        if (!data) return;
        try {
          const j = JSON.parse(data) as Record<string, unknown>;
          const hasAis = typeof j.MessageType === "string";
          if (!hasAis) {
            const err =
              (typeof j.Error === "string" && j.Error) ||
              (typeof j.error === "string" && j.error) ||
              (typeof j.Message === "string" && j.Message);
            if (err) {
              send(
                `event: error\ndata: ${JSON.stringify({
                  kind: "aisstream_error",
                  message: String(err),
                })}\n\n`,
              );
              closeAll();
              return;
            }
          }
        } catch {
          /* non-JSON or AIS binary — treat as raw below */
        }
        gotAisMessage = true;
        send(`data: ${data.replace(/\n/g, " ")}\n\n`);
      });

      ws.addEventListener("error", () => {});

      ws.addEventListener("close", (ev) => {
        if (!gotAisMessage) {
          const ce = ev as CloseEvent;
          let code = typeof ce.code === "number" ? ce.code : 0;
          const reason = typeof ce.reason === "string" ? ce.reason : "";
          /** Deno often reports `code === 0` when the close frame isn’t surfaced; treat as abnormal. */
          if (code === 0) code = 1006;
          const payload = JSON.stringify({
            kind: "aisstream_close",
            code,
            reason,
            rawCode: typeof ce.code === "number" ? ce.code : undefined,
            hint:
              "Upstream closed before any AIS message: invalid API key, subscription rejected, or bbox/MMSI mismatch. " +
              "Confirm AISSTREAM_API_KEY; set secret AIS_MMSI_BOUNDING_BOXES (JSON) to cover the vessel’s area if needed.",
          });
          send(`event: error\ndata: ${payload}\n\n`);
        }
        closeAll();
      });
    },
    cancel() {
      shutdown();
    },
  });

  return new Response(stream, {
    headers: {
      ...baseCors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
