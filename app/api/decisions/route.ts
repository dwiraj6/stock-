/* /api/decisions — the track record.
   POST logs a decision BEFORE the outcome exists.
   GET  resolves every logged decision against the CURRENT price and
        scores the user's calibration against the model's.

   The prices used on GET come through the normal fetch chain, so a
   matured decision is scored against a live quote during market
   hours and the last close otherwise — the same honesty the rest of
   the app applies to prices applies to verdicts about them. */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import { resolveSymbol, getSymbol } from '@/lib/symbols';
import { fetchQuote, fetchHistory } from '@/lib/market-data';
import { recordDecision, listDecisions, scoreDecisions } from '@/lib/decisions';
import { marketBlock } from '@/lib/api';
import { currentUser, userKey } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/* `who` is deliberately ABSENT from this schema.

   It used to be here, taken straight off the request, which meant a
   client could write into — and read back — any track record whose
   id it could name. Identity now comes from the session cookie and
   from nowhere else, so a decision can only ever be filed against
   the account that actually made it. */
const PostBody = z.object({
  symbol: z.string().min(1),
  amount: z.number().positive().max(1_000_000_000),
  userProb: z.number().min(0).max(1),
  modelProb: z.number().min(0).max(1),
  priceAt: z.number().positive(),
  horizonDays: z.number().int().min(1).max(756).optional(),
});

export async function POST(req: NextRequest) {
  return guard('decisions:post', async () => {
    const user = await currentUser();
    if (!user) {
      return fail(
        'AUTH_REQUIRED',
        'Sign in to record this measurement.',
        'Your answer is kept — signing in seals it with today’s price and starts the twelve-month clock.'
      );
    }

    let body;
    try {
      body = PostBody.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'The decision could not be recorded.',
        'Send { symbol, amount, userProb, modelProb, priceAt }.');
    }

    const r = resolveSymbol(body.symbol);
    if (!r.found) {
      return fail('SYMBOL_NOT_FOUND', `${body.symbol.toUpperCase()} isn’t listed.`,
        'Pick a listed symbol.',
        { suggestions: r.suggestions.map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })) });
    }

    const saved = await recordDecision({
      who: userKey(user),
      symbol: r.symbol.symbol,
      name: r.symbol.name,
      amount: body.amount,
      userProb: body.userProb,
      modelProb: body.modelProb,
      priceAt: body.priceAt,
      horizonDays: body.horizonDays ?? 252,
    });

    if (!saved) {
      return fail('UPSTREAM_DEGRADED', 'The decision could not be saved.',
        'The measurement itself is unaffected. Try again and it will be logged.');
    }
    return ok({ recorded: true, symbol: r.symbol.symbol });
  });
}

export async function GET(req: NextRequest) {
  return guard('decisions:get', async () => {
    const user = await currentUser();
    if (!user) {
      return fail(
        'AUTH_REQUIRED',
        'Sign in to see your track record.',
        'It is tied to your account so it survives a cleared browser — the horizon is twelve months.'
      );
    }

    /* The account's own key, plus every anonymous browser id it has
       adopted. Someone who measured on a laptop and a phone before
       signing up made both sets of decisions and owns both. */
    const keys = [userKey(user), ...(user.adopted ?? [])];
    const decisions = await listDecisions(keys, 100);
    if (decisions.length === 0) {
      return ok({
        track: {
          total: 0, matured: 0, open: 0,
          yourBrier: null, modelBrier: null, baseRate: null, baselineBrier: null,
          yourHitRate: null, yourMeanProb: null, modelMeanProb: null,
          observedRate: null, overconfidencePp: null,
          verdict: 'No decisions recorded yet. Run a measurement and it will be logged here before the outcome is known.',
          decisions: [],
        },
        ...marketBlock(),
      }, { ttlSeconds: 0 });
    }

    /* Price every distinct symbol once. A live quote during market
       hours, the last close otherwise; the adjusted close is used
       when the quote is unavailable so a decision is never scored
       against nothing. */
    const symbols = [...new Set(decisions.map((d) => d.symbol))];
    const prices: Record<string, number | null> = {};
    await Promise.all(
      symbols.map(async (s) => {
        const rec = getSymbol(s);
        if (!rec) { prices[s] = null; return; }
        const q = await fetchQuote(rec);
        if (q?.data.price != null) { prices[s] = q.data.price; return; }
        const h = await fetchHistory(rec, 1);
        const bars = h?.data ?? [];
        prices[s] = bars.length ? bars[bars.length - 1].adjClose : null;
      })
    );

    const track = scoreDecisions(decisions, prices);
    return ok({ track, ...marketBlock() }, { ttlSeconds: 30 });
  });
}
