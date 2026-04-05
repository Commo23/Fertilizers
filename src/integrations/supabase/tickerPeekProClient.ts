/**
 * Supabase client for Ticker Peek Pro (scrape-currencies, scrape-futures, scrape-options, scrape-volatility, scrape-vol-surface).
 *
 * Env (optional overrides) — precedence:
 * 1. VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 * 2. VITE_TICKER_PEEK_PRO_SUPABASE_URL, VITE_TICKER_PEEK_PRO_SUPABASE_PUBLISHABLE_KEY (legacy)
 * 3. Built-in defaults → project exspgdhlzbolngavwlii
 *
 * Dashboard → Edge Functions → Secrets: FIRECRAWL_API_KEY must be set for scrape-* functions.
 */
import { createClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://exspgdhlzbolngavwlii.supabase.co";
const DEFAULT_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4c3BnZGhsemJvbG5nYXZ3bGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDY2OTIsImV4cCI6MjA4NjQ4MjY5Mn0.XHmjeaT0WHUxiNYLMxvAW4xk9v2AMlCy2qVmFgeQoyU";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_TICKER_PEEK_PRO_SUPABASE_URL ||
  DEFAULT_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_TICKER_PEEK_PRO_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_KEY;

export const tickerPeekProSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
