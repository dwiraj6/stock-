/* PART 2 · GLOBAL CHROME */

import { useEffect, useState } from 'react';
import { rupees2, pctSigned } from '../lib/format.js';
import { useBreakpoint } from '../lib/hooks.js';

export function Masthead({ quote, onMethodology, onAsk, onHome }) {
  const [compact, setCompact] = useState(false);
  const bp = useBreakpoint();

  useEffect(() => {
    /* Read scroll position inside a rAF rather than in the listener.
       The listener fires many times per frame on a trackpad; reading
       window.scrollY there forces layout each time. Coalescing to one
       read per frame costs nothing and keeps scrolling off the main
       thread's critical path. */
    let ticking = false;
    const on = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setCompact(window.scrollY > 200);
        ticking = false;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, []);

  const small = bp === 'sm';

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        height: compact ? 48 : 64,
        background: 'var(--color-paper)',
        borderBottom: '1px solid var(--color-rule)',
        transition: 'height var(--dur-quick) var(--ease-out)',
      }}
    >
      <div
        className="mx-auto flex h-full items-center"
        style={{ maxWidth: 1200, padding: '0 24px', gap: 16 }}
      >
        {/* left */}
        <div className="flex items-center" style={{ gap: 12, flexShrink: 0 }}>
          <button
            onClick={onHome}
            className="font-display"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '1.25rem',
              fontWeight: 700,
              fontVariationSettings: '"wdth" 125',
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              lineHeight: 1,
            }}
          >
            Plumbline
          </button>
          {!small && (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: 1,
                  height: 18,
                  background: 'var(--color-rule)',
                  opacity: compact ? 0 : 1,
                  transition: 'opacity var(--dur-quick) var(--ease-out)',
                }}
              />
              <span
                className="font-data whitespace-nowrap"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-graphite)',
                  opacity: compact ? 0 : 1,
                  transition: 'opacity var(--dur-quick) var(--ease-out)',
                }}
              >
                conviction, measured
              </span>
            </>
          )}
        </div>

        {/* centre — the ticker chip, present only when a stock is loaded */}
        <div className="flex flex-1 justify-center" style={{ minWidth: 0 }}>
          {quote && <TickerChip quote={quote} />}
        </div>

        {/* right */}
        <div className="flex items-center" style={{ gap: 20, flexShrink: 0 }}>
          {!small && (
            <button
              onClick={onMethodology}
              className="font-body"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '0.9375rem',
                color: 'var(--color-ink)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                textDecorationColor: 'var(--color-rule)',
              }}
            >
              How this works
            </button>
          )}
          {quote && (
            <button
              onClick={onAsk}
              className="font-data"
              style={{
                background: 'none',
                border: '1px solid var(--color-rule)',
                borderRadius: 3,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-ink)',
              }}
            >
              Ask
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function TickerChip({ quote }) {
  const up = Number.isFinite(quote.dayChange) ? quote.dayChange >= 0 : null;
  return (
    <div
      className="font-data flex items-baseline whitespace-nowrap"
      style={{
        border: '1px solid var(--color-rule)',
        borderRadius: 3,
        padding: '4px 10px',
        gap: 10,
        fontSize: '0.8125rem',
        overflow: 'hidden',
      }}
    >
      <span style={{ color: 'var(--color-graphite)' }}>
        {quote.exchange} ▸ <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{quote.ticker}</span>
      </span>
      <span style={{ color: 'var(--color-ink)' }}>{rupees2(quote.price)}</span>
      <span
        style={{
          color:
            up === null
              ? 'var(--color-graphite)'
              : up
                ? 'var(--color-verdigris)'
                : 'var(--color-madder)',
        }}
      >
        {pctSigned(quote.dayChange)}
      </span>
    </div>
  );
}

export function Footer({ market }) {
  return (
    <footer
      style={{
        background: 'var(--color-paper-deep)',
        borderTop: '1px solid var(--color-rule)',
        padding: 48,
        marginTop: 96,
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div
          className="font-data grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 32,
            fontSize: '0.75rem',
            color: 'var(--color-graphite)',
            lineHeight: 1.7,
          }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Sources</p>
            <p>Yahoo Finance</p>
            <p>TradingView</p>
            <p>NSE India</p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Method</p>
            <p>Monte Carlo, GBM</p>
            <p>10,000 paths</p>
            <p>Backtested on 20 NSE equities</p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Legal</p>
            <p style={{ maxWidth: '26ch' }}>
              Not investment advice. Plumbline is an educational tool. It does not
              recommend trades.
            </p>
          </div>
        </div>

        {/* The timestamp is whatever the server actually served —
            never a constant baked into the build. */}
        <p
          className="font-data"
          style={{
            textAlign: 'center',
            marginTop: 40,
            fontSize: '0.75rem',
            color: 'var(--color-graphite)',
          }}
        >
          {market?.asOfLabel ?? 'Enter a stock to load market data'}
          {market?.meta?.source ? ` · source: ${market.meta.source}` : ''}
        </p>
      </div>
    </footer>
  );
}
