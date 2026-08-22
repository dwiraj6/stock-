/* The browser's view of the API.
   ────────────────────────────────────────────────────────────────
   Every call returns the typed payload the routes emit. Errors are
   values, not exceptions: routes answer 200 with { ok:false, code,
   message, action }, so the UI can render something true instead of
   catching and guessing.

   Polling honours the server's own pollMs and pauses when the tab is
   hidden, so a backgrounded tab never burns the upstream rate limit
   (Part 2.3). */

async function call(path, init) {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = await res.json();
    return body;
  } catch (err) {
    // A network failure is itself a typed result.
    return {
      ok: false,
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Could not reach the Plumbline server.',
      action: 'Check your connection and try again.',
      _transport: String(err?.message ?? err),
    };
  }
}

export const searchSymbols = (q, limit = 6) =>
  call(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);

export const getQuote = (symbol) => call(`/api/quote/${encodeURIComponent(symbol)}`);

export const getStock = (symbol, years = 3) =>
  call(`/api/stock/${encodeURIComponent(symbol)}?years=${years}`);

export const getNews = (symbol) => call(`/api/news/${encodeURIComponent(symbol)}`);

export const getCalibration = () => call('/api/calibration');

/* An anonymous, browser-generated identity.
   Not an account, not an email, nothing personal — it exists only so
   your own decisions can be shown back to you. It lives in this
   browser and nowhere else; clearing site data ends it. */
const WHO_KEY = 'plumbline.who';
export function whoAmI() {
  if (typeof window === 'undefined') return '';
  try {
    let w = localStorage.getItem(WHO_KEY);
    if (!w) {
      w =
        (crypto?.randomUUID?.() ??
          `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/-/g, '');
      localStorage.setItem(WHO_KEY, w);
    }
    return w;
  } catch {
    // Private mode: the track record simply does not persist.
    return '';
  }
}

export const getTrackRecord = () => {
  const who = whoAmI();
  if (!who) return Promise.resolve({ ok: true, track: null });
  return call(`/api/decisions?who=${encodeURIComponent(who)}`);
};

export function recordDecision({ symbol, amount, userProb, modelProb, priceAt }) {
  const who = whoAmI();
  if (!who || modelProb == null || !priceAt) return Promise.resolve({ ok: false });
  return call('/api/decisions', {
    method: 'POST',
    body: JSON.stringify({ who, symbol, amount, userProb, modelProb, priceAt }),
  });
}

export const simulate = (symbol, amount) =>
  call('/api/simulate', { method: 'POST', body: JSON.stringify({ symbol, amount }) });

export const score = (symbol, conviction, amount) =>
  call('/api/score', { method: 'POST', body: JSON.stringify({ symbol, conviction, amount }) });

/**
 * Stream a chat answer. `onChunk` receives text as it arrives, by
 * word — no character-by-character typewriter.
 */
export async function chat({ symbol, question, conviction, amount, history }, onChunk) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, question, conviction, amount, history }),
    });

    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      // A typed failure came back instead of a stream.
      const body = await res.json();
      return body;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      full += chunk;
      onChunk?.(chunk, full);
    }
    return { ok: true, text: full, model: res.headers.get('x-plumbline-model') };
  } catch (err) {
    return {
      ok: false,
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'The chat stream was interrupted.',
      action: 'Ask again — the rest of the page is unaffected.',
    };
  }
}

/**
 * Poll a quote on the server's own schedule. Pauses while the tab is
 * hidden. Returns a stop function.
 */
export function pollQuote(symbol, onUpdate) {
  let timer = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    if (document.visibilityState === 'hidden') {
      schedule(30_000);
      return;
    }
    const body = await getQuote(symbol);
    if (stopped) return;
    onUpdate(body);
    // pollMs === 0 means the market is shut: stop entirely rather
    // than hammering a feed that cannot change.
    const next = body?.ok ? body.pollMs : 60_000;
    if (next && next > 0) schedule(next);
  };

  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible' && !stopped) tick();
  };

  document.addEventListener('visibilitychange', onVisible);
  tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
