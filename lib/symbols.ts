/* Symbol resolution.
   ────────────────────────────────────────────────────────────────
   Backed by NSE's own EQUITY_L.csv, committed to /data. Parsed once
   per process into an in-memory index — no network, no cache tier,
   no failure mode. Search must work when everything else is down.

   The not-found path is a first-class result, not an exception:
   "SODEXO" returns suggestions and never throws (Part 3.1). */

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

export type Symbol = {
  symbol: string;
  name: string;
  /** Yahoo needs the .NS suffix; TradingView must NOT get it. */
  yahooTicker: string;
  /**
   * The string the TradingView embed actually renders.
   *
   * NOT "NSE:<symbol>". Verified in a browser against the live
   * widget: NSE symbols return "This symbol is only available on
   * TradingView" with O/H/L/C all null, on advanced-chart,
   * symbol-overview and mini-chart alike. NSE data is entitled to
   * subscribers. BSE data is not — BSE:RELIANCE renders real candles
   * on the free embed.
   *
   * Nearly every liquid Indian company is dual-listed, so the BSE
   * feed shows the same company. The payload says so explicitly
   * (`tradingViewExchange`, `tradingViewNote`) rather than quietly
   * swapping exchanges behind a caption that reads NSE.
   */
  tradingViewSymbol: string;
  /** Which exchange the TradingView chart is actually showing. */
  tradingViewExchange: 'BSE' | 'NSE';
  /** The exchange everything ELSE on the page comes from. */
  exchange: 'NSE' | 'BSE';
  isin: string;
  listedOn: string | null;
};

export const TRADINGVIEW_NOTE =
  'TradingView’s free embed does not serve NSE data. This chart shows the ' +
  'BSE listing of the same company; every other number on this page is NSE.';

export type ResolveResult =
  | { found: true; symbol: Symbol; alias?: { from: string; note: string } }
  | { found: false; query: string; suggestions: Symbol[] };

type Row = Record<string, string>;

let INDEX: Symbol[] | null = null;
let BY_SYMBOL: Map<string, Symbol> | null = null;

/** Tickers NSE has renamed. A legacy symbol resolves to its
    successor with a note, rather than dead-ending on a name the user
    reasonably still knows the company by. */
function aliases(): Record<string, { to: string; note: string }> {
  try {
    const p = path.join(process.cwd(), 'data', 'symbol-aliases.json');
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as {
      aliases: Record<string, { to: string; note: string }>;
    };
    return raw.aliases ?? {};
  } catch {
    return {};
  }
}

let ALIASES: Record<string, { to: string; note: string }> | null = null;

/** TradingView occasionally disagrees with NSE on a ticker string. */
function overrides(): Record<string, string> {
  try {
    const p = path.join(process.cwd(), 'data', 'tv-overrides.json');
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as {
      overrides: Record<string, string>;
    };
    return raw.overrides ?? {};
  } catch {
    return {};
  }
}

function load(): Symbol[] {
  if (INDEX) return INDEX;

  const csvPath = path.join(process.cwd(), 'data', 'nse-symbols.csv');
  const csv = fs.readFileSync(csvPath, 'utf8');

  const parsed = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: true,
    // NSE's header row has leading spaces: " SERIES", " ISIN NUMBER".
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const tv = overrides();

  const rows = (parsed.data ?? []).filter((r) => r['SERIES'] === 'EQ' && r['SYMBOL']);

  INDEX = rows.map((r) => {
    const symbol = r['SYMBOL'];
    const override = tv[symbol];
    const tvSymbol = override ?? `BSE:${symbol}`;
    return {
      symbol,
      name: r['NAME OF COMPANY'] ?? symbol,
      yahooTicker: `${symbol}.NS`,
      tradingViewSymbol: tvSymbol,
      tradingViewExchange: tvSymbol.startsWith('NSE:') ? ('NSE' as const) : ('BSE' as const),
      exchange: 'NSE' as const,
      isin: r['ISIN NUMBER'] ?? '',
      listedOn: r['DATE OF LISTING'] || null,
    };
  });

  BY_SYMBOL = new Map(INDEX.map((s) => [s.symbol, s]));
  return INDEX;
}

export function allSymbols(): Symbol[] {
  return load();
}

export function symbolCount(): number {
  return load().length;
}

/** Strip corporate suffixes so "Reliance Industries Limited" and
    "reliance" compare sensibly. */
export function normaliseName(s: string): string {
  return s
    .toUpperCase()
    .replace(/[.,&'’"()-]/g, ' ')
    .replace(/\b(LIMITED|LTD|INDUSTRIES|CORPORATION|CORP|COMPANY|CO|INDIA|THE|PLC|INC)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSymbol(sym: string): Symbol | null {
  load();
  return BY_SYMBOL!.get(String(sym || '').trim().toUpperCase()) ?? null;
}

/**
 * Ranked search. Exact ticker first, then ticker prefix, then name
 * prefix, then word-start inside the name, then any substring.
 * The rank ordering is what makes "TA" surface TATAMOTORS ahead of
 * ASIANPAINT even though both contain the letters.
 */
export function searchSymbols(query: string, limit = 8): Symbol[] {
  const list = load();
  const raw = String(query || '').trim().toUpperCase();
  if (!raw) return [];
  const norm = normaliseName(raw);

  type Scored = { s: Symbol; rank: number };
  const out: Scored[] = [];

  for (const s of list) {
    const t = s.symbol.toUpperCase();
    const n = s.name.toUpperCase();
    const nn = normaliseName(s.name);
    let rank = -1;

    if (t === raw) rank = 0;
    else if (t.startsWith(raw)) rank = 1;
    else if (nn.startsWith(norm) && norm.length > 0) rank = 2;
    else if (n.startsWith(raw)) rank = 3;
    else if (new RegExp(`\\b${escapeRe(norm)}`).test(nn) && norm.length > 1) rank = 4;
    else if (t.includes(raw)) rank = 5;
    else if (n.includes(raw)) rank = 6;

    if (rank >= 0) out.push({ s, rank });
    if (out.length > 4000) break;
  }

  out.sort((a, b) => a.rank - b.rank || a.s.symbol.length - b.s.symbol.length || a.s.symbol.localeCompare(b.s.symbol));
  return out.slice(0, limit).map((o) => o.s);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Damerau-free Levenshtein, capped — enough for "SODEXO" → "SOLEX". */
function editDistance(a: string, b: string, cap = 6): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > cap) return cap + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/**
 * Nearest listed symbols to something that isn't listed. Used by the
 * NOT LISTED state, which must always offer a way forward.
 */
export function suggestSymbols(query: string, limit = 3): Symbol[] {
  const list = load();
  const raw = String(query || '').trim().toUpperCase();
  if (!raw) return [];
  const norm = normaliseName(raw);

  // A partial-match search first — usually better than pure edit distance.
  const partial = searchSymbols(raw, limit);
  if (partial.length >= limit) return partial;

  const scored = list
    .map((s) => {
      const dSym = editDistance(raw, s.symbol.toUpperCase());
      const dName = editDistance(norm, normaliseName(s.name));
      return { s, d: Math.min(dSym, dName) };
    })
    .filter((x) => x.d <= 6)
    .sort((a, b) => a.d - b.d || a.s.symbol.localeCompare(b.s.symbol));

  const seen = new Set(partial.map((p) => p.symbol));
  const merged = [...partial];
  for (const { s } of scored) {
    if (seen.has(s.symbol)) continue;
    merged.push(s);
    seen.add(s.symbol);
    if (merged.length >= limit) break;
  }
  return merged.slice(0, limit);
}

/** The single entry point every route uses. Never throws. */
export function resolveSymbol(input: string): ResolveResult {
  const query = String(input || '').trim();
  if (!query) return { found: false, query, suggestions: [] };

  const direct = getSymbol(query);
  if (direct) return { found: true, symbol: direct };

  // A ticker NSE has renamed — answer it, and say what happened.
  if (!ALIASES) ALIASES = aliases();
  const alias = ALIASES[query.toUpperCase()];
  if (alias && alias.note) {
    const target = getSymbol(alias.to);
    if (target) {
      return { found: true, symbol: target, alias: { from: query.toUpperCase(), note: alias.note } };
    }
  }

  // Accept a Yahoo ticker too, so callers can round-trip.
  const stripped = query.toUpperCase().replace(/\.(NS|BO)$/, '');
  const viaTicker = getSymbol(stripped);
  if (viaTicker) return { found: true, symbol: viaTicker };

  // An unambiguous exact name match still counts as found.
  const hits = searchSymbols(query, 1);
  if (hits.length === 1 && normaliseName(hits[0].name) === normaliseName(query)) {
    return { found: true, symbol: hits[0] };
  }

  return { found: false, query, suggestions: suggestSymbols(query, 3) };
}
