const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// CME month codes
const MONTH_CODES: Record<string, string> = {
  jan: 'F', feb: 'G', mar: 'H', apr: 'J', may: 'K', jun: 'M',
  jul: 'N', aug: 'Q', sep: 'U', oct: 'V', nov: 'X', dec: 'Z',
};

function monthValueToSymbol(baseSymbol: string, monthValue: string): string | null {
  // monthValue like "mar-26" or "sep-26"
  const match = monthValue.match(/^([a-z]{3})-(\d{2})$/);
  if (!match) return null;
  const monthCode = MONTH_CODES[match[1]];
  if (!monthCode) return null;
  // Extract root symbol (e.g. "E6" from "E6H26")
  const root = baseSymbol.replace(/[A-Z]\d{2}$/, '');
  return `${root}${monthCode}${match[2]}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { futureSymbol, optionSymbol, moneyness, strikesOnly, strikeMin, strikeMax } = await req.json();

    if (!futureSymbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'futureSymbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mn = moneyness || 50;
    const optSym = optionSymbol || futureSymbol;

    // Step 1: Scrape the default page
    const defaultMarkdown = await scrapeVolPage(apiKey, futureSymbol, optSym, mn);
    const defaultResult = parseVolatilityData(defaultMarkdown);

    // If strikesOnly mode, just return available strikes from default page
    if (strikesOnly) {
      const allStrikes = new Set<number>();
      for (const row of [...defaultResult.calls, ...defaultResult.puts]) {
        const s = parseStrike(row.strike);
        if (s !== null) allStrikes.add(s);
      }
      const strikes = [...allStrikes].sort((a, b) => a - b);
      console.log(`strikesOnly: returning ${strikes.length} strikes`);
      return new Response(
        JSON.stringify({ success: true, strikes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get expirations
    let expirations = parseLinkExpirations(defaultMarkdown);
    if (expirations.length === 0) {
      const monthExps = parseMonthExpirations(defaultMarkdown);
      expirations = monthExps
        .map(exp => {
          const sym = monthValueToSymbol(futureSymbol, exp.value);
          return sym ? { label: exp.label, value: sym } : null;
        })
        .filter((e): e is { label: string; value: string } => e !== null);
    }
    expirations = expirations.filter(e => e.value !== optSym);
    console.log(`Found ${expirations.length} additional expirations, ${defaultResult.calls.length} calls from default`);

    const surfacePoints: SurfacePoint[] = [];

    // Filter function for strike range
    const inRange = (strike: number) => {
      if (strikeMin !== undefined && strike < strikeMin) return false;
      if (strikeMax !== undefined && strike > strikeMax) return false;
      return true;
    };

    // Add default maturity data (filtered)
    addPointsFromGreeks(surfacePoints, defaultResult,
      defaultResult.metadata.daysToExpiration || 0,
      defaultResult.metadata.expirationDate || 'Current', inRange);

    // Step 2: Scrape ALL available maturities
    const maxMaturities = expirations.length;

    for (let i = 0; i < maxMaturities; i++) {
      const exp = expirations[i];
      console.log(`Step 2.${i + 1}: Scraping maturity ${exp.label} → ${exp.value}`);

      try {
        const matMarkdown = await scrapeVolPage(apiKey, futureSymbol, exp.value, mn);
        const matResult = parseVolatilityData(matMarkdown);
        const dte = matResult.metadata.daysToExpiration || ((i + 1) * 30 + (defaultResult.metadata.daysToExpiration || 0));
        console.log(`  → ${matResult.calls.length} calls, ${matResult.puts.length} puts, DTE=${dte}`);

        addPointsFromGreeks(surfacePoints, matResult, dte, exp.label, inRange);
      } catch (err) {
        console.error(`Error scraping maturity ${exp.label}:`, err);
      }
    }

    console.log(`Total surface points: ${surfacePoints.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        surfacePoints,
        expirations: expirations.slice(0, maxMaturities),
        totalMaturities: maxMaturities + (defaultResult.calls.length > 0 ? 1 : 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function scrapeVolPage(apiKey: string, futureSymbol: string, symbolPart: string, moneyness: number): Promise<string> {
  const params = new URLSearchParams();
  params.set('futuresOptionsView', 'merged');
  params.set('moneyness', String(moneyness));
  const url = `https://www.barchart.com/futures/quotes/${futureSymbol}/volatility-greeks/${symbolPart}?${params.toString()}`;
  console.log(`Scraping: ${url}`);

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 12000,
    }),
  });

  const data = await response.json();
  return data.data?.markdown || data.markdown || '';
}

// Types
interface SurfacePoint {
  strike: number;
  dte: number;
  iv: number;
  maturityLabel: string;
  type: 'call' | 'put';
}

interface GreekRow { strike: string; type: string; iv: string; }
interface ParsedData {
  calls: GreekRow[];
  puts: GreekRow[];
  metadata: { daysToExpiration?: number; expirationDate?: string };
}

function addPointsFromGreeks(points: SurfacePoint[], data: ParsedData, dte: number, maturityLabel: string, inRange: (s: number) => boolean = () => true) {
  for (const row of data.calls) {
    const strike = parseStrike(row.strike);
    const iv = parseIV(row.iv);
    if (strike !== null && iv !== null && iv > 0 && inRange(strike)) points.push({ strike, dte, iv, maturityLabel, type: 'call' });
  }
  for (const row of data.puts) {
    const strike = parseStrike(row.strike);
    const iv = parseIV(row.iv);
    if (strike !== null && iv !== null && iv > 0 && inRange(strike)) points.push({ strike, dte, iv, maturityLabel, type: 'put' });
  }
}

function parseStrike(s: string): number | null {
  // Remove thousands separators
  const clean = s.replace(/,/g, '');
  if (clean.includes('-')) {
    const parts = clean.split('-');
    const whole = parseFloat(parts[0]);
    const frac = parseFloat(parts[1]?.replace(/\D/g, '') || '0');
    if (isNaN(whole)) return null;
    return whole + frac / (frac >= 10 ? 100 : 10);
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseIV(s: string): number | null {
  if (!s || s === 'N/A') return null;
  const clean = s.replace(/[%+]/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseLinkExpirations(markdown: string): Array<{ label: string; value: string }> {
  const expirations: Array<{ label: string; value: string }> = [];
  const expSet = new Set<string>();
  for (const line of markdown.split('\n')) {
    const expPattern = /\[([^\]]+)\]\(https:\/\/www\.barchart\.com\/futures\/quotes\/[A-Za-z0-9]+\/volatility-greeks\/([A-Za-z0-9]+)\)/gi;
    let match;
    while ((match = expPattern.exec(line)) !== null) {
      const label = match[1].trim();
      const value = match[2];
      if (!expSet.has(value)) {
        expSet.add(value);
        expirations.push({ label, value });
      }
    }
  }
  return expirations;
}

function parseMonthExpirations(markdown: string): Array<{ label: string; value: string }> {
  const expirations: Array<{ label: string; value: string }> = [];
  for (const line of markdown.split('\n')) {
    const monthPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(20\d{2})/g;
    let match;
    const matches: Array<{ label: string; value: string }> = [];
    while ((match = monthPattern.exec(line)) !== null) {
      const month = match[1].toLowerCase();
      const year = match[2].substring(2);
      matches.push({ label: `${match[1]} '${year}`, value: `${month}-${year}` });
    }
    if (matches.length >= 3) {
      for (const m of matches) {
        if (!expirations.find(e => e.value === m.value)) {
          expirations.push(m);
        }
      }
    }
  }
  return expirations;
}

function parseVolatilityData(markdown: string): ParsedData {
  const calls: GreekRow[] = [];
  const puts: GreekRow[] = [];
  const metadata: { daysToExpiration?: number; expirationDate?: string } = {};
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const strikeLineRe = /^(\d[\d,]*[\.\-]\d+\w?|\d[\d,]+)$/;
  const valueLineRe = /^[-+]?[\d,.]+(?:[\.\-]\d+)?\w?%?s?$/;

  for (const line of lines) {
    const dteMatch = line.match(/\*?\*?(\d+)\s*Days?\*?\*?\s*to\s*expiration\s*on\s*\*?\*?(\S+)\*?\*?/i);
    if (dteMatch) {
      metadata.daysToExpiration = parseInt(dteMatch[1]);
      metadata.expirationDate = dteMatch[2];
    }
  }

  let section: 'calls' | 'puts' | 'unknown' = 'unknown';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '#### Calls' || lines[i].toLowerCase() === 'calls') { section = 'calls'; continue; }
    if (lines[i] === '#### Puts' || lines[i].toLowerCase() === 'puts') { section = 'puts'; continue; }

    const strikeMatch = lines[i].match(strikeLineRe);
    if (!strikeMatch) continue;
    const nextLine = lines[i + 1];
    if (!nextLine || (nextLine !== 'Call' && nextLine !== 'Put')) continue;

    const strike = strikeMatch[1];
    const type = nextLine;
    const targetSection = section !== 'unknown' ? section : (type === 'Call' ? 'calls' : 'puts');

    const values: string[] = [];
    let j = i + 2;
    while (j < lines.length && values.length < 8) {
      const line = lines[j];
      if (strikeLineRe.test(line) && lines[j + 1] && (lines[j + 1] === 'Call' || lines[j + 1] === 'Put')) break;
      if (line.startsWith('####')) break;
      if (line === 'false') { j++; continue; }
      if (['Strike', 'Type', 'Latest', 'IV', 'Delta', 'Gamma', 'Theta', 'Vega', 'Links', 'Last Trade', 'IV Skew'].includes(line)) { j++; continue; }
      if (line.startsWith('![')) { j++; continue; }
      if (valueLineRe.test(line) || /^\d{2}\/\d{2}\/\d{2}$/.test(line) || /^\d+:\d+/.test(line) || /^N\/A$/i.test(line) || /^unch$/i.test(line)) {
        values.push(line.replace(/s$/, ''));
      }
      j++;
    }

    if (values.length >= 6) {
      const row: GreekRow = { strike, type, iv: values[1] || 'N/A' };
      if (targetSection === 'puts') puts.push(row);
      else calls.push(row);
    }
  }

  return { calls, puts, metadata };
}
