/**
 * Dev-only RSS proxy (Vite middleware). Fetches feeds server-side to avoid browser CORS.
 * No third-party relay — same pattern as WorldMonitor’s api/rss-proxy, self-contained.
 * Extend RSS_PROXY_ALLOWED_DOMAINS when adding feeds in src/config/feeds.ts.
 */
import type { Plugin } from "vite";

const RSS_PROXY_ALLOWED_DOMAINS = new Set([
  // Core (news / wires)
  "feeds.bbci.co.uk",
  "www.theguardian.com",
  "feeds.npr.org",
  "news.google.com",
  "www.aljazeera.com",
  "rss.cnn.com",
  "hnrss.org",
  "feeds.arstechnica.com",
  "www.theverge.com",
  "www.cnbc.com",
  "feeds.marketwatch.com",
  "www.defenseone.com",
  "breakingdefense.com",
  "www.bellingcat.com",
  "techcrunch.com",
  "huggingface.co",
  "www.technologyreview.com",
  "rss.arxiv.org",
  "export.arxiv.org",
  "www.federalreserve.gov",
  "www.sec.gov",
  "www.whitehouse.gov",
  "www.state.gov",
  "www.defense.gov",
  "home.treasury.gov",
  "www.justice.gov",
  "tools.cdc.gov",
  "www.fema.gov",
  "www.dhs.gov",
  "www.thedrive.com",
  "krebsonsecurity.com",
  "finance.yahoo.com",
  "thediplomat.com",
  "venturebeat.com",
  "foreignpolicy.com",
  "www.ft.com",
  "openai.com",
  "www.reutersagency.com",
  "feeds.reuters.com",
  "asia.nikkei.com",
  "www.cfr.org",
  "www.csis.org",
  "www.politico.com",
  "www.brookings.edu",
  "layoffs.fyi",
  "www.defensenews.com",
  "www.militarytimes.com",
  "taskandpurpose.com",
  "news.usni.org",
  "www.oryxspioenkop.com",
  "www.gov.uk",
  "www.foreignaffairs.com",
  "www.atlanticcouncil.org",
  "www.zdnet.com",
  "www.techmeme.com",
  "www.darkreading.com",
  "www.schneier.com",
  "rss.politico.com",
  "www.anandtech.com",
  "www.tomshardware.com",
  "www.semianalysis.com",
  "feed.infoq.com",
  "thenewstack.io",
  "devops.com",
  "dev.to",
  "lobste.rs",
  "changelog.com",
  "seekingalpha.com",
  "news.crunchbase.com",
  "www.saastr.com",
  "feeds.feedburner.com",
  "www.producthunt.com",
  "www.axios.com",
  "api.axios.com",
  "github.blog",
  "githubnext.com",
  "mshibanami.github.io",
  "www.engadget.com",
  "news.mit.edu",
  "dev.events",
  "www.ycombinator.com",
  "a16z.com",
  "review.firstround.com",
  "www.sequoiacap.com",
  "www.nfx.com",
  "www.aaronsw.com",
  "bothsidesofthetable.com",
  "www.lennysnewsletter.com",
  "stratechery.com",
  "www.eu-startups.com",
  "tech.eu",
  "sifted.eu",
  "www.techinasia.com",
  "kr-asia.com",
  "techcabal.com",
  "disrupt-africa.com",
  "lavca.org",
  "contxto.com",
  "inc42.com",
  "yourstory.com",
  "pitchbook.com",
  "www.cbinsights.com",
  "www.techstars.com",
  "english.alarabiya.net",
  "www.arabnews.com",
  "www.timesofisrael.com",
  "www.haaretz.com",
  "www.scmp.com",
  "kyivindependent.com",
  "www.themoscowtimes.com",
  "feeds.24.com",
  "feeds.capi24.com",
  "www.france24.com",
  "www.euronews.com",
  "www.lemonde.fr",
  "rss.dw.com",
  "www.africanews.com",
  "www.lasillavacia.com",
  "www.channelnewsasia.com",
  "www.thehindu.com",
  "news.un.org",
  "www.iaea.org",
  "www.who.int",
  "www.cisa.gov",
  "www.crisisgroup.org",
  "rusi.org",
  "warontherocks.com",
  "www.aei.org",
  "responsiblestatecraft.org",
  "www.fpri.org",
  "jamestown.org",
  "www.chathamhouse.org",
  "ecfr.eu",
  "www.gmfus.org",
  "www.wilsoncenter.org",
  "www.lowyinstitute.org",
  "www.mei.edu",
  "www.stimson.org",
  "www.cnas.org",
  "carnegieendowment.org",
  "www.rand.org",
  "fas.org",
  "www.armscontrol.org",
  "www.nti.org",
  "thebulletin.org",
  "www.iss.europa.eu",
  "www.fao.org",
  "worldbank.org",
  "www.imf.org",
  "www.hurriyet.com.tr",
  "tvn24.pl",
  "www.polsatnews.pl",
  "www.rp.pl",
  "meduza.io",
  "novayagazeta.eu",
  "www.bangkokpost.com",
  "vnexpress.net",
  "www.abc.net.au",
  "news.ycombinator.com",
  "www.coindesk.com",
  "cointelegraph.com",
  "www.goodnewsnetwork.org",
  "www.positive.news",
  "reasonstobecheerful.world",
  "www.optimistdaily.com",
  "www.sunnyskyz.com",
  "www.huffpost.com",
  "www.sciencedaily.com",
  "feeds.nature.com",
  "www.livescience.com",
  "www.newscientist.com",
  // Commodity / mining / energy (COMMODITY_FEEDS)
  "www.kitco.com",
  "www.mining.com",
  "www.commoditytrademantra.com",
  "oilprice.com",
  "www.rigzone.com",
  "www.eia.gov",
  "news.goldseek.com",
  "news.silverseek.com",
  "www.mining-journal.com",
  "www.northernminer.com",
  "www.miningweekly.com",
  "www.mining-technology.com",
  "www.australianmining.com.au",
  "iea.org",
  "www.investing.com",
  "feeds.content.dowjones.io",
  "moxie.foxnews.com",
  "feeds.abcnews.com",
  "www.cbsnews.com",
  "feeds.nbcnews.com",
  "thehill.com",
  "www.pbs.org",
  "www.rt.com",
  "gcaptain.com",
  "www.spglobal.com",
  "www.bloomberg.com",
  "www.reuters.com",
  "www.apnews.com",
  "e00-elmundo.uecdn.es",
  "feeds.elpais.com",
  "www.bbc.com",
  "www.tagesschau.de",
  "www.bild.de",
  "www.spiegel.de",
  "newsfeed.zeit.de",
  "www.ansa.it",
  "www.corriere.it",
  "www.repubblica.it",
  "feeds.nos.nl",
  "www.nrc.nl",
  "www.svt.se",
  "www.dn.se",
  "www.svd.se",
  "www.alarabiya.net",
  "asharqbusiness.com",
  "asharq.com",
  "www.omanobserver.om",
  "www.decrypt.co",
  "blockworks.co",
  "thedefiant.io",
  "bitcoinmagazine.com",
  "cryptoslate.com",
  "unchainedcrypto.com",
  "www.blockchain.com",
]);

export function rssProxyPlugin(): Plugin {
  return {
    name: "rss-proxy-local",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/rss-proxy")) {
          return next();
        }

        const url = new URL(req.url, "http://localhost");
        const feedUrl = url.searchParams.get("url");
        if (!feedUrl) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing url parameter" }));
          return;
        }

        try {
          const parsed = new URL(feedUrl);
          if (!RSS_PROXY_ALLOWED_DOMAINS.has(parsed.hostname)) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: `Domain not allowed: ${parsed.hostname}. Add it in vite-plugin-rss-proxy.ts if this is a trusted RSS source.`,
              }),
            );
            return;
          }

          const controller = new AbortController();
          const timeout = feedUrl.includes("news.google.com") ? 20000 : 12000;
          const timer = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(feedUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "application/rss+xml, application/xml, text/xml, */*",
            },
            redirect: "follow",
          });
          clearTimeout(timer);

          const data = await response.text();
          res.statusCode = response.status;
          res.setHeader("Content-Type", "application/xml");
          res.setHeader("Cache-Control", "public, max-age=300");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(data);
        } catch (error: unknown) {
          const err = error as { name?: string; message?: string };
          const feedUrlShort = feedUrl.slice(0, 80);
          console.error("[rss-proxy]", feedUrlShort, err?.message);
          res.statusCode = err?.name === "AbortError" ? 504 : 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                err?.name === "AbortError" ? "Feed timeout" : "Failed to fetch feed",
            }),
          );
        }
      });
    },
  };
}
