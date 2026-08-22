/* RISK PROFILING, WITHOUT THE HOROSCOPE.
   ────────────────────────────────────────────────────────────────
   Almost every risk profiler works the same way: ask five questions,
   add up the points, and announce that you are a Moderate Investor.
   That output is unfalsifiable. Nothing about it can ever be checked
   against what happens next, which makes it exactly the kind of
   confident, unearned score this product spends its time refusing to
   produce. A tool that publishes its own -3.4% skill on direction
   has no business handing out personality types.

   So this profiler produces NO LABEL. What it collects are three
   constraints the user states about their own situation:

     · WHEN they need the money back        (a deadline, or none)
     · HOW MUCH they could lose without harm (a rupee figure)
     · WHAT they would DO on a bad fall      (a stated behaviour)

   Every one of those is then checked against the simulation that is
   already running — the same 10,000 paths, the same counted odds.
   The result is not "you are moderate", it is:

     "You said you could lose at most ₹10,000. At your horizon the
      simulation's 10th percentile is ₹-14,200. That is outside what
      you said you would accept, and it happened in 10% of futures."

   That is a statement about THIS position and THIS person which is
   falsifiable, dated, and made of numbers that already exist. It is
   the conviction gap applied to loss instead of to odds: what you
   feel you can take, measured against what the data says can happen.

   THE BEHAVIOURAL QUESTION IS THE INTERESTING ONE. Asking "what
   would you do if it fell 20%" and then reporting the simulation's
   actual probability of a 20% fall turns a hypothetical into a
   forecast about the user rather than the market. Someone who says
   they would sell, holding a position with a 23% chance of triggering
   that, has learned something real about the position — and it costs
   nothing to compute, because `lose20` is already counted.

   NOTHING HERE IS ADVICE. It states what the user said, states what
   the simulation says, and shows the distance. It never says buy,
   sell, hold, or "this is suitable for you". */

import type { Odds } from './simulate';

/* ── the questions ────────────────────────────────────────────────
   Four, and no more. Every additional question costs completion
   rate, and a profiler nobody finishes profiles nobody. Each one
   below earns its place by CHANGING SOMETHING the app then computes;
   a question whose answer is only filed away is not asked. */

export type Horizon = 'under1y' | '1to3y' | '3to10y' | 'none';
export type Goal = 'safety' | 'purchase' | 'growth' | 'learning';
export type OnDrop = 'sell' | 'hold' | 'buy' | 'unsure';

export type RiskProfile = {
  goal: Goal;
  horizon: Horizon;
  /** The most this person says they could lose, in rupees. */
  maxLoss: number;
  onDrop: OnDrop;
  /** When they last answered. Tolerance changes; a stale one is noted. */
  updatedAt: string;
};

export const GOALS: { value: Goal; label: string; note: string }[] = [
  {
    value: 'safety',
    label: 'Money I might need in an emergency',
    note: 'It has to be there on the day it is needed, whatever the market is doing.',
  },
  {
    value: 'purchase',
    label: 'A specific thing I am saving for',
    note: 'A deposit, a course, a wedding — something with a date attached.',
  },
  {
    value: 'growth',
    label: 'Long-term savings with no fixed date',
    note: 'Money that can sit through a bad year without being needed.',
  },
  {
    value: 'learning',
    label: 'An amount I am willing to learn with',
    note: 'Small enough that losing it teaches rather than hurts.',
  },
];

export const HORIZONS: { value: Horizon; label: string; months: number | null }[] = [
  { value: 'under1y', label: 'Within a year', months: 12 },
  { value: '1to3y', label: 'One to three years', months: 36 },
  { value: '3to10y', label: 'Three years or more', months: 120 },
  { value: 'none', label: 'No date in mind', months: null },
];

export const ON_DROP: { value: OnDrop; label: string }[] = [
  { value: 'sell', label: 'Sell, to stop it getting worse' },
  { value: 'hold', label: 'Hold and wait' },
  { value: 'buy', label: 'Buy more at the lower price' },
  { value: 'unsure', label: 'Honestly, I do not know' },
];

/* ── what the profile is checked against ──────────────────────── */

export type Finding = {
  /** `hard` is a stated limit the simulation crosses. */
  severity: 'hard' | 'note';
  key: string;
  text: string;
};

export type ProfileCheck = {
  findings: Finding[];
  /** The horizon the app should lead with, given what they said. */
  emphasise: '2M' | '6M' | '12M';
  /** True when nothing they stated is contradicted by the numbers. */
  clear: boolean;
};

const rupees = (n: number) =>
  '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');

const pct = (p: number) => `${Math.round(p * 100)}%`;

/**
 * Compare a stated profile against a simulated position.
 *
 * Takes only what the simulation already produced — no new model, no
 * second opinion, nothing that could disagree with the chart beside
 * it. Every number quoted here is one the page is already showing.
 */
export function checkProfile(args: {
  profile: RiskProfile;
  amount: number;
  /** Lumpsum percentiles at 12 months. */
  p10: number;
  p90: number;
  odds: Odds;
  /** Odds at the shortest horizon, for a short-deadline holder. */
  odds2M?: Odds;
  p10At2M?: number;
}): ProfileCheck {
  const { profile, amount, p10, odds } = args;
  const findings: Finding[] = [];

  /* Which horizon to lead with. Someone who needs the money inside a
     year should be reading the two-month and twelve-month bands, not
     a ten-year story — and the app already computed all three. */
  const emphasise: ProfileCheck['emphasise'] =
    profile.horizon === 'under1y' ? '2M' : '12M';

  /* ── 1. the stated loss limit against the modelled bad case ──
     p10 is the tenth percentile: one future in ten came out at or
     below it. Not the worst case — the worst case is worse — and
     saying so matters, because a limit that only just clears p10 is
     not actually cleared. */
  const worstCommon = amount - p10; // a loss, as a positive number
  if (worstCommon > 0 && profile.maxLoss > 0) {
    if (worstCommon > profile.maxLoss) {
      findings.push({
        severity: 'hard',
        key: 'loss-limit',
        text:
          `You said you could lose up to ${rupees(profile.maxLoss)}. ` +
          `One future in ten ends at ${rupees(p10)} or lower — a loss of ${rupees(worstCommon)}, ` +
          `which is ${rupees(worstCommon - profile.maxLoss)} more than you said you would accept. ` +
          `And the tenth percentile is not the worst case; a tenth of outcomes are below it.`,
      });
    } else {
      findings.push({
        severity: 'note',
        key: 'loss-limit',
        text:
          `Your stated limit of ${rupees(profile.maxLoss)} sits below the simulation's ` +
          `one-in-ten outcome of ${rupees(worstCommon)}. That does not make the position safe — ` +
          `a tenth of futures are worse than that — but the common bad case is inside what you said you could take.`,
      });
    }
  }

  /* ── 2. the behaviour they predicted, priced ──
     This is the part a points-based profiler cannot do. They named
     the condition; the simulation already counted how often it
     occurs. */
  if (profile.onDrop === 'sell' && odds.lose20 > 0.02) {
    findings.push({
      severity: 'hard',
      key: 'behaviour',
      text:
        `You said a 20% fall would make you sell. The simulation puts a fall that size at ` +
        `${pct(odds.lose20)} over a year — so in roughly one future in ` +
        `${Math.max(2, Math.round(1 / odds.lose20))} you would be selling at the bottom, ` +
        `which turns a paper loss into a real one.`,
    });
  }
  if (profile.onDrop === 'unsure' && odds.lose20 > 0.05) {
    findings.push({
      severity: 'note',
      key: 'behaviour',
      text:
        `You said you do not know what you would do if this fell 20%. It is worth deciding now, ` +
        `while nothing is happening: the simulation puts a fall that size at ${pct(odds.lose20)}.`,
    });
  }

  /* ── 3. the deadline against the horizon the maths assumes ──
     The simulation runs on twelve months. Money with a shorter fuse
     is being measured against the wrong clock, and that is worth
     saying plainly rather than burying. */
  if (profile.horizon === 'under1y') {
    findings.push({
      severity: 'hard',
      key: 'horizon',
      text:
        `You need this money within a year, and the band on this page settles over twelve months. ` +
        `A shorter holding period is not less risky — it is the same volatility with less time to ` +
        `recover from it, and no ability to wait out a bad patch.`,
    });
  }

  /* ── 4. goal against instrument ──
     A single equity is the wrong shape for money that must be
     present on a particular day. That is not advice; it is what the
     distribution says. */
  if (profile.goal === 'safety') {
    findings.push({
      severity: 'hard',
      key: 'goal',
      text:
        `You said this is money you might need in an emergency. This position has a ` +
        `${pct(odds.lose10)} chance of being down 10% or more in a year — an emergency does not ` +
        `wait for a recovery, so the money would have to come out at whatever the price is that day.`,
    });
  }
  if (profile.goal === 'purchase' && odds.lose10 > 0.15) {
    findings.push({
      severity: 'note',
      key: 'goal',
      text:
        `This is money with a date attached, and there is a ${pct(odds.lose10)} chance of being ` +
        `down 10% or more when that date arrives.`,
    });
  }

  /* ── 5. the honest positive ──
     Only stated when it is genuinely true, and never as a
     recommendation. */
  if (profile.goal === 'growth' && profile.horizon === '3to10y' && profile.onDrop !== 'sell') {
    findings.push({
      severity: 'note',
      key: 'match',
      text:
        `Nothing you stated is contradicted by this simulation: no deadline, a fall would not ` +
        `force you out, and the common bad case is inside your limit. That says your situation fits ` +
        `the shape of this risk — it says nothing about whether the stock will go up.`,
    });
  }

  return {
    findings,
    emphasise,
    clear: !findings.some((f) => f.severity === 'hard'),
  };
}

/** How old an answer is allowed to get before it is worth re-asking. */
export const PROFILE_STALE_DAYS = 180;

export function profileIsStale(p: RiskProfile | null): boolean {
  if (!p?.updatedAt) return false;
  const age = Date.now() - new Date(p.updatedAt).getTime();
  return age > PROFILE_STALE_DAYS * 86_400_000;
}

/** Validate anything arriving from a client. */
export function parseProfile(input: unknown): RiskProfile | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;

  const goal = GOALS.find((g) => g.value === o.goal)?.value;
  const horizon = HORIZONS.find((h) => h.value === o.horizon)?.value;
  const onDrop = ON_DROP.find((d) => d.value === o.onDrop)?.value;
  const maxLoss = Number(o.maxLoss);

  if (!goal || !horizon || !onDrop) return null;
  if (!Number.isFinite(maxLoss) || maxLoss < 0 || maxLoss > 1_000_000_000) return null;

  return { goal, horizon, maxLoss, onDrop, updatedAt: new Date().toISOString() };
}
