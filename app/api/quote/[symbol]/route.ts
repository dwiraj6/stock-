/* GET /api/quote/:symbol
   TTL 30s while OPEN, 60s PRE_OPEN, until next open otherwise. */
import { NextRequest } from 'next/server';
import { ok, fail, guard, logTier, marketBlock } from '@/lib/api';
import { resolveSymbol } from '@/lib/symbols';
import { fetchQuote } from '@/lib/market-data';
import { getMarketStatus, delayMinutesFor } from '@/lib/market-hours';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { symbol: string } }) {
  return guard('quote', async () => {
    const r = resolveSymbol(ctx.params.symbol);
    if (!r.found) {
      return fail(
        'SYMBOL_NOT_FOUND',
        `${ctx.params.symbol.toUpperCase()} isn’t listed on NSE or BSE.`,
        'Pick one of the suggested symbols, or search again.',
        {
          suggestions: r.suggestions.map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })),
        }
      );
    }

    const status = getMarketStatus();
    const res = await fetchQuote(r.symbol);

    if (!res) {
      return fail(
        'UPSTREAM_UNAVAILABLE',
        `No price data is available for ${r.symbol.symbol} right now.`,
        'The upstream feed is unreachable and nothing is cached for this symbol yet. Try again in a moment.',
        { meta: undefined }
      );
    }

    logTier('quote', r.symbol.symbol, res.meta);

    return ok(
      {
        symbol: r.symbol.symbol,
        name: r.symbol.name,
        tradingViewSymbol: r.symbol.tradingViewSymbol,
        tradingViewExchange: r.symbol.tradingViewExchange,
        exchange: r.symbol.exchange,
        ...(r.alias ? { renamedFrom: r.alias } : {}),
        quote: res.data,
        delayMinutes: delayMinutesFor(status.marketState),
        ...marketBlock(),
        meta: res.meta,
      },
      { ttlSeconds: status.quoteTtlSeconds }
    );
  });
}
