/* MODULE · WHAT YOU SAID, AGAINST WHAT THE NUMBERS SAY
   ────────────────────────────────────────────────────────────────
   The risk profile's payoff, and the reason it is not a label.

   Everywhere else, a risk profiler ends at "you are a Moderate
   Investor" and the answer is never mentioned again. Here the four
   answers come back on every measurement and are checked against
   THIS position: the loss limit against the tenth percentile, the
   stated behaviour against the counted probability of the fall that
   would trigger it, the deadline against the horizon the maths
   assumes.

   Every number quoted is one already on this page. The check runs in
   the browser off the payload the page is holding, so it cannot
   disagree with the chart above it and it costs no request.

   IT NEVER SAYS BUY, SELL, OR HOLD. It states what you said, states
   what the simulation says, and shows where the two do not meet.
   What to do about that is not the app's call. */

import { useMemo } from 'react';
/* The SAME module the server uses, imported rather than reimplemented.
   A second copy of this logic in the browser would drift from the
   first the day either changed, and the two disagreeing about
   whether a position breaks your stated limit is precisely the kind
   of quiet inconsistency this product exists to avoid.

   It is safe to bundle: risk-profile.ts imports only a TYPE from the
   simulation module, which is erased at compile time, so nothing
   server-side comes with it. */
import { checkProfile } from '@/lib/risk-profile';

export default function SituationCheck({ run, profile, onEdit, animate }) {
  const check = useMemo(() => {
    if (!profile || !run?.model || !run?.sim) return null;
    /* Read from the ADAPTED shapes the page is holding, not from the
       raw API payload: the adapter renames lumpsum -> horizons.lumpsum
       and carries the counted odds on `model`, because the score route
       is what computes them. Reading the wrong one fails silently —
       the module simply never renders — so it is worth naming here. */
    const L = run.sim.horizons?.lumpsum?.['12M'] ?? run.sim.lump;
    const odds = run.model.odds?.['12M'];
    if (!L || !odds) return null;
    return checkProfile({
      profile,
      amount: run.amount,
      p10: L.p10,
      p90: L.p90,
      odds,
    });
  }, [profile, run]);

  /* No profile: an invitation, not a nag. One line, and it says what
     it would buy them rather than "complete your profile". */
  if (!profile) {
    return (
      <section aria-labelledby="sit-eyebrow" className="sc">
        <p className="eyebrow" id="sit-eyebrow">
          Your situation
        </p>
        <p className="font-body sc-invite">
          This measurement can also be checked against your own limits — when you need the money,
          the most you could lose, what you would do if it fell 20%.{' '}
          <button type="button" className="sc-link" onClick={onEdit}>
            Answer four questions
          </button>{' '}
          and every measurement after this one is compared against them.
        </p>
      </section>
    );
  }

  if (!check) return null;

  const hard = check.findings.filter((f) => f.severity === 'hard');
  const notes = check.findings.filter((f) => f.severity === 'note');

  return (
    <section aria-labelledby="sit-eyebrow" className="sc">
      <p className="eyebrow" id="sit-eyebrow">
        What you said, against what the numbers say
      </p>

      <h2 className="font-display sc-verdict">
        {hard.length === 0
          ? 'Nothing you told us is contradicted by this simulation.'
          : hard.length === 1
            ? 'One thing you told us does not survive this simulation.'
            : `${hard.length} things you told us do not survive this simulation.`}
      </h2>

      <ul className="sc-list">
        {[...hard, ...notes].map((f, i) => (
          <li
            key={f.key}
            className={`sc-item ${f.severity === 'hard' ? 'is-hard' : ''}`}
            style={{
              animation: animate ? `pl-fade-up 320ms var(--ease-out) ${i * 60}ms both` : 'none',
              '--pl-rise': '8px',
            }}
          >
            <span className="sc-mark" aria-hidden="true" />
            <p className="font-body sc-text">{f.text}</p>
          </li>
        ))}
      </ul>

      <p className="font-body sc-fine">
        This compares your own answers with the simulation on this page. It is not advice, and it
        does not know anything about you that you did not type.{' '}
        <button type="button" className="sc-link" onClick={onEdit}>
          Change your answers
        </button>
      </p>
    </section>
  );
}
