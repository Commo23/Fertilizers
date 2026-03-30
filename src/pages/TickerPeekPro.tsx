import { useState } from "react";
import { Layout } from "@/components/Layout";
import { DashboardHeader } from "@/components/ticker-peek-pro/DashboardHeader";
import { FuturesPanel } from "@/components/ticker-peek-pro/FuturesPanel";
import { OptionsPanel } from "@/components/ticker-peek-pro/OptionsPanel";
import { VolatilityPanel } from "@/components/ticker-peek-pro/VolatilityPanel";
import { VolSurfacePanel } from "@/components/ticker-peek-pro/VolSurfacePanel";
import { IvMatrixPanel } from "@/components/ticker-peek-pro/IvMatrixPanel";
import { CurrencySelector } from "@/components/ticker-peek-pro/CurrencySelector";
import type { Breadcrumb } from "@/lib/ticker-peek-pro/types";
import type { CurrencyData, FuturesContract } from "@/lib/ticker-peek-pro/barchart";

const TickerPeekPro = () => {
  const [view, setView] = useState<"home" | "futures" | "options" | "volatility" | "volsurface" | "ivmatrix">("home");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyData | null>(null);
  const [selectedFuture, setSelectedFuture] = useState<FuturesContract | null>(null);
  const [optionSymbol, setOptionSymbol] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ label: "Home", view: "home" }]);

  const handleCurrencySelected = (currency: CurrencyData) => {
    setSelectedCurrency(currency);
    setSelectedFuture(null);
    setView("home");
    setBreadcrumbs([{ label: "Home", view: "home" }]);
  };

  const handleLoadFutures = () => {
    if (!selectedCurrency) return;
    setView("futures");
    setBreadcrumbs([
      { label: "Home", view: "home" },
      { label: `${selectedCurrency.symbol} Futures`, view: "futures", symbol: selectedCurrency.symbol },
    ]);
  };

  const handleLoadVolatility = () => {
    if (!selectedCurrency) return;
    setOptionSymbol(selectedCurrency.symbol);
    if (!selectedFuture) {
      setSelectedFuture({
        contract: selectedCurrency.symbol,
        month: "",
        last: selectedCurrency.last,
        change: selectedCurrency.change,
        percentChange: selectedCurrency.percentChange,
        open: "",
        high: selectedCurrency.high,
        low: selectedCurrency.low,
        volume: selectedCurrency.volume,
        openInterest: "",
        time: selectedCurrency.time,
      });
    }
    setView("volatility");
    setBreadcrumbs([
      { label: "Home", view: "home" },
      { label: `${selectedCurrency.symbol} Vol & Greeks`, view: "volatility" },
    ]);
  };

  const handleLoadVolSurface = () => {
    if (!selectedCurrency) return;
    setOptionSymbol(selectedCurrency.symbol);
    if (!selectedFuture) {
      setSelectedFuture({
        contract: selectedCurrency.symbol,
        month: "",
        last: selectedCurrency.last,
        change: selectedCurrency.change,
        percentChange: selectedCurrency.percentChange,
        open: "",
        high: selectedCurrency.high,
        low: selectedCurrency.low,
        volume: selectedCurrency.volume,
        openInterest: "",
        time: selectedCurrency.time,
      });
    }
    setView("volsurface");
    setBreadcrumbs([
      { label: "Home", view: "home" },
      { label: `${selectedCurrency.symbol} Vol Surface 3D`, view: "volsurface" },
    ]);
  };

  const handleLoadIvMatrix = () => {
    if (!selectedCurrency) return;
    setOptionSymbol(selectedCurrency.symbol);
    if (!selectedFuture) {
      setSelectedFuture({
        contract: selectedCurrency.symbol,
        month: "",
        last: selectedCurrency.last,
        change: selectedCurrency.change,
        percentChange: selectedCurrency.percentChange,
        open: "",
        high: selectedCurrency.high,
        low: selectedCurrency.low,
        volume: selectedCurrency.volume,
        openInterest: "",
        time: selectedCurrency.time,
      });
    }
    setView("ivmatrix");
    setBreadcrumbs([
      { label: "Home", view: "home" },
      { label: `${selectedCurrency.symbol} Matrice IV`, view: "ivmatrix" },
    ]);
  };

  const handleSelectFuture = (future: FuturesContract) => {
    setSelectedFuture(future);
    setView("options");
    setBreadcrumbs([
      { label: "Home", view: "home" },
      { label: `${selectedCurrency?.symbol ?? ""} Futures`, view: "futures", symbol: selectedCurrency?.symbol },
      { label: `${future.contract} Options`, view: "options", symbol: future.contract },
    ]);
  };

  const handleViewVolatility = (optSymbol: string) => {
    setOptionSymbol(optSymbol);
    setView("volatility");
    setBreadcrumbs([
      { label: "Home", view: "home" },
      { label: `${selectedCurrency?.symbol ?? ""} Futures`, view: "futures", symbol: selectedCurrency?.symbol },
      { label: `${selectedFuture?.contract ?? ""} Options`, view: "options", symbol: selectedFuture?.contract },
      { label: "Vol & Greeks", view: "volatility" },
    ]);
  };

  const handleBreadcrumbClick = (crumb: Breadcrumb) => {
    setView(crumb.view);
    if (crumb.view === "home") {
      setSelectedFuture(null);
      setBreadcrumbs([{ label: "Home", view: "home" }]);
    } else if (crumb.view === "futures") {
      setSelectedFuture(null);
      setBreadcrumbs(breadcrumbs.slice(0, 2));
    } else if (crumb.view === "options") {
      setBreadcrumbs(breadcrumbs.slice(0, 3));
    }
  };

  return (
    <Layout title="Ticker Peek Pro">
      <div className="min-h-screen bg-background">
        <DashboardHeader breadcrumbs={breadcrumbs} onBreadcrumbClick={handleBreadcrumbClick} />
        <main className="container mx-auto px-4 py-6 max-w-[1600px]">
          <div className="mb-6">
            <CurrencySelector
              selectedCurrency={selectedCurrency}
              onSelect={handleCurrencySelected}
              onLoadFutures={handleLoadFutures}
              onLoadVolatility={handleLoadVolatility}
              onLoadVolSurface={handleLoadVolSurface}
              onLoadIvMatrix={handleLoadIvMatrix}
            />
          </div>

          {view === "futures" && selectedCurrency != null && (
            <FuturesPanel currency={selectedCurrency} onSelect={handleSelectFuture} />
          )}
          {view === "options" && selectedFuture != null && (
            <OptionsPanel contract={selectedFuture} onViewVolatility={handleViewVolatility} />
          )}
          {view === "volatility" && selectedFuture != null && optionSymbol !== "" && (
            <VolatilityPanel contract={selectedFuture} optionSymbol={optionSymbol} />
          )}
          {view === "volsurface" && selectedFuture != null && optionSymbol !== "" && (
            <VolSurfacePanel futureSymbol={selectedFuture.contract} optionSymbol={optionSymbol} />
          )}
          {view === "ivmatrix" && selectedFuture != null && optionSymbol !== "" && (
            <IvMatrixPanel
              futureSymbol={selectedFuture.contract}
              optionSymbol={optionSymbol}
              underlyingLast={selectedFuture.last}
            />
          )}
        </main>
      </div>
    </Layout>
  );
};

export default TickerPeekPro;
