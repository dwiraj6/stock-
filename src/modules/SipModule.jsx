/* MODULE 5 · LUMPSUM VERSUS SIP
   ────────────────────────────────────────────────────────────────
   The same money, two ways — so both distributions are computed on
   the identical total capital and the identical 10,000 futures. The
   only difference between them is when the money goes in.

   Both plots share one X domain. Two distributions on different
   scales, drawn side by side, would make the narrower one look
   safer for free. */

import { useMemo } from 'react';
import { useMeasure, useBreakpoint } from '../lib/hooks.js';
import { rupees, axisRupee } from '../lib/format.js';

export default function SipModule({ sim, amount, animate = true }) {
  const bp = useBreakpoint();
  const small = bp === 'sm';
  const [ref, { width }] = useMeasure();

  /* Both curves and their shared domain arrive from the server,
     computed from all 10,000 terminal values rather than from the
     400 paths the fan draws. Nothing here re-derives a distribution;
     it renders the one the simulation actually produced. */
  const density = sim.density;
  const domain = density ? density.domain : [0, 1];
  const lumpKde = density ? { xs: density.xs, ys: density.lumpsum } : { xs: [], ys: [] };
  const sipKde = density ? { xs: density.xs, ys: density.sip } : { xs: [], ys: [] };

  const medianGiveUp = Math.round(sim.lump.p50 - sim.sip.p50);
  const worstCut = Math.round(sim.sip.p10 - sim.lump.p10);
  const tranche = Math.round(sim.sip.tranche);

  const panelW = small ? width : Math.max(0, (width - 32) / 2);

  const alt =
    `Two outcome distributions on the same ${rupees(amount)}. ` +
    `Deployed today: worst tenth ${rupees(sim.lump.p10)}, median ${rupees(sim.lump.p50)}, best tenth ${rupees(sim.lump.p90)}. ` +
    `Deployed monthly: worst tenth ${rupees(sim.sip.p10)}, median ${rupees(sim.sip.p50)}, best tenth ${rupees(sim.sip.p90)}.`;

  return (
    <section aria-labelledby="sip-eyebrow">
      <p className="eyebrow" id="sip-eyebrow">The same money, two ways</p>
      <p className="sr-only">{alt}</p>

      <div
        ref={ref}
        style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: small ? '1fr' : '1fr 1fr',
          gap: 32,
        }}
      >
        <Distribution
          title={`${rupees(amount)} today`}
          data={lumpKde}
          domain={domain}
          stats={sim.lump}
          width={panelW}
          animate={animate}
          idKey="lump"
        />
        <Distribution
          title={`${rupees(tranche)} × 12 months`}
          data={sipKde}
          domain={domain}
          stats={sim.sip}
          width={panelW}
          animate={animate}
          idKey="sip"
        />
      </div>

      <p
        className="font-body"
        style={{
          marginTop: 32,
          textAlign: 'center',
          fontSize: 'var(--text-lead)',
          maxWidth: '62ch',
          marginLeft: 'auto',
          marginRight: 'auto',
          animation: animate ? 'pl-fade-in 300ms var(--ease-out) 900ms both' : 'none',
        }}
      >
        {medianGiveUp > 0 ? (
          <>
            The SIP gives up <span className="font-data">{rupees(medianGiveUp)}</span> of median
            return to cut your worst case by{' '}
            <span className="font-data">{rupees(Math.abs(worstCut))}</span>. That trade is what
            rupee-cost averaging actually is.
          </>
        ) : (
          <>
            Here the SIP gives up nothing at the median and still cuts your worst case by{' '}
            <span className="font-data">{rupees(Math.abs(worstCut))}</span>. That trade is what
            rupee-cost averaging actually is.
          </>
        )}
      </p>
    </section>
  );
}

const H = 190;
const AXIS_H = 40;
const PADX = 8;

function Distribution({ title, data, domain, stats, width, animate, idKey }) {
  const w = Math.max(0, width);
  const plotW = Math.max(0, w - PADX * 2);
  // No curve is better than a curve drawn from nothing.
  const usable = Array.isArray(data?.xs) && data.xs.length > 1 && domain[1] > domain[0];

  const { path, len } = useMemo(() => {
    if (plotW <= 0) return { path: '', len: 0 };
    const x = (v) => PADX + ((v - domain[0]) / (domain[1] - domain[0])) * plotW;
    const y = (d) => H - d * (H - 14);
    let d = `M${x(data.xs[0]).toFixed(1)} ${H}`;
    let length = 0;
    let prev = null;
    for (let i = 0; i < data.xs.length; i++) {
      const px = x(data.xs[i]);
      const py = y(data.ys[i]);
      d += `L${px.toFixed(1)} ${py.toFixed(1)}`;
      if (prev) length += Math.hypot(px - prev[0], py - prev[1]);
      prev = [px, py];
    }
    d += `L${x(data.xs[data.xs.length - 1]).toFixed(1)} ${H}Z`;
    return { path: d, len: length };
  }, [data, domain, plotW]);

  const xOf = (v) => PADX + ((v - domain[0]) / (domain[1] - domain[0])) * plotW;

  const markers = [
    { key: 'p10', v: stats.p10, label: '10th' },
    { key: 'p50', v: stats.p50, label: 'median' },
    { key: 'p90', v: stats.p90, label: '90th' },
  ];

  return (
    <div style={{ minWidth: 0 }}>
      <p className="eyebrow" style={{ marginBottom: 12 }}>{title}</p>
      {!usable && (
        <p className="font-body" style={{ fontSize: '0.9375rem', color: 'var(--color-graphite)' }}>
          Outcome distribution not available.
        </p>
      )}
      {w > 0 && usable && (
        <svg width={w} height={H + AXIS_H} viewBox={`0 0 ${w} ${H + AXIS_H}`} aria-hidden="true">
          <defs>
            <clipPath id={`fill-${idKey}`}>
              <rect x="0" y="0" width={w} height={H + AXIS_H} />
            </clipPath>
          </defs>

          {/* fill, arriving after the outline has drawn */}
          <path
            d={path}
            fill="var(--color-madder)"
            fillOpacity="0.08"
            stroke="none"
            style={animate ? { animation: 'pl-fade-in 300ms linear 600ms both' } : undefined}
          />
          {/* outline first */}
          <path
            d={path}
            fill="none"
            stroke="var(--color-madder)"
            strokeWidth="1"
            style={
              animate
                ? {
                    strokeDasharray: len,
                    strokeDashoffset: len,
                    animation: 'pl-draw 600ms var(--ease-plot) 0ms both',
                    '--pl-len': len,
                  }
                : undefined
            }
          />

          {/* the shared axis line */}
          <line x1={0} x2={w} y1={H} y2={H} stroke="var(--color-rule)" strokeWidth="1" />

          {/* percentile markers */}
          {markers.map((m, i) => (
            <g
              key={m.key}
              style={
                animate
                  ? { animation: `pl-fade-in 200ms var(--ease-out) ${800 + i * 60}ms both` }
                  : undefined
              }
            >
              <line
                x1={xOf(m.v)}
                x2={xOf(m.v)}
                y1={14}
                y2={H}
                stroke={m.key === 'p50' ? 'var(--color-ink)' : 'var(--color-graphite)'}
                strokeWidth="1"
                strokeDasharray={m.key === 'p50' ? undefined : '3 2'}
              />
              <text
                x={clampLabel(xOf(m.v), w)}
                y={H + 16}
                textAnchor="middle"
                className="font-data"
                fontSize="10.5"
                fill={m.key === 'p50' ? 'var(--color-ink)' : 'var(--color-graphite)'}
              >
                {axisRupee(m.v)}
              </text>
              <text
                x={clampLabel(xOf(m.v), w)}
                y={H + 30}
                textAnchor="middle"
                className="font-data"
                fontSize="10"
                fill="var(--color-graphite)"
              >
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

function clampLabel(x, w) {
  return Math.max(26, Math.min(w - 26, x));
}
