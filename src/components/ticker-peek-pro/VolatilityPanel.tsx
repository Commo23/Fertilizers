import { useEffect, useState, useMemo } from "react";
import { RefreshCw, Table2, LineChart as LineChartIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { fetchVolatility, type FuturesContract, type VolatilityResponse, type OptionsTypeOption } from "@/lib/ticker-peek-pro/barchart";
import { DataCard } from "./DataCard";
import { LoadingState, ErrorState, EmptyState } from "./DataStates";
import { PriceChange } from "./PriceChange";

interface Expiration {
  label: string;
  value: string;
}

interface VolatilityPanelProps {
  contract: FuturesContract;
  optionSymbol: string;
}

const DEFAULT_OPTIONS_TYPES: OptionsTypeOption[] = [
  { label: 'Monthly Options', value: 'monthly' },
  { label: 'Friday Weekly Options', value: 'weeklyFriday' },
  { label: 'Monday Weekly Options', value: 'weeklyMonday' },
  { label: 'Tuesday Weekly Options', value: 'weeklyTuesday' },
  { label: 'Wednesday Weekly Options', value: 'weeklyWednesday' },
  { label: 'Thursday Weekly Options', value: 'weeklyThursday' },
];

function parseNumericField(raw: string): number {
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function VolatilityPanel({ contract, optionSymbol }: VolatilityPanelProps) {
  const [data, setData] = useState<VolatilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawPreview, setRawPreview] = useState("");
  const [activeTab, setActiveTab] = useState<"calls" | "puts">("calls");
  const [moneyness, setMoneyness] = useState(50);
  const [expirations, setExpirations] = useState<Expiration[]>([]);
  const [selectedMaturity, setSelectedMaturity] = useState<string>("");
  const [optionsTypes, setOptionsTypes] = useState<OptionsTypeOption[]>(DEFAULT_OPTIONS_TYPES);
  const [selectedOptionsType, setSelectedOptionsType] = useState<string>("monthly");
  const [vizMode, setVizMode] = useState<"table" | "smile">("table");

  const loadData = async (maturity?: string, optType?: string, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    const result = await fetchVolatility(
      contract.contract,
      optionSymbol,
      moneyness,
      maturity,
      optType || selectedOptionsType,
      forceRefresh
    );
    if (result.success && result.data) {
      setData(result.data);
      setRawPreview(result.raw || "");
      if (result.expirations && result.expirations.length > 0) {
        setExpirations(result.expirations);
      } else {
        setExpirations([]);
      }
      if (result.optionsTypes && result.optionsTypes.length > 0) {
        setOptionsTypes(result.optionsTypes);
      }
    } else {
      setError(result.error || "Failed to fetch volatility data");
      setRawPreview(result.raw || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    setSelectedMaturity("");
    setExpirations([]);
    setSelectedOptionsType("monthly");
    loadData();
  }, [contract.contract, optionSymbol]);

  useEffect(() => {
    loadData(selectedMaturity || undefined);
  }, [moneyness]);

  const handleMaturityChange = (maturity: string) => {
    setSelectedMaturity(maturity);
    loadData(maturity || undefined);
  };

  const handleOptionsTypeChange = (optType: string) => {
    setSelectedOptionsType(optType);
    setSelectedMaturity("");
    setExpirations([]);
    loadData(undefined, optType);
  };

  const columns = [
    { key: "strike", label: "Strike" },
    { key: "latest", label: "Latest" },
    { key: "iv", label: "IV" },
    { key: "delta", label: "Delta" },
    { key: "gamma", label: "Gamma" },
    { key: "theta", label: "Theta" },
    { key: "vega", label: "Vega" },
    { key: "ivSkew", label: "IV Skew" },
    { key: "lastTrade", label: "Last Trade" },
  ];

  const currentData = activeTab === "calls" ? data?.calls || [] : data?.puts || [];

  const smileSeries = useMemo(() => {
    return currentData
      .map((row) => {
        const strike = parseNumericField(row.strike);
        const ivPct = row.iv === "N/A" ? NaN : parseNumericField(row.iv);
        return {
          strike,
          ivPct,
          strikeLabel: row.strike,
          ivLabel: row.iv,
        };
      })
      .filter((p) => Number.isFinite(p.strike) && Number.isFinite(p.ivPct))
      .sort((a, b) => a.strike - b.strike);
  }, [currentData]);

  const spotPrice = useMemo(() => parseNumericField(contract.last), [contract.last]);

  const formatGreekValue = (value: string, key: string) => {
    if (value === "N/A") return <span className="text-muted-foreground">N/A</span>;
    if (key === "iv" || key === "ivSkew") {
      const isPositive = value.startsWith("+");
      return (
        <span className={`font-mono text-xs ${key === "iv" ? "text-warning" : isPositive ? "text-primary" : "text-destructive"}`}>
          {value}
        </span>
      );
    }
    if (key === "delta") {
      const num = parseFloat(value);
      return <span className={`font-mono text-xs ${num >= 0 ? "text-primary" : "text-destructive"}`}>{value}</span>;
    }
    if (key === "theta") {
      return <span className="font-mono text-xs text-destructive">{value}</span>;
    }
    return <span className="font-mono text-xs">{value}</span>;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold">Volatility & Greeks</h2>
            <span className="text-sm font-mono text-accent">{optionSymbol}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-mono font-medium">{contract.last}</span>
            <PriceChange value={contract.change} />
            {data?.metadata?.daysToExpiration !== undefined && (
              <span className="text-muted-foreground">
                DTE: <span className="text-info font-mono">{data.metadata.daysToExpiration}</span>
              </span>
            )}
            {data?.metadata?.expirationDate && (
              <span className="text-muted-foreground">
                Exp: <span className="font-mono">{data.metadata.expirationDate}</span>
              </span>
            )}
            {data?.metadata?.pointValue && (
              <span className="text-muted-foreground">
                PV: <span className="font-mono">{data.metadata.pointValue}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Options Type:</span>
          <select
            value={selectedOptionsType}
            onChange={(e) => handleOptionsTypeChange(e.target.value)}
            className="bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {optionsTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {expirations.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Maturity:</span>
            <select
              value={selectedMaturity}
              onChange={(e) => handleMaturityChange(e.target.value)}
              className="bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Default</option>
              {expirations.map((exp, idx) => (
                <option key={idx} value={exp.value}>
                  {exp.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Strikes:</span>
          <select
            value={moneyness}
            onChange={(e) => setMoneyness(Number(e.target.value))}
            className="bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value={5}>5 ±</option>
            <option value={20}>20 ±</option>
            <option value={50}>50 ±</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("calls")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "calls"
                ? "bg-primary/15 text-primary glow-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Calls {data?.calls.length ? `(${data.calls.length})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("puts")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "puts"
                ? "bg-destructive/15 text-destructive"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Puts {data?.puts.length ? `(${data.puts.length})` : ""}
          </button>
        </div>

        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 w-fit border border-border/60">
          <button
            type="button"
            onClick={() => setVizMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              vizMode === "table"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setVizMode("smile")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              vizMode === "smile"
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            Vol smile
          </button>
        </div>
      </div>

      <DataCard
        title={
          vizMode === "smile"
            ? `${activeTab === "calls" ? "Call" : "Put"} vol smile (IV vs strike)`
            : `${activeTab === "calls" ? "Call" : "Put"} Greeks`
        }
        actions={
          <button
            onClick={() => loadData(selectedMaturity || undefined, undefined, true)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      >
        {loading ? (
          <LoadingState message={`Scraping volatility for ${optionSymbol}...`} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadData(selectedMaturity || undefined)} />
        ) : currentData.length === 0 ? (
          <div className="p-4 space-y-4">
            <EmptyState message={`No ${activeTab} Greeks parsed.`} />
            {rawPreview && (
              <pre className="text-xs text-muted-foreground bg-muted/30 p-3 rounded overflow-auto max-h-60 font-mono">
                {rawPreview}
              </pre>
            )}
          </div>
        ) : vizMode === "smile" ? (
          smileSeries.length < 2 ? (
            <div className="p-6">
              <EmptyState message="Not enough valid IV points to plot a vol smile (need at least 2 strikes)." />
            </div>
          ) : (
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Implied volatility (IV) by strike for the selected maturity and option type. Same data as the table.
              </p>
              <div className="h-[340px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={smileSeries} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      type="number"
                      dataKey="strike"
                      domain={["dataMin", "dataMax"]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
                      label={{ value: "Strike", position: "insideBottom", offset: -4, className: "fill-muted-foreground text-xs" }}
                    />
                    <YAxis
                      dataKey="ivPct"
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                      width={48}
                      label={{ value: "IV (%)", angle: -90, position: "insideLeft", className: "fill-muted-foreground text-xs" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${Number(value).toFixed(2)}%`, "IV"]}
                      labelFormatter={(strike) => `Strike ${strike}`}
                    />
                    {Number.isFinite(spotPrice) &&
                      smileSeries.length > 0 &&
                      spotPrice >= smileSeries[0].strike &&
                      spotPrice <= smileSeries[smileSeries.length - 1].strike && (
                        <ReferenceLine
                          x={spotPrice}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="5 5"
                          label={{
                            value: "Underlying",
                            position: "top",
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10,
                          }}
                        />
                      )}
                    <Line
                      type="monotone"
                      dataKey="ivPct"
                      stroke="hsl(var(--warning))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(var(--warning))", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      name="IV"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-table-header border-b border-table">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-table-row-hover transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="data-cell font-semibold text-foreground">{row.strike}</span>
                    </td>
                    <td className="px-3 py-2.5 data-cell font-medium">{row.latest}</td>
                    <td className="px-3 py-2.5">{formatGreekValue(row.iv, "iv")}</td>
                    <td className="px-3 py-2.5">{formatGreekValue(row.delta, "delta")}</td>
                    <td className="px-3 py-2.5">{formatGreekValue(row.gamma, "gamma")}</td>
                    <td className="px-3 py-2.5">{formatGreekValue(row.theta, "theta")}</td>
                    <td className="px-3 py-2.5">{formatGreekValue(row.vega, "vega")}</td>
                    <td className="px-3 py-2.5">{formatGreekValue(row.ivSkew, "ivSkew")}</td>
                    <td className="px-3 py-2.5 data-cell text-muted-foreground text-xs">{row.lastTrade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
