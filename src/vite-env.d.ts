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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
