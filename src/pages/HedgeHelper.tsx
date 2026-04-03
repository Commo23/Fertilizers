import { useRef, useEffect, useMemo } from "react";
import { useForexChat } from "@/hooks/useForexChat";
import { useCommodityData } from "@/hooks/useCommodityData";
import type { AppCommodityContext } from "@/types/chat";
import {
  ChatMessage,
  ChatInput,
  TypingIndicator,
  MarketDataPanel,
  ChatSettingsPanel,
} from "@/components/hedge-helper";
import { Bot, Trash2, TrendingUp, Shield, BarChart3, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";

const QUICK_ACTIONS = [
  { icon: Shield, label: "Stratégies de hedging FX", prompt: "Quelles sont les principales stratégies de couverture FOREX pour une entreprise exposée au risque EUR/USD ?" },
  { icon: TrendingUp, label: "Forwards vs Options", prompt: "Compare les forwards et les options pour couvrir une exposition de change ou une exposition matière première. Avantages et inconvénients de chaque instrument ?" },
  { icon: BarChart3, label: "Analyser mon risque", prompt: "Comment puis-je évaluer mon exposition au risque de change ou au risque matière première ? Quels sont les indicateurs clés à surveiller ?" },
  { icon: Shield, label: "Hedging commodities", prompt: "Quelles stratégies de couverture pour une exposition pétrole (WTI/Brent) ou gaz ? Comment gérer le risque de base et le roll yield ?" },
];

const STRATEGY_PROMPT_FX = `Je souhaite initier une stratégie de couverture de change. Peux-tu m'aider à définir les paramètres ? (montant, devise, payer/recevoir, échéance, devise de référence)`;

const STRATEGY_PROMPT_COMMO = `Je souhaite initier une stratégie de couverture sur une matière première (pétrole, gaz, métal, agricole). Peux-tu m'aider à définir les paramètres ?`;

function buildAppCommodityContext(
  marketData: { spotPrices: Record<string, number>; volatilities?: Record<string, number>; lastUpdated?: Date },
  exposures: Array<{ commodity: string; quantity: number; type: string; totalValue: number; maturity?: Date }>
): AppCommodityContext {
  return {
    spotPrices: marketData.spotPrices,
    volatilities: marketData.volatilities,
    lastUpdated: marketData.lastUpdated instanceof Date ? marketData.lastUpdated.toISOString() : undefined,
    exposuresSummary: exposures.length > 0 ? exposures.map((e) => ({
      commodity: e.commodity,
      quantity: e.quantity,
      type: e.type,
      value: e.totalValue,
      maturity: e.maturity instanceof Date ? e.maturity.toISOString().slice(0, 10) : undefined
    })) : undefined
  };
}

export default function HedgeHelper() {
  const { marketData, exposures, updateMarketData } = useCommodityData();
  const appCommodityContext = useMemo(
    () => buildAppCommodityContext(marketData, exposures),
    [marketData, exposures]
  );
  const { messages, isLoading, sendMessage, clearMessages, settings, setSettings, saveSettingsToStorage } = useForexChat({ appCommodityContext });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Layout
      title="Hedge Assistant"
      breadcrumbs={[{ label: "Hedge Assistant" }]}
    >
      <div className="flex h-[calc(100vh-8rem)] rounded-lg border border-border bg-background overflow-hidden">
        {/* Chat Section */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">Hedge Assistant</h1>
                <p className="text-xs text-muted-foreground">Assistant hedging FX et matières premières</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ChatSettingsPanel settings={settings} onSettingsChange={setSettings} onSave={saveSettingsToStorage} />
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearMessages}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Effacer
                </Button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Bienvenue sur <span className="text-primary">Hedge Assistant</span>
                </h2>
                <p className="text-muted-foreground max-w-md mb-8">
                  Je suis l'assistant CommoHedge, spécialisé dans le hedging FX et matières premières.
                  Posez-moi vos questions sur les stratégies de couverture, l'analyse des risques, ou les instruments dérivés.
                </p>

                <div className="grid gap-3 w-full max-w-xl">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.prompt)}
                      className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-secondary/50 transition-all text-left group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/20 transition-colors">
                        <action.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    message={message}
                    fxDisplayMode={settings.fxDisplayMode}
                    assetClass={settings.assetClass}
                  />
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <TypingIndicator />
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border bg-card/50 shrink-0">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex justify-center gap-2 flex-wrap">
                <Button
                  onClick={() => sendMessage(settings.assetClass === "commodities" ? STRATEGY_PROMPT_COMMO : STRATEGY_PROMPT_FX)}
                  disabled={isLoading}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  <Rocket className="h-4 w-4" />
                  Initier une stratégie {settings.assetClass === "commodities" ? "commodities" : "FX"}
                </Button>
              </div>
              <ChatInput onSend={sendMessage} isLoading={isLoading} />
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-80 xl:w-96 border-l border-border">
          <MarketDataPanel
            assetClass={settings.assetClass}
            commodityMarketData={settings.assetClass === "commodities" ? marketData : null}
            onRefreshCommodity={updateMarketData}
          />
        </div>
      </div>
    </Layout>
  );
}
