/* SCREEN 4 · METHODOLOGY
   ────────────────────────────────────────────────────────────────
   Long-form editorial. Serif body at 68ch, section heads in the
   display face, formulas inline in mono.

   Each section fades up once on first entry into the viewport and
   never again. This is the only place in the product where anything
   animates on scroll. */

import { useEffect, useMemo, useState } from 'react';
import { useRevealOnce } from '../lib/hooks.js';
import { getCalibration } from '../lib/client.js';
import { mulberry32 as makeRng, makeNormal, hashSeed } from '../lib/viz.js';

export default function Methodology({ onBack }) {
  /* The backtest paragraph quotes the committed calibration file. It
     was previously written out by hand — and the hand-written numbers
     disagreed with what the real point-in-time run produced. Anything
     stated here now comes from /api/calibration or is not stated. */
  const [cal, setCal] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getCalibration().then((r) => {
      if (!cancelled && r?.ok) setCal(r.calibration);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <main className="pl-page" style={{ paddingBottom: 0 }}>
      <button
        onClick={onBack}
        className="font-data"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: '0.75rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-graphite)',
        }}
      >
        ← Back
      </button>

      <h1
        className="font-display"
        style={{ fontSize: 'var(--text-title)', marginTop: 32, maxWidth: '18ch' }}
      >
        How this works
      </h1>

      <p
        className="font-body prose-measure"
        style={{ fontSize: 'var(--text-lead)', marginTop: 24, color: 'var(--color-graphite)' }}
      >
        Plumbline makes one measurement and shows its working. This page is the working.
      </p>

      <div style={{ display: 'grid', gap: 96, marginTop: 96, paddingBottom: 96 }}>
        <Section title="What a Monte Carlo actually is">
          <p>
            A Monte Carlo simulation answers a question you cannot answer with algebra by
            running the situation many times and looking at what came out. There is no
            forecast anywhere in it. There is only a rule for how a price moves in one day,
            applied over and over, with a fresh roll of the dice each time.
          </p>
          <p>
            The rule we use is called geometric Brownian motion. In one line, tomorrow’s
            price is today’s price multiplied by an exponential of two terms — a steady
            drift and a random shock:
          </p>
          <Formula>
            S(t+1) = S(t) · exp( (μ − σ²/2)·Δt + σ·√Δt·Z )
          </Formula>
          <p>
            <Mono>μ</Mono> is the drift, <Mono>σ</Mono> is the volatility, <Mono>Δt</Mono> is
            one trading day expressed as <Mono>1/252</Mono> of a year, and <Mono>Z</Mono> is a
            fresh draw from a standard normal distribution. That last term is the whole
            reason we run it ten thousand times: change <Mono>Z</Mono> and you get a
            different future out of the same stock.
          </p>
        </Section>

        <Section title="Where drift and volatility come from">
          <p>
            Both are estimated from the price history and nothing else. We take the daily
            log returns of the last three years, and:
          </p>
          <Formula>
            σ = stdev(log returns) · √252{'\n'}
            μ = mean(log returns) · 252 + σ²/2
          </Formula>
          <p>
            This is the part of the model most worth being suspicious of. It assumes the
            next twelve months are drawn from the same distribution as the last thirty-six.
            When a company changes — a merger, a new regulator, a business that stops
            working — that assumption is simply false, and the simulation will be confidently
            wrong. It has no mechanism for noticing.
          </p>
        </Section>

        <Section title="Why we show ten thousand paths and not one line">
          <p>
            A single projected line is the most dishonest chart in finance. It has exactly one
            future in it, drawn with the same confident stroke you would use for recorded
            history, and it invites you to read a guess as a fact.
          </p>
          <p>
            The fan is the same model, drawn honestly. Read left to right, it opens: near-term
            outcomes cluster, distant ones scatter. Where the ink is dark, many futures
            landed. Where it is pale, few did.
          </p>
          <FanDiagram />
          <p>
            One path is noise. Ten start to suggest a shape. A hundred show where the mass
            is. The full bundle is the distribution itself — and the honest answer to “what
            will this stock do” is that entire shape, not any single line inside it.
          </p>
        </Section>

        <Section title="What the model cannot see">
          <p>
            It reads two things: price history and reported fundamentals. That means it does
            not see news, guidance, earnings calls, regulatory decisions, management changes,
            order books, or anything a person told you on Telegram. It cannot see a product
            launch or a fraud.
          </p>
          <p>
            This is not a gap we intend to close. A model that reads price history is a model
            whose failure mode you can describe in a sentence, and we would rather show you
            that sentence than hide it behind more inputs. All three of our backtest misses
            were earnings surprises. They would be misses again tomorrow.
          </p>
        </Section>

        <Section title="How we backtested">
          <p>
            We took a set of liquid NSE equities, cut every series at a date twelve months
            back, and estimated drift and volatility from the two years before that cut and
            nothing after it. Each run produced an 80% band for the following twelve months.
            Then we compared the band to what the stock actually did.
          </p>
          {cal ? (
            <>
              <p>
                Cut-off <Mono>{cal.cutoffDate}</Mono>. <Mono>{cal.hits}</Mono> of{' '}
                <Mono>{cal.universe}</Mono> landed inside the band, against an expectation of
                about <Mono>{cal.expectedHits}</Mono> for a well-calibrated 80% band.
              </p>
              <p>{cal.missNarrative}</p>
              <p>{cal.interpretation}</p>
            </>
          ) : (
            <p>
              The backtest figures load from the committed calibration file. If they are not
              showing, the file has not been generated for this deployment and no accuracy
              claim is being made.
            </p>
          )}
        </Section>

        <Section title="Our sources">
          <p>
            Price history and fundamentals from Yahoo Finance, the NSE equity master
            (<Mono>EQUITY_L.csv</Mono>) for listings, Google News India for coverage, and
            TradingView for the live chart. Sector medians are computed from the NIFTY 500
            constituents. Every response carries the source that served it and the age of the
            data, and every screen that shows cached data says so.
          </p>
          <p>
            Quotes for NSE and BSE from free sources run roughly fifteen minutes behind during
            market hours, and the app labels that delay rather than claiming to be live. When
            the market is shut it shows the last close and says which close it was.
          </p>
          <p>
            Plumbline is an educational tool. It is not registered investment advice and it
            does not recommend trades.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  const [ref, shown] = useRevealOnce();
  return (
    <section
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 300ms var(--ease-out), transform 300ms var(--ease-out)',
      }}
    >
      <h2 className="font-display" style={{ fontSize: 'var(--text-head)', maxWidth: '22ch' }}>
        {title}
      </h2>
      <div
        className="font-body prose-measure"
        style={{ marginTop: 20, display: 'grid', gap: 20, fontSize: '1.0625rem', lineHeight: 1.7 }}
      >
        {children}
      </div>
    </section>
  );
}

function Mono({ children }) {
  return <span className="font-data">{children}</span>;
}

function Formula({ children }) {
  return (
    <pre
      className="font-data"
      style={{
        background: 'var(--color-paper-deep)',
        padding: '18px 20px',
        margin: 0,
        fontSize: '0.875rem',
        lineHeight: 1.7,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
      }}
    >
      {children}
    </pre>
  );
}

/* ── the teaching diagram ──
   One path, then ten, then a hundred, then the full fan. Four
   panels reading left to right, all drawn from the same generator
   with the same seed — so panel four literally contains panels one
   through three. */
function FanDiagram() {
  const PANELS = [1, 10, 100, 400];
  const W = 150;
  const H = 108;
  const STEPS = 64;

  const paths = useMemo(() => {
    const rng = makeRng(hashSeed('methodology|fan|v1'));
    const normal = makeNormal(rng);
    const sigma = 0.26;
    const mu = 0.08;
    const dt = 1 / STEPS;
    const out = [];
    for (let p = 0; p < 400; p++) {
      const row = new Float64Array(STEPS + 1);
      let v = 1;
      row[0] = 1;
      for (let i = 1; i <= STEPS; i++) {
        v *= Math.exp((mu - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * normal());
        row[i] = v;
      }
      out.push(row);
    }
    return out;
  }, []);

  const bounds = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of paths) {
      for (let i = 0; i <= STEPS; i++) {
        if (r[i] < lo) lo = r[i];
        if (r[i] > hi) hi = r[i];
      }
    }
    return [lo, hi];
  }, [paths]);

  const d = (row) => {
    let s = '';
    for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * W;
      const y = 6 + (1 - (row[i] - bounds[0]) / (bounds[1] - bounds[0])) * (H - 12);
      s += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return s;
  };

  return (
    <figure style={{ margin: '12px 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {PANELS.map((n) => (
          <div key={n}>
            <div style={{ border: '1px solid var(--color-rule)', background: 'var(--color-card)' }}>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
                {paths.slice(0, n).map((row, i) => (
                  <path
                    key={i}
                    d={d(row)}
                    fill="none"
                    stroke="var(--color-madder)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    opacity={n === 1 ? 1 : n === 10 ? 0.5 : n === 100 ? 0.12 : 0.04}
                  />
                ))}
              </svg>
            </div>
            <figcaption
              className="font-data"
              style={{ fontSize: '0.75rem', color: 'var(--color-graphite)', marginTop: 6 }}
            >
              {n === 1 ? '1 path' : `${n} paths`}
            </figcaption>
          </div>
        ))}
      </div>
    </figure>
  );
}
