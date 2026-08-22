/* PROBABILITY CALIBRATION — the claim the app now leads with.
   ────────────────────────────────────────────────────────────────
   The app's headline is "the simulation says you have a 35% chance
   of making money on this." That is a probability forecast, and a
   probability forecast is validated one way: when the model said
   35%, did roughly 35% of those cases actually make money?

   That is a reliability test, and it is a much stronger claim than
   the band backtest. A band can be right by being wide. A
   probability cannot hide — if it says 30% and things happen 70% of
   the time, it is broken, and the number shows it.

   METHOD — strictly point-in-time, and deliberately harsh:
     · a universe of liquid NSE names
     · SEVERAL cut-off dates, not one, so the result is not an
       artefact of a single lucky window
     · at each cut-off: estimate mu/sigma from the two years BEFORE
       it, simulate 12 months forward, record P(profit)
     · then look at what the stock actually did over those 12 months
     · bucket every forecast by its predicted probability and compare
       predicted frequency to observed frequency
     · score it with Brier, and compare against the only honest
       baseline: always predicting the base rate

   Nothing after a cut-off touches the estimate for that cut-off.

   Run: npx tsx --env-file=.env.local scripts/calibrate-probabilities.ts
*/

import fs from 'node:fs';
import path from 'node:path';
import { getSymbol } from '../lib/symbols';
import { fetchHistory } from '../lib/market-data';
import { estimateParams, mulberry32, TRADING_DAYS } from '../lib/simulate';
import type { Bar } from '../lib/types';

const UNIVERSE = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'ITC', 'LT',
  'AXISBANK', 'KOTAKBANK', 'BHARTIARTL', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'ULTRACEMCO', 'NESTLEIND', 'TATASTEEL', 'WIPRO', 'BAJFINANCE',
  'HCLTECH', 'TECHM', 'POWERGRID', 'NTPC', 'ONGC', 'COALINDIA', 'GRASIM',
  'CIPLA', 'DRREDDY', 'BRITANNIA', 'EICHERMOT', 'HEROMOTOCO', 'JSWSTEEL',
  'HINDALCO', 'BPCL', 'IOC', 'DABUR', 'GODREJCP', 'SIEMENS', 'HAVELLS',
];

/* Cut-offs spaced ~4 months apart. Each needs 2 years of history
   before it and 12 months of reality after it. */
const CUTOFF_MONTHS_AGO = [12, 16, 20, 24, 28, 32];

const N_PATHS = 4000; // enough for a stable probability, fast enough for 240 runs

type Forecast = {
  symbol: string;
  cutoff: string;
  predicted: number;   // P(profit) the model gave
  actual: 0 | 1;       // did it actually profit
  actualReturnPct: number;
  sigma: number;
  mu: number;
};

function simulateProfitProbability(bars: Bar[], symbol: string, cutoffKey: string): number | null {
  const p = estimateParams(bars, `${symbol}|${cutoffKey}`, 2);
  if (!p) return null;

  const rng = mulberry32(p.seed);
  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0, s = 0;
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };

  const drift = p.muDaily - 0.5 * p.sigmaDaily ** 2;
  let profit = 0;
  for (let i = 0; i < N_PATHS; i++) {
    let logS = 0;
    for (let d = 0; d < TRADING_DAYS; d++) logS += drift + p.sigmaDaily * normal();
    if (logS > 0) profit++;
  }
  return profit / N_PATHS;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

async function main() {
  console.log(`universe ${UNIVERSE.length} stocks x ${CUTOFF_MONTHS_AGO.length} cut-offs = up to ${UNIVERSE.length * CUTOFF_MONTHS_AGO.length} forecasts\n`);

  const forecasts: Forecast[] = [];
  const skipped: string[] = [];

  for (const sym of UNIVERSE) {
    const rec = getSymbol(sym);
    if (!rec) { skipped.push(`${sym}: not listed`); continue; }

    // 6 years so the earliest cut-off still has 2 years before it.
    const hist = await fetchHistory(rec, 6);
    if (!hist || hist.data.length < 400) { skipped.push(`${sym}: thin history`); continue; }
    const all = hist.data;

    for (const m of CUTOFF_MONTHS_AGO) {
      const cut = monthsAgo(m);
      const cutMs = cut.getTime();
      const cutKey = cut.toISOString().slice(0, 10);

      // ── THE CUT ──
      const before = all.filter((b) => new Date(b.date).getTime() <= cutMs);
      const after = all.filter((b) => new Date(b.date).getTime() > cutMs);
      if (before.length < 300 || after.length < TRADING_DAYS - 10) continue;

      const predicted = simulateProfitProbability(before, sym, cutKey);
      if (predicted === null) continue;

      const startPrice = before[before.length - 1].adjClose;
      const endIdx = Math.min(after.length - 1, TRADING_DAYS - 1);
      const endPrice = after[endIdx].adjClose;

      forecasts.push({
        symbol: sym,
        cutoff: cutKey,
        predicted,
        actual: endPrice > startPrice ? 1 : 0,
        actualReturnPct: +(((endPrice / startPrice) - 1) * 100).toFixed(2),
        sigma: +(estimateParams(before, sym, 2)!.sigmaAnnual * 100).toFixed(1),
        mu: +(estimateParams(before, sym, 2)!.muAnnual * 100).toFixed(1),
      });
    }
    process.stdout.write(`  ${sym} `);
  }
  console.log(`\n\n${forecasts.length} forecasts made\n`);

  // ── reliability: bucket by predicted probability ──
  const EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const buckets = EDGES.slice(0, -1).map((lo, i) => ({
    lo,
    hi: EDGES[i + 1],
    label: `${Math.round(lo * 100)}-${Math.round(EDGES[i + 1] * 100)}%`,
    n: 0,
    predictedSum: 0,
    actualSum: 0,
  }));

  for (const f of forecasts) {
    const b = buckets.find((x) => f.predicted >= x.lo && (f.predicted < x.hi || x.hi === 1));
    if (!b) continue;
    b.n++;
    b.predictedSum += f.predicted;
    b.actualSum += f.actual;
  }

  const reliability = buckets
    .filter((b) => b.n > 0)
    .map((b) => ({
      bucket: b.label,
      n: b.n,
      meanPredicted: +(b.predictedSum / b.n).toFixed(3),
      observedFrequency: +(b.actualSum / b.n).toFixed(3),
      gap: +((b.actualSum / b.n) - (b.predictedSum / b.n)).toFixed(3),
    }));

  // ── Brier score, and the only honest baseline ──
  const brier = forecasts.reduce((s, f) => s + (f.predicted - f.actual) ** 2, 0) / forecasts.length;
  const baseRate = forecasts.reduce((s, f) => s + f.actual, 0) / forecasts.length;
  const brierBase = forecasts.reduce((s, f) => s + (baseRate - f.actual) ** 2, 0) / forecasts.length;
  const skill = 1 - brier / brierBase;

  console.log('RELIABILITY — when the model said X%, how often did it happen?');
  console.log('  predicted     n     model said   actually happened   gap');
  console.log('  ' + '-'.repeat(64));
  for (const r of reliability) {
    const arrow = Math.abs(r.gap) < 0.05 ? '' : r.gap > 0 ? '  (model too pessimistic)' : '  (model too optimistic)';
    console.log(
      `  ${r.bucket.padEnd(10)} ${String(r.n).padStart(4)}       ${(r.meanPredicted * 100).toFixed(0).padStart(3)}%              ${(r.observedFrequency * 100).toFixed(0).padStart(3)}%      ${r.gap >= 0 ? '+' : ''}${(r.gap * 100).toFixed(0)}pp${arrow}`
    );
  }

  console.log(`\nBRIER SCORE (lower is better, 0 = perfect, 0.25 = a coin flip)`);
  console.log(`  model              ${brier.toFixed(4)}`);
  console.log(`  always-base-rate   ${brierBase.toFixed(4)}   (predicting ${(baseRate * 100).toFixed(0)}% every time)`);
  console.log(`  skill score        ${skill >= 0 ? '+' : ''}${(skill * 100).toFixed(1)}%   ${skill > 0 ? 'better than the baseline' : 'NO BETTER than the baseline'}`);

  const out = {
    generatedAt: new Date().toISOString(),
    what: 'Reliability of the simulation\'s probability-of-profit forecast, tested point-in-time.',
    method:
      `For each of ${UNIVERSE.length} liquid NSE stocks at ${CUTOFF_MONTHS_AGO.length} cut-off dates, all data after the ` +
      `cut-off was removed, drift and volatility estimated from the preceding two years, and ${N_PATHS} ` +
      `paths simulated 12 months forward. The share of paths finishing above the starting price is the ` +
      `forecast. It is then compared with what the stock actually did over that same 12 months.`,
    forecasts: forecasts.length,
    cutoffs: [...new Set(forecasts.map((f) => f.cutoff))].sort(),
    baseRate: +baseRate.toFixed(3),
    brier: +brier.toFixed(4),
    brierBaseline: +brierBase.toFixed(4),
    skillScore: +skill.toFixed(4),
    reliability,
    interpretation:
      skill > 0.02
        ? `The forecast carries real information: its Brier score of ${brier.toFixed(3)} beats the ${brierBase.toFixed(3)} you would get by ignoring the stock entirely and predicting the base rate of ${(baseRate * 100).toFixed(0)}% every time.`
        : skill > -0.02
          ? `The forecast is about as good as predicting the base rate of ${(baseRate * 100).toFixed(0)}% for every stock, and no better. It is honestly calibrated but carries little stock-specific information — which is roughly what a model reading only price history should be expected to achieve.`
          : `The forecast is WORSE than simply predicting the base rate of ${(baseRate * 100).toFixed(0)}% every time. Read the reliability table before trusting any individual number.`,
    caveats: [
      `${UNIVERSE.length} stocks over ${CUTOFF_MONTHS_AGO.length} overlapping 12-month windows. The windows overlap, so the forecasts are not independent and the effective sample is smaller than the count suggests.`,
      'The universe is large-cap names that still trade today. Anything delisted or collapsed never entered the test, which biases the result upward.',
      'All cut-offs fall in one market regime. A crash inside the test window would change these numbers.',
    ],
    samples: forecasts.slice(0, 400),
  };

  const dest = path.join(process.cwd(), 'data', 'probability-calibration.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${dest}`);
  if (skipped.length) console.log('skipped:', skipped.join(', '));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
