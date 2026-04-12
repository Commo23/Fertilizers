import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TradingViewEconomicCalendar from "@/components/TradingViewEconomicCalendar";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

export function EconomicCalendarContent({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2 h-full min-h-0 flex flex-col" : "space-y-6"}>
      {!compact && (
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-8 w-8 text-primary" />
            Economic Calendar
          </h1>
          <p className="text-muted-foreground mt-2">
            Track important economic events and indicators that impact commodity markets
          </p>
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
            <CardTitle className="text-xl font-bold text-primary">Global Economic Calendar</CardTitle>
            <CardDescription className="text-sm">
              Real-time economic events, indicators, and announcements from major economies worldwide
            </CardDescription>
          </CardHeader>
        )}
        <CardContent
          className={cn(
            "w-full overflow-hidden",
            compact ? "min-h-0 flex-1 overflow-auto p-2 pt-2" : "pt-6",
          )}
        >
          <TradingViewEconomicCalendar />
        </CardContent>
      </Card>
    </div>
  );
}

export default function EconomicCalendar() {
  return (
    <Layout
      title="Economic Calendar"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Economic Calendar" }
      ]}
    >
      <EconomicCalendarContent />
    </Layout>
  );
}

