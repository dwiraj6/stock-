import { useEffect, useId, useRef, useState } from 'react';
import Rail from './Rail.jsx';
import { TriangleDown } from './marks/Marks.jsx';
import { searchSymbols as apiSearch } from '../lib/client.js';
import { group, parseAmount } from '../lib/format.js';

/* ── BUTTON ────────────────────────────────────────────────────
   --ink fill, --paper text, 3px radius. Disabled at 40% opacity,
   never hidden — a control you cannot use should still tell you
   it exists and what it would do. */
export function Button({ children, disabled, onClick, type = 'button', className = '', ...rest }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`font-display pl-button ${className}`}
      style={{
        background: 'var(--color-ink)',
        color: 'var(--color-paper)',
        fontWeight: 700,
        fontVariationSettings: '"wdth" 125',
        letterSpacing: '-0.02em',
        fontSize: '1rem',
        padding: '16px 32px',
        borderRadius: 3,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background var(--dur-instant) var(--ease-out), transform var(--dur-instant) var(--ease-out)',
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── TICKER INPUT ──────────────────────────────────────────────
   Autocomplete from the local symbol table. ↑↓ to move, Enter to
   select, Esc closes. */
export function TickerInput({ value, onChange, onSelect, selected, onInvalid }) {
  const id = useId();
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  /* Debounced server search. The index lives on the server (2,291
     real NSE equities), so this is a network call — 120ms of debounce
     keeps a fast typist from firing one request per keystroke. */
  const [results, setResults] = useState([]);
  useEffect(() => {
    /* Clear synchronously on every keystroke, before the debounce.
       Otherwise the previous query's results stay on screen for
       120ms — long enough for a fast typist to replace "HDFC" with
       "SODEXO", press Enter, and select HDFC Asset Management. The
       list must never contain results for text that is no longer in
       the box. */
    setResults([]);
    if (!open || !query.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await apiSearch(query, 6);
      // Fuzzy results are "did you mean" candidates; they belong in
      // the NOT LISTED panel, not in the autocomplete list.
      if (!cancelled && res?.ok) setResults(res.fuzzy ? [] : res.results ?? []);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    const onDocDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const choose = (s) => {
    setQuery(s.name);
    setOpen(false);
    onSelect?.(s);
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        // Enter with no dropdown: ask the server to resolve it, and
        // let the caller raise NOT LISTED if it cannot.
        apiSearch(query, 1).then((res) => {
          const hit = res?.ok && !res.fuzzy ? res.results?.[0] : null;
          if (hit) choose(hit);
          else onInvalid?.(query.trim());
        });
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active] || results[0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={id} className="eyebrow block" style={{ marginBottom: 10 }}>
        Stock
      </label>
      <div className="flex items-center" style={{ gap: 12 }}>
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck="false"
          placeholder="Reliance Industries"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            onChange?.(e.target.value);
          }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={onKeyDown}
          className="font-body flex-1"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 'var(--text-lead)',
            color: 'var(--color-ink)',
            padding: '2px 0',
            minWidth: 0,
          }}
        />
        {selected && (
          <span
            className="font-data whitespace-nowrap"
            style={{ fontSize: '0.75rem', color: 'var(--color-graphite)' }}
          >
            {selected.exchange} ▸ <span style={{ color: 'var(--color-ink)' }}>{selected.symbol}</span>
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 z-20"
          style={{
            top: 'calc(100% + 8px)',
            background: 'var(--color-card)',
            border: '1px solid var(--color-rule)',
            borderRadius: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {results.map((s, i) => (
            <li
              key={s.symbol}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              className="flex items-baseline justify-between"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                background: i === active ? 'var(--color-paper-deep)' : 'transparent',
                borderTop: i === 0 ? 'none' : '1px solid var(--color-rule)',
              }}
            >
              <span className="font-body" style={{ fontSize: '0.9375rem' }}>
                <Highlight text={s.name} query={query} />
              </span>
              <span
                className="font-data"
                style={{ fontSize: '0.75rem', color: 'var(--color-graphite)', marginLeft: 16 }}
              >
                <Highlight text={s.symbol} query={query} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Matched substring in --ink 500; the rest --graphite. The match is
    found here rather than sent by the server — it is a rendering
    concern, not data. */
function Highlight({ text, query }) {
  const q = String(query || '').trim();
  if (!q) return <>{text}</>;
  const at = text.toUpperCase().indexOf(q.toUpperCase());
  if (at < 0) return <>{text}</>;
  const a = text.slice(0, at);
  const b = text.slice(at, at + q.length);
  const c = text.slice(at + q.length);
  return (
    <>
      <span style={{ color: 'var(--color-graphite)' }}>{a}</span>
      <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{b}</span>
      <span style={{ color: 'var(--color-graphite)' }}>{c}</span>
    </>
  );
}

/* ── AMOUNT INPUT ──────────────────────────────────────────────
   Indian grouping applied as you type. The ₹ is a static prefix,
   not part of the editable value. */
export function AmountInput({ value, onChange }) {
  const id = useId();
  const [text, setText] = useState(value ? group(value) : '');

  const handle = (e) => {
    const raw = parseAmount(e.target.value);
    if (raw === null) {
      setText('');
      onChange?.(null);
      return;
    }
    const capped = Math.min(raw, 999999999);
    setText(group(capped));
    onChange?.(capped);
  };

  return (
    <div>
      <label htmlFor={id} className="eyebrow block" style={{ marginBottom: 10 }}>
        Amount
      </label>
      <div className="flex items-baseline" style={{ gap: 8 }}>
        <span
          className="font-data"
          aria-hidden="true"
          style={{ fontSize: 'var(--text-lead)', color: 'var(--color-graphite)' }}
        >
          ₹
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="50,000"
          value={text}
          onChange={handle}
          className="font-data flex-1"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 'var(--text-lead)',
            color: 'var(--color-ink)',
            fontVariantNumeric: 'tabular-nums',
            padding: '2px 0',
            minWidth: 0,
          }}
        />
      </div>
    </div>
  );
}

/* ── CONVICTION SLIDER ─────────────────────────────────────────
   A rail in the instrument language. The thumb is a solid --ink
   downward triangle, not a circle — a circle is a handle you drag,
   a triangle is a value you read off a scale.

   Arrow keys ±1, shift+arrow ±10, Home/End to the extremes. */
export function ConvictionSlider({ value, onChange }) {
  const id = useId();
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const set = (v) => onChange?.(Math.max(0, Math.min(100, Math.round(v))));

  const fromClientX = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * 100;
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      set(fromClientX(x));
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      set(value + step);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      set(value - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      set(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      set(100);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      set(value + 10);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      set(value - 10);
    }
  };

  return (
    <div>
      {/* "How confident are you?" is not falsifiable — 72 of what?
          This asks for a probability of a specific event, which can
          be scored against reality later. */}
      <span id={`${id}-label`} className="eyebrow block" style={{ marginBottom: 4 }}>
        What are the odds you make money on this?
      </span>
      <span
        className="font-body block"
        style={{ fontSize: '0.875rem', color: 'var(--color-graphite)', marginBottom: 16 }}
      >
        Out of 100 times, how many would you end up ahead a year from now?
      </span>

      <div className="flex items-start" style={{ gap: 24 }}>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-labelledby={`${id}-label`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
            aria-valuetext={`${value} out of 100`}
            onKeyDown={onKeyDown}
            onMouseDown={(e) => {
              setDragging(true);
              set(fromClientX(e.clientX));
            }}
            onTouchStart={(e) => {
              setDragging(true);
              set(fromClientX(e.touches[0].clientX));
            }}
            className="relative"
            style={{ paddingTop: 18, paddingBottom: 24, cursor: 'pointer', touchAction: 'none' }}
          >
            <Rail min={0} max={100} tickEvery={10} numerals tickLength={5} style={{ height: 1 }} />
            {/* the thumb */}
            <div
              className="absolute"
              style={{
                left: `${value}%`,
                top: 18 - 12,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }}
            >
              <TriangleDown size={13} color="var(--color-ink)" solid />
            </div>
          </div>

          <div className="flex justify-between" style={{ marginTop: 4 }}>
            <span
              className="font-body"
              style={{ fontStyle: 'italic', fontSize: '0.875rem', color: 'var(--color-graphite)' }}
            >
              certain to lose
            </span>
            <span
              className="font-body"
              style={{ fontStyle: 'italic', fontSize: '0.875rem', color: 'var(--color-graphite)' }}
            >
              certain to gain
            </span>
          </div>
        </div>

        {/* live value — tabular, so it does not shift as it changes */}
        <div
          className="font-data"
          aria-hidden="true"
          style={{
            fontSize: 'var(--text-head)',
            lineHeight: 1,
            paddingTop: 8,
            minWidth: '3ch',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}%
        </div>
      </div>
    </div>
  );
}
