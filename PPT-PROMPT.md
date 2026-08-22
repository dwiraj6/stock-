# Prompt for generating the stockಶಿಷ್ಯ deck in the CodeFury 9.0 template

Paste everything below the line into Claude, and attach
`CodeFury 9.0 Presentation Template.pptx`.

---

I am attaching **CodeFury 9.0 Presentation Template.pptx**. Build my hackathon
deck inside it. **The template's visual identity is fixed and must not change in
any way.** You are only replacing the content.

## PART 1 — THE TEMPLATE SPEC. Obey exactly.

I have already inspected the file. These are its real values, not guesses. Do not
substitute anything.

**Canvas** 20 in × 11.25 in (1920 × 1080 px, 16:9). Do not resize.

**Background** Pure white on every slide. Never add a coloured, textured, dark or
image background to any slide.

**Colour — the entire palette, nothing else may be introduced**

| Role | Hex | Where it is used |
|---|---|---|
| Ink | `#034697` | ALL text, every slide, no exceptions |
| Deep accent | `#3A73AE` | decorative rectangles |
| Mid accent | `#93C4F6` | decorative rectangles |
| Pale accent | `#C2E1FE` | decorative rectangles, chart fills |
| Ground | `#FFFFFF` | background |

There is no second brand colour. There is no red, green, orange, purple, teal or
grey in this deck. If a diagram needs to distinguish two things, use two of the
blues above plus white — that is the whole range and it is enough.

**Type — four faces, each with one job. Do not add a fifth.**

| Role | Face | Size |
|---|---|---|
| Huge display (closing slide only) | Anek Kannada ExtraBold | 124 pt |
| Slide title | Franklin Gothic Demi | 60 pt |
| Section heading | Futura Bold | 44 pt / 40 pt |
| Sub-label, small caps line | Futura Bold | 36 pt |
| Body text | Varela Round | 32 pt |
| Chart labels, axis numbers, captions | Varela Round | 18–24 pt |

Never use Calibri, Inter, Poppins, Montserrat, Roboto, Space Grotesk, or any
system default. If a face is unavailable, keep the name in the file anyway — do
not swap it for a lookalike.

**Geometry** The template uses **rectangles only**. Every decorative element is a
plain rectangle with square corners. Do not introduce circles, pills, rounded
corners, blobs, waves, arcs, or any other shape as decoration. Straight lines and
rectangles are the entire vocabulary.

**The repeating motif** Every slide carries the same set of six small
rectangles — two `#93C4F6`, two `#C2E1FE`, two `#3A73AE` — anchored at the slide
edges. **Preserve these on every slide you produce, in the same positions.** They
are the template's signature.

**Slide 1 is the CodeFury branded cover. Do not touch it at all** — not the
images, not the shapes, not the layout. Leave it exactly as it arrived.

## PART 2 — ABSOLUTE BANS

Producing any of these means the slide is wrong and must be redrawn.

- **No gradients.** Not in backgrounds, not in shape fills, not in text, not as a
  "subtle" overlay. Flat fills only.
- **No emoji.** Anywhere. Not as bullets, not as icons, not in headings.
- **No icon fonts or clip-art icon sets.** No Font Awesome, no Noun Project
  glyphs, no little line-icons above every heading. If something needs a mark,
  draw it from rectangles and lines in the palette.
- **No drop shadows, glows, bevels, 3-D effects, or glassmorphism.**
- **No stock photography and no AI-generated illustration.**
- **No "01 / 02 / 03" numbered eyebrows** above every section, and no tiny
  uppercase tracked kicker above every heading. Both are the tell.
- **No identical three-card grids** with an icon, a heading and a paragraph
  repeated across the slide.
- **No centred-everything layouts.** Use the left edge as a real axis.
- **No bullet lists longer than four items,** and no slide that is only bullets.

## PART 3 — THE RULE THAT MATTERS MOST: VISUALS OVER TEXT

**Every content slide must be more diagram than paragraph.** Target roughly
70 % visual, 30 % text by area. A slide of prose is a failed slide.

Crucially: **the visuals must be drawn from the product's own artefacts, not
generic infographics.** Below I give you the exact diagrams to draw. Each one is
a real thing the product produces. Draw them as native PowerPoint shapes —
rectangles, lines, text boxes — in the palette above. Never as an image, never as
a screenshot placeholder.

## PART 4 — THE PRODUCT

**Name** stockಶಿಷ್ಯ — written exactly like that, Latin "stock" joined directly to
the Kannada ಶಿಷ್ಯ, no space, no hyphen.
Set the Kannada in **Anek Kannada ExtraBold** wherever the name appears (it is in
the template already). Set "stock" in the surrounding face. Size the Kannada at
about **0.86×** the Latin size — Kannada carries a taller x-height and will
otherwise look oversized beside it.

**Tagline** conviction, measured

**What it is** An educational tool that measures the distance between how
confident an Indian retail investor *feels* about a stock and how confident the
*data* actually is — then writes both numbers down, before the outcome exists, so
that twelve months later it can be checked who was right.

**Why the name** ಶಿಷ್ಯ (*shishya*) means **student** — not guru, not oracle. It
is the only honest name for a model that gets the range right 87 % of the time
and scores *worse than a coin flip* on direction, and publishes both.

**Every number below is real and reproducible from the repository. Do not invent,
round differently, or add any statistic I have not given you.**

| Figure | Value |
|---|---|
| Band accuracy | 87 % of 120 point-in-time forecasts inside the 80 % band, 6 windows |
| Direction skill | **−3.4 %** across 240 forecasts — worse than the base rate |
| Model Brier | 0.2413 vs 0.2333 for a strategy that ignores the stock |
| Base rate | 63 % of stocks rose over the test period |
| Factors tested | 5 price factors, 300 train / 150 held out — best was −7.0 % |
| Coverage | 2,291 NSE EQ symbols |
| Sector medians | 499 NIFTY 500 constituents |
| Simulation | 10,000 GBM paths, 252 trading days, seeded and reproducible |
| Chat latency | first token in 1.5–1.8 s |
| Test suite | 147 end-to-end checks passing |
| Scroll | 0 frames below 30 fps; CLS 0.011–0.040 |

## PART 5 — SLIDE BY SLIDE

Keep the template's six-slide skeleton and expand the middle. 10–12 slides total.

---

**SLIDE 1 — CodeFury cover.** Untouched. Skip it.

---

**SLIDE 2 — Title** *(use the template's existing 60 pt / 36 pt slots)*

- Team name: **[I WILL FILL THIS IN]**
- Project: **stockಶಿಷ್ಯ** — set large, Franklin Gothic Demi, with the Kannada in
  Anek Kannada ExtraBold
- Under it, small: *conviction, measured*
- Team members: **[I WILL FILL THIS IN]**

**Visual** In the empty right half, draw a **plumb bob**: one vertical 1 pt line
in `#034697` about 380 px long, ending in a solid teardrop (a narrow triangle
with a rounded top works). This is the product's logo mark and it recurs
throughout the deck. Nothing else on this slide.

---

**SLIDE 3 — The problem**

Heading (Futura Bold 44 pt): **Confidence is easy to feel and impossible to
check.**

Body (Varela Round 32 pt, maximum three short lines):
> Every stock tool outputs confidence — a BUY rating, a target price, a 9/10
> score. Almost none output uncertainty, and none are ever scored against what
> actually happened.

**Visual — THE GAP RAIL. This is the single most important diagram in the deck.
Give it at least half the slide.**

Draw a horizontal line 1 pt `#034697`, about 1100 px wide, centred in the lower
half. Put small tick marks and labels beneath it at 0, 20, 40, 60, 80, 100
(Varela Round 18 pt).

- **Above** the line at the 72 % position: a small solid downward triangle in
  `#034697`, labelled `you 72`
- **Below** the line at the 62 % position: a small hollow upward triangle
  (`#034697` outline, white fill), labelled `the data 62`
- **Between 62 and 72**, above the line: a **dimension line** — a horizontal
  segment with a short vertical tick at each end, exactly like an engineering
  drawing — labelled `the gap`

Caption in `#3A73AE`, Varela Round 20 pt:
*Both numbers are the odds of the same thing. One you felt. The other is a count
of ten thousand simulated futures.*

---

**SLIDE 4 — What it shows you**

Heading (Futura Bold 40 pt): **Ten thousand futures, drawn as ink.**

**Visual — THE FAN. Full slide width, minimal text.**

Draw a fan of outcome paths: roughly 40–60 thin polylines in `#93C4F6`, all
starting from a single point at the left edge and spreading outward to the right
into a cone, with a single darker `#034697` line through the middle for the
median. The cone should be widest at the right. Use low-opacity thin strokes so
the overlap reads as density.

One line of body underneath (Varela Round 24 pt):
*Where the ink is dark, many futures landed there. The honest answer to “what
will this do” is the whole shape.*

---

**SLIDE 5 — The finding that shapes the product** *(the strongest slide — put
real weight here)*

Heading (Futura Bold 40 pt): **We tested ourselves and published what failed.**

**Visual — a comparison bar pair, drawn as rectangles.** Two horizontal bars,
same length scale, labelled with the Brier scores. Lower is better, so say so.

- Bar A — `#93C4F6` — “Ignore the stock entirely. Say 63 % every time.” → **0.2333**
- Bar B — `#3A73AE` — “Our model. 500 days of history, 10,000 simulations.” → **0.2413**

Then, large, in `#034697` Futura Bold 44 pt: **−3.4 %**
and beside it, Varela Round 24 pt: *the lazy strategy won*

**Below, a small table** (rectangles and 1 pt rules only, no table styling, no
alternating fills) titled *Six attempts, zero signals*:

| Attempt | Skill |
|---|---|
| Full estimated drift | −51.0 % |
| Drift shrunk to 50 % | −30.3 % |
| Drift shrunk to 25 % | −20.1 % |
| Zero drift | −13.9 % |
| Flat +8 %/yr — shipped | −3.4 % |
| 5 price factors, held out | −7.0 % |

---

**SLIDE 6 — What it *does* get right**

Heading (Futura Bold 40 pt): **It cannot pick the direction. It can size the
uncertainty.**

**Visual — split the slide into two rectangles**, `#C2E1FE` left, white with a
1 pt `#034697` border right. Inside each, one enormous numeral in `#034697`:

- Left: **87 %** — *of 120 point-in-time forecasts landed inside the predicted
  80 % band, across 6 windows*
- Right: **−3.4 %** — *skill on direction across 240 forecasts. Published in the
  same size type.*

Draw them at the same size. That equality is the point of the slide.

---

**SLIDE 7 — The receipt** *(what makes it different)*

Heading (Futura Bold 40 pt): **It writes down what you believed, before you
knew.**

**Visual — draw a receipt.** A white rectangle with a 1 pt `#034697` border,
about 520 px wide, with thin horizontal rules between rows and monospaced-looking
right-aligned values:

```
RELIANCE                      ₹50,000
you said                    72 in 100
the simulation said         62 in 100
price that day              ₹1,316.00
─────────────────────────────────────
        SEALED · OPENS IN 12 MONTHS
```

Body beside it (Varela Round 28 pt, two lines max):
*Neither number can be edited afterwards. A year later the price decides, and you
are scored the same way the model scores itself.*

---

**SLIDE 8 — How it works** *(architecture, drawn not described)*

Heading (Futura Bold 40 pt): **How it works**

**Visual — a left-to-right flow of plain rectangles joined by 1 pt lines with
small solid triangular arrowheads.** No rounded corners, no shadows, no icons.

```
Yahoo Finance ┐
Twelve Data   ├─→ market data ─→ Mongo cache ─→ simulation ─→ the gap
Google News   ┘                  (stale-while-      10,000
                                  revalidate)        paths
```

Under it, one line of specification text in `#3A73AE`, Varela Round 20 pt:
*Next.js 14 · MongoDB Atlas · Gemini · Firebase Auth · Vercel — 2,291 NSE
symbols, sector medians from 499 NIFTY 500 constituents.*

---

**SLIDE 9 — The features, as evidence not as a list**

Heading (Futura Bold 40 pt): **Four things, each measured**

**Visual — a 2 × 2 grid of plain rectangles**, alternating white and `#C2E1FE`,
each holding one large numeral and one short line. No icons.

- **147** — end-to-end checks passing, including airplane mode with every
  upstream blocked
- **1.6 s** — to the assistant's first word, streaming, grounded only in the
  numbers on the page
- **12 months** — before a decision is scored, and it cannot be edited in between
- **0** — frames below 30 fps while scrolling

---

**SLIDE 10 — Risk profiling** *(if space allows)*

Heading (Futura Bold 40 pt): **No label. A constraint check.**

Body (two lines): *Every other profiler ends at “you are a Moderate Investor” —
an output nobody can ever check. We collect three constraints and test them
against the simulation already running.*

**Visual — three stacked rows**, each a plain rectangle with a 1 pt rule, showing
a stated limit against a measured value:

| You said | The simulation says |
|---|---|
| “I can lose at most ₹2,000” | one future in ten ends ₹8,747 down |
| “A 20 % fall would make me sell” | 8 % chance — one future in 13 |
| “I need this within a year” | the band settles over twelve months |

---

**SLIDE 11 — THANK YOU** *(the template's existing closing slide)*

Keep **THANK YOU** at 124 pt in Anek Kannada ExtraBold, `#034697`, exactly as the
template has it. Add underneath, small (Varela Round 24 pt):

> stockಶಿಷ್ಯ — conviction, measured
> Educational tool. Not registered investment advice. It does not recommend
> trades.

Draw the plumb bob mark once more beside it.

---

## PART 6 — VOICE

Write like an engineer stating findings, not like marketing.

- Short declarative sentences. No exclamation marks.
- Never the words *revolutionary, seamless, cutting-edge, empower, leverage,
  game-changing, unlock, transform, journey, ecosystem*.
- Every claim on a slide must be backed by one of the numbers above.
- Say what the product *cannot* do as plainly as what it can. That is the
  argument, not a caveat.

## PART 7 — BEFORE YOU RETURN THE FILE, CHECK

1. Slide 1 is byte-identical to the original.
2. The six-rectangle blue motif is on every slide, in the same place.
3. Every background is white. No gradient exists anywhere in the file.
4. Only `#034697`, `#3A73AE`, `#93C4F6`, `#C2E1FE`, `#FFFFFF` appear.
5. Only the four named fonts appear.
6. Every shape is a rectangle or a straight line.
7. No emoji, no icons, no photographs, no AI imagery.
8. Every content slide is more diagram than text.
9. Every number matches Part 4 exactly.
10. stockಶಿಷ್ಯ is spelled correctly, unspaced, with the Kannada in Anek Kannada
    ExtraBold at ~0.86× the Latin size.

Return the finished `.pptx`.
