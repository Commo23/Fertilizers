/**
 * AISStream allows only ONE concurrent WebSocket per API key.
 * This lock coordinates the two Vite dev plugins (ais-relay & ais-mmsi-sse)
 * so they never compete for the single slot.
 *
 * Priority: MMSI tracker (user-initiated, short-lived) takes precedence
 * over ais-relay (background, long-lived).
 */
import { EventEmitter } from "node:events";

const bus = new EventEmitter();
bus.setMaxListeners(20);

let mmsiActive = false;

export function isMmsiActive(): boolean {
  return mmsiActive;
}

export function acquireMmsi(): void {
  mmsiActive = true;
  bus.emit("mmsi:start");
}

export function releaseMmsi(): void {
  mmsiActive = false;
  bus.emit("mmsi:stop");
}

export function onMmsiStart(fn: () => void): void {
  bus.on("mmsi:start", fn);
}

export function onMmsiStop(fn: () => void): void {
  bus.on("mmsi:stop", fn);
}
