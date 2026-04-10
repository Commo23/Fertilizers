export interface VariantMeta {
  title: string;
  description: string;
  keywords: string;
  url: string;
  siteName: string;
  shortName: string;
  subject: string;
  classification: string;
  categories: string[];
  features: string[];
}

/** Canonical site URL for OG tags; leave empty to use `window.location.origin` at runtime (see `meta-tags.ts`). */
export const VARIANT_META: { full: VariantMeta; [k: string]: VariantMeta } = {
  full: {
    title: 'CommoHedge — Intelligence & situation dashboard',
    description: 'Tableau de bord temps réel : actualités, marchés, cartographie et risques.',
    keywords: 'commodity, FX, hedging, markets, intelligence, geopolitics, cartography, OSINT',
    url: '',
    siteName: 'CommoHedge',
    shortName: 'CommoHedge',
    subject: 'Commodity & FX intelligence',
    classification: 'Trading terminal, market dashboard',
    categories: ['finance', 'productivity'],
    features: [
      'Actualités et flux marchés',
      'Cartographie & couches ouvertes',
      'Stratégies et pricing',
    ],
  },
  tech: {
    title: 'CommoHedge — Variante tech & données',
    description: 'Focus tech, data centers, écosystème startup (variante UI).',
    keywords: 'tech, data, cloud, startups, dashboard',
    url: '',
    siteName: 'CommoHedge',
    shortName: 'CommoHedge',
    subject: 'Tech & data (variante)',
    classification: 'Dashboard',
    categories: ['business', 'news'],
    features: ['Cartographie tech', 'Couches spécialisées'],
  },
  happy: {
    title: 'CommoHedge — Bonnes nouvelles',
    description: 'Actualités positives et indicateurs de progrès (variante UI).',
    keywords: 'positive news, progress, dashboard',
    url: '',
    siteName: 'CommoHedge',
    shortName: 'CommoHedge',
    subject: 'Positive news (variante)',
    classification: 'Dashboard',
    categories: ['news', 'lifestyle'],
    features: ['Fil positif', 'Carte dédiée'],
  },
  finance: {
    title: 'CommoHedge — Marchés & finance',
    description: 'Marchés, taux, devises et données macro (variante UI).',
    keywords: 'finance, markets, forex, commodities, dashboard',
    url: '',
    siteName: 'CommoHedge',
    shortName: 'CommoHedge',
    subject: 'Markets & finance (variante)',
    classification: 'Finance dashboard',
    categories: ['finance', 'news'],
    features: ['Carte finance', 'Couches bourses & macro'],
  },
  commodity: {
    title: 'CommoHedge — Matières premières & supply chain',
    description: 'Mines, ports, pipelines et flux matières premiers (variante UI).',
    keywords: 'commodity, mining, supply chain, metals, energy, dashboard',
    url: '',
    siteName: 'CommoHedge',
    shortName: 'CommoHedge',
    subject: 'Commodity & supply chain (variante)',
    classification: 'Commodity dashboard',
    categories: ['finance', 'business'],
    features: [
      'Sites miniers & usines',
      'Ports matières premières',
      'Carte supply chain',
    ],
  },
};
