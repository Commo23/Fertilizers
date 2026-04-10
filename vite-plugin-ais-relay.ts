/**
 * Dev-only WebSocket relay to AISStream (aisstream.io).
 * API keys must not be exposed in the browser — the relay runs in Node and reads AISSTREAM_API_KEY.
 *
 * Note: Variables from `.env` are NOT reliably on `process.env` inside plugin hooks — use Vite's `loadEnv`.
 *
 * Implementation: one shared `WebSocketServer` (noServer: true) + `prependListener('upgrade')` so the
 * socket is upgraded exactly once (creating a new WSS per request breaks ws / duplicate handlers).
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Single small bbox keeps AIS traffic low (avoids AISStream closing with 1006 on overload).
 * Morocco (example) + nearby approaches (Atlantic / Gibraltar / western Med):
 * ~SW [20°N, 25°W] — NE [40°N, 5°E].
 * Format: [[[lat1, lon1], [lat2, lon2]]] — corner order is irrelevant.
 */
const DEFAULT_BOUNDING_BOXES: number[][][] = [
  [
    [20.0, -25.0],
    [40.0, 5.0],
  ],
];

const POSITION_MESSAGE_TYPES = [
  "PositionReport",
  "ShipStaticData",
  "ExtendedClassBPositionReport",
  "StandardClassBPositionReport",
] as const;

export function aisRelayPlugin(): Plugin {
  return {
    name: "ais-relay",
    enforce: "pre",
    configureServer(server: ViteDevServer) {
      const resolveAisstreamApiKey = (): string | undefined => {
        const fromEnvFile = loadEnv(server.config.mode, server.config.envDir, "");
        return (
          fromEnvFile.AISSTREAM_API_KEY ||
          process.env.AISSTREAM_API_KEY
        )?.trim() || undefined;
      };

      const wss = new WebSocketServer({ noServer: true });

      wss.on("connection", (clientWs) => {
        const apiKey = resolveAisstreamApiKey();
        if (!apiKey) {
          clientWs.close(1011, "AISSTREAM_API_KEY missing");
          return;
        }

        const log = server.config.logger;
        const keyPreview = apiKey.slice(0, 6) + "…";
        let upstream: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let attempt = 0;
        let msgCount = 0;

        const connectUpstream = () => {
          attempt++;
          log.info(`[ais-relay] Connecting to AISStream (attempt ${attempt}, key=${keyPreview})…`);
          const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
          upstream = ws;

          ws.on("open", () => {
            log.info("[ais-relay] Upstream OPEN — sending subscription…");
            const payload = {
              APIKey: apiKey,
              BoundingBoxes: DEFAULT_BOUNDING_BOXES,
              FilterMessageTypes: [...POSITION_MESSAGE_TYPES],
            };
            log.info(
              `[ais-relay] Subscribe bbox=${JSON.stringify(payload.BoundingBoxes)} types=${payload.FilterMessageTypes.join(",")}`,
            );
            ws.send(JSON.stringify(payload));
            attempt = 0;
            msgCount = 0;
          });

          ws.on("message", (data) => {
            msgCount++;
            if (msgCount <= 3) {
              const snippet = data.toString().slice(0, 200);
              log.info(`[ais-relay] msg #${msgCount}: ${snippet}`);
            }
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(data.toString());
            }
          });

          ws.on("close", (code, reason) => {
            const r = reason instanceof Buffer ? reason.toString() : String(reason ?? "");
            log.info(`[ais-relay] Upstream closed code=${code} reason=${r} (after ${msgCount} msgs)`);
            if (code === 1006) {
              log.warn(
                "[ais-relay] 1006 = abnormal close. Possible causes: invalid API key, AISStream rate-limit, or network drop.",
              );
            }
            scheduleReconnect();
          });

          ws.on("error", (err) => {
            log.warn(`[ais-relay] Upstream error: ${err instanceof Error ? err.message : String(err)}`);
          });
        };

        const scheduleReconnect = () => {
          if (clientWs.readyState !== WebSocket.OPEN) return;
          const delay = Math.min(2000 * Math.pow(2, attempt), 30_000);
          log.info(`[ais-relay] Will reconnect in ${delay}ms (attempt ${attempt + 1})…`);
          reconnectTimer = setTimeout(() => {
            if (clientWs.readyState === WebSocket.OPEN) connectUpstream();
          }, delay);
        };

        connectUpstream();

        clientWs.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString()) as {
              type?: string;
              boundingBoxes?: number[][][];
            };
            if (
              msg.type === "subscribe" &&
              Array.isArray(msg.boundingBoxes) &&
              msg.boundingBoxes.length > 0 &&
              upstream?.readyState === WebSocket.OPEN
            ) {
              const payload = {
                APIKey: apiKey,
                BoundingBoxes: msg.boundingBoxes,
                FilterMessageTypes: [...POSITION_MESSAGE_TYPES],
              };
              upstream.send(JSON.stringify(payload));
            }
          } catch {
            /* ignore */
          }
        });

        const cleanup = () => {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          try { upstream?.close(); } catch { /* ignore */ }
        };

        clientWs.on("close", cleanup);
        clientWs.on("error", cleanup);
      });

      server.httpServer?.prependListener(
        "upgrade",
        (req: IncomingMessage, socket: Duplex, head: Buffer) => {
          const rawPath = req.url?.split("?")[0] ?? "";
          const path = rawPath.replace(/\/$/, "") || "/";
          if (path !== "/api/ais-relay") return;

          const apiKey = resolveAisstreamApiKey();
          if (!apiKey) {
            server.config.logger.warn(
              "[ais-relay] AISSTREAM_API_KEY missing — add it to .env (project root), then restart `npm run dev`.",
            );
            socket.write("HTTP/1.1 503 AISSTREAM_API_KEY missing\r\nConnection: close\r\n\r\n");
            socket.destroy();
            return;
          }

          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        },
      );
    },
  };
}
