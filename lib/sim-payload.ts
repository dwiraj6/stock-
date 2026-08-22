/* One builder for the simulate payload.
   ────────────────────────────────────────────────────────────────
   The route and the prewarm script both write this object into the
   same cache under the same key. They used to build it separately,
   and they drifted: prewarm kept writing the old shape after the
   payload gained `odds`, `width` and `driftSource`, so a prewarmed
   symbol served a payload missing the very fields the page had
   started reading. The cache schema version could not catch it —
   both writers agreed on the version and disagreed on the contents.

   Two writers, one shape. Anything that caches a simulation goes
   through here. */

import type { Bar, Meta } from './types';
import { estimateParams, simulate, LIMITATION } from './simulate';

export function buildSimPayload(args: {
  symbol: string;
  name: string;
  amount: number;
  bars: Bar[];
  meta: Meta;
}) {
  const params = estimateParams(args.bars, args.symbol, 2);
  if (!params) return null;
  const sim = simulate(params, args.amount);

  return {
    symbol: args.symbol,
    name: args.name,
    amount: args.amount,
    lumpsum: sim.lumpsum,
    sip: sim.sip,
    odds: sim.odds,
    sipOdds: sim.sipOdds,
    /* Band width as a share of the stake — the quantity the backtest
       validates, and the one that actually discriminates between
       stocks (50% of stake for HDFCBANK, 100% for TMCV). */
    width: (['2M', '6M', '12M'] as const).reduce(
      (acc, k) => {
        const L = sim.lumpsum[k];
        acc[k] = +((L.p90 - L.p10) / args.amount).toFixed(4);
        return acc;
      },
      {} as Record<string, number>
    ),
    paths: sim.paths,
    pathPoints: sim.pathPoints,
    band: sim.band,
    density: sim.density,
    params: {
      mu: params.muAnnual,
      observedMu: params.observedMuAnnual,
      driftSource: params.driftSource,
      sigma: params.sigmaAnnual,
      muDaily: params.muDaily,
      sigmaDaily: params.sigmaDaily,
      dataPoints: params.dataPoints,
      winsorized: params.winsorized,
      seed: params.seed,
    },
    warning: params.warning,
    limitation: LIMITATION,
    meta: args.meta,
  };
}

export type SimPayload = NonNullable<ReturnType<typeof buildSimPayload>>;
