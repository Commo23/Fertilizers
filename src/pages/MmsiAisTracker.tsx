import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Radar } from "lucide-react";
import {
  connectMmsiAisTableStream,
  parseMmsiInput,
  type MmsiAisTableRow,
} from "@/services/mmsi-ais-table-stream";

export default function MmsiAisTracker() {
  const [input, setInput] = useState("");
  const [active, setActive] = useState(false);
  const [rows, setRows] = useState<MmsiAisTableRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    disconnectRef.current?.();
    disconnectRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    const list = parseMmsiInput(input);
    if (list.length === 0) {
      setError("Enter at least one valid MMSI (exactly 9 digits each), separated by commas.");
      return;
    }
    stop();
    setRows([]);
    setActive(true);
    disconnectRef.current = connectMmsiAisTableStream(
      list,
      (next) => setRows(next),
      (msg) => setError(msg),
    );
  }, [input, stop]);

  useEffect(() => {
    return () => {
      disconnectRef.current?.();
      disconnectRef.current = null;
    };
  }, []);

  return (
    <Layout
      title="MMSI vessel tracker"
      breadcrumbs={[
        { label: "Commodity Market", href: "/commodity-market" },
        { label: "MMSI vessel tracker" },
      ]}
    >
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-2">
          <Radar className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">MMSI vessel tracker</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Stream AIS by MMSI list (AISStream via Supabase <code className="text-xs">ais-mmsi-sse</code>). Separate
          from <strong>Live cargo AIS</strong> on the world map. Up to 50 MMSI; data updates as positions arrive.
        </p>

        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
          <div className="space-y-2">
            <Label htmlFor="mmsi-input">MMSI (comma-separated)</Label>
            <Input
              id="mmsi-input"
              placeholder="e.g. 310867000 (9 digits per MMSI)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={active}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {!active ? (
              <Button type="button" onClick={start}>
                Start streaming
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={stop}>
                Stop
              </Button>
            )}
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MMSI</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead className="text-right">Lat</TableHead>
                <TableHead className="text-right">Lon</TableHead>
                <TableHead className="text-right">SOG</TableHead>
                <TableHead className="text-right">COG</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground text-center py-8">
                    {active ? "Waiting for AIS messages…" : "Start streaming to see rows."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.mmsi}>
                    <TableCell className="font-mono">{r.mmsi}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.country ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.lat.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.lon.toFixed(4)}</TableCell>
                    <TableCell className="text-right">{r.sog.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{r.cog.toFixed(0)}°</TableCell>
                    <TableCell>{r.shipTypeLabel ?? "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate" title={r.destination ?? ""}>
                      {r.destination ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.updatedAt.toLocaleTimeString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
