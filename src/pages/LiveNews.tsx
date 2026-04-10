import { useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { LiveNewsPanel } from "@/components/LiveNewsPanel";
import "@/styles/live-news-panel.css";
import { Radio } from "lucide-react";

export default function LiveNews() {
  const hostRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<LiveNewsPanel | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const panel = new LiveNewsPanel();
    panelRef.current = panel;
    host.appendChild(panel.getElement());

    return () => {
      panel.destroy();
      panelRef.current = null;
    };
  }, []);

  return (
    <Layout
      title="Actualités en direct"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Live news" },
      ]}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Radio className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Actualités en direct</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Chaînes d’information en continu (YouTube / flux) via le même mécanisme que WorldMonitor.
          Les flux sont résolus par l’API publique (par défaut world-watcher) ; vous pouvez surcharger
          l’URL avec <code className="text-xs bg-muted px-1 rounded">VITE_LIVE_NEWS_API_BASE</code>.
        </p>
        <div ref={hostRef} className="wm-live-root w-full" />
      </div>
    </Layout>
  );
}
