/**
 * ML Web Worker (stub) — pas de @xenova/transformers dans ce dépôt.
 * Répond au protocole attendu par `ml-worker.ts` pour que le build / le dev server fonctionnent.
 * Les inférences sont des no-op / heuristiques minimales (embeddings nuls 384-d, sentiment neutre, etc.).
 */

const EMBED_DIM = 384;

type WorkerInbound =
  | { type: 'load-model'; id: string; modelId: string }
  | { type: 'unload-model'; id: string; modelId: string }
  | { type: 'embed'; id: string; texts: string[] }
  | { type: 'summarize'; id: string; texts: string[]; modelId?: string }
  | { type: 'classify-sentiment'; id: string; texts: string[] }
  | { type: 'extract-entities'; id: string; texts: string[] }
  | { type: 'cluster-semantic'; id: string; embeddings: number[][]; threshold: number }
  | { type: 'vector-store-ingest'; id: string; items: unknown[] }
  | { type: 'vector-store-search'; id: string; queries: string[]; topK: number; minScore: number }
  | { type: 'vector-store-count'; id: string }
  | { type: 'vector-store-reset'; id: string }
  | { type: 'status'; id: string }
  | { type: 'reset' };

function zeroEmbedding(): number[] {
  return new Array(EMBED_DIM).fill(0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let nA = 0;
  let nB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    nA += a[i]! * a[i]!;
    nB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(nA) * Math.sqrt(nB);
  return denom === 0 ? 0 : dot / denom;
}

function semanticCluster(embeddings: number[][], threshold: number): number[][] {
  const n = embeddings.length;
  const clusters: number[][] = [];
  const assigned = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (assigned.has(i)) continue;
    const embeddingI = embeddings[i];
    if (!embeddingI) continue;
    const cluster = [i];
    assigned.add(i);
    for (let j = i + 1; j < n; j++) {
      if (assigned.has(j)) continue;
      const embeddingJ = embeddings[j];
      if (!embeddingJ) continue;
      if (cosineSimilarity(embeddingI, embeddingJ) >= threshold) {
        cluster.push(j);
        assigned.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

self.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'load-model':
        self.postMessage({
          type: 'model-loaded',
          id: message.id,
          modelId: message.modelId,
        });
        break;
      case 'unload-model':
        self.postMessage({
          type: 'model-unloaded',
          id: message.id,
          modelId: message.modelId,
        });
        break;
      case 'embed': {
        const embeddings = message.texts.map(() => zeroEmbedding());
        self.postMessage({ type: 'embed-result', id: message.id, embeddings });
        break;
      }
      case 'summarize': {
        const summaries = message.texts.map(t =>
          t.length > 200 ? `${t.slice(0, 197)}…` : t || '(empty)'
        );
        self.postMessage({ type: 'summarize-result', id: message.id, summaries });
        break;
      }
      case 'classify-sentiment': {
        const results = message.texts.map(() => ({
          label: 'neutral' as const,
          score: 0.5,
        }));
        self.postMessage({ type: 'sentiment-result', id: message.id, results });
        break;
      }
      case 'extract-entities': {
        const entities = message.texts.map(() => [] as []);
        self.postMessage({ type: 'entities-result', id: message.id, entities });
        break;
      }
      case 'cluster-semantic': {
        const clusters = semanticCluster(message.embeddings, message.threshold);
        self.postMessage({ type: 'cluster-semantic-result', id: message.id, clusters });
        break;
      }
      case 'vector-store-ingest':
        self.postMessage({
          type: 'vector-store-ingest-result',
          id: message.id,
          stored: 0,
        });
        break;
      case 'vector-store-search':
        self.postMessage({
          type: 'vector-store-search-result',
          id: message.id,
          results: [],
        });
        break;
      case 'vector-store-count':
        self.postMessage({
          type: 'vector-store-count-result',
          id: message.id,
          count: 0,
        });
        break;
      case 'vector-store-reset':
        self.postMessage({ type: 'vector-store-reset-result', id: message.id });
        break;
      case 'status':
        self.postMessage({
          type: 'status-result',
          id: message.id,
          loadedModels: [],
        });
        break;
      case 'reset':
        self.postMessage({ type: 'reset-complete' });
        break;
      default:
        break;
    }
  } catch (e) {
    self.postMessage({
      type: 'error',
      id: 'id' in message ? (message as { id?: string }).id : undefined,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};

self.postMessage({ type: 'worker-ready' });
