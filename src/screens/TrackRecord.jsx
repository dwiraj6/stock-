/* SCREEN · YOUR TRACK RECORD
   ────────────────────────────────────────────────────────────────
   The only part of this product that can change what someone does.

   Every measurement is logged the moment it is made — the stock, the
   price then, your stated odds, the simulation's odds. None of it
   can be revised afterwards, because it is written before the
   outcome exists. When you come back, the current price decides.

   Scored with Brier, the same statistic the app uses on itself in
   the calibration module. That symmetry is deliberate: the app holds
   its user to exactly the standard it holds itself to, and publishes
   both.

   An open position is shown as open. It is not right or wrong yet,
   and scoring it early would be the same dishonesty the rest of the
   product spends its time avoiding. */

import { useEffect, useState } from 'react';
import { rupees2, pctSigned } from '../lib/format.js';
import { getTrackRecord, getCalibration } from '../lib/client.js';
import { useReducedMotion } from '../lib/hooks.js';

export default function TrackRecord({ onBack }) {
  const reduced = useReducedMotion();
  const animate = !reduced;
  const [track, setTrack] = useState(null);
  const [state, setState] = useState('loading');
  /* The model's own record, shown alongside yours.
     A new user's record is necessarily empty — a 12-month horizon
     matures in 12 months — so a screen showing only their record is
     blank on the day it matters most. The model's record is not
     blank: 120 band forecasts and 240 direction forecasts, all real,
     all point-in-time. Showing both makes the standard explicit and
     the screen honest from the first visit. */
  const [model, setModel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCalibration().then((res) => {
      if (!cancelled && res?.ok) {
        setModel({
          band: res.calibration,
          direction: res.probability ?? null,
          factors: res.factors ?? null,
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTrackRecord().then((res) => {
      if (cancelled) return;
      if (res?.ok && res.track) {
        setTrack(res.track);
        setState('ready');
      } else {
        setState('empty');
      }
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
        style={{ fontSize: 'var(--text-title)', marginTop: 32, maxWidth: '20ch' }}
      >
        Your track record
      </h1>

      <p
        className="font-body prose-measure"
        style={{ fontSize: 'var(--text-lead)', marginTop: 24, color: 'var(--color-graphite)' }}
      >
        Every measurement you run is written down before the outcome exists. This is what
        happened next.
      </p>

      {state === 'loading' && (
        <p className="font-data" style={{ marginTop: 48, color: 'var(--color-graphite)', fontSize: '0.875rem' }}>
          Reading your decisions…
        </p>
      )}

      {state === 'empty' && (
        <p className="font-body prose-measure" style={{ marginTop: 48, fontSize: '1rem' }}>
          Nothing recorded yet. Run a measurement and it will be logged here — your stated
          odds and the simulation's, both fixed before anything is known.
        </p>
      )}

      {/* ── the model's record, always present ── */}
      {model?.band && (
        <div
          style={{
            marginTop: 48,
            background: 'var(--color-paper-deep)',
            padding: 40,
            maxWidth: 820,
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 16 }}>
            The standard — the model's own record
          </p>
          <p className="font-body" style={{ fontSize: '1.0625rem', lineHeight: 1.65 }}>
            Yours is measured the same way this is. On{' '}
            <span className="font-data">{model.band.universe}</span> point-in-time forecasts
            the 80% band contained the outcome{' '}
            <span className="font-data">{Math.round(model.band.hitRate * 100)}%</span> of the
            time. On direction it scored Brier{' '}
            <span className="font-data">{model.direction?.brier ?? '—'}</span> against{' '}
            <span className="font-data">{model.direction?.brierBaseline ?? '—'}</span> for
            guessing the base rate — no skill at all
            {model.factors ? `, and none of the ${model.factors.results?.length ?? 5} price factors we tested did better` : ''}
            .
          </p>
          <p
            className="font-body"
            style={{ fontSize: '1rem', lineHeight: 1.65, marginTop: 14, color: 'var(--color-graphite)' }}
          >
            So the bar is low. If your own Brier comes in under{' '}
            <span className="font-data">{model.direction?.brierBaseline ?? '0.23'}</span>,
            you are reading these stocks better than the simulation is.
          </p>
        </div>
      )}

      {state === 'ready' && track && (
        <>
          {/* ── the verdict ── */}
          <div
            style={{
              marginTop: 48,
              background: 'var(--color-card)',
              border: '1px solid var(--color-rule)',
              padding: 40,
              maxWidth: 820,
              animation: animate ? 'pl-fade-up 340ms var(--ease-out) both' : 'none',
            }}
          >
            <p className="eyebrow" style={{ marginBottom: 16 }}>
              {track.matured} of {track.total} matured
            </p>
            <p className="font-body" style={{ fontSize: 'var(--text-lead)', lineHeight: 1.6 }}>
              {track.verdict}
            </p>

            {track.matured >= 1 && (
              <div
                style={{
                  marginTop: 28,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 24,
                  borderTop: '1px solid var(--color-rule)',
                  paddingTop: 24,
                }}
              >
                <Stat
                  label="Your Brier"
                  value={track.yourBrier}
                  hint="0 is perfect, 0.25 is a coin flip"
                />
                <Stat label="The model's" value={track.modelBrier} hint="same measure, same decisions" />
                <Stat
                  label="Base rate"
                  value={track.baselineBrier}
                  hint={`always guessing ${Math.round((track.observedRate ?? 0) * 100)}%`}
                />
                <Stat
                  label="You were closer"
                  value={track.yourHitRate === null ? null : `${Math.round(track.yourHitRate * 100)}%`}
                  hint="of the time, vs the model"
                  raw
                />
              </div>
            )}
          </div>

          {/* ── the decisions ── */}
          <ul style={{ listStyle: 'none', margin: '48px 0 96px', padding: 0, maxWidth: 900 }}>
            {track.decisions.map((d, i) => (
              <li
                key={`${d.symbol}-${d.createdAt}-${i}`}
                style={{
                  borderTop: '1px solid var(--color-rule)',
                  padding: '20px 0',
                  animation: animate
                    ? `pl-fade-up 300ms var(--ease-out) ${Math.min(i, 12) * 40}ms both`
                    : 'none',
                  '--pl-rise': '8px',
                }}
              >
                <div className="flex items-baseline justify-between" style={{ gap: 16 }}>
                  <span className="font-data" style={{ fontSize: '0.9375rem' }}>
                    {d.symbol}
                  </span>
                  <span
                    className="font-data"
                    style={{
                      fontSize: '0.75rem',
                      color: d.matured
                        ? d.outcome === 1
                          ? 'var(--color-verdigris)'
                          : 'var(--color-madder)'
                        : 'var(--color-graphite)',
                    }}
                  >
                    {d.matured
                      ? d.outcome === 1
                        ? 'ended ahead'
                        : 'ended behind'
                      : `open · ${d.daysRemaining} days to go`}
                  </span>
                </div>

                <div
                  className="font-data"
                  style={{
                    marginTop: 10,
                    fontSize: '0.8125rem',
                    color: 'var(--color-graphite)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 20,
                  }}
                >
                  <span>
                    you said{' '}
                    <span style={{ color: 'var(--color-ink)' }}>
                      {Math.round(d.userProb * 100)}%
                    </span>
                  </span>
                  <span>
                    model said{' '}
                    <span style={{ color: 'var(--color-ink)' }}>
                      {Math.round(d.modelProb * 100)}%
                    </span>
                  </span>
                  <span>
                    {rupees2(d.priceAt)}
                    {d.currentPrice !== null ? ` → ${rupees2(d.currentPrice)}` : ''}
                  </span>
                  {d.returnPct !== null && (
                    <span
                      style={{
                        color:
                          d.returnPct >= 0 ? 'var(--color-verdigris)' : 'var(--color-madder)',
                      }}
                    >
                      {pctSigned(d.returnPct)}
                    </span>
                  )}
                  {d.closer && (
                    <span style={{ color: 'var(--color-ink)' }}>
                      {d.closer === 'tie' ? 'dead heat' : `${d.closer} closer`}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, hint, raw }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p
        className="font-data"
        style={{ fontSize: 'var(--text-head)', marginTop: 6, lineHeight: 1 }}
      >
        {value === null || value === undefined ? '—' : raw ? value : value.toFixed(3)}
      </p>
      <p
        className="font-body"
        style={{ fontSize: '0.75rem', color: 'var(--color-graphite)', marginTop: 6 }}
      >
        {hint}
      </p>
    </div>
  );
}
