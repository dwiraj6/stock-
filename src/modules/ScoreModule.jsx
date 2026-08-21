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

  const gap = Math.abs(model.gap ?? conviction - model.score);
  const reasons = model.discounting ?? [];
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

        {/* ── right: what you're discounting ── */}
        <div style={{ minWidth: 0 }}>
          {gap > 15 && (
            <Discounting
              conviction={conviction}
              score={model.score}
              reasons={reasons}
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

function Discounting({ conviction, score, reasons, animate, delay }) {
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
        <p className="eyebrow" style={{ marginBottom: 14 }}>What you’re discounting</p>
        <p className="font-body" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
          You rated this <span className="font-data">{conviction}</span>. The model says{' '}
          <span className="font-data">{score}</span>. The three things the numbers see that
          your rating doesn’t:
        </p>
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
