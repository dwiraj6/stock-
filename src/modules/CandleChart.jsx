/* MODULE 3 (left) · THE PRICE CHART
   ────────────────────────────────────────────────────────────────
   Custom SVG, house palette. No chart library — every one of them
   would fight these specs, starting with the colours.

   THE INVERSION, applied to candles: up candles are HOLLOW, a 1px
   verdigris outline with no fill. Down candles are SOLID madder.
   A rising day is a thin line; a falling day is a filled block.
   Weight goes to the losses.

   Long ranges are aggregated, not decimated — a 3-year view draws
   weekly candles whose open is the first open, close the last
   close, high the max and low the min of the bucket. Dropping every
   fifth bar would be faster and would lie about the highs.        */

import { useMemo, useRef, useState, useCallback } from 'react';
import { useMeasure, useBreakpoint } from '../lib/hooks.js';
import { movingAverage } from '../lib/viz.js';
import { rupees2, group2, compactVol, longDate, axisMonth, pctSigned, axisPrice } from '../lib/format.js';

const RANGES = [
  { key: '1M', days: 21 },
  { key: '6M', days: 126 },
  { key: '1Y', days: 252 },
  { key: '3Y', days: 756 },
  { key: 'MAX', days: Infinity },
];

const MAX_CANDLES = 130;
const PAD = { top: 26, right: 14, bottom: 8, left: 60 };
const VOL_H = 72;
const XAXIS_H = 22;

export default function CandleChart({ quote, animate = true }) {
  const bp = useBreakpoint();
  const small = bp === 'sm';
  const [range, setRange] = useState(small ? '6M' : '1Y');
  const [cursor, setCursor] = useState(null);
  const [ref, { width }] = useMeasure();
  const svgRef = useRef(null);

  const CANDLE_H = small ? 320 : 380;
  const volH = small ? 56 : VOL_H;
  const height = CANDLE_H + 1 + volH + XAXIS_H;

  // Moving averages on the full daily series, then sampled at bucket
  // ends — a 50-day average has to stay 50 days even when the chart
  // is drawing weeks.
  const { ma50, ma200 } = useMemo(() => {
    const closes = Array.from(quote.closes);
    return { ma50: movingAverage(closes, 50), ma200: movingAverage(closes, 200) };
  }, [quote]);

  const candles = useMemo(() => {
    const spec = RANGES.find((r) => r.key === range) ?? RANGES[2];
    const n = Math.min(quote.bars.length, spec.days === Infinity ? quote.bars.length : spec.days);
    const from = quote.bars.length - n;
    const slice = quote.bars.slice(from);
    const bucket = Math.max(1, Math.ceil(slice.length / MAX_CANDLES));

    const out = [];
    for (let i = 0; i < slice.length; i += bucket) {
      const grp = slice.slice(i, i + bucket);
      const last = grp[grp.length - 1];
      const absIdx = from + i + grp.length - 1;
      out.push({
        date: last.date,
        from: grp[0].date,
        open: grp[0].open,
        close: last.close,
        high: Math.max(...grp.map((b) => b.high)),
        low: Math.min(...grp.map((b) => b.low)),
        volume: grp.reduce((s, b) => s + b.volume, 0),
        ma50: ma50[absIdx],
        ma200: ma200[absIdx],
        span: grp.length,
      });
    }
    return out.map((c) => ({ ...c, down: c.close < c.open }));
  }, [quote, range, ma50, ma200]);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = CANDLE_H - PAD.top - PAD.bottom;

  const scale = useMemo(() => {
    if (plotW <= 0 || candles.length === 0) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of candles) {
      if (c.low < lo) lo = c.low;
      if (c.high > hi) hi = c.high;
      for (const m of [c.ma50, c.ma200]) {
        if (m != null) {
          if (m < lo) lo = m;
          if (m > hi) hi = m;
        }
      }
    }
    const pad = (hi - lo) * 0.06 || 1;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const step = plotW / candles.length;
    const bodyW = Math.max(1, Math.min(14, step - 1)); // 1px gap minimum
    const x = (i) => PAD.left + i * step + step / 2;
    const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    const maxVol = Math.max(...candles.map((c) => c.volume));
    const volTop = CANDLE_H + 1;
    return { x, y, yMin, yMax, step, bodyW, maxVol, volTop };
  }, [candles, plotW, plotH, volH, CANDLE_H]);

  const yTicks = useMemo(() => {
    if (!scale) return [];
    const out = [];
    for (let i = 0; i <= 4; i++) out.push(scale.yMin + ((scale.yMax - scale.yMin) * i) / 4);
    return out;
  }, [scale]);

  const maPath = useCallback(
    (key) => {
      if (!scale) return '';
      let d = '';
      let started = false;
      candles.forEach((c, i) => {
        const v = c[key];
        if (v == null) return;
        d += `${started ? 'L' : 'M'}${scale.x(i).toFixed(1)} ${scale.y(v).toFixed(1)}`;
        started = true;
      });
      return d;
    },
    [candles, scale]
  );

  const maLen = useCallback(
    (key) => {
      if (!scale) return 0;
      let len = 0;
      let prev = null;
      candles.forEach((c, i) => {
        const v = c[key];
        if (v == null) return;
        const p = { x: scale.x(i), y: scale.y(v) };
        if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
      });
      return len;
    },
    [candles, scale]
  );

  const onMove = useCallback(
    (e) => {
      if (!scale) return;
      const rect = svgRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (px < PAD.left || px > PAD.left + plotW) {
        setCursor(null);
        return;
      }
      const i = Math.floor((px - PAD.left) / scale.step);
      if (i < 0 || i >= candles.length) {
        setCursor(null);
        return;
      }
      setCursor({ i, y: py });
    },
    [scale, plotW, candles.length]
  );

  const candlesSettled = candles.length * 4 + 120;
  const active = cursor ? candles[cursor.i] : null;

  const alt =
    `Price history for ${quote.ticker} over ${range}. ` +
    `Last close ${rupees2(quote.price)}, ${pctSigned(quote.dayChange)} on the day. ` +
    `52-week range ${rupees2(quote.low52)} to ${rupees2(quote.high52)}. ` +
    `50-day moving average ${ma50[ma50.length - 1] ? rupees2(ma50[ma50.length - 1]) : 'not available'}.`;

  return (
    <div>
      {/* range control — a real radiogroup (Part 11) */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 16 }}>
        <div className="font-data flex items-center" style={{ gap: 14, fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--color-graphite)' }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 14,
                height: 1,
                background: 'var(--color-ink)',
                verticalAlign: 'middle',
                marginRight: 5,
              }}
            />
            50D MA
          </span>
          {!small && (
            <span style={{ color: 'var(--color-graphite)' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 1,
                  backgroundImage:
                    'repeating-linear-gradient(to right, var(--color-graphite) 0 4px, transparent 4px 6px)',
                  verticalAlign: 'middle',
                  marginRight: 5,
                }}
              />
              200D MA
            </span>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Chart range"
          className="flex"
          style={{ border: '1px solid var(--color-rule)', borderRadius: 3, overflow: 'hidden' }}
          onKeyDown={(e) => {
            const i = RANGES.findIndex((r) => r.key === range);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              setRange(RANGES[(i + 1) % RANGES.length].key);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              setRange(RANGES[(i - 1 + RANGES.length) % RANGES.length].key);
            }
          }}
        >
          {RANGES.map((r) => {
            const on = r.key === range;
            return (
              <button
                key={r.key}
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setRange(r.key)}
                className="font-data"
                style={{
                  background: on ? 'var(--color-ink)' : 'transparent',
                  color: on ? 'var(--color-paper)' : 'var(--color-graphite)',
                  border: 'none',
                  borderRadius: 0,
                  padding: '5px 11px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'background var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out)',
                }}
              >
                {r.key}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={ref} className="relative w-full">
        {width > 0 && scale && (
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
            {/* horizontal gridlines only */}
            {yTicks.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={scale.y(v)}
                  y2={scale.y(v)}
                  stroke="var(--color-rule)"
                  strokeWidth="1"
                  opacity="0.15"
                />
                <text
                  x={PAD.left - 9}
                  y={scale.y(v) + 3.5}
                  textAnchor="end"
                  className="font-data"
                  fontSize="10.5"
                  fill="var(--color-graphite)"
                >
                  {axisPrice(v)}
                </text>
              </g>
            ))}

            {/* ── candles ── */}
            {candles.map((c, i) => {
              const cx = scale.x(i);
              const bodyTop = scale.y(Math.max(c.open, c.close));
              const bodyBot = scale.y(Math.min(c.open, c.close));
              const bodyH = Math.max(1, bodyBot - bodyTop);
              const colour = c.down ? 'var(--color-madder)' : 'var(--color-verdigris)';
              const tr = 'x 340ms var(--ease-out), y 340ms var(--ease-out), width 340ms var(--ease-out), height 340ms var(--ease-out), fill 340ms var(--ease-out), stroke 340ms var(--ease-out)';
              return (
                <g
                  key={i}
                  style={
                    animate
                      ? { animation: `pl-fade-in 120ms linear ${i * 4}ms both` }
                      : undefined
                  }
                >
                  {/* wick */}
                  <line
                    x1={cx}
                    x2={cx}
                    y1={scale.y(c.high)}
                    y2={scale.y(c.low)}
                    stroke={colour}
                    strokeWidth="1"
                    style={{ transition: 'all 340ms var(--ease-out)' }}
                  />
                  {/* body — hollow on the way up, solid on the way down */}
                  <rect
                    style={{
                      x: `${cx - scale.bodyW / 2}px`,
                      y: `${bodyTop}px`,
                      width: `${scale.bodyW}px`,
                      height: `${bodyH}px`,
                      fill: c.down ? 'var(--color-madder)' : 'none',
                      stroke: colour,
                      strokeWidth: 1,
                      transition: tr,
                    }}
                  />
                </g>
              );
            })}

            {/* ── moving averages, drawn after the candles land ── */}
            <path
              d={maPath('ma50')}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="1"
              style={
                animate
                  ? {
                      strokeDasharray: maLen('ma50'),
                      strokeDashoffset: maLen('ma50'),
                      animation: `pl-draw 500ms var(--ease-plot) ${candlesSettled}ms both`,
                      '--pl-len': maLen('ma50'),
                    }
                  : undefined
              }
            />
            {!small && (
              <path
                d={maPath('ma200')}
                fill="none"
                stroke="var(--color-graphite)"
                strokeWidth="1"
                strokeDasharray="4 2"
                style={animate ? { animation: `pl-fade-in 500ms linear ${candlesSettled}ms both` } : undefined}
              />
            )}

            {/* ── volume, sharing the X axis ── */}
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={scale.volTop + volH}
              y2={scale.volTop + volH}
              stroke="var(--color-rule)"
              strokeWidth="1"
            />
            {candles.map((c, i) => {
              const h = Math.max(0.5, (c.volume / scale.maxVol) * volH);
              return (
                <rect
                  key={i}
                  x={scale.x(i) - scale.bodyW / 2}
                  y={scale.volTop + volH - h}
                  width={scale.bodyW}
                  height={h}
                  fill={c.down ? 'var(--color-madder)' : 'var(--color-madder)'}
                  opacity={c.down ? 1 : 0.08}
                  style={{
                    transformOrigin: `center ${scale.volTop + volH}px`,
                    animation: animate
                      ? `pl-scale-y 300ms var(--ease-out) ${i * 4}ms both`
                      : undefined,
                    transition: 'x 340ms var(--ease-out), y 340ms var(--ease-out), width 340ms var(--ease-out), height 340ms var(--ease-out)',
                  }}
                />
              );
            })}
            {/* the volume scale is one max marker, not an axis */}
            <text
              x={PAD.left - 9}
              y={scale.volTop + 10}
              textAnchor="end"
              className="font-data"
              fontSize="10.5"
              fill="var(--color-graphite)"
            >
              {compactVol(scale.maxVol)}
            </text>

            {/* ── x axis ── */}
            {candles.map((c, i) => {
              const every = Math.max(1, Math.round(candles.length / (small ? 4 : 7)));
              if (i % every !== 0) return null;
              return (
                <text
                  key={i}
                  x={scale.x(i)}
                  y={height - 6}
                  textAnchor="middle"
                  className="font-data"
                  fontSize="10.5"
                  fill="var(--color-graphite)"
                >
                  {axisMonth(c.date)}
                </text>
              );
            })}

            {/* ── crosshair, both axes, tracking instantly ── */}
            {cursor && active && (
              <g pointerEvents="none">
                <line
                  x1={scale.x(cursor.i)}
                  x2={scale.x(cursor.i)}
                  y1={PAD.top}
                  y2={scale.volTop + volH}
                  stroke="var(--color-ink)"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                />
                {cursor.y > PAD.top && cursor.y < PAD.top + plotH && (
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={cursor.y}
                    y2={cursor.y}
                    stroke="var(--color-ink)"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                  />
                )}
              </g>
            )}
          </svg>
        )}

        {/* readout, pinned to the top-right of the plot area */}
        {cursor && active && (
          <div
            className="absolute font-data"
            style={{
              top: 4,
              right: PAD.right,
              background: 'var(--color-card)',
              border: '1px solid var(--color-rule)',
              padding: '7px 10px',
              fontSize: '0.75rem',
              lineHeight: 1.55,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            <div style={{ color: 'var(--color-graphite)' }}>{longDate(active.date)}</div>
            <div>
              <Cell k="O" v={group2(active.open)} />
              <Cell k="H" v={group2(active.high)} />
            </div>
            <div>
              <Cell k="L" v={group2(active.low)} />
              <Cell k="C" v={group2(active.close)} />
            </div>
            <div>
              <Cell k="VOL" v={compactVol(active.volume)} wide />
              <span style={{ color: 'var(--color-graphite)' }}>Δ </span>
              <span
                style={{
                  color: active.down ? 'var(--color-madder)' : 'var(--color-verdigris)',
                }}
              >
                {pctSigned(((active.close - active.open) / active.open) * 100)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 52-week range ──
          The marker's position is literal, not decorative. */}
      <FiftyTwoWeek quote={quote} animate={animate} delay={candlesSettled + 500} />
    </div>
  );
}

function Cell({ k, v, wide }) {
  return (
    <>
      <span style={{ color: 'var(--color-graphite)' }}>{k} </span>
      <span style={{ display: 'inline-block', minWidth: wide ? 68 : 62 }}>{v}</span>
    </>
  );
}

function FiftyTwoWeek({ quote, animate, delay }) {
  const ok =
    Number.isFinite(quote.price) &&
    Number.isFinite(quote.low52) &&
    Number.isFinite(quote.high52) &&
    quote.high52 > quote.low52;
  // No marker rather than a marker in the wrong place: its position
  // is literal, so it cannot be drawn from a guess.
  if (!ok) return null;
  const pos = Math.max(
    0,
    Math.min(1, (quote.price - quote.low52) / (quote.high52 - quote.low52))
  );
  return (
    <div style={{ marginTop: 22 }}>
      <div className="relative" style={{ height: 12 }}>
        <div
          className="absolute"
          style={{ left: 0, right: 0, top: 5.5, height: 1, background: 'var(--color-rule)' }}
        />
        <div
          className="absolute"
          style={{
            left: `${pos * 100}%`,
            top: 2,
            width: 8,
            height: 8,
            background: 'var(--color-ink)',
            transform: 'translateX(-50%)',
            borderRadius: 0,
            animation: animate ? `pl-fade-in 400ms var(--ease-out) ${delay}ms both` : 'none',
            transition: 'left 400ms var(--ease-out)',
          }}
        />
      </div>
      <div className="flex justify-between" style={{ marginTop: 6 }}>
        <div>
          <div className="font-data" style={{ fontSize: '0.8125rem' }}>{rupees2(quote.low52)}</div>
          <div className="eyebrow" style={{ marginTop: 2 }}>Low</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="font-data" style={{ fontSize: '0.8125rem' }}>{rupees2(quote.high52)}</div>
          <div className="eyebrow" style={{ marginTop: 2 }}>High</div>
        </div>
      </div>
    </div>
  );
}
