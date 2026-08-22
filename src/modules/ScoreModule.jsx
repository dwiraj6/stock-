/* MODULE 4 · THE SCORE, BROKEN OPEN
   ────────────────────────────────────────────────────────────────
   Where the number came from. Five components, each a row: the
   name, the same rail again, the score, and underneath it the
   actual metric that drove it.

   The bars fill --ink for the achieved portion and --paper-deep for
   the remainder. Never coloured by good or bad — the number and the
   sentence carry that. A red bar would be the chart telling you
   what to think before you have read the reason. */

import { useEffect, useState } from 'react';
import { ScoreRail } from '../components/Rail.jsx';
import { useCountUp } from '../lib/hooks.js';
import { subscribeHighlight } from '../lib/highlight.js';

const BAR_STAGGER = 80;
const BAR_DUR = 400;

const sumOf = (components) =>
  components.reduce((s, c) => s + c.score * c.weight, 0);

export default function ScoreModule({ quote, model, conviction, animate = true }) {
  const [highlight, setHighlight] = useState(null);
  useEffect(() => subscribeHighlight(setHighlight), []);

  /* SIGNED, not absolute. The old guard used Math.abs while the
     server only ever built the list for a POSITIVE gap, so an
     under-confident rating — 54 against a model's 73 — rendered a
     panel promising "the three things the numbers see" and then
     listed nothing at all. The two conditions have to be the same
     condition. */
  const signedGap = model.gap ?? conviction - model.score;
  const discountingReasons = model.discounting ?? [];
  const supportingReasons = model.supporting ?? [];
  const settled = model.components.length * BAR_STAGGER + BAR_DUR;

  return (
    <section aria-labelledby="score-eyebrow">
      <p className="eyebrow" id="score-eyebrow">Where the {model.score} came from</p>

      <div className="pl-split-6-6" style={{ marginTop: 24 }}>
        {/* ── left: the components ── */}
        <div style={{ minWidth: 0 }}>
          {model.components.map((c, i) => (
            <ComponentRow
              key={c.key}
              c={c}
              index={i}
              animate={animate}
              highlighted={highlight === c.key}
            />
          ))}

          <p
            className="font-data"
            style={{
              marginTop: 18,
              fontSize: '0.75rem',
              color: 'var(--color-graphite)',
              lineHeight: 1.7,
            }}
          >
            {/* The arithmetic, spelled out from the same component
                scores printed above, so a reader can check it by hand
                and arrive at the number in the hero. */}
            {model.components
              .map((c) => `${c.score.toFixed(1)} × ${(c.weight * 100).toFixed(0)}%`)
              .join('  +  ')}
            <br />
            = {sumOf(model.components).toFixed(2)} × 10 = {model.score}
            {model.sectorConstituents ? (
              <>
                <br />
                Sector medians from {model.sectorConstituents} {model.sector} constituents of the
                NIFTY 500.
              </>
            ) : null}
          </p>
        </div>

        {/* ── right: where you and the numbers disagree ──
            Two directions, and the panel only appears when there is
            something in it to read. */}
        <div style={{ minWidth: 0 }}>
          {signedGap > 15 && discountingReasons.length > 0 && (
            <Gap
              eyebrow="What you’re discounting"
              lead={
                <>
                  You rated this <span className="font-data">{conviction}</span>. The model says{' '}
                  <span className="font-data">{model.score}</span>. What the numbers see that
                  your rating doesn’t:
                </>
              }
              reasons={discountingReasons}
              animate={animate}
              delay={settled}
            />
          )}
          {signedGap < -15 && supportingReasons.length > 0 && (
            <Gap
              eyebrow="What you’re discounting in your own favour"
              lead={
                <>
                  You rated this <span className="font-data">{conviction}</span>. The model says{' '}
                  <span className="font-data">{model.score}</span> — you are being harder on this
                  stock than the numbers are. What they see that your rating doesn’t:
                </>
              }
              reasons={supportingReasons}
              animate={animate}
              delay={settled}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ComponentRow({ c, index, animate, highlighted }) {
  const delay = index * BAR_STAGGER;
  const counted = useCountUp(c.score, { duration: BAR_DUR, delay, active: animate });

  return (
    <div
      data-metric={c.key}
      style={{
        borderTop: index === 0 ? 'none' : '1px solid var(--color-rule)',
        padding: '16px 12px 16px 0',
        marginLeft: -12,
        paddingLeft: 12,
        background: highlighted ? 'var(--color-paper-deep)' : 'transparent',
        transition: 'background var(--dur-instant) var(--ease-out)',
      }}
    >
      <div className="flex items-baseline justify-between" style={{ gap: 16 }}>
        <span className="font-body" style={{ fontSize: '1rem' }}>
          {c.name}
        </span>
        <span className="font-data" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
          {Math.round(counted)}
          <span style={{ color: 'var(--color-graphite)' }}>/10</span>
        </span>
      </div>

      <div style={{ margin: '10px 0 8px' }}>
        <ScoreRail score={c.score} delay={delay} animate={animate} />
      </div>

      <p
        className="font-body"
        style={{ fontSize: '0.875rem', color: 'var(--color-graphite)', lineHeight: 1.55 }}
      >
        {c.metric}
      </p>
    </div>
  );
}

function Gap({ eyebrow, lead, reasons, animate, delay }) {
  return (
    <div
      style={{
        background: 'var(--color-card)',
        /* the only 2px border in the entire application */
        borderLeft: '2px solid var(--color-madder)',
        borderTop: '1px solid var(--color-rule)',
        borderRight: '1px solid var(--color-rule)',
        borderBottom: '1px solid var(--color-rule)',
        animation: animate
          ? `pl-slide-left 340ms var(--ease-out) ${delay}ms both`
          : 'none',
      }}
    >
      <div style={{ padding: '24px 24px 16px' }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{eyebrow}</p>
        {/* Note what this NO LONGER says: "the three things". The
            list is capped at three but can be shorter, and promising
            a count the list cannot always meet is how a panel ends
            up advertising findings it does not have. */}
        <p className="font-body" style={{ fontSize: '1rem', lineHeight: 1.6 }}>{lead}</p>
      </div>

      {/* no bullets, no icons — the rules are the structure */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {reasons.map((r) => (
          <li
            key={r}
            className="font-body"
            style={{
              borderTop: '1px solid var(--color-rule)',
              padding: 16,
              fontSize: '1rem',
              lineHeight: 1.55,
            }}
          >
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
