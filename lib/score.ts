/* The conviction model.
   ────────────────────────────────────────────────────────────────
   Five components, each scored 0–10 and weighted to a 0–100 model
   conviction.

   Two rules make this defensible rather than decorative:

   · A NULL METRIC IS EXCLUDED AND ITS WEIGHT RENORMALISED, never
     scored zero (Part 6.2). Yahoo has no returnOnEquity for
     Reliance and no debtToEquity for HDFC Bank. Scoring those zero
     would punish a company for a gap in someone else's database.

   · EVERY SUBSCORE CARRIES ITS EVIDENCE. `reason` is a template
     string built from the real values, never generated, never
     vague. The UI prints it verbatim under the bar, and a reader
     who checks it against the fundamentals panel finds the same
     numbers. */

import fs from 'node:fs';
import path from 'node:path';
import type { Bar, Fundamentals, Quote } from './types';
import type { SimParams } from './simulate';

export const WEIGHTS = {
  valuation: 0.25,
  volatility: 0.2,
  financial: 0.25,
  momentum: 0.2,
  dataQuality: 0.1,
} as const;

export type Verdict = 'value' | 'higher' | 'lower' | 'level' | 'na';

export type MetricEvidence = {
  label: string;
  value: number | null;
  display: string;
  sectorMedian: number | null;
  sectorMedianDisplay: string | null;
  verdict: Verdict;
  /** True when this metric made the stock look worse. */
  adverse: boolean;
};

export type Component = {
  key: keyof typeof WEIGHTS;
  name: string;
  score: number;
  weight: number;
  metrics: MetricEvidence[];
  reason: string;
  /** Metrics that were unavailable, named so the UI can say so. */
  missing: string[];
};

export type ScoreResult = {
  modelScore: number;
  components: Component[];
  sector: string | null;
  sectorConstituents: number | null;
  sectorMediansGeneratedAt: string | null;
};

/* ── sector medians, loaded once ──────────────────────────────── */

type MedianFile = {
  generatedAt: string;
  sectors: Record<string, { constituents: number; metrics: Record<string, { median: number | null; n: number }> }>;
};

let MEDIANS: MedianFile | null = null;
let MEDIANS_TRIED = false;

export function sectorMedians(): MedianFile | null {
  if (MEDIANS_TRIED) return MEDIANS;
  MEDIANS_TRIED = true;
  try {
    const p = path.join(process.cwd(), 'data', 'sector-medians.json');
    MEDIANS = JSON.parse(fs.readFileSync(p, 'utf8')) as MedianFile;
  } catch {
    MEDIANS = null;
  }
  return MEDIANS;
}

export function medianFor(sector: string | null, metric: string): number | null {
  if (!sector) return null;
  const f = sectorMedians();
  const m = f?.sectors?.[sector]?.metrics?.[metric];
  return m && m.median !== null && Number.isFinite(m.median) ? m.median : null;
}

/* ── helpers ──────────────────────────────────────────────────── */

const clamp = (v: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const pctStr = (v: number) => `${(v * 100).toFixed(1)}%`;

/* A metric within 5% of its sector median is 'level' — and a level
   metric is NOT adverse. Deriving `adverse` from a bare > comparison
   would flag TCS's D/E of 0.102 against a median of 0.10 as a
   weakness, which is noise dressed up as evidence. */
function ratioVerdict(value: number, median: number, lowerIsBetter: boolean): Verdict {
  const ratio = value / median;
  if (!Number.isFinite(ratio) || ratio <= 0) return 'na';
  if (ratio > 0.95 && ratio < 1.05) return 'level';
  const worse = lowerIsBetter ? ratio > 1 : ratio < 1;
  return worse ? (lowerIsBetter ? 'higher' : 'lower') : 'value';
}

function times(value: number, median: number): string {
  const ratio = value / median;
  if (!Number.isFinite(ratio) || ratio <= 0) return '';
  return ratio >= 1 ? `${ratio.toFixed(1)}× the sector median` : `${(1 / ratio).toFixed(1)}× below the sector median`;
}

/**
 * Combine sub-signals, each 0–10 with its own weight, skipping any
 * that are unavailable and renormalising what remains. Returns null
 * when nothing at all could be measured.
 */
function combine(parts: { score: number; weight: number }[]): number | null {
  const live = parts.filter((p) => Number.isFinite(p.score));
  if (live.length === 0) return null;
  const total = live.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return null;
  return live.reduce((s, p) => s + p.score * p.weight, 0) / total;
}

/* ── components ───────────────────────────────────────────────── */

function valuation(f: Fundamentals): Component {
  const metrics: MetricEvidence[] = [];
  const missing: string[] = [];
  const parts: { score: number; weight: number }[] = [];

  const peMed = medianFor(f.sector, 'trailingPE');
  if (f.trailingPE !== null && peMed !== null) {
    const ratio = f.trailingPE / peMed;
    parts.push({ score: clamp(10 - 4 * (ratio - 1)), weight: 0.6 });
    metrics.push({
      label: 'P/E',
      value: f.trailingPE,
      display: f.trailingPE.toFixed(1),
      sectorMedian: peMed,
      sectorMedianDisplay: peMed.toFixed(1),
      verdict: ratioVerdict(f.trailingPE, peMed, true),
      adverse: ratioVerdict(f.trailingPE, peMed, true) === 'higher',
    });
  } else missing.push(f.trailingPE === null ? 'P/E' : 'sector P/E median');

  const pbMed = medianFor(f.sector, 'priceToBook');
  if (f.priceToBook !== null && pbMed !== null) {
    const ratio = f.priceToBook / pbMed;
    parts.push({ score: clamp(10 - 4 * (ratio - 1)), weight: 0.4 });
    metrics.push({
      label: 'Price / book',
      value: f.priceToBook,
      display: f.priceToBook.toFixed(2),
      sectorMedian: pbMed,
      sectorMedianDisplay: pbMed.toFixed(2),
      verdict: ratioVerdict(f.priceToBook, pbMed, true),
      adverse: ratioVerdict(f.priceToBook, pbMed, true) === 'higher',
    });
  } else missing.push(f.priceToBook === null ? 'price/book' : 'sector price/book median');

  const s = combine(parts);
  const reason =
    f.trailingPE !== null && peMed !== null
      ? `P/E ${f.trailingPE.toFixed(1)} against sector median ${peMed.toFixed(1)}`
      : f.trailingPE !== null
        ? `P/E ${f.trailingPE.toFixed(1)}; no sector median available to compare against`
        : 'No P/E available — the company has no trailing earnings on record';

  return {
    key: 'valuation',
    name: 'Valuation',
    score: s === null ? 0 : r1(s),
    weight: WEIGHTS.valuation,
    metrics,
    reason,
    missing,
  };
}

function volatility(params: SimParams | null): Component {
  const metrics: MetricEvidence[] = [];
  const missing: string[] = [];
  let score = 0;
  let reason = 'Not enough price history to estimate volatility';

  if (params) {
    const sigmaPct = params.sigmaAnnual * 100;
    // A large-cap Indian equity sits around 20–25% annualised. 12% is
    // very calm, 42% is speculative.
    score = r1(clamp(10 - (sigmaPct - 12) / 3));
    metrics.push({
      label: 'Annualised volatility',
      value: params.sigmaAnnual,
      display: `${sigmaPct.toFixed(1)}%`,
      sectorMedian: null,
      sectorMedianDisplay: null,
      verdict: sigmaPct > 25 ? 'higher' : sigmaPct < 18 ? 'value' : 'level',
      adverse: sigmaPct > 25,
    });
    reason =
      `Annualised σ ${sigmaPct.toFixed(1)}% from ${params.dataPoints} trading days` +
      (params.winsorized > 0 ? `, ${params.winsorized} outlier returns winsorized` : '');
  } else missing.push('price history');

  return { key: 'volatility', name: 'Volatility', score, weight: WEIGHTS.volatility, metrics, reason, missing };
}

function financial(f: Fundamentals): Component {
  const metrics: MetricEvidence[] = [];
  const missing: string[] = [];
  const parts: { score: number; weight: number }[] = [];
  const bits: string[] = [];

  const deMed = medianFor(f.sector, 'debtToEquity');
  if (f.debtToEquity !== null) {
    const med = deMed ?? 0.5;
    const ratio = f.debtToEquity / (med || 0.01);
    parts.push({ score: clamp(10 - 3 * (ratio - 1)), weight: 0.4 });
    metrics.push({
      label: 'Debt / equity',
      value: f.debtToEquity,
      display: f.debtToEquity.toFixed(2),
      sectorMedian: deMed,
      sectorMedianDisplay: deMed === null ? null : deMed.toFixed(2),
      verdict: deMed === null ? 'na' : ratioVerdict(f.debtToEquity, deMed, true),
      adverse: deMed !== null && ratioVerdict(f.debtToEquity, deMed, true) === 'higher',
    });
    bits.push(`D/E ${f.debtToEquity.toFixed(2)}`);
  } else missing.push('debt/equity');

  const roeMed = medianFor(f.sector, 'returnOnEquity');
  if (f.returnOnEquity !== null) {
    const med = roeMed ?? 0.15;
    const ratio = f.returnOnEquity / (med || 0.01);
    parts.push({ score: clamp(2 + 6 * ratio), weight: 0.35 });
    metrics.push({
      label: 'Return on equity',
      value: f.returnOnEquity,
      display: pctStr(f.returnOnEquity),
      sectorMedian: roeMed,
      sectorMedianDisplay: roeMed === null ? null : pctStr(roeMed),
      verdict: roeMed === null ? 'na' : ratioVerdict(f.returnOnEquity, roeMed, false),
      adverse: roeMed !== null && ratioVerdict(f.returnOnEquity, roeMed, false) === 'lower',
    });
    bits.push(`ROE ${pctStr(f.returnOnEquity)}`);
  } else missing.push('return on equity');

  const pmMed = medianFor(f.sector, 'profitMargins');
  if (f.profitMargins !== null) {
    const med = pmMed ?? 0.08;
    const ratio = f.profitMargins / (med || 0.01);
    parts.push({ score: clamp(2 + 6 * ratio), weight: 0.25 });
    metrics.push({
      label: 'Profit margin',
      value: f.profitMargins,
      display: pctStr(f.profitMargins),
      sectorMedian: pmMed,
      sectorMedianDisplay: pmMed === null ? null : pctStr(pmMed),
      verdict: pmMed === null ? 'na' : ratioVerdict(f.profitMargins, pmMed, false),
      adverse: pmMed !== null && ratioVerdict(f.profitMargins, pmMed, false) === 'lower',
    });
    bits.push(`margin ${pctStr(f.profitMargins)}`);
  } else missing.push('profit margin');

  const s = combine(parts);
  return {
    key: 'financial',
    name: 'Financial health',
    score: s === null ? 0 : r1(s),
    weight: WEIGHTS.financial,
    metrics,
    reason: bits.length
      ? bits.join(', ') + (missing.length ? ` (${missing.join(' and ')} not reported)` : '')
      : 'No balance-sheet metrics are available for this company',
    missing,
  };
}

export function totalReturn(bars: Bar[], tradingDays: number): number | null {
  if (bars.length < tradingDays + 1) return null;
  const end = bars[bars.length - 1].adjClose;
  const start = bars[bars.length - 1 - tradingDays].adjClose;
  if (!(start > 0) || !(end > 0)) return null;
  return end / start - 1;
}

function momentum(bars: Bar[]): Component {
  const metrics: MetricEvidence[] = [];
  const missing: string[] = [];
  const parts: { score: number; weight: number }[] = [];

  const r6 = totalReturn(bars, 126);
  const r12 = totalReturn(bars, 252);

  if (r6 !== null) {
    parts.push({ score: clamp(5 + (r6 * 100) / 9), weight: 0.6 });
    metrics.push({
      label: '6-month return',
      value: r6,
      display: `${r6 >= 0 ? '+' : '−'}${Math.abs(r6 * 100).toFixed(1)}%`,
      sectorMedian: null,
      sectorMedianDisplay: null,
      verdict: r6 >= 0 ? 'value' : 'lower',
      adverse: r6 < 0,
    });
  } else missing.push('6-month return');

  if (r12 !== null) {
    parts.push({ score: clamp(5 + (r12 * 100) / 15), weight: 0.4 });
    metrics.push({
      label: '12-month return',
      value: r12,
      display: `${r12 >= 0 ? '+' : '−'}${Math.abs(r12 * 100).toFixed(1)}%`,
      sectorMedian: null,
      sectorMedianDisplay: null,
      verdict: r12 >= 0 ? 'value' : 'lower',
      adverse: r12 < 0,
    });
  } else missing.push('12-month return');

  const s = combine(parts);
  const reason =
    r6 !== null
      ? `${r6 >= 0 ? 'Up' : 'Down'} ${Math.abs(r6 * 100).toFixed(1)}% over six months` +
        (r12 !== null ? `, ${r12 >= 0 ? 'up' : 'down'} ${Math.abs(r12 * 100).toFixed(1)}% over twelve` : '')
      : 'Not enough history to measure momentum';

  return { key: 'momentum', name: 'Momentum', score: s === null ? 0 : r1(s), weight: WEIGHTS.momentum, metrics, reason, missing };
}

function dataQuality(bars: Bar[], f: Fundamentals, params: SimParams | null): Component {
  const fields: [string, unknown][] = [
    ['P/E', f.trailingPE],
    ['price/book', f.priceToBook],
    ['debt/equity', f.debtToEquity],
    ['return on equity', f.returnOnEquity],
    ['profit margin', f.profitMargins],
    ['book value', f.bookValue],
    ['sector', f.sector],
  ];
  const present = fields.filter(([, v]) => v !== null && v !== undefined);
  const missing = fields.filter(([, v]) => v === null || v === undefined).map(([k]) => k);

  const days = bars.length;
  const depth = clamp((days / 504) * 6, 0, 6); // two years of history earns the full 6
  const completeness = (present.length / fields.length) * 4;
  const score = r1(clamp(depth + completeness));

  const reason =
    `${days} trading days of history, ${present.length} of ${fields.length} fundamentals present` +
    (missing.length ? ` (missing: ${missing.join(', ')})` : '');

  return {
    key: 'dataQuality',
    name: 'Data quality',
    score,
    weight: WEIGHTS.dataQuality,
    metrics: [
      {
        label: 'History',
        value: days,
        display: `${days} trading days`,
        sectorMedian: null,
        sectorMedianDisplay: null,
        verdict: days >= 500 ? 'value' : days >= 250 ? 'level' : 'lower',
        adverse: days < 250,
      },
      {
        label: 'Fundamentals present',
        value: present.length,
        display: `${present.length} of ${fields.length}`,
        sectorMedian: null,
        sectorMedianDisplay: null,
        verdict: missing.length === 0 ? 'value' : 'lower',
        adverse: missing.length > 2,
      },
    ],
    reason,
    missing,
  };
}

export function scoreStock(
  bars: Bar[],
  f: Fundamentals,
  params: SimParams | null
): ScoreResult {
  const components = [
    valuation(f),
    volatility(params),
    financial(f),
    momentum(bars),
    dataQuality(bars, f, params),
  ];

  const modelScore = Math.round(
    components.reduce((s, c) => s + c.score * c.weight, 0) * 10
  );

  const file = sectorMedians();
  const sectorInfo = f.sector ? file?.sectors?.[f.sector] : undefined;

  return {
    modelScore: Math.max(0, Math.min(100, modelScore)),
    components,
    sector: f.sector,
    sectorConstituents: sectorInfo?.constituents ?? null,
    sectorMediansGeneratedAt: file?.generatedAt ?? null,
  };
}

/* ── the discounting list (Part 6.3) ──────────────────────────── */

export function discounting(
  result: ScoreResult,
  f: Fundamentals,
  bars: Bar[]
): string[] {
  const out: string[] = [];

  const peMed = medianFor(f.sector, 'trailingPE');
  if (f.trailingPE !== null && peMed !== null && f.trailingPE > peMed * 1.15) {
    out.push(`The P/E is ${times(f.trailingPE, peMed)}`);
  }

  const r6 = totalReturn(bars, 126);
  if (r6 !== null && r6 < -0.05) {
    out.push(`Down ${Math.abs(r6 * 100).toFixed(1)}% over six months`);
  }

  // Earnings direction, from real quarterly net income.
  if (f.quarterlyEarnings && f.quarterlyEarnings.length >= 4) {
    const q = f.quarterlyEarnings
      .slice(0, 4)
      .map((x) => x.netIncome)
      .filter((v): v is number => v !== null);
    if (q.length === 4) {
      // rows arrive newest-first
      let falls = 0;
      for (let i = 0; i < 3; i++) if (q[i] < q[i + 1]) falls++;
      if (falls >= 2) out.push(`Earnings fell in ${falls} of the last ${3} quarter-on-quarter comparisons`);
    }
  }

  const deMed = medianFor(f.sector, 'debtToEquity');
  if (f.debtToEquity !== null && deMed !== null && f.debtToEquity > deMed * 1.3) {
    out.push(`Debt to equity is ${f.debtToEquity.toFixed(2)} against a sector median of ${deMed.toFixed(2)}`);
  }

  const roeMed = medianFor(f.sector, 'returnOnEquity');
  if (f.returnOnEquity !== null && roeMed !== null && f.returnOnEquity < roeMed * 0.8) {
    out.push(`Return on equity is ${pctStr(f.returnOnEquity)} against a sector median of ${pctStr(roeMed)}`);
  }

  if (out.length < 3) {
    // Fall back to the worst-scoring components, still citing real numbers.
    const worst = [...result.components]
      .filter((c) => c.key !== 'dataQuality')
      .sort((a, b) => a.score - b.score);
    for (const c of worst) {
      if (out.length >= 3) break;
      const line = `${c.name} scores ${c.score.toFixed(1)} of 10 — ${c.reason.charAt(0).toLowerCase()}${c.reason.slice(1)}`;
      if (!out.includes(line)) out.push(line);
    }
  }

  return out.slice(0, 3);
}

/* ── verdict (Part 6.4) ───────────────────────────────────────── */

export type VerdictResult = { key: 'unsupported' | 'smaller' | 'agree'; text: string };

export function verdictFor(conviction: number, modelScore: number): VerdictResult {
  const gap = Math.abs(conviction - modelScore);
  const over = conviction > modelScore;
  if (over && gap >= 25) {
    return { key: 'unsupported', text: 'The numbers don’t support this at your size.' };
  }
  if (gap >= 10) {
    return { key: 'smaller', text: 'The numbers support a smaller position.' };
  }
  return { key: 'agree', text: 'The numbers support your read.' };
}
