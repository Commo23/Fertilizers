/**
 * Supabase client dédié au scraping Ticker Peek Pro (Edge Functions scrape-*).
 * Projet distinct de l’app principale (Auth / données utilisateur).
 *
 * Variables d’environnement (ordre de priorité) :
 * 1. VITE_FUTURES_SUPABASE_URL, VITE_FUTURES_SUPABASE_PUBLISHABLE_KEY
 * 2. VITE_TICKER_PEEK_PRO_SUPABASE_URL, VITE_TICKER_PEEK_PRO_SUPABASE_PUBLISHABLE_KEY (legacy)
 * 3. Défauts embarqués → exspgdhlzbolngavwlii
 *
 * Ne pas utiliser VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ici : ce sont le projet Auth principal.
 *
 * Dashboard du projet futures → Edge Functions → Secrets : FIRECRAWL_API_KEY pour scrape-*.
 */
import { createClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://exspgdhlzbolngavwlii.supabase.co";
const DEFAULT_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4c3BnZGhsemJvbG5nYXZ3bGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDY2OTIsImV4cCI6MjA4NjQ4MjY5Mn0.XHmjeaT0WHUxiNYLMxvAW4xk9v2AMlCy2qVmFgeQoyU";

const SUPABASE_URL =
  import.meta.env.VITE_FUTURES_SUPABASE_URL ||
  import.meta.env.VITE_TICKER_PEEK_PRO_SUPABASE_URL ||
  DEFAULT_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_FUTURES_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_TICKER_PEEK_PRO_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_KEY;

export const tickerPeekProSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: "futures-insights-scrape-supabase",
    persistSession: false,
    autoRefreshToken: false,
  },
});
