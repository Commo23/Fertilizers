import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Globe,
  Home,
  Settings,
  Users,
  Database,
  Percent,
  MessageSquare,
  LayoutGrid,
  Radar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useCompanySettings, getCompanyNameSync, companySettingsEmitter } from "@/hooks/useCompanySettings";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User } from "lucide-react";
import { SyncIndicator } from "./SyncIndicator";
import { BRAND } from "@/constants/branding";
import "@/styles/sidebar-zoom.css";

type MarketDataNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
};

// Dashboard - Standalone
const dashboardItem = {
  title: "Dashboard",
  url: "/dashboard",
  icon: Home,
  description: "Global overview and key metrics"
};

// Market Data & News Group
const marketDataItems: MarketDataNavItem[] = [
  {
    title: "Intelligence workspace",
    url: "/intel-workspace",
    icon: LayoutGrid,
    description:
      "Carte, Live TV, webcams, news, graphique avancé, Hormuz, calendrier, flux matières premières (grille déplaçable)",
  },
  {
    title: "Commodity Market",
    url: "/commodity-market",
    icon: Globe,
    description: "Real-time commodity market data and prices"
  },
  {
    title: "Rate Explorer",
    url: "/rate-explorer",
    icon: Percent,
    description: "Interest rate futures, IRS & yield curve bootstrapping"
  },
  {
    title: "MMSI tracker",
    url: "/mmsi-tracker",
    icon: Radar,
    description: "Stream AIS by MMSI list (table; separate from map cargo layer)",
  },
  {
    title: "Hedge Assistant",
    url: "/hedge-helper",
    icon: MessageSquare,
    description: "Assistant hedging FX et matières premières"
  },
  {
    title: "Ticker Peek Pro",
    url: "/ticker-peek-pro",
    icon: BarChart3,
    description: "Commodities terminal: futures, options, volatility & Vol Surface 3D (Barchart)"
  }
];

const managementItems = [
  {
    title: "User Management",
    url: "/users",
    icon: Users,
    description: "Roles and permissions"
  },
  {
    title: "Database Sync",
    url: "/database-sync",
    icon: Database,
    description: "Synchronize with Supabase"
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "System configuration"
  }
];

export function AppSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { getCompanyNameParts, isLoaded, getCompanyLogo } = useCompanySettings();
  const logo = getCompanyLogo();
  // Utilise le cache mémoire pour le nom dès le premier render
  const [companyName, setCompanyName] = useState(getCompanyNameSync());
  
  useEffect(() => {
    const unsubscribe = companySettingsEmitter.subscribe(() => {
      setCompanyName(getCompanyNameSync());
    });
    return unsubscribe;
  }, []);
  
  // Découpe le nom pour l'affichage
  const dashIndex = companyName.indexOf(' - ');
  const primaryName = dashIndex === -1 ? companyName : companyName.substring(0, dashIndex).trim();
  const secondaryName = dashIndex === -1 ? '' : companyName.substring(dashIndex + 3).trim();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <Sidebar className="border-r border-border/40 bg-gradient-to-b from-background to-background/95 sidebar-zoom-adaptive">
      <SidebarHeader className="p-6 border-b border-border/40 sidebar-header">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <img 
              src={logo}
              alt="Company Logo" 
              className="h-10 w-10 object-contain sidebar-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Globe className="h-6 w-6 text-primary hidden" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-primary">
              {primaryName || BRAND.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {secondaryName || BRAND.tagline}
            </div>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2 sidebar-content">
        <ScrollArea variant="sidebar" orientation="vertical" className="h-full">
        {/* Dashboard */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={isActive(dashboardItem.url)}
                  className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground sidebar-menu-button"
                >
                  <Link to={dashboardItem.url} className="flex items-center gap-3 w-full">
                    <dashboardItem.icon className="h-4 w-4 shrink-0 sidebar-icon" />
                    <span className="flex-1">{dashboardItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-4" />

        {/* Market Data & News */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2 sidebar-group-label">
            Market Data & News
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {marketDataItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground sidebar-menu-button"
                  >
                    <Link to={item.url} className="flex w-full items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0 sidebar-icon" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-4" />

        {/* Management */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2 sidebar-group-label">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)}
                    className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground sidebar-menu-button"
                  >
                    <Link to={item.url} className="flex items-center gap-3 w-full">
                      <item.icon className="h-4 w-4 shrink-0 sidebar-icon" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/40 sidebar-footer">
        <div className="space-y-3">
          {/* User Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center sidebar-user-avatar shadow-lg">
                  <User className="h-5 w-5 text-white sidebar-icon" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {user?.name || 'Commodity Hedge Manager'}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  window.location.href = '/';
                }}
                className="w-full h-9 bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 hover:border-red-400/50 hover:text-red-400 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-red-500/20 font-medium"
                title="Logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

          {/* Sync Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground sidebar-group-label">
              <span className="font-semibold">Synchronisation</span>
              <SyncIndicator />
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
} 