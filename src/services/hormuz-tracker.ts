function normalizeBaseUrl(base: string): string {
  return base.replace(/\/$/, '');
}

function getSupabaseFunctionsBase(): string {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  // Default matches env fallbacks in src/config/environment.ts
  const fallback = 'https://fwjdrsubflqmllkhhdef.supabase.co';
  return `${normalizeBaseUrl(url || fallback)}/functions/v1`;
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
    // Supabase Edge Function (verify_jwt=false)
    const resp = await fetch(`${getSupabaseFunctionsBase()}/hormuz-tracker`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const raw = (await resp.json()) as HormuzTrackerData;
    return raw.attribution ? raw : null;
  } catch {
    return null;
  }
}
