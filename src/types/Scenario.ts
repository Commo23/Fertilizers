import type { StressTestScenario, StrategyComponent, Result } from '@/types/strategyBuilder';

export interface SavedScenario {
  id: string;
  name: string;
  timestamp: number;
  params: {
    startDate: string;
    monthsToHedge: number;
    interestRate: number;
    storageCost?: number;
    convenienceYield?: number;
    totalVolume: number;
    baseVolume?: number;
    quoteVolume?: number;
    spotPrice: number;
    commodity?: any; // Commodity interface
    useCustomPeriods?: boolean;
    customPeriods?: any[];
  };
  strategy: StrategyComponent[];
  results: Result[];
  payoffData: Array<{ price: number; payoff: number }>;
  stressTest?: StressTestScenario;
  manualForwards?: Record<string, number>;
  realPrices?: Record<string, number>;
  useImpliedVol?: boolean;
  impliedVolatilities?: Record<string, number>;
  customOptionPrices?: Record<string, Record<string, number>>;
} 