'use client';

/* THE LANDING PAGE.
   ────────────────────────────────────────────────────────────────
   A different surface from the app, and deliberately so.

   Inside the product, stillness is correct: it is an instrument, and
   an instrument that fidgets while you read it is broken. A landing
   page has the opposite job — nobody has used the thing yet, so the
   only way to show what it does is to do it.

   So this page moves, but every moving thing is drawn from the
   product's own vocabulary:

     · the plumb line, which runs the whole page as a 1px spine with
       the bob riding down it as you scroll
     · the fan, opening as you reach it
     · the dimension line, measuring a gap
     · hairlines, ticks, and numerals counting up

   Nothing is imported. No gradient, no blob, no glow, no parallax
   for its own sake, no card lifting on hover. Every animation is
   transform or opacity only, so the compositor does the work and the
   main thread stays free — that is what "smooth" actually means.

   ONE DEVIATION, STATED: the app's motion rule is "nothing animates
   on scroll except the methodology page's one-time reveals". This
   page animates on scroll throughout. A landing page where scrolling
   drives a demonstration is not the ambient fidgeting that rule
   exists to prevent, but it is a departure and it is deliberate. */

import { useEffect, useRef, useState, useMemo } from 'react';

/* ── scroll progress, rAF-coalesced ──
   One listener for the whole page. Reading scrollY inside the
   listener forces layout on every event; reading it once per frame
   costs nothing and is the difference between smooth and not. */
function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let ticking = false;
    const on = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
        ticking = false;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, []);
  return p;
}

/** Reveal once, then disconnect. Never repeats on scroll back. */
function useReveal(threshold = 0.25) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, threshold]);
  return [ref, shown];
}

/** Once `on` is true, tween 0 → 1 over `ms` on the compositor clock.
    Pure rAF, no library, cancels on unmount. */
function useTween(on, ms) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t) => {
      const x = Math.min(1, (t - t0) / ms);
      // easeOutCubic — fast to start, settles rather than stops
      setV(1 - Math.pow(1 - x, 3));
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, ms]);
  return v;
}

/** How far a section has travelled through the viewport, 0..1. */
function useSectionProgress() {
  const ref = useRef(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ticking = false;
    const on = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 when the top reaches the bottom of the screen, 1 when the
        // bottom passes the top.
        const raw = (vh - r.top) / (vh + r.height);
        setP(Math.min(1, Math.max(0, raw)));
        ticking = false;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, []);
  return [ref, p];
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

/* ── deterministic paths, for illustration only ──
   This fan carries no ticker and makes no claim about any stock. It
   is a drawing of what a Monte Carlo IS, the same justification the
   methodology page's teaching diagram uses. Every STATISTIC quoted on
   this page is real and comes from the committed backtest files. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useFanPaths(count = 300, steps = 60) {
  return useMemo(() => {
    const rng = mulberry32(20260822);
    let spare = null;
    const normal = () => {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0, v = 0, s = 0;
      do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
      const f = Math.sqrt((-2 * Math.log(s)) / s);
      spare = v * f;
      return u * f;
    };
    const sigma = 0.075;
    const rows = [];
    for (let i = 0; i < count; i++) {
      const row = [1];
      let v = 1;
      for (let t = 1; t < steps; t++) {
        v *= Math.exp(-0.5 * sigma * sigma + sigma * normal());
        row.push(v);
      }
      rows.push(row);
    }
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) for (const v of r) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const median = [];
    for (let t = 0; t < steps; t++) {
      const col = rows.map((r) => r[t]).sort((a, b) => a - b);
      median.push(col[Math.floor(col.length / 2)]);
    }
    return { rows, lo, hi, median, steps };
  }, [count, steps]);
}

/* ══════════════════════════════════════════════════════════════ */

export default function Landing({ stats }) {
  const scroll = useScrollProgress();
  const reduced = useReducedMotion();

  return (
    <div className="lp">
      <LandingHeader />
      {/* ── THE SPINE ──
          One 1px line down the whole page, with the bob riding it.
          It is the plumb line: the thing that shows you what is
          actually vertical, running the length of the argument. */}
      <div className="lp-spine" aria-hidden="true">
        <div className="lp-spine-line" />
        <div
          className="lp-spine-bob"
          style={{ top: `${(reduced ? 1 : scroll) * 100}%` }}
        >
          <svg width="18" height="26" viewBox="0 0 18 26">
            <path d="M9 0 V13" stroke="var(--color-ink)" strokeWidth="1" />
            <path
              d="M9 13 C4.6 15 4.3 19 9 26 C13.7 19 13.4 15 9 13 Z"
              fill="var(--color-ink)"
            />
          </svg>
        </div>
      </div>

      <Hero reduced={reduced} />
      <Problem reduced={reduced} />
      <FanSection reduced={reduced} />
      <Evidence stats={stats} reduced={reduced} />
      <Receipt reduced={reduced} />
      <Close stats={stats} />
    </div>
  );
}

/* ── THE HEADER ───────────────────────────────────────────────────
   The one part of this page that is not static.

   The page itself is prerendered at build time, which is why it
   paints instantly, and reading a session cookie on the server would
   have made the whole thing dynamic to personalise one corner. So
   the corner asks after hydration instead and the other 99% of the
   page stays static.

   Nothing renders until the answer arrives. A "Sign in" link that
   flips to a name a moment later tells a returning visitor they were
   logged out, which is both wrong and alarming. */
function LandingHeader() {
  const [me, setMe] = useState(null); // null = unknown, false = signed out

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json())
      .then((res) => { if (!cancelled) setMe(res?.user ?? false); })
      .catch(() => { if (!cancelled) setMe(false); });
    return () => { cancelled = true; };
  }, []);

  if (me === null) return null;

  return (
    <div className="lp-header">
      {me ? (
        <a className="lp-header-link" href="/app">
          Continue as {me.name || me.email}
        </a>
      ) : (
        <>
          <a className="lp-header-link" href="/login?next=%2Fapp">
            Log in
          </a>
          <a className="lp-header-cta" href="/login?mode=signup&next=%2Fapp">
            Sign up
          </a>
        </>
      )}
    </div>
  );
}

/* ── 1 · HERO ─────────────────────────────────────────────────── */

function Hero({ reduced }) {
  return (
    <section className="lp-hero">
      <div className="lp-inner">
        <div className="lp-bob-wrap" aria-hidden="true">
          <svg
            width="34"
            height="190"
            viewBox="0 0 34 190"
            className={reduced ? '' : 'lp-bob'}
            style={{ overflow: 'visible' }}
          >
            <path
              d="M17 0 V164"
              stroke="var(--color-ink)"
              strokeWidth="1"
              className={reduced ? '' : 'lp-bob-line'}
            />
            <path
              d="M17 164 C10 168 9.4 176 17 190 C24.6 176 24 168 17 164 Z"
              fill="var(--color-ink)"
              className={reduced ? '' : 'lp-bob-weight'}
            />
          </svg>
        </div>

        <h1 className="lp-h1">
          <span className="lp-line" style={{ '--d': '600ms' }}>
            You think you know
          </span>
          <span className="lp-line" style={{ '--d': '760ms' }}>
            what this stock will do.
          </span>
        </h1>

        <p className="lp-sub lp-line" style={{ '--d': '980ms' }}>
          A plumb line shows you what is actually vertical, after the wobble stops.
          This measures the distance between what you believe about a stock and what
          the numbers support — then writes both down, so a year from now you can see
          who was right.
        </p>

        <div className="lp-cta-row lp-line" style={{ '--d': '1160ms' }}>
          <a href="/app" className="lp-cta">
            Measure a stock
          </a>
          <a href="/app#/record" className="lp-cta-quiet">
            See the track record
          </a>
        </div>

        <p className="lp-scroll-hint lp-line" style={{ '--d': '1400ms' }} aria-hidden="true">
          scroll
        </p>
      </div>
    </section>
  );
}

/* ── 2 · THE PROBLEM ──────────────────────────────────────────── */

/* The two numbers on the rail, named once. The dimension line, the
   marker positions and the labels are all derived from these, so
   there is no way for the drawing to say one thing and the text
   another. Illustrative values — the app computes the real pair. */
const YOU_ODDS = 72;
const DATA_ODDS = 62;

function Problem({ reduced }) {
  /* SCROLL-DRIVEN WAS WRONG HERE, and the screenshots showed why.
     Tying the slider to scroll position means a reader who stops to
     look at the rail — which is exactly what you want them to do —
     freezes it half-drawn, with the label reading a number the copy
     beneath it then contradicts. And gating the payoff on a
     threshold like "progress > 0.52" put the gap just below the
     trigger at the very position where the rail sits centred.

     So the demo runs on its own clock the moment the rail is in
     view: the slider sweeps to where you'd put it, and a beat later
     the data marker and the gap arrive. Stopping to read it is
     rewarded rather than punished, and it plays identically at any
     scroll speed. */
  const [railRef, live] = useReveal(0.6);
  const sweep = useTween(live && !reduced, 1100);
  const fill = reduced ? 1 : sweep;
  const you = Math.round(YOU_ODDS * fill);

  const [seen, shown] = useReveal(0.3);
  const showModel = reduced || fill > 0.995;

  return (
    <section className="lp-sec">
      <div className="lp-inner" ref={seen}>
        <p className={`eyebrow lp-fade ${shown ? 'in' : ''}`}>The problem</p>
        <h2 className={`lp-h2 lp-fade ${shown ? 'in' : ''}`} style={{ '--d': '80ms' }}>
          Confidence is easy to feel and impossible to check.
        </h2>

        <div className="lp-rail-demo" ref={railRef} aria-hidden="true">
          <div className="lp-rail">
            <div className="lp-rail-track" />
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <span key={t} className="lp-tick" style={{ left: `${t}%` }}>
                <i />
                <b className="font-data">{t}</b>
              </span>
            ))}

            <span className="lp-marker lp-marker-you" style={{ left: `${you}%` }}>
              <b className="font-data">you {you}</b>
              <svg width="13" height="11" viewBox="0 0 13 11">
                <path d="M0 0 L13 0 L6.5 11 Z" fill="var(--color-ink)" />
              </svg>
            </span>

            <span
              className={`lp-marker lp-marker-data ${showModel ? 'in' : ''}`}
              style={{ left: `${DATA_ODDS}%` }}
            >
              <svg width="13" height="11" viewBox="0 0 13 11">
                <path
                  d="M0 11 L13 11 L6.5 0 Z"
                  fill="none"
                  stroke="var(--color-verdigris)"
                  strokeWidth="1"
                />
              </svg>
              <b className="font-data" style={{ color: 'var(--color-verdigris)' }}>
                the data {DATA_ODDS}
              </b>
            </span>

            <span
              className={`lp-dim ${showModel ? 'in' : ''}`}
              style={{ left: `${DATA_ODDS}%`, width: `${Math.max(0, you - DATA_ODDS)}%` }}
            >
              <i />
            </span>
          </div>
        </div>

        <p className={`lp-body lp-fade ${showModel ? 'in' : ''}`}>
          Both numbers are the odds of the same thing: ending a year from now with more
          money than you put in. One of them you felt. The other is a count of ten
          thousand simulated futures.
        </p>
      </div>
    </section>
  );
}

/* ── 3 · THE FAN ──────────────────────────────────────────────── */

function FanSection({ reduced }) {
  const [ref, p] = useSectionProgress();
  const fan = useFanPaths();
  const W = 1000;
  const H = 340;

  // The bundle opens left→right as the section crosses the screen.
  const t = reduced ? 1 : Math.min(1, Math.max(0, (p - 0.12) * 1.9));

  /* Mapped in LOG space, and symmetrically. Two reasons, and both
     are the same reason the app plots returns this way:

       · a lognormal's upside tail is longer than its downside, so
         raw min/max bounds shove the whole cone below centre and the
         drawing lies about where the middle is
       · a halving and a doubling are the same size of surprise, and
         only a log axis draws them that way

     So the widest excursion in either direction sets the scale and
     the starting value sits exactly on the centre line. */
  const span = Math.max(Math.abs(Math.log(fan.hi)), Math.abs(Math.log(fan.lo)));
  const scaleY = (v) => H / 2 - (Math.log(v) / span) * (H / 2) * 0.92;
  const x = (i) => (i / (fan.steps - 1)) * W;

  const d = (row) => {
    let s = '';
    for (let i = 0; i < fan.steps; i++) {
      s += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${scaleY(row[i]).toFixed(1)}`;
    }
    return s;
  };

  return (
    <section className="lp-sec lp-sec-wide" ref={ref}>
      <div className="lp-inner">
        <p className="eyebrow">What it shows you</p>
        <h2 className="lp-h2">Ten thousand futures, drawn as ink.</h2>
      </div>

      <div className="lp-fan" aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="lp-fan-svg">
          <defs>
            <clipPath id="lp-fan-clip">
              <rect x="0" y="0" height={H} width={W * t} />
            </clipPath>
          </defs>
          <g clipPath="url(#lp-fan-clip)">
            {fan.rows.map((row, i) => (
              <path
                key={i}
                d={d(row)}
                fill="none"
                stroke="var(--color-madder)"
                strokeWidth="1"
                opacity="0.05"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path
              d={d(fan.median)}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>
      </div>

      <div className="lp-inner">
        <p className="lp-body">
          Not one confident line. Where the ink is dark, many futures landed there.
          Where it is pale, few did. The honest answer to <em>what will this do</em> is
          the whole shape — and the width of it is the one thing we can prove we get
          right.
        </p>
      </div>
    </section>
  );
}

/* ── 4 · THE EVIDENCE ─────────────────────────────────────────── */

function CountUp({ to, suffix = '', decimals = 0, run }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const k = Math.min(1, (ts - start) / 900);
      // ease-out, so it decelerates into the true value
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, run]);
  return (
    <span className="font-data">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function Evidence({ stats, reduced }) {
  const [ref, shown] = useReveal(0.2);
  const run = shown || reduced;

  return (
    <section className="lp-sec" ref={ref}>
      <div className="lp-inner">
        <p className={`eyebrow lp-fade ${run ? 'in' : ''}`}>The part nobody else does</p>
        <h2 className={`lp-h2 lp-fade ${run ? 'in' : ''}`} style={{ '--d': '80ms' }}>
          We tested ourselves and published what failed.
        </h2>

        <div className="lp-cards">
          <div className={`lp-card lp-pass lp-fade ${run ? 'in' : ''}`} style={{ '--d': '160ms' }}>
            <p className="eyebrow">The test it passes</p>
            <p className="lp-stat">
              <CountUp to={stats.bandHitPct} suffix="%" run={run} />
            </p>
            <p className="lp-card-body">
              of {stats.bandN} point-in-time forecasts landed inside the predicted 80%
              band, across {stats.bandWindows} separate windows. The range is honestly
              sized.
            </p>
          </div>

          <div className={`lp-card lp-fail lp-fade ${run ? 'in' : ''}`} style={{ '--d': '280ms' }}>
            <p className="eyebrow">The test it fails</p>
            <p className="lp-stat">
              <CountUp to={stats.directionSkillPct} decimals={1} suffix="%" run={run} />
            </p>
            <p className="lp-card-body">
              skill at predicting direction over {stats.directionN} forecasts — worse than
              guessing the base rate. It cannot tell you which way a stock goes.
            </p>
          </div>

          <div className={`lp-card lp-fail lp-fade ${run ? 'in' : ''}`} style={{ '--d': '400ms' }}>
            <p className="eyebrow">And we did try</p>
            <p className="lp-stat">
              <CountUp to={stats.factorsTested} run={run} /> <span className="lp-stat-sm">more</span>
            </p>
            <p className="lp-card-body">
              documented factors — momentum, low volatility, reversal, 52-week distance,
              trend — fitted on {stats.factorTrainN} observations and graded on{' '}
              {stats.factorTestN} held out. None beat the base rate either.
            </p>
          </div>
        </div>

        <p className={`lp-body lp-fade ${run ? 'in' : ''}`} style={{ '--d': '520ms' }}>
          Six attempts, zero signals. That is why this tool refuses to forecast direction
          — not as an apology, but as a result. Every number above is reproducible from
          the committed data in the repository.
        </p>
      </div>
    </section>
  );
}

/* ── 5 · THE RECEIPT ──────────────────────────────────────────── */

/* The SAME pair the rail demonstrated a section ago — this is the
   receipt for that measurement, not a second unrelated example, and
   reading the constants is what keeps that true. */
function Receipt({ reduced }) {
  const [ref, shown] = useReveal(0.3);
  const on = shown || reduced;

  return (
    <section className="lp-sec" ref={ref}>
      <div className="lp-inner">
        <p className={`eyebrow lp-fade ${on ? 'in' : ''}`}>What changes behaviour</p>
        <h2 className={`lp-h2 lp-fade ${on ? 'in' : ''}`} style={{ '--d': '80ms' }}>
          It writes down what you believed, before you knew.
        </h2>

        <div className={`lp-receipt ${on ? 'in' : ''}`} aria-hidden="true">
          <div className="lp-receipt-rule" />
          <div className="lp-receipt-row" style={{ '--i': 0 }}>
            <span className="font-data">RELIANCE</span>
            <span className="font-data">₹50,000</span>
          </div>
          <div className="lp-receipt-row" style={{ '--i': 1 }}>
            <span>you said</span>
            <span className="font-data">{YOU_ODDS} in 100</span>
          </div>
          <div className="lp-receipt-row" style={{ '--i': 2 }}>
            <span>the simulation said</span>
            <span className="font-data">{DATA_ODDS} in 100</span>
          </div>
          <div className="lp-receipt-row" style={{ '--i': 3 }}>
            <span>price that day</span>
            <span className="font-data">₹1,316.00</span>
          </div>
          <div className="lp-receipt-rule" />
          <div className="lp-receipt-row lp-receipt-seal" style={{ '--i': 4 }}>
            <span className="font-data">sealed · opens in 12 months</span>
          </div>
        </div>

        <p className={`lp-body lp-fade ${on ? 'in' : ''}`} style={{ '--d': '600ms' }}>
          Neither number can be edited afterwards, because both were saved before the
          outcome existed. A year later the price decides, and you are scored the same
          way the model scores itself. If you beat it, it says so.
        </p>
      </div>
    </section>
  );
}

/* ── 6 · CLOSE ────────────────────────────────────────────────── */

function Close({ stats }) {
  const [ref, shown] = useReveal(0.3);
  return (
    <section className="lp-sec lp-close" ref={ref}>
      <div className="lp-inner">
        <h2 className={`lp-h2 lp-big lp-fade ${shown ? 'in' : ''}`}>
          Measure one you already own.
        </h2>
        <p className={`lp-body lp-fade ${shown ? 'in' : ''}`} style={{ '--d': '120ms' }}>
          {stats.symbols.toLocaleString('en-IN')} NSE equities. Sector medians from{' '}
          {stats.constituents} NIFTY 500 constituents. No account, no email.
        </p>
        <div className={`lp-cta-row lp-fade ${shown ? 'in' : ''}`} style={{ '--d': '240ms' }}>
          <a href="/app" className="lp-cta">
            Measure a stock
          </a>
          <a href="/app#/method" className="lp-cta-quiet">
            How it works
          </a>
        </div>
        <p className="lp-legal font-data">
          Educational tool. Not registered investment advice. It does not recommend
          trades.
        </p>
      </div>
    </section>
  );
}
