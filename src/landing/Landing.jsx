'use client';

/* THE LANDING PAGE.
   ────────────────────────────────────────────────────────────────
   MOTION IS AUTHORED WITH GSAP, AND THE DIRECTION MATTERS.

   Every tween is a `from`. The element's natural state — the one in
   the stylesheet, the one the server renders — is its FINAL state:
   visible, in place, readable. GSAP animates *from* a hidden state
   toward that.

   That is not a stylistic preference, it is the fix for a real bug.
   The previous build held content at opacity 0 until an
   IntersectionObserver fired, so anything that never scrolled — a
   screenshot tool, a crawler, a background tab, a browser where the
   observer was slow — was served a blank page. With `from` tweens
   that cannot happen: if GSAP fails to load, if scripting is off, if
   ScrollTrigger never fires, the page is simply already correct.

   WHAT MOVES, AND WHY EACH ONE EARNS IT:

     the spine bob   rides the plumb line as you scroll — the
                     product's own instrument used as a progress
                     indicator that means something
     the hero        one orchestrated entrance: rule, eyebrow,
                     headline lines, prose, buttons
     the rail        SCRUBBED. You drag the gap open yourself: the
                     marker slides to where you would have put it,
                     the data marker arrives, the dimension line
                     draws between them
     the fan         SCRUBBED. Ten thousand paths draw left to right
                     as you move through the section
     the numerals    count up on entry — the one place a number
                     arriving beats a number being there
     the receipt     rows print in sequence, like a receipt printing

   Nothing loops. Nothing idles. Every animation resolves to
   stillness, which is the app's own rule and matters most on a page
   about someone's money. */

import { useEffect, useMemo, useRef, useState } from 'react';
import Shishya from '../components/Shishya.jsx';

/* ── reduced motion ───────────────────────────────────────────── */
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

/* ── scroll progress, for the bob on the spine ──
   One listener, read once per frame inside a rAF. Reading scrollY in
   the listener itself forces layout on every event; coalescing to a
   frame costs nothing and is the difference between smooth and not. */
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

/* ── deterministic paths, for illustration only ──
   This fan carries no ticker and makes no claim about any stock. It
   is a drawing of what a Monte Carlo IS. Every STATISTIC quoted on
   this page is real and read from the committed backtest files. */
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

/* The two numbers on the rail, named once. The marker positions, the
   dimension line and the receipt all derive from these, so the
   drawing cannot say one thing while the text says another.
   Illustrative values — the app computes the real pair. */
const YOU_ODDS = 72;
const DATA_ODDS = 62;

/* ══════════════════════════════════════════════════════════════ */

export default function Landing({ stats }) {
  const scroll = useScrollProgress();
  const reduced = useReducedMotion();
  const root = useRef(null);

  /* ── every timeline on the page, in one place ──
     GSAP is imported dynamically so it never enters the bundle for
     someone browsing with reduced motion, and `gsap.context` scopes
     every selector to this subtree and reverts the lot on unmount. */
  useEffect(() => {
    if (reduced || !root.current) return;
    let ctx;
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context((self) => {
        const q = self.selector;

        /* ── the hero: one orchestrated entrance ── */
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from(q('[data-a="eyebrow"]'), { y: 10, opacity: 0, duration: 0.6 }, 0.15)
          .from(q('[data-a="line"]'), { y: 26, opacity: 0, duration: 0.85, stagger: 0.09 }, 0.25)
          .from(q('[data-a="sub"]'), { y: 16, opacity: 0, duration: 0.7 }, 0.55)
          .from(q('[data-a="cta"]'), { y: 14, opacity: 0, duration: 0.6 }, 0.68)
          .from(q('[data-a="hint"]'), { opacity: 0, duration: 0.5 }, 0.85)
          .from(q('[data-a="hint"] i'), { scaleX: 0, duration: 0.7 }, 0.85);

        /* ── section entrances ──
           One reveal per element rather than one per section, so a
           heading arrives before the paragraph that explains it.

           TWO GUARDS, AND BOTH ARE LOAD-BEARING.

           `immediateRender: false` is the one that matters. A plain
           `gsap.from` with a ScrollTrigger applies its from-state
           the moment it is created — which puts every element below
           the fold at opacity 0 and waits. That is the blank-page
           bug again in a new costume: measured at 18 invisible
           elements on a page nobody had scrolled. With it off, the
           element keeps its natural rendered state until its trigger
           actually fires.

           And anything already on screen at setup is skipped
           outright. Its trigger would fire in the same frame it was
           created, so the reveal would be a flash rather than an
           entrance — the hero runs its own timeline for that
           region. */
        q('[data-a="rise"]').forEach((el) => {
          if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
          gsap.from(el, {
            y: 22,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
            immediateRender: false,
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        });

        /* ── the rail: you drag the gap open ──
           Scrubbed, so the reader controls it. The marker slides to
           where they would have put it, the data marker arrives, and
           the dimension line draws between the two. */
        const rail = q('[data-a="rail"]')[0];
        if (rail) {
          gsap
            .timeline({
              scrollTrigger: { trigger: rail, start: 'top 80%', end: 'top 38%', scrub: 0.6 },
            })
            .from(q('[data-a="you"]'), { left: '0%', ease: 'none', duration: 1 }, 0)
            .from(q('[data-a="data-marker"]'), { opacity: 0, y: 8, duration: 0.3 }, 0.74)
            .from(q('[data-a="dim"]'), { opacity: 0, duration: 0.26 }, 0.86);
        }

        /* ── the fan: ten thousand paths, drawn as you pass ── */
        const fan = q('[data-a="fan"]')[0];
        if (fan) {
          gsap.from(q('[data-a="fan-clip"]'), {
            attr: { width: 0 },
            ease: 'none',
            scrollTrigger: { trigger: fan, start: 'top 90%', end: 'bottom 58%', scrub: 0.5 },
          });
        }

        /* ── the name: the pivot arrives with weight ── */
        const mark = q('[data-a="mark"]')[0];
        if (mark) {
          gsap.from(mark, {
            y: 44,
            opacity: 0,
            duration: 1,
            ease: 'power4.out',
            immediateRender: false,
            scrollTrigger: { trigger: mark, start: 'top 86%', once: true },
          });
        }

        /* ── the receipt prints ── */
        const receipt = q('[data-a="receipt"]')[0];
        if (receipt) {
          gsap.from(q('[data-a="receipt-row"]'), {
            opacity: 0,
            y: 8,
            duration: 0.4,
            stagger: 0.1,
            ease: 'power2.out',
            immediateRender: false,
            scrollTrigger: { trigger: receipt, start: 'top 82%', once: true },
          });
        }
      }, root);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduced]);

  return (
    <div className="lp" ref={root}>
      <a className="lp-wordmark" href="/">
        <Shishya size={26} cord={false} />
        <span>stock<span className="knd">ಶಿಷ್ಯ</span></span>
      </a>
      <LandingHeader />

      {/* ── THE SPINE ──
          One plumb line down the whole page with the bob riding it.
          The instrument the product is named for, used as the page's
          margin rule and its progress indicator at once. */}
      <div className="lp-spine" aria-hidden="true">
        <div className="lp-spine-line" />
        <div className="lp-spine-bob" style={{ top: `${(reduced ? 1 : scroll) * 100}%` }}>
          <Shishya size={26} cord={false} />
        </div>
      </div>

      <Hero reduced={reduced} />
      <Problem />
      <FanSection />
      <Evidence stats={stats} reduced={reduced} />
      <TheName />
      <Receipt />
      <Close stats={stats} />
    </div>
  );
}

/* ── the header ──────────────────────────────────────────────────
   The page is prerendered as static, which is why it paints
   instantly. Reading a session cookie on the server would make the
   whole thing dynamic to personalise one corner, so this corner asks
   after hydration instead. A skeleton holds the width meanwhile: a
   "Log in" link that flips to a name a moment later tells a
   returning visitor they were signed out. */
function LandingHeader() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json())
      .then((res) => { if (!cancelled) setMe(res?.user ?? false); })
      .catch(() => { if (!cancelled) setMe(false); });
    return () => { cancelled = true; };
  }, []);

  if (me === null) {
    return (
      <div className="lp-header" aria-hidden="true">
        <span className="sk" style={{ width: 52, height: 11 }} />
        <span className="sk" style={{ width: 86, height: 30, borderRadius: 3 }} />
      </div>
    );
  }

  return (
    <div className="lp-header">
      {me ? (
        <a className="lp-header-link" href="/app">
          Continue as {me.name || me.email}
        </a>
      ) : (
        <>
          <a className="lp-header-link" href="/login?next=%2Fapp">Log in</a>
          <a className="lp-header-cta" href="/login?mode=signup&next=%2Fapp">Sign up</a>
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
            {/* The bob, with a face. The same object the product is
                built around; giving it eyes turns the mark into the
                character without inventing a second visual language. */}
            <g className={reduced ? '' : 'lp-bob-weight'}>
              <path
                d="M17 164 C10 168 9.4 176 17 190 C24.6 176 24 168 17 164 Z"
                fill="var(--color-ink)"
              />
              <ellipse cx="14.1" cy="175.4" rx="1.85" ry="2.1" fill="var(--color-paper)" />
              <ellipse cx="19.9" cy="175.4" rx="1.85" ry="2.1" fill="var(--color-paper)" />
              <circle cx="14.1" cy="175.6" r="0.95" fill="var(--color-ink)" />
              <circle cx="19.9" cy="175.6" r="0.95" fill="var(--color-ink)" />
            </g>
          </svg>
        </div>

        <p className="lp-eyebrow" data-a="eyebrow">
          Conviction, measured
        </p>

        <h1 className="lp-h1">
          <span className="lp-line" data-a="line">You think you know</span>
          <span className="lp-line" data-a="line">what this stock will do.</span>
        </h1>

        <p className="lp-sub" data-a="sub">
          A plumb line shows you what is actually vertical, after the wobble stops. This
          measures the distance between what you believe about a stock and what the numbers
          support — then writes both down, so a year from now you can see who was right.
        </p>

        <div className="lp-cta-row" data-a="cta">
          <a href="/app" className="lp-cta">Measure a stock</a>
          <a href="/app#record" className="lp-cta-quiet">See the track record</a>
        </div>

        <p className="lp-scroll-hint" data-a="hint" aria-hidden="true">
          <i />
          Scroll
        </p>
      </div>
    </section>
  );
}

/* ── 2 · THE PROBLEM ──────────────────────────────────────────── */

function Problem() {
  return (
    <section className="lp-sec">
      <div className="lp-inner lp-split">
        <div>
          <h2 className="lp-h2" data-a="rise">
            Confidence is easy to feel and impossible to check.
          </h2>
          <p className="lp-body" data-a="rise">
            Both numbers are the odds of the same thing: ending a year from now with more
            money than you put in. One of them you felt. The other is a count of ten thousand
            simulated futures.
          </p>
        </div>

        <div className="lp-rail-demo" data-a="rail" aria-hidden="true">
          <div className="lp-rail">
            <div className="lp-rail-track" />
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <span key={t} className="lp-tick" style={{ left: `${t}%` }}>
                <i />
                <b className="font-data">{t}</b>
              </span>
            ))}

            <span className="lp-marker lp-marker-you" data-a="you" style={{ left: `${YOU_ODDS}%` }}>
              <b className="font-data">you {YOU_ODDS}</b>
              <svg width="13" height="11" viewBox="0 0 13 11">
                <path d="M0 0 L13 0 L6.5 11 Z" fill="var(--color-ink)" />
              </svg>
            </span>

            <span
              className="lp-marker lp-marker-data in"
              data-a="data-marker"
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
              className="lp-dim in"
              data-a="dim"
              style={{ left: `${DATA_ODDS}%`, width: `${YOU_ODDS - DATA_ODDS}%` }}
            >
              <i />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3 · THE FAN ──────────────────────────────────────────────── */

function FanSection() {
  const fan = useFanPaths();
  const W = 1000;
  const H = 340;

  /* Mapped in LOG space, and symmetrically. A lognormal's upside tail
     is longer than its downside, so raw min/max bounds shove the cone
     below centre and the drawing lies about where the middle is. And
     a halving and a doubling are the same size of surprise — only a
     log axis draws them that way. */
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
    <section className="lp-sec lp-sec-tight">
      <div className="lp-inner">
        <h2 className="lp-h2" data-a="rise">Ten thousand futures, drawn as ink.</h2>
      </div>

      <div className="lp-fan" data-a="fan" aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="lp-fan-svg">
          <defs>
            <clipPath id="lp-fan-clip">
              {/* Full width by default; scroll scrubs it from 0, so a
                  renderer that never scrolls sees the whole fan. */}
              <rect x="0" y="0" height={H} width={W} data-a="fan-clip" />
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
        <p className="lp-body lp-lead" data-a="rise">
          Not one confident line. Where the ink is dark, many futures landed there. Where it
          is pale, few did. The honest answer to <em>what will this do</em> is the whole
          shape — and the width of it is the one thing we can prove we get right.
        </p>
      </div>
    </section>
  );
}

/* ── 4 · EVIDENCE ─────────────────────────────────────────────── */

function Evidence({ stats, reduced }) {
  const [run, setRun] = useState(false);
  const ref = useRef(null);

  /* The numerals count up when the block arrives. A failsafe runs it
     regardless after 1.2s, so a renderer that never scrolls still
     shows the real figures rather than zeroes. */
  useEffect(() => {
    if (reduced) { setRun(true); return; }
    const el = ref.current;
    if (!el) return;
    const failsafe = setTimeout(() => setRun(true), 1200);
    if (typeof IntersectionObserver !== 'function') return () => clearTimeout(failsafe);
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setRun(true); io.disconnect(); clearTimeout(failsafe); } },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(failsafe); };
  }, [reduced]);

  return (
    <section className="lp-sec lp-sec-tight" ref={ref}>
      <div className="lp-inner lp-split-wide">
        <div>
          <h2 className="lp-h2" data-a="rise">We tested ourselves and published what failed.</h2>
          <p className="lp-body" data-a="rise">
            Six attempts, zero signals. That is why this tool refuses to forecast direction —
            not as an apology, but as a result. Every number here is reproducible from the
            committed data in the repository.
          </p>
        </div>

        <div className="lp-cards">
          <div className="lp-card lp-pass" data-a="rise">
            <p className="lp-stat">
              <CountUp to={stats.bandHitPct} suffix="%" run={run} />
            </p>
            <p className="lp-card-body">
              of {stats.bandN} point-in-time forecasts landed inside the predicted 80% band,
              across {stats.bandWindows} separate windows. The range is honestly sized.
            </p>
          </div>

          <div className="lp-card lp-fail" data-a="rise">
            <p className="lp-stat">
              <CountUp to={stats.directionSkillPct} suffix="%" decimals={1} run={run} />
            </p>
            <p className="lp-card-body">
              skill at predicting direction over {stats.directionN} forecasts — worse than
              guessing the base rate. It cannot tell you which way a stock goes.
            </p>
          </div>

          <div className="lp-card lp-fail" data-a="rise">
            <p className="lp-stat">
              <CountUp to={stats.factorsTested} run={run} />{' '}
              <span className="lp-stat-sm">more</span>
            </p>
            <p className="lp-card-body">
              documented factors — momentum, low volatility, reversal, 52-week distance,
              trend — fitted on {stats.factorTrainN} observations and graded on{' '}
              {stats.factorTestN} held out. None beat the base rate either.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 5 · THE NAME — the pivot ─────────────────────────────────── */

function TheName() {
  return (
    <section className="lp-sec lp-sec-pivot">
      <div className="lp-inner lp-split">
        <div>
          <div className="lp-name-bob" data-a="rise" aria-hidden="true">
            <Shishya size={92} state="idle" />
          </div>
          <p className="lp-name-mark" data-a="mark">
            stock<span className="knd">ಶಿಷ್ಯ</span>
          </p>
          <p className="lp-name-gloss" data-a="rise">
            <span className="knd">ಶಿಷ್ಯ</span> means <em>student</em>. Not guru. Not oracle.
          </p>
        </div>

        <div>
          <p className="lp-body" data-a="rise">
            The one still learning is the only honest thing to call a model that gets the
            range right 87% of the time and scores worse than a coin flip on direction. Both
            numbers are on this page, in the same size type.
          </p>
          <p className="lp-body" data-a="rise">
            The figure is the plumb bob itself — the oldest instrument there is for telling
            what is actually true from what merely looks it. It turns out to be shaped like
            someone paying attention.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── 6 · THE RECEIPT ──────────────────────────────────────────── */

function Receipt() {
  return (
    <section className="lp-sec">
      <div className="lp-inner lp-split">
        <div>
          <h2 className="lp-h2" data-a="rise">
            It writes down what you believed, before you knew.
          </h2>
          <p className="lp-body" data-a="rise">
            Neither number can be edited afterwards, because both were saved before the
            outcome existed. A year later the price decides, and you are scored the same way
            the model scores itself. If you beat it, it says so.
          </p>
        </div>

        <div className="lp-receipt" data-a="receipt" aria-hidden="true">
          <div className="lp-receipt-rule" />
          <div className="lp-receipt-row" data-a="receipt-row">
            <span className="font-data">RELIANCE</span>
            <span className="font-data">₹50,000</span>
          </div>
          <div className="lp-receipt-row" data-a="receipt-row">
            <span>you said</span>
            <span className="font-data">{YOU_ODDS} in 100</span>
          </div>
          <div className="lp-receipt-row" data-a="receipt-row">
            <span>the simulation said</span>
            <span className="font-data">{DATA_ODDS} in 100</span>
          </div>
          <div className="lp-receipt-row" data-a="receipt-row">
            <span>price that day</span>
            <span className="font-data">₹1,316.00</span>
          </div>
          <div className="lp-receipt-rule" />
          <div className="lp-receipt-row lp-receipt-seal" data-a="receipt-row">
            <span className="font-data">sealed · opens in 12 months</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 7 · CLOSE ────────────────────────────────────────────────── */

function Close({ stats }) {
  return (
    <section className="lp-sec lp-close">
      <div className="lp-inner">
        <h2 className="lp-h2 lp-big" data-a="rise">Measure one you already own.</h2>
        <p className="lp-body" data-a="rise">
          {stats.symbols.toLocaleString('en-IN')} NSE equities. Sector medians from{' '}
          {stats.constituents} NIFTY 500 constituents. Search and size a position freely — an
          account is only needed to seal a measurement, because a record that settles in
          twelve months has to still be here in twelve months.
        </p>
        <div className="lp-cta-row" data-a="rise">
          <a href="/app" className="lp-cta">Measure a stock</a>
          <a href="/app#method" className="lp-cta-quiet">How it works</a>
        </div>
        <p className="lp-legal font-data">
          Educational tool. Not registered investment advice. It does not recommend trades.
        </p>
      </div>
    </section>
  );
}

/* ── the counting numeral ─────────────────────────────────────── */

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
