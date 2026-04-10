import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COMMODITY_FEEDS } from "@/config/feeds";
import { getEffectivePanelConfig } from "@/config/panels";
import { fetchCategoryFeeds } from "@/services/news";
import type { Feed, NewsItem } from "@/types";
import { Newspaper, RefreshCw } from "lucide-react";

/**
 * Panneaux « news » matières premières alignés sur COMMODITY_PANELS + flux dans COMMODITY_FEEDS.
 * `live-news` utilise le flux `markets` (titres / marchés) comme « Commodity Headlines ».
 */
/** Latest market news — filtre en-gb, commodity fertilizers + feedgrade minerals (page Argus). */
const ARGUS_FERTILIZER_LATEST_NEWS =
  "https://www.argusmedia.com/en/news-and-insights/latest-market-news?filter_language=en-gb&filter_commodity=fertilizers%3Afertilizers%2Cfeedgrade+minerals&page=1";
const ARGUS_FERTILIZERS_OVERVIEW = "https://www.argusmedia.com/en/commodities/fertilizers";

/** Zone liste d’articles : hauteur bornée, défilement vertical si beaucoup d’entrées. */
const PANEL_NEWS_BODY_CLASS =
  "min-h-[140px] max-h-[min(320px,42vh)] overflow-y-auto overflow-x-hidden scroll-smooth rounded-md border border-border/40 bg-muted/25 p-3 dark:bg-muted/15 [scrollbar-gutter:stable]";

const COMMODITY_NEWS_SECTIONS: {
  panelKey: string;
  feedsKey: keyof typeof COMMODITY_FEEDS;
  description?: string;
  /** Liens vers les pages Argus de référence (remplace sourceHubHref si plusieurs). */
  sourceLinks?: { href: string; label: string }[];
  sourceHubHref?: string;
}[] = [
  { panelKey: "live-news", feedsKey: "markets" },
  { panelKey: "commodity-news", feedsKey: "commodity-news" },
  { panelKey: "energy", feedsKey: "energy" },
  { panelKey: "gold-silver", feedsKey: "gold-silver" },
  { panelKey: "mining-news", feedsKey: "mining-news" },
  { panelKey: "mining-companies", feedsKey: "mining-companies" },
  { panelKey: "supply-chain", feedsKey: "supply-chain" },
  { panelKey: "commodity-regulation", feedsKey: "commodity-regulation" },
  {
    panelKey: "fertilizer-news",
    feedsKey: "fertilizer-news",
    description:
      "Articles Argus via Google News (site:argusmedia.com). Les liens du flux sont des URL news.google.com qui redirigent vers Argus.",
    sourceLinks: [
      {
        href: ARGUS_FERTILIZER_LATEST_NEWS,
        label: "Latest market news — Fertilizers (Argus)",
      },
      { href: ARGUS_FERTILIZERS_OVERVIEW, label: "Fertilizers — vue d’ensemble" },
    ],
  },
];

function NewsPanelCard({
  panelKey,
  feeds,
  description,
  sourceLinks,
  sourceHubHref,
}: {
  panelKey: string;
  feeds: Feed[];
  description?: string;
  sourceLinks?: { href: string; label: string }[];
  sourceHubHref?: string;
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

  return (
    <Card className="shadow-md flex w-full flex-col overflow-hidden">
      <CardHeader className="shrink-0 space-y-1 border-b pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-snug text-primary sm:text-lg">{title}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => void load()}
            disabled={loading}
            title="Actualiser"
            aria-label="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          <span className="line-clamp-4">
            {description ?? "Flux RSS publics (proxy optionnel selon la config)."}
          </span>
          {(sourceLinks?.length
            ? sourceLinks
            : sourceHubHref
              ? [{ href: sourceHubHref, label: "Rubrique source sur Argus" }]
              : []
          ).map((sl) => (
            <span key={sl.href} className="block">
              <a
                href={sl.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {sl.label}
              </a>
            </span>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col pt-3">
        <div className={PANEL_NEWS_BODY_CLASS}>
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
            <ul className="space-y-3 text-sm">
              {items.map((item, i) => (
                <li
                  key={`${item.link}-${i}`}
                  className="border-b border-border/30 pb-3 last:border-0 last:pb-0"
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-3 font-medium leading-snug text-foreground hover:text-primary hover:underline"
                  >
                    {item.title}
                  </a>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
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

export default function CommodityNews() {
  return (
    <Layout
      title="Commodity News"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "Commodity News" },
      ]}
    >
      <div className="space-y-6">
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

        <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-2 xl:grid-cols-2">
          {COMMODITY_NEWS_SECTIONS.map(
            ({ panelKey, feedsKey, description, sourceLinks, sourceHubHref }) => (
              <NewsPanelCard
                key={panelKey}
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
    </Layout>
  );
}
