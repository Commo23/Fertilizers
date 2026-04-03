import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FileText, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Download, 
  Trash2, 
  Eye, 
  Search,
  RefreshCw,
  Archive,
  Activity,
  XCircle,
  ChevronUp,
  ChevronDown,
  Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SavedScenario } from '@/types/Scenario';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import ScenariosPdfExport from '@/components/ScenariosPdfExport';
import PayoffChart from '@/components/PayoffChart';
import { ThemeProvider } from '@/hooks/ThemeProvider';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { BRAND } from '@/constants/branding';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Interfaces pour les différents types de rapports
interface SavedRiskMatrix {
  id: string;
  name: string;
  timestamp: number;
  priceRanges: Array<{ min: number; max: number; probability: number }>;
  strategies: Array<{
    components: any[];
    coverageRatio: number;
    name: string;
  }>;
  results: Array<{
    strategy: any[];
    coverageRatio: number;
    costs: Record<string, number>;
    differences: Record<string, number>;
    hedgingCost: number;
    name: string;
  }>;
}

interface SavedBacktest {
  id: string;
  name: string;
  timestamp: number;
  type: 'historical' | 'stress-test' | 'scenario';
  params: any;
  results: any[];
  historicalData?: Array<{ date: string; price: number }>;
  monthlyStats?: Array<{
    month: string;
    avgPrice: number;
    volatility: number;
    dataPoints: number;
    calculationMethod: string;
  }>;
}

interface ReportStats {
  totalScenarios: number;
  totalRiskMatrices: number;
  totalBacktests: number;
  totalSize: number;
  lastUpdated: Date;
  scenariosByCurrency: Record<string, number>;
  scenariosByType: Record<string, number>;
  averageScenarioSize: number;
  oldestReport: Date;
  newestReport: Date;
}

// Add this interface for yearly results
interface YearlyResult {
  hedgedCost: number;
  unhedgedCost: number;
  deltaPnL: number;
  strategyPremium: number;
  volume: number;
}

const Reports = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  
  // États pour les différents types de rapports
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [savedRiskMatrices, setSavedRiskMatrices] = useState<SavedRiskMatrix[]>([]);
  const [savedBacktests, setSavedBacktests] = useState<SavedBacktest[]>([]);
  const [reportStats, setReportStats] = useState<ReportStats>({
    totalScenarios: 0,
    totalRiskMatrices: 0,
    totalBacktests: 0,
    totalSize: 0,
    lastUpdated: new Date(),
    scenariosByCurrency: {},
    scenariosByType: {},
    averageScenarioSize: 0,
    oldestReport: new Date(),
    newestReport: new Date()
  });

  // États pour les dialogues
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, Record<string, boolean>>>({});

  // Charger tous les rapports au montage du composant
  useEffect(() => {
    loadAllReports();
  }, []);

  const loadAllReports = () => {
    try {
      // Charger les scénarios sauvegardés
      const scenariosData = localStorage.getItem('optionScenarios');
      const scenarios = scenariosData ? JSON.parse(scenariosData) : [];
      setSavedScenarios(scenarios);

      // Charger les matrices de risque
      const riskMatricesData = localStorage.getItem('savedRiskMatrices');
      const riskMatrices = riskMatricesData ? JSON.parse(riskMatricesData) : [];
      setSavedRiskMatrices(riskMatrices);

      // Charger les backtests (ils sont aussi dans optionScenarios mais marqués différemment)
      const backtests = scenarios.filter((scenario: SavedScenario) => 
        scenario.stressTest?.isHistorical || scenario.stressTest?.name === 'Historical Backtest'
      );
      setSavedBacktests(backtests);

      // Calculer les statistiques détaillées
      const totalSize = JSON.stringify(scenarios).length + 
                       JSON.stringify(riskMatrices).length + 
                       JSON.stringify(backtests).length;
      
      // Statistiques par devise
      const scenariosByCurrency: Record<string, number> = {};
      scenarios.forEach((scenario: SavedScenario) => {
        const currency = scenario.params.commodity?.symbol || scenario.params.commodity?.base || (scenario.params as any).currencyPair?.symbol || 'Unknown';
        scenariosByCurrency[currency] = (scenariosByCurrency[currency] || 0) + 1;
      });

      // Statistiques par type de scénario
      const scenariosByType: Record<string, number> = {};
      scenarios.forEach((scenario: SavedScenario) => {
        const type = scenario.stressTest?.name || 'Base Calculation';
        scenariosByType[type] = (scenariosByType[type] || 0) + 1;
      });

      // Calculer les dates
      const allTimestamps = [
        ...scenarios.map(s => s.timestamp),
        ...riskMatrices.map(r => r.timestamp),
        ...backtests.map(b => b.timestamp)
      ];
      
      const oldestReport = allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps)) : new Date();
      const newestReport = allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : new Date();
      
      // Taille moyenne des scénarios
      const averageScenarioSize = scenarios.length > 0 ? 
        scenarios.reduce((sum, s) => sum + JSON.stringify(s).length, 0) / scenarios.length : 0;
      
      setReportStats({
        totalScenarios: scenarios.length,
        totalRiskMatrices: riskMatrices.length,
        totalBacktests: backtests.length,
        totalSize,
        lastUpdated: new Date(),
        scenariosByCurrency,
        scenariosByType,
        averageScenarioSize,
        oldestReport,
        newestReport
      });
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  // Fonctions utilitaires
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'scenario': return <FileText className="h-4 w-4" />;
      case 'risk-matrix': return <BarChart3 className="h-4 w-4" />;
      case 'backtest': return <TrendingUp className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'scenario': return 'bg-blue-100 text-blue-800';
      case 'risk-matrix': return 'bg-green-100 text-green-800';
      case 'backtest': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Fonctions de filtrage
  const filteredReports = () => {
    let reports = [
      ...savedScenarios.map(s => ({ ...s, type: 'scenario' })),
      ...savedRiskMatrices.map(r => ({ ...r, type: 'risk-matrix' })),
      ...savedBacktests.map(b => ({ ...b, type: 'backtest' }))
    ];

    // Filtre par recherche
    if (searchTerm) {
      reports = reports.filter(report => 
        report.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par type
    if (filterType !== 'all') {
      reports = reports.filter(report => report.type === filterType);
    }

    // Filtre par date
    if (dateRange !== 'all') {
      const now = Date.now();
      const ranges = {
        'today': 24 * 60 * 60 * 1000,
        'week': 7 * 24 * 60 * 60 * 1000,
        'month': 30 * 24 * 60 * 60 * 1000,
        'year': 365.25 * 24 * 60 * 60 * 1000
      };
      
      if (ranges[dateRange as keyof typeof ranges]) {
        reports = reports.filter(report => 
          (now - report.timestamp) < ranges[dateRange as keyof typeof ranges]
        );
      }
    }

    return reports.sort((a, b) => b.timestamp - a.timestamp);
  };

  // Fonctions d'action
  const viewReport = (report: any) => {
    setSelectedReport(report);
    setIsViewDialogOpen(true);
  };

  const deleteReport = (report: any) => {
    setSelectedReport(report);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedReport) return;

    try {
      if (selectedReport.type === 'scenario') {
        const updatedScenarios = savedScenarios.filter(s => s.id !== selectedReport.id);
        setSavedScenarios(updatedScenarios);
        localStorage.setItem('optionScenarios', JSON.stringify(updatedScenarios));
      } else if (selectedReport.type === 'risk-matrix') {
        const updatedMatrices = savedRiskMatrices.filter(m => m.id !== selectedReport.id);
        setSavedRiskMatrices(updatedMatrices);
        localStorage.setItem('savedRiskMatrices', JSON.stringify(updatedMatrices));
      }

      loadAllReports(); // Recharger les statistiques
      setIsDeleteDialogOpen(false);
      setSelectedReport(null);
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const loadScenario = (scenario: SavedScenario) => {
    try {
      localStorage.setItem('calculatorState', JSON.stringify({
        params: scenario.params,
        strategy: scenario.strategy,
        results: scenario.results,
        payoffData: scenario.payoffData,
        // Récupérer les paramètres personnalisés du scénario sauvegardé ou utiliser des valeurs par défaut
        manualForwards: scenario.manualForwards || {},
        realPrices: scenario.realPrices || {},
        realPriceParams: {
          useSimulation: false,
          volatility: 0.3,
          drift: 0.01,
          numSimulations: 1000
        },
        barrierOptionSimulations: 1000,
        useClosedFormBarrier: false,
        activeTab: 'parameters',
        customScenario: scenario.stressTest,
        stressTestScenarios: {}, // You might want to save this too
        // Récupérer les paramètres de volatilité implicite
        useImpliedVol: scenario.useImpliedVol || false,
        impliedVolatilities: scenario.impliedVolatilities || {},
        // Récupérer les prix personnalisés des options
        useCustomOptionPrices: (scenario as any).useCustomOptionPrices || false,
        customOptionPrices: scenario.customOptionPrices || {}
      }));
      navigate('/strategy-builder');
    } catch (error) {
      console.error('Error loading scenario:', error);
    }
  };

  const exportReport = (report: any) => {
    // Utiliser la fonction PDF pour l'export
    exportToPdf(report);
  };

  const clearAllReports = () => {
    if (confirm('Are you sure you want to delete ALL reports? This action cannot be undone.')) {
      localStorage.removeItem('optionScenarios');
      localStorage.removeItem('savedRiskMatrices');
      loadAllReports();
    }
  };

  // Fonctions pour la sélection multiple
  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const selectAllReports = () => {
    const allReportIds = filteredReports().map(report => `${report.type}-${report.id}`);
    setSelectedReports(allReportIds);
  };

  const clearSelection = () => {
    setSelectedReports([]);
  };

  const importReports = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (importData.reports && Array.isArray(importData.reports)) {
          // Importer les rapports
          importData.reports.forEach((report: any) => {
            if (report.type === 'scenario') {
              const existingScenarios = JSON.parse(localStorage.getItem('optionScenarios') || '[]');
              existingScenarios.push(report);
              localStorage.setItem('optionScenarios', JSON.stringify(existingScenarios));
            } else if (report.type === 'risk-matrix') {
              const existingMatrices = JSON.parse(localStorage.getItem('savedRiskMatrices') || '[]');
              existingMatrices.push(report);
              localStorage.setItem('savedRiskMatrices', JSON.stringify(existingMatrices));
            }
          });
          
          loadAllReports();
          alert(`Successfully imported ${importData.reports.length} reports`);
        }
      } catch (error) {
        console.error('Error importing reports:', error);
        alert('Error importing reports. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const exportSelectedReports = () => {
    if (selectedReports.length === 0) return;

    try {
      const reportsToExport = filteredReports().filter(report => 
        selectedReports.includes(`${report.type}-${report.id}`)
      );

      const exportData = {
        exportDate: new Date().toISOString(),
        totalReports: reportsToExport.length,
        reports: reportsToExport
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `reports_export_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error exporting selected reports:', error);
    }
  };

  // Fonctions pour la visualisation détaillée
  const initializeExpandedState = (reportId: string) => ({
    strategy: false,
    detailedResults: false,
    yearlyStats: false,
    totalStats: false,
    monthlyPnL: false
  });

  const toggleSection = (reportId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [reportId]: {
        ...(prev[reportId] || initializeExpandedState(reportId)),
        [section]: !(prev[reportId]?.[section] ?? false)
      }
    }));
  };

  const getScenarioTypeName = (scenario: SavedScenario) => {
    if (!scenario.stressTest) return 'Base Calculation';
    return scenario.stressTest.name;
  };

  const calculateYearlyResults = (results: SavedScenario['results']): Record<string, YearlyResult> => {
    const yearlyData: Record<string, YearlyResult> = {};
    
    results.forEach(result => {
      const year = new Date(result.date).getFullYear().toString();
      
      if (!yearlyData[year]) {
        yearlyData[year] = {
          hedgedCost: 0,
          unhedgedCost: 0,
          deltaPnL: 0,
          strategyPremium: 0,
          volume: 0
        };
      }
      
      yearlyData[year].hedgedCost += result.hedgedCost;
      yearlyData[year].unhedgedCost += result.unhedgedCost;
      yearlyData[year].deltaPnL += result.deltaPnL;
      yearlyData[year].strategyPremium += result.strategyPrice * result.monthlyVolume;
      yearlyData[year].volume += result.monthlyVolume;
    });
    
    return yearlyData;
  };

  // Fonction pour générer les données du profil de couverture FX
  const generateCommodityHedgingData = (strategy: any[], spot: number, includePremium: boolean = false) => {
    const data = [];
    const minSpot = spot * 0.7;  // -30% du spot
    const maxSpot = spot * 1.3;  // +30% du spot
    const step = (maxSpot - minSpot) / 100; // 100 points

    for (let currentSpot = minSpot; currentSpot <= maxSpot; currentSpot += step) {
      const unhedgedRate = currentSpot;
      let hedgedRate = currentSpot;
      let totalPremium = 0;

      // Process each option in the strategy
      strategy.forEach(option => {
        const strike = option.strikeType === 'percent' 
          ? spot * (option.strike / 100) 
          : option.strike;
        
        // Utilise la quantité avec son signe (+ pour achat, - pour vente)
        const quantity = option.quantity / 100;
        
        // Calculate option premium (simplified)
        const premium = 0.01 * Math.abs(quantity); // Prime simplifiée, toujours positive
        
        if (option.type === 'put') {
          // PUT: La logique change selon achat ou vente
          if (currentSpot < strike) {
            // Dans la monnaie
            if (quantity > 0) {
              // ACHAT PUT: Protection contre la baisse
              hedgedRate = currentSpot - ((strike - currentSpot) * Math.abs(quantity));
            } else if (quantity < 0) {
              // VENTE PUT: Obligation d'achat à un prix élevé
              hedgedRate = currentSpot + ((strike - currentSpot) * Math.abs(quantity));
            }
          }
          // Hors de la monnaie: pas d'effet sur le taux (sauf prime)
        } 
        else if (option.type === 'call') {
          // CALL: La logique change selon achat ou vente
          if (currentSpot > strike) {
            // Dans la monnaie
            if (quantity > 0) {
              // ACHAT CALL: Protection contre la hausse
              hedgedRate = currentSpot - ((currentSpot - strike) * Math.abs(quantity));
            } else if (quantity < 0) {
              // VENTE CALL: Obligation de vente à un prix bas
              hedgedRate = currentSpot + ((currentSpot - strike) * Math.abs(quantity));
            }
          }
          // Hors de la monnaie: pas d'effet sur le taux (sauf prime)
        }
        else if (option.type === 'forward') {
          // FORWARD: Taux fixe peu importe le spot
          hedgedRate = strike * Math.abs(quantity) + currentSpot * (1 - Math.abs(quantity));
        }
        else if (option.type === 'swap') {
          // SWAP: Échange à taux fixe
          hedgedRate = strike;
        }
        
        // Barrier options (simplified logic)
        else if (option.type.includes('knockout') || option.type.includes('knockin')) {
          const barrier = option.barrierType === 'percent' 
            ? spot * (option.barrier / 100) 
            : option.barrier;
          
          let isBarrierBroken = false;
          
          if (option.type.includes('knockout')) {
            if (option.type.includes('call')) {
              isBarrierBroken = currentSpot >= barrier;
            } else if (option.type.includes('put')) {
              isBarrierBroken = currentSpot <= barrier;
            }
          } else if (option.type.includes('knockin')) {
            if (option.type.includes('call')) {
              isBarrierBroken = currentSpot >= barrier;
            } else if (option.type.includes('put')) {
              isBarrierBroken = currentSpot <= barrier;
            }
          }
          
          if (isBarrierBroken) {
            if (option.type.includes('knockout')) {
              // Knockout: l'option expire
              hedgedRate = currentSpot;
            } else if (option.type.includes('knockin')) {
              // Knockin: l'option devient active
              if (option.type.includes('call') && currentSpot > strike) {
                hedgedRate = currentSpot - ((currentSpot - strike) * Math.abs(quantity));
              } else if (option.type.includes('put') && currentSpot < strike) {
                hedgedRate = currentSpot - ((strike - currentSpot) * Math.abs(quantity));
              }
            }
          }
        }
        
        if (includePremium) {
          totalPremium += premium;
        }
      });
      
      data.push({
        spot: currentSpot,
        unhedged: unhedgedRate,
        hedged: hedgedRate,
        premium: totalPremium
      });
    }
    
    return data;
  };

  // Helper functions pour le formatage
  const formatNumber = (value: number, decimals: number = 2): string => {
    if (isNaN(value) || value === null || value === undefined) return 'N/A';
    return Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true
    });
  };

  const formatCurrency = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return 'N/A';
    const sign = value < 0 ? '-' : '';
    const absValue = Math.abs(value);
    return `${sign}$${absValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    })}`;
  };

  const formatPercentage = (value: number, decimals: number = 2): string => {
    if (isNaN(value) || value === null || value === undefined) return 'N/A';
    return `${value.toFixed(decimals)}%`;
  };

  const formatVolume = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return 'N/A';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true
    });
  };

  // Fonction pour exporter en PDF - Version améliorée et professionnelle
  const exportToPdf = async (report: any) => {
    if (report.type === 'scenario') {
      const tempExport = async () => {
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
          putOnlyUsedFonts: true,
          compress: true
        });

        const pageWidth = pdf.internal.pageSize.width;
        const pageHeight = pdf.internal.pageSize.height;
        const contentPadding = 15;
        let yOffset = contentPadding;
        let currentPage = 1;

        // Fonction pour ajouter une nouvelle page si nécessaire
        const checkPageBreak = (requiredSpace: number) => {
          if (yOffset + requiredSpace > pageHeight - 20) {
            pdf.addPage();
            yOffset = contentPadding;
            currentPage++;
            addPageHeader();
          }
        };

        // En-tête de page
        const addPageHeader = () => {
          // Header avec logo et titre
          pdf.setFillColor(30, 64, 175); // Blue-600
          pdf.rect(0, 0, pageWidth, 28, 'F');
          
          // Ajouter le logo si l'option est cochée
          const includeLogoInPdf = (() => {
            try {
              const saved = localStorage.getItem('includeLogoInPdf');
              return saved ? JSON.parse(saved) : false;
            } catch {
              return false;
            }
          })();
          
          if (includeLogoInPdf) {
            try {
              const companyLogo = localStorage.getItem('companyLogo');
              if (companyLogo && companyLogo.trim() !== '') {
                // Centrer verticalement le logo dans la barre (hauteur 28mm, logo 18mm -> offset de 5mm)
                const logoY = 5; // Position Y pour centrer dans la barre de 28mm
                const logoHeight = 18;
                const logoWidth = 18;
                
                let imageData = '';
                let imageFormat = 'PNG';
                
                if (companyLogo.startsWith('data:image')) {
                  // Logo en base64 avec préfixe data:image
                  imageData = companyLogo;
                  // Extraire le format depuis le data URL
                  if (companyLogo.includes('image/jpeg') || companyLogo.includes('image/jpg')) {
                    imageFormat = 'JPEG';
                  } else if (companyLogo.includes('image/png')) {
                    imageFormat = 'PNG';
                  }
                } else if (!companyLogo.startsWith('/') && !companyLogo.startsWith('http')) {
                  // Logo en base64 sans préfixe data: - détecter le format
                  if (companyLogo.startsWith('iVBORw0KGgo') || companyLogo.startsWith('/9j/')) {
                    // PNG base64 commence par iVBORw0KGgo
                    imageData = `data:image/png;base64,${companyLogo}`;
                    imageFormat = 'PNG';
                  } else if (companyLogo.startsWith('/9j/') || companyLogo.startsWith('iVBORw0KGgo') === false) {
                    // JPEG base64 commence par /9j/
                    imageData = `data:image/jpeg;base64,${companyLogo}`;
                    imageFormat = 'JPEG';
                  } else {
                    // Par défaut, essayer PNG
                    imageData = `data:image/png;base64,${companyLogo}`;
                    imageFormat = 'PNG';
                  }
                }
                
                if (imageData) {
                  // Ajouter le logo APRÈS le rectangle bleu pour qu'il soit visible au-dessus
                  pdf.addImage(imageData, imageFormat, contentPadding, logoY, logoWidth, logoHeight);
                }
              }
            } catch (error) {
              console.warn('Could not add logo to PDF:', error);
            }
          }
          
          const logoOffset = includeLogoInPdf ? 25 : 0;
          
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255);
          pdf.setFontSize(18);
          pdf.text('COMMODITY RISK MANAGER', contentPadding + logoOffset, 12);
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.text('Professional Commodity Hedging & Risk Management Report', contentPadding + logoOffset, 19);
          
          // Report ID and generation date - simplified and smaller, below the subtitle
          const reportId = report.id || `RPT-${Date.now()}`;
          // Simplify ID: take first 8 characters if it's a UUID, otherwise use first 8 chars
          const shortId = reportId.length > 8 ? reportId.substring(0, 8).toUpperCase() : reportId.toUpperCase();
          const generatedDate = new Date(report.timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(220, 220, 220); // Lighter gray for less prominence
          pdf.text(`ID: ${shortId} | ${generatedDate}`, pageWidth - contentPadding, 24, { align: 'right' });
          
          // Reset text color to black for the rest of the document
          pdf.setTextColor(0, 0, 0);
          
          // Ligne de séparation
          pdf.setDrawColor(200, 200, 200);
          pdf.line(contentPadding, 28, pageWidth - contentPadding, 28);
          
          yOffset = 38;
        };

        // En-tête principal du document
        addPageHeader();
        
        // Titre principal du rapport avec meilleur styling
        const cleanTitle = report.name.replace(/[^\w\s-]/g, ' ').trim();
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0);
        pdf.setFontSize(20);
        pdf.text(cleanTitle, contentPadding, yOffset, { maxWidth: pageWidth - 2 * contentPadding });
        yOffset += 10;

        // Sous-titre avec métadonnées
        const scenarioType = getScenarioTypeName(report);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Scenario Type: ${scenarioType}`, contentPadding, yOffset);
        yOffset += 6;
        
        // Commodity information
        const commodityNameForHeader = report.params.commodity?.symbol || report.params.commodity?.base || (report.params as any).currencyPair?.symbol || 'N/A';
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Commodity: ${commodityNameForHeader}`, contentPadding, yOffset);
        yOffset += 8;

        // Table des matières
        checkPageBreak(30);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0);
        pdf.setFontSize(14);
        pdf.text('TABLE OF CONTENTS', contentPadding, yOffset);
        yOffset += 8;

        const tocItems = [
          '1. Executive Summary',
          '2. Strategy Parameters',
          '3. Strategy Components',
          '4. Risk Analysis',
          '5. Detailed Results',
          '6. Yearly & Monthly Breakdown',
          '7. Performance Metrics',
          '8. Summary Statistics'
        ];

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        tocItems.forEach((item, index) => {
          pdf.text(item, contentPadding + 5, yOffset);
          yOffset += 4;
        });
        yOffset += 10;

        // 1. Executive Summary
        checkPageBreak(40);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(0);
        pdf.text('1. EXECUTIVE SUMMARY', contentPadding, yOffset);
        yOffset += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const totalPnL = report.results?.reduce((sum: number, r: any) => sum + r.deltaPnL, 0) || 0;
        const totalVolume = report.results?.reduce((sum: number, r: any) => sum + r.monthlyVolume, 0) || 0;
        const avgHedgedCost = report.results?.reduce((sum: number, r: any) => sum + r.hedgedCost, 0) / (report.results?.length || 1) || 0;
        const avgUnhedgedCost = report.results?.reduce((sum: number, r: any) => sum + r.unhedgedCost, 0) / (report.results?.length || 1) || 0;
        const costReduction = avgUnhedgedCost !== 0 ? ((totalPnL / Math.abs(avgUnhedgedCost)) * 100) : 0;
        
        // Déclarer commodityName avant son utilisation
        const commodityName = report.params.commodity?.symbol || report.params.commodity?.base || (report.params as any).currencyPair?.symbol || 'N/A';

        // Check if custom periods are used
        const useCustomPeriods = report.params.useCustomPeriods || false;
        const customPeriodsCount = report.params.customPeriods?.length || 0;
        
        const strategyCoverageText = useCustomPeriods && customPeriodsCount > 0
          ? `The strategy uses ${customPeriodsCount} custom hedging period${customPeriodsCount > 1 ? 's' : ''} with a total volume of ${formatVolume(totalVolume)} units.`
          : `The strategy covers ${report.params.monthsToHedge} months with a total volume of ${formatVolume(totalVolume)} units.`;
        
        const summaryText = [
          `This report presents a comprehensive analysis of the "${report.name}" commodity hedging strategy.`,
          strategyCoverageText,
          '',
          'Key Performance Metrics:',
          '',
          `• Total P&L: ${formatCurrency(totalPnL)}`,
          `• Average Hedged Cost: ${formatCurrency(avgHedgedCost)}`,
          `• Average Unhedged Cost: ${formatCurrency(avgUnhedgedCost)}`,
          `• Cost Reduction: ${formatPercentage(costReduction)}`,
          `• Strategy Components: ${report.strategy?.length || 0} instrument${(report.strategy?.length || 0) > 1 ? 's' : ''}`,
          `• Commodity: ${commodityName}`
        ];

        summaryText.forEach(line => {
          pdf.text(line, contentPadding + 5, yOffset);
          yOffset += 4;
        });
        yOffset += 10;

        // 2. Strategy Parameters
        checkPageBreak(50);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('2. STRATEGY PARAMETERS', contentPadding, yOffset);
        yOffset += 8;

        const tableOptions = {
          headStyles: { 
            fillColor: [30, 64, 175],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 10
          },
          bodyStyles: {
            fontSize: 9,
            cellPadding: 3,
            halign: 'left'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { 
            left: contentPadding,
            right: contentPadding,
            top: 2,
            bottom: 2
          },
          tableWidth: 'auto'
        };
        
        // Build basic parameters - adapt based on custom periods (reuse variables already declared above)
        const basicParams = [
          ['Parameter', 'Value', 'Description'],
          ['Start Date', report.params.startDate, 'Hedging start date']
        ];
        
        // Add hedging period information based on whether custom periods are used
        if (useCustomPeriods && customPeriodsCount > 0) {
          basicParams.push(['Hedging Periods', `${customPeriodsCount} custom period${customPeriodsCount > 1 ? 's' : ''}`, 'Number of custom hedging periods']);
        } else {
          basicParams.push(['Months to Hedge', report.params.monthsToHedge.toString(), 'Hedging period in months']);
        }
        
        basicParams.push(
          ['Interest Rate', `${report.params.interestRate}%`, 'Risk-free interest rate'],
          ['Commodity', commodityName, 'Trading commodity']
        );

        if (report.params.baseVolume && report.params.quoteVolume) {
          const baseName = report.params.commodity?.base || (report.params as any).currencyPair?.base || 'BASE';
          const quoteName = report.params.commodity?.quote || (report.params as any).currencyPair?.quote || 'QUOTE';
          basicParams.push(
            [`Base Volume (${baseName})`, formatVolume(report.params.baseVolume), 'Base commodity volume'],
            [`Quote Volume (${quoteName})`, formatVolume(Math.round(report.params.quoteVolume)), 'Quote commodity volume'],
            ['Spot Price', formatNumber(report.params.spotPrice || 0, 4), 'Current spot price']
          );
        } else {
          basicParams.push(
            ['Total Volume', formatVolume(report.params.totalVolume || 0), 'Total hedging volume'],
            ['Spot Price', formatNumber(report.params.spotPrice || 0, 2), 'Current spot price']
          );
        }

        pdf.autoTable({
          ...tableOptions,
          startY: yOffset,
          head: [basicParams[0]],
          body: basicParams.slice(1)
        });

        yOffset = (pdf as any).lastAutoTable.finalY + 10;

        // 3. Strategy Components
        if (report.strategy && report.strategy.length > 0) {
          checkPageBreak(40);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          pdf.text('3. STRATEGY COMPONENTS', contentPadding, yOffset);
          yOffset += 8;

          // Tableau récapitulatif des composants
          const strategyData = report.strategy.map((comp: any, index: number) => {
            const strikeValue = comp.strikeType === 'percent' 
              ? `${comp.strike}%` 
              : formatNumber(comp.strike, 2);
            
            const row = [
              `Component ${index + 1}`,
              comp.type.toUpperCase(),
              strikeValue,
              formatPercentage(comp.volatility || 0, 1),
              formatPercentage(comp.quantity || 0, 0)
            ];
            
            // Ajouter la première barrière
            if (comp.barrier !== undefined && comp.barrier !== null) {
              const barrierValue = comp.barrierType === 'percent'
                ? `${comp.barrier}%`
                : formatNumber(comp.barrier, 2);
              row.push(barrierValue);
            } else {
              row.push('N/A');
            }
            
            // Ajouter la deuxième barrière pour les options à double barrière
            if (comp.type && comp.type.includes('double') && comp.secondBarrier !== undefined && comp.secondBarrier !== null) {
              const secondBarrierValue = comp.barrierType === 'percent'
                ? `${comp.secondBarrier}%`
                : formatNumber(comp.secondBarrier, 2);
              row.push(secondBarrierValue);
            } else {
              row.push('N/A');
            }
            
            return row;
          });

          pdf.autoTable({
            ...tableOptions,
            startY: yOffset,
            head: [['Component', 'Type', 'Strike', 'Volatility', 'Quantity', 'Barrier', 'Second Barrier']],
            body: strategyData,
            styles: {
              overflow: 'hidden',
              cellPadding: 2,
              fontSize: 9
            },
            columnStyles: {
              0: { cellWidth: 28, fontStyle: 'bold', overflow: 'hidden' }, // Augmenté pour "Component 1", "Component 2"
              1: { cellWidth: 35, overflow: 'hidden' },
              2: { cellWidth: 25, halign: 'right' },
              3: { cellWidth: 20, halign: 'right' },
              4: { cellWidth: 20, halign: 'right' },
              5: { cellWidth: 25, halign: 'right' },
              6: { cellWidth: 25, halign: 'right' }
            }
          });

          yOffset = (pdf as any).lastAutoTable.finalY + 10;

          // Tableau détaillé par maturité
          if (report.results && report.results.length > 0) {
            checkPageBreak(30);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
            pdf.text('Strategy Components by Maturity', contentPadding, yOffset);
            yOffset += 6;

            // Préparer les données détaillées par maturité
            const detailedStrategyData: any[] = [];
            
            report.results.forEach((result: any) => {
              const date = new Date(result.date);
              const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
              const maturityDate = new Date(result.date).toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              });
              
              // Pour chaque composant de stratégie
              report.strategy.forEach((comp: any, compIndex: number) => {
                // Trouver l'option correspondante dans les résultats
                const optionPrice = result.optionPrices && result.optionPrices[compIndex] 
                  ? result.optionPrices[compIndex] 
                  : null;
                
                // Calculer le strike absolu (utiliser le strike dynamique si disponible)
                let absoluteStrike = comp.strikeType === 'percent'
                  ? report.params.spotPrice * (comp.strike / 100)
                  : comp.strike;
                
                // Si l'option a un strike dynamique calculé, l'utiliser
                if (optionPrice && optionPrice.dynamicStrikeInfo) {
                  absoluteStrike = optionPrice.dynamicStrikeInfo.calculatedStrike;
                } else if (optionPrice && optionPrice.strike) {
                  absoluteStrike = optionPrice.strike;
                }
                
                // Obtenir la volatilité effective (implied vol si disponible, sinon stratégie)
                let effectiveVol = comp.volatility;
                if (report.useImpliedVol && report.impliedVolatilities && report.impliedVolatilities[monthKey]) {
                  const monthIV = report.impliedVolatilities[monthKey];
                  // Vérifier si c'est un objet (nouveau format) ou un nombre (ancien format)
                  if (typeof monthIV === 'object' && monthIV !== null) {
                    const optionKey = `${comp.type}-${compIndex}`;
                    const impliedVol = (monthIV as any)[optionKey] || (monthIV as any).global;
                    if (impliedVol !== undefined && impliedVol !== null && !isNaN(impliedVol)) {
                      effectiveVol = impliedVol;
                    }
                  } else if (typeof monthIV === 'number') {
                    // Ancien format : valeur directe
                    effectiveVol = monthIV;
                  }
                }
                
                // Calculer les barrières absolues si présentes
                let absoluteBarrier = 'N/A';
                let absoluteSecondBarrier = 'N/A';
                
                if (comp.barrier !== undefined && comp.barrier !== null) {
                  absoluteBarrier = comp.barrierType === 'percent'
                    ? formatNumber(report.params.spotPrice * (comp.barrier / 100), 2)
                    : formatNumber(comp.barrier, 2);
                }
                
                if (comp.type && comp.type.includes('double') && comp.secondBarrier !== undefined && comp.secondBarrier !== null) {
                  absoluteSecondBarrier = comp.barrierType === 'percent'
                    ? formatNumber(report.params.spotPrice * (comp.secondBarrier / 100), 2)
                    : formatNumber(comp.secondBarrier, 2);
                }
                
                const row = [
                  maturityDate,
                  comp.type.toUpperCase(),
                  formatNumber(absoluteStrike, 2),
                  formatPercentage(effectiveVol, 1),
                  optionPrice ? formatNumber(optionPrice.price, 4) : 'N/A',
                  formatPercentage(comp.quantity || 0, 0),
                  absoluteBarrier,
                  absoluteSecondBarrier
                ];
                
                detailedStrategyData.push(row);
              });
            });

            pdf.autoTable({
              ...tableOptions,
              startY: yOffset,
              head: [['Maturity', 'Type', 'Strike', 'Vol (%)', 'Price', 'Quantity (%)', 'Barrier', '2nd Barrier']],
              body: detailedStrategyData,
              styles: {
                fontSize: 7,
                cellPadding: 1,
                overflow: 'hidden'
              },
              columnStyles: {
                0: { cellWidth: 25, fontStyle: 'bold' },
                1: { cellWidth: 40, overflow: 'hidden' }, // Augmenté pour afficher "PUT-KNOCKOUT" complet
                2: { cellWidth: 20, halign: 'right' },
                3: { cellWidth: 18, halign: 'right' },
                4: { cellWidth: 20, halign: 'right' },
                5: { cellWidth: 18, halign: 'right' },
                6: { cellWidth: 20, halign: 'right' },
                7: { cellWidth: 20, halign: 'right' }
              }
            });

            yOffset = (pdf as any).lastAutoTable.finalY + 10;
          }
        }

        // 4. Risk Analysis (Stress Test)
        if (report.stressTest) {
          checkPageBreak(30);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          pdf.text('4. RISK ANALYSIS', contentPadding, yOffset);
          yOffset += 8;

          const stressParams = [
            ['Parameter', 'Value'],
            ['Scenario Name', report.stressTest.name || 'Custom Scenario'],
            ['Volatility', `${(report.stressTest.volatility * 100).toFixed(1)}%`],
            ['Drift', `${(report.stressTest.drift * 100).toFixed(1)}%`],
            ['Price Shock', `${(report.stressTest.priceShock * 100).toFixed(1)}%`]
          ];

          if (report.stressTest.forwardBasis) {
            stressParams.push(['Forward Basis', `${(report.stressTest.forwardBasis * 100).toFixed(1)}%`]);
          }

          pdf.autoTable({
            ...tableOptions,
            startY: yOffset,
            head: [stressParams[0]],
            body: stressParams.slice(1),
            tableWidth: pageWidth / 2 - contentPadding
          });

          yOffset = (pdf as any).lastAutoTable.finalY + 10;
        }

        // 5. Detailed Results
        if (report.results && report.results.length > 0) {
          checkPageBreak(30);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          pdf.text('5. DETAILED RESULTS', contentPadding, yOffset);
          yOffset += 8;

          // Résultats par année
          const yearlyResults = calculateYearlyResults(report.results);
          const yearlyData = Object.entries(yearlyResults).map(([year, data]) => [
            year,
            formatVolume(data.volume),
            formatCurrency(data.strategyPremium),
            formatCurrency(data.hedgedCost),
            formatCurrency(data.unhedgedCost),
            formatCurrency(data.deltaPnL),
            formatPercentage((data.deltaPnL / Math.abs(data.unhedgedCost)) * 100)
          ]);

          pdf.autoTable({
            ...tableOptions,
            startY: yOffset,
            head: [['Year', 'Volume', 'Strategy Premium', 'Hedged Cost', 'Unhedged Cost', 'Delta P&L', 'Cost Reduction %']],
            body: yearlyData
          });

          yOffset = (pdf as any).lastAutoTable.finalY + 10;

          // Graphique P&L Evolution - Rendre avec React et capturer
          checkPageBreak(80);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text('P&L Evolution Chart', contentPadding, yOffset);
          yOffset += 6;

          try {
            // Créer un conteneur temporaire hors écran avec une taille plus grande
            const tempContainer = document.createElement('div');
            tempContainer.id = `temp-pnl-chart-${report.id}`;
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '0';
            tempContainer.style.width = '900px';
            tempContainer.style.height = '500px';
            tempContainer.style.backgroundColor = '#ffffff';
            tempContainer.style.padding = '20px';
            document.body.appendChild(tempContainer);

            // Préparer les données pour le graphique
            const pnlChartData = report.results.map((result: any) => ({
              date: new Date(result.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              deltaPnL: result.deltaPnL
            }));

            // Vérifier que nous avons des données
            if (!pnlChartData || pnlChartData.length === 0) {
              throw new Error('No P&L data available');
            }

            // Rendre le graphique P&L avec React
            const PnlChartComponent = () => (
              <div style={{ width: '100%', height: '100%', background: 'white' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>P&L Evolution Over Time</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#666' }}>Monthly Delta P&L Performance</p>
                <div style={{ width: '100%', height: '420px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pnlChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="deltaPnL" 
                        name="Delta P&L" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );

            const root = createRoot(tempContainer);
            root.render(<PnlChartComponent />);

            // Attendre que le graphique soit complètement rendu (augmenter le délai)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Vérifier que le graphique est rendu avant de capturer
            const chartElement = tempContainer.querySelector('.recharts-wrapper');
            if (!chartElement) {
              console.warn('Chart element not found, waiting longer...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Capturer avec html2canvas
            const renderOptions = {
              scale: 2,
              useCORS: true,
              logging: true, // Activer les logs pour déboguer
              backgroundColor: '#ffffff',
              allowTaint: true
            };
            
            console.log('Capturing P&L chart...');
            const canvas = await html2canvas(tempContainer, renderOptions);
            console.log('P&L chart captured, dimensions:', canvas.width, 'x', canvas.height);
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pageWidth - (2 * contentPadding);
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Vérifier que l'image n'est pas vide
            if (canvas.width > 0 && canvas.height > 0) {
              pdf.addImage(imgData, 'PNG', contentPadding, yOffset, imgWidth, imgHeight);
              yOffset += imgHeight + 10;
              console.log('P&L chart added to PDF');
            } else {
              throw new Error('Captured canvas is empty');
            }

            // Nettoyer
            root.unmount();
            document.body.removeChild(tempContainer);
          } catch (error) {
            console.error('Error generating P&L chart:', error);
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text('P&L Chart could not be generated', contentPadding, yOffset);
            yOffset += 10;
          }

          // Graphique Commodity Hedging Profile - Rendre avec React et capturer
          checkPageBreak(80);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text('Commodity Hedging Profile', contentPadding, yOffset);
          yOffset += 6;

          try {
            // Créer un conteneur temporaire hors écran
            const tempContainer = document.createElement('div');
            tempContainer.id = `temp-commodity-hedging-chart-${report.id}`;
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '0';
            tempContainer.style.width = '900px';
            tempContainer.style.height = '600px';
            tempContainer.style.backgroundColor = '#ffffff';
            document.body.appendChild(tempContainer);

            // Rendre le graphique PayoffChart avec React (onglet hedging actif)
            const HedgingChartComponent = () => (
              <ThemeProvider>
                <PayoffChart
                  data={report.payoffData || []}
                  strategy={report.strategy}
                  spot={report.params.spotPrice}
                  currencyPair={report.params.commodity || (report.params as any).currencyPair}
                  includePremium={false}
                  showPremiumToggle={false}
                  defaultTab="hedging"
                />
              </ThemeProvider>
            );

            const root = createRoot(tempContainer);
            root.render(<HedgingChartComponent />);

            // Attendre que le graphique soit rendu (plus de temps pour PayoffChart)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Capturer avec html2canvas
            const renderOptions = {
              scale: 1.8,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            };
            
            const canvas = await html2canvas(tempContainer, renderOptions);
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pageWidth - (2 * contentPadding);
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', contentPadding, yOffset, imgWidth, imgHeight);
            yOffset += imgHeight + 10;

            // Nettoyer
            root.unmount();
            document.body.removeChild(tempContainer);
          } catch (error) {
            console.warn('Could not generate Commodity Hedging chart:', error);
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text('Commodity Hedging Chart could not be generated', contentPadding, yOffset);
            yOffset += 10;
          }


          // Tableau détaillé (premiers 15 résultats)
          checkPageBreak(50);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text('Monthly Detailed Results (First 15 periods)', contentPadding, yOffset);
          yOffset += 6;

          const detailedData = report.results.slice(0, 15).map((result: any) => [
            new Date(result.date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }),
            formatVolume(result.monthlyVolume),
            formatNumber(result.strategyPrice, 4),
            formatCurrency(result.hedgedCost),
            formatCurrency(result.unhedgedCost),
            formatCurrency(result.deltaPnL)
          ]);

          pdf.autoTable({
            ...tableOptions,
            startY: yOffset,
            head: [['Date', 'Volume', 'Strategy Price', 'Hedged Cost', 'Unhedged Cost', 'Delta P&L']],
            body: detailedData,
            styles: { fontSize: 8 }
          });

          yOffset = (pdf as any).lastAutoTable.finalY + 10;
        }

        // 6. Yearly & Monthly Breakdown
        checkPageBreak(50);
        pdf.addPage();
        yOffset = contentPadding;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('6. YEARLY & MONTHLY BREAKDOWN', contentPadding, yOffset);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Monthly & Yearly P&L Breakdown', contentPadding, yOffset + 6);
        pdf.setTextColor(0);
        yOffset += 12;

        // Organiser les données par année et par mois
        const pnlByYearMonth: Record<string, Record<string, number>> = {};
        const yearTotals: Record<string, number> = {};
        const monthTotalsMap: Record<string, number> = {};
        let grandTotal = 0;
        const months: string[] = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        
        // Initialiser les totaux mensuels
        months.forEach(month => {
          monthTotalsMap[month] = 0;
        });
        
        // Collecter les données
        if (report.results && report.results.length > 0) {
          report.results.forEach((result: any) => {
            try {
              const date = new Date(result.date);
              const year = date.getFullYear().toString();
              const month = date.getMonth();
              const monthKey = months[month];
              
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
              monthTotalsMap[monthKey] += result.deltaPnL;
              grandTotal += result.deltaPnL;
            } catch (error) {
              console.error('Erreur lors du traitement de la date:', result.date, error);
            }
          });
        }
        
        // Convertir l'ensemble des années en tableau trié
        const sortedYears = Array.from(Object.keys(pnlByYearMonth)).sort();
        
        // Fonction pour formater les valeurs de P&L (sans espaces, format cohérent)
        const formatPnLForPdf = (value: number) => {
          if (value === 0) return '-';
          if (isNaN(value) || value === null || value === undefined) return '-';
          const sign = value < 0 ? '-' : '';
          const absValue = Math.abs(value);
          return `${sign}$${absValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
          })}`;
        };
        
        // Préparer les données pour le tableau
        const monthlyPnLData = sortedYears.map(year => {
          const rowData: any[] = [year];
          
          months.forEach(month => {
            const value = pnlByYearMonth[year][month] || 0;
            rowData.push(value === 0 ? '-' : formatPnLForPdf(value));
          });
          
          rowData.push(formatPnLForPdf(yearTotals[year])); // Total annuel
          return rowData;
        });
        
        // Ajouter une ligne de total pour chaque mois
        const monthlyTotalsRow = ['Total'];
        
        months.forEach((month) => {
          const monthTotal = monthTotalsMap[month];
          monthlyTotalsRow.push(monthTotal === 0 ? '-' : formatPnLForPdf(monthTotal));
        });
        
        monthlyTotalsRow.push(formatPnLForPdf(grandTotal)); // Total général
        monthlyPnLData.push(monthlyTotalsRow);
        
        const monthlyHeaders = ['Year'].concat(months).concat(['Total']);
        
        // Calculer les largeurs de colonnes pour un meilleur affichage
        const tableWidth = pageWidth - (2 * contentPadding);
        const yearColumnWidth = 15; // Réduit pour laisser plus d'espace aux colonnes numériques
        const totalColumnWidth = 22; // Augmenté pour le Total
        const availableWidth = tableWidth - yearColumnWidth - totalColumnWidth;
        const monthColumnWidth = availableWidth / 12; // 12 mois
        
        const columnStyles: any = {
          0: { fontStyle: 'bold', halign: 'left', cellWidth: yearColumnWidth, cellPadding: 1 }
        };
        
        // Largeurs pour les colonnes de mois (1-12) - alignées à droite, sans linebreak
        for (let i = 1; i <= 12; i++) {
          columnStyles[i] = { 
            halign: 'right', 
            cellWidth: monthColumnWidth, 
            fontSize: 6.5,
            cellPadding: 1,
            overflow: 'hidden' // Empêche le retour à la ligne
          };
        }
        
        // Largeur pour la colonne Total
        columnStyles[13] = { 
          fontStyle: 'bold', 
          halign: 'right', 
          cellWidth: totalColumnWidth,
          cellPadding: 1,
          overflow: 'hidden'
        };
        
        pdf.autoTable({
          ...tableOptions,
          startY: yOffset,
          head: [monthlyHeaders],
          body: monthlyPnLData,
          styles: { 
            overflow: 'hidden', // Pas de linebreak par défaut
            cellPadding: 1, // Padding réduit
            fontSize: 6.5 // Police légèrement réduite
          },
          columnStyles: columnStyles,
          didParseCell: function(data: any) {
            // Styles conditionnels pour les valeurs positives/négatives
            if (data.section === 'body' && data.column.index > 0 && data.column.index < 13) {
              const value = data.cell.raw;
              
              if (value === '-') return;
              
              try {
                // Extract numeric value from currency string (remove $, commas, spaces)
                const numValue = typeof value === 'string' 
                  ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
                  : value;
                
                if (!isNaN(numValue)) {
                  if (numValue > 0) {
                    data.cell.styles.fillColor = [230, 255, 230];
                  } else if (numValue < 0) {
                    data.cell.styles.fillColor = [255, 230, 230];
                  }
                }
              } catch (e) {
                console.error('Erreur lors du formatage de la cellule:', e);
              }
            }
            // Style pour la colonne Total
            if (data.section === 'body' && data.column.index === 13) {
              const value = data.cell.raw;
              if (value !== '-') {
                try {
                  const numValue = typeof value === 'string' 
                    ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
                    : value;
                  if (!isNaN(numValue)) {
                    if (numValue > 0) {
                      data.cell.styles.fillColor = [230, 255, 230];
                    } else if (numValue < 0) {
                      data.cell.styles.fillColor = [255, 230, 230];
                    }
                  }
                } catch (e) {
                  console.error('Erreur lors du formatage de la cellule Total:', e);
                }
              }
            }
          }
        });
        
        yOffset = (pdf as any).lastAutoTable.finalY + 10;

        // 7. Performance Metrics
        checkPageBreak(40);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('7. PERFORMANCE METRICS', contentPadding, yOffset);
        yOffset += 8;

        const totalHedgedCost = report.results?.reduce((sum: number, r: any) => sum + r.hedgedCost, 0) || 0;
        const totalUnhedgedCost = report.results?.reduce((sum: number, r: any) => sum + r.unhedgedCost, 0) || 0;
        const totalStrategyPremium = report.results?.reduce((sum: number, r: any) => sum + (r.strategyPrice * r.monthlyVolume), 0) || 0;
        const strikeTarget = totalVolume > 0 ? Math.abs(totalHedgedCost) / totalVolume : 0;

        const metricsData = [
          ['Metric', 'Value', 'Description'],
          ['Total Hedged Cost', formatCurrency(totalHedgedCost), 'Total cost with hedging strategy'],
          ['Total Unhedged Cost', formatCurrency(totalUnhedgedCost), 'Total cost without hedging'],
          ['Total P&L', formatCurrency(totalPnL), 'Net profit/loss from hedging'],
          ['Total Strategy Premium', formatCurrency(totalStrategyPremium), 'Total premium paid for strategy'],
          ['Strike Target', formatNumber(strikeTarget, 4), 'Effective strike rate achieved'],
          ['Cost Reduction %', formatPercentage(costReduction), 'Percentage cost reduction achieved']
        ];

        pdf.autoTable({
          ...tableOptions,
          startY: yOffset,
          head: [metricsData[0]],
          body: metricsData.slice(1)
        });

        yOffset = (pdf as any).lastAutoTable.finalY + 10;

        // 8. Summary Statistics
        checkPageBreak(30);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('8. SUMMARY STATISTICS', contentPadding, yOffset);
        yOffset += 8;

        const avgMonthlyVolume = totalVolume > 0 ? totalVolume / (report.results?.length || 1) : 0;
        const avgStrategyPrice = report.results?.length > 0 
          ? report.results.reduce((sum: number, r: any) => sum + r.strategyPrice, 0) / report.results.length 
          : 0;
        const bestMonthPnL = report.results?.length > 0 ? Math.max(...report.results.map((r: any) => r.deltaPnL)) : 0;
        const worstMonthPnL = report.results?.length > 0 ? Math.min(...report.results.map((r: any) => r.deltaPnL)) : 0;
        const pnlVolatility = report.results?.length > 1 
          ? calculateVolatility(report.results.map((r: any) => r.deltaPnL)) 
          : 0;

        const summaryData = [
          ['Statistic', 'Value'],
          ['Total Periods', (report.results?.length || 0).toString()],
          ['Average Monthly Volume', formatVolume(avgMonthlyVolume)],
          ['Average Strategy Price', formatNumber(avgStrategyPrice, 4)],
          ['Best Month P&L', formatCurrency(bestMonthPnL)],
          ['Worst Month P&L', formatCurrency(worstMonthPnL)],
          ['Volatility of P&L', formatCurrency(pnlVolatility)]
        ];

        pdf.autoTable({
          ...tableOptions,
          startY: yOffset,
          head: [summaryData[0]],
          body: summaryData.slice(1),
          tableWidth: pageWidth / 2 - contentPadding
        });

        // Footer professionnel sur toutes les pages
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          
          // Ligne de séparation
          pdf.setDrawColor(200, 200, 200);
          pdf.line(contentPadding, pageHeight - 10, pageWidth - contentPadding, pageHeight - 10);
          
          // Texte du pied de page
          pdf.setFontSize(8);
          pdf.setTextColor(100);
          const footerText = `${cleanTitle} | Page ${i} of ${totalPages} | ${BRAND.name}`;
          pdf.text(
            footerText, 
            pageWidth / 2, 
            pageHeight - 5, 
            { align: 'center' }
          );
        }

        pdf.save(`${report.name.replace(/[^a-z0-9]/gi, '_')}_professional_report.pdf`);
      };

      tempExport();
    } else if (report.type === 'risk-matrix') {
      // Export amélioré pour les matrices de risque
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      const contentPadding = 15;
      let yOffset = contentPadding;

      // En-tête
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pageWidth, 25, 'F');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255);
      pdf.setFontSize(16);
      pdf.text('RISK MATRIX ANALYSIS', contentPadding, 12);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Matrix: ${report.name}`, contentPadding, 18);
      
      yOffset = 35;

      // Informations générales
      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('MATRIX OVERVIEW', contentPadding, yOffset);
      yOffset += 10;

      const overviewData = [
        ['Parameter', 'Value'],
        ['Matrix Name', report.name],
        ['Number of Strategies', report.strategies?.length || 0],
        ['Number of Price Ranges', report.priceRanges?.length || 0],
        ['Created', new Date(report.timestamp).toLocaleString()]
      ];

      pdf.autoTable({
        startY: yOffset,
        head: [overviewData[0]],
        body: overviewData.slice(1),
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { fontSize: 10 },
        tableWidth: pageWidth / 2 - contentPadding
      });

      yOffset = (pdf as any).lastAutoTable.finalY + 10;

      // Détails des stratégies
      if (report.strategies && report.strategies.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('STRATEGIES ANALYZED', contentPadding, yOffset);
        yOffset += 6;

        const strategiesData = report.strategies.map((strategy: any, index: number) => [
          `Strategy ${index + 1}`,
          strategy.name || `Strategy ${index + 1}`,
          strategy.components?.length || 0,
          `${strategy.coverageRatio?.toFixed(2) || 'N/A'}%`
        ]);

        pdf.autoTable({
          startY: yOffset,
          head: [['ID', 'Name', 'Components', 'Coverage Ratio']],
          body: strategiesData,
          headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 }
        });
      }

      pdf.save(`${report.name.replace(/[^a-z0-9]/gi, '_')}_risk_matrix.pdf`);
    } else if (report.type === 'backtest') {
      // Export amélioré pour les backtests
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = pdf.internal.pageSize.width;
      const contentPadding = 15;
      let yOffset = contentPadding;

      // En-tête
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pageWidth, 25, 'F');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255);
      pdf.setFontSize(16);
      pdf.text('HISTORICAL BACKTEST REPORT', contentPadding, 12);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Backtest: ${report.name}`, contentPadding, 18);
      
      yOffset = 35;

      // Résumé du backtest
      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('BACKTEST SUMMARY', contentPadding, yOffset);
      yOffset += 10;

      const backtestData = [
        ['Parameter', 'Value'],
        ['Backtest Name', report.name],
        ['Type', report.type || 'Historical'],
        ['Historical Data Points', report.historicalData?.length || 0],
        ['Analysis Periods', report.results?.length || 0],
        ['Created', new Date(report.timestamp).toLocaleString()]
      ];

      pdf.autoTable({
        startY: yOffset,
        head: [backtestData[0]],
        body: backtestData.slice(1),
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { fontSize: 10 }
      });

      pdf.save(`${report.name.replace(/[^a-z0-9]/gi, '_')}_backtest_report.pdf`);
    }
  };

  // Fonction utilitaire pour calculer la volatilité
  const calculateVolatility = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  };


  return (
    <Layout 
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Reports" }
      ]}
    >
      {/* Header avec statistiques */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              View and manage all saved reports, scenarios, and analytics
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAllReports}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={importReports}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="import-reports"
              />
              <Button variant="outline" asChild>
                <label htmlFor="import-reports" className="cursor-pointer">
                  <Archive className="h-4 w-4 mr-2" />
                  Import
                </label>
              </Button>
            </div>
            {selectedReports.length > 0 && (
              <>
                <Button variant="outline" onClick={exportSelectedReports}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected ({selectedReports.length})
                </Button>
                <Button variant="outline" onClick={clearSelection}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </>
            )}
            <Button variant="destructive" onClick={clearAllReports}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scenarios</p>
                  <p className="text-2xl font-bold">{reportStats.totalScenarios}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Risk Matrices</p>
                  <p className="text-2xl font-bold">{reportStats.totalRiskMatrices}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Backtests</p>
                  <p className="text-2xl font-bold">{reportStats.totalBacktests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Size</p>
                  <p className="text-2xl font-bold">{formatFileSize(reportStats.totalSize)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-bold">{reportStats.lastUpdated.toLocaleTimeString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistiques détaillées */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Currency Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(reportStats.scenariosByCurrency).map(([currency, count]) => (
                  <div key={currency} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{currency}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
                {Object.keys(reportStats.scenariosByCurrency).length === 0 && (
                  <p className="text-sm text-muted-foreground">No scenarios found</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scenario Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(reportStats.scenariosByType).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{type}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
                {Object.keys(reportStats.scenariosByType).length === 0 && (
                  <p className="text-sm text-muted-foreground">No scenarios found</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Oldest Report</span>
                  <span className="text-sm">{reportStats.oldestReport.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Newest Report</span>
                  <span className="text-sm">{reportStats.newestReport.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Avg Size</span>
                  <span className="text-sm">{formatFileSize(reportStats.averageScenarioSize)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filtres et recherche */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Types</option>
                <option value="scenario">Scenarios</option>
                <option value="risk-matrix">Risk Matrices</option>
                <option value="backtest">Backtests</option>
              </select>

              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onglets principaux */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="risk-matrices">Risk Matrices</TabsTrigger>
          <TabsTrigger value="backtests">Backtests</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Reports</CardTitle>
              <CardDescription>
                Complete list of all saved reports and analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Checkbox
                  checked={selectedReports.length === filteredReports().length && filteredReports().length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selectAllReports();
                    } else {
                      clearSelection();
                    }
                  }}
                  id="select-all-reports"
                />
                <Label htmlFor="select-all-reports">Select All</Label>
                {selectedReports.length > 0 && (
                  <Badge variant="secondary">
                    {selectedReports.length} selected
                  </Badge>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedReports.length === filteredReports().length && filteredReports().length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllReports();
                          } else {
                            clearSelection();
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports().map((report) => (
                    <TableRow key={`${report.type}-${report.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReports.includes(`${report.type}-${report.id}`)}
                          onCheckedChange={() => toggleReportSelection(`${report.type}-${report.id}`)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getReportTypeIcon(report.type)}
                          {report.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getReportTypeColor(report.type)}>
                          {report.type.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(report.timestamp)}</TableCell>
                      <TableCell>{formatFileSize(JSON.stringify(report).length)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewReport(report)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportReport(report)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {report.type === 'scenario' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadScenario(report as SavedScenario)}
                              title="Load this scenario in Strategy Builder"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteReport(report)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scénarios */}
        <TabsContent value="scenarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Scenarios</CardTitle>
              <CardDescription>
                Strategy scenarios with detailed calculations and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {savedScenarios.length === 0 ? (
                <div className="p-6 text-center">
                  <p>No saved scenarios found.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <ScenariosPdfExport
                    scenarios={savedScenarios}
                    selectedScenarios={selectedReports.filter(id => id.includes('scenario-'))}
                    setSelectedScenarios={(ids) => setSelectedReports(ids)}
                  />
                  {savedScenarios.map(scenario => (
                    <Card key={scenario.id} className="mb-6">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>{scenario.name}</CardTitle>
                          <p className="text-sm text-gray-500">{formatDate(scenario.timestamp)}</p>
                          <p className="text-sm font-medium mt-1">Type: {getScenarioTypeName(scenario)}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => exportToPdf({ ...scenario, type: 'scenario' })}
                            className="flex items-center gap-2"
                          >
                            <Download size={16} /> Export PDF
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => deleteReport({ ...scenario, type: 'scenario' })}
                            className="flex items-center gap-2"
                          >
                            <Trash2 size={16} /> Delete
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <h3 className="font-semibold mb-2">Basic Parameters</h3>
                            <ul className="space-y-1">
                              <li>Start Date: {scenario.params.startDate}</li>
                              <li>Months to Hedge: {scenario.params.monthsToHedge}</li>
                              <li>Interest Rate: {scenario.params.interestRate}%</li>
                              {scenario.params.baseVolume && scenario.params.quoteVolume ? (
                                <>
                                  <li>Base Volume ({scenario.params.commodity?.base || (scenario.params as any).currencyPair?.base || 'BASE'}): {scenario.params.baseVolume.toLocaleString()}</li>
                                  <li>Quote Volume ({scenario.params.commodity?.quote || (scenario.params as any).currencyPair?.quote || 'QUOTE'}): {Math.round(scenario.params.quoteVolume).toLocaleString()}</li>
                                  <li>Rate: {scenario.params.spotPrice?.toFixed(4)}</li>
                                </>
                              ) : (
                                <>
                                  <li>Total Volume: {scenario.params.totalVolume?.toLocaleString()}</li>
                                  <li>Spot Price: {scenario.params.spotPrice}</li>
                                </>
                              )}
                            </ul>
                          </div>
                          {scenario.stressTest && (
                            <div>
                              <h3 className="font-semibold mb-2">Stress Test Parameters</h3>
                              <ul className="space-y-1">
                                <li>Volatility: {(scenario.stressTest.volatility * 100).toFixed(1)}%</li>
                                <li>Drift: {(scenario.stressTest.drift * 100).toFixed(1)}%</li>
                                <li>Price Shock: {(scenario.stressTest.priceShock * 100).toFixed(1)}%</li>
                                {scenario.stressTest.forwardBasis && (
                                  <li>Forward Basis: {(scenario.stressTest.forwardBasis * 100).toFixed(1)}%</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="mb-6">
                          <Button
                            variant="outline"
                            onClick={() => toggleSection(scenario.id, 'strategy')}
                            className="flex items-center gap-2 mb-2"
                          >
                            {expandedSections[scenario.id]?.strategy ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            Strategy Components
                          </Button>
                          
                          {expandedSections[scenario.id]?.strategy && (
                            <div className="mt-2">
                              {scenario.strategy.map((option, index) => (
                                <div key={index} className="grid grid-cols-5 gap-4 p-2 border-b">
                                  <div>Type: {option.type}</div>
                                  <div>Strike: {option.strike} ({option.strikeType})</div>
                                  <div>Volatility: {option.volatility}%</div>
                                  <div>Quantity: {option.quantity}%</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-6">
                          <div className="h-64" id={`pnl-chart-${scenario.id}`}>
                            <h3 className="font-semibold mb-2">P&L Evolution</h3>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={scenario.results}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="deltaPnL" name="Delta P&L" stroke="#8884d8" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="mb-8" id={`commodity-hedging-chart-${scenario.id}`}>
                            <PayoffChart
                              data={scenario.payoffData || []}
                              strategy={scenario.strategy}
                              spot={scenario.params.spotPrice}
                              currencyPair={scenario.params.commodity || (scenario.params as any).currencyPair}
                              includePremium={false}
                              showPremiumToggle={false}
                              defaultTab="hedging"
                            />
                          </div>
                        </div>

                        <div className="mt-6 relative z-10">
                          <Button
                            variant="outline"
                            onClick={() => toggleSection(scenario.id, 'detailedResults')}
                            className="flex items-center gap-2 mb-2 relative z-10"
                          >
                            {expandedSections[scenario.id]?.detailedResults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            Detailed Results
                          </Button>
                          
                          {expandedSections[scenario.id]?.detailedResults && (
                            <div className="overflow-x-auto">
                              <table className="min-w-full border-collapse">
                                <thead>
                                  <tr>
                                    <th className="border p-2">Maturity</th>
                                    <th className="border p-2">Time to Maturity</th>
                                    <th className="border p-2">Forward Price</th>
                                    <th className="border p-2">Real Price</th>
                                    {/* Afficher les colonnes IV individuelles si useImpliedVol est activé */}
                                    {scenario.useImpliedVol && scenario.results[0]?.optionPrices?.map((option, idx) => (
                                      option.type !== 'swap' && option.type !== 'forward' && (
                                        <th key={`iv-${idx}`} className="border p-2 bg-amber-500/5">
                                          IV {option.label} (%)
                                        </th>
                                      )
                                    ))}
                                    {/* Colonne IV globale si useImpliedVol n'est pas activé ou s'il n'y a pas d'options */}
                                    {(!scenario.useImpliedVol || !scenario.results[0]?.optionPrices || scenario.results[0].optionPrices.length === 0) && (
                                      <th className="border p-2">IV (%)</th>
                                    )}
                                    {scenario.results[0]?.optionPrices?.map((option, idx) => (
                                      <th key={idx} className="border p-2">{option.label || `${option.type.charAt(0).toUpperCase() + option.type.slice(1)} Price ${idx + 1}`}</th>
                                    ))}
                                    <th className="border p-2">Strategy Price</th>
                                    <th className="border p-2">Payoff</th>
                                    <th className="border p-2">Volume</th>
                                    <th className="border p-2">Hedged Cost</th>
                                    <th className="border p-2">Unhedged Cost</th>
                                    <th className="border p-2">Delta P&L</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scenario.results.map((row, i) => {
                                    // Récupération de la volatilité implicite pour cette date
                                    const date = new Date(row.date);
                                    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                                    let impliedVol = null;
                                    
                                    // 1. Vérifier si l'utilisateur a entré des valeurs manuelles d'IV
                                    if (scenario.useImpliedVol && scenario.impliedVolatilities && scenario.impliedVolatilities[monthKey]) {
                                      const monthIV = scenario.impliedVolatilities[monthKey];
                                      // Vérifier si c'est un objet (nouveau format) ou un nombre (ancien format)
                                      if (typeof monthIV === 'object' && monthIV !== null) {
                                        // Essayer d'abord la volatilité globale du mois
                                        if ((monthIV as any).global !== undefined) {
                                          impliedVol = (monthIV as any).global;
                                        }
                                        // Sinon, utiliser la volatilité de la première option si disponible
                                        else if (row.optionPrices && row.optionPrices.length > 0) {
                                          const firstOption = row.optionPrices[0];
                                          const optionKey = `${firstOption.type}-0`;
                                          if ((monthIV as any)[optionKey] !== undefined) {
                                            impliedVol = (monthIV as any)[optionKey];
                                          }
                                        }
                                      } else if (typeof monthIV === 'number') {
                                        // Ancien format : valeur directe
                                        impliedVol = monthIV;
                                      }
                                    }
                                    // 2. Utiliser la volatilité de la stratégie comme dernier recours
                                    if (impliedVol === null && scenario.strategy && scenario.strategy.length > 0) {
                                      impliedVol = scenario.strategy[0].volatility / 100;
                                    }
                                    
                                    return (
                                      <tr key={i}>
                                        <td className="border p-2">{row.date}</td>
                                        <td className="border p-2">{row.timeToMaturity.toFixed(4)}</td>
                                        <td className="border p-2">{row.forward.toFixed(4)}</td>
                                        <td className="border p-2">{row.realPrice.toFixed(4)}</td>
                                        {/* Afficher les IV individuelles pour chaque option si useImpliedVol est activé */}
                                        {scenario.useImpliedVol && row.optionPrices && row.optionPrices.map((option, idx) => {
                                          if (option.type === 'swap' || option.type === 'forward') return null;
                                          const optionKey = `${option.type}-${idx}`;
                                          const monthIV = scenario.impliedVolatilities?.[monthKey];
                                          let optionIV = null;
                                          if (typeof monthIV === 'object' && monthIV !== null) {
                                            optionIV = (monthIV as any)[optionKey] || (monthIV as any).global;
                                          } else if (typeof monthIV === 'number') {
                                            optionIV = monthIV;
                                          }
                                          if (optionIV === null || optionIV === undefined) {
                                            optionIV = scenario.strategy && scenario.strategy.length > 0 ? scenario.strategy[0].volatility : null;
                                          }
                                          return (
                                            <td key={`iv-${idx}`} className="border p-2 bg-amber-500/5">
                                              {optionIV !== null && optionIV !== undefined 
                                                ? (typeof optionIV === 'number' ? optionIV : parseFloat(optionIV)).toFixed(1)
                                                : ""}
                                            </td>
                                          );
                                        })}
                                        {/* Colonne IV globale si useImpliedVol n'est pas activé */}
                                        {(!scenario.useImpliedVol || !row.optionPrices || row.optionPrices.length === 0) && (
                                          <td className="border p-2">
                                            {impliedVol !== null 
                                              ? (typeof impliedVol === 'number' ? impliedVol : parseFloat(impliedVol)).toFixed(1)
                                              : (scenario.strategy && scenario.strategy.length > 0 
                                                  ? scenario.strategy[0].volatility.toFixed(1) 
                                                  : "")}
                                          </td>
                                        )}
                                        {/* S'assurer que toutes les options sont affichées */}
                                        {row.optionPrices && Array.isArray(row.optionPrices) 
                                          ? row.optionPrices.map((option, idx) => (
                                              <td key={idx} className="border p-2">{option.price.toFixed(2)}</td>
                                            ))
                                          : scenario.strategy.map((_, idx) => (
                                              <td key={idx} className="border p-2">-</td>
                                            ))
                                        }
                                        <td className="border p-2">{row.strategyPrice.toFixed(2)}</td>
                                        <td className="border p-2">{row.totalPayoff.toFixed(2)}</td>
                                        <td className="border p-2">{row.monthlyVolume.toFixed(0)}</td>
                                        <td className="border p-2">{row.hedgedCost.toFixed(2)}</td>
                                        <td className="border p-2">{row.unhedgedCost.toFixed(2)}</td>
                                        <td className="border p-2">{row.deltaPnL.toFixed(2)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <Button
                            variant="outline"
                            onClick={() => toggleSection(scenario.id, 'yearlyStats')}
                            className="flex items-center gap-2 mb-2"
                          >
                            {expandedSections[scenario.id]?.yearlyStats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            Summary Statistics by Year
                          </Button>
                          
                          {expandedSections[scenario.id]?.yearlyStats && (
                            <div className="overflow-x-auto">
                              <table className="min-w-full border-collapse">
                                <thead>
                                  <tr>
                                    <th className="border p-2">Year</th>
                                    <th className="border p-2">Volume</th>
                                    <th className="border p-2">Strategy Premium</th>
                                    <th className="border p-2">Hedged Cost</th>
                                    <th className="border p-2">Unhedged Cost</th>
                                    <th className="border p-2">Delta P&L</th>
                                    <th className="border p-2">Cost Reduction (%)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(calculateYearlyResults(scenario.results)).map(([year, data]) => (
                                    <tr key={year}>
                                      <td className="border p-2">{year}</td>
                                      <td className="border p-2">{data.volume.toLocaleString()}</td>
                                      <td className="border p-2">{data.strategyPremium.toFixed(2)}</td>
                                      <td className="border p-2">{data.hedgedCost.toFixed(2)}</td>
                                      <td className="border p-2">{data.unhedgedCost.toFixed(2)}</td>
                                      <td className="border p-2">{data.deltaPnL.toFixed(2)}</td>
                                      <td className="border p-2">
                                        {((data.deltaPnL / Math.abs(data.unhedgedCost)) * 100).toFixed(2)}%
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <Button
                            variant="outline"
                            onClick={() => toggleSection(scenario.id, 'totalStats')}
                            className="flex items-center gap-2 mb-2"
                          >
                            {expandedSections[scenario.id]?.totalStats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            Total Summary Statistics
                          </Button>
                          
                          {expandedSections[scenario.id]?.totalStats && (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <tbody>
                                  <tr>
                                    <td className="border p-2 font-medium">Total Cost with Hedging</td>
                                    <td className="border p-2 text-right">
                                      {scenario.results.reduce((sum, row) => sum + row.hedgedCost, 0).toFixed(2)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="border p-2 font-medium">Total Cost without Hedging</td>
                                    <td className="border p-2 text-right">
                                      {scenario.results.reduce((sum, row) => sum + row.unhedgedCost, 0).toFixed(2)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="border p-2 font-medium">Total P&L</td>
                                    <td className="border p-2 text-right">
                                      {scenario.results.reduce((sum, row) => sum + row.deltaPnL, 0).toFixed(2)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="border p-2 font-medium">Total Strategy Premium</td>
                                    <td className="border p-2 text-right">
                                      {scenario.results.reduce((sum, row) => sum + (row.strategyPrice * row.monthlyVolume), 0).toFixed(2)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="border p-2 font-medium">Cost Reduction (%)</td>
                                    <td className="border p-2 text-right">
                                      {(() => {
                                        const totalPnL = scenario.results.reduce((sum, row) => sum + row.deltaPnL, 0);
                                        const totalUnhedgedCost = scenario.results.reduce((sum, row) => sum + row.unhedgedCost, 0);
                                        return ((totalPnL / Math.abs(totalUnhedgedCost)) * 100).toFixed(2);
                                      })()}%
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="border p-2 font-medium">Strike Target</td>
                                    <td className="border p-2 text-right">
                                      {(() => {
                                        const totalHedgedCost = scenario.results.reduce((sum, row) => sum + row.hedgedCost, 0);
                                        const totalVolume = scenario.results.reduce((sum, row) => sum + row.monthlyVolume, 0);
                                        return totalVolume > 0 
                                          ? Number(Math.abs(totalHedgedCost) / totalVolume).toFixed(2)
                                          : 'N/A';
                                      })()}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <Button
                            variant="outline"
                            onClick={() => toggleSection(scenario.id, 'monthlyPnL')}
                            className="flex items-center gap-2 mb-2"
                          >
                            {expandedSections[scenario.id]?.monthlyPnL ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            Monthly & Yearly P&L Breakdown
                          </Button>
                          
                          {expandedSections[scenario.id]?.monthlyPnL && (
                            <div className="overflow-x-auto">
                              {(() => {
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
                                scenario.results.forEach(result => {
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
                                  if (value > 0) return 'bg-green-100';
                                  if (value < 0) return 'bg-red-100';
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
                                      <tr className="bg-gray-100">
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
                                      <tr className="bg-gray-50">
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
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matrices de risque */}
        <TabsContent value="risk-matrices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Matrices</CardTitle>
              <CardDescription>
                Risk analysis matrices with multiple strategy comparisons
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Strategies</TableHead>
                    <TableHead>Price Ranges</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedRiskMatrices.map((matrix) => (
                    <TableRow key={matrix.id}>
                      <TableCell className="font-medium">{matrix.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {matrix.strategies.length} strategies
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {matrix.priceRanges.length} ranges
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(matrix.timestamp)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewReport({ ...matrix, type: 'risk-matrix' })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportReport(matrix)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backtests */}
        <TabsContent value="backtests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historical Backtests</CardTitle>
              <CardDescription>
                Historical data analysis and backtesting results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedBacktests.map((backtest) => (
                    <TableRow key={backtest.id}>
                      <TableCell className="font-medium">{backtest.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {backtest.historicalData?.length || backtest.results?.length || 0} points
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {backtest.params?.monthsToHedge || 'N/A'} months
                      </TableCell>
                      <TableCell>{formatDate(backtest.timestamp)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewReport({ ...backtest, type: 'backtest' })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportReport(backtest)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogues */}
      
      {/* Dialogue de visualisation */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReport?.name} - {selectedReport?.type?.replace('-', ' ')}
            </DialogTitle>
            <DialogDescription>
              Detailed view of the selected report
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{formatDate(selectedReport.timestamp)}</p>
                </div>
                <div>
                  <Label>Type</Label>
                  <Badge className={getReportTypeColor(selectedReport.type)}>
                    {selectedReport.type.replace('-', ' ')}
                  </Badge>
                </div>
              </div>

              {selectedReport.type === 'scenario' && (
                <div className="space-y-4">
                  <div>
                    <Label>Strategy Components</Label>
                    <div className="text-sm">
                      {selectedReport.strategy?.length || 0} components
                    </div>
                  </div>
                  <div>
                    <Label>Parameters</Label>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(selectedReport.params, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedReport.type === 'risk-matrix' && (
                <div className="space-y-4">
                  <div>
                    <Label>Strategies</Label>
                    <div className="text-sm">
                      {selectedReport.strategies?.length || 0} strategies analyzed
                    </div>
                  </div>
                  <div>
                    <Label>Price Ranges</Label>
                    <div className="text-sm">
                      {selectedReport.priceRanges?.length || 0} price ranges
                    </div>
                  </div>
                </div>
              )}

              {selectedReport.type === 'backtest' && (
                <div className="space-y-4">
                  <div>
                    <Label>Historical Data</Label>
                    <div className="text-sm">
                      {selectedReport.historicalData?.length || 0} data points
                    </div>
                  </div>
                  <div>
                    <Label>Results</Label>
                    <div className="text-sm">
                      {selectedReport.results?.length || 0} periods analyzed
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => exportReport(selectedReport)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de suppression */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedReport?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Reports; 
