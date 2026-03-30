import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useTickerPeekPro, type TppCurrencyData } from "@/hooks/useTickerPeekPro";
import { 
  Plus, 
  Shield, 
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  ArrowUpDown,
  BarChart3,
  Edit,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  Calculator,
  RefreshCw,
  Loader2
} from "lucide-react";
import StrategyImportService, { HedgingInstrument } from "@/services/StrategyImportService";
import {
  barrierMonteCarloNumSteps,
  calculateBarrierOptionClosedForm,
  calculateBlack76Price,
  calculateCommodityForwardPrice,
  calculateDigitalOptionPrice,
  calculateOptionPrice,
  calculatePricesFromPaths,
  calculateTimeToMaturity,
  calculateUnderlyingPrice,
  calculateVanillaOptionMonteCarlo,
  clampOptionPriceNonNegative,
  commodityExpiredSettlementValue,
  commodityUndiscountedForwardValue,
  daysToMaturityFromYearsAct36525,
  dteClampedForVolatilitySurface,
  generateBarrierMonteCarloPathsForPricing,
  getDte,
  impliedVolSurfacePointToDecimal,
  orderedDoubleBarrierLevels,
  readStrategyBuilderPricingFromStorage,
  roundPrice4,
  roundPrice6,
  strategyBuilderAnnualPercentToDecimal,
} from "@/services/PricingService";
import { Commodity } from "@/services/commodityApi";
import { CURRENCY_PAIRS } from "@/pages/Index";
import { useInterestRates } from '@/hooks/useInterestRates';
import { getOrBuildCurve, interpolatePrice } from '@/lib/ticker-peek-pro/futuresCurve';
import {
  fetchFutures,
  fetchVolSurface,
  fetchVolSurfaceStrikes,
  type SurfacePoint,
  type FuturesContract,
} from "@/lib/ticker-peek-pro/barchart";
import { interpolateSurface } from "@/lib/ticker-peek-pro/volSurfaceInterpolation";
// ✅ Types d'instruments alignés avec Strategy Builder / Pricers (mêmes libellés que StrategyImportService)
const HEDGING_INSTRUMENT_TYPES = [
  { value: "Vanilla Call", label: "Vanilla Call" },
  { value: "Vanilla Put", label: "Vanilla Put" },
  { value: "Forward", label: "Forward" },
  { value: "Swap", label: "Swap" },
  { value: "Knock-Out Call", label: "Knock-Out Call" },
  { value: "Reverse Knock-Out Call", label: "Reverse Knock-Out Call" },
  { value: "Double Knock-Out Call", label: "Double Knock-Out Call" },
  { value: "Knock-Out Put", label: "Knock-Out Put" },
  { value: "Reverse Knock-Out Put", label: "Reverse Knock-Out Put" },
  { value: "Double Knock-Out Put", label: "Double Knock-Out Put" },
  { value: "Knock-In Call", label: "Knock-In Call" },
  { value: "Reverse Knock-In Call", label: "Reverse Knock-In Call" },
  { value: "Double Knock-In Call", label: "Double Knock-In Call" },
  { value: "Knock-In Put", label: "Knock-In Put" },
  { value: "Reverse Knock-In Put", label: "Reverse Knock-In Put" },
  { value: "Double Knock-In Put", label: "Double Knock-In Put" },
  { value: "One-Touch", label: "One-Touch (beta)" },
  { value: "Double-Touch", label: "Double-Touch (beta)" },
  { value: "No-Touch", label: "No-Touch (beta)" },
  { value: "Double-No-Touch", label: "Double-No-Touch (beta)" },
  { value: "Range Binary", label: "Range Binary (beta)" },
  { value: "Outside Binary", label: "Outside Binary (beta)" },
];
// ✅ Mapping des symboles de commodity aux symboles TradingView pour récupérer les prix réels
const COMMODITY_SYMBOL_MAP: { [key: string]: { tradingViewSymbol: string; category: 'metals' | 'agricultural' | 'energy' | 'freight' | 'bunker' } } = {
  // Energy
  'WTI': { tradingViewSymbol: 'CL1!', category: 'energy' },
  'BRENT': { tradingViewSymbol: 'BRN1!', category: 'energy' },
  'NATGAS': { tradingViewSymbol: 'NG1!', category: 'energy' },
  'HEATING': { tradingViewSymbol: 'HO1!', category: 'energy' },
  'RBOB': { tradingViewSymbol: 'RB1!', category: 'energy' },
  
  // Precious Metals
  'GOLD': { tradingViewSymbol: 'GC1!', category: 'metals' },
  'SILVER': { tradingViewSymbol: 'SI1!', category: 'metals' },
  'PLATINUM': { tradingViewSymbol: 'PL1!', category: 'metals' },
  'PALLADIUM': { tradingViewSymbol: 'PA1!', category: 'metals' },
  
  // Base Metals
  'COPPER': { tradingViewSymbol: 'HG1!', category: 'metals' },
  'ALUMINUM': { tradingViewSymbol: 'ALI1!', category: 'metals' },
  'ZINC': { tradingViewSymbol: 'ZN1!', category: 'metals' },
  'NICKEL': { tradingViewSymbol: 'NI1!', category: 'metals' },
  
  // Agriculture
  'CORN': { tradingViewSymbol: 'ZC1!', category: 'agricultural' },
  'WHEAT': { tradingViewSymbol: 'ZW1!', category: 'agricultural' },
  'SOYBEAN': { tradingViewSymbol: 'ZS1!', category: 'agricultural' },
  'COTTON': { tradingViewSymbol: 'CT1!', category: 'agricultural' },
  'SUGAR': { tradingViewSymbol: 'SB1!', category: 'agricultural' },
  'COFFEE': { tradingViewSymbol: 'KC1!', category: 'agricultural' },
  
  // Livestock
  'CATTLE': { tradingViewSymbol: 'LE1!', category: 'agricultural' },
  'HOGS': { tradingViewSymbol: 'HE1!', category: 'agricultural' },
};

/** Map HedgingInstruments commodity (e.g. WTI or TPP symbol CL) to Ticker Peek Pro futures symbol (e.g. CL). */
function getTppSymbolForCommodity(currency: string): string | null {
  if (!currency || typeof currency !== "string") return null;
  const m = COMMODITY_SYMBOL_MAP[currency];
  if (m?.tradingViewSymbol) {
    const s = m.tradingViewSymbol;
    return s.replace(/\d+!?$/g, "").replace("!", "").trim() || s.slice(0, 3);
  }
  // Instrument may store TPP symbol directly (e.g. "CL", "NG") when added via Ticker Peek Pro
  const trimmed = currency.trim().toUpperCase();
  if (trimmed.length >= 1 && trimmed.length <= 5) return trimmed;
  return null;
}

function parseValuationDateToLocal(valuationDate: string): Date {
  const [y, m, d] = valuationDate.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Note: keep all pricing-related helpers centralized in PricingService.

// Interface pour les paramètres de marché par commodity
interface CommodityMarketData {
  spot: number;
  volatility: number;
  riskFreeRate: number;
}

/**
 * HedgingInstruments.tsx - Commodity Hedging Instruments Management
 * 
 * ✅ MODIFICATIONS APPORTÉES :
 * - Utilisation STRICTE des fonctions de pricing de Strategy Builder
 * - Black-Scholes et Monte Carlo pour les options call/put simples
 * - Closed-form pour les options avec barrières (SIMPLE ET DOUBLE)
 * - Suppression de TOUTES les implémentations liées au Forex
 * - Utilisation de calculateOptionPrice() comme fonction principale
 * - Cohérence parfaite avec Strategy Builder
 * 
 * ✅ OPTIONS DOUBLE BARRIÈRE :
 * - Logique de détermination des barrières inférieure/supérieure identique à Strategy Builder
 * - L = Math.min(barrier, secondBarrier) = barrière inférieure
 * - U = Math.max(barrier, secondBarrier) = barrière supérieure
 * - Utilise calculateBarrierOptionClosedForm avec formules analytiques complètes
 * - Gestion correcte des types : call-double-knockout, put-double-knockout, etc.
 * - PRIORITÉ ABSOLUE dans le mapping des types pour éviter la confusion avec les barrières simples
 * - Détection et logs spécifiques pour les options double barrière
 * - Affichage distinctif "closed-form (double)" dans l'interface utilisateur
 * 
 * ✅ OPTIONS VANILLES (call/put) : calculateBlack76Price / calculateVanillaOptionMonteCarlo (PricingService)
 */
const HedgingInstruments = () => {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showExportColumns, setShowExportColumns] = useState(false);
  
  // ── Interest Rates from Rate Explorer ──
  const {
    mode: interestRateMode,
    isCurveMode,
    getRate,
    fixedRates,
    hasCurveData
  } = useInterestRates();

  /** Reference display only: 1Y USD rate from Rate Explorer settings (curve or fixed). Per-row pricing uses getRate(USD, TTM). */
  const usdRate1YDisplayPct = useMemo(() => getRate("USD", 1) * 100, [getRate]);
  
  // ── Ticker Peek Pro Integration ──
  const tpp = useTickerPeekPro();
  const [useTppData, setUseTppData] = useState(() => {
    try {
      const saved = localStorage.getItem('hedgingUseTickerPeekPro');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [tppSearchQuery, setTppSearchQuery] = useState('');
  
  // Helper pour parser les nombres en tenant compte des virgules (ex: "1,0850")
  const parseInputNumber = (value: string | number | undefined, defaultValue = 0): number => {
    if (value === undefined || value === null) return defaultValue;
    const str = value.toString().replace(',', '.');
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : defaultValue;
  };

  // Add Instrument form state (tous les inputs comme dans Pricers)
  const [addFormType, setAddFormType] = useState("");
  const [addFormCommodity, setAddFormCommodity] = useState("");
  const [addFormNotional, setAddFormNotional] = useState("1000000");
  const [addFormRate, setAddFormRate] = useState("75.50"); // default strike = spot
  const [addFormStrikeType, setAddFormStrikeType] = useState<"percent" | "absolute">("absolute");
  const [addFormStartDate, setAddFormStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addFormMaturity, setAddFormMaturity] = useState("");
  const [addFormSpotPrice, setAddFormSpotPrice] = useState("75.50");
  const [addFormQuantity, setAddFormQuantity] = useState("100");
  const [addFormVolatility, setAddFormVolatility] = useState("25");
  const [addFormInterestRate, setAddFormInterestRate] = useState("4.5");
  const [addFormBarrier, setAddFormBarrier] = useState("");
  const [addFormSecondBarrier, setAddFormSecondBarrier] = useState("");
  const [addFormBarrierType, setAddFormBarrierType] = useState<"percent" | "absolute">("percent");
  const [addFormRebate, setAddFormRebate] = useState("1");
  const [addFormTimeToPayoff, setAddFormTimeToPayoff] = useState("1");
  const [addFormStorageCost, setAddFormStorageCost] = useState("0");
  const [addFormConvenienceYield, setAddFormConvenienceYield] = useState("0");
  const [addFormCounterparty, setAddFormCounterparty] = useState("");
  const [addFormPortfolio, setAddFormPortfolio] = useState("");
  const [addFormRealPrice, setAddFormRealPrice] = useState("");

  // Portfolios and counterparties (persisted in localStorage)
  type PortfolioOrCounterparty = { id: string; name: string };
  const DEFAULT_COUNTERPARTIES: PortfolioOrCounterparty[] = [
    { id: "deutsche-bank", name: "Deutsche Bank" },
    { id: "hsbc", name: "HSBC" },
    { id: "jpmorgan", name: "JPMorgan" },
    { id: "bnp-paribas", name: "BNP Paribas" },
  ];
  const loadList = <T,>(key: string, defaultVal: T): T => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : defaultVal;
    } catch { return defaultVal; }
  };
  const [portfolios, setPortfolios] = useState<PortfolioOrCounterparty[]>(() =>
    loadList("hedgingPortfolios", [])
  );
  const [counterparties, setCounterparties] = useState<PortfolioOrCounterparty[]>(() =>
    loadList("hedgingCounterparties", DEFAULT_COUNTERPARTIES)
  );
  const [filterByPortfolio, setFilterByPortfolio] = useState<string>("");
  const [filterByCounterparty, setFilterByCounterparty] = useState<string>("");
  const [isAddPortfolioOpen, setIsAddPortfolioOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [isAddCounterpartyOpen, setIsAddCounterpartyOpen] = useState(false);
  const [newCounterpartyName, setNewCounterpartyName] = useState("");

  const savePortfolios = useCallback((list: PortfolioOrCounterparty[]) => {
    setPortfolios(list);
    localStorage.setItem("hedgingPortfolios", JSON.stringify(list));
  }, []);
  const saveCounterparties = useCallback((list: PortfolioOrCounterparty[]) => {
    setCounterparties(list);
    localStorage.setItem("hedgingCounterparties", JSON.stringify(list));
  }, []);

  const addPortfolio = useCallback(() => {
    const name = newPortfolioName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `portfolio-${Date.now()}`;
    if (portfolios.some((p) => p.id === id)) {
      toast({ title: "Portfolio exists", description: "A portfolio with this name already exists.", variant: "destructive" });
      return;
    }
    savePortfolios([...portfolios, { id, name }]);
    setNewPortfolioName("");
    setIsAddPortfolioOpen(false);
    setAddFormPortfolio(id);
    toast({ title: "Portfolio added", description: `"${name}" has been added.` });
  }, [newPortfolioName, portfolios, savePortfolios, toast]);

  const addCounterparty = useCallback(() => {
    const name = newCounterpartyName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `counterparty-${Date.now()}`;
    if (counterparties.some((c) => c.id === id)) {
      toast({ title: "Counterparty exists", description: "A counterparty with this name already exists.", variant: "destructive" });
      return;
    }
    saveCounterparties([...counterparties, { id, name }]);
    setNewCounterpartyName("");
    setIsAddCounterpartyOpen(false);
    setAddFormCounterparty(id);
    toast({ title: "Counterparty added", description: `"${name}" has been added.` });
  }, [newCounterpartyName, counterparties, saveCounterparties, toast]);

  const addFormTimeToMaturity = useMemo(() => {
    if (!addFormStartDate || !addFormMaturity) return 1;
    return calculateTimeToMaturity(addFormMaturity, addFormStartDate);
  }, [addFormStartDate, addFormMaturity]);
  const addFormDte = useMemo(() => {
    return daysToMaturityFromYearsAct36525(addFormTimeToMaturity);
  }, [addFormTimeToMaturity]);

  // Load TPP currencies when enabled
  useEffect(() => {
    if (useTppData) {
      tpp.loadAllTppCurrencies();
    }
  }, [useTppData, tpp.loadAllTppCurrencies]);

  // Default strike = spot when opening Add Instrument dialog
  useEffect(() => {
    if (isAddDialogOpen && addFormSpotPrice) {
      setAddFormRate(addFormSpotPrice);
    }
  }, [isAddDialogOpen]); // only when dialog opens; addFormSpotPrice may update after

  // Helper to get TPP symbol - when TPP is enabled, addFormCommodity IS the TPP symbol (e.g. "CL")
  // When TPP is disabled, we need to convert CURRENCY_PAIRS symbol (e.g. "WTI") to TPP symbol (e.g. "CL")
  const getEffectiveTppSymbol = useCallback((commodity: string): string | null => {
    if (useTppData) {
      // When TPP is enabled, the commodity IS the TPP symbol
      return commodity;
    }
    // When TPP is disabled, convert from CURRENCY_PAIRS symbol
    return getTppSymbolForCommodity(commodity);
  }, [useTppData]);

  // Load TPP data (futures + IV surface) when commodity changes
  useEffect(() => {
    if (useTppData && addFormCommodity && isAddDialogOpen) {
      // When TPP is enabled, addFormCommodity is already the TPP symbol (e.g. "CL")
      tpp.loadTppData(addFormCommodity).then(result => {
        if (result.spotPrice != null) {
          const spot = String(result.spotPrice.toFixed(4));
          setAddFormSpotPrice(spot);
          setAddFormRate(spot); // default strike = spot
          toast({
            title: "Ticker Peek Pro",
            description: `Spot price loaded: ${result.spotPrice.toFixed(2)} (${result.futuresCount} contracts)`,
          });
        }
        if (result.surfacePointsCount > 0) {
          toast({
            title: "IV Surface Loaded",
            description: `${result.surfacePointsCount} data points for vol interpolation`,
          });
        }
      });
    }
  }, [useTppData, addFormCommodity, isAddDialogOpen, tpp.loadTppData, toast]);

  // Auto-interpolate IV from TPP surface when strike/maturity changes
  useEffect(() => {
    if (!useTppData || tpp.tppSurfacePoints.length === 0 || !addFormCommodity || !isAddDialogOpen) return;
    const spotPrice = parseFloat(addFormSpotPrice) || 0;
    const strikeValue = parseFloat(addFormRate) || 0;
    const absoluteStrike = addFormStrikeType === 'percent' ? spotPrice * (strikeValue / 100) : strikeValue;
    const dte = dteClampedForVolatilitySurface(addFormDte);
    const type: 'call' | 'put' = addFormType.toLowerCase().includes('put') ? 'put' : 'call';
    const iv = tpp.interpolateTppIV(absoluteStrike, dte, type);
    if (iv !== null && iv > 0) {
      const ivPct = iv * 100;
      setAddFormVolatility(ivPct.toFixed(2));
    }
  }, [useTppData, tpp.tppSurfacePoints, addFormRate, addFormStrikeType, addFormSpotPrice, addFormDte, addFormType, isAddDialogOpen, addFormCommodity, tpp.interpolateTppIV]);

  // Manual refresh IV from TPP surface
  const handleRefreshTppIV = useCallback(() => {
    if (!useTppData || tpp.tppSurfacePoints.length === 0) {
      toast({ title: "IV Refresh", description: "No TPP surface data available.", variant: "destructive" });
      return;
    }
    const spotPrice = parseFloat(addFormSpotPrice) || 0;
    const strikeValue = parseFloat(addFormRate) || 0;
    const absoluteStrike = addFormStrikeType === 'percent' ? spotPrice * (strikeValue / 100) : strikeValue;
    const dte = dteClampedForVolatilitySurface(addFormDte);
    const type: 'call' | 'put' = addFormType.toLowerCase().includes('put') ? 'put' : 'call';
    const iv = tpp.interpolateTppIV(absoluteStrike, dte, type);
    if (iv !== null && iv > 0) {
      const ivPct = iv * 100;
      setAddFormVolatility(ivPct.toFixed(2));
      toast({ title: "IV Updated", description: `Volatility set to ${ivPct.toFixed(2)}% from TPP surface (Strike: ${absoluteStrike.toFixed(2)}, DTE: ${dte})` });
    } else {
      toast({ title: "IV Refresh", description: "Could not interpolate IV for current strike/maturity.", variant: "destructive" });
    }
  }, [useTppData, tpp.tppSurfacePoints, addFormRate, addFormStrikeType, addFormSpotPrice, addFormDte, addFormType, tpp.interpolateTppIV, toast]);

  useEffect(() => {
    if (addFormCommodity && isAddDialogOpen && !useTppData) {
      const pair = CURRENCY_PAIRS.find((p) => p.symbol === addFormCommodity);
      if (pair) {
        const spot = String(pair.defaultSpotRate);
        setAddFormSpotPrice(spot);
        setAddFormRate(spot); // default strike = spot
      }
    }
  }, [addFormCommodity, isAddDialogOpen, useTppData]);

  // ✅ Fonction pour récupérer le prix réel depuis Commodity Market (déclarée avant les hooks qui l'utilisent)
  const getRealMarketPrice = useCallback((commoditySymbol: string): number | null => {
    const symbolMap = COMMODITY_SYMBOL_MAP[commoditySymbol];
    if (!symbolMap) return null;
    try {
      const cacheKey = `fx_commodities_cache_${symbolMap.category}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cacheData = JSON.parse(cached);
        if (cacheData.data && Array.isArray(cacheData.data)) {
          let commodity = cacheData.data.find((c: Commodity) =>
            c.symbol === symbolMap.tradingViewSymbol ||
            c.symbol.replace('!', '') === symbolMap.tradingViewSymbol.replace('!', '')
          );
          if (!commodity) {
            const symbolWithoutExcl = symbolMap.tradingViewSymbol.replace('!', '');
            commodity = cacheData.data.find((c: Commodity) =>
              c.symbol === symbolWithoutExcl ||
              c.symbol.replace('!', '') === symbolWithoutExcl
            );
          }
          if (commodity && commodity.price > 0) {
            return commodity.price;
          }
        }
      }
    } catch (error) {
      console.error(`[REAL MARKET PRICE] Error reading cache for ${commoditySymbol}:`, error);
    }
    return null;
  }, []);

  // ── Auto-update Spot Price from real market price (brut, non bootstrapé) ──
  useEffect(() => {
    if (!useTppData || !addFormCommodity || !isAddDialogOpen) return;
    const realSpot = getRealMarketPrice(addFormCommodity);
    if (realSpot != null && realSpot > 0) {
      const currentSpot = parseFloat(addFormSpotPrice) || 0;
      if (Math.abs(realSpot - currentSpot) > 0.01) {
        const spotStr = realSpot.toFixed(4);
        setAddFormSpotPrice(spotStr);
        setAddFormRate(spotStr);
      }
    }
  }, [useTppData, addFormCommodity, isAddDialogOpen, getRealMarketPrice]);

  // ── Taux sans risque interpolé à la maturité (même logique que Rate Explorer "Rates at custom date") ──
  const getInterestRateForPricing = useMemo(() => {
    const maturityYears = addFormTimeToMaturity ?? 0;
    const rate = getRate('USD', maturityYears); // Interpolation sur la courbe bootstrapée (ou Bank Rate si mode fixed)
    return rate * 100; // Convert to percentage
  }, [getRate, addFormTimeToMaturity]);

  useEffect(() => {
    if (!isAddDialogOpen) return;
    const newRate = getInterestRateForPricing;
    const currentRate = parseFloat(addFormInterestRate) || 0;
    if (Math.abs(newRate - currentRate) > 0.01) {
      setAddFormInterestRate(newRate.toFixed(2));
    }
  }, [getInterestRateForPricing, isAddDialogOpen]);

  // ── Manual refresh Interest Rate (interpolation à la maturité du formulaire) ──
  const handleRefreshInterestRate = useCallback(() => {
    const newRate = getInterestRateForPricing;
    setAddFormInterestRate(newRate.toFixed(2));
    toast({
      title: "Rate Updated",
      description: `Taux interpolé à la maturité: ${newRate.toFixed(2)}% (${isCurveMode ? 'courbe bootstrapée' : 'Bank Rate'} - USD)`,
    });
  }, [getInterestRateForPricing, isCurveMode, toast]);

  // ── Manual refresh Spot Price from real market data ──
  const handleRefreshTppSpot = useCallback(() => {
    if (!useTppData || !addFormCommodity) {
      toast({ title: "Spot Refresh", description: "No real market data available.", variant: "destructive" });
      return;
    }
    const realSpot = getRealMarketPrice(addFormCommodity);
    if (realSpot != null && realSpot > 0) {
      const spotStr = realSpot.toFixed(4);
      setAddFormSpotPrice(spotStr);
      setAddFormRate(spotStr);
      toast({
        title: "Spot Updated",
        description: `Spot price set to ${realSpot.toFixed(4)} (raw market price)`,
      });
    } else {
      toast({ title: "Spot Refresh", description: "Could not find real market price for this commodity.", variant: "destructive" });
    }
  }, [useTppData, addFormCommodity, getRealMarketPrice, toast]);

  const [instruments, setInstruments] = useState<HedgingInstrument[]>(() => {
    try {
      const saved = localStorage.getItem('hedgingInstruments');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading instruments from localStorage:', error);
      return [];
    }
  });
  const [importService] = useState(() => StrategyImportService.getInstance());
  
  // ✅ MTM Calculation states - maintenant par devise avec logique Strategy Builder
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split('T')[0]);
  
  // ✅ État pour utiliser les prix réels du Commodity Market
  const [useRealMarketPrices, setUseRealMarketPrices] = useState<boolean>(() => {
    const saved = localStorage.getItem('hedgingInstruments_useRealMarketPrices');
    return saved === 'true';
  });

  // Volatility from Pricers (calculatorState) – same as "Risk-free Rate" / volatility in Pricers
  const getRealVolatility = useCallback((): number | null => {
    try {
      const saved = localStorage.getItem('calculatorState');
      if (!saved) return null;
      const state = JSON.parse(saved);
      const vol = state?.strategyComponent?.volatility;
      return typeof vol === 'number' && vol > 0 ? vol : null;
    } catch {
      return null;
    }
  }, []);

  // Interpolate IV from TPP surface at (strike, dte). Returns IV in percentage (e.g. 25 for 25%).
  // Surface points can have iv as percentage (e.g. 69.69) or decimal (0.30); normalize to decimal before interpolating.
  const interpolateIVFromSurface = useCallback((
    surface: SurfacePoint[],
    absoluteStrike: number,
    dteDays: number,
    type: "call" | "put"
  ): number | null => {
    const filtered = surface.filter((p) => p.type === type);
    if (filtered.length === 0) return null;
    const strikes = [...new Set(filtered.map((p) => p.strike))].sort((a, b) => a - b);
    const dtes = [...new Set(filtered.map((p) => p.dte))].sort((a, b) => a - b);
    if (strikes.length < 2 || dtes.length < 2) return null;
    let z: (number | null)[][] = dtes.map((d) =>
      strikes.map((s) => {
        const point = filtered.find((p) => p.dte === d && p.strike === s);
        const iv = point?.iv;
        if (iv == null || iv <= 0) return null;
        return impliedVolSurfacePointToDecimal(iv);
      })
    );
    z = interpolateSurface(z, strikes, dtes);
    let si = strikes.findIndex((s) => s >= absoluteStrike);
    let di = dtes.findIndex((d) => d >= dteDays);
    if (si <= 0) si = 1;
    if (si >= strikes.length) si = strikes.length - 1;
    if (di <= 0) di = 1;
    if (di >= dtes.length) di = dtes.length - 1;
    const s0 = strikes[si - 1],
      s1 = strikes[si];
    const d0 = dtes[di - 1],
      d1 = dtes[di];
    const z00 = z[di - 1]?.[si - 1],
      z01 = z[di - 1]?.[si];
    const z10 = z[di]?.[si - 1],
      z11 = z[di]?.[si];
    const vals = [z00, z01, z10, z11].filter((v) => v !== null) as number[];
    if (vals.length === 0) return null;
    if (vals.length < 4) return (vals.reduce((a, b) => a + b, 0) / vals.length) * 100;
    const ts = s1 !== s0 ? (absoluteStrike - s0) / (s1 - s0) : 0.5;
    const td = d1 !== d0 ? (dteDays - d0) / (d1 - d0) : 0.5;
    const ivDecimal =
      z00! * (1 - ts) * (1 - td) + z01! * ts * (1 - td) + z10! * (1 - ts) * td + z11! * ts * td;
    return ivDecimal * 100;
  }, []);

  // Per-strike real-time IV from Ticker Peek Pro vol surface when "Use real-time data" is on
  const [realTimeVolByInstrumentId, setRealTimeVolByInstrumentId] = useState<Record<string, number>>({});
  const [tppSurfaceByCommodity, setTppSurfaceByCommodity] = useState<Record<string, SurfacePoint[]>>({});
  const [tppFuturesByCommodity, setTppFuturesByCommodity] = useState<Record<string, FuturesContract[]>>({});
  const [loadingRealTimeVol, setLoadingRealTimeVol] = useState(false);

  const [commodityMarketData, setCommodityMarketData] = useState<{ [commodity: string]: CommodityMarketData }>(() => {
    // Charger les données de marché depuis localStorage
    try {
      const saved = localStorage.getItem('commodityMarketData');
      if (saved) return JSON.parse(saved);
      
      return {};
    } catch (error) {
      console.error('Error loading commodity market data:', error);
      return {};
    }
  });
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [refreshingFuturesFromCurve, setRefreshingFuturesFromCurve] = useState(false);

  // Dialog states for view and edit actions
  const [selectedInstrument, setSelectedInstrument] = useState<HedgingInstrument | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Pricing model states - récupérer depuis le localStorage pour utiliser les mêmes paramètres que Strategy Builder
  const [optionPricingModel, setOptionPricingModel] = useState<'black-76' | 'black-scholes' | 'garman-kohlhagen' | 'monte-carlo'>(() => {
    const savedState = localStorage.getItem('calculatorState');
    if (savedState) {
      const state = JSON.parse(savedState);
      // Chercher optionPricingModel dans les paramètres sauvegardés
      return state.optionPricingModel || 'black-scholes';
    }
    return 'black-scholes';
  });
  
  const [barrierPricingModel, setBarrierPricingModel] = useState<'monte-carlo' | 'closed-form'>(() => {
    const savedState = localStorage.getItem('calculatorState');
    if (savedState) {
      const state = JSON.parse(savedState);
      return state.barrierPricingModel || 'closed-form';
    }
    return 'closed-form';
  });
  
  const [barrierOptionSimulations, setBarrierOptionSimulations] = useState<number>(() => {
    const savedState = localStorage.getItem('calculatorState');
    if (savedState) {
      const state = JSON.parse(savedState);
      return state.barrierOptionSimulations || 1000;
    }
    return 1000;
  });
  
  const [useImpliedVol, setUseImpliedVol] = useState<boolean>(() => {
    const savedState = localStorage.getItem('calculatorState');
    if (savedState) {
      const state = JSON.parse(savedState);
      return state.useImpliedVol || false;
    }
    return false;
  });
  
  const [impliedVolatilities, setImpliedVolatilities] = useState(() => {
    const savedState = localStorage.getItem('calculatorState');
    if (savedState) {
      const state = JSON.parse(savedState);
      return state.impliedVolatilities || {};
    }
    return {};
  });

  // Fonction pour extraire les commodities uniques des instruments
  const getUniqueCommodities = (instruments: HedgingInstrument[]): string[] => {
    const commodities = new Set<string>();
    instruments.forEach(instrument => {
      if (instrument.currency) {
        commodities.add(instrument.currency);
      }
    });
    return Array.from(commodities).sort();
  };

  // Fonction pour extraire les données de marché depuis les instruments exportés du Strategy Builder
  const getMarketDataFromInstruments = (commodity: string): CommodityMarketData | null => {
    const commodityInstruments = instruments.filter(inst => inst.currency === commodity);
    if (commodityInstruments.length === 0) return null;
    
    // Prendre les données du premier instrument de cette commodity
    const firstInstrument = commodityInstruments[0];
    
    return {
      spot: firstInstrument.exportSpotPrice || 1.0000,
      volatility: firstInstrument.exportVolatility || 20,
      riskFreeRate: firstInstrument.exportDomesticRate || 1.0
    };
  };

  // Charger les instruments depuis le service
  useEffect(() => {
    const loadInstruments = () => {
      const service = StrategyImportService.getInstance();
      const loadedInstruments = service.getHedgingInstruments();
      
      // LOG DE DIAGNOSTIC : Vérifier les données d'export
      if (loadedInstruments.length > 0) {
        const firstInstrument = loadedInstruments[0];
        console.log('[DEBUG] Premier instrument - Données d\'export:');
        console.log('  - exportSpotPrice:', firstInstrument.exportSpotPrice);
        console.log('  - exportDomesticRate:', firstInstrument.exportDomesticRate);
        console.log('  - exportForeignRate:', firstInstrument.exportForeignRate);
        console.log('  - exportVolatility:', firstInstrument.exportVolatility);
        console.log('  - exportTimeToMaturity:', firstInstrument.exportTimeToMaturity);
        console.log('  - exportForwardPrice:', firstInstrument.exportForwardPrice);
      }
      
      setInstruments(loadedInstruments);
      
      // Initialiser les données de marché pour les nouvelles commodities depuis les instruments exportés
      const uniqueCommodities = getUniqueCommodities(loadedInstruments);
      setCommodityMarketData(prevData => {
        const newData = { ...prevData };
        let hasUpdates = false;
        
        uniqueCommodities.forEach(commodity => {
          const exportData = getMarketDataFromInstruments(commodity);
          if (exportData) {
            // TOUJOURS mettre à jour avec les données d'export (pas seulement si absent)
            const currentData = newData[commodity];
            if (!currentData || 
                currentData.spot !== exportData.spot ||
                currentData.riskFreeRate !== exportData.riskFreeRate) {
              
              newData[commodity] = exportData;
              hasUpdates = true;
            }
          }
        });
        
        // Sauvegarder dans localStorage seulement si des mises à jour
        if (hasUpdates) {
          try {
            localStorage.setItem('commodityMarketData', JSON.stringify(newData));
          } catch (error) {
            console.error('Error saving commodity market data:', error);
          }
        }
        
        return newData;
      });
    };

    loadInstruments();
    
    // Listen for updates from Strategy Builder
    const handleUpdate = () => {
        loadInstruments();
    };

    window.addEventListener('hedgingInstrumentsUpdated', handleUpdate);
    return () => window.removeEventListener('hedgingInstrumentsUpdated', handleUpdate);
  }, []);

  // ✅ OPTIMISATION : Force re-calculation when valuation date changes
  useEffect(() => {
    if (instruments.length > 0) {
      // Force re-render to recalculate all Today Prices with new valuation date
      const updatedInstruments = instruments.map(instrument => ({ ...instrument }));
      setInstruments(updatedInstruments);
      
      // Show toast to confirm recalculation
      toast({
        title: "Valuation Date Updated",
        description: `Recalculating prices and MTM for ${instruments.length} instruments as of ${valuationDate}`,
      });
    }
  }, [valuationDate, toast, instruments.length]);

  // ✅ OPTIMISATION : Force re-calculation when market parameters change
  useEffect(() => {
    if (instruments.length > 0) {
      // Force re-render to recalculate all Today Prices and MTM with new market parameters
      const updatedInstruments = instruments.map(instrument => ({ ...instrument }));
      setInstruments(updatedInstruments);
    }
  }, [commodityMarketData, instruments.length]);

  // ✅ Force re-calculation when useRealMarketPrices changes
  useEffect(() => {
    if (instruments.length > 0) {
      console.log(`[🔄 REAL MARKET PRICES] Toggled to ${useRealMarketPrices} - Forcing recalculation of ${instruments.length} instruments`);
      // Force re-render to recalculate all Today Prices with real market prices
      const updatedInstruments = instruments.map(instrument => ({ ...instrument }));
      setInstruments(updatedInstruments);
    }
  }, [useRealMarketPrices, instruments.length]);

  // Load per-strike IV from Ticker Peek Pro vol surface + futures curves when "Use real-time data" is on
  useEffect(() => {
    if (!useRealMarketPrices || instruments.length === 0) {
      setRealTimeVolByInstrumentId({});
      setTppFuturesByCommodity({});
      return;
    }
    let cancelled = false;
    setLoadingRealTimeVol(true);
    const commodities = [...new Set(instruments.map((i) => i.currency).filter(Boolean))];
    const loadSurfacesFuturesAndFillVol = async () => {
      const nextSurfaces: Record<string, SurfacePoint[]> = {};
      const nextFutures: Record<string, FuturesContract[]> = {};
      for (const commodity of commodities) {
        const tppSym = getTppSymbolForCommodity(commodity);
        if (!tppSym || cancelled) continue;
        if (tppSurfaceByCommodity[commodity]?.length) {
          nextSurfaces[commodity] = tppSurfaceByCommodity[commodity];
        } else {
          try {
            const strikesRes = await fetchVolSurfaceStrikes(tppSym, tppSym, 50);
            if (cancelled || !strikesRes.success || !strikesRes.strikes?.length) { /* skip surface */ } else {
              const surfaceRes = await fetchVolSurface(
                tppSym,
                tppSym,
                50,
                false,
                strikesRes.strikes[0],
                strikesRes.strikes[strikesRes.strikes.length - 1]
              );
              if (!cancelled && surfaceRes.success && surfaceRes.surfacePoints?.length)
                nextSurfaces[commodity] = surfaceRes.surfacePoints;
            }
          } catch {
            // skip
          }
        }
        if (tppFuturesByCommodity[commodity]?.length) {
          nextFutures[commodity] = tppFuturesByCommodity[commodity];
        } else {
          try {
            const futuresRes = await fetchFutures(tppSym);
            if (!cancelled && futuresRes.success && futuresRes.data?.length)
              nextFutures[commodity] = futuresRes.data;
          } catch {
            // skip
          }
        }
      }
      if (cancelled) return;
      setTppSurfaceByCommodity((prev) => ({ ...prev, ...nextSurfaces }));
      setTppFuturesByCommodity((prev) => ({ ...prev, ...nextFutures }));
      const byId: Record<string, number> = {};
      for (const inst of instruments) {
        const surface = nextSurfaces[inst.currency] || tppSurfaceByCommodity[inst.currency];
        if (!surface?.length || !inst.maturity) continue;
    const dteDays = getDte(inst.maturity, valuationDate);
        if (dteDays <= 0) continue;
        const curveFwd = getCurrentForwardFromTppCurveInternal(
          nextFutures[inst.currency] || tppFuturesByCommodity[inst.currency],
          getTppSymbolForCommodity(inst.currency),
          inst.maturity,
          valuationDate
        );
        const spot = curveFwd ?? getRealMarketPrice(inst.currency) ?? commodityMarketData[inst.currency]?.spot ?? 75;
        const strike = inst.strike ?? spot;
        const type = inst.type.toLowerCase().includes("put") ? "put" : "call";
        const ivPct = interpolateIVFromSurface(surface, strike, dteDays, type);
        if (ivPct != null) byId[inst.id] = ivPct;
      }
      if (!cancelled) setRealTimeVolByInstrumentId(byId);
      setLoadingRealTimeVol(false);
    };
    loadSurfacesFuturesAndFillVol();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tppSurfaceByCommodity/tppFuturesByCommodity excluded to avoid infinite loop (effect updates them)
  }, [
    useRealMarketPrices,
    instruments,
    valuationDate,
    commodityMarketData,
    getRealMarketPrice,
    interpolateIVFromSurface,
  ]);

  // Courbe construite avec valuation date pour que le forward interpolé corresponde au bon tenor (valuation → maturité)
  function getCurrentForwardFromTppCurveInternal(
    futures: FuturesContract[] | undefined,
    tppSymbol: string | null,
    maturityDate: string,
    valuationDateStr: string
  ): number | null {
    if (!tppSymbol || !futures?.length) return null;
    const refDate = parseValuationDateToLocal(valuationDateStr);
    const curvePoints = getOrBuildCurve(tppSymbol, futures, refDate);
    if (curvePoints.length < 2) return null;
    const dte = getDte(maturityDate, valuationDateStr);
    if (dte < 0) return null;
    return interpolatePrice(curvePoints, dte);
  }

  const getCurrentForwardFromTppCurve = useCallback((
    commodity: string,
    maturityDate: string
  ): number | null => {
    const tppSym = getTppSymbolForCommodity(commodity);
    const futures = tppFuturesByCommodity[commodity];
    return getCurrentForwardFromTppCurveInternal(
      futures,
      tppSym,
      maturityDate,
      valuationDate
    );
  }, [tppFuturesByCommodity, valuationDate]);

  // Forward price affiché dans le formulaire Add Instrument (même logique que colonne Forward Price - Current et calculateTodayPrice)
  const addFormForwardPrice = useMemo((): number | null => {
    if (!addFormSpotPrice || addFormTimeToMaturity <= 0) return null;
    const spot = parseInputNumber(addFormSpotPrice);
    if (spot <= 0) return null;
    if (useTppData && addFormCommodity && tpp.tppFutures.length >= 2) {
      const refDate = new Date();
      const curvePoints = getOrBuildCurve(addFormCommodity, tpp.tppFutures, refDate);
      if (curvePoints.length >= 2) {
        const fromCurve = interpolatePrice(curvePoints, addFormDte);
        if (fromCurve != null && fromCurve > 0) return fromCurve;
      }
    }
    const r = parseInputNumber(addFormInterestRate) / 100;
    return calculateCommodityForwardPrice(spot, r, 0, 0, addFormTimeToMaturity);
  }, [addFormSpotPrice, addFormInterestRate, addFormTimeToMaturity, addFormDte, useTppData, addFormCommodity, tpp.tppFutures]);

  // Theo price / Unit Price (Initial) from Add form – utilise le forward price pour le pricing (même logique que calculateTodayPrice)
  const addFormTheoPrice = useMemo((): number | null => {
    if (!addFormType || !addFormSpotPrice || addFormTimeToMaturity <= 0) return null;
    const spot = parseInputNumber(addFormSpotPrice);
    const r = parseInputNumber(addFormInterestRate) / 100;
    const t = addFormTimeToMaturity; // raw ACT/365.25 TTM
    const sigma = parseInputNumber(addFormVolatility) / 100;
    const strikeVal = parseInputNumber(addFormRate);
    const strike = addFormStrikeType === "percent" ? (spot * strikeVal) / 100 : strikeVal;
    const S = addFormForwardPrice ?? calculateCommodityForwardPrice(spot, r, 0, 0, t);
    const K = strike;
    let mappedType = addFormType.toLowerCase();
    if (mappedType === "forward") return commodityUndiscountedForwardValue(S, K);
    if (mappedType === "vanilla call") mappedType = "call";
    if (mappedType === "vanilla put") mappedType = "put";
    if (mappedType === "call" || mappedType === "put") {
      if (optionPricingModel === "monte-carlo") {
        return clampOptionPriceNonNegative(
          calculateVanillaOptionMonteCarlo(mappedType, S, K, r, r, t, sigma, 1000)
        );
      }
      return clampOptionPriceNonNegative(calculateBlack76Price(mappedType, S, K, r, 0, t, sigma));
    }
    if (mappedType.includes("double")) {
      if (mappedType.includes("call") && (mappedType.includes("knockout") || mappedType.includes("knock-out"))) mappedType = "call-double-knockout";
      else if (mappedType.includes("put") && (mappedType.includes("knockout") || mappedType.includes("knock-out"))) mappedType = "put-double-knockout";
      else if (mappedType.includes("call") && (mappedType.includes("knockin") || mappedType.includes("knock-in"))) mappedType = "call-double-knockin";
      else if (mappedType.includes("put") && (mappedType.includes("knockin") || mappedType.includes("knock-in"))) mappedType = "put-double-knockin";
    } else if (mappedType.includes("knock-out") || mappedType.includes("knockout")) {
      mappedType = mappedType.includes("call") ? "call-knockout" : "put-knockout";
    } else if (mappedType.includes("knock-in") || mappedType.includes("knockin")) {
      mappedType = mappedType.includes("call") ? "call-knockin" : "put-knockin";
    } else if (mappedType.includes("reverse")) {
      if (mappedType.includes("call") && mappedType.includes("knockout")) mappedType = "call-reverse-knockout";
      else if (mappedType.includes("put") && mappedType.includes("knockout")) mappedType = "put-reverse-knockout";
      else if (mappedType.includes("call") && mappedType.includes("knockin")) mappedType = "call-reverse-knockin";
      else if (mappedType.includes("put") && mappedType.includes("knockin")) mappedType = "put-reverse-knockin";
    }
    const bar = addFormBarrier ? parseInputNumber(addFormBarrier) : 0;
    const bar2 = addFormSecondBarrier ? parseInputNumber(addFormSecondBarrier) : undefined;
    const rebate = addFormRebate ? parseInputNumber(addFormRebate, 1) : 1;
    return calculateOptionPrice(mappedType, S, K, r, r, t, sigma, bar, bar2, rebate, barrierOptionSimulations || 1000);
  }, [
    addFormType, addFormSpotPrice, addFormRate, addFormStrikeType, addFormVolatility, addFormInterestRate,
    addFormTimeToMaturity, addFormForwardPrice, addFormBarrier, addFormSecondBarrier, addFormRebate,
    optionPricingModel, barrierOptionSimulations,
  ]);



  // Function to get implied volatility - identique à Index.tsx
  const getImpliedVolatility = (monthKey: string, optionKey?: string) => {
    if (!useImpliedVol) return null;
    
    if (optionKey && impliedVolatilities[monthKey] && impliedVolatilities[monthKey][optionKey] !== undefined) {
      return impliedVolatilities[monthKey][optionKey];
    }
    
    if (impliedVolatilities[monthKey] && impliedVolatilities[monthKey].global !== undefined) {
      return impliedVolatilities[monthKey].global;
    }
    
    return null;
  };

  // Fonction calculateTodayPrice améliorée pour utiliser les données enrichies d'export
  // Note: La fonction calculateBarrierOptionClosedForm a été déplacée vers PricingService
  // avec une implémentation complète pour les options à double barrière

  const calculateTodayPrice = (instrument: HedgingInstrument): number => {
    // ── 1. TTM & DTE ──
    // Raw TTM (ACT/365.25) for pricing, rate, forward — ensures exact match with export
    // DTE (integer days) for IV surface & forward curve interpolation only
    const t = calculateTimeToMaturity(instrument.maturity, valuationDate);
    const dte = getDte(instrument.maturity, valuationDate);
    console.log(`[DEBUG] ${instrument.id}: TODAY PRICE - valuationDate=${valuationDate}, TTM=${t.toFixed(6)}y, DTE=${dte}`);
    
    if (t <= 0) {
      const marketData = commodityMarketData[instrument.currency] || getMarketDataFromInstruments(instrument.currency) || { spot: 1.0000, volatility: 20, riskFreeRate: 1.0 };
      
      // ✅ PRIORITÉ : Prix réel du marché si activé > individuel > global
      let spotRate: number;
      if (useRealMarketPrices) {
        const realPrice = getRealMarketPrice(instrument.currency);
        if (realPrice !== null && realPrice > 0) {
          spotRate = realPrice;
          console.log(`[DEBUG] ${instrument.id}: EXPIRED OPTION - Using REAL MARKET PRICE: ${spotRate.toFixed(6)} for ${instrument.currency}`);
        } else {
          spotRate = instrument.impliedSpotPrice || marketData.spot;
        }
      } else {
        spotRate = instrument.impliedSpotPrice || marketData.spot;
      }
      
      const K = instrument.strike || spotRate;
      const ty = instrument.type.toLowerCase();
      return roundPrice6(commodityExpiredSettlementValue(ty, spotRate, K));
    }
    
    // 2. PARAMÈTRES DE MARCHÉ : Utiliser les valeurs CURRENT des données de marché (Commodity)
    const marketData = commodityMarketData[instrument.currency] || getMarketDataFromInstruments(instrument.currency) || { 
      spot: 1.0000, 
      volatility: 20, 
      riskFreeRate: 5.0
    };
    
    const isExportedStrategy = !!(instrument.exportSpotPrice && instrument.exportTimeToMaturity);

    // ── 2a. SPOT ──
    // Priority: real-time market > user individual override > export > market panel
    let spotRate: number;
    if (useRealMarketPrices) {
      const realPrice = getRealMarketPrice(instrument.currency);
      spotRate = (realPrice != null && realPrice > 0)
        ? realPrice
        : (instrument.impliedSpotPrice || (isExportedStrategy ? instrument.exportSpotPrice! : marketData.spot));
    } else {
      spotRate = instrument.impliedSpotPrice
        || (isExportedStrategy ? instrument.exportSpotPrice! : marketData.spot);
    }

    // ── 2b. RATE ──
    // Priority: real-time > export > Strategy Builder storage / Rate Explorer
    const sbRates = readStrategyBuilderPricingFromStorage();
    const getRateForMaturityLikeIndex = (ttmYears: number): number =>
      sbRates.useRealInterestRate && sbRates.pricingCurrencyQuote
        ? getRate(sbRates.pricingCurrencyQuote, ttmYears)
        : strategyBuilderAnnualPercentToDecimal(sbRates.interestRatePercent);

    // Real-time mode: interpolate USD rate at this instrument's TTM (same as Rate Explorer / Strategy Builder curve)
    const r_d = useRealMarketPrices
      ? getRate('USD', t)
      : (isExportedStrategy && instrument.exportDomesticRate != null)
        ? instrument.exportDomesticRate / 100
        : getRateForMaturityLikeIndex(t);

    console.log(`[DEBUG] ${instrument.id}: spot=${spotRate.toFixed(4)}, r_d=${(r_d*100).toFixed(3)}%, DTE=${dte}, TTM=${t.toFixed(6)}y (valuationDate=${valuationDate})`);

    // ── 3. VOLATILITÉ ──
    // Priority: real-time TPP surface > user individual override > export > Pricers / instrument / market
    let sigma: number;
    if (useRealMarketPrices) {
      const surfaceIV = realTimeVolByInstrumentId[instrument.id];
      if (surfaceIV != null && surfaceIV > 0) {
        sigma = surfaceIV / 100;
      } else if (instrument.impliedVolatility != null && instrument.impliedVolatility > 0) {
        sigma = instrument.impliedVolatility / 100;
      } else if (isExportedStrategy && instrument.exportVolatility != null && instrument.exportVolatility > 0) {
        sigma = instrument.exportVolatility / 100;
      } else if (instrument.volatility != null && instrument.volatility > 0) {
        sigma = instrument.volatility / 100;
      } else {
        sigma = (marketData.volatility || 20) / 100;
      }
    } else {
      if (instrument.impliedVolatility != null) {
        sigma = instrument.impliedVolatility / 100;
      } else if (isExportedStrategy && instrument.exportVolatility != null) {
        sigma = instrument.exportVolatility / 100;
      } else {
        const realVol = getRealVolatility();
        if (realVol != null && realVol > 0) sigma = realVol / 100;
        else if (instrument.volatility != null) sigma = instrument.volatility / 100;
        else sigma = (marketData.volatility || 20) / 100;
      }
    }

    // ── 4. FORWARD ──
    // Priority: real-time TPP curve > export (if user hasn't changed spot) > theoretical
    let S: number;
    if (useRealMarketPrices) {
      const fromCurve = getCurrentForwardFromTppCurve(instrument.currency, instrument.maturity);
      if (fromCurve != null && fromCurve > 0) {
        S = fromCurve;
      } else {
        S = calculateCommodityForwardPrice(spotRate, r_d, 0, 0, t);
      }
    } else {
      if (isExportedStrategy && !instrument.impliedSpotPrice && instrument.exportForwardPrice != null && instrument.exportForwardPrice > 0) {
        S = instrument.exportForwardPrice;
      } else {
        S = calculateCommodityForwardPrice(spotRate, r_d, 0, 0, t);
      }
    }

    if (t <= 0) return 0;

    const K = instrument.strike || S;
    
    // Map instrument type to option type pour pricing
    const optionType = instrument.type.toLowerCase();
     
     // Pour les options à barrière, vérifier si le spot actuel a franchi les barrières
     if (optionType.includes('knock') || optionType.includes('barrier')) {
       const barrier = instrument.barrier;
       const secondBarrier = instrument.secondBarrier;
       
       if (barrier) {
         if (secondBarrier) {
           const { lower: lowerBarrier, upper: upperBarrier } = orderedDoubleBarrierLevels(barrier, secondBarrier);
           const spotOutsideRange = spotRate <= lowerBarrier || spotRate >= upperBarrier;
           
           // Pour les double knock-out: si le spot est en dehors des barrières, l'option est déjà knockée
           if (optionType.includes('knock-out') && spotOutsideRange) {
             return 0;
           }
           
           // Pour les double knock-in: si le spot est en dehors des barrières, l'option est activée
           if (optionType.includes('knock-in') && spotOutsideRange) {
             // Continuer avec le pricing normal d'une option vanille
           }
         } else {
           // Barrière simple
           let barrierCrossed = false;
           
           if (optionType.includes('reverse')) {
             // Pour les reverse barriers, la logique est inversée
             if (optionType.includes('call')) {
               barrierCrossed = spotRate <= barrier; // Call reverse: knocked si spot en dessous
             } else {
               barrierCrossed = spotRate >= barrier; // Put reverse: knocked si spot au dessus
             }
           } else {
             // Barrières normales
             if (optionType.includes('call')) {
               barrierCrossed = spotRate >= barrier; // Call: knocked si spot au dessus
             } else {
               barrierCrossed = spotRate <= barrier; // Put: knocked si spot en dessous
             }
           }
           
           // Pour les knock-out: si barrière franchie, option knockée
           if (optionType.includes('knock-out') && barrierCrossed) {
             return 0;
           }
           
           // Pour les knock-in: si barrière franchie, option activée
           if (optionType.includes('knock-in') && barrierCrossed) {
             // Continuer avec le pricing normal d'une option vanille
           }
         }
       }
     }
    // ✅ OPTIMISATION : Logs réduits pour améliorer les performances
    
    // ✅ UTILISATION DIRECTE DE LA FONCTION STRATEGY BUILDER - MÊME LOGIQUE EXACTE
    // Mapper le type d'instrument vers le type reconnu par calculateOptionPrice
    let mappedType = instrument.type.toLowerCase();
    
    // ✅ MAPPING COMPLET DES TYPES D'OPTIONS - MÊME LOGIQUE QUE STRATEGY BUILDER
    // ✅ PRIORITÉ ABSOLUE : Options double barrière (avant les simples)
    if (mappedType.includes('double')) {
      // Options à double barrière - PRIORITÉ ABSOLUE
      if (mappedType.includes('call') && (mappedType.includes('knockout') || mappedType.includes('knock-out'))) {
        mappedType = 'call-double-knockout';
      } else if (mappedType.includes('put') && (mappedType.includes('knockout') || mappedType.includes('knock-out'))) {
        mappedType = 'put-double-knockout';
      } else if (mappedType.includes('call') && (mappedType.includes('knockin') || mappedType.includes('knock-in'))) {
        mappedType = 'call-double-knockin';
      } else if (mappedType.includes('put') && (mappedType.includes('knockin') || mappedType.includes('knock-in'))) {
        mappedType = 'put-double-knockin';
      }
    } else if (mappedType === 'vanilla call') {
      mappedType = 'call';
    } else if (mappedType === 'vanilla put') {
      mappedType = 'put';
    } else if (mappedType.includes('knock-out') || mappedType.includes('knockout')) {
      // Options à barrière knock-out SIMPLE
      if (mappedType.includes('call')) {
        mappedType = 'call-knockout';
      } else if (mappedType.includes('put')) {
        mappedType = 'put-knockout';
      }
    } else if (mappedType.includes('knock-in') || mappedType.includes('knockin')) {
      // Options à barrière knock-in SIMPLE
      if (mappedType.includes('call')) {
        mappedType = 'call-knockin';
      } else if (mappedType.includes('put')) {
        mappedType = 'put-knockin';
      }
    } else if (mappedType.includes('reverse')) {
      // Options à barrière reverse
      if (mappedType.includes('call') && mappedType.includes('knockout')) {
        mappedType = 'call-reverse-knockout';
      } else if (mappedType.includes('put') && mappedType.includes('knockout')) {
        mappedType = 'put-reverse-knockout';
      } else if (mappedType.includes('call') && mappedType.includes('knockin')) {
        mappedType = 'call-reverse-knockin';
      } else if (mappedType.includes('put') && mappedType.includes('knockin')) {
        mappedType = 'put-reverse-knockin';
      }
    } else if (mappedType.includes('one-touch') || mappedType.includes('no-touch')) {
      // Options digitales
      mappedType = mappedType; // Garder le type original pour les options digitales
    } else if (mappedType.includes('double-touch') || mappedType.includes('double-no-touch')) {
      // Options digitales double
      mappedType = mappedType; // Garder le type original pour les options digitales
    }
    
    
    // ✅ CORRECTION CRITIQUE : Utiliser les barrières calculées lors de l'export
    let calculatedBarrier = instrument.barrier || 0;
    let calculatedSecondBarrier = instrument.secondBarrier;
    
    // Si l'instrument a des données d'export et que le spot price a changé, recalculer les barrières
    if (instrument.originalComponent?.barrierType === 'percent' && instrument.exportSpotPrice) {
      const exportSpotPrice = instrument.exportSpotPrice;
      const currentSpotPrice = spotRate;
      
      // Si le spot price a changé, recalculer les barrières proportionnellement
      if (Math.abs(exportSpotPrice - currentSpotPrice) > 0.0001) {
        const spotRatio = currentSpotPrice / exportSpotPrice;
        calculatedBarrier = (instrument.barrier || 0) * spotRatio;
        if (instrument.secondBarrier) {
          calculatedSecondBarrier = instrument.secondBarrier * spotRatio;
        }
      }
    }
    
    // ✅ LOGIQUE DOUBLE BARRIÈRE : Détermination correcte des barrières inférieure et supérieure
    // Même logique que Strategy Builder pour les options double barrière
    // Strategy Builder utilise : L = Math.min(barrier, secondBarrier), U = Math.max(barrier, secondBarrier)
    if (mappedType.includes('double') && calculatedSecondBarrier) {
      const { lower: lowerBarrier, upper: upperBarrier } = orderedDoubleBarrierLevels(
        calculatedBarrier,
        calculatedSecondBarrier
      );
      calculatedBarrier = lowerBarrier;
      calculatedSecondBarrier = upperBarrier;
      
    } else if (mappedType.includes('double') && !calculatedSecondBarrier) {
      console.warn(`[WARNING] ${instrument.id}: Double barrier option detected but secondBarrier is missing`);
    }
    
    // ✅ UTILISATION STRICTE DE LA FONCTION PRINCIPALE DE STRATEGY BUILDER
    // Cette fonction gère automatiquement le choix du modèle selon le type d'option :
    // - Black-Scholes pour les options call/put simples
    // - Monte Carlo pour les options call/put avec Monte Carlo
    // - Closed-form pour les options avec barrières (SIMPLE ET DOUBLE)
    // - Monte Carlo pour les options digitales
    // 
    // ✅ OPTIONS DOUBLE BARRIÈRE : Utilise calculateBarrierOptionClosedForm avec :
    // - L = Math.min(barrier, secondBarrier) = barrière inférieure
    // - U = Math.max(barrier, secondBarrier) = barrière supérieure
    // - Formules analytiques complètes pour les options double barrière
    
    let price = 0;
    const bMc = strategyBuilderAnnualPercentToDecimal(sbRates.interestRatePercent);

    // Aligné sur Index.tsx detailedResults : vanille = Black-76 (hors MC) ou MC avec (r, b comme params.interestRate)
    if (mappedType === 'call' || mappedType === 'put') {
      console.log(`[DEBUG] ${instrument.id}: VANILLA OPTION - Black-76 / MC comme Strategy Builder`);
      console.log(`[DEBUG] ${instrument.id}: Parameters - S=${S.toFixed(6)}, K=${K.toFixed(6)}, r=${r_d.toFixed(6)}, bMc=${bMc.toFixed(6)}, t=${t.toFixed(6)}, sigma=${sigma.toFixed(6)}, DTE=${dte}`);
      if (optionPricingModel === 'monte-carlo') {
        price = calculateVanillaOptionMonteCarlo(
          mappedType,
          S,
          K,
          r_d,
          bMc,
          t,
          sigma,
          1000
        );
      } else {
        price = calculateBlack76Price(mappedType, S, K, r_d, 0, t, sigma);
      }
      console.log(`[DEBUG] ${instrument.id}: VANILLA PRICING - Model: ${optionPricingModel}, Price: ${price.toFixed(6)}`);
    } else if (mappedType.includes('knockout') || mappedType.includes('knockin')) {
      if (barrierPricingModel === 'closed-form') {
        price = calculateBarrierOptionClosedForm(
          mappedType,
          S,
          K,
          r_d,
          t,
          sigma,
          calculatedBarrier,
          calculatedSecondBarrier
        );
      } else {
        const mcSteps = barrierMonteCarloNumSteps(t);
        const paths = generateBarrierMonteCarloPathsForPricing({
          initialPrice: S,
          domesticRateDecimal: sbRates.domesticRatePercent / 100,
          foreignRateDecimal: sbRates.foreignRatePercent / 100,
          sigma,
          timeToMaturity: t,
          numSteps: mcSteps,
          numSimulations: 300,
        });
        price = calculatePricesFromPaths(
          mappedType,
          S,
          K,
          r_d,
          mcSteps,
          paths,
          calculatedBarrier,
          calculatedSecondBarrier
        );
      }
      console.log(`[DEBUG] ${instrument.id}: BARRIER PRICING - Type: ${mappedType}, Price: ${price.toFixed(6)}`);
    } else {
      const digitalType = (() => {
        const m = mappedType;
        if (m.includes('double-no-touch')) return 'double-no-touch';
        if (m.includes('double-touch')) return 'double-touch';
        if (m.includes('one-touch')) return 'one-touch';
        if (m.includes('no-touch')) return 'no-touch';
        if (m.includes('range-binary')) return 'range-binary';
        if (m.includes('outside-binary')) return 'outside-binary';
        return m;
      })();
      const underlyingDigital = calculateUnderlyingPrice(
        spotRate,
        r_d,
        sbRates.foreignRatePercent / 100,
        t
      );
      const sigmaDigital =
        (instrument.volatility != null ? instrument.volatility : marketData.volatility) / 100;
      price = calculateDigitalOptionPrice(
        digitalType,
        underlyingDigital.price,
        K,
        r_d,
        t,
        sigmaDigital,
        calculatedBarrier,
        calculatedSecondBarrier,
        10000,
        instrument.rebate || 1
      );
      console.log(`[DEBUG] ${instrument.id}: DIGITAL PRICING - Type: ${digitalType}, Price: ${price.toFixed(6)}`);
    }
    
    console.log(`[DEBUG] ${instrument.id}: STRATEGY BUILDER PRICING RESULT - Calculated: ${price.toFixed(6)}, Export: ${instrument.realOptionPrice || instrument.premium || 'N/A'}, Difference: ${price - (instrument.realOptionPrice || instrument.premium || 0)}`);
    console.log(`[DEBUG] ${instrument.id}: MTM CONSISTENCY CHECK - If no parameters changed, price should equal export price for MTM=0`);
        return roundPrice6(price);
  };

  // Fonction pour mettre à jour les données de marché d'une commodity spécifique
  const updateCommodityMarketData = (commodity: string, field: keyof CommodityMarketData, value: number) => {
      setCommodityMarketData(prev => {
      const newData = {
      ...prev,
      [commodity]: {
        ...prev[commodity],
        [field]: value
      }
      };
      
      // Sauvegarder dans localStorage
      try {
        localStorage.setItem('commodityMarketData', JSON.stringify(newData));
      } catch (error) {
        console.error('Error saving commodity market data:', error);
      }
      
      return newData;
    });
    
    // Si c'est la volatilité, le spot rate ou le risk-free rate qui change, recalculer automatiquement les prix
    if (field === 'volatility' || field === 'spot' || field === 'riskFreeRate') {
      // Force re-render pour recalculer les Today Price
      setInstruments(prevInstruments => [...prevInstruments]);
      
      let fieldName = field;
      let unit = '';
      if (field === 'volatility') {
        fieldName = 'volatility';
        unit = '%';
      } else if (field === 'spot') {
        fieldName = 'spot';
        unit = '';
      } else if (field === 'riskFreeRate') {
        fieldName = 'riskFreeRate';
        unit = '%';
      }
      
      toast({
        title: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} Updated`,
        description: `Updated ${fieldName} to ${value}${unit} for ${commodity}. Today Prices recalculated.`,
      });
    }
  };

  // Fonction pour mettre à jour la volatilité d'un instrument spécifique
  const updateInstrumentVolatility = (instrumentId: string, volatility: number) => {
    setInstruments(prevInstruments => 
      prevInstruments.map(instrument => 
        instrument.id === instrumentId 
          ? { ...instrument, impliedVolatility: volatility }
          : instrument
      )
    );
    
    toast({
      title: "Individual Volatility Updated",
      description: `Updated volatility to ${volatility}% for instrument ${instrumentId}`,
    });
  };

  // Fonction pour réinitialiser la volatilité individuelle (utiliser la volatilité globale)
  const resetInstrumentVolatility = (instrumentId: string) => {
    setInstruments(prevInstruments => 
      prevInstruments.map(instrument => 
        instrument.id === instrumentId 
          ? { ...instrument, impliedVolatility: undefined }
          : instrument
      )
    );
    
    toast({
      title: "Individual Volatility Reset",
      description: `Reset to global volatility for instrument ${instrumentId}`,
    });
  };

  // Fonction pour mettre à jour le spot price d'un instrument spécifique
  const updateInstrumentSpotPrice = (instrumentId: string, spotPrice: number) => {
    setInstruments(prevInstruments => {
      const updated = prevInstruments.map(instrument =>
        instrument.id === instrumentId
          ? { ...instrument, impliedSpotPrice: spotPrice }
          : instrument
      );
      // Sauvegarde dans le localStorage
      try {
        localStorage.setItem('hedgingInstruments', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving instruments:', error);
      }
      return updated;
    });

    toast({
      title: "Individual Spot Price Updated",
      description: `Updated spot price to ${spotPrice.toFixed(6)} for instrument ${instrumentId}`,
    });
  };

  // Fonction pour réinitialiser le spot price individuel (utiliser le spot price global)
  const resetInstrumentSpotPrice = (instrumentId: string) => {
    setInstruments(prevInstruments => {
      const updated = prevInstruments.map(instrument =>
        instrument.id === instrumentId
          ? { ...instrument, impliedSpotPrice: undefined }
          : instrument
      );
      try {
        localStorage.setItem('hedgingInstruments', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving instruments:', error);
      }
      return updated;
    });

    toast({
      title: "Individual Spot Price Reset",
      description: `Reset to global spot price for instrument ${instrumentId}`,
    });
  };

  // Refresh TPP futures curve data only. Forward Price - Current is interpolated from this curve (at TTM from valuation date). Spot stays raw.
  const handleRefreshFuturesFromCurve = useCallback(async () => {
    if (instruments.length === 0) {
      toast({ title: "No instruments", description: "Add instruments first.", variant: "destructive" });
      return;
    }
    setRefreshingFuturesFromCurve(true);
    const commodities = [...new Set(instruments.map((i) => i.currency).filter(Boolean))];
    const nextFutures: Record<string, FuturesContract[]> = {};
    try {
      for (const commodity of commodities) {
        const tppSym = getTppSymbolForCommodity(commodity) || commodity.trim();
        if (!tppSym) continue;
        const res = await fetchFutures(tppSym, true);
        if (res.success && res.data?.length) nextFutures[commodity] = res.data;
        else if (res.error) console.warn("[Refresh futures] fetchFutures failed for", tppSym, res.error);
      }
      const count = Object.keys(nextFutures).length;
      if (count > 0) {
        setTppFuturesByCommodity((prev) => ({ ...prev, ...nextFutures }));
        toast({
          title: "Futures curve refresh",
          description: `Curve data refreshed for ${count} commodity(ies). Forward Price - Current is interpolated from this curve (valuation date = ${valuationDate}).`,
        });
      } else {
        const tried = commodities.map((c) => getTppSymbolForCommodity(c) || c).join(", ");
        toast({
          title: "Futures curve refresh",
          description: `No curve data for symbols (${tried}). Open Ticker Peek Pro and load data for these commodities, then try again.`,
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Refresh futures from curve:", e);
      toast({ title: "Refresh failed", description: String(e), variant: "destructive" });
    } finally {
      setRefreshingFuturesFromCurve(false);
    }
  }, [instruments, valuationDate]);

  // Fonction pour appliquer les données par défaut d'une commodity
  const applyDefaultDataForCommodity = (commodity: string) => {
    const defaultData = getMarketDataFromInstruments(commodity) || { 
      spot: 1.0000, 
      volatility: 20, 
      riskFreeRate: 1.0
    };
    
    console.log(`[DEBUG] Applying default data for ${commodity}:`, defaultData);
    console.log(`[DEBUG] Source instrument exportSpotPrice:`, instruments.find(inst => inst.currency === commodity)?.exportSpotPrice);
    
      setCommodityMarketData(prev => {
      const newData = {
      ...prev,
      [commodity]: defaultData
      };
      
      // Sauvegarder dans localStorage
      try {
        localStorage.setItem('commodityMarketData', JSON.stringify(newData));
      } catch (error) {
        console.error('Error saving commodity market data:', error);
      }
      
      return newData;
    });
    
    toast({
      title: "Market Data Updated",
      description: `Applied export parameters for ${commodity}: Spot ${defaultData.spot.toFixed(6)}`,
    });
  };

  // NOUVELLE FONCTION : Forcer la mise à jour depuis les données d'export
  const refreshMarketDataFromExport = () => {
    const uniqueCommodities = getUniqueCommodities(instruments);
    
    setCommodityMarketData(prevData => {
      const newData = { ...prevData };
      let updatedCount = 0;
      
      uniqueCommodities.forEach(commodity => {
        const exportData = getMarketDataFromInstruments(commodity);
        if (exportData) {
          console.log(`[DEBUG] Refreshing ${commodity} with export data:`, exportData);
          newData[commodity] = exportData;
          updatedCount++;
        }
      });
      
      // Sauvegarder dans localStorage
      try {
        localStorage.setItem('commodityMarketData', JSON.stringify(newData));
      } catch (error) {
        console.error('Error saving commodity market data:', error);
      }
      
      if (updatedCount > 0) {
        toast({
          title: "Market Data Refreshed",
          description: `Updated ${updatedCount} commodities with export parameters`,
        });
      }
      
      return newData;
    });
  };

  const recalculateAllMTM = async () => {
    setIsRecalculating(true);
    
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force re-render by updating state
      setInstruments([...instruments]);
      
      toast({
        title: "MTM Recalculated",
        description: `Updated prices for ${instruments.length} instruments using Valuation Date ${valuationDate}`,
      });
    } catch (error) {
      toast({
        title: "Calculation Error",
        description: "Failed to recalculate MTM. Please check your parameters.",
        variant: "destructive"
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case "matured":
        return <Badge variant="secondary">Matured</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInstrumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "forward":
        return <ArrowUpDown className="h-4 w-4 text-blue-600" />;
      case "vanilla call":
      case "vanilla put":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "swap":
        return <BarChart3 className="h-4 w-4 text-purple-600" />;
      case "collar":
        return <Shield className="h-4 w-4 text-orange-600" />;
      default:
        return <Target className="h-4 w-4 text-gray-600" />;
    }
  };

  const getMTMColor = (mtm: number) => {
    return mtm >= 0 ? "text-green-600" : "text-red-600";
  };

  // Delete instrument function
  const deleteInstrument = (id: string) => {
    importService.deleteInstrument(id);
    const updatedInstruments = importService.getHedgingInstruments();
    setInstruments(updatedInstruments);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('hedgingInstrumentsUpdated'));
    
    toast({
      title: "Instrument Deleted",
      description: "The hedging instrument has been removed successfully.",
    });
  };

  const deleteAllInstruments = () => {
    // Delete all instruments using the same service method
    instruments.forEach(instrument => {
      importService.deleteInstrument(instrument.id);
    });
    
    const updatedInstruments = importService.getHedgingInstruments();
    setInstruments(updatedInstruments);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('hedgingInstrumentsUpdated'));
    
    toast({
      title: "All Instruments Deleted",
      description: "All hedging instruments have been removed successfully.",
    });
  };

  const handleAddInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormType || !addFormCommodity) {
      toast({
        title: "Missing fields",
        description: "Please select Type and Commodity.",
        variant: "destructive",
      });
      return;
    }
    const pair = CURRENCY_PAIRS.find(p => p.symbol === addFormCommodity);
    const spot = parseInputNumber(addFormSpotPrice, 75.5);
    const strikeVal = parseInputNumber(addFormRate);
    const strike = addFormStrikeType === "percent" ? (spot * strikeVal) / 100 : strikeVal;
    const maturityDate = addFormMaturity || new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const theo = addFormTheoPrice ?? 0;
    const realPriceVal = addFormRealPrice.trim() !== "" ? parseInputNumber(addFormRealPrice) : null;
    const priceToStore = realPriceVal != null && !Number.isNaN(realPriceVal) ? realPriceVal : theo;
    const newInstrument: HedgingInstrument = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: addFormType,
      currency: addFormCommodity,
      notional: parseInputNumber(addFormNotional, 1000000),
      strike,
      maturity: maturityDate,
      status: "active",
      mtm: 0,
      hedge_accounting: false,
      counterparty: addFormCounterparty || "",
      portfolio: addFormPortfolio || undefined,
      quantity: parseInputNumber(addFormQuantity, 100),
      volatility: addFormVolatility ? parseInputNumber(addFormVolatility) : undefined,
      barrier: addFormBarrier ? parseInputNumber(addFormBarrier) : undefined,
      secondBarrier: addFormSecondBarrier ? parseInputNumber(addFormSecondBarrier) : undefined,
      rebate: addFormRebate ? parseInputNumber(addFormRebate) : undefined,
      premium: priceToStore,
      ...(realPriceVal != null && !Number.isNaN(realPriceVal) ? { realOptionPrice: realPriceVal } : {}),
      impliedSpotPrice: spot,
      exportSpotPrice: spot,
      exportStrike: strike,
      exportForwardPrice: (() => {
        const r = getRate('USD', addFormTimeToMaturity);
        return addFormForwardPrice ?? calculateCommodityForwardPrice(spot, r, 0, 0, addFormTimeToMaturity);
      })(),
      exportDomesticRate: getRate('USD', addFormTimeToMaturity) * 100,
      exportHedgingStartDate: addFormStartDate,
      exportStrategyStartDate: addFormStartDate,
      exportVolatility: addFormVolatility ? parseInputNumber(addFormVolatility) : undefined,
      exportTimeToMaturity: addFormTimeToMaturity,
    };
    importService.addInstrument(newInstrument);
    setInstruments(importService.getHedgingInstruments());
    window.dispatchEvent(new CustomEvent("hedgingInstrumentsUpdated"));
    setIsAddDialogOpen(false);
    setAddFormType("");
    setAddFormCommodity("");
    setAddFormNotional("1000000");
    setAddFormSpotPrice("75.50");
    setAddFormRate("75.50"); // default strike = spot
    setAddFormStrikeType("absolute");
    setAddFormStartDate(new Date().toISOString().split("T")[0]);
    setAddFormMaturity("");
    setAddFormQuantity("100");
    setAddFormVolatility("25");
    setAddFormInterestRate("4.5");
    setAddFormBarrier("");
    setAddFormSecondBarrier("");
    setAddFormBarrierType("percent");
    setAddFormRebate("1");
    setAddFormTimeToPayoff("1");
    setAddFormStorageCost("0");
    setAddFormConvenienceYield("0");
    setAddFormCounterparty("");
    setAddFormPortfolio("");
    setAddFormRealPrice("");
    toast({
      title: "Instrument added",
      description: `${addFormType} on ${pair?.name ?? addFormCommodity} has been added.`,
    });
  };

  // View instrument function
  const viewInstrument = (instrument: HedgingInstrument) => {
    setSelectedInstrument(instrument);
    setIsViewDialogOpen(true);
  };

  // Edit instrument function
  const editInstrument = (instrument: HedgingInstrument) => {
    setSelectedInstrument(instrument);
    setIsEditDialogOpen(true);
  };

  // Save instrument changes function
  const saveInstrumentChanges = (updatedInstrument: HedgingInstrument) => {
    importService.updateInstrument(updatedInstrument.id, updatedInstrument);
    const updatedInstruments = importService.getHedgingInstruments();
    setInstruments(updatedInstruments);
    setIsEditDialogOpen(false);
    setSelectedInstrument(null);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('hedgingInstrumentsUpdated'));
    
    toast({
      title: "Instrument Updated",
      description: "The hedging instrument has been updated successfully.",
    });
  };

  // ✅ OPTIMISATION : Memoization des calculs coûteux (tab + portfolio + counterparty)
  const filteredInstruments = useMemo(() => {
    return instruments.filter(instrument => {
    const isOption = instrument.type.includes("Call") || 
                    instrument.type.includes("Put") || 
                    instrument.type === "Collar" ||
                    instrument.type.includes("Touch") ||
                    instrument.type.includes("Binary") ||
                    instrument.type.includes("Digital") ||
                    instrument.type.includes("Knock");
    
    const matchesTab = selectedTab === "all" || 
                      (selectedTab === "forwards" && instrument.type === "Forward") ||
                      (selectedTab === "options" && isOption) ||
                      (selectedTab === "swaps" && instrument.type === "Swap") ||
                      (selectedTab === "hedge-accounting" && instrument.hedge_accounting);
    
    const matchesPortfolio = !filterByPortfolio || (instrument.portfolio || "") === filterByPortfolio;
    const matchesCounterparty = !filterByCounterparty || (instrument.counterparty || "") === filterByCounterparty;
    
    return matchesTab && matchesPortfolio && matchesCounterparty;
  });
  }, [instruments, selectedTab, filterByPortfolio, filterByCounterparty]);

  // ✅ OPTIMISATION : Memoization des calculs de résumé
  const totalNotional = useMemo(() => {
    return instruments.reduce((sum, inst) => {
    const quantityToHedge = inst.quantity || 0;
    const unitPrice = inst.realOptionPrice || inst.premium || 0;
    const volumeToHedge = inst.notional;
    const calculatedNotional = unitPrice * volumeToHedge;
    const displayedNotional = calculatedNotional > 0 ? calculatedNotional : inst.notional;
    return sum + displayedNotional;
  }, 0);
  }, [instruments]);
  
  // ✅ OPTIMISATION : Memoization du calcul MTM total
  const totalMTM = useMemo(() => {
    return instruments.reduce((sum, inst) => {
    // Important: avoid transient MTM=0 right after import while commodityMarketData is still initializing.
    // We intentionally do NOT early-return when market data is missing; calculateTodayPrice already
    // falls back to export-derived parameters via getMarketDataFromInstruments().
    const _marketData = commodityMarketData[inst.currency] ?? getMarketDataFromInstruments(inst.currency);
    
    const originalPrice = inst.realOptionPrice || inst.premium || 0;
    const isExportedStrategy = inst.exportSpotPrice && inst.exportTimeToMaturity;
    const initialPrice = isExportedStrategy ? originalPrice : (inst.premium || 0);
    const todayPrice = calculateTodayPrice(inst);
    const quantity = inst.quantity || 1;
    const isShort = quantity < 0;
    
      const mtmValue = isShort 
        ? initialPrice - todayPrice 
        : todayPrice - initialPrice;
    
    return sum + (mtmValue * Math.abs(inst.notional));
  }, 0);
  }, [instruments, commodityMarketData, valuationDate]);
  
  const hedgeAccountingCount = useMemo(() => {
    return instruments.filter(inst => inst.hedge_accounting).length;
  }, [instruments]);
  
  // ✅ OPTIMISATION : Memoization des commodities uniques
  const uniqueCommodities = useMemo(() => {
    return getUniqueCommodities(instruments);
  }, [instruments]);

  return (
    <Layout 
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Hedging Instruments" }
      ]}
    >
      {/* MTM Calculation Controls */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            MTM Valuation Parameters
          </CardTitle>
          <CardDescription>
            Configure market parameters for Mark-to-Market calculations using Valuation Date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* ✅ Valuation Date - Unique date for pricing */}
            <div className="grid gap-4 md:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="valuation-date">Valuation Date</Label>
                <Input
                  id="valuation-date"
                  type="date"
                  value={valuationDate}
                  onChange={(e) => setValuationDate(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Date used for pricing and MTM calculations</p>
              </div>
            </div>
            
            {/* ✅ Use Real Market Data (Spot, Vol, Risk-Free Rate) – same as Pricers */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="use-real-prices" className="text-sm font-medium">
                  Use real-time data (Spot, Vol, Risk-free rate)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Spot from Commodity Market · Volatility from Pricers · Risk-free rate from Rate Explorer (Bank Rate USD). Same sources as Pricers.
                </p>
              </div>
              <Switch
                id="use-real-prices"
                checked={useRealMarketPrices}
                onCheckedChange={(checked) => {
                  setUseRealMarketPrices(checked);
                  localStorage.setItem('hedgingInstruments_useRealMarketPrices', checked.toString());
                  // Force recalculation when toggled
                  if (instruments.length > 0) {
                    setInstruments([...instruments]);
                  }
                  toast({
                    title: checked ? "Real Market Prices Enabled" : "Real Market Prices Disabled",
                    description: checked 
                      ? "Using live prices from Commodity Market for pricing"
                      : "Using manual prices for pricing",
                  });
                }}
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>&nbsp;</Label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={recalculateAllMTM}
                  disabled={isRecalculating}
                  className="flex-1"
                >
                  {isRecalculating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  {isRecalculating ? "Calculating..." : "Recalculate All MTM"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={refreshingFuturesFromCurve || instruments.length === 0}
                  onClick={handleRefreshFuturesFromCurve}
                  title="For each instrument, fetch the futures curve for its commodity and set Current price to the interpolated futures price at the instrument's time to maturity."
                >
                  {refreshingFuturesFromCurve ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh futures from futures curve
                </Button>
              </div>
            </div>

            {/* Market Data per Commodity */}
            {uniqueCommodities.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Market Parameters by Commodity ({uniqueCommodities.length} commodities found)
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshMarketDataFromExport}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh from Export
                  </Button>
                </div>
                {uniqueCommodities.map((commodity) => {
                  const data = commodityMarketData[commodity] || getMarketDataFromInstruments(commodity) || { spot: 1.0000, volatility: 20, riskFreeRate: 1.0 };
                  return (
                    <div key={commodity} className="border rounded-lg p-4 bg-muted/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-semibold">
                            {commodity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {instruments.filter(inst => inst.currency === commodity).length} instrument(s)
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => applyDefaultDataForCommodity(commodity)}
                            className="text-xs"
                          >
                            Reset to Default
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                          <Label htmlFor={`spot-${commodity}`} className="text-xs">Spot Price</Label>
                            {useRealMarketPrices && getRealMarketPrice(commodity) !== null && (
                              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                                Real Market
                              </Badge>
                            )}
                          </div>
                          <Input
                            id={`spot-${commodity}`}
                            type="number"
                            step="0.0001"
                            value={useRealMarketPrices && getRealMarketPrice(commodity) !== null 
                              ? (getRealMarketPrice(commodity) || data.spot)
                              : data.spot}
                            onChange={(e) => {
                              if (!useRealMarketPrices) {
                                updateCommodityMarketData(commodity, 'spot', parseFloat(e.target.value) || data.spot);
                              }
                            }}
                            disabled={useRealMarketPrices && getRealMarketPrice(commodity) !== null}
                            className={`font-mono text-sm ${useRealMarketPrices && getRealMarketPrice(commodity) !== null ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : ''}`}
                            placeholder="75.50"
                          />
                          {useRealMarketPrices && getRealMarketPrice(commodity) !== null && (
                            <p className="text-xs text-green-600">Using live price from Commodity Market</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`vol-${commodity}`} className="text-xs">Volatility (%)</Label>
                            {useRealMarketPrices && getRealVolatility() !== null && (
                              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                                From Pricers
                              </Badge>
                            )}
                          </div>
                          <Input
                            id={`vol-${commodity}`}
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={useRealMarketPrices && getRealVolatility() !== null ? getRealVolatility()! : data.volatility}
                            onChange={(e) => {
                              if (!useRealMarketPrices || getRealVolatility() === null)
                                updateCommodityMarketData(commodity, 'volatility', parseFloat(e.target.value) || data.volatility);
                            }}
                            disabled={useRealMarketPrices && getRealVolatility() !== null}
                            className={`font-mono text-sm ${useRealMarketPrices && getRealVolatility() !== null ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : ''}`}
                            placeholder="25"
                          />
                          {useRealMarketPrices && getRealVolatility() !== null && (
                            <p className="text-xs text-green-600 dark:text-green-400">Using volatility from Pricers (calculatorState)</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`risk-${commodity}`} className="text-xs">Risk-Free Rate (%)</Label>
                            {useRealMarketPrices && (
                              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                                {isCurveMode ? "Curve (Rate Explorer)" : "Fixed (USD)"}
                              </Badge>
                            )}
                          </div>
                          <Input
                            id={`risk-${commodity}`}
                            type="number"
                            step="0.01"
                            min="0"
                            max="20"
                            value={useRealMarketPrices ? usdRate1YDisplayPct : data.riskFreeRate}
                            onChange={(e) => {
                              if (!useRealMarketPrices)
                                updateCommodityMarketData(commodity, 'riskFreeRate', parseFloat(e.target.value) || data.riskFreeRate);
                            }}
                            disabled={useRealMarketPrices}
                            className={`font-mono text-sm ${useRealMarketPrices ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : ''}`}
                            placeholder="5.0"
                          />
                          {useRealMarketPrices && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              1Y USD reference from Rate Explorer settings; each row uses the rate at its own TTM.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No instruments found. Import strategies from Strategy Builder to see market parameters.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Individual Spot Price Overrides Summary */}
      {instruments.some(inst => inst.impliedSpotPrice) && (
        <Card className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Individual Spot Price Overrides
            </CardTitle>
            <CardDescription className="text-xs">
              Instruments using custom spot price instead of global market parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {instruments
                .filter(inst => inst.impliedSpotPrice)
                .map(inst => (
                  <Badge key={inst.id} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    {inst.id}: {inst.impliedSpotPrice?.toFixed(6)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-3 w-3 p-0 ml-1 text-blue-500 hover:text-red-500"
                      onClick={() => resetInstrumentSpotPrice(inst.id)}
                      title="Reset to global spot price"
                    >
                      ×
                    </Button>
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notional</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalNotional)}</div>
            <p className="text-xs text-muted-foreground">
              Across {instruments.length} instruments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mark-to-Market</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMTMColor(totalMTM)}`}>
              {formatCurrency(totalMTM)}
            </div>
            <p className="text-xs text-muted-foreground">
              Unrealized P&L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hedge Accounting</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hedgeAccountingCount}</div>
            <p className="text-xs text-muted-foreground">
              Qualifying instruments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Near Maturity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              Next 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Commodity Hedging Instruments</CardTitle>
              <CardDescription>
                Manage forwards, options, swaps and other commodity hedging instruments
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {/* Toggle Export Columns */}
              <Button 
                onClick={() => setShowExportColumns(!showExportColumns)}
                variant={showExportColumns ? "default" : "outline"}
                size="sm"
                className="whitespace-nowrap"
              >
                {showExportColumns ? "Hide Export" : "Show Export"}
              </Button>
              
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Instrument
                </Button>
              </DialogTrigger>
              <Button
                variant="destructive"
                onClick={deleteAllInstruments}
                disabled={instruments.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
              <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Add New Commodity Hedging Instrument</DialogTitle>
                  <DialogDescription>
                    Create a new commodity hedging instrument entry. Same inputs as Pricers.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddInstrument} className="flex flex-col min-h-0">
                  <div className="grid gap-4 py-4 overflow-y-auto pr-1 space-y-4">
                    {/* Ticker Peek Pro Toggle */}
                    <div className={`p-2.5 rounded-lg border ${useTppData ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' : 'bg-muted/30 border-border'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={useTppData}
                            onCheckedChange={(checked) => {
                              setUseTppData(checked);
                              localStorage.setItem('hedgingUseTickerPeekPro', JSON.stringify(checked));
                            }}
                          />
                          <label className="text-sm font-medium text-foreground cursor-pointer" onClick={() => {
                            const next = !useTppData;
                            setUseTppData(next);
                            localStorage.setItem('hedgingUseTickerPeekPro', JSON.stringify(next));
                          }}>
                            Use Data from Ticker Peek Pro
                          </label>
                        </div>
                        {useTppData && (
                          <span className="text-xs text-muted-foreground">
                            {tpp.tppLoadingCurrencies ? 'Loading...' : `${tpp.tppCurrencies.length} instruments`}
                          </span>
                        )}
                      </div>
                      {useTppData && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Spot = interpolated futures price at maturity, Vol = interpolated from IV Matrix, Rate = {isCurveMode ? 'Yield Curve (Bootstrapped)' : 'Bank Rate'}.
                          </p>
                          {tpp.tppLoadingFutures && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Loading futures curve...
                            </p>
                          )}
                          {!tpp.tppLoadingFutures && tpp.tppFutures.length > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              Futures curve ready ({tpp.tppFutures.length} contracts)
                            </p>
                          )}
                          {tpp.tppLoadingSurface && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Building IV surface...
                            </p>
                          )}
                          {!tpp.tppLoadingSurface && tpp.tppSurfacePoints.length > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              IV Surface ready ({tpp.tppSurfacePoints.length} pts)
                            </p>
                          )}
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Risk-free rate from {isCurveMode ? 'Rate Explorer (Yield Curve)' : 'Bank Rate USD'}: {getInterestRateForPricing.toFixed(2)}%
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Type</Label>
                      <Select value={addFormType} onValueChange={setAddFormType}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select instrument type" />
                        </SelectTrigger>
                        <SelectContent>
                          {HEDGING_INSTRUMENT_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Commodity</Label>
                      <Select 
                        value={addFormCommodity} 
                        onValueChange={setAddFormCommodity}
                        disabled={useTppData && tpp.tppLoadingCurrencies}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder={
                            useTppData && tpp.tppLoadingCurrencies ? "Loading TPP instruments..." : "Select commodity"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {useTppData ? (
                            <>
                              <div className="p-2 border-b sticky top-0 bg-background z-10">
                                <Input
                                  placeholder="Search commodities..."
                                  value={tppSearchQuery}
                                  onChange={(e) => setTppSearchQuery(e.target.value)}
                                  className="h-8"
                                />
                              </div>
                              {(() => {
                                const searchLower = tppSearchQuery.toLowerCase().trim();
                                const categoryConfig = [
                                  { key: 'energies', label: 'Energies' },
                                  { key: 'metals', label: 'Metals' },
                                  { key: 'grains', label: 'Grains' },
                                  { key: 'livestock', label: 'Livestock' },
                                ];
                                const groups = categoryConfig.map(cat => {
                                  const items = tpp.tppCurrenciesByCategory[cat.key] || [];
                                  const filtered = searchLower
                                    ? items.filter(c =>
                                        c.symbol.toLowerCase().includes(searchLower) ||
                                        c.name.toLowerCase().includes(searchLower)
                                      )
                                    : items;
                                  return { ...cat, items: filtered };
                                }).filter(g => g.items.length > 0);
                                return groups.map(group => (
                                  <SelectGroup key={group.key}>
                                    <SelectLabel className="text-xs text-muted-foreground">{group.label}</SelectLabel>
                                    {group.items.map(c => (
                                      <SelectItem key={c.symbol} value={c.symbol}>
                                        {c.symbol} — {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ));
                              })()}
                            </>
                          ) : (
                            CURRENCY_PAIRS.map((pair) => (
                              <SelectItem key={pair.symbol} value={pair.symbol}>{pair.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border-t pt-3 mt-1">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Dates</p>
                      <div className="grid gap-3">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Start Date</Label>
                          <Input type="date" className="col-span-3" value={addFormStartDate} onChange={(e) => setAddFormStartDate(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Maturity Date</Label>
                          <Input type="date" className="col-span-3" value={addFormMaturity} onChange={(e) => setAddFormMaturity(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Maturity (years)</Label>
                          <Input type="number" step="0.01" className="col-span-3 bg-muted" readOnly value={addFormTimeToMaturity.toFixed(2)} />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Basic Parameters</p>
                      <div className="grid gap-3">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Spot Price</Label>
                          <div className="col-span-3 flex gap-2">
                            <Input type="number" step="0.0001" className="flex-1" value={addFormSpotPrice} onChange={(e) => setAddFormSpotPrice(e.target.value)} />
                            {useTppData && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleRefreshTppSpot}
                                disabled={tpp.tppLoadingFutures || tpp.tppFutures.length === 0}
                                title="Refresh Spot Price (raw market price)"
                              >
                                <RefreshCw className={`h-4 w-4 ${tpp.tppLoadingFutures ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right text-muted-foreground" title="Forward = Spot × exp(r × t). C'est ce prix qui est utilisé pour le pricing (Black-76).">Forward Price</Label>
                          <Input type="number" step="0.0001" className="col-span-3 bg-muted font-mono" readOnly value={addFormForwardPrice != null ? addFormForwardPrice.toFixed(4) : ''} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Strike Price</Label>
                          <div className="col-span-3 flex gap-2">
                            <Input type="number" step="0.01" className="flex-1" value={addFormRate} onChange={(e) => setAddFormRate(e.target.value)} />
                            <Select value={addFormStrikeType} onValueChange={(v: "percent" | "absolute") => setAddFormStrikeType(v)}>
                              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">%</SelectItem>
                                <SelectItem value="absolute">Abs</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Quantity</Label>
                          <Input type="number" step="1" className="col-span-3" value={addFormQuantity} onChange={(e) => setAddFormQuantity(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Notional (Volume)</Label>
                          <Input type="number" step="1000" className="col-span-3" value={addFormNotional} onChange={(e) => setAddFormNotional(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">Volatility (%)</Label>
                          <div className="col-span-3 flex gap-2">
                            <Input 
                              type="number" 
                              step="0.1" 
                              className="flex-1" 
                              value={addFormVolatility} 
                              onChange={(e) => setAddFormVolatility(e.target.value)} 
                            />
                            {useTppData && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleRefreshTppIV}
                                disabled={tpp.tppLoadingSurface || tpp.tppSurfacePoints.length === 0}
                                title="Refresh IV from TPP surface"
                              >
                                <RefreshCw className={`h-4 w-4 ${tpp.tppLoadingSurface ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right" title="Taux interpolé à la maturité (même logique que Rate Explorer « Rates at custom date »)">Risk-free Rate (%)</Label>
                          <div className="col-span-3 flex gap-2">
                            <Input type="number" step="0.01" className="flex-1" value={addFormInterestRate} onChange={(e) => setAddFormInterestRate(e.target.value)} />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleRefreshInterestRate}
                              title={isCurveMode ? "Interpoler le taux à la maturité (courbe bootstrapée)" : "Utiliser le Bank Rate USD"}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(addFormType.includes("Knock") || addFormType.includes("Touch")) && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Barrier</p>
                        <div className="grid gap-3">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Barrier</Label>
                            <div className="col-span-3 flex gap-2">
                              <Input type="number" step="0.01" className="flex-1" placeholder="e.g. 110" value={addFormBarrier} onChange={(e) => setAddFormBarrier(e.target.value)} />
                              <Select value={addFormBarrierType} onValueChange={(v: "percent" | "absolute") => setAddFormBarrierType(v)}>
                                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent">%</SelectItem>
                                  <SelectItem value="absolute">Abs</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {addFormType.includes("Double") && (
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label className="text-right">Second Barrier</Label>
                              <div className="col-span-3 flex gap-2">
                                <Input type="number" step="0.01" className="flex-1" value={addFormSecondBarrier} onChange={(e) => setAddFormSecondBarrier(e.target.value)} />
                                <Select value={addFormBarrierType} onValueChange={(v: "percent" | "absolute") => setAddFormBarrierType(v)}>
                                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percent">%</SelectItem>
                                    <SelectItem value="absolute">Abs</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(addFormType.includes("Touch") || addFormType.includes("Binary")) && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Digital options</p>
                        <div className="grid gap-3">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Rebate (%)</Label>
                            <Input type="number" step="0.1" className="col-span-3" value={addFormRebate} onChange={(e) => setAddFormRebate(e.target.value)} />
                          </div>
                          {addFormType === "One-Touch" && (
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label className="text-right">Time to Payoff (years)</Label>
                              <Input type="number" step="0.01" className="col-span-3" value={addFormTimeToPayoff} onChange={(e) => setAddFormTimeToPayoff(e.target.value)} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Storage Cost (%)</Label>
                        <Input type="number" step="0.01" className="col-span-3" value={addFormStorageCost} onChange={(e) => setAddFormStorageCost(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-3">
                        <Label className="text-right">Convenience Yield (%)</Label>
                        <Input type="number" step="0.01" className="col-span-3" value={addFormConvenienceYield} onChange={(e) => setAddFormConvenienceYield(e.target.value)} />
                      </div>
                    </div>

                    {/* Theo price (from inputs) + Real price (optional); stored price = real if set, else theo */}
                    <div className="border-t pt-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Pricing</p>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Theo price</Label>
                        <div className="col-span-3 font-mono text-sm bg-muted/50 px-3 py-2 rounded border">
                          {addFormTheoPrice != null ? addFormTheoPrice.toFixed(4) : "—"}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Real price (optional)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="Market price to store"
                          className="col-span-3"
                          value={addFormRealPrice}
                          onChange={(e) => setAddFormRealPrice(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Unit price saved: Real price if filled, otherwise Theo price.</p>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4 border-t pt-3">
                      <Label className="text-right">Portfolio</Label>
                      <div className="col-span-3 flex gap-2">
                        <Select value={addFormPortfolio || "__none__"} onValueChange={(v) => setAddFormPortfolio(v === "__none__" ? "" : v)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select portfolio (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {portfolios.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsAddPortfolioOpen(true)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Counterparty</Label>
                      <div className="col-span-3 flex gap-2">
                        <Select value={addFormCounterparty} onValueChange={setAddFormCounterparty}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select counterparty" />
                          </SelectTrigger>
                          <SelectContent>
                            {counterparties.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsAddCounterpartyOpen(true)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="border-t pt-4 mt-2 shrink-0">
                    <Button type="submit">Add Instrument</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Dialog Add portfolio */}
            <Dialog open={isAddPortfolioOpen} onOpenChange={setIsAddPortfolioOpen}>
              <DialogContent className="sm:max-w-[360px]">
                <DialogHeader>
                  <DialogTitle>Add portfolio</DialogTitle>
                  <DialogDescription>Create a new portfolio to assign to instruments.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-portfolio-name">Name</Label>
                    <Input
                      id="new-portfolio-name"
                      value={newPortfolioName}
                      onChange={(e) => setNewPortfolioName(e.target.value)}
                      placeholder="e.g. Trading Book"
                      onKeyDown={(e) => e.key === "Enter" && addPortfolio()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddPortfolioOpen(false)}>Cancel</Button>
                  <Button onClick={addPortfolio}>Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog Add counterparty */}
            <Dialog open={isAddCounterpartyOpen} onOpenChange={setIsAddCounterpartyOpen}>
              <DialogContent className="sm:max-w-[360px]">
                <DialogHeader>
                  <DialogTitle>Add counterparty</DialogTitle>
                  <DialogDescription>Create a new counterparty to assign to instruments.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-counterparty-name">Name</Label>
                    <Input
                      id="new-counterparty-name"
                      value={newCounterpartyName}
                      onChange={(e) => setNewCounterpartyName(e.target.value)}
                      placeholder="e.g. Goldman Sachs"
                      onKeyDown={(e) => e.key === "Enter" && addCounterparty()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddCounterpartyOpen(false)}>Cancel</Button>
                  <Button onClick={addCounterparty}>Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters by portfolio and counterparty */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Display by portfolio</Label>
              <Select value={filterByPortfolio || "all"} onValueChange={(v) => setFilterByPortfolio(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px] bg-muted/50">
                  <SelectValue placeholder="All instruments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All instruments</SelectItem>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Display by counterparty</Label>
              <Select value={filterByCounterparty || "all"} onValueChange={(v) => setFilterByCounterparty(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px] bg-muted/50">
                  <SelectValue placeholder="All instruments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All instruments</SelectItem>
                  {counterparties.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="forwards">Forwards</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              <TabsTrigger value="swaps">Swaps</TabsTrigger>
              <TabsTrigger value="hedge-accounting">Hedge Accounting</TabsTrigger>
            </TabsList>
            
            <TabsContent value={selectedTab} className="mt-4">
              {filteredInstruments.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Commodity Hedging Instruments</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't imported any strategies yet. Create and import strategies from the Strategy Builder.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button asChild>
                      <a href="/strategy-builder">
                        <Target className="h-4 w-4 mr-2" />
                        Go to Strategy Builder
                      </a>
                    </Button>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Manual Instrument
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full border rounded-lg overflow-hidden bg-background">
                  <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 250px)', minHeight: '600px', overflowY: 'auto' }}>
                    <Table className="min-w-full border-collapse">
                     <TableHeader className="bg-muted/50 dark:bg-muted/80 sticky top-0 z-10">
                       <TableRow className="border-b-2 border-border">
                         {/* Fixed columns */}
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[60px] sticky left-0 z-[1] shadow-sm">ID</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[90px]">Type</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[100px]">Commodity</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[80px]">Quantity (%)</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[110px]">Unit Price (Initial)</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[100px]">Today Price</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[100px]">MTM</TableHead>
                         
                         {/* Dynamic columns with conditional Export */}
                         <TableHead colSpan={showExportColumns ? 2 : 1} className="text-center border-b border-r border-border bg-blue-50 dark:bg-blue-950/30 font-semibold w-[110px]">Time to Maturity</TableHead>
                         <TableHead colSpan={showExportColumns ? 2 : 1} className="text-center border-b border-r border-border bg-green-50 dark:bg-green-950/30 font-semibold w-[100px]">Spot Price</TableHead>
                         <TableHead colSpan={showExportColumns ? 2 : 1} className="text-center border-b border-r border-border bg-yellow-50 dark:bg-yellow-950/30 font-semibold w-[100px]">Volatility (%)</TableHead>
                         <TableHead colSpan={showExportColumns ? 2 : 1} className="text-center border-b border-r border-border bg-purple-50 dark:bg-purple-950/30 font-semibold w-[110px]">Risk-Free Rate (%)</TableHead>
                         <TableHead colSpan={showExportColumns ? 2 : 1} className="text-center border-b border-r border-border bg-indigo-50 dark:bg-indigo-950/30 font-semibold w-[110px]">Forward Price</TableHead>
                         <TableHead colSpan={showExportColumns ? 2 : 1} className="text-center border-b border-r border-border bg-orange-50 dark:bg-orange-950/30 font-semibold w-[110px]">Strike Analysis</TableHead>
                         
                         {/* Fixed end columns */}
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[80px]">Barrier 1</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[80px]">Barrier 2</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[80px]">Rebate (%)</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[90px]">Notional</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[100px]">Total premium</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[100px]">Maturity</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center border-r border-border w-[80px]">Status</TableHead>
                         <TableHead rowSpan={2} className="bg-muted/50 dark:bg-muted/80 font-semibold text-center w-[120px]">Actions</TableHead>
                    </TableRow>
                       <TableRow className="border-b border-border">
                         {/* Sub-headers for dynamic columns */}
                         {showExportColumns && <TableHead className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-r border-border font-medium">Export</TableHead>}
                         <TableHead className="text-xs text-green-600 dark:text-green-400 bg-blue-50 dark:bg-blue-950/30 border-r border-border font-medium">Current</TableHead>
                         
                         {showExportColumns && <TableHead className="text-xs text-blue-600 dark:text-blue-400 bg-green-50 dark:bg-green-950/30 border-r border-border font-medium">Export</TableHead>}
                         <TableHead className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-r border-border font-medium">Current</TableHead>
                         
                         {showExportColumns && <TableHead className="text-xs text-blue-600 dark:text-blue-400 bg-yellow-50 dark:bg-yellow-950/30 border-r border-border font-medium">Export</TableHead>}
                         <TableHead className="text-xs text-green-600 dark:text-green-400 bg-yellow-50 dark:bg-yellow-950/30 border-r border-border font-medium">Current</TableHead>
                         
                         {showExportColumns && <TableHead className="text-xs text-blue-600 dark:text-blue-400 bg-purple-50 dark:bg-purple-950/30 border-r border-border font-medium">Export</TableHead>}
                         <TableHead className="text-xs text-green-600 dark:text-green-400 bg-purple-50 dark:bg-purple-950/30 border-r border-border font-medium">Current</TableHead>
                         
                         {showExportColumns && <TableHead className="text-xs text-blue-600 dark:text-blue-400 bg-pink-50 dark:bg-pink-950/30 border-r border-border font-medium">Export</TableHead>}
                         <TableHead className="text-xs text-green-600 dark:text-green-400 bg-pink-50 dark:bg-pink-950/30 border-r border-border font-medium">Current</TableHead>
                         
                         {showExportColumns && <TableHead className="text-xs text-blue-600 dark:text-blue-400 bg-indigo-50 dark:bg-indigo-950/30 border-r border-border font-medium">Export</TableHead>}
                         <TableHead className="text-xs text-green-600 dark:text-green-400 bg-indigo-50 dark:bg-indigo-950/30 border-r border-border font-medium">Current</TableHead>
                         
                         {showExportColumns && <TableHead className="text-xs text-blue-600 dark:text-blue-400 bg-orange-50 dark:bg-orange-950/30 border-r border-border font-medium">Export</TableHead>}
                         <TableHead className="text-xs text-green-600 dark:text-green-400 bg-orange-50 dark:bg-orange-950/30 font-medium">Current</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInstruments.map((instrument) => {
                      // Calculate derived values
                      const quantityToHedge = instrument.quantity || 0;
                      // Use real option price from Detailed Results if available, otherwise use premium
                      const unitPrice = instrument.realOptionPrice || instrument.premium || 0;
                      // Calculate today's price using current market parameters
                      const todayPrice = calculateTodayPrice(instrument);
                      
                      // ✅ Calculate MTM with proper long/short logic (same as total MTM calculation)
                      // ✅ CORRECTION : Logique correcte pour initialPrice dans le tableau
                      const isExportedStrategy = instrument.exportSpotPrice && instrument.exportTimeToMaturity;
                      // Pour les stratégies exportées : initialPrice = prix d'export (pour MTM=0 à l'export)
                      // Pour les stratégies manuelles : initialPrice = premium saisi par l'utilisateur
                      const initialPrice = isExportedStrategy ? unitPrice : (instrument.premium || 0);
                      
                      const isShort = quantityToHedge < 0;
                      let mtmValue;
                      if (isShort) {
                        // For short positions: MTM = Initial Price - Today's Price
                        mtmValue = initialPrice - todayPrice;
                      } else {
                        // For long positions: MTM = Today's Price - Initial Price  
                        mtmValue = todayPrice - initialPrice;
                      }
                      
                      console.log(`[DEBUG] ${instrument.id}: Table MTM - Initial: ${initialPrice.toFixed(6)}, Today: ${todayPrice.toFixed(6)}, MTM: ${mtmValue.toFixed(6)}, Exported: ${isExportedStrategy}`);
                        const dteDisplay = instrument.maturity ? getDte(instrument.maturity, valuationDate) : 0;
                        const timeToMaturity = instrument.maturity ? calculateTimeToMaturity(instrument.maturity, valuationDate) : 0;
                      // Use implied volatility from Detailed Results if available, otherwise use component volatility
                      const volatility = instrument.impliedVolatility || instrument.volatility || 0;
                      // FIX: Le notional contient déjà la quantité appliquée, donc volumeToHedge = notional
                      const volumeToHedge = instrument.notional; // Plus de double multiplication
                      const calculatedNotional = unitPrice * volumeToHedge;
                      
                      return (
                         <TableRow key={instrument.id} className="hover:bg-muted/50 dark:hover:bg-muted/30 border-b border-border transition-all duration-200 group">
                           <TableCell className="font-semibold bg-muted/50 dark:bg-muted/80 border-r border-border text-center sticky left-0 z-[1] shadow-sm text-foreground w-[60px]">
                             <div className="px-2 py-1 rounded-md bg-background">
                               {instrument.id}
                             </div>
                           </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                              {getInstrumentIcon(instrument.type)}
                              </div>
                              <div className="space-y-1">
                                <div className="font-medium text-foreground">{instrument.type}</div>
                                {instrument.strategyName && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                    From: {instrument.strategyName}
                                  </div>
                                )}
                                {instrument.repricingData && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                    Period Data ✓
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-mono font-semibold px-3 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                              {instrument.currency}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-mono font-semibold text-sm">
                            {quantityToHedge.toFixed(1)}%
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-mono text-foreground font-semibold">
                              {unitPrice > 0 ? unitPrice.toFixed(4) : 
                                <span className="text-slate-400 italic">N/A</span>
                              }
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="space-y-1">
                              <div className={`font-mono font-semibold ${todayPrice !== 0 ? "text-blue-600" : "text-slate-400"}`}>
                              {todayPrice !== 0 ? todayPrice.toFixed(4) : 'N/A'}
                              </div>
                            {(() => {
                              // Détecter le modèle de pricing utilisé (EXACTEMENT la même logique que calculateTodayPrice)
                              const optionType = instrument.type.toLowerCase();
                              let modelName = "unknown";
                              let modelColor = "bg-muted text-muted-foreground";
                              
                              // 1. OPTIONS DOUBLE BARRIÈRE - PRIORITÉ ABSOLUE (avant toutes les autres)
                              if (optionType.includes('double')) {
                                modelName = "closed-form (double)";
                                modelColor = "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400";
                              }
                              // 2. OPTIONS BARRIÈRES SIMPLES - DEUXIÈME PRIORITÉ
                              else if (optionType.includes('knock-out') || optionType.includes('knock-in') || 
                                  optionType.includes('barrier') || optionType.includes('ko ') || optionType.includes('ki ') ||
                                  optionType.includes('knockout') || optionType.includes('knockin') || optionType.includes('reverse')) {
                                modelName = "closed-form";
                                modelColor = "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400";
                              }
                              // 3. OPTIONS DIGITALES - TROISIÈME PRIORITÉ
                              else if (optionType.includes('touch') || optionType.includes('binary') || 
                                       optionType.includes('digital')) {
                                modelName = "monte-carlo";
                                modelColor = "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400";
                              }
                              // 4. OPTIONS VANILLES EXPLICITES
                              else if (optionType === 'vanilla call' || optionType === 'vanilla put') {
                                modelName = optionPricingModel === 'monte-carlo' ? "monte-carlo" : "black-scholes";
                                modelColor = optionPricingModel === 'monte-carlo' ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400" : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400";
                              }
                              // 5. FORWARDS
                              else if (optionType === 'forward') {
                                modelName = "commodity-forward";
                                modelColor = "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400";
                              }
                              // 6. SWAPS
                              else if (optionType === 'swap') {
                                modelName = "commodity-swap";
                                modelColor = "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400";
                              }
                              // 7. OPTIONS VANILLES GÉNÉRIQUES - SEULEMENT si pas déjà traité
                              else if (optionType.includes('call') && !optionType.includes('knock')) {
                                modelName = optionPricingModel === 'monte-carlo' ? "monte-carlo" : "black-scholes";
                                modelColor = optionPricingModel === 'monte-carlo' ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400" : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400";
                              } else if (optionType.includes('put') && !optionType.includes('knock')) {
                                modelName = optionPricingModel === 'monte-carlo' ? "monte-carlo" : "black-scholes";
                                modelColor = optionPricingModel === 'monte-carlo' ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400" : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400";
                              }
                              
                              return (
                                <div className={`text-xs px-2 py-1 rounded-md font-medium ${modelColor}`}>
                                  {modelName}
                                </div>
                              );
                            })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={`inline-flex items-center justify-center px-3 py-1 rounded-lg font-mono font-semibold ${
                              mtmValue >= 0 
                                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
                                : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            }`}>
                              {(() => {
                                const displayMtm = roundPrice4(mtmValue);
                                return displayMtm === 0 ? '0.0000' : (displayMtm >= 0 ? '+' : '') + displayMtm.toFixed(4);
                              })()}
                            </div>
                          </TableCell>
                                                     {/* Time to Maturity - Export: même formule que Current, avec date de début export pour cohérence même jour */}
                           {showExportColumns && (
                             <TableCell className="font-mono text-center bg-blue-50 dark:bg-blue-950/30 border-r border-border">
                              {(() => {
                                const exportStart = instrument.exportHedgingStartDate || instrument.exportStrategyStartDate;
                                const exportTtm = exportStart
                                  ? calculateTimeToMaturity(instrument.maturity, exportStart)
                                  : (instrument.exportTimeToMaturity ?? 0);
                                const exportDteVal = daysToMaturityFromYearsAct36525(exportTtm);
                                if (exportTtm <= 0 && !instrument.exportTimeToMaturity) return <div className="text-xs text-blue-600 dark:text-blue-400">N/A</div>;
                                return (
                                  <>
                                    <div className="text-xs text-blue-600 dark:text-blue-400">
                                      {exportTtm.toFixed(4)}y
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {exportDteVal}d
                                    </div>
                                  </>
                                );
                              })()}
                          </TableCell>
                           )}
                          
                          {/* Time to Maturity - Current */}
                           <TableCell className="text-center bg-green-50/80 dark:bg-green-950/30 border-r border-border">
                            <div className="space-y-1">
                              <div className={`text-sm font-mono font-semibold ${timeToMaturity === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                              {timeToMaturity.toFixed(4)}y
                            </div>
                              <div className={`text-xs px-2 py-1 rounded-md ${timeToMaturity === 0 ? 'text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-950/30' : 'text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-950/30'}`}>
                              {timeToMaturity === 0 ? 'EXPIRED' : `${dteDisplay}d`}
                              </div>
                              <div className={`text-xs px-2 py-1 rounded-md ${timeToMaturity === 0 ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30' : 'text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-950/30'}`}>
                                {timeToMaturity === 0 ? `Expired on ${instrument.maturity}` : `From ${valuationDate} to ${instrument.maturity}`}
                              </div>
                            </div>
                          </TableCell>
                          
                                                     {/* Spot Price - Export (conditional) */}
                           {showExportColumns && (
                             <TableCell className="text-center bg-blue-50/80 dark:bg-blue-950/30 border-r border-border">
                               <div className="text-sm font-mono font-semibold text-blue-700 dark:text-blue-400">
                              {instrument.exportSpotPrice ? 
                                instrument.exportSpotPrice.toFixed(6) : 
                                   <span className="text-blue-400 italic">N/A</span>
                              }
                            </div>
                          </TableCell>
                           )}
                          
                          {/* Spot Price - Current: prix spot brut (non bootstrapé) */}
                           <TableCell className="text-center bg-green-50/80 dark:bg-green-950/30 border-r border-border">
                            {(() => {
                              const marketData = commodityMarketData[instrument.currency] || getMarketDataFromInstruments(instrument.currency) || { spot: 1.0000, volatility: 20, domesticRate: 1.0, foreignRate: 1.0 };
                              
                              let currentSpot: number;
                              let isUsingRealPrice = false;
                              if (useRealMarketPrices) {
                                const realPrice = getRealMarketPrice(instrument.currency);
                                if (realPrice !== null && realPrice > 0) {
                                  currentSpot = realPrice;
                                  isUsingRealPrice = true;
                                } else {
                                  currentSpot = instrument.impliedSpotPrice || marketData.spot;
                                }
                              } else {
                                currentSpot = instrument.impliedSpotPrice || marketData.spot;
                              }
                              
                              return (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      value={instrument.impliedSpotPrice ?? currentSpot}
                                      onChange={(e) => {
                                        if (!isUsingRealPrice) {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value) && value > 0) {
                                          updateInstrumentSpotPrice(instrument.id, value);
                                          }
                                        }
                                      }}
                                      placeholder={currentSpot.toFixed(6)}
                                      disabled={isUsingRealPrice}
                                      className={`w-20 h-6 text-xs text-center border-green-200 dark:border-green-800 focus:border-green-400 dark:focus:border-green-600 focus:ring-green-400/20 ${
                                        isUsingRealPrice ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700' : 'bg-background'
                                      }`}
                                      step="0.0001"
                                      min="0"
                                    />
                                    {instrument.impliedSpotPrice && !isUsingRealPrice && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 text-gray-400 hover:text-red-500"
                                        onClick={() => resetInstrumentSpotPrice(instrument.id)}
                                        title="Reset to global spot price"
                                      >
                                        ×
                                      </Button>
                                    )}
                                  </div>
                                <div className={`text-xs px-2 py-1 rounded-md ${
                                  isUsingRealPrice 
                                    ? 'text-green-700 dark:text-green-400 bg-green-100/70 dark:bg-green-950/30' 
                                    : 'text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-950/30'
                                }`}>
                                    {isUsingRealPrice ? 'Real: ' : ''}{currentSpot.toFixed(4)}
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          
                                                     {/* Volatility - Export (conditional) */}
                           {showExportColumns && (
                             <TableCell className="text-center bg-blue-50/80 dark:bg-blue-950/30 border-r border-border">
                               <div className="text-sm font-mono font-semibold text-blue-700 dark:text-blue-400">
                              {instrument.exportVolatility ? 
                                `${instrument.exportVolatility.toFixed(2)}%` : 
                                   <span className="text-blue-400 italic">N/A</span>
                              }
                            </div>
                          </TableCell>
                           )}
                          
                          {/* Volatility - Current (mirrors calculateTodayPrice priority) */}
                           <TableCell className="text-center bg-green-50/80 dark:bg-green-950/30 border-r border-border">
                            <div className="space-y-1">
                              {(() => {
                                const md = commodityMarketData[instrument.currency] || getMarketDataFromInstruments(instrument.currency) || { spot: 1, volatility: 20, riskFreeRate: 1 };
                                const isExp = !!(instrument.exportSpotPrice && instrument.exportTimeToMaturity);
                                let volPct: number | null = null;
                                let source = '';
                                if (useRealMarketPrices) {
                                  const surfaceIV = realTimeVolByInstrumentId[instrument.id];
                                  if (surfaceIV != null && surfaceIV > 0) { volPct = surfaceIV; source = 'TPP surface'; }
                                  else if (instrument.impliedVolatility != null && instrument.impliedVolatility > 0) { volPct = instrument.impliedVolatility; source = 'Individual'; }
                                  else if (isExp && instrument.exportVolatility != null && instrument.exportVolatility > 0) { volPct = instrument.exportVolatility; source = 'Export'; }
                                  else if (instrument.volatility != null && instrument.volatility > 0) { volPct = instrument.volatility; source = 'Instrument'; }
                                  else { volPct = md.volatility || 20; source = 'Market'; }
                                } else {
                                  if (instrument.impliedVolatility != null) { volPct = instrument.impliedVolatility; source = 'Individual'; }
                                  else if (isExp && instrument.exportVolatility != null) { volPct = instrument.exportVolatility; source = 'Export'; }
                                  else {
                                    const realVol = getRealVolatility();
                                    if (realVol != null && realVol > 0) { volPct = realVol; source = 'Pricers'; }
                                    else if (instrument.volatility != null) { volPct = instrument.volatility; source = 'Instrument'; }
                                    else { volPct = md.volatility || 20; source = 'Market'; }
                                  }
                                }
                                return (
                                  <>
                                    <div className="font-mono text-sm font-semibold text-green-700 dark:text-green-400">
                                      {volPct != null ? Number(volPct).toFixed(2) : '—'}%
                                    </div>
                                    <div className="text-xs text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-950/30 px-2 py-1 rounded-md">
                                      {source}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </TableCell>
                          
                                                     {/* Risk-Free Rate - Export (conditional) */}
                           {showExportColumns && (
                             <TableCell className="font-mono text-center bg-blue-50 dark:bg-blue-950/30 border-r border-border">
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              {instrument.exportDomesticRate ? 
                                `${instrument.exportDomesticRate.toFixed(3)}%` : 
                                'N/A'
                              }
                                </div>
                          </TableCell>
                           )}
                          
                          {/* Risk-Free Rate - Current (mirrors calculateTodayPrice r_d) */}
                          <TableCell className="font-mono text-center bg-green-50 dark:bg-green-950/30">
                            {(() => {
                              const rawTtm = calculateTimeToMaturity(instrument.maturity, valuationDate);
                              const isExp = !!(instrument.exportSpotPrice && instrument.exportTimeToMaturity);
                              let ratePct: number;
                              let src = '';
                              if (useRealMarketPrices) {
                                const rd = getRate('USD', rawTtm);
                                ratePct = rd * 100;
                                src = isCurveMode ? 'Rate Explorer' : 'Fixed (USD)';
                              } else if (isExp && instrument.exportDomesticRate != null) {
                                ratePct = instrument.exportDomesticRate;
                                src = 'Export';
                              } else {
                                const sbR = readStrategyBuilderPricingFromStorage();
                                const rd = sbR.useRealInterestRate && sbR.pricingCurrencyQuote
                                  ? getRate(sbR.pricingCurrencyQuote, rawTtm)
                                  : strategyBuilderAnnualPercentToDecimal(sbR.interestRatePercent);
                                ratePct = rd * 100;
                                src = sbR.useRealInterestRate ? 'Rate Explorer' : 'SB param';
                              }
                              return (
                                <>
                                  <div className="text-xs text-green-600 dark:text-green-400">
                                    {ratePct.toFixed(3)}%
                                  </div>
                                  <div className="text-xs text-green-500 dark:text-green-500 opacity-70">
                                    {src}
                                  </div>
                                </>
                              );
                            })()}
                          </TableCell>
                          
                          
                                                     {/* Forward Price - Export (conditional) */}
                           {showExportColumns && (
                             <TableCell className="font-mono text-center bg-blue-50 dark:bg-blue-950/30 border-r border-border">
<div className="text-xs text-blue-600 dark:text-blue-400">
                                {instrument.exportForwardPrice ?
                                instrument.exportForwardPrice.toFixed(6) : 
                                'N/A'
                              }
                            </div>
                          </TableCell>
                           )}
                          
                          {/* Forward Price - Current (mirrors calculateTodayPrice S) */}
                          <TableCell className="font-mono text-center bg-green-50 dark:bg-green-950/30">
                            {(() => {
                              const md = commodityMarketData[instrument.currency] || getMarketDataFromInstruments(instrument.currency) || { spot: 1, volatility: 20, riskFreeRate: 2 };
                              const rawTtm = calculateTimeToMaturity(instrument.maturity, valuationDate);
                              const isExp = !!(instrument.exportSpotPrice && instrument.exportTimeToMaturity);

                              const sbR = readStrategyBuilderPricingFromStorage();
                              const rd = useRealMarketPrices
                                ? getRate('USD', rawTtm)
                                : (isExp && instrument.exportDomesticRate != null)
                                  ? instrument.exportDomesticRate / 100
                                  : (sbR.useRealInterestRate && sbR.pricingCurrencyQuote ? getRate(sbR.pricingCurrencyQuote, rawTtm) : strategyBuilderAnnualPercentToDecimal(sbR.interestRatePercent));
                              const currentSpot = useRealMarketPrices
                                ? (() => { const rp = getRealMarketPrice(instrument.currency); return (rp != null && rp > 0) ? rp : (instrument.impliedSpotPrice || (isExp ? instrument.exportSpotPrice! : md.spot)); })()
                                : (instrument.impliedSpotPrice || (isExp ? instrument.exportSpotPrice! : md.spot));

                              let fwd: number;
                              let src = '';
                              if (useRealMarketPrices) {
                                const fromCurve = getCurrentForwardFromTppCurve(instrument.currency, instrument.maturity);
                                if (fromCurve != null && fromCurve > 0) { fwd = fromCurve; src = 'TPP curve'; }
                                else { fwd = calculateCommodityForwardPrice(currentSpot, rd, 0, 0, rawTtm); src = 'Theoretical'; }
                              } else if (isExp && !instrument.impliedSpotPrice && instrument.exportForwardPrice != null && instrument.exportForwardPrice > 0) {
                                fwd = instrument.exportForwardPrice; src = 'Export';
                              } else {
                                fwd = calculateCommodityForwardPrice(currentSpot, rd, 0, 0, rawTtm); src = 'Theoretical';
                              }
                              return (
                                <>
                                  <div className="text-xs text-green-600 dark:text-green-400">{fwd.toFixed(6)}</div>
                                  <div className="text-xs text-green-500 dark:text-green-500 opacity-70">{src}</div>
                                </>
                              );
                            })()}
                          </TableCell>
                          
                                                     {/* Strike - Export (conditional) */}
                           {showExportColumns && (
                             <TableCell className="font-mono text-center bg-blue-50 dark:bg-blue-950/30 border-r border-border">
<div className="text-xs text-blue-600 dark:text-blue-400">
                                {(() => {
                                  if (instrument.exportStrike != null) return instrument.exportStrike.toFixed(4);
                                  if (instrument.originalComponent && instrument.exportSpotPrice != null) {
                                    const exportStrike = instrument.originalComponent.strikeType === 'percent'
                                      ? instrument.exportSpotPrice * (instrument.originalComponent.strike / 100)
                                      : instrument.originalComponent.strike;
                                    return exportStrike.toFixed(4);
                                  }
                                  return instrument.strike != null ? instrument.strike.toFixed(4) : 'N/A';
                                })()}
                            </div>
                            {instrument.originalComponent && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {instrument.originalComponent.strikeType}: {instrument.originalComponent.strike}
                              </div>
                            )}
                          </TableCell>
                           )}
                          
                          {/* Strike - Current */}
                          <TableCell className="font-mono text-center bg-green-50 dark:bg-green-950/30">
                            <div className="text-xs text-green-600 dark:text-green-400">
                            {instrument.strike ? instrument.strike.toFixed(4) : 'N/A'}
                            </div>
                            {instrument.originalComponent && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Current calculation
                              </div>
                            )}
                            {instrument.dynamicStrikeInfo && (
                              <div className="text-xs text-orange-600 dark:text-orange-400">
                                Dyn: {instrument.dynamicStrikeInfo.calculatedStrikePercent}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {instrument.barrier ? instrument.barrier.toFixed(4) : 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {instrument.secondBarrier ? instrument.secondBarrier.toFixed(4) : 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {instrument.rebate ? instrument.rebate.toFixed(2) : 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {formatCurrency(volumeToHedge)}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {calculatedNotional > 0 ? formatCurrency(calculatedNotional) : formatCurrency(instrument.notional)}
                          </TableCell>
                          <TableCell>{instrument.maturity}</TableCell>
                        <TableCell>
                          {instrument.effectiveness_ratio ? (
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={instrument.effectiveness_ratio} 
                                className="w-16 h-2" 
                              />
                              <span className="text-sm font-medium">
                                {instrument.effectiveness_ratio}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(timeToMaturity === 0 ? 'matured' : (instrument.status || 'active').toLowerCase())}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="View Details"
                              onClick={() => viewInstrument(instrument)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Edit"
                              onClick={() => editInstrument(instrument)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Delete"
                              onClick={() => deleteInstrument(instrument.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* View Instrument Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Instrument Details</DialogTitle>
            <DialogDescription>
              View detailed information about this hedging instrument
            </DialogDescription>
          </DialogHeader>
          {selectedInstrument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">ID</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Currency Pair</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.currency}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Quantity</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.quantity?.toFixed(1)}%</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Strike</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.strike?.toFixed(4) || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Maturity</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.maturity}</p>
                </div>
                {selectedInstrument.barrier && (
                  <div>
                    <Label className="text-sm font-medium">Barrier 1</Label>
                    <p className="text-sm text-muted-foreground">{selectedInstrument.barrier.toFixed(4)}</p>
                  </div>
                )}
                {selectedInstrument.secondBarrier && (
                  <div>
                    <Label className="text-sm font-medium">Barrier 2</Label>
                    <p className="text-sm text-muted-foreground">{selectedInstrument.secondBarrier.toFixed(4)}</p>
                  </div>
                )}
                {selectedInstrument.rebate && (
                  <div>
                    <Label className="text-sm font-medium">Rebate (%)</Label>
                    <p className="text-sm text-muted-foreground">{selectedInstrument.rebate.toFixed(2)}%</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Notional</Label>
                  <p className="text-sm text-muted-foreground">{formatCurrency(selectedInstrument.notional)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.status}</p>
                </div>
              </div>
              {selectedInstrument.strategyName && (
                <div>
                  <Label className="text-sm font-medium">Strategy Source</Label>
                  <p className="text-sm text-muted-foreground">{selectedInstrument.strategyName}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Instrument Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Instrument</DialogTitle>
            <DialogDescription>
              Modify the parameters of this hedging instrument
            </DialogDescription>
          </DialogHeader>
          {selectedInstrument && (
            <InstrumentEditForm 
              instrument={selectedInstrument}
              onSave={saveInstrumentChanges}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

// Component for editing instrument details
const InstrumentEditForm: React.FC<{
  instrument: HedgingInstrument;
  onSave: (instrument: HedgingInstrument) => void;
  onCancel: () => void;
}> = ({ instrument, onSave, onCancel }) => {
  const [editedInstrument, setEditedInstrument] = useState<HedgingInstrument>({ ...instrument });

  const handleSave = () => {
    onSave(editedInstrument);
  };

  const updateField = (field: keyof HedgingInstrument, value: any) => {
    setEditedInstrument(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edit-quantity">Quantity (%)</Label>
          <Input
            id="edit-quantity"
            type="number"
            step="0.1"
            value={editedInstrument.quantity || 0}
            onChange={(e) => updateField('quantity', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label htmlFor="edit-strike">Strike</Label>
          <Input
            id="edit-strike"
            type="number"
            step="0.0001"
            value={editedInstrument.strike || 0}
            onChange={(e) => updateField('strike', parseFloat(e.target.value) || 0)}
          />
        </div>
        {editedInstrument.barrier !== undefined && (
          <div>
            <Label htmlFor="edit-barrier">Barrier 1</Label>
            <Input
              id="edit-barrier"
              type="number"
              step="0.0001"
              value={editedInstrument.barrier || 0}
              onChange={(e) => updateField('barrier', parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
        {editedInstrument.secondBarrier !== undefined && (
          <div>
            <Label htmlFor="edit-second-barrier">Barrier 2</Label>
            <Input
              id="edit-second-barrier"
              type="number"
              step="0.0001"
              value={editedInstrument.secondBarrier || 0}
              onChange={(e) => updateField('secondBarrier', parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
        {editedInstrument.rebate !== undefined && (
          <div>
            <Label htmlFor="edit-rebate">Rebate (%)</Label>
            <Input
              id="edit-rebate"
              type="number"
              step="0.01"
              value={editedInstrument.rebate || 0}
              onChange={(e) => updateField('rebate', parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
        <div>
          <Label htmlFor="edit-notional">Notional</Label>
          <Input
            id="edit-notional"
            type="number"
            step="1000"
            value={editedInstrument.notional || 0}
            onChange={(e) => updateField('notional', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label htmlFor="edit-maturity">Maturity Date</Label>
          <Input
            id="edit-maturity"
            type="date"
            value={editedInstrument.maturity}
            onChange={(e) => updateField('maturity', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="edit-status">Status</Label>
          <Select value={editedInstrument.status} onValueChange={(value) => updateField('status', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Settled">Settled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </DialogFooter>
    </div>
  );
};

export default HedgingInstruments; 