/* PART 7 · THE CONVERSATION PANEL
   ────────────────────────────────────────────────────────────────
   Not a floating circular bubble. A right-docked panel that
   overlays the page without shifting it.

   Messages are not chat bubbles. They are ruled entries, the way a
   margin annotation sits against the text it is about: the user's
   turns right-aligned in mono, the app's turns left-aligned in the
   serif with a rule above each.

   Citations carry a dotted underline; hovering one highlights the
   row it refers to in Module 4 on the page behind. Small and cheap,
   and it makes the panel feel wired into the product. */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Chevron } from './marks/Marks.jsx';
import { useFocusTrap, useBreakpoint, useReducedMotion } from '../lib/hooks.js';
import { setHighlight } from '../lib/highlight.js';
import { chat as apiChat } from '../lib/client.js';

/* Starters are questions about THIS stock's own numbers, so the
   model can always answer them from the grounded context. */
const STARTERS = (score) => [
  `Why is the score only ${score}?`,
  'What would change your mind?',
  'Explain the debt number',
];

/* Human-readable labels for the keys the model cites. */
const METRIC_LABELS = {
  valuation: 'valuation',
  volatility: 'volatility',
  financial: 'financial health',
  momentum: 'momentum',
  dataQuality: 'data quality',
  trailingPE: 'P/E',
  priceToBook: 'price to book',
  debtToEquity: 'debt to equity',
  returnOnEquity: 'return on equity',
  profitMargins: 'profit margin',
  dividendYield: 'dividend yield',
  bookValue: 'book value',
};

/* Which score row a cited key highlights on the page behind. */
const METRIC_TO_ROW = {
  trailingPE: 'valuation',
  priceToBook: 'valuation',
  debtToEquity: 'financial',
  returnOnEquity: 'financial',
  profitMargins: 'financial',
  bookValue: 'financial',
  dividendYield: 'valuation',
};

const readable = (key) =>
  METRIC_LABELS[key] ??
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();

/**
 * Parse the model's citations.
 *
 * Deliberately permissive. The prompt asks for [[metric:key]], and
 * the model mostly complies — but it has also been observed emitting
 * [[fundamentals:debtToEquity]] and [[debtToEquity:0.37]]. Anything
 * this does not recognise would otherwise render as literal brackets
 * in the middle of a sentence.
 *
 * The earlier version also consumed the word AFTER the marker and
 * rendered only that word, so "the [[metric:debtToEquity]] ratio is
 * 0.37" came out as "the ratio is 0.37" — the metric name silently
 * deleted. The marker is now replaced by its own readable label and
 * nothing around it is touched.
 */
function parseAnswer(src) {
  const out = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: src.slice(last, m.index) });

    const body = m[1].trim();
    let key = body;
    let label = null;

    if (body.includes('|')) {
      // [[key|display text]]
      const [k, ...rest] = body.split('|');
      key = k.trim();
      label = rest.join('|').trim();
    } else if (body.includes(':')) {
      const [a, b] = body.split(':').map((x) => x.trim());
      // [[metric:key]] / [[fundamentals:key]] -> the key is the second
      // half. [[key:0.37]] -> the model put a VALUE there; keep the key
      // and let the number it already wrote stand on its own.
      key = /^[\d.,%-]+$/.test(b) ? a : b;
    }

    out.push({ type: 'cite', key, text: label ?? readable(key) });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ type: 'text', text: src.slice(last) });
  return out;
}

export default function ConversationPanel({ open, onClose, run, seedQuestion, onSeedConsumed, onAnswering, onAnswered }) {
  const bp = useBreakpoint();
  const reduced = useReducedMotion();
  const small = bp === 'sm';
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);
  const trapRef = useFocusTrap(open, onClose);

  const starters = STARTERS(run.model.score);

  const ask = useCallback(
    async (text) => {
      const question = text.trim();
      if (!question || thinking) return;
      setDraft('');
      const priorTurns = turns;
      setTurns((t) => [...t, { role: 'user', text: question }]);
      setThinking(true);
      onAnswering?.(true);

      // The last few turns, so follow-ups keep their thread.
      const history = priorTurns.slice(-6).map((t) => ({
        role: t.role === 'user' ? 'user' : 'model',
        text: t.role === 'user' ? t.text : t.raw ?? '',
      }));

      let started = false;
      const res = await apiChat(
        {
          symbol: run.quote.ticker,
          question,
          conviction: run.conviction,
          amount: run.amount,
          history,
        },
        (_chunk, full) => {
          if (!started) {
            started = true;
            setThinking(false);
            setTurns((t) => [...t, { role: 'app', raw: full }]);
          } else {
            setTurns((t) => {
              const copy = [...t];
              copy[copy.length - 1] = { role: 'app', raw: full };
              return copy;
            });
          }
        }
      );

      setThinking(false);
      onAnswering?.(false);
      onAnswered?.();
      if (!res.ok) {
        // A typed failure renders as an app turn saying what happened
        // and what to do next — never a silent dead end.
        setTurns((t) => [
          ...t,
          { role: 'app', raw: `${res.message} ${res.action}`, failed: true },
        ]);
      }
    },
    [run, thinking, turns, onAnswering, onAnswered]
  );

  /* Opened from the bob's observation: ask its follow-up straight
     away, so the panel arrives already in the middle of the thread
     the user tapped rather than at an empty prompt. Fires once. */
  const seeded = useRef(false);
  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (seeded.current || !seedQuestion || turns.length > 0) return;
    seeded.current = true;
    onSeedConsumed?.();
    ask(seedQuestion);
  }, [open, seedQuestion, turns.length, ask, onSeedConsumed]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, thinking]);

  useEffect(() => {
    if (!open) setHighlight(null);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Ask about ${run.quote.ticker}`}
      className="fixed"
      style={{
        top: small ? 0 : 0,
        right: 0,
        bottom: 0,
        width: small ? '100%' : 420,
        background: 'var(--color-card)',
        borderLeft: small ? 'none' : '1px solid var(--color-rule)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        animation: small
          ? 'pl-sheet-up var(--dur-normal) var(--ease-out) both'
          : 'pl-panel-in var(--dur-normal) var(--ease-out) both',
      }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--color-rule)',
          flexShrink: 0,
        }}
      >
        <h2
          className="font-display"
          style={{ fontSize: '1.25rem', fontWeight: 700, fontVariationSettings: '"wdth" 125' }}
        >
          Ask about {run.quote.ticker}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close panel"
          style={{
            background: 'none',
            border: 'none',
            padding: 6,
            cursor: 'pointer',
            color: 'var(--color-graphite)',
            display: 'flex',
          }}
        >
          <Chevron dir={small ? 'down' : 'right'} size={14} />
        </button>
      </div>

      {/* transcript */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
        {turns.length === 0 && !thinking && (
          <div style={{ paddingTop: 20 }}>
            <p
              className="font-body"
              style={{ fontSize: '1rem', color: 'var(--color-graphite)', marginBottom: 16 }}
            >
              Ask anything the model can answer from its own numbers.
            </p>
            <div className="flex flex-col" style={{ gap: 8, alignItems: 'flex-start' }}>
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="font-data"
                  style={{
                    border: '1px solid var(--color-rule)',
                    borderRadius: 3,
                    background: 'transparent',
                    padding: '7px 12px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: 'var(--color-ink)',
                    textAlign: 'left',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === 'user' ? (
            <p
              key={i}
              className="font-data"
              style={{
                textAlign: 'right',
                fontSize: '0.875rem',
                color: 'var(--color-graphite)',
                margin: '22px 0 0',
                lineHeight: 1.6,
              }}
            >
              {t.text}
            </p>
          ) : (
            <p
              key={i}
              className="font-body"
              style={{
                borderTop: '1px solid var(--color-rule)',
                paddingTop: 14,
                margin: '14px 0 0',
                fontSize: '1rem',
                lineHeight: 1.65,
                color: t.failed ? 'var(--color-madder)' : 'var(--color-ink)',
              }}
            >
              {parseAnswer(t.raw ?? '').map((tok, k) => (
                <Token key={k} tok={tok} />
              ))}
            </p>
          )
        )}

        {thinking && <Typing />}
      </div>

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        style={{
          borderTop: '1px solid var(--color-rule)',
          padding: 16,
          display: 'flex',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <label htmlFor="ask-input" className="sr-only">
          Ask about {run.quote.ticker}
        </label>
        <input
          id="ask-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about the numbers"
          autoComplete="off"
          className="font-body"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--color-paper)',
            border: '1px solid var(--color-rule)',
            borderRadius: 3,
            padding: '10px 12px',
            fontSize: '0.9375rem',
            color: 'var(--color-ink)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || thinking}
          className="font-data"
          style={{
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            border: 'none',
            borderRadius: 3,
            padding: '10px 16px',
            fontSize: '0.75rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: draft.trim() && !thinking ? 'pointer' : 'not-allowed',
            opacity: draft.trim() && !thinking ? 1 : 0.4,
          }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function Token({ tok }) {
  if (tok.type === 'num') {
    return <span className="font-data">{tok.text}</span>;
  }
  if (tok.type === 'cite') {
    return (
      <span
        onMouseEnter={() => setHighlight(METRIC_TO_ROW[tok.key] ?? tok.key)}
        onMouseLeave={() => setHighlight(null)}
        onFocus={() => setHighlight(METRIC_TO_ROW[tok.key] ?? tok.key)}
        onBlur={() => setHighlight(null)}
        tabIndex={0}
        style={{
          borderBottom: '1px dotted var(--color-graphite)',
          cursor: 'help',
        }}
      >
        {tok.text}
      </span>
    );
  }
  return <>{tok.text}</>;
}

/* Three 2px squares, not dots. Stops the instant text arrives. */
function Typing() {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 4,
        marginTop: 20,
        borderTop: '1px solid var(--color-rule)',
        paddingTop: 16,
      }}
      aria-label="Thinking"
      role="status"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 2,
            height: 2,
            background: 'var(--color-graphite)',
            display: 'block',
            animation: `pl-square-pulse 600ms linear ${i * 200}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}
