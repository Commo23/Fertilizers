import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCommodityData } from "@/hooks/useCommodityData";
import { useTheme } from "@/hooks/useTheme";
import CommodityDataService from "@/services/CommodityDataService";
import FinancialDataService from "@/services/FinancialDataService";
import { fetchCommoditiesData } from "@/services/commodityApi";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Shield, 
  AlertTriangle,
  BarChart3,
  Globe,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Play,
  Pause
} from "lucide-react";

const Dashboard = () => {
  const { theme } = useTheme();
  const { 
    riskMetrics, 
    commodityExposures, 
    marketData, 
    isLiveMode, 
    setLiveMode, 
    lastUpdate,
    updateMarketData,
    generateStressScenarios
  } = useCommodityData();

  // Initialize commodity market data
  const [marketOverviewData, setMarketOverviewData] = useState<{
    WTI: { rate: number; change: number };
    BRENT: { rate: number; change: number };
    GOLD: { rate: number; change: number };
    SILVER: { rate: number; change: number };
    COPPER: { rate: number; change: number };
    NATGAS: { rate: number; change: number };
    CORN: { rate: number; change: number };
    WHEAT: { rate: number; change: number };
    SOYBEAN: { rate: number; change: number };
    COTTON: { rate: number; change: number };
    SUGAR: { rate: number; change: number };
    COFFEE: { rate: number; change: number };
  }>({
    WTI: { rate: 75.50, change: 1.2 },
    BRENT: { rate: 79.80, change: 0.8 },
    GOLD: { rate: 1980.50, change: -0.5 },
    SILVER: { rate: 24.30, change: 2.1 },
    COPPER: { rate: 3.85, change: 0.3 },
    NATGAS: { rate: 2.45, change: -1.5 },
    CORN: { rate: 4.85, change: 0.7 },
    WHEAT: { rate: 5.20, change: -0.2 },
    SOYBEAN: { rate: 12.80, change: 1.1 },
    COTTON: { rate: 0.85, change: 0.4 },
    SUGAR: { rate: 0.18, change: -0.3 },
    COFFEE: { rate: 1.45, change: 0.6 }
  });

  const [previousRates, setPreviousRates] = useState<{
    WTI: number;
    BRENT: number;
    GOLD: number;
    SILVER: number;
    COPPER: number;
    NATGAS: number;
    CORN: number;
    WHEAT: number;
    SOYBEAN: number;
    COTTON: number;
    SUGAR: number;
    COFFEE: number;
  } | null>(null);

  const commodityDataService = new CommodityDataService();
  const financialDataService = new FinancialDataService();


  // Function to get theme-adaptive text colors using CSS classes
  const getTextColors = () => {
    return {
      rate: 'text-slate-700 group-hover:text-slate-600 dark:text-blue-300 dark:group-hover:text-blue-200 bloomberg-theme:text-orange-300 bloomberg-theme:group-hover:text-orange-200',
      pair: 'text-slate-500 dark:text-blue-400/80 bloomberg-theme:text-orange-400/80',
      change: 'text-emerald-600 dark:text-emerald-400 bloomberg-theme:text-emerald-400'
    };
  };

  const textColors = getTextColors();

  // Function to get theme-adaptive currency card colors using CSS classes
  const getCurrencyCardClasses = (baseColor: string) => {
    const colorMap = {
      blue: 'from-blue-100/80 to-blue-50/60 border-blue-300/40 hover:border-blue-400/60 hover:shadow-blue-400/20 dark:from-blue-900/30 dark:to-blue-800/20 dark:border-blue-500/30 dark:hover:border-blue-400/60 dark:hover:shadow-blue-500/20 bloomberg-theme:from-orange-800/30 bloomberg-theme:to-orange-700/20 bloomberg-theme:border-orange-500/30 bloomberg-theme:hover:border-orange-400/60 bloomberg-theme:hover:shadow-orange-500/20',
      purple: 'from-purple-100/80 to-purple-50/60 border-purple-300/40 hover:border-purple-400/60 hover:shadow-purple-400/20 dark:from-purple-900/30 dark:to-purple-800/20 dark:border-purple-500/30 dark:hover:border-purple-400/60 dark:hover:shadow-purple-500/20 bloomberg-theme:from-yellow-800/30 bloomberg-theme:to-yellow-700/20 bloomberg-theme:border-yellow-500/30 bloomberg-theme:hover:border-yellow-400/60 bloomberg-theme:hover:shadow-yellow-500/20',
      cyan: 'from-cyan-100/80 to-cyan-50/60 border-cyan-300/40 hover:border-cyan-400/60 hover:shadow-cyan-400/20 dark:from-cyan-900/30 dark:to-cyan-800/20 dark:border-cyan-500/30 dark:hover:border-cyan-400/60 dark:hover:shadow-cyan-500/20 bloomberg-theme:from-orange-700/30 bloomberg-theme:to-orange-600/20 bloomberg-theme:border-orange-400/30 bloomberg-theme:hover:border-orange-300/60 bloomberg-theme:hover:shadow-orange-400/20',
      emerald: 'from-emerald-100/80 to-emerald-50/60 border-emerald-300/40 hover:border-emerald-400/60 hover:shadow-emerald-400/20 dark:from-emerald-900/30 dark:to-emerald-800/20 dark:border-emerald-500/30 dark:hover:border-emerald-400/60 dark:hover:shadow-emerald-500/20 bloomberg-theme:from-yellow-700/30 bloomberg-theme:to-yellow-600/20 bloomberg-theme:border-yellow-400/30 bloomberg-theme:hover:border-yellow-300/60 bloomberg-theme:hover:shadow-yellow-400/20',
      orange: 'from-orange-100/80 to-orange-50/60 border-orange-300/40 hover:border-orange-400/60 hover:shadow-orange-400/20 dark:from-orange-900/30 dark:to-orange-800/20 dark:border-orange-500/30 dark:hover:border-orange-400/60 dark:hover:shadow-orange-500/20 bloomberg-theme:from-orange-600/30 bloomberg-theme:to-orange-500/20 bloomberg-theme:border-orange-300/30 bloomberg-theme:hover:border-orange-200/60 bloomberg-theme:hover:shadow-orange-300/20',
      rose: 'from-rose-100/80 to-rose-50/60 border-rose-300/40 hover:border-rose-400/60 hover:shadow-rose-400/20 dark:from-rose-900/30 dark:to-rose-800/20 dark:border-rose-500/30 dark:hover:border-rose-400/60 dark:hover:shadow-rose-500/20 bloomberg-theme:from-red-800/30 bloomberg-theme:to-red-700/20 bloomberg-theme:border-red-500/30 bloomberg-theme:hover:border-red-400/60 bloomberg-theme:hover:shadow-red-500/20',
      indigo: 'from-indigo-100/80 to-indigo-50/60 border-indigo-300/40 hover:border-indigo-400/60 hover:shadow-indigo-400/20 dark:from-indigo-900/30 dark:to-indigo-800/20 dark:border-indigo-500/30 dark:hover:border-indigo-400/60 dark:hover:shadow-indigo-500/20 bloomberg-theme:from-orange-900/30 bloomberg-theme:to-orange-800/20 bloomberg-theme:border-orange-600/30 bloomberg-theme:hover:border-orange-500/60 bloomberg-theme:hover:shadow-orange-600/20',
      yellow: 'from-yellow-100/80 to-yellow-50/60 border-yellow-300/40 hover:border-yellow-400/60 hover:shadow-yellow-400/20 dark:from-yellow-900/30 dark:to-yellow-800/20 dark:border-yellow-500/30 dark:hover:border-yellow-400/60 dark:hover:shadow-yellow-500/20 bloomberg-theme:from-yellow-600/30 bloomberg-theme:to-yellow-500/20 bloomberg-theme:border-yellow-300/30 bloomberg-theme:hover:border-yellow-200/60 bloomberg-theme:hover:shadow-yellow-300/20',
      teal: 'from-teal-100/80 to-teal-50/60 border-teal-300/40 hover:border-teal-400/60 hover:shadow-teal-400/20 dark:from-teal-900/30 dark:to-teal-800/20 dark:border-teal-500/30 dark:hover:border-teal-400/60 dark:hover:shadow-teal-500/20 bloomberg-theme:from-orange-800/30 bloomberg-theme:to-orange-700/20 bloomberg-theme:border-orange-500/30 bloomberg-theme:hover:border-orange-400/60 bloomberg-theme:hover:shadow-orange-500/20',
      pink: 'from-pink-100/80 to-pink-50/60 border-pink-300/40 hover:border-pink-400/60 hover:shadow-pink-400/20 dark:from-pink-900/30 dark:to-pink-800/20 dark:border-pink-500/30 dark:hover:border-pink-400/60 dark:hover:shadow-pink-500/20 bloomberg-theme:from-red-700/30 bloomberg-theme:to-red-600/20 bloomberg-theme:border-red-400/30 bloomberg-theme:hover:border-red-300/60 bloomberg-theme:hover:shadow-red-400/20',
      violet: 'from-violet-100/80 to-violet-50/60 border-violet-300/40 hover:border-violet-400/60 hover:shadow-violet-400/20 dark:from-violet-900/30 dark:to-violet-800/20 dark:border-violet-500/30 dark:hover:border-violet-400/60 dark:hover:shadow-violet-500/20 bloomberg-theme:from-orange-800/30 bloomberg-theme:to-orange-700/20 bloomberg-theme:border-orange-500/30 bloomberg-theme:hover:border-orange-400/60 bloomberg-theme:hover:shadow-orange-500/20',
      amber: 'from-amber-100/80 to-amber-50/60 border-amber-300/40 hover:border-amber-400/60 hover:shadow-amber-400/20 dark:from-amber-900/30 dark:to-amber-800/20 dark:border-amber-500/30 dark:hover:border-amber-400/60 dark:hover:shadow-amber-500/20 bloomberg-theme:from-yellow-700/30 bloomberg-theme:to-yellow-600/20 bloomberg-theme:border-yellow-400/30 bloomberg-theme:hover:border-yellow-300/60 bloomberg-theme:hover:shadow-yellow-400/20'
    };

    return colorMap[baseColor as keyof typeof colorMap] || colorMap.blue;
  };

  // Function to load market overview data from Commodity Market API
  const loadMarketOverviewData = async () => {
    try {
      // Fetch real commodity data from API
      const [metalsData, energyData, agriculturalData] = await Promise.all([
        fetchCommoditiesData('metals'),
        fetchCommoditiesData('energy'),
        fetchCommoditiesData('agricultural')
      ]);

      // Combine all commodity data and build robust access helpers
      const allCommodities = [...metalsData, ...energyData, ...agriculturalData];

      const findCommodity = (keywords: string[]) => {
        const lowered = keywords.map(k => k.toLowerCase());
        return allCommodities.find(c => {
          const s = (c.symbol || '').toLowerCase();
          const n = (c.name || '').toLowerCase();
          return lowered.some(k => s.includes(k) || n.includes(k));
        });
      };

      const getPrice = (keywords: string[], fallback: number) => {
        const c = findCommodity(keywords);
        return c?.price ?? fallback;
      };

      const getPercentChange = (keywords: string[]) => {
        const c = findCommodity(keywords);
        return typeof c?.percentChange === 'number' ? c!.percentChange : null;
      };

      // Extract specific commodities we want to display using keyword matching
      const currentRates = {
        WTI: getPrice(['wti', 'west texas', 'cl1!', 'crude oil wti', 'crude wti'], 75.50),
        BRENT: getPrice(['brent', 'brn1!', 'crude oil brent'], 79.80),
        GOLD: getPrice(['gold', 'xau', 'au', '1oz', 'gc1!'], 1980.50),
        SILVER: getPrice(['silver', 'xag', 'ag', 'si1!'], 24.30),
        COPPER: getPrice(['copper', 'hg1!', 'cu'], 3.85),
        NATGAS: getPrice(['natural gas', 'natgas', 'ng1!', 'gas naturel'], 2.45),
        CORN: getPrice(['corn', 'zc1!'], 4.85),
        WHEAT: getPrice(['wheat', 'zw1!'], 5.20), 
        SOYBEAN: getPrice(['soybean', 'zs1!'], 12.80),
        COTTON: getPrice(['cotton', 'ct1!'], 0.85),
        SUGAR: getPrice(['sugar', 'sb1!'], 0.18),
        COFFEE: getPrice(['coffee', 'kc1!'], 1.45)
      };
      
      // Calculate changes based on previous rates (only if we have previous data)
      const newMarketData = {
        WTI: { 
          rate: currentRates.WTI, 
          change: getPercentChange(['wti', 'west texas', 'cl1!', 'crude oil wti', 'crude wti']) ?? (previousRates ? calculateChange(currentRates.WTI, previousRates.WTI) : 0)
        },
        BRENT: { 
          rate: currentRates.BRENT, 
          change: getPercentChange(['brent', 'brn1!', 'crude oil brent']) ?? (previousRates ? calculateChange(currentRates.BRENT, previousRates.BRENT) : 0)
        },
        GOLD: { 
          rate: currentRates.GOLD, 
          change: getPercentChange(['gold', 'xau', 'au', '1oz', 'gc1!']) ?? (previousRates ? calculateChange(currentRates.GOLD, previousRates.GOLD) : 0)
        },
        SILVER: { 
          rate: currentRates.SILVER, 
          change: getPercentChange(['silver', 'xag', 'ag', 'si1!']) ?? (previousRates ? calculateChange(currentRates.SILVER, previousRates.SILVER) : 0)
        },
        COPPER: { 
          rate: currentRates.COPPER, 
          change: getPercentChange(['copper', 'hg1!', 'cu']) ?? (previousRates ? calculateChange(currentRates.COPPER, previousRates.COPPER) : 0)
        },
        NATGAS: { 
          rate: currentRates.NATGAS, 
          change: getPercentChange(['natural gas', 'natgas', 'ng1!', 'gas naturel']) ?? (previousRates ? calculateChange(currentRates.NATGAS, previousRates.NATGAS) : 0)
        },
        CORN: { 
          rate: currentRates.CORN, 
          change: getPercentChange(['corn', 'zc1!']) ?? (previousRates ? calculateChange(currentRates.CORN, previousRates.CORN) : 0)
        },
        WHEAT: { 
          rate: currentRates.WHEAT, 
          change: getPercentChange(['wheat', 'zw1!']) ?? (previousRates ? calculateChange(currentRates.WHEAT, previousRates.WHEAT) : 0)
        },
        SOYBEAN: { 
          rate: currentRates.SOYBEAN, 
          change: getPercentChange(['soybean', 'zs1!']) ?? (previousRates ? calculateChange(currentRates.SOYBEAN, previousRates.SOYBEAN) : 0)
        },
        COTTON: { 
          rate: currentRates.COTTON, 
          change: getPercentChange(['cotton', 'ct1!']) ?? (previousRates ? calculateChange(currentRates.COTTON, previousRates.COTTON) : 0)
        },
        SUGAR: { 
          rate: currentRates.SUGAR, 
          change: getPercentChange(['sugar', 'sb1!']) ?? (previousRates ? calculateChange(currentRates.SUGAR, previousRates.SUGAR) : 0)
        },
        COFFEE: { 
          rate: currentRates.COFFEE, 
          change: getPercentChange(['coffee', 'kc1!']) ?? (previousRates ? calculateChange(currentRates.COFFEE, previousRates.COFFEE) : 0)
        }
      };
      
      // Update states
      setMarketOverviewData(newMarketData);
      setPreviousRates(currentRates);
    } catch (error) {
      console.error('Error loading commodity market data:', error);
    }
  };

  // Helper function to calculate percentage change
  const calculateChange = (currentRate: number, previousRate: number): number => {
    if (!previousRate || previousRate === 0) return 0;
    return ((currentRate - previousRate) / previousRate) * 100;
  };

  // Load market data on component mount and when live mode is enabled
  useEffect(() => {
    loadMarketOverviewData();
    
    if (isLiveMode) {
      const interval = setInterval(loadMarketOverviewData, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isLiveMode]);

  // Generate real-time alerts based on actual data
  const generateAlerts = () => {
    const alerts = [];
    
    // Check volatility alerts
    Object.entries(marketData.volatilities).forEach(([pair, vol]) => {
      if (typeof vol === 'number' && vol > 0.15) { // 15% volatility threshold
        alerts.push({
          type: "high",
          message: `${pair} volatility above ${(vol * 100).toFixed(1)}%`,
          time: "Real-time"
        });
      }
    });

    // Check hedge ratio alerts
    commodityExposures.forEach(exp => {
      if (exp.hedgeRatio < 60 && exp.grossExposure > 1000000) {
        alerts.push({
          type: "medium",
          message: `${exp.currency} hedge ratio below target (${exp.hedgeRatio.toFixed(1)}%)`,
          time: "Real-time"
        });
      }
    });

    // Check VaR alerts
    if (riskMetrics.var95 > 500000) {
      alerts.push({
        type: "high",
        message: `VaR exceeds $${(riskMetrics.var95 / 1000).toFixed(0)}K threshold`,
        time: "Real-time"
      });
    }

    return alerts.slice(0, 3); // Show only top 3 alerts
  };

  const alerts = generateAlerts();

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "JPY") {
      return `¥${(amount / 1000000).toFixed(1)}M`;
    }
    return `${currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}${(amount / 1000000).toFixed(1)}M`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Layout 
      title="Dashboard"
      breadcrumbs={[
        { label: "Dashboard" }
      ]}
    >
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/5 via-indigo-900/5 to-purple-900/5 rounded-2xl" />
          
          <div className="relative bg-background/80 dark:bg-background/90 backdrop-blur-sm border border-border rounded-2xl p-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-blue-900 to-indigo-700 rounded-xl text-white shadow-lg">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-indigo-600 bg-clip-text text-transparent">
                      Risk Management Dashboard
                    </h1>
                    <p className="text-muted-foreground font-medium">
                      Real-time risk monitoring and commodity market analysis
                    </p>
                  </div>
                </div>
                
        <div className="flex items-center gap-4">
                  <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                    Last Updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <div className={`flex items-center gap-2 text-sm ${isLiveMode ? 'text-green-600' : 'text-gray-600'}`}>
            {isLiveMode ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isLiveMode ? 'Live Mode' : 'Static Mode'}
          </div>
        </div>
              </div>
              
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={updateMarketData}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </Button>
          <Button
            variant={isLiveMode ? "destructive" : "default"}
            size="sm"
            onClick={() => setLiveMode(!isLiveMode)}
            className="flex items-center gap-2"
          >
            {isLiveMode ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isLiveMode ? 'Stop Live' : 'Start Live'}
          </Button>
              </div>
            </div>
        </div>
      </div>
      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exposure</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(riskMetrics.totalExposure / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                Real-time calculation
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hedged Amount</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(riskMetrics.hedgedAmount / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">
              <span className={`flex items-center gap-1 ${riskMetrics.hedgeRatio > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                {riskMetrics.hedgeRatio > 70 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {riskMetrics.hedgeRatio.toFixed(1)}% hedge ratio
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unhedged Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(riskMetrics.unhedgedRisk / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">
              <span className={`flex items-center gap-1 ${riskMetrics.unhedgedRisk > 2000000 ? 'text-red-600' : 'text-yellow-600'}`}>
                <AlertTriangle className="h-3 w-3" />
                {riskMetrics.unhedgedRisk > 2000000 ? 'High' : 'Medium'} priority
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MTM Impact</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${riskMetrics.mtmImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {riskMetrics.mtmImpact >= 0 ? '+' : ''}${(riskMetrics.mtmImpact / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={`flex items-center gap-1 ${riskMetrics.mtmImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {riskMetrics.mtmImpact >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {riskMetrics.mtmImpact >= 0 ? 'Favorable' : 'Unfavorable'} movements
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Currency Exposure Overview */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Currency Exposure Overview
            </CardTitle>
            <CardDescription>
              Breakdown of exposures and hedge ratios by currency
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {commodityExposures.map((item) => (
              <div key={item.currency} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {item.currency}
                      </Badge>
                      {getTrendIcon(item.trend)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(item.grossExposure, item.currency)} exposure
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatCurrency(item.hedgedAmount, item.currency)} hedged
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.hedgeRatio.toFixed(1)}% ratio
                    </div>
                  </div>
                </div>
                <Progress value={item.hedgeRatio} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Alerts
            </CardTitle>
            <CardDescription>
              Active alerts and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className={`h-2 w-2 rounded-full mt-2 ${
                  alert.type === "high" ? "bg-red-500" : 
                  alert.type === "medium" ? "bg-yellow-500" : "bg-blue-500"
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" size="sm">
              View All Alerts
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Market Overview - Theme-Adaptive Futuristic Design */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:border-slate-700 bloomberg-theme:from-orange-950 bloomberg-theme:via-orange-900 bloomberg-theme:to-orange-950 bloomberg-theme:border-orange-800">
        {/* Animated background pattern - Theme adaptive */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 bloomberg-theme:from-orange-500/15 bloomberg-theme:to-yellow-500/15 rounded-lg"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.05)_50%,transparent_75%)] bg-[length:20px_20px] animate-pulse"></div>
        </div>
        
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 dark:from-blue-400 dark:via-purple-400 dark:to-cyan-400 bloomberg-theme:from-orange-400 bloomberg-theme:via-yellow-400 bloomberg-theme:to-orange-300 bg-clip-text text-transparent">
                Market Overview
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-300 bloomberg-theme:text-orange-200">
                Real-time commodity prices and market movements
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMarketOverviewData}
              className="flex items-center gap-2 bg-slate-100/80 border-slate-300 text-slate-700 hover:bg-slate-200/80 hover:border-blue-500 dark:bg-slate-800/50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:border-blue-400 bloomberg-theme:bg-orange-900/50 bloomberg-theme:border-orange-700 bloomberg-theme:text-orange-200 bloomberg-theme:hover:bg-orange-800/50 bloomberg-theme:hover:border-orange-500 transition-all duration-300"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="relative z-10">
          {marketOverviewData ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {/* Energy Commodities */}
              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('blue')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className={`text-lg font-mono font-bold ${textColors.rate} transition-colors`}>
                    ${marketOverviewData.WTI.rate.toFixed(2)}
                  </div>
                  <div className={`text-sm ${textColors.pair} font-medium`}>WTI Crude</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.WTI.change >= 0 ? textColors.change : 'text-red-400'}`}>
                    {marketOverviewData.WTI.change >= 0 ? '↗' : '↘'} {marketOverviewData.WTI.change >= 0 ? '+' : ''}{marketOverviewData.WTI.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('purple')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-purple-300 group-hover:text-purple-200 transition-colors">
                    ${marketOverviewData.BRENT.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-purple-400/80 font-medium">Brent Crude</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.BRENT.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.BRENT.change >= 0 ? '↗' : '↘'} {marketOverviewData.BRENT.change >= 0 ? '+' : ''}{marketOverviewData.BRENT.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('cyan')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-cyan-300 group-hover:text-cyan-200 transition-colors">
                    ${marketOverviewData.GOLD.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-cyan-400/80 font-medium">Gold</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.GOLD.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.GOLD.change >= 0 ? '↗' : '↘'} {marketOverviewData.GOLD.change >= 0 ? '+' : ''}{marketOverviewData.GOLD.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('emerald')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                    ${marketOverviewData.SILVER.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-emerald-400/80 font-medium">Silver</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.SILVER.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.SILVER.change >= 0 ? '↗' : '↘'} {marketOverviewData.SILVER.change >= 0 ? '+' : ''}{marketOverviewData.SILVER.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('orange')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-orange-300 group-hover:text-orange-200 transition-colors">
                    ${marketOverviewData.COPPER.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-orange-400/80 font-medium">Copper</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.COPPER.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.COPPER.change >= 0 ? '↗' : '↘'} {marketOverviewData.COPPER.change >= 0 ? '+' : ''}{marketOverviewData.COPPER.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('rose')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-rose-300 group-hover:text-rose-200 transition-colors">
                    ${marketOverviewData.NATGAS.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-rose-400/80 font-medium">Natural Gas</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.NATGAS.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.NATGAS.change >= 0 ? '↗' : '↘'} {marketOverviewData.NATGAS.change >= 0 ? '+' : ''}{marketOverviewData.NATGAS.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('indigo')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                    ${marketOverviewData.CORN.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-indigo-400/80 font-medium">Corn</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.CORN.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.CORN.change >= 0 ? '↗' : '↘'} {marketOverviewData.CORN.change >= 0 ? '+' : ''}{marketOverviewData.CORN.change.toFixed(2)}%
              </div>
            </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('yellow')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-yellow-300 group-hover:text-yellow-200 transition-colors">
                    ${marketOverviewData.WHEAT.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-yellow-400/80 font-medium">Wheat</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.WHEAT.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.WHEAT.change >= 0 ? '↗' : '↘'} {marketOverviewData.WHEAT.change >= 0 ? '+' : ''}{marketOverviewData.WHEAT.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('teal')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-teal-300 group-hover:text-teal-200 transition-colors">
                    ${marketOverviewData.SOYBEAN.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-teal-400/80 font-medium">Soybean</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.SOYBEAN.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.SOYBEAN.change >= 0 ? '↗' : '↘'} {marketOverviewData.SOYBEAN.change >= 0 ? '+' : ''}{marketOverviewData.SOYBEAN.change.toFixed(2)}%
              </div>
            </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('pink')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-pink-300 group-hover:text-pink-200 transition-colors">
                    ${marketOverviewData.COTTON.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-pink-400/80 font-medium">Cotton</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.COTTON.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.COTTON.change >= 0 ? '↗' : '↘'} {marketOverviewData.COTTON.change >= 0 ? '+' : ''}{marketOverviewData.COTTON.change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('violet')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-violet-300 group-hover:text-violet-200 transition-colors">
                    ${marketOverviewData.SUGAR.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-violet-400/80 font-medium">Sugar</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.SUGAR.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.SUGAR.change >= 0 ? '↗' : '↘'} {marketOverviewData.SUGAR.change >= 0 ? '+' : ''}{marketOverviewData.SUGAR.change.toFixed(2)}%
              </div>
            </div>
              </div>

              <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${getCurrencyCardClasses('amber')} transition-all duration-300 hover:shadow-lg`}>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="text-lg font-mono font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                    ${marketOverviewData.COFFEE.rate.toFixed(2)}
                  </div>
                  <div className="text-sm text-amber-400/80 font-medium">Coffee</div>
                  <div className={`text-xs font-semibold ${marketOverviewData.COFFEE.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketOverviewData.COFFEE.change >= 0 ? '↗' : '↘'} {marketOverviewData.COFFEE.change >= 0 ? '+' : ''}{marketOverviewData.COFFEE.change.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500/30 to-purple-500/30 border-blue-500/40 dark:from-blue-500/20 dark:to-purple-500/20 dark:border-blue-500/30 bloomberg-theme:from-orange-500/25 bloomberg-theme:to-yellow-500/25 bloomberg-theme:border-orange-500/40 mb-4">
                <Activity className="h-8 w-8 text-blue-400 animate-pulse" />
              </div>
              <div className="text-slate-600 dark:text-slate-300 bloomberg-theme:text-orange-200 text-lg font-medium mb-2">Loading Commodity Data</div>
              <div className="text-slate-500 dark:text-slate-400 bloomberg-theme:text-orange-300 text-sm mb-4">Fetching real-time commodity prices...</div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMarketOverviewData}
                className="bg-slate-100/80 border-slate-300 text-slate-700 hover:bg-slate-200/80 hover:border-blue-500 dark:bg-slate-800/50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:border-blue-400 bloomberg-theme:bg-orange-900/50 bloomberg-theme:border-orange-700 bloomberg-theme:text-orange-200 bloomberg-theme:hover:bg-orange-800/50 bloomberg-theme:hover:border-orange-500 transition-all duration-300"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </Layout>
  );
};

export default Dashboard; 