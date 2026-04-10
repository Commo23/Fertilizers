/**
 * Types partagés (rapports, import stratégie, sync données) — extraits de l’ancien Strategy Builder.
 */
export interface CurrencyPair {
  symbol: string;
  name: string;
  base: string;
  quote: string;
  category: 'energy' | 'metals' | 'agriculture' | 'livestock' | 'majors' | 'crosses' | 'others';
  defaultSpotRate: number;
}

export interface StressTestScenario {
  name: string;
  description: string;
  volatility: number;
  drift: number;
  priceShock: number;
  forwardBasis?: number;
  realBasis?: number;
  isCustom?: boolean;
  isEditable?: boolean;
  isHistorical?: boolean;
  historicalData?: Array<{ date: string; price: number }>;
}

export interface StrategyComponent {
  type:
    | 'call'
    | 'put'
    | 'swap'
    | 'forward'
    | 'call-knockout'
    | 'call-reverse-knockout'
    | 'call-double-knockout'
    | 'put-knockout'
    | 'put-reverse-knockout'
    | 'put-double-knockout'
    | 'call-knockin'
    | 'call-reverse-knockin'
    | 'call-double-knockin'
    | 'put-knockin'
    | 'put-reverse-knockin'
    | 'put-double-knockin'
    | 'one-touch'
    | 'double-touch'
    | 'no-touch'
    | 'double-no-touch'
    | 'range-binary'
    | 'outside-binary';
  strike: number;
  strikeType: 'percent' | 'absolute';
  volatility: number;
  quantity: number;
  barrier?: number;
  secondBarrier?: number;
  barrierType?: 'percent' | 'absolute';
  rebate?: number;
  timeToPayoff?: number;
  dynamicStrike?: {
    method: 'equilibrium';
    balanceWithIndex: number;
    volatilityAdjustment?: number;
  };
}

export interface Result {
  date: string;
  timeToMaturity: number;
  forward: number;
  realPrice: number;
  optionPrices: Array<{
    type: string;
    price: number;
    quantity: number;
    strike: number;
    label: string;
    dynamicStrikeInfo?: {
      calculatedStrike: number;
      calculatedStrikePercent: string;
      forwardRate: number;
      timeToMaturity: number;
    };
  }>;
  strategyPrice: number;
  totalPayoff: number;
  monthlyVolume: number;
  hedgedCost: number;
  unhedgedCost: number;
  deltaPnL: number;
}

export interface OptionImpliedVolatility {
  [key: string]: {
    [optionIndex: string]: number;
    global?: number;
  };
}

/** Liste de référence des commodités (spot par défaut) — utilisée par les services et rapports. */
export const CURRENCY_PAIRS: CurrencyPair[] = [
  { symbol: 'WTI', name: 'WTI Crude Oil', base: 'BBL', quote: 'USD', category: 'energy', defaultSpotRate: 75.5 },
  { symbol: 'BRENT', name: 'Brent Crude Oil', base: 'BBL', quote: 'USD', category: 'energy', defaultSpotRate: 79.8 },
  { symbol: 'NATGAS', name: 'Natural Gas', base: 'MMBTU', quote: 'USD', category: 'energy', defaultSpotRate: 2.85 },
  { symbol: 'HEATING', name: 'Heating Oil', base: 'GAL', quote: 'USD', category: 'energy', defaultSpotRate: 2.45 },
  { symbol: 'RBOB', name: 'Gasoline RBOB', base: 'GAL', quote: 'USD', category: 'energy', defaultSpotRate: 2.15 },
  { symbol: 'GOLD', name: 'Gold', base: 'OZ', quote: 'USD', category: 'metals', defaultSpotRate: 2050.0 },
  { symbol: 'SILVER', name: 'Silver', base: 'OZ', quote: 'USD', category: 'metals', defaultSpotRate: 24.5 },
  { symbol: 'PLATINUM', name: 'Platinum', base: 'OZ', quote: 'USD', category: 'metals', defaultSpotRate: 950.0 },
  { symbol: 'PALLADIUM', name: 'Palladium', base: 'OZ', quote: 'USD', category: 'metals', defaultSpotRate: 1050.0 },
  { symbol: 'COPPER', name: 'Copper', base: 'LB', quote: 'USD', category: 'metals', defaultSpotRate: 3.85 },
  { symbol: 'ALUMINUM', name: 'Aluminum', base: 'MT', quote: 'USD', category: 'metals', defaultSpotRate: 2350.0 },
  { symbol: 'ZINC', name: 'Zinc', base: 'MT', quote: 'USD', category: 'metals', defaultSpotRate: 2580.0 },
  { symbol: 'NICKEL', name: 'Nickel', base: 'MT', quote: 'USD', category: 'metals', defaultSpotRate: 17500.0 },
  { symbol: 'CORN', name: 'Corn', base: 'BU', quote: 'USD', category: 'agriculture', defaultSpotRate: 4.75 },
  { symbol: 'WHEAT', name: 'Wheat', base: 'BU', quote: 'USD', category: 'agriculture', defaultSpotRate: 5.85 },
  { symbol: 'SOYBEAN', name: 'Soybeans', base: 'BU', quote: 'USD', category: 'agriculture', defaultSpotRate: 13.5 },
  { symbol: 'COFFEE', name: 'Coffee', base: 'LB', quote: 'USD', category: 'agriculture', defaultSpotRate: 1.85 },
  { symbol: 'SUGAR', name: 'Sugar', base: 'LB', quote: 'USD', category: 'agriculture', defaultSpotRate: 0.24 },
  { symbol: 'COTTON', name: 'Cotton', base: 'LB', quote: 'USD', category: 'agriculture', defaultSpotRate: 0.82 },
  { symbol: 'CATTLE', name: 'Live Cattle', base: 'LB', quote: 'USD', category: 'livestock', defaultSpotRate: 1.75 },
  { symbol: 'HOGS', name: 'Lean Hogs', base: 'LB', quote: 'USD', category: 'livestock', defaultSpotRate: 0.85 },
];
