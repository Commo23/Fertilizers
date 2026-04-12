import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./hooks/ThemeProvider";
import { useSmoothScroll, useMomentumScroll } from "./hooks/useSmoothScroll";
import { useZoom } from "./hooks/useZoom";
import { useAutoSync } from "./hooks/useAutoSync";
import LocalStorageWatcher from "./services/LocalStorageWatcher";
import "./utils/testSupabaseIntegration";
import "./utils/initSupabaseTables";
import "./utils/testSupabaseFinal";
import "./utils/testSignUp";
import "./utils/cleanupLocalStorage";

// Import pages
import Dashboard from "./pages/Dashboard";
import CommodityMarket from "./pages/CommodityMarket";
import MarketNews from "./pages/MarketNews";
import CommodityNews from "./pages/CommodityNews";
import LiveNews from "./pages/LiveNews";
import HormuzTracker from "./pages/HormuzTracker";
import WorldMap from "./pages/WorldMap";
import EconomicCalendar from "./pages/EconomicCalendar";
import AdvancedChart from "./pages/AdvancedChart";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";
import DatabaseSync from "./pages/DatabaseSync";
import RateExplorer from "./pages/RateExplorer";
import HedgeHelper from "./pages/HedgeHelper";
import TickerPeekPro from "./pages/TickerPeekPro";
import LandingPage from "./pages/LandingPage";
import SupabaseLogin from "./pages/SupabaseLogin";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

// Theme toggle component
import { ThemeToggle } from "./components/ui/theme-toggle";

const queryClient = new QueryClient();

const App = () => {
  // Initialiser les hooks de scroll fluide
  useSmoothScroll();
  useMomentumScroll();

  // Initialiser le zoom
  useZoom();

  // Initialiser la synchronisation automatique
  useAutoSync();

  // Initialiser la surveillance du localStorage
  LocalStorageWatcher.getInstance();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Router>
            <Routes>
              {/* Landing Page - Page par défaut */}
              <Route path="/" element={<LandingPage />} />

              {/* Authentication */}
              <Route path="/login" element={<SupabaseLogin />} />
              <Route path="/supabase-login" element={<SupabaseLogin />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/commodity-market" element={<ProtectedRoute><CommodityMarket /></ProtectedRoute>} />
              <Route path="/market-news" element={<ProtectedRoute><MarketNews /></ProtectedRoute>} />
              <Route path="/commodity-news" element={<ProtectedRoute><CommodityNews /></ProtectedRoute>} />
              <Route path="/live-news" element={<ProtectedRoute><LiveNews /></ProtectedRoute>} />
              <Route path="/hormuz-tracker" element={<ProtectedRoute><HormuzTracker /></ProtectedRoute>} />
              <Route path="/world-map" element={<ProtectedRoute><WorldMap /></ProtectedRoute>} />
              <Route path="/economic-calendar" element={<ProtectedRoute><EconomicCalendar /></ProtectedRoute>} />
              <Route path="/advanced-chart" element={<ProtectedRoute><AdvancedChart /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/database-sync" element={<ProtectedRoute><DatabaseSync /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/rate-explorer" element={<ProtectedRoute><RateExplorer /></ProtectedRoute>} />
              <Route path="/hedge-helper" element={<ProtectedRoute><HedgeHelper /></ProtectedRoute>} />
              <Route path="/ticker-peek-pro" element={<ProtectedRoute><TickerPeekPro /></ProtectedRoute>} />

              <Route path="/saved" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
