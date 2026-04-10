/**
 * USGS FDSN Web Service — aucune clé API, usage public.
 * https://earthquake.usgs.gov/fdsnws/event/1/
 */
import type { Earthquake } from '@/generated/client/worldmonitor/seismology/v1/service_client';

interface UsgsFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    url: string;
    depth?: number;
  };
  geometry: {
    type: string;
    coordinates: number[];
  };
}

interface UsgsGeoJson {
  features?: UsgsFeature[];
}

function depthFromCoords(coords: number[]): number {
  if (coords.length >= 3 && typeof coords[2] === 'number') {
    return Math.abs(coords[2]);
  }
  return 0;
}

export async function fetchUsgsEarthquakesPastDays(days = 7, minMagnitude = 4): Promise<Earthquake[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: start.toISOString().slice(0, 10),
    endtime: end.toISOString(),
    minmagnitude: String(minMagnitude),
    orderby: 'time',
  });
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/geo+json' },
  });
  if (!res.ok) {
    throw new Error(`USGS HTTP ${res.status}`);
  }
  const data = (await res.json()) as UsgsGeoJson;
  const features = data.features ?? [];
  const out: Earthquake[] = [];
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lon, lat] = coords;
    const depthKm = f.properties.depth ?? depthFromCoords(coords);
    out.push({
      id: f.id || `usgs-${f.properties.time}-${lon}-${lat}`,
      place: f.properties.place || 'Unknown',
      magnitude: typeof f.properties.mag === 'number' ? f.properties.mag : 0,
      depthKm,
      location: { latitude: lat, longitude: lon },
      occurredAt: f.properties.time,
      sourceUrl: f.properties.url || 'https://earthquake.usgs.gov/',
    });
  }
  return out;
}
