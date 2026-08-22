/* THE TRACK RECORD.
   ────────────────────────────────────────────────────────────────
   The one thing that actually changes behaviour: writing down what
   you believed BEFORE you knew, then being shown what happened.

   A decision is recorded at the moment of the measurement — the
   stock, the price then, your stated odds, and the model's stated
   odds. Neither number can be revised afterwards, because the
   document is written before the outcome exists. When you come back,
   the current price decides who was closer.

   Scored with Brier, the same way the model scores itself in
   scripts/calibrate-probabilities.ts. The symmetry is the point: the
   app holds itself and its user to one standard.

   Identity is an anonymous browser-generated id. No accounts, no
   email, nothing personal — the brief's "log nothing personal"
   applies here as much as to the chat. */

import { getDb } from './mongo';

export type Decision = {
  /** Anonymous, browser-generated. Not a person. */
  who: string;
  symbol: string;
  name: string;
  amount: number;
  /** The user's stated probability of profit, 0-1. */
  userProb: number;
  /** The model's, from the simulation, 0-1. */
  modelProb: number;
  /** Adjusted close at the moment of the decision. */
  priceAt: number;
  horizonDays: number;
  createdAt: Date;
};

export type ResolvedDecision = Decision & {
  currentPrice: number | null;
  returnPct: number | null;
  /** null until the horizon is reached — an open position is not
      yet right or wrong, and pretending otherwise would be the same
      dishonesty the rest of the app avoids. */
  outcome: 0 | 1 | null;
  daysElapsed: number;
  daysRemaining: number;
  matured: boolean;
  /** Who was closer, once it is decidable. */
  closer: 'you' | 'model' | 'tie' | null;
};

export type TrackRecord = {
  total: number;
  matured: number;
  open: number;
  /** Brier scores over matured decisions only. */
  yourBrier: number | null;
  modelBrier: number | null;
  /** The base rate among YOUR decisions — the score to beat. */
  baseRate: number | null;
  baselineBrier: number | null;
  yourHitRate: number | null;
  /** Mean stated odds vs what actually happened. */
  yourMeanProb: number | null;
  modelMeanProb: number | null;
  observedRate: number | null;
  /** Positive = you were overconfident, in percentage points. */
  overconfidencePp: number | null;
  verdict: string;
  decisions: ResolvedDecision[];
};

const COLL = 'decisions';

export async function recordDecision(d: Omit<Decision, 'createdAt'>): Promise<boolean> {
  try {
    const db = await getDb();
    await db.collection<Decision>(COLL).insertOne({ ...d, createdAt: new Date() });
    await db
      .collection(COLL)
      .createIndex({ who: 1, createdAt: -1 }, { name: 'by_user' })
      .catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function listDecisions(who: string, limit = 50): Promise<Decision[]> {
  try {
    const db = await getDb();
    return await db
      .collection<Decision>(COLL)
      .find({ who })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

function brier(pairs: { p: number; actual: number }[]): number | null {
  if (pairs.length === 0) return null;
  return +(pairs.reduce((s, x) => s + (x.p - x.actual) ** 2, 0) / pairs.length).toFixed(4);
}

/**
 * Resolve each decision against a current price and score the lot.
 * `prices` maps symbol -> latest adjusted close; a symbol missing
 * from it stays unresolved rather than being guessed at.
 */
export function scoreDecisions(
  decisions: Decision[],
  prices: Record<string, number | null>
): TrackRecord {
  const now = Date.now();

  const resolved: ResolvedDecision[] = decisions.map((d) => {
    const cur = prices[d.symbol] ?? null;
    const elapsedMs = now - new Date(d.createdAt).getTime();
    const daysElapsed = Math.floor(elapsedMs / 86_400_000);
    // Trading days are ~5/7 of calendar days.
    const horizonCalendarDays = Math.round(d.horizonDays * (7 / 5));
    const daysRemaining = Math.max(0, horizonCalendarDays - daysElapsed);
    const matured = daysElapsed >= horizonCalendarDays;

    const returnPct = cur !== null && d.priceAt > 0 ? ((cur / d.priceAt) - 1) * 100 : null;
    const outcome: 0 | 1 | null = matured && returnPct !== null ? (returnPct > 0 ? 1 : 0) : null;

    let closer: ResolvedDecision['closer'] = null;
    if (outcome !== null) {
      const du = Math.abs(d.userProb - outcome);
      const dm = Math.abs(d.modelProb - outcome);
      closer = Math.abs(du - dm) < 0.001 ? 'tie' : du < dm ? 'you' : 'model';
    }

    return {
      ...d,
      currentPrice: cur,
      returnPct: returnPct === null ? null : +returnPct.toFixed(2),
      outcome,
      daysElapsed,
      daysRemaining,
      matured,
      closer,
    };
  });

  const done = resolved.filter((r) => r.outcome !== null);
  const yourBrier = brier(done.map((r) => ({ p: r.userProb, actual: r.outcome as number })));
  const modelBrier = brier(done.map((r) => ({ p: r.modelProb, actual: r.outcome as number })));

  const observedRate =
    done.length > 0 ? +(done.reduce((s, r) => s + (r.outcome as number), 0) / done.length).toFixed(3) : null;
  const baselineBrier =
    observedRate === null ? null : brier(done.map((r) => ({ p: observedRate, actual: r.outcome as number })));

  const yourMeanProb =
    done.length > 0 ? +(done.reduce((s, r) => s + r.userProb, 0) / done.length).toFixed(3) : null;
  const modelMeanProb =
    done.length > 0 ? +(done.reduce((s, r) => s + r.modelProb, 0) / done.length).toFixed(3) : null;

  const overconfidencePp =
    yourMeanProb !== null && observedRate !== null
      ? +(((yourMeanProb - observedRate) * 100).toFixed(1))
      : null;

  let verdict: string;
  if (done.length === 0) {
    const soonest = resolved.length
      ? Math.min(...resolved.map((r) => r.daysRemaining))
      : null;
    verdict =
      resolved.length === 0
        ? 'No decisions recorded yet. Run a measurement and it will be logged here before the outcome is known.'
        : `${resolved.length} decision${resolved.length === 1 ? '' : 's'} recorded, none matured yet. ` +
          `The first one can be scored in ${soonest} days. Nothing is judged before its horizon — an open position is not yet right or wrong.`;
  } else if (done.length < 5) {
    verdict =
      `${done.length} decision${done.length === 1 ? '' : 's'} matured. That is far too few to say anything about ` +
      `your calibration; the numbers below are shown so you can watch them settle, not so you can read them yet.`;
  } else if (overconfidencePp !== null && overconfidencePp > 12) {
    verdict =
      `Across ${done.length} matured decisions you averaged ${Math.round((yourMeanProb ?? 0) * 100)}% confidence ` +
      `and were right ${Math.round((observedRate ?? 0) * 100)}% of the time — overconfident by ` +
      `${overconfidencePp.toFixed(0)} points. That gap is the thing this app exists to show you.`;
  } else if (overconfidencePp !== null && overconfidencePp < -12) {
    verdict =
      `Across ${done.length} matured decisions you averaged ${Math.round((yourMeanProb ?? 0) * 100)}% confidence ` +
      `and were right ${Math.round((observedRate ?? 0) * 100)}% of the time. You are underconfident — you know more ` +
      `than you are giving yourself credit for.`;
  } else {
    verdict =
      `Across ${done.length} matured decisions you averaged ${Math.round((yourMeanProb ?? 0) * 100)}% confidence ` +
      `and were right ${Math.round((observedRate ?? 0) * 100)}% of the time. That is well calibrated — rarer than you think.`;
  }

  return {
    total: resolved.length,
    matured: done.length,
    open: resolved.length - done.length,
    yourBrier,
    modelBrier,
    baseRate: observedRate,
    baselineBrier,
    yourHitRate:
      done.length > 0
        ? +(done.filter((r) => r.closer === 'you').length / done.length).toFixed(3)
        : null,
    yourMeanProb,
    modelMeanProb,
    observedRate,
    overconfidencePp,
    verdict,
    decisions: resolved,
  };
}
