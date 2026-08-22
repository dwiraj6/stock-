/* Point-in-time band backtest.
   ────────────────────────────────────────────────────────────────
   The app's headline claim is about WIDTH: "the middle 80% of
   outcomes lands here." This is the test of that claim.

   STRICT POINT-IN-TIME. At each cut-off, every bar after it is
   removed before anything is estimated. Volatility comes from the
   two years before the cut-off and nothing else.

   SIX WINDOWS, NOT ONE. Twenty stocks at a single cut-off gives
   n=20, where the binomial standard deviation at p=0.8 is about 1.8
   — 14 and 16 out of 20 are the same result wearing different
   clothes. Running six point-in-time windows gives an n worth
   quoting, and the per-window breakdown is published so one lucky
   window cannot carry the claim.

   Run: npx tsx --env-file=.env.local scripts/backtest.ts
*/

import fs from 'node:fs';
import path from 'node:path';
import { getSymbol } from '../lib/symbols';
import { fetchHistory } from '../lib/market-data';
import { estimateParams, simulate, TRADING_DAYS } from '../lib/simulate';
import type { Bar } from '../lib/types';

/* Liquid NSE names across sectors. TATAMOTORS is absent: NSE split
   it into TMCV/TMPV in the demerger, so a 12-month point-in-time
   series for that ticker no longer exists. */
const UNIVERSE = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'SBIN', 'ITC', 'LT', 'AXISBANK', 'KOTAKBANK',
  'BHARTIARTL', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA', 'TITAN',
  'ULTRACEMCO', 'NESTLEIND', 'TATASTEEL', 'WIPRO', 'BAJFINANCE',
];

const BAND = 0.8;
const CUTOFF_MONTHS_AGO = [12, 16, 20, 24, 28, 32];

type Result = {
  symbol: string;
  name: string;
  cutoff: string;
  monthsBack: number;
  cutoffPrice: number;
  predictedP10: number;
  predictedP50: number;
  predictedP90: number;
  actual: number;
  hit: boolean;
  missMagnitude: number;
  actualReturnPct: number;
  sigmaAtCutoff: number;
  observedMuAtCutoff: number;
  daysUsed: number;
  predictedPath: { t: number; p10: number; p50: number; p90: number }[];
  actualPath: { t: number; value: number }[];
};

function monthlyIndices(n: number, steps = 12): number[] {
  const out: number[] = [];
  for (let i = 1; i <= steps; i++) out.push(Math.min(n - 1, Math.round((i / steps) * n)));
  return out;
}

async function main() {
  console.log(`${UNIVERSE.length} stocks x ${CUTOFF_MONTHS_AGO.length} point-in-time windows\n`);

  const results: Result[] = [];
  const skipped: { symbol: string; why: string }[] = [];

  const primaryCutoff = new Date();
  primaryCutoff.setMonth(primaryCutoff.getMonth() - 12);
  const primaryKey = primaryCutoff.toISOString().slice(0, 10);

  for (const sym of UNIVERSE) {
    const rec = getSymbol(sym);
    if (!rec) {
      skipped.push({ symbol: sym, why: 'not listed on NSE' });
      continue;
    }

    // 6 years so the earliest cut-off still has 2 full years before it.
    const hist = await fetchHistory(rec, 6);
    if (!hist || hist.data.length === 0) {
      skipped.push({ symbol: sym, why: 'no history returned' });
      continue;
    }
    const all: Bar[] = hist.data;

    for (const monthsBack of CUTOFF_MONTHS_AGO) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - monthsBack);
      const cutMs = cutoff.getTime();

      // ── THE CUT. Nothing after this may touch the estimate. ──
      const before = all.filter((b) => new Date(b.date).getTime() <= cutMs);
      const after = all.filter((b) => new Date(b.date).getTime() > cutMs);
      if (before.length < 300 || after.length < 200) continue;

      const params = estimateParams(before, `${sym}|${monthsBack}`, 2);
      if (!params) continue;

      const cutoffPrice = before[before.length - 1].adjClose;
      const sim = simulate(params, cutoffPrice);
      const pred = sim.lumpsum['12M'];

      const horizonIdx = Math.min(after.length - 1, TRADING_DAYS - 1);
      const actual = after[horizonIdx].adjClose;

      const hit = actual >= pred.p10 && actual <= pred.p90;
      const missMagnitude = hit
        ? 0
        : actual < pred.p10
          ? (pred.p10 - actual) / pred.p10
          : (actual - pred.p90) / pred.p90;

      // Only the primary window carries the heavy path data the grid draws.
      const isPrimary = cutoff.toISOString().slice(0, 10) === primaryKey;

      const predictedPath = isPrimary
        ? sim.pathPoints
            .filter((_, i) => i % 5 === 0)
            .map((pp) => {
              const t = Math.max(pp.day / TRADING_DAYS, 1e-6);
              const drift = (params.muDaily - 0.5 * params.sigmaDaily ** 2) * (t * TRADING_DAYS);
              const spread = 1.2816 * params.sigmaDaily * Math.sqrt(t * TRADING_DAYS);
              return {
                t: pp.day,
                p10: +(cutoffPrice * Math.exp(drift - spread)).toFixed(2),
                p50: +(cutoffPrice * Math.exp(drift)).toFixed(2),
                p90: +(cutoffPrice * Math.exp(drift + spread)).toFixed(2),
              };
            })
        : [];

      const actualPath = isPrimary
        ? monthlyIndices(Math.min(after.length, TRADING_DAYS)).map((i) => ({
            t: i,
            value: +after[Math.min(i, after.length - 1)].adjClose.toFixed(2),
          }))
        : [];

      results.push({
        symbol: sym,
        name: rec.name,
        cutoff: cutoff.toISOString().slice(0, 10),
        monthsBack,
        cutoffPrice: +cutoffPrice.toFixed(2),
        predictedP10: +pred.p10.toFixed(2),
        predictedP50: +pred.p50.toFixed(2),
        predictedP90: +pred.p90.toFixed(2),
        actual: +actual.toFixed(2),
        hit,
        missMagnitude: +missMagnitude.toFixed(4),
        actualReturnPct: +(((actual / cutoffPrice) - 1) * 100).toFixed(2),
        sigmaAtCutoff: +(params.sigmaAnnual * 100).toFixed(2),
        observedMuAtCutoff: +(params.observedMuAnnual * 100).toFixed(2),
        daysUsed: params.dataPoints,
        predictedPath,
        actualPath,
      });
    }
    process.stdout.write(` ${sym}`);
  }
  console.log('\n');

  const hits = results.filter((r) => r.hit).length;
  const misses = results.filter((r) => !r.hit);

  const byCutoff = [...new Set(results.map((r) => r.cutoff))].sort().map((c) => {
    const rows = results.filter((r) => r.cutoff === c);
    return {
      cutoff: c,
      n: rows.length,
      hits: rows.filter((r) => r.hit).length,
      rate: +(rows.filter((r) => r.hit).length / rows.length).toFixed(3),
    };
  });

  const primaryRows = results.filter((r) => r.cutoff === primaryKey);
  const primaryMisses = primaryRows.filter((r) => !r.hit);
  const expected = Math.round(results.length * BAND);
  const rate = hits / results.length;

  /* A 95% interval on the hit rate, so "70%" is not quoted as if it
     were exact. Normal approximation is fine at this n. */
  const se = Math.sqrt((rate * (1 - rate)) / results.length);
  const lo = Math.max(0, rate - 1.96 * se);
  const hi = Math.min(1, rate + 1.96 * se);

  const missNarrative =
    primaryMisses.length === 0
      ? `In the most recent window every stock finished inside its band.`
      : `In the most recent window the ${primaryMisses.length === 1 ? 'miss was' : 'misses were'} ` +
        `${primaryMisses.map((m) => m.symbol).join(', ').replace(/, ([^,]*)$/, ' and $1')} — ` +
        `${primaryMisses.length === 1 ? 'it' : 'they'} moved further than volatility alone implied. ` +
        `The model reads price history. It does not read the future, and it does not see news.`;

  const out = {
    generatedAt: new Date().toISOString(),
    what: 'Does the 80% band actually contain the outcome 80% of the time?',
    method:
      `${UNIVERSE.length} liquid NSE stocks at ${CUTOFF_MONTHS_AGO.length} point-in-time cut-offs. At each cut-off ` +
      `all later data was removed, volatility estimated from the preceding two years, and 10,000 paths ` +
      `simulated 12 months forward. The resulting 10th-90th percentile band was then compared with the ` +
      `real adjusted close twelve months on.`,
    universe: results.length,
    stocks: UNIVERSE.length,
    windows: CUTOFF_MONTHS_AGO.length,
    band: BAND,
    hits,
    misses: misses.length,
    expectedHits: expected,
    hitRate: +rate.toFixed(3),
    hitRateCI: [+lo.toFixed(3), +hi.toFixed(3)],
    cutoffDate: primaryKey,
    byCutoff,
    primaryWindow: {
      cutoff: primaryKey,
      n: primaryRows.length,
      hits: primaryRows.filter((r) => r.hit).length,
    },
    interpretation:
      `${hits} of ${results.length} outcomes landed inside the 80% band — ${(rate * 100).toFixed(0)}%, ` +
      `against the ${(BAND * 100).toFixed(0)}% a well-calibrated band should deliver. The 95% interval on that ` +
      `rate is ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%. ` +
      (hi < BAND
        ? `The band is too narrow: reality escapes it more often than it should, so treat the range as wider than drawn.`
        : lo > BAND
          ? `The band is wider than it needs to be, which makes it safe but less informative.`
          : `That is consistent with an honestly sized band.`),
    missNarrative,
    caveats: [
      'The six windows overlap, so these forecasts are not independent and the effective sample is smaller than the count.',
      'The universe is large-cap names that still trade today; anything delisted never entered the test, which biases the result upward.',
      'All windows fall in one market regime.',
    ],
    skipped,
    results,
  };

  const dest = path.join(process.cwd(), 'data', 'calibration.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  console.log('per window:');
  for (const c of byCutoff) console.log(`  ${c.cutoff}   ${String(c.hits).padStart(2)}/${c.n}   ${(c.rate * 100).toFixed(0)}%`);
  console.log(`\nOVERALL  ${hits}/${results.length}  =  ${(rate * 100).toFixed(0)}%   (95% CI ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%, target ${BAND * 100}%)`);
  console.log(out.interpretation);
  console.log(`\nwrote ${dest} — ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
