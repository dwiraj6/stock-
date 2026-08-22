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

Two surfaces:

| Route | What it is |
|---|---|
| `/` | The landing page — the argument, before you have used anything |
| `/app` | The instrument itself |

---

## The landing page

Inside the product, stillness is correct: it is an instrument, and an
instrument that fidgets while you read it is broken. A landing page
has the opposite job, because nobody has used the thing yet and the
only way to show what it does is to do it.

So the page moves, but every moving thing is drawn from the product's
own vocabulary — the plumb line runs the full height as a 1px spine
with the bob riding it on scroll; the fan opens as you reach it; a
dimension line measures the gap; numerals count up. No gradient, no
blob, no glow, no card lifting on hover. Every animation is `transform`
or `opacity` only, so the compositor does the work and the main thread
stays free. Measured at **0 of 246 frames below 30fps, worst frame
16.7ms**, and `verify` asserts that no rule transitions a layout
property.

Two things about it are worth stating plainly:

**Every statistic on it is read from the committed exhibits at build
time** — `data/calibration.json`, `data/probability-calibration.json`,
`data/factor-test.json`, `data/sector-medians.json`. Nothing is typed
into the markup. A landing page that quotes its own backtest from
memory will still be quoting it long after the backtest has moved on,
and `verify` fails if the page and the exhibits disagree. That
includes the unflattering number: the page states the −3.4% direction
skill in the same size type as the 87% band hit rate.

**The rail demo runs on its own clock.** It was scroll-driven first,
which turned out to be exactly wrong — a reader who stopped to look at
it froze it half-drawn, and gating the payoff on section progress put
the gap just below the trigger at the one scroll position where the
rail sat centred and readable. Now the sweep starts when the rail
enters the viewport and finishes regardless of what the reader does
next. Stopping to read it is rewarded rather than punished, and it
plays identically at any scroll speed.

The one deviation from the app's motion rule ("nothing animates on
scroll except the methodology page's one-time reveals") is deliberate
and stated in the source: a landing page where scrolling drives a
demonstration is not the ambient fidgeting that rule exists to
prevent.

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

## What it claims, and what it refuses to

The app makes exactly one predictive claim, and publishes the test it
fails alongside the one it passes.

**WIDTH — validated.** Across **120 point-in-time forecasts** (20
stocks × 6 windows), the real outcome landed inside the 80% band
**104 times = 87%**, 95% CI 81–93%. Slightly wider than it needs to
be, which the page says.

**DIRECTION — no skill, and it says so.** Across **240 point-in-time
forecasts**, the probability-of-profit forecast scored Brier
**0.2413** against **0.2333** for ignoring the stock entirely and
predicting the base rate. **Skill −3.4%.** That table is on the
results page under *"and the test it fails"*.

**AND WE DID TRY.** Before claiming direction is unpredictable, five
documented price-based factors were fitted on 300 observations and
graded on **150 held-out windows they never saw**:

```
momentum12_1   Brier 0.2675   skill  -19.2%
lowvol               0.2402          -7.0%   <- best
reversal1m           0.2447          -9.1%
dist52w              0.2559         -14.0%
trend200             0.2604         -16.1%
```

None beat the base rate. Fundamentals were deliberately excluded:
Yahoo serves only today's P/E and book value, so any fundamental test
would carry look-ahead bias, and a signal that cannot be measured
honestly is not tested at all.

**Six attempts, zero signals.** The refusal to forecast direction is a
measured finding, not a limitation.

A tool that publishes only the test it passes has not shown you a
test.

### The finding that reshaped the model

The original model estimated each stock's own drift from its last two
years and projected it forward. Tested properly, that was **actively
harmful**:

```
full estimated drift    Brier 0.3524   skill  -51.0%
shrink to 50%                 0.3040          -30.3%
shrink to 25%                 0.2801          -20.1%
zero drift                    0.2658          -13.9%
flat +8%/yr  (shipped)        0.2412           -3.4%
```

Monotonic — every step away from the stock-specific estimate helped.
The old reliability curve was **inverted**: when it said 0–10% the
stock rose 72% of the time; when it said 90–100% it rose 44%. It was
betting on momentum over a horizon where these names mean-revert.

The cause is statistics, not a bug: two years of daily data pins down
volatility well and expected return barely at all. Drift is now a flat
nominal rate for every symbol. The stock's own drift is still shown —
it just no longer drives the simulation.

## Verification

```bash
npm run verify          # 83 end-to-end checks, incl. airplane mode
npm run check:sigma     # sigma vs an independent implementation
npm run check:hours     # every market state + the UTC-server trap
npm run check:symbols   # resolution, ranking, the SODEXO case
npm run backtest        # band calibration, 6 point-in-time windows
npm run calibrate       # direction calibration + Brier
npm run factors         # 5 factors on held-out windows
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

## The plumb bob notices things

After the results settle, the docked bob raises one observation about
*this* page — the widest thing it found — and offers a follow-up that
opens the chat already on that thread.

The observations are **computed from the payload, never generated**,
for three reasons in order of weight:

1. **They cannot be wrong.** Each is a template over numbers already
   on screen, so the bob can never contradict the chart beside it.
2. **They cost nothing.** The free Gemini tier allows 20 requests per
   model per day; a generated greeting on every page load would spend
   that during one demo and leave none for real questions.
3. **They are instant.** A generated greeting arrives seconds late,
   which is when a greeting stops being welcome.

Candidates are weighted, so the bob says the single most interesting
true thing rather than the first thing in a list — TMCV gets *"the
spread covers 100% of what you'd put in"*, RELIANCE gets *"spreading
this across twelve months cuts the worst case by 35%"*.

It appears once, and stays until dismissed or opened. It does not
pulse, reappear or re-animate.

### A number the model invented

Wiring this up caught a real fault. Asked to explain the SIP, the chat
said *"₹10,000 every month"* for a ₹50,000 stake that splits into
₹4,167. The context held the total and the outcome percentiles but not
the instalment, so the model derived one — and derived it wrong.

The instalment is now in the context, and the system prompt gained a
rule above the formatting ones: **never derive a number.** Anything
the model has to compute, it will invent instead.

## Your track record

Every measurement is logged the moment it is made — the stock, the
price then, your stated odds, the simulation's odds — and none of it
can be revised, because it is written before the outcome exists. When
you come back, the current price decides.

Scored with **Brier, the same statistic the app uses on itself**. That
symmetry is the point: it holds its user to exactly the standard it
holds itself to, and publishes both.

An open position is shown as open. It is not right or wrong yet, and
scoring it early would be the dishonesty the rest of the app spends
its time avoiding.

The model's own record sits on the same screen. A new user's record is
necessarily empty — a 12-month horizon matures in 12 months — so the
page would otherwise be blank on the day it matters most. The model's
record is not blank, and putting them side by side makes the standard
explicit: *if your Brier comes in under 0.2333, you are reading these
stocks better than the simulation is.*

Identity is an anonymous browser-generated id in `localStorage`. No
accounts, no email, nothing personal.

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
