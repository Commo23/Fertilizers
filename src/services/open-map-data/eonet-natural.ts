/**
 * NASA EONET v3 — aucune clé API.
 * https://eonet.gsfc.nasa.gov/docs/v3
 */
import type { NaturalEvent, NaturalEventCategory } from '@/types';

interface EonetCategory {
  id: number;
  title: string;
}

interface EonetGeometry {
  date?: string;
  coordinates?: number[] | number[][] | number[][][];
}

interface EonetApiEvent {
  id: string;
  title: string;
  description?: string;
  closed?: string | null;
  categories?: EonetCategory[];
  geometry?: EonetGeometry[];
  sources?: Array<{ url?: string; id?: string }>;
}

interface EonetResponse {
  events?: EonetApiEvent[];
}

function normalizeCategory(title: string): NaturalEventCategory {
  const t = title.toLowerCase();
  if (t.includes('wildfire')) return 'wildfires';
  if (t.includes('severe storm') || t.includes('hurricane') || t.includes('cyclone') || t.includes('typhoon'))
    return 'severeStorms';
  if (t.includes('volcano')) return 'volcanoes';
  if (t.includes('flood')) return 'floods';
  if (t.includes('landslide')) return 'landslides';
  if (t.includes('drought')) return 'drought';
  if (t.includes('dust') || t.includes('haze')) return 'dustHaze';
  if (t.includes('snow') || t.includes('blizzard')) return 'snow';
  if (t.includes('temp') || t.includes('heat') || t.includes('cold')) return 'tempExtremes';
  if (t.includes('ice') || t.includes('sea ice') || t.includes('lake ice')) return 'seaLakeIce';
  if (t.includes('water color') || t.includes('algae')) return 'waterColor';
  if (t.includes('earthquake')) return 'earthquakes';
  return 'manmade';
}

function extractLonLat(geom: EonetGeometry[]): { lon: number; lat: number } | null {
  if (!geom?.length) return null;
  const last = geom[geom.length - 1];
  const c = last?.coordinates;
  if (!c) return null;
  if (typeof c[0] === 'number' && typeof c[1] === 'number') {
    return { lon: c[0], lat: c[1] };
  }
  if (Array.isArray(c[0]) && typeof (c[0] as number[])[0] === 'number') {
    const ring = c[0] as number[][];
    if (ring.length && typeof ring[0][0] === 'number') {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const p of ring) {
        if (p.length >= 2) {
          sx += p[0];
          sy += p[1];
          n++;
        }
      }
      if (n) return { lon: sx / n, lat: sy / n };
    }
  }
  return null;
}

function parseDate(geom: EonetGeometry[], closed?: string | null): Date {
  const last = geom?.length ? geom[geom.length - 1] : undefined;
  if (last?.date) {
    const d = new Date(last.date);
    if (!isNaN(d.getTime())) return d;
  }
  if (closed) {
    const d = new Date(closed);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function fetchEonetNaturalEvents(days = 14, status: 'open' | 'closed' | 'all' = 'all'): Promise<NaturalEvent[]> {
  const params = new URLSearchParams({
    days: String(days),
    status,
    limit: '250',
  });
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EONET HTTP ${res.status}`);
  const data = (await res.json()) as EonetResponse;
  const events = data.events ?? [];
  const out: NaturalEvent[] = [];

  for (const e of events) {
    const geom = e.geometry ?? [];
    const pos = extractLonLat(geom);
    if (!pos) continue;
    const catTitle = e.categories?.[0]?.title ?? 'Event';
    const category = normalizeCategory(catTitle);
    const sourceUrl = e.sources?.[0]?.url;
    out.push({
      id: `eonet-${e.id}`,
      title: e.title,
      description: e.description,
      category,
      categoryTitle: catTitle,
      lat: pos.lat,
      lon: pos.lon,
      date: parseDate(geom, e.closed),
      sourceUrl,
      sourceName: 'NASA EONET',
      closed: Boolean(e.closed),
    });
  }
  return out;
}
