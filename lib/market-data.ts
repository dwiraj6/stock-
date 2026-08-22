/* The fetch chain.
   ────────────────────────────────────────────────────────────────
   memory → Mongo → Yahoo → Twelve Data → stale Mongo

   Four disciplines protect the upstream (Part 2.4):
     · an in-memory LRU in front of Mongo, so a hot symbol never
       makes a repeat network call inside its TTL
     · request coalescing — concurrent callers for the same key share
       one in-flight promise instead of racing N identical fetches
     · a global token bucket capping outbound Yahoo calls at 4/sec
     · exponential backoff on 429 (1s, 2s, 4s) before falling to the
       next tier

   Nothing here throws upward. Every function returns data plus the
   tier that served it, or a typed failure the route can render. */

import YahooFinance from 'yahoo-finance2';
import { cacheGet, cacheSet } from './mongo';
import { getMarketStatus, delayMinutesFor } from './market-hours';
import type { Bar, Fundamentals, Meta, Quote, SourceTier } from './types';
import type { Symbol as SymbolRec } from './symbols';

const yf: any = new (YahooFinance as any)({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false, logOptionsErrors: false },
});

/* ── in-memory LRU ────────────────────────────────────────────── */

type Entry<T> = { value: T; at: number; source: SourceTier };
const MEM = new Map<string, Entry<unknown>>();
const MEM_MAX = 400;

function memGet<T>(key: string, ttlMs: number): Entry<T> | null {
  const e = MEM.get(key) as Entry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.at > ttlMs) return null;
  // refresh recency
  MEM.delete(key);
  MEM.set(key, e as Entry<unknown>);
  return e;
}

function memSet<T>(key: string, value: T, source: SourceTier): void {
  if (MEM.size >= MEM_MAX) {
    const oldest = MEM.keys().next().value;
    if (oldest !== undefined) MEM.delete(oldest);
  }
  MEM.set(key, { value, at: Date.now(), source });
}

/* ── request coalescing ───────────────────────────────────────── */

const INFLIGHT = new Map<string, Promise<unknown>>();

function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = INFLIGHT.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => INFLIGHT.delete(key));
  INFLIGHT.set(key, p as Promise<unknown>);
  return p;
}

/* ── global rate limit: 4 outbound Yahoo calls/second ─────────── */

const RATE = { capacity: 4, tokens: 4, refillPerMs: 4 / 1000, last: Date.now() };

async function takeToken(): Promise<void> {
  for (;;) {
    const now = Date.now();
    RATE.tokens = Math.min(RATE.capacity, RATE.tokens + (now - RATE.last) * RATE.refillPerMs);
    RATE.last = now;
    if (RATE.tokens >= 1) {
      RATE.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - RATE.tokens) / RATE.refillPerMs);
    await sleep(Math.max(25, Math.min(waitMs, 1000)));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimited(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err);
  return /429|too many requests|rate.?limit/i.test(m);
}

/** Call Yahoo with the token bucket and 1s/2s/4s backoff on 429. */
async function yahooCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    await takeToken();
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRateLimited(err) || attempt === 3) break;
      const backoff = 1000 * Math.pow(2, attempt);
      console.warn(`[stockshishya] yahoo 429 on ${label}; backing off ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/* ── numeric hygiene ──────────────────────────────────────────── */

/**
 * Yahoo hands back numbers, `{ raw }` objects, undefined, and NaN
 * depending on the module. Anything that is not a finite number
 * becomes null — never a substitute, never a zero (Part 0.1).
 */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object' && v !== null && 'raw' in (v as Record<string, unknown>)) {
    return num((v as { raw: unknown }).raw);
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/* ── meta helper ──────────────────────────────────────────────── */

export function makeMeta(
  source: SourceTier,
  fetchedAt: Date,
  opts: { isCached?: boolean; isStale?: boolean; degraded?: boolean; note?: string } = {}
): Meta {
  const status = getMarketStatus();
  return {
    source,
    fetchedAt: fetchedAt.toISOString(),
    isCached: opts.isCached ?? false,
    isStale: opts.isStale ?? false,
    degraded: opts.degraded ?? false,
    delayMinutes: source === 'cache' ? 0 : delayMinutesFor(status.marketState),
    ...(opts.note ? { note: opts.note } : {}),
  };
}

export type Fetched<T> = { data: T; meta: Meta };

/* ══════════════════════════════════════════════════════════════
   QUOTE
   ══════════════════════════════════════════════════════════════ */

function mapQuote(raw: any, rec: SymbolRec): Quote {
  return {
    symbol: rec.symbol,
    name: str(raw?.longName) ?? str(raw?.shortName) ?? rec.name,
    price: num(raw?.regularMarketPrice),
    change: num(raw?.regularMarketChange),
    changePercent: num(raw?.regularMarketChangePercent),
    dayHigh: num(raw?.regularMarketDayHigh),
    dayLow: num(raw?.regularMarketDayLow),
    open: num(raw?.regularMarketOpen),
    previousClose: num(raw?.regularMarketPreviousClose),
    volume: num(raw?.regularMarketVolume),
    marketCap: num(raw?.marketCap),
    fiftyTwoWeekHigh: num(raw?.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(raw?.fiftyTwoWeekLow),
    currency: str(raw?.currency) ?? 'INR',
    exchange: str(raw?.fullExchangeName) ?? rec.exchange,
  };
}

/** Twelve Data fallback — same shape, fewer fields. Missing → null. */
async function twelveQuote(rec: SymbolRec): Promise<Quote | null> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(rec.symbol)}&exchange=NSE&apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j: any = await res.json();
    if (!j || j.status === 'error' || j.code >= 400) return null;
    return {
      symbol: rec.symbol,
      name: str(j.name) ?? rec.name,
      price: num(j.close),
      change: num(j.change),
      changePercent: num(j.percent_change),
      dayHigh: num(j.high),
      dayLow: num(j.low),
      open: num(j.open),
      previousClose: num(j.previous_close),
      volume: num(j.volume),
      marketCap: null,
      fiftyTwoWeekHigh: num(j.fifty_two_week?.high),
      fiftyTwoWeekLow: num(j.fifty_two_week?.low),
      currency: str(j.currency) ?? 'INR',
      exchange: 'NSE',
    };
  } catch {
    return null;
  }
}

export async function fetchQuote(rec: SymbolRec): Promise<Fetched<Quote> | null> {
  const status = getMarketStatus();
  const softTtl = status.quoteTtlSeconds;
  const key = `quote:${rec.symbol}`;

  const mem = memGet<Quote>(key, softTtl * 1000);
  if (mem) return { data: mem.value, meta: makeMeta(mem.source, new Date(mem.at), { isCached: true }) };

  return coalesce(key, async () => {
    const cached = await cacheGet<Quote>('quotes', rec.symbol, softTtl);
    if (cached && !cached.isStale) {
      memSet(key, cached.data, 'cache');
      return {
        data: cached.data,
        meta: makeMeta('cache', cached.fetchedAt, { isCached: true }),
      };
    }

    try {
      const raw = await yahooCall<any>(`quote ${rec.symbol}`, () => yf.quote(rec.yahooTicker));
      if (raw && num(raw.regularMarketPrice) !== null) {
        const q = mapQuote(raw, rec);
        memSet(key, q, 'yahoo');
        await cacheSet('quotes', rec.symbol, q, 'yahoo');
        return { data: q, meta: makeMeta('yahoo', new Date()) };
      }
    } catch (err) {
      console.warn(`[stockshishya] yahoo quote failed for ${rec.symbol}: ${(err as Error).message}`);
    }

    const td = await twelveQuote(rec);
    if (td && td.price !== null) {
      memSet(key, td, 'twelvedata');
      await cacheSet('quotes', rec.symbol, td, 'twelvedata');
      return { data: td, meta: makeMeta('twelvedata', new Date(), { degraded: true }) };
    }

    // Last resort: whatever Mongo still holds, however old.
    if (cached) {
      memSet(key, cached.data, 'cache');
      return {
        data: cached.data,
        meta: makeMeta('cache', cached.fetchedAt, {
          isCached: true,
          isStale: true,
          degraded: true,
          note: 'Upstream unavailable — serving the last cached quote.',
        }),
      };
    }
    return null;
  });
}

/* ══════════════════════════════════════════════════════════════
   HISTORY
   ══════════════════════════════════════════════════════════════ */

function mapBars(quotes: any[]): Bar[] {
  const out: Bar[] = [];
  for (const b of quotes ?? []) {
    const close = num(b?.close);
    // Yahoo appends an in-progress bar with null close for the
    // current session. Including it would poison every return series.
    if (close === null) continue;
    const adj = num(b?.adjclose) ?? close;
    const open = num(b?.open);
    const high = num(b?.high);
    const low = num(b?.low);
    if (open === null || high === null || low === null) continue;
    const d = b?.date instanceof Date ? b.date : new Date(b?.date);
    if (Number.isNaN(d.getTime())) continue;
    out.push({
      date: d.toISOString(),
      open,
      high,
      low,
      close,
      adjClose: adj,
      volume: num(b?.volume) ?? 0,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export async function fetchHistory(rec: SymbolRec, years = 3): Promise<Fetched<Bar[]> | null> {
  const key = `hist:${rec.symbol}:${years}`;
  const softTtl = 900;

  const mem = memGet<Bar[]>(key, softTtl * 1000);
  if (mem) return { data: mem.value, meta: makeMeta(mem.source, new Date(mem.at), { isCached: true }) };

  return coalesce(key, async () => {
    const cacheKey = `${rec.symbol}:${years}y`;
    const cached = await cacheGet<Bar[]>('stocks', cacheKey, softTtl);
    if (cached && !cached.isStale && cached.data?.length) {
      memSet(key, cached.data, 'cache');
      return { data: cached.data, meta: makeMeta('cache', cached.fetchedAt, { isCached: true }) };
    }

    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - years);

    try {
      const chart = await yahooCall<any>(`chart ${rec.symbol}`, () =>
        yf.chart(rec.yahooTicker, { period1, interval: '1d' })
      );
      const bars = mapBars(chart?.quotes ?? []);
      if (bars.length > 0) {
        memSet(key, bars, 'yahoo');
        await cacheSet('stocks', cacheKey, bars, 'yahoo');
        return { data: bars, meta: makeMeta('yahoo', new Date()) };
      }
    } catch (err) {
      console.warn(`[stockshishya] yahoo chart failed for ${rec.symbol}: ${(err as Error).message}`);
    }

    if (cached?.data?.length) {
      memSet(key, cached.data, 'cache');
      return {
        data: cached.data,
        meta: makeMeta('cache', cached.fetchedAt, {
          isCached: true,
          isStale: true,
          degraded: true,
          note: 'Upstream unavailable — serving cached price history.',
        }),
      };
    }
    return null;
  });
}

/* ══════════════════════════════════════════════════════════════
   FUNDAMENTALS
   ══════════════════════════════════════════════════════════════ */

const SUMMARY_MODULES = [
  'summaryDetail',
  'defaultKeyStatistics',
  'financialData',
  'assetProfile',
  'incomeStatementHistoryQuarterly',
];

function mapFundamentals(s: any): Fundamentals {
  const sd = s?.summaryDetail ?? {};
  const ks = s?.defaultKeyStatistics ?? {};
  const fd = s?.financialData ?? {};
  const ap = s?.assetProfile ?? {};

  /* Yahoo reports debtToEquity as a PERCENTAGE (36.653 means 0.37).
     Passing it through as a ratio would claim Reliance is 36x
     levered and would wreck the financial-health subscore. */
  const deRaw = num(fd.debtToEquity);
  const debtToEquity = deRaw === null ? null : deRaw / 100;

  const q = s?.incomeStatementHistoryQuarterly?.incomeStatementHistory;
  const quarterlyEarnings = Array.isArray(q) && q.length
    ? q
        .map((row: any) => ({
          date: (row?.endDate instanceof Date ? row.endDate : new Date(row?.endDate))?.toISOString?.() ?? '',
          netIncome: num(row?.netIncome),
        }))
        .filter((r: { date: string }) => r.date)
    : null;

  return {
    trailingPE: num(sd.trailingPE),
    priceToBook: num(ks.priceToBook),
    debtToEquity,
    returnOnEquity: num(fd.returnOnEquity),
    profitMargins: num(fd.profitMargins),
    dividendYield: num(sd.dividendYield),
    bookValue: num(ks.bookValue),
    sector: str(ap.sector),
    industry: str(ap.industry),
    earningsGrowth: num(fd.earningsGrowth),
    revenueGrowth: num(fd.revenueGrowth),
    totalDebt: num(fd.totalDebt),
    freeCashflow: num(fd.freeCashflow),
    marketCap: num(sd.marketCap) ?? num(ks.marketCap),
    quarterlyEarnings,
  };
}

export async function fetchFundamentals(rec: SymbolRec): Promise<Fetched<Fundamentals> | null> {
  const key = `fund:${rec.symbol}`;
  const softTtl = 900;

  const mem = memGet<Fundamentals>(key, softTtl * 1000);
  if (mem) return { data: mem.value, meta: makeMeta(mem.source, new Date(mem.at), { isCached: true }) };

  return coalesce(key, async () => {
    const cacheKey = `${rec.symbol}:fundamentals`;
    const cached = await cacheGet<Fundamentals>('stocks', cacheKey, softTtl);
    if (cached && !cached.isStale) {
      memSet(key, cached.data, 'cache');
      return { data: cached.data, meta: makeMeta('cache', cached.fetchedAt, { isCached: true }) };
    }

    try {
      const s = await yahooCall<any>(`quoteSummary ${rec.symbol}`, () =>
        yf.quoteSummary(rec.yahooTicker, { modules: SUMMARY_MODULES })
      );
      if (s) {
        const f = mapFundamentals(s);
        memSet(key, f, 'yahoo');
        await cacheSet('stocks', cacheKey, f, 'yahoo');
        return { data: f, meta: makeMeta('yahoo', new Date()) };
      }
    } catch (err) {
      console.warn(`[stockshishya] yahoo quoteSummary failed for ${rec.symbol}: ${(err as Error).message}`);
    }

    if (cached) {
      memSet(key, cached.data, 'cache');
      return {
        data: cached.data,
        meta: makeMeta('cache', cached.fetchedAt, {
          isCached: true,
          isStale: true,
          degraded: true,
          note: 'Upstream unavailable — serving cached fundamentals.',
        }),
      };
    }
    return null;
  });
}

/** Exposed for the news module, which needs the same discipline. */
export async function yahooSearch(query: string): Promise<any | null> {
  try {
    return await yahooCall<any>(`search ${query}`, () =>
      yf.search(query, { newsCount: 12, quotesCount: 1 })
    );
  } catch (err) {
    console.warn(`[stockshishya] yahoo search failed for ${query}: ${(err as Error).message}`);
    return null;
  }
}

export const __testing = { num, mapBars, mapFundamentals };
