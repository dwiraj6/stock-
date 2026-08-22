/* SCREEN 1 · ENTRY
   ────────────────────────────────────────────────────────────────
   State the thesis, take three inputs. Nothing else. No feature
   grid, no testimonials, no logo wall.

   ENTRY MOTION SEQUENCE
     0ms      page fades in, 200ms
     100ms    plumb bob line draws downward, 400ms
     500ms    bob begins damped swing, 1400ms, settles vertical
     600ms    headline line 1 fades up 12px, 300ms
     760ms    headline line 2 fades up 12px, 300ms
     950ms    input card fades up 8px, 300ms
     1150ms   button and suggestions fade in, 200ms
     then     complete stillness                                  */

import { useEffect, useState } from 'react';
import { PlumbBob } from '../components/marks/Marks.jsx';
import { TickerInput, AmountInput, ConvictionSlider, Button } from '../components/Inputs.jsx';
import { searchSymbols as apiSearch } from '../lib/client.js';
import { useReducedMotion } from '../lib/hooks.js';

export default function Entry({ onRun, initial, me }) {
  const reduced = useReducedMotion();
  const animate = !reduced;

  const [symbol, setSymbol] = useState(initial?.symbol ?? null);
  const [typed, setTyped] = useState('');
  const [amount, setAmount] = useState(initial?.amount ?? null);
  const [conviction, setConviction] = useState(initial?.conviction ?? 72);
  const [notListed, setNotListed] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  /* "Three stocks people checked today" is real: /api/search with no
     query returns nothing, so this asks the server for the three most
     recently scored symbols. If the sessions collection is empty the
     strip simply does not render — it is never filled with invented
     activity. */
  const [checkedToday, setCheckedToday] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/recent')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok && Array.isArray(d.symbols)) setCheckedToday(d.symbols);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const valid = Boolean(symbol) && Number.isFinite(amount) && amount > 0;

  const submit = () => {
    if (!valid) return;
    onRun({ symbol, amount, conviction });
  };

  const tryUnlisted = async (q) => {
    // The server owns the universe, so it owns the not-found answer
    // and the suggestions that go with it.
    const res = await apiSearch(q, 3);
    const hits = res?.ok ? res.results ?? [] : [];
    // `fuzzy` means these are near-misses, not matches — never
    // auto-select one on the user's behalf.
    if (!res?.fuzzy && hits.length === 1 && hits[0].symbol.toUpperCase() === q.toUpperCase()) {
      setSymbol(hits[0]);
      return;
    }
    setSuggestions(hits);
    setNotListed(q.toUpperCase());
    setSymbol(null);
  };

  const anim = (delay, dur = 300, rise = 12, ease = 'var(--ease-out)') =>
    animate
      ? { animation: `pl-fade-up ${dur}ms ${ease} ${delay}ms both`, '--pl-rise': `${rise}px` }
      : undefined;

  return (
    <main
      style={{
        animation: animate ? 'pl-fade-in 200ms linear 0ms both' : 'none',
      }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: 1200, padding: '0 24px' }}
      >
        {/* ── the plumb line ──
            The product in one object: the thing that shows you what
            is actually true, after the wobble stops. */}
        <div className="flex justify-center" style={{ paddingTop: 8 }}>
          <PlumbBob height={180} animate={animate} />
        </div>

        <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 48 }}>
          <h1 className="font-display" style={{ fontSize: 'var(--text-title)', lineHeight: 1.08 }}>
            <span style={{ display: 'block', ...anim(600) }}>
              You think you know what this stock will do.
            </span>
            <span
              style={{
                display: 'block',
                marginTop: '0.35em',
                color: 'var(--color-graphite)',
                ...anim(760),
              }}
            >
              Let’s measure how much of that is the numbers, and how much is you.
            </span>
          </h1>

          {/* ── the input card ── */}
          <div
            style={{
              marginTop: 56,
              background: 'var(--color-card)',
              border: '1px solid var(--color-rule)',
              padding: 32,
              ...anim(950, 300, 8),
            }}
          >
            <TickerInput
              value={typed}
              selected={symbol}
              onChange={(v) => {
                setTyped(v);
                setNotListed(null);
                if (!v) setSymbol(null);
              }}
              onSelect={(s) => {
                setSymbol(s);
                setNotListed(null);
              }}
              onInvalid={tryUnlisted}
            />

            <Divider />

            <AmountInput value={amount} onChange={setAmount} />

            <Divider />

            <ConvictionSlider value={conviction} onChange={setConviction} />
          </div>

          {/* ── NOT LISTED (Part 8) ──
              The state that saves the demo. Never let a bad ticker
              throw. */}
          {notListed && (
            <NotListed
              query={notListed}
              suggestions={suggestions}
              onPick={(s) => {
                setSymbol(s);
                setTyped(s.name);
                setNotListed(null);
              }}
            />
          )}

          <div className="flex justify-center" style={{ marginTop: 40, ...anim(1150, 200, 0) }}>
            <Button disabled={!valid} onClick={submit}>
              Run the simulation
            </Button>
          </div>

          {/* Said before the click, not after it. Being bounced to a
              sign-in page by a button that gave no warning is the
              part people resent; a line of small print costs nothing
              and removes the surprise entirely. */}
          {me === false && valid && (
            <p
              className="font-body"
              style={{
                marginTop: 14,
                textAlign: 'center',
                fontSize: '0.8125rem',
                color: 'var(--color-graphite)',
              }}
            >
              You will be asked to sign in first — your stock, amount and conviction are kept.
            </p>
          )}

          {checkedToday.length > 0 && (
          <div style={{ marginTop: 48, ...anim(1150, 200, 0) }}>
            <p className="font-body" style={{ fontSize: '0.9375rem', color: 'var(--color-graphite)' }}>
              {checkedToday.length === 1 ? 'One stock checked today:' : `${checkedToday.length === 2 ? 'Two' : 'Three'} stocks people checked today:`}
            </p>
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
              {checkedToday.map((t, i) => {
                return (
                  <span key={t} className="flex items-center" style={{ gap: 8 }}>
                    {i > 0 && (
                      <span aria-hidden="true" style={{ color: 'var(--color-rule)' }}>·</span>
                    )}
                    <button
                      onClick={async () => {
                        const res = await apiSearch(t, 1);
                        const hit = res?.ok ? res.results?.[0] : null;
                        if (hit) {
                          setSymbol(hit);
                          setTyped(hit.name);
                          setNotListed(null);
                        }
                      }}
                      className="font-data"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        color: 'var(--color-ink)',
                        textDecoration: 'underline',
                        textUnderlineOffset: 3,
                        textDecorationColor: 'var(--color-rule)',
                      }}
                    >
                      {t}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Divider() {
  return (
    <div
      aria-hidden="true"
      style={{ height: 1, background: 'var(--color-rule)', margin: '24px -32px' }}
    />
  );
}

export function NotListed({ query, suggestions = [], onPick }) {
  return (
    <div
      role="status"
      style={{
        marginTop: 20,
        border: '1px solid var(--color-rule)',
        borderLeft: '1px solid var(--color-rule)',
        background: 'var(--color-card)',
        padding: 20,
      }}
    >
      <p className="font-body" style={{ fontSize: '1rem' }}>
        <span className="font-data">{query}</span> isn’t listed on NSE or BSE.
      </p>
      {suggestions.length > 0 && (
      <div className="flex flex-wrap" style={{ gap: 8, marginTop: 14 }}>
        {suggestions.map((s) => (
          <button
            key={s.symbol}
            onClick={() => onPick(s)}
            className="font-data"
            style={{
              border: '1px solid var(--color-rule)',
              borderRadius: 3,
              background: 'transparent',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: 'var(--color-ink)',
            }}
          >
            {s.symbol}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
