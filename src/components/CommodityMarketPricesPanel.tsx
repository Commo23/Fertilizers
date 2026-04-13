import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Ship, Fuel, Wheat, Sprout } from "lucide-react";
import { Commodity, CommodityCategory, fetchCommoditiesData, refreshCommoditiesData } from "@/services/commodityApi";
import { WORLD_BANK_CATEGORIES, WorldBankCommodity, fetchWorldBankDataByCategory } from "@/services/worldBankApi";

type TabKey = "agricultural" | "freight" | "bunker" | "fertilizers";

const TAB_META: Record<TabKey, { label: string; icon: React.ComponentType<{ className?: string }>; category?: CommodityCategory }> =
  {
    agricultural: { label: "Agricultural", icon: Wheat, category: "agricultural" },
    freight: { label: "Freight", icon: Ship, category: "freight" },
    bunker: { label: "Bunker", icon: Fuel, category: "bunker" },
    fertilizers: { label: "Fertilizers (World Bank)", icon: Sprout },
  };

function LoadingTable({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function CommodityMarketPricesPanel({ defaultTab = "agricultural" }: { defaultTab?: TabKey }) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  const [data, setData] = useState<Record<CommodityCategory, Commodity[]>>({
    metals: [],
    agricultural: [],
    energy: [],
    freight: [],
    bunker: [],
  });
  const [fertilizers, setFertilizers] = useState<WorldBankCommodity[]>([]);

  const [loading, setLoading] = useState<Record<TabKey, boolean>>({
    agricultural: true,
    freight: true,
    bunker: true,
    fertilizers: true,
  });

  const loadCommodityCategory = async (category: CommodityCategory, forceRefresh: boolean) => {
    const tabKey = category as Exclude<TabKey, "fertilizers">;
    setLoading((p) => ({ ...p, [tabKey]: true }));
    try {
      const rows = forceRefresh ? await refreshCommoditiesData(category) : await fetchCommoditiesData(category);
      setData((p) => ({ ...p, [category]: rows }));
    } finally {
      setLoading((p) => ({ ...p, [tabKey]: false }));
    }
  };

  const loadFertilizers = async () => {
    setLoading((p) => ({ ...p, fertilizers: true }));
    try {
      const rows = await fetchWorldBankDataByCategory(WORLD_BANK_CATEGORIES.FERTILIZERS);
      // Prefer showing items that actually have a current value
      const sorted = [...rows].sort((a, b) => Number(Boolean(b.currentValue)) - Number(Boolean(a.currentValue)));
      setFertilizers(sorted);
    } finally {
      setLoading((p) => ({ ...p, fertilizers: false }));
    }
  };

  useEffect(() => {
    void loadCommodityCategory("agricultural", false);
    void loadCommodityCategory("freight", false);
    void loadCommodityCategory("bunker", false);
    void loadFertilizers();
    // Keep it lightweight inside the workspace; CommodityMarket page already does periodic refresh.
  }, []);

  const onRefresh = async () => {
    if (activeTab === "fertilizers") {
      await loadFertilizers();
      return;
    }
    const category = TAB_META[activeTab].category;
    if (!category) return;
    await loadCommodityCategory(category, true);
  };

  const activeRows = useMemo(() => {
    if (activeTab === "fertilizers") return null;
    const category = TAB_META[activeTab].category!;
    return data[category] ?? [];
  }, [activeTab, data]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
          <div className="flex items-center justify-between gap-2">
            <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto">
              {(Object.keys(TAB_META) as TabKey[]).map((k) => {
                const Icon = TAB_META[k].icon;
                return (
                  <TabsTrigger key={k} value={k} className="gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{TAB_META[k].label}</span>
                    <span className="sm:hidden">{TAB_META[k].label.split(" ")[0]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} className="shrink-0 gap-2">
              <RefreshCw className={loading[activeTab] ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          <div className="min-h-0 flex-1">
            <TabsContent value="agricultural" className="mt-2 h-full min-h-0">
              {loading.agricultural ? (
                <LoadingTable />
              ) : (
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">CCY</TableHead>
                        <TableHead className="text-right">Chg%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.agricultural ?? []).map((c) => (
                        <TableRow key={c.symbol}>
                          <TableCell className="font-mono text-xs sm:text-sm">{c.symbol}</TableCell>
                          <TableCell className="max-w-[340px] truncate text-xs sm:text-sm">{c.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">{c.price.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-xs sm:text-sm">{c.currency || "USD"}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            {Number.isFinite(c.percentChange) ? `${c.percentChange.toFixed(2)}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="freight" className="mt-2 h-full min-h-0">
              {loading.freight ? (
                <LoadingTable />
              ) : (
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">CCY</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.freight ?? []).map((c) => (
                        <TableRow key={c.symbol}>
                          <TableCell className="font-mono text-xs sm:text-sm">{c.symbol}</TableCell>
                          <TableCell className="max-w-[380px] truncate text-xs sm:text-sm">{c.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">{c.price.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-xs sm:text-sm">{c.currency || "USD"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="bunker" className="mt-2 h-full min-h-0">
              {loading.bunker ? (
                <LoadingTable />
              ) : (
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">CCY</TableHead>
                        <TableHead className="text-right">Chg%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.bunker ?? []).map((c) => (
                        <TableRow key={c.symbol}>
                          <TableCell className="font-mono text-xs sm:text-sm">{c.symbol}</TableCell>
                          <TableCell className="max-w-[340px] truncate text-xs sm:text-sm">{c.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">{c.price.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-xs sm:text-sm">{c.currency || "USD"}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            {Number.isFinite(c.percentChange) ? `${c.percentChange.toFixed(2)}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="fertilizers" className="mt-2 h-full min-h-0">
              {loading.fertilizers ? (
                <LoadingTable />
              ) : (
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Chg%</TableHead>
                        <TableHead>Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fertilizers.map((c) => (
                        <TableRow key={c.symbol}>
                          <TableCell className="font-mono text-xs sm:text-sm">{c.symbol}</TableCell>
                          <TableCell className="max-w-[380px] truncate text-xs sm:text-sm">{c.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            {typeof c.currentValue === "number" ? c.currentValue.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            {typeof c.changePercent === "number" ? `${c.changePercent.toFixed(2)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">{c.unit || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Helps fill empty space when a tab has no data */}
      {!loading[activeTab] && activeTab !== "fertilizers" && (activeRows?.length ?? 0) === 0 && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No data available for this category right now.
        </div>
      )}
      {!loading.fertilizers && activeTab === "fertilizers" && fertilizers.length === 0 && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No World Bank fertilizers data found. Import Pink Sheet data in the World Bank page if needed.
        </div>
      )}
    </div>
  );
}

