/* Drawn marks (1.4).
   ────────────────────────────────────────────────────────────────
   No icon library. These are the whole permitted set: triangle
   marker (solid and hollow), dimension end-cap, tick, chevron,
   crosshair, plus/minus, horizontal rule, arrow.

   All are hairline strokes at fixed pixel size with no fills except
   the markers, and none of them scale with a viewBox — a 1px stroke
   that becomes 1.3px because its parent grew is not a hairline. */

export function TriangleDown({ size = 13, color = 'var(--color-ink)', solid = true, className = '' }) {
  const h = size * 0.86;
  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className={className} aria-hidden="true">
      <path
        d={`M0 0 L${size} 0 L${size / 2} ${h} Z`}
        fill={solid ? color : 'none'}
        stroke={color}
        strokeWidth={solid ? 0 : 1}
      />
    </svg>
  );
}

export function TriangleUp({ size = 13, color = 'var(--color-ink)', solid = false, className = '' }) {
  const h = size * 0.86;
  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className={className} aria-hidden="true">
      <path
        d={`M0 ${h} L${size} ${h} L${size / 2} 0 Z`}
        fill={solid ? color : 'none'}
        stroke={color}
        strokeWidth={solid ? 0 : 1}
      />
    </svg>
  );
}

/** Pointing right / left, for the vertical gap rail on 375. */
export function TriangleRight({ size = 13, color = 'var(--color-ink)', solid = true }) {
  const w = size * 0.86;
  return (
    <svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} aria-hidden="true">
      <path
        d={`M0 0 L0 ${size} L${w} ${size / 2} Z`}
        fill={solid ? color : 'none'}
        stroke={color}
        strokeWidth={solid ? 0 : 1}
      />
    </svg>
  );
}

export function TriangleLeft({ size = 13, color = 'var(--color-ink)', solid = false }) {
  const w = size * 0.86;
  return (
    <svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} aria-hidden="true">
      <path
        d={`M${w} 0 L${w} ${size} L0 ${size / 2} Z`}
        fill={solid ? color : 'none'}
        stroke={color}
        strokeWidth={solid ? 0 : 1}
      />
    </svg>
  );
}

/** Chevron. Direction in degrees of rotation from "pointing right". */
export function Chevron({ size = 10, color = 'currentColor', dir = 'right', strokeWidth = 1 }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir] ?? 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M3.5 1 L7 5 L3.5 9" fill="none" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** The computing log's leading mark: a rule that becomes a tick. */
export function TickMark({ state = 'pending', size = 12 }) {
  const color =
    state === 'done' ? 'var(--color-ink)'
    : state === 'cache' ? 'var(--color-madder)'
    : 'var(--color-graphite)';
  if (state === 'pending' || state === 'active') {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
        <path d="M1 6 H11" stroke={color} strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M1.5 6.5 L4.5 9.5 L10.5 2.5" fill="none" stroke={color} strokeWidth="1.25" />
    </svg>
  );
}

/** The active-line caret in the computing log. */
export function Caret({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <rect x="4" y="2" width="4" height="8" fill="var(--color-ink)" />
    </svg>
  );
}

export function PlusMinus({ sign = 1, size = 10, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1 5 H9" stroke={color} strokeWidth="1" />
      {sign > 0 && <path d="M5 1 V9" stroke={color} strokeWidth="1" />}
    </svg>
  );
}

/** Arrow, used inside the dimension line pointing inward. */
export function ArrowHead({ size = 7, color = 'var(--color-ink)', dir = 'right' }) {
  const rot = { right: 0, left: 180, up: 270, down: 90 }[dir] ?? 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      aria-hidden="true"
      style={{ transform: `rotate(${rot}deg)`, display: 'block' }}
    >
      <path d="M0 0.5 L6 3.5 L0 6.5 Z" fill={color} />
    </svg>
  );
}

/** A plain 1px horizontal rule as a mark, for inline use. */
export function RuleMark({ width = 16, color = 'var(--color-rule)' }) {
  return (
    <svg width={width} height="1" viewBox={`0 0 ${width} 1`} aria-hidden="true">
      <path d={`M0 0.5 H${width}`} stroke={color} strokeWidth="1" />
    </svg>
  );
}

/** The plumb bob (Part 3): a 1px line terminating in a solid
    teardrop weight. Drawn once, swung once, then still forever. */
export function PlumbBob({ height = 180, width = 34, animate = true, className = '' }) {
  const cx = width / 2;
  const lineLen = height - 26;
  const bobTop = lineLen;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      style={{
        overflow: 'visible',
        transformOrigin: `${cx}px 0px`,
        animation: animate ? 'pl-plumb-swing 1400ms cubic-bezier(0.33,0,0.25,1) 500ms both' : 'none',
      }}
    >
      {/* the line */}
      <path
        d={`M${cx} 0 V${bobTop}`}
        stroke="var(--color-ink)"
        strokeWidth="1"
        style={
          animate
            ? {
                strokeDasharray: lineLen,
                strokeDashoffset: lineLen,
                animation: 'pl-draw 400ms cubic-bezier(0.65,0,0.35,1) 100ms both',
                '--pl-len': lineLen,
              }
            : undefined
        }
      />
      {/* the weight: a teardrop — shoulders, then a point */}
      <path
        d={`M${cx} ${bobTop}
            C${cx - 6.5} ${bobTop + 3.5} ${cx - 7} ${bobTop + 11} ${cx} ${bobTop + 25}
            C${cx + 7} ${bobTop + 11} ${cx + 6.5} ${bobTop + 3.5} ${cx} ${bobTop} Z`}
        fill="var(--color-ink)"
        style={
          animate
            ? { animation: 'pl-fade-in 200ms linear 420ms both' }
            : undefined
        }
      />
    </svg>
  );
}
