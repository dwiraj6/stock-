import { useEffect, useRef, useState, useCallback } from 'react';

/** Part 9: prefers-reduced-motion is honoured in JS as well as CSS.
    Anything animated by script has to check this, not just the
    stylesheet — otherwise "reduce" becomes "reduced but still
    animated", which the brief rules out explicitly. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Count a number up. Used for the gap figure and the score bars.
 * Linear, because the brief specifies linear for the gap count and a
 * number that eases looks like it is deciding what it is.
 */
export function useCountUp(target, { duration = 600, delay = 0, active = true } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced || !active ? target : 0);
  const raf = useRef(0);
  const timer = useRef(0);

  useEffect(() => {
    if (!active) return;
    if (reduced || duration === 0) {
      setValue(target);
      return;
    }
    let start = 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      setValue(target * p);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    timer.current = window.setTimeout(() => {
      raf.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      window.clearTimeout(timer.current);
      cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay, active, reduced]);

  return value;
}

/** Element width, for charts that must re-render responsively rather
    than scale as bitmaps (Part 10). */
export function useMeasure() {
  const ref = useRef(null);
  const [rect, setRect] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setRect({ width: r.width, height: r.height });
    });
    ro.observe(el);
    setRect({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, rect];
}

/** Current breakpoint. 375 is not a smaller 1024 — the gap module is
    a different component there (Part 10) — so this returns a name,
    not a width. */
export function useBreakpoint() {
  const get = () => {
    if (typeof window === 'undefined') return 'lg';
    const w = window.innerWidth;
    if (w < 768) return 'sm';
    if (w < 1024) return 'md';
    return 'lg';
  };
  const [bp, setBp] = useState(get);
  useEffect(() => {
    const on = () => setBp(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return bp;
}

/** Fire once when the element first enters the viewport. Used only by
    the methodology page — nothing else in the product animates on
    scroll, and nothing repeats on scroll back. */
export function useRevealOnce(rootMargin = '-12% 0px') {
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
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);
  return [ref, shown];
}

/** Trap focus inside a container while it is open (Part 11). */
export function useFocusTrap(active, onEscape) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    if (!active) return;
    restoreTo.current = document.activeElement;
    const el = ref.current;
    if (!el) return;

    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const first = el.querySelector(selector);
    first?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(el.querySelectorAll(selector)).filter(
        (n) => n.offsetParent !== null
      );
      if (nodes.length === 0) return;
      const firstN = nodes[0];
      const lastN = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstN) {
        e.preventDefault();
        lastN.focus();
      } else if (!e.shiftKey && document.activeElement === lastN) {
        e.preventDefault();
        firstN.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // focus returns to the trigger (Part 11)
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, [active, onEscape]);

  return ref;
}

/** Hash routing. Two routes, so a router dependency would be
    ceremony. */
export function useHashRoute() {
  const read = () => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#\/?/, ''));
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((to) => {
    window.location.hash = to ? `/${to}` : '/';
    window.scrollTo(0, 0);
  }, []);
  return [route, navigate];
}

/**
 * True once the screen's entry sequence has finished.
 *
 * This exists for performance, not choreography. A CSS animation with
 * `fill-mode: both` stays ATTACHED to its element after it finishes —
 * measured on the results page, 716 animations remained in
 * document.getAnimations() with playState "finished", 400 of them on
 * the fan chart's paths. Each one keeps its element on its own
 * compositor layer, and scrolling then costs the compositor 716
 * layers per frame. The page looked still and was not.
 *
 * Flipping this flag re-renders once with animations removed, which
 * detaches all of them. The final visual state is unchanged because
 * every component's non-animated branch already renders exactly that
 * — it is the same branch prefers-reduced-motion uses.
 */
export function useSettled(delayMs) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);
  return settled;
}

/** True once `delay` ms have passed since mount — for staging an
    entry sequence without stacking timeouts through the tree. */
export function useAfter(delay, active = true) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(!active ? false : reduced || delay === 0);
  useEffect(() => {
    if (!active) return;
    if (reduced || delay === 0) {
      setDone(true);
      return;
    }
    const t = window.setTimeout(() => setDone(true), delay);
    return () => window.clearTimeout(t);
  }, [delay, active, reduced]);
  return done;
}
