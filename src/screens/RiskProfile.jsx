/* SCREEN · YOUR SITUATION
   ────────────────────────────────────────────────────────────────
   Four questions, one screen, no scoring.

   Deliberately NOT called "risk profile" in the interface, because
   that phrase carries the expectation of a label at the end — a
   Moderate Investor badge — and there isn't one. What the answers
   do instead is give the app three things it can CHECK against the
   simulation it already runs: a deadline, a loss limit, and a stated
   behaviour.

   The fourth question is the one worth having. "What would you do if
   this fell 20%" is usually filed away as a personality trait. Here
   it is priced: the simulation has already counted how often a 20%
   fall happens, so an answer of "I would sell" becomes a probability
   that you will sell at the bottom. That is a forecast about the
   person, made of the same numbers as everything else on the page.

   All four are answered at once and saved once. A wizard with a
   progress bar would be four times the ceremony for the same four
   answers. */

import { useEffect, useState } from 'react';
import { rupees } from '../lib/format.js';
import { getProfile, saveProfile } from '../lib/client.js';

const GOALS = [
  {
    value: 'safety',
    label: 'Money I might need in an emergency',
    note: 'It has to be there on the day it is needed, whatever the market is doing.',
  },
  {
    value: 'purchase',
    label: 'A specific thing I am saving for',
    note: 'A deposit, a course, a wedding — something with a date attached.',
  },
  {
    value: 'growth',
    label: 'Long-term savings with no fixed date',
    note: 'Money that can sit through a bad year without being needed.',
  },
  {
    value: 'learning',
    label: 'An amount I am willing to learn with',
    note: 'Small enough that losing it teaches rather than hurts.',
  },
];

const HORIZONS = [
  { value: 'under1y', label: 'Within a year' },
  { value: '1to3y', label: 'One to three years' },
  { value: '3to10y', label: 'Three years or more' },
  { value: 'none', label: 'No date in mind' },
];

const ON_DROP = [
  { value: 'sell', label: 'Sell, to stop it getting worse' },
  { value: 'hold', label: 'Hold and wait' },
  { value: 'buy', label: 'Buy more at the lower price' },
  { value: 'unsure', label: 'Honestly, I do not know' },
];

export default function RiskProfile({ onBack, onSaved }) {
  const [goal, setGoal] = useState(null);
  const [horizon, setHorizon] = useState(null);
  const [onDrop, setOnDrop] = useState(null);
  const [maxLoss, setMaxLoss] = useState('');
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getProfile().then((res) => {
      if (cancelled) return;
      if (res?.ok && res.profile) {
        setGoal(res.profile.goal);
        setHorizon(res.profile.horizon);
        setOnDrop(res.profile.onDrop);
        setMaxLoss(String(res.profile.maxLoss ?? ''));
      }
      setState(res?.code === 'AUTH_REQUIRED' ? 'signed-out' : 'ready');
    });
    return () => { cancelled = true; };
  }, []);

  const loss = Number(String(maxLoss).replace(/[^\d]/g, ''));
  const complete = goal && horizon && onDrop && Number.isFinite(loss) && loss >= 0 && maxLoss !== '';

  const submit = async () => {
    if (!complete || state === 'saving') return;
    setState('saving');
    setError(null);
    const res = await saveProfile({ goal, horizon, onDrop, maxLoss: loss });
    if (res?.ok) {
      setState('saved');
      onSaved?.(res.profile);
    } else {
      setState('ready');
      setError([res?.message, res?.action].filter(Boolean).join(' '));
    }
  };

  return (
    <main className="pl-page" style={{ paddingBottom: 96 }}>
      <button onClick={onBack} className="font-data rp-back">
        ← Back
      </button>

      <h1 className="font-display" style={{ fontSize: 'var(--text-title)', marginTop: 32, maxWidth: '20ch' }}>
        Your situation
      </h1>

      <p
        className="font-body prose-measure"
        style={{ fontSize: 'var(--text-lead)', marginTop: 24, color: 'var(--color-graphite)' }}
      >
        Four questions. There is no score at the end and no label — what these do is let every
        measurement check what you said against what the simulation found.
      </p>

      {state === 'signed-out' && (
        <p className="font-body prose-measure" style={{ marginTop: 40 }}>
          This is kept with your account.{' '}
          <a href="/login?next=%2Fapp%23profile" style={{ textDecoration: 'underline' }}>
            Sign in
          </a>{' '}
          to answer it.
        </p>
      )}

      {(state === 'ready' || state === 'saving' || state === 'saved') && (
        <>
          <Question n="1" title="What is this money for?">
            {GOALS.map((g) => (
              <Choice
                key={g.value}
                selected={goal === g.value}
                onClick={() => setGoal(g.value)}
                label={g.label}
                note={g.note}
              />
            ))}
          </Question>

          <Question n="2" title="When would you need it back?">
            {HORIZONS.map((h) => (
              <Choice
                key={h.value}
                selected={horizon === h.value}
                onClick={() => setHorizon(h.value)}
                label={h.label}
              />
            ))}
          </Question>

          <Question
            n="3"
            title="What is the most you could lose without it changing your life?"
            sub="A rupee figure, not a percentage. The number you could explain to someone at home."
          >
            <div className="rp-amount">
              <span className="font-data rp-rupee">₹</span>
              <input
                className="font-data rp-input"
                inputMode="numeric"
                value={maxLoss}
                placeholder="10,000"
                onChange={(e) => setMaxLoss(e.target.value.replace(/[^\d]/g, ''))}
                aria-label="Most you could lose, in rupees"
              />
            </div>
            {loss > 0 && (
              <p className="font-body rp-echo">
                {rupees(loss)} — this gets compared against the simulation&rsquo;s one-in-ten
                outcome on every measurement you run.
              </p>
            )}
          </Question>

          <Question
            n="4"
            title="If this fell 20% in a month, what would you do?"
            sub="Answer with what you would actually do, not what sounds disciplined. This one gets priced."
          >
            {ON_DROP.map((d) => (
              <Choice
                key={d.value}
                selected={onDrop === d.value}
                onClick={() => setOnDrop(d.value)}
                label={d.label}
              />
            ))}
          </Question>

          {error && (
            <p className="font-body rp-error" role="alert">
              {error}
            </p>
          )}

          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 20 }}>
            <button className="pl-button font-data rp-save" onClick={submit} disabled={!complete || state === 'saving'}>
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
            </button>
            {state === 'saved' && (
              <span className="font-body" style={{ fontSize: '0.9375rem', color: 'var(--color-graphite)' }}>
                Every measurement will now be checked against this.
              </span>
            )}
          </div>

          <p className="font-body rp-fine">
            Nothing here is advice, and none of it is shared. It is your own statement about your
            own situation, kept so the app can tell you when a position contradicts it.
          </p>
        </>
      )}
    </main>
  );
}

function Question({ n, title, sub, children }) {
  return (
    <section className="rp-q">
      <p className="eyebrow">Question {n}</p>
      <h2 className="font-display rp-q-title">{title}</h2>
      {sub && <p className="font-body rp-q-sub">{sub}</p>}
      <div className="rp-choices">{children}</div>
    </section>
  );
}

function Choice({ selected, onClick, label, note }) {
  return (
    <button
      type="button"
      className={`rp-choice ${selected ? 'is-on' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="rp-tick" aria-hidden="true">
        {selected ? (
          <svg width="12" height="10" viewBox="0 0 12 10">
            <path d="M1 5 L4.5 8.5 L11 1" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ) : null}
      </span>
      <span>
        <span className="rp-choice-label font-body">{label}</span>
        {note && <span className="rp-choice-note font-body">{note}</span>}
      </span>
    </button>
  );
}
