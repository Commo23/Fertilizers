import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/styles/world-map.css";
import { MapContainer } from "@/components/map/MapContainer";
import {
  DEFAULT_MAP_LAYERS,
  MOBILE_DEFAULT_MAP_LAYERS,
  STORAGE_KEYS,
} from "@/config";
import { isMobileDevice, loadFromStorage, saveToStorage } from "@/utils";
import { cn } from "@/lib/utils";
import { Globe, Maximize2, Minimize2 } from "lucide-react";
import { fetchEarthquakes } from "@/services/earthquakes";
import { fetchNaturalEvents } from "@/services/eonet";
import { connectMerchantAisStream } from "@/services/merchant-ais";
import type { MerchantCargoVessel } from "@/types";

const LIVE_DATA_INTERVAL_MS = 5 * 60 * 1000;

export default function WorldMap() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapContainer | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const [mapReady, setMapReady] = useState(false);
  const [isGlobe, setIsGlobe] = useState(
    () => loadFromStorage<string>(STORAGE_KEYS.mapMode, "flat") === "globe",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cargoVessels, setCargoVessels] = useState<MerchantCargoVessel[]>([]);
  const [cargoQuery, setCargoQuery] = useState("");
  const [cargoResultsOpen, setCargoResultsOpen] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const preferGlobe =
      loadFromStorage<string>(STORAGE_KEYS.mapMode, "flat") === "globe";
    const mobile = isMobileDevice();

    const map = new MapContainer(
      host,
      {
        zoom: mobile ? 2.5 : 1.0,
        pan: { x: 0, y: 0 },
        view: "global",
        layers: mobile ? MOBILE_DEFAULT_MAP_LAYERS : DEFAULT_MAP_LAYERS,
        timeRange: "7d",
      },
      preferGlobe,
    );
    mapRef.current = map;
    map.initEscalationGetters();
    setIsGlobe(map.isGlobeMode());
    setMapReady(true);

    return () => {
      setMapReady(false);
      map.destroy();
      mapRef.current = null;
    };
  }, []);

  /** Séismes (USGS) + événements naturels (NASA EONET) sans clé API si pas d’API WorldMonitor. */
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [eq, nat] = await Promise.all([
          fetchEarthquakes(),
          fetchNaturalEvents(14),
        ]);
        if (cancelled) return;
        const m = mapRef.current;
        if (!m) return;
        m.setEarthquakes(eq);
        m.setNaturalEvents(nat);
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[WorldMap] données live", e);
      }
    };

    void load();
    const id = window.setInterval(load, LIVE_DATA_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mapReady]);

  /** Cargo / tanker AIS (AISStream via Vite relay — set env `AISSTREAM_API_KEY` for `npm run dev`). */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let disconnect: (() => void) | undefined;

    const apply = () => {
      disconnect?.();
      disconnect = undefined;
      if (map.getState().layers.cargoShips) {
        disconnect = connectMerchantAisStream((vessels) => {
          setCargoVessels(vessels);
          mapRef.current?.setMerchantCargoVessels(vessels);
        });
      } else {
        setCargoVessels([]);
        map.setMerchantCargoVessels([]);
      }
    };

    apply();
    map.setOnLayerChange((layer) => {
      if (layer === "cargoShips") apply();
    });

    return () => {
      disconnect?.();
      setCargoVessels([]);
      map.setMerchantCargoVessels([]);
    };
  }, [mapReady]);

  const cargoResults = useMemo(() => {
    const q = cargoQuery.trim().toLowerCase();
    if (!q) return [] as MerchantCargoVessel[];
    const matches = (v: MerchantCargoVessel) => {
      const name = (v.name ?? "").toLowerCase();
      const mmsi = (v.mmsi ?? "").toLowerCase();
      const dest = (v.destination ?? "").toLowerCase();
      const type = (v.shipTypeLabel ?? "").toLowerCase();
      return (
        name.includes(q) ||
        mmsi.includes(q) ||
        dest.includes(q) ||
        type.includes(q)
      );
    };
    return cargoVessels.filter(matches).slice(0, 12);
  }, [cargoQuery, cargoVessels]);

  const focusCargo = useCallback((v: MerchantCargoVessel) => {
    setCargoResultsOpen(false);
    const map = mapRef.current;
    if (!map) return;
    // Works for 2D + globe (MapContainer delegates internally).
    map.setCenter(v.lat, v.lon, 4.2);
  }, []);

  const scheduleResize = useCallback(() => {
    requestAnimationFrame(() => {
      mapRef.current?.resize();
      requestAnimationFrame(() => mapRef.current?.resize());
    });
  }, []);

  const handleDimension = useCallback(
    (mode: "flat" | "globe") => {
      const map = mapRef.current;
      if (!map) return;
      const wantGlobe = mode === "globe";
      if (wantGlobe === map.isGlobeMode()) return;

      saveToStorage(STORAGE_KEYS.mapMode, wantGlobe ? "globe" : "flat");
      setIsGlobe(wantGlobe);
      if (wantGlobe) map.switchToGlobe();
      else map.switchToFlat();
      scheduleResize();
    },
    [scheduleResize],
  );

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
    scheduleResize();
  }, [scheduleResize]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
        scheduleResize();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, scheduleResize]);

  return (
    <Layout
      title="Situation mondiale"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Situation mondiale" },
      ]}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-8 w-8 text-primary shrink-0" />
          <h1 className="text-3xl font-bold text-foreground">Situation mondiale</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Carte 2D (DeckGL / SVG) ou globe 3D (globe.gl). Le choix est mémorisé comme dans WorldMonitor.
        </p>

        <div
          ref={sectionRef}
          className={cn(
            "world-map-section flex flex-col gap-2 min-h-0",
            isFullscreen && "world-map-section--fullscreen",
          )}
        >
          <div className="world-map-toolbar flex flex-wrap items-center justify-end gap-1 shrink-0">
            <div className="relative mr-auto min-w-[240px] max-w-[420px] w-full sm:w-auto">
              <input
                value={cargoQuery}
                onChange={(e) => {
                  setCargoQuery(e.target.value);
                  setCargoResultsOpen(true);
                }}
                onFocus={() => setCargoResultsOpen(true)}
                onBlur={() => {
                  // Let click on a result register.
                  window.setTimeout(() => setCargoResultsOpen(false), 120);
                }}
                disabled={!mapReady || !mapRef.current?.getState().layers.cargoShips}
                placeholder={
                  mapRef.current?.getState().layers.cargoShips
                    ? "Search cargo (name, MMSI, destination)…"
                    : "Enable “Live cargo AIS” layer to search…"
                }
                className={cn(
                  "h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none",
                  "focus:ring-2 focus:ring-primary/30",
                  (!mapReady || !mapRef.current?.getState().layers.cargoShips) &&
                    "opacity-60",
                )}
              />

              {cargoResultsOpen && cargoQuery.trim() && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-md border border-border bg-card shadow-lg">
                  {cargoResults.length === 0 ? (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">
                      Aucun cargo trouvé (dans {cargoVessels.length} navires en cache).
                    </div>
                  ) : (
                    <div className="max-h-[260px] overflow-auto">
                      {cargoResults.map((v) => (
                        <button
                          key={v.mmsi}
                          type="button"
                          className="w-full px-2.5 py-2 text-left text-xs hover:bg-muted/70"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => focusCargo(v)}
                          title="Centrer la carte sur ce navire"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-foreground truncate">
                              {v.name || `MMSI ${v.mmsi}`}
                            </div>
                            <div className="text-[11px] text-muted-foreground shrink-0">
                              {v.shipTypeLabel ?? "Vessel"}
                            </div>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <div className="truncate">
                              {v.destination ? `→ ${v.destination}` : `MMSI ${v.mmsi}`}
                            </div>
                            <div className="shrink-0">
                              {v.lat.toFixed(2)}, {v.lon.toFixed(2)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              className="map-dimension-toggle inline-flex rounded-md border border-border bg-card overflow-hidden"
              role="group"
              aria-label="Mode carte"
            >
              <button
                type="button"
                className={cn(
                  "map-dim-btn px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors",
                  !isGlobe
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
                disabled={!mapReady}
                title="Carte 2D (plate)"
                onClick={() => handleDimension("flat")}
              >
                2D
              </button>
              <button
                type="button"
                className={cn(
                  "map-dim-btn px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors border-l border-border",
                  isGlobe
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
                disabled={!mapReady}
                title="Globe 3D"
                onClick={() => handleDimension("globe")}
              >
                3D
              </button>
            </div>
            <button
              type="button"
              className="map-pin-btn inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </div>

          <div
            ref={hostRef}
            className={cn(
              "world-map-host w-full border bg-card",
              isFullscreen && "world-map-host--flex-fill",
            )}
          />
        </div>
      </div>
    </Layout>
  );
}
