/**
 * Commodity Data Service
 * 
 * Service de gestion des données pour le risque de commodités
 * Remplace FinancialDataService (FX) par une version commodity-centric
 */

import {
  CommodityMarketData,
  CommodityExposureData,
  CommodityHedgingInstrument,
  CommodityRiskMetrics,
  CommodityExposure,
  CostOfCarryParams
} from '@/types/Commodity';

import {
  calculateBlack76Price,
  calculateCostOfCarry,
  calculateCommodityForwardPrice,
  calculateVanillaGreeks
} from './PricingService';

class CommodityDataService {
  private marketData: CommodityMarketData;
  private exposures: CommodityExposureData[] = [];
  private instruments: CommodityHedgingInstrument[] = [];

  constructor() {
    this.marketData = this.initializeMarketData();
  }

  /**
   * Initialise les données de marché avec des valeurs réalistes
   */
  private initializeMarketData(): CommodityMarketData {
    return {
      spotPrices: {
        // Energy
        'WTI': 75.50,           // WTI Crude Oil ($/barrel)
        'BRENT': 78.20,         // Brent Crude ($/barrel)
        'NATGAS': 2.65,         // Natural Gas ($/MMBtu)
        'HEATING': 2.45,        // Heating Oil ($/gallon)
        'GASOLINE': 2.35,       // RBOB Gasoline ($/gallon)
        
        // Precious Metals
        'GOLD': 1850.25,        // Gold ($/troy oz)
        'SILVER': 23.45,        // Silver ($/troy oz)
        'PLATINUM': 925.00,     // Platinum ($/troy oz)
        'PALLADIUM': 1050.00,   // Palladium ($/troy oz)
        
        // Base Metals
        'COPPER': 3.85,         // Copper ($/lb)
        'ALUMINUM': 2250.00,    // Aluminum ($/metric ton)
        'ZINC': 2450.00,        // Zinc ($/metric ton)
        'NICKEL': 16500.00,     // Nickel ($/metric ton)
        'LEAD': 2100.00,        // Lead ($/metric ton)
        
        // Agriculture - Grains
        'CORN': 4.85,           // Corn ($/bushel)
        'WHEAT': 6.25,          // Wheat ($/bushel)
        'SOYBEANS': 13.50,      // Soybeans ($/bushel)
        
        // Agriculture - Softs
        'COFFEE': 1.85,         // Coffee ($/lb)
        'SUGAR': 0.18,          // Sugar ($/lb)
        'COTTON': 0.82,         // Cotton ($/lb)
        'COCOA': 3250.00,       // Cocoa ($/metric ton)
        
        // Livestock
        'CATTLE': 165.00,       // Live Cattle ($/cwt)
        'HOGS': 75.50           // Lean Hogs ($/cwt)
      },
      
      volatilities: {
        // Energy - Haute volatilité
        'WTI': 0.35,            // 35%
        'BRENT': 0.33,          // 33%
        'NATGAS': 0.55,         // 55% - Très volatile
        'HEATING': 0.38,        // 38%
        'GASOLINE': 0.40,       // 40%
        
        // Precious Metals - Volatilité moyenne
        'GOLD': 0.15,           // 15%
        'SILVER': 0.25,         // 25%
        'PLATINUM': 0.20,       // 20%
        'PALLADIUM': 0.35,      // 35%
        
        // Base Metals - Volatilité moyenne à haute
        'COPPER': 0.25,         // 25%
        'ALUMINUM': 0.22,       // 22%
        'ZINC': 0.28,           // 28%
        'NICKEL': 0.42,         // 42% - Très volatile
        'LEAD': 0.26,           // 26%
        
        // Agriculture - Volatilité saisonnière
        'CORN': 0.28,           // 28%
        'WHEAT': 0.32,          // 32%
        'SOYBEANS': 0.26,       // 26%
        'COFFEE': 0.35,         // 35%
        'SUGAR': 0.30,          // 30%
        'COTTON': 0.25,         // 25%
        'COCOA': 0.28,          // 28%
        
        // Livestock
        'CATTLE': 0.18,         // 18%
        'HOGS': 0.30            // 30%
      },
      
      riskFreeRate: 0.0475,   // 4.75% (SOFR / US Treasury)
      
      storageCosts: {
        // Energy - Coûts élevés
        'WTI': 0.05,            // 5% annuel
        'BRENT': 0.05,
        'NATGAS': 0.08,         // 8% - Storage coûteux
        'HEATING': 0.04,
        'GASOLINE': 0.04,
        
        // Precious Metals - Faibles coûts
        'GOLD': 0.005,          // 0.5%
        'SILVER': 0.01,         // 1%
        'PLATINUM': 0.008,
        'PALLADIUM': 0.01,
        
        // Base Metals - Coûts moyens
        'COPPER': 0.02,         // 2%
        'ALUMINUM': 0.025,
        'ZINC': 0.025,
        'NICKEL': 0.03,
        'LEAD': 0.025,
        
        // Agriculture - Coûts élevés (périssable)
        'CORN': 0.06,           // 6%
        'WHEAT': 0.06,
        'SOYBEANS': 0.06,
        'COFFEE': 0.08,
        'SUGAR': 0.07,
        'COTTON': 0.05,
        'COCOA': 0.07,
        
        // Livestock - Très élevés (vivant)
        'CATTLE': 0.12,         // 12%
        'HOGS': 0.15            // 15%
      },
      
      convenienceYields: {
        // Energy - Yields élevés (détenir le physique a de la valeur)
        'WTI': 0.02,            // 2%
        'BRENT': 0.02,
        'NATGAS': 0.05,         // 5% - Haute convenience
        'HEATING': 0.015,
        'GASOLINE': 0.015,
        
        // Precious Metals - Faibles yields
        'GOLD': 0.005,          // 0.5%
        'SILVER': 0.008,
        'PLATINUM': 0.01,
        'PALLADIUM': 0.015,
        
        // Base Metals - Yields moyens
        'COPPER': 0.015,        // 1.5%
        'ALUMINUM': 0.012,
        'ZINC': 0.012,
        'NICKEL': 0.02,
        'LEAD': 0.01,
        
        // Agriculture - Yields saisonniers
        'CORN': 0.03,           // 3%
        'WHEAT': 0.03,
        'SOYBEANS': 0.025,
        'COFFEE': 0.04,
        'SUGAR': 0.035,
        'COTTON': 0.025,
        'COCOA': 0.03,
        
        // Livestock - Yields élevés
        'CATTLE': 0.08,         // 8%
        'HOGS': 0.10            // 10%
      },
      
      costOfCarry: {},        // Sera calculé dynamiquement
      
      forwardCurve: {
        'WTI': {
          '1M': 76.20,
          '3M': 77.50,
          '6M': 79.00,
          '12M': 81.50
        },
        'GOLD': {
          '1M': 1852.00,
          '3M': 1855.50,
          '6M': 1860.00,
          '12M': 1868.00
        },
        'COPPER': {
          '1M': 3.87,
          '3M': 3.90,
          '6M': 3.95,
          '12M': 4.05
        }
      },
      
      contangoBackwardation: {
        'WTI': 0.70,            // +0.70% (Contango)
        'BRENT': 0.65,          // +0.65% (Contango)
        'NATGAS': -2.5,         // -2.5% (Backwardation)
        'GOLD': 0.15,           // +0.15% (Slight contango)
        'COPPER': 0.50,         // +0.50% (Contango)
        'CORN': -1.2,           // -1.2% (Backwardation - harvest)
      },
      
      lastUpdated: new Date()
    };
  }

  /**
   * Calcule les métriques de risque
   */
  calculateRiskMetrics(): CommodityRiskMetrics {
    const totalExposure = this.exposures.reduce((sum, exp) => sum + Math.abs(exp.totalValue), 0);
    const hedgedAmount = this.exposures.reduce((sum, exp) => sum + Math.abs(exp.hedgedQuantity * exp.pricePerUnit), 0);
    const unhedgedRisk = totalExposure - hedgedAmount;
    const hedgeRatio = totalExposure > 0 ? (hedgedAmount / totalExposure) * 100 : 0;
    
    // Calculate VaR
    const var95 = this.calculateVaR(0.95);
    const var99 = this.calculateVaR(0.99);
    
    // Calculate Expected Shortfall
    const expectedShortfall95 = this.calculateExpectedShortfall(var95, 0.95);
    const expectedShortfall99 = this.calculateExpectedShortfall(var99, 0.99);
    
    // Calculate MTM impact
    const mtmImpact = this.instruments.reduce((sum, inst) => sum + inst.mtm, 0);
    
    // Commodity-specific metrics
    const totalVolume = this.exposures.reduce((sum, exp) => sum + Math.abs(exp.quantity), 0);
    const averagePrice = totalExposure / (totalVolume || 1);
    const priceRisk = unhedgedRisk;

    return {
      var95,
      var99,
      expectedShortfall95,
      expectedShortfall99,
      totalExposure,
      hedgedAmount,
      unhedgedRisk,
      hedgeRatio,
      mtmImpact,
      totalVolume,
      averagePrice,
      priceRisk
    };
  }

  /**
   * Calcule le VaR paramétrique
   */
  private calculateVaR(confidenceLevel: number): number {
    const zScore = confidenceLevel === 0.95 ? 1.645 : 2.326;
    
    let portfolioVariance = 0;
    const commodityExposures = this.getCommodityExposures();
    
    // Calcul de la variance du portefeuille avec corrélations
    commodityExposures.forEach((exp1, i) => {
      commodityExposures.forEach((exp2, j) => {
        const vol1 = this.getVolatility(exp1.commodity);
        const vol2 = this.getVolatility(exp2.commodity);
        const correlation = this.getCorrelation(exp1.commodity, exp2.commodity);
        
        portfolioVariance += exp1.totalValue * exp2.totalValue * vol1 * vol2 * correlation;
      });
    });
    
    const portfolioStdDev = Math.sqrt(Math.abs(portfolioVariance));
    return zScore * portfolioStdDev * Math.sqrt(1/252); // 1-day VaR
  }

  /**
   * Calcule l'Expected Shortfall (CVaR)
   */
  private calculateExpectedShortfall(valueAtRisk: number, confidenceLevel: number): number {
    const alpha = 1 - confidenceLevel;
    const zScore = confidenceLevel === 0.95 ? 1.645 : 2.326;
    
    // PDF normale au z-score
    const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * zScore * zScore);
    
    return valueAtRisk * (phi / alpha);
  }

  /**
   * Obtient les expositions par commodity agrégées
   */
  getCommodityExposures(): CommodityExposure[] {
    const commodityMap = new Map<string, {
      grossExposure: number;
      netExposure: number;
      hedgedAmount: number;
      totalValue: number;
      longPositions: number;
      shortPositions: number;
      commodityName: string;
      unit: string;
    }>();

    // Agréger les expositions par commodity
    this.exposures.forEach(exp => {
      const existing = commodityMap.get(exp.commodity) || {
        grossExposure: 0,
        netExposure: 0,
        hedgedAmount: 0,
        totalValue: 0,
        longPositions: 0,
        shortPositions: 0,
        commodityName: exp.commodityName,
        unit: exp.unit
      };

      existing.grossExposure += Math.abs(exp.quantity);
      existing.hedgedAmount += Math.abs(exp.hedgedQuantity);
      existing.totalValue += Math.abs(exp.totalValue);
      
      if (exp.type === 'long') {
        existing.longPositions += exp.quantity;
        existing.netExposure += exp.quantity;
      } else {
        existing.shortPositions += Math.abs(exp.quantity);
        existing.netExposure -= Math.abs(exp.quantity);
      }

      commodityMap.set(exp.commodity, existing);
    });

    // Convertir en array et calculer les métriques additionnelles
    return Array.from(commodityMap.entries()).map(([commodity, data]) => {
      const hedgeRatio = data.grossExposure > 0 ? (data.hedgedAmount / data.grossExposure) * 100 : 0;
      const volatility = this.getVolatility(commodity);
      const var95 = Math.abs(data.totalValue) * volatility * 1.645 * Math.sqrt(1/252);
      const averagePrice = data.totalValue / (data.grossExposure || 1);
      
      // Déterminer la tendance
      const trend = this.determineTrend(commodity);
      
      // Déterminer contango/backwardation
      const contangoBack = this.marketData.contangoBackwardation[commodity] || 0;
      const contangoBackwardation = contangoBack > 0.5 ? 'contango' : 
                                     contangoBack < -0.5 ? 'backwardation' : 'neutral';

      return {
        commodity,
        commodityName: data.commodityName,
        category: this.getCommodityCategory(commodity),
        unit: data.unit as any,
        grossExposure: data.grossExposure,
        netExposure: data.netExposure,
        hedgedAmount: data.hedgedAmount,
        hedgeRatio,
        var95,
        averagePrice,
        totalValue: data.totalValue,
        trend,
        contangoBackwardation
      };
    });
  }

  /**
   * Calcule le prix forward d'une commodity
   */
  calculateForwardPrice(commodity: string, tenor: string): number {
    const spotPrice = this.marketData.spotPrices[commodity];
    if (!spotPrice) return 0;

    const r = this.marketData.riskFreeRate;
    const storage = this.marketData.storageCosts[commodity] || 0;
    const convenience = this.marketData.convenienceYields[commodity] || 0;
    const b = r + storage - convenience;
    
    const timeToMaturity = this.tenorToYears(tenor);
    
    return calculateCommodityForwardPrice(spotPrice, b, timeToMaturity);
  }

  /**
   * Calcule le prix d'une option
   */
  calculateOptionPrice(
    optionType: 'call' | 'put',
    commodity: string,
    strike: number,
    timeToMaturity: number,
    volatility?: number
  ): number {
    const spotPrice = this.marketData.spotPrices[commodity];
    if (!spotPrice) return 0;

    const r = this.marketData.riskFreeRate;
    const storage = this.marketData.storageCosts[commodity] || 0;
    const convenience = this.marketData.convenienceYields[commodity] || 0;
    const b = r + storage - convenience;
    const vol = volatility || this.marketData.volatilities[commodity] || 0.3;

    return calculateBlack76Price(optionType, spotPrice, strike, r, b, timeToMaturity, vol);
  }

  /**
   * Calcule le MTM d'un instrument
   */
  calculateMTM(instrument: CommodityHedgingInstrument): number {
    const currentSpot = this.marketData.spotPrices[instrument.commodity];
    if (!currentSpot) return 0;

    const timeToMaturity = (instrument.maturity.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000);
    
    const r = this.marketData.riskFreeRate;
    const storage = this.marketData.storageCosts[instrument.commodity] || 0;
    const convenience = this.marketData.convenienceYields[instrument.commodity] || 0;
    const b = r + storage - convenience;
    
    switch (instrument.type) {
      case 'forward':
        const forwardPrice = calculateCommodityForwardPrice(currentSpot, b, timeToMaturity);
        return instrument.notional * (currentSpot - (instrument.strike || 0)) * Math.exp(-r * timeToMaturity);
      
      case 'vanilla-call':
      case 'vanilla-put':
        const vol = this.marketData.volatilities[instrument.commodity] || 0.3;
        const optionValue = calculateBlack76Price(
          instrument.type.replace('vanilla-', '') as 'call' | 'put',
          currentSpot,
          instrument.strike || 0,
          r,
          b,
          timeToMaturity,
          vol
        );
        return instrument.notional * optionValue - (instrument.premium || 0);
      
      default:
        return 0;
    }
  }

  /**
   * Met à jour les données de marché (simulation)
   */
  updateMarketData(): void {
    Object.keys(this.marketData.spotPrices).forEach(commodity => {
      const volatility = this.marketData.volatilities[commodity] || 0.3;
      const randomShock = (Math.random() - 0.5) * 2 * volatility * 0.01;
      this.marketData.spotPrices[commodity] *= (1 + randomShock);
    });
    
    this.marketData.lastUpdated = new Date();
    
    // Recalculer MTM pour tous les instruments
    this.instruments.forEach(instrument => {
      instrument.mtm = this.calculateMTM(instrument);
    });
  }

  // ===== CRUD OPERATIONS =====

  addExposure(exposure: Omit<CommodityExposureData, 'id'>): void {
    const newExposure: CommodityExposureData = {
      ...exposure,
      id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    this.exposures.push(newExposure);
  }

  updateExposure(id: string, updates: Partial<Omit<CommodityExposureData, 'id'>>): boolean {
    const index = this.exposures.findIndex(exp => exp.id === id);
    if (index === -1) return false;
    
    this.exposures[index] = { ...this.exposures[index], ...updates };
    return true;
  }

  deleteExposure(id: string): boolean {
    const index = this.exposures.findIndex(exp => exp.id === id);
    if (index === -1) return false;
    
    this.exposures.splice(index, 1);
    return true;
  }

  addInstrument(instrument: Omit<CommodityHedgingInstrument, 'id' | 'mtm'>): void {
    const newInstrument: CommodityHedgingInstrument = {
      ...instrument,
      id: `HDG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mtm: 0
    };
    newInstrument.mtm = this.calculateMTM(newInstrument);
    this.instruments.push(newInstrument);
  }

  updateInstrument(id: string, updates: Partial<Omit<CommodityHedgingInstrument, 'id'>>): boolean {
    const index = this.instruments.findIndex(inst => inst.id === id);
    if (index === -1) return false;
    
    this.instruments[index] = { ...this.instruments[index], ...updates };
    this.instruments[index].mtm = this.calculateMTM(this.instruments[index]);
    return true;
  }

  deleteInstrument(id: string): boolean {
    const index = this.instruments.findIndex(inst => inst.id === id);
    if (index === -1) return false;
    
    this.instruments.splice(index, 1);
    return true;
  }

  // ===== HELPER METHODS =====

  getExposures(): CommodityExposureData[] {
    return [...this.exposures];
  }

  getInstruments(): CommodityHedgingInstrument[] {
    return [...this.instruments];
  }

  getMarketData(): CommodityMarketData {
    return { ...this.marketData };
  }

  clearAllData(): void {
    this.exposures = [];
    this.instruments = [];
  }

  clearInstruments(): void {
    this.instruments = [];
  }

  /** Clear only exposures (e.g. before reloading from storage to avoid duplication). */
  clearExposures(): void {
    this.exposures = [];
  }

  /** Replace all exposures (e.g. when loading from storage, preserves ids). */
  setExposures(exposures: CommodityExposureData[]): void {
    this.exposures = exposures.map(exp => ({
      ...exp,
      maturity: exp.maturity instanceof Date ? exp.maturity : new Date(exp.maturity)
    }));
  }

  private getVolatility(commodity: string): number {
    return this.marketData.volatilities[commodity] || 0.3;
  }

  private getCorrelation(commodity1: string, commodity2: string): number {
    if (commodity1 === commodity2) return 1.0;
    
    // Matrice de corrélation professionnelle pour commodities
    const correlations: { [key: string]: number } = {
      // Energy correlations
      'WTI-BRENT': 0.95,
      'WTI-NATGAS': 0.35,
      'WTI-GASOLINE': 0.85,
      'BRENT-GASOLINE': 0.82,
      
      // Precious metals correlations
      'GOLD-SILVER': 0.75,
      'GOLD-PLATINUM': 0.65,
      'SILVER-PLATINUM': 0.70,
      
      // Base metals correlations
      'COPPER-ALUMINUM': 0.80,
      'COPPER-ZINC': 0.75,
      'COPPER-NICKEL': 0.70,
      
      // Agriculture correlations
      'CORN-WHEAT': 0.65,
      'CORN-SOYBEANS': 0.70,
      'WHEAT-SOYBEANS': 0.60,
      
      // Cross-category correlations
      'WTI-GOLD': -0.15,        // Inverse faible
      'WTI-COPPER': 0.40,       // Cycle économique
      'GOLD-COPPER': 0.15,
      'COPPER-CORN': 0.25,
    };
    
    const pair1 = [commodity1, commodity2].sort().join('-');
    const pair2 = [commodity2, commodity1].sort().join('-');
    
    return correlations[pair1] || correlations[pair2] || 0.25; // Défaut: corrélation faible positive
  }

  private determineTrend(commodity: string): 'up' | 'down' | 'stable' {
    const volatility = this.getVolatility(commodity);
    const contango = this.marketData.contangoBackwardation[commodity] || 0;
    
    if (contango > 1.0) return 'up';
    if (contango < -1.0) return 'down';
    return 'stable';
  }

  private getCommodityCategory(commodity: string): any {
    const energySymbols = ['WTI', 'BRENT', 'NATGAS', 'HEATING', 'GASOLINE'];
    const metalsSymbols = ['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'COPPER', 'ALUMINUM', 'ZINC', 'NICKEL', 'LEAD'];
    const agricultureSymbols = ['CORN', 'WHEAT', 'SOYBEANS', 'COFFEE', 'SUGAR', 'COTTON', 'COCOA'];
    const livestockSymbols = ['CATTLE', 'HOGS'];
    
    if (energySymbols.includes(commodity)) return 'energy';
    if (metalsSymbols.includes(commodity)) return 'metals';
    if (agricultureSymbols.includes(commodity)) return 'agriculture';
    if (livestockSymbols.includes(commodity)) return 'livestock';
    
    return 'energy'; // Défaut
  }

  private tenorToYears(tenor: string): number {
    const match = tenor.match(/(\d+)([DWMY])/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'D': return value / 365.25;
      case 'W': return value / 52.18;
      case 'M': return value / 12;
      case 'Y': return value;
      default: return 0;
    }
  }

  /**
   * Génère des scénarios de stress pour les commodities
   */
  generateStressScenarios(): Array<{
    name: string;
    description: string;
    shocks: { [commodity: string]: number };
    impact: number;
  }> {
    const scenarios = [];
    const commodityExposures = this.getCommodityExposures();
    
    // Scénario 1: Choc pétrolier (+30% WTI, +25% BRENT)
    const oilShock: { [commodity: string]: number } = {};
    const oilImpact = commodityExposures
      .filter(exp => exp.commodity === 'WTI' || exp.commodity === 'BRENT')
      .reduce((sum, exp) => {
        const shock = exp.commodity === 'WTI' ? 0.30 : 0.25;
        oilShock[exp.commodity] = shock;
        return sum + Math.abs(exp.totalValue) * shock;
      }, 0);
    
    if (Object.keys(oilShock).length > 0) {
      scenarios.push({
        name: 'Oil Price Shock',
        description: 'Significant increase in crude oil prices due to supply disruption',
        shocks: oilShock,
        impact: oilImpact
      });
    }

    // Scénario 2: Choc métaux précieux (+20% GOLD, +15% SILVER)
    const metalsShock: { [commodity: string]: number } = {};
    const metalsImpact = commodityExposures
      .filter(exp => exp.commodity === 'GOLD' || exp.commodity === 'SILVER')
      .reduce((sum, exp) => {
        const shock = exp.commodity === 'GOLD' ? 0.20 : 0.15;
        metalsShock[exp.commodity] = shock;
        return sum + Math.abs(exp.totalValue) * shock;
      }, 0);
    
    if (Object.keys(metalsShock).length > 0) {
      scenarios.push({
        name: 'Precious Metals Rally',
        description: 'Flight to safety driving up precious metals prices',
        shocks: metalsShock,
        impact: metalsImpact
      });
    }

    // Scénario 3: Choc agricole (-15% CORN, -10% WHEAT)
    const agriShock: { [commodity: string]: number } = {};
    const agriImpact = commodityExposures
      .filter(exp => exp.commodity === 'CORN' || exp.commodity === 'WHEAT' || exp.commodity === 'SOYBEAN')
      .reduce((sum, exp) => {
        const shock = exp.commodity === 'CORN' ? -0.15 : exp.commodity === 'WHEAT' ? -0.10 : -0.12;
        agriShock[exp.commodity] = shock;
        return sum + Math.abs(exp.totalValue) * Math.abs(shock);
      }, 0);
    
    if (Object.keys(agriShock).length > 0) {
      scenarios.push({
        name: 'Agricultural Price Decline',
        description: 'Bumper harvest leading to oversupply and price decline',
        shocks: agriShock,
        impact: agriImpact
      });
    }

    // Scénario 4: Choc généralisé (toutes les commodities +10%)
    const generalShock: { [commodity: string]: number } = {};
    const generalImpact = commodityExposures.reduce((sum, exp) => {
      generalShock[exp.commodity] = 0.10;
      return sum + Math.abs(exp.totalValue) * 0.10;
    }, 0);
    
    if (commodityExposures.length > 0) {
      scenarios.push({
        name: 'Broad Commodity Rally',
        description: 'General increase in commodity prices across all categories',
        shocks: generalShock,
        impact: generalImpact
      });
    }

    return scenarios;
  }

  /**
   * Calcule les contributions au VaR par commodity
   */
  calculateVarContributions(): { [commodity: string]: number } {
    const contributions: { [commodity: string]: number } = {};
    const commodityExposures = this.getCommodityExposures();
    const totalVaR = this.calculateRiskMetrics().var95;
    
    if (totalVaR === 0) return contributions;

    // Calculer la contribution de chaque commodity au VaR total
    commodityExposures.forEach(exp => {
      const commodityVaR = exp.var95;
      const contribution = totalVaR > 0 ? (commodityVaR / totalVaR) * 100 : 0;
      contributions[exp.commodity] = contribution;
    });

    return contributions;
  }
}

export default CommodityDataService;

