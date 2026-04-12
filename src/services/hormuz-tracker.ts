import { config } from '@/config/environment';

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/$/, '');
}

function getSupabaseFunctionsBase(): string {
  const url = config.supabase.url.trim();
  return `${normalizeBaseUrl(url)}/functions/v1`;
}

/** Required for browser calls to Supabase Edge Functions (gateway checks apikey / Bearer). */
function supabaseFunctionHeaders(): HeadersInit {
  const key = config.supabase.anonKey;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
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
    const resp = await fetch(`${getSupabaseFunctionsBase()}/hormuz-tracker`, {
      signal: AbortSignal.timeout(15_000),
      headers: supabaseFunctionHeaders(),
    });
    if (!resp.ok) return null;
    const raw = (await resp.json()) as HormuzTrackerData;
    return raw.attribution ? raw : null;
  } catch {
    return null;
  }
}
