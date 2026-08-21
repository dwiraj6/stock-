/* THE PLUMB BOB, DOCKED.
   ────────────────────────────────────────────────────────────────
   The entry screen's plumb bob does not disappear when the results
   load — it shrinks and hangs in the corner, and tapping it opens
   the conversation. The product's signature object becomes the way
   you talk to the product.

   This is the mascot this design system already had. It carries the
   thesis (the thing that shows you what is actually true, after the
   wobble stops), it needs no new visual vocabulary, and it breaks
   none of Part 13: no emoji, no illustration, no blob, no floating
   circular bubble. A 1px line and a solid ink weight, which is what
   every other mark in this product is made of.

   MOTION (Part 9's rule holds: one moment, then stillness)
     · docks once when the results arrive, 340ms, ease-out
     · swings ONCE when a new stock loads — the same damped swing as
       the entry bob, because it is the same object
     · nudges once when an answer finishes streaming
     · otherwise it does not move. No idle bobbing, no attention
       -seeking loop. A mascot that fidgets is exactly the ambient
       motion the brief bans.
     · prefers-reduced-motion: renders docked and still, always. */

import { useEffect, useRef, useState } from 'react';
import { useBreakpoint, useReducedMotion } from '../lib/hooks.js';

export default function PlumbCompanion({ open, onOpen, symbol, answering, answeredAt }) {
  const reduced = useReducedMotion();
  const bp = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [swing, setSwing] = useState(0);
  const firstAnswer = useRef(true);

  // Dock once, shortly after the results settle.
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), reduced ? 0 : 900);
    return () => window.clearTimeout(t);
  }, [reduced]);

  // A new stock is a new measurement: swing once, settle.
  useEffect(() => {
    if (!symbol || reduced) return;
    setSwing((n) => n + 1);
  }, [symbol, reduced]);

  // One nudge when an answer lands — never a loop.
  useEffect(() => {
    if (!answeredAt || reduced) return;
    if (firstAnswer.current) {
      firstAnswer.current = false;
    }
    setSwing((n) => n + 1);
  }, [answeredAt, reduced]);

  /* Not rendered at all below 768px.
     A CSS media query cannot do this job: the element sets
     `display: flex` inline for its layout, and an inline style beats
     a stylesheet rule — media query included. Rather than escalate
     with !important, the component simply does not mount on a narrow
     screen, where it would hang over the content. The masthead's Ask
     button is the affordance there. */
  if (open || bp === 'sm') return null;

  const H = 46;
  const W = 26;
  const cx = W / 2;
  const lineLen = H - 13;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="pl-companion"
      aria-label={`Ask about ${symbol ?? 'this stock'}`}
      title={`Ask about ${symbol ?? 'this stock'}`}
      style={{
        position: 'fixed',
        right: 28,
        bottom: 28,
        zIndex: 50,
        background: 'var(--color-paper)',
        border: '1px solid var(--color-rule)',
        borderRadius: 3,
        padding: '10px 14px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: reduced
          ? 'none'
          : 'opacity var(--dur-normal) var(--ease-out), transform var(--dur-normal) var(--ease-out)',
      }}
    >
      <svg
        key={swing}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        style={{
          overflow: 'visible',
          transformOrigin: `${cx}px 0px`,
          /* The same damped pendulum as the entry bob, shortened.
             It runs once per key change and then holds. */
          animation:
            reduced || swing === 0
              ? 'none'
              : 'pl-plumb-swing 1100ms cubic-bezier(0.33,0,0.25,1) both',
        }}
      >
        <path d={`M${cx} 0 V${lineLen}`} stroke="var(--color-ink)" strokeWidth="1" />
        <path
          d={`M${cx} ${lineLen}
              C${cx - 3.6} ${lineLen + 2} ${cx - 3.9} ${lineLen + 6} ${cx} ${lineLen + 13}
              C${cx + 3.9} ${lineLen + 6} ${cx + 3.6} ${lineLen + 2} ${cx} ${lineLen} Z`}
          fill="var(--color-ink)"
        />
      </svg>

      <span
        className="font-data"
        style={{
          fontSize: '0.75rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-graphite)',
          lineHeight: 1,
        }}
      >
        {answering ? 'Thinking' : 'Ask'}
      </span>
    </button>
  );
}
