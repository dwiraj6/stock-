/* Monte Carlo simulation.
   ────────────────────────────────────────────────────────────────
   Geometric Brownian motion on parameters estimated from real
   adjusted closes. Two decisions here are load-bearing:

   1. ADJUSTED CLOSE, ALWAYS. NSE has frequent splits and bonus
      issues. A 1:1 bonus halves the raw close overnight, which the
      estimator reads as a −50% day and which inflates annualised
      sigma by tens of percentage points. Every band downstream
      would silently widen. Raw OHLC is for drawing candles only.

   2. WINSORIZE BEFORE ESTIMATING. Even adjusted series carry the
      odd bad tick or unadjusted action. Clipping the log returns to
      their 1st and 99th percentile keeps the distribution's shape
      while stopping one outlier from setting sigma for the whole
      simulation.

   The PRNG is seeded from symbol + IST date, so the same stock on
   the same day always produces the same fan. A chart that reshuffles
   on refresh looks broken. */

import type { Bar } from './types';
import { istDateKey } from './market-hours';

export const TRADING_DAYS = 252;

/* DRIFT: measured, not assumed.
   ────────────────────────────────────────────────────────────────
   This model used to estimate each stock's own drift from its last
   two years and project it forward. That was tested — 240 forecasts,
   40 stocks, 6 point-in-time cut-offs — and it was actively harmful:

     full estimated drift    Brier 0.3524   skill  -51.0%
     shrink to 50%                 0.3040          -30.3%
     shrink to 25%                 0.2801          -20.1%
     zero drift                    0.2658          -13.9%
     flat +8%/yr (this)            0.2412           -3.4%

   Monotonic. Every step away from the stock-specific estimate
   improved the forecast, and the reliability curve under the old
   scheme was inverted — when it said 0-10% the stock rose 72% of
   the time, when it said 90-100% it rose 44% of the time. It was
   betting on momentum over a horizon where these names mean-revert.

   The cause is not a bug, it is statistics: two years of daily data
   pins down volatility well and expected return barely at all
   (Merton 1980). So drift is no longer estimated per stock. It is a
   flat nominal rate, the same for every symbol, and it earns its
   keep only by stopping the median from sitting at a mechanical
   -sigma^2/2 drag.

   Note what the best row still says: -3.4% skill. Even at its best
   this model does NOT predict direction better than guessing the
   base rate. It predicts WIDTH, and the band backtest is what
   validates that. The app says so on the page. */
export const FLAT_DRIFT_ANNUAL = 0.08;
export const N_PATHS = 10_000;
const REC_STEP = 3; // record every 3rd day: 21 (a month) divides by 3
const N_REC = TRADING_DAYS / REC_STEP + 1; // 85 recorded points
const DRAWN_PATHS = 400;
const DRAWN_POINTS = 60; // downsample for payload size
const SIP_MONTHS = 12;
const DAYS_PER_MONTH = 21;

export const HORIZONS = [
  { key: '2M', days: 42, rec: 14 },
  { key: '6M', days: 126, rec: 42 },
  { key: '12M', days: 252, rec: 84 },
] as const;

export type HorizonKey = (typeof HORIZONS)[number]['key'];

export type Percentiles = {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  /** Rupee P&L against the amount deployed. */
  pnl: { p10: number; p25: number; p50: number; p75: number; p90: number };
};

export type SimParams = {
  /** The drift the simulation RUNS on — flat, not stock-specific. */
  muDaily: number;
  sigmaDaily: number;
  muAnnual: number;
  sigmaAnnual: number;
  /** What this stock's own history implied. Display only; using it
      was measured to make the forecast worse. */
  observedMuAnnual: number;
  driftSource: 'flat';
  dataPoints: number;
  winsorized: number;
  seed: number;
  /** Non-null when the series is too short to be confident. */
  warning: string | null;
};

/* The honest headline number.
   ────────────────────────────────────────────────────────────────
   "How confident are you?" on a 0-100 slider is not falsifiable — 72
   of what? So the app now asks a question with a real answer: what
   are the odds you make money on this? The model answers the SAME
   question by counting how many of its 10,000 simulated futures
   finished above the amount deployed.

   Both numbers are then probabilities of the same event, directly
   comparable, and — unlike a weighted composite score — the model's
   half is a straight readout of the distribution the backtest
   actually tests. */
export type Odds = {
  /** P(final value > amount deployed). The headline. */
  profit: number;
  /** P(down more than 10% / 20%) — the losses, stated first. */
  lose10: number;
  lose20: number;
  /** P(up more than 20%). */
  gain20: number;
  /** P(beating a 7% fixed deposit over the same period). */
  beatFd: number;
};

export type SimResult = {
  params: SimParams;
  lumpsum: Record<HorizonKey, Percentiles>;
  sip: Record<HorizonKey, Percentiles>;
  /** 400 paths × 60 points, as multipliers of the amount. */
  paths: number[][];
  pathPoints: { rec: number; day: number }[];
  /** p10/p50/p90 at each of the 60 path points, in rupees, computed
      from ALL 10,000 paths — not from the 400 that get drawn. The
      median line has to be the real median, not the median of a
      sample of it. ~1KB. */
  band: { p10: number[]; p50: number[]; p90: number[] };
  /** Outcome odds at every horizon, for lumpsum and SIP. */
  odds: Record<HorizonKey, Odds>;
  sipOdds: Record<HorizonKey, Odds>;
  /** Outcome density for both modes over ONE shared domain, computed
      from all 10,000 terminal values. Sending the 10,000 samples
      themselves would add ~160KB to every response for a curve the
      client would only have to re-derive; sending the curve keeps the
      payload small AND keeps the density honest, since it is built
      from the full bundle rather than the 400 drawn paths. */
  density: {
    domain: [number, number];
    xs: number[];
    lumpsum: number[];
    sip: number[];
  };
  limitation: string;
};

export const LIMITATION =
  'This model reads price history and volatility. It does not forecast ' +
  'earnings, news, or policy. Treat the band as a range of possibilities, ' +
  'not a prediction.';

/* ── PRNG ─────────────────────────────────────────────────────── */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function boxMuller(rng: () => number): () => number {
  let spare: number | null = null;
  return function () {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };
}

/* ── estimation ───────────────────────────────────────────────── */

export function logReturns(adjCloses: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < adjCloses.length; i++) {
    const a = adjCloses[i - 1];
    const b = adjCloses[i];
    if (a > 0 && b > 0) out.push(Math.log(b / a));
  }
  return out;
}

export function percentileOf(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Clip to the 1st/99th percentile. Returns the clipped series and
    how many values were actually moved. */
export function winsorize(xs: number[]): { values: number[]; clipped: number } {
  if (xs.length < 20) return { values: xs.slice(), clipped: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  const lo = percentileOf(sorted, 0.01);
  const hi = percentileOf(sorted, 0.99);
  let clipped = 0;
  const values = xs.map((v) => {
    if (v < lo) {
      clipped++;
      return lo;
    }
    if (v > hi) {
      clipped++;
      return hi;
    }
    return v;
  });
  return { values, clipped };
}

export function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation, n−1. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) {
    const d = x - m;
    s += d * d;
  }
  return Math.sqrt(s / (xs.length - 1));
}

/**
 * Estimate from the last `years` of ADJUSTED closes.
 * Returns null when there is nothing usable at all.
 */
export function estimateParams(bars: Bar[], symbol: string, years = 2): SimParams | null {
  if (!bars || bars.length < 3) return null;

  const cutoff = Date.now() - years * 365.25 * 86_400_000;
  const window = bars.filter((b) => new Date(b.date).getTime() >= cutoff);
  const use = window.length >= 60 ? window : bars;

  const adj = use.map((b) => b.adjClose).filter((v) => Number.isFinite(v) && v > 0);
  const raw = logReturns(adj);
  if (raw.length < 20) return null;

  const { values, clipped } = winsorize(raw);
  const muDaily = mean(values);
  const sigmaDaily = stdev(values);

  const dataPoints = adj.length;
  const warning =
    dataPoints < 250
      ? `Only ${dataPoints} trading days of history are available. The estimate is ` +
        `less reliable than it would be with two full years, and the band should be ` +
        `read as wider than shown.`
      : null;

  /* The measured drift is kept for display — the momentum component
     reads it, and the methodology page shows it — but it is NOT what
     the simulation runs on. See FLAT_DRIFT_ANNUAL. */
  const flatDaily = FLAT_DRIFT_ANNUAL / TRADING_DAYS;

  return {
    muDaily: flatDaily,
    sigmaDaily,
    muAnnual: FLAT_DRIFT_ANNUAL,
    sigmaAnnual: sigmaDaily * Math.sqrt(TRADING_DAYS),
    /** What the stock's own history implied, for display only. */
    observedMuAnnual: muDaily * TRADING_DAYS,
    driftSource: 'flat' as const,
    dataPoints,
    winsorized: clipped,
    seed: hashSeed(`${symbol}|${istDateKey()}`),
    warning,
  };
}

/* ── simulation ───────────────────────────────────────────────── */

function pct(sorted: Float64Array, p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function pack(sorted: Float64Array, amount: number): Percentiles {
  const p10 = pct(sorted, 0.1);
  const p25 = pct(sorted, 0.25);
  const p50 = pct(sorted, 0.5);
  const p75 = pct(sorted, 0.75);
  const p90 = pct(sorted, 0.9);
  return {
    p10, p25, p50, p75, p90,
    pnl: {
      p10: p10 - amount,
      p25: p25 - amount,
      p50: p50 - amount,
      p75: p75 - amount,
      p90: p90 - amount,
    },
  };
}

export function simulate(params: SimParams, amount: number): SimResult {
  const rng = mulberry32(params.seed);
  const normal = boxMuller(rng);

  const dt = 1;
  const drift = (params.muDaily - 0.5 * params.sigmaDaily * params.sigmaDaily) * dt;
  const vol = params.sigmaDaily * Math.sqrt(dt);

  // Growth multipliers relative to S0 = 1, row-major.
  const grid = new Float32Array(N_PATHS * N_REC);

  for (let p = 0; p < N_PATHS; p++) {
    const base = p * N_REC;
    let logS = 0;
    grid[base] = 1;
    let rec = 1;
    for (let d = 1; d <= TRADING_DAYS; d++) {
      logS += drift + vol * normal();
      if (d % REC_STEP === 0) grid[base + rec++] = Math.exp(logS);
    }
  }

  /* Odds are counted, not derived from percentiles: the fraction of
     the 10,000 paths that cleared each threshold. A count is exactly
     the thing a calibration test can check against reality. */
  const FD_ANNUAL = 0.07;
  const oddsFrom = (values: Float64Array, deployed: number, years: number): Odds => {
    let profit = 0, lose10 = 0, lose20 = 0, gain20 = 0, beatFd = 0;
    const fdTarget = deployed * Math.pow(1 + FD_ANNUAL, years);
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v > deployed) profit++;
      if (v < deployed * 0.9) lose10++;
      if (v < deployed * 0.8) lose20++;
      if (v > deployed * 1.2) gain20++;
      if (v > fdTarget) beatFd++;
    }
    const n = values.length;
    const r = (x: number) => Math.round((x / n) * 1000) / 1000;
    return { profit: r(profit), lose10: r(lose10), lose20: r(lose20), gain20: r(gain20), beatFd: r(beatFd) };
  };

  // ── lumpsum percentiles + odds at each horizon ──
  const lumpsum = {} as Record<HorizonKey, Percentiles>;
  const odds = {} as Record<HorizonKey, Odds>;
  const col = new Float64Array(N_PATHS);
  let lumpSorted = new Float64Array(N_PATHS);
  for (const h of HORIZONS) {
    for (let p = 0; p < N_PATHS; p++) col[p] = grid[p * N_REC + h.rec] * amount;
    const sorted = col.slice().sort();
    if (h.key === '12M') lumpSorted = sorted;
    lumpsum[h.key] = pack(sorted, amount);
    odds[h.key] = oddsFrom(col, amount, h.days / TRADING_DAYS);
  }

  /* ── SIP ──
     The same paths, a different cashflow. amount/12 is deployed at
     the start of each of 12 months; each tranche then rides the same
     path from its own entry price. Valuing at a horizon means only
     counting tranches already invested by then, and the capital
     deployed by that horizon is what the P&L is measured against —
     comparing a 2-month SIP's value to the full amount would invent
     a loss that never happened. */
  const sip = {} as Record<HorizonKey, Percentiles>;
  const tranche = amount / SIP_MONTHS;
  const entryRecs: number[] = [];
  for (let k = 0; k < SIP_MONTHS; k++) entryRecs.push((k * DAYS_PER_MONTH) / REC_STEP);

  const sipOdds = {} as Record<HorizonKey, Odds>;
  let sipSorted = new Float64Array(N_PATHS);
  for (const h of HORIZONS) {
    const active = entryRecs.filter((r) => r <= h.rec);
    const deployed = tranche * active.length;
    for (let p = 0; p < N_PATHS; p++) {
      const base = p * N_REC;
      const sT = grid[base + h.rec];
      let v = 0;
      for (const r of active) v += tranche * (sT / grid[base + r]);
      col[p] = v;
    }
    const sorted = col.slice().sort();
    if (h.key === '12M') sipSorted = sorted;
    sip[h.key] = pack(sorted, deployed);
    sipOdds[h.key] = oddsFrom(col, deployed, h.days / TRADING_DAYS);
  }

  // ── the drawn bundle ──
  const stride = Math.floor(N_PATHS / DRAWN_PATHS);
  const pointStride = (N_REC - 1) / (DRAWN_POINTS - 1);
  const pathPoints: { rec: number; day: number }[] = [];
  for (let i = 0; i < DRAWN_POINTS; i++) {
    const rec = Math.round(i * pointStride);
    pathPoints.push({ rec, day: rec * REC_STEP });
  }

  const paths: number[][] = [];
  for (let i = 0; i < DRAWN_PATHS; i++) {
    const base = i * stride * N_REC;
    const row: number[] = [];
    for (const pp of pathPoints) {
      // Multipliers, 4dp — the client scales by amount. Sending
      // rupee values would roughly double the payload for nothing.
      row.push(Math.round(grid[base + pp.rec] * 10000) / 10000);
    }
    paths.push(row);
  }

  // ── the band at every drawn point, from all 10,000 paths ──
  const band = {
    p10: [] as number[],
    p50: [] as number[],
    p90: [] as number[],
  };
  for (const pp of pathPoints) {
    for (let p = 0; p < N_PATHS; p++) col[p] = grid[p * N_REC + pp.rec] * amount;
    const sorted = col.slice().sort();
    band.p10.push(Math.round(pct(sorted, 0.1)));
    band.p50.push(Math.round(pct(sorted, 0.5)));
    band.p90.push(Math.round(pct(sorted, 0.9)));
  }

  /* ── outcome density, both modes, one shared domain ──
     Two distributions drawn side by side on different scales would
     make the narrower one look safer for free, so the domain spans
     both and is wide enough for both tails to reach the floor. */
  const lumpTerminal = lumpSorted;
  const sipTerminal = sipSorted;
  const domLo =
    Math.min(pct(lumpTerminal, 0.004), pct(sipTerminal, 0.004)) * 0.96;
  const domHi =
    Math.max(pct(lumpTerminal, 0.996), pct(sipTerminal, 0.996)) * 1.02;

  const density = {
    domain: [domLo, domHi] as [number, number],
    xs: [] as number[],
    lumpsum: [] as number[],
    sip: [] as number[],
  };
  const BINS = 120;
  const step = (domHi - domLo) / (BINS - 1);
  for (let i = 0; i < BINS; i++) density.xs.push(Math.round(domLo + i * step));

  const densify = (sorted: Float64Array): number[] => {
    const counts = new Float64Array(BINS);
    for (let i = 0; i < sorted.length; i++) {
      const b = Math.round((sorted[i] - domLo) / step);
      if (b >= 0 && b < BINS) counts[b] += 1;
    }
    // Gaussian smoothing, Silverman bandwidth.
    let m = 0;
    for (let i = 0; i < sorted.length; i++) m += sorted[i];
    m /= sorted.length;
    let v = 0;
    for (let i = 0; i < sorted.length; i++) v += (sorted[i] - m) ** 2;
    const sd = Math.sqrt(v / (sorted.length - 1));
    const h = 1.06 * sd * Math.pow(sorted.length, -0.2) || step;
    const reach = Math.max(1, Math.ceil((3 * h) / step));
    const out = new Float64Array(BINS);
    for (let b = 0; b < BINS; b++) {
      if (counts[b] === 0) continue;
      for (let k = -reach; k <= reach; k++) {
        const j = b + k;
        if (j < 0 || j >= BINS) continue;
        const z = (k * step) / h;
        out[j] += counts[b] * Math.exp(-0.5 * z * z);
      }
    }
    let max = 0;
    for (let i = 0; i < BINS; i++) if (out[i] > max) max = out[i];
    return Array.from(out, (x) => (max > 0 ? Math.round((x / max) * 1000) / 1000 : 0));
  };

  density.lumpsum = densify(lumpTerminal);
  density.sip = densify(sipTerminal);

  return { params, lumpsum, sip, odds, sipOdds, paths, pathPoints, band, density, limitation: LIMITATION };
}
