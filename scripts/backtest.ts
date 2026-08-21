/* Point-in-time backtest.
   ────────────────────────────────────────────────────────────────
   This is the ONLY accuracy claim Plumbline makes, so it is
   computed from real history and the failures are reported.

   STRICT POINT-IN-TIME. For each stock we cut all data at
   T = today − 12 months, estimate mu and sigma from the two years
   BEFORE T only, simulate forward, and compare the predicted 80%
   band to what actually happened. Any data after T touching the
   estimate would invalidate the whole exhibit — so the cut happens
   once, on the raw bar array, before anything else runs.

   The hit count is whatever it is. A truthful 14/20 with an
   explanation beats a suspicious 20/20.

   Run:  npx tsx --env-file=.env.local scripts/backtest.ts
*/

import fs from 'node:fs';
import path from 'node:path';
import { getSymbol } from '../lib/symbols';
import { fetchHistory } from '../lib/market-data';
import { estimateParams, simulate, TRADING_DAYS } from '../lib/simulate';
import type { Bar } from '../lib/types';

/* 20 liquid NSE names across sectors. TATAMOTORS is deliberately
   absent: NSE split it into TMCV/TMPV in the demerger, so a
   12-month point-in-time series for that ticker no longer exists. */
const UNIVERSE = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'SBIN', 'ITC', 'LT', 'AXISBANK', 'KOTAKBANK',
  'BHARTIARTL', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA', 'TITAN',
  'ULTRACEMCO', 'NESTLEIND', 'TATASTEEL', 'WIPRO', 'BAJFINANCE',
];

const BAND = 0.8;

type Result = {
  symbol: string;
  name: string;
  cutoffPrice: number;
  predictedP10: number;
  predictedP50: number;
  predictedP90: number;
  actual: number;
  hit: boolean;
  /** How far outside the band, as a fraction. 0 when inside. */
  missMagnitude: number;
  actualReturnPct: number;
  sigmaAtCutoff: number;
  muAtCutoff: number;
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
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  console.log(`cutoff T = ${cutoff.toISOString().slice(0, 10)} (12 months before today)`);
  console.log(`universe = ${UNIVERSE.length} NSE equities\n`);

  const results: Result[] = [];
  const skipped: { symbol: string; why: string }[] = [];

  for (const sym of UNIVERSE) {
    const rec = getSymbol(sym);
    if (!rec) {
      skipped.push({ symbol: sym, why: 'not listed on NSE' });
      continue;
    }

    // 4 years so there are 2 full years available BEFORE the cutoff.
    const hist = await fetchHistory(rec, 4);
    if (!hist || hist.data.length === 0) {
      skipped.push({ symbol: sym, why: 'no history returned' });
      continue;
    }

    const all: Bar[] = hist.data;
    const cutMs = cutoff.getTime();

    // ── THE CUT. Nothing after this point may touch the estimate. ──
    const before = all.filter((b) => new Date(b.date).getTime() <= cutMs);
    const after = all.filter((b) => new Date(b.date).getTime() > cutMs);

    if (before.length < 300) {
      skipped.push({ symbol: sym, why: `only ${before.length} bars before cutoff` });
      continue;
    }
    if (after.length < 200) {
      skipped.push({ symbol: sym, why: `only ${after.length} bars after cutoff` });
      continue;
    }

    // Estimate from the 2 years before T, using ONLY `before`.
    const params = estimateParams(before, `${sym}|backtest`, 2);
    if (!params) {
      skipped.push({ symbol: sym, why: 'could not estimate parameters' });
      continue;
    }

    const cutoffPrice = before[before.length - 1].adjClose;
    const sim = simulate(params, cutoffPrice);
    const pred = sim.lumpsum['12M'];

    // What actually happened: the adjusted close ~252 trading days on.
    const horizonIdx = Math.min(after.length - 1, TRADING_DAYS - 1);
    const actual = after[horizonIdx].adjClose;

    const hit = actual >= pred.p10 && actual <= pred.p90;
    const missMagnitude = hit
      ? 0
      : actual < pred.p10
        ? (pred.p10 - actual) / pred.p10
        : (actual - pred.p90) / pred.p90;

    // Bands and the real path, monthly, for the mini-panels.
    const predictedPath = sim.pathPoints
      .filter((_, i) => i % 5 === 0)
      .map((pp) => {
        const frac = pp.day / TRADING_DAYS;
        // Percentiles at that horizon scale as exp(mu*t ± z*sigma*sqrt(t)).
        const t = Math.max(frac, 1e-6);
        const drift = (params.muDaily - 0.5 * params.sigmaDaily ** 2) * (t * TRADING_DAYS);
        const spread = 1.2816 * params.sigmaDaily * Math.sqrt(t * TRADING_DAYS);
        return {
          t: pp.day,
          p10: +(cutoffPrice * Math.exp(drift - spread)).toFixed(2),
          p50: +(cutoffPrice * Math.exp(drift)).toFixed(2),
          p90: +(cutoffPrice * Math.exp(drift + spread)).toFixed(2),
        };
      });

    const actualPath = monthlyIndices(Math.min(after.length, TRADING_DAYS)).map((i) => ({
      t: i,
      value: +after[Math.min(i, after.length - 1)].adjClose.toFixed(2),
    }));

    results.push({
      symbol: sym,
      name: rec.name,
      cutoffPrice: +cutoffPrice.toFixed(2),
      predictedP10: +pred.p10.toFixed(2),
      predictedP50: +pred.p50.toFixed(2),
      predictedP90: +pred.p90.toFixed(2),
      actual: +actual.toFixed(2),
      hit,
      missMagnitude: +missMagnitude.toFixed(4),
      actualReturnPct: +(((actual / cutoffPrice) - 1) * 100).toFixed(2),
      sigmaAtCutoff: +(params.sigmaAnnual * 100).toFixed(2),
      muAtCutoff: +(params.muAnnual * 100).toFixed(2),
      daysUsed: params.dataPoints,
      predictedPath,
      actualPath,
    });

    console.log(
      `  ${sym.padEnd(12)} cut=${cutoffPrice.toFixed(0).padStart(7)}  band=[${pred.p10.toFixed(0).padStart(7)}, ${pred.p90.toFixed(0).padStart(7)}]  actual=${actual.toFixed(0).padStart(7)}  ${hit ? 'HIT ' : 'MISS'}  ${hit ? '' : `${(missMagnitude * 100).toFixed(1)}% outside`}`
    );
  }

  const hits = results.filter((r) => r.hit).length;
  const misses = results.filter((r) => !r.hit);

  const missNarrative =
    misses.length === 0
      ? `Every one of the ${results.length} stocks finished inside its predicted band. On an 80% band that is a better result than the model should expect, and reflects a small sample rather than unusual skill.`
      : `The ${misses.length === 1 ? 'miss was' : 'misses were'} ${misses
          .map((m) => m.symbol)
          .join(', ')
          .replace(/, ([^,]*)$/, ' and $1')} — ` +
        `${misses.length === 1 ? 'it' : 'they'} moved further than price history alone implied. ` +
        `The model reads price history and fundamentals. It does not read the future, and it does not see news.`;

  const expected = Math.round(results.length * BAND);
  const out = {
    generatedAt: new Date().toISOString(),
    cutoffDate: cutoff.toISOString().slice(0, 10),
    method:
      'Point-in-time. For each symbol, all data after the cutoff was removed before ' +
      'estimating mu and sigma from the preceding two years. 10,000 GBM paths were then ' +
      'simulated 252 trading days forward from the cutoff close, and the resulting 80% ' +
      'band compared to the real adjusted close twelve months later.',
    universe: results.length,
    requested: UNIVERSE.length,
    band: BAND,
    hits,
    misses: misses.length,
    expectedHits: expected,
    hitRate: +(hits / results.length).toFixed(3),
    interpretation:
      `${hits} of ${results.length} landed inside the 80% band. On a well-calibrated 80% ` +
      `band you would expect about ${expected}. ${results.length} stocks is a small sample — ` +
      `read this as a sanity check that the bands are roughly the right width, not as proof ` +
      `of anything stronger.`,
    missNarrative,
    skipped,
    results,
  };

  const dest = path.join(process.cwd(), 'data', 'calibration.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  console.log(`\n${hits}/${results.length} inside the 80% band (expected ~${expected})`);
  console.log(missNarrative);
  if (skipped.length) console.log('skipped:', skipped.map((s) => `${s.symbol} (${s.why})`).join(', '));
  console.log(`\nwrote ${dest} — ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
