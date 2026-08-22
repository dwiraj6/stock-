/* ಶಿಷ್ಯ — THE MASCOT.
   ────────────────────────────────────────────────────────────────
   Shishya means STUDENT. Not guru, not oracle, not advisor — the one
   who is still learning. For a product whose whole ethic is publishing
   what it cannot do (a -3.4% skill score on direction, in the same
   size type as the 87% it gets right), a companion named "student" is
   the only honest character it could have. A guru would be a lie the
   rest of the app spends its time refusing to tell.

   THE FIGURE IS THE PLUMB BOB, GIVEN A FACE. That is deliberate and
   not a shortcut: the plumb bob is already this product's signature
   object — the thing that shows you what is actually vertical, after
   the wobble stops — and it is already shaped like a small hooded
   figure. Widest at the shoulders, tapering to a point, hanging from
   a line. Add eyes and it is a character; nothing new has to be
   invented, and the mascot cannot drift away from the brand because
   it IS the brand mark.

   The hanging cord becomes a śikhā, the tuft of hair a student
   traditionally wears. The cord was already there. It just means
   something now.

   DRAWN IN THE PRODUCT'S OWN INK. No gradients, no 3D, no glow, no
   outline stroke in a colour that appears nowhere else. Solid ink
   body, eyes knocked out in paper, one hairline for the cord — the
   same two weights every other mark on the page is made of. It sits
   next to a Monte Carlo chart without looking like it wandered in
   from a different app.

   EXPRESSIONS, because a mascot with one face is a logo:

     idle      calm, watching
     thinking  eyes up and away, while an answer is being written
     speaking  eyes open, mouth open
     pleased   eyes as arcs — used once, when an answer lands
     curious   head-tilt via the eyes, when it has noticed something

   What it never does is loop. No idle bobbing, no attention-seeking
   pulse. The app's motion rule — one moment, then stillness — applies
   to the mascot most of all, because a fidgeting character beside a
   chart of someone's money is exactly the wrong tone. */

/**
 * @param {object} p
 * @param {number} [p.size]   height in px; width follows the ratio
 * @param {'idle'|'thinking'|'speaking'|'pleased'|'curious'} [p.state]
 * @param {boolean} [p.cord]  draw the hanging cord above the head
 * @param {string} [p.title]  accessible name; omit for decoration
 */
export default function Shishya({
  size = 44,
  state = 'idle',
  cord = true,
  title,
  className = '',
  style,
}) {
  const W = 48;
  const H = 72;

  /* Where the pupils sit. The eyes are the whole performance — the
     body never changes shape, so every expression is two small
     translations and one mouth. */
  const look = {
    idle: { x: 0, y: 0 },
    thinking: { x: 2.2, y: -1.9 },
    speaking: { x: 0, y: 0.3 },
    pleased: { x: 0, y: 0 },
    curious: { x: -1.8, y: -0.8 },
  }[state] ?? { x: 0, y: 0 };

  /* Proportions were widened after looking at it: the first pass was
     22 units across against 50 tall, which read as a plumb bob that
     happened to have eyes rather than as a character. Broader
     shoulders and larger eyes give it presence at 26px in a toolbar,
     which is the size it is actually seen at most of the time. */
  const eyeY = 33;
  const leftX = 17.6;
  const rightX = 30.4;

  return (
    <svg
      width={(size * W) / H}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ overflow: 'visible', display: 'block', ...style }}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      {/* ── the cord, which is also the śikhā ── */}
      {cord && (
        <path
          d={`M24 0 V13`}
          stroke="var(--color-ink)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* ── the body: a plumb bob, point down ──
          Widest at the shoulders, tapering to the tip that does the
          actual measuring. */}
      <path
        d={`M24 11
            C14.5 15.5 9.5 23 9.5 32
            C9.5 43 15.5 53.5 24 64
            C32.5 53.5 38.5 43 38.5 32
            C38.5 23 33.5 15.5 24 11 Z`}
        fill="var(--color-ink)"
      />

      {/* ── eyes, knocked out of the ink ── */}
      {state === 'pleased' ? (
        /* Two arcs. The only state where the eyes are strokes rather
           than shapes, because a closed happy eye is a line. */
        <>
          <path
            d={`M${leftX - 4.2} ${eyeY + 1.2} q4.2 -4.8 8.4 0`}
            stroke="var(--color-paper)"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${rightX - 4.2} ${eyeY + 1.2} q4.2 -4.8 8.4 0`}
            stroke="var(--color-paper)"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <ellipse cx={leftX} cy={eyeY} rx="4.4" ry="4.8" fill="var(--color-paper)" />
          <ellipse cx={rightX} cy={eyeY} rx="4.4" ry="4.8" fill="var(--color-paper)" />
          <circle cx={leftX + look.x} cy={eyeY + look.y} r="2.15" fill="var(--color-ink)" />
          <circle cx={rightX + look.x} cy={eyeY + look.y} r="2.15" fill="var(--color-ink)" />
        </>
      )}

      {/* ── mouth, only when there is something to say ── */}
      {state === 'speaking' && (
        <ellipse cx="24" cy="44" rx="3" ry="3.5" fill="var(--color-paper)" />
      )}
      {state === 'pleased' && (
        <path
          d="M20.5 43 q3.5 3.4 7 0"
          stroke="var(--color-paper)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* ── the thinking dots ──
          Placed outside the head so they never crowd the face, and
          only ever three. */}
      {state === 'thinking' && (
        <g fill="var(--color-graphite)">
          <circle cx="39" cy="20" r="1.6">
            <animate
              attributeName="opacity"
              values="0.25;1;0.25"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="44" cy="16" r="2.1">
            <animate
              attributeName="opacity"
              values="0.25;1;0.25"
              dur="1.2s"
              begin="0.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="50" cy="11" r="2.6">
            <animate
              attributeName="opacity"
              values="0.25;1;0.25"
              dur="1.2s"
              begin="0.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}
    </svg>
  );
}

/** The name, set so the Kannada always has a font that can draw it. */
export function Wordmark({ className = '', style }) {
  return (
    <span className={className} style={style}>
      stock<span className="knd">ಶಿಷ್ಯ</span>
    </span>
  );
}
