import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TradingViewAdvancedChart from "@/components/TradingViewAdvancedChart";
import { BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function AdvancedChartContent({ compact }: { compact?: boolean }) {
  const [symbol, setSymbol] = useState("TVC:GOLD");
  const [interval, setInterval] = useState("D");
  const [height, setHeight] = useState(600);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const [embedHeight, setEmbedHeight] = useState(400);

  useEffect(() => {
    if (!compact || !chartBoxRef.current) return;
    const el = chartBoxRef.current;
    const ro = new ResizeObserver(() => {
      setEmbedHeight(Math.max(260, Math.floor(el.clientHeight)));
    });
    ro.observe(el);
    setEmbedHeight(Math.max(260, Math.floor(el.clientHeight)));
    return () => ro.disconnect();
  }, [compact]);

  const tvHeight = compact ? embedHeight : height;

  return (
    <div className={cn("space-y-6", compact && "flex h-full min-h-0 flex-col overflow-hidden space-y-3")}>
      {!compact && (
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <BarChart3 className="h-8 w-8 shrink-0 text-primary" />
            Advanced Chart
          </h1>
        </div>
      )}

      <Card
        className={cn(
          "shadow-md",
          compact && "flex min-h-0 flex-1 flex-col overflow-hidden border-border/60",
        )}
      >
        {!compact && (
          <CardHeader className="border-b pb-2">
            <CardTitle className="text-xl font-bold text-primary">Trading Chart</CardTitle>
            <CardDescription>
              Real-time chart with technical indicators, drawing tools, and market analysis
            </CardDescription>
          </CardHeader>
        )}
        <CardContent
          className={cn(
            "space-y-4",
            compact ? "flex min-h-0 flex-1 flex-col overflow-auto p-2 pt-2" : "pt-6",
          )}
        >
          <div
            className={cn(
              "grid grid-cols-1 gap-4 border-b pb-4 md:grid-cols-3",
              compact && "grid-cols-1 gap-2 border-border/50 pb-2 sm:grid-cols-3",
            )}
          >
            <div className="space-y-2">
              <Label htmlFor={compact ? "adv-symbol-embed" : "symbol"}>Symbol</Label>
              <Input
                id={compact ? "adv-symbol-embed" : "symbol"}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="TVC:GOLD"
                className="font-mono"
              />
              {!compact && (
                <p className="text-xs text-muted-foreground">
                  Format: EXCHANGE:SYMBOL (e.g., TVC:GOLD, NYMEX:CL1!)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={compact ? "adv-interval-embed" : "interval"}>Interval</Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger id={compact ? "adv-interval-embed" : "interval"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="D">Daily</SelectItem>
                  <SelectItem value="W">Weekly</SelectItem>
                  <SelectItem value="M">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!compact && (
              <div className="space-y-2">
                <Label htmlFor="height">Chart Height (px)</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value, 10) || 600)}
                  min={400}
                  max={1000}
                  step={50}
                />
              </div>
            )}
          </div>

          <div
            ref={chartBoxRef}
            className={cn("w-full overflow-hidden", compact ? "min-h-[260px] flex-1" : "")}
            style={!compact ? { height: `${height}px` } : undefined}
          >
            <TradingViewAdvancedChart symbol={symbol} interval={interval} height={tvHeight} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdvancedChart() {
  return (
    <Layout
      title="Advanced Chart"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Advanced Chart" },
      ]}
    >
      <AdvancedChartContent />
    </Layout>
  );
}
