# Prompt — CodeFury 9.0 template, slides 3, 4 and 5 only

Paste everything below the rule into Claude with
`CodeFury 9.0 Presentation Template.pptx` attached.

---

I am attaching **CodeFury 9.0 Presentation Template.pptx**.

**Fill in slides 3, 4 and 5 only.** Do not touch slides 1, 2 or 6 — leave them
exactly as they arrived. Do not add or delete slides. Do not change the theme,
the background, the colours, the fonts, or the decorative shapes.

## 1 · THE TEMPLATE'S RULES — these are read from the file, not guessed

**Canvas** 20 in × 11.25 in (1920 × 1080). Never resize.

**Background** Pure white. Never add a fill, image or texture to a slide.

**Colour — the complete palette. Nothing else may appear.**

| Hex | Use |
|---|---|
| `#034697` | ALL text, and the main diagram strokes |
| `#3A73AE` | secondary diagram fills, captions |
| `#93C4F6` | diagram fills |
| `#C2E1FE` | pale panel fills |
| `#FFFFFF` | background |

No red, green, orange, grey or black anywhere. Where a diagram must separate two
things, use two of these blues plus white.

**Fonts — three faces on these slides. Do not introduce a fourth.**

| Role | Face | Size |
|---|---|---|
| Slide heading | **Futura Bold** | 44 pt (slide 3) / 40 pt (slides 4–5) |
| Body | **Varela Round** | 32 pt |
| Diagram labels, axis numbers, captions | **Varela Round** | 18–24 pt |

Never Calibri, Inter, Poppins, Montserrat, Roboto or any system default.

**Geometry** The template is **rectangles and straight lines only** — every
existing shape is a square-cornered rectangle. Do not add circles, rounded
corners, pills, blobs, waves or arcs.

**Alignment — important.** This template is **centre-aligned**. Headings are
centred across the slide; body blocks are centred beneath them. Keep that. Do not
switch to a left-aligned or asymmetric layout.

**The decorative motif** Each of these slides already carries six small
rectangles — two `#93C4F6`, two `#C2E1FE`, two `#3A73AE` — at the slide edges.
**Leave every one of them exactly where it is.**

## 2 · EXISTING BOX POSITIONS — reuse these, do not move them

Measured from the file. Keep the heading and body boxes where they are; place new
diagrams in the free space noted.

**Slide 3**
- Heading box — x 5.70 in, y 1.74 in, w 8.61 in, h 1.58 in · 44 pt Futura Bold
- Body box — x 2.78 in, y 4.13 in, w 14.44 in, h 4.41 in · 32 pt Varela Round
- *Shrink the body box to about h 1.4 in and put the diagram in the space freed
  below it.*

**Slide 4**
- Heading box — x 7.23 in, y 1.59 in, w 5.53 in, h 1.45 in · 40 pt Futura Bold
- Body box 1 — x 1.60 in, y 3.36 in, w 17.42 in, h 1.96 in
- Body box 2 — x 1.60 in, y 6.25 in, w 17.42 in, h 1.96 in
- *Keep box 1 as text. Replace box 2's text with the diagram.*

**Slide 5**
- Heading box — x 7.23 in, y 1.59 in, w 5.53 in, h 1.45 in · 40 pt Futura Bold
- Everything below y 3.1 in is free canvas.

## 3 · ABSOLUTE BANS

Any of these means the slide is wrong.

- No gradients — not in fills, not in text, not as an overlay. Flat colour only.
- No emoji, anywhere.
- No icons, icon fonts or clip-art. If something needs a mark, draw it from
  rectangles and lines.
- No drop shadows, glows, bevels, 3-D or glass effects.
- No stock photos and no AI-generated imagery.
- No `01 / 02 / 03` numbered markers and no tiny uppercase tracked kicker above
  headings.
- No three identical cards with an icon, a heading and a paragraph.
- No bullet list longer than four items. No slide that is only bullets.

## 4 · THE RULE THAT MATTERS MOST

**Each of these three slides must be more diagram than text — roughly 70 % of
the area visual, 30 % text.** A slide of paragraphs is a failed slide.

The diagrams are specified exactly below. Draw every one as **native PowerPoint
shapes** — rectangles, straight lines, triangles, text boxes — in the palette
above. Never as an inserted image and never as a placeholder.

## 5 · THE PRODUCT

**stockಶಿಷ್ಯ** — written exactly so: Latin "stock" joined straight to the Kannada
ಶಿಷ್ಯ, no space, no hyphen. Set the Kannada in **Anek Kannada ExtraBold** (already
in this template) at about **0.86×** the size of the Latin beside it, or it will
look oversized.

**Tagline** conviction, measured

**Every figure below is real. Do not invent, re-round, or add any statistic I
have not given you.**

| Figure | Value |
|---|---|
| Band accuracy | 87 % of 120 point-in-time forecasts inside the 80 % band, 6 windows |
| Direction skill | −3.4 % over 240 forecasts — worse than the base rate |
| Brier | 0.2413 model vs 0.2333 for ignoring the stock entirely |
| Base rate | 63 % of stocks rose across the test period |
| Factors | 5 price factors, 300 train / 150 held out, best −7.0 % |
| Coverage | 2,291 NSE EQ symbols |
| Sector medians | 499 NIFTY 500 constituents |
| Simulation | 10,000 GBM paths, 252 trading days, seeded |

---

# SLIDE 3 — Theme & Problem Statement

**Heading** (44 pt Futura Bold, centred, keep the existing box):

> Confidence is easy to feel and impossible to check.

**Body** (32 pt Varela Round `#034697`, centred, shrink the box to ~2 lines):

> Every stock tool outputs confidence — a rating, a target price, a score out of
> ten. Almost none output uncertainty, and none are ever scored against what
> actually happened.

**DIAGRAM — the gap rail. Give it the whole lower half.**

This is the product's signature and the most important drawing in the deck.

- A horizontal line, 1 pt `#034697`, about 13 in wide, centred, at roughly
  y 6.6 in.
- Beneath it, small tick marks and labels at 0, 20, 40, 60, 80, 100 — Varela
  Round 18 pt `#3A73AE`.
- **Above** the line at the 72 % point: a small **solid** downward-pointing
  triangle, `#034697`, with the label `you 72` above it (Varela Round 20 pt).
- **Below** the line at the 62 % point: a small **hollow** upward-pointing
  triangle — `#034697` outline, white fill — labelled `the data 62` beneath.
- **Between the 62 % and 72 % points**, sitting just above the line: a
  **dimension line** — one horizontal segment with a short vertical tick at each
  end, exactly as on an engineering drawing — labelled `the gap` above it.

**Caption** centred under the diagram, Varela Round 20 pt `#3A73AE`:

> Both numbers are the odds of the same thing: ending a year from now with more
> money than you put in. One of them you felt. The other is a count of ten
> thousand simulated futures.

---

# SLIDE 4 — Your Idea / Solution

**Heading** (40 pt Futura Bold `#034697`, centred, keep the existing box):

> Ten thousand futures, drawn as ink.

**Body — reuse box 1 only** (32 pt Varela Round `#034697`, centred, two lines):

> stockಶಿಷ್ಯ simulates 10,000 possible futures for the stock and the amount you
> chose, then shows you the whole distribution instead of a single confident
> number.

**DIAGRAM — replace body box 2 with the fan. Full width, y ≈ 5.6 in to 9.4 in.**

- 40 to 60 thin polylines in `#93C4F6`, roughly 0.75 pt, all beginning at a
  single point on the left edge and spreading rightward into a cone that is
  widest at the right.
- Let them overlap — the density where many lines cross is the entire point.
- One line through the middle in `#034697`, 2 pt, for the median.
- No axes, no gridlines, no frame around it.

**Two small labels** in Varela Round 18 pt `#3A73AE`, placed on the diagram:
`today` at the left origin, `12 months` at the right edge.

**Caption** centred beneath, Varela Round 20 pt `#3A73AE`:

> Where the ink is dark, many futures landed there. Where it is pale, few did.
> The honest answer to *what will this do* is the whole shape.

---

# SLIDE 5 — Your Idea / Solution *(the strongest slide — free canvas below the heading)*

**Heading** (40 pt Futura Bold `#034697`, centred, keep the existing box):

> We tested ourselves and published what failed.

**DIAGRAM A — the comparison, upper half, y ≈ 3.4 in to 5.6 in.**

Two horizontal bars of equal scale, centred, each about 9 in long at full value.
Label clearly that **lower is better**.

- Bar 1 — fill `#93C4F6` — label left: *Ignore the stock. Say 63 % every time.*
  — value right: **0.2333**
- Bar 2 — fill `#3A73AE` — label left: *Our model. 500 days of history, 10,000
  simulations.* — value right: **0.2413**

Draw bar 2 slightly longer than bar 1, in proportion to the numbers.

To the right of the pair, large: **−3.4 %** in Futura Bold 44 pt `#034697`, and
beneath it in Varela Round 20 pt `#3A73AE`: *the lazy strategy won.*

**DIAGRAM B — the attempts table, lower half, y ≈ 6.2 in to 9.4 in.**

A plain table drawn with 1 pt `#034697` horizontal rules only — no vertical
lines, no cell borders, no alternating fills, no header shading. Header row in
Futura Bold 22 pt, body rows in Varela Round 22 pt, values right-aligned.

Title above it, Futura Bold 24 pt `#034697`: **Six attempts, zero signals**

| Attempt | Skill |
|---|---|
| Full estimated drift | −51.0 % |
| Drift shrunk to 50 % | −30.3 % |
| Drift shrunk to 25 % | −20.1 % |
| Zero drift | −13.9 % |
| Flat +8 %/yr — shipped | −3.4 % |
| 5 price factors, held out | −7.0 % |

**Closing line**, centred at the very bottom, Varela Round 20 pt `#3A73AE`:

> None beat the base rate. That is why the tool refuses to forecast direction —
> not as an apology, but as a result. What it *does* get right is the range:
> 87 % of 120 forecasts landed inside the predicted 80 % band.

---

## 6 · VOICE

Write like an engineer stating findings, not like marketing.

- Short declarative sentences. No exclamation marks.
- Never *revolutionary, seamless, cutting-edge, empower, leverage, game-changing,
  unlock, transform, journey, ecosystem*.
- Every claim must be backed by a number from section 5.
- State what the product cannot do as plainly as what it can. That is the
  argument, not a caveat.

## 7 · CHECK BEFORE RETURNING

1. Slides 1, 2 and 6 are untouched.
2. The six decorative rectangles are still in place on slides 3, 4 and 5.
3. All three backgrounds are white; no gradient exists anywhere in the file.
4. Only `#034697`, `#3A73AE`, `#93C4F6`, `#C2E1FE`, `#FFFFFF` appear.
5. Only Futura Bold, Varela Round and Anek Kannada ExtraBold appear.
6. Every shape is a rectangle, a straight line or a triangle.
7. No emoji, icons, photographs or generated imagery.
8. Headings and body remain centre-aligned.
9. Each slide is more diagram than text.
10. Every figure matches section 5 exactly.
11. stockಶಿಷ್ಯ is unspaced, with the Kannada in Anek Kannada ExtraBold at ~0.86×.

Return the finished `.pptx`.
