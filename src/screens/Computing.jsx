/* SCREEN 2 · COMPUTING
   ────────────────────────────────────────────────────────────────
   Between submit and results. No spinner, no skeleton shimmer.
   A running log of what is actually being done.

   The simulation itself finishes in about 150ms. The log does not
   race ahead to meet it — if a real step finishes early we hold the
   rhythm, because a progress display that stutters through six
   states in a tenth of a second reads as fake, and this product's
   whole argument is that it is not. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { TickMark, Caret } from '../components/marks/Marks.jsx';
import { ProgressRail } from '../components/Rail.jsx';
import { useReducedMotion } from '../lib/hooks.js';

const STEP_MS = 220;      // each line appears 220ms after the previous
const COMPLETE_MS = 380;  // and completes this long after appearing
const HOLD_MS = 200;      // the final line holds
const FADE_MS = 200;      // then the block fades out

export default function Computing({ symbol, ready, onDone }) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  /* These name what the server is actually doing while the log
     plays: three requests are already in flight. */
  const lines = useMemo(
    () => [
      { text: `Fetching ${symbol?.symbol ?? ''}.NS · 3 years daily` },
      { text: 'Reading fundamentals · P/E, D/E, ROE' },
      { text: 'Estimating drift and volatility' },
      { text: 'Plotting 10,000 paths' },
      { text: 'Scoring against sector medians' },
      { text: 'Comparing lumpsum and SIP' },
    ],
    [symbol]
  );

  const total = lines.length;

  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
    const timers = [];
    for (let i = 0; i <= total; i++) {
      timers.push(window.setTimeout(() => setStep(i), i * STEP_MS));
    }
    const endAt = (total - 1) * STEP_MS + COMPLETE_MS + HOLD_MS;
    timers.push(window.setTimeout(() => setLeaving(true), endAt));
    timers.push(
      window.setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }, endAt + FADE_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [total, onDone, reduced]);

  if (reduced) return null;

  const elapsed = step * STEP_MS;
  const progress = Math.min(1, elapsed / ((total - 1) * STEP_MS + COMPLETE_MS));

  return (
    <main
      className="flex items-center justify-center"
      style={{
        minHeight: '68vh',
        padding: '0 24px',
        animation: leaving ? `pl-fade-out ${FADE_MS}ms linear both` : undefined,
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {lines.map((line, i) => {
            const appeared = step > i;
            const complete = elapsed >= i * STEP_MS + COMPLETE_MS;
            const active = appeared && !complete;
            if (!appeared) return <li key={line.text} style={{ height: 30 }} aria-hidden="true" />;
            return (
              <li
                key={line.text}
                className="font-data flex items-center"
                style={{
                  height: 30,
                  gap: 10,
                  fontSize: '0.875rem',
                  color: line.cache ? 'var(--color-madder)' : 'var(--color-graphite)',
                  animation: `pl-fade-in ${STEP_MS}ms var(--ease-out) both`,
                }}
              >
                <TickMark
                  state={complete ? (line.cache ? 'cache' : 'done') : 'pending'}
                />
                <span style={{ flex: 1 }}>{line.text}</span>
                {active && <Caret />}
                {complete && (
                  <span
                    aria-hidden="true"
                    style={{ color: line.cache ? 'var(--color-madder)' : 'var(--color-ink)' }}
                  >
                    <TickMark state={line.cache ? 'cache' : 'done'} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div style={{ marginTop: 28 }}>
          <ProgressRail value={progress} />
        </div>
      </div>
    </main>
  );
}
