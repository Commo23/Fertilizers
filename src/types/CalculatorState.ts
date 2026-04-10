import type { OptionImpliedVolatility } from '@/types/strategyBuilder';

export interface CustomPeriod {
  maturityDate: string;
  volume: number;
}

export interface CalculatorState {
    params: {
      startDate: string;
      monthsToHedge: number;
      interestRate: number;
      totalVolume: number;
      baseVolume: number;
      quoteVolume: number;
      spotPrice: number;
      commodity: any; // Commodity interface
      useCustomPeriods: boolean;
      customPeriods: CustomPeriod[];
      volumeType: 'long' | 'short'; // Type de position commodity
    };
    strategy: any[];
    results: any;
    payoffData: any[];
    manualForwards: Record<string, number>;
    realPrices: Record<string, number>;
    realPriceParams: {
      useSimulation: boolean;
      volatility: number;
      drift: number;
      numSimulations: number;
    };
    barrierOptionSimulations: number;
    barrierPricingModel: 'monte-carlo' | 'closed-form';
    activeTab: string;
    customScenario: any;
    stressTestScenarios: Record<string, any>;
    useImpliedVol: boolean;
    impliedVolatilities: OptionImpliedVolatility;
    useRealInterestRate?: boolean;
  } 