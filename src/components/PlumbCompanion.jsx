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
import { observe } from '../lib/observe.js';

export default function PlumbCompanion({ open, onOpen, symbol, answering, answeredAt, run }) {
  const reduced = useReducedMotion();
  const bp = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [swing, setSwing] = useState(0);
  const [noticeShown, setNoticeShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const firstAnswer = useRef(true);

  /* The observation is computed from the payload already on screen —
     never generated. It cannot contradict the charts beside it, it
     arrives instantly, and it costs none of the 20-requests-per-day
     Gemini budget, which a greeting on every page load would spend
     before anyone asked a real question. */
  const notice = observe(run);

  /* It appears once, a beat after the page settles, and stays until
     dismissed or opened. It does not reappear, pulse or re-animate:
     the brief's one-moment-then-stillness rule applies to the bob as
     much as to the charts. */
  useEffect(() => {
    if (!notice || dismissed) return;
    const t = window.setTimeout(() => setNoticeShown(true), reduced ? 0 : 3200);
    return () => window.clearTimeout(t);
  }, [notice, dismissed, reduced]);

  // A new stock is a new observation.
  useEffect(() => {
    setNoticeShown(false);
    setDismissed(false);
  }, [symbol]);

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

  const showNotice = noticeShown && notice && !dismissed && !answering;

  const H = 46;
  const W = 26;
  const cx = W / 2;
  const lineLen = H - 13;

  return (
    <div
      style={{
        position: 'fixed',
        right: 28,
        bottom: 28,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
        maxWidth: 340,
      }}
    >
      {/* ── what the bob noticed ── */}
      {showNotice && (
        <div
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-rule)',
            borderRight: '2px solid var(--color-ink)',
            padding: '16px 18px',
            animation: reduced ? 'none' : 'pl-fade-up 340ms var(--ease-out) both',
            '--pl-rise': '8px',
          }}
        >
          <p
            className="font-body"
            style={{ fontSize: '0.9375rem', lineHeight: 1.55, color: 'var(--color-ink)', margin: 0 }}
          >
            {notice.text}
          </p>
          <div className="flex items-center" style={{ gap: 14, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => onOpen(notice.followUp)}
              className="font-data"
              style={{
                background: 'var(--color-ink)',
                color: 'var(--color-paper)',
                border: 'none',
                borderRadius: 3,
                padding: '7px 12px',
                fontSize: '0.75rem',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              {notice.followUp}
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                setNoticeShown(false);
              }}
              className="font-data"
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--color-graphite)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

    <button
      type="button"
      onClick={() => onOpen()}
      className="pl-companion"
      aria-label={`Ask about ${symbol ?? 'this stock'}`}
      title={`Ask about ${symbol ?? 'this stock'}`}
      style={{
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
    </div>
  );
}
