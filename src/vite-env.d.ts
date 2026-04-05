/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the WorldMonitor app (separate project), e.g. http://localhost:5174 */
  readonly VITE_WORLD_MONITOR_URL?: string;
  /** Ticker Peek Pro Supabase project ref (informational; URL/key drive the client) */
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy overrides for Ticker Peek Pro Supabase */
  readonly VITE_TICKER_PEEK_PRO_SUPABASE_URL?: string;
  readonly VITE_TICKER_PEEK_PRO_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
