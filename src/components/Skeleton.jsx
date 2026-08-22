/* SKELETONS.
   ────────────────────────────────────────────────────────────────
   A placeholder that says "a number is coming here" instead of
   leaving a hole that the real content later shoves out of the way.
   The point is not decoration — it is that the page does not JUMP.
   A layout that reflows when data lands makes a reader lose their
   place, and on a page whose whole argument is precision, moving
   furniture reads as sloppiness.

   So every skeleton here is sized to what will replace it. A stat
   block reserves the height of a stat block; a row reserves the
   height of a row. If the replacement is a different size, the
   skeleton is wrong and should be fixed rather than tolerated.

   HOW IT MOVES, and why it matters here: the sweep is a pseudo
   element translated across the block. Not `background-position`,
   which repaints the whole element every frame, and not an opacity
   pulse on the block itself, which is fine but reads as "broken"
   rather than "loading". A translated overlay is compositor-only,
   which is the same rule every other animation in this product
   follows.

   Under prefers-reduced-motion it stops moving entirely and stays a
   flat block. It is still doing its job — holding the space — with
   no animation at all. */

/**
 * @param {object} p
 * @param {number|string} [p.w]  width, number = px, string = as given
 * @param {number} [p.h]         height in px
 * @param {string} [p.className]
 * @param {object} [p.style]
 */
export function Skeleton({ w = '100%', h = 14, className = '', style }) {
  return (
    <span
      className={`sk ${className}`}
      aria-hidden="true"
      style={{ width: typeof w === 'number' ? `${w}px` : w, height: h, ...style }}
    />
  );
}

/** Several lines of body text, the last one short like real prose. */
export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <span className="sk-lines" aria-hidden="true" style={{ maxWidth: width }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} h={13} w={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </span>
  );
}

/** An eyebrow, a big number, and a caption — the app's stat shape. */
export function SkeletonStat() {
  return (
    <span className="sk-stat" aria-hidden="true">
      <Skeleton w={72} h={10} />
      <Skeleton w={116} h={28} style={{ marginTop: 10 }} />
      <Skeleton w={148} h={11} style={{ marginTop: 10 }} />
    </span>
  );
}

/**
 * The wrapper that carries the accessible announcement.
 *
 * Screen readers get one polite "Loading…" for the whole region
 * rather than a stream of nothing from a dozen empty boxes — the
 * skeletons themselves are aria-hidden for exactly that reason.
 */
export function SkeletonBlock({ label = 'Loading', children, style }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={style}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
