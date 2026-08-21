/* GET /api/search?q=  — local index, no network, no cache tier. */
import { NextRequest } from 'next/server';
import { ok, fail, guard } from '@/lib/api';
import { searchSymbols, suggestSymbols, symbolCount } from '@/lib/symbols';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return guard('search', async () => {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const limit = Math.min(20, Number(req.nextUrl.searchParams.get('limit') ?? 8) || 8);

    if (!q.trim()) {
      return ok({ results: [], query: q, universe: symbolCount() });
    }

    const shape = (s: { symbol: string; name: string; exchange: string; tradingViewSymbol: string }) => ({
      symbol: s.symbol,
      name: s.name,
      exchange: s.exchange,
      tradingViewSymbol: s.tradingViewSymbol,
    });

    const direct = searchSymbols(q, limit);
    if (direct.length > 0) {
      return ok({ results: direct.map(shape), fuzzy: false, query: q, universe: symbolCount() });
    }

    /* Nothing matched by prefix or substring. Rather than returning an
       empty list — which leaves the NOT LISTED state with no way
       forward — fall back to nearest-neighbour suggestions and label
       them as such, so the caller can present them as "did you mean"
       rather than as matches. */
    const near = suggestSymbols(q, 3);
    return ok({
      results: near.map(shape),
      fuzzy: true,
      query: q,
      universe: symbolCount(),
    });
  });
}
