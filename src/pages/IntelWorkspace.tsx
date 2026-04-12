import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import ReactGridLayout from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Layout as AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorldMapContent } from "@/pages/WorldMap";
import { MarketNewsContent } from "@/pages/MarketNews";
import {
  COMMODITY_NEWS_SECTIONS,
  CommodityNewsCategoryPanel,
} from "@/pages/CommodityNews";
import { EconomicCalendarContent } from "@/pages/EconomicCalendar";
import { AdvancedChartContent } from "@/pages/AdvancedChart";
import { getEffectivePanelConfig } from "@/config/panels";
import { LiveNewsPanel } from "@/components/LiveNewsPanel";
import { LiveWebcamsPanel } from "@/components/LiveWebcamsPanel";
import { HormuzPanel } from "@/components/Hormuz/HormuzPanel";
import "@/styles/live-news-panel.css";
import "@/styles/live-webcams-panel.css";
import "@/styles/hormuz-panel.css";
import "@/styles/intel-workspace.css";
import { GripVertical, LayoutGrid, RotateCcw } from "lucide-react";
import { loadFromStorage, saveToStorage } from "@/utils";

const STORAGE_KEY = "fx_intel_workspace_layout_v5";

/** Carte, puis Live TV + webcams, puis Market / Calendrier / Hormuz, puis 9 flux commodity, puis graphique avancé (pleine largeur). */
const DEFAULT_LAYOUT: Layout = [
  { i: "world-map", x: 0, y: 0, w: 12, h: 20, minW: 6, minH: 12 },
  { i: "live-news", x: 0, y: 20, w: 6, h: 10, minW: 4, minH: 7 },
  { i: "live-webcams", x: 6, y: 20, w: 6, h: 10, minW: 4, minH: 7 },
  { i: "market-news", x: 0, y: 30, w: 4, h: 10, minW: 3, minH: 7 },
  { i: "economic-calendar", x: 4, y: 30, w: 4, h: 10, minW: 3, minH: 7 },
  { i: "hormuz", x: 8, y: 30, w: 4, h: 10, minW: 3, minH: 7 },
  { i: "commodity-headlines", x: 0, y: 40, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-news", x: 4, y: 40, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-energy", x: 8, y: 40, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-gold-silver", x: 0, y: 49, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-mining-news", x: 4, y: 49, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-mining-companies", x: 8, y: 49, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-supply-chain", x: 0, y: 58, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-regulation", x: 4, y: 58, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "commodity-fertilizer-news", x: 8, y: 58, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "advanced-chart", x: 0, y: 67, w: 12, h: 14, minW: 6, minH: 10 },
];

function loadLayout(): Layout {
  try {
    const raw = loadFromStorage<string>(STORAGE_KEY, "");
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Layout;
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;
    const allowed = new Set(DEFAULT_LAYOUT.map((x) => x.i));
    const byId = new Map(
      parsed.filter((p) => allowed.has(p.i)).map((p) => [p.i, p]),
    );
    return DEFAULT_LAYOUT.map((d) => {
      const s = byId.get(d.i);
      return s ? { ...d, ...s, minW: d.minW, minH: d.minH, maxW: d.maxW, maxH: d.maxH } : d;
    });
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function WorkspacePanelChrome({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "intel-panel flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm",
        className,
      )}
    >
      <div className="intel-drag-handle flex shrink-0 cursor-grab items-center gap-1.5 border-b border-border/60 bg-muted/30 px-2 py-1.5 active:cursor-grabbing">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-xs font-semibold leading-tight text-foreground sm:text-sm">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1.5">{children}</div>
    </div>
  );
}

function LiveNewsEmbed() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const panel = new LiveNewsPanel();
    host.appendChild(panel.getElement());
    return () => {
      panel.destroy();
    };
  }, []);
  return <div ref={hostRef} className="wm-live-root w-full min-h-[180px]" />;
}

function LiveWebcamsEmbed() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const panel = new LiveWebcamsPanel();
    host.appendChild(panel.getElement());
    return () => {
      panel.destroy();
    };
  }, []);
  return <div ref={hostRef} className="wm-live-root w-full min-h-[180px]" />;
}

function HormuzEmbed() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const panel = new HormuzPanel();
    host.appendChild(panel.getElement());
    void panel.fetchData();
    return () => {
      panel.destroy();
    };
  }, []);
  return <div ref={hostRef} className="wm-live-root w-full min-h-[180px]" />;
}

export default function IntelWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [layout, setLayout] = useState<Layout>(() => loadLayout());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const onLayoutChange = useCallback((next: Layout) => {
    setLayout(next);
    saveToStorage(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    saveToStorage(STORAGE_KEY, JSON.stringify(DEFAULT_LAYOUT));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
    return () => window.clearTimeout(t);
  }, [layout]);

  return (
    <AppLayout
      title="Intelligence workspace"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Intelligence workspace" },
      ]}
    >
      <div className="space-y-3 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Intelligence workspace</h1>
              <p className="text-muted-foreground text-sm max-w-3xl">
                Carte en grand, Live TV et webcams, news, calendrier, Hormuz, flux matières premières, graphique avancé
                TradingView — panneaux déplaçables via la poignée ⋮⋮ ; disposition mémorisée sur cet appareil.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetLayout} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser la grille
          </Button>
        </div>

        <div ref={containerRef} className="w-full min-h-[70vh]">
          <ReactGridLayout
            className="intel-workspace-grid"
            width={width}
            layout={layout}
            cols={12}
            rowHeight={26}
            margin={[8, 8]}
            containerPadding={[0, 0]}
            onLayoutChange={onLayoutChange}
            draggableHandle=".intel-drag-handle"
            compactType="vertical"
            preventCollision={false}
            isBounded={false}
            useCSSTransforms
          >
            <div key="world-map" className="min-h-0">
              <WorkspacePanelChrome title="Situation mondiale" className="h-full">
                <WorldMapContent embedded />
              </WorkspacePanelChrome>
            </div>

            <div key="live-news" className="min-h-0">
              <WorkspacePanelChrome title="Live news">
                <LiveNewsEmbed />
              </WorkspacePanelChrome>
            </div>

            <div key="live-webcams" className="min-h-0">
              <WorkspacePanelChrome title="Live webcams">
                <LiveWebcamsEmbed />
              </WorkspacePanelChrome>
            </div>

            <div key="market-news" className="min-h-0">
              <WorkspacePanelChrome title="Market News">
                <MarketNewsContent compact />
              </WorkspacePanelChrome>
            </div>

            <div key="economic-calendar" className="min-h-0">
              <WorkspacePanelChrome title="Economic Calendar">
                <EconomicCalendarContent compact />
              </WorkspacePanelChrome>
            </div>

            <div key="hormuz" className="min-h-0">
              <WorkspacePanelChrome title="Hormuz tracker">
                <HormuzEmbed />
              </WorkspacePanelChrome>
            </div>

            {COMMODITY_NEWS_SECTIONS.map((section) => {
              const { name: commodityTitle } = getEffectivePanelConfig(section.panelKey, "commodity");
              return (
                <div key={section.gridId} className="min-h-0">
                  <WorkspacePanelChrome title={commodityTitle}>
                    <CommodityNewsCategoryPanel section={section} />
                  </WorkspacePanelChrome>
                </div>
              );
            })}

            <div key="advanced-chart" className="min-h-0">
              <WorkspacePanelChrome title="Advanced Chart" className="h-full min-h-[320px]">
                <AdvancedChartContent compact />
              </WorkspacePanelChrome>
            </div>
          </ReactGridLayout>
        </div>
      </div>
    </AppLayout>
  );
}
