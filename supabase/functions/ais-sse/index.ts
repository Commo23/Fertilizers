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

const DEFAULT_BBOX: number[][][] = [[[20, -25], [40, 5]]]; // Morocco + approaches
const DEFAULT_TYPES = [
  "PositionReport",
  "ShipStaticData",
  "ExtendedClassBPositionReport",
  "StandardClassBPositionReport",
];

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

  const apiKey = (Deno.env.get("AISSTREAM_API_KEY") ?? "").trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AISSTREAM_API_KEY missing" }), {
      status: 500,
      headers: { ...baseCors, "Content-Type": "application/json" },
    });
  }

  // Optional shared token gate
  const tokenRequired = (Deno.env.get("AIS_SSE_TOKEN") ?? "").trim();
  if (tokenRequired) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    if (token !== tokenRequired) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }
  }

  const boundingBoxes = jsonOrDefault<number[][][]>(Deno.env.get("AIS_BOUNDING_BOXES"), DEFAULT_BBOX);
  const filterMessageTypes = jsonOrDefault<string[]>(Deno.env.get("AIS_FILTER_MESSAGE_TYPES"), DEFAULT_TYPES);

  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

  /** Set in `start`; used when the HTTP client drops the SSE (ReadableStream cancel). */
  let shutdown: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      let keepAliveId: number | null = null;
      let closed = false;
      let gotAisMessage = false;

      /**
       * Client disconnects are normal for SSE (tab close, reconnect, map layer off).
       * If we enqueue after the socket is gone, Deno logs: "Http: connection closed before message completed".
       */
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

      // Keep-alive comments for SSE proxies
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
            FilterMessageTypes: filterMessageTypes,
          }),
        );
      });

      ws.addEventListener("message", (ev) => {
        const data = typeof ev.data === "string" ? ev.data : "";
        if (!data) return;
        gotAisMessage = true;
        // One SSE event per AIS message
        send(`data: ${data.replace(/\n/g, " ")}\n\n`);
      });

      ws.addEventListener("error", () => {
        /* `close` follows with WebSocket close code (TLS, auth, etc.) */
      });

      ws.addEventListener("close", (ev) => {
        if (!gotAisMessage) {
          const ce = ev as CloseEvent;
          const payload = JSON.stringify({
            kind: "aisstream_close",
            code: ce.code,
            reason: typeof ce.reason === "string" ? ce.reason : "",
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

