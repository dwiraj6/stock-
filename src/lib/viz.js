/* Pure presentation maths.
   ────────────────────────────────────────────────────────────────
   These are drawing helpers, not data: a moving average over closes
   the server sent, a density estimate over outcomes the server
   simulated, a deterministic sequence for the methodology page's
   teaching diagram.

   Nothing here invents a market number. The distinction that matters
   under Part 0.4 is between generating DATA (never) and computing a
   SHAPE from data that was really fetched (fine, and better done on
   the client than shipped over the wire). */

/** Simple moving average over a close series. Leading entries are
    null so the line starts where the data actually supports it. */
export function movingAverage(closes, window) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < window) return out;
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= window) sum -= closes[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/** Kept for any caller that needs a percentile of a sorted array. */
export function percentileSorted(sorted, p) {
  if (!sorted || sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/* ── deterministic sequence, for the methodology diagram only ──
   The four panels showing 1 → 10 → 100 → 400 paths are a drawing of
   what a Monte Carlo IS. They illustrate the method; they are not a
   claim about any stock, carry no ticker, and feed nothing. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeNormal(rng) {
  let spare = null;
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

/** The caption under the gap figure. */
export function gapCaption(gap) {
  if (gap < 10) return 'Your read and the numbers agree. That is rarer than you think.';
  return `${gap} points of daylight between what you believe and what the numbers support.`;
}
