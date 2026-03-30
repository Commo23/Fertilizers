import { useEffect, useState, useMemo, useCallback } from "react";
import { RefreshCw, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import type { SurfacePoint } from "@/lib/ticker-peek-pro/barchart";
import { fetchVolSurface, fetchVolSurfaceStrikes } from "@/lib/ticker-peek-pro/barchart";
import { interpolateSurface } from "@/lib/ticker-peek-pro/volSurfaceInterpolation";
import { setCache } from "@/lib/ticker-peek-pro/scrapeCache";
import { DataCard } from "./DataCard";
import { LoadingState, ErrorState, EmptyState } from "./DataStates";
import { StrikeRangeSelector } from "./StrikeRangeSelector";

interface IvMatrixPanelProps {
  futureSymbol: string;
  optionSymbol: string;
  /** Prix last du future (ex. depuis la liste) — ligne verticale « underlying » sur le smile */
  underlyingLast?: string;
}

function parseNumericField(raw: string | undefined): number {
  if (raw == null || raw === "") return NaN;
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

type Phase = "loading-strikes" | "select-strikes" | "loading-surface" | "done";

export function IvMatrixPanel({ futureSymbol, optionSymbol, underlyingLast }: IvMatrixPanelProps) {
  const [phase, setPhase] = useState<Phase>("loading-strikes");
  const [availableStrikes, setAvailableStrikes] = useState<number[]>([]);
  const [strikeRange, setStrikeRange] = useState<[number, number] | null>(null);
  const [points, setPoints] = useState<SurfacePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [activeType, setActiveType] = useState<"call" | "put">("call");
  const [useInterpolation, setUseInterpolation] = useState(true);
  const [queryStrike, setQueryStrike] = useState("");
  const [queryDte, setQueryDte] = useState("");
  const [smileDte, setSmileDte] = useState<number | null>(null);

  useEffect(() => {
    setPhase("loading-strikes");
    setError(null);
    setAvailableStrikes([]);
    setPoints([]);
    setStrikeRange(null);

    fetchVolSurfaceStrikes(futureSymbol, optionSymbol, 50).then((res) => {
      if (res.success && res.strikes && res.strikes.length > 0) {
        setAvailableStrikes(res.strikes);
        setPhase("select-strikes");
      } else {
        setError(res.error || "Impossible de charger les strikes disponibles");
        setPhase("done");
      }
    });
  }, [futureSymbol, optionSymbol]);

  const buildSurface = useCallback(
    async (minStrike: number, maxStrike: number, forceRefresh = false) => {
      setStrikeRange([minStrike, maxStrike]);
      setPhase("loading-surface");
      setError(null);
      setProgress("Scraping toutes les maturités pour l'intervalle sélectionné…");

      const result = await fetchVolSurface(
        futureSymbol,
        optionSymbol,
        50,
        forceRefresh,
        minStrike,
        maxStrike
      );

      if (result.success && result.surfacePoints) {
        setPoints(result.surfacePoints);
        setProgress(
          `${result.totalMaturities} maturités, ${result.surfacePoints.length} points`
        );
        const matrixKey = `ivmatrix:${futureSymbol}:${optionSymbol}:${minStrike}-${maxStrike}`;
        setCache(matrixKey, result.surfacePoints);
      } else {
        setError(result.error || "Échec de construction de la nappe");
      }
      setPhase("done");
    },
    [futureSymbol, optionSymbol]
  );

  const surfaceData = useMemo(() => {
    const filtered = points.filter((p) => p.type === activeType);
    if (filtered.length === 0) return null;

    const strikes = [...new Set(filtered.map((p) => p.strike))].sort((a, b) => a - b);
    const dtes = [...new Set(filtered.map((p) => p.dte))].sort((a, b) => a - b);
    const maturityLabels = dtes.map((dte) => {
      const point = filtered.find((p) => p.dte === dte);
      return point?.maturityLabel || String(dte);
    });

    let z: (number | null)[][] = dtes.map((dte) =>
      strikes.map((strike) => {
        const point = filtered.find((p) => p.dte === dte && p.strike === strike);
        const iv = point?.iv ?? null;
        return iv !== null && iv > 0 ? iv : null;
      })
    );

    if (useInterpolation) {
      z = interpolateSurface(z, strikes, dtes);
    }

    return { strikes, dtes, maturityLabels, z };
  }, [points, activeType, useInterpolation]);

  useEffect(() => {
    if (!surfaceData?.dtes?.length) {
      setSmileDte(null);
      return;
    }
    setSmileDte((prev) => {
      if (prev !== null && surfaceData.dtes.includes(prev)) return prev;
      return surfaceData.dtes[Math.floor(surfaceData.dtes.length / 2)];
    });
  }, [surfaceData]);

  const smileSeriesFromMatrix = useMemo(() => {
    if (!surfaceData || smileDte === null) return [];
    const di = surfaceData.dtes.indexOf(smileDte);
    if (di < 0) return [];
    return surfaceData.strikes
      .map((strike, si) => {
        const iv = surfaceData.z[di]?.[si];
        const ivPct = iv !== null && iv !== undefined && Number.isFinite(iv) ? iv : NaN;
        return { strike, ivPct };
      })
      .filter((p) => Number.isFinite(p.ivPct))
      .sort((a, b) => a.strike - b.strike);
  }, [surfaceData, smileDte]);

  const spotPrice = useMemo(() => parseNumericField(underlyingLast), [underlyingLast]);

  const interpolatedIV = useMemo(() => {
    if (!surfaceData || !queryStrike || !queryDte) return null;
    const qs = parseFloat(queryStrike);
    const qd = parseFloat(queryDte);
    if (isNaN(qs) || isNaN(qd)) return null;

    const { strikes, dtes, z } = surfaceData;
    if (strikes.length < 2 || dtes.length < 2) return null;

    let si = strikes.findIndex((s) => s >= qs);
    let di = dtes.findIndex((d) => d >= qd);

    if (si <= 0) si = 1;
    if (si >= strikes.length) si = strikes.length - 1;
    if (di <= 0) di = 1;
    if (di >= dtes.length) di = dtes.length - 1;

    const s0 = strikes[si - 1], s1 = strikes[si];
    const d0 = dtes[di - 1], d1 = dtes[di];

    const z00 = z[di - 1]?.[si - 1];
    const z01 = z[di - 1]?.[si];
    const z10 = z[di]?.[si - 1];
    const z11 = z[di]?.[si];

    const vals = [z00, z01, z10, z11].filter((v) => v !== null) as number[];
    if (vals.length === 0) return null;
    if (vals.length < 4) {
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    const ts = s1 !== s0 ? (qs - s0) / (s1 - s0) : 0.5;
    const td = d1 !== d0 ? (qd - d0) / (d1 - d0) : 0.5;
    return (
      z00! * (1 - ts) * (1 - td) +
      z01! * ts * (1 - td) +
      z10! * (1 - ts) * td +
      z11! * ts * td
    );
  }, [surfaceData, queryStrike, queryDte]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Matrice IV</h2>
          <p className="text-sm text-muted-foreground font-mono">
            {optionSymbol} — Strike × DTE (Monthly Options)
          </p>
        </div>
      </div>

      {phase === "loading-strikes" && (
        <LoadingState message="Chargement des strikes disponibles…" />
      )}

      {phase === "select-strikes" && availableStrikes.length > 0 && (
        <StrikeRangeSelector
          strikes={availableStrikes}
          onConfirm={(min, max) => buildSurface(min, max)}
        />
      )}

      {(phase === "loading-surface" || phase === "done") && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 w-fit">
              <button
                onClick={() => setActiveType("call")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeType === "call"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Calls
              </button>
              <button
                onClick={() => setActiveType("put")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeType === "put"
                    ? "bg-destructive/15 text-destructive"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Puts
              </button>
            </div>

            {surfaceData && (
              <button
                onClick={() => setUseInterpolation(!useInterpolation)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  useInterpolation
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/50 text-muted-foreground border-border"
                }`}
              >
                Interpolation {useInterpolation ? "ON" : "OFF"}
              </button>
            )}

            {phase === "done" && (
              <button
                onClick={() => {
                  setPhase("select-strikes");
                  setPoints([]);
                }}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground hover:text-foreground border border-border transition-colors"
              >
                Changer l'intervalle
              </button>
            )}

            {phase !== "loading-surface" && (
              <span className="text-xs text-muted-foreground">
                {strikeRange && `Strikes ${strikeRange[0]}–${strikeRange[1]} | `}
                {progress}
              </span>
            )}

            {surfaceData && (phase === "done" || phase === "loading-surface") && (
              <button
                onClick={() => strikeRange && buildSurface(strikeRange[0], strikeRange[1], true)}
                disabled={phase === "loading-surface"}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-auto"
              >
                <RefreshCw className={`w-3 h-3 ${phase === "loading-surface" ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {surfaceData && phase === "done" && (
            <DataCard title="Interpolation IV">
              <div className="flex items-end gap-4 flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Strike</label>
                  <Input
                    type="number"
                    placeholder={`ex: ${surfaceData.strikes[Math.floor(surfaceData.strikes.length / 2)]}`}
                    value={queryStrike}
                    onChange={(e) => setQueryStrike(e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">DTE (jours)</label>
                  <Input
                    type="number"
                    placeholder={`ex: ${surfaceData.dtes[Math.floor(surfaceData.dtes.length / 2)]}`}
                    value={queryDte}
                    onChange={(e) => setQueryDte(e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 h-8">
                  <Calculator className="w-4 h-4 text-muted-foreground" />
                  {interpolatedIV !== null ? (
                    <span className="text-lg font-bold text-warning">{interpolatedIV.toFixed(2)}%</span>
                  ) : queryStrike && queryDte ? (
                    <span className="text-sm text-muted-foreground">Données insuffisantes</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Entrez strike & DTE</span>
                  )}
                </div>
              </div>
            </DataCard>
          )}

          {phase === "loading-surface" && (
            <LoadingState message="Scraping toutes les maturités… Cela peut prendre une minute." />
          )}

          {phase === "done" && error && (
            <ErrorState message={error} onRetry={() => strikeRange && buildSurface(strikeRange[0], strikeRange[1])} />
          )}

          {phase === "done" && surfaceData && !error && smileDte !== null && (
            <DataCard
              title={`Vol smile — IV vs strike (${smileDte} DTE)`}
              actions={
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Maturité</label>
                  <select
                    value={smileDte}
                    onChange={(e) => setSmileDte(Number(e.target.value))}
                    className="bg-muted/50 border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[220px]"
                  >
                    {surfaceData.dtes.map((dte, i) => (
                      <option key={dte} value={dte}>
                        {dte}d — {surfaceData.maturityLabels[i] ?? dte}
                      </option>
                    ))}
                  </select>
                </div>
              }
            >
              {smileSeriesFromMatrix.length < 2 ? (
                <p className="text-sm text-muted-foreground p-4">
                  Pas assez de points IV valides à cette maturité pour tracer le smile (interpolation{" "}
                  {useInterpolation ? "activée" : "désactivée"}).
                </p>
              ) : (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Courbe à maturité fixe : valeurs issues de la matrice ci-dessous
                    {useInterpolation ? " (après interpolation 2D)" : " (brutes)"}.
                  </p>
                  <div className="h-[320px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={smileSeriesFromMatrix} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis
                          type="number"
                          dataKey="strike"
                          domain={["dataMin", "dataMax"]}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(1))}
                          label={{
                            value: "Strike",
                            position: "insideBottom",
                            offset: -4,
                            className: "fill-muted-foreground text-xs",
                          }}
                        />
                        <YAxis
                          dataKey="ivPct"
                          domain={["auto", "auto"]}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `${v}%`}
                          width={48}
                          label={{
                            value: "IV (%)",
                            angle: -90,
                            position: "insideLeft",
                            className: "fill-muted-foreground text-xs",
                          }}
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
                          smileSeriesFromMatrix.length > 0 &&
                          spotPrice >= smileSeriesFromMatrix[0].strike &&
                          spotPrice <= smileSeriesFromMatrix[smileSeriesFromMatrix.length - 1].strike && (
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
              )}
            </DataCard>
          )}

          {phase === "done" && surfaceData && !error && (
            <DataCard
              title={`Matrice IV (Strike × DTE) — ${activeType === "call" ? "Calls" : "Puts"}`}
              actions={
                <span className="text-xs text-muted-foreground">
                  {surfaceData.strikes.length} strikes × {surfaceData.dtes.length} DTE
                </span>
              }
            >
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-table-header border-b border-table">
                      <th className="px-2 py-1.5 text-left text-muted-foreground uppercase tracking-wider sticky left-0 bg-table-header z-10">
                        Strike \ DTE
                      </th>
                      {surfaceData.dtes.map((dte, i) => (
                        <th
                          key={dte}
                          className="px-2 py-1.5 text-center text-muted-foreground"
                          title={surfaceData.maturityLabels[i]}
                        >
                          {dte}d
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {surfaceData.strikes.map((strike, si) => (
                      <tr key={strike} className="hover:bg-table-row-hover transition-colors">
                        <td className="px-2 py-1 font-semibold text-foreground sticky left-0 bg-background z-10 border-r border-border">
                          {strike}
                        </td>
                        {surfaceData.dtes.map((_, di) => {
                          const val = surfaceData.z[di]?.[si];
                          return (
                            <td
                              key={di}
                              className={`px-2 py-1 text-center ${
                                val !== null ? "text-warning" : "text-muted-foreground/30"
                              }`}
                            >
                              {val !== null ? val.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}

          {phase === "done" && !surfaceData && !error && points.length === 0 && strikeRange && (
            <EmptyState message="Aucune donnée IV pour l'intervalle sélectionné." />
          )}
        </>
      )}

      {phase === "done" && error && points.length === 0 && !strikeRange && (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      )}
    </div>
  );
}
