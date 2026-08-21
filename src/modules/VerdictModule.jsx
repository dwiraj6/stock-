/* MODULE 7 · THE VERDICT
   ────────────────────────────────────────────────────────────────
   The reasoning cites real metrics, not adjectives. The suggestion
   quotes a real number computed from this stock's own simulation —
   if the SIP only cut the worst case by four percent we would have
   to say four. */

import { rupees } from '../lib/format.js';

export default function VerdictModule({ quote, model, sim, amount, conviction, animate = true }) {
  /* The verdict and the suggestion are computed server-side from
     the real simulation — the client renders them, it does not
     re-derive them. */
  const verdict = model.verdict;

  const lumpLoss = amount - sim.lump.p10;
  const sipLoss = amount - sim.sip.p10;
  const cutPct = lumpLoss > 0 ? Math.round(((lumpLoss - sipLoss) / lumpLoss) * 100) : 0;
  const tranche = Math.round(sim.sip.tranche);

  // The two weakest weighted components carry the reasoning.
  const weak = model.components
    .filter((c) => c.weight)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  return (
    <section aria-labelledby="verdict-eyebrow">
      <p className="eyebrow" id="verdict-eyebrow">So</p>

      <div
        style={{
          marginTop: 24,
          background: 'var(--color-card)',
          border: '1px solid var(--color-rule)',
          padding: 48,
          maxWidth: 820,
          marginLeft: 'auto',
          marginRight: 'auto',
          animation: animate ? 'pl-fade-up 340ms var(--ease-out) 0ms both' : 'none',
        }}
      >
        <h2
          className="font-display"
          style={{ fontSize: 'var(--text-title)', lineHeight: 1.1, textAlign: 'center' }}
        >
          {verdict.text}
        </h2>

        <p
          className="font-body"
          style={{
            fontSize: 'var(--text-lead)',
            marginTop: 24,
            textAlign: 'center',
            maxWidth: '58ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {weak[0].name} scores <span className="font-data">{weak[0].score}</span> of{' '}
          <span className="font-data">10</span> —{' '}
          {lowerFirst(weak[0].metric)}. {weak[1].name} scores{' '}
          <span className="font-data">{weak[1].score}</span> of <span className="font-data">10</span>, with{' '}
          {lowerFirst(weak[1].metric)}.
        </p>

        <div
          style={{
            marginTop: 32,
            background: 'var(--color-paper-deep)',
            padding: 24,
          }}
        >
          <p className="font-body" style={{ fontSize: '1rem', textAlign: 'center' }}>
            {cutPct > 0 ? (
              <>
                If you still want exposure: <span className="font-data">{rupees(tranche)}</span>{' '}
                monthly instead of <span className="font-data">{rupees(amount)}</span> today cuts
                your worst case by <span className="font-data">{cutPct}%</span>.
              </>
            ) : (
              <>
                Spreading the same <span className="font-data">{rupees(amount)}</span> across twelve
                months does not improve the worst case here — this stock’s downside comes from
                its drift, not its timing.
              </>
            )}
          </p>
        </div>

        <p
          className="font-data"
          style={{
            marginTop: 32,
            fontSize: '0.75rem',
            color: 'var(--color-graphite)',
            textAlign: 'center',
          }}
        >
          Educational tool. Not registered investment advice.
        </p>
      </div>
    </section>
  );
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
