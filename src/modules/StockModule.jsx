/* MODULE 3 · THE STOCK ITSELF
   ────────────────────────────────────────────────────────────────
   Two-column split, 8/4. The chart on the left, the fundamentals on
   the right as a definition list — not cards, not tiles. A tile
   grid would give six numbers equal visual weight and no
   relationships; a definition list puts each number directly above
   the sector median it should be read against. */

import { useEffect, useRef, useState } from 'react';
import CandleChart from './CandleChart.jsx';
import { marketCap, rupees, pct } from '../lib/format.js';

export default function StockModule({ quote, animate = true }) {
  return (
    <section aria-labelledby="stock-eyebrow">
      <p className="eyebrow" id="stock-eyebrow">What this stock has actually done</p>

      <div className="pl-split-8-4" style={{ marginTop: 24 }}>
        <div style={{ minWidth: 0 }}>
          <CandleChart quote={quote} animate={animate} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Fundamentals quote={quote} />
        </div>
      </div>

      <TradingViewFrame quote={quote} />
    </section>
  );
}

/* ── the fundamentals panel ─────────────────────────────────── */

function Fundamentals({ quote }) {
  const med = quote.sectorMedians;

  const rows = [
    {
      label: 'Market cap',
      value: fmt(quote.marketCapCr, (v) => marketCap(v)),
    },
    {
      label: 'P/E',
      value: fmt(quote.pe, (v) => v.toFixed(1)),
      median: fmt(med.pe, (v) => v.toFixed(1), null),
      worse: compare(quote.pe, med.pe, true),
      word: describe(quote.pe, med.pe, 'higher', 'lower'),
    },
    {
      label: 'Price / book',
      value: fmt(quote.pb, (v) => v.toFixed(2)),
      median: fmt(med.pb, (v) => v.toFixed(2), null),
      worse: compare(quote.pb, med.pb, true),
      word: describe(quote.pb, med.pb, 'higher', 'lower'),
    },
    {
      label: 'Debt / equity',
      value: fmt(quote.de, (v) => v.toFixed(2)),
      median: fmt(med.de, (v) => v.toFixed(2), null),
      worse: compare(quote.de, med.de, true),
      word: describe(quote.de, med.de, 'higher', 'lower'),
    },
    {
      label: 'ROE',
      value: fmt(quote.roe, (v) => `${v.toFixed(2)}%`),
      median: fmt(med.roe, (v) => `${v.toFixed(1)}%`, null),
      worse: compare(quote.roe, med.roe, false),
      word: describe(quote.roe, med.roe, 'lower', 'higher'),
    },
    {
      label: 'Book value',
      value: fmt(quote.bookValue, (v) => rupees(v)),
    },
    {
      label: 'Dividend yield',
      value: fmt(quote.dividendYield, (v) => `${v.toFixed(2)}%`),
    },
  ];

  return (
    <dl style={{ margin: 0 }}>
      {rows.map((r, i) => {
        const missing = r.value === NA;
        const tone = missing
          ? 'var(--color-graphite)'
          : r.worse === undefined
            ? 'var(--color-ink)'
            : r.worse
              ? 'var(--color-madder)'
              : 'var(--color-verdigris)';
        return (
          <div
            key={r.label}
            style={{
              borderTop: i === 0 ? 'none' : '1px solid var(--color-rule)',
              padding: '14px 0',
            }}
          >
            <dt className="eyebrow">{r.label}</dt>
            <dd className="font-data" style={{ margin: 0, marginTop: 6 }}>
              <span
                style={{
                  fontSize: missing ? '0.9375rem' : 'var(--text-lead)',
                  color: tone,
                  fontStyle: missing ? 'italic' : 'normal',
                }}
              >
                {r.value}
              </span>
            </dd>
            {r.median && (
              /* Part 11: colour is never the only signal — the
                 comparison is spelled out in words as well. */
              <p
                className="font-data"
                style={{ fontSize: '0.75rem', color: 'var(--color-graphite)', marginTop: 4 }}
              >
                sector {r.median}
                {r.word ? ` · ${r.word}` : ''}
              </p>
            )}
          </div>
        );
      })}
    </dl>
  );
}

/* Part 0.1: a field the source did not report is NOT a zero and NOT
   an estimate. It renders as "not available" and is excluded from
   every comparison. Reliance genuinely has no returnOnEquity on
   Yahoo, and HDFC Bank has no debtToEquity — the panel has to say so
   rather than print a plausible-looking number. */
const NA = 'not available';

function fmt(v, render, fallback = NA) {
  return v === null || v === undefined || !Number.isFinite(v) ? fallback : render(v);
}

/** true = worse than the median, false = better, undefined = can't say. */
function compare(value, median, lowerIsBetter) {
  if (!Number.isFinite(value) || !Number.isFinite(median) || median === 0) return undefined;
  const ratio = value / median;
  if (ratio > 0.95 && ratio < 1.05) return undefined; // level is not adverse
  return lowerIsBetter ? ratio > 1 : ratio < 1;
}

function describe(value, median, up, down) {
  if (!Number.isFinite(value) || !Number.isFinite(median) || median <= 0 || value <= 0) return '';
  const ratio = value / median;
  if (ratio >= 1) {
    if (ratio < 1.05) return 'about level';
    return `${ratio.toFixed(1)}× ${up}`;
  }
  const x = 1 / ratio;
  if (x < 1.05) return 'about level';
  return `${x.toFixed(1)}× ${down}`;
}

/* ── the TradingView embed ──────────────────────────────────────
   Quarantined inside its own 1px frame so its native styling has
   nowhere to leak. It is the one thing on the page we do not draw
   ourselves, and it is labelled as such. */

function TradingViewFrame({ quote }) {
  const host = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = '';
    setStatus('loading');

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    container.appendChild(inner);
    el.appendChild(container);

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      /* Part 9: the backend owns this string, including the override
         table for symbols where NSE and TradingView disagree. Passing
         a Yahoo ticker (RELIANCE.NS) renders an empty chart with no
         error, so it is never reconstructed here. */
      symbol: quote.tradingViewSymbol,
      interval: 'D',
      timezone: 'Asia/Kolkata',
      theme: 'light',
      style: '1',
      locale: 'in',
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: '#FBF6F3',
      support_host: 'https://www.tradingview.com',
    });
    script.onload = () => setStatus('ok');
    script.onerror = () => setStatus('failed');
    container.appendChild(script);

    // The widget renders into an iframe; if nothing has appeared by
    // then, treat it as unreachable and say so plainly.
    const t = window.setTimeout(() => {
      if (!el.querySelector('iframe')) setStatus('failed');
      else setStatus('ok');
    }, 6000);

    return () => {
      window.clearTimeout(t);
      el.innerHTML = '';
    };
  }, [quote.tradingViewSymbol]);

  return (
    <div style={{ marginTop: 32 }}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>
        Live chart · TradingView · {quote.tradingViewExchange ?? 'BSE'}
      </p>
      {/* The chart is a different exchange from everything above it.
          Saying so is the whole difference between a caption and a
          claim. */}
      {quote.tradingViewNote && (
        <p
          className="font-body"
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-graphite)',
            marginBottom: 12,
            maxWidth: '68ch',
            lineHeight: 1.55,
          }}
        >
          {quote.tradingViewNote}
        </p>
      )}
      <div
        style={{
          border: '1px solid var(--color-rule)',
          background: 'var(--color-card)',
          height: 420,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div ref={host} style={{ position: 'absolute', inset: 0 }} />
        {status === 'failed' && (
          <div
            className="flex items-center justify-center"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <p
              className="font-data"
              style={{ fontSize: '0.75rem', color: 'var(--color-graphite)', textAlign: 'center' }}
            >
              TradingView didn’t load. The candlestick chart above is drawn from our own
              data and is unaffected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
