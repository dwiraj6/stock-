/* GET /api/news/:symbol — TTL 15m. */
import { NextRequest } from 'next/server';
import { ok, fail, guard } from '@/lib/api';
import { resolveSymbol } from '@/lib/symbols';
import { getNews } from '@/lib/news';
import { makeMeta } from '@/lib/market-data';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { symbol: string } }) {
  return guard('news', async () => {
    const r = resolveSymbol(ctx.params.symbol);
    if (!r.found) {
      return fail('SYMBOL_NOT_FOUND', `${ctx.params.symbol.toUpperCase()} isn’t listed on NSE or BSE.`,
        'Pick one of the suggested symbols, or search again.',
        { suggestions: r.suggestions.map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })) });
    }

    const news = await getNews(r.symbol);
    const meta = makeMeta(news.fromCache ? 'cache' : 'yahoo', news.fetchedAt, {
      isCached: news.fromCache,
      isStale: news.isStale,
      degraded: news.items.length === 0,
      ...(news.items.length === 0
        ? { note: 'No recent coverage passed the company-relevance filter.' }
        : {}),
    });

    return ok(
      {
        symbol: r.symbol.symbol,
        items: news.items,
        sources: news.sources,
        audit: news.audit,
        meta,
      },
      { ttlSeconds: 900 }
    );
  });
}
