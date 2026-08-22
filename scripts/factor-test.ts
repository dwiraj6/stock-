/* CAN ANYTHING PREDICT DIRECTION?
   ────────────────────────────────────────────────────────────────
   The simulation cannot: measured at -3.4% skill, worse than
   guessing the base rate. That was one signal though — a GBM drift.
   Before the app claims "direction is unpredictable" it owes the
   claim a real attempt.

   Five candidate signals are tested here. All are documented factors
   and, critically, all are computable from PRICE ALONE, so they can
   be evaluated strictly point-in-time. Fundamentals are deliberately
   excluded: Yahoo serves only today's P/E and book value, so any
   fundamental test would be contaminated by look-ahead bias. A
   signal that cannot be measured honestly is not tested here at all.

     momentum12_1   return from t-12m to t-1m, skipping the last
                    month (the classic Jegadeesh-Titman construction;
                    the skip avoids short-term reversal)
     lowvol         negative annualised volatility — the low-vol
                    anomaly says calm stocks outperform
     reversal1m     negative last-month return — short-horizon
                    mean reversion
     dist52w        distance below the 52-week high
     trend200       price relative to its 200-day moving average

   Each is turned into a probability by a single logistic fit on the
   TRAINING windows only, then scored on the HELD-OUT windows. No
   signal sees the data it is graded on.

   Run: npx tsx --env-file=.env.local scripts/factor-test.ts
*/

import fs from 'node:fs';
import path from 'node:path';
import { getSymbol } from '../lib/symbols';
import { fetchHistory } from '../lib/market-data';
import { TRADING_DAYS } from '../lib/simulate';
import type { Bar } from '../lib/types';

const UNIVERSE = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','SBIN','ITC','LT','AXISBANK','KOTAKBANK',
  'BHARTIARTL','ASIANPAINT','MARUTI','SUNPHARMA','TITAN','ULTRACEMCO','NESTLEIND','TATASTEEL',
  'WIPRO','BAJFINANCE','HCLTECH','TECHM','POWERGRID','NTPC','ONGC','COALINDIA','GRASIM','CIPLA',
  'DRREDDY','BRITANNIA','EICHERMOT','HEROMOTOCO','JSWSTEEL','HINDALCO','BPCL','IOC','DABUR',
  'GODREJCP','SIEMENS','HAVELLS','ADANIPORTS','BAJAJFINSV','DIVISLAB','SHREECEM','TATAPOWER',
  'INDUSINDBK','BANKBARODA','PNB','VEDL','SAIL',
];

/* Windows are split before anything is fitted. The model never sees
   the windows it is graded on. */
const TRAIN_MONTHS = [24, 28, 32, 36, 40, 44];
const TEST_MONTHS  = [12, 16, 20];

type Row = { symbol: string; window: number; signals: Record<string, number>; actual: 0 | 1 };

const SIGNALS = ['momentum12_1', 'lowvol', 'reversal1m', 'dist52w', 'trend200'] as const;
type SignalName = (typeof SIGNALS)[number];

function computeSignals(before: Bar[]): Record<string, number> | null {
  const n = before.length;
  if (n < TRADING_DAYS + 30) return null;
  const adj = before.map((b) => b.adjClose);
  const last = adj[n - 1];

  const at = (daysBack: number) => adj[n - 1 - daysBack];

  // momentum, 12 months to 1 month ago
  const p12 = at(TRADING_DAYS);
  const p1 = at(21);
  if (!(p12 > 0) || !(p1 > 0)) return null;
  const momentum12_1 = Math.log(p1 / p12);

  // annualised volatility over the last year
  const rets: number[] = [];
  for (let i = n - TRADING_DAYS; i < n; i++) {
    if (i < 1) continue;
    if (adj[i] > 0 && adj[i - 1] > 0) rets.push(Math.log(adj[i] / adj[i - 1]));
  }
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1));
  const lowvol = -sd * Math.sqrt(TRADING_DAYS);

  // short-term reversal
  const reversal1m = -Math.log(last / at(21));

  // distance below the 52-week high
  const window = adj.slice(Math.max(0, n - TRADING_DAYS));
  const high52 = Math.max(...window);
  const dist52w = Math.log(last / high52);

  // trend vs the 200-day average
  const ma200Slice = adj.slice(Math.max(0, n - 200));
  const ma200 = ma200Slice.reduce((s, x) => s + x, 0) / ma200Slice.length;
  const trend200 = Math.log(last / ma200);

  const out = { momentum12_1, lowvol, reversal1m, dist52w, trend200 };
  for (const v of Object.values(out)) if (!Number.isFinite(v)) return null;
  return out;
}

/** Standardise using TRAINING statistics only. */
function zStats(rows: Row[], s: SignalName) {
  const xs = rows.map((r) => r.signals[s]);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) || 1;
  return { m, sd };
}

/** Single-feature logistic regression, plain gradient descent. */
function fitLogistic(x: number[], y: number[], iters = 4000, lr = 0.1) {
  let b0 = 0;
  let b1 = 0;
  const n = x.length;
  for (let it = 0; it < iters; it++) {
    let g0 = 0;
    let g1 = 0;
    for (let i = 0; i < n; i++) {
      const p = 1 / (1 + Math.exp(-(b0 + b1 * x[i])));
      const e = p - y[i];
      g0 += e;
      g1 += e * x[i];
    }
    b0 -= (lr * g0) / n;
    b1 -= (lr * g1) / n;
  }
  return { b0, b1 };
}

async function main() {
  console.log(`${UNIVERSE.length} stocks · train on ${TRAIN_MONTHS.length} windows · test on ${TEST_MONTHS.length} held-out windows\n`);

  const train: Row[] = [];
  const test: Row[] = [];

  for (const sym of UNIVERSE) {
    const rec = getSymbol(sym);
    if (!rec) continue;
    const hist = await fetchHistory(rec, 8);
    if (!hist || hist.data.length < 600) continue;
    const all = hist.data;

    for (const [months, bucket] of [
      ...TRAIN_MONTHS.map((m) => [m, train] as const),
      ...TEST_MONTHS.map((m) => [m, test] as const),
    ]) {
      const cut = new Date();
      cut.setMonth(cut.getMonth() - months);
      const ms = cut.getTime();
      const before = all.filter((b) => new Date(b.date).getTime() <= ms);
      const after = all.filter((b) => new Date(b.date).getTime() > ms);
      if (before.length < TRADING_DAYS + 40 || after.length < TRADING_DAYS - 10) continue;

      const signals = computeSignals(before);
      if (!signals) continue;

      const start = before[before.length - 1].adjClose;
      const end = after[Math.min(after.length - 1, TRADING_DAYS - 1)].adjClose;
      bucket.push({ symbol: sym, window: months, signals, actual: end > start ? 1 : 0 });
    }
    process.stdout.write('.');
  }

  console.log(`\n\ntrain n=${train.length}   test n=${test.length}\n`);
  if (train.length < 50 || test.length < 30) {
    console.log('not enough data to test honestly');
    process.exit(1);
  }

  const testBase = test.reduce((s, r) => s + r.actual, 0) / test.length;
  const baselineBrier =
    test.reduce((s, r) => s + (testBase - r.actual) ** 2, 0) / test.length;

  console.log(`held-out base rate: ${(testBase * 100).toFixed(0)}% up`);
  console.log(`baseline Brier (always predict the base rate): ${baselineBrier.toFixed(4)}\n`);
  console.log('  signal            train coef    test Brier    skill vs baseline');
  console.log('  ' + '-'.repeat(66));

  const results: any[] = [];
  for (const s of SIGNALS) {
    const { m, sd } = zStats(train, s);
    const xTr = train.map((r) => (r.signals[s] - m) / sd);
    const yTr = train.map((r) => r.actual);
    const { b0, b1 } = fitLogistic(xTr, yTr);

    const preds = test.map((r) => {
      const z = (r.signals[s] - m) / sd;
      return 1 / (1 + Math.exp(-(b0 + b1 * z)));
    });
    const brier = test.reduce((acc, r, i) => acc + (preds[i] - r.actual) ** 2, 0) / test.length;
    const skill = 1 - brier / baselineBrier;

    results.push({ signal: s, coef: +b1.toFixed(4), brier: +brier.toFixed(4), skill: +skill.toFixed(4) });
    console.log(
      `  ${s.padEnd(16)} ${b1 >= 0 ? '+' : ''}${b1.toFixed(3).padStart(7)}      ${brier.toFixed(4)}       ${skill >= 0 ? '+' : ''}${(skill * 100).toFixed(1)}%${skill > 0.02 ? '   <- beats baseline' : ''}`
    );
  }

  const best = results.reduce((a, b) => (b.skill > a.skill ? b : a));
  const anyWorks = best.skill > 0.02;

  console.log(
    `\n${anyWorks
      ? `BEST: ${best.signal}, skill ${(best.skill * 100).toFixed(1)}% on held-out windows.`
      : `NONE of the ${SIGNALS.length} signals beat the base rate on held-out windows. Best was ${best.signal} at ${(best.skill * 100).toFixed(1)}%.`}`
  );

  const out = {
    generatedAt: new Date().toISOString(),
    what: 'Do any price-based factors predict 12-month direction for NSE large caps?',
    method:
      `${SIGNALS.length} documented price-based factors, each fitted with a single-feature logistic ` +
      `regression on ${TRAIN_MONTHS.length} training windows and scored on ${TEST_MONTHS.length} held-out ` +
      `windows it never saw. Standardisation used training statistics only. Fundamentals were excluded ` +
      `deliberately: only today's values are available, so any fundamental test would carry look-ahead bias.`,
    trainN: train.length,
    testN: test.length,
    heldOutBaseRate: +testBase.toFixed(3),
    baselineBrier: +baselineBrier.toFixed(4),
    results,
    best: best.signal,
    bestSkill: best.skill,
    anySignalWorks: anyWorks,
    conclusion: anyWorks
      ? `${best.signal} carried real information on held-out data (skill ${(best.skill * 100).toFixed(1)}%).`
      : `No price-based factor tested here predicts 12-month direction better than the base rate. ` +
        `Combined with the simulation's own -3.4%, the app's refusal to forecast direction is a measured ` +
        `finding across ${SIGNALS.length + 1} attempts, not an excuse.`,
    caveats: [
      'Large-cap NSE names that still trade today; delisted names never entered the test.',
      'Overlapping 12-month windows, so forecasts are not independent.',
      'One market regime. A crash inside the window would change these numbers.',
      'Single-feature models only; a combination could behave differently.',
    ],
  };

  const dest = path.join(process.cwd(), 'data', 'factor-test.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${dest}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
