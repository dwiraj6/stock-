/* PART 8 · EVERY STATE
   ────────────────────────────────────────────────────────────────
   Errors state what happened and what to do next. They never
   apologise and are never vague. No sad illustration. */

import { PlumbBob } from './marks/Marks.jsx';
import { Button } from './Inputs.jsx';

/* ── STALE CACHE ──
   A strip beneath the masthead. Slides down, dismissible, never
   blocks. */
export function StaleCacheStrip({ meta, onDismiss }) {
  return (
    <div
      role="status"
      style={{
        background: 'var(--color-paper-deep)',
        borderBottom: '1px solid var(--color-rule)',
        animation: 'pl-strip-down 240ms var(--ease-out) both',
        overflow: 'hidden',
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: 1200, padding: '8px 24px', gap: 16 }}
      >
        <span className="font-data" style={{ fontSize: '0.75rem', color: 'var(--color-madder)' }}>
          {meta?.note ??
            (meta?.isStale
              ? `Showing cached data from ${new Date(meta.fetchedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST. Live feed didn’t respond.`
              : 'Serving degraded data — one upstream source did not respond.')}
        </span>
        <button
          onClick={onDismiss}
          className="font-data"
          aria-label="Dismiss cache notice"
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            color: 'var(--color-graphite)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/* ── THIN DATA ── */
export function ThinDataNote({ text }) {
  return (
    <div
      role="status"
      style={{
        border: '1px solid var(--color-rule)',
        borderLeft: '2px solid var(--color-madder)',
        background: 'var(--color-card)',
        padding: '16px 20px',
        marginBottom: 32,
      }}
    >
      <p className="font-body prose-measure" style={{ fontSize: '1rem' }}>
        {text}
      </p>
    </div>
  );
}

/* ── FAILED ── */
export function FailedState({ ticker, payload, onRetry, onHome, onPickSuggestion }) {
  return (
    <main
      className="flex items-center justify-center"
      style={{ minHeight: '62vh', padding: '0 24px' }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        <p className="eyebrow">{payload?.code === 'SYMBOL_NOT_FOUND' ? 'Not listed' : `Could not load ${ticker}`}</p>
        {/* The message and the next step come from the server's typed
            error, so the screen says what actually happened. */}
        <p className="font-body prose-measure" style={{ fontSize: 'var(--text-lead)', marginTop: 16 }}>
          {payload?.message ?? 'Couldn’t reach Yahoo Finance or the cache. Try again in a moment.'}
        </p>
        <p className="font-body prose-measure" style={{ marginTop: 10, color: 'var(--color-graphite)' }}>
          {payload?.action ?? 'Try again in a moment.'}
        </p>
        {Array.isArray(payload?.suggestions) && payload.suggestions.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 18 }}>
            {payload.suggestions.map((s) => (
              <button
                key={s.symbol}
                onClick={() => onPickSuggestion?.(s.symbol)}
                className="font-data"
                style={{
                  border: '1px solid var(--color-rule)', borderRadius: 3,
                  background: 'transparent', padding: '6px 12px',
                  cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-ink)',
                }}
              >
                {s.symbol}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center" style={{ gap: 24, marginTop: 32 }}>
          <Button onClick={onRetry}>Try again</Button>
          <button
            onClick={onHome}
            className="font-body"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '0.9375rem',
              color: 'var(--color-graphite)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Start over
          </button>
        </div>
      </div>
    </main>
  );
}

/* ── EMPTY ──
   Plumb bob visible, everything else absent. */
export function EmptyState({ onHome }) {
  return (
    <main className="flex flex-col items-center" style={{ padding: '0 24px' }}>
      <PlumbBob height={180} animate={false} />
      <p
        className="font-body"
        style={{ fontSize: 'var(--text-lead)', marginTop: 40, color: 'var(--color-ink)' }}
      >
        Enter a stock to begin.
      </p>
      <button
        onClick={onHome}
        className="font-data"
        style={{
          marginTop: 24,
          background: 'none',
          border: '1px solid var(--color-rule)',
          borderRadius: 3,
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '0.75rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink)',
        }}
      >
        Back
      </button>
    </main>
  );
}
