/* MODULE 1 · THE GAP
   ────────────────────────────────────────────────────────────────
   The signature element, and the only place 4.5rem appears in the
   entire application.

   A measurement, drawn the way a technical drawing draws one: a
   scale, two markers, and a dimension line with perpendicular
   end-caps and inward-pointing arrows spanning the distance being
   called out. The number is the subject of the screen, so it is
   set at a size nothing else is allowed to use.

   At 375 the whole thing rotates and becomes an actual plumb line
   (Part 10) — not a squeezed version of the desktop component but
   the better one. */

import { useMemo } from 'react';
import Rail from '../components/Rail.jsx';
import { TriangleDown, TriangleUp, TriangleLeft, ArrowHead } from '../components/marks/Marks.jsx';
import { useCountUp, useBreakpoint } from '../lib/hooks.js';
import { gapCaption } from '../lib/viz.js';

const T = {
  rail: 0,        // rail and ticks draw left→right, 500ms, ease-plot
  you: 300,       // your marker drops in from above, 280ms
  data: 480,      // data marker rises from below, 280ms
  dimension: 700, // dimension line extends from centre outward, 260ms
  caps: 860,      // end-caps snap in, 140ms, ease-snap
  count: 900,     // gap number counts up, 600ms
  caption: 1300,  // caption fades in, 240ms
};

export default function GapModule({ conviction, score, animate = true }) {
  const bp = useBreakpoint();
  const gap = Math.abs(conviction - score);
  const counted = useCountUp(gap, { duration: 600, delay: T.count, active: animate });
  const shown = Math.round(counted);

  const dataColor = score < 50 ? 'var(--color-madder)' : 'var(--color-verdigris)';
  const lo = Math.min(conviction, score);
  const hi = Math.max(conviction, score);

  const caption = useMemo(() => gapCaption(gap), [gap]);

  const alt =
    `Measurement. Your conviction ${conviction} of 100. The model's conviction ${score} of 100. ` +
    `The gap between them is ${gap} points. ${caption}`;

  return (
    <section aria-labelledby="gap-eyebrow" className="w-full">
      <p className="eyebrow" id="gap-eyebrow">The measurement</p>
      <p className="sr-only">{alt}</p>

      {bp === 'sm' ? (
        <VerticalGap
          conviction={conviction}
          score={score}
          gap={shown}
          dataColor={dataColor}
          animate={animate}
        />
      ) : (
        <HorizontalGap
          conviction={conviction}
          score={score}
          gap={shown}
          lo={lo}
          hi={hi}
          dataColor={dataColor}
          animate={animate}
        />
      )}

      <p
        className="prose-measure mt-10"
        style={{
          fontSize: 'var(--text-lead)',
          animation: animate ? `pl-fade-in 240ms var(--ease-out) ${T.caption}ms both` : 'none',
        }}
      >
        {caption}
      </p>
    </section>
  );
}

/* ── Desktop / tablet ─────────────────────────────────────────── */

function HorizontalGap({ conviction, score, gap, lo, hi, dataColor, animate }) {
  const leftPct = lo;
  const spanPct = hi - lo;
  const CAP_H = 15;

  /* Eight of twelve columns: (1200 − 11·24)·8/12 + 7·24 = 792px.
     The rail is a measuring instrument, and an instrument that runs
     the full width of the page has no edges to read it against. */
  return (
    <div
      className="relative mt-8 select-none"
      style={{ paddingTop: 132, paddingBottom: 86, maxWidth: 792 }}
    >
      {/* ── the gap figure — the only 4.5rem in the application ── */}
      <div
        className="absolute font-display"
        style={{
          left: `${leftPct + spanPct / 2}%`,
          transform: 'translateX(-50%)',
          top: 0,
          fontSize: 'var(--text-gap)',
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1',
          animation: animate ? `pl-fade-in 1ms linear ${T.count}ms both` : 'none',
        }}
      >
        {gap}
      </div>

      {/* ── dimension line ── */}
      <div
        className="absolute"
        style={{ left: `${leftPct}%`, width: `${spanPct}%`, top: 92, height: CAP_H }}
      >
        {/* the span, extending from the centre outward */}
        <div
          className="absolute"
          style={{
            left: 0,
            right: 0,
            top: CAP_H / 2,
            height: 1,
            background: 'var(--color-ink)',
            transformOrigin: 'center',
            animation: animate
              ? `pl-scale-x 260ms var(--ease-out) ${T.dimension}ms both`
              : 'none',
          }}
        />
        {/* perpendicular end-caps, snapping in */}
        {[0, 1].map((side) => (
          <div
            key={side}
            className="absolute"
            style={{
              left: side === 0 ? 0 : '100%',
              top: 0,
              width: 1,
              height: CAP_H,
              background: 'var(--color-ink)',
              transform: 'translateX(-0.5px)',
              animation: animate
                ? `pl-fade-in 140ms var(--ease-snap) ${T.caps}ms both`
                : 'none',
            }}
          />
        ))}
        {/* inward-pointing arrows, as on a technical drawing */}
        <div
          className="absolute"
          style={{
            left: 1,
            top: CAP_H / 2 - 3.5,
            animation: animate ? `pl-fade-in 140ms var(--ease-snap) ${T.caps}ms both` : 'none',
          }}
        >
          <ArrowHead dir="right" />
        </div>
        <div
          className="absolute"
          style={{
            left: 'calc(100% - 8px)',
            top: CAP_H / 2 - 3.5,
            animation: animate ? `pl-fade-in 140ms var(--ease-snap) ${T.caps}ms both` : 'none',
          }}
        >
          <ArrowHead dir="left" />
        </div>
      </div>

      {/* ── your marker: solid, pointing down from above ── */}
      <Marker
        pct={conviction}
        label="you"
        value={conviction}
        color="var(--color-ink)"
        placement="above"
        animate={animate}
        delay={T.you}
      />

      {/* ── the rail ── */}
      <div
        style={{
          animation: animate
            ? `pl-reveal-x 500ms var(--ease-plot) ${T.rail}ms both`
            : 'none',
        }}
      >
        <Rail min={0} max={100} tickEvery={10} numerals tickLength={6} style={{ height: 1 }} />
      </div>

      {/* ── the data marker: hollow, pointing up from below ── */}
      <Marker
        pct={score}
        label="the data"
        value={score}
        color={dataColor}
        placement="below"
        animate={animate}
        delay={T.data}
      />
    </div>
  );
}

/* Two nested elements, deliberately.
   The outer one centres the marker on its value with translateX(-50%);
   the inner one carries the entry animation. They cannot be the same
   element: a CSS animation that touches `transform` wins over an
   inline transform for the whole of its duration AND, under
   fill-mode: both, forever after — so the final keyframe's
   translateY(0) would silently erase the centring and park every
   marker half a label-width to the right of the number it points at.
   On a component whose entire job is pointing precisely at a value,
   that is not a cosmetic bug. */
function Marker({ pct, label, value, color, placement, animate, delay }) {
  const above = placement === 'above';
  return (
    <div
      className="absolute"
      style={{
        left: `${pct}%`,
        top: above ? 108 : undefined,
        bottom: above ? undefined : 22,
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          gap: 4,
          animation: animate
            ? `${above ? 'pl-drop-in' : 'pl-rise-in'} 280ms var(--ease-out) ${delay}ms both`
            : 'none',
        }}
      >
        {above ? (
          <>
            <span
              className="font-data whitespace-nowrap"
              style={{ fontSize: '0.75rem', color: 'var(--color-graphite)', lineHeight: 1 }}
            >
              {label} <span style={{ color: 'var(--color-ink)' }}>{value}</span>
            </span>
            <TriangleDown size={13} color={color} solid />
          </>
        ) : (
          <>
            <TriangleUp size={13} color={color} solid={false} />
            <span
              className="font-data whitespace-nowrap"
              style={{ fontSize: '0.75rem', color: 'var(--color-graphite)', lineHeight: 1 }}
            >
              {label} <span style={{ color }}>{value}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 375: the rail rotates and becomes the plumb line ─────────── */

/* At 375 the composition is rearranged, not just rotated:
     · the figure sits above the instrument, as it does on desktop,
       because 4.5rem beside a 340px rail collides with the scale
     · the scale reads down the LEFT of the rail
     · both markers sit to the RIGHT, so neither one lands on a numeral
     · the dimension line brackets the whole measurement from the
       far left, where nothing else competes for the column
   Same instrument, laid out for the column it has. */
function VerticalGap({ conviction, score, gap, dataColor, animate }) {
  const H = 340;
  // clears the 4.5rem figure sitting in flow above the instrument
  const TOP = 102;
  const RAIL_X = '34%';
  const yOf = (v) => ((100 - v) / 100) * H;
  const yYou = yOf(conviction);
  const yData = yOf(score);
  const top = Math.min(yYou, yData);
  const span = Math.abs(yYou - yData);
  const CAP_W = 14;

  return (
    <div className="relative mt-6 select-none" style={{ height: H + TOP + 24 }}>
      {/* the figure — the only 4.5rem in the application */}
      <div
        className="font-display"
        style={{
          fontSize: 'var(--text-gap)',
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 18,
          animation: animate ? `pl-fade-in 1ms linear ${T.count}ms both` : 'none',
        }}
      >
        {gap}
      </div>

      {/* the rail, hanging */}
      <div
        className="absolute"
        style={{
          left: RAIL_X,
          top: TOP,
          height: H,
          width: 1,
          animation: animate ? `pl-reveal-y 500ms var(--ease-plot) ${T.rail}ms both` : 'none',
        }}
      >
        <Rail
          orientation="vertical"
          invert
          numeralSide="left"
          min={0}
          max={100}
          tickEvery={20}
          numerals
          tickLength={5}
          style={{ height: H }}
        />
      </div>

      {/* your marker — solid, pointing right at the line from the left.
          Same nesting as the horizontal marker, for the same reason:
          pl-slide-left animates transform and would otherwise wipe the
          translateY(-50%) that sits it on its value. */}
      <div
        className="absolute"
        style={{ left: RAIL_X, marginLeft: 12, top: TOP + yYou, transform: 'translateY(-50%)' }}
      >
        <div
          className="flex items-center"
          style={{
            gap: 6,
            animation: animate ? `pl-slide-left 280ms var(--ease-out) ${T.you}ms both` : 'none',
          }}
        >
          <TriangleLeft size={12} color="var(--color-ink)" solid />
          <span
            className="font-data whitespace-nowrap"
            style={{ fontSize: '0.75rem', color: 'var(--color-graphite)' }}
          >
            you <span style={{ color: 'var(--color-ink)' }}>{conviction}</span>
          </span>
        </div>
      </div>

      {/* the data marker — hollow, pointing left at the line from the right */}
      <div
        className="absolute flex items-center"
        style={{
          left: RAIL_X,
          marginLeft: 12,
          top: TOP + yData,
          transform: 'translateY(-50%)',
          gap: 6,
          animation: animate ? `pl-fade-in 280ms var(--ease-out) ${T.data}ms both` : 'none',
        }}
      >
        <TriangleLeft size={12} color={dataColor} solid={false} />
        <span
          className="font-data whitespace-nowrap"
          style={{ fontSize: '0.75rem', color: 'var(--color-graphite)' }}
        >
          the data <span style={{ color: dataColor }}>{score}</span>
        </span>
      </div>

      {/* the dimension line, measuring vertically */}
      <div
        className="absolute"
        style={{ left: 2, top: TOP + top, height: span, width: CAP_W }}
      >
        <div
          className="absolute"
          style={{
            top: 0,
            bottom: 0,
            left: CAP_W / 2,
            width: 1,
            background: 'var(--color-ink)',
            transformOrigin: 'center',
            animation: animate
              ? `pl-scale-y 260ms var(--ease-out) ${T.dimension}ms both`
              : 'none',
          }}
        />
        {[0, 1].map((side) => (
          <div
            key={side}
            className="absolute"
            style={{
              top: side === 0 ? 0 : '100%',
              left: 0,
              height: 1,
              width: CAP_W,
              background: 'var(--color-ink)',
              animation: animate
                ? `pl-fade-in 140ms var(--ease-snap) ${T.caps}ms both`
                : 'none',
            }}
          />
        ))}
        <div
          className="absolute"
          style={{
            left: CAP_W / 2 - 3.5,
            top: 1,
            animation: animate ? `pl-fade-in 140ms var(--ease-snap) ${T.caps}ms both` : 'none',
          }}
        >
          <ArrowHead dir="down" />
        </div>
        <div
          className="absolute"
          style={{
            left: CAP_W / 2 - 3.5,
            top: 'calc(100% - 8px)',
            animation: animate ? `pl-fade-in 140ms var(--ease-snap) ${T.caps}ms both` : 'none',
          }}
        >
          <ArrowHead dir="up" />
        </div>
      </div>

    </div>
  );
}
