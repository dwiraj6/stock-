/* GET /api/stock/:symbol
   Profile, fundamentals with sector medians, OHLC history, and the
   TradingView symbol string. TTL 15m. */
import { NextRequest } from 'next/server';
import { ok, fail, guard, logTier, marketBlock } from '@/lib/api';
import { resolveSymbol, TRADINGVIEW_NOTE } from '@/lib/symbols';
import { fetchFundamentals, fetchHistory, fetchQuote } from '@/lib/market-data';
import { medianFor, sectorMedians } from '@/lib/score';

export const dynamic = 'force-dynamic';

const MEDIAN_METRICS = [
  'trailingPE',
  'priceToBook',
  'debtToEquity',
  'returnOnEquity',
  'profitMargins',
  'dividendYield',
] as const;

export async function GET(req: NextRequest, ctx: { params: { symbol: string } }) {
  return guard('stock', async () => {
    const r = resolveSymbol(ctx.params.symbol);
    if (!r.found) {
      return fail('SYMBOL_NOT_FOUND', `${ctx.params.symbol.toUpperCase()} isn’t listed on NSE or BSE.`,
        'Pick one of the suggested symbols, or search again.',
        { suggestions: r.suggestions.map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })) });
    }
    const rec = r.symbol;
    const years = Math.min(10, Math.max(1, Number(req.nextUrl.searchParams.get('years') ?? 3) || 3));

    const [hist, fund, quote] = await Promise.all([
      fetchHistory(rec, years),
      fetchFundamentals(rec),
      fetchQuote(rec),
    ]);

    if (!hist || hist.data.length === 0) {
      return fail(
        'INSUFFICIENT_DATA',
        `No price history is available for ${rec.symbol}.`,
        'This symbol may be newly listed or suspended. Try another symbol.',
        { daysAvailable: 0 }
      );
    }

    logTier('stock', rec.symbol, hist.meta);

    const f = fund?.data ?? null;
    const medians = f?.sector
      ? Object.fromEntries(MEDIAN_METRICS.map((m) => [m, medianFor(f.sector, m)]))
      : null;
    const file = sectorMedians();

    const degraded = !fund || hist.meta.degraded || (fund?.meta.degraded ?? false);

    return ok(
      {
        profile: {
          symbol: rec.symbol,
          name: rec.name,
          exchange: rec.exchange,
          isin: rec.isin,
          listedOn: rec.listedOn,
          sector: f?.sector ?? null,
          industry: f?.industry ?? null,
          ...(r.alias ? { renamedFrom: r.alias } : {}),
        },
        /* The TradingView embed is fed the BSE listing: its free tier
           blocks NSE symbols outright. Both the exchange and the
           reason ship with the payload so the UI can say which
           exchange the chart is showing — the rest of the page is
           NSE, and silently mixing the two would be dishonest. */
        tradingViewSymbol: rec.tradingViewSymbol,
        tradingViewExchange: rec.tradingViewExchange,
        tradingViewNote: rec.tradingViewExchange === 'BSE' ? TRADINGVIEW_NOTE : null,
        tradingViewConfig: {
          symbol: rec.tradingViewSymbol,
          theme: 'light',
          locale: 'in',
          timezone: 'Asia/Kolkata',
          style: '1',
          hide_side_toolbar: false,
          allow_symbol_change: false,
        },
        quote: quote?.data ?? null,
        fundamentals: f,
        sectorMedians: medians,
        sectorMediansMeta: file
          ? {
              generatedAt: file.generatedAt,
              constituents: f?.sector ? file.sectors?.[f.sector]?.constituents ?? null : null,
            }
          : null,
        history: hist.data,
        daysAvailable: hist.data.length,
        ...marketBlock(),
        meta: { ...hist.meta, degraded },
      },
      { ttlSeconds: 900 }
    );
  });
}
