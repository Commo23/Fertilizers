/**
 * Dev-only SSE relay for MMSI AIS (same role as Supabase `ais-mmsi-sse`).
 * Reads AISSTREAM_API_KEY + AIS_MMSI_BOUNDING_BOXES from `.env` via `loadEnv` — no Supabase secrets needed locally.
 */
import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import { WebSocket } from "ws";
import { acquireMmsi, releaseMmsi } from "./ais-connection-lock.js";

function jsonOrDefault<T>(value: string | undefined, fallback: T): T {
  try {
    if (!value?.trim()) return fallback;
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

function parseMmsiQuery(search: string): string[] {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const raw = (params.get("mmsi") ?? "").trim();
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

export function aisMmsiSseRelayPlugin(): Plugin {
  return {
    name: "ais-mmsi-sse-relay",
    enforce: "pre",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const fullUrl = req.url ?? "";
        const path = fullUrl.split("?")[0]?.replace(/\/$/, "") ?? "";
        if (path !== "/api/ais-mmsi-sse") {
          next();
          return;
        }

        const env = loadEnv(server.config.mode, server.config.envDir, "");
        const log = server.config.logger;

        const setCors = () => {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, apikey, x-client-info, x-supabase-authorization",
          );
        };

        if (req.method === "OPTIONS") {
          setCors();
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== "GET") {
          setCors();
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const u = new URL(fullUrl, "http://localhost");
        const mmsiList = parseMmsiQuery(u.search);
        if (mmsiList.length === 0) {
          setCors();
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing or invalid mmsi", hint: "9 digits each" }));
          return;
        }

        const apiKey = (env.AISSTREAM_API_KEY || process.env.AISSTREAM_API_KEY)?.trim();
        if (!apiKey) {
          setCors();
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "AISSTREAM_API_KEY missing",
              hint: "Add AISSTREAM_API_KEY to .env (project root), restart npm run dev",
            }),
          );
          return;
        }

        const boundingBoxes = jsonOrDefault<number[][][]>(env.AIS_MMSI_BOUNDING_BOXES, DEFAULT_BBOX);

        setCors();
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        acquireMmsi();
        log.info("[ais-mmsi-sse] Acquired AISStream lock — waiting for relay to release…");

        await new Promise((r) => setTimeout(r, 3000));

        const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
        let ended = false;
        let gotAisMessage = false;

        const endRes = () => {
          if (ended) return;
          ended = true;
          releaseMmsi();
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          try {
            res.end();
          } catch {
            /* ignore */
          }
        };

        const send = (chunk: string) => {
          if (ended) return;
          try {
            res.write(chunk);
          } catch {
            endRes();
          }
        };

        const keepAlive = setInterval(() => {
          send(`: ping ${Date.now()}\n\n`);
        }, 15_000);

        req.on("close", () => {
          clearInterval(keepAlive);
          endRes();
        });

        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              Apikey: apiKey,
              BoundingBoxes: boundingBoxes,
              FiltersShipMMSI: mmsiList,
              FilterMessageTypes: DEFAULT_TYPES,
            }),
          );
          log.info(`[ais-mmsi-sse] subscribe mmsi=${mmsiList.join(",")} bbox=${JSON.stringify(boundingBoxes)}`);
        });

        ws.on("message", (data) => {
          const s = data.toString();
          if (!s) return;
          if (!gotAisMessage) {
            log.info(`[ais-mmsi-sse] first upstream message (${s.length} bytes): ${s.slice(0, 300)}`);
          }
          try {
            const j = JSON.parse(s) as Record<string, unknown>;
            const hasAis = typeof j.MessageType === "string";
            if (!hasAis) {
              const err =
                (typeof j.Error === "string" && j.Error) ||
                (typeof j.error === "string" && j.error) ||
                (typeof j.Message === "string" && j.Message);
              if (err) {
                log.warn(`[ais-mmsi-sse] AISStream error: ${err}`);
                send(
                  `event: error\ndata: ${JSON.stringify({ kind: "aisstream_error", message: String(err) })}\n\n`,
                );
                clearInterval(keepAlive);
                endRes();
                return;
              }
              log.warn(`[ais-mmsi-sse] unknown upstream JSON: ${s.slice(0, 300)}`);
            }
          } catch {
            log.warn(`[ais-mmsi-sse] non-JSON upstream: ${s.slice(0, 200)}`);
          }
          gotAisMessage = true;
          send(`data: ${s.replace(/\n/g, " ")}\n\n`);
        });

        ws.on("close", (code, reason) => {
          clearInterval(keepAlive);
          const c = typeof code === "number" ? code : 0;
          const r = reason instanceof Buffer ? reason.toString() : String(reason ?? "");
          log.warn(`[ais-mmsi-sse] WS closed: code=${c} reason="${r}" gotData=${gotAisMessage}`);
          if (!ended && !gotAisMessage) {
            const finalCode = c === 0 ? 1006 : c;
            send(
              `event: error\ndata: ${JSON.stringify({
                kind: "aisstream_close",
                code: finalCode,
                reason: r,
                hint:
                  "[dev relay] Upstream closed before any AIS message — check AISSTREAM_API_KEY and AIS_MMSI_BOUNDING_BOXES in .env",
              })}\n\n`,
            );
          }
          endRes();
        });

        ws.on("error", (err) => {
          clearInterval(keepAlive);
          log.warn(`[ais-mmsi-sse] WS error: ${err instanceof Error ? err.message : String(err)}`);
          if (!ended && !gotAisMessage) {
            send(
              `event: error\ndata: ${JSON.stringify({
                kind: "aisstream_close",
                code: 1006,
                reason: "websocket error",
                hint: "[dev relay] AISStream WebSocket error — check AISSTREAM_API_KEY in .env",
              })}\n\n`,
            );
          }
          endRes();
        });
      });
    },
  };
}
