/* POST /api/score  { symbol, conviction }
   The gap, the five components with their evidence, the discounting
   list, the verdict, and a SIP suggestion computed from the actual
   simulation — not a made-up percentage. */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard, logTier } from '@/lib/api';
import { requireUser } from '@/lib/require-auth';
import { resolveSymbol } from '@/lib/symbols';
import { fetchFundamentals, fetchHistory } from '@/lib/market-data';
import { estimateParams, simulate } from '@/lib/simulate';
import { scoreStock, discounting, supporting, verdictFor } from '@/lib/score';
import { recordSession } from '@/lib/mongo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({
  symbol: z.string().min(1),
  conviction: z.number().min(0).max(100),
  amount: z.number().positive().max(1_000_000_000).optional(),
});

export async function POST(req: NextRequest) {
  return guard('score', async () => {
    /* The measurement itself is gated. The UI redirects to /login
       before it gets here, but a gate that lives only in the client
       is decoration — this is the one that holds against curl. */
    const gate = await requireUser();
    if ('response' in gate) return gate.response;

    let parsed;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'The request body is not valid.',
        'Send { symbol: string, conviction: number 0-100 }.');
    }

    const r = resolveSymbol(parsed.symbol);
    if (!r.found) {
      return fail('SYMBOL_NOT_FOUND', `${parsed.symbol.toUpperCase()} isn’t listed on NSE or BSE.`,
        'Pick one of the suggested symbols, or search again.',
        { suggestions: r.suggestions.map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })) });
    }
    const rec = r.symbol;

    const [hist, fund] = await Promise.all([fetchHistory(rec, 3), fetchFundamentals(rec)]);
    if (!hist || hist.data.length === 0) {
      return fail('INSUFFICIENT_DATA', `No price history is available for ${rec.symbol}.`,
        'This symbol may be newly listed or suspended. Try another symbol.', { daysAvailable: 0 });
    }
    if (!fund) {
      return fail('UPSTREAM_DEGRADED',
        `Fundamentals for ${rec.symbol} could not be loaded, so the score cannot be computed.`,
        'Try again in a moment — price history is available, only the fundamentals feed failed.',
        { meta: hist.meta });
    }

    const params = estimateParams(hist.data, rec.symbol, 2);
    const result = scoreStock(hist.data, fund.data, params);

    /* The headline gap is now between two PROBABILITIES of the same
       event — the user's stated odds of making money, and the share
       of simulated futures that did. Same unit, same question.
       The composite 0-100 score is still computed and still shown as
       the evidence underneath, but it is no longer the headline: it
       is a weighted average of hand-chosen weights and nothing
       validates it. The odds are a count of outcomes. */
    const amountForOdds = parsed.amount ?? 50_000;
    const simForOdds = params ? simulate(params, amountForOdds) : null;
    const modelProb = simForOdds ? simForOdds.odds['12M'].profit : null;
    const userProb = parsed.conviction / 100;
    const oddsGapPp =
      modelProb === null ? null : Math.round((userProb - modelProb) * 100);

    const gap = parsed.conviction - result.modelScore;
    const verdict = verdictFor(parsed.conviction, result.modelScore);

    // The suggestion quotes the real reduction in the p10 outcome.
    let suggestion: {
      text: string;
      monthly: number | null;
      p10Improvement: number | null;
      p10ImprovementPct: number | null;
    } = { text: '', monthly: null, p10Improvement: null, p10ImprovementPct: null };

    const amount = parsed.amount ?? 50_000;
    if (params) {
      const sim = simulate(params, amount);
      const lump = sim.lumpsum['12M'];
      const sip = sim.sip['12M'];
      const lumpLoss = amount - lump.p10;
      const sipLoss = amount - sip.p10;
      const monthly = Math.round(amount / 12);
      if (lumpLoss > 0) {
        const cut = lumpLoss - sipLoss;
        const cutPct = Math.round((cut / lumpLoss) * 100);
        suggestion = {
          text:
            cutPct > 0
              ? `If you still want exposure: ₹${monthly.toLocaleString('en-IN')} monthly instead of ` +
                `₹${amount.toLocaleString('en-IN')} today cuts your worst case by ${cutPct}%.`
              : `Spreading the same ₹${amount.toLocaleString('en-IN')} across twelve months does not ` +
                `improve the worst case here — this stock's downside comes from its drift, not its timing.`,
          monthly,
          p10Improvement: Math.round(cut),
          p10ImprovementPct: cutPct,
        };
      } else {
        suggestion = {
          text: `The simulation's worst tenth percentile is above your ₹${amount.toLocaleString('en-IN')} ` +
            `at twelve months, so there is no downside for a SIP to cut.`,
          monthly,
          p10Improvement: null,
          p10ImprovementPct: null,
        };
      }
    }

    logTier('score', rec.symbol, hist.meta);
    void recordSession({
      symbol: rec.symbol,
      conviction: parsed.conviction,
      modelScore: result.modelScore,
      gap,
    });

    return ok(
      {
        symbol: rec.symbol,
        name: rec.name,
        conviction: parsed.conviction,
        // ── the headline ──
        userProb,
        modelProb,
        oddsGapPp,
        absOddsGapPp: oddsGapPp === null ? null : Math.abs(oddsGapPp),
        odds: simForOdds ? simForOdds.odds : null,
        width: simForOdds
          ? +(((simForOdds.lumpsum['12M'].p90 - simForOdds.lumpsum['12M'].p10) / amountForOdds).toFixed(4))
          : null,
        band: simForOdds
          ? { p10: simForOdds.lumpsum['12M'].p10, p90: simForOdds.lumpsum['12M'].p90 }
          : null,
        // ── the evidence, demoted ──
        modelScore: result.modelScore,
        gap,
        absGap: Math.abs(gap),
        components: result.components,
        // Only surfaced when the user is materially more confident
        // than the model (Part 6.3).
        discounting: gap > 15 ? discounting(result, fund.data, hist.data) : [],
        /* The mirror: what the numbers see when the user is being
           HARDER on the stock than the evidence warrants. The client
           guarded on the absolute gap while this was only built for
           the positive one, so an under-confident rating rendered a
           panel promising three findings and listing none. */
        supporting: gap < -15 ? supporting(result) : [],
        verdict,
        suggestion,
        sector: result.sector,
        sectorConstituents: result.sectorConstituents,
        sectorMediansGeneratedAt: result.sectorMediansGeneratedAt,
        warning: params?.warning ?? null,
        meta: { ...hist.meta, degraded: hist.meta.degraded || fund.meta.degraded },
      },
      { ttlSeconds: 300 }
    );
  });
}
