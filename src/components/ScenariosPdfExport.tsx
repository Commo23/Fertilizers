import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SavedScenario } from '../types/Scenario';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { BRAND } from '@/constants/branding';

interface Props {
  scenarios: SavedScenario[];
  selectedScenarios: string[];
  setSelectedScenarios: (ids: string[]) => void;
}

const ScenariosPdfExport = ({ scenarios, selectedScenarios, setSelectedScenarios }: Props) => {
  const toggleScenario = (id: string) => {
    setSelectedScenarios(
      selectedScenarios.includes(id)
        ? selectedScenarios.filter(s => s !== id)
        : [...selectedScenarios, id]
    );
  };

  const toggleAll = () => {
    setSelectedScenarios(
      selectedScenarios.length === scenarios.length
        ? []
        : scenarios.map(s => s.id)
    );
  };

      // Helper function to format numbers with proper thousands separators
      const formatNumber = (value: number, decimals: number = 2): string => {
        if (isNaN(value) || value === null || value === undefined) return 'N/A';
        const absValue = Math.abs(value);
        return absValue.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          useGrouping: true
        });
      };

      // Helper function to format currency values
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

      // Helper function to format percentage
      const formatPercentage = (value: number, decimals: number = 2): string => {
        if (isNaN(value) || value === null || value === undefined) return 'N/A';
        return `${value.toFixed(decimals)}%`;
      };
      
      // Helper function to format large numbers (volumes)
      const formatVolume = (value: number): string => {
        if (isNaN(value) || value === null || value === undefined) return 'N/A';
        return value.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true
        });
      };

  const exportToPdf = async () => {
    // Attendre que les graphiques soient rendus
    const waitForCharts = () => {
      return new Promise((resolve) => {
        setTimeout(resolve, 2000); // Attendre 2 secondes pour le rendu des graphiques
      });
    };

    await waitForCharts();
    
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      compress: true
    });

    // Filter selected scenarios
    const scenariosToExport = scenarios.filter(s => selectedScenarios.includes(s.id));
    
    const contentPadding = 15; // Marge améliorée
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    let yOffset = contentPadding;
    
      // Options générales pour les tableaux - améliorées
      const tableOptions = {
        headStyles: { 
          fillColor: [30, 64, 175], // Blue-600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 9
        },
        bodyStyles: {
          minCellWidth: 8,
          cellPadding: 2,
          fontSize: 8
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Light gray
        },
        margin: { 
          left: contentPadding,
          right: contentPadding,
          top: 3,
          bottom: 3
        },
        tableWidth: 'auto',
        styles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        }
      };

    for (const scenario of scenariosToExport) {
      // Start a new page for each scenario
      if (scenario !== scenariosToExport[0]) {
        pdf.addPage();
        yOffset = contentPadding;
      }

      // Professional header with better styling
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
      const reportId = scenario.id || `RPT-${Date.now()}`;
      // Simplify ID: take first 8 characters if it's a UUID, otherwise use first 8 chars
      const shortId = reportId.length > 8 ? reportId.substring(0, 8).toUpperCase() : reportId.toUpperCase();
      const generatedDate = new Date(scenario.timestamp).toLocaleString('en-US', {
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
      
      // Separator line
      pdf.setDrawColor(200, 200, 200);
      pdf.line(contentPadding, 28, pageWidth - contentPadding, 28);
      
      yOffset = 38; // Space after header
      
      // Title section with better styling
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0);
      pdf.setFontSize(20);
      const cleanTitle = scenario.name.replace(/[^\w\s-]/g, ' ').trim();
      pdf.text(cleanTitle, contentPadding, yOffset, { maxWidth: pageWidth - 2 * contentPadding });
      yOffset += 10;
      
      // Scenario type badge with better styling
      const scenarioType = scenario.stressTest?.name || 'Base Calculation';
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      pdf.text(`Scenario Type: ${scenarioType}`, contentPadding, yOffset);
      yOffset += 6;
      
      // Commodity information (handle both commodity and currencyPair for backward compatibility)
      const commodityName = scenario.params.commodity?.symbol || 
                           scenario.params.commodity?.base || 
                           (scenario.params as any).currencyPair?.symbol || 
                           (scenario.params as any).currencyPair?.base || 
                           'N/A';
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Commodity: ${commodityName}`, contentPadding, yOffset);
      yOffset += 8;

      // Table of Contents
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('TABLE OF CONTENTS', contentPadding, yOffset);
      yOffset += 8;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const tocItems = [
        '1. Executive Summary',
        '2. Strategy Parameters',
        '3. Strategy Components',
        '4. Risk Analysis',
        '5. Performance Analysis',
        '6. Yearly & Monthly Breakdown',
        '7. Detailed Results',
        '8. Summary Statistics'
      ];
      
      tocItems.forEach((item, index) => {
        pdf.text(item, contentPadding + 5, yOffset);
        const dotLine = '.'.repeat(60);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150);
        pdf.text(dotLine, contentPadding + 5, yOffset);
        pdf.setTextColor(0);
        pdf.text(`${index + 1}`, pageWidth - contentPadding - 5, yOffset, { align: 'right' });
        yOffset += 5;
      });
      
      yOffset += 5;
      
      // Check if we need a new page
      if (yOffset > pageHeight - 50) {
        pdf.addPage();
        yOffset = contentPadding;
      }
      
      // Calculate all statistics upfront for use throughout the document
      const totalPnL = scenario.results.reduce((sum, row) => sum + row.deltaPnL, 0);
      const totalUnhedgedCost = scenario.results.reduce((sum, row) => sum + row.unhedgedCost, 0);
      const totalHedgedCost = scenario.results.reduce((sum, row) => sum + row.hedgedCost, 0);
      const totalVolume = scenario.results.reduce((sum, row) => sum + row.monthlyVolume, 0);
      const totalStrategyPremium = scenario.results.reduce(
        (sum, row) => sum + (row.strategyPrice * row.monthlyVolume), 0
      );
      const costReduction = totalUnhedgedCost !== 0 ? ((totalPnL / Math.abs(totalUnhedgedCost)) * 100) : 0;
      const avgMonthlyVolume = scenario.results.length > 0 ? totalVolume / scenario.results.length : 0;
      const avgStrategyPrice = scenario.results.length > 0
        ? scenario.results.reduce((sum, row) => sum + row.strategyPrice, 0) / scenario.results.length
        : 0;
      const pnlValues = scenario.results.map(row => row.deltaPnL);
      const bestMonthPnL = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
      const worstMonthPnL = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;
      const pnlMean = pnlValues.length > 0 ? totalPnL / pnlValues.length : 0;
      const pnlVariance = pnlValues.length > 0
        ? pnlValues.reduce((sum, val) => sum + Math.pow(val - pnlMean, 2), 0) / pnlValues.length
        : 0;
      const pnlVolatility = Math.sqrt(pnlVariance);
      const strikeTarget = totalVolume > 0 ? (totalHedgedCost / totalVolume) : 0;
      
      // 1. EXECUTIVE SUMMARY
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('1. EXECUTIVE SUMMARY', contentPadding, yOffset);
      yOffset += 8;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      // Check if custom periods are used
      const useCustomPeriods = scenario.params.useCustomPeriods || false;
      const customPeriodsCount = scenario.params.customPeriods?.length || 0;
      
      const strategyCoverageText = useCustomPeriods && customPeriodsCount > 0
        ? `The strategy uses ${customPeriodsCount} custom hedging period${customPeriodsCount > 1 ? 's' : ''} with a total volume of ${formatVolume(totalVolume)} units.`
        : `The strategy covers ${scenario.params.monthsToHedge} months with a total volume of ${formatVolume(totalVolume)} units.`;
      
      const summaryText = [
        `This report presents a comprehensive analysis of the "${scenario.name}" commodity hedging strategy.`,
        strategyCoverageText,
        '',
        'Key Performance Metrics:',
        '',
        `• Total P&L: ${formatCurrency(totalPnL)}`,
        `• Average Hedged Cost: ${formatCurrency(totalHedgedCost / (scenario.results.length || 1))}`,
        `• Average Unhedged Cost: ${formatCurrency(totalUnhedgedCost / (scenario.results.length || 1))}`,
        `• Cost Reduction: ${formatPercentage(costReduction)}`,
        `• Strategy Components: ${scenario.strategy.length} instrument${scenario.strategy.length > 1 ? 's' : ''}`,
        `• Commodity: ${commodityName}`
      ];
      
      summaryText.forEach(line => {
        if (yOffset > pageHeight - 20) {
          pdf.addPage();
          yOffset = contentPadding;
        }
        pdf.text(line, contentPadding, yOffset);
        yOffset += 5;
      });
      
      yOffset += 5;
      
      // Check if we need a new page
      if (yOffset > pageHeight - 50) {
        pdf.addPage();
        yOffset = contentPadding;
      }
      
      // 2. STRATEGY PARAMETERS
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('2. STRATEGY PARAMETERS', contentPadding, yOffset);
      yOffset += 8;
      
      const halfWidth = (pageWidth - (3 * contentPadding)) / 2;
      
      // Tableau des paramètres de base (colonne de gauche) - reuse variables already declared above
      const basicParams = [
        ['Parameter', 'Value'],
        ['Start Date', scenario.params.startDate || 'N/A']
      ];
      
      // Add hedging period information based on whether custom periods are used
      if (useCustomPeriods && customPeriodsCount > 0) {
        basicParams.push(['Hedging Periods', `${customPeriodsCount} custom period${customPeriodsCount > 1 ? 's' : ''}`]);
      } else {
        basicParams.push(['Months to Hedge', scenario.params.monthsToHedge?.toString() || 'N/A']);
      }
      
      basicParams.push(
        ['Interest Rate', `${scenario.params.interestRate || 0}%`],
        ['Commodity', commodityName]
      );

      // Add volume information based on what's available
      if (scenario.params.baseVolume && scenario.params.quoteVolume) {
        const baseName = scenario.params.commodity?.base || (scenario.params as any).currencyPair?.base || 'BASE';
        const quoteName = scenario.params.commodity?.quote || (scenario.params as any).currencyPair?.quote || 'QUOTE';
        basicParams.push(
          [`Base Volume (${baseName})`, formatVolume(scenario.params.baseVolume)],
          [`Quote Volume (${quoteName})`, formatVolume(Math.round(scenario.params.quoteVolume))],
          ['Spot Price', formatNumber(scenario.params.spotPrice || 0, 4)]
        );
      } else {
        basicParams.push(
          ['Total Volume', formatVolume(scenario.params.totalVolume || 0)],
          ['Spot Price', formatNumber(scenario.params.spotPrice || 0, 2)]
        );
      }

      (pdf as any).autoTable({
        ...tableOptions,
        startY: yOffset,
        head: [basicParams[0]],
        body: basicParams.slice(1),
        margin: { left: contentPadding, top: 1, bottom: 1 },
        tableWidth: halfWidth,
        styles: { fontSize: 8 } // Police plus petite
      });

      // Tableau des paramètres de stress test (colonne de droite) si disponible
      if (scenario.stressTest) {
        const stressParams = [
          ['Parameter', 'Value'],
          ['Scenario Name', scenario.stressTest.name || 'N/A'],
          ['Volatility', formatPercentage(scenario.stressTest.volatility * 100, 1)],
          ['Drift', formatPercentage(scenario.stressTest.drift * 100, 1)],
          ['Price Shock', formatPercentage(scenario.stressTest.priceShock * 100, 1)]
        ];

        if (scenario.stressTest.forwardBasis !== undefined) {
          stressParams.push(['Forward Basis', formatPercentage(scenario.stressTest.forwardBasis * 100, 2)]);
        }
        
        if (scenario.stressTest.realBasis !== undefined) {
          stressParams.push(['Real Basis', formatPercentage(scenario.stressTest.realBasis * 100, 2)]);
        }

        (pdf as any).autoTable({
          ...tableOptions,
          startY: yOffset,
          head: [stressParams[0]],
          body: stressParams.slice(1),
          margin: { left: contentPadding * 2 + halfWidth, top: 1, bottom: 1 },
          tableWidth: halfWidth,
          styles: { fontSize: 8 }
        });
      }
      
      // Récupérer le nouvel offset Y après les tableaux
      const finalY = Math.max(
        (pdf as any).lastAutoTable.finalY,
        (pdf as any).autoTable.previous?.finalY || 0
      );
      yOffset = finalY + 8; // Espace après les paramètres
      
      // Check if we need a new page
      if (yOffset > pageHeight - 50) {
        pdf.addPage();
        yOffset = contentPadding;
      }
      
      // 3. STRATEGY COMPONENTS
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('3. STRATEGY COMPONENTS', contentPadding, yOffset);
      yOffset += 8;

      const strategyData = scenario.strategy.map((opt, index) => {
        const spotPrice = scenario.params.spotPrice || 1;
        const strikeValue = opt.strikeType === 'percent' 
          ? `${opt.strike}%` 
          : formatNumber(opt.strike, 2);
        
        const row = [
          `Component ${index + 1}`,
          opt.type.toUpperCase(),
          strikeValue,
          formatPercentage(opt.volatility || 0, 1),
          formatPercentage(opt.quantity || 0, 0)
        ];
        
        // Ajouter les informations de barrière si présentes
        if (opt.barrier !== undefined && opt.barrier !== null) {
          const barrierValue = opt.barrierType === 'percent'
            ? `${opt.barrier}%`
            : formatNumber(opt.barrier, 2);
          row.push(barrierValue);
        } else {
          row.push('N/A');
        }
        
        // Ajouter la deuxième barrière pour les options à double barrière
        if (opt.type.includes('double') && opt.secondBarrier !== undefined && opt.secondBarrier !== null) {
          const secondBarrierValue = opt.barrierType === 'percent'
            ? `${opt.secondBarrier}%`
            : formatNumber(opt.secondBarrier, 2);
          row.push(secondBarrierValue);
        } else {
          row.push('N/A');
        }
        
        return row;
      });

      (pdf as any).autoTable({
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
      
      yOffset = (pdf as any).lastAutoTable.finalY + 8;

      // Tableau détaillé par maturité
      if (scenario.results && scenario.results.length > 0) {
        // Check if we need a new page
        if (yOffset > pageHeight - 50) {
          pdf.addPage();
          yOffset = contentPadding;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Strategy Components by Maturity', contentPadding, yOffset);
        yOffset += 6;

        // Préparer les données détaillées par maturité
        const detailedStrategyData: any[] = [];
        
        scenario.results.forEach((result: any) => {
          const date = new Date(result.date);
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          const maturityDate = new Date(result.date).toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          });
          
          // Pour chaque composant de stratégie
          scenario.strategy.forEach((comp: any, compIndex: number) => {
            // Trouver l'option correspondante dans les résultats
            const optionPrice = result.optionPrices && result.optionPrices[compIndex] 
              ? result.optionPrices[compIndex] 
              : null;
            
            // Calculer le strike absolu (utiliser le strike dynamique si disponible)
            let absoluteStrike = comp.strikeType === 'percent'
              ? (scenario.params.spotPrice || 1) * (comp.strike / 100)
              : comp.strike;
            
            // Si l'option a un strike dynamique calculé, l'utiliser
            if (optionPrice && optionPrice.dynamicStrikeInfo) {
              absoluteStrike = optionPrice.dynamicStrikeInfo.calculatedStrike;
            } else if (optionPrice && optionPrice.strike) {
              absoluteStrike = optionPrice.strike;
            }
            
            // Obtenir la volatilité effective (implied vol si disponible, sinon stratégie)
            let effectiveVol = comp.volatility;
            if (scenario.useImpliedVol && scenario.impliedVolatilities && scenario.impliedVolatilities[monthKey]) {
              const monthIV = scenario.impliedVolatilities[monthKey];
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
                ? formatNumber((scenario.params.spotPrice || 1) * (comp.barrier / 100), 2)
                : formatNumber(comp.barrier, 2);
            }
            
            if (comp.type && comp.type.includes('double') && comp.secondBarrier !== undefined && comp.secondBarrier !== null) {
              absoluteSecondBarrier = comp.barrierType === 'percent'
                ? formatNumber((scenario.params.spotPrice || 1) * (comp.secondBarrier / 100), 2)
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

        (pdf as any).autoTable({
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

        yOffset = (pdf as any).lastAutoTable.finalY + 8;
      }
      
      // Check if we need a new page
      if (yOffset > pageHeight - 50) {
        pdf.addPage();
        yOffset = contentPadding;
      }
      
      // 4. RISK ANALYSIS
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('4. RISK ANALYSIS', contentPadding, yOffset);
      yOffset += 8;
      
      // Risk metrics
      const riskMetrics = [
        ['Risk Metric', 'Value'],
        ['Total Exposure', formatCurrency(totalVolume * (scenario.params.spotPrice || 0))],
        ['Average Monthly Exposure', formatCurrency(avgMonthlyVolume * (scenario.params.spotPrice || 0))],
        ['Maximum Drawdown', formatCurrency(worstMonthPnL)],
        ['P&L Volatility', formatNumber(pnlVolatility, 2)],
        ['Hedge Effectiveness', formatPercentage((1 - Math.abs(totalPnL / totalUnhedgedCost)) * 100, 2)]
      ];
      
      (pdf as any).autoTable({
        ...tableOptions,
        startY: yOffset,
        head: [riskMetrics[0]],
        body: riskMetrics.slice(1),
        styles: { 
          fontSize: 9,
          cellPadding: 2
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold',
            cellWidth: 60
          },
          1: { 
            halign: 'right',
            cellWidth: 'auto'
          }
        },
        tableWidth: 'auto'
      });
      
      yOffset = (pdf as any).lastAutoTable.finalY + 8;
      
      // Check if we need a new page for charts
      if (yOffset > pageHeight - 80) {
        pdf.addPage();
        yOffset = contentPadding;
      }
      
      // 5. PERFORMANCE ANALYSIS (Charts)
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('5. PERFORMANCE ANALYSIS', contentPadding, yOffset);
      yOffset += 6;

      // Calculer les dimensions des graphiques - plus compacts
      const usableWidth = pageWidth - (2 * contentPadding);
      const aspectRatio = 2.2; // Ratio plus allongé pour économiser l'espace vertical
      const chartHeight = usableWidth / aspectRatio;
      
      try {
        // Graphique P&L Evolution
        const chartElement = document.getElementById(`pnl-chart-${scenario.id}`);
        if (chartElement) {
          console.log(`Found P&L element for scenario ${scenario.id}`);
          const renderOptions = {
            scale: 1.8, // Réduire légèrement la résolution
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          };
          
          try {
            const canvas = await html2canvas(chartElement, renderOptions);
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', contentPadding, yOffset, usableWidth, chartHeight);
            yOffset += chartHeight + 3; // Espace très réduit entre les graphiques
            console.log(`Successfully rendered P&L chart for scenario ${scenario.id}`);
          } catch (chartError) {
            console.error(`Error rendering P&L chart for scenario ${scenario.id}:`, chartError);
            pdf.setFontSize(8);
            pdf.text('Error rendering P&L chart', contentPadding, yOffset);
            yOffset += 10;
          }
        } else {
          console.warn(`P&L element not found for scenario ${scenario.id}`);
          pdf.setFontSize(8);
          pdf.text('P&L chart not available', contentPadding, yOffset);
          yOffset += 10;
        }
        
        // Vérifier si on a besoin d'une nouvelle page pour le graphique Commodity Hedging
        if (yOffset > pdf.internal.pageSize.height - chartHeight - 15) {
          pdf.addPage();
          yOffset = contentPadding;
          
           pdf.setFontSize(12);
           pdf.setFont('helvetica', 'bold');
           pdf.text('Commodity Hedging Profile', contentPadding, yOffset);
           yOffset += 6;
        }
        
        // Graphique Commodity Hedging Profile (au lieu du Payoff Diagram)
        const commodityHedgingElement = document.getElementById(`commodity-hedging-chart-${scenario.id}`);
        if (commodityHedgingElement) {
          console.log(`Found commodity hedging element for scenario ${scenario.id}`);
          const renderOptions = {
            scale: 1.8,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          };
          
          try {
            const canvas = await html2canvas(commodityHedgingElement, renderOptions);
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', contentPadding, yOffset, usableWidth, chartHeight);
            yOffset += chartHeight + 6;
            console.log(`Successfully rendered commodity hedging chart for scenario ${scenario.id}`);
          } catch (chartError) {
            console.error(`Error rendering commodity hedging chart for scenario ${scenario.id}:`, chartError);
            pdf.setFontSize(8);
            pdf.text('Error rendering commodity hedging chart', contentPadding, yOffset);
            yOffset += 10;
          }
        } else {
          console.warn(`Commodity hedging element not found for scenario ${scenario.id}`);
          pdf.setFontSize(8);
          pdf.text('Commodity hedging chart not available', contentPadding, yOffset);
          yOffset += 10;
        }
      } catch (error) {
        console.error('Error rendering charts:', error);
        pdf.setFontSize(8);
        pdf.text('Error rendering charts', contentPadding, yOffset);
        yOffset += 10;
      }

      // 8. SUMMARY STATISTICS - plus compact, sur la même page si possible
      if (yOffset > pdf.internal.pageSize.height - 80) {
        pdf.addPage();
        yOffset = contentPadding;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('8. SUMMARY STATISTICS', contentPadding, yOffset);
      yOffset += 8;

      const summaryStats = [
        ['Metric', 'Value', 'Description'],
        ['Total Hedged Cost', formatCurrency(totalHedgedCost), 'Total cost with hedging strategy'],
        ['Total Unhedged Cost', formatCurrency(totalUnhedgedCost), 'Total cost without hedging'],
        ['Total P&L', formatCurrency(totalPnL), 'Net profit/loss from hedging'],
        ['Total Strategy Premium', formatNumber(totalStrategyPremium, 2), 'Total premium paid for strategy'],
        ['Strike Target', formatNumber(strikeTarget || 0, 4), 'Effective strike rate achieved'],
        ['Cost Reduction %', formatPercentage(costReduction), 'Percentage cost reduction achieved']
      ];

      (pdf as any).autoTable({
        ...tableOptions,
        startY: yOffset,
        head: [summaryStats[0]],
        body: summaryStats.slice(1),
        styles: { 
          fontSize: 9,
          cellPadding: 2
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold',
            cellWidth: 50
          },
          1: { 
            halign: 'right',
            cellWidth: 40
          },
          2: {
            cellWidth: 'auto',
            fontSize: 8
          }
        },
        tableWidth: 'auto'
      });
      
      yOffset = (pdf as any).lastAutoTable.finalY + 8;
      
      // Additional statistics table
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Performance Statistics', contentPadding, yOffset);
      yOffset += 6;
      
      const performanceStats = [
        ['Statistic', 'Value'],
        ['Total Periods', scenario.results.length.toString()],
        ['Average Monthly Volume', formatVolume(avgMonthlyVolume)],
        ['Average Strategy Price', formatNumber(avgStrategyPrice, 4)],
        ['Best Month P&L', formatCurrency(bestMonthPnL)],
        ['Worst Month P&L', formatCurrency(worstMonthPnL)],
        ['Volatility of P&L', formatCurrency(pnlVolatility)]
      ];
      
      (pdf as any).autoTable({
        ...tableOptions,
        startY: yOffset,
        head: [performanceStats[0]],
        body: performanceStats.slice(1),
        styles: { 
          fontSize: 9,
          cellPadding: 2
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold',
            cellWidth: 60
          },
          1: { 
            halign: 'right',
            cellWidth: 'auto'
          }
        },
        tableWidth: 'auto'
      });
      
      yOffset = (pdf as any).lastAutoTable.finalY + 6;
      
      // 6. YEARLY & MONTHLY BREAKDOWN - on a new page
      pdf.addPage();
      yOffset = contentPadding;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
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
      scenario.results.forEach(result => {
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
      
      // Convertir l'ensemble des années en tableau trié
      const sortedYears = Array.from(Object.keys(pnlByYearMonth)).sort();
      
      // Fonction pour formater les valeurs de P&L (sans espaces)
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
      const tableWidth = pdf.internal.pageSize.width - (2 * 15); // contentPadding = 15
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
      
      (pdf as any).autoTable({
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
          if (data.section === 'body' && data.column.index > 0) {
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
        }
      });
      
      yOffset = (pdf as any).lastAutoTable.finalY + 6; // Espace réduit
      
      // Statistics by Year - plus compact
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary Statistics by Year', contentPadding, yOffset);
      yOffset += 4;

      // Calculate yearly statistics
      const yearlyResults = sortedYears.map(year => {
        const yearData = scenario.results.filter(r => {
          try {
            const date = new Date(r.date);
            return date.getFullYear().toString() === year;
          } catch (e) {
            return false;
          }
        });
        
        const hedgedCost = yearData.reduce((sum, row) => sum + row.hedgedCost, 0);
        const unhedgedCost = yearData.reduce((sum, row) => sum + row.unhedgedCost, 0);
        const deltaPnL = yearData.reduce((sum, row) => sum + row.deltaPnL, 0);
        const strategyPremium = yearData.reduce((sum, row) => sum + (row.strategyPrice * row.monthlyVolume), 0);
        const volume = yearData.reduce((sum, row) => sum + row.monthlyVolume, 0);
        const strikeTarget = volume > 0 ? (hedgedCost / volume).toFixed(2) : 'N/A';
        const costReduction = ((deltaPnL / Math.abs(unhedgedCost)) * 100).toFixed(2);
        
        return [
          year,
          formatVolume(volume),
          formatCurrency(strategyPremium),
          formatCurrency(hedgedCost),
          formatCurrency(unhedgedCost),
          formatCurrency(deltaPnL),
          formatPercentage(parseFloat(costReduction))
        ];
      });
      
      (pdf as any).autoTable({
        ...tableOptions,
        startY: yOffset,
        head: [['Year', 'Volume', 'Strategy Premium', 'Hedged Cost', 'Unhedged Cost', 'Delta P&L', 'Cost Reduction %']],
        body: yearlyResults,
        styles: {
          fontSize: 8, // Police réduite
          cellPadding: 1.5
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' }
        },
        didParseCell: function(data: any) {
          // Mettre en surbrillance les valeurs de P&L (colonne 5 = Delta P&L)
          if (data.section === 'body' && data.column.index === 5) {
            try {
              const value = data.cell.raw;
              // Extract numeric value from currency string
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
        }
      });

      // 7. DETAILED RESULTS - on a new page
      pdf.addPage();
      yOffset = contentPadding;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold'); 
      pdf.text('7. DETAILED RESULTS', contentPadding, yOffset);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      yOffset += 8;
      
      const detailedResults = scenario.results.map(row => [
        new Date(row.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }), // Format DD/MM/YYYY
        formatVolume(row.monthlyVolume || 0),
        formatNumber(row.strategyPrice || 0, 4),
        formatCurrency(row.hedgedCost),
        formatCurrency(row.unhedgedCost),
        formatCurrency(row.deltaPnL)
      ]);

      (pdf as any).autoTable({
        ...tableOptions,
        startY: yOffset,
        head: [['Date', 'Volume', 'Strategy Price', 'Hedged Cost', 'Unhedged Cost', 'Delta P&L']],
        body: detailedResults,
        styles: {
          fontSize: 7, // Police plus petite
          cellPadding: 1 // Padding minimal
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' },
          1: { cellWidth: 35, halign: 'right' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 40, halign: 'right' },
          4: { cellWidth: 40, halign: 'right' },
          5: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: function(data: any) {
          // Mettre en surbrillance les valeurs de P&L (colonne 5 = Delta P&L)
          if (data.section === 'body' && data.column.index === 5) {
            try {
              const value = data.cell.raw;
              // Extract numeric value from currency string
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
        }
      });
      
      // Ajouter un pied de page professionnel à toutes les pages
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
    }

    // Generate filename based on scenario name
    const generateFileName = () => {
      if (scenariosToExport.length === 1) {
        const scenario = scenariosToExport[0];
        const cleanName = scenario.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const date = new Date(scenario.timestamp).toISOString().split('T')[0].replace(/-/g, '_');
        return `${cleanName}_${date}_professional_report.pdf`;
      }
      return `Strategy_Reports_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}.pdf`;
    };
    
    // Save the PDF
    pdf.save(generateFileName());
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4 mb-4">
        <Checkbox
          checked={selectedScenarios.length === scenarios.length}
          onCheckedChange={toggleAll}
          id="select-all"
        />
        <label htmlFor="select-all">Select All Scenarios</label>
        <Button
          onClick={exportToPdf}
          disabled={selectedScenarios.length === 0}
        >
          Export Selected to PDF
        </Button>
      </div>
      <div className="space-y-2">
        {scenarios.map(scenario => (
          <div key={scenario.id} className="flex items-center gap-2">
            <Checkbox
              checked={selectedScenarios.includes(scenario.id)}
              onCheckedChange={() => toggleScenario(scenario.id)}
              id={`scenario-${scenario.id}`}
            />
            <label htmlFor={`scenario-${scenario.id}`}>
              {scenario.name} ({new Date(scenario.timestamp).toLocaleDateString()})
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScenariosPdfExport; 