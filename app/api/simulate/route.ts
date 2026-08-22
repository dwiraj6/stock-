/* POST /api/simulate  { symbol, amount, years? }
   Returns lumpsum AND SIP in one response so the frontend never
   makes two calls for one comparison. */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard, logTier } from '@/lib/api';
import { resolveSymbol } from '@/lib/symbols';
import { fetchHistory } from '@/lib/market-data';
import { estimateParams } from '@/lib/simulate';
import { buildSimPayload } from '@/lib/sim-payload';
import { cacheGet, cacheSet } from '@/lib/mongo';
import { istDateKey } from '@/lib/market-hours';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({
  symbol: z.string().min(1),
  amount: z.number().positive().max(1_000_000_000),
  years: z.number().min(1).max(10).optional(),
});

export async function POST(req: NextRequest) {
  return guard('simulate', async () => {
    let parsed;
    try {
      parsed = Body.parse(await req.json());
    } catch (e) {
      return fail('BAD_REQUEST', 'The request body is not valid.',
        'Send { symbol: string, amount: number }.');
    }

    const r = resolveSymbol(parsed.symbol);
    if (!r.found) {
      return fail('SYMBOL_NOT_FOUND', `${parsed.symbol.toUpperCase()} isn’t listed on NSE or BSE.`,
        'Pick one of the suggested symbols, or search again.',
        { suggestions: r.suggestions.map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })) });
    }
    const rec = r.symbol;

    /* Seeded by symbol + IST date, so the cache key is the identity
       of the result: same stock, same amount, same day -> same fan.
       Schema versioning is handled globally in lib/mongo.ts. */
    const key = `${rec.symbol}_${Math.round(parsed.amount)}_${istDateKey()}`;
    const cached = await cacheGet<any>('simulations', key, 86_400);
    if (cached && !cached.isStale) {
      return ok({ ...cached.data, meta: { ...cached.data.meta, isCached: true, source: 'cache' } },
        { ttlSeconds: 3600 });
    }

    const hist = await fetchHistory(rec, parsed.years ?? 3);
    if (!hist || hist.data.length === 0) {
      return fail('INSUFFICIENT_DATA', `No price history is available for ${rec.symbol}.`,
        'This symbol may be newly listed or suspended. Try another symbol.', { daysAvailable: 0 });
    }

    const params = estimateParams(hist.data, rec.symbol, 2);
    if (!params) {
      return fail('INSUFFICIENT_DATA',
        `${rec.symbol} has only ${hist.data.length} trading days of history — too few to estimate volatility.`,
        'Try a stock with at least a few months of trading history.',
        { daysAvailable: hist.data.length });
    }

    logTier('simulate', rec.symbol, hist.meta);

    const payload = buildSimPayload({
      symbol: rec.symbol,
      name: rec.name,
      amount: parsed.amount,
      bars: hist.data,
      meta: hist.meta,
    });
    if (!payload) {
      return fail('INSUFFICIENT_DATA',
        `${rec.symbol} has too little history to simulate.`,
        'Try a stock with at least a few months of trading history.',
        { daysAvailable: hist.data.length });
    }

    await cacheSet('simulations', key, payload, 'computed');
    return ok(payload, { ttlSeconds: 3600 });
  });
}
