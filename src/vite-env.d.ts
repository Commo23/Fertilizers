/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the WorldMonitor app (separate project), e.g. http://localhost:5174 */
  readonly VITE_WORLD_MONITOR_URL?: string;

  /** Projet Supabase principal — Auth & données utilisateur */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;

  /** Projet Supabase dédié — Edge Functions scraping (Ticker Peek Pro / futures insights) */
  readonly VITE_FUTURES_SUPABASE_PROJECT_ID?: string;
  readonly VITE_FUTURES_SUPABASE_URL?: string;
  readonly VITE_FUTURES_SUPABASE_PUBLISHABLE_KEY?: string;

  /** Overrides optionnels pour hedge-assistant-chat si déployé ailleurs que le projet principal */
  readonly VITE_SUPABASE_CHAT_URL?: string;
  readonly VITE_SUPABASE_CHAT_ANON_KEY?: string;

  /** @deprecated Utiliser VITE_FUTURES_SUPABASE_* pour le scraping */
  readonly VITE_TICKER_PEEK_PRO_SUPABASE_URL?: string;
  readonly VITE_TICKER_PEEK_PRO_SUPABASE_PUBLISHABLE_KEY?: string;

  /** Live news API relay (default: world-watcher Vercel) */
  readonly VITE_LIVE_NEWS_API_BASE?: string;
  /** Dev: set to 1 to call /api/youtube via Vite proxy (same-origin) */
  readonly VITE_LIVE_NEWS_USE_PROXY?: string;
  readonly VITE_DESKTOP_RUNTIME?: string;
  readonly VITE_TAURI_API_BASE_URL?: string;
  readonly VITE_WS_API_URL?: string;
  /** WorldMonitor-style site variant for default channel list */
  readonly VITE_SITE_VARIANT?: string;

  /** If true and VITE_RSS_RELAY_BASE is set, RSS uses that relay in production (not WorldMonitor-specific). */
  readonly VITE_RSS_DIRECT_TO_RELAY?: string;
  /** Your own RSS relay origin, e.g. https://rss.example.com (must expose /rss?url=). */
  readonly VITE_RSS_RELAY_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
