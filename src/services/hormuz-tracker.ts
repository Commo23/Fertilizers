import { config } from '@/config/environment';

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/$/, '');
}

function getSupabaseFunctionsBase(): string {
  // Same defaults as `environment.ts` (projet principal + Vercel: VITE_SUPABASE_URL)
  return `${normalizeBaseUrl(config.supabase.url)}/functions/v1`;
}

export interface HormuzSeries {
  date: string;
  value: number;
}

export interface HormuzChart {
  label: string;
  title: string;
  series: HormuzSeries[];
}

export interface HormuzTrackerData {
  fetchedAt: number;
  updatedDate: string | null;
  title: string | null;
  summary: string | null;
  paragraphs: string[];
  status: 'closed' | 'disrupted' | 'restricted' | 'open';
  charts: HormuzChart[];
  attribution: { source: string; url: string };
}

export async function fetchHormuzTracker(): Promise<HormuzTrackerData | null> {
  try {
    const anonKey = config.supabase.anonKey;
    // Gateway Supabase exige apikey + Bearer (même si verify_jwt=false sur la fonction)
    const resp = await fetch(`${getSupabaseFunctionsBase()}/hormuz-tracker`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
    });
    if (!resp.ok) return null;
    const raw = (await resp.json()) as HormuzTrackerData;
    return raw.attribution ? raw : null;
  } catch {
    return null;
  }
}
