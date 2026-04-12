import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import TradingViewWidget from "@/components/TradingViewWidget";
import { Newspaper } from "lucide-react";

export function MarketNewsContent({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2 h-full min-h-0 flex flex-col" : "space-y-6"}>
      {!compact && (
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="h-8 w-8 text-primary" />
            Market News
          </h1>
        </div>
      )}

      <Card
        className={cn(
          "shadow-md border-border/60",
          compact && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        {!compact && (
          <CardHeader className="shrink-0 border-b pb-2">
            <CardTitle className="text-xl font-bold text-primary">Market News</CardTitle>
          </CardHeader>
        )}
        <CardContent
          className={cn(
            "w-full overflow-hidden",
            compact ? "min-h-0 flex-1 overflow-auto p-2 pt-2" : "pt-6",
          )}
        >
          <TradingViewWidget />
        </CardContent>
      </Card>
    </div>
  );
}

export default function MarketNews() {
  return (
    <Layout
      title="Market News"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Market News" }
      ]}
    >
      <MarketNewsContent />
    </Layout>
  );
}

