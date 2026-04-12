import { useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { LiveWebcamsPanel } from "@/components/LiveWebcamsPanel";
import "@/styles/live-news-panel.css";
import "@/styles/live-webcams-panel.css";
import { Video } from "lucide-react";

export default function LiveWebcams() {
  const hostRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<LiveWebcamsPanel | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const panel = new LiveWebcamsPanel();
    panelRef.current = panel;
    host.appendChild(panel.getElement());

    return () => {
      panel.destroy();
      panelRef.current = null;
    };
  }, []);

  return (
    <Layout
      title="Webcams en direct"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Webcams en direct" },
      ]}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Video className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Webcams en direct</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Grille de flux YouTube (régions, vue grille/liste), même logique que WorldMonitor — préférences
          stockées localement.
        </p>
        <div ref={hostRef} className="wm-live-root w-full" />
      </div>
    </Layout>
  );
}
