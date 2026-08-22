# stockಶಿಷ್ಯ — Product Requirements Document

**Version** 1.0 · **Status** Shipped, in production · **Last updated** 22 August 2026
**Live** https://stock-six-sand.vercel.app · **Source** https://github.com/dwiraj6/stock-

---

## 0. One paragraph

stockಶಿಷ್ಯ measures the distance between how confident an Indian retail
investor *feels* about a stock and how confident the *data* actually is —
then writes both numbers down, before the outcome exists, so that twelve
months later it can be checked who was right. It is an educational
instrument, not an advisor. It holds no money, executes no trades, and
recommends nothing.

**ಶಿಷ್ಯ** (*shishya*) is Sanskrit/Kannada for **student** — not guru, not
oracle. That is the product thesis compressed into a name: this tool gets
the *range* right 87% of the time and scores **worse than a coin flip** on
*direction*, and it publishes both numbers in the same size type.

---

## 1. The problem

An Indian retail investor deciding whether to put ₹50,000 into a stock has
access to an enormous amount of information and almost no calibration.

- Every tool in the category outputs **confidence**: a BUY rating, a target
  price, a 9/10 score, a "strong fundamentals" badge.
- None of them output **uncertainty**, and none are ever scored.
- The investor therefore has no way to distinguish a well-founded belief
  from a confident-feeling one, and no feedback loop that would let them
  learn the difference over time.

The gap being addressed is not *information*. It is **calibration** — and
the absence of any mechanism that would reveal a miscalibration.

### 1.1 Why this is hard to fix honestly

The obvious product is a better rating engine. That fails, and this project
has the measurements to prove it:

| Attempt | Result |
|---|---|
| GBM simulation with estimated drift | Brier 0.3524, skill **−51.0%** |
| Drift shrunk to 50% | 0.3040, −30.3% |
| Drift shrunk to 25% | 0.2801, −20.1% |
| Zero drift | 0.2658, −13.9% |
| Flat +8%/yr (shipped) | 0.2412, **−3.4%** |
| 5 documented price factors, held-out | best (low-vol) **−7.0%** |

Six independent attempts to forecast direction. **None beat the base rate.**
That is not a limitation to apologise for — it is the finding the product is
built on, and it dictates the entire design.

---

## 2. Product principles

These are load-bearing. Every feature decision below traces to one.

1. **Publish the misses in the same size type as the hits.**
   The 87% band accuracy and the −3.4% direction skill appear on the same
   screen, at the same weight.

2. **Never produce an unfalsifiable output.**
   No "Moderate Investor" label, no 1–10 conviction rating that can never be
   checked. Every number the product emits is either a count of simulated
   outcomes or a figure read from a committed backtest file.

3. **A decision is written before the outcome exists, and never revised.**
   This is the only claim the product genuinely makes. It constrains
   storage design (see §7.4).

4. **Degrade honestly, never silently.**
   Every failure path states what broke, what still works, and what to do.
   No blank screens, no spinners that never end, no fabricated data.

5. **One moment of motion, then stillness.**
   An instrument that fidgets while you read it is broken.

---

## 3. Users

| Segment | Need | What they do here |
|---|---|---|
| **Primary** — Indian retail investor, 22–40, has a Zerodha/Groww account, ₹10k–₹5L invested | "Am I right about this stock, or does it just feel that way?" | States conviction, sees the gap, records the decision |
| **Secondary** — first-time investor | "How much can I actually lose?" | Reads the band and the loss odds; often never records |
| **Tertiary** — evaluator/judge/reviewer | "Is this real or a demo?" | Reads the methodology and calibration exhibits |

**Explicit non-users:** anyone seeking trade recommendations, anyone
executing trades, institutions, anyone under 18.

---

## 4. Scope

### 4.1 In scope (shipped)

- Measurement of a single long equity position, NSE-listed
- Three horizons: 2 months, 6 months, 12 months
- Lumpsum and 12-month SIP comparison
- Conviction capture and gap analysis
- Grounded conversational assistant (ಶಿಷ್ಯ)
- Personal track record with Brier scoring
- Risk profiling as constraint-checking
- Accounts (Google + email/password)
- Published, reproducible validation exhibits

### 4.2 Explicitly out of scope

- Buy/sell/hold recommendations — **permanently out**, not "later"
- Portfolio construction, allocation, rebalancing
- Options, futures, F&O, intraday, shorting
- Order execution or broker integration
- Mutual funds, bonds, commodities, crypto
- Tax, KYC, or anything requiring SEBI registration
- Real-time tick data (the product uses delayed/close data by design)

---

## 5. Functional requirements

### 5.1 Entry — stock selection and conviction

| ID | Requirement |
|---|---|
| E-1 | Search across **2,291 NSE EQ-series symbols** by ticker or company name, with fuzzy matching |
| E-2 | An unlisted query returns typed `SYMBOL_NOT_FOUND` with **exactly 3** ranked suggestions and a stated next action |
| E-3 | Amount input accepts ₹100–₹10,00,00,000, formatted in the Indian numbering system (lakh/crore) |
| E-4 | Conviction captured as an integer 0–100 on a rail, phrased as *"odds of ending a year from now with more money than you put in"* |
| E-5 | The entry screen is **fully usable signed out** — search, amount, conviction all work before any account exists |
| E-6 | The gate is stated *before* the click: "You will be asked to sign in first — your stock, amount and conviction are kept" |

### 5.2 Simulation

| ID | Requirement |
|---|---|
| S-1 | Geometric Brownian Motion, **10,000 paths**, 252 trading days/year |
| S-2 | Seeded `mulberry32` PRNG keyed on symbol + IST date → **identical output for identical input on the same day** |
| S-3 | Volatility estimated from **adjusted close** only; raw OHLC used exclusively for candle rendering |
| S-4 | Returns **winsorised at the 1st/99th percentile** before volatility estimation |
| S-5 | Drift is a **flat +8%/yr**, not estimated per stock — justified by the measurement table in §1.1 and documented in source |
| S-6 | Outcome odds are **counted, not derived from percentiles**: `profit`, `lose10`, `lose20`, `gain20`, `beatFd` |
| S-7 | Minimum 250 trading days of history; below that the payload carries an explicit `warning` |
| S-8 | Requires an authenticated session (§5.8) |

### 5.3 Score and gap

| ID | Requirement |
|---|---|
| G-1 | Score composed of valuation, volatility, financial health, momentum, data quality |
| G-2 | A metric the source does not report is rendered **"not available"** in italic graphite — never zero, never imputed, never silently dropped |
| G-3 | The headline is the **odds gap in percentage points**: stated conviction minus simulated probability |
| G-4 | Sector-relative comparison uses medians built from **499 NIFTY 500 constituents** |
| G-5 | The band width as a share of stake is surfaced, because it is the one quantity the backtest validates |

### 5.4 ಶಿಷ್ಯ — the assistant

| ID | Requirement |
|---|---|
| C-1 | Answers **only** from the grounded context of the page in front of the user |
| C-2 | **Never derives a number.** Anything not in context is stated as unavailable. (Regression: it once invented "₹10,000 every month" for a ₹50,000/12 SIP.) |
| C-3 | Refuses buy/sell/hold advice, and says why |
| C-4 | Cites metrics inline as `[[metric:key]]`, rendered as links that highlight the referenced module |
| C-5 | Streams token-by-token; **first token < 4s** |
| C-6 | Opening questions are **derived from the stock's own payload** and guarded — a question is offered only when the number it asks about exists |
| C-7 | Model chain of 5 buckets; a dead model is cooled down for 5 min, shared across serverless instances |
| C-8 | Free-tier exhaustion is stated precisely, with what still works |

### 5.5 Track record

| ID | Requirement |
|---|---|
| T-1 | A decision is written at the moment of measurement: symbol, price, user odds, model odds, horizon |
| T-2 | Records are **immutable** — never updated after creation |
| T-3 | An unmatured position shows as **open**, scored neither right nor wrong |
| T-4 | On maturity, scored with **Brier** — the same statistic the model applies to itself |
| T-5 | The model's own record (120 band forecasts, 240 direction forecasts) is shown alongside, so the screen is meaningful on day one |
| T-6 | Anonymous pre-account history is adoptable **once** (§7.4) |

### 5.6 Risk profiling

| ID | Requirement |
|---|---|
| R-1 | Four questions: purpose, horizon, maximum tolerable loss (₹), behaviour on a 20% fall |
| R-2 | **No label is produced.** No "Moderate Investor." (Principle 2.) |
| R-3 | Each answer is checked against the running simulation and reported as a finding |
| R-4 | The behavioural answer is **priced**: "I would sell" + a counted 8% chance of a 20% fall = "in roughly one future in 13 you would be selling at the bottom" |
| R-5 | Findings never say buy, sell, hold, or suitable — asserted in the test suite |
| R-6 | Even the all-clear refuses to imply the stock is a good bet |

### 5.7 Validation exhibits

| ID | Requirement |
|---|---|
| V-1 | **Band calibration**: 20 stocks × 6 point-in-time windows = 120 forecasts, 87% inside the 80% band |
| V-2 | **Direction calibration**: 240 forecasts, Brier 0.2413 vs 0.2333 baseline, skill **−3.4%** |
| V-3 | **Factor test**: 5 price factors, 300 train / 150 held-out, best −7.0% |
| V-4 | All three are committed JSON, regenerable by a documented npm script |
| V-5 | Every statistic shown in the UI is **read from these files at build time** — the test suite fails if page and file disagree |

### 5.8 Accounts

| ID | Requirement |
|---|---|
| A-1 | Google sign-in via Firebase (popup → ID token → app session) |
| A-2 | Email + password, with 6-digit verification when SMTP is configured |
| A-3 | Passwords hashed with **scrypt** (`node:crypto`), per-user salt, timing-safe compare |
| A-4 | Sessions are 256-bit random tokens, **stored hashed**, revocable, HttpOnly/Secure/SameSite=Lax |
| A-5 | Signup and login are **not an account-existence oracle** — identical response in message *and* in timing |
| A-6 | The gate is on **running the analysis**, not on entering the app |
| A-7 | Server-side enforcement on `/api/simulate` and `/api/score` — the UI gate is not the security boundary |

---

## 6. Non-functional requirements

| Area | Requirement | Measured |
|---|---|---|
| **Scroll** | No frame below 30fps | 0/246 frames; worst 16.7ms |
| **Layout stability** | CLS < 0.1 on every screen | landing 0.011 · track record 0.040 · situation 0.039 |
| **Chat latency** | First token < 4s | 1.5–1.8s |
| **Animation** | `transform`/`opacity` only — no layout property transitions | asserted in suite |
| **Reduced motion** | Finished state shown immediately, never a stalled one | asserted |
| **Mobile** | Zero horizontal bleed at 390px | 0px |
| **Resilience** | Full render with every upstream blocked | asserted (airplane-mode test) |
| **Accessibility** | One polite live-region announcement per loading area; skeletons `aria-hidden` | asserted |

---

## 7. Technical architecture

### 7.1 Stack

Next.js 14.2 (App Router) · React 18.3 · TypeScript 5.6.3 · Tailwind CSS v4
· MongoDB Atlas · Gemini · Firebase Auth · Vercel

**Deliberate dependency choices**

- **Hand-rolled auth, not Auth.js.** No cryptography is invented — scrypt,
  CSPRNG, SHA-256, `jose` for JWKS. What is hand-written is the plumbing,
  which keeps the whole surface in four readable files. Auth.js v5 is beta
  and its Credentials provider fits an email-OTP flow badly.
- **No `firebase-admin`.** A Firebase ID token is an ordinary RS256 JWT at a
  standard JWKS endpoint; `jose` verifies it in a dozen lines with no
  service-account private key to hold or leak.
- **Plain SMTP, not an email SDK.** Free tiers of transactional providers
  only deliver to your own address until a domain is verified — which fails
  silently for every other user.

### 7.2 Data flow

```
Yahoo Finance (primary) ─┐
Twelve Data (fallback)   ├─→ market-data.ts ─→ Mongo cache ─→ API route ─→ client
Google News RSS ─────────┘         │
                                   └─ stale-while-revalidate:
                                      a stale doc is served instantly,
                                      refreshed in the background
```

Cache keys are namespaced by `CACHE_SCHEMA` (currently `v4`), so a payload
shape change retires the entire cache at once instead of serving a mix.

### 7.3 Cache TTLs

| Tier | TTL |
|---|---|
| quotes | 300s |
| stocks | 900s |
| news | 900s |
| simulations | 86,400s |
| model health | 300s |

### 7.4 Storage design — the immutability constraint

Principle 3 dictates two decisions that look odd without it:

- **Decision documents are never rewritten.** When an account adopts an
  anonymous browser history, ownership is resolved *at read time* against a
  list on the user. Rewriting the `who` field on historical rows would make
  "written before the outcome and never revised" literally false.
- **An anonymous id can be claimed once.** The first account to adopt it
  owns it; every later claim is refused. A leaked id therefore cannot be
  used to attach to — or steal — a record that already belongs to someone.

**Storage keys are frozen across the rename.** The Mongo database is still
`plumbline`, the session cookie `plumbline_session`, the anonymous id
`plumbline.who`. Renaming them does not rename anything — it points the app
at a new, empty place and orphans every account and every recorded decision.
Each carries a source comment saying so.

### 7.5 Environment

| Variable | Required | Effect if absent |
|---|---|---|
| `MONGODB_URI` | ✅ | App will not boot |
| `GEMINI_API_KEY` | ✅ | App will not boot |
| `TWELVEDATA_API_KEY` | ✅ | App will not boot |
| `NEXT_PUBLIC_FIREBASE_*` | — | Google button falls back to direct OAuth, or hides |
| `GOOGLE_CLIENT_ID` / `_SECRET` | — | Direct OAuth path unavailable |
| `SMTP_*` | — | Email verification unavailable; signup says so |
| `ALLOW_UNVERIFIED_SIGNUP` | — | `1` enables instant signup without SMTP |

All values are **trimmed and unquoted before validation** — a trailing
newline pasted into a hosting dashboard once cost an afternoon of
debugging, because the value looked perfectly correct on screen.

---

## 8. Design system

| Token | Value |
|---|---|
| Paper / paper-deep / card | `#F2E5DE` / `#E8D7CE` / `#FBF6F3` |
| Ink / graphite | `#16181F` / `#5A5E69` |
| Madder (loss) / verdigris (gain) | `#9B2C2C` / `#2F6F62` |
| Rule / focus | `#D9C6BC` / `#2B4C9B` |
| Display / body / data | Archivo · Newsreader · IBM Plex Mono |
| Kannada | Noto Sans Kannada (Archivo has no Kannada glyphs — the name would render as tofu without it) |
| Radius | 3px, everywhere |

**Rules:** hairlines not shadows · no gradients, blobs or glows · colour is
semantic (loss/gain) and never decorative · one moment of motion, then
stillness.

### 8.1 The mascot

ಶಿಷ್ಯ is **the plumb bob with a face** — not a new character. The bob is
already the signature object (the instrument that shows what is actually
vertical, after the wobble stops) and is already shaped like a small hooded
figure. The hanging cord doubles as a śikhā, the tuft a student
traditionally wears.

Five states, driven by real application state: `idle` · `thinking` (while an
answer streams) · `speaking` · `pleased` (one beat after an answer lands) ·
`curious` (when an observation is waiting). It never loops or idles.

---

## 9. Quality gates

`npm run verify` — **147 end-to-end checks, all passing.**

| Section | Covers |
|---|---|
| 0–0b | Suite session; server-side gate on the measurement |
| 1–3 | Market-closed path; unlisted symbol; TradingView BSE feed |
| 4–7 | Error paths; provenance; null handling; simulation integrity |
| 8–11 | Calibration; chat refusals; validated headline; both exhibits |
| 12–12b | Track record; anonymous adoption and claim-once |
| 13–14 | Chat cannot derive a number; airplane mode |
| 14–16 | Landing page; authentication; Firebase |
| 17–19 | Two password accounts coexist; risk profiling; skeleton CLS |

Supporting scripts: `check:sigma` (volatility reproducible against an
independent implementation to `0.000e+0`), `check:hours`, `check:symbols`,
`backtest`, `calibrate`, `factors`.

---

## 10. Known limitations

Stated because the product's credibility depends on stating them.

1. **Direction is not predicted, and that is a measured finding** across six
   attempts — not a missing feature.
2. **Survivorship bias.** The backtest universe is large-cap NSE names that
   still trade today; delisted names never entered it.
3. **Overlapping windows.** 12-month forecasts from 6 windows are not
   independent, so the confidence interval is optimistic.
4. **One market regime.** A crash inside the test window would change every
   number in §1.1.
5. **Fundamentals are point-in-time only for prices.** Yahoo serves only
   *today's* P/E and book value, so fundamental factors were excluded from
   the factor test rather than tested with look-ahead bias.
6. **GBM assumes lognormal returns.** Real returns have fatter tails; the
   band is therefore, if anything, too narrow at the extremes.
7. **Free-tier ceilings.** Gemini allows ~100 questions/day across the
   model chain; Atlas throttles connection bursts.
8. **`ALLOW_UNVERIFIED_SIGNUP=1` disables password reset**, because nothing
   can reach a mailbox.

---

## 11. Open items

| Item | Owner | Note |
|---|---|---|
| Rotate `MONGODB_URI` password, `GEMINI_API_KEY`, `TWELVEDATA_API_KEY` | User | Exposed in plain text during development |
| Publish the Google consent screen | User | While in *Testing*, only listed test users can sign in |
| Add `SMTP_*` for password reset | User | Optional; Google sign-in works without it |
| Gemini billing | User | Lifts the ~100/day free ceiling; Flash costs cents at demo volume |

---

## 12. Compliance posture

- Educational tool. **Not** SEBI-registered investment advice.
- Recommends no trades; the word "buy" is asserted absent from assistant output.
- Holds no money; no broker integration; no order path.
- Stores an email address and nothing else — no phone, no PAN, no KYC.
- Every screen carries the disclaimer; the assistant restates it on request.

---

## Appendix A — Directory structure

```
stockಶಿಷ್ಯ/
│
├── app/                                  Next.js App Router
│   ├── layout.tsx                        Root layout, fonts, metadata
│   ├── page.tsx                          / — landing (static, reads exhibits)
│   ├── landing-client.tsx                Landing client boundary
│   │
│   ├── app/page.tsx                      /app — the instrument
│   ├── login/
│   │   ├── page.tsx                      /login — server shell
│   │   └── login-client.tsx              Suspense + search params
│   │
│   └── api/
│       ├── search/route.ts               Symbol search, fuzzy, ranked
│       ├── quote/[symbol]/route.ts       Live or last-close quote
│       ├── stock/[symbol]/route.ts       History + fundamentals
│       ├── news/[symbol]/route.ts        Google News RSS, filtered + audited
│       ├── simulate/route.ts             Monte Carlo        🔒 auth
│       ├── score/route.ts                Component score    🔒 auth
│       ├── chat/route.ts                 ಶಿಷ್ಯ, streaming
│       ├── decisions/route.ts            Track record       🔒 auth
│       ├── profile/route.ts              Risk profile       🔒 auth
│       ├── calibration/route.ts          Published exhibits
│       ├── recent/route.ts               Recently measured tickers
│       ├── health/route.ts               Env + Mongo diagnostics
│       └── auth/
│           ├── signup · verify · resend  Email + 6-digit code
│           ├── login · logout · me       Password, session, identity
│           ├── forgot · reset            Password reset by code
│           ├── adopt                     Claim anonymous history
│           ├── firebase                  Firebase ID token → session
│           └── google/{start,callback}   Direct OAuth + PKCE (fallback)
│
├── lib/                                  Server-side
│   ├── simulate.ts                       GBM, 10k paths, seeded PRNG
│   ├── sim-payload.ts                    ONE builder, shared by route + prewarm
│   ├── score.ts                          Component scoring, null-safe
│   ├── market-data.ts                    Yahoo → Twelve Data → cache
│   ├── market-hours.ts                   IST sessions, holidays, UTC-server trap
│   ├── symbols.ts                        2,291 NSE symbols, TradingView mapping
│   ├── news.ts                           RSS fetch, relevance filter, audit
│   ├── chat.ts                           Model chain, cooldowns, system prompt
│   ├── decisions.ts                      Immutable records, Brier scoring
│   ├── risk-profile.ts                   Constraint checking (shared with client)
│   ├── users.ts                          Accounts, sessions, pending, throttle
│   ├── auth.ts                           scrypt, tokens, OTP, timing-safe compare
│   ├── current-user.ts                   Session cookie → user
│   ├── require-auth.ts                   Server-side gate
│   ├── signin.ts                         Session establishment + adoption
│   ├── google.ts                         OAuth: state, PKCE, JWKS
│   ├── firebase-verify.ts                Firebase ID token verification
│   ├── mailer.ts                         SMTP, templates
│   ├── mongo.ts                          Pooled client, cache tier, TTLs
│   ├── exhibits.ts                       Backtest files → page stats
│   ├── env.ts                            Validation, trimming
│   ├── api.ts                            Typed response contract
│   └── types.ts                          Shared types, error codes
│
├── src/                                  Client
│   ├── App.jsx                           Phase machine, session, gate
│   ├── index.css                         Tokens, base, skeletons, Kannada
│   │
│   ├── screens/
│   │   ├── Entry.jsx                     Search, amount, conviction
│   │   ├── Computing.jsx                 Sequenced work log
│   │   ├── Results.jsx                   Module composition
│   │   ├── Methodology.jsx               How it works, in full
│   │   ├── TrackRecord.jsx               Your record vs the model's
│   │   └── RiskProfile.jsx               Four questions, no label
│   │
│   ├── modules/
│   │   ├── GapModule.jsx                 The headline: felt vs measured
│   │   ├── FanChart.jsx                  10,000 paths as ink
│   │   ├── CandleChart.jsx               Own-data OHLC
│   │   ├── StockModule.jsx               Fundamentals + TradingView
│   │   ├── ScoreModule.jsx               Component breakdown
│   │   ├── SipModule.jsx                 Lumpsum vs SIP
│   │   ├── NewsModule.jsx                Headlines, with audit
│   │   ├── CalibrationModule.jsx         Does this model work?
│   │   ├── SituationCheck.jsx            Profile vs simulation
│   │   └── VerdictModule.jsx             The closing statement
│   │
│   ├── components/
│   │   ├── Shishya.jsx                   ★ The mascot, 5 states
│   │   ├── PlumbCompanion.jsx            Docked mascot + observation
│   │   ├── ConversationPanel.jsx         Chat, streaming, citations
│   │   ├── Chrome.jsx                    Masthead, footer, identity
│   │   ├── Skeleton.jsx                  Loading placeholders
│   │   ├── Inputs.jsx · Rail.jsx         Amount, conviction rail
│   │   ├── States.jsx                    Failed, empty, stale-cache
│   │   └── marks/Marks.jsx               Ticks, arrows, primitives
│   │
│   ├── auth/
│   │   ├── AuthScreen.jsx                5 steps in one screen
│   │   ├── CodeInput.jsx                 6 boxes, paste, autofill
│   │   ├── auth.css · constants.js
│   │
│   ├── landing/
│   │   ├── Landing.jsx                   Hero → problem → fan → name →
│   │   │                                 evidence → receipt → close
│   │   └── landing.css
│   │
│   └── lib/
│       ├── client.js                     API client, typed errors
│       ├── auth-client.js                Auth calls
│       ├── firebase-client.js            Popup → ID token (dynamic import)
│       ├── adapt.js                      API shape → view shape
│       ├── starters.js                   Chat openers, derived + guarded
│       ├── observe.js                    Mascot observations, weighted
│       ├── format.js                     ₹, lakh/crore, null-safe
│       ├── viz.js · highlight.js · hooks.js
│
├── data/                                 Committed exhibits + reference
│   ├── calibration.json                  120 band forecasts, 87%
│   ├── probability-calibration.json      240 direction forecasts, −3.4%
│   ├── factor-test.json                  5 factors, held-out
│   ├── sector-medians.json               499 NIFTY 500 constituents
│   ├── nse-symbols.csv                   2,291 EQ symbols
│   ├── nifty500.csv · symbol-aliases.json · tv-overrides.json
│
├── scripts/
│   ├── verify.mjs                        147 end-to-end checks
│   ├── backtest.ts                       Band calibration
│   ├── calibrate-probabilities.ts        Direction + Brier
│   ├── factor-test.ts                    5 factors, train/test split
│   ├── build-sector-medians.ts           NIFTY 500 medians
│   ├── prewarm.ts                        Cache the demo tickers
│   ├── verify-sigma.ts                   σ vs independent implementation
│   └── test-market-hours.ts · test-symbols.ts
│
├── PRD.md · README.md
├── next.config.js · tsconfig.json · postcss.config.mjs
├── package.json
└── .env.example                          Every variable, documented
```

🔒 = requires an authenticated session, enforced server-side.

---

## Appendix B — Commands

```bash
npm run dev              # localhost:3000
npm run build            # production build
npm run verify           # 147 end-to-end checks
npm run prewarm          # cache demo tickers
npm run backtest         # regenerate band calibration
npm run calibrate        # regenerate direction calibration
npm run factors          # regenerate the factor test
npm run check:sigma      # volatility vs independent implementation
npm run check:hours      # market states + the UTC-server trap
npm run check:symbols    # resolution, ranking, the SODEXO case
```
