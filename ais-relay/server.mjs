import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const AISSTREAM_API_KEY = String(process.env.AISSTREAM_API_KEY || '').trim();
const DEFAULT_BBOX = [[[20, -25], [40, 5]]]; // Morocco + approaches
const DEFAULT_TYPES = [
  'PositionReport',
  'ShipStaticData',
  'ExtendedClassBPositionReport',
  'StandardClassBPositionReport',
];

function jsonOrDefault(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const BOUNDING_BOXES = jsonOrDefault(process.env.AIS_BOUNDING_BOXES, DEFAULT_BBOX);
const FILTER_MESSAGE_TYPES = jsonOrDefault(process.env.AIS_FILTER_MESSAGE_TYPES, DEFAULT_TYPES);

if (!AISSTREAM_API_KEY) {
  // eslint-disable-next-line no-console
  console.error('[ais-relay] Missing AISSTREAM_API_KEY env var');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (clientWs) => {
  let upstream = null;
  let msgCount = 0;

  const connectUpstream = () => {
    upstream = new WebSocket('wss://stream.aisstream.io/v0/stream');
    upstream.on('open', () => {
      const payload = {
        APIKey: AISSTREAM_API_KEY,
        BoundingBoxes: BOUNDING_BOXES,
        FilterMessageTypes: FILTER_MESSAGE_TYPES,
      };
      upstream.send(JSON.stringify(payload));
    });
    upstream.on('message', (data) => {
      msgCount++;
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data.toString());
    });
    upstream.on('close', (code) => {
      try {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close(code === 1000 ? 1000 : 1011);
      } catch {}
    });
    upstream.on('error', () => {});
  };

  connectUpstream();

  clientWs.on('close', () => {
    try { upstream?.close(); } catch {}
  });
  clientWs.on('error', () => {
    try { upstream?.close(); } catch {}
  });
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url?.split('?')[0] || '/';
  if (url !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ais-relay] listening on :${PORT} (ws path /ws)`);
});

