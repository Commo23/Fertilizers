/**
 * Commodity Options Strategy Simulator & Risk Matrix
 * 
 * This simulator has been adapted specifically for commodity options trading.
 * Key commodity-specific features:
 * - Black-Scholes and Monte Carlo pricing models for vanilla options
 * - Cost of carry support (storage costs & convenience yields)
 * - Commodity forward pricing using cost of carry
 * - Commodity management (Energy, Metals, Agriculture, Livestock)
 * - Commodity-specific Monte Carlo simulations with proper drift calculation
 * - Barrier options adapted for commodity trading
 * - Comprehensive risk matrix analysis for commodity strategies
 * 
 * Calculation Models:
 * - Commodity Forward: S * exp(b * t) where b = r + storage - convenience
 * - Vanilla Options: Black-Scholes or Monte Carlo simulation
 * - Monte Carlo Drift: (b - 0.5 * σ²) for commodity price dynamics
 */

import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import StrategyImportService from '../services/StrategyImportService';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Save, X, AlertTriangle, Table, PlusCircle, Trash, Upload, BarChart3, Calculator, Shield, Calendar, ChevronDown, Target, TrendingUp, RefreshCw, Info, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { CalculatorState, CustomPeriod } from '@/types/CalculatorState';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import MonteCarloVisualization from '../components/MonteCarloVisualization';
import PayoffChart from '../components/PayoffChart';
import { SimulationData } from '../components/MonteCarloVisualization';
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ZeroCostStrategies from '@/components/ZeroCostStrategies';
import ZeroCostTab from '@/components/ZeroCostTab';
import {
  formatDateLocal,
  calculateUnderlyingPrice,
  calculateBarrierOptionClosedForm,
  calculateBarrierOptionPrice,
  calculateDigitalOptionPrice,
  calculateVanillaOptionMonteCarlo,
  calculatePricesFromPaths,
  calculateCommodityForwardPrice,
  discountFactorContinuous,
  presentValueForwardPayoff,
  calculateSwapPrice,
  calculateTimeToMaturity,
  clampOptionPriceNonNegative,
  daysToMaturityFromYearsAct36525,
  dteClampedForVolatilitySurface,
  getDte,
  calculateImpliedVolatility as solveImpliedVolatilityDecimal,
  calculateBlack76Price,
  calculateBlackScholesSpotPrice,
  calculateGarmanKohlhagenPrice,
  calculateStrategyPayoffAtPrice,
  calculateGreeks,
  strategyBuilderAnnualPercentToDecimal,
  impliedVolSurfacePointToDecimal,
  orderedDoubleBarrierLevels,
  generateStrategyBuilderPricePaths,
  generateStrategyBuilderPayoffDiagramPaths,
  generateBarrierMonteCarloPathsForPricing,
  calculateStrategyBuilderOptionPrice,
  isValidDateString,
  getDataDateRange,
  getBacktestExerciseType,
  getThirdFridayOfMonth,
  findClosestDateInData,
} from '@/services/PricingService';
import { Commodity, CommodityCategory, fetchCommoditiesData } from '@/services/commodityApi';
import { useInterestRates } from '@/hooks/useInterestRates';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchAllCountries, CountryBondData } from '@/services/rateExplorer/bondsApi';
import {
  fetchCurrencies as fetchTppCurrencies,
  fetchFutures as fetchTppFutures,
  fetchVolSurface as fetchTppVolSurface,
  fetchVolSurfaceStrikes as fetchTppVolSurfaceStrikes,
  type CurrencyData as TppCurrencyData,
  type SurfacePoint as TppSurfacePoint,
  type CommodityCategory as TppCommodityCategory,
  type FuturesContract as TppFuturesContract,
} from '@/lib/ticker-peek-pro/barchart';
import { interpolateSurface } from '@/lib/ticker-peek-pro/volSurfaceInterpolation';
import { getOrBuildCurve, interpolatePrice as interpolateFuturesPrice, type FuturesCurvePoint } from '@/lib/ticker-peek-pro/futuresCurve';

export { formatDateLocal } from '@/services/PricingService';

// Currency Pair interface
interface CurrencyPair {
  symbol: string;
  name: string;
  base: string;  // Unit (BBL, OZ, MT, etc.) - for display only
  quote: string; // Currency (usually USD) - for display only
  category: 'energy' | 'metals' | 'agriculture' | 'livestock' | 'majors' | 'crosses' | 'others'; // Commodity categories + legacy FX
  defaultSpotRate: number; // Default spot price for this commodity
}

// Helper function to get unit from commodity name/symbol
function getUnitFromCommodity(commodity: Commodity): string {
  const name = commodity.name.toLowerCase();
  const symbol = commodity.symbol.toLowerCase();
  
  // Energy
  if (name.includes('crude') || name.includes('oil') || symbol.includes('wti') || symbol.includes('brent') || symbol.includes('cl')) {
    return 'BBL';
  }
  if (name.includes('natural gas') || name.includes('natgas') || symbol.includes('ng')) {
    return 'MMBTU';
  }
  if (name.includes('heating oil') || name.includes('heating')) {
    return 'GAL';
  }
  if (name.includes('gasoline') || name.includes('rbob') || symbol.includes('rb')) {
    return 'GAL';
  }
  
  // Metals
  if (name.includes('gold') || symbol.includes('au') || symbol.includes('gc')) {
    return 'OZ';
  }
  if (name.includes('silver') || symbol.includes('ag') || symbol.includes('si')) {
    return 'OZ';
  }
  if (name.includes('platinum') || symbol.includes('pl')) {
    return 'OZ';
  }
  if (name.includes('palladium') || symbol.includes('pa')) {
    return 'OZ';
  }
  if (name.includes('copper') || symbol.includes('cu') || symbol.includes('hg')) {
    return 'LB';
  }
  if (name.includes('aluminum') || name.includes('aluminium') || symbol.includes('al')) {
    return 'MT';
  }
  if (name.includes('zinc') || symbol.includes('zn')) {
    return 'MT';
  }
  if (name.includes('nickel') || symbol.includes('ni')) {
    return 'MT';
  }
  
  // Agriculture
  if (name.includes('corn') || symbol.includes('zc')) {
    return 'BU';
  }
  if (name.includes('wheat') || symbol.includes('zw')) {
    return 'BU';
  }
  if (name.includes('soybean') || name.includes('soy') || symbol.includes('zs')) {
    return 'BU';
  }
  if (name.includes('coffee') || symbol.includes('kc')) {
    return 'LB';
  }
  if (name.includes('sugar') || symbol.includes('sb')) {
    return 'LB';
  }
  if (name.includes('cotton') || symbol.includes('ct')) {
    return 'LB';
  }
  if (name.includes('cocoa') || symbol.includes('cc')) {
    return 'MT';
  }
  
  // Livestock
  if (name.includes('cattle') || symbol.includes('le')) {
    return 'CWT';
  }
  if (name.includes('hog') || symbol.includes('he')) {
    return 'CWT';
  }
  
  // Freight and Bunker
  if (commodity.category === 'freight' || commodity.category === 'bunker') {
    return 'MT';
  }
  
  // Default
  return 'MT';
}

interface FXStrategyParams {
  startDate: string;           // Hedging Start Date (renamed from startDate)
  strategyStartDate: string;   // Strategy Start Date (new field)
  monthsToHedge: number;
  // Commodity parameters
  interestRate: number;        // Risk-free rate (r)
  // Legacy FX parameters for backward compatibility
  domesticRate?: number;
  foreignRate?: number;
  totalVolume: number; // Main volume for calculations
  baseVolume?: number; // Backward compatibility
  quoteVolume?: number; // Backward compatibility
  spotPrice: number;
  priceDifferential?: number; // Price differential (basis) - applied only to costs, not to options/swaps/forwards
  currencyPair: CurrencyPair;
  useCustomPeriods: boolean;
  customPeriods: CustomPeriod[];
  volumeType: 'long' | 'short' | 'receivable' | 'payable'; // Type de position: long/short (commodity) ou receivable/payable (legacy FX)
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
  historicalData?: HistoricalDataPoint[];
}

export interface StrategyComponent {
  type: 'call' | 'put' | 'swap' | 'forward' | 
         'call-knockout' | 'call-reverse-knockout' | 'call-double-knockout' | 
         'put-knockout' | 'put-reverse-knockout' | 'put-double-knockout' |
         'call-knockin' | 'call-reverse-knockin' | 'call-double-knockin' |
         'put-knockin' | 'put-reverse-knockin' | 'put-double-knockin' |
         'one-touch' | 'double-touch' | 'no-touch' | 'double-no-touch' |
         'range-binary' | 'outside-binary';
  strike: number;
  strikeType: 'percent' | 'absolute';
  volatility: number;
  quantity: number;
  barrier?: number;           // Primary barrier level
  secondBarrier?: number;     // Secondary barrier for double barriers
  barrierType?: 'percent' | 'absolute';  // Whether barrier is % of spot or absolute value
  rebate?: number;            // Rebate amount for digital options
  timeToPayoff?: number;      // Time to payoff for one-touch options (in years)
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

interface SavedScenario {
  id: string;
  name: string;
  timestamp: number;
  params: {
    startDate: string;           // Hedging Start Date
    strategyStartDate: string;   // Strategy Start Date
    monthsToHedge: number;
    interestRate: number;
    domesticRate?: number;
    foreignRate?: number;
    totalVolume: number;
    baseVolume?: number; // Backward compatibility
    quoteVolume?: number; // Backward compatibility
    spotPrice: number;
    priceDifferential?: number; // Price differential (basis) - applied only to costs
    currencyPair?: CurrencyPair;
    useCustomPeriods?: boolean;
    customPeriods?: CustomPeriod[];
    volumeType?: 'long' | 'short' | 'receivable' | 'payable'; // Type de position
  };
  strategy: StrategyComponent[];
  results: Result[];
  payoffData: Array<{ price: number; payoff: number }>;
  stressTest?: StressTestScenario;
  // Ajouter les données additionnelles du tableau
  useImpliedVol: boolean;
  impliedVolatilities: OptionImpliedVolatility;
  manualForwards: {[key: string]: number};
  realPrices: {[key: string]: number};
  useCustomOptionPrices?: boolean;
  customOptionPrices?: {[key: string]: {[optionKey: string]: number}};
}

interface ImpliedVolatility {
  [key: string]: number; // Format: "YYYY-MM": volatility
}

// New interface for per-option implied volatility
export interface OptionImpliedVolatility {
  [key: string]: {   // Format: "YYYY-MM"
    [optionIndex: string]: number;  // Format: "optionType-index": volatility
    global?: number;  // Global volatility for the month (backward compatibility)
  };
}

interface HistoricalDataPoint {
  date: string;
  price: number;
}

interface MonthlyStats {
  month: string;
  avgPrice: number;
  volatility: number | null;
  dataPoints?: number;
  calculationMethod?: string;
}

interface PriceRange {
  min: number;
  max: number;
  probability: number;
}

/** Get maturity convention from Settings (Pricing): last-month-day | third-friday */
const getMaturityConvention = (): 'last-month-day' | 'third-friday' => {
  try {
    const s = localStorage.getItem('fxRiskManagerSettings');
    if (!s) return 'last-month-day';
    const parsed = JSON.parse(s);
    return parsed?.pricing?.maturityConvention === 'third-friday' ? 'third-friday' : 'last-month-day';
  } catch {
    return 'last-month-day';
  }
};

/** Third Friday of the given month (year, month 0-indexed). Returns Date at noon to avoid timezone shift. */
const getThirdFriday = (year: number, month: number): Date => {
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay(); // 0 Sun .. 5 Fri .. 6 Sat
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const firstFriday = 1 + daysUntilFriday;
  const thirdFriday = firstFriday + 14;
  return new Date(year, month, thirdFriday, 12, 0, 0);
};

/** Maturity date for a given month: last day or third Friday per Settings. Month 0-indexed. */
const getMaturityDateForMonth = (year: number, month: number, convention: 'last-month-day' | 'third-friday'): Date => {
  if (convention === 'third-friday') return getThirdFriday(year, month);
  // Last day of month at noon to avoid timezone shift
  return new Date(year, month + 1, 0, 12, 0, 0);
};

interface RiskMatrixResult {
  strategy: StrategyComponent[];
  coverageRatio: number;
  costs: {[key: string]: number};
  differences: {[key: string]: number};
  hedgingCost: number;
  name: string; // Ajout de la propriété name
}

// Ajouter cette interface pour les matrices de risque sauvegardées
interface SavedRiskMatrix {
  id: string;
  name: string;
  timestamp: number;
  priceRanges: PriceRange[];
  strategies: {
    components: StrategyComponent[];
    coverageRatio: number;
    name: string;
  }[];
  results: RiskMatrixResult[];
}

const DEFAULT_SCENARIOS = {
  base: {
    name: "Base Case",
    description: "Normal market conditions",
    volatility: 0.2,
    drift: 0.01,
    priceShock: 0,
    forwardBasis: 0,
    isEditable: true
  },
  highVol: {
    name: "High Volatility",
    description: "Double volatility scenario",
    volatility: 0.4,
    drift: 0.01,
    priceShock: 0,
    forwardBasis: 0,
    isEditable: true
  },
  crash: {
    name: "Market Crash",
    description: "High volatility, negative drift, price shock",
    volatility: 0.5,
    drift: -0.03,
    priceShock: -0.2,
    forwardBasis: 0,
    isEditable: true
  },
  bull: {
    name: "Bull Market",
    description: "Low volatility, positive drift, upward shock",
    volatility: 0.15,
    drift: 0.02,
    priceShock: 0.1,
    forwardBasis: 0,
    isEditable: true
  }
};

// Currency Pairs Database with current market rates (approximate)
export const CURRENCY_PAIRS: CurrencyPair[] = [
  // ENERGY COMMODITIES
  { symbol: "WTI", name: "WTI Crude Oil", base: "BBL", quote: "USD", category: "energy", defaultSpotRate: 75.50 },
  { symbol: "BRENT", name: "Brent Crude Oil", base: "BBL", quote: "USD", category: "energy", defaultSpotRate: 79.80 },
  { symbol: "NATGAS", name: "Natural Gas", base: "MMBTU", quote: "USD", category: "energy", defaultSpotRate: 2.85 },
  { symbol: "HEATING", name: "Heating Oil", base: "GAL", quote: "USD", category: "energy", defaultSpotRate: 2.45 },
  { symbol: "RBOB", name: "Gasoline RBOB", base: "GAL", quote: "USD", category: "energy", defaultSpotRate: 2.15 },
  
  // PRECIOUS METALS
  { symbol: "GOLD", name: "Gold", base: "OZ", quote: "USD", category: "metals", defaultSpotRate: 2050.00 },
  { symbol: "SILVER", name: "Silver", base: "OZ", quote: "USD", category: "metals", defaultSpotRate: 24.50 },
  { symbol: "PLATINUM", name: "Platinum", base: "OZ", quote: "USD", category: "metals", defaultSpotRate: 950.00 },
  { symbol: "PALLADIUM", name: "Palladium", base: "OZ", quote: "USD", category: "metals", defaultSpotRate: 1050.00 },
  
  // BASE METALS
  { symbol: "COPPER", name: "Copper", base: "LB", quote: "USD", category: "metals", defaultSpotRate: 3.85 },
  { symbol: "ALUMINUM", name: "Aluminum", base: "MT", quote: "USD", category: "metals", defaultSpotRate: 2350.00 },
  { symbol: "ZINC", name: "Zinc", base: "MT", quote: "USD", category: "metals", defaultSpotRate: 2580.00 },
  { symbol: "NICKEL", name: "Nickel", base: "MT", quote: "USD", category: "metals", defaultSpotRate: 17500.00 },
  
  // AGRICULTURE
  { symbol: "CORN", name: "Corn", base: "BU", quote: "USD", category: "agriculture", defaultSpotRate: 4.75 },
  { symbol: "WHEAT", name: "Wheat", base: "BU", quote: "USD", category: "agriculture", defaultSpotRate: 5.85 },
  { symbol: "SOYBEAN", name: "Soybeans", base: "BU", quote: "USD", category: "agriculture", defaultSpotRate: 13.50 },
  { symbol: "COFFEE", name: "Coffee", base: "LB", quote: "USD", category: "agriculture", defaultSpotRate: 1.85 },
  { symbol: "SUGAR", name: "Sugar", base: "LB", quote: "USD", category: "agriculture", defaultSpotRate: 0.24 },
  { symbol: "COTTON", name: "Cotton", base: "LB", quote: "USD", category: "agriculture", defaultSpotRate: 0.82 },
  
  // LIVESTOCK
  { symbol: "CATTLE", name: "Live Cattle", base: "LB", quote: "USD", category: "livestock", defaultSpotRate: 1.75 },
  { symbol: "HOGS", name: "Lean Hogs", base: "LB", quote: "USD", category: "livestock", defaultSpotRate: 0.85 },
];

// State pour les paires de devises personnalisées
const Index = () => {
  const { toast } = useToast();
  
  // 🎯 Interest Rate Hook - Utilise les taux de Settings (Fixed Bank Rate ou Curve)
  const { 
    mode: interestRateMode, 
    isCurveMode, 
    getRate, 
    fixedRates,
    hasCurveData 
  } = useInterestRates();
  
  const [customCurrencyPairs, setCustomCurrencyPairs] = useState<CurrencyPair[]>(() => {
    const savedPairs = localStorage.getItem('customCurrencyPairs');
    return savedPairs ? JSON.parse(savedPairs) : [];
  });

  // Fonction pour sauvegarder les paires personnalisées
  const saveCustomCurrencyPairs = (pairs: CurrencyPair[]) => {
    localStorage.setItem('customCurrencyPairs', JSON.stringify(pairs));
    setCustomCurrencyPairs(pairs);
  };

  // Fonction pour ajouter une paire de devise manuellement
  const addCustomCurrencyPair = (newPair: CurrencyPair) => {
    const updated = [...customCurrencyPairs, newPair];
    saveCustomCurrencyPairs(updated);
  };

  // Add state for active tab
  const [activeTab, setActiveTab] = useState(() => {
    try {
    const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).activeTab || 'parameters' : 'parameters';
    } catch (error) {
      console.warn('Error parsing activeTab from localStorage:', error);
      return 'parameters';
    }
  });

  // Basic parameters state
  const [params, setParams] = useState(() => {
    // 🎯 Obtenir le taux initial depuis Settings (Bank Rate USD par défaut)
    const initialRate = fixedRates?.USD || 4.5;
    
    const defaultParams = {
      startDate: new Date().toISOString().split('T')[0],           // Hedging Start Date
      strategyStartDate: new Date().toISOString().split('T')[0],   // Strategy Start Date (same as hedging start by default)
      monthsToHedge: 12,
      interestRate: initialRate, // 🎯 Risk-free rate depuis Settings (en pourcentage)
      domesticRate: 1.0, // EUR rate
      foreignRate: 0.5, // USD rate
      totalVolume: 10000000, // Main volume for calculations
      spotPrice: CURRENCY_PAIRS[0].defaultSpotRate, // Default to WTI spot price
      priceDifferential: 0, // Price differential (basis) for commodities - applied only to costs
      currencyPair: CURRENCY_PAIRS[0], // Default to WTI
      useCustomPeriods: false,
      customPeriods: [],
      volumeType: 'long' // Default to long position (commodity)
    };
    
    try {
      const savedState = localStorage.getItem('calculatorState');
    if (savedState) {
      const savedParams = JSON.parse(savedState).params;
      // Ensure backward compatibility - use totalVolume as main volume
      if (!savedParams.totalVolume) {
        savedParams.totalVolume = 10000000;
      }
      // Ensure backward compatibility - add strategyStartDate if missing
      if (!savedParams.strategyStartDate) {
        savedParams.strategyStartDate = savedParams.startDate || new Date().toISOString().split('T')[0];
      }
      // Ensure backward compatibility - add volumeType if missing
      if (!savedParams.volumeType) {
        savedParams.volumeType = 'long'; // Default to long
      }
      // Ensure backward compatibility - add priceDifferential if missing
      if (savedParams.priceDifferential === undefined) {
        savedParams.priceDifferential = 0; // Default to 0
      }
      return savedParams;
      }
    } catch (error) {
      console.warn('Error parsing params from localStorage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem('calculatorState');
      } catch (e) {
        console.warn('Could not clear corrupted localStorage:', e);
      }
    }
    
    return defaultParams;
  });

  // Keep track of initial spot price
  const [initialSpotPrice, setInitialSpotPrice] = useState<number>(params.spotPrice);
  
  
  // 🌐 Fonction pour récupérer le Bank Rate depuis Gov Bonds pour une devise donnée
  const getBankRateForCurrency = useCallback(async (currency: string): Promise<number | null> => {
    try {
      const response = await fetchAllCountries();
      if (response.success && response.data) {
        // Mapping complet de toutes les devises disponibles dans Gov Bonds
        const CURRENCY_TO_COUNTRY: Record<string, string> = {
          // Major currencies
          USD: 'united-states',
          EUR: 'germany', // Using Germany as primary EUR country
          GBP: 'united-kingdom',
          JPY: 'japan',
          CHF: 'switzerland',
          CAD: 'canada',
          AUD: 'australia',
          NZD: 'new-zealand',
          
          // Asian currencies
          CNY: 'china',
          SGD: 'singapore',
          HKD: 'hong-kong',
          KRW: 'south-korea',
          TWD: 'taiwan',
          THB: 'thailand',
          MYR: 'malaysia',
          IDR: 'indonesia',
          PHP: 'philippines',
          VND: 'vietnam',
          
          // European currencies (non-EUR)
          SEK: 'sweden',
          NOK: 'norway',
          DKK: 'denmark',
          PLN: 'poland',
          CZK: 'czech-republic',
          HUF: 'hungary',
          RON: 'romania',
          ISK: 'iceland',
          
          // Middle Eastern currencies
          SAR: 'saudi-arabia',
          AED: 'united-arab-emirates',
          QAR: 'qatar',
          KWD: 'kuwait',
          BHD: 'bahrain',
          OMR: 'oman',
          ILS: 'israel',
          
          // African currencies
          ZAR: 'south-africa',
          EGP: 'egypt',
          NGN: 'nigeria',
          KES: 'kenya',
          MAD: 'morocco',
          
          // Latin American currencies
          BRL: 'brazil',
          MXN: 'mexico',
          ARS: 'argentina',
          CLP: 'chile',
          COP: 'colombia',
          PEN: 'peru',
          
          // Other currencies
          INR: 'india',
          RUB: 'russia',
          TRY: 'turkey',
          PKR: 'pakistan',
          BDT: 'bangladesh',
          LKR: 'sri-lanka',
        };
        
        // First, try to find by country slug mapping
        const countrySlug = CURRENCY_TO_COUNTRY[currency];
        if (countrySlug) {
          const countryData = response.data.find((c: CountryBondData) => 
            c.countrySlug === countrySlug || 
            c.country.toLowerCase().replace(/\s+/g, '-') === countrySlug
          );
          
          if (countryData?.bankRate !== null && countryData?.bankRate !== undefined) {
            return countryData.bankRate;
          }
        }
        
        // Fallback: search directly by currency code (for EUR countries or if mapping fails)
        const countryDataByCurrency = response.data.find((c: CountryBondData) => 
          c.currency === currency && c.bankRate !== null && c.bankRate !== undefined
        );
        
        if (countryDataByCurrency) {
          return countryDataByCurrency.bankRate;
        }
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération du Bank Rate pour ${currency}:`, error);
    }
    return null;
  }, []);

  
  // 🌐 Auto-sync bank rates on mount if in fixed mode
  useEffect(() => {
    if (!isCurveMode) {
      // Check if bond data is fresh (less than 1 hour old)
      const lastUpdate = localStorage.getItem('bondDataLastUpdate');
      const isFresh = lastUpdate ? (Date.now() - new Date(lastUpdate).getTime()) < 3600000 : false;
      
      if (!isFresh) {
        // Auto-sync bank rates in background
        const syncRates = async () => {
          try {
            const response = await fetchAllCountries();
            if (response.success && response.data) {
              const CURRENCY_TO_COUNTRY: Record<string, string> = {
                USD: 'united-states',
                EUR: 'germany',
                GBP: 'united-kingdom',
                CHF: 'switzerland',
                JPY: 'japan',
                CAD: 'canada',
                AUD: 'australia',
                NZD: 'new-zealand',
              };
              
              const newRates: Record<string, number> = {};
              Object.entries(CURRENCY_TO_COUNTRY).forEach(([currency, countrySlug]) => {
                const countryData = response.data!.find((c: CountryBondData) => 
                  c.countrySlug === countrySlug || 
                  c.country.toLowerCase().replace(/\s+/g, '-') === countrySlug
                );
                if (countryData?.bankRate !== null && countryData?.bankRate !== undefined) {
                  newRates[currency] = countryData.bankRate;
                }
              });
              
              if (Object.keys(newRates).length > 0) {
                // Update settings
                const currentSettings = JSON.parse(localStorage.getItem('fxRiskManagerSettings') || '{}');
                currentSettings.pricing = {
                  ...currentSettings.pricing,
                  fixedRates: { ...currentSettings.pricing?.fixedRates, ...newRates }
                };
                localStorage.setItem('fxRiskManagerSettings', JSON.stringify(currentSettings));
                localStorage.setItem('bondDataLastUpdate', response.scrapedAt || new Date().toISOString());
                window.dispatchEvent(new CustomEvent('settingsUpdated'));
                console.log('✅ Taux bancaires synchronisés automatiquement dans Strategy Builder');
              }
            }
          } catch (error) {
            console.error('Erreur lors de la synchronisation automatique des taux:', error);
          }
        };
        
        syncRates();
      }
    }
  }, [isCurveMode]); // Run once on mount and when mode changes

  // State for using real data from Commodity Market
  const [useRealData, setUseRealData] = useState(() => {
    try {
      const savedState = localStorage.getItem('calculatorState');
      if (savedState) {
        const saved = JSON.parse(savedState);
        return saved.useRealData || false;
      }
    } catch (error) {
      console.warn('Error parsing useRealData from localStorage:', error);
    }
    return false;
  });

  // State for real commodities from Commodity Market
  const [realCommodities, setRealCommodities] = useState<Commodity[]>([]);
  const [loadingRealCommodities, setLoadingRealCommodities] = useState(false);
  
  // State for commodity search filter
  const [commoditySearchQuery, setCommoditySearchQuery] = useState('');

  // ── Ticker Peek Pro (same as Pricers) ──
  const [useTickerPeekPro, setUseTickerPeekPro] = useState(() => {
    try {
      const saved = localStorage.getItem('calculatorState');
      return saved ? JSON.parse(saved).useTickerPeekPro === true : false;
    } catch { return false; }
  });
  const [tppCurrencies, setTppCurrencies] = useState<TppCurrencyData[]>([]);
  const [tppCurrenciesByCategory, setTppCurrenciesByCategory] = useState<Record<string, TppCurrencyData[]>>({});
  const [tppLoadingCurrencies, setTppLoadingCurrencies] = useState(false);
  const [tppLoadingFutures, setTppLoadingFutures] = useState(false);
  const [tppLoadingSurface, setTppLoadingSurface] = useState(false);
  const [tppSurfacePoints, setTppSurfacePoints] = useState<TppSurfacePoint[]>([]);
  const [tppFutures, setTppFutures] = useState<TppFuturesContract[]>([]);

  // 🎯 Obtenir la devise de la commodity sélectionnée
  // Si on utilise des données réelles, essayer de récupérer la devise depuis la commodity
  const getSelectedCurrency = useMemo(() => {
    if (useRealData && realCommodities.length > 0 && params.currencyPair?.symbol) {
      const selectedCommodity = realCommodities.find(c => c.symbol === params.currencyPair?.symbol);
      if (selectedCommodity?.currency) {
        return selectedCommodity.currency;
      }
    }
    return params.currencyPair?.quote || 'USD';
  }, [params.currencyPair, useRealData, realCommodities]);

  // 🎯 Fonction pour obtenir le taux d'intérêt selon les settings
  const getInterestRateForStrategy = useMemo(() => {
    // Mode Curve: utilise la maturité moyenne pour interpoler le taux
    // Mode Fixed: utilise le Bank Rate de la devise
    const maturityYears = params.monthsToHedge / 12;
    const rate = getRate(getSelectedCurrency, maturityYears);
    return rate * 100; // Convertir en pourcentage
  }, [getRate, getSelectedCurrency, params.monthsToHedge]);

  // 🎯 Synchroniser automatiquement le Risk-free Rate avec le Bank Rate quand la commodity change
  useEffect(() => {
    if (!isCurveMode && getSelectedCurrency) {
      const syncRate = async () => {
        const bankRate = await getBankRateForCurrency(getSelectedCurrency);
        if (bankRate !== null) {
          // Mettre à jour le taux automatiquement
          setParams(prev => ({
            ...prev,
            interestRate: bankRate
          }));
          
          // Mettre à jour aussi les fixedRates dans Settings pour cette devise
          const currentSettings = JSON.parse(localStorage.getItem('fxRiskManagerSettings') || '{}');
          currentSettings.pricing = {
            ...currentSettings.pricing,
            fixedRates: {
              ...currentSettings.pricing?.fixedRates,
              [getSelectedCurrency]: bankRate
            }
          };
          localStorage.setItem('fxRiskManagerSettings', JSON.stringify(currentSettings));
          window.dispatchEvent(new CustomEvent('settingsUpdated'));
          
          console.log(`✅ Risk-free Rate synchronisé avec Bank Rate pour ${getSelectedCurrency}: ${bankRate.toFixed(2)}%`);
        }
      };
      
      syncRate();
    }
  }, [getSelectedCurrency, isCurveMode, getBankRateForCurrency]);

  // ✅ Helper function to map CURRENCY_PAIRS category to CommodityCategory
  const mapCurrencyPairCategoryToDomain = (category: string): CommodityCategory | null => {
    const mapping: Record<string, CommodityCategory> = {
      'energy': 'energy',
      'metals': 'metals',
      'agriculture': 'agricultural',
      'livestock': 'agricultural', // Livestock is agricultural-related
    };
    return mapping[category] || null;
  };

  // ✅ Get filtered default commodities based on selected domains
  const getFilteredDefaultCommodities = (): CurrencyPair[] => {
    const savedSettings = localStorage.getItem('fxRiskManagerSettings');
    let selectedCategories: CommodityCategory[] = ['metals', 'agricultural', 'energy', 'freight', 'bunker'];
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed?.domains?.selectedDomains && Array.isArray(parsed.domains.selectedDomains) && parsed.domains.selectedDomains.length > 0) {
          selectedCategories = parsed.domains.selectedDomains;
        }
      } catch (error) {
        console.warn('Error parsing domain preferences:', error);
      }
    }
    
    return CURRENCY_PAIRS.filter(pair => {
      const domain = mapCurrencyPairCategoryToDomain(pair.category);
      return domain !== null && selectedCategories.includes(domain);
    });
  };

  // Function to load all commodities from Commodity Market cache
  const loadRealCommodities = async () => {
    setLoadingRealCommodities(true);
    try {
      // ✅ Get selected domains from preferences
      const savedSettings = localStorage.getItem('fxRiskManagerSettings');
      let selectedCategories: CommodityCategory[] = ['metals', 'agricultural', 'energy', 'freight', 'bunker'];
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          if (parsed?.domains?.selectedDomains && Array.isArray(parsed.domains.selectedDomains)) {
            selectedCategories = parsed.domains.selectedDomains;
          }
        } catch (error) {
          console.warn('Error parsing domain preferences:', error);
        }
      }
      
      const allCommodities: Commodity[] = [];
      
      // Load from cache first (fast) - only for selected domains
      for (const category of selectedCategories) {
        try {
          const cached = localStorage.getItem(`fx_commodities_cache_${category}`);
          if (cached) {
            const cacheData = JSON.parse(cached);
            const now = Date.now();
            const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
            const isExpired = (now - cacheData.timestamp) > CACHE_DURATION;
            
            if (!isExpired && cacheData.data && Array.isArray(cacheData.data)) {
              allCommodities.push(...cacheData.data);
            }
          }
        } catch (error) {
          console.warn(`Error loading cached data for ${category}:`, error);
        }
      }

      // If no cached data, try to fetch - only for selected domains
      if (allCommodities.length === 0) {
        for (const category of selectedCategories) {
          try {
            const data = await fetchCommoditiesData(category, false);
            allCommodities.push(...data);
          } catch (error) {
            console.warn(`Error fetching ${category} data:`, error);
          }
        }
      }

      setRealCommodities(allCommodities);
      console.log(`Loaded ${allCommodities.length} real commodities from Commodity Market`);
    } catch (error) {
      console.error('Error loading real commodities:', error);
      toast({
        title: "Error",
        description: "Failed to load commodities from Commodity Market. Using default list.",
        variant: "destructive"
      });
    } finally {
      setLoadingRealCommodities(false);
    }
  };

  // Load real commodities when useRealData is enabled
  useEffect(() => {
    if (useRealData) {
      loadRealCommodities();
    }
  }, [useRealData]);

  // ── Ticker Peek Pro: Load all commodities (same as Pricers) ──
  const loadAllTppCurrencies = useCallback(async () => {
    setTppLoadingCurrencies(true);
    const categories: TppCommodityCategory[] = ['energies', 'metals', 'grains', 'livestock'];
    const categorized: Record<string, TppCurrencyData[]> = {};
    const results = await Promise.allSettled(
      categories.map(cat => fetchTppCurrencies(cat))
    );
    categories.forEach((cat, idx) => {
      const result = results[idx];
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        const unique = result.value.data.reduce<TppCurrencyData[]>((acc, c) => {
          if (!acc.find(x => x.symbol === c.symbol)) acc.push(c);
          return acc;
        }, []);
        categorized[cat] = unique;
      }
    });
    setTppCurrenciesByCategory(categorized);
    setTppCurrencies(Object.values(categorized).flat());
    setTppLoadingCurrencies(false);
  }, []);

  // ── Ticker Peek Pro: Load Cash price from Futures + IV surface (same as Pricers) ──
  const loadTppData = useCallback(async (symbol: string, forceRefresh = false) => {
    setTppLoadingFutures(true);
    try {
      const futuresResult = await fetchTppFutures(symbol, forceRefresh);
      if (futuresResult.success && futuresResult.data && futuresResult.data.length > 0) {
        setTppFutures(futuresResult.data);
        const cashContract = futuresResult.data.find(f =>
          f.month.toLowerCase().includes('cash') || f.contract.toLowerCase().includes('cash')
        ) || futuresResult.data[0];
        const cashPrice = parseFloat(cashContract.last.replace(/,/g, ''));
        if (!isNaN(cashPrice) && cashPrice > 0) {
          setParams(prev => ({ ...prev, spotPrice: cashPrice }));
          setInitialSpotPrice(cashPrice);
          toast({ title: "Ticker Peek Pro — Cash Price", description: `${symbol}: ${cashPrice.toFixed(2)}` });
        }
      } else {
        setTppFutures([]);
      }
    } catch (error) {
      console.error('Error loading TPP futures:', error);
      setTppFutures([]);
    } finally {
      setTppLoadingFutures(false);
    }

    setTppLoadingSurface(true);
    setTppSurfacePoints([]);
    try {
      const strikesResult = await fetchTppVolSurfaceStrikes(symbol, symbol, 50, forceRefresh);
      if (strikesResult.success && strikesResult.strikes && strikesResult.strikes.length > 0) {
        const allStrikes = strikesResult.strikes;
        const surfaceResult = await fetchTppVolSurface(
          symbol, symbol, 50, forceRefresh, allStrikes[0], allStrikes[allStrikes.length - 1]
        );
        if (surfaceResult.success && surfaceResult.surfacePoints && surfaceResult.surfacePoints.length > 0) {
          setTppSurfacePoints(surfaceResult.surfacePoints);
          const parseIvNum = (v: unknown): number => {
            const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
            return Number.isNaN(n) ? 0 : n;
          };
          const avgIv = surfaceResult.surfacePoints.reduce((s, p) => s + parseIvNum(p.iv), 0) / surfaceResult.surfacePoints.length;
          // IV from API may be percentage (e.g. 25) or decimal (0.25); display as percentage
          const ivPct = avgIv > 1 ? avgIv : avgIv * 100;
          if (ivPct > 0 && ivPct < 200) {
            try {
              const saved = localStorage.getItem('calculatorState');
              const state = saved ? JSON.parse(saved) : {};
              state.strategyComponent = state.strategyComponent || {};
              state.strategyComponent.volatility = Math.round(ivPct * 10) / 10;
              localStorage.setItem('calculatorState', JSON.stringify(state));
              window.dispatchEvent(new CustomEvent('calculatorStateUpdated'));
            } catch (_) {}
          }
          toast({ title: "IV Surface Loaded", description: `${surfaceResult.surfacePoints.length} points — volatility updated from TPP` });
        }
      }
    } catch (error) {
      console.error('Error loading TPP IV surface:', error);
    } finally {
      setTppLoadingSurface(false);
    }
  }, [toast]);

  // ── Ticker Peek Pro: Bilinear IV interpolation (same as Pricers) ──
  const interpolateTppIV = useCallback((absoluteStrike: number, dte: number, type: 'call' | 'put'): number | null => {
    if (tppSurfacePoints.length === 0) return null;
    const filtered = tppSurfacePoints.filter(p => p.type === type);
    if (filtered.length === 0) return null;

    const strikes = [...new Set(filtered.map(p => p.strike))].sort((a, b) => a - b);
    const dtes = [...new Set(filtered.map(p => p.dte))].sort((a, b) => a - b);
    if (strikes.length < 2 || dtes.length < 2) return null;

    // TPP surface can return IV as percentage (e.g. 25) or decimal (0.25); normalize to decimal for pricing
    const parseIv = (v: unknown): number | null => {
      if (v == null) return null;
      const n = typeof v === 'string' ? parseFloat(String(v).replace(',', '.')) : Number(v);
      return Number.isNaN(n) || n <= 0 ? null : n;
    };
    let z: (number | null)[][] = dtes.map(d =>
      strikes.map(s => {
        const point = filtered.find(p => p.dte === d && p.strike === s);
        const raw = parseIv(point?.iv);
        if (raw == null) return null;
        return impliedVolSurfacePointToDecimal(raw);
      })
    );
    z = interpolateSurface(z, strikes, dtes);

    let si = strikes.findIndex(s => s >= absoluteStrike);
    let di = dtes.findIndex(d => d >= dte);
    if (si <= 0) si = 1;
    if (si >= strikes.length) si = strikes.length - 1;
    if (di <= 0) di = 1;
    if (di >= dtes.length) di = dtes.length - 1;

    const s0 = strikes[si - 1], s1 = strikes[si];
    const d0 = dtes[di - 1], d1 = dtes[di];
    const z00 = z[di - 1]?.[si - 1], z01 = z[di - 1]?.[si];
    const z10 = z[di]?.[si - 1], z11 = z[di]?.[si];
    const vals = [z00, z01, z10, z11].filter(v => v !== null) as number[];
    if (vals.length === 0) return null;
    if (vals.length < 4) return vals.reduce((a, b) => a + b, 0) / vals.length;

    const ts = s1 !== s0 ? (absoluteStrike - s0) / (s1 - s0) : 0.5;
    const td = d1 !== d0 ? (dte - d0) / (d1 - d0) : 0.5;
    return z00! * (1 - ts) * (1 - td) + z01! * ts * (1 - td) + z10! * (1 - ts) * td + z11! * ts * td;
  }, [tppSurfacePoints]);

  useEffect(() => {
    if (useTickerPeekPro) {
      loadAllTppCurrencies();
      setUseRealData(false);
      try {
        const saved = localStorage.getItem('calculatorState');
        const state = saved ? JSON.parse(saved) : {};
        state.useRealData = false;
        localStorage.setItem('calculatorState', JSON.stringify(state));
      } catch (_) {}
    }
  }, [useTickerPeekPro, loadAllTppCurrencies]);

  useEffect(() => {
    if (useTickerPeekPro && params.currencyPair?.symbol) {
      loadTppData(params.currencyPair.symbol);
    }
  }, [useTickerPeekPro, params.currencyPair?.symbol]);

  // Strategy components state
  const [strategy, setStrategy] = useState(() => {
    try {
    const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).strategy || [] : [];
    } catch (error) {
      console.warn('Error parsing strategy from localStorage:', error);
      return [];
    }
  });

  // Results state - complete results for calculations
  const [results, setResults] = useState(() => {
    try {
    const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).results || null : null;
    } catch (error) {
      console.warn('Error parsing results from localStorage:', error);
      return null;
    }
  });

  // Display results state - filtered results for user interface
  const [displayResults, setDisplayResults] = useState(() => {
    try {
    const savedState = localStorage.getItem('calculatorState');
      const fullResults = savedState ? JSON.parse(savedState).results || null : null;
    // Initialize with full results, will be filtered when calculateResults runs
    return fullResults;
    } catch (error) {
      console.warn('Error parsing displayResults from localStorage:', error);
      return null;
    }
  });

  // Manual forward prices state
  const [manualForwards, setManualForwards] = useState(() => {
    try {
    const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).manualForwards || {} : {};
    } catch (error) {
      console.warn('Error parsing manualForwards from localStorage:', error);
      return {};
    }
  });

  // Real prices state
  const [realPrices, setRealPrices] = useState(() => {
    try {
    const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).realPrices || {} : {};
    } catch (error) {
      console.warn('Error parsing realPrices from localStorage:', error);
      return {};
    }
  });

  // Payoff data state
  const [payoffData, setPayoffData] = useState(() => {
    try {
    const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).payoffData || [] : [];
    } catch (error) {
      console.warn('Error parsing payoffData from localStorage:', error);
      return [];
    }
  });

  // Real prices simulation parameters
  const [realPriceParams, setRealPriceParams] = useState<{
    useSimulation: boolean;
    volatility: number;
    drift: number;
    numSimulations: number;
  }>({
      useSimulation: false,
      volatility: 0.3,
    drift: 0,
      numSimulations: 1000
  });

  const [barrierOptionSimulations, setBarrierOptionSimulations] = useState<number>(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).barrierOptionSimulations || 1000 : 1000;
  });
  
  // Legacy: useClosedFormBarrier is now handled by barrierPricingModel

  // Month names in English
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Custom scenario state
  const [customScenario, setCustomScenario] = useState<StressTestScenario>(() => {
    const savedState = localStorage.getItem('calculatorState');
    return savedState ? JSON.parse(savedState).customScenario : {
      name: "Custom Case",
      description: "User-defined scenario",
      volatility: 0.2,
      drift: 0.01,
      priceShock: 0,
      forwardBasis: 0,
      isCustom: true
    };
  });

  // Stress Test Scenarios - Updated to reflect historical FX crisis scenarios
  const [stressTestScenarios, setStressTestScenarios] = useState<Record<string, StressTestScenario>>(() => {
    const savedState = localStorage.getItem('calculatorState');
    // Force loading of new scenarios by checking if we have all expected scenarios
    const defaultScenarios = {
      base: {
        name: "Base Case",
        description: "Normal market conditions",
        volatility: 0.20,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true,
        isHistorical: false
      },
      
      highVol: {
        name: "High Volatility",
        description: "Double volatility scenario",
        volatility: 0.40,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true,
        isHistorical: false
      },
      
      crash: {
        name: "Market Crash",
        description: "High volatility, negative drift, price shock",
        volatility: 0.50,
        drift: -0.03,
        priceShock: -0.20,
        forwardBasis: 0,
        isEditable: true,
        isHistorical: false
      },
      
      bull: {
        name: "Bull Market",
        description: "Low volatility, positive drift, upward shock",
        volatility: 0.15,
        drift: 0.02,
        priceShock: 0.10,
        forwardBasis: 0,
        isEditable: true,
        isHistorical: false
      },
      
      contango: {
        name: "Contango",
        description: "Upward sloping forward curve",
        volatility: 0.25,
        drift: 0.005,
        priceShock: 0,
        forwardBasis: 0.05,
        isEditable: true,
        isHistorical: false
      },
      
      backwardation: {
        name: "Backwardation",
        description: "Downward sloping forward curve",
        volatility: 0.25,
        drift: 0.005,
        priceShock: 0,
        forwardBasis: -0.05,
        isEditable: true,
        isHistorical: false
      },
      
      contangoReal: {
        name: "Contango (Real Prices)",
        description: "Contango with real price impact",
        volatility: 0.25,
        drift: 0.005,
        priceShock: 0,
        forwardBasis: 0.05,
        realBasis: 0.05,
        isEditable: true,
        isHistorical: false
      },
      
      backwardationReal: {
        name: "Backwardation (Real Prices)",
        description: "Backwardation with real price impact",
        volatility: 0.25,
        drift: 0.005,
        priceShock: 0,
        forwardBasis: -0.05,
        realBasis: -0.05,
        isEditable: true,
        isHistorical: false
      },
      
      custom: {
        name: "Custom Case",
        description: "User-defined stress scenario",
        volatility: 0.20,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isCustom: true,
        isEditable: true,
        isHistorical: false
      }
    };
    
    // Always return default scenarios to ensure we have all the new ones
    if (savedState) {
      const parsed = JSON.parse(savedState);
      // Check if we have all the new scenarios, if not, use defaults
      const savedScenarios = parsed.stressTestScenarios || {};
      const expectedScenarios = ['base', 'highVol', 'crash', 'bull', 'contango', 'backwardation', 'contangoReal', 'backwardationReal', 'custom'];
      
      const hasAllScenarios = expectedScenarios.every(key => savedScenarios[key]);
      
      if (hasAllScenarios) {
        return savedScenarios;
      }
    }
    
    return defaultScenarios;
  });

  // Add this new state
  const [activeStressTest, setActiveStressTest] = useState<string | null>(null);
  
  // Function to get stress test summary stats
  const getStressTestSummary = () => {
    if (!activeStressTest || !stressTestScenarios[activeStressTest]) return null;
    
    const scenario = stressTestScenarios[activeStressTest];
    return {
      name: scenario.name,
      type: scenario.isCustom ? 'Custom' : 
            ['contango', 'backwardation', 'contangoReal', 'backwardationReal'].includes(activeStressTest) ? 'Market Structure' : 
            ['crash', 'bull'].includes(activeStressTest) ? 'Market Direction' : 'Base',
      riskLevel: Math.abs(scenario.priceShock) > 0.15 ? 'High' : 
                 Math.abs(scenario.priceShock) > 0.05 ? 'Medium' : 'Low',
      severity: {
        volatility: scenario.volatility,
        shock: scenario.priceShock,
        drift: scenario.drift
      }
    };
  };

  // Add state for showing inputs
  const [showInputs, setShowInputs] = useState<Record<string, boolean>>({});

  // Toggle inputs visibility for a scenario
  const toggleInputs = (key: string) => {
    setShowInputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Add these new states - Initialize from localStorage
  const [useImpliedVol, setUseImpliedVol] = useState(() => {
    try {
      const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).useImpliedVol || false : false;
    } catch (error) {
      console.warn('Error parsing useImpliedVol from localStorage:', error);
      return false;
    }
  });
  
  const [impliedVolatilities, setImpliedVolatilities] = useState<OptionImpliedVolatility>(() => {
    try {
      const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).impliedVolatilities || {} : {};
    } catch (error) {
      console.warn('Error parsing impliedVolatilities from localStorage:', error);
      return {};
    }
  });

  const [useRealInterestRate, setUseRealInterestRate] = useState(() => {
    try {
      const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).useRealInterestRate ?? false : false;
    } catch (error) {
      console.warn('Error parsing useRealInterestRate from localStorage:', error);
      return false;
    }
  });

  // État pour les prix d'options personnalisés - Initialize from localStorage
  const [useCustomOptionPrices, setUseCustomOptionPrices] = useState(() => {
    try {
      const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).useCustomOptionPrices || false : false;
    } catch (error) {
      console.warn('Error parsing useCustomOptionPrices from localStorage:', error);
      return false;
    }
  });
  
  const [customOptionPrices, setCustomOptionPrices] = useState<{[key: string]: {[key: string]: number}}>(() => {
    try {
      const savedState = localStorage.getItem('calculatorState');
      return savedState ? JSON.parse(savedState).customOptionPrices || {} : {};
    } catch (error) {
      console.warn('Error parsing customOptionPrices from localStorage:', error);
      return {};
    }
  });
  
  // Historical data and monthly stats
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [showHistoricalData, setShowHistoricalData] = useState(true);
  const [showMonthlyStats, setShowMonthlyStats] = useState(true);

  // Function to generate FX-appropriate price ranges based on current currency pair
  const generateFXPriceRanges = (currencyPair: CurrencyPair, spotPrice: number): PriceRange[] => {
    // Determine volatility tier based on currency pair
    let volatilityTier: 'low' | 'medium' | 'high' = 'medium';
    
    if (['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CHF'].includes(currencyPair.symbol)) {
      volatilityTier = 'low'; // Major pairs - lower volatility
    } else if (['EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'GBP/CHF', 'CHF/JPY'].includes(currencyPair.symbol)) {
      volatilityTier = 'medium'; // Cross pairs - medium volatility
    } else {
      volatilityTier = 'high'; // Exotic pairs - higher volatility
    }
    
    // Define movement ranges based on volatility tier
    const movements = {
      low: [-0.08, -0.04, 0.04, 0.08], // ±4-8% for majors
      medium: [-0.12, -0.06, 0.06, 0.12], // ±6-12% for crosses
      high: [-0.20, -0.10, 0.10, 0.20] // ±10-20% for exotics
    };
    
    const rangeMoves = movements[volatilityTier];
    
    // Generate price levels around current spot
    const prices = rangeMoves.map(move => spotPrice * (1 + move));
    prices.sort((a, b) => a - b);
    
    // Create ranges with appropriate probabilities (normal distribution-like)
    return [
      { 
        min: parseFloat(prices[0].toFixed(4)), 
        max: parseFloat(prices[1].toFixed(4)), 
        probability: 20 // Tail risk
      },
      { 
        min: parseFloat(prices[1].toFixed(4)), 
        max: parseFloat(spotPrice.toFixed(4)), 
        probability: 30 // Below current
      },
      { 
        min: parseFloat(spotPrice.toFixed(4)), 
        max: parseFloat(prices[2].toFixed(4)), 
        probability: 30 // Above current
      },
      { 
        min: parseFloat(prices[2].toFixed(4)), 
        max: parseFloat(prices[3].toFixed(4)), 
        probability: 20 // Tail risk
      }
    ];
  };

  const [priceRanges, setPriceRanges] = useState<PriceRange[]>(() => {
    // Initialize with FX-appropriate ranges
    return generateFXPriceRanges(params.currencyPair, params.spotPrice);
  });

  const [matrixStrategies, setMatrixStrategies] = useState<{
    components: StrategyComponent[];
    coverageRatio: number;
    name: string;
  }[]>([]);

  const [riskMatrixResults, setRiskMatrixResults] = useState<RiskMatrixResult[]>([]);

  // Forex-specific states
  const [optionPricingModel, setOptionPricingModel] = useState<'black-76' | 'black-scholes' | 'garman-kohlhagen' | 'monte-carlo'>('black-scholes');
  const [barrierPricingModel, setBarrierPricingModel] = useState<'monte-carlo' | 'closed-form'>('closed-form');

  // Ajouter cet état
  const [savedRiskMatrices, setSavedRiskMatrices] = useState<SavedRiskMatrix[]>(() => {
    const saved = localStorage.getItem('savedRiskMatrices');
    return saved ? JSON.parse(saved) : [];
  });

  // Ajouter un état pour stocker les volumes personnalisés par mois
  const [customVolumes, setCustomVolumes] = useState<Record<string, number>>({});

  // Ajouter un état pour l'onglet actif des résultats
  const [activeResultsTab, setActiveResultsTab] = useState('detailed');

  // Ajouter une fonction pour gérer les changements de volume personnalisé
  const handleCustomVolumeChange = (monthKey: string, newVolume: number) => {
    // Mettre à jour l'état des volumes personnalisés
    setCustomVolumes(prev => ({
      ...prev,
      [monthKey]: newVolume
    }));
    
    // Recalculer les résultats avec les nouveaux volumes
    recalculateResults();
  };

  // Fonction pour recalculer les résultats avec les volumes personnalisés
  const recalculateResults = () => {
    if (!results) return;
    
    // Create copy of results
    const updatedResults = [...results];
    
    // Update each result with new data
    updatedResults.forEach(result => {
      const date = new Date(result.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      // Update forward price if available in manual forwards
      if (manualForwards[monthKey]) {
        result.forward = manualForwards[monthKey];
      }
      
      // Update real price if available in real prices
      if (realPrices[monthKey]) {
        result.realPrice = realPrices[monthKey];
      }
      
      // Recalculate option prices with current parameters and IV
      result.optionPrices.forEach((option, optionIndex) => {
        const strike = option.strike;
        
        // Use custom option prices if enabled
        const optionKey = `${option.type}-${optionIndex}`;
        if (useCustomOptionPrices && customOptionPrices[monthKey]?.[optionKey] !== undefined) {
          option.price = customOptionPrices[monthKey][optionKey];
        } else {
          // Otherwise recalculate price with current parameters
          let volatilityToUse;
          
          if (useImpliedVol && impliedVolatilities[monthKey]) {
            // Use implied volatility if available
            const iv = getImpliedVolatility(monthKey, optionKey);
            volatilityToUse = (iv !== undefined && iv !== null) ? iv / 100 : 
              (strategy.find(opt => opt.type === option.type)?.volatility || 20) / 100;
          } else {
            // Use strategy volatility
            volatilityToUse = (strategy.find(opt => opt.type === option.type)?.volatility || 20) / 100;
          }
          
          // Calculate price with proper volatility
          if (option.type === 'forward') {
            option.price = presentValueForwardPayoff(
              result.forward,
              strike,
              strategyBuilderAnnualPercentToDecimal(params.interestRate),
              result.timeToMaturity
            );
          } else if (option.type === 'call' || option.type === 'put') {
            option.price = calculateGarmanKohlhagenPrice(
              option.type,
              result.forward,
              strike,
              strategyBuilderAnnualPercentToDecimal(params.interestRate),
              strategyBuilderAnnualPercentToDecimal(params.interestRate),
              result.timeToMaturity,
              volatilityToUse
            );
          } else if (option.type.includes('knockout') || option.type.includes('knockin')) {
            // For barrier options, use the appropriate calculation
            const strategyOption = strategy.find(opt => opt.type === option.type);
            if (strategyOption) {
              const barrier = strategyOption.barrierType === 'percent' ? 
                params.spotPrice * (strategyOption.barrier / 100) : 
                strategyOption.barrier;
                
              const secondBarrier = option.type.includes('double') ? 
                (strategyOption.barrierType === 'percent' ? 
                  params.spotPrice * (strategyOption.secondBarrier / 100) : 
                  strategyOption.secondBarrier) : 
                undefined;
                
              if (barrierPricingModel === 'closed-form') {
                const underlyingResult = calculateUnderlyingPrice(
                  params.spotPrice,
                  strategyBuilderAnnualPercentToDecimal(params.interestRate),
                  params.foreignRate/100,
                  result.timeToMaturity
                );
                option.price = calculateBarrierOptionClosedForm(
                  option.type,
                  underlyingResult.price,
                  strike,
                  strategyBuilderAnnualPercentToDecimal(params.interestRate),
                  result.timeToMaturity,
                  volatilityToUse,
                  barrier,
                  secondBarrier
                );
              } else {
                const underlyingResult = calculateUnderlyingPrice(
                  params.spotPrice,
                  strategyBuilderAnnualPercentToDecimal(params.interestRate),
                  params.foreignRate/100,
                  result.timeToMaturity
                );
                option.price = calculateBarrierOptionPrice(
                  option.type,
                  underlyingResult.price,
                  strike,
                  strategyBuilderAnnualPercentToDecimal(params.interestRate),
                  result.timeToMaturity,
                  volatilityToUse,
                  barrier,
                  secondBarrier,
                  barrierOptionSimulations
                );
              }
            }
          } else if (
            option.type.includes('one-touch') ||
            option.type.includes('double-touch') ||
            option.type.includes('no-touch') ||
            option.type.includes('double-no-touch') ||
            option.type.includes('range-binary') ||
            option.type.includes('outside-binary')
          ) {
            // For digital options
            const strategyOption = strategy.find(opt => opt.type === option.type);
            if (strategyOption) {
              const barrier = strategyOption.barrierType === 'percent' ? 
                params.spotPrice * (strategyOption.barrier / 100) : 
                strategyOption.barrier;
                
              const secondBarrier = option.type.includes('double') ? 
                (strategyOption.barrierType === 'percent' ? 
                  params.spotPrice * (strategyOption.secondBarrier / 100) : 
                  strategyOption.secondBarrier) : 
                undefined;
                
              const underlyingResult = calculateUnderlyingPrice(
                params.spotPrice,
                strategyBuilderAnnualPercentToDecimal(params.interestRate),
                params.foreignRate/100,
                result.timeToMaturity
              );
              option.price = calculateDigitalOptionPrice(
                option.type,
                underlyingResult.price,
                strike,
                strategyBuilderAnnualPercentToDecimal(params.interestRate),
                result.timeToMaturity,
                volatilityToUse,
                barrier,
                secondBarrier,
                10000,
                strategyOption.rebate ?? 1
              );
            }
          }
        }
      });
      
      // Recalculate strategy price
      result.strategyPrice = validateDataForReduce(result.optionPrices).reduce((sum, opt) => sum + opt.price * opt.quantity/100, 0);
      
      // Recalculate hedged cost, unhedged cost, delta P&L
      const monthlyPayoff = result.realPrice - result.forward;
      result.totalPayoff = monthlyPayoff * result.monthlyVolume;
      result.hedgedCost = result.strategyPrice * result.monthlyVolume;
      result.unhedgedCost = result.totalPayoff;
      result.deltaPnL = result.unhedgedCost - result.hedgedCost;
    });
    
    // Update results state
    setResults(updatedResults);
  };

  // Modify the calculatePayoff function to handle barrier options
  const calculatePayoff = () => {
    if (strategy.length === 0) return;

    const spotPrice = params.spotPrice;
    const priceRange = Array.from({length: 101}, (_, i) => spotPrice * (0.5 + i * 0.01));
    
    const numSteps = 252;
    const paths = generateStrategyBuilderPayoffDiagramPaths({
      spotPrice,
      domesticRatePercent: params.domesticRate,
      foreignRatePercent: params.foreignRate,
      sigmaDecimal: realPriceParams.volatility,
      numSteps,
      numSimulations: 500,
    });

    const payoffCalculation = priceRange.map(price => {
      let totalPayoff = 0;

      strategy.forEach(option => {
        const strike = option.strikeType === 'percent' 
          ? params.spotPrice * (option.strike / 100) 
          : option.strike;

        const quantity = option.quantity / 100;

        // Calculate option price based on type
        let optionPremium;
        
        if (option.type === 'call' || option.type === 'put') {
          // Use appropriate pricing model for FX options
          if (optionPricingModel === 'garman-kohlhagen') {
            optionPremium = calculateGarmanKohlhagenPrice(
              option.type,
              spotPrice,
              strike,
              strategyBuilderAnnualPercentToDecimal(params.interestRate),
              strategyBuilderAnnualPercentToDecimal(params.interestRate),
              1, // 1 year for payoff diagrams
              option.volatility/100
            );
          } else {
            optionPremium = calculateBlackScholesSpotPrice(
              option.type,
              spotPrice,
              strike,
              params.domesticRate / 100,
              1,
              option.volatility / 100
            );
          }
        } else if (option.type.includes('knockout') || option.type.includes('knockin')) {
          // Use Monte Carlo for barrier options
          const barrier = option.barrierType === 'percent' ? 
            params.spotPrice * (option.barrier / 100) : 
            option.barrier;
            
          const secondBarrier = option.type.includes('double') ? 
            (option.barrierType === 'percent' ? 
              params.spotPrice * (option.secondBarrier / 100) : 
              option.secondBarrier) : 
            undefined;
            
          optionPremium = calculatePricesFromPaths(
          option.type,
          spotPrice,
          strike,
          strategyBuilderAnnualPercentToDecimal(params.interestRate),
            numSteps,
            paths,
            barrier,
            secondBarrier
          );
        } else if (option.type === 'swap') {
          // For swaps, premium is typically negligible for payoff diagrams
          optionPremium = 0;
        } else if (['one-touch', 'no-touch', 'double-touch', 'double-no-touch', 'range-binary', 'outside-binary'].includes(option.type)) {
          // Pour les options digitales, utiliser une approximation simple pour les graphiques de payoff
          const rebateDecimal = (option.rebate || 5) / 100;
          // Approximation simple : prime = probability * rebate * discount factor
          optionPremium = 0.5 * rebateDecimal * discountFactorContinuous(params.domesticRate/100, 1);
        }

        // Payoff is centralized in PricingService to keep Strategy Builder / Hedging Instruments consistent.
        const payoff = calculateStrategyPayoffAtPrice([option], price, spotPrice);
        
        // Subtract premium for net payoff
        const netPayoff = payoff - optionPremium;
        totalPayoff += netPayoff * quantity;
      });

      return { price, payoff: totalPayoff };
    });

    setPayoffData(payoffCalculation);
  };

  // Add new option to strategy
  const addOption = () => {
    setStrategy([...strategy, {
      type: 'call',
      strike: 100,
      strikeType: 'percent',
      volatility: 20,
      quantity: 100,
      // Ne pas ajouter de barrières par défaut - elles seront ajoutées seulement si nécessaires
      barrierType: 'percent'
    }]);
  };

  // Remove option from strategy
  const removeOption = (index) => {
    const newStrategy = strategy.filter((_, i) => i !== index);
    setStrategy(newStrategy);
    
    if (newStrategy.length > 0) {
      calculatePayoff();
    } else {
      setPayoffData([]);
    }
  };

  // Update option parameters
  const updateOption = (index, field, value) => {
    const newStrategy = [...strategy];
    newStrategy[index][field] = value;
    setStrategy(newStrategy);
    calculatePayoff();
  };

  // Filter results to show only from user's chosen start date onwards
  const filterResultsForDisplay = (allResults: Result[], hedgingStartDate: string): Result[] | null => {
    if (!allResults || allResults.length === 0) {
      return null;
    }

    // Since we now generate months starting from hedging start date, 
    // we should show ALL calculated results (all months to hedge)
    console.log(`[DISPLAY FILTER] Hedging start date: ${hedgingStartDate}`);
    console.log(`[DISPLAY FILTER] Showing ALL ${allResults.length} calculated periods (all months to hedge)`);
    
    if (allResults.length > 0) {
      console.log(`[DISPLAY FILTER] First period: ${allResults[0].date}`);
      console.log(`[DISPLAY FILTER] Last period: ${allResults[allResults.length - 1].date}`);
    }

    return allResults;
  };

  // Canonical rounding for option/forward prices (6 decimals) - align with export and Hedging Instruments
  const roundOptionPrice = (p: number) => Math.round(p * 1e6) / 1e6;

  // Calculate detailed results
  const calculateResults = () => {
    // Use strategy start date for financial calculations (accurate time-to-maturity and forward prices)
    const strategyStartDate = new Date(params.strategyStartDate);
    const calculationStartDate = new Date(strategyStartDate.getFullYear(), strategyStartDate.getMonth(), strategyStartDate.getDate());
    
    // User's chosen hedging start date - this is where pricing and hedging periods should start
    const hedgingStartDate = new Date(params.startDate);
    
    let months = [];
    let monthlyVolumes = [];

    // Check if we're using custom periods or standard months
    if (params.useCustomPeriods && params.customPeriods.length > 0) {
      // Sort custom periods by maturity date
      const sortedPeriods = [...params.customPeriods].sort(
        (a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime()
      );
      
      // Convert custom periods to months array
      months = sortedPeriods.map(period => new Date(period.maturityDate));
      
      // Use the volumes defined in custom periods
      monthlyVolumes = sortedPeriods.map(period => period.volume);
    } else {
      // Generate exactly the number of months specified by the user
      // Maturity = last day of month or third Friday (Settings → Pricing → Maturity date for pricing)
      const maturityConvention = getMaturityConvention();
      let currentDate = new Date(hedgingStartDate);
      
      for (let i = 0; i < params.monthsToHedge; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const maturityDate = getMaturityDateForMonth(year, month, maturityConvention);
        months.push(maturityDate);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      console.log(`[CALCULATION] Generated exactly ${months.length} periods (${maturityConvention}) starting from HEDGING START DATE ${formatDateLocal(new Date(hedgingStartDate))}`);
      
      // Use equal volumes for each month
      const monthlyVolume = params.totalVolume / months.length;
      monthlyVolumes = Array(months.length).fill(monthlyVolume);
    }

    // Generate price paths for the entire period (from today's date for accurate calculations)
    const { paths, monthlyIndices } = generateStrategyBuilderPricePaths({
      monthMaturityStrs: months.map((d) => formatDateLocal(d)),
      valuationDateStr: formatDateLocal(calculationStartDate),
      spotPrice: params.spotPrice,
      domesticRatePercent: params.domesticRate,
      foreignRatePercent: params.foreignRate,
      sigmaDecimal: realPriceParams.volatility,
      numSimulations: realPriceParams.numSimulations,
    });

    // If simulation is enabled, generate new real prices using the first path
    if (realPriceParams.useSimulation) {
      const simulatedPrices = {};
      months.forEach((date, idx) => {
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        // Use the first simulated path as the 'real' price path
        simulatedPrices[monthKey] = paths[0][monthlyIndices[idx]];
      });
      setRealPrices(simulatedPrices);
    }

    // Prepare Monte Carlo visualization data once we have paths
    const timeLabels = months.map(
      (date) => `${date.getFullYear()}-${date.getMonth() + 1}`
    );

    // Select randomly up to 100 paths to display
    const maxDisplayPaths = Math.min(100, paths.length);
    const selectedPathIndices = [];
    
    // If we have fewer than 100 paths, use all of them
    if (paths.length <= maxDisplayPaths) {
      for (let i = 0; i < paths.length; i++) {
        selectedPathIndices.push(i);
      }
    } else {
      // Otherwise, select 100 random indices
      while (selectedPathIndices.length < maxDisplayPaths) {
        const randomIndex = Math.floor(Math.random() * paths.length);
        if (!selectedPathIndices.includes(randomIndex)) {
          selectedPathIndices.push(randomIndex);
        }
      }
    }
    
    // Create the real price paths data
    const realPricePaths = selectedPathIndices.map(pathIndex => 
      monthlyIndices.map(idx => paths[pathIndex][idx])
    );

    // Calculate barrier option prices if we have barrier options
    const barrierOptions = strategy.filter(
      (opt) => opt.type.includes('knockout') || opt.type.includes('knockin')
    );

    const barrierOptionPricePaths: number[][] = [];

    if (barrierOptions.length > 0) {
      // For simplicity, use the first barrier option
      const barrierOption = barrierOptions[0];
      
      // Calculate barrier value
      const barrier = barrierOption.barrierType === 'percent' 
        ? params.spotPrice * (barrierOption.barrier! / 100) 
        : barrierOption.barrier!;
      
      const secondBarrier = barrierOption.type.includes('double')
        ? barrierOption.barrierType === 'percent'
          ? params.spotPrice * (barrierOption.secondBarrier! / 100)
          : barrierOption.secondBarrier
        : undefined;
        
      // Calculate strike
      const strike = barrierOption.strikeType === 'percent'
        ? params.spotPrice * (barrierOption.strike / 100)
        : barrierOption.strike;

      // Calculate option prices for selected paths
      for (const pathIndex of selectedPathIndices) {
        const path = paths[pathIndex];
        const optionPrices: number[] = [];
        
        // For each month, calculate the option price
        for (let monthIdx = 0; monthIdx < monthlyIndices.length; monthIdx++) {
          const maturityIndex = monthlyIndices[monthIdx];
          
          // Calculate option price at this point
          const optionPrice = calculatePricesFromPaths(
            barrierOption.type,
            params.spotPrice,
            strike,
            strategyBuilderAnnualPercentToDecimal(params.interestRate),
            maturityIndex,
            [path],
            barrier,
            secondBarrier
          );
          
          optionPrices.push(optionPrice);
        }
        
        barrierOptionPricePaths.push(optionPrices);
      }
    }

    // Update visualization data with the calculated paths
    setSimulationData({
      realPricePaths,
      timeLabels,
      strategyName: barrierOptions.length > 0 
        ? `${barrierOptions[0].type} at ${barrierOptions[0].strike}` 
        : 'Current Strategy',
    });

    // Calculate time to maturity using the canonical function (local date strings, same as HedgingInstruments)
    const calculationStartStr = formatDateLocal(calculationStartDate);
    const timeToMaturities = months.map(date => {
      return calculateTimeToMaturity(formatDateLocal(date), calculationStartStr);
    });

    // Ticker Peek Pro: build futures curve for forward interpolation
    let curvePoints: FuturesCurvePoint[] = [];
    if (useTickerPeekPro && tppFutures.length >= 2 && params.currencyPair?.symbol) {
      curvePoints = getOrBuildCurve(params.currencyPair.symbol, tppFutures, calculationStartDate);
    }

    // Suivi des options knocked out
    const knockedOutOptions = new Set();
    
    // Pour chaque chemin de simulation, vérifier à l'avance les franchissements de barrière
    const barrierCrossings = {};
    // Pour suivre les options knock-in activées
    const barrierActivations = {};
    
    strategy.forEach((option, optIndex) => {
      // Gestion des options knockout
      if (option.type.includes('knockout')) {
        const optionId = `${option.type}-${optIndex}`;
        barrierCrossings[optionId] = [];
        
        // Vérifier les franchissements sur le chemin principal (celui utilisé pour les real prices)
        const barrier = option.barrierType === 'percent' ? 
          params.spotPrice * (option.barrier / 100) : 
          option.barrier;
          
        const secondBarrier = option.type.includes('double') ? 
          (option.barrierType === 'percent' ? 
            params.spotPrice * (option.secondBarrier / 100) : 
            option.secondBarrier) : 
          undefined;
        
        // Vérifier le franchissement pour chaque mois
        let isKnockedOut = false;
        
        months.forEach((date, monthIndex) => {
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          const realPrice = realPrices[monthKey] || 0;
          
          // Vérifier si cette option serait knocked out
          let barrierCrossed = false;
          if (!isKnockedOut) { // Ne vérifier que si l'option n'est pas déjà knocked out
            if (option.type.includes('reverse')) {
              if (option.type.includes('put')) {
                // Put Reverse KO: Knocked out si prix au-dessus de la barrière
                barrierCrossed = realPrice >= barrier;
              } else {
                // Call Reverse KO: Knocked out si prix en-dessous de la barrière
                barrierCrossed = realPrice <= barrier;
              }
            } else if (option.type.includes('double')) {
              // Double KO: Knocked out si prix en dehors des deux barrières
              const { lower: lowerBarrier, upper: upperBarrier } = orderedDoubleBarrierLevels(
                barrier,
                secondBarrier ?? barrier
              );
              barrierCrossed = realPrice >= upperBarrier || realPrice <= lowerBarrier;
            } else {
              if (option.type.includes('put')) {
                // Put Standard KO: Knocked out si prix en-dessous de la barrière
                barrierCrossed = realPrice <= barrier;
              } else {
                // Call Standard KO: Knocked out si prix au-dessus de la barrière
                barrierCrossed = realPrice >= barrier;
              }
            }
          }
          
          // Mettre à jour l'état knocked out si la barrière est franchie
          if (barrierCrossed) {
            isKnockedOut = true;
          }
          
          // Stocker si l'option est knocked out à ce mois
          barrierCrossings[optionId][monthIndex] = isKnockedOut;
        });
      }
      
      // Gestion des options knockin - ajout de code similaire pour suivre l'activation
      if (option.type.includes('knockin')) {
        const optionId = `${option.type}-${optIndex}`;
        barrierActivations[optionId] = [];
        
        const barrier = option.barrierType === 'percent' ? 
          params.spotPrice * (option.barrier / 100) : 
          option.barrier;
          
        const secondBarrier = option.type.includes('double') ? 
          (option.barrierType === 'percent' ? 
            params.spotPrice * (option.secondBarrier / 100) : 
            option.secondBarrier) : 
          undefined;
        
        // Vérifier l'activation pour chaque mois
        let isKnockedIn = false;
        
        months.forEach((date, monthIndex) => {
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          const realPrice = realPrices[monthKey] || 0;
          
          // Vérifier si cette option serait knocked in
          let barrierHit = false;
          if (!isKnockedIn) { // Vérifier seulement si l'option n'est pas déjà knocked in
            if (option.type.includes('reverse')) {
              if (option.type.includes('put')) {
                // Put Reverse KI: Knocked in si prix au-dessus de la barrière
                barrierHit = realPrice >= barrier;
              } else {
                // Call Reverse KI: Knocked in si prix en-dessous de la barrière
                barrierHit = realPrice <= barrier;
              }
            } else if (option.type.includes('double')) {
              // Double KI: Knocked in si prix en dehors des deux barrières
              const { lower: lowerBarrier, upper: upperBarrier } = orderedDoubleBarrierLevels(
                barrier,
                secondBarrier ?? barrier
              );
              barrierHit = realPrice >= upperBarrier || realPrice <= lowerBarrier;
            } else {
              if (option.type.includes('put')) {
                // Put Standard KI: Knocked in si prix en-dessous de la barrière
                barrierHit = realPrice <= barrier;
              } else {
                // Call Standard KI: Knocked in si prix au-dessus de la barrière
                barrierHit = realPrice >= barrier;
              }
            }
          }
          
          // Mettre à jour l'état knocked in si la barrière est touchée
          if (barrierHit) {
            isKnockedIn = true;
          }
          
          // Stocker si l'option est knocked in à ce mois
          barrierActivations[optionId][monthIndex] = isKnockedIn;
        });
      }
    });

    // Per-maturity rate: interpolated from Rate Explorer when "Use real interest rate" is on
    const getRateForMaturity = (ttmYears: number): number =>
      useRealInterestRate && getSelectedCurrency ? getRate(getSelectedCurrency, ttmYears) : strategyBuilderAnnualPercentToDecimal(params.interestRate);
    const swapR = timeToMaturities.length > 0
      ? timeToMaturities.reduce((acc, tt) => acc + getRateForMaturity(tt), 0) / timeToMaturities.length
      : strategyBuilderAnnualPercentToDecimal(params.interestRate);
    const swapForwards = months.map((_, idx) => {
      const mKey = `${months[idx].getFullYear()}-${months[idx].getMonth() + 1}`;
      const rate = getRateForMaturity(timeToMaturities[idx]);
      return manualForwards[mKey] || calculateCommodityForwardPrice(initialSpotPrice, rate, 0, 0, timeToMaturities[idx]);
    });
    const swapPriceComputed = calculateSwapPrice(swapForwards, timeToMaturities, swapR);

    // Generate detailed results for each period with the corresponding monthly volume
    const detailedResults = months.map((date, i) => {
      // Use the monthly volume from our array instead of dividing total volume
      const monthlyVolume = monthlyVolumes[i];
      
      const maturityIndex = monthlyIndices[i]; // Add the maturityIndex definition
      const t = timeToMaturities[i]; // raw ACT/365.25 TTM for pricing & rate
      const dte = daysToMaturityFromYearsAct36525(t); // integer days for IV/forward curve lookups only
      const r = getRateForMaturity(t);
      
      // Get forward price: TPP interpolated by maturity, else manual or cost-of-carry
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const forward = (() => {
        if (useTickerPeekPro && curvePoints.length >= 2) {
          const interpolated = interpolateFuturesPrice(curvePoints, dte);
          if (interpolated != null) return interpolated;
        }
        return manualForwards[monthKey] || 
          calculateCommodityForwardPrice(
            initialSpotPrice, 
            r, 
            0, // storage cost = 0
            0, // convenience yield = 0
            t
          );
      })();

      // Get real price (sans PDD - utilisé pour les payoffs d'options/swaps/forwards)
      const realPrice = realPrices[monthKey] || forward;
      
      // Prix réel avec PDD (uniquement pour les coûts, pas pour les payoffs)
      const realPriceWithPDD = realPrice + (params.priceDifferential || 0);

      // Prix du swap (calculé une fois avec taux par maturité / moyenne)
      const swapPrice = swapPriceComputed;

      // Séparer les swaps, forwards et options
        const swaps = strategy.filter(s => s.type === 'swap');
        const forwards = strategy.filter(s => s.type === 'forward');
        const options = strategy.filter(s => s.type !== 'swap' && s.type !== 'forward');

      // Calculer les prix des options en utilisant les chemins de prix
        const optionPrices = options.map((option, optIndex) => {
            let strike = option.strikeType === 'percent' ? 
          params.spotPrice * (option.strike/100) : 
                option.strike;
            
            // Check if this option has dynamic strike calculation based on time to maturity
            if (option.dynamicStrike && option.dynamicStrike.method === 'equilibrium') {
              // Get the balancing option
              const balanceWithOption = strategy[option.dynamicStrike.balanceWithIndex];
              
              if (balanceWithOption) {
                // Calculate the strike of the balancing option
                const balanceWithStrike = balanceWithOption.strikeType === 'percent' ? 
                  forward * (balanceWithOption.strike/100) : 
                  balanceWithOption.strike;
                
                // Calculate volatility, with adjustment if specified
                const volAdjustment = option.dynamicStrike.volatilityAdjustment || 1;
                const balanceWithVol = balanceWithOption.volatility / 100;
                const currentVol = (option.volatility / 100) * volAdjustment;
                
                // Get the type of options
                const balanceWithType = balanceWithOption.type.includes('put') ? 'put' : 'call';
                const currentType = option.type.includes('put') ? 'put' : 'call';
                
                // Risk-free rate for this maturity (row-level r)
                const b = strategyBuilderAnnualPercentToDecimal(params.interestRate);
                
                // Use the selected pricing model for the balancing option
                let balanceWithPrice = 0;
                if (optionPricingModel === 'monte-carlo') {
                  balanceWithPrice = calculateVanillaOptionMonteCarlo(
                    balanceWithType,
                    forward,
                    balanceWithStrike,
                    r,
                    b,
                    t,
                    balanceWithVol,
                    1000
                  );
                } else {
                  balanceWithPrice = calculateBlack76Price(
                    balanceWithType,
                    forward,
                    balanceWithStrike,
                    r,
                    0,
                    t,
                    balanceWithVol
                  );
                }
                
                // Find the strike that gives an equivalent premium for the current option
                let low = forward * 0.5;    // Start with a wide range
                let high = forward * 1.5;
                let mid = 0;
                let price = 0;
                
                // Use bisection method to find equilibrium strike
                for (let iter = 0; iter < 50; iter++) {
                  mid = (low + high) / 2;
                  
                  // Use the selected pricing model for the current option
                  if (optionPricingModel === 'monte-carlo') {
                    price = calculateVanillaOptionMonteCarlo(
                      currentType,
                      forward,
                      mid,
                      r,
                      b,
                      t,
                      currentVol,
                      1000
                    );
                  } else {
                    price = calculateBlack76Price(
                      currentType,
                      forward,
                      mid,
                      r,
                      0,
                      t,
                      currentVol
                    );
                  }
                  
                  // Check if we're close enough
                  if (Math.abs(price - balanceWithPrice) < 0.0001) {
                    break;
                  }
                  
                  // Adjust search range based on option type and price comparison
                  if (price > balanceWithPrice) {
                    if (currentType === 'call') {
                      low = mid;
                    } else { // put
                      high = mid;
                    }
                  } else {
                    if (currentType === 'call') {
                      high = mid;
                    } else { // put
                      low = mid;
                    }
                  }
                }
                
                // Set the dynamically calculated strike for this specific period
                strike = mid;
                
                // Store this as a dynamically calculated strike in an attribute
                // This will be used to display in the UI
                option.dynamicStrikeInfo = {
                  calculatedStrike: strike,
                  calculatedStrikePercent: (forward > 0 ? (strike / forward * 100).toFixed(2) : '0.00') + '%',
                  forwardRate: forward,
                  timeToMaturity: t
                };
                
                // Optional: Log the calculated strike for debugging
                console.log(`Period ${i} (${monthKey}): Calculated strike for ${currentType} at ${(strike || 0).toFixed(4)} (${forward > 0 ? (strike/forward*100).toFixed(2) : '0.00'}% of forward)`);
              }
            }
            
            // Generate a descriptive label based on option type
            let optionLabel = "";
            if (option.type === 'call') {
              optionLabel = `Call Price ${optIndex + 1}`;
            } else if (option.type === 'put') {
              optionLabel = `Put Price ${optIndex + 1}`;
            } else if (option.type === 'swap') {
              optionLabel = `Swap Price ${optIndex + 1}`;
            } else if (option.type === 'forward') {
              optionLabel = `Forward ${optIndex + 1}`;
            } else if (option.type.includes('knockout')) {
              // Knockout options
              if (option.type.includes('call')) {
                if (option.type.includes('reverse')) {
                  optionLabel = `Call Rev KO ${optIndex + 1}`;
                } else if (option.type.includes('double')) {
                  optionLabel = `Call Dbl KO ${optIndex + 1}`;
            } else {
                  optionLabel = `Call KO ${optIndex + 1}`;
                }
              } else { // Put options
                if (option.type.includes('reverse')) {
                  optionLabel = `Put Rev KO ${optIndex + 1}`;
                } else if (option.type.includes('double')) {
                  optionLabel = `Put Dbl KO ${optIndex + 1}`;
                } else {
                  optionLabel = `Put KO ${optIndex + 1}`;
                }
              }
            } else if (option.type.includes('knockin')) {
              // Knockin options
              if (option.type.includes('call')) {
                if (option.type.includes('reverse')) {
                  optionLabel = `Call Rev KI ${optIndex + 1}`;
                } else if (option.type.includes('double')) {
                  optionLabel = `Call Dbl KI ${optIndex + 1}`;
                } else {
                  optionLabel = `Call KI ${optIndex + 1}`;
                }
              } else { // Put options
                if (option.type.includes('reverse')) {
                  optionLabel = `Put Rev KI ${optIndex + 1}`;
                } else if (option.type.includes('double')) {
                  optionLabel = `Put Dbl KI ${optIndex + 1}`;
                } else {
                  optionLabel = `Put KI ${optIndex + 1}`;
                }
              }
            } else if (option.type.includes('one-touch')) {
              optionLabel = `One Touch ${optIndex + 1}`;
            } else if (option.type.includes('no-touch')) {
              optionLabel = `No Touch ${optIndex + 1}`;
            } else if (option.type.includes('double-touch')) {
              optionLabel = `Double Touch ${optIndex + 1}`;
            } else if (option.type.includes('double-no-touch')) {
              optionLabel = `Double No Touch ${optIndex + 1}`;
            } else if (option.type.includes('range-binary')) {
              optionLabel = `Range Binary ${optIndex + 1}`;
            } else if (option.type.includes('outside-binary')) {
              optionLabel = `Outside Binary ${optIndex + 1}`;
            }
            
        // Calculate option price differently based on type
        let price;
        
        // Vérifier si cette option a été knocked out dans un mois précédent
        const optionId = `${option.type}-${optIndex}`;
        const isKnockedOut = option.type.includes('knockout') && barrierCrossings[optionId] && barrierCrossings[optionId][i];
        
        // Check if we should use custom prices first
        const optionKey = `${option.type}-${optIndex}`;
        if (useCustomOptionPrices && customOptionPrices[monthKey]?.[optionKey] !== undefined) {
          // Use custom price if available
          price = customOptionPrices[monthKey][optionKey];
        } else {
          // Calculate price normally
          
          // Pour les options knocked out, nous calculons toujours le prix même si l'option est knocked out
          // Le prix représente la valeur théorique de l'option, indépendamment de son état knocked out
          if (option.type === 'forward') {
            // For forwards, the value is simply the difference between forward rate and strike
            price = presentValueForwardPayoff(forward, strike, r, t);
          } else if (option.type === 'call' || option.type === 'put') {
            // TPP: IV from surface by strike & DTE; else implied or option vol
            const tppIv = useTickerPeekPro && tppSurfacePoints.length > 0
              ? interpolateTppIV(strike, dte, option.type.includes('put') ? 'put' : 'call')
              : null;
            const iv = getImpliedVolatility(monthKey, optionKey);
            const effectiveSigma = (tppIv != null ? tppIv : (useImpliedVol && iv !== undefined && iv !== null ? iv / 100 : option.volatility / 100));
          // For standard options, use appropriate pricing model
          // Use forward price as underlying for commodities (Black-76 model)
          const underlyingPrice = forward; // Use forward price for commodity options
          if (optionPricingModel === 'monte-carlo') {
            // Use Monte Carlo for vanilla options with cost of carry
            const b = strategyBuilderAnnualPercentToDecimal(params.interestRate);
            price = calculateVanillaOptionMonteCarlo(
              option.type,
              underlyingPrice,
              strike,
              r,
              b,
              t,
              effectiveSigma,
              1000 // Number of simulations for vanilla options
            );
          } else {
            price = calculateBlack76Price(
              option.type,
              underlyingPrice,
              strike,
              r,
              0,
              t,
              effectiveSigma
            );
          }
        } else if (option.type.includes('knockout') || option.type.includes('knockin')) {
          // For barrier options, use Monte Carlo paths or closed-form solutions based on flag
          const barrier = option.barrierType === 'percent' ? 
            params.spotPrice * (option.barrier / 100) : 
            option.barrier;
            
          const secondBarrier = option.type.includes('double') ? 
            (option.barrierType === 'percent' ? 
              params.spotPrice * (option.secondBarrier / 100) : 
              option.secondBarrier) : 
            undefined;
            
          // Use implied volatility if available; TPP surface by strike & DTE when enabled
          const optionKey = `${option.type}-${optIndex}`;
          const tppIvBarrier = useTickerPeekPro && tppSurfacePoints.length > 0
            ? interpolateTppIV(strike, dte, option.type.includes('put') ? 'put' : 'call')
            : null;
          const effectiveSigma = (tppIvBarrier != null ? tppIvBarrier : (useImpliedVol && impliedVolatilities[monthKey] ? (getImpliedVolatility(monthKey, optionKey) || option.volatility) / 100 : option.volatility / 100));
            
          // Use closed-form solution if enabled (for both simple and double barrier options)
          // ✅ CORRECTION : Utiliser le forward price (comme pour les options vanilles) au lieu du spot
          if (barrierPricingModel === 'closed-form') {
            // ✅ Utiliser le forward price (S) comme dans Strategy Builder pour les options vanilles
            price = calculateBarrierOptionClosedForm(
              option.type,
              forward, // ✅ Forward price (comme Strategy Builder - Black-76 model for commodities)
              strike,
              r,
              t,
              effectiveSigma,
              barrier,
              secondBarrier
            );
          } else {
            const numSteps = maturityIndex;
            const localPaths = generateBarrierMonteCarloPathsForPricing({
              initialPrice: forward,
              domesticRateDecimal: params.domesticRate / 100,
              foreignRateDecimal: params.foreignRate / 100,
              sigma: effectiveSigma,
              timeToMaturity: t,
              numSteps,
              numSimulations: 300,
            });
          price = calculatePricesFromPaths(
                option.type,
                forward,
                    strike,
              r,
              numSteps,
              localPaths,
            barrier,
            secondBarrier
          );
          }
        } else if (
          option.type.includes('one-touch') ||
          option.type.includes('double-touch') ||
          option.type.includes('no-touch') ||
          option.type.includes('double-no-touch') ||
          option.type.includes('range-binary') ||
          option.type.includes('outside-binary')
        ) {
          // Calculer la barrière principale
          const barrier = option.barrierType === 'percent'
            ? params.spotPrice * (option.barrier / 100)
            : option.barrier;
          // Calculer la seconde barrière si besoin
          const secondBarrier = option.type.includes('double')
            ? (option.barrierType === 'percent'
                ? params.spotPrice * (option.secondBarrier / 100)
                : option.secondBarrier)
            : undefined;
          // Calculer le prix digital
          const underlyingResult = calculateUnderlyingPrice(
            params.spotPrice,
            r,
            params.foreignRate/100,
            t
          );
          price = calculateDigitalOptionPrice(
            option.type,
            underlyingResult.price,
            strike,
            r,
            t,
            option.volatility / 100,
            barrier,
            secondBarrier,
            10000, // nombre de simulations
            option.rebate ?? 1
          );
        }
        } // Fermer le bloc else
            
        return {
          type: option.type,
          price: roundOptionPrice(price),
              quantity: option.quantity/100,
              strike: strike,
              label: optionLabel,
              dynamicStrikeInfo: option.dynamicStrike ? option.dynamicStrikeInfo : undefined
            };
        });

      // Add swap and forward prices
      const allOptionPrices = [
        ...optionPrices,
        ...swaps.map((swap, swapIndex) => ({
          type: 'swap',
          price: swap.strike, // Afficher le strike (prix fixe saisi) au lieu du swapPrice calculé
          quantity: swap.quantity/100,
          strike: swap.strike,
          label: `Swap Price ${swapIndex + 1}`
        })),
        ...forwards.map((forwardItem, forwardIndex) => {
          const forwardValue = presentValueForwardPayoff(forward, forwardItem.strike, r, t);
          return {
            type: 'forward',
            price: forwardValue,
            quantity: forwardItem.quantity/100,
            strike: forwardItem.strike,
            label: `Forward ${forwardIndex + 1}`
          };
        })
      ];

        // Calculate strategy price
      const strategyPrice = validateDataForReduce(allOptionPrices).reduce((total, opt) => 
            total + (opt.price * opt.quantity), 0);

        // Calculate payoff using real price
      const totalPayoff = validateDataForReduce(allOptionPrices).reduce((sum, opt, idx) => {
          let payoff = 0;
          
        // Pour les options de la stratégie originale, utiliser l'index original
        // pour retrouver correctement l'état knock-out/knock-in
        const originalIndex = options.findIndex((original, i) => {
          const originalStrike = original.strikeType === 'percent' ? 
            params.spotPrice * (original.strike/100) : original.strike;
          return original.type === opt.type && Math.abs(originalStrike - opt.strike) < 0.001;
        });
        
        const optionId = `${opt.type}-${originalIndex}`;
        
        // Vérifier si l'option est knocked out (pour toutes les options à barrière)
        const isKnockedOut = opt.type.includes('knockout') && barrierCrossings[optionId] && barrierCrossings[optionId][i];
        // Vérifier si l'option est knocked in (pour toutes les options à barrière knock-in)
        const isKnockedIn = opt.type.includes('knockin') && barrierActivations[optionId] && barrierActivations[optionId][i];
        
        if (isKnockedOut) {
          payoff = 0;
        } else if (opt.type.includes('knockin')) {
          const isCall = opt.type.includes('call');
          const basePayoff = isCall
            ? Math.max(0, realPrice - opt.strike)
            : Math.max(0, opt.strike - realPrice);
          payoff = isKnockedIn ? basePayoff : 0;
        } else if (opt.type.includes('knockout') || opt.type.includes('knockin')) {
          const option = strategy.find(s => s.type === opt.type);
          if (!option) return sum;

          const barrier = option.barrierType === 'percent'
            ? params.spotPrice * (option.barrier / 100)
            : option.barrier;
          const secondBarrier = option.type.includes('double')
            ? (option.barrierType === 'percent'
                ? params.spotPrice * (option.secondBarrier / 100)
                : option.secondBarrier)
            : undefined;

          let barrierHit = false;
          if (opt.type.includes('reverse')) {
            barrierHit = opt.type.includes('put')
              ? realPrice >= barrier
              : realPrice <= barrier;
          } else if (opt.type.includes('double')) {
            const { lower: lo, upper: up } = orderedDoubleBarrierLevels(barrier, secondBarrier ?? barrier);
            barrierHit = realPrice >= up || realPrice <= lo;
          } else {
            barrierHit = opt.type.includes('put')
              ? realPrice <= barrier
              : realPrice >= barrier;
          }

          const isCall = opt.type.includes('call');
          const basePayoff = isCall
            ? Math.max(0, realPrice - opt.strike)
            : Math.max(0, opt.strike - realPrice);

          if (opt.type.includes('knockout')) {
            payoff = barrierHit ? 0 : basePayoff;
            }
          } else if (opt.type === 'call') {
          payoff = Math.max(0, realPrice - opt.strike);
          } else if (opt.type === 'put') {
          payoff = Math.max(0, opt.strike - realPrice);
          } else if (opt.type === 'swap') {
          payoff = forward - realPrice;
          } else if (
            opt.type.includes('one-touch') ||
            opt.type.includes('double-touch') ||
            opt.type.includes('no-touch') ||
            opt.type.includes('double-no-touch') ||
            opt.type.includes('range-binary') ||
            opt.type.includes('outside-binary')
          ) {
            const option = strategy.find(s => s.type === opt.type);
            if (!option) return sum;
            const barrier = option.barrierType === 'percent'
              ? params.spotPrice * (option.barrier / 100) : option.barrier;
            const secondBarrier = option.type.includes('double')
              ? (option.barrierType === 'percent'
                  ? params.spotPrice * (option.secondBarrier / 100) : option.secondBarrier)
              : undefined;
            const rebate = option.rebate ?? 1;
            let conditionAtteinte = false;
            if (opt.type.includes('one-touch')) conditionAtteinte = realPrice >= barrier;
            else if (opt.type.includes('no-touch')) conditionAtteinte = realPrice < barrier;
            else if (opt.type.includes('double-touch') || opt.type.includes('double-no-touch') ||
                     opt.type.includes('range-binary') || opt.type.includes('outside-binary')) {
              const { lower: lo, upper: up } = orderedDoubleBarrierLevels(barrier, secondBarrier ?? barrier);
              if (opt.type.includes('double-touch')) conditionAtteinte = realPrice >= up || realPrice <= lo;
              else if (opt.type.includes('double-no-touch')) conditionAtteinte = realPrice < up && realPrice > lo;
              else if (opt.type.includes('range-binary')) conditionAtteinte = realPrice <= up && realPrice >= lo;
              else if (opt.type.includes('outside-binary')) conditionAtteinte = realPrice > up || realPrice < lo;
            }
            payoff = conditionAtteinte ? ((rebate / 100) * monthlyVolume) : 0;
          }
          
            return sum + (payoff * opt.quantity);
        }, 0);

      // Calculer le pourcentage total de swaps dans la stratégie
        const totalSwapPercentage = validateDataForReduce(swaps).reduce((sum, swap) => sum + swap.quantity, 0) / 100;
      
      // Calculer le prix couvert (hedged price) en tenant compte des swaps et du prix réel avec PDD
      // Pour les swaps, utiliser le strike réel (prix fixe saisi) au lieu du swapPrice calculé
      // Le PDD s'applique aux coûts : pour les swaps, on applique le PDD au strike du swap
      const swapStrikeAverage = swaps.length > 0 
        ? validateDataForReduce(swaps).reduce((sum, swap) => sum + (swap.strike * swap.quantity), 0) / 
          validateDataForReduce(swaps).reduce((sum, swap) => sum + swap.quantity, 0)
        : 0;
      const swapStrikeWithPDD = swapStrikeAverage + (params.priceDifferential || 0);
      const hedgedPrice = totalSwapPercentage * swapStrikeWithPDD + (1 - totalSwapPercentage) * realPriceWithPDD;

      // Vérifier si la stratégie contient des options digitales
      const hasDigitalOptions = strategy.some(opt => 
        ['one-touch', 'no-touch', 'double-touch', 'double-no-touch', 'range-binary', 'outside-binary'].includes(opt.type)
      );

      // Calculer le coût hedgé selon la formule d'origine
      // Pour les options digitales, totalPayoff est déjà multiplié par le volume
        const hedgedCost = -(monthlyVolume * hedgedPrice) - 
            (monthlyVolume * (1 - totalSwapPercentage) * strategyPrice) + 
          (hasDigitalOptions ? 
            ((1 - totalSwapPercentage) * totalPayoff) : 
            (monthlyVolume * (1 - totalSwapPercentage) * totalPayoff)
          );
      
      // Calculer le coût non hedgé selon la formule d'origine (avec PDD appliqué)
      const unhedgedCost = -(monthlyVolume * realPriceWithPDD);
      
      // Calculer le Delta P&L selon la formule d'origine
      const deltaPnL = hedgedCost - unhedgedCost;

        return {
        date: formatDateLocal(date),
        timeToMaturity: t,
        forward: forward,
        realPrice: realPrice,
        interestRate: r * 100, // Rate used for this maturity (%): interpolated if "Use real interest rate", else params
        optionPrices: allOptionPrices,
        strategyPrice: strategyPrice,
        totalPayoff: totalPayoff,
        monthlyVolume: monthlyVolume,
        hedgedCost: hedgedCost,
        unhedgedCost: unhedgedCost,
        deltaPnL: deltaPnL
        };
    });

    // Store complete results for calculations (includes periods before user's start date)
    setResults(detailedResults);

    // Ticker Peek Pro: fill Detailed Results table (forward & IV) from TPP data
    if (useTickerPeekPro && (curvePoints.length >= 2 || tppSurfacePoints.length > 0)) {
      const tppForwards: Record<string, number> = {};
      if (curvePoints.length >= 2) {
        months.forEach((date, idx) => {
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          const dteFwd = daysToMaturityFromYearsAct36525(timeToMaturities[idx]);
          const fwd = interpolateFuturesPrice(curvePoints, dteFwd);
          if (fwd != null) tppForwards[monthKey] = fwd;
        });
        if (Object.keys(tppForwards).length > 0) setManualForwards(prev => ({ ...prev, ...tppForwards }));
      }
      if (tppSurfacePoints.length > 0) {
        const optionsList = strategy.filter(s => s.type !== 'swap' && s.type !== 'forward');
        const tppIvs: Record<string, Record<string, number>> = {};
        months.forEach((date, i) => {
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          const t = timeToMaturities[i];
          const dte = daysToMaturityFromYearsAct36525(t);
          optionsList.forEach((option, optIndex) => {
            const strike = option.strikeType === 'percent' ? params.spotPrice * (option.strike / 100) : option.strike;
            const optionKey = `${option.type}-${optIndex}`;
            const type = option.type.includes('put') ? 'put' : 'call';
            const iv = interpolateTppIV(strike, dte, type);
            if (iv != null) {
              if (!tppIvs[monthKey]) tppIvs[monthKey] = {};
              // interpolateTppIV returns decimal (0.25); store as percentage (25) for display
              tppIvs[monthKey][optionKey] = iv * 100;
            }
          });
        });
        if (Object.keys(tppIvs).length > 0) setImpliedVolatilities(prev => ({ ...prev, ...tppIvs }));
      }
    }
    
    // Update swap prices automatically when results are calculated
    const hasSwaps = strategy.some(component => component.type === 'swap');
    if (hasSwaps && detailedResults.length > 0) {
      const forwards = detailedResults.map(r => r.forward);
      const times = detailedResults.map(r => r.timeToMaturity);
      const swapPrice = calculateSwapPrice(forwards, times, params.domesticRate / 100);
      
      // Update all swaps in the strategy with the new calculated price
      setStrategy(prevStrategy => prevStrategy.map(component => 
        component.type === 'swap' 
          ? { ...component, strike: swapPrice }
          : component
      ));
    }
    
    // Show all calculated results (all months to hedge from hedging start date)
    const displayResults = filterResultsForDisplay(detailedResults, params.startDate);
    setDisplayResults(displayResults);
    
    // Après avoir mis à jour toutes les données de résultats, recalculez les simulations Monte Carlo
    // Cette ligne devrait être placée juste avant la fin de la fonction calculateResults
    if (realPriceParams.useSimulation) {
      recalculateMonteCarloSimulations();
    }
  };

  // Initialize display results from saved state if needed
  useEffect(() => {
    if (results && !displayResults) {
      const filteredResults = filterResultsForDisplay(results, params.startDate);
      setDisplayResults(filteredResults);
    }
  }, [results, displayResults, params.startDate]);

  useEffect(() => {
    if (strategy.length > 0) {
      calculatePayoff();
    }
  }, [strategy]);

  // Apply stress test scenario
  const applyStressTest = (key) => {
    setActiveStressTest(key);
    const scenario = stressTestScenarios[key];
    
    // Appliquer le choc de prix au prix spot
    const adjustedPrice = params.spotPrice * (1 + scenario.priceShock);
    
    // Mettre à jour les paramètres de prix réels
    setRealPriceParams(prev => ({
      ...prev,
      useSimulation: !scenario.realBasis, // Désactiver la simulation si on utilise realBasis
      volatility: scenario.volatility,
      drift: scenario.drift
    }));
    
    // Calculer les forward prices et real prices selon le type de scénario
      const newForwards = {};
    const newRealPrices = {};
      
    const months = [];
    const strategyStartDate = new Date(params.strategyStartDate);
      
      for (let i = 0; i < params.monthsToHedge; i++) {
      const date = new Date(strategyStartDate);
      date.setMonth(date.getMonth() + i); // ✅ CORRECTION : Modifier la date pour chaque mois
      
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        const timeInYears = i / 12;
        
        // Ajouter le mois au tableau pour utilisation ultérieure
        months.push(new Date(date));
      
      // Calcul du forward price standard basé sur le taux d'intérêt
      const baseForward = calculateCommodityForwardPrice(params.spotPrice, strategyBuilderAnnualPercentToDecimal(params.interestRate), 0, 0, timeInYears);
      
      // ✅ LOGIQUE CORRIGÉE : Distinguer les scénarios "Real Prices" des autres
    if (scenario.realBasis !== undefined) {
        // Pour Contango (Real Prices) et Backwardation (Real Prices)
        // NE PAS toucher aux forwards - garder les forwards calculés normalement
        // Seulement modifier les real prices
        newRealPrices[monthKey] = adjustedPrice * Math.pow(1 + scenario.realBasis, i);
      } else if (scenario.forwardBasis !== undefined) {
        // Pour Contango et Backwardation standard (sans "Real Prices")
        // Modifier les forwards ET les real prices
        newForwards[monthKey] = baseForward * Math.pow(1 + scenario.forwardBasis, i);
        newRealPrices[monthKey] = adjustedPrice;
      } else {
        // Pour les autres scénarios (Base Case, High Vol, Crash, Bull, Custom)
        // Appliquer uniquement le choc de prix aux real prices
        newRealPrices[monthKey] = adjustedPrice;
      }
    }
    
    // ✅ DEBUG : Vérifier que les scénarios s'appliquent à toutes les maturités
    console.log(`[STRESS TEST] Applying scenario: ${scenario.name}`);
    console.log(`[STRESS TEST] Scenario type: ${scenario.realBasis !== undefined ? 'Real Prices' : scenario.forwardBasis !== undefined ? 'Forward Basis' : 'Standard'}`);
    console.log(`[STRESS TEST] Generated forwards for ${Object.keys(newForwards).length} maturities:`, newForwards);
    console.log(`[STRESS TEST] Generated real prices for ${Object.keys(newRealPrices).length} maturities:`, newRealPrices);
    
    if (Object.keys(newForwards).length > 0) {
      setManualForwards(newForwards);
    }
    
    if (Object.keys(newRealPrices).length > 0) {
      setRealPrices(newRealPrices);
    }
    
      calculateResults();
  };

  // Update stress test scenario
  const updateScenario = (key: string, field: keyof StressTestScenario, value: number) => {
    setStressTestScenarios(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Reset stress test to base case
  const resetStressTest = () => {
    setActiveStressTest('base');
    
    // Réinitialiser les forwards et real prices
    setManualForwards({});
    setRealPrices({});
    
    // Réinitialiser les paramètres de prix réels
    setRealPriceParams(prev => ({
      ...prev,
      useSimulation: true,
      volatility: 0.20,
      drift: 0.01
    }));
    
    // Recalculer avec les paramètres de base
    calculateResults();
    
    console.log('[STRESS TEST] Reset to base case - all maturities cleared');
  };

  // Type guard for results
  const isValidResult = (result: any): result is Result => {
    return result && 
      typeof result.hedgedCost === 'number' &&
      typeof result.unhedgedCost === 'number' &&
      typeof result.deltaPnL === 'number' &&
      typeof result.strategyPrice === 'number' &&
      typeof result.monthlyVolume === 'number';
  };

  // Update the yearlyResults calculation with type checking
  const calculateYearlyResults = (results: Result[]) => {
    return validateDataForReduce(results).reduce((acc: Record<string, { 
      hedgedCost: number; 
      unhedgedCost: number; 
      deltaPnL: number;
      strategyPremium: number; // Added this property
    }>, row) => {
      // Corriger l'extraction de l'année - les dates sont maintenant au format ISO (YYYY-MM-DD)
      const year = row.date.split('-')[0];
      if (!acc[year]) {
        acc[year] = {
          hedgedCost: 0,
          unhedgedCost: 0,
          deltaPnL: 0,
          strategyPremium: 0 // Initialize the new property
        };
      }
      if (isValidResult(row)) {
        acc[year].hedgedCost += row.hedgedCost;
        acc[year].unhedgedCost += row.unhedgedCost;
        acc[year].deltaPnL += row.deltaPnL;
        acc[year].strategyPremium += (row.strategyPrice * row.monthlyVolume); // Calculate and add the strategy premium
      }
      return acc;
    }, {});
  };

  // Modifier le gestionnaire de changement du prix spot
  const handleSpotPriceChange = (newPrice: number) => {
    setParams(prev => ({
      ...prev,
      spotPrice: newPrice,
      // Volume remains the same when spot price changes
    }));
    setInitialSpotPrice(newPrice); // Mettre à jour le prix spot initial uniquement lors des modifications manuelles
  };

  // Handle volume change - simplified to use only totalVolume
  const handleVolumeChange = (newVolume: number) => {
    setParams(prev => ({
      ...prev,
      totalVolume: newVolume
    }));
  };

  // Function to update price ranges when currency pair or spot price changes
  const updatePriceRangesForFX = () => {
    const newRanges = generateFXPriceRanges(params.currencyPair, params.spotPrice);
    setPriceRanges(newRanges);
  };

  // Add this useEffect near your other useEffect hooks
  useEffect(() => {
    if (!realPriceParams.useSimulation) {
      // When switching to manual mode, initialize real prices with forward prices
      const initialRealPrices = {};
      results?.forEach(row => {
        const date = new Date(row.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        initialRealPrices[monthKey] = row.forward;
      });
      setRealPrices(initialRealPrices);
    }
  }, [realPriceParams.useSimulation]);

  // Auto-update price ranges when currency pair or spot price changes
  useEffect(() => {
    const newRanges = generateFXPriceRanges(params.currencyPair.symbol, params.spotPrice);
    setPriceRanges(newRanges);
  }, [params.currencyPair.symbol, params.spotPrice]);

  const saveScenario = () => {
    // Vérifier qu'il y a au moins une stratégie ou des paramètres à sauvegarder
    if (!strategy || strategy.length === 0) {
      toast({
        title: "Warning",
        description: "No strategy components to save. Please add at least one component first.",
        variant: "destructive",
      });
      return;
    }

    // Générer un nom par défaut basé sur le contexte
    let defaultName = `Strategy - ${params.currencyPair?.symbol || 'Unknown'} - ${new Date().toLocaleDateString()}`;
    if (activeStressTest && stressTestScenarios[activeStressTest]) {
      defaultName = `Strategy - ${stressTestScenarios[activeStressTest].name} - ${new Date().toLocaleDateString()}`;
    } else if (results && payoffData) {
      defaultName = `Strategy - Calculated - ${new Date().toLocaleDateString()}`;
    }

    // Ask user for scenario name
    const scenarioName = prompt("Enter strategy name:", defaultName);
    if (!scenarioName) return;

    const scenario: SavedScenario = {
      id: uuidv4(),
      name: scenarioName,
      timestamp: Date.now(),
      params,
      strategy,
      results: results || null, // Permettre null si pas encore calculé
      payoffData: payoffData || [], // Permettre tableau vide si pas encore calculé
      stressTest: activeStressTest ? stressTestScenarios[activeStressTest] : null,
      useImpliedVol,
      impliedVolatilities,
      manualForwards,
      realPrices,
      useCustomOptionPrices,
      customOptionPrices
    };

    const savedScenarios = JSON.parse(localStorage.getItem('optionScenarios') || '[]');
    savedScenarios.push(scenario);
    localStorage.setItem('optionScenarios', JSON.stringify(savedScenarios));

    const hasResults = results && payoffData;
    toast({
      title: "Success",
      description: `Strategy "${scenarioName}" saved successfully!${hasResults ? '' : ' (Strategy saved without calculations. Run calculations to add results.)'}`,
    });
  };

  const viewSavedScenarios = () => {
    // Navigate to the Reports page where PDFs are generated
    window.location.href = '/reports';
  };

  const importToHedgingInstruments = () => {
    if (!strategy || strategy.length === 0) {
      alert('Veuillez d\'abord ajouter au moins un composant de stratégie');
      return;
    }

    if (!params.currencyPair) {
      alert('Veuillez d\'abord sélectionner une paire de devises');
      return;
    }

    if (!results || results.length === 0) {
      alert('Aucun résultat détaillé disponible. Veuillez d\'abord exécuter le calcul.');
      return;
    }

    const strategyName = prompt('Entrez un nom pour cette stratégie:');
    if (!strategyName) return;

    try {
      const importService = StrategyImportService.getInstance();
      
      // ✅ Utiliser tous les résultats calculés (tous les mois à hedger)
      // Les périodes sont maintenant générées directement à partir de la Hedging Start Date
      const filteredResults = filterResultsForDisplay(results, params.startDate);
      
      if (!filteredResults || filteredResults.length === 0) {
        alert('Aucune période à exporter. Vérifiez que la Hedging Start Date est correcte.');
        return;
      }
      
      console.log(`[EXPORT] Hedging Start Date: ${params.startDate}`);
      console.log(`[EXPORT] Total calculated periods: ${results.length}, Exported periods: ${filteredResults.length}`);
      console.log(`[EXPORT] First exported period: ${filteredResults[0].date}`);
      console.log(`[EXPORT] Last exported period: ${filteredResults[filteredResults.length - 1].date}`);
      
      // Préparer les données de résultats détaillés FILTRÉES pour l'import
      // avec informations enrichies pour le re-pricing
      const enrichedDetailedResults = filteredResults.map((result, periodIndex) => {
        const monthKey = `${new Date(result.date).getFullYear()}-${new Date(result.date).getMonth() + 1}`;
        
        // Enrichir chaque résultat avec des informations supplémentaires
        const enrichedResult = {
          ...result,
          // Informations de marché du moment (domesticRate = taux utilisé pour cette maturité si "Use real interest rate")
          marketData: {
            spotPrice: params.spotPrice,
            domesticRate: (result as { interestRate?: number }).interestRate ?? params.interestRate,
            foreignRate: params.foreignRate,
            monthKey: monthKey,
            periodIndex: periodIndex
          },
          // ✅ CORRECTION : Volatilités implicites spécifiques du tableau detailed results
          impliedVolatilities: impliedVolatilities[monthKey] || {},
          // Prix personnalisés si utilisés
          customPrices: useCustomOptionPrices ? (customOptionPrices[monthKey] || {}) : {},
          // Forwards manuels si utilisés
          manualForward: manualForwards[monthKey],
          // Prix réels si utilisés
          realPrice: realPrices[monthKey],
          // Informations détaillées sur chaque composant de stratégie
          strategyDetails: strategy.map((component, componentIndex) => {
            // Calculer le strike en valeur absolue
            const absoluteStrike = component.strikeType === 'percent' 
              ? params.spotPrice * (component.strike / 100)
              : component.strike;
            
            // Calculer les barrières en valeur absolue SEULEMENT pour les options barrières
            let absoluteBarrier = undefined;
            let absoluteSecondBarrier = undefined;
            
            if (component.type.includes('knockout') || component.type.includes('knockin') || 
                component.type.includes('touch') || component.type.includes('binary')) {
              absoluteBarrier = component.barrier 
                ? (component.barrierType === 'percent' 
                    ? params.spotPrice * (component.barrier / 100)
                    : component.barrier)
                : undefined;
              
              absoluteSecondBarrier = component.secondBarrier 
                ? (component.barrierType === 'percent' 
                    ? params.spotPrice * (component.secondBarrier / 100)
                    : component.secondBarrier)
                : undefined;
            }

            // ✅ CORRECTION : Obtenir la volatilité effective du tableau Detailed Results
            const optionKey = `${component.type}-${componentIndex}`;
            let effectiveVolatility = component.volatility; // Fallback par défaut
            
            if (useImpliedVol && impliedVolatilities[monthKey]) {
              // Utiliser la volatilité implicite spécifique à l'option si disponible
              const impliedVol = getImpliedVolatility(monthKey, optionKey);
              if (impliedVol !== undefined && impliedVol !== null && impliedVol > 0) {
                effectiveVolatility = impliedVol;
              }
            }

            // Obtenir le prix d'option correspondant depuis les résultats
            const optionPriceData = result.optionPrices[componentIndex];
            
            return {
              componentIndex: componentIndex,
              type: component.type,
              originalStrike: component.strike,
              strikeType: component.strikeType,
              absoluteStrike: absoluteStrike,
              originalVolatility: component.volatility,
              effectiveVolatility: effectiveVolatility,
              quantity: component.quantity,
              // Barrières en valeur absolue (seulement pour les options barrières)
              originalBarrier: (component.type.includes('knockout') || component.type.includes('knockin') || 
                               component.type.includes('touch') || component.type.includes('binary')) 
                               ? component.barrier : undefined,
              absoluteBarrier: absoluteBarrier,
              originalSecondBarrier: (component.type.includes('knockout') || component.type.includes('knockin') || 
                                     component.type.includes('touch') || component.type.includes('binary')) 
                                     ? component.secondBarrier : undefined,
              absoluteSecondBarrier: absoluteSecondBarrier,
              barrierType: (component.type.includes('knockout') || component.type.includes('knockin') || 
                           component.type.includes('touch') || component.type.includes('binary')) 
                           ? component.barrierType : undefined,
              // Rebate pour les options digitales
              rebate: component.rebate,
              // Time to payoff pour les one-touch
              timeToPayoff: component.timeToPayoff,
              // Informations sur le strike dynamique si applicable
              dynamicStrike: component.dynamicStrike,
              dynamicStrikeInfo: optionPriceData?.dynamicStrikeInfo,
              // Prix et données calculées
              calculatedPrice: optionPriceData?.price,
              label: optionPriceData?.label,
              // Prix personnalisé si utilisé
              customPrice: useCustomOptionPrices ? customOptionPrices[monthKey]?.[optionKey] : undefined,
              // Données de re-pricing essentielles
              repricingData: {
                underlyingPrice: result.forward,
                timeToMaturity: result.timeToMaturity,
                domesticRate: params.domesticRate / 100,
                foreignRate: params.foreignRate / 100,
                volatility: effectiveVolatility / 100,
                dividendYield: 0, // Pas applicable pour FX
                // Modèle de pricing utilisé
                pricingModel: 'garman-kohlhagen' // ou le modèle utilisé
              }
            };
          })
        };
        
        return enrichedResult;
      });
      
      const strategyId = importService.importStrategy(strategyName, strategy, {
        currencyPair: params.currencyPair,
        spotPrice: params.spotPrice,
        startDate: params.startDate,           // Hedging Start Date
        strategyStartDate: params.strategyStartDate,   // Strategy Start Date
        monthsToHedge: params.monthsToHedge,
        baseVolume: params.totalVolume, // Backward compatibility
        quoteVolume: params.totalVolume * params.spotPrice, // Backward compatibility
        domesticRate: params.interestRate, // ✅ CORRECTION : Utiliser interestRate comme Risk-Free Rate pour les commodités
        foreignRate: params.foreignRate,
        volumeType: params.volumeType,
        useCustomPeriods: params.useCustomPeriods,
        customPeriods: params.customPeriods,
      }, enrichedDetailedResults); // Passer TOUS les résultats enrichis

      // Dispatch custom event to notify HedgingInstruments page
      window.dispatchEvent(new CustomEvent('hedgingInstrumentsUpdated'));

      // Message d'alerte amélioré avec plus d'informations
      const totalPeriods = enrichedDetailedResults.length;
      const totalComponents = strategy.length;
      alert(`Stratégie "${strategyName}" exportée avec succès vers Instruments de Couverture!\n` +
            `ID de la stratégie: ${strategyId}\n` +
            `Hedging Start Date: ${params.startDate}\n` +
            `Périodes exportées: ${totalPeriods} (filtrées à partir de ${params.startDate})\n` +
            `Composants par période: ${totalComponents}\n` +
            `Total d'instruments créés: ${totalPeriods * totalComponents}`);
    } catch (error) {
      console.error('Erreur lors de l\'export de la stratégie:', error);
      alert('Erreur lors de l\'export de la stratégie. Veuillez réessayer.');
    }
  };

  // Save state when important values change
  useEffect(() => {
    const state: CalculatorState = {
      params,
      strategy,
      results,
      payoffData,
      manualForwards,
      realPrices,
      realPriceParams,
      barrierOptionSimulations,
      barrierPricingModel,
      activeTab,
      customScenario,
      stressTestScenarios,
      useImpliedVol,
      impliedVolatilities,
      useRealInterestRate
    };
    localStorage.setItem('calculatorState', JSON.stringify(state));
  }, [
    params,
    strategy,
    results,
    payoffData,
    manualForwards,
    realPrices,
    realPriceParams,
    barrierOptionSimulations,
    barrierPricingModel,
    activeTab,
    customScenario,
    stressTestScenarios,
    useImpliedVol,
    impliedVolatilities,
    useRealInterestRate
  ]);

  const resetScenario = (key: string) => {
    if (DEFAULT_SCENARIOS[key]) {
      setStressTestScenarios(prev => ({
        ...prev,
        [key]: { ...DEFAULT_SCENARIOS[key] }
      }));
    }
  };

  // Fonction pour nettoyer les barrières incorrectes des stratégies existantes
  const cleanStrategyBarriers = () => {
    const cleanedStrategy = strategy.map(component => {
      // Si ce n'est pas une option barrière, supprimer les barrières
      if (!component.type.includes('knockout') && !component.type.includes('knockin') && 
          !component.type.includes('touch') && !component.type.includes('binary')) {
        const { barrier, secondBarrier, barrierType, ...cleanComponent } = component;
        return cleanComponent;
      }
      return component;
    });
    
    setStrategy(cleanedStrategy);
    console.log('Barrières nettoyées pour les options non-barrières');
  };

  // Fonction pour nettoyer le localStorage
  const clearLocalStorage = () => {
    if (confirm('Êtes-vous sûr de vouloir effacer toutes les données sauvegardées ?')) {
      localStorage.removeItem('calculatorState');
      localStorage.removeItem('importedStrategies');
      localStorage.removeItem('hedgingInstruments');
      window.location.reload();
    }
  };

  // Add function to validate data before using reduce operations
  const validateDataForReduce = (data: any, operation: string = 'reduce') => {
    if (!data || !Array.isArray(data)) {
      console.warn(`⚠️ Invalid data for ${operation}:`, data);
      return [];
    }
    return data;
  };

  // Add function to clear loaded scenario
  const clearLoadedScenario = () => {
    try {
      console.log('🧹 Clearing loaded scenario...');
    setParams({
      startDate: new Date().toISOString().split('T')[0],           // Hedging Start Date
      strategyStartDate: new Date().toISOString().split('T')[0],   // Strategy Start Date
      monthsToHedge: 12,
      interestRate: 2.0,
      domesticRate: 1.0,
      foreignRate: 0.5,
      totalVolume: 1000000,
      spotPrice: CURRENCY_PAIRS[0].defaultSpotRate,
      currencyPair: CURRENCY_PAIRS[0],
      useCustomPeriods: false,
      customPeriods: [],
      volumeType: 'receivable'
    });
    setStrategy([]);
    setResults(null);
    setDisplayResults(null); // Important: clear display results too
    setPayoffData([]);
    setManualForwards({});
    setRealPrices({});
    setRealPriceParams({
      useSimulation: false,
      volatility: 0.3,
      drift: 0,
      numSimulations: 1000
    });
    
    // Réinitialiser les données de volatilité implicite et prix personnalisés
    setUseImpliedVol(false);
    setImpliedVolatilities({});
    setUseCustomOptionPrices(false);
    setCustomOptionPrices({});
    
    // Réinitialiser l'onglet actif
    setActiveTab('parameters');
    
    // Réinitialiser les scénarios de stress test à leurs valeurs par défaut
    setStressTestScenarios({
      base: {
        name: "Base Case",
        description: "Normal market conditions",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true
      },
      highVol: {
        name: "High Volatility",
        description: "Double volatility scenario",
        volatility: 0.4,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isEditable: true
      },
      crash: {
        name: "Market Crash",
        description: "High volatility, negative drift, price shock",
        volatility: 0.5,
        drift: -0.03,
        priceShock: -0.2,
        forwardBasis: 0,
        isEditable: true
      },
      bull: {
        name: "Bull Market",
        description: "Low volatility, positive drift, upward shock",
        volatility: 0.15,
        drift: 0.02,
        priceShock: 0.1,
        forwardBasis: 0,
        isEditable: true
      },
      contango: {
        name: "Contango",
        description: "Forward prices higher than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0.01,
        isEditable: true
      },
      backwardation: {
        name: "Backwardation",
        description: "Forward prices lower than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: -0.01,
        isEditable: true
      },
      contangoReal: {
        name: "Contango (Real Prices)",
        description: "Real prices higher than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        realBasis: 0.01,
        isEditable: true
      },
      backwardationReal: {
        name: "Backwardation (Real Prices)",
        description: "Real prices lower than spot (monthly basis in %)",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        realBasis: -0.01,
        isEditable: true
      },
      custom: {
        name: "Custom Case",
        description: "User-defined scenario",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isCustom: true
      }
    });

    // Save the current state but with cleared scenario
    const state: CalculatorState = {
      params: {
        startDate: new Date().toISOString().split('T')[0],
        monthsToHedge: 12,
        interestRate: 5.0,
        totalVolume: 1000000,
        baseVolume: 1000000, // Backward compatibility
        quoteVolume: 1000000 * CURRENCY_PAIRS[0].defaultSpotRate, // Backward compatibility
        spotPrice: CURRENCY_PAIRS[0].defaultSpotRate,
        commodity: CURRENCY_PAIRS[0], // Will be replaced by actual commodity data
        useCustomPeriods: false,
        customPeriods: [],
        volumeType: 'long'
      },
      strategy: [],
      results: null,
      // displayResults removed - not part of CalculatorState interface
      payoffData: [],
      manualForwards: {},
      realPrices: {},
      realPriceParams: {
        useSimulation: false,
        volatility: 0.3,
        drift: 0,
        numSimulations: 1000
      },
      barrierOptionSimulations: 1000,
      barrierPricingModel: 'monte-carlo' as 'monte-carlo' | 'closed-form',
      activeTab: activeTab,
      customScenario: {
        name: "Custom Case",
        description: "User-defined scenario",
        volatility: 0.2,
        drift: 0.01,
        priceShock: 0,
        forwardBasis: 0,
        isCustom: true
      },
      stressTestScenarios: DEFAULT_SCENARIOS,
      useImpliedVol: false,
      impliedVolatilities: {},
      useRealInterestRate: false
    };
    localStorage.setItem('calculatorState', JSON.stringify(state));
    
    console.log('✅ Scenario cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing scenario:', error);
      // Fallback: just clear localStorage and reload
      localStorage.removeItem('calculatorState');
      window.location.reload();
    }
  };

  // Add function to prepare content for PDF export
  const prepareForPDF = () => {
    // Ensure tables don't break across pages
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      (table as HTMLElement).style.pageBreakInside = 'avoid';
      (table as HTMLElement).style.width = '100%';
    });

    // Add proper page breaks between sections
    const sections = document.querySelectorAll('.Card');
    sections.forEach(section => {
      (section as HTMLElement).style.pageBreakInside = 'avoid';
      (section as HTMLElement).style.marginBottom = '20px';
    });
  };

  // Modify the PDF export function
  const exportToPDF = async () => {
    prepareForPDF();

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      compress: true
    });

    // Define PDF options
    const options = {
      margin: [10, 10, 10, 10],
      autoPaging: 'text'as "text",
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false
      }
    };

    // Create a temporary div for PDF content
    const tempDiv = document.createElement('div');
    tempDiv.className = 'scenario-pdf-content';
    tempDiv.innerHTML = `
      <div class="scenario-header">
        <h2>Scenario ${new Date().toLocaleDateString()}</h2>
        <div class="scenario-info">
          <div class="basic-parameters">
            <p>Type: ${strategy[0]?.type || ''}</p>
            <p>Strategy Start Date: ${params.strategyStartDate}</p>
            <p>Hedging Start Date: ${params.startDate}</p>
            <p>Spot Price: ${params.spotPrice}</p>
                            <p>Volume: {params.totalVolume.toLocaleString()}</p>
                <p>Position Type: {params.volumeType === 'long' || params.volumeType === 'receivable' ? 'Long' : 'Short'}</p>
                <p>Current Rate: {(params.spotPrice || 0).toFixed(4)}</p>
          </div>
          <div class="stress-parameters">
            <p>Volatility: ${((stressTestScenarios[activeStressTest || 'base']?.volatility || 0) * 100).toFixed(1)}%</p>
            <p>Price Shock: ${((stressTestScenarios[activeStressTest || 'base']?.priceShock || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>
      <div class="charts-section">
        ${document.querySelector('.pnl-evolution')?.outerHTML || ''}
        ${document.querySelector('.payoff-diagram')?.outerHTML || ''}
      </div>
      <div class="detailed-results">
        ${document.querySelector('.detailed-results table')?.outerHTML || ''}
      </div>
      <div class="summary-statistics">
        ${document.querySelector('.summary-statistics table')?.outerHTML || ''}
      </div>
    `;

    // Add styles for PDF
    const style = document.createElement('style');
    style.textContent = `
      .scenario-pdf-content {
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .scenario-header {
        margin-bottom: 20px;
      }
      .scenario-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 30px;
      }
      .charts-section {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
        margin-bottom: 30px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
    `;
    tempDiv.appendChild(style);

    document.body.appendChild(tempDiv);
    
    try {
      await pdf.html(tempDiv, {
        ...options,
        html2canvas: {
          ...options.html2canvas,
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          allowTaint: true,
          foreignObjectRendering: true,
          svgRendering: true
        }
      });
      pdf.save('strategy-results.pdf');
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  // Ajoutez cette fonction pour gérer les changements de volatilité implicite
  const handleImpliedVolChange = (monthKey: string, value: number) => {
    setImpliedVolatilities(prev => {
      const updated = { ...prev };
      if (!updated[monthKey]) {
        updated[monthKey] = {};
      }
      updated[monthKey].global = value;
      return updated;
    });
    calculateResults();
  };
  
  // Helper function to get implied volatility with the new structure
  const getImpliedVolatility = (monthKey: string, optionKey?: string) => {
    if (!impliedVolatilities[monthKey]) {
      return null;
    }
    
    // If an optionKey is provided and that specific IV exists, return it
    if (optionKey && impliedVolatilities[monthKey][optionKey] !== undefined) {
      const vol = impliedVolatilities[monthKey][optionKey];
      return (vol !== null && vol !== undefined && !isNaN(vol) && vol > 0) ? vol : null;
    }
    
    // Otherwise fall back to the global month IV
    const globalVol = impliedVolatilities[monthKey].global;
    return (globalVol !== null && globalVol !== undefined && !isNaN(globalVol) && globalVol > 0) ? globalVol : null;
  };
  
  // New function to handle per-option implied volatility changes
  const handleOptionImpliedVolChange = (monthKey: string, optionKey: string, value: number) => {
    setImpliedVolatilities(prev => {
      const updated = { ...prev };
      if (!updated[monthKey]) {
        updated[monthKey] = {};
      }
      updated[monthKey][optionKey] = value;
      return updated;
    });
    // Recalculer immédiatement les résultats après chaque changement de valeur
    calculateResults();
  };

  // Fonction pour ajouter un swap
  const addSwap = () => {
    // Calculer le prix du swap si on a des résultats
    let swapPrice = params.spotPrice;
    if (results) {
      const forwards = results.map(r => r.forward);
      const times = results.map(r => r.timeToMaturity);
              swapPrice = calculateSwapPrice(forwards, times, params.domesticRate/100);
    }

    setStrategy([...strategy, {
      type: 'swap',
      strike: swapPrice,
      strikeType: 'absolute',
      volatility: 0, // Non utilisé pour le swap
      quantity: 100  // 100% par défaut
    }]);
  };

  // Fonction pour ajouter un forward FX
  const addForward = () => {
    // Calculer le taux forward théorique pour 1 an
    const forwardRate = calculateCommodityForwardPrice(
      params.spotPrice, 
      params.interestRate / 100, 
      0, // storage cost = 0
      0, // convenience yield = 0
      1.0 // 1 year
    );

    setStrategy([...strategy, {
      type: 'forward',
      strike: forwardRate,
      strikeType: 'absolute',
      volatility: 0, // Forwards n'ont pas de volatilité
      quantity: 100  // 100% par défaut
    }]);
  };

  // Interface moved to top of file - no need to redeclare here

  // Mettre à jour la fonction de nettoyage CSV
  const cleanCSVLine = (line: string) => {
    return line
      .replace(/\r/g, '')
      .replace(/^"|"$/g, '')
      .split(/[,;\t]/); // Accepte plusieurs délimiteurs
  };

  // Ajouter cet état pour suivre le format CSV sélectionné
  const [csvFormat, setCsvFormat] = useState<'english' | 'french'>('english');

  // Modifier la partie du code qui gère l'importation des données historiques
  const importHistoricalData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    
    input.onchange = (e: any) => {
      const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
        try {
          const csv = event.target?.result as string;
          const lines = csv.split('\n');
          
          const newData: HistoricalDataPoint[] = [];
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Diviser par virgule ou point-virgule, en tenant compte des guillemets
            const parts = line.split(',').map(part => part.replace(/"/g, '').trim());
            
            if (parts.length < 2) continue;
            
            let dateStr = parts[0];
            let priceStr = parts[1];
            
            // Traiter le format de date selon le format sélectionné
            let date;
            if (csvFormat === 'french') {
              // Format français DD/MM/YYYY
              const [day, month, year] = dateStr.split('/');
              date = new Date(Number(year), Number(month) - 1, Number(day));
            } else {
              // Format anglais MM/DD/YYYY
              const [month, day, year] = dateStr.split('/');
              date = new Date(Number(year), Number(month) - 1, Number(day));
            }
            
            // Traiter le format de prix selon le format sélectionné
            let price;
            if (csvFormat === 'french') {
              // Format français:
              // - Espace ou point comme séparateur de milliers
              // - Virgule comme séparateur décimal
              priceStr = priceStr
                .replace(/\s/g, '') // Supprimer les espaces (séparateurs de milliers)
                .replace(/\./g, '') // Supprimer les points (séparateurs de milliers alternatifs)
                .replace(',', '.'); // Remplacer la virgule par un point pour la conversion
              price = parseFloat(priceStr);
            } else {
              // Format anglais:
              // - Virgule comme séparateur de milliers
              // - Point comme séparateur décimal
              priceStr = priceStr.replace(/,/g, ''); // Supprimer les virgules (séparateurs de milliers)
              price = parseFloat(priceStr);
            }
            
            if (!isNaN(date.getTime()) && !isNaN(price)) {
              newData.push({
                            date: date.toISOString().split('T')[0],
                price
              });
            }
          }
          
          if (newData.length > 0) {
            // Trier les données par date
            const sortedData = newData.sort((a, b) => a.date.localeCompare(b.date));
        setHistoricalData(sortedData);
        calculateMonthlyStats(sortedData);
            console.log("Imported data:", sortedData); // Pour le débogage
            } else {
            alert('No valid data found in the CSV file. Please make sure to select the correct format (French/English).');
          }
          
        } catch (error) {
          console.error('Error parsing CSV:', error);
          alert('Error parsing the CSV file. Please check the format.');
        }
      };
      
        reader.readAsText(file);
    };
    
    input.click();
    };

  // Ajouter cette fonction pour mettre à jour les prix réels et les IV après le calcul des stats mensuelles
  const updateBacktestValues = (stats: MonthlyStats[]) => {
    // Récupérer tous les mois disponibles dans les statistiques
    const newRealPrices: {[key: string]: number} = {};
    const newImpliedVols: OptionImpliedVolatility = {};

    // Parcourir les statistiques mensuelles
    stats.forEach(stat => {
      const [year, month] = stat.month.split('-').map(Number);
      const monthKey = `${year}-${month}`;
      
      // Mettre à jour les prix réels
      newRealPrices[monthKey] = stat.avgPrice;
      
      // Si une volatilité est disponible, la stocker
      if (stat.volatility !== null) {
        if (!newImpliedVols[monthKey]) {
          newImpliedVols[monthKey] = {};
        }
        
        // Stocker la volatilité globale pour le mois
        newImpliedVols[monthKey].global = stat.volatility * 100; // Convertir en pourcentage
        
        // Appliquer également cette volatilité à chaque option de la stratégie
        strategy.forEach((option, index) => {
          // Ignorer les swaps et forwards qui n'utilisent pas de volatilité
          if (option.type !== 'swap' && option.type !== 'forward') {
            const optionKey = `${option.type}-${index}`;
            newImpliedVols[monthKey][optionKey] = stat.volatility * 100; // Convertir en pourcentage
          }
        });
      }
    });

    // Mettre à jour les états
    setRealPrices(newRealPrices);
    setImpliedVolatilities(newImpliedVols);
    setUseImpliedVol(true); // Activer l'utilisation des IV
    
    // Recalculer les résultats avec les nouvelles valeurs
    calculateResults();
  };

  // Update the monthly statistics calculation with intelligent calendar system
  const calculateMonthlyStats = (data: HistoricalDataPoint[]) => {
    // First, validate and filter data
    const validData = data.filter(point => 
      point && 
      point.date && 
      isValidDateString(point.date) && 
      typeof point.price === 'number' && 
      !isNaN(point.price)
    );
    
    if (validData.length === 0) {
      console.warn('[BACKTEST] No valid data points found');
      setMonthlyStats([]);
      return;
    }
    
    // Get data range information
    const dateRange = getDataDateRange(validData.map(p => p.date));
    if (!dateRange) {
      console.warn('[BACKTEST] Could not determine data range');
      setMonthlyStats([]);
      return;
    }
    
    console.log(`[BACKTEST] Data range: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]}`);
    console.log(`[BACKTEST] Months covered: ${dateRange.months.join(', ')}`);
    
    const monthlyData: { [key: string]: { prices: number[], dates: string[] } } = {};
    
    // Group prices and dates by month
    validData.forEach(point => {
        const date = new Date(point.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { prices: [], dates: [] };
        }
        monthlyData[monthKey].prices.push(point.price);
        monthlyData[monthKey].dates.push(point.date);
    });

    // Calculate statistics for each month using intelligent calendar system
    const stats = Object.entries(monthlyData).map(([month, { prices, dates }]) => {
      // Determine which price to use based on settings
      const exerciseType = getBacktestExerciseType();
      let avgPrice: number;
      let calculationMethod = '';
      
      if (exerciseType === 'third-friday') {
        // Use intelligent calendar system to find the 3rd Friday
        const [year, monthNum] = month.split('-').map(Number);
        const thirdFriday = getThirdFridayOfMonth(year, monthNum);
        
        if (thirdFriday) {
          // Use the smart date finder to get the closest date in data
          const closestResult = findClosestDateInData(thirdFriday, dates);
          
          if (closestResult) {
            avgPrice = prices[closestResult.index];
            calculationMethod = `3rd Friday (${closestResult.date}, ${closestResult.diffDays} days diff)`;
            
            if (closestResult.diffDays > 7) {
              console.warn(`[BACKTEST] ${month}: 3rd Friday data is ${closestResult.diffDays} days away from target date`);
            }
          } else {
            // Fallback to monthly average if no close date found
            avgPrice = validateDataForReduce(prices).reduce((sum, price) => sum + price, 0) / prices.length;
            calculationMethod = 'Monthly average (3rd Friday fallback)';
            console.warn(`[BACKTEST] ${month}: Could not find close date to 3rd Friday, using monthly average`);
          }
        } else {
          // Extremely rare case: no Fridays in month
          avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          calculationMethod = 'Monthly average (no 3rd Friday found)';
          console.error(`[BACKTEST] ${month}: No 3rd Friday found, using monthly average`);
        }
      } else {
        // Use monthly average (default behavior)
        avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        calculationMethod = `Monthly average (${prices.length} data points)`;
      }
      
      console.log(`[BACKTEST] ${month}: ${calculationMethod} = ${(avgPrice || 0).toFixed(4)}`);
      
      // Calculate volatility (same logic as before)
      const returns = prices.slice(1).map((price, i) => 
          Math.log(price / prices[i])
      );
      
      let volatility = null;
      if (returns.length > 0) {
          const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
          const variance = returns.reduce((sum, ret) => 
              sum + Math.pow(ret - avgReturn, 2), 0
          ) / (returns.length - 1);
          volatility = Math.sqrt(variance * 252);
      }

      return { 
        month, 
        avgPrice, 
        volatility,
        dataPoints: prices.length,
        calculationMethod
      };
    });

    // Sort by month (most recent first) and set the statistics
    const sortedStats = stats.sort((a, b) => b.month.localeCompare(a.month));
    setMonthlyStats(sortedStats);
    
    // Add this call with the sorted stats
    updateBacktestValues(sortedStats);
  };

  // Add this function
  const addHistoricalDataRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setHistoricalData([...historicalData, { date: today, price: 0 }]);
  };

  // Add this function too since it's used in the UI
  const clearHistoricalData = () => {
    setHistoricalData([]);
    setMonthlyStats([]);
  };

  // Modify the addCurrentStrategyToMatrix function
  const addCurrentStrategyToMatrix = () => {
    if (strategy.length === 0) {
      alert("Please create a strategy first");
      return;
    }
    
    // Create a deep copy of the current strategy with all properties
    const strategyCopy = strategy.map(opt => ({
      ...opt,
      // Ensure barrier-specific properties are included
      barrier: opt.barrier,
      secondBarrier: opt.secondBarrier,
      barrierType: opt.barrierType || 'percent'
    }));
    
    // Create a name based on the components
    const strategyName = strategyCopy.map(comp => {
      if (comp.type === 'swap') return 'Swap';
      
      // Handle barrier options
      if (comp.type.includes('knockout') || comp.type.includes('knockin')) {
        let optionName = "";
        
        // Determine base type (call/put)
        if (comp.type.includes('call')) {
          optionName = "Call";
        } else {
          optionName = "Put";
        }
        
        // Add barrier type
        if (comp.type.includes('double')) {
          optionName += " Dbl";
        } else if (comp.type.includes('reverse')) {
          optionName += " Rev";
        }
        
        // Add barrier mechanism
        if (comp.type.includes('knockout')) {
          optionName += " KO";
        } else { // knockin
          optionName += " KI";
        }
        
        return optionName;
      }
      
      // Standard options
      return `${comp.type === 'call' ? 'Call' : 'Put'} Option`;
    }).join('/');
    
    setMatrixStrategies([
      ...matrixStrategies,
      {
        components: strategyCopy,
        coverageRatio: 25, // Default 25%
        name: strategyName
      }
    ]);
  };

  // Modify the generateRiskMatrix function to adjust coverage cost according to the ratio
  const generateRiskMatrix = () => {
    // Check if we have results
    if (!results || results.length === 0) {
      alert("Please calculate the results first");
      return;
    }

    // Copy existing results to preserve them
    const existingResults = [...riskMatrixResults];
    const newResults: RiskMatrixResult[] = [];
    
    // For each configured strategy
    matrixStrategies.forEach(strategyConfig => {
      // Check if this strategy already exists in the results
      const existingStrategyIndex = existingResults.findIndex(result => 
        result.name === strategyConfig.name && 
        result.coverageRatio === strategyConfig.coverageRatio
      );
      
      // If the strategy already exists, use the existing results
      if (existingStrategyIndex !== -1) {
        newResults.push(existingResults[existingStrategyIndex]);
        return;
      }
      
      // Otherwise, calculate new results for this strategy
      
      // Calculate the total cost of the strategy taking into account the coverage ratio
      const strategyPremium = validateDataForReduce(results).reduce((sum, row) => {
        // Apply the coverage ratio to the strategy cost
        return sum + (row.strategyPrice * row.monthlyVolume * (strategyConfig.coverageRatio / 100));
      }, 0);
      
      const costs: {[key: string]: number} = {};
      const differences: {[key: string]: number} = {};
      
      // For each price range
      priceRanges.forEach(range => {
        const midPrice = (range.min + range.max) / 2;
        let totalPnL = 0;
        
        // Simulate each month with the constant mid price
        for (let i = 0; i < params.monthsToHedge; i++) {
        const monthlyVolume = params.totalVolume / params.monthsToHedge;
          const coveredVolume = monthlyVolume * (strategyConfig.coverageRatio/100);
          
          // Use the existing strategyPrice from the results
          const strategyPrice = results[Math.min(i, results.length-1)].strategyPrice;
          
          // Calculate the payoff for this mid price using the dedicated function
          const totalPayoff = calculateStrategyPayoffAtPrice(
            strategyConfig.components,
            midPrice,
            params.spotPrice
          );

          // Calculate the costs for this month
          const unhedgedCost = -(monthlyVolume * midPrice);
          const hedgedCost = -(monthlyVolume * midPrice) + 
            (coveredVolume * totalPayoff) - 
            (coveredVolume * strategyPrice);
          
          totalPnL += (hedgedCost - unhedgedCost);
        }
        
        // Store the total P&L for this range
        const rangeKey = `${range.min},${range.max}`;
        differences[rangeKey] = totalPnL;
      });
      
      newResults.push({
        strategy: strategyConfig.components,
        coverageRatio: strategyConfig.coverageRatio,
        costs,
        differences,
        hedgingCost: strategyPremium,
        name: strategyConfig.name
      });
    });
    
    setRiskMatrixResults(newResults);
  };

  // Add this function to add a strategy to the matrix
  const addMatrixStrategy = () => {
    if (strategy.length === 0) return;
    
    // Create a deep copy of the current strategy with all properties
    const strategyCopy = strategy.map(opt => ({
      ...opt,
      // Ensure barrier-specific properties are included
      barrier: opt.barrier,
      secondBarrier: opt.secondBarrier,
      barrierType: opt.barrierType || 'percent'
    }));
    
    // Create a name based on the components
    const strategyName = strategyCopy.map(comp => {
      if (comp.type === 'swap') return 'Swap';
      
      // Handle barrier options
      if (comp.type.includes('knockout') || comp.type.includes('knockin')) {
        let optionName = "";
        
        // Determine base type (call/put)
        if (comp.type.includes('call')) {
          optionName = "Call";
        } else {
          optionName = "Put";
        }
        
        // Add barrier type
        if (comp.type.includes('double')) {
          optionName += " Dbl";
        } else if (comp.type.includes('reverse')) {
          optionName += " Rev";
        }
        
        // Add barrier mechanism
        if (comp.type.includes('knockout')) {
          optionName += " KO";
        } else { // knockin
          optionName += " KI";
        }
        
        return optionName;
      }
      
      // Standard options
      return `${comp.type === 'call' ? 'Call' : 'Put'} Option`;
    }).join('/');
    
    setMatrixStrategies([
      ...matrixStrategies,
      {
        components: strategyCopy,
        coverageRatio: 25, // Default 25%
        name: strategyName
      }
    ]);
  };

  // Add this function to calculate the strategy price
  const calculateStrategyPrice = (components: StrategyComponent[]) => {
    let totalPrice = 0;
    
    components.forEach(comp => {
      const strike = comp.strikeType === 'percent' 
        ? params.spotPrice * (comp.strike / 100) 
        : comp.strike;
      
      if (comp.type === 'swap') {
        totalPrice += 0; // Swap has no premium
      } else {
        const optionPrice = calculateStrategyBuilderOptionPrice({
          type: comp.type,
          S: params.spotPrice,
          K: strike,
          rDiscountDecimal: strategyBuilderAnnualPercentToDecimal(params.interestRate),
          t: 1,
          sigma: comp.volatility / 100,
          useImpliedVol,
          getImpliedVol: useImpliedVol ? getImpliedVolatility : undefined,
          spotPrice: params.spotPrice,
          domesticRatePercent: params.domesticRate,
          foreignRatePercent: params.foreignRate,
          optionPricingModel,
          barrierPricingModel,
          barrierOptionSimulations,
          strategyLegs: strategy,
        });
        totalPrice += optionPrice * comp.quantity;
      }
    });
    
    return totalPrice;
  };

  // Add this function to remove a strategy
  const removeMatrixStrategy = (index: number) => {
    setMatrixStrategies(matrixStrategies.filter((_, i) => i !== index));
  };

  // Update the handleCoverageRatioChange function
  const handleCoverageRatioChange = (index: number, value: number) => {
    const updated = [...matrixStrategies];
    updated[index].coverageRatio = value;
    setMatrixStrategies(updated);
  };

  // Add this function to handle price ranges
  const updatePriceRange = (index: number, field: keyof PriceRange, value: number) => {
    const updated = [...priceRanges];
    updated[index][field] = value;
    setPriceRanges(updated);
  };

  // Add this function to determine cell colors
  const getCellColor = (value: number) => {
    if (value > 0) {
      const intensity = Math.min(value / 100, 1); // Scale appropriately
      return `rgba(0, 128, 0, ${intensity * 0.3})`; // Green
    } else {
      const intensity = Math.min(Math.abs(value) / 100, 1);
      return `rgba(255, 0, 0, ${intensity * 0.3})`; // Red
    }
  };

  // Add a function to clear all strategies
  const clearAllStrategies = () => {
    setMatrixStrategies([]);
    setRiskMatrixResults([]);
  };

  // Add this function to save the risk matrix
  const saveRiskMatrix = () => {
    if (riskMatrixResults.length === 0) {
      alert("No risk matrix results to save");
      return;
    }

    const name = prompt("Enter a name for this risk matrix:", "Risk Matrix " + new Date().toLocaleDateString());
    if (!name) return;

    const newMatrix: SavedRiskMatrix = {
      id: uuidv4(),
      name,
      timestamp: Date.now(),
      priceRanges: [...priceRanges],
      strategies: [...matrixStrategies],
      results: [...riskMatrixResults],
    };

    const updatedMatrices = [...savedRiskMatrices, newMatrix];
    setSavedRiskMatrices(updatedMatrices);
    localStorage.setItem('savedRiskMatrices', JSON.stringify(updatedMatrices));

    alert("Risk matrix saved successfully!");
  };

  // Add this function to export the risk matrix to PDF
  const exportRiskMatrixToPDF = async () => {
    if (riskMatrixResults.length === 0) {
      alert("No risk matrix results to export");
      return;
    }

    try {
      // Create a temporary element for the PDF content
      const tempDiv = document.createElement('div');
      tempDiv.className = 'p-8 bg-background dark:bg-background';
      tempDiv.innerHTML = `
        <h1 class="text-2xl font-bold mb-4">Risk Matrix Results</h1>
        <div class="mb-4">
          <h2 class="text-lg font-semibold">Price Ranges</h2>
          <ul>
            ${priceRanges.map(range => `
              <li>Range: [${range.min}, ${range.max}] - Probability: ${range.probability}%</li>
            `).join('')}
          </ul>
        </div>
      `;

      // Create the results table
      const table = document.createElement('table');
      table.className = 'w-full border-collapse';
      table.innerHTML = `
        <thead>
          <tr>
            <th class="border p-2 text-left">Strategy</th>
            <th class="border p-2 text-center">Coverage Ratio</th>
            <th class="border p-2 text-center">Hedging Cost (M$)</th>
            ${priceRanges.map(range => `
              <th class="border p-2 text-center">${range.probability}%<br>[${range.min},${range.max}]</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${riskMatrixResults.map(result => `
            <tr>
              <td class="border p-2">
                ${result.name}
              </td>
              <td class="border p-2 text-center">${result.coverageRatio || 0}%</td>
              <td class="border p-2 text-center">${((result.hedgingCost || 0) / 1000000).toFixed(1)}</td>
              ${priceRanges.map(range => {
                const rangeKey = `${range.min},${range.max}`;
                const diffValue = result.differences?.[rangeKey] || 0;
                const value = (diffValue / 1000000).toFixed(1);
                const color = diffValue > 0 
                  ? 'rgba(0, 128, 0, 0.2)' 
                  : 'rgba(255, 0, 0, 0.2)';
                return `<td class="border p-2 text-center" style="background-color: ${color}">${value}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      `;
      
      tempDiv.appendChild(table);
      document.body.appendChild(tempDiv);

      // Generate the PDF
      const pdf = new jsPDF('landscape', 'pt', 'a4');
      
      // Use html2canvas to render the table as an image
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Download the PDF
      pdf.save('risk_matrix_results.pdf');
      
      // Clean up
      document.body.removeChild(tempDiv);
      
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  // Add this function to calculate the expected value of each strategy
  const calculateExpectedValue = (result: RiskMatrixResult) => {
    let expectedValue = 0;
    let totalProbability = 0;
    
    // Iterate over each price range
    priceRanges.forEach(range => {
      const rangeKey = `${range.min},${range.max}`;
      const difference = result.differences[rangeKey]; // Profit/Loss in this range
      const probability = range.probability / 100; // Convert percentage to decimal
      
      // Add the weighted contribution of this range to the expected value
      expectedValue += difference * probability;
      totalProbability += probability;
    });
    
    // Normalize if the probabilities don't sum exactly to 1
    if (totalProbability !== 1) {
      expectedValue = expectedValue / totalProbability;
    }
    
    return expectedValue;
  };

  // Add a function to save the historical backtest results
  const saveHistoricalBacktestResults = () => {
    if (!results) {
      alert("No results to save. Please run the backtest first.");
      return;
    }

    // Ask the user to name their scenario
    const scenarioName = prompt("Scenario name:", "Historical Backtest " + new Date().toLocaleDateString());
    if (!scenarioName) return;

    // Create a new scenario object
    const newScenario: SavedScenario = {
      id: uuidv4(),
      name: scenarioName,
      timestamp: Date.now(),
      params: {...params},
      strategy: [...strategy],
      results: [...results],
      payoffData: [...payoffData],
      // Indicate that it's a historical backtest
      stressTest: {
        name: "Historical Backtest",
        description: "Calculated from historical data",
        volatility: 0,  // These values are not used in the historical backtest
        drift: 0,       // but are needed for the structure
        priceShock: 0,
        isHistorical: true,  // Mark as historical backtest
        historicalData: [...historicalData]  // Add the historical data
      },
      useImpliedVol,
      impliedVolatilities,
      manualForwards,
      realPrices,
      customOptionPrices
    };

    // Get existing scenarios
    const savedScenariosStr = localStorage.getItem('optionScenarios');
    const savedScenarios: SavedScenario[] = savedScenariosStr 
      ? JSON.parse(savedScenariosStr) 
      : [];
    
    // Add the new scenario
    savedScenarios.push(newScenario);
    
    // Save to localStorage
    localStorage.setItem('optionScenarios', JSON.stringify(savedScenarios));
    
    alert("Scenario saved successfully!");
  };

  // Add a function to export the historical backtest results to PDF
  const exportHistoricalBacktestToPDF = () => {
    if (!results) {
      alert("No results to export. Please run the backtest first.");
      return;
    }

    // Set up jsPDF
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Define options for PDF export
    const options = {
      margin: [10, 10, 10, 10],
      autoPaging: 'text',
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false
      }
    };
    
    // Title
    doc.setFontSize(18);
    doc.text('Historical Backtest Results', pageWidth / 2, 15, { align: 'center' });
    
    // Date
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 25, { align: 'center' });
    
    // Basic parameters
    doc.setFontSize(14);
    doc.text('Basic Parameters', 10, 35);
    doc.setFontSize(10);
    doc.text(`Strategy Start Date: ${params.strategyStartDate}`, 15, 45);
    doc.text(`Hedging Start Date: ${params.startDate}`, 15, 50);
    doc.text(`Months to Hedge: ${params.monthsToHedge}`, 15, 55);
    doc.text(`Domestic Rate: ${params.domesticRate}% | Foreign Rate: ${params.foreignRate}%`, 15, 60);
    doc.text(`Volume: ${params.totalVolume.toLocaleString()}`, 15, 65);
    doc.text(`Position Type: ${params.volumeType === 'long' || params.volumeType === 'receivable' ? 'Long' : 'Short'}`, 15, 85);
    doc.text(`Current Spot Rate: ${params.spotPrice.toFixed(4)}`, 15, 95);
    
    // Strategy
    doc.setFontSize(14);
    doc.text('Strategy Components', 10, 110);
    strategy.forEach((comp, index) => {
      const yPos = 105 + (index * 10);
      const strike = comp.strikeType === 'percent' 
        ? `${comp.strike}%` 
        : comp.strike.toString();
      doc.setFontSize(10);
      doc.text(`Component ${index+1}: ${comp.type.toUpperCase()}, Strike: ${strike}, Vol: ${comp.volatility}%, Qty: ${comp.quantity}%`, 15, yPos);
    });
    
    // Historical Data Summary
    doc.setFontSize(14);
    doc.text('Historical Data Summary', 10, 140);
    doc.setFontSize(10);
    doc.text(`Number of Data Points: ${historicalData.length}`, 15, 150);
    if (monthlyStats.length > 0) {
      doc.text(`Average Historical Volatility: ${
        monthlyStats.reduce((sum, stat) => sum + (stat.volatility || 0), 0) / 
        monthlyStats.filter(stat => stat.volatility !== null).length * 100
      }%`, 15, 155);
    }
    
    // Total results
    const totalHedgedCost = validateDataForReduce(results).reduce((sum, row) => sum + (row.hedgedCost || 0), 0);
    const totalUnhedgedCost = validateDataForReduce(results).reduce((sum, row) => sum + (row.unhedgedCost || 0), 0);
    const totalPnL = validateDataForReduce(results).reduce((sum, row) => sum + (row.deltaPnL || 0), 0);
    const costReduction = totalUnhedgedCost !== 0 ? (totalPnL / Math.abs(totalUnhedgedCost)) * 100 : 0;
    
    doc.setFontSize(14);
    doc.text('Total Results', 10, 170);
    doc.setFontSize(10);
    doc.text(`Total Cost with Hedging: ${(totalHedgedCost || 0).toFixed(2)}`, 15, 180);
    doc.text(`Total Cost without Hedging: ${(totalUnhedgedCost || 0).toFixed(2)}`, 15, 185);
    doc.text(`Total P&L: ${(totalPnL || 0).toFixed(2)}`, 15, 190);
    doc.text(`Cost Reduction: ${(costReduction || 0).toFixed(2)}%`, 15, 195);
    
    // Capture the P&L chart and add it
    const pnlChartContainer = document.getElementById('historical-backtest-pnl-chart');
    if (pnlChartContainer) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text('P&L Evolution', 10, 15);
      
      html2canvas(pnlChartContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 10, 25, 190, 100);
        
        // Save the PDF
        doc.save('Historical_Backtest_Results.pdf');
      });
    } else {
      doc.save('Historical_Backtest_Results.pdf');
    }
  };

  // Add this function after clearAllStrategies
  const generateGeneralRiskAnalysis = () => {
    // Check if we have results
    if (!results || results.length === 0) {
      alert("Please calculate the results first");
      return;
    }
    
    // Check if there is at least one strategy
    if (matrixStrategies.length === 0) {
      alert("Please add at least one strategy to the matrix first");
      return;
    }

    // Save existing strategies
    const existingStrategies = [...matrixStrategies];
    
    // Prepare the ratios to apply
    const coverageRatios = [25, 50, 75, 100];
    const analysisStrategies = [];
    
    // For each existing strategy, create versions with different ratios
    existingStrategies.forEach(strategy => {
      // Base name of the strategy 
      const baseName = strategy.name.replace(/\s\d+%$/, ''); // Remove % if already exists
      
      // Create 4 versions with different ratios
      coverageRatios.forEach(ratio => {
        analysisStrategies.push({
          name: `${baseName} ${ratio}%`,
          components: [...strategy.components],
          coverageRatio: ratio
        });
      });
    });
    
    // Set the strategies for the matrix
    setMatrixStrategies(analysisStrategies);
    
    // Generate the matrix with these strategies
    setTimeout(() => {
      generateRiskMatrix();
    }, 100);
  };

  // Add a state to track if the display is in coverage variations mode
  const [showCoverageVariations, setShowCoverageVariations] = useState(false);

  // Add the function to rearrange the matrix display
  const toggleCoverageVariations = () => {
    if (!riskMatrixResults.length) {
      alert("Please generate the risk matrix first");
      return;
    }
    
    setShowCoverageVariations(!showCoverageVariations);
  };

  // Modifier l'affichage du tableau de la matrice de risque
  {riskMatrixResults.length > 0 && (
    <div className="mt-8 overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4">Risk Matrix Results</h3>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">Strategy</th>
            <th className="border p-2">Coverage Ratio</th>
            <th className="border p-2">Hedging Cost (k$)</th>
            {priceRanges.map((range, i) => (
              <th key={i} className="border p-2">{range.probability}%<br/>[{range.min},{range.max}]</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showCoverageVariations 
            ? riskMatrixResults.flatMap((result, i) => {
                const strategyName = result.name.replace(/\s\d+%$/, '');
                const ratios = [25, 50, 75, 100];
                
                return ratios.map((ratio) => (
                  <tr key={`${i}-${ratio}`}>
                    <td className="border p-2">{strategyName}</td>
                    <td className="border p-2">{ratio}%</td>
                    <td className="border p-2">{(((result.hedgingCost || 0) / (result.coverageRatio || 1)) * ratio / 1000).toFixed(1)}</td>
                    
                    {priceRanges.map((range, j) => {
                      const rangeKey = `${range.min},${range.max}`;
                      // Ajuster la valeur en fonction du ratio
                      const diffValue = result.differences?.[rangeKey] || 0;
                      const adjustedValue = (diffValue / (result.coverageRatio || 1)) * ratio;
                      
                      return (
                        <td 
                          key={j} 
                          className="border p-2"
                          style={{ backgroundColor: getCellColor(adjustedValue) }}
                        >
                          {((adjustedValue || 0) / 1000).toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })
            : riskMatrixResults.map((result, i) => (
                <tr key={i}>
                  <td className="border p-2">{result.name || ''}</td>
                  <td className="border p-2">{result.coverageRatio || 0}%</td>
                  <td className="border p-2">{((result.hedgingCost || 0) / 1000).toFixed(1)}</td>
                  
                  {priceRanges.map((range, j) => {
                    const rangeKey = `${range.min},${range.max}`;
                    const diffValue = result.differences?.[rangeKey] || 0;
                    return (
                      <td 
                        key={j} 
                        className="border p-2"
                        style={{ backgroundColor: getCellColor(diffValue) }}
                      >
                        {(diffValue / 1000).toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  )}

  // Add this near the other state variables
  const [showMonteCarloVisualization, setShowMonteCarloVisualization] = useState<boolean>(false);
  
  // Generate months and startDate for simulations
  const startDate = new Date(params.strategyStartDate);
  const months = Array.from({ length: params.monthsToHedge }, (_, i) => {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i + 1);
    return date;
  });
  
  // Store simulation data
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);
  const [isRunningSimulation, setIsRunningSimulation] = useState<boolean>(false);

  // Ajoutez cette fonction pour recalculer les simulations Monte Carlo lorsque les paramètres changent
  const recalculateMonteCarloSimulations = useCallback(() => {
    if (!results) return;
    
    setIsRunningSimulation(true);

    // Récupérer les mois et date de début pour les simulations
    const startDate = new Date(params.strategyStartDate);
    let months = [];
    
    // Check if using custom periods
    if (params.useCustomPeriods && params.customPeriods.length > 0) {
      // Sort custom periods by maturity date
      const sortedPeriods = [...params.customPeriods].sort(
        (a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime()
      );
      
      // Use the maturity dates from custom periods
      months = sortedPeriods.map(period => new Date(period.maturityDate));
    } else {
      // Use the same maturity convention as calculateResults (last day or third Friday)
      const maturityConvention = getMaturityConvention();
    let currentDate = new Date(startDate);

    const lastDayOfStartMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const remainingDaysInMonth = lastDayOfStartMonth.getDate() - currentDate.getDate() + 1;

    if (remainingDaysInMonth > 0) {
        months.push(getMaturityDateForMonth(currentDate.getFullYear(), currentDate.getMonth(), maturityConvention));
    }

    for (let i = 0; i < params.monthsToHedge - (remainingDaysInMonth > 0 ? 1 : 0); i++) {
      currentDate.setMonth(currentDate.getMonth() + 1);
        months.push(getMaturityDateForMonth(currentDate.getFullYear(), currentDate.getMonth(), maturityConvention));
      }
    }

    // Générer les chemins de prix pour toute la période seulement si la simulation est activée
    let paths = [];
    let monthlyIndices = [];
    let timeLabels = [];
    let realPricePaths = [];
    
    // Générer des chemins de prix seulement si la simulation est activée
    if (realPriceParams.useSimulation) {
      const pathsData = generateStrategyBuilderPricePaths({
        monthMaturityStrs: months.map((d) => formatDateLocal(d)),
        valuationDateStr: formatDateLocal(startDate),
        spotPrice: params.spotPrice,
        domesticRatePercent: params.domesticRate,
        foreignRatePercent: params.foreignRate,
        sigmaDecimal: realPriceParams.volatility,
        numSimulations: realPriceParams.numSimulations,
      });
      paths = pathsData.paths;
      monthlyIndices = pathsData.monthlyIndices;
      
      // Préparer les données de visualisation Monte Carlo
      timeLabels = months.map(
        (date) => `${date.getFullYear()}-${date.getMonth() + 1}`
      );

      // Sélectionner aléatoirement jusqu'à 100 chemins à afficher
      const maxDisplayPaths = Math.min(100, paths.length);
      const selectedPathIndices = [];
      
      // Si nous avons moins de 100 chemins, utilisez-les tous
      if (paths.length <= maxDisplayPaths) {
        for (let i = 0; i < paths.length; i++) {
          selectedPathIndices.push(i);
        }
      } else {
        // Sinon, sélectionnez 100 indices aléatoires
        while (selectedPathIndices.length < maxDisplayPaths) {
          const randomIndex = Math.floor(Math.random() * paths.length);
          if (!selectedPathIndices.includes(randomIndex)) {
            selectedPathIndices.push(randomIndex);
          }
        }
      }
      
      // Créer les données de chemins de prix réels
      realPricePaths = selectedPathIndices.map(pathIndex => 
        monthlyIndices.map(idx => paths[pathIndex][idx])
      );
    } else {
      // Si la simulation n'est pas utilisée, nous avons quand même besoin de timeLabels pour les options à barrière
      timeLabels = months.map(
        (date) => `${date.getFullYear()}-${date.getMonth() + 1}`
      );
      
      // Générer des chemins simples pour les options barrière si nécessaire
      // Même si useSimulation est false, nous voulons générer des chemins pour les options barrière
      const pathsData = generateStrategyBuilderPricePaths({
        monthMaturityStrs: months.map((d) => formatDateLocal(d)),
        valuationDateStr: formatDateLocal(startDate),
        spotPrice: params.spotPrice,
        domesticRatePercent: params.domesticRate,
        foreignRatePercent: params.foreignRate,
        sigmaDecimal: realPriceParams.volatility,
        numSimulations: 100,
      });
      paths = pathsData.paths;
      monthlyIndices = pathsData.monthlyIndices;
    }

    // Calculer les prix des options à barrière si nous en avons, même si useSimulation est false
    const barrierOptions = strategy.filter(
      (opt) => opt.type.includes('knockout') || opt.type.includes('knockin')
    );

    const barrierOptionPricePaths: number[][] = [];

    if (barrierOptions.length > 0) {
      // Génération de chemins spécifiques pour les options à barrière
      const barrierPathsData = generateStrategyBuilderPricePaths({
        monthMaturityStrs: months.map((d) => formatDateLocal(d)),
        valuationDateStr: formatDateLocal(startDate),
        spotPrice: params.spotPrice,
        domesticRatePercent: params.domesticRate,
        foreignRatePercent: params.foreignRate,
        sigmaDecimal: realPriceParams.volatility,
        numSimulations: barrierOptionSimulations,
      });
      const barrierPaths = barrierPathsData.paths;
      const barrierMonthlyIndices = barrierPathsData.monthlyIndices;
      
      // Sélectionner les chemins à utiliser pour l'affichage (soit tous si peu nombreux, soit un échantillon aléatoire)
      const maxDisplayPaths = Math.min(100, barrierPaths.length);
      const selectedPathIndices = [];
      
      // Si nous avons moins de 100 chemins, utilisez-les tous
      if (barrierPaths.length <= maxDisplayPaths) {
        for (let i = 0; i < barrierPaths.length; i++) {
          selectedPathIndices.push(i);
        }
      } else {
        // Sinon, sélectionnez 100 indices aléatoires
        while (selectedPathIndices.length < maxDisplayPaths) {
          const randomIndex = Math.floor(Math.random() * barrierPaths.length);
          if (!selectedPathIndices.includes(randomIndex)) {
            selectedPathIndices.push(randomIndex);
          }
        }
      }

      // Pour simplifier, utilisez la première option à barrière
      const barrierOption = barrierOptions[0];
      
      // Calculer la valeur de la barrière
      const barrier = barrierOption.barrierType === 'percent' 
        ? params.spotPrice * (barrierOption.barrier! / 100) 
        : barrierOption.barrier!;
      
      const secondBarrier = barrierOption.type.includes('double')
        ? barrierOption.barrierType === 'percent'
          ? params.spotPrice * (barrierOption.secondBarrier! / 100)
          : barrierOption.secondBarrier
        : undefined;
        
      // Calculer le strike
      const strike = barrierOption.strikeType === 'percent'
        ? params.spotPrice * (barrierOption.strike / 100)
        : barrierOption.strike;

      // Calculer les prix des options pour les chemins sélectionnés
      for (const pathIndex of selectedPathIndices) {
        const path = barrierPaths[pathIndex];
        const optionPrices: number[] = [];
        
        // Pour chaque mois, calculer le prix de l'option
        for (let monthIdx = 0; monthIdx < barrierMonthlyIndices.length; monthIdx++) {
          const maturityIndex = barrierMonthlyIndices[monthIdx];
          
          // Calculer le prix de l'option à ce point
          const optionPrice = calculatePricesFromPaths(
            barrierOption.type,
            params.spotPrice,
            strike,
            strategyBuilderAnnualPercentToDecimal(params.interestRate),
            maturityIndex,
            [path],
            barrier,
            secondBarrier
          );
          
          optionPrices.push(optionPrice);
        }
        
        barrierOptionPricePaths.push(optionPrices);
      }
    }

    // Mettre à jour les données de visualisation avec les chemins calculés
    setSimulationData({
      realPricePaths,
      timeLabels,
      strategyName: barrierOptions.length > 0 
        ? `${barrierOptions[0].type} at ${barrierOptions[0].strike}` 
        : 'Current Strategy',
    });

    setIsRunningSimulation(false);
  }, [params, realPriceParams.numSimulations, strategy, results, barrierOptionSimulations]);

  // Update the realPriceParams and recalculate when numSimulations changes
  const handleNumSimulationsChange = (value: number) => {
    // Ensure value is between 100 and 5000
    const validValue = Math.max(100, Math.min(5000, value));
    
    setRealPriceParams(prev => ({
      ...prev,
      numSimulations: validValue
    }));
    
    // Recalculer les simulations avec le nouveau nombre de simulations
    if (results && realPriceParams.useSimulation) {
      recalculateMonteCarloSimulations();
    }
  };

  // Mise à jour du nombre de simulations pour les options à barrière
  useEffect(() => {
    if (results && strategy.some(opt => opt.type.includes('knockout') || opt.type.includes('knockin'))) {
      recalculateMonteCarloSimulations();
    }
  }, [barrierOptionSimulations, recalculateMonteCarloSimulations, results, strategy]);

  // Ajouter un effet useEffect pour recalculer les simulations Monte Carlo lorsque useSimulation change
  useEffect(() => {
    if (results) {
      recalculateMonteCarloSimulations();
    }
  }, [realPriceParams.useSimulation, recalculateMonteCarloSimulations, results]);
  
  // Function to add a new custom period
  const addCustomPeriod = () => {
    // Calculate a default maturity date one month from the strategy start date
    const startDate = new Date(params.strategyStartDate);
    startDate.setMonth(startDate.getMonth() + params.customPeriods.length + 1);
    
    // Create a new custom period with default values
    const newPeriod: CustomPeriod = {
      maturityDate: startDate.toISOString().split('T')[0],
      volume: Math.round(params.totalVolume / (params.customPeriods.length + 1))
    };
    
    // Update the params with the new period
    setParams({
      ...params,
      customPeriods: [...params.customPeriods, newPeriod]
    });
  };
  
  // Function to remove a custom period
  const removeCustomPeriod = (index: number) => {
    const updatedPeriods = [...params.customPeriods];
    updatedPeriods.splice(index, 1);
    
    setParams({
      ...params,
      customPeriods: updatedPeriods
    });
  };
  
  // Function to update a custom period
  const updateCustomPeriod = (index: number, field: keyof CustomPeriod, value: string | number) => {
    const updatedPeriods = [...params.customPeriods];
    updatedPeriods[index] = {
      ...updatedPeriods[index],
      [field]: value
    };
    
    setParams({
      ...params,
      customPeriods: updatedPeriods
    });
  };
  
  // Function to toggle between using standard months or custom periods
  const toggleCustomPeriods = () => {
    // If switching to custom periods for the first time, initialize with one period
    if (!params.useCustomPeriods && params.customPeriods.length === 0) {
      const startDate = new Date(params.strategyStartDate);
      startDate.setMonth(startDate.getMonth() + 1);
      
      setParams({
        ...params,
        useCustomPeriods: !params.useCustomPeriods,
        customPeriods: [
          {
            maturityDate: startDate.toISOString().split('T')[0],
            volume: params.totalVolume
          }
        ]
      });
    } else {
      setParams({
        ...params,
        useCustomPeriods: !params.useCustomPeriods
      });
    }
    
    // Recalculate results if they exist
    if (results) {
      recalculateResults();
    }
  };


  // Gestionnaire d'événements pour mettre à jour le prix personnalisé et calculer l'IV correspondante
  const handleCustomPriceChange = (monthKey: string, optionIndex: string, newPrice: number) => {
    // Mettre à jour l'état des prix personnalisés
    setCustomOptionPrices(prev => {
      const updated = { ...prev };
      if (!updated[monthKey]) {
        updated[monthKey] = {};
      }
      updated[monthKey][optionIndex] = newPrice;
      return updated;
    });
    
    // Si nous avons des résultats
    if (results) {
      const monthResult = results.find(r => {
        const date = new Date(r.date);
        return `${date.getFullYear()}-${date.getMonth() + 1}` === monthKey;
      });
      
      if (monthResult) {
        // Trouver l'option correspondante
        const optionType = optionIndex.split('-')[0]; // Extraire le type (call, put, etc.)
        const optionIdx = parseInt(optionIndex.split('-')[1] || '0'); // Extraire l'index numérique
        
        const option = monthResult.optionPrices.find((opt, idx) => 
          opt.type === optionType && idx === optionIdx
        );
        
        if (option) {
          // Pour les options standards (call/put)
          if (option.type === 'call' || option.type === 'put') {
          // Calculer la volatilité implicite à partir du prix personnalisé
          const underlyingResult = calculateUnderlyingPrice(
            params.spotPrice,
            strategyBuilderAnnualPercentToDecimal(params.interestRate),
            params.foreignRate/100,
            monthResult.timeToMaturity
          );
          const impliedVol =
            solveImpliedVolatilityDecimal(
            option.type,
              underlyingResult.price,
              option.strike,
              params.domesticRate / 100,
              params.foreignRate / 100,
              monthResult.timeToMaturity,
              newPrice
            ) * 100;
            // Mettre à jour la volatilité implicite pour cette option spécifique
            setImpliedVolatilities(prev => {
              const updated = { ...prev };
              if (!updated[monthKey]) {
                updated[monthKey] = {};
              }
              updated[monthKey][optionIndex] = impliedVol;
              return updated;
            });
          // Activer automatiquement l'utilisation des volatilités implicites
          if (!useImpliedVol) {
            setUseImpliedVol(true);
          }
          }
          // Pour les options à barrière (avec knockout ou knockin dans leur type)
          else if (option.type.includes('knockout') || option.type.includes('knockin')) {
            const strategyOption = strategy.find(opt => opt.type === option.type);
            if (strategyOption) {
              if (useImpliedVol) {
                let bestSigma = 0.20; // Valeur initiale
                let bestDiff = Infinity;
                const steps = 50;
                for (let i = 0; i <= steps; i++) {
                  const testSigma = 0.01 + (i / steps) * 0.99; // Test de volatilité entre 1% et 100%
                  const underlyingResult = calculateUnderlyingPrice(
                    params.spotPrice,
                    strategyBuilderAnnualPercentToDecimal(params.interestRate),
                    params.foreignRate/100,
                    monthResult.timeToMaturity
                  );
                  const testPrice = calculateStrategyBuilderOptionPrice({
                    type: option.type,
                    S: underlyingResult.price,
                    K: option.strike,
                    rDiscountDecimal: strategyBuilderAnnualPercentToDecimal(params.interestRate),
                    t: monthResult.timeToMaturity,
                    sigma: testSigma,
                    useImpliedVol: false,
                    spotPrice: params.spotPrice,
                    domesticRatePercent: params.domesticRate,
                    foreignRatePercent: params.foreignRate,
                    optionPricingModel,
                    barrierPricingModel,
                    barrierOptionSimulations,
                    strategyLegs: strategy,
                  });
                  const diff = Math.abs(testPrice - newPrice);
                  if (diff < bestDiff) {
                    bestDiff = diff;
                    bestSigma = testSigma;
                  }
                }
                // Mettre à jour la volatilité implicite pour cette option spécifique
                setImpliedVolatilities(prev => {
                  const updated = { ...prev };
                  if (!updated[monthKey]) {
                    updated[monthKey] = {};
                  }
                  updated[monthKey][optionIndex] = bestSigma * 100; // Convertir en pourcentage
                  return updated;
                });
              }
            }
          }
          // Recalculer les résultats avec les nouvelles volatilités implicites
          setTimeout(() => {
            recalculateResults();
          }, 50);
        }
      }
    }
  };

  // Fonction pour initialiser les volatilités implicites à partir des prix actuels
  const initializeImpliedVolatilities = () => {
    if (!results) return;
    
    // Stocker les nouvelles volatilités implicites
    const newImpliedVols: OptionImpliedVolatility = {};
    
    // Pour chaque mois dans les résultats
    results.forEach(monthResult => {
      const date = new Date(monthResult.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      // Initialiser la structure du mois
      newImpliedVols[monthKey] = {};
      
      // Traiter chaque option dans ce mois
      monthResult.optionPrices.forEach((option, optionIndex) => {
        // Ignorer les swaps
        if (option.type === 'swap') return;
        
        // Trouver l'option correspondante dans la stratégie
        const strategyOption = strategy.find(opt => opt.type === option.type);
        if (!strategyOption) return;
        
        // Calculer la volatilité implicite pour cette option
        let impliedVol = strategyOption.volatility;
        
        // Pour les options standard (call/put), calculer une vraie IV
        if (option.type === 'call' || option.type === 'put') {
          const underlyingResult = calculateUnderlyingPrice(
            params.spotPrice,
            strategyBuilderAnnualPercentToDecimal(params.interestRate),
            params.foreignRate/100,
            monthResult.timeToMaturity
          );
          const calculatedIV =
            solveImpliedVolatilityDecimal(
            option.type,
            underlyingResult.price,
            option.strike,
            params.domesticRate / 100,
              params.foreignRate / 100,
            monthResult.timeToMaturity,
            option.price
            ) * 100;
          
          if (calculatedIV > 0) {
            impliedVol = calculatedIV;
          }
        }
        
        // Stocker la volatilité pour cette option spécifique
        const optionKey = `${option.type}-${optionIndex}`;
        newImpliedVols[monthKey][optionKey] = impliedVol;
      });
      
      // Définir une volatilité globale (moyenne ou première option standard)
      let standardOptionFound = false;
      
      // D'abord, essayer de trouver une option standard
      for (let i = 0; i < monthResult.optionPrices.length; i++) {
        const option = monthResult.optionPrices[i];
        if (option.type === 'call' || option.type === 'put') {
          const optionKey = `${option.type}-${i}`;
          newImpliedVols[monthKey].global = newImpliedVols[monthKey][optionKey];
          standardOptionFound = true;
          break;
        }
      }
      
      // Si aucune option standard, utiliser la moyenne
      if (!standardOptionFound) {
        let sum = 0;
        let count = 0;
        
        for (const optionKey in newImpliedVols[monthKey]) {
          if (optionKey !== 'global') {
            sum += newImpliedVols[monthKey][optionKey];
            count++;
          }
        }
        
        newImpliedVols[monthKey].global = count > 0 ? sum / count : 20; // Valeur par défaut
      }
    });
    
    setImpliedVolatilities(newImpliedVols);
  };

  // Modifier le gestionnaire d'événements pour "Use my own prices"
  const handleUseCustomPricesToggle = (checked: boolean) => {
    setUseCustomOptionPrices(checked);
    
    if (checked) {
      // Initialiser les volatilités implicites à partir des prix actuels
      initializeImpliedVolatilities();
      
      // Activer automatiquement l'utilisation des volatilités implicites
      if (!useImpliedVol) {
        setUseImpliedVol(true);
      }
    }
    
    // Toujours recalculer les résultats après le changement
    setTimeout(() => {
      if (checked) {
        recalculateResults();
      } else {
        // Si on désactive les prix personnalisés, recalculer complètement
        calculateResults();
      }
    }, 100);
  };

  // Gestionnaire pour activer/désactiver l'utilisation des volatilités implicites
  const handleUseImpliedVolToggle = (checked: boolean) => {
    setUseImpliedVol(checked);
    
    // Si on active les volatilités implicites et qu'il n'y en a pas encore, les initialiser
    if (checked && Object.keys(impliedVolatilities).length === 0) {
      initializeImpliedVolatilities();
    }
    
    // Toujours recalculer les résultats après le changement
    setTimeout(() => {
      if (useCustomOptionPrices) {
        // Si on utilise des prix personnalisés, utiliser recalculateResults
        recalculateResults();
      } else {
        // Sinon, recalculer complètement
        calculateResults();
      }
    }, 100);
  };

  const handleUseRealInterestRateToggle = (checked: boolean) => {
    setUseRealInterestRate(checked);
    setTimeout(() => {
      if (useCustomOptionPrices) {
        recalculateResults();
      } else {
        calculateResults();
      }
    }, 100);
  };

  // Ticker Peek Pro: force refresh (scraping) then refresh forward & IV in Detailed Results
  const handleTppDetailedUpdate = async () => {
    const symbol = params.currencyPair?.symbol;
    if (!useTickerPeekPro || !symbol) return;
    try {
      await loadTppData(symbol, true);
      calculateResults();
      toast({ title: "TPP data updated", description: "Forward and IV refreshed from Ticker Peek Pro." });
    } catch (e) {
      console.error('TPP update error:', e);
      toast({ title: "Update failed", description: "Could not refresh TPP data.", variant: "destructive" });
    }
  };

  return (
    <div id="content-to-pdf" className="w-full px-4 space-y-6">
      <style type="text/css" media="print">
        {`
          @page {
            size: portrait;
            margin: 20mm;
          }
          .scenario-content {
            max-width: 800px;
            margin: 0 auto;
          }
          .page-break {
            page-break-before: always;
          }
          table {
            page-break-inside: avoid;
            font-size: 12px;
          }
          .chart-container {
            page-break-inside: avoid;
            margin-bottom: 20px;
            height: 300px !important;
          }
        `}
      </style>
      {/* Global Toolbar with Save and View buttons */}
      <div className="flex justify-between items-center mb-6 p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Strategy Builder</h2>
          {strategy && strategy.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {strategy.length} component{strategy.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
      {displayResults && (
          <Button
            variant="destructive"
            onClick={clearLoadedScenario}
            className="flex items-center gap-2"
              size="sm"
          >
              <X className="h-4 w-4" />
            Clear Loaded Scenario
          </Button>
          )}
          <Button
            onClick={saveScenario}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!strategy || strategy.length === 0}
            size="sm"
          >
            <Save className="h-4 w-4" />
            Save Strategy
          </Button>
          <Button
            onClick={viewSavedScenarios}
            variant="outline"
            className="flex items-center gap-2"
            size="sm"
          >
            <Table className="h-4 w-4" />
            View Saved
          </Button>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="parameters" className="py-2.5 text-sm">Strategy Parameters</TabsTrigger>
          <TabsTrigger value="stress" className="py-2.5 text-sm">Stress Testing</TabsTrigger>
          <TabsTrigger value="backtest" className="py-2.5 text-sm">Historical Backtest</TabsTrigger>
          <TabsTrigger value="riskmatrix" className="py-2.5 text-sm">Risk Matrix</TabsTrigger>
          <TabsTrigger value="zerocost" className="py-2.5 text-sm">Zero-Cost Strategies</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parameters">
          <Card className="shadow-md">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-xl font-bold text-primary">Commodity Options Strategy Parameters</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Section 1: Use Real Data / Ticker Peek Pro (same as Pricers) */}
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={useRealData}
                      disabled={useTickerPeekPro}
                      onCheckedChange={(checked) => {
                        setUseRealData(checked);
                        try {
                          const savedState = localStorage.getItem('calculatorState');
                          const state = savedState ? JSON.parse(savedState) : {};
                          state.useRealData = checked;
                          localStorage.setItem('calculatorState', JSON.stringify(state));
                        } catch (error) { console.warn('Error saving useRealData:', error); }
                      }}
                    />
                    <label className="text-sm font-medium text-foreground cursor-pointer">
                      Use Real Data from Commodity Market
                    </label>
                  </div>
                  {useRealData && !useTickerPeekPro && (
                    <span className="text-xs text-muted-foreground">
                      {loadingRealCommodities ? 'Loading...' : `${realCommodities.length} commodities available`}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={useTickerPeekPro}
                      onCheckedChange={(checked) => {
                        setUseTickerPeekPro(checked);
                        if (checked) setUseRealData(false);
                      try {
                        const savedState = localStorage.getItem('calculatorState');
                        const state = savedState ? JSON.parse(savedState) : {};
                          state.useTickerPeekPro = checked;
                          state.useRealData = checked ? false : state.useRealData;
                        localStorage.setItem('calculatorState', JSON.stringify(state));
                        } catch (error) { console.warn('Error saving useTickerPeekPro:', error); }
                      }}
                    />
                    <label className="text-sm font-medium text-foreground cursor-pointer">
                      Use Data from Ticker Peek Pro
                    </label>
                  </div>
                  {useTickerPeekPro && (
                    <span className="text-xs text-muted-foreground">
                      {tppLoadingCurrencies ? 'Loading...' : `${tppCurrencies.length} commodities · Spot + IV from TPP`}
                    </span>
                  )}
                </div>
                {useRealData && !useTickerPeekPro && (
                  <p className="text-xs text-muted-foreground">Real-time prices from Commodity Market. Prices update when you select a commodity.</p>
                )}
                {useTickerPeekPro && (
                  <p className="text-xs text-muted-foreground">Cash price from Ticker Peek Pro futures and IV surface for volatility — same source as Pricers.</p>
                )}
              </div>

              {/* Section 1: Commodity & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Commodity</label>
                  <div className="relative">
                  <Select 
                    value={params.currencyPair?.symbol || (useTickerPeekPro && tppCurrencies.length > 0 ? tppCurrencies[0].symbol : useRealData && realCommodities.length > 0 ? realCommodities[0].symbol : CURRENCY_PAIRS[0].symbol)} 
                    onOpenChange={(open) => {
                      if (!open) setCommoditySearchQuery('');
                    }}
                    onValueChange={(value) => {
                      if (useTickerPeekPro && tppCurrencies.length > 0) {
                        const tppItem = tppCurrencies.find(c => c.symbol === value);
                        if (tppItem) {
                          const tppCategoryMap: Record<string, 'energy' | 'metals' | 'agriculture' | 'livestock' | 'majors' | 'crosses' | 'others'> = {
                            'energies': 'energy',
                            'metals': 'metals',
                            'grains': 'agriculture',
                            'livestock': 'livestock'
                          };
                          let resolvedCategory: 'energy' | 'metals' | 'agriculture' | 'livestock' | 'majors' | 'crosses' | 'others' = 'others';
                          for (const [cat, list] of Object.entries(tppCurrenciesByCategory)) {
                            if (list.some(c => c.symbol === value)) {
                              resolvedCategory = tppCategoryMap[cat] ?? 'others';
                              break;
                            }
                          }
                          const defaultSpot = typeof tppItem.last === 'number' ? tppItem.last : (typeof tppItem.last === 'string' ? parseFloat(String(tppItem.last).replace(/,/g, '')) : 0) || 0;
                          const currencyPair: CurrencyPair = {
                            symbol: tppItem.symbol,
                            name: tppItem.name || tppItem.symbol,
                            base: tppItem.symbol?.replace(/[^A-Za-z]/g, '') || 'USD',
                            quote: 'USD',
                            category: resolvedCategory,
                            defaultSpotRate: defaultSpot
                          };
                          setParams({ ...params, currencyPair, spotPrice: defaultSpot });
                          setInitialSpotPrice(defaultSpot);
                          toast({ title: "Commodity (Ticker Peek Pro)", description: `${tppItem.name || tppItem.symbol}: spot and IV will load from TPP.` });
                        }
                      } else if (useRealData && realCommodities.length > 0) {
                        const selectedCommodity = realCommodities.find(c => c.symbol === value);
                        if (selectedCommodity) {
                          const categoryMap: Record<CommodityCategory, 'energy' | 'metals' | 'agriculture' | 'livestock' | 'majors' | 'crosses' | 'others'> = {
                            'energy': 'energy',
                            'metals': 'metals',
                            'agricultural': 'agriculture',
                            'freight': 'others',
                            'bunker': 'others'
                          };
                          const currencyPair: CurrencyPair = {
                            symbol: selectedCommodity.symbol,
                            name: selectedCommodity.name,
                            base: getUnitFromCommodity(selectedCommodity),
                            quote: selectedCommodity.currency || 'USD',
                            category: categoryMap[selectedCommodity.category] || 'others',
                            defaultSpotRate: selectedCommodity.price
                          };
                          setParams({ ...params, currencyPair: currencyPair, spotPrice: selectedCommodity.price });
                          setInitialSpotPrice(selectedCommodity.price);
                          toast({ title: "Commodity Updated", description: `${selectedCommodity.name}: $${selectedCommodity.price.toFixed(2)} (${selectedCommodity.currency || 'USD'})` });
                        }
                      } else {
                        const filteredPairs = getFilteredDefaultCommodities();
                        const allPairs = [...filteredPairs, ...customCurrencyPairs];
                        const selectedPair = allPairs.find(pair => pair.symbol === value);
                      if (selectedPair) {
                          setParams({ ...params, currencyPair: selectedPair, spotPrice: selectedPair.defaultSpotRate });
                        setInitialSpotPrice(selectedPair.defaultSpotRate);
                        }
                      }
                    }}
                    disabled={(useRealData && loadingRealCommodities) || (useTickerPeekPro && tppLoadingCurrencies)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={useRealData && loadingRealCommodities ? "Loading commodities..." : useTickerPeekPro && tppLoadingCurrencies ? "Loading TPP..." : "Select commodity"} />
                    </SelectTrigger>
                    <SelectContent>
                      {useTickerPeekPro && tppCurrencies.length > 0 ? (
                        // Ticker Peek Pro currencies grouped by category
                        <>
                          {(Object.entries(tppCurrenciesByCategory) as [keyof typeof tppCurrenciesByCategory, TppCurrencyData[]][]).map(([cat, list]) => {
                            if (!list?.length) return null;
                            const labels: Record<string, string> = { energies: 'Energies', metals: 'Metals', grains: 'Grains', livestock: 'Livestock' };
                            return (
                              <Fragment key={cat}>
                                <SelectGroup>
                                  <SelectLabel>{labels[cat] || cat}</SelectLabel>
                                  {list.map((c) => (
                                    <SelectItem key={c.symbol} value={c.symbol}>
                                      {c.symbol} {c.name ? `· ${c.name}` : ''} {typeof c.last === 'number' ? `$${c.last}` : c.last ? `$${c.last}` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </Fragment>
                            );
                          })}
                        </>
                      ) : useRealData && realCommodities.length > 0 ? (
                        // Real commodities from Commodity Market
                        <>
                          {/* Search Input */}
                          <div className="p-2 border-b sticky top-0 bg-background z-10">
                            <Input
                              placeholder="Search by symbol or name..."
                              value={commoditySearchQuery}
                              onChange={(e) => setCommoditySearchQuery(e.target.value)}
                              className="h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          
                          {/* Filtered commodities by category */}
                          {(() => {
                            const searchLower = commoditySearchQuery.toLowerCase().trim();
                            const filteredEnergy = searchLower 
                              ? realCommodities.filter(c => 
                                  c.category === 'energy' && 
                                  (c.symbol.toLowerCase().includes(searchLower) || 
                                   c.name.toLowerCase().includes(searchLower))
                                )
                              : realCommodities.filter(c => c.category === 'energy');
                            const filteredMetals = searchLower
                              ? realCommodities.filter(c => 
                                  c.category === 'metals' && 
                                  (c.symbol.toLowerCase().includes(searchLower) || 
                                   c.name.toLowerCase().includes(searchLower))
                                )
                              : realCommodities.filter(c => c.category === 'metals');
                            const filteredAgricultural = searchLower
                              ? realCommodities.filter(c => 
                                  c.category === 'agricultural' && 
                                  (c.symbol.toLowerCase().includes(searchLower) || 
                                   c.name.toLowerCase().includes(searchLower))
                                )
                              : realCommodities.filter(c => c.category === 'agricultural');
                            const filteredFreight = searchLower
                              ? realCommodities.filter(c => 
                                  c.category === 'freight' && 
                                  (c.symbol.toLowerCase().includes(searchLower) || 
                                   c.name.toLowerCase().includes(searchLower))
                                )
                              : realCommodities.filter(c => c.category === 'freight');
                            const filteredBunker = searchLower
                              ? realCommodities.filter(c => 
                                  c.category === 'bunker' && 
                                  (c.symbol.toLowerCase().includes(searchLower) || 
                                   c.name.toLowerCase().includes(searchLower))
                                )
                              : realCommodities.filter(c => c.category === 'bunker');
                            
                            const hasResults = filteredEnergy.length > 0 || filteredMetals.length > 0 || 
                                              filteredAgricultural.length > 0 || filteredFreight.length > 0 || 
                                              filteredBunker.length > 0;
                            
                            if (searchLower && !hasResults) {
                              return (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  No commodities found matching "{commoditySearchQuery}"
                                </div>
                              );
                            }
                            
                            return (
                              <>
                                {filteredEnergy.length > 0 && (
                                  <>
                                    <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">⚡ Energy</div>
                                    {filteredEnergy.map(commodity => (
                                      <SelectItem key={commodity.symbol} value={commodity.symbol}>
                                        <div className="flex flex-col">
                                          <div className="flex justify-between items-center w-full">
                                            <span>{commodity.symbol}</span>
                                            <span className="text-xs text-muted-foreground font-mono">${commodity.price.toFixed(2)}</span>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{commodity.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                {filteredMetals.length > 0 && (
                                  <>
                                    <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">🔩 Metals</div>
                                    {filteredMetals.map(commodity => (
                                      <SelectItem key={commodity.symbol} value={commodity.symbol}>
                                        <div className="flex flex-col">
                                          <div className="flex justify-between items-center w-full">
                                            <span>{commodity.symbol}</span>
                                            <span className="text-xs text-muted-foreground font-mono">${commodity.price.toFixed(2)}</span>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{commodity.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                {filteredAgricultural.length > 0 && (
                                  <>
                                    <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">🌾 Agriculture</div>
                                    {filteredAgricultural.map(commodity => (
                                      <SelectItem key={commodity.symbol} value={commodity.symbol}>
                                        <div className="flex flex-col">
                                          <div className="flex justify-between items-center w-full">
                                            <span>{commodity.symbol}</span>
                                            <span className="text-xs text-muted-foreground font-mono">${commodity.price.toFixed(2)}</span>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{commodity.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                {filteredFreight.length > 0 && (
                                  <>
                                    <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">🚢 Freight</div>
                                    {filteredFreight.map(commodity => (
                                      <SelectItem key={commodity.symbol} value={commodity.symbol}>
                                        <div className="flex flex-col">
                                          <div className="flex justify-between items-center w-full">
                                            <span>{commodity.symbol}</span>
                                            <span className="text-xs text-muted-foreground font-mono">${commodity.price.toFixed(2)}</span>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{commodity.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                {filteredBunker.length > 0 && (
                                  <>
                                    <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">⛽ Bunker</div>
                                    {filteredBunker.map(commodity => (
                                      <SelectItem key={commodity.symbol} value={commodity.symbol}>
                                        <div className="flex flex-col">
                                          <div className="flex justify-between items-center w-full">
                                            <span>{commodity.symbol}</span>
                                            <span className="text-xs text-muted-foreground font-mono">${commodity.price.toFixed(2)}</span>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{commodity.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        // Default commodities list - filtered by selected domains
                        (() => {
                          const filteredPairs = getFilteredDefaultCommodities();
                          const energyPairs = filteredPairs.filter(pair => pair.category === 'energy');
                          const metalsPairs = filteredPairs.filter(pair => pair.category === 'metals');
                          const agriculturePairs = filteredPairs.filter(pair => pair.category === 'agriculture');
                          const livestockPairs = filteredPairs.filter(pair => pair.category === 'livestock');
                          
                          if (filteredPairs.length === 0) {
                            return (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No commodities available for selected domains.
                              </div>
                            );
                          }
                          
                          return (
                            <>
                              {energyPairs.length > 0 && (
                                <>
                      <div className="p-2 text-xs font-medium text-muted-foreground border-b">⚡ Energy</div>
                                  {energyPairs.map(pair => (
                        <SelectItem key={pair.symbol} value={pair.symbol}>
                          <div className="flex flex-col">
                            <div className="flex justify-between items-center w-full">
                              <span>{pair.symbol}</span>
                              <span className="text-xs text-muted-foreground font-mono">${pair.defaultSpotRate}/{pair.base}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{pair.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                                </>
                              )}
                              {metalsPairs.length > 0 && (
                                <>
                      <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">🔩 Metals</div>
                                  {metalsPairs.map(pair => (
                        <SelectItem key={pair.symbol} value={pair.symbol}>
                          <div className="flex flex-col">
                            <div className="flex justify-between items-center w-full">
                              <span>{pair.symbol}</span>
                              <span className="text-xs text-muted-foreground font-mono">${pair.defaultSpotRate}/{pair.base}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{pair.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                                </>
                              )}
                              {agriculturePairs.length > 0 && (
                                <>
                      <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">🌾 Agriculture</div>
                                  {agriculturePairs.map(pair => (
                        <SelectItem key={pair.symbol} value={pair.symbol}>
                          <div className="flex flex-col">
                            <div className="flex justify-between items-center w-full">
                              <span>{pair.symbol}</span>
                              <span className="text-xs text-muted-foreground font-mono">${pair.defaultSpotRate}/{pair.base}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{pair.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                                </>
                              )}
                              {livestockPairs.length > 0 && (
                                <>
                      <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">🐄 Livestock</div>
                                  {livestockPairs.map(pair => (
                        <SelectItem key={pair.symbol} value={pair.symbol}>
                          <div className="flex flex-col">
                            <div className="flex justify-between items-center w-full">
                              <span>{pair.symbol}</span>
                              <span className="text-xs text-muted-foreground font-mono">${pair.defaultSpotRate}/{pair.base}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{pair.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                                </>
                              )}
                        {customCurrencyPairs.length > 0 && (
                          <>
                            <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">✨ Custom Commodities</div>
                            {customCurrencyPairs.map(pair => (
                              <SelectItem key={pair.symbol} value={pair.symbol}>
                                <div className="flex flex-col">
                                  <div className="flex justify-between items-center w-full">
                                    <span>{pair.symbol}</span>
                                    <span className="text-xs text-muted-foreground font-mono">{pair.defaultSpotRate}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{pair.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                              )}
                            </>
                          );
                        })()
                        )}
                        
                        <div className="p-2 border-t mt-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full">
                                <PlusCircle className="h-3 w-3 mr-1" /> Add Custom Commodity
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add Custom Commodity</DialogTitle>
                                <DialogDescription>
                                  Enter the details of your custom commodity.
                                </DialogDescription>
                              </DialogHeader>
                              
                              <form onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const symbol = formData.get('symbol') as string;
                                const name = formData.get('name') as string;
                                const base = formData.get('base') as string;
                                const quote = formData.get('quote') as string;
                                const defaultSpotRate = parseFloat(formData.get('defaultSpotRate') as string);
                                
                                // Validation
                                if (!symbol || !name || !base || !quote || isNaN(defaultSpotRate)) {
                                  toast({
                                    title: "Validation Error",
                                    description: "All fields are required and spot rate must be a valid number.",
                                  });
                                  return;
                                }
                                
                                // Check if pair already exists
                                const allPairs = [...CURRENCY_PAIRS, ...customCurrencyPairs];
                                if (allPairs.some(pair => pair.symbol === symbol)) {
                                  toast({
                                    title: "Pair Already Exists",
                                    description: `Commodity ${symbol} already exists.`,
                                  });
                                  return;
                                }
                                
                                const newPair: CurrencyPair = {
                                  symbol,
                                  name,
                                  base,
                                  quote,
                                  category: 'others',
                                  defaultSpotRate
                                };
                                
                                addCustomCurrencyPair(newPair);
                                
                                toast({
                                  title: "Success",
                                  description: `Commodity ${symbol} added successfully.`,
                                });
                                
                                // Reset form and close dialog
                                e.currentTarget.reset();
                                (document.querySelector('[data-state="open"]') as HTMLElement)?.click();
                                
                                // Optionally select the new pair
                                setParams({
                                  ...params,
                                  currencyPair: newPair,
                                  spotPrice: newPair.defaultSpotRate
                                });
                                setInitialSpotPrice(newPair.defaultSpotRate);
                              }}>
                                <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="symbol" className="text-right">Symbol</Label>
                                    <Input id="symbol" name="symbol" placeholder="WTI, GOLD, CORN" className="col-span-3" />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Name</Label>
                                    <Input id="name" name="name" placeholder="WTI Crude Oil" className="col-span-3" />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="base" className="text-right">Unit of Measure</Label>
                                    <div className="col-span-3">
                                      <Input id="base" name="base" placeholder="BBL, OZ, MT, BU, LB, MMBtu" className="w-full" />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Standard market unit (e.g., BBL for oil, OZ for gold, BU for grains)
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="quote" className="text-right">Currency</Label>
                                    <Input id="quote" name="quote" placeholder="USD" className="col-span-3" />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="defaultSpotRate" className="text-right">Default Spot Price</Label>
                                    <Input id="defaultSpotRate" name="defaultSpotRate" placeholder="75.50" type="number" step="0.01" className="col-span-3" />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button type="submit">Add Commodity</Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>
                    </SelectContent>
                  </Select>
                    
                    {customCurrencyPairs.length > 0 && params.currencyPair && customCurrencyPairs.some(pair => pair.symbol === params.currencyPair?.symbol) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6"
                        onClick={() => {
                          const filtered = customCurrencyPairs.filter(pair => pair.symbol !== params.currencyPair?.symbol);
                          saveCustomCurrencyPairs(filtered);
                          
                          // Sélectionner EUR/USD par défaut si la paire supprimée était sélectionnée
                          if (filtered.length === 0 || !filtered.some(pair => pair.symbol === params.currencyPair?.symbol)) {
                            setParams({
                              ...params,
                              currencyPair: CURRENCY_PAIRS[0],
                              spotPrice: CURRENCY_PAIRS[0].defaultSpotRate
                            });
                            setInitialSpotPrice(CURRENCY_PAIRS[0].defaultSpotRate);
                          }
                          
                          toast({
                            title: "Commodity Removed",
                            description: `Commodity ${params.currencyPair?.symbol} has been removed.`,
                          });
                        }}
                        title="Remove custom commodity"
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Strategy Start Date</label>
                  <Input
                    type="date"
                    value={params.strategyStartDate}
                    onChange={(e) => setParams({...params, strategyStartDate: e.target.value})}
                    className="h-9"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Hedging Start Date</label>
                  <Input
                    type="date"
                    value={params.startDate}
                    onChange={(e) => setParams({...params, startDate: e.target.value})}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Section 2: Hedging Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg border">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground flex items-center justify-between">
                    <span>Months to Hedge</span>
                    <span className="text-xs text-muted-foreground font-mono">{params.monthsToHedge} months</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Slider 
                      value={[params.monthsToHedge]} 
                      min={1} 
                      max={36} 
                      step={1}
                      onValueChange={(value) => setParams({...params, monthsToHedge: value[0]})}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={params.monthsToHedge}
                      onChange={(e) => setParams({...params, monthsToHedge: Number(e.target.value)})}
                      className="w-16 h-8 text-center text-sm"
                      min={1}
                      max={36}
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <span>Risk-free Rate (r) %</span>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                              {isCurveMode 
                                ? `Mode Courbe: Taux interpolé depuis la courbe bootstrappée pour ${params.monthsToHedge} mois.`
                                : `Mode Fixe: Bank Rate ${getSelectedCurrency} depuis Settings.`}
                            </p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                      <Badge 
                        variant={isCurveMode ? "default" : "secondary"} 
                        className="text-[10px] px-1.5 py-0"
                      >
                        {isCurveMode ? "Curve" : "Bank Rate"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{(params.interestRate || 0).toFixed(2)}%</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Slider 
                      value={[params.interestRate]} 
                      min={0} 
                      max={15} 
                      step={0.1}
                      onValueChange={(value) => setParams({...params, interestRate: value[0]})}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={params.interestRate}
                      onChange={(e) => setParams({...params, interestRate: Number(e.target.value)})}
                      className="w-14 h-8 text-center text-sm"
                      min={0}
                      max={15}
                      step={0.1}
                    />
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const newRate = getInterestRateForStrategy;
                              setParams({...params, interestRate: newRate});
                              toast({
                                title: "Rate Updated",
                                description: `Rate set to ${newRate.toFixed(2)}% (${isCurveMode ? 'Curve' : 'Bank Rate'} - ${getSelectedCurrency})`,
                              });
                            }}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reset to market rate ({getInterestRateForStrategy.toFixed(2)}%)</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {getSelectedCurrency} • {isCurveMode ? `Maturité: ${(params.monthsToHedge / 12).toFixed(1)}Y` : "Bank Rate"}
                  </p>
                </div>
              </div>

              {/* Section 3: Volume, Position, Spot Price & Price Differential */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Commodity Volume */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Commodity Volume (Units)</label>
                  <Input
                    type="number"
                    value={params.totalVolume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="h-9"
                    placeholder="Enter volume"
                  />
                </div>

                {/* Position Type */}
                 <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Position Type</label>
                  <Select
                    value={params.volumeType}
                    onValueChange={(value: 'long' | 'short') => 
                      setParams(prev => ({ ...prev, volumeType: value }))
                    }
                  >
                     <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select position type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">📈</span>
                          <span>Long Position</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="short">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600">📉</span>
                          <span>Short Position</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                   <div className="text-xs text-muted-foreground">
                    {params.volumeType === 'long' || params.volumeType === 'receivable' ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <span>📈</span>
                        <span>You own or will buy the commodity</span>
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <span>📉</span>
                        <span>You need to deliver or sell the commodity</span>
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Spot Price */}
                 <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Spot Price {params.currencyPair?.symbol && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        ({params.currencyPair.symbol})
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={params.spotPrice}
                      onChange={(e) => handleSpotPriceChange(Number(e.target.value))}
                       className="h-9 text-sm font-mono flex-1"
                      step="0.0001"
                      placeholder={`${params.currencyPair?.defaultSpotRate || 1.0850}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (params.currencyPair) {
                          setParams({...params, spotPrice: params.currencyPair.defaultSpotRate});
                          setInitialSpotPrice(params.currencyPair.defaultSpotRate);
                        }
                      }}
                       className="h-9 px-2 whitespace-nowrap text-xs"
                      title="Reset to default market rate"
                    >
                      Reset
                    </Button>
                  </div>
                   <div className="text-xs text-muted-foreground flex items-center gap-1 bg-primary/5 px-2 py-1 rounded border border-primary/10">
                    <span>💱</span>
                     <span>Current: <span className="font-mono font-medium">${(params.spotPrice || 0).toFixed(2)}</span></span>
                    {params.currencyPair?.base && (
                      <span className="text-muted-foreground">/{params.currencyPair.base}</span>
                    )}
                  </div>
                </div>

                 {/* Price Differential */}
                 <div className="space-y-1">
                   <label className="text-sm font-medium text-foreground">
                     Price Differential (Basis)
                     <span className="ml-1 text-xs text-muted-foreground font-normal">
                       ({params.currencyPair?.quote || 'USD'})
                     </span>
                   </label>
                   <Input
                     type="number"
                     value={params.priceDifferential || 0}
                     onChange={(e) => setParams({...params, priceDifferential: Number(e.target.value) || 0})}
                     className="h-9 text-sm font-mono"
                     step="0.01"
                     placeholder="0.00"
                   />
                   <div className="text-xs text-muted-foreground flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
                     <span>📊</span>
                     <span>Effective: <span className="font-mono font-medium">${((params.spotPrice || 0) + (params.priceDifferential || 0)).toFixed(2)}</span></span>
                     {params.currencyPair?.base && (
                       <span className="text-muted-foreground">/{params.currencyPair.base}</span>
                     )}
                   </div>
                   <div className="text-xs text-muted-foreground">
                     <span className="font-medium">ℹ️</span> Applied only to costs
                  </div>
                </div>
              </div>

              {/* Custom Periods - Compact Toggle */}
              <div>
                <div className="bg-muted/20 p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={params.useCustomPeriods}
                    onCheckedChange={toggleCustomPeriods}
                    id="useCustomPeriods"
                  />
                    <label htmlFor="useCustomPeriods" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Calendar size={16} />
                    Use Custom Periods Instead of Monthly Hedging
                  </label>
                  </div>
                </div>
                
                {params.useCustomPeriods && (
                  <div className="mt-4 pl-8">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-medium text-foreground/90">Custom Hedging Periods</h4>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={addCustomPeriod}
                        className="flex items-center gap-1 h-8 px-2 text-xs"
                      >
                        <Plus size={14} /> Add Period
                      </Button>
                    </div>
                    
                    {params.customPeriods.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No custom periods defined. Click "Add Period" to create one.</p>
                    ) : (
                      <div className="space-y-2">
                        {params.customPeriods.map((period, index) => (
                          <div key={index} className="grid grid-cols-5 gap-2 items-center p-2 rounded-md bg-muted/50">
                            <div className="col-span-2">
                              <label className="compact-label">Maturity Date</label>
                              <Input
                                type="date"
                                value={period.maturityDate}
                                onChange={(e) => updateCustomPeriod(index, 'maturityDate', e.target.value)}
                                className="compact-input"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="compact-label">Volume</label>
                              <Input
                                type="number"
                                value={period.volume}
                                onChange={(e) => updateCustomPeriod(index, 'volume', Number(e.target.value))}
                                className="compact-input"
                              />
                            </div>
                            <div className="flex items-end justify-end">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeCustomPeriod(index)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                              >
                                <Trash size={14} />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        <div className="mt-2 text-xs text-muted-foreground">
                          Total Volume: {params.customPeriods.reduce((sum, p) => sum + p.volume, 0).toLocaleString()}
                        </div>
                        
                        {Math.abs(params.customPeriods.reduce((sum, p) => sum + p.volume, 0) - params.totalVolume) > 0.01 && (
                          <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            <span>The sum of custom periods volumes ({params.customPeriods.reduce((sum, p) => sum + p.volume, 0).toLocaleString()}) 
                            differs from the total volume ({params.totalVolume.toLocaleString()}).</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pricing Configuration - Compact Layout */}
              <div className="mt-3 space-y-4">
                {/* Real Price Simulation & Option Pricing Model - Combined Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Real Price Simulation */}
                  <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                      <BarChart3 size={16} />
                      Real Price Simulation
                    </h4>
                  <div className="flex items-center gap-2">
                    <Switch
                    checked={realPriceParams.useSimulation}
                      onCheckedChange={(checked) => setRealPriceParams(prev => ({...prev, useSimulation: checked}))}
                      id="useMonteCarloSimulation"
                  />
                      <label htmlFor="useMonteCarloSimulation" className="text-xs font-medium cursor-pointer">
                      Use Monte Carlo Simulation for Real Prices
                    </label>
                </div>
                  
                  {realPriceParams.useSimulation && (
                      <div className="pt-2 border-t border-border/50">
                        <label className="text-xs text-muted-foreground mb-1 block">Price Path Simulations</label>
                      <div className="flex items-center gap-2">
                        <Slider 
                          value={[realPriceParams.numSimulations]} 
                          min={100} 
                          max={10000} 
                          step={100}
                          onValueChange={(value) => setRealPriceParams(prev => ({...prev, numSimulations: value[0]}))}
                          className="flex-1"
                        />
                  <Input
                    type="number"
                    value={realPriceParams.numSimulations}
                    onChange={(e) => setRealPriceParams(prev => ({...prev, numSimulations: Number(e.target.value)}))}
                    min="100"
                    max="10000"
                    step="100"
                            className="w-16 h-7 text-xs text-center"
                  />
                </div>
                    </div>
                  )}
              </div>
              
                  {/* Option Pricing Model */}
                  <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                      <Calculator size={16} />
                      Option Pricing Model
                    </h4>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Model Selection</label>
                  <Select 
                    value={optionPricingModel} 
                    onValueChange={(value: string) => setOptionPricingModel(value as 'black-scholes' | 'monte-carlo')}
                  >
                        <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select pricing model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="black-scholes">Black-Scholes</SelectItem>
                      <SelectItem value="monte-carlo">Monte Carlo Simulation</SelectItem>
                    </SelectContent>
                  </Select>
                    </div>
                </div>
              </div>

                {/* Barrier Option Pricing - Full Width Compact */}
                <div className="bg-muted/30 p-3 rounded-lg">
                  <h4 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
                    <Shield size={16} />
                    Barrier Option Pricing
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Simulations */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Number of Simulations</label>
                    <div className="flex items-center gap-2">
                      <Slider 
                        value={[barrierOptionSimulations]} 
                        min={100} 
                        max={10000} 
                        step={100}
                        onValueChange={(value) => setBarrierOptionSimulations(value[0])}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={barrierOptionSimulations}
                        onChange={(e) => setBarrierOptionSimulations(Number(e.target.value))}
                        min="100"
                        max="10000"
                        step="100"
                          className="w-16 h-7 text-xs text-center"
                      />
                    </div>
                  </div>
                  
                    {/* Pricing Method */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Pricing Method</label>
                    <Select 
                      value={barrierPricingModel} 
                      onValueChange={(value: string) => setBarrierPricingModel(value as 'monte-carlo' | 'closed-form')}
                    >
                        <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select barrier pricing method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monte-carlo">Monte Carlo Simulation</SelectItem>
                        <SelectItem value="closed-form">Closed-Form Approximation</SelectItem>
                      </SelectContent>
                    </Select>
                      <p className="text-xs text-muted-foreground">
                        Closed-form provides faster and more accurate pricing
                    </p>
                    </div>
                  </div>
                    </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md mt-4">
            <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-bold text-primary">Strategy Components</CardTitle>
              <div className="flex gap-2">
                <Button onClick={addOption} size="sm" className="h-8 px-3 text-sm flex items-center gap-1">
                  <Plus size={14} /> Add Option
                </Button>
                <Button onClick={addSwap} size="sm" variant="outline" className="h-8 px-3 text-sm flex items-center gap-1">
                  <Plus size={14} /> Add Swap
                </Button>
                <Button onClick={addForward} size="sm" variant="outline" className="h-8 px-3 text-sm flex items-center gap-1">
                  <Plus size={14} /> Add Forward
                </Button>
                {strategy.length > 0 && (
                  <Button onClick={importToHedgingInstruments} size="sm" variant="secondary" className="h-8 px-3 text-sm flex items-center gap-1">
                    <Upload size={14} /> Export to Hedging
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {strategy.map((component, index) => (
                  <div key={index} className="grid grid-cols-6 gap-4 items-center p-4 border rounded">
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={component.type}
                        onChange={(e) => updateOption(index, 'type', e.target.value)}
                        disabled={component.type === 'swap' || component.type === 'forward'}
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                        <option value="swap">Swap</option>
                        <option value="forward">Forward</option>
                        <option value="call-knockout">Call Knock-Out</option>
                        <option value="call-reverse-knockout">Call Reverse Knock-Out</option>
                        <option value="call-double-knockout">Call Double Knock-Out</option>
                        <option value="put-knockout">Put Knock-Out</option>
                        <option value="put-reverse-knockout">Put Reverse Knock-Out</option>
                        <option value="put-double-knockout">Put Double Knock-Out</option>
                        <option value="call-knockin">Call Knock-In</option>
                        <option value="call-reverse-knockin">Call Reverse Knock-In</option>
                        <option value="call-double-knockin">Call Double Knock-In</option>
                        <option value="put-knockin">Put Knock-In</option>
                        <option value="put-reverse-knockin">Put Reverse Knock-In</option>
                        <option value="put-double-knockin">Put Double Knock-In</option>
                        <option value="one-touch">One Touch (beta) </option>
                        <option value="double-touch">Double Touch (beta) </option>
                        <option value="no-touch">No Touch (beta)</option>
                        <option value="double-no-touch">Double No Touch (beta)</option>
                        <option value="range-binary">Range Binary (beta)</option>
                        <option value="outside-binary">Outside Binary (beta)</option>
                      </select>
                    </div>
                    {component.type === 'swap' ? (
                      <>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Swap Price</label>
                          <Input
                            type="number"
                            value={component.strike}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Quantity (%)</label>
                          <Input
                            type="number"
                            value={component.quantity}
                            onChange={(e) => updateOption(index, 'quantity', Number(e.target.value))}
                            min="0"
                            max="100"
                          />
                        </div>
                      </>
                    ) : component.type === 'forward' ? (
                      <>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Forward Rate</label>
                          <Input
                            type="number"
                            value={component.strike}
                            onChange={(e) => updateOption(index, 'strike', Number(e.target.value))}
                            step="0.0001"
                            placeholder="e.g., 1.0850"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Quantity (%)</label>
                          <Input
                            type="number"
                            value={component.quantity}
                            onChange={(e) => updateOption(index, 'quantity', Number(e.target.value))}
                            min="0"
                            max="100"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Strike</label>
                      <Input
                        type="number"
                            value={component.strike}
                        onChange={(e) => updateOption(index, 'strike', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Strike Type</label>
                      <select
                        className="w-full p-2 border rounded"
                            value={component.strikeType}
                        onChange={(e) => updateOption(index, 'strikeType', e.target.value)}
                      >
                        <option value="percent">Percentage</option>
                        <option value="absolute">Absolute</option>
                      </select>
                    </div>
                    
                    {/* Add barrier inputs for barrier option types */}
                    {component.type.includes('knockout') || component.type.includes('knockin') ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-1">Barrier</label>
                          <Input
                            type="number"
                            value={component.barrier || 0}
                            onChange={(e) => updateOption(index, 'barrier', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Barrier Type</label>
                          <select
                            className="w-full p-2 border rounded"
                            value={component.barrierType || 'percent'}
                            onChange={(e) => updateOption(index, 'barrierType', e.target.value)}
                          >
                            <option value="percent">Percentage</option>
                            <option value="absolute">Absolute</option>
                          </select>
                        </div>
                        
                        {/* For double barrier options */}
                        {component.type.includes('double') && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Second Barrier</label>
                            <Input
                              type="number"
                              value={component.secondBarrier || 0}
                              onChange={(e) => updateOption(index, 'secondBarrier', Number(e.target.value))}
                            />
                          </div>
                        )}
                      </>
                    ) : null}
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Volatility (%)</label>
                      <Input
                        type="number"
                            value={component.volatility}
                        onChange={(e) => updateOption(index, 'volatility', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity (%)</label>
                      <Input
                        type="number"
                            value={component.quantity}
                        onChange={(e) => updateOption(index, 'quantity', Number(e.target.value))}
                      />
                    </div>
                      </>
                    )}
                    {['one-touch','double-touch','no-touch','double-no-touch','range-binary','outside-binary'].includes(component.type) && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-1">Rebate (%)</label>
                          <Input
                            type="number"
                            value={component.rebate ?? 5}
                            onChange={e => updateOption(index, 'rebate', Number(e.target.value))}
                            min="0"
                            step="0.01"
                            placeholder="% du volume mensuel"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Barrier</label>
                          <Input
                            type="number"
                            value={component.barrier ?? 0}
                            onChange={e => updateOption(index, 'barrier', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Barrier Type</label>
                          <select
                            className="w-full p-2 border rounded"
                            value={component.barrierType || 'percent'}
                            onChange={e => updateOption(index, 'barrierType', e.target.value)}
                          >
                            <option value="percent">Percentage</option>
                            <option value="absolute">Absolute</option>
                          </select>
                        </div>
                        {['double-touch','double-no-touch','range-binary','outside-binary'].includes(component.type) && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Second Barrier</label>
                            <Input
                              type="number"
                              value={component.secondBarrier ?? 0}
                              onChange={e => updateOption(index, 'secondBarrier', Number(e.target.value))}
                            />
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-end">
                      <Button
                        variant="destructive"
                        onClick={() => removeOption(index)}
                        className="flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button onClick={calculateResults} className="w-full">
            Calculate Strategy Results
          </Button>
        </TabsContent>

        <TabsContent value="stress">
          <Card>
            <button
              onClick={() => toggleInputs('strategy')}
              className="w-full text-left bg-background rounded-md"
            >
              <div className="flex items-center justify-between p-3">
                <span className="font-medium">Strategy Components</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${showInputs['strategy'] ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {showInputs['strategy'] && (
            <div className="px-3 pb-3">
              <div className="space-y-4">
                {strategy.map((option, index) => (
                  <div key={index} className="grid grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={option.type}
                        onChange={(e) => updateOption(index, 'type', e.target.value)}
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                        <option value="swap">Swap</option>
                        <option value="forward">Forward</option>
                        <option value="call-knockout">Call Knock-Out</option>
                        <option value="call-reverse-knockout">Call Reverse Knock-Out</option>
                        <option value="call-double-knockout">Call Double Knock-Out</option>
                        <option value="put-knockout">Put Knock-Out</option>
                        <option value="put-reverse-knockout">Put Reverse Knock-Out</option>
                        <option value="put-double-knockout">Put Double Knock-Out</option>
                        <option value="call-knockin">Call Knock-In</option>
                        <option value="call-reverse-knockin">Call Reverse Knock-In</option>
                        <option value="call-double-knockin">Call Double Knock-In</option>
                        <option value="put-knockin">Put Knock-In</option>
                        <option value="put-reverse-knockin">Put Reverse Knock-In</option>
                        <option value="put-double-knockin">Put Double Knock-In</option>
                        <option value="one-touch">One Touch</option>
                        <option value="double-touch">Double Touch</option>
                        <option value="no-touch">No Touch</option>
                        <option value="double-no-touch">Double No Touch</option>
                        <option value="range-binary">Range Binary</option>
                        <option value="outside-binary">Outside Binary</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Strike</label>
                      <Input
                        type="number"
                        value={option.strike}
                        onChange={(e) => updateOption(index, 'strike', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Strike Type</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={option.strikeType}
                        onChange={(e) => updateOption(index, 'strikeType', e.target.value)}
                      >
                        <option value="percentage">Percentage</option>
                        <option value="absolute">Absolute</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Volatility (%)</label>
                      <Input
                        type="number"
                        value={option.volatility}
                        onChange={(e) => updateOption(index, 'volatility', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity (%)</label>
                      <Input
                        type="number"
                        value={option.quantity}
                        onChange={(e) => updateOption(index, 'quantity', Number(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stress Test Scenarios</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                      Test your strategy under different market conditions
                  </div>
                    <div className="flex gap-2">
                      <button
                        onClick={resetStressTest}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                        title="Reset to Base Case scenario"
                      >
                        🏠 Reset to Base
                      </button>
                  <button
                    onClick={() => {
                      // Clear localStorage and reload scenarios
                      localStorage.removeItem('calculatorState');
                      window.location.reload();
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    title="Reset and load all stress test scenarios"
                  >
                    🔄 Reset Scenarios
                  </button>
                    </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Scenarios count indicator */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-800 dark:text-blue-400">
                    📊 {Object.keys(stressTestScenarios).length} scenarios available
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {Object.values(stressTestScenarios).filter(s => s.isCustom).length} Custom | 
                    {Object.values(stressTestScenarios).filter(s => !s.isCustom).length} Predefined
                  </span>
                </div>
              </div>
              
              {/* Active scenario indicator */}
              {activeStressTest && stressTestScenarios[activeStressTest] && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-700 dark:text-green-400">✓ Active Scenario:</span>
                    <span className="text-green-800 dark:text-green-300">{stressTestScenarios[activeStressTest].name}</span>
                    <span className="text-green-600 dark:text-green-400 text-sm">
                      (Vol: {((stressTestScenarios[activeStressTest]?.volatility || 0) * 100).toFixed(1)}%, 
                      Shock: {((stressTestScenarios[activeStressTest]?.priceShock || 0) * 100).toFixed(1)}%, 
                      Drift: {((stressTestScenarios[activeStressTest]?.drift || 0) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
              
              {/* Display scenarios in 3x3 grid */}
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(stressTestScenarios).map(([key, scenario]) => (
                          <Card key={key} className={`p-4 transition-all duration-200 ${activeStressTest === key ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'bg-background hover:shadow-md'}`}>
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-medium text-sm">{scenario.name}</h5>
                            {scenario.isCustom && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400">
                                Custom
                                      </span>
                                    )}
                                  </div>
                          <p className="text-xs text-muted-foreground mb-2">{scenario.description}</p>
                                </div>
                              </div>
                              
                      {/* Scenario parameters */}
                      <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Volatility:</span>
                            <span className="ml-1 font-medium">{((scenario.volatility || 0) * 100).toFixed(1)}%</span>
                                </div>
                          <div>
                            <span className="text-muted-foreground">Drift:</span>
                            <span className="ml-1 font-medium">{(scenario.drift * 100).toFixed(1)}%</span>
                                  </div>
                          <div>
                            <span className="text-muted-foreground">Price Shock:</span>
                            <span className="ml-1 font-medium">{(scenario.priceShock * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Forward Basis:</span>
                            <span className="ml-1 font-medium">{(scenario.forwardBasis * 100).toFixed(1)}%</span>
                          </div>
                                </div>
                              </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                              <Button
                                size="sm"
                          variant={activeStressTest === key ? "default" : "outline"}
                          onClick={() => applyStressTest(key)}
                          className="flex-1 text-xs"
                        >
                          {activeStressTest === key ? "✓ Applied" : "Apply"}
                              </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleInputs(key)}
                          className="text-xs"
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform ${showInputs[key] ? 'rotate-180' : ''}`} />
                        </Button>
                      </div>
                      
                      {/* Editable inputs */}
                      {showInputs[key] && scenario.isEditable && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="text-xs text-muted-foreground">Volatility (%)</label>
                            <Input
                              type="number"
                                step="0.01"
                                value={scenario.volatility * 100}
                                onChange={(e) => updateScenario(key, 'volatility', parseFloat(e.target.value) / 100)}
                                        className="h-7 text-xs"
                            />
                          </div>
                          <div>
                              <label className="text-xs text-muted-foreground">Drift (%)</label>
                            <Input
                              type="number"
                                step="0.01"
                                value={scenario.drift * 100}
                                onChange={(e) => updateScenario(key, 'drift', parseFloat(e.target.value) / 100)}
                                className="h-7 text-xs"
                            />
                          </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Price Shock (%)</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={scenario.priceShock * 100}
                                onChange={(e) => updateScenario(key, 'priceShock', parseFloat(e.target.value) / 100)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Forward Basis (%)</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={scenario.forwardBasis * 100}
                                onChange={(e) => updateScenario(key, 'forwardBasis', parseFloat(e.target.value) / 100)}
                                className="h-7 text-xs"
                              />
                        </div>
                                  </div>
                      </div>
                    )}
                            </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backtest">
          <Card>
            <CardHeader>
              <CardTitle>Historical Data Backtest</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                    <Button 
                  variant={showHistoricalData ? "outline" : "default"}
                      onClick={() => setShowHistoricalData(!showHistoricalData)}
                    >
                      {showHistoricalData ? 'Hide' : 'Show'} Historical Data
                    </Button>
                    <Button 
                  variant={showMonthlyStats ? "outline" : "default"}
                      onClick={() => setShowMonthlyStats(!showMonthlyStats)}
                    >
                      {showMonthlyStats ? 'Hide' : 'Show'} Monthly Statistics
                    </Button>
                <div className="flex-grow" />
                <Button onClick={addHistoricalDataRow}>
                  <Plus className="w-4 h-4 mr-2" /> Add Row
                    </Button>
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <Select value={csvFormat} onValueChange={(value) => setCsvFormat(value as 'english' | 'french')}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="CSV Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English (Point .)</SelectItem>
                      <SelectItem value="french">French (Comma ,)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button onClick={importHistoricalData} className="flex-grow sm:flex-grow-0">
                  Import Historical Data
                    </Button>
                </div>
                <Button variant="destructive" onClick={clearHistoricalData}>
                  Clear Data
                    </Button>
                </div>
                
                {showHistoricalData && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border p-2 bg-muted">Date</th>
                          <th className="border p-2 bg-muted">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalData.map((point, index) => (
                          <tr key={index}>
                            <td className="border p-2">{point.date}</td>
                            <td className="border p-2">{point.price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {showMonthlyStats && monthlyStats.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Monthly Statistics</h3>
                  <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border p-2 bg-muted">Month</th>
                          <th className="border p-2 bg-muted">Average Price</th>
                          <th className="border p-2 bg-muted">Historical Volatility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyStats.map((stat, index) => (
                          <tr key={index}>
                            <td className="border p-2">{stat.month}</td>
                            <td className="border p-2">{stat.avgPrice.toFixed(2)}</td>
                            <td className="border p-2">
                              {stat.volatility ? `${(stat.volatility * 100).toFixed(2)}%` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
          
          {displayResults && (
            <div>
              {/* Affichage des résultats... */}
              
              {/* Ajouter ces boutons ici si nécessaire */}
              <div className="mt-6 flex flex-col md:flex-row gap-3">
                <Button 
                  onClick={saveHistoricalBacktestResults} 
                  variant="outline"
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Backtest
                </Button>
                <Link to="/saved" className="flex-1">
                  <Button variant="secondary" className="w-full">
                    View Saved Scenarios
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="riskmatrix">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>FX Risk Matrix Generator</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {params.currencyPair?.symbol || 'Currency Pair'}
                  </span>
                  <button
                    onClick={updatePriceRangesForFX}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    title="Update price ranges for current FX pair"
                  >
                    🔄 Update FX Ranges
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium text-blue-800 dark:text-blue-400">Current Setup:</span> 
                  <span className="text-blue-700 dark:text-blue-300"> {params.currencyPair?.symbol} @ {params.spotPrice.toFixed(4)}</span>
                  <span className="text-blue-600 dark:text-blue-400 ml-2">
                    (Ranges auto-generated based on {params.currencyPair?.category} pair volatility)
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">FX Rate Ranges</h3>
                    <span className="text-sm text-muted-foreground">
                      ({params.currencyPair?.quote || 'Quote Currency'} per {params.currencyPair?.base || 'Base Currency'})
                    </span>
                  </div>
                  <div className="space-y-4">
                    {priceRanges.map((range, index) => (
                      <div key={index} className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Min</Label>
                          <Input 
                            type="number" 
                            value={range.min}
                            onChange={(e) => updatePriceRange(index, 'min', Number(e.target.value))}
                          />
              </div>
                        <div>
                          <Label>Max</Label>
                          <Input 
                            type="number" 
                            value={range.max}
                            onChange={(e) => updatePriceRange(index, 'max', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label>Probability (%)</Label>
                          <Input 
                            type="number" 
                            value={range.probability}
                            onChange={(e) => updatePriceRange(index, 'probability', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <Button
                        onClick={() => setPriceRanges([...priceRanges, { min: 0, max: 0, probability: 0 }])}
                        size="sm"
                      >
                        Add Range
                      </Button>
                      <Button
                        onClick={() => setPriceRanges(priceRanges.slice(0, -1))}
                        variant="destructive"
                        size="sm"
                        disabled={priceRanges.length <= 1}
                      >
                        Remove Last
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Strategies</h3>
                  <div className="space-y-4">
                    {matrixStrategies.map((strat, index) => (
                      <div key={index} className="p-4 border rounded-md">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium">{strat.name}</h4>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeMatrixStrategy(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <Label>Coverage Ratio (%)</Label>
                          <div className="flex items-center gap-4">
                            <Slider
                              value={[strat.coverageRatio]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={(value) => handleCoverageRatioChange(index, value[0])}
                              className="flex-1"
                            />
                            <span className="w-12 text-right">{strat.coverageRatio}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={addMatrixStrategy}
                      className="w-full"
                      disabled={strategy.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Current Strategy
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={generateRiskMatrix} className="w-full">
                  Generate Risk Matrix
                </Button>
                <Button 
                  onClick={toggleCoverageVariations} 
                  className="w-full"
                  variant="outline"
                >
                  {showCoverageVariations ? "Show Original View" : "Show Coverage Variations"}
                </Button>
                <Button 
                  onClick={clearAllStrategies} 
                  className="w-full"
                  variant="destructive"
                >
                  Clear Strategies
                </Button>
                {riskMatrixResults.length > 0 && (
                  <>
                    <Button 
                      onClick={saveRiskMatrix} 
                      className="w-full"
                      variant="outline"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Risk Matrix
                    </Button>
                    <Button 
                      onClick={exportRiskMatrixToPDF} 
                      className="w-full"
                      variant="outline"
                    >
                      Export as PDF
                    </Button>
                  </>
                )}
              </div>

              {riskMatrixResults.length > 0 && (
                <div className="mt-8 overflow-x-auto">
                  <h3 className="text-lg font-semibold mb-4">Risk Matrix Results</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border p-2">Strategy</th>
                        <th className="border p-2">Coverage Ratio</th>
                        <th className="border p-2">Hedging Cost ({params.currencyPair?.base || 'Base Currency'})</th>
                        {priceRanges.map((range, i) => (
                          <th key={i} className="border p-2">{range.probability}%<br/>[{range.min.toFixed(4)}-{range.max.toFixed(4)}]</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {showCoverageVariations 
                        ? riskMatrixResults.flatMap((result, i) => {
                            const strategyName = result.name.replace(/\s\d+%$/, '');
                            const ratios = [25, 50, 75, 100];
                            
                            return ratios.map((ratio) => (
                              <tr key={`${i}-${ratio}`}>
                                <td className="border p-2">{strategyName}</td>
                                <td className="border p-2">{ratio}%</td>
                                <td className="border p-2">{((result.hedgingCost / result.coverageRatio) * ratio).toFixed(2)}</td>
                                
                                {priceRanges.map((range, j) => {
                                  const rangeKey = `${range.min},${range.max}`;
                                  // Ajuster la valeur en fonction du ratio
                                  const adjustedValue = (result.differences[rangeKey] / result.coverageRatio) * ratio;
                                  
                                  return (
                                    <td 
                                      key={j} 
                                      className="border p-2"
                                      style={{ backgroundColor: getCellColor(adjustedValue) }}
                                    >
                                      {adjustedValue.toFixed(2)}
                          </td>
                                  );
                                })}
                              </tr>
                            ));
                          })
                        : riskMatrixResults.map((result, i) => (
                            <tr key={i}>
                              <td className="border p-2">{result.name}</td>
                          <td className="border p-2">{result.coverageRatio}%</td>
                              <td className="border p-2">{result.hedgingCost.toFixed(2)}</td>
                              
                          {priceRanges.map((range, j) => {
                            const rangeKey = `${range.min},${range.max}`;
                            return (
                              <td 
                                key={j} 
                                className="border p-2"
                                style={{ backgroundColor: getCellColor(result.differences[rangeKey]) }}
                              >
                                {result.differences[rangeKey].toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                          ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zerocost">
          <ZeroCostTab 
            spotPrice={params.spotPrice}
            setStrategy={setStrategy}
            calculatePayoff={calculatePayoff}
            monthsToHedge={params.monthsToHedge}
            interestRate={params.interestRate}
            optionPricingModel={optionPricingModel === 'monte-carlo' ? 'monte-carlo' : 'black-scholes'}
          />
        </TabsContent>
      </Tabs>

      {displayResults && (
        <div className="mt-6">
          <Tabs value={activeResultsTab} onValueChange={setActiveResultsTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 mb-6">
              <TabsTrigger value="detailed" className="text-xs">Detailed Results</TabsTrigger>
              <TabsTrigger value="pnl-evolution" className="text-xs">P&L Evolution</TabsTrigger>
              <TabsTrigger value="fx-rates" className="text-xs">Forward vs Real Price</TabsTrigger>
              <TabsTrigger value="hedging-profile" className="text-xs">Hedging Profile</TabsTrigger>
              <TabsTrigger value="monte-carlo" className="text-xs">Monte Carlo</TabsTrigger>
              <TabsTrigger value="yearly-stats" className="text-xs">Yearly Statistics</TabsTrigger>
              <TabsTrigger value="total-stats" className="text-xs">Total Statistics</TabsTrigger>
              <TabsTrigger value="monthly-breakdown" className="text-xs">Monthly Breakdown</TabsTrigger>
            </TabsList>

            <TabsContent value="detailed">
              <Card className="shadow-lg border border-border/40 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-3 border-b">
                  <CardTitle className="text-xl font-bold text-primary flex items-center gap-2">
                    <Table className="h-5 w-5" />
                    Detailed Results
                  </CardTitle>
                </CardHeader>
            <CardContent className="p-0">
              {displayResults.length > 0 && (
                <div>
                  <div className="flex items-center p-4 bg-muted/30">
                    <div className="flex items-center">
                      <Switch
                      id="useCustomPrices"
                      checked={useCustomOptionPrices}
                      onCheckedChange={handleUseCustomPricesToggle}
                      className="mr-2"
                    />
                      <label htmlFor="useCustomPrices" className="text-sm font-medium cursor-pointer">
                      Use my own prices
                    </label>
                  </div>
                  
                    <div className="ml-4 flex items-center">
                      <Switch
                        id="useImpliedVolUI"
                        checked={useImpliedVol}
                        onCheckedChange={handleUseImpliedVolToggle}
                        className="mr-2"
                      />
                      <label htmlFor="useImpliedVolUI" className="text-sm font-medium cursor-pointer">
                        Use Implied Volatility
                      </label>
                      {useCustomOptionPrices && useImpliedVol && (
                        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full ml-2">
                          Auto-calcul
                        </span>
                      )}
                    </div>
                    <div className="ml-4 flex items-center">
                      <Switch
                        id="useRealInterestRateUI"
                        checked={useRealInterestRate}
                        onCheckedChange={handleUseRealInterestRateToggle}
                        className="mr-2"
                      />
                      <label htmlFor="useRealInterestRateUI" className="text-sm font-medium cursor-pointer">
                        Use real interest rate
                      </label>
                    </div>
                    {useTickerPeekPro && params.currencyPair?.symbol && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        disabled={tppLoadingFutures || tppLoadingSurface}
                        onClick={handleTppDetailedUpdate}
                      >
                        {(tppLoadingFutures || tppLoadingSurface) ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Update
                      </Button>
                    )}
                  </div>
                  
                  <div className="custom-scrollbar">
                    <table className="w-full">
                  <thead>
                        <tr className="bg-muted/50 text-xs uppercase tracking-wider">
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b">Maturity</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b">Time to Maturity</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-blue-500/5">
                            Forward Price
                            <div className="text-xs font-normal text-muted-foreground mt-1">Theoretical forward price</div>
                          </th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-primary/5">
                            Real Price
                            <div className="text-xs font-normal text-muted-foreground mt-1">Monthly realized price</div>
                          </th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-purple-500/5">
                            Real rate (%)
                            <div className="text-xs font-normal text-muted-foreground mt-1">Rate used for this maturity</div>
                          </th>
                          
                          {/* Ajouter des colonnes pour les strikes dynamiques si présents */}
                          {strategy.some(opt => opt.dynamicStrike) && displayResults && displayResults.length > 0 && 
                            strategy.map((opt, idx) => 
                              opt.dynamicStrike ? (
                                <th key={`dyn-strike-${idx}`} className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-yellow-500/10">
                                  {opt.type.includes('put') ? 'Put' : 'Call'} Strike {idx + 1}
                                </th>
                              ) : null
                            )
                          }
                          
                      {useImpliedVol && results[0].optionPrices.map((opt, i) => (
                        opt.type !== 'swap' && (
                          <th key={`iv-header-${i}`} className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-amber-500/5">
                            IV {opt.label} (%)
                          </th>
                        )
                      ))}
                      {displayResults[0].optionPrices.map((opt, i) => (
                            <th key={`opt-header-${i}`} className="px-3 py-3 text-left font-medium text-foreground/70 border-b">{opt.label}</th>
                          ))}
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-green-500/5">Strategy Price</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-purple-500/5">Strategy Payoff</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b">Volume</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-green-500/5">Hedged Cost</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-red-500/5">Unhedged Cost</th>
                          <th className="px-3 py-3 text-left font-medium text-foreground/70 border-b bg-indigo-500/5">Delta P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayResults.map((row, i) => {
                      const date = new Date(row.date);
                      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                          const isEven = i % 2 === 0;
                          
                          const getPnLColor = (value: number) => {
                            if (value > 0) return 'text-green-600';
                            if (value < 0) return 'text-red-600';
                            return '';
  };

  return (
                            <tr key={i} className={`${isEven ? 'bg-muted/20' : 'bg-background'} hover:bg-muted/40 transition-colors`}>
                              <td className="px-3 py-2 text-sm border-b border-border/30">{row.date}</td>
                              <td className="px-3 py-2 text-sm border-b border-border/30">{row.timeToMaturity.toFixed(4)}</td>
                              <td className="px-3 py-2 text-sm border-b border-border/30 bg-blue-500/5">
                          <Input
                            type="number"
                              value={(() => {
                                const date = new Date(row.date);
                                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                                return manualForwards[monthKey] ? Number(manualForwards[monthKey]).toFixed(4) : row.forward.toFixed(4);
                              })()}
                            onChange={(e) => {
                                const date = new Date(row.date);
                                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                              const newValue = e.target.value === '' ? '' : Number(e.target.value);
                              setManualForwards(prev => ({
                                ...prev,
                                [monthKey]: newValue
                              }));
                              // Recalculate immediately when Forward Price changes
                              setTimeout(() => calculateResults(), 100);
                            }}
                            onBlur={() => calculateResults()}
                                  className="compact-input w-32 text-right"
                            step="0.01"
                          />
                        </td>
                              <td className="px-3 py-2 text-sm border-b border-border/30 bg-primary/5">
                          <Input
                            type="number"
                              value={(() => {
                                const date = new Date(row.date);
                                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                                return realPriceParams.useSimulation ? 
                              row.realPrice.toFixed(4) : 
                                  (realPrices[monthKey] ? Number(realPrices[monthKey]).toFixed(4) : row.forward.toFixed(4));
                              })()}
                            onChange={(e) => {
                                const date = new Date(row.date);
                                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                              const newValue = e.target.value === '' ? '' : Number(e.target.value);
                              setRealPrices(prev => ({
                                ...prev,
                                [monthKey]: newValue
                              }));
                            }}
                            onBlur={() => calculateResults()}
                                  className="compact-input w-32 text-right"
                            step="0.01"
                            disabled={realPriceParams.useSimulation}
                          />
                        </td>
                              <td className="px-3 py-2 text-sm border-b border-border/30 bg-purple-500/5 font-mono text-right">
                                {(row as { interestRate?: number }).interestRate != null
                                  ? `${(row as { interestRate: number }).interestRate.toFixed(3)}%`
                                  : params.interestRate.toFixed(3) + '%'}
                        </td>
                          {/* Ajouter des cellules pour les strikes dynamiques si présents */}
                          {strategy.some(opt => opt.dynamicStrike) && 
                            strategy.map((opt, idx) => {
                              if (!opt.dynamicStrike) return null;
                              
                              // Trouver l'option correspondante dans le résultat
                              const resultOption = row.optionPrices.find(
                                o => o.label.includes(opt.type.includes('put') ? 'Put' : 'Call') && 
                                     o.label.endsWith(`${idx + 1}`)
                              );
                              
                              // Afficher le strike dynamique si disponible
                              if (resultOption && resultOption.dynamicStrikeInfo) {
                                return (
                                  <td key={`dyn-strike-${idx}-${i}`} className="px-3 py-2 text-sm border-b border-border/30 bg-yellow-500/10 font-mono">
                                    {resultOption.strike.toFixed(4)}
                                    <br />
                                    <span className="text-xs text-muted-foreground">
                                      ({(resultOption.strike / row.forward * 100).toFixed(1)}%)
                                    </span>
                                  </td>
                                );
                              }
                              
                              // Fallback si les informations ne sont pas disponibles
                              return (
                                <td key={`dyn-strike-${idx}-${i}`} className="px-3 py-2 text-sm border-b border-border/30 bg-yellow-500/10">
                                  {resultOption ? resultOption.strike.toFixed(4) : '-'}
                                </td>
                              );
                            })
                          }
                          {useImpliedVol && results[0].optionPrices.map((opt, j) => (
                            opt.type !== 'swap' && (
                              <td key={`iv-${j}`} className="px-3 py-2 text-sm border-b border-border/30 bg-amber-500/5">
                              <div className="flex flex-col">
                              <Input
                                type="number"
                                  value={impliedVolatilities[monthKey]?.[`${opt.type}-${j}`] || ''}
                                  onChange={(e) => handleOptionImpliedVolChange(monthKey, `${opt.type}-${j}`, Number(e.target.value))}
                                  className="compact-input w-24"
                                placeholder="Enter IV"
                              />
                                {useCustomOptionPrices && impliedVolatilities[monthKey] && (
                                  <span className="text-xs text-amber-600 mt-1"></span>
                                )}
                              </div>
                            </td>
                            )
                          ))}
                          {/* Afficher les prix des options dans le même ordre que les en-têtes */}
                          {row.optionPrices.map((opt, j) => {
                            // Créer une clé unique pour cette option à cette date
                                  const date = new Date(row.date);
                                  const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                                  const optionKey = `${opt.type}-${j}`;
                                  
                                  // Récupérer le prix personnalisé s'il existe, ou utiliser le prix calculé
                                  const customPrice = 
                                    customOptionPrices[monthKey]?.[optionKey] !== undefined
                                      ? customOptionPrices[monthKey][optionKey]
                                      : opt.price;
                                  
                                  return (
                                    <td key={`option-${j}`} className="px-3 py-2 text-sm border-b border-border/30">
                                      {useCustomOptionPrices ? (
                                        <Input
                                          type="number"
                                          value={customPrice.toFixed(4)}
                                          onChange={(e) => {
                                            const newValue = e.target.value === '' ? 0 : Number(e.target.value);
                                            // Mettre à jour les prix personnalisés et calculer la volatilité implicite
                                            handleCustomPriceChange(monthKey, optionKey, newValue);
                                          }}
                                          onBlur={() => recalculateResults()}
                                          className="compact-input w-24 text-right"
                                          step="0.0001"
                                        />
                                      ) : (
                                        <span className="font-mono">{opt.price.toFixed(4)}</span>
                                      )}
                                    </td>
                                  );
                                })}
                              <td className="px-3 py-2 text-sm border-b border-border/30 bg-green-500/5 font-medium font-mono">{row.strategyPrice.toFixed(4)}</td>
                              <td className="px-3 py-2 text-sm border-b border-border/30 bg-purple-500/5 font-medium font-mono">{row.totalPayoff.toFixed(4)}</td>
                              <td className="px-3 py-2 text-sm border-b border-border/30">
                          <Input
                            type="number"
                            value={(() => {
                              const date = new Date(row.date);
                              const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                              return customVolumes[monthKey] || row.monthlyVolume;
                            })()}
                            onChange={(e) => {
                              const date = new Date(row.date);
                              const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                              const newValue = e.target.value === '' ? 0 : Number(e.target.value);
                              handleCustomVolumeChange(monthKey, newValue);
                            }}
                            onBlur={() => recalculateResults()}
                                  className="compact-input w-32 text-right"
                            step="1"
                          />
                        </td>
                              <td className="px-3 py-2 text-sm border-b border-border/30 bg-green-500/5 font-medium font-mono">{row.hedgedCost.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm border-b border-border/30 bg-red-500/5 font-medium font-mono">{row.unhedgedCost.toFixed(2)}</td>
                              <td className={`px-3 py-2 text-sm border-b border-border/30 bg-indigo-500/5 font-medium font-mono ${getPnLColor(row.deltaPnL)}`}>
                                {row.deltaPnL.toFixed(2)}
                              </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="pnl-evolution">
              <Card>
                <CardHeader>
                  <CardTitle>P&L Evolution</CardTitle>
                </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayResults}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="deltaPnL" name="Delta P&L" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="fx-rates">
              <Card>
                <CardHeader>
                  <CardTitle>Forward Price vs Real Price</CardTitle>
                  <CardDescription className="mt-2">
                    Real Price represents the monthly realized price for commodity transactions
                  </CardDescription>
                </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayResults}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="forward" 
                      name="Forward Price" 
                      stroke="#8884d8" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="realPrice"
                      name="Real Price (Monthly Realized)"
                      stroke="#82ca9d"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="hedging-profile">
              {(() => {
                // Génération des données de prix et grecques en fonction du spot
                const generatePriceData = () => {
                  if (!strategy || strategy.length === 0) return [];
                  
                  const currentSpot = params.spotPrice;
                  const spotRange = Array.from({length: 101}, (_, i) => currentSpot * (0.7 + i * 0.006)); // -30% à +30%
                  const r = strategyBuilderAnnualPercentToDecimal(params.interestRate);
                  const b = strategyBuilderAnnualPercentToDecimal(params.interestRate);
                  // Valeurs par défaut pour les modèles de pricing
                  const optionPricingModel = 'black-scholes' as 'black-scholes' | 'monte-carlo';
                  const barrierPricingModel = 'closed-form' as 'closed-form' | 'monte-carlo';
                  
                  return spotRange.map(spot => {
                    try {
                      // Calculer les grecques agrégées pour toute la stratégie
                      let totalDelta = 0;
                      let totalGamma = 0;
                      let totalTheta = 0;
                      let totalVega = 0;
                      let totalRho = 0;
                      let totalPrice = 0;
                      
                      strategy.forEach(option => {
                        // Calculer le strike selon le type
                        const strike = option.strikeType === 'percent' 
                          ? currentSpot * (option.strike / 100)
                          : option.strike;
                        
                        // Calculer les barrières selon le type
                        const barrier = option.barrier ? (
                          option.barrierType === 'percent'
                            ? currentSpot * (option.barrier / 100)
                            : option.barrier
                        ) : undefined;

                        const secondBarrier = option.secondBarrier ? (
                          option.barrierType === 'percent'
                            ? currentSpot * (option.secondBarrier / 100)
                            : option.secondBarrier
                        ) : undefined;

                        const S = spot; // Spot variable pour la courbe de sensibilité
                        const K = strike;
                        const t = params.monthsToHedge / 12; // Time to maturity en années
                        const sigma = option.volatility / 100;
                        const quantity = option.quantity / 100;
                        
                        let greeks;
                        let price = 0;
                        
                        if (option.type === 'forward') {
                          const forward = calculateCommodityForwardPrice(spot, b, t);
                          price = forward - strike;
                          greeks = { delta: 1, gamma: 0, theta: 0, vega: 0, rho: 0 };
                        } else if (option.type === 'swap') {
                          const forward = calculateCommodityForwardPrice(spot, b, t);
                          price = calculateSwapPrice([forward], [t], r);
                          greeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
                        } else if (option.type === 'call' || option.type === 'put') {
                          // Options vanilles
                          if (optionPricingModel === 'monte-carlo') {
                            price = calculateVanillaOptionMonteCarlo(
                              option.type,
                              S,
                              K,
                              r,
                              b,
                              t,
                              sigma,
                              1000
                            );
                          } else {
                            price = calculateBlackScholesSpotPrice(option.type, S, K, r, t, sigma);
                          }
                          greeks = calculateGreeks(option.type, S, K, r, b, t, sigma);
                        } else if (option.type.includes('knockout') || option.type.includes('knockin')) {
                          // Options barrières
                          if (barrierPricingModel === 'closed-form') {
                            price = calculateBarrierOptionClosedForm(
                              option.type,
                              S,
                              K,
                              r,
                              t,
                              sigma,
                              barrier || 0,
                              secondBarrier,
                              b,
                              barrierOptionSimulations || 1000
                            );
                          } else {
                            price = calculateBarrierOptionPrice(
                              option.type,
                              S,
                              K,
                              r,
                              t,
                              sigma,
                              barrier || 0,
                              secondBarrier,
                              barrierOptionSimulations || 1000
                            );
                          }
                          greeks = calculateGreeks(
                            option.type,
                            S,
                            K,
                            r,
                            b,
                            t,
                            sigma,
                            barrier,
                            secondBarrier
                          );
                        } else {
                          // Options digitales
                          const rebate = option.rebate !== undefined ? option.rebate : 1;
                          const numSimulations = barrierOptionSimulations || 10000;
                          price = calculateDigitalOptionPrice(
                            option.type,
                            S,
                            K,
                            r,
                            t,
                            sigma,
                            barrier,
                            secondBarrier,
                            numSimulations,
                            rebate
                          );
                          greeks = calculateGreeks(
                            option.type,
                            S,
                            K,
                            r,
                            b,
                            t,
                            sigma,
                            barrier,
                            secondBarrier,
                            rebate
                          );
                        }
                        
                        price = clampOptionPriceNonNegative(price);
                        const adjustedPrice = price * quantity;
                        
                        // Agréger les prix et grecques en tenant compte de la quantité
                        totalPrice += adjustedPrice;
                        totalDelta += greeks.delta * quantity;
                        totalGamma += greeks.gamma * quantity;
                        totalTheta += greeks.theta * quantity;
                        totalVega += greeks.vega * quantity;
                        totalRho += greeks.rho * quantity;
                      });
                      
                      return { 
                        spot: parseFloat(spot.toFixed(4)),
                        price: totalPrice,
                        delta: totalDelta,
                        gamma: totalGamma,
                        theta: totalTheta,
                        vega: totalVega,
                        rho: totalRho
                      };
                    } catch (error) {
                      console.warn('Error calculating price/Greeks at spot', spot, error);
                      return { 
                        spot: parseFloat(spot.toFixed(4)),
                        price: 0,
                        delta: 0,
                        gamma: 0,
                        theta: 0,
                        vega: 0,
                        rho: 0
                      };
                    }
                  });
                };
                
                const priceData = generatePriceData();
                
                return payoffData.length > 0 ? (
                <PayoffChart
                  data={payoffData}
                  strategy={strategy}
                  spot={params.spotPrice}
                  currencyPair={params.currencyPair}
                  includePremium={true}
                  className="mt-6"
                    priceData={priceData}
                />
                ) : (
                  <div className="flex items-center justify-center h-96 text-muted-foreground">
                    <div className="text-center">
                      <p className="text-lg font-medium mb-2">Aucune donnée disponible</p>
                      <p className="text-sm">Cliquez sur "Calculate Results" pour générer les courbes</p>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="monte-carlo">
              {/* Monte Carlo Simulation Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Monte Carlo Simulation</CardTitle>
                  <CardDescription>Visualize price paths and option price evolution</CardDescription>
                </CardHeader>
            <CardContent>
              <div className="flex flex-row justify-between mb-4">
                <div>
                  <Button 
                    onClick={() => {
                      if (results) {
                        if (!simulationData) {
                          recalculateMonteCarloSimulations(); 
                        }
                        setShowMonteCarloVisualization(!showMonteCarloVisualization);
                      } else {
                        alert("Calculate Strategy Results first to generate Monte Carlo simulations.");
                      }
                    }}
                    disabled={!results || isRunningSimulation}
                    className="mr-2"
                  >
                    {isRunningSimulation ? (
                      <>
                        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-e-transparent align-[-0.125em]"></span>
                        Running Simulation...
                      </>
                    ) : showMonteCarloVisualization ? (
                      "Hide Visualization"
                    ) : (
                      "Show Monte Carlo Visualization"
                    )}
                  </Button>
                </div>
                <div className="flex items-center">
                  {isRunningSimulation ? (
                    <span className="text-sm text-blue-600">
                      Calculating simulations...
                    </span>
                  ) : realPriceParams.useSimulation ? (
                    <span className="text-sm text-gray-600">
                      Using {realPriceParams.numSimulations || 1000} simulations (configured in Strategy Parameters)
                    </span>
                  ) : strategy.some(opt => opt.type.includes('knockout') || opt.type.includes('knockin')) ? (
                    <span className="text-sm text-blue-600">
                      Barrier option visualization available (Monte Carlo not used for real prices)
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600 font-semibold">
                      Enable "Use Monte Carlo Simulation" or add barrier options to see visualizations
                    </span>
                  )}
                </div>
              </div>

              {showMonteCarloVisualization && results && simulationData && (
                <div>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="font-medium text-blue-800 mb-1">Monte Carlo Visualization Information</h4>
                    <ul className="list-disc ml-5 text-sm text-blue-700">
                      {realPriceParams.useSimulation && (
                        <li>Displaying {Math.min(100, realPriceParams.numSimulations)} random paths out of {realPriceParams.numSimulations} total simulations</li>
                      )}
                      {realPriceParams.useSimulation && simulationData.realPricePaths.length > 0 && (
                        <li>Real Price Paths: Shows simulated price paths based on the volatility parameters</li>
                      )}
                    </ul>
                  </div>
                  
                  <MonteCarloVisualization 
                    simulationData={{
                      ...simulationData,
                      
                    }} 
                  />
                  
                  
                </div>
              )}
              
              {(!showMonteCarloVisualization || !results || !simulationData) && (
                <div className="text-center py-8 bg-muted rounded-md border border-border">
                  {!results ? (
                    <div>
                      <p className="text-gray-700 font-medium">Calculate Strategy Results First</p>
                      <p className="mt-1 text-sm text-gray-500">Click "Calculate Results" to generate Monte Carlo simulations.</p>
                    </div>
                  ) : !simulationData ? (
                    <div>
                      <p className="text-gray-700 font-medium">No Simulation Data Available</p>
                      <p className="mt-1 text-sm text-gray-500">Please recalculate results to generate simulation data.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-700 font-medium">Visualization Hidden</p>
                      <p className="mt-1 text-sm text-gray-500">Click "Show Monte Carlo Visualization" to display price paths.</p>
                    </div>
                  )}

                  <Button 
                    onClick={() => {
                      if (results) {
                        if (!simulationData) {
                          recalculateMonteCarloSimulations();
                        }
                        setShowMonteCarloVisualization(true);
                      }
                    }}
                    disabled={!results || isRunningSimulation}
                    className="mt-4"
                  >
                    {!simulationData 
                      ? "Generate Simulation" 
                      : "Show Visualization"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="yearly-stats">
              <Card>
                <CardHeader>
                  <CardTitle>Summary Statistics by Year</CardTitle>
                </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {(() => {
                  const yearlyResults = calculateYearlyResults(results);

                  return (
                    <table className="w-full border-collapse mb-6">
                      <thead>
                        <tr>
                          <th className="border p-2 text-left">Year</th>
                          <th className="border p-2 text-right">Total Cost with Hedging</th>
                          <th className="border p-2 text-right">Total Cost without Hedging</th>
                          <th className="border p-2 text-right">Total P&L</th>
                          <th className="border p-2 text-right">Total Strategy Premium</th>
                          <th className="border p-2 text-right">Cost Reduction (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(yearlyResults).map(([year, data]: [string, any]) => (
                          <tr key={year}>
                            <td className="border p-2 font-medium">{year}</td>
                            <td className="border p-2 text-right">
                              {(data.hedgedCost || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td className="border p-2 text-right">
                              {(data.unhedgedCost || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td className="border p-2 text-right">
                              {(data.deltaPnL || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td className="border p-2 text-right">
                              {(data.strategyPremium || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td className="border p-2 text-right">
                                  {data.unhedgedCost !== 0 ? (((data.deltaPnL / Math.abs(data.unhedgedCost)) * 100).toFixed(2) + '%') : '0%'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="total-stats">
              <Card>
                <CardHeader>
                  <CardTitle>Total Summary Statistics</CardTitle>
                </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className="border p-2 font-medium">Total Cost with Hedging</td>
                      <td className="border p-2 text-right">
                        {displayResults.reduce((sum, row) => sum + row.hedgedCost, 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Total Cost without Hedging</td>
                      <td className="border p-2 text-right">
                        {displayResults.reduce((sum, row) => sum + row.unhedgedCost, 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Total P&L</td>
                      <td className="border p-2 text-right">
                        {displayResults.reduce((sum, row) => sum + row.deltaPnL, 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Total Strategy Premium</td>
                      <td className="border p-2 text-right">
                        {displayResults.reduce((sum, row) => sum + (row.strategyPrice * row.monthlyVolume), 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Cost Reduction (%)</td>
                      <td className="border p-2 text-right">
                        {(() => {
                          if (!results || results.length === 0) return 'N/A';
                          const totalPnL = validateDataForReduce(results).reduce((sum, row) => sum + (row.deltaPnL || 0), 0);
                          const totalUnhedgedCost = validateDataForReduce(results).reduce((sum, row) => sum + (row.unhedgedCost || 0), 0);
                          if (Math.abs(totalUnhedgedCost) < 0.01) return 'N/A';
                                                             return (((totalPnL / Math.abs(totalUnhedgedCost)) * 100).toFixed(2) + '%');
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Strike Target</td>
                      <td className="border p-2 text-right">
                        {(() => {
                          if (!results || results.length === 0) return 'N/A';
                          const totalHedgedCost = validateDataForReduce(results).reduce((sum, row) => sum + (row.hedgedCost || 0), 0);
                          const totalVolume = validateDataForReduce(results).reduce((sum, row) => sum + (row.monthlyVolume || 0), 0);
                          return totalVolume > 0 
                            ? ((-1) * totalHedgedCost / totalVolume).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })
                            : 'N/A';
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="monthly-breakdown">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly & Yearly P&L Breakdown</CardTitle>
                </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {displayResults.length > 0 && (() => {
                  // Organiser les données par année et par mois
                  const pnlByYearMonth: Record<string, Record<string, number>> = {};
                  const yearTotals: Record<string, number> = {};
                  const monthTotals: Record<string, number> = {};
                  let grandTotal = 0;
                  
                  // Collecter toutes les années et tous les mois uniques
                  const years: Set<string> = new Set();
                  const months: string[] = [
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                  ];
                  
                  // Initialiser la structure de données
                  results.forEach(result => {
                    const date = new Date(result.date);
                    const year = date.getFullYear().toString();
                    const month = date.getMonth();
                    const monthKey = months[month];
                    
                    years.add(year);
                    
                    if (!pnlByYearMonth[year]) {
                      pnlByYearMonth[year] = {};
                      yearTotals[year] = 0;
                    }
                    
                    if (!pnlByYearMonth[year][monthKey]) {
                      pnlByYearMonth[year][monthKey] = 0;
                    }
                    
                    // Ajouter le P&L au mois correspondant
                    pnlByYearMonth[year][monthKey] += result.deltaPnL;
                    
                    // Mettre à jour les totaux
                    yearTotals[year] += result.deltaPnL;
                    if (!monthTotals[monthKey]) monthTotals[monthKey] = 0;
                    monthTotals[monthKey] += result.deltaPnL;
                    grandTotal += result.deltaPnL;
                  });
                  
                  // Convertir l'ensemble des années en tableau trié
                  const sortedYears = Array.from(years).sort();
                  
                  // Fonction pour appliquer une couleur en fonction de la valeur
                  const getPnLColor = (value: number) => {
                    if (value > 0) return 'bg-green-100 dark:bg-green-950/30';
                    if (value < 0) return 'bg-red-100 dark:bg-red-950/30';
                    return '';
                  };
                  
                  // Fonction pour formater les valeurs de P&L
                  const formatPnL = (value: number) => {
                    if (Math.abs(value) < 0.01) return '0';
                    // Formater en milliers avec un point de séparation de milliers
                    return (value / 1000).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 3
                    });
                  };
                  
                  return (
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border p-2 font-semibold text-left"></th>
                          {months.map(month => (
                            <th key={month} className="border p-2 font-semibold text-center w-20">{month}</th>
                          ))}
                          <th className="border p-2 font-semibold text-center w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedYears.map(year => (
                          <tr key={year}>
                            <td className="border p-2 font-semibold">{year}</td>
                            {months.map(month => {
                              const value = pnlByYearMonth[year][month] || 0;
                              return (
                                <td 
                                  key={`${year}-${month}`} 
                                  className={`border p-2 text-right ${getPnLColor(value)}`}
                                >
                                  {value ? formatPnL(value) : '-'}
                                </td>
                              );
                            })}
                            <td className={`border p-2 text-right font-semibold ${getPnLColor(yearTotals[year])}`}>
                              {formatPnL(yearTotals[year])}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/50">
                          <td className="border p-2 font-semibold">Total</td>
                          {months.map(month => (
                            <td 
                              key={`total-${month}`} 
                              className={`border p-2 text-right font-semibold ${getPnLColor(monthTotals[month] || 0)}`}
                            >
                              {monthTotals[month] ? formatPnL(monthTotals[month]) : '-'}
                            </td>
                          ))}
                          <td className={`border p-2 text-right font-semibold ${getPnLColor(grandTotal)}`}>
                            {formatPnL(grandTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default Index;
