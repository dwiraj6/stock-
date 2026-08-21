# Plumbline

Conviction, measured. An educational tool that shows an Indian retail
investor the distance between how confident they *feel* about a stock
and how confident the *data* is — then explains why the distance
exists.

Next.js 14 App Router · TypeScript · MongoDB Atlas · Gemini · Vercel.

```bash
cp .env.example .env.local     # fill in the three values
npm install
npm run prewarm                # cache the demo tickers
npm run dev                    # http://localhost:3000
```

---

## What is real

Every number the app displays is traceable to a source field. There is
no mock data, no seeded placeholder, and no estimated stand-in
anywhere in the tree — including in development.

| Thing | Where it comes from |
|---|---|
| Symbol universe | NSE's own `EQUITY_L.csv`, committed to `/data`. **2,291** equities, `SERIES=EQ`. |
| Quotes, OHLCV, fundamentals | `yahoo-finance2`, with Twelve Data as fallback and Mongo as backstop. |
| Sector medians | Computed from **499 of the 500** NIFTY 500 constituents. `/data/sector-medians.json` records `n` per metric. |
| News | Google News India + Yahoo, behind a mandatory company-relevance filter. |
| Backtest | Point-in-time, 20 NSE equities, `/data/calibration.json`. |
| Simulation | 10,000-path GBM on parameters estimated from adjusted closes. |

**The only accuracy claim the app makes** is the backtest hit rate:
**16 of 20** twelve-month outcomes landed inside the predicted 80%
band, against an expectation of ~16. The four misses (HDFCBANK, ITC,
TITAN, NESTLEIND) are named on the page and in the payload.

## Verification

```bash
npm run verify          # 43 end-to-end checks, incl. airplane mode
npm run check:sigma     # sigma vs an independent implementation
npm run check:hours     # every market state + the UTC-server trap
npm run check:symbols   # resolution, ranking, the SODEXO case
```

`check:sigma` prints the intermediate values so the volatility
estimate can be reproduced by hand in Excel or pandas. For RELIANCE it
matches an independently-written estimator to `0.000e+0`.

## Endpoints

| Route | TTL | Notes |
|---|---|---|
| `GET /api/search?q=` | none | Local index. Falls back to fuzzy `did you mean` with `fuzzy: true`. |
| `GET /api/quote/:symbol` | 30s open / until next open | Carries `marketState`, `isLive`, `asOfLabel`, `pollMs`. |
| `GET /api/stock/:symbol` | 15m | Profile, fundamentals + sector medians, history, `tradingViewSymbol` (BSE — see deviations). |
| `GET /api/news/:symbol` | 15m | Verbatim headlines, publisher, link, plus an itemised `audit` of what was filtered and why. |
| `GET /api/calibration` | 1h | Serves the committed backtest. Never recomputes. |
| `GET /api/recent` | 60s | Real session records. Empty if nobody has run a score. |
| `POST /api/simulate` | 24h | Lumpsum **and** SIP in one response. |
| `POST /api/score` | 5m | Five components, each with its evidence. |
| `POST /api/chat` | none | Streaming, grounded, 20 msg/IP/hour. |

Every payload carries
`meta { source, fetchedAt, isCached, isStale, degraded, delayMinutes }`.
Every error returns **HTTP 200** with `{ ok:false, code, message, action }` —
the app is designed so it cannot show a blank screen.

## News

Rendered on the results page as **"What the model doesn't see"**, placed
immediately after the score breakdown. That position is the point: the
score reads price history and reported fundamentals, and these
headlines are not in it and cannot be — the same admission the
calibration grid makes about its misses.

Headlines are the publisher's own words, unedited, with attribution
and a working link. The API reports an itemised audit rather than a
single "discarded" count, because those are not the same claim:

```
HDFCBANK   kept=8  fetched=110  tooOld=81  offTopic=10  dupes=1  trimmed=10
```

Age, not relevance, is the dominant filter. A rolled-up figure would
have implied 102 headlines were rejected as off-topic when 10 were.

## Performance and the chat's failure modes

Two problems were reported after the first build, and both were real.

**Scrolling lagged.** The results page looked still after its entry
sequence but was not: a CSS animation with `fill-mode: both` stays
*attached* to its element after finishing. Measured on the results
page, **716 animations remained** in `document.getAnimations()` with
`playState: "finished"` — 400 of them on the fan chart's paths — and
the compositor was handling all 716 layers on every scrolled frame.

`useSettled(2600)` in `src/lib/hooks.js` now flips `animate` to false
once the longest entry sequence is over. That re-renders once with the
animations removed, detaching them. The final visual state is
unchanged because the non-animated branch is the same one
`prefers-reduced-motion` already used and which was already verified.

```
                 animations   worst frame   frames < 30fps
before                  716       116.6ms          1 / 461
after                     0         8.8ms          0 / 458
```

`content-visibility: auto` was also tried and **removed**: it makes
the browser guess offscreen section heights, so the scrollbar shifts
under the cursor, and it bought nothing once the animations were
detached. `contain: paint` is kept.

**The chat gave half an answer, then went blank.** Three causes, all
measured against the live API:

1. **Thinking was eating the token budget.** `gemini-2.5-flash`
   reasons internally and charges those tokens against
   `maxOutputTokens`. At the old 600 it spent **248–278 tokens
   thinking** against 78 visible — ~45% gone before a word was
   written. With this route's large grounding context the budget
   could vanish entirely. Thinking is now off (`thinkingBudget: 0`)
   and the budget is 2048. Total tokens per answer fell from ~443
   to ~185.
2. **The free-tier quota is 20 requests per model per day**, not per
   minute (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). When
   it cut in mid-stream, `chunk.text()` threw and the old code ended
   the stream silently — a half answer followed by nothing. The
   stream now never ends on silence: it reports truncation, safety
   blocks and empty responses in words.
3. **There was no timeout.** A quota-limited request hung for a
   measured **104 seconds** with nothing on screen. There is now a
   25s deadline, and exhausted models are parked in a cooldown so
   later questions skip them instead of paying a 429 round-trip each.

Each model has its own daily bucket, so the fallback chain triples the
questions available. One entry in that chain — `gemini-2.5-flash-lite`
— turned out to **404**; it was silently wasting a hop and is gone.

The citation parser was also rewritten. It had been consuming the word
*after* `[[metric:key]]` and rendering only that word, so *"the
[[metric:debtToEquity]] ratio is 0.37"* displayed as *"the ratio is
0.37"* — the metric name silently deleted. The model also emits
formats the prompt never asked for (`[[fundamentals:debtToEquity]]`,
`[[debtToEquity:0.37]]`), which previously rendered as literal
brackets. All four forms now resolve to a readable label.

## Deviations from the brief

Seven, each forced by something real:

1. **`TATAMOTORS` no longer exists on NSE.** The demerger split it into
   `TMCV` and `TMPV`; the ticker is absent from the current
   `EQUITY_L.csv`. It resolves to TMCV with an explanatory note
   (`/data/symbol-aliases.json`), and TMCV replaces it in the demo set.
   It is excluded from the backtest, where a 12-month point-in-time
   series for it cannot exist.

2. **`gemini-2.0-flash` is retired** — the API returns 404 "no longer
   available". The chain is now `gemini-2.5-flash` →
   `gemini-flash-latest` → `gemini-2.5-flash-lite`, verified against
   `models.list` for this key.

3. **Yahoo's `search()` news is unusable for `.NS` tickers.** Querying
   `RELIANCE.NS` returns stories about SanDisk, AMD, Micron and a
   migrant crossing in Ceuta — ten of ten discarded by the relevance
   filter. Both sources are now queried on every request and the
   filter decides, rather than Yahoo short-circuiting the better one.

4. **`debtToEquity` arrives as a percentage**, not a ratio (Reliance:
   `36.653`). It is divided by 100 on ingest. Passed through raw it
   would claim Reliance is 36× levered and wreck the financial-health
   score.

5. **The frontend was Vite; the brief specifies Next.js.** Migrated —
   all 32 visual components were reused unchanged as client
   components. The Vite entrypoints are gone.

6. **TradingView's free embed cannot show NSE.** Verified in a
   browser against the live widget: `NSE:RELIANCE` renders
   *"This symbol is only available on TradingView"* with `O∅ H∅ L∅ C∅`
   — on `advanced-chart`, `symbol-overview` and `mini-chart` alike.
   NSE data is entitled to subscribers; **BSE is not**, and
   `BSE:RELIANCE` renders real candles. Since every liquid Indian
   company is dual-listed, the embed is fed the BSE listing, and the
   payload ships `tradingViewExchange` + `tradingViewNote` so the UI
   states which exchange the chart is showing. Everything else on the
   page stays NSE. Scrip codes (`BSE:500325`) are not accepted — use
   the ticker.

7. **NSE holidays for 2026 are estimates.** The fixed civil dates are
   certain; the lunar festival dates are not, and
   `HOLIDAYS_VERIFIED = false` in `lib/market-hours.ts` says so until
   someone reconciles them against NSE's official circular. Nothing in
   the app claims the list is authoritative while that flag is false.

## Things that are deliberately not clever

- **Adjusted close for all return and volatility maths.** NSE splits
  and bonuses are frequent; a 1:1 bonus reads as a −50% day on raw
  close and inflates sigma by tens of points. Raw OHLC draws candles
  and nothing else.
- **Winsorize before estimating.** One bad tick otherwise sets the
  volatility for the whole simulation. For RELIANCE it moves sigma by
  −0.67pp, clipping 10 of 498 returns.
- **A null metric is excluded and its weight renormalised**, never
  scored zero. Yahoo has no ROE for Reliance and no D/E for HDFC Bank;
  scoring those zero would punish a company for a gap in someone
  else's database.
- **Every cache key is namespaced by `CACHE_SCHEMA`** (`lib/mongo.ts`).
  Cached documents outlive code, and this bit us twice: the fan chart
  drew `MNaN 190LNaN` when the simulate payload gained `band`/`density`,
  and the news provenance line reported zeroes when `filtered` became
  `audit`. Neither failed loudly — they rendered wrong. **Bump
  `CACHE_SCHEMA` on any change to a cached payload's shape.**
- **`config.cache = { type: 'memory' }`** in `next.config.js`: Next
  14's persistent webpack cache corrupts across builds on Node 22.

## Operational notes

- **Rotate the credentials in `.env.local`.** They were pasted into a
  chat transcript. `.env.local` is gitignored; the values are not
  secret any more.
- `npm run prewarm` before any demo. With the five demo tickers cached
  the app renders complete results with every upstream blocked —
  verified as check 10 of `npm run verify`.
- Mongo TTL indexes are created on first use by `ensureIndexes()`.
  Documents are kept 12× past their soft TTL so a stale payload can
  still be served when upstream is down.

## Not investment advice

Plumbline is educational. It does not recommend trades. The model
reads price history and reported fundamentals; it does not see news,
guidance, or policy, and its backtest misses are the moves that price
history could not have implied.
