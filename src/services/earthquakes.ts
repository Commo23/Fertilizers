import { getRpcBaseUrl } from '@/services/rpc-client';
import {
  SeismologyServiceClient,
  type Earthquake,
  type ListEarthquakesResponse,
} from '@/generated/client/worldmonitor/seismology/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import { fetchUsgsEarthquakesPastDays } from '@/services/open-map-data/usgs-earthquakes';

// Re-export the proto Earthquake type as the domain's public type
export type { Earthquake };

const breaker = createCircuitBreaker<ListEarthquakesResponse>({ name: 'Seismology', cacheTtlMs: 30 * 60 * 1000, persistCache: true });

const emptyFallback: ListEarthquakesResponse = { earthquakes: [] };

function getSeismologyClient(): SeismologyServiceClient | null {
  const base = getRpcBaseUrl();
  if (!base) return null;
  return new SeismologyServiceClient(base, { fetch: (...args) => globalThis.fetch(...args) });
}

/**
 * Séismes : API WorldMonitor si `VITE_WS_API_URL` / hôte prod pointe vers l’API ;
 * sinon **USGS** (public, sans clé).
 */
export async function fetchEarthquakes(): Promise<Earthquake[]> {
  const hydrated = getHydratedData('earthquakes') as ListEarthquakesResponse | undefined;
  if (hydrated?.earthquakes?.length) return hydrated.earthquakes;

  const client = getSeismologyClient();
  if (!client) {
    return fetchUsgsEarthquakesPastDays(7, 4);
  }

  try {
    const response = await breaker.execute(async () => {
      return client.listEarthquakes({ minMagnitude: 0, start: 0, end: 0, pageSize: 0, cursor: '' });
    }, emptyFallback);
    if (response.earthquakes?.length) return response.earthquakes;
  } catch {
    /* fallback USGS */
  }
  return fetchUsgsEarthquakesPastDays(7, 4);
}
