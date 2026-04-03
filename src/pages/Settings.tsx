import React, { useState, useEffect } from 'react';
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useFinancialData } from "@/hooks/useFinancialData";
import { useCommodityData } from "@/hooks/useCommodityData";
import { toast } from "@/hooks/use-toast";
import { 
  Settings as SettingsIcon, 
  Database, 
  Globe, 
  Shield, 
  Bell, 
  Palette, 
  Calculator,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Download,
  Upload,
  RefreshCw,
  Save,
  RotateCcw,
  DollarSign,
  Target,
  Building,
  Trash2,
  AlertCircle,
  Eraser,
  ZoomIn,
  ZoomOut,
  Monitor,
  Landmark,
  Key,
  Plus,
  FolderOpen
} from "lucide-react";
import { useCompanySettings, companySettingsEmitter } from "@/hooks/useCompanySettings";
import { BRAND } from "@/constants/branding";
import { getLocalStorageStats, performEmergencyRecovery } from "@/utils/emergencyRecovery";
import "@/styles/zoom-controls.css";
import { fetchAllCountries, CountryBondData } from "@/services/rateExplorer/bondsApi";

interface AppSettings {
  // General settings
  company: {
    name: string;
    currency: string;
    timezone: string;
    fiscalYearStart: string;
  };
  
  // Risk settings
  risk: {
    defaultConfidenceLevel: number;
    varHorizon: number;
    stressTestEnabled: boolean;
    monteCarloSimulations: number;
    riskLimits: {
      maxVaR: number;
      maxUnhedgedRisk: number;
      minHedgeRatio: number;
    };
  };
  
  // Pricing settings
  pricing: {
    defaultModel: string;
    useRealTimeData: boolean;
    volatilityModel: string;
    interestRateSource: string;
    pricingFrequency: string;
    underlyingPriceType: 'spot' | 'forward';
    backtestExerciseType: 'monthly-average' | 'third-friday';
    /** Maturity date convention for Strategy Builder: last day of month or third Friday */
    maturityConvention: 'last-month-day' | 'third-friday';
    // Interest rate configuration for simulations
    interestRateMode: 'fixed' | 'curve';
    fixedRates: {
      USD: number;
      EUR: number;
      GBP: number;
      CHF: number;
      JPY: number;
      CAD: number;
      AUD: number;
      NZD: number;
    };
  };
  
  // Interface settings
  ui: {
    theme: string;
    language: string;
    dateFormat: string;
    numberFormat: string;
    dashboardRefresh: number;
    zoomLevel: number;
  };
  
  // Notification settings
  notifications: {
    riskAlerts: boolean;
    priceAlerts: boolean;
    maturityAlerts: boolean;
    emailNotifications: boolean;
    alertThresholds: {
      varExceeded: number;
      hedgeRatioBelow: number;
      maturityWithin: number;
    };
  };
  
  // Data management settings
  data: {
    autoSave: boolean;
    backupFrequency: string;
    dataRetention: number;
    exportFormat: string;
  };

  // Domain selection settings
  domains: {
    selectedDomains: ('metals' | 'agricultural' | 'energy' | 'freight' | 'bunker')[];
  };

  // Commodity Exposures settings
  commodityExposures: {
    autoDetection: boolean;
    defaultMaturity: string;
    riskClassification: string;
    consolidationLevel: string;
    exposureThreshold: number;
    reportingCurrency: string;
    includePendingTransactions: boolean;
    maturityBuckets: string[];
  };

  // Hedging Instruments settings
  hedgingInstruments: {
    defaultInstrumentType: string;
    autoHedgeRatio: number;
    maxLeverage: number;
    counterpartyLimits: boolean;
    creditRiskAssessment: boolean;
    marginRequirements: boolean;
    settlementPreferences: string;
    approvalWorkflow: boolean;
    documentationRequired: string[];
  };

  // API keys (Hedge Assistant, etc.)
  api: {
    geminiApiKey: string;
  };
}

const Settings = () => {
  const { marketData, updateMarketData, isLiveMode, setLiveMode, exposures, deleteExposure, addExposure } = useFinancialData();
  const { clearAllData: clearCommodityData } = useCommodityData();
  const { companySettings, updateCompanySettings, getCompanyNameParts, getCompanyLogo, setCompanyLogo, resetCompanyLogo, isLoaded, getCompanyLogo: getLogo, getCompanyNameParts: getNameParts } = useCompanySettings();
  
  // Function to apply zoom to the entire application
  const applyZoom = (zoomLevel: number) => {
    document.documentElement.style.zoom = `${zoomLevel}%`;
    localStorage.setItem('fx-hedging-zoom', zoomLevel.toString());
  };
  const [settings, setSettings] = useState<AppSettings>({
    company: {
      name: BRAND.nameWithTagline,
      currency: "USD",
      timezone: "Europe/Paris",
      fiscalYearStart: "01-01"
    },
    risk: {
      defaultConfidenceLevel: 95,
      varHorizon: 1,
      stressTestEnabled: true,
      monteCarloSimulations: 10000,
      riskLimits: {
        maxVaR: 5000000,
        maxUnhedgedRisk: 10000000,
        minHedgeRatio: 70
      }
    },
    pricing: {
      defaultModel: "black-scholes",
      useRealTimeData: true,
      volatilityModel: "garch",
      interestRateSource: "bloomberg",
      pricingFrequency: "real-time",
      underlyingPriceType: "spot",
      backtestExerciseType: "monthly-average",
      maturityConvention: "last-month-day",
      // Interest rate mode: 'fixed' uses Bank Rate, 'curve' uses bootstrapped yield curve
      interestRateMode: "fixed",
      // Default fixed rates (Bank Rates as of current date - can be updated)
      fixedRates: {
        USD: 4.50,  // Federal Reserve rate
        EUR: 3.00,  // ECB rate
        GBP: 4.75,  // Bank of England rate
        CHF: 0.50,  // Swiss National Bank rate
        JPY: 0.25,  // Bank of Japan rate
        CAD: 3.25,  // Bank of Canada rate
        AUD: 4.35,  // Reserve Bank of Australia rate
        NZD: 4.25,  // Reserve Bank of New Zealand rate
      }
    },
    ui: {
      theme: "light",
      language: "en",
      dateFormat: "MM/DD/YYYY",
      numberFormat: "en-US",
      dashboardRefresh: 30,
      zoomLevel: 100
    },
    notifications: {
      riskAlerts: true,
      priceAlerts: true,
      maturityAlerts: true,
      emailNotifications: false,
      alertThresholds: {
        varExceeded: 110,
        hedgeRatioBelow: 60,
        maturityWithin: 30
      }
    },
    data: {
      autoSave: true,
      backupFrequency: "daily",
      dataRetention: 365,
      exportFormat: "xlsx"
    },
    domains: {
      selectedDomains: ['metals', 'agricultural', 'energy', 'freight', 'bunker'] // All domains selected by default
    },
    commodityExposures: {
      autoDetection: true,
      defaultMaturity: "1M",
      riskClassification: "medium",
      consolidationLevel: "entity",
      exposureThreshold: 100000,
      reportingCurrency: "USD",
      includePendingTransactions: true,
      maturityBuckets: ["1W", "1M", "3M", "6M", "1Y", "2Y+"]
    },
    hedgingInstruments: {
      defaultInstrumentType: "forward",
      autoHedgeRatio: 80,
      maxLeverage: 10,
      counterpartyLimits: true,
      creditRiskAssessment: true,
      marginRequirements: true,
      settlementPreferences: "physical",
      approvalWorkflow: true,
      documentationRequired: ["ISDA", "CSA", "Confirmation"]
    },
    api: {
      geminiApiKey: ""
    }
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [deletionStats, setDeletionStats] = useState<{total: number, deleted: number} | null>(null);
  const logo = getCompanyLogo();
  const companyName = companySettings?.name || BRAND.nameWithTagline;
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [logoMarkedForRemoval, setLogoMarkedForRemoval] = useState(false);
  const [pendingCompanyName, setPendingCompanyName] = useState<string | null>(null);
  const [includeLogoInPdf, setIncludeLogoInPdf] = useState<boolean>(() => {
    const saved = localStorage.getItem('includeLogoInPdf');
    return saved ? JSON.parse(saved) : false;
  });

  // Portfolios & counterparties (shared with Hedging Instruments, localStorage)
  type PortfolioOrCounterparty = { id: string; name: string };
  const DEFAULT_COUNTERPARTIES: PortfolioOrCounterparty[] = [
    { id: "deutsche-bank", name: "Deutsche Bank" },
    { id: "hsbc", name: "HSBC" },
    { id: "jpmorgan", name: "JPMorgan" },
    { id: "bnp-paribas", name: "BNP Paribas" },
  ];
  const loadHedgingList = <T,>(key: string, defaultVal: T): T => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : defaultVal;
    } catch { return defaultVal; }
  };
  const [hedgingPortfolios, setHedgingPortfolios] = useState<PortfolioOrCounterparty[]>(() =>
    loadHedgingList("hedgingPortfolios", [])
  );
  const [hedgingCounterparties, setHedgingCounterparties] = useState<PortfolioOrCounterparty[]>(() =>
    loadHedgingList("hedgingCounterparties", DEFAULT_COUNTERPARTIES)
  );
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newCounterpartyName, setNewCounterpartyName] = useState("");

  const saveHedgingPortfolios = (list: PortfolioOrCounterparty[]) => {
    setHedgingPortfolios(list);
    localStorage.setItem("hedgingPortfolios", JSON.stringify(list));
  };
  const saveHedgingCounterparties = (list: PortfolioOrCounterparty[]) => {
    setHedgingCounterparties(list);
    localStorage.setItem("hedgingCounterparties", JSON.stringify(list));
  };
  const addHedgingPortfolio = () => {
    const name = newPortfolioName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `portfolio-${Date.now()}`;
    if (hedgingPortfolios.some((p) => p.id === id)) {
      toast({ title: "Already exists", description: "A portfolio with this name already exists.", variant: "destructive" });
      return;
    }
    saveHedgingPortfolios([...hedgingPortfolios, { id, name }]);
    setNewPortfolioName("");
    toast({ title: "Portfolio added", description: `"${name}" has been added.` });
  };
  const addHedgingCounterparty = () => {
    const name = newCounterpartyName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `counterparty-${Date.now()}`;
    if (hedgingCounterparties.some((c) => c.id === id)) {
      toast({ title: "Existe déjà", description: "Une contrepartie avec ce nom existe déjà.", variant: "destructive" });
      return;
    }
    saveHedgingCounterparties([...hedgingCounterparties, { id, name }]);
    setNewCounterpartyName("");
    toast({ title: "Counterparty added", description: `"${name}" has been added.` });
  };
  const removeHedgingPortfolio = (id: string) => {
    const name = hedgingPortfolios.find((p) => p.id === id)?.name;
    saveHedgingPortfolios(hedgingPortfolios.filter((p) => p.id !== id));
    toast({ title: "Portefeuille supprimé", description: name ? `"${name}" a été supprimé.` : undefined });
  };
  const removeHedgingCounterparty = (id: string) => {
    const name = hedgingCounterparties.find((c) => c.id === id)?.name;
    saveHedgingCounterparties(hedgingCounterparties.filter((c) => c.id !== id));
    toast({ title: "Counterparty removed", description: name ? `"${name}" has been removed.` : undefined });
  };
  
  // 🌐 Bank Rates from World Government Bonds
  const [isLoadingBankRates, setIsLoadingBankRates] = useState(false);
  const [bondDataLastUpdate, setBondDataLastUpdate] = useState<string | null>(() => {
    // Load last update from localStorage
    const saved = localStorage.getItem('bondDataLastUpdate');
    return saved || null;
  });
  
  // Currency to Country mapping for bank rates
  const CURRENCY_TO_COUNTRY: Record<string, string> = {
    USD: 'united-states',
    EUR: 'germany', // Germany as reference for EUR
    GBP: 'united-kingdom',
    CHF: 'switzerland',
    JPY: 'japan',
    CAD: 'canada',
    AUD: 'australia',
    NZD: 'new-zealand',
  };
  
  // 🌐 Check if bond data is fresh (less than 1 hour old)
  const isBondDataFresh = (): boolean => {
    if (!bondDataLastUpdate) return false;
    const lastUpdate = new Date(bondDataLastUpdate);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 1; // Consider fresh if less than 1 hour old
  };
  
  // 🌐 Fetch bank rates from World Government Bonds (with automatic scraping if needed)
  const fetchBankRatesFromBonds = async (forceRefresh = false) => {
    setIsLoadingBankRates(true);
    try {
      // Check if we need to refresh (data is stale or missing)
      const needsRefresh = forceRefresh || !isBondDataFresh();
      
      if (needsRefresh) {
        console.log('🔄 Données obsolètes ou manquantes, lancement du scraping...');
      }
      
      const response = await fetchAllCountries();
      
      if (!response.success || !response.data) {
        // If no data, try to trigger scraping by calling the API again
        console.log('⚠️ Aucune donnée disponible, tentative de scraping...');
        
        // Wait a bit and retry (scraping might be in progress)
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retryResponse = await fetchAllCountries();
        
        if (!retryResponse.success || !retryResponse.data) {
          toast({
            title: "Données non disponibles",
            description: "Les données ne sont pas disponibles. Le scraping est peut-être en cours. Réessayez dans quelques instants.",
            variant: "destructive",
          });
          return;
        }
        
        // Use retry response
        const bondData = retryResponse.data;
        const newRates: Record<string, number> = { ...(settings.pricing?.fixedRates ?? {}) };
        let updatedCount = 0;
        
        Object.entries(CURRENCY_TO_COUNTRY).forEach(([currency, countrySlug]) => {
          const countryData = bondData.find((c: CountryBondData) => 
            c.countrySlug === countrySlug || 
            c.country.toLowerCase().replace(/\s+/g, '-') === countrySlug
          );
          
          if (countryData && countryData.bankRate !== null && countryData.bankRate !== undefined) {
            newRates[currency] = countryData.bankRate;
            updatedCount++;
            console.log(`✅ ${currency}: ${countryData.country} Bank Rate = ${countryData.bankRate}%`);
          }
        });
        
        if (updatedCount > 0) {
          updateSettings('pricing', { fixedRates: newRates });
          const updateTime = retryResponse.scrapedAt || new Date().toISOString();
          setBondDataLastUpdate(updateTime);
          localStorage.setItem('bondDataLastUpdate', updateTime);
        }
        
        return;
      }
      
      const bondData = response.data;
      const newRates: Record<string, number> = { ...(settings.pricing?.fixedRates ?? {}) };
      let updatedCount = 0;
      let missingRates: string[] = [];
      
      // Map each currency to its corresponding country's bank rate
      Object.entries(CURRENCY_TO_COUNTRY).forEach(([currency, countrySlug]) => {
        // Find the country in bond data (match by slug or country name)
        const countryData = bondData.find((c: CountryBondData) => 
          c.countrySlug === countrySlug || 
          c.country.toLowerCase().replace(/\s+/g, '-') === countrySlug
        );
        
        if (countryData && countryData.bankRate !== null && countryData.bankRate !== undefined) {
          newRates[currency] = countryData.bankRate;
          updatedCount++;
          console.log(`✅ ${currency}: ${countryData.country} Bank Rate = ${countryData.bankRate}%`);
        } else {
          missingRates.push(currency);
          console.log(`⚠️ ${currency}: Bank Rate non trouvé pour ${countrySlug}`);
        }
      });
      
      if (updatedCount > 0) {
        updateSettings('pricing', { fixedRates: newRates });
        const updateTime = response.scrapedAt || new Date().toISOString();
        setBondDataLastUpdate(updateTime);
        localStorage.setItem('bondDataLastUpdate', updateTime);
        
        // 🌐 Emit event to notify other components of rate update
        window.dispatchEvent(new CustomEvent('settingsUpdated'));
        
        if (missingRates.length > 0) {
          console.log(`⚠️ Taux manquants pour: ${missingRates.join(', ')}`);
        }
      } else if (missingRates.length > 0) {
        // All rates are missing, data might be stale
        console.log('⚠️ Tous les taux sont manquants, les données sont peut-être obsolètes');
      }
      
    } catch (error) {
      console.error('Erreur lors de la récupération des taux:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la récupération des taux.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBankRates(false);
    }
  };

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
    const savedSettings = localStorage.getItem('fxRiskManagerSettings');
    if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
          // Vérifier que les données parsées sont valides
          if (parsed && typeof parsed === 'object' && parsed.company) {
            setSettings(prev => ({
              ...prev,
              ...parsed,
              company: {
                ...prev.company,
                ...parsed.company
              },
              api: {
                ...prev.api,
                ...parsed.api
              }
            }));
          }
        }
        
        // Load zoom level from localStorage
        const savedZoom = localStorage.getItem('fx-hedging-zoom');
        if (savedZoom) {
          const zoomLevel = parseInt(savedZoom);
          if (zoomLevel >= 50 && zoomLevel <= 150) {
            setSettings(prev => ({
              ...prev,
              ui: {
                ...prev.ui,
                zoomLevel: zoomLevel
              }
            }));
            applyZoom(zoomLevel);
          }
        }
      } catch (error) {
        console.error('Error loading saved settings:', error);
        // En cas d'erreur, garder les paramètres par défaut
        toast({
          title: "Erreur de chargement",
          description: "Impossible de charger les paramètres sauvegardés. Paramètres par défaut utilisés.",
          variant: "destructive",
        });
      }
    };

    loadSettings();
  }, []);
  
  // 🌐 Auto-sync bank rates on mount and when in fixed mode
  useEffect(() => {
    // Only auto-sync if in fixed rate mode
    if (settings.pricing?.interestRateMode === 'fixed') {
      const lastUpdate = localStorage.getItem('bondDataLastUpdate');
      const isFresh = lastUpdate ? (Date.now() - new Date(lastUpdate).getTime()) < 3600000 : false;
      
      if (!isFresh) {
        console.log('🔄 Synchronisation automatique des taux bancaires...');
        fetchBankRatesFromBonds(false);
      } else {
        console.log('✅ Données des taux bancaires à jour');
      }
    }
  }, [settings.pricing?.interestRateMode]); // Sync when mode changes

  // Fonction pour mettre à jour les paramètres
  const updateSettings = (section: keyof AppSettings, updates: Record<string, unknown>) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
    
    // Don't update company settings hook or emit events during editing
    // Only update when saving
    
    setHasChanges(true);
  };

  // Function to save settings
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Préparer les nouvelles configurations
      const newSettings = { ...settings };
      let nameChanged = false;
      
      // Gérer le changement de nom
      if (pendingCompanyName !== null) {
        const trimmedName = pendingCompanyName.trim();
        if (trimmedName.length > 0) {
          newSettings.company = { ...newSettings.company, name: trimmedName };
        nameChanged = true;
        } else {
          toast({
            title: "Nom invalide",
            description: "Le nom de l'entreprise ne peut pas être vide.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }
      
      // Sauvegarder les paramètres dans localStorage
      localStorage.setItem('fxRiskManagerSettings', JSON.stringify(newSettings));
      
      // Mettre à jour le state local
      setSettings(newSettings);
      
      // Mettre à jour les paramètres de l'entreprise si le nom a changé
      if (nameChanged) {
        updateCompanySettings({ name: newSettings.company.name });
      }
      
      // Gérer le logo
      if (pendingLogo !== null) {
        setCompanyLogo(pendingLogo);
      } else if (logoMarkedForRemoval) {
        resetCompanyLogo();
      }
      
      // Nettoyer les états temporaires
      setPendingCompanyName(null);
      setPendingLogo(null);
      setLogoMarkedForRemoval(false);
      
      // Appliquer les autres paramètres
      if (newSettings.pricing?.useRealTimeData !== isLiveMode) {
        setLiveMode(newSettings.pricing.useRealTimeData);
      }
      if (newSettings.ui?.theme) {
        document.documentElement.className = newSettings.ui.theme;
      }
      if (newSettings.ui?.language) {
        localStorage.setItem('preferred-language', newSettings.ui.language);
      }
      if (newSettings.ui?.dashboardRefresh) {
        localStorage.setItem('dashboard-refresh-interval', String(newSettings.ui?.dashboardRefresh ?? 30));
      }
      
      // Finaliser
      setLastSaved(new Date());
      setHasChanges(false);
      
      // 🌐 Emit custom event to notify other components of settings update
      window.dispatchEvent(new CustomEvent('settingsUpdated'));
      
      // 🌐 Auto-sync bank rates if in fixed mode
      if (newSettings.pricing?.interestRateMode === 'fixed') {
        // Trigger auto-sync in background (don't wait)
        fetchBankRatesFromBonds(false).catch(err => {
          console.error('Error auto-syncing bank rates:', err);
        });
      }
      
      // Afficher un message de succès
      toast({
        title: "Paramètres sauvegardés",
        description: "Vos modifications ont été enregistrées avec succès.",
      });
      
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Function to reset settings
  const resetSettings = () => {
    setPendingCompanyName("FX hedging - Risk Management Platform");
    setLogoMarkedForRemoval(true);
    setPendingLogo(null);
    setSettings(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        theme: "light"
      }
    }));
    setHasChanges(true);
  };

  // Function to export settings
  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fx-risk-manager-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Function to import settings
  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setSettings(prev => ({ ...prev, ...imported }));
          // Update company settings hook if company settings are imported
          if (imported.company) {
            updateCompanySettings(imported.company);
            // Emit event to notify all components about the import
            companySettingsEmitter.emit();
          }
          setHasChanges(true);
        } catch (error) {
          console.error('Error importing settings:', error);
        }
      };
      reader.readAsText(file);
    }
    setPendingCompanyName(null);
  };

  // Function to delete all exposures
  const deleteAllExposures = async () => {
    setIsDeleting(true);
    try {
      // Get current exposures count from the financial data service
      const currentExposures = exposures || [];
      const totalCount = currentExposures.length;
      let deletedCount = 0;

      // Delete each exposure using the service
      for (const exposure of currentExposures) {
        try {
          const success = deleteExposure(exposure.id);
          if (success) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error deleting exposure ${exposure.id}:`, error);
        }
      }

      // ✅ NOUVEAU : Supprimer également les données de commodités
      try {
        clearCommodityData();
        console.log('✅ Commodity data cleared successfully');
      } catch (error) {
        console.error('Error clearing commodity data:', error);
      }

      // Clear localStorage as backup
      localStorage.removeItem('commodityExposures');
      localStorage.removeItem('commodityExposuresBackup');
      localStorage.removeItem('commodityExposuresLastModified');
      localStorage.removeItem('marketData');
      localStorage.removeItem('riskMetrics');
      localStorage.removeItem('currencyExposures');
      
      // Also clear from session storage if used
      sessionStorage.removeItem('commodityExposures');
      
      // Update stats
      setDeletionStats({ total: totalCount, deleted: deletedCount });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close dialog
      setShowDeleteDialog(false);
      
      console.log(`✅ Suppression terminée: ${deletedCount}/${totalCount} expositions supprimées`);
      
      // Show success notification
      toast({
        title: "✅ Toutes les données supprimées",
        description: `Toutes les expositions commodités ont été supprimées avec succès`,
      });
      
    } catch (error) {
      console.error('Error deleting exposures:', error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors de la suppression des expositions",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to clean up expired and invalid exposures
  const cleanupExposures = async () => {
    setIsDeleting(true);
    try {
      // Get current exposures from the financial data service
      const currentExposures = exposures || [];
      const totalCount = currentExposures.length;
      let deletedCount = 0;
      
      // Filter out expired and invalid exposures
      const now = new Date();
      const expiredOrInvalidExposures = currentExposures.filter((exposure: any) => {
        // Check if exposure is expired
        const maturityDate = new Date(exposure.maturity || exposure.maturityDate);
        const isExpired = maturityDate <= now;
        
        // Check if exposure has invalid data
        const hasInvalidAmount = !exposure.amount || Math.abs(exposure.amount) === 0;
        const hasInvalidCurrency = !exposure.currency || exposure.currency.length !== 3;
        const hasInvalidType = exposure.type !== 'receivable' && exposure.type !== 'payable';
        
        return isExpired || hasInvalidAmount || hasInvalidCurrency || hasInvalidType;
      });
      
      // Delete expired/invalid exposures using the service
      for (const exposure of expiredOrInvalidExposures) {
        try {
          const success = deleteExposure(exposure.id);
          if (success) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error deleting exposure ${exposure.id}:`, error);
        }
      }
      
      // Update localStorage timestamp
      localStorage.setItem('commodityExposuresLastModified', new Date().toISOString());
      
      setDeletionStats({ total: totalCount, deleted: deletedCount });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close dialog
      setShowCleanupDialog(false);
      
      console.log(`✅ Nettoyage terminé: ${deletedCount}/${totalCount} expositions supprimées`);
      
      // Show success notification
      if (deletedCount > 0) {
        toast({
          title: "✅ Nettoyage terminé",
          description: `${deletedCount} exposition(s) expirée(s) ou invalide(s) supprimée(s)`,
        });
      } else {
        toast({
          title: "ℹ️ Aucun nettoyage nécessaire",
          description: "Toutes les expositions sont valides et non expirées",
        });
      }
      
    } catch (error) {
      console.error('Error cleaning up exposures:', error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors du nettoyage des expositions",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to create test exposures for demonstration (removed - FX specific, not applicable to commodities)
  // Commodity test data should be created through the Strategy Builder or Commodity Exposures page

  return (
    <Layout 
      title="Settings"
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Settings" }
      ]}
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Application Settings
          </h1>
          <p className="text-muted-foreground">
            General configuration for {BRAND.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetSettings}
            size="sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={saveSettings}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Unsaved changes are pending. Don't forget to save your changes.
          </AlertDescription>
        </Alert>
      )}

      {lastSaved && !hasChanges && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Settings saved successfully on {lastSaved.toLocaleString('en-US')}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="interface">Interface</TabsTrigger>
          <TabsTrigger value="notifications">Alerts</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="commodityexposures">Commodity Exposures</TabsTrigger>
          <TabsTrigger value="hedging">Hedging</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="diagnostic">Diagnostic</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Basic company and application configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={pendingCompanyName ?? companyName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPendingCompanyName(value);
                      setHasChanges(true);
                    }}
                    placeholder="Your company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-logo">Company Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex items-center justify-center border rounded bg-muted/30">
                      {logoMarkedForRemoval ? (
                        <span className="text-xs text-muted-foreground">(Logo removed)</span>
                      ) : (
                        <img
                          src={pendingLogo ?? logo}
                          alt="Company Logo"
                          className="max-h-14 max-w-14 object-contain"
                          style={{ background: 'white' }}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Input
                        id="company-logo"
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                          // Vérifier la taille du fichier (max 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            toast({
                              title: "Fichier trop volumineux",
                              description: "La taille du logo ne doit pas dépasser 5MB.",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          // Vérifier le type de fichier
                          if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.type)) {
                            toast({
                              title: "Format non supporté",
                              description: "Veuillez utiliser un fichier PNG, JPEG ou SVG.",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (typeof ev.target?.result === 'string') {
                                setPendingLogo(ev.target.result);
                                setHasChanges(true);
                                setLogoMarkedForRemoval(false);
                              }
                            };
                          reader.onerror = () => {
                            toast({
                              title: "Erreur de lecture",
                              description: "Impossible de lire le fichier image.",
                              variant: "destructive",
                            });
                          };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="include-logo-pdf"
                          checked={includeLogoInPdf}
                          onCheckedChange={(checked) => {
                            setIncludeLogoInPdf(checked === true);
                            localStorage.setItem('includeLogoInPdf', JSON.stringify(checked === true));
                            setHasChanges(true);
                          }}
                        />
                        <Label htmlFor="include-logo-pdf" className="text-sm font-normal cursor-pointer">
                          Include in PDF
                        </Label>
                      </div>
                      {(pendingLogo !== null || logo !== "/fx-hedging-logo.png" || logoMarkedForRemoval) && (
                        <div className="flex gap-2">
                          {!logoMarkedForRemoval && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (pendingLogo !== null) {
                                  setPendingLogo(null);
                                  setHasChanges(true);
                                } else {
                                  setLogoMarkedForRemoval(true);
                                  setHasChanges(true);
                                }
                              }}
                              type="button"
                            >
                              Remove Logo
                            </Button>
                          )}
                          {logoMarkedForRemoval && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setLogoMarkedForRemoval(false);
                                setHasChanges(true);
                              }}
                              type="button"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG. Max 1 Mo recommandé.</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-currency">Base Currency</Label>
                  <Select
                    value={settings.company?.currency ?? 'USD'}
                    onValueChange={(value) => updateSettings('company', { currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                      <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                      <SelectItem value="MAD">MAD - Moroccan Dirham</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.company?.timezone ?? 'Europe/Paris'}
                    onValueChange={(value) => updateSettings('company', { timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                      <SelectItem value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscal-year">Début d'Année Fiscale</Label>
                  <Input
                    id="fiscal-year"
                    value={settings.company?.fiscalYearStart ?? '01-01'}
                    onChange={(e) => updateSettings('company', { fiscalYearStart: e.target.value })}
                    placeholder="MM-DD"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Informations Système</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Version</div>
                    <div className="text-lg font-bold">v2.1.0</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Dernière MAJ</div>
                    <div className="text-lg font-bold">{new Date().toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Mode</div>
                    <div className="text-lg font-bold">
                      <Badge variant={isLiveMode ? "default" : "secondary"}>
                        {isLiveMode ? "Live" : "Simulation"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Risk Management Settings
              </CardTitle>
              <CardDescription>
                Configuration of risk metrics and limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="confidence-level">Default Confidence Level (%)</Label>
                  <Select
                    value={String(settings.risk?.defaultConfidenceLevel ?? 95)}
                    onValueChange={(value) => updateSettings('risk', { defaultConfidenceLevel: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90%</SelectItem>
                      <SelectItem value="95">95%</SelectItem>
                      <SelectItem value="99">99%</SelectItem>
                      <SelectItem value="99.9">99.9%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="var-horizon">VaR Horizon (days)</Label>
                  <Input
                    id="var-horizon"
                    type="number"
                    value={settings.risk?.varHorizon ?? 1}
                    onChange={(e) => updateSettings('risk', { varHorizon: parseInt(e.target.value) })}
                    min="1"
                    max="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monte-carlo">Monte Carlo Simulations</Label>
                  <Select
                    value={String(settings.risk?.monteCarloSimulations ?? 10000)}
                    onValueChange={(value) => updateSettings('risk', { monteCarloSimulations: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">1,000</SelectItem>
                      <SelectItem value="5000">5,000</SelectItem>
                      <SelectItem value="10000">10,000</SelectItem>
                      <SelectItem value="50000">50,000</SelectItem>
                      <SelectItem value="100000">100,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="stress-test"
                    checked={settings.risk?.stressTestEnabled ?? true}
                    onCheckedChange={(checked) => updateSettings('risk', { stressTestEnabled: checked })}
                  />
                  <Label htmlFor="stress-test">Stress Testing Enabled</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Risk Limits</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="max-var">Maximum VaR (USD)</Label>
                    <Input
                      id="max-var"
                      type="number"
                      value={settings.risk?.riskLimits?.maxVaR ?? 5000000}
                      onChange={(e) => updateSettings('risk', { 
                        riskLimits: { ...(settings.risk?.riskLimits ?? {}), maxVaR: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-unhedged">Max Unhedged Risk (USD)</Label>
                    <Input
                      id="max-unhedged"
                      type="number"
                      value={settings.risk?.riskLimits?.maxUnhedgedRisk ?? 10000000}
                      onChange={(e) => updateSettings('risk', { 
                        riskLimits: { ...(settings.risk?.riskLimits ?? {}), maxUnhedgedRisk: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-hedge">Min Hedge Ratio (%)</Label>
                    <Input
                      id="min-hedge"
                      type="number"
                      value={settings.risk?.riskLimits?.minHedgeRatio ?? 70}
                      onChange={(e) => updateSettings('risk', { 
                        riskLimits: { ...(settings.risk?.riskLimits ?? {}), minHedgeRatio: parseInt(e.target.value) }
                      })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Pricing Settings
              </CardTitle>
              <CardDescription>
                Configuration of pricing models and data sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pricing-model">Default Pricing Model</Label>
                  <Select
                    value={settings.pricing?.defaultModel ?? 'black-scholes'}
                    onValueChange={(value) => updateSettings('pricing', { defaultModel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="black-scholes">Black-Scholes</SelectItem>
                      <SelectItem value="monte-carlo">Monte Carlo</SelectItem>
                      <SelectItem value="binomial">Binomial Tree</SelectItem>
                      <SelectItem value="closed-form">Closed Form</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volatility-model">Volatility Model</Label>
                  <Select
                    value={settings.pricing?.volatilityModel ?? 'implied'}
                    onValueChange={(value) => updateSettings('pricing', { volatilityModel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="historical">Historical</SelectItem>
                      <SelectItem value="garch">GARCH</SelectItem>
                      <SelectItem value="implied">Implied</SelectItem>
                      <SelectItem value="ewma">EWMA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest-source">Interest Rate Source</Label>
                  <Select
                    value={settings.pricing?.interestRateSource ?? 'central-bank'}
                    onValueChange={(value) => updateSettings('pricing', { interestRateSource: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bloomberg">Bloomberg</SelectItem>
                      <SelectItem value="reuters">Reuters</SelectItem>
                      <SelectItem value="central-bank">Central Banks</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Interest Rate Mode Configuration */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <Label className="text-base font-semibold">Interest Rate Configuration for Pricing & Simulations</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="interest-rate-mode">Interest Rate Mode</Label>
                    <Select
                      value={settings.pricing?.interestRateMode ?? 'fixed'}
                      onValueChange={(value) => updateSettings('pricing', { interestRateMode: value as 'fixed' | 'curve' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            <span>Fixed Rate (Bank Rate)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="curve">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            <span>Yield Curve (Bootstrapped)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {settings.pricing?.interestRateMode === 'fixed' 
                        ? "Uses a single fixed rate (Bank Rate) for each currency regardless of maturity."
                        : "Uses the bootstrapped yield curve from Rate Explorer for precise rates at each maturity."}
                    </p>
                  </div>
                  
                  {settings.pricing?.interestRateMode === 'fixed' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Fixed Rates by Currency (Bank Rates %)</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchBankRatesFromBonds()}
                          disabled={isLoadingBankRates}
                          className="h-8"
                        >
                          {isLoadingBankRates ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Chargement...
                            </>
                          ) : (
                            <>
                              <Landmark className="w-3.5 h-3.5 mr-1.5" />
                              Sync from Gov Bonds
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {bondDataLastUpdate && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Dernière mise à jour: {new Date(bondDataLastUpdate).toLocaleString()}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(settings.pricing?.fixedRates ?? {}).map(([currency, rate]) => (
                          <div key={currency} className="space-y-1">
                            <Label htmlFor={`rate-${currency}`} className="text-xs flex items-center gap-1">
                              <span className="font-mono font-bold">{currency}</span>
                            </Label>
                            <div className="flex items-center gap-1">
                              <Input
                                id={`rate-${currency}`}
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={rate}
                                onChange={(e) => {
                                  const newRates = { ...(settings.pricing?.fixedRates ?? {}) };
                                  newRates[currency as keyof typeof newRates] = parseFloat(e.target.value) || 0;
                                  updateSettings('pricing', { fixedRates: newRates });
                                }}
                                className="h-8 text-sm"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Alert className="bg-blue-50 border-blue-200">
                        <Landmark className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-xs text-blue-700">
                          Cliquez sur <strong>"Sync from Gov Bonds"</strong> pour récupérer les taux bancaires depuis World Government Bonds.<br/>
                          Mapping: USD → United States, EUR → Germany, GBP → UK, CHF → Switzerland, JPY → Japan, CAD → Canada, AUD → Australia, NZD → New Zealand.
                        </AlertDescription>
                      </Alert>
                      <p className="text-xs text-muted-foreground">
                        These rates are used as the risk-free rate for pricing options and simulations when "Fixed Rate" mode is selected.
                      </p>
                    </div>
                  )}
                  
                  {settings.pricing?.interestRateMode === 'curve' && (
                    <Alert className="bg-primary/5 border-primary/20">
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Curve Mode:</strong> Interest rates will be interpolated from the bootstrapped yield curve 
                        (IRS + Futures data) based on the specific maturity of each instrument. 
                        Visit the <strong>Rate Explorer → All Curves</strong> tab to view and load the current curves.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricing-frequency">Pricing Frequency</Label>
                  <Select
                    value={settings.pricing?.pricingFrequency ?? 'daily'}
                    onValueChange={(value) => updateSettings('pricing', { pricingFrequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real-time">Real-time</SelectItem>
                      <SelectItem value="5min">Every 5 minutes</SelectItem>
                      <SelectItem value="15min">Every 15 minutes</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="underlying-price-type">Underlying Price for Options</Label>
                  <Select
                    value={settings.pricing?.underlyingPriceType ?? 'forward'}
                    onValueChange={(value) => updateSettings('pricing', { underlyingPriceType: value as 'spot' | 'forward' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spot">Spot Price</SelectItem>
                      <SelectItem value="forward">Forward Price</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose whether to use spot or forward price as the underlying for option pricing calculations. This setting applies to Strategy Builder and Hedging Instruments.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backtest-exercise-type">Backtest Exercise Type</Label>
                  <Select
                    value={settings.pricing?.backtestExerciseType ?? 'monthly-average'}
                    onValueChange={(value) => updateSettings('pricing', { backtestExerciseType: value as 'monthly-average' | 'third-friday' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly-average">Monthly Average</SelectItem>
                      <SelectItem value="third-friday">Third Friday Price</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose how to calculate exercise prices for backtesting: use monthly average price or the price on the third Friday of each month (typical option expiry date).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maturity-convention">Maturity date for pricing (Strategy Builder)</Label>
                  <Select
                    value={settings.pricing?.maturityConvention ?? 'last-month-day'}
                    onValueChange={(value) => updateSettings('pricing', { maturityConvention: value as 'last-month-day' | 'third-friday' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last-month-day">Last day of month</SelectItem>
                      <SelectItem value="third-friday">Third Friday of month</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the maturity date used for each period in Strategy Builder: last calendar day of the month or the third Friday (typical option expiry).
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="real-time-data"
                  checked={settings.pricing?.useRealTimeData ?? false}
                  onCheckedChange={(checked) => updateSettings('pricing', { useRealTimeData: checked })}
                />
                <Label htmlFor="real-time-data">Use Real-time Data</Label>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Current Market Data</h4>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">EUR/USD</div>
                    <div className="text-lg font-bold">{marketData.spotRates['EUR/USD']?.toFixed(4) || 'N/A'}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">GBP/USD</div>
                    <div className="text-lg font-bold">{marketData.spotRates['GBP/USD']?.toFixed(4) || 'N/A'}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">USD/JPY</div>
                    <div className="text-lg font-bold">{marketData.spotRates['USD/JPY']?.toFixed(2) || 'N/A'}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Last Update</div>
                    <div className="text-lg font-bold">{marketData.lastUpdated?.toLocaleTimeString('en-US') || 'N/A'}</div>
                  </div>
                </div>
                <Button onClick={updateMarketData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interface">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Interface Settings
              </CardTitle>
              <CardDescription>
                Customization of interface appearance and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={settings.ui?.theme ?? 'system'}
                    onValueChange={(value) => updateSettings('ui', { theme: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="bloomberg">Bloomberg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={settings.ui?.language ?? 'en'}
                    onValueChange={(value) => updateSettings('ui', { language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-format">Date Format</Label>
                  <Select
                    value={settings.ui?.dateFormat ?? 'DD/MM/YYYY'}
                    onValueChange={(value) => updateSettings('ui', { dateFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number-format">Number Format</Label>
                  <Select
                    value={settings.ui?.numberFormat ?? 'en-US'}
                    onValueChange={(value) => updateSettings('ui', { numberFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr-FR">Français (1 234,56)</SelectItem>
                      <SelectItem value="en-US">Anglais (1,234.56)</SelectItem>
                      <SelectItem value="de-DE">Allemand (1.234,56)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dashboard-refresh">Dashboard Refresh (sec)</Label>
                  <Select
                    value={String(settings.ui?.dashboardRefresh ?? 30)}
                    onValueChange={(value) => updateSettings('ui', { dashboardRefresh: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="0">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <Label className="text-base font-semibold">Display Zoom</Label>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="zoom-level">Zoom Level: {settings.ui?.zoomLevel ?? 100}%</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newZoom = Math.max(50, (settings.ui?.zoomLevel ?? 100) - 10);
                            updateSettings('ui', { zoomLevel: newZoom });
                            applyZoom(newZoom);
                          }}
                          disabled={(settings.ui?.zoomLevel ?? 100) <= 50}
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newZoom = Math.min(150, (settings.ui?.zoomLevel ?? 100) + 10);
                            updateSettings('ui', { zoomLevel: newZoom });
                            applyZoom(newZoom);
                          }}
                          disabled={(settings.ui?.zoomLevel ?? 100) >= 150}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="50"
                        max="150"
                        step="10"
                        value={settings.ui?.zoomLevel ?? 100}
                        onChange={(e) => {
                          const newZoom = parseInt(e.target.value);
                          updateSettings('ui', { zoomLevel: newZoom });
                          applyZoom(newZoom);
                        }}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>50%</span>
                        <span>100%</span>
                        <span>150%</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateSettings('ui', { zoomLevel: 75 });
                          applyZoom(75);
                        }}
                        className="flex-1"
                      >
                        75%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateSettings('ui', { zoomLevel: 100 });
                          applyZoom(100);
                        }}
                        className="flex-1"
                      >
                        100%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateSettings('ui', { zoomLevel: 125 });
                          applyZoom(125);
                        }}
                        className="flex-1"
                      >
                        125%
                      </Button>
                    </div>
                    
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Zoom settings affect the entire application interface. Changes are applied immediately.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                System alerts and notifications configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="risk-alerts"
                    checked={settings.notifications?.riskAlerts ?? true}
                    onCheckedChange={(checked) => updateSettings('notifications', { riskAlerts: checked })}
                  />
                  <Label htmlFor="risk-alerts">Risk Alerts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="price-alerts"
                    checked={settings.notifications?.priceAlerts ?? true}
                    onCheckedChange={(checked) => updateSettings('notifications', { priceAlerts: checked })}
                  />
                  <Label htmlFor="price-alerts">Price Alerts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="maturity-alerts"
                    checked={settings.notifications?.maturityAlerts ?? true}
                    onCheckedChange={(checked) => updateSettings('notifications', { maturityAlerts: checked })}
                  />
                  <Label htmlFor="maturity-alerts">Alertes d'Échéance</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="email-notifications"
                    checked={settings.notifications?.emailNotifications ?? false}
                    onCheckedChange={(checked) => updateSettings('notifications', { emailNotifications: checked })}
                  />
                  <Label htmlFor="email-notifications">Notifications Email</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Alert Thresholds</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="var-threshold">VaR Exceeded (%)</Label>
                    <Input
                      id="var-threshold"
                      type="number"
                      value={settings.notifications?.alertThresholds?.varExceeded ?? 120}
                      onChange={(e) => updateSettings('notifications', { 
                        alertThresholds: { 
                          ...(settings.notifications?.alertThresholds ?? {}), 
                          varExceeded: parseInt(e.target.value) 
                        }
                      })}
                      min="100"
                      max="200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hedge-threshold">Hedge Ratio Below (%)</Label>
                    <Input
                      id="hedge-threshold"
                      type="number"
                      value={settings.notifications?.alertThresholds?.hedgeRatioBelow ?? 50}
                      onChange={(e) => updateSettings('notifications', { 
                        alertThresholds: { 
                          ...(settings.notifications?.alertThresholds ?? {}), 
                          hedgeRatioBelow: parseInt(e.target.value) 
                        }
                      })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maturity-threshold">Maturity Within (days)</Label>
                    <Input
                      id="maturity-threshold"
                      type="number"
                      value={settings.notifications?.alertThresholds?.maturityWithin ?? 30}
                      onChange={(e) => updateSettings('notifications', { 
                        alertThresholds: { 
                          ...(settings.notifications?.alertThresholds ?? {}), 
                          maturityWithin: parseInt(e.target.value) 
                        }
                      })}
                      min="1"
                      max="365"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                Backup, export and data maintenance settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-save"
                    checked={settings.data?.autoSave ?? true}
                    onCheckedChange={(checked) => updateSettings('data', { autoSave: checked })}
                  />
                  <Label htmlFor="auto-save">Auto Save</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backup-frequency">Backup Frequency</Label>
                  <Select
                    value={settings.data?.backupFrequency ?? 'daily'}
                    onValueChange={(value) => updateSettings('data', { backupFrequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data-retention">Data Retention (days)</Label>
                  <Input
                    id="data-retention"
                    type="number"
                    value={settings.data?.dataRetention ?? 365}
                    onChange={(e) => updateSettings('data', { dataRetention: parseInt(e.target.value) })}
                    min="30"
                    max="3650"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-format">Default Export Format</Label>
                  <Select
                    value={settings.data?.exportFormat ?? 'xlsx'}
                    onValueChange={(value) => updateSettings('data', { exportFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                      <SelectItem value="json">JSON (.json)</SelectItem>
                      <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Commodity Domains</h4>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-4">
                    Select the commodity domains you want to work with. Only selected domains will be displayed in Commodity Market, Strategy Builder, and Pricers.
                  </p>
                  <div className="space-y-3">
                    {(['metals', 'agricultural', 'energy', 'freight', 'bunker'] as const).map((domain) => {
                      const domainLabels: Record<typeof domain, string> = {
                        metals: 'Metals',
                        agricultural: 'Agricultural',
                        energy: 'Energy',
                        freight: 'Freight',
                        bunker: 'Bunker'
                      };
                      const selectedDomains = settings.domains?.selectedDomains ?? ['forex'] as string[];
                      const isSelected = selectedDomains.includes(domain);
                      return (
                        <div key={domain} className="flex items-center space-x-2">
                          <Checkbox
                            id={`domain-${domain}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const currentDomains = settings.domains?.selectedDomains ?? ['forex'] as string[];
                              if (checked) {
                                // Add domain if not already present
                                if (!currentDomains.includes(domain)) {
                                  updateSettings('domains', {
                                    selectedDomains: [...currentDomains, domain]
                                  });
                                }
                              } else {
                                // Remove domain, but ensure at least one domain is selected
                                if (currentDomains.length > 1) {
                                  updateSettings('domains', {
                                    selectedDomains: currentDomains.filter(d => d !== domain)
                                  });
                                } else {
                                  toast({
                                    title: "Cannot deselect all domains",
                                    description: "At least one domain must be selected.",
                                    variant: "destructive",
                                  });
                                }
                              }
                            }}
                          />
                          <Label 
                            htmlFor={`domain-${domain}`} 
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {domainLabels[domain]}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Selected: {(settings.domains?.selectedDomains ?? []).length} of 5 domains
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Settings Import/Export</h4>
                <div className="flex gap-4">
                  <Button onClick={exportSettings} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Settings
                  </Button>
                  <div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={importSettings}
                      style={{ display: 'none' }}
                      id="import-settings"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => document.getElementById('import-settings')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import Settings
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Maintenance</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Used Space</div>
                    <div className="text-lg font-bold">24.7 MB</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Last Backup</div>
                    <div className="text-lg font-bold">{new Date().toLocaleString('en-US')}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                    <div className="text-lg font-bold">
                      <Badge variant="default">Operational</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-destructive">Global Data Management</h4>
                  <Badge variant="outline" className="text-destructive border-destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Advanced Operations
                  </Badge>
                </div>
                
                <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <h5 className="font-medium text-orange-800">Quick Access to Commodity Data Operations</h5>
                        <p className="text-sm text-orange-700">
                          Manage commodity exposures and related data directly from the Data Management section. 
                          These operations affect the same data as the Commodity Exposures tab.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => setShowCleanupDialog(true)}
                        disabled={isDeleting}
                      >
                        <Eraser className="h-4 w-4 mr-2" />
                        Clean Commodity Data
                      </Button>
                      
                      
                      <Button 
                        variant="destructive" 
                        className="w-full" 
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Commodity Data
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4 text-xs">
                      <div className="p-2 border rounded">
                        <div className="font-medium text-muted-foreground">Commodity Exposures</div>
                        <div className="text-sm font-bold">
                          {(() => {
                            try {
                              const exposuresData = localStorage.getItem('commodityExposures');
                              const exposures = exposuresData ? JSON.parse(exposuresData) : [];
                              return exposures.length || 0;
                            } catch {
                              return 0;
                            }
                          })()}
                        </div>
                      </div>
                      <div className="p-2 border rounded">
                        <div className="font-medium text-muted-foreground">Settings</div>
                        <div className="text-sm font-bold">
                          {(() => {
                            try {
                              const settingsData = localStorage.getItem('fxRiskManagerSettings');
                              return settingsData ? 'Configured' : 'Default';
                            } catch {
                              return 'Default';
                            }
                          })()}
                        </div>
                      </div>
                      <div className="p-2 border rounded">
                        <div className="font-medium text-muted-foreground">Cache Size</div>
                        <div className="text-sm font-bold">
                          {(() => {
                            try {
                              let totalSize = 0;
                              for (let key in localStorage) {
                                if (key.startsWith('fx')) {
                                  totalSize += localStorage.getItem(key)?.length || 0;
                                }
                              }
                              return `${(totalSize / 1024).toFixed(1)} KB`;
                            } catch {
                              return '0 KB';
                            }
                          })()}
                        </div>
                      </div>
                      <div className="p-2 border rounded">
                        <div className="font-medium text-muted-foreground">Data Health</div>
                        <div className="text-sm font-bold">
                          <Badge variant="secondary" className="text-xs">Good</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commodityexposures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Commodity Exposures Configuration
              </CardTitle>
              <CardDescription>
                Setup and configuration for commodity exposures management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-detection"
                    checked={settings.commodityExposures?.autoDetection ?? true}
                    onCheckedChange={(checked) => updateSettings('commodityExposures', { autoDetection: checked })}
                  />
                  <Label htmlFor="auto-detection">Auto-detect Commodity Exposures</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-maturity">Default Maturity</Label>
                  <Select
                    value={settings.commodityExposures?.defaultMaturity ?? '3M'}
                    onValueChange={(value) => updateSettings('commodityExposures', { defaultMaturity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1W">1 Week</SelectItem>
                      <SelectItem value="1M">1 Month</SelectItem>
                      <SelectItem value="3M">3 Months</SelectItem>
                      <SelectItem value="6M">6 Months</SelectItem>
                      <SelectItem value="1Y">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="risk-classification">Risk Classification</Label>
                  <Select
                    value={settings.commodityExposures?.riskClassification ?? 'commodity-type'}
                    onValueChange={(value) => updateSettings('commodityExposures', { riskClassification: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="critical">Critical Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consolidation-level">Consolidation Level</Label>
                  <Select
                    value={settings.commodityExposures?.consolidationLevel ?? 'entity'}
                    onValueChange={(value) => updateSettings('commodityExposures', { consolidationLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transaction">Transaction Level</SelectItem>
                      <SelectItem value="entity">Entity Level</SelectItem>
                      <SelectItem value="group">Group Level</SelectItem>
                      <SelectItem value="consolidated">Fully Consolidated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exposure-threshold">Exposure Threshold (USD)</Label>
                  <Input
                    id="exposure-threshold"
                    type="number"
                    value={settings.commodityExposures?.exposureThreshold ?? 10000}
                    onChange={(e) => updateSettings('commodityExposures', { exposureThreshold: parseInt(e.target.value) })}
                    min="1000"
                    step="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reporting-currency">Reporting Currency</Label>
                  <Select
                    value={settings.commodityExposures?.reportingCurrency ?? 'USD'}
                    onValueChange={(value) => updateSettings('commodityExposures', { reportingCurrency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="MAD">MAD - Moroccan Dirham</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-pending"
                    checked={settings.commodityExposures?.includePendingTransactions ?? false}
                    onCheckedChange={(checked) => updateSettings('commodityExposures', { includePendingTransactions: checked })}
                  />
                  <Label htmlFor="include-pending">Include Pending Transactions</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Maturity Buckets</h4>
                <div className="grid gap-2 md:grid-cols-3">
                  {(settings.commodityExposures?.maturityBuckets ?? ['0-3M', '3-6M', '6-12M', '12M+']).map((bucket, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <Badge variant="secondary">{bucket}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Maturity buckets are used to categorize exposures by time horizon for risk analysis.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-destructive">Bulk Operations</h4>
                  <Badge variant="outline" className="text-destructive border-destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Danger Zone
                  </Badge>
                </div>
                
                <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <h5 className="font-medium text-destructive">Warning</h5>
                        <p className="text-sm text-muted-foreground">
                          These operations will permanently modify or delete commodity exposure data. 
                          Make sure to backup your data before proceeding.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="w-full" disabled={isDeleting}>
                            <Eraser className="h-4 w-4 mr-2" />
                            Clean Up Exposures
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <Eraser className="h-5 w-5" />
                              Clean Up Commodity Exposures
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove expired and invalid commodity exposures from the system. 
                              The following exposures will be cleaned up:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Exposures with maturity dates in the past</li>
                                <li>Exposures with invalid or missing amounts</li>
                                <li>Exposures with invalid currency codes</li>
                                <li>Duplicate or corrupted entries</li>
                              </ul>
                              <br />
                              Valid exposures will be preserved. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={cleanupExposures}
                              disabled={isDeleting}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              {isDeleting ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Cleaning...
                                </>
                              ) : (
                                <>
                                  <Eraser className="h-4 w-4 mr-2" />
                                  Clean Up
                                </>
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full" disabled={isDeleting}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete All Exposures
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                              <Trash2 className="h-5 w-5" />
                              Delete All Commodity Exposures
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong className="text-destructive">This is a permanent action!</strong>
                              <br /><br />
                              You are about to delete ALL commodity exposures from the system. This includes:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>All current commodity exposures</li>
                                <li>Historical exposure data</li>
                                <li>Associated backup files</li>
                                <li>Cached exposure calculations</li>
                              </ul>
                              <br />
                              <strong>This action cannot be undone.</strong> Make sure you have exported 
                              or backed up any important data before proceeding.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={deleteAllExposures}
                              disabled={isDeleting}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              {isDeleting ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete All
                                </>
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {deletionStats && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          Operation completed successfully! 
                          {deletionStats.deleted > 0 ? (
                            <> {deletionStats.deleted} out of {deletionStats.total} exposures were processed.</>
                          ) : (
                            <> No exposures needed to be processed.</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}


                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                      <div className="p-3 border rounded-lg">
                        <div className="font-medium text-muted-foreground">Current Exposures</div>
                        <div className="text-lg font-bold">
                          {(() => {
                            try {
                              const exposuresData = localStorage.getItem('commodityExposures');
                              const exposures = exposuresData ? JSON.parse(exposuresData) : [];
                              return exposures.length || 0;
                            } catch {
                              return 0;
                            }
                          })()}
                        </div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="font-medium text-muted-foreground">Data Size</div>
                        <div className="text-lg font-bold">
                          {(() => {
                            try {
                              const exposuresData = localStorage.getItem('commodityExposures');
                              const sizeKB = exposuresData ? (exposuresData.length / 1024).toFixed(1) : '0';
                              return `${sizeKB} KB`;
                            } catch {
                              return '0 KB';
                            }
                          })()}
                        </div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="font-medium text-muted-foreground">Last Modified</div>
                        <div className="text-lg font-bold">
                          {(() => {
                            try {
                              const lastModified = localStorage.getItem('commodityExposuresLastModified');
                              return lastModified ? new Date(lastModified).toLocaleDateString('en-US') : 'Never';
                            } catch {
                              return 'Never';
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hedging">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Hedging Instruments Setup
              </CardTitle>
              <CardDescription>
                Configuration for hedging instruments and strategies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-instrument">Default Instrument Type</Label>
                  <Select
                    value={settings.hedgingInstruments?.defaultInstrumentType ?? 'forward'}
                    onValueChange={(value) => updateSettings('hedgingInstruments', { defaultInstrumentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forward">Forward</SelectItem>
                      <SelectItem value="swap">Swap</SelectItem>
                      <SelectItem value="option">Option</SelectItem>
                      <SelectItem value="collar">Collar</SelectItem>
                      <SelectItem value="barrier">Barrier Option</SelectItem>
                      <SelectItem value="vanilla-call">Vanilla Call</SelectItem>
                      <SelectItem value="vanilla-put">Vanilla Put</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto-hedge-ratio">Auto Hedge Ratio (%)</Label>
                  <Input
                    id="auto-hedge-ratio"
                    type="number"
                    value={settings.hedgingInstruments?.autoHedgeRatio ?? 80}
                    onChange={(e) => updateSettings('hedgingInstruments', { autoHedgeRatio: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-leverage">Maximum Leverage</Label>
                  <Input
                    id="max-leverage"
                    type="number"
                    value={settings.hedgingInstruments?.maxLeverage ?? 10}
                    onChange={(e) => updateSettings('hedgingInstruments', { maxLeverage: parseInt(e.target.value) })}
                    min="1"
                    max="50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settlement-preferences">Settlement Preferences</Label>
                  <Select
                    value={settings.hedgingInstruments?.settlementPreferences ?? 'cash'}
                    onValueChange={(value) => updateSettings('hedgingInstruments', { settlementPreferences: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical Settlement</SelectItem>
                      <SelectItem value="cash">Cash Settlement</SelectItem>
                      <SelectItem value="net">Net Settlement</SelectItem>
                      <SelectItem value="automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Risk Controls</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="counterparty-limits"
                      checked={settings.hedgingInstruments?.counterpartyLimits ?? true}
                      onCheckedChange={(checked) => updateSettings('hedgingInstruments', { counterpartyLimits: checked })}
                    />
                    <Label htmlFor="counterparty-limits">Counterparty Limits</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="credit-risk-assessment"
                      checked={settings.hedgingInstruments?.creditRiskAssessment ?? true}
                      onCheckedChange={(checked) => updateSettings('hedgingInstruments', { creditRiskAssessment: checked })}
                    />
                    <Label htmlFor="credit-risk-assessment">Credit Risk Assessment</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="margin-requirements"
                      checked={settings.hedgingInstruments?.marginRequirements ?? true}
                      onCheckedChange={(checked) => updateSettings('hedgingInstruments', { marginRequirements: checked })}
                    />
                    <Label htmlFor="margin-requirements">Margin Requirements</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="approval-workflow"
                      checked={settings.hedgingInstruments?.approvalWorkflow ?? false}
                      onCheckedChange={(checked) => updateSettings('hedgingInstruments', { approvalWorkflow: checked })}
                    />
                    <Label htmlFor="approval-workflow">Approval Workflow</Label>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-lg font-medium">Documentation Requirements</h4>
                <div className="grid gap-2 md:grid-cols-3">
                  {(settings.hedgingInstruments?.documentationRequired ?? ['ISDA Master Agreement', 'CSA', 'Trade Confirmation']).map((doc, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <Badge variant="outline">{doc}</Badge>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additional-docs">Additional Documentation</Label>
                  <Textarea
                    id="additional-docs"
                    placeholder="Enter additional documentation requirements..."
                    rows={3}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <h4 className="text-lg font-medium flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Portfolios and counterparties
                </h4>
                <p className="text-sm text-muted-foreground">
                  Manage portfolios and counterparties used in Hedging Instruments. Lists are shared with the Hedging Instruments page.
                </p>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Portfolios */}
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <Label className="text-base font-semibold">Portfolios</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Portfolio name"
                        value={newPortfolioName}
                        onChange={(e) => setNewPortfolioName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHedgingPortfolio())}
                      />
                      <Button type="button" onClick={addHedgingPortfolio} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {hedgingPortfolios.length === 0 ? (
                        <li className="text-sm text-muted-foreground">No portfolios</li>
                      ) : (
                        hedgingPortfolios.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                            <span>{p.name}</span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete portfolio?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the portfolio &quot;{p.name}&quot;? This action cannot be undone. Instruments linked to this portfolio will not be deleted but will no longer show a portfolio.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeHedgingPortfolio(p.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Counterparties */}
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <Label className="text-base font-semibold">Counterparties</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Counterparty name"
                        value={newCounterpartyName}
                        onChange={(e) => setNewCounterpartyName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHedgingCounterparty())}
                      />
                      <Button type="button" onClick={addHedgingCounterparty} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {hedgingCounterparties.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                          <span>{c.name}</span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Delete counterparty?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the counterparty &quot;{c.name}&quot;? This action cannot be undone. Instruments linked to this counterparty will not be deleted but will no longer show a counterparty.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeHedgingCounterparty(c.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Clés API
              </CardTitle>
              <CardDescription>
                Gestion des clés API pour les services de l'application (Hedge Assistant, etc.). Enregistrez avec le bouton Save en haut pour conserver les modifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Clé API Gemini (Google AI Studio)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Utilisée par le Hedge Assistant pour le modèle Gemini 2.5 Flash. Si renseignée ici, elle sera disponible pour le chat (vous pouvez aussi la saisir dans Configuration de l'Assistant). Obtenez une clé sur Google AI Studio.
                  </p>
                  <Input
                    type="password"
                    placeholder="AIza..."
                    value={settings.api?.geminiApiKey ?? ""}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        api: { ...prev.api, geminiApiKey: e.target.value }
                      }));
                      setHasChanges(true);
                    }}
                    className="font-mono text-sm"
                    autoComplete="off"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostic">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Diagnostic & Récupération
              </CardTitle>
              <CardDescription>
                Outils de diagnostic et de récupération pour résoudre les problèmes de l'application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* LocalStorage Statistics */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Statistiques LocalStorage</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {(() => {
                          const stats = getLocalStorageStats();
                          return stats.itemCount;
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Éléments stockés
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {(() => {
                          const stats = getLocalStorageStats();
                          return (stats.totalSize / 1024).toFixed(1) + ' KB';
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Taille totale
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {(() => {
                          const stats = getLocalStorageStats();
                          const largestItem = stats.items[0];
                          return largestItem ? largestItem.key : 'N/A';
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Plus gros élément
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Emergency Recovery Actions */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Actions de Récupération</h4>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Ces actions peuvent supprimer des données. Utilisez-les uniquement en cas de problème.
                  </AlertDescription>
                </Alert>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Nettoyer les données du Strategy Builder</CardTitle>
                      <CardDescription>
                        Supprime les données corrompues du Strategy Builder
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="w-full">
                            <Eraser className="h-4 w-4 mr-2" />
                            Nettoyer Strategy Builder
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Nettoyer les données du Strategy Builder</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action va supprimer toutes les données sauvegardées du Strategy Builder, 
                              y compris les stratégies, paramètres et résultats. Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                performEmergencyRecovery({ clearCalculatorState: true });
                                toast({
                                  title: "Données nettoyées",
                                  description: "Les données du Strategy Builder ont été supprimées.",
                                });
                              }}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              Nettoyer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Réinitialiser toutes les données</CardTitle>
                      <CardDescription>
                        Supprime toutes les données de l'application
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Réinitialiser tout
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Réinitialiser toutes les données</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action va supprimer TOUTES les données de l'application, 
                              y compris les paramètres, stratégies, expositions et instruments. 
                              Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                performEmergencyRecovery({ resetToDefaults: true });
                                toast({
                                  title: "Application réinitialisée",
                                  description: "Toutes les données ont été supprimées.",
                                });
                              }}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Réinitialiser
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* System Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Informations Système</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Navigateur</Label>
                    <Input 
                      value={navigator.userAgent.split(' ').slice(-2).join(' ')} 
                      readOnly 
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LocalStorage disponible</Label>
                    <Input 
                      value={(() => {
                        try {
                          localStorage.setItem('test', 'test');
                          localStorage.removeItem('test');
                          return 'Oui';
                        } catch {
                          return 'Non';
                        }
                      })()} 
                      readOnly 
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Settings; 