/* MODULE 2 · THE SIMULATION
   ────────────────────────────────────────────────────────────────
   Ten thousand possible outcomes. Not a smooth shaded confidence
   band — 400 sampled paths drawn as individual 1px madder strokes
   at 3% opacity, overlapping into density. Where the ink is dark,
   more futures went there. A shaded band would tell you the same
   thing while hiding that it is made of paths.

   The annotation order is fixed and is the entire point of the
   module: worst, then median, then best, top to bottom. The eye
   hits the loss first. */

import { useMemo, useRef, useState, useCallback } from 'react';
import { useMeasure, useBreakpoint } from '../lib/hooks.js';
import { axisRupee, rupees, rupeesSigned, axisMonth } from '../lib/format.js';

const PAD = { top: 30, right: 18, bottom: 30, left: 66 };

/* The horizons are the only genuine sequence in the app and the only
   place ordinal markers are permitted (Module 2). They come from the
   simulation payload's own point grid so the hairlines land exactly
   where the server sampled. */
const HORIZON_DAYS = [
  { label: '2M', day: 42 },
  { label: '6M', day: 126 },
  { label: '12M', day: 252 },
];

export default function FanChart({ sim, amount, asOf, animate = true }) {
  const pts = sim?.pathPoints ?? [];
  const N_REC = pts.length;
  const recToDay = (i) => pts[i]?.day ?? 0;
  const HORIZONS = HORIZON_DAYS.map((h) => {
    let best = 0;
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i].day - h.day) < Math.abs(pts[best].day - h.day)) best = i;
    }
    return { ...h, rec: best };
  });
  const bp = useBreakpoint();
  const [ref, { width }] = useMeasure();
  const height = bp === 'sm' ? 280 : 420;
  const [cursor, setCursor] = useState(null);
  const svgRef = useRef(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;

  // Dates along the horizon: trading days converted to calendar days.
  const dates = useMemo(() => {
    const out = new Array(N_REC);
    for (let i = 0; i < N_REC; i++) {
      const cal = Math.round(recToDay(i) * (365 / 252));
      out[i] = new Date(asOf.getTime() + cal * 86400000);
    }
    return out;
  }, [asOf]);

  const scale = useMemo(() => {
    if (!sim || plotW <= 0) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < N_REC; i++) {
      if (sim.band.p10[i] < lo) lo = sim.band.p10[i];
      if (sim.band.p90[i] > hi) hi = sim.band.p90[i];
    }
    // Headroom so the densest part of the fan is not jammed against
    // the frame. Paths beyond the band clip against the plot area,
    // which is what gives the bundle its frayed edge.
    const yMin = Math.min(lo * 0.9, amount * 0.72);
    const yMax = Math.max(hi * 1.1, amount * 1.24);
    const x = (i) => PAD.left + (i / (N_REC - 1)) * plotW;
    const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    return { x, y, yMin, yMax };
  }, [sim, plotW, plotH, amount]);

  const paths = useMemo(() => {
    if (!scale || !sim) return [];
    return sim.drawn.map((row) => {
      let d = '';
      for (let i = 0; i < N_REC; i++) {
        d += `${i === 0 ? 'M' : 'L'}${scale.x(i).toFixed(1)} ${scale.y(row[i]).toFixed(1)}`;
      }
      return d;
    });
  }, [sim, scale]);

  const medianPath = useMemo(() => {
    if (!scale || !sim) return '';
    let d = '';
    for (let i = 0; i < N_REC; i++) {
      d += `${i === 0 ? 'M' : 'L'}${scale.x(i).toFixed(1)} ${scale.y(sim.band.p50[i]).toFixed(1)}`;
    }
    return d;
  }, [sim, scale]);

  // Analytic length, so the median's draw is exact rather than a
  // guess at getTotalLength().
  const medianLen = useMemo(() => {
    if (!scale || !sim) return 0;
    let len = 0;
    for (let i = 1; i < N_REC; i++) {
      const dx = scale.x(i) - scale.x(i - 1);
      const dy = scale.y(sim.band.p50[i]) - scale.y(sim.band.p50[i - 1]);
      len += Math.hypot(dx, dy);
    }
    return len;
  }, [sim, scale]);

  const yTicks = useMemo(() => {
    if (!scale) return [];
    const steps = 5;
    const out = [];
    for (let i = 0; i <= steps; i++) {
      out.push(scale.yMin + ((scale.yMax - scale.yMin) * i) / steps);
    }
    return out;
  }, [scale]);

  const xTicks = useMemo(() => {
    if (!scale) return [];
    const every = bp === 'sm' ? 21 : 14; // recorded indices
    const out = [];
    for (let i = 0; i < N_REC; i += every) out.push(i);
    return out;
  }, [scale, bp]);

  const onMove = useCallback(
    (e) => {
      if (!scale || plotW <= 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      if (px < PAD.left || px > PAD.left + plotW) {
        setCursor(null);
        return;
      }
      const i = Math.round(((px - PAD.left) / plotW) * (N_REC - 1));
      setCursor(Math.max(0, Math.min(N_REC - 1, i)));
    },
    [scale, plotW]
  );

  if (!sim) return null;

  const finalLo = sim.lump.p10;
  const finalMid = sim.lump.p50;
  const finalHi = sim.lump.p90;

  const alt =
    `Simulation of 10,000 outcomes over twelve months on ${rupees(amount)}. ` +
    `Worst tenth percentile ${rupees(finalLo)}, a loss of ${rupees(Math.abs(finalLo - amount))}. ` +
    `Median ${rupees(finalMid)}, ${finalMid >= amount ? 'a gain' : 'a loss'} of ${rupees(Math.abs(finalMid - amount))}. ` +
    `Best tenth percentile ${rupees(finalHi)}, a gain of ${rupees(Math.abs(finalHi - amount))}.`;

  return (
    <section aria-labelledby="sim-eyebrow">
      <p className="eyebrow" id="sim-eyebrow">Ten thousand possible outcomes</p>
      <p className="sr-only">{alt}</p>

      <div ref={ref} className="relative mt-6 w-full">
        {width > 0 && (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={onMove}
            onMouseLeave={() => setCursor(null)}
            style={{ display: 'block', touchAction: 'pan-y' }}
            role="img"
            aria-label={alt}
          >
            <defs>
              <clipPath id="fan-clip">
                <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
              </clipPath>
              {/* The bundle is revealed left to right by one animated
                  rect rather than 400 dash offsets. The fan spreads
                  open as the reveal travels, because the paths
                  themselves diverge — the divergence does the work. */}
              <clipPath id="fan-draw">
                <rect x={PAD.left} y={0} height={height} width={plotW}>
                  {animate && (
                    <animate
                      attributeName="width"
                      from="0"
                      to={plotW}
                      dur="900ms"
                      begin="0s"
                      fill="freeze"
                      calcMode="spline"
                      keySplines="0.65 0 0.35 1"
                      keyTimes="0;1"
                      values={`0;${plotW}`}
                    />
                  )}
                </rect>
              </clipPath>
            </defs>

            {/* horizontal gridlines only, 15% opacity */}
            {yTicks.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={scale.y(v)}
                  y2={scale.y(v)}
                  stroke="var(--color-rule)"
                  strokeWidth="1"
                  opacity="0.15"
                />
                <text
                  x={PAD.left - 10}
                  y={scale.y(v) + 3.5}
                  textAnchor="end"
                  className="font-data"
                  fontSize="10.5"
                  fill="var(--color-graphite)"
                >
                  {axisRupee(v)}
                </text>
              </g>
            ))}

            {/* x axis month labels */}
            {xTicks.map((i) => (
              <text
                key={i}
                x={scale.x(i)}
                y={height - 10}
                textAnchor="middle"
                className="font-data"
                fontSize="10.5"
                fill="var(--color-graphite)"
              >
                {axisMonth(dates[i])}
              </text>
            ))}

            {/* ── the bundle ── */}
            {/* 400 paths at 3% opacity. Once drawn they never change,
                so the whole bundle is promoted to its own layer and
                excluded from hit-testing — the compositor can then
                scroll it as one texture instead of 400 elements. */}
            <g clipPath="url(#fan-clip)" style={{ pointerEvents: 'none' }}>
              <g clipPath="url(#fan-draw)">
                {paths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke="var(--color-madder)"
                    strokeWidth="1"
                    opacity="0.03"
                    style={
                      animate
                        ? {
                            // fades to 0.03, not to 1 — see pl-fade-to
                            '--pl-op': 0.03,
                            animation: `pl-fade-to 200ms linear ${(i * 1.2).toFixed(1)}ms both`,
                          }
                        : undefined
                    }
                  />
                ))}
              </g>

              {/* the median, drawn last */}
              <path
                d={medianPath}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="2"
                style={
                  animate
                    ? {
                        strokeDasharray: medianLen,
                        strokeDashoffset: medianLen,
                        animation: 'pl-draw 400ms var(--ease-plot) 900ms both',
                        '--pl-len': medianLen,
                      }
                    : undefined
                }
              />
            </g>

            {/* ── horizon hairlines: 2M / 6M / 12M ──
                The only genuine sequence in the app, and the only
                place ordinal markers are permitted. */}
            {HORIZONS.map((h) => (
              <g key={h.label}>
                <line
                  x1={scale.x(h.rec)}
                  x2={scale.x(h.rec)}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  stroke="var(--color-rule)"
                  strokeWidth="1"
                  style={
                    animate ? { animation: `pl-fade-in 200ms linear ${900 + h.rec * 4}ms both` } : undefined
                  }
                />
                <text
                  x={scale.x(h.rec) + 5}
                  y={PAD.top + 11}
                  className="font-data"
                  fontSize="10.5"
                  fill="var(--color-graphite)"
                  style={
                    animate ? { animation: `pl-fade-in 200ms linear ${900 + h.rec * 4}ms both` } : undefined
                  }
                >
                  {h.label}
                </text>
              </g>
            ))}

            {/* ── crosshair: tracks instantly, no animated tooltip ── */}
            {cursor !== null && (
              <g>
                <line
                  x1={scale.x(cursor)}
                  x2={scale.x(cursor)}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  stroke="var(--color-ink)"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                />
              </g>
            )}
          </svg>
        )}

        {/* readout box, pinned to the top edge */}
        {cursor !== null && (
          <div
            className="absolute font-data"
            style={{
              top: 0,
              left: Math.min(
                Math.max(PAD.left, scale.x(cursor) + 10),
                Math.max(PAD.left, width - 210)
              ),
              background: 'var(--color-card)',
              border: '1px solid var(--color-rule)',
              padding: '6px 9px',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            <div style={{ color: 'var(--color-graphite)' }}>{axisMonth(dates[cursor])}</div>
            <div>
              <span style={{ color: 'var(--color-graphite)' }}>10th </span>
              <span style={{ color: 'var(--color-madder)' }}>{rupees(sim.band.p10[cursor])}</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-graphite)' }}>50th </span>
              {rupees(sim.band.p50[cursor])}
            </div>
            <div>
              <span style={{ color: 'var(--color-graphite)' }}>90th </span>
              <span style={{ color: 'var(--color-verdigris)' }}>{rupees(sim.band.p90[cursor])}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── the annotation. Worst first. Always. ── */}
      <dl className="mt-8" style={{ maxWidth: 460 }}>
        <Outcome
          label="Worst 10%"
          value={finalLo}
          amount={amount}
          delay={1300}
          animate={animate}
          tone="var(--color-madder)"
          first
        />
        <Outcome
          label="Median"
          value={finalMid}
          amount={amount}
          delay={1420}
          animate={animate}
        />
        <Outcome
          label="Best 10%"
          value={finalHi}
          amount={amount}
          delay={1540}
          animate={animate}
          tone="var(--color-verdigris)"
        />
      </dl>
    </section>
  );
}

function Outcome({ label, value, amount, delay, animate, tone, first }) {
  const delta = value - amount;
  return (
    <div
      className="flex items-baseline justify-between"
      style={{
        borderTop: first ? 'none' : '1px solid var(--color-rule)',
        padding: '10px 0',
        animation: animate ? `pl-fade-in 200ms var(--ease-out) ${delay}ms both` : 'none',
      }}
    >
      <dt className="font-data" style={{ fontSize: '0.875rem', color: 'var(--color-graphite)' }}>
        {label}
      </dt>
      <dd className="font-data flex items-baseline" style={{ gap: 20 }}>
        <span style={{ fontSize: 'var(--text-lead)' }}>{rupees(value)}</span>
        <span
          style={{
            fontSize: '0.875rem',
            color: delta < 0 ? 'var(--color-madder)' : 'var(--color-verdigris)',
            minWidth: 92,
            textAlign: 'right',
            display: 'inline-block',
          }}
        >
          {rupeesSigned(delta)}
        </span>
      </dd>
    </div>
  );
}
