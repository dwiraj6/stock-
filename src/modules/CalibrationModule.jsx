/* MODULE 6 · CALIBRATION
   ────────────────────────────────────────────────────────────────
   The credibility exhibit. Twenty panels; the three that missed
   are marked in madder and arrive last, so the eye is drawn to
   them rather than away.

   Admitting the failure mode is the point. It is not softened. */

import { useState } from 'react';
import { pctSigned } from '../lib/format.js';
import { useBreakpoint } from '../lib/hooks.js';

const WAVE = 40; // 40ms stagger

export default function CalibrationModule({ calibration, animate = true }) {
  /* Everything here is the committed point-in-time backtest served by
     /api/calibration. No number on this panel is computed at render
     time, and none of it is illustrative. */
  if (!calibration || !calibration.entries?.length) {
    return (
      <section aria-labelledby="calib-eyebrow">
        <p className="eyebrow" id="calib-eyebrow">Does this model actually work?</p>
        <p className="font-body prose-measure" style={{ marginTop: 18, fontSize: 'var(--text-lead)' }}>
          The backtest has not been generated for this deployment yet, so no accuracy
          claim is being made.
        </p>
      </section>
    );
  }
  const CALIBRATION = calibration.entries;
  const HITS = calibration.hits;
  const TOTAL = calibration.total;
  const MISSES = CALIBRATION.filter((c) => !c.hit);
  const bp = useBreakpoint();
  const [expanded, setExpanded] = useState(null);

  const cols = bp === 'sm' ? 2 : bp === 'md' ? 4 : 5;

  // Hits first in the wave; the misses arrive 200ms after the hits
  // have finished.
  const hitOrder = [];
  const missOrder = [];
  CALIBRATION.forEach((c, i) => (c.hit ? hitOrder : missOrder).push(i));
  const delayFor = (i) => {
    const h = hitOrder.indexOf(i);
    if (h >= 0) return h * WAVE;
    const m = missOrder.indexOf(i);
    return hitOrder.length * WAVE + 200 + m * WAVE;
  };

  return (
    <section aria-labelledby="calib-eyebrow">
      <p className="eyebrow" id="calib-eyebrow">Does this model actually work?</p>

      <h2
        className="font-display"
        style={{ fontSize: 'var(--text-head)', marginTop: 18, maxWidth: '24ch' }}
      >
        Across <span className="font-data">{TOTAL}</span> NSE stocks, the real 12-month
        outcome landed inside our 80% band <span className="font-data">{HITS}</span> times.
      </h2>

      <div
        style={{
          marginTop: 32,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: 12,
        }}
      >
        {CALIBRATION.map((c, i) => {
          const open = expanded === i;
          return (
            <div
              key={c.ticker}
              style={{
                gridColumn: open ? `1 / -1` : 'auto',
                transition: 'grid-column 340ms var(--ease-out)',
                animation: animate
                  ? `pl-fade-up 300ms var(--ease-out) ${delayFor(i)}ms both`
                  : 'none',
                '--pl-rise': '8px',
              }}
            >
              <button
                onClick={() => setExpanded(open ? null : i)}
                aria-expanded={open}
                className="w-full text-left"
                style={{
                  background: 'transparent',
                  border: `1px solid ${c.hit ? 'var(--color-rule)' : 'var(--color-madder)'}`,
                  borderRadius: 0,
                  padding: 10,
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                }}
              >
                <Sparkline entry={c} tall={open} />
                <div className="flex items-baseline justify-between" style={{ marginTop: 8 }}>
                  <span
                    className="font-data"
                    style={{
                      fontSize: '0.75rem',
                      color: c.hit ? 'var(--color-graphite)' : 'var(--color-madder)',
                    }}
                  >
                    {c.ticker}
                  </span>
                  <span
                    className="font-data"
                    style={{
                      fontSize: '0.75rem',
                      color: c.hit ? 'var(--color-graphite)' : 'var(--color-madder)',
                    }}
                  >
                    {c.hit ? 'inside' : 'outside'}
                  </span>
                </div>
                {open && (
                  <p
                    className="font-body"
                    style={{
                      marginTop: 12,
                      fontSize: '1rem',
                      lineHeight: 1.6,
                      maxWidth: '68ch',
                      animation: animate ? 'pl-fade-in 200ms linear 120ms both' : 'none',
                    }}
                  >
                    {c.note}
                  </p>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* the well — the failure mode, stated plainly */}
      <div
        style={{
          marginTop: 32,
          background: 'var(--color-paper-deep)',
          padding: 32,
        }}
      >
        <p className="font-body prose-measure" style={{ fontSize: '1rem', lineHeight: 1.65 }}>
          {calibration.missNarrative}
        </p>
        <p
          className="font-body prose-measure"
          style={{ fontSize: '0.9375rem', lineHeight: 1.65, marginTop: 14, color: 'var(--color-graphite)' }}
        >
          {calibration.interpretation}
        </p>
      </div>
    </section>
  );
}

function Sparkline({ entry, tall }) {
  const W = 100;
  const H = tall ? 160 : 52;
  const pad = 3;

  /* Each entry carries its own point count: the predicted band and
     the realised path are sampled independently by the backtest, so
     the panel reads both from the entry rather than assuming a
     shared constant. */
  const bandN = entry.band?.length ?? 0;
  const actualN = entry.actual?.length ?? 0;
  if (bandN < 2 || actualN < 2) return null;

  let lo = Infinity;
  let hi = -Infinity;
  for (const b of entry.band) {
    lo = Math.min(lo, b.lo);
    hi = Math.max(hi, b.hi);
  }
  for (const v of entry.actual) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = hi - lo || 1;
  const xb = (i) => (i / (bandN - 1)) * W;
  const xa = (i) => (i / (actualN - 1)) * W;
  const y = (v) => pad + (1 - (v - lo) / span) * (H - pad * 2);

  let band = `M${xb(0).toFixed(1)} ${y(entry.band[0].hi).toFixed(1)}`;
  for (let i = 1; i < bandN; i++) band += `L${xb(i).toFixed(1)} ${y(entry.band[i].hi).toFixed(1)}`;
  for (let i = bandN - 1; i >= 0; i--) band += `L${xb(i).toFixed(1)} ${y(entry.band[i].lo).toFixed(1)}`;
  band += 'Z';

  let path = '';
  for (let i = 0; i < actualN; i++) {
    path += `${i === 0 ? 'M' : 'L'}${xa(i).toFixed(1)} ${y(entry.actual[i]).toFixed(1)}`;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', transition: 'height 340ms var(--ease-out)' }}
    >
      <path d={band} fill="var(--color-madder)" fillOpacity="0.08" stroke="none" />
      <path
        d={band}
        fill="none"
        stroke="var(--color-madder)"
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
