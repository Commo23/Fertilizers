import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COMMODITY_FEEDS } from "@/config/feeds";
import { getEffectivePanelConfig } from "@/config/panels";
import { fetchCategoryFeeds } from "@/services/news";
import type { Feed, NewsItem } from "@/types";
import { cn } from "@/lib/utils";
import { Newspaper, RefreshCw } from "lucide-react";

/** Liens Argus (engrais) — pages de référence. */
const ARGUS_FERTILIZER_LATEST_NEWS =
  "https://www.argusmedia.com/en/news-and-insights/latest-market-news?filter_language=en-gb&filter_commodity=fertilizers%3Afertilizers%2Cfeedgrade+minerals&page=1";
const ARGUS_FERTILIZERS_OVERVIEW = "https://www.argusmedia.com/en/commodities/fertilizers";

export const COMMODITY_NEWS_SECTIONS: {
  gridId: string;
  panelKey: string;
  feedsKey: keyof typeof COMMODITY_FEEDS;
  description?: string;
  sourceLinks?: { href: string; label: string }[];
  sourceHubHref?: string;
}[] = [
  { gridId: "commodity-headlines", panelKey: "live-news", feedsKey: "markets" },
  { gridId: "commodity-news", panelKey: "commodity-news", feedsKey: "commodity-news" },
  { gridId: "commodity-energy", panelKey: "energy", feedsKey: "energy" },
  { gridId: "commodity-gold-silver", panelKey: "gold-silver", feedsKey: "gold-silver" },
  { gridId: "commodity-mining-news", panelKey: "mining-news", feedsKey: "mining-news" },
  { gridId: "commodity-mining-companies", panelKey: "mining-companies", feedsKey: "mining-companies" },
  { gridId: "commodity-supply-chain", panelKey: "supply-chain", feedsKey: "supply-chain" },
  { gridId: "commodity-regulation", panelKey: "commodity-regulation", feedsKey: "commodity-regulation" },
  {
    gridId: "commodity-fertilizer-news",
    panelKey: "fertilizer-news",
    feedsKey: "fertilizer-news",
    sourceLinks: [
      { href: ARGUS_FERTILIZER_LATEST_NEWS, label: "Argus — actualités engrais" },
      { href: ARGUS_FERTILIZERS_OVERVIEW, label: "Argus — engrais (vue d’ensemble)" },
    ],
  },
];

export type CommodityNewsSectionConfig = (typeof COMMODITY_NEWS_SECTIONS)[number];

function NewsPanelCard({
  panelKey,
  feeds,
  description,
  sourceLinks,
  sourceHubHref,
  hideTitle,
}: {
  panelKey: string;
  feeds: Feed[];
  description?: string;
  sourceLinks?: { href: string; label: string }[];
  sourceHubHref?: string;
  hideTitle?: boolean;
}) {
  const { name: title } = getEffectivePanelConfig(panelKey, "commodity");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCategoryFeeds(feeds, { batchSize: 4 });
      setItems(data);
    } catch {
      setError("Impossible de charger les flux RSS pour le moment.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [feeds]);

  useEffect(() => {
    void load();
  }, [load]);

  const extraLinks =
    sourceLinks?.length
      ? sourceLinks
      : sourceHubHref
        ? [{ href: sourceHubHref, label: "Source Argus" }]
        : [];
  const hasExtraLinks = extraLinks.length > 0;
  const showDescription = Boolean(description?.trim());

  const listBodyClass = cn(
    "min-h-[96px] overflow-y-auto overflow-x-hidden scroll-smooth rounded-md border border-border/40 bg-muted/25 p-2 dark:bg-muted/15 [scrollbar-gutter:stable]",
    hideTitle ? "min-h-[72px] flex-1 max-h-none" : "max-h-[min(280px,40vh)]",
  );

  const refreshBtn = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0 h-7 w-7"
      onClick={() => void load()}
      disabled={loading}
      title="Actualiser"
      aria-label="Actualiser"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );

  return (
    <Card
      className={cn(
        "shadow-md flex w-full flex-col overflow-hidden border-border/60",
        hideTitle && "h-full min-h-0",
      )}
    >
      {hideTitle ? (
        <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border/50 px-1.5 py-0.5">
          <span className="sr-only">{title}</span>
          {hasExtraLinks && (
            <div className="mr-auto flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 pr-1 text-[10px] leading-tight text-muted-foreground">
              {extraLinks.map((sl) => (
                <a
                  key={sl.href}
                  href={sl.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-primary underline-offset-2 hover:underline"
                >
                  {sl.label}
                </a>
              ))}
            </div>
          )}
          {refreshBtn}
        </div>
      ) : (
        <CardHeader className="shrink-0 space-y-1 border-b px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-tight text-primary sm:text-base">{title}</CardTitle>
            {refreshBtn}
          </div>
          {(showDescription || hasExtraLinks) && (
            <CardDescription className="space-y-1 text-[11px] leading-snug text-muted-foreground">
              {showDescription && <p className="line-clamp-2">{description}</p>}
              {hasExtraLinks &&
                extraLinks.map((sl) => (
                  <a
                    key={sl.href}
                    href={sl.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-primary underline-offset-2 hover:underline"
                  >
                    {sl.label}
                  </a>
                ))}
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className={cn("flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2", hideTitle && "min-h-0 px-1.5 pb-1.5 pt-1.5")}>
        <div className={listBodyClass}>
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          )}
          {!loading && error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun article pour l’instant.</p>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="space-y-2 text-[13px] leading-snug">
              {items.map((item, i) => (
                <li
                  key={`${item.link}-${i}`}
                  className="border-b border-border/30 pb-2 last:border-0 last:pb-0"
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-3 font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {item.title}
                  </a>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{item.source}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={item.pubDate.toISOString()}>
                      {item.pubDate.toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CommodityNewsCategoryPanel({ section }: { section: CommodityNewsSectionConfig }) {
  return (
    <NewsPanelCard
      panelKey={section.panelKey}
      feeds={COMMODITY_FEEDS[section.feedsKey] ?? []}
      description={section.description}
      sourceLinks={section.sourceLinks}
      sourceHubHref={section.sourceHubHref}
      hideTitle
    />
  );
}

export function CommodityNewsContent({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("space-y-6", compact && "space-y-3 h-full min-h-0 flex flex-col")}>
      {!compact && (
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="h-8 w-8 text-primary shrink-0" />
            Commodity News
          </h1>
          <p className="text-muted-foreground text-sm max-w-3xl mt-2">
            Agrégation des panneaux d’actualités matières premières (métaux, énergie, mines, engrais, supply chain,
            réglementation), via les mêmes flux RSS que la variante commodity de WorldMonitor.
          </p>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-2",
          compact && "flex-1 min-h-0 overflow-y-auto pr-1",
        )}
      >
        {COMMODITY_NEWS_SECTIONS.map(
          ({ gridId, panelKey, feedsKey, description, sourceLinks, sourceHubHref }) => (
            <NewsPanelCard
              key={gridId}
              panelKey={panelKey}
              feeds={COMMODITY_FEEDS[feedsKey] ?? []}
              description={description}
              sourceLinks={sourceLinks}
              sourceHubHref={sourceHubHref}
            />
          ),
        )}
      </div>
    </div>
  );
}

export default function CommodityNews() {
  return (
    <Layout
      title="Commodity News"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Commodity News" },
      ]}
    >
      <CommodityNewsContent />
    </Layout>
  );
}
