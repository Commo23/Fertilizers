import { useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { HormuzPanel } from "@/components/Hormuz/HormuzPanel";
import "@/styles/live-news-panel.css";
import "@/styles/hormuz-panel.css";
import { Ship } from "lucide-react";

export default function HormuzTracker() {
  const hostRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HormuzPanel | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const panel = new HormuzPanel();
    panelRef.current = panel;
    host.appendChild(panel.getElement());
    void panel.fetchData();

    return () => {
      panel.destroy();
      panelRef.current = null;
    };
  }, []);

  return (
    <Layout
      title="Hormuz Trade Tracker"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Hormuz Trade Tracker" },
      ]}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Ship className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Hormuz Trade Tracker</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Indicateurs synthétiques des flux (crude, LNG, transits, fertilizer) au détroit d’Ormuz,
          servis par une Edge Function Supabase.
        </p>
        <div ref={hostRef} className="wm-live-root w-full" />
      </div>
    </Layout>
  );
}

