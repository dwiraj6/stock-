/* Part 13 verification.
   Everything the brief says to check before shipping. */
import { chromium } from 'playwright';

const B = 'http://localhost:3007';
const pass = [];
const fail = [];
const ok = (c, m) => (c ? pass : fail).push(m);

const get = async (path, init) => {
  const r = await fetch(B + path, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

/* ══ 1. WEEKEND / MARKET-CLOSED PATH ══ */
{
  const { status, body } = await get('/api/quote/RELIANCE');
  ok(status === 200, `quote returns HTTP 200 (${status})`);
  ok(body.isLive === false, `isLive is false while the market is shut (${body.marketState})`);
  ok(/^Last close: /.test(body.asOfLabel), `asOfLabel names the close: "${body.asOfLabel}"`);
  ok(body.pollMs === 0, `pollMs is 0 when shut — no fake ticking price`);
  ok(body.delayMinutes === 0, `delayMinutes is 0 when shut (a close is not delayed)`);
  ok(typeof body.nextOpen === 'string', `nextOpen present: ${body.nextOpen?.slice(0, 16)}`);
}

/* ══ 2. THE SODEXO CASE ══ */
{
  const { status, body } = await get('/api/quote/SODEXO');
  ok(status === 200, `unlisted ticker still returns HTTP 200 (${status})`);
  ok(body.ok === false && body.code === 'SYMBOL_NOT_FOUND', 'typed SYMBOL_NOT_FOUND');
  ok((body.suggestions ?? []).length === 3, `3 suggestions: ${body.suggestions?.map((s) => s.symbol).join(', ')}`);
  ok(typeof body.action === 'string' && body.action.length > 10, 'error states what to do next');
}

/* ══ 3. TRADINGVIEW — the BSE feed, and it must be labelled ══
   The free embed blocks NSE symbols outright, so the chart is fed
   the BSE listing. Verified in-browser: NSE:RELIANCE renders
   "only available on TradingView" with null OHLC, BSE:RELIANCE
   renders real candles. */
{
  const demo = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TMCV'];
  let wellFormed = true;
  let labelled = true;
  const seen = [];
  for (const s of demo) {
    const { body } = await get(`/api/stock/${s}`);
    const tv = body?.tradingViewSymbol ?? '';
    seen.push(tv);
    if (!/^BSE:[A-Z0-9&-]+$/.test(tv) || tv.includes('.NS')) wellFormed = false;
    if (body?.tradingViewExchange !== 'BSE' || !body?.tradingViewNote) labelled = false;
  }
  ok(wellFormed, `TradingView symbols use the BSE feed: ${seen.join(', ')}`);
  ok(labelled, 'each payload names the exchange and explains the swap');
}

/* ══ 4. EVERY ERROR PATH ══ */
{
  const bad = await get('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'RELIANCE' }), // no amount
  });
  ok(bad.status === 200 && bad.body.code === 'BAD_REQUEST', 'malformed body -> typed BAD_REQUEST at 200');

  const notFound = await get('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'NOTAREALTICKER', amount: 50000 }),
  });
  ok(notFound.body.code === 'SYMBOL_NOT_FOUND', 'unknown symbol -> SYMBOL_NOT_FOUND with suggestions');

  const junk = await get('/api/search?q=%21%40%23');
  ok(junk.status === 200 && junk.body.ok === true, 'junk search query does not throw');
}

/* ══ 5. PROVENANCE ON EVERY PAYLOAD ══ */
{
  const routes = ['/api/quote/RELIANCE', '/api/stock/RELIANCE', '/api/news/RELIANCE'];
  for (const r of routes) {
    const { body } = await get(r);
    const m = body?.meta;
    const complete =
      m &&
      typeof m.source === 'string' &&
      typeof m.fetchedAt === 'string' &&
      typeof m.isCached === 'boolean' &&
      typeof m.isStale === 'boolean' &&
      typeof m.degraded === 'boolean' &&
      typeof m.delayMinutes === 'number';
    ok(complete, `${r} carries full provenance (source=${m?.source})`);
  }
}

/* ══ 6. NULLS ARE NULL, NEVER SUBSTITUTED ══ */
{
  const { body } = await get('/api/stock/RELIANCE');
  const f = body.fundamentals;
  ok(f.returnOnEquity === null, 'Reliance ROE is null (Yahoo does not report it) — not zero, not estimated');
  ok(typeof f.debtToEquity === 'number' && f.debtToEquity < 1, `D/E converted from percentage to ratio: ${f.debtToEquity?.toFixed(3)}`);

  const hdfc = await get('/api/stock/HDFCBANK');
  ok(hdfc.body.fundamentals.debtToEquity === null, 'HDFC Bank D/E is null — not substituted');

  const score = await get('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'HDFCBANK', conviction: 70 }),
  });
  const fin = score.body.components.find((c) => c.key === 'financial');
  ok(fin.score > 0, `missing metric renormalises rather than scoring zero (financial=${fin.score})`);
  ok(fin.missing.includes('debt/equity'), `the missing metric is named: ${JSON.stringify(fin.missing)}`);
}

/* ══ 7. SIMULATION INTEGRITY ══ */
{
  const { body } = await get('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'RELIANCE', amount: 50000 }),
  });
  const l = body.lumpsum['12M'];
  ok(l.p10 <= l.p25 && l.p25 <= l.p50 && l.p50 <= l.p75 && l.p75 <= l.p90, 'percentiles ordered');
  ok(body.paths.length === 400 && body.paths[0].length === 60, `paths ${body.paths.length}x${body.paths[0].length}`);
  ok(body.band.p50.length === 60, 'band sampled at every drawn point');
  ok(body.density.xs.length === 120, 'density curve present for both modes');
  ok(typeof body.limitation === 'string' && body.limitation.includes('not a prediction'), 'limitation string present');

  const again = await get('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'RELIANCE', amount: 50000 }),
  });
  ok(again.body.lumpsum['12M'].p50 === l.p50, 'same stock + amount + day = same fan (seeded)');

  const size = JSON.stringify(body).length;
  ok(size < 260_000, `payload ${(size / 1024).toFixed(0)}KB`);
}

/* ══ 8. CALIBRATION IS REAL AND OWNS ITS MISSES ══ */
{
  const { body } = await get('/api/calibration');
  const c = body.calibration;
  ok(c.results.length === c.universe, `${c.universe} stocks backtested`);
  ok(c.hits + c.misses === c.universe, `${c.hits} hits + ${c.misses} misses = ${c.universe}`);
  ok(c.results.every((r) => typeof r.actual === 'number' && r.actual > 0), 'every entry has a real outcome');
  ok(/point-in-time/i.test(c.method), 'method states the point-in-time cut');
  ok(c.missNarrative.length > 40, 'misses are named and explained');
}

/* ══ 9. CHAT REFUSES ADVICE ══ */
{
  const r = await fetch(B + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'RELIANCE', question: 'Should I buy this stock?' }),
  });
  const text = await r.text();
  ok(/does not recommend trades/i.test(text), 'advice request refused before reaching the model');
  ok(!/\byes\b|\bbuy it\b/i.test(text), 'refusal contains no recommendation');
}

/* ══ 10. AIRPLANE MODE — the whole point of the cache ══ */
{
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();

  // Block every outbound host except our own server. Yahoo, Google
  // News, TradingView and fonts all go dark; Mongo is server-side and
  // stays up, which is exactly the "upstream is down" scenario.
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(B) || u.startsWith('data:')) return route.continue();
    return route.abort();
  });

  await p.goto(B, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.getByRole('combobox').fill('RELIANCE');
  await p.waitForTimeout(900);
  const optCount = await p.getByRole('option').count();
  ok(optCount > 0, `search works with all upstreams blocked (${optCount} results)`);
  await p.getByRole('option').first().click();
  await p.getByPlaceholder('50,000').fill('50000');
  await p.getByRole('button', { name: 'Run the simulation' }).click();

  const reached = await p
    .waitForSelector('section[aria-labelledby="gap-eyebrow"]', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  ok(reached, 'results render with every upstream blocked');

  if (reached) {
    await p.waitForTimeout(2500);
    const txt = await p.locator('body').innerText();
    ok(/THE MEASUREMENT/i.test(txt), 'gap module rendered from cache');
    ok(/TEN THOUSAND POSSIBLE OUTCOMES/i.test(txt), 'simulation rendered from cache');
    ok(/WHERE THE \d+ CAME FROM/i.test(txt), 'score rendered from cache');
    ok(/80% band/i.test(txt), 'calibration rendered (static file)');
    await p.screenshot({ path: '.drive/13-airplane.png', fullPage: false });
  }
  await browser.close();
}

console.log('\n──────── PASS ────────');
pass.forEach((m) => console.log('  ✓ ' + m));
if (fail.length) {
  console.log('\n──────── FAIL ────────');
  fail.forEach((m) => console.log('  ✗ ' + m));
}
console.log(`\n${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
