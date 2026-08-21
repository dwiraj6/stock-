/* THE RAIL.
   ────────────────────────────────────────────────────────────────
   One component, four jobs: the conviction slider, the gap
   measurement, the computing progress bar, and the score bars. The
   brief calls the repetition "the system working" — so this is
   deliberately a primitive with no opinions about what is being
   measured, only about how a measured thing looks.

   Built from 1px divs rather than SVG on purpose. An SVG hairline
   inside a viewBox stops being 1px the moment its container
   resizes; a border-top does not. Every rule in this product is
   exactly one device pixel at every breakpoint. */

const pctOf = (v, min, max) => ((v - min) / (max - min)) * 100;

export default function Rail({
  min = 0,
  max = 100,
  tickEvery = 10,
  ticks = null,               // explicit tick values, overrides tickEvery
  numerals = false,           // print the tick values beneath
  fill = null,                // 0..1, draws an --ink bar over the track
  fillColor = 'var(--color-ink)',
  trackColor = 'var(--color-rule)',
  orientation = 'horizontal',
  invert = false,             // vertical only: put `max` at the top
  numeralSide = 'right',      // vertical only: which side the scale reads on
  tickLength = 5,
  className = '',
  style = {},
  children,                   // markers, positioned by the caller
  numeralFormat = (v) => String(v),
  'aria-hidden': ariaHidden,
}) {
  const vertical = orientation === 'vertical';
  const tickValues =
    ticks ??
    (() => {
      const out = [];
      for (let v = min; v <= max + 1e-9; v += tickEvery) out.push(Math.round(v * 1e6) / 1e6);
      return out;
    })();

  // On the vertical rail the scale runs upward — more conviction sits
  // higher, the way it does on the horizontal one where more sits
  // further right. Same reading, rotated.
  const posOf = (v) => (vertical && invert ? 100 - pctOf(v, min, max) : pctOf(v, min, max));

  if (vertical) {
    return (
      <div
        className={`relative ${className}`}
        style={{ width: '100%', ...style }}
        aria-hidden={ariaHidden}
      >
        {/* track — 1px vertical rule */}
        <div
          className="absolute top-0 bottom-0"
          style={{ left: '50%', width: 1, background: trackColor, transform: 'translateX(-0.5px)' }}
        />
        {/* fill — grows from the top */}
        {fill !== null && (
          <div
            className={invert ? 'absolute bottom-0' : 'absolute top-0'}
            style={{
              left: '50%',
              width: 1,
              height: `${Math.max(0, Math.min(1, fill)) * 100}%`,
              background: fillColor,
              transform: 'translateX(-0.5px)',
            }}
          />
        )}
        {/* ticks */}
        {tickValues.map((v) => (
          <div key={v} className="absolute" style={{ top: `${posOf(v)}%`, left: '50%' }}>
            <div
              style={{
                position: 'absolute',
                left: -tickLength,
                width: tickLength * 2,
                height: 1,
                background: trackColor,
              }}
            />
            {numerals && (
              <span
                className="font-data absolute"
                style={{
                  ...(numeralSide === 'left'
                    ? { right: tickLength + 8, textAlign: 'right' }
                    : { left: tickLength + 8 }),
                  top: -8,
                  fontSize: '0.75rem',
                  color: 'var(--color-graphite)',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {numeralFormat(v)}
              </span>
            )}
          </div>
        ))}
        {children}
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ width: '100%', ...style }}
      aria-hidden={ariaHidden}
    >
      {/* track — 1px horizontal rule */}
      <div
        className="absolute left-0 right-0"
        style={{ top: 0, height: 1, background: trackColor }}
      />
      {/* fill — grows from the left */}
      {fill !== null && (
        <div
          className="absolute left-0"
          style={{
            top: 0,
            height: 1,
            width: `${Math.max(0, Math.min(1, fill)) * 100}%`,
            background: fillColor,
            transition: 'width var(--dur-quick) linear',
          }}
        />
      )}
      {/* ticks */}
      {tickValues.map((v) => (
        <div
          key={v}
          className="absolute"
          style={{ left: `${pctOf(v, min, max)}%`, top: 0 }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              width: 1,
              height: tickLength,
              background: trackColor,
              transform: 'translateX(-0.5px)',
            }}
          />
          {numerals && (
            <span
              className="font-data absolute"
              style={{
                top: tickLength + 5,
                left: 0,
                transform: 'translateX(-50%)',
                fontSize: '0.75rem',
                color: 'var(--color-graphite)',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {numeralFormat(v)}
            </span>
          )}
        </div>
      ))}
      {children}
    </div>
  );
}

/* ── Score bar (Module 4) ──────────────────────────────────────
   The same rail, filled to the achieved portion in --ink with the
   remainder in --paper-deep. Never coloured by good/bad: the
   number and the sentence carry that. */
export function ScoreRail({ score, outOf = 10, delay = 0, animate = true }) {
  return (
    <div className="relative" style={{ height: 3 }} aria-hidden="true">
      <div className="absolute inset-0" style={{ background: 'var(--color-paper-deep)' }} />
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: `${(score / outOf) * 100}%`,
          background: 'var(--color-ink)',
          transformOrigin: 'left center',
          animation: animate
            ? `pl-scale-x 400ms var(--ease-out) ${delay}ms both`
            : 'none',
        }}
      />
    </div>
  );
}

/* ── Progress rail (Screen 2) ──────────────────────────────────
   The same rail component as the conviction slider, filling in
   --ink left to right. */
export function ProgressRail({ value }) {
  return (
    <Rail
      min={0}
      max={1}
      ticks={[]}
      fill={value}
      style={{ height: 1 }}
      aria-hidden="true"
    />
  );
}
