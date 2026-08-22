/* Prewarm the cache for the demo tickers.
   ────────────────────────────────────────────────────────────────
   Run before any demo. This is the insurance policy that lets the
   app work with the network unplugged: quote, history, fundamentals,
   news and a precomputed simulation all land in Mongo, and every
   route's cache tier will serve them when upstream is unreachable.

   Run:  npx tsx --env-file=.env.local scripts/prewarm.ts
*/

import { getSymbol } from '../lib/symbols';
import { fetchQuote, fetchHistory, fetchFundamentals } from '../lib/market-data';
import { getNews } from '../lib/news';
import { estimateParams } from '../lib/simulate';
import { buildSimPayload } from '../lib/sim-payload';
import { cacheSet, ensureIndexes, mongoHealthy } from '../lib/mongo';
import { istDateKey } from '../lib/market-hours';

/* The brief names TATAMOTORS. NSE split it into TMCV and TMPV in the
   demerger, so TMCV (Tata Motors Limited) stands in its place. */
const DEMO = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TMCV'];
const AMOUNTS = [50_000];

async function main() {
  if (!(await mongoHealthy())) {
    console.error('Mongo unreachable — nothing can be prewarmed.');
    process.exit(1);
  }
  await ensureIndexes();
  console.log('prewarming demo tickers...\n');

  for (const sym of DEMO) {
    const rec = getSymbol(sym);
    if (!rec) {
      console.log(`  ${sym.padEnd(12)} NOT LISTED — skipped`);
      continue;
    }
    const out: string[] = [];

    const q = await fetchQuote(rec);
    out.push(`quote=${q ? `${q.data.price} (${q.meta.source})` : 'FAILED'}`);

    const h = await fetchHistory(rec, 3);
    out.push(`history=${h ? `${h.data.length} bars` : 'FAILED'}`);

    const f = await fetchFundamentals(rec);
    out.push(`P/E=${f ? String(f.data.trailingPE ?? 'null') : 'FAILED'}`);

    const n = await getNews(rec).catch(() => null);
    out.push(`news=${n ? `${n.items.length}` : 'FAILED'}`);

    if (h) {
      for (const amt of AMOUNTS) {
        // The SAME builder the route uses. Never hand-roll this shape.
        const payload = buildSimPayload({
          symbol: rec.symbol,
          name: rec.name,
          amount: amt,
          bars: h.data,
          meta: h.meta,
        });
        if (!payload) continue;
        const key = `${rec.symbol}_${amt}_${istDateKey()}`;
        await cacheSet('simulations', key, payload, 'computed');
        out.push(`sim=sigma ${(payload.params.sigma * 100).toFixed(1)}%`);
      }
    }

    console.log(`  ${sym.padEnd(12)} ${out.join('  ')}`);
  }

  console.log('\nprewarm complete — the demo tickers now serve from cache with no network.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
