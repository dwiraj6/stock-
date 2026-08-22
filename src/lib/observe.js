/* WHAT THE BOB NOTICES.
   ────────────────────────────────────────────────────────────────
   A proactive line, chosen from the payload already on screen.

   Deliberately NOT generated. Three reasons, in order of weight:

     1. It cannot be wrong. Every sentence below is a template over
        numbers the page is already displaying, so the bob can never
        contradict the chart beside it.
     2. It costs nothing. The free Gemini tier allows 20 requests per
        model per day; a greeting on every page load would spend that
        during one demo and leave nothing for real questions.
     3. It is instant. A generated greeting arrives seconds late,
        which is exactly when a greeting stops being welcome.

   Each candidate carries a weight. The heaviest one wins, so the bob
   says the single most interesting true thing about THIS page rather
   than the first thing in a list. */

import { rupees } from './format.js';

/**
 * @returns {{ text: string, followUp: string, weight: number } | null}
 */
export function observe(run) {
  if (!run) return null;
  const { quote, model, sim, amount, news } = run;
  const cands = [];

  const userPct = Math.round((model?.userProb ?? 0) * 100);
  const modelPct = model?.modelProb != null ? Math.round(model.modelProb * 100) : null;
  const gap = modelPct === null ? null : userPct - modelPct;
  const widthPct = model?.width != null ? Math.round(model.width * 100) : null;

  /* ── the spread, when it is genuinely wide ──
     The most useful thing this product knows, and the only thing its
     backtest validates. */
  if (widthPct !== null && widthPct >= 80) {
    cands.push({
      weight: 100,
      text: `The spread on ${quote.ticker} covers ${widthPct}% of what you'd put in — the range of outcomes is about as wide as the stake itself.`,
      followUp: 'Why is the range so wide?',
    });
  } else if (widthPct !== null && widthPct >= 55) {
    cands.push({
      weight: 60,
      text: `The middle 80% of outcomes here spans ${widthPct}% of your stake — ${rupees(model.band.p10)} to ${rupees(model.band.p90)}.`,
      followUp: 'What makes the range this wide?',
    });
  }

  /* ── the gap, when it is large ── */
  if (gap !== null && Math.abs(gap) >= 20) {
    cands.push({
      weight: 95,
      text:
        gap > 0
          ? `You put the odds at ${userPct} in 100. The simulation says ${modelPct}. That is a ${gap}-point gap, and it is the biggest thing on this page.`
          : `You put the odds at ${userPct} in 100 — ${Math.abs(gap)} points below the simulation's ${modelPct}. You are being harder on this stock than the numbers are.`,
      followUp: 'Where does that gap come from?',
    });
  } else if (gap !== null && Math.abs(gap) <= 3) {
    cands.push({
      weight: 40,
      text: `You said ${userPct} in 100 and the simulation said ${modelPct}. That close is rarer than you'd think.`,
      followUp: 'What is driving the simulation to that number?',
    });
  }

  /* ── a component that is genuinely weak ── */
  const weakest = (model?.components ?? [])
    .filter((c) => c.key !== 'dataQuality' && Number.isFinite(c.score))
    .sort((a, b) => a.score - b.score)[0];
  if (weakest && weakest.score <= 3.5) {
    cands.push({
      weight: 80,
      text: `${weakest.name} scores ${weakest.score} out of 10 here — ${lower(weakest.metric)}.`,
      followUp: `Explain the ${weakest.name.toLowerCase()} score`,
    });
  }

  /* ── a metric the source simply does not have ──
     Worth saying out loud: a gap in the data changes how much weight
     the score deserves, and most tools hide it. */
  const missing = (model?.components ?? []).flatMap((c) => c.missing ?? []);
  if (missing.length >= 2) {
    cands.push({
      weight: 55,
      text: `Two things aren't reported for ${quote.ticker} — ${missing.slice(0, 2).join(' and ')}. The score works around them rather than guessing.`,
      followUp: 'How does a missing metric change the score?',
    });
  }

  /* ── thin history ── */
  if (quote?.daysAvailable && quote.daysAvailable < 250) {
    cands.push({
      weight: 90,
      text: `${quote.ticker} only has ${quote.daysAvailable} trading days of history. The simulation still runs, but treat the band as wider than drawn.`,
      followUp: 'Why does short history matter?',
    });
  }

  /* ── SIP genuinely helps ── */
  if (model?.suggestion?.p10ImprovementPct >= 25) {
    cands.push({
      weight: 70,
      text: `Spreading this across twelve months instead of one payment cuts the worst case by ${model.suggestion.p10ImprovementPct}%.`,
      followUp: 'Explain the SIP comparison',
    });
  }

  /* ── the honest fallback ── */
  if (news?.items?.length) {
    cands.push({
      weight: 20,
      text: `There are ${news.items.length} recent headlines about ${quote.ticker} on this page. None of them are in the score — the model can't read news.`,
      followUp: 'What can the model actually see?',
    });
  }
  cands.push({
    weight: 10,
    text: `Everything on this page comes from ${quote.daysAvailable ?? 'the'} trading days of real prices. Ask me about any number on it.`,
    followUp: 'Why is the score what it is?',
  });

  cands.sort((a, b) => b.weight - a.weight);
  return cands[0] ?? null;
}

function lower(s) {
  return typeof s === 'string' && s.length ? s.charAt(0).toLowerCase() + s.slice(1) : '';
}
