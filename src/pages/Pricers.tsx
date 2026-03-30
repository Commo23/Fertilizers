import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from "@/components/Layout";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Calculator, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Info,
  CheckCircle,
  Clock,
  Calendar,
  Percent,
  Hash,
  RefreshCw,
  Target,
  LineChart
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { CURRENCY_PAIRS } from '@/pages/Index'; // Commodity data
import PayoffChart from '@/components/PayoffChart';
import {
  PricingService,
  Greeks,
  calculateVanillaSpotMcOrBs,
  calculateCommodityForwardPrice,
  strategyBuilderAnnualPercentToDecimal,
} from '@/services/PricingService';
import { Commodity, CommodityCategory, fetchCommoditiesData } from '@/services/commodityApi';
import { useInterestRates } from '@/hooks/useInterestRates';
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
import { getOrBuildCurve, interpolatePrice } from '@/lib/ticker-peek-pro/futuresCurve';

// Interface pour les commodities (adaptée du Strategy Builder)
interface CurrencyPair { // Renamed to Commodity in a previous step, but still named CurrencyPair here for compatibility
  symbol: string;
  name: string;
  base: string;  // Unit (BBL, OZ, MT, etc.) - for display only
  quote: string; // Currency (usually USD) - for display only
  category: 'energy' | 'metals' | 'agriculture' | 'livestock' | 'majors' | 'crosses' | 'others'; // Commodity categories + legacy FX
  defaultSpotRate: number; // Default spot price for this commodity
}

interface StrategyComponent {
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
  barrier?: number;
  secondBarrier?: number;
  barrierType?: 'percent' | 'absolute';
  rebate?: number;
  timeToPayoff?: number;
}

interface PricingResult {
  price: number;
  method: string;
  greeks?: Greeks;
}

// Types d'instruments supportés (même que Strategy Builder)
const INSTRUMENT_TYPES = [
  { value: 'call', label: 'Call', category: 'vanilla' },
  { value: 'put', label: 'Put', category: 'vanilla' },
  { value: 'swap', label: 'Swap', category: 'swap' },
  { value: 'forward', label: 'Forward', category: 'forward' },
  { value: 'call-knockout', label: 'Call Knock-Out', category: 'barrier' },
  { value: 'call-reverse-knockout', label: 'Call Reverse Knock-Out', category: 'barrier' },
  { value: 'call-double-knockout', label: 'Call Double Knock-Out', category: 'barrier' },
  { value: 'put-knockout', label: 'Put Knock-Out', category: 'barrier' },
  { value: 'put-reverse-knockout', label: 'Put Reverse Knock-Out', category: 'barrier' },
  { value: 'put-double-knockout', label: 'Put Double Knock-Out', category: 'barrier' },
  { value: 'call-knockin', label: 'Call Knock-In', category: 'barrier' },
  { value: 'call-reverse-knockin', label: 'Call Reverse Knock-In', category: 'barrier' },
  { value: 'call-double-knockin', label: 'Call Double Knock-In', category: 'barrier' },
  { value: 'put-knockin', label: 'Put Knock-In', category: 'barrier' },
  { value: 'put-reverse-knockin', label: 'Put Reverse Knock-In', category: 'barrier' },
  { value: 'put-double-knockin', label: 'Put Double Knock-In', category: 'barrier' },
  { value: 'one-touch', label: 'One Touch (beta)', category: 'digital' },
  { value: 'double-touch', label: 'Double Touch (beta)', category: 'digital' },
  { value: 'no-touch', label: 'No Touch (beta)', category: 'digital' },
  { value: 'double-no-touch', label: 'Double No Touch (beta)', category: 'digital' },
  { value: 'range-binary', label: 'Range Binary (beta)', category: 'digital' },
  { value: 'outside-binary', label: 'Outside Binary (beta)', category: 'digital' }
];

const Pricers = () => {
  const { toast } = useToast();
  
  // 🎯 Interest Rate Hook - Utilise les taux de Settings (Fixed Bank Rate ou Curve)
  const { 
    mode: interestRateMode, 
    isCurveMode, 
    getRate, 
    fixedRates,
    hasCurveData 
  } = useInterestRates();
  
  // État principal
  const [selectedInstrument, setSelectedInstrument] = useState('call');
  const [selectedCurrencyPair, setSelectedCurrencyPair] = useState('WTI');
  
  // State for using real data from Commodity Market
  const [useRealData, setUseRealData] = useState(() => {
    try {
      const saved = localStorage.getItem('pricersUseRealData');
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      return false;
    }
  });

  // State for real commodities from Commodity Market
  const [realCommodities, setRealCommodities] = useState<Commodity[]>([]);
  const [loadingRealCommodities, setLoadingRealCommodities] = useState(false);
  
  // State for commodity search filter
  const [commoditySearchQuery, setCommoditySearchQuery] = useState('');

  // ── Ticker Peek Pro Integration ──
  const [useTickerPeekPro, setUseTickerPeekPro] = useState(() => {
    try {
      const saved = localStorage.getItem('pricersUseTickerPeekPro');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [tppCurrencies, setTppCurrencies] = useState<TppCurrencyData[]>([]);
  const [tppCurrenciesByCategory, setTppCurrenciesByCategory] = useState<Record<string, TppCurrencyData[]>>({});
  const [tppLoadingCurrencies, setTppLoadingCurrencies] = useState(false);
  const [tppLoadingFutures, setTppLoadingFutures] = useState(false);
  const [tppLoadingSurface, setTppLoadingSurface] = useState(false);
  const [tppSurfacePoints, setTppSurfacePoints] = useState<TppSurfacePoint[]>([]);
  const [tppFutures, setTppFutures] = useState<TppFuturesContract[]>([]);
  const [tppSearchQuery, setTppSearchQuery] = useState('');

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

  // ── Ticker Peek Pro: Load all commodities from all categories ──
  const loadAllTppCurrencies = async () => {
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
  };

  // ── Ticker Peek Pro: Load futures (for curve), then spot = interpolated price at maturity; IV surface ──
  const loadTppData = async (symbol: string) => {
    setTppLoadingFutures(true);
    setTppFutures([]);
    try {
      const futuresResult = await fetchTppFutures(symbol);
      if (futuresResult.success && futuresResult.data && futuresResult.data.length > 0) {
        setTppFutures(futuresResult.data);
        const refDate = new Date();
        const curvePoints = getOrBuildCurve(symbol, futuresResult.data, refDate);
        if (curvePoints.length >= 2) {
          setPricingInputs(prev => {
            const dte = Math.max(0, Math.round((prev.timeToMaturity ?? 1) * 365.25));
            const interpolated = interpolatePrice(curvePoints, dte);
            const spot = interpolated != null ? interpolated : parseFloat(
              (futuresResult.data!.find(f => f.month.toLowerCase().includes('cash')) || futuresResult.data![0]).last.replace(/,/g, '')
            );
            return { ...prev, spotPrice: spot };
          });
          toast({
            title: "Ticker Peek Pro",
            description: `Spot = interpolated futures price at maturity (${futuresResult.data.length} contracts)`,
          });
        } else {
          const cashContract = futuresResult.data.find(f =>
            f.month.toLowerCase().includes('cash') || f.contract.toLowerCase().includes('cash')
          ) || futuresResult.data[0];
          const cashPrice = parseFloat(cashContract.last.replace(/,/g, ''));
          if (!isNaN(cashPrice) && cashPrice > 0) {
            setPricingInputs(prev => ({ ...prev, spotPrice: cashPrice }));
            toast({ title: "Ticker Peek Pro — Cash Price", description: `${symbol}: ${cashPrice.toFixed(2)}` });
          }
        }
      }
    } catch (error) {
      console.error('Error loading TPP futures:', error);
    } finally {
      setTppLoadingFutures(false);
    }

    // 2. Load IV surface for volatility interpolation
    setTppLoadingSurface(true);
    setTppSurfacePoints([]);
    try {
      const strikesResult = await fetchTppVolSurfaceStrikes(symbol, symbol, 50);
      if (strikesResult.success && strikesResult.strikes && strikesResult.strikes.length > 0) {
        const allStrikes = strikesResult.strikes;
        const surfaceResult = await fetchTppVolSurface(
          symbol, symbol, 50, false, allStrikes[0], allStrikes[allStrikes.length - 1]
        );
        if (surfaceResult.success && surfaceResult.surfacePoints && surfaceResult.surfacePoints.length > 0) {
          setTppSurfacePoints(surfaceResult.surfacePoints);
          toast({
            title: "IV Surface Loaded",
            description: `${surfaceResult.surfacePoints.length} data points for vol interpolation`,
          });
        }
      }
    } catch (error) {
      console.error('Error loading TPP IV surface:', error);
    } finally {
      setTppLoadingSurface(false);
    }
  };

  // ── Ticker Peek Pro: Bilinear IV interpolation ──
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
    const toDecimalIv = (raw: number) => (raw > 1 ? raw / 100 : raw);
    let z: (number | null)[][] = dtes.map(d =>
      strikes.map(s => {
        const point = filtered.find(p => p.dte === d && p.strike === s);
        const raw = parseIv(point?.iv);
        if (raw == null) return null;
        return toDecimalIv(raw);
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

  // Load real commodities when useRealData is enabled
  useEffect(() => {
    if (useRealData) {
      loadRealCommodities();
    }
  }, [useRealData]);

  // Load TPP commodities when toggle is on
  useEffect(() => {
    if (useTickerPeekPro) {
      loadAllTppCurrencies();
      if (useRealData) {
        setUseRealData(false);
        localStorage.setItem('pricersUseRealData', 'false');
      }
    }
  }, [useTickerPeekPro]);

  // Load TPP futures and IV surface when commodity changes
  useEffect(() => {
    if (useTickerPeekPro && selectedCurrencyPair) {
      loadTppData(selectedCurrencyPair);
    }
  }, [selectedCurrencyPair, useTickerPeekPro]);

  // ✅ AJOUT: Sélection du modèle de pricing pour les barrières
  const [barrierPricingModel, setBarrierPricingModel] = useState<'closed-form' | 'monte-carlo'>('closed-form');
  // ✅ AJOUT: Sélection du modèle de pricing vanille (même logique que Strategy Builder)
  const [optionPricingModel, setOptionPricingModel] = useState<'black-scholes' | 'monte-carlo'>('black-scholes');
  // ✅ AJOUT: Nombre de simulations pour barrières/digitales (comme Strategy Builder)
  const [barrierOptionSimulations, setBarrierOptionSimulations] = useState<number>(1000);
  
  // ✅ AJOUT: Sélection du prix sous-jacent pour TOUTES les options
  const [underlyingPriceType, setUnderlyingPriceType] = useState<'forward' | 'spot'>('forward');
  
  // Inputs de pricing (adaptés pour commodities)
  const [pricingInputs, setPricingInputs] = useState(() => {
    // Initialiser avec le taux de Settings (Bank Rate USD par défaut)
    const initialRate = (fixedRates?.USD || 4.5);
    return {
    startDate: new Date().toISOString().split('T')[0],
    maturityDate: new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 an par défaut
    spotPrice: 75.50, // WTI default price
      interestRate: initialRate, // 🎯 Risk-free rate depuis Settings (en pourcentage)
    timeToMaturity: 1.0,
    volatility: 20.0, // Commodity volatility (en pourcentage)
    numSimulations: 1000, // ✅ 1000 comme Strategy Builder
    storageCost: 0.0, // Storage cost (en pourcentage)
    convenienceYield: 0.0 // Convenience yield (en pourcentage)
    };
  });

  // When TPP is on and maturity changes: set spot = interpolated futures price at that maturity
  useEffect(() => {
    if (!useTickerPeekPro || tppFutures.length < 2 || !selectedCurrencyPair) return;
    const refDate = new Date();
    const curvePoints = getOrBuildCurve(selectedCurrencyPair, tppFutures, refDate);
    if (curvePoints.length < 2) return;
    const dte = Math.max(0, Math.round((pricingInputs.timeToMaturity ?? 1) * 365.25));
    const interpolated = interpolatePrice(curvePoints, dte);
    if (interpolated != null) {
      setPricingInputs(prev => (prev.spotPrice !== interpolated ? { ...prev, spotPrice: interpolated } : prev));
    }
  }, [useTickerPeekPro, selectedCurrencyPair, tppFutures, pricingInputs.timeToMaturity]);

  // 🎯 Fonction pour obtenir la devise de la commodity sélectionnée
  // Si on utilise des données réelles, essayer de récupérer la devise depuis la commodity
  const getSelectedCurrency = useMemo(() => {
    if (useTickerPeekPro) return 'USD';
    if (useRealData && realCommodities.length > 0 && selectedCurrencyPair) {
      const selectedCommodity = realCommodities.find(c => c.symbol === selectedCurrencyPair);
      if (selectedCommodity?.currency) {
        return selectedCommodity.currency;
      }
    }
    const currentPair = CURRENCY_PAIRS.find(p => p.symbol === selectedCurrencyPair);
    return currentPair?.quote || 'USD';
  }, [selectedCurrencyPair, useRealData, realCommodities, useTickerPeekPro]);
  
  // 🎯 Fonction pour obtenir le taux d'intérêt selon les settings
  const getInterestRateForPricing = useMemo(() => {
    // Mode Curve: utilise la maturité pour interpoler le taux
    // Mode Fixed: utilise le Bank Rate de la devise
    const maturityYears = pricingInputs.timeToMaturity || 1.0;
    const rate = getRate(getSelectedCurrency, maturityYears);
    return rate * 100; // Convertir en pourcentage
  }, [getRate, getSelectedCurrency, pricingInputs.timeToMaturity]);
  
  // 🎯 Mettre à jour le taux d'intérêt quand la devise ou la maturité change
  useEffect(() => {
    const newRate = getInterestRateForPricing;
    if (Math.abs(newRate - pricingInputs.interestRate) > 0.001) {
      setPricingInputs(prev => ({
        ...prev,
        interestRate: newRate
      }));
    }
  }, [getInterestRateForPricing]);
  
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
                console.log('✅ Taux bancaires synchronisés automatiquement dans Pricers');
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

  // 🎯 Synchroniser automatiquement le Risk-free Rate avec le Bank Rate quand la commodity change
  useEffect(() => {
    if (!isCurveMode && getSelectedCurrency) {
      const syncRate = async () => {
        const bankRate = await getBankRateForCurrency(getSelectedCurrency);
        if (bankRate !== null) {
          // Mettre à jour le taux automatiquement
          setPricingInputs(prev => ({
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
  
  const getRiskFreeRate = () => strategyBuilderAnnualPercentToDecimal(pricingInputs.interestRate);
  const calculateCostOfCarry = () => getRiskFreeRate();

  // Volume principal (simplifié)
  const [volume, setVolume] = useState(1000000);

  // Volume simplifié - pas de synchronisation nécessaire

  // Composant stratégie (comme dans Strategy Builder)
  const [strategyComponent, setStrategyComponent] = useState<StrategyComponent>({
    type: 'call',
    strike: 75.5, // Default absolute strike (e.g. WTI)
    strikeType: 'absolute',
    volatility: 15.0, // En pourcentage
    quantity: 100,
    barrier: undefined,
    barrierType: 'percent',
    secondBarrier: undefined,
    rebate: 1.0,
    timeToPayoff: 1.0 // Temps jusqu'au payoff pour les options one-touch (en années)
  });

  // Auto-interpolate IV from TPP surface when strike/maturity/instrument changes
  useEffect(() => {
    if (!useTickerPeekPro || tppSurfacePoints.length === 0) return;
    const absoluteStrike = strategyComponent.strikeType === 'percent'
      ? pricingInputs.spotPrice * (strategyComponent.strike / 100)
      : strategyComponent.strike;
    const dte = Math.max(1, Math.round(pricingInputs.timeToMaturity * 365.25));
    const type: 'call' | 'put' = selectedInstrument.includes('put') ? 'put' : 'call';
    const iv = interpolateTppIV(absoluteStrike, dte, type);
    // interpolateTppIV returns decimal (0.30); volatility field expects percentage (30)
    if (iv !== null && iv > 0) {
      const ivPct = iv * 100;
      setStrategyComponent(prev => ({ ...prev, volatility: parseFloat(ivPct.toFixed(2)) }));
    }
  }, [useTickerPeekPro, tppSurfacePoints, strategyComponent.strike, strategyComponent.strikeType,
      pricingInputs.spotPrice, pricingInputs.timeToMaturity, selectedInstrument, interpolateTppIV]);

  // Manual refresh IV from TPP surface
  const handleRefreshTppIV = useCallback(() => {
    if (!useTickerPeekPro || tppSurfacePoints.length === 0) {
      toast({ title: "IV Refresh", description: "No TPP surface data available.", variant: "destructive" });
      return;
    }
    const absoluteStrike = strategyComponent.strikeType === 'percent'
      ? pricingInputs.spotPrice * (strategyComponent.strike / 100)
      : strategyComponent.strike;
    const dte = Math.max(1, Math.round(pricingInputs.timeToMaturity * 365.25));
    const type: 'call' | 'put' = selectedInstrument.includes('put') ? 'put' : 'call';
    const iv = interpolateTppIV(absoluteStrike, dte, type);
    if (iv !== null && iv > 0) {
      const ivPct = iv * 100;
      setStrategyComponent(prev => ({ ...prev, volatility: parseFloat(ivPct.toFixed(2)) }));
      toast({ title: "IV Updated", description: `Volatility set to ${ivPct.toFixed(2)}% from TPP surface (Strike: ${absoluteStrike.toFixed(2)}, DTE: ${dte})` });
    } else {
      toast({ title: "IV Refresh", description: "Could not interpolate IV for current strike/maturity.", variant: "destructive" });
    }
  }, [useTickerPeekPro, tppSurfacePoints, strategyComponent.strike, strategyComponent.strikeType,
      pricingInputs.spotPrice, pricingInputs.timeToMaturity, selectedInstrument, interpolateTppIV, toast]);

  // Résultats
  const [pricingResults, setPricingResults] = useState<PricingResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGreeks, setShowGreeks] = useState(true);

  // Utiliser la même fonction de calcul de maturité que Strategy Builder
  const calculateTimeToMaturity = () => {
    return PricingService.calculateTimeToMaturity(
      pricingInputs.maturityDate,
      pricingInputs.startDate
    );
  };

  // Mettre à jour la maturité quand les dates changent
  useEffect(() => {
    const timeToMaturity = calculateTimeToMaturity();
    setPricingInputs(prev => ({ ...prev, timeToMaturity }));
  }, [pricingInputs.startDate, pricingInputs.maturityDate]);

  // Mettre à jour le spot price quand la commodity change (sauf en mode TPP)
  useEffect(() => {
    if (useTickerPeekPro) return;
    if (useRealData && realCommodities.length > 0) {
      const selectedCommodity = realCommodities.find(c => c.symbol === selectedCurrencyPair);
      if (selectedCommodity) {
        setPricingInputs(prev => ({ ...prev, spotPrice: selectedCommodity.price }));
        toast({
          title: "Real Price Updated",
          description: `${selectedCommodity.name}: $${selectedCommodity.price.toFixed(2)}`,
        });
      } else if (realCommodities.length > 0 && !realCommodities.find(c => c.symbol === selectedCurrencyPair)) {
        const firstCommodity = realCommodities[0];
        setSelectedCurrencyPair(firstCommodity.symbol);
        setPricingInputs(prev => ({ ...prev, spotPrice: firstCommodity.price }));
      }
    } else {
      const pair = CURRENCY_PAIRS.find(p => p.symbol === selectedCurrencyPair);
      if (pair) {
        setPricingInputs(prev => ({ ...prev, spotPrice: pair.defaultSpotRate }));
      }
    }
  }, [selectedCurrencyPair, useRealData, realCommodities, useTickerPeekPro]);

  // Mettre à jour le type d'instrument dans le composant stratégie
  useEffect(() => {
    setStrategyComponent(prev => ({ ...prev, type: selectedInstrument as any }));
  }, [selectedInstrument]);

  // Calcul du prix - UTILISE UNIQUEMENT PricingService.calculateOptionPrice
  const calculatePrice = async (showToast: boolean = true) => {
    setIsCalculating(true);
    
    try {
      const results: PricingResult[] = [];
      
      // Calculer le strike selon le type
      const strike = strategyComponent.strikeType === 'percent' 
        ? pricingInputs.spotPrice * (strategyComponent.strike / 100)
        : strategyComponent.strike;
        
      // Calculer les barrières selon le type
      const barrier = strategyComponent.barrier ? (
        strategyComponent.barrierType === 'percent'
          ? pricingInputs.spotPrice * (strategyComponent.barrier / 100)
          : strategyComponent.barrier
      ) : undefined;

      const secondBarrier = strategyComponent.secondBarrier ? (
        strategyComponent.barrierType === 'percent'
          ? pricingInputs.spotPrice * (strategyComponent.secondBarrier / 100)
          : strategyComponent.secondBarrier
      ) : undefined;

      console.log('Calculated values:', {
        strike,
        barrier,
        secondBarrier,
        spotPrice: pricingInputs.spotPrice,
        type: strategyComponent.type
      });

      // ✅ UTILISATION STRICTE COMME STRATEGY BUILDER — TOUJOURS LE SPOT (S)
      let price = 0;
      let methodName = '';
      
      // ✅ STRATEGY BUILDER UTILISE TOUJOURS LE SPOT DIRECTEMENT (pas de forward dans les options)
      const S = pricingInputs.spotPrice; // Spot price (comme Strategy Builder)
      const K = strike;
      const r = getRiskFreeRate();
      const t = pricingInputs.timeToMaturity;
      const sigma = strategyComponent.volatility / 100;
      
      if (strategyComponent.type === 'forward') {
        const forward = calculateCommodityForwardPrice(
          pricingInputs.spotPrice,
          getRiskFreeRate(),
          0,
          0,
          pricingInputs.timeToMaturity
        );
        price = forward - strike;
        methodName = 'Forward Pricing';
      } else if (strategyComponent.type === 'swap') {
        const forward = calculateCommodityForwardPrice(
          pricingInputs.spotPrice,
          getRiskFreeRate(),
          0,
          0,
          pricingInputs.timeToMaturity
        );
        price = PricingService.calculateSwapPrice(
          [forward],
          [pricingInputs.timeToMaturity],
          getRiskFreeRate()
        );
        methodName = 'Swap Pricing';
      } else if (strategyComponent.type === 'call' || strategyComponent.type === 'put') {
        price = calculateVanillaSpotMcOrBs(
          strategyComponent.type,
          S,
          K,
          r,
          0,
          t,
          sigma,
          optionPricingModel === 'monte-carlo' ? 'monte-carlo' : 'black-scholes'
        );
        methodName =
          optionPricingModel === 'monte-carlo' ? 'Monte Carlo (vanilla)' : 'Black-Scholes (spot)';
      } else if (strategyComponent.type.includes('knockout') || strategyComponent.type.includes('knockin')) {
        // ✅ BARRIER OPTIONS — STRICTEMENT COMME STRATEGY BUILDER (lignes 2022-2063)
        if (barrierPricingModel === 'closed-form') {
          price = PricingService.calculateBarrierOptionClosedForm(
            strategyComponent.type,
            S, // Spot comme Strategy Builder
            K,
            r,
            t,
            sigma,
            barrier || 0,
            secondBarrier,
            0, // r_f = 0 pour commodities
            barrierOptionSimulations || 1000 // Pour fallback Monte Carlo si nécessaire
          );
          methodName = 'Barrier Closed-Form';
        } else {
          price = PricingService.calculateBarrierOptionPrice(
            strategyComponent.type,
            S, // Spot comme Strategy Builder
            K,
            r,
            t,
            sigma,
            barrier || 0,
            secondBarrier,
            barrierOptionSimulations || 1000 // Strategy Builder utilise barrierOptionSimulations
          );
          methodName = 'Barrier Monte Carlo';
        }
      } else {
        // ✅ DIGITAL OPTIONS — STRICTEMENT COMME STRATEGY BUILDER (lignes 2066-2094)
        const rebate = strategyComponent.rebate !== undefined ? strategyComponent.rebate : 1;
        const numSimulations = barrierOptionSimulations || 10000; // Strategy Builder utilise barrierOptionSimulations || 10000
        price = PricingService.calculateDigitalOptionPrice(
          strategyComponent.type,
          S, // Spot comme Strategy Builder
          K,
          r,
          t,
          sigma,
          barrier,
          secondBarrier,
          numSimulations,
          rebate
        );
        methodName = 'Digital Monte Carlo';
      }
      
      // ✅ Strategy Builder assure que le prix n'est jamais négatif (ligne 2127)
      price = Math.max(0, price);
      
      // Calculer les grecques si demandé
      let greeks: Greeks | undefined;
      if (showGreeks && strategyComponent.type !== 'forward' && strategyComponent.type !== 'swap') {
        // Greeks calculation temporarily disabled
        // try {
        //   greeks = PricingService.calculateGreeks(
        //     strategyComponent.type,
        //     underlyingPrice,
        //     strike,
        //     getRiskFreeRate(),
        //     calculateCostOfCarry(),
        //     pricingInputs.timeToMaturity,
        //     strategyComponent.volatility / 100,
        //     barrier,
        //     secondBarrier,
        //     strategyComponent.rebate || 1
        //   );
        // } catch (error) {
        //   console.warn('Error calculating Greeks:', error);
        // }
      }
      
      // Ajouter le résultat
      if (price !== undefined && price !== null && !isNaN(price)) {
        results.push({
          price: price * strategyComponent.quantity / 100,
          method: methodName,
          greeks: greeks
        });
      }
      
      setPricingResults(results);
      
      if (showToast) {
        toast({
          title: "Calculation completed",
          description: `${results.length} pricing method(s) applied`,
        });
      }
      
    } catch (error) {
      console.error('Erreur lors du calcul:', error);
      if (showToast) {
        toast({
          title: "Calculation Error",
          description: "An error occurred during price calculation",
          variant: "destructive"
        });
      }
    } finally {
      setIsCalculating(false);
    }
  };

  // Fonction pour le bouton Calculer
  const handleCalculateClick = () => {
    calculatePrice(true);
  };

  // Mise à jour des inputs
  const updatePricingInput = (field: string, value: any) => {
    setPricingInputs(prev => ({ ...prev, [field]: value }));
  };

  const updateStrategyComponent = (field: keyof StrategyComponent, value: any) => {
    setStrategyComponent(prev => ({ ...prev, [field]: value }));
  };

  // ✅ AJOUT: Fonctions de gestion des notionnels
  const handleVolumeChange = (value: number) => {
    setVolume(value);
  };

  // Recalculer automatiquement le prix quand les paramètres changent
  useEffect(() => {
    // Ne recalculer que si on a déjà des résultats (utilisateur a cliqué sur Calculer au moins une fois)
    if (pricingResults.length > 0) {
      const timeoutId = setTimeout(() => {
        calculatePrice(false); // false = ne pas afficher le toast
      }, 500); // 500ms de délai
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    strategyComponent.type,
    strategyComponent.strike,
    strategyComponent.strikeType,
    strategyComponent.barrier,
    strategyComponent.secondBarrier,
    strategyComponent.barrierType,
    strategyComponent.volatility,
    strategyComponent.quantity,
    strategyComponent.rebate,
    strategyComponent.timeToPayoff,
    pricingInputs.spotPrice,
    pricingInputs.interestRate,
    pricingInputs.timeToMaturity,
    barrierPricingModel, // ✅ Recalculer quand le modèle change
    optionPricingModel, // ✅ Recalculer quand le modèle vanille change
    barrierOptionSimulations, // ✅ Recalculer quand le nombre de simulations change
    volume, // ✅ Recalculer quand le volume change
    showGreeks // ✅ Recalculer quand l'affichage des grecques change
  ]);

  // ✅ AJOUT: Recalculer les données de prix automatiquement quand les paramètres changent
  useEffect(() => {
    // Recalculer les données de prix seulement si on a déjà calculé au moins une fois
    if (pricingResults.length > 0) {
      // Les données se mettent à jour automatiquement via generatePriceData()
      // car elles dépendent des mêmes paramètres que le prix principal
      console.log('Price data updated automatically');
    }
  }, [
    strategyComponent,
    pricingInputs,
    barrierPricingModel,
    optionPricingModel,
    barrierOptionSimulations,
    showGreeks,
    pricingResults // ✅ Recalculer quand les résultats de pricing changent
  ]);

  // Formatage des résultats
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    }).format(price);
  };

  const getMethodIcon = (method: string) => {
    if (method.includes('Closed-Form') || method.includes('Garman-Kohlhagen')) return <Calculator className="w-4 h-4" />;
    if (method.includes('Monte Carlo')) return <BarChart3 className="w-4 h-4" />;
    if (method.includes('Forward') || method.includes('Swap')) return <TrendingUp className="w-4 h-4" />;
    return <Settings className="w-4 h-4" />;
  };

  const getMethodColor = (method: string) => {
    if (method.includes('Garman-Kohlhagen') || method.includes('Closed-Form')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
    if (method.includes('Monte Carlo') || method.includes('Digital')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (method.includes('Forward') || method.includes('Swap')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  // Formatage des grecques
  const formatGreek = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    }).format(value);
  };

  const getGreekColor = (value: number, type: 'delta' | 'gamma' | 'theta' | 'vega' | 'rho') => {
    if (type === 'theta') {
      // Theta est généralement négatif (décroissance temporelle)
      return value < 0 ? 'text-red-600' : 'text-green-600';
    }
    if (type === 'gamma') {
      // Gamma est généralement positif
      return value > 0 ? 'text-green-600' : 'text-red-600';
    }
    return 'text-gray-900 dark:text-gray-100';
  };

  // Obtenir la commodity sélectionnée (TPP, réelle ou par défaut)
  const selectedCommodity = useRealData && realCommodities.length > 0
    ? realCommodities.find(c => c.symbol === selectedCurrencyPair)
    : null;
  const tppSelectedCurrency = useTickerPeekPro
    ? tppCurrencies.find(c => c.symbol === selectedCurrencyPair)
    : null;
  const selectedPair = useTickerPeekPro && tppSelectedCurrency
    ? {
        symbol: tppSelectedCurrency.symbol,
        name: tppSelectedCurrency.name,
        category: 'others' as const,
        defaultSpotRate: parseFloat(tppSelectedCurrency.last.replace(/,/g, '')) || 0,
      }
    : useRealData && selectedCommodity
      ? {
          symbol: selectedCommodity.symbol,
          name: selectedCommodity.name,
          category: 'others' as const,
          defaultSpotRate: selectedCommodity.price,
        }
      : CURRENCY_PAIRS.find(p => p.symbol === selectedCurrencyPair);

  // Calculs complémentaires pour l'affichage des résultats
  // Volume principal pour les calculs
  const spot = pricingInputs.spotPrice;
  const premium = pricingResults.length > 0 ? pricingResults[0].price * volume : 0;
  const strikeAbs = strategyComponent.strikeType === 'percent' ? spot * (strategyComponent.strike / 100) : strategyComponent.strike;
  const barrierAbs = strategyComponent.barrierType === 'percent' && strategyComponent.barrier ? spot * strategyComponent.barrier / 100 : (strategyComponent.barrier || undefined);
  const secondBarrierAbs = strategyComponent.barrierType === 'percent' && strategyComponent.secondBarrier ? spot * strategyComponent.secondBarrier / 100 : (strategyComponent.secondBarrier || undefined);

  // Génération des données de payoff pour le graphique - UTILISE STRICTEMENT PricingService
  const generatePayoffData = () => {
    const spot = pricingInputs.spotPrice;
    const priceRange = Array.from({length: 101}, (_, i) => spot * (0.7 + i * 0.006)); // -30% à +30%
    const premium = pricingResults.length > 0 ? pricingResults[0].price : 0; // ✅ Vraie prime calculée
    
    return priceRange.map(price => {
      const unitPayoff = PricingService.calculateStrategyPayoffAtPrice([strategyComponent], price, spot);
      const quantity = strategyComponent.quantity / 100;
      let totalPayoff = unitPayoff * quantity;
      
      if (premium !== 0 && quantity !== 0) {
        if (quantity > 0) {
          totalPayoff -= premium;
        } else if (quantity < 0) {
          totalPayoff += premium;
        }
      }
      
      return { price, payoff: totalPayoff };
    });
  };

  const payoffData = generatePayoffData();

  // ✅ AJOUT: Génération des données de prix et grecques en fonction du spot
  const generatePriceData = () => {
    const currentSpot = pricingInputs.spotPrice;
    const spotRange = Array.from({length: 101}, (_, i) => currentSpot * (0.7 + i * 0.006)); // -30% à +30%
    
    return spotRange.map(spot => {
      try {
        // Calculer le strike selon le type
        const strike = strategyComponent.strikeType === 'percent' 
          ? currentSpot * (strategyComponent.strike / 100)  // Utiliser le spot original pour le strike
          : strategyComponent.strike;
          
        // Calculer les barrières selon le type
        const barrier = strategyComponent.barrier ? (
          strategyComponent.barrierType === 'percent'
            ? currentSpot * (strategyComponent.barrier / 100)
            : strategyComponent.barrier
        ) : undefined;

        const secondBarrier = strategyComponent.secondBarrier ? (
          strategyComponent.barrierType === 'percent'
            ? currentSpot * (strategyComponent.secondBarrier / 100)
            : strategyComponent.secondBarrier
        ) : undefined;

        // ✅ STRICTEMENT COMME STRATEGY BUILDER — TOUJOURS LE SPOT (S)
        const S = spot; // Spot variable pour la courbe de sensibilité
        const K = strike;
        const r = getRiskFreeRate();
        const t = pricingInputs.timeToMaturity;
        const sigma = strategyComponent.volatility / 100;
        const b = calculateCostOfCarry(); // Cost of carry pour commodities
        
        let price = 0;
        let greeks: Greeks | undefined;
        
        if (strategyComponent.type === 'forward') {
          const forward = calculateCommodityForwardPrice(spot, b, 0, 0, pricingInputs.timeToMaturity);
          price = forward - strike;
          // Les forwards n'ont pas de grecques (dérivées linéaires)
          greeks = { delta: 1, gamma: 0, theta: 0, vega: 0, rho: 0 };
        } else if (strategyComponent.type === 'swap') {
          const forward = calculateCommodityForwardPrice(spot, b, 0, 0, pricingInputs.timeToMaturity);
          price = PricingService.calculateSwapPrice(
            [forward],
            [pricingInputs.timeToMaturity],
            getRiskFreeRate()
          );
          // Les swaps n'ont pas de grecques significatives
          greeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
        } else if (strategyComponent.type === 'call' || strategyComponent.type === 'put') {
          price = calculateVanillaSpotMcOrBs(
            strategyComponent.type,
            S,
            K,
            r,
            b,
            t,
            sigma,
            optionPricingModel === 'monte-carlo' ? 'monte-carlo' : 'black-scholes'
          );
          greeks = PricingService.calculateGreeks(
            strategyComponent.type,
            S,
            K,
            r,
            b,
            t,
            sigma
          );
        } else if (strategyComponent.type.includes('knockout') || strategyComponent.type.includes('knockin')) {
          // ✅ BARRIER OPTIONS — STRICTEMENT COMME STRATEGY BUILDER
          if (barrierPricingModel === 'closed-form') {
            price = PricingService.calculateBarrierOptionClosedForm(
              strategyComponent.type,
              S,
              K,
              r,
              t,
              sigma,
              barrier || 0,
              secondBarrier,
              b, // Cost of carry
              barrierOptionSimulations || 1000
            );
          } else {
            price = PricingService.calculateBarrierOptionPrice(
              strategyComponent.type,
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
          // Calculer les grecques pour les options barrières
          greeks = PricingService.calculateGreeks(
            strategyComponent.type,
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
          // ✅ DIGITAL OPTIONS — STRICTEMENT COMME STRATEGY BUILDER
          const rebate = strategyComponent.rebate !== undefined ? strategyComponent.rebate : 1;
          const numSimulations = barrierOptionSimulations || 10000;
          price = PricingService.calculateDigitalOptionPrice(
            strategyComponent.type,
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
          // Calculer les grecques pour les options digitales
          greeks = PricingService.calculateGreeks(
            strategyComponent.type,
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
        
        price = Math.max(0, price); // Strategy Builder assure que le prix n'est jamais négatif
        
        // Ajuster le prix et les grecques par la quantité
        const quantity = strategyComponent.quantity / 100;
        const adjustedPrice = price * quantity;
        
        // Ajuster les grecques par la quantité (sauf pour forward/swap)
        const adjustedGreeks = greeks ? {
          delta: greeks.delta * quantity,
          gamma: greeks.gamma * quantity,
          theta: greeks.theta * quantity,
          vega: greeks.vega * quantity,
          rho: greeks.rho * quantity
        } : { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
        
        return { 
          spot: parseFloat(spot.toFixed(4)), 
          price: adjustedPrice,
          delta: adjustedGreeks.delta,
          gamma: adjustedGreeks.gamma,
          theta: adjustedGreeks.theta,
          vega: adjustedGreeks.vega,
          rho: adjustedGreeks.rho
        };
      } catch (error) {
        console.warn('Error calculating price/greeks at spot', spot, error);
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

  // Calculer les données de prix et grecques
  const priceData = generatePriceData();

  return (
    <Layout 
      title="Commodity Pricers"
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Commodity Pricers" }
      ]}
    >
      <div className="space-y-8">
        {/* En-tête moderne */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Commodity Pricers</h1>
            <p className="text-lg text-muted-foreground">
              Advanced commodity pricing engine for options, swaps and forwards
            </p>
          </div>
          <Button 
            onClick={handleCalculateClick} 
            disabled={isCalculating}
            size="lg"
            className="flex items-center gap-3 px-8 py-3 text-base font-medium"
          >
            {isCalculating ? (
              <>
                <Clock className="w-5 h-5 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="w-5 h-5" />
                Calculate
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Panneau de configuration */}
          <div className="xl:col-span-1 space-y-6">
            {/* Sélection de l'instrument */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Settings className="w-6 h-6 text-primary" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Type d'instrument */}
                <div className="space-y-2">
                  <Label>Instrument Type</Label>
                  <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTRUMENT_TYPES.map((instrument) => (
                        <SelectItem key={instrument.value} value={instrument.value}>
                          {instrument.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ✅ AJOUT: Modèle de pricing pour les barrières */}
                {(selectedInstrument.includes('knockout') || selectedInstrument.includes('knockin')) && (
                  <div className="space-y-2">
                    <Label>Barrier Pricing Model</Label>
                    <Select value={barrierPricingModel} onValueChange={(value: 'closed-form' | 'monte-carlo') => setBarrierPricingModel(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="closed-form">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Closed-Form (Analytical)
                          </div>
                        </SelectItem>
                        <SelectItem value="monte-carlo">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Monte Carlo (Simulation)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      {barrierPricingModel === 'closed-form' 
                        ? 'Uses exact analytical formulas'
                        : 'Uses 1000 Monte Carlo simulations'
                      }
                    </div>
                  </div>
                )}

                {/* ✅ AJOUT: Modèle de pricing des vanilles (conforme Strategy Builder) */}
                {(selectedInstrument === 'call' || selectedInstrument === 'put') && (
                  <div className="space-y-2">
                    <Label>Vanilla Pricing Model</Label>
                    <Select value={optionPricingModel} onValueChange={(value: 'black-scholes' | 'monte-carlo') => setOptionPricingModel(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="black-scholes">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Black-Scholes (spot)
                          </div>
                        </SelectItem>
                        <SelectItem value="monte-carlo">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Monte Carlo (vanilla)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      Same behavior as Strategy Builder for vanilla options
                    </div>
                  </div>
                )}

                {/* ✅ NOTE: Strategy Builder utilise TOUJOURS le spot pour les options, pas le forward */}
                {/* L'option forward/spot a été supprimée pour rester strictement aligné avec Strategy Builder */}

                {/* ✅ AJOUT: Affichage des grecques */}
                {(selectedInstrument !== 'forward' && selectedInstrument !== 'swap') && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="greeks-toggle"
                        checked={showGreeks}
                        onCheckedChange={setShowGreeks}
                      />
                      <Label htmlFor="greeks-toggle" className="text-sm">
                        Calculate Greeks
                      </Label>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {showGreeks 
                        ? 'Delta, Gamma, Theta, Vega and Rho will be calculated with analytical formulas'
                        : 'Greeks will not be calculated (performance gain)'
                      }
                    </div>
                  </div>
                )}

                {/* Use Real Data Toggle */}
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={useRealData}
                        onCheckedChange={(checked) => {
                          setUseRealData(checked);
                          localStorage.setItem('pricersUseRealData', JSON.stringify(checked));
                          if (checked && useTickerPeekPro) {
                            setUseTickerPeekPro(false);
                            localStorage.setItem('pricersUseTickerPeekPro', 'false');
                          }
                        }}
                      />
                      <label className="text-sm font-medium text-foreground cursor-pointer" onClick={() => {
                        const next = !useRealData;
                        setUseRealData(next);
                        localStorage.setItem('pricersUseRealData', JSON.stringify(next));
                        if (next && useTickerPeekPro) {
                          setUseTickerPeekPro(false);
                          localStorage.setItem('pricersUseTickerPeekPro', 'false');
                        }
                      }}>
                        Use Real Data from Commodity Market
                      </label>
                    </div>
                    {useRealData && (
                      <span className="text-xs text-muted-foreground">
                        {loadingRealCommodities ? 'Loading...' : `${realCommodities.length} commodities available`}
                      </span>
                    )}
                  </div>
                  {useRealData && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Real-time prices from Commodity Market will be used.
                    </p>
                  )}
                </div>

                {/* Use Ticker Peek Pro Toggle */}
                <div className={`p-2.5 rounded-lg border ${useTickerPeekPro ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' : 'bg-muted/30 border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={useTickerPeekPro}
                        onCheckedChange={(checked) => {
                          setUseTickerPeekPro(checked);
                          localStorage.setItem('pricersUseTickerPeekPro', JSON.stringify(checked));
                          if (checked && useRealData) {
                            setUseRealData(false);
                            localStorage.setItem('pricersUseRealData', 'false');
                          }
                        }}
                      />
                      <label className="text-sm font-medium text-foreground cursor-pointer" onClick={() => {
                        const next = !useTickerPeekPro;
                        setUseTickerPeekPro(next);
                        localStorage.setItem('pricersUseTickerPeekPro', JSON.stringify(next));
                        if (next && useRealData) {
                          setUseRealData(false);
                          localStorage.setItem('pricersUseRealData', 'false');
                        }
                      }}>
                        Use Data from Ticker Peek Pro
                      </label>
                    </div>
                    {useTickerPeekPro && (
                      <span className="text-xs text-muted-foreground">
                        {tppLoadingCurrencies ? 'Loading...' : `${tppCurrencies.length} instruments`}
                      </span>
                    )}
                  </div>
                  {useTickerPeekPro && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Spot = interpolated futures price at maturity, Vol = interpolated from IV Matrix.
                      </p>
                      {tppLoadingFutures && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Loading Cash price...
                        </p>
                      )}
                      {tppLoadingSurface && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Building IV surface...
                        </p>
                      )}
                      {!tppLoadingSurface && tppSurfacePoints.length > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          IV Surface ready ({tppSurfacePoints.length} pts)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Commodity Selector */}
                <div className="space-y-2">
                  <Label>Commodity</Label>
                  <Select 
                    value={selectedCurrencyPair} 
                    onValueChange={setSelectedCurrencyPair}
                    onOpenChange={(open) => {
                      if (!open) {
                        setCommoditySearchQuery('');
                        setTppSearchQuery('');
                      }
                    }}
                    disabled={(useRealData && loadingRealCommodities) || (useTickerPeekPro && tppLoadingCurrencies)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        useTickerPeekPro && tppLoadingCurrencies ? "Loading TPP instruments..." :
                        useRealData && loadingRealCommodities ? "Loading commodities..." :
                        "Select commodity"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {useTickerPeekPro ? (
                        <>
                          <div className="p-2 border-b sticky top-0 bg-background z-10">
                            <Input
                              placeholder="Search by symbol or name..."
                              value={tppSearchQuery}
                              onChange={(e) => setTppSearchQuery(e.target.value)}
                              className="h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          {(() => {
                            const searchLower = tppSearchQuery.toLowerCase().trim();
                            const categoryConfig: { key: string; label: string; icon: string }[] = [
                              { key: 'energies', label: 'Energies', icon: '⚡' },
                              { key: 'metals', label: 'Metals', icon: '🔩' },
                              { key: 'grains', label: 'Grains', icon: '🌾' },
                              { key: 'livestock', label: 'Livestock', icon: '🐄' },
                            ];
                            const groups = categoryConfig.map(cat => {
                              const items = tppCurrenciesByCategory[cat.key] || [];
                              const filtered = searchLower
                                ? items.filter(c =>
                                    c.symbol.toLowerCase().includes(searchLower) ||
                                    c.name.toLowerCase().includes(searchLower))
                                : items;
                              return { ...cat, items: filtered };
                            }).filter(g => g.items.length > 0);

                            if (groups.length === 0) {
                              return (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  {tppSearchQuery ? `No results for "${tppSearchQuery}"` : 'No instruments loaded yet.'}
                                </div>
                              );
                            }
                            return groups.map(group => (
                              <div key={group.key}>
                                <div className="p-2 text-xs font-medium text-muted-foreground border-b border-t">
                                  {group.icon} {group.label}
                                </div>
                                {group.items.map(c => (
                                  <SelectItem key={c.symbol} value={c.symbol}>
                                    <div className="flex flex-col">
                                      <div className="flex justify-between items-center w-full">
                                        <span className="font-mono">{c.symbol}</span>
                                        <span className="text-xs text-muted-foreground font-mono ml-2">{c.last}</span>
                                      </div>
                                      <span className="text-xs text-muted-foreground">{c.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </div>
                            ));
                          })()}
                        </>
                      ) : useRealData && realCommodities.length > 0 ? (
                        <>
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
                        (() => {
                          const filteredPairs = getFilteredDefaultCommodities();
                          if (filteredPairs.length === 0) {
                            return (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No commodities available for selected domains.
                              </div>
                            );
                          }
                          return (
                            <>
                              {filteredPairs.map((pair) => (
                                <SelectItem key={pair.symbol} value={pair.symbol}>
                                  {pair.name}
                                </SelectItem>
                              ))}
                            </>
                          );
                        })()
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Dates (cohérent avec Strategy Builder) */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Calendar className="w-6 h-6 text-primary" />
                  Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Date de début */}
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={pricingInputs.startDate}
                    onChange={(e) => updatePricingInput('startDate', e.target.value)}
                  />
                </div>

                {/* Date de maturité */}
                <div className="space-y-2">
                  <Label>Maturity Date</Label>
                  <Input
                    type="date"
                    value={pricingInputs.maturityDate}
                    onChange={(e) => updatePricingInput('maturityDate', e.target.value)}
                  />
                </div>

                {/* Maturité calculée */}
                <div className="space-y-2">
                  <Label>Maturity (years)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pricingInputs.timeToMaturity.toFixed(2)}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Paramètres de base */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Basic Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prix spot */}
                <div className="space-y-2">
                  <Label>Spot Price ({selectedPair?.symbol || 'EUR/USD'})</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={pricingInputs.spotPrice}
                    onChange={(e) => updatePricingInput('spotPrice', parseFloat(e.target.value))}
                  />
                </div>

                {/* Prix d'exercice */}
                <div className="space-y-2">
                  <Label>Strike Price</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={strategyComponent.strike}
                      onChange={(e) => updateStrategyComponent('strike', parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <Select value={strategyComponent.strikeType} onValueChange={(value: 'percent' | 'absolute') => updateStrategyComponent('strikeType', value)}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">
                          <div className="flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            %
                          </div>
                        </SelectItem>
                        <SelectItem value="absolute">
                          <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            Abs
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {strategyComponent.strikeType === 'percent' 
                      ? `Absolute value: ${(pricingInputs.spotPrice * strategyComponent.strike / 100).toFixed(4)}`
                      : `Percentage: ${((strategyComponent.strike / pricingInputs.spotPrice) * 100).toFixed(2)}%`
                    }
                  </div>
                </div>

                {/* Quantité */}
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    step="1"
                    value={strategyComponent.quantity}
                    onChange={(e) => updateStrategyComponent('quantity', parseInt(e.target.value))}
                  />
                </div>

                {/* ✅ AJOUT: Notionnels bidirectionnels */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Notionnels</Label>
                  
                  {/* Volume principal */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Volume
                    </Label>
                    <Input
                      type="number"
                      step="1000"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value) || 0)}
                      className="text-right"
                    />
                  </div>
                  
                  {/* Indicateur de prix */}
                  <div className="text-xs text-muted-foreground text-center">
                    📊 Spot Price: {pricingInputs.spotPrice}
                  </div>
                </div>

                {/* Volatilité */}
                <div className="space-y-2">
                  <Label>Volatility (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={strategyComponent.volatility}
                      onChange={(e) => updateStrategyComponent('volatility', parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    {useTickerPeekPro && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleRefreshTppIV}
                        disabled={tppLoadingSurface || tppSurfacePoints.length === 0}
                        title="Refresh IV from TPP surface"
                      >
                        <RefreshCw className={`h-4 w-4 ${tppLoadingSurface ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Risk-free Rate - avec indicateur de mode */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                    Risk-free Rate (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                              {isCurveMode 
                                ? `Mode Courbe: Taux interpolé depuis la courbe bootstrappée (IRS + Futures) pour une maturité de ${pricingInputs.timeToMaturity.toFixed(2)} an(s).`
                                : `Mode Fixe: Bank Rate ${getSelectedCurrency} depuis Settings.`}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                  </Label>
                    <Badge 
                      variant={isCurveMode ? "default" : "secondary"} 
                      className="text-xs"
                    >
                      {isCurveMode ? (
                        <><LineChart className="w-3 h-3 mr-1" />Curve</>
                      ) : (
                        <><Target className="w-3 h-3 mr-1" />Bank Rate</>
                      )}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={pricingInputs.interestRate}
                    onChange={(e) => updatePricingInput('interestRate', parseFloat(e.target.value))}
                      className="flex-1"
                  />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const newRate = getInterestRateForPricing;
                              setPricingInputs(prev => ({ ...prev, interestRate: newRate }));
                              toast({
                                title: "Rate Updated",
                                description: `Rate reset to ${newRate.toFixed(2)}% (${isCurveMode ? 'Curve' : 'Bank Rate'} - ${getSelectedCurrency})`,
                              });
                            }}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reset to market rate</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getSelectedCurrency} • {isCurveMode ? `Maturité: ${pricingInputs.timeToMaturity.toFixed(2)}Y` : "Bank Rate"}
                  </p>
                </div>


                {/* Barrière - visible par défaut pour les options avec barrières */}
                {(selectedInstrument.includes('knockout') || selectedInstrument.includes('knockin') || selectedInstrument.includes('touch')) && (
                  <div className="space-y-2">
                    <Label>Barrier</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={strategyComponent.barrier ?? ''}
                        onChange={(e) => updateStrategyComponent('barrier', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <Select value={strategyComponent.barrierType || 'percent'} onValueChange={(value: 'percent' | 'absolute') => updateStrategyComponent('barrierType', value)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">
                            <div className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              %
                            </div>
                          </SelectItem>
                          <SelectItem value="absolute">
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              Abs
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {strategyComponent.barrier !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {strategyComponent.barrierType === 'percent' 
                          ? `Absolute value: ${(spot * strategyComponent.barrier / 100).toFixed(4)}`
                          : `Percentage: ${((strategyComponent.barrier / spot) * 100).toFixed(2)}%`
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Deuxième barrière - visible par défaut pour les options double */}
                {selectedInstrument.includes('double') && (
                  <div className="space-y-2">
                    <Label>Second Barrier</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={strategyComponent.secondBarrier ?? ''}
                        onChange={(e) => updateStrategyComponent('secondBarrier', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <Select value={strategyComponent.barrierType || 'percent'} onValueChange={(value: 'percent' | 'absolute') => updateStrategyComponent('barrierType', value)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">
                            <div className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              %
                            </div>
                          </SelectItem>
                          <SelectItem value="absolute">
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              Abs
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {strategyComponent.secondBarrier !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {strategyComponent.barrierType === 'percent' 
                          ? `Absolute value: ${(spot * strategyComponent.secondBarrier / 100).toFixed(4)}`
                          : `Percentage: ${((strategyComponent.secondBarrier / spot) * 100).toFixed(2)}%`
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Paramètres spécifiques aux options digitales */}
                {(selectedInstrument.includes('touch') || selectedInstrument.includes('binary')) && (
                  <>
                    {/* Rebate - pour toutes les options digitales */}
                    <div className="space-y-2">
                      <Label>Rebate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={strategyComponent.rebate || 1.0}
                        onChange={(e) => updateStrategyComponent('rebate', parseFloat(e.target.value))}
                        placeholder="1.0"
                      />
                      <div className="text-xs text-muted-foreground">
                        Rebate amount as percentage of notional (default: 1%)
                      </div>
                    </div>

                    {/* Time to Payoff - spécifique aux one-touch */}
                    {selectedInstrument === 'one-touch' && (
                      <div className="space-y-2">
                        <Label>Time to Payoff (years)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={strategyComponent.timeToPayoff || 1.0}
                          onChange={(e) => updateStrategyComponent('timeToPayoff', parseFloat(e.target.value))}
                          placeholder="1.0"
                        />
                        <div className="text-xs text-muted-foreground">
                          Time to payoff for one-touch options (default: 1 year)
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Paramètres avancés */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-xl">
                  Advanced Parameters
                  <Switch
                    checked={showAdvanced}
                    onCheckedChange={setShowAdvanced}
                  />
                </CardTitle>
              </CardHeader>
              {showAdvanced && (
                <CardContent className="space-y-4">
                  {/* Nombre de simulations */}
                  <div className="space-y-2">
                    <Label>Number of Simulations</Label>
                    <Input
                      type="number"
                      step="100"
                      value={pricingInputs.numSimulations}
                      onChange={(e) => updatePricingInput('numSimulations', parseInt(e.target.value))}
                    />
                    <div className="text-xs text-muted-foreground">
                      Used for Monte Carlo simulations (default: 1000 like Strategy Builder)
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Résultats */}
          <div className="xl:col-span-3 space-y-8">
            {/* Résultats de pricing */}
            {pricingResults.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    Pricing Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {pricingResults.map((result, index) => (
                      <Card key={index} className="p-6 border-0 shadow-md">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={getMethodColor(result.method)}>
                            <div className="flex items-center gap-1">
                              {getMethodIcon(result.method)}
                              {result.method}
                            </div>
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Prix:</span>
                            <span className="font-mono font-bold text-lg">
                              {formatPrice(result.price)}
                            </span>
                          </div>

                          {result.greeks && (
                            <div className="pt-2 border-t">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Analytical Greeks:</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className={`${getGreekColor(result.greeks.delta, 'delta')}`}>
                                  <span className="font-medium">Δ (Delta):</span><br/>
                                  {formatGreek(result.greeks.delta)}
                                </div>
                                <div className={`${getGreekColor(result.greeks.gamma, 'gamma')}`}>
                                  <span className="font-medium">Γ (Gamma):</span><br/>
                                  {formatGreek(result.greeks.gamma)}
                                </div>
                                <div className={`${getGreekColor(result.greeks.theta, 'theta')}`}>
                                  <span className="font-medium">Θ (Theta):</span><br/>
                                  {formatGreek(result.greeks.theta)}
                                </div>
                                <div className={`${getGreekColor(result.greeks.vega, 'vega')}`}>
                                  <span className="font-medium">Vega:</span><br/>
                                  {formatGreek(result.greeks.vega)}
                                </div>
                                <div className={`${getGreekColor(result.greeks.rho, 'rho')}`}>
                                  <span className="font-medium">ρ (Rho):</span><br/>
                                  {formatGreek(result.greeks.rho)}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                <strong>Interpretation:</strong><br/>
                                Δ: Sensitivity to underlying price<br/>
                                Γ: Delta sensitivity to price<br/>
                                Θ: Time decay<br/>
                                Vega: Sensitivity to volatility<br/>
                                ρ: Sensitivity to interest rates
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Résumé de la transaction */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Transaction Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Volume</span><br/>
                    <span className="text-lg font-semibold">{volume.toLocaleString()}</span>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Spot Price</span><br/>
                    <span className="text-lg font-semibold">{spot}</span>
                  </div>
                  {(selectedInstrument !== 'forward' && selectedInstrument !== 'swap') && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <span className="font-semibold text-sm text-muted-foreground">Underlying Price</span><br/>
                      <span className="text-lg font-semibold">
                        {underlyingPriceType === 'forward' 
                          ? `${calculateCommodityForwardPrice(spot, getRiskFreeRate(), 0, 0, pricingInputs.timeToMaturity).toFixed(4)} (Forward)`
                          : `${spot} (Spot)`
                        }
                      </span>
                    </div>
                  )}
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Absolute Strike</span><br/>
                    <span className="text-lg font-semibold">{strikeAbs.toFixed(4)}</span>
                  </div>
                  {/* ✅ Afficher les barrières selon le type d'option */}
                  {(selectedInstrument.includes('knockout') || selectedInstrument.includes('knockin') || selectedInstrument.includes('touch') || selectedInstrument.includes('binary')) && (
                    <>
                      {/* ✅ Barrier 1 - toujours affiché pour les options avec barrières */}
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <span className="font-semibold text-sm text-muted-foreground">Barrier 1</span><br/>
                        <span className="text-lg font-semibold">{barrierAbs ? barrierAbs.toFixed(4) : '-'}</span>
                      </div>
                      
                      {/* ✅ Barrier 2 - seulement pour les options double barrière */}
                      {selectedInstrument.includes('double') && (
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <span className="font-semibold text-sm text-muted-foreground">Barrier 2</span><br/>
                          <span className="text-lg font-semibold">{secondBarrierAbs ? secondBarrierAbs.toFixed(4) : '-'}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Risk-free Rate</span><br/>
                    <span className="text-lg font-semibold">{pricingInputs.interestRate}%</span>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Storage Cost</span><br/>
                    <span className="text-lg font-semibold">{(pricingInputs.storageCost || 0).toFixed(2)}%</span>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Convenience Yield</span><br/>
                    <span className="text-lg font-semibold">{(pricingInputs.convenienceYield || 0).toFixed(2)}%</span>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Volatility</span><br/>
                    <span className="text-lg font-semibold">{strategyComponent.volatility}%</span>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-semibold text-sm text-muted-foreground">Maturity</span><br/>
                    <span className="text-lg font-semibold">{pricingInputs.timeToMaturity.toFixed(2)} years</span>
                  </div>
                </div>
              </CardContent>
            </Card>



            {/* Prime totale */}
            {pricingResults.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Total Premium</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex flex-col gap-3 text-lg">
                    <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                      <span className="font-semibold">Premium:</span>
                      <span className="font-mono text-xl">{premium.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Affichage du graphique Payoff/Commodity Hedging/Price/Greeks */}
            <Card className="border-0 shadow-lg">
              <PayoffChart
                data={payoffData}
                strategy={[strategyComponent]}
                spot={pricingInputs.spotPrice}
                currencyPair={selectedPair}
                includePremium={true}
                showPremiumToggle={true}
                realPremium={pricingResults.length > 0 ? pricingResults[0].price : undefined}
                priceData={priceData}
              />
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Pricers;