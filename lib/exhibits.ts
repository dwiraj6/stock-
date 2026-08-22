/* THE PUBLISHED NUMBERS, READ FROM DISK.
   ────────────────────────────────────────────────────────────────
   Every page that quotes the backtest reads it through here, so
   there is exactly one place where a committed exhibit becomes a
   number on a screen. The landing page and the sign-in page both use
   it; if a third surface ever quotes these figures it should use it
   too rather than copying the shape.

   The fallbacks are the values as measured at the time of writing.
   They exist so a missing data file degrades to a stale-but-true
   number instead of rendering "NaN%", and verify.mjs asserts that
   what the page shows matches what the files actually say — so a
   fallback that silently went out of date would fail the suite. */

import fs from 'node:fs';
import path from 'node:path';

function readJson(name: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', name), 'utf8'));
  } catch {
    return null;
  }
}

function countSymbols(): number {
  try {
    const csv = fs.readFileSync(path.join(process.cwd(), 'data', 'nse-symbols.csv'), 'utf8');
    return csv.split('\n').filter((l) => l.split(',')[2]?.trim() === 'EQ').length;
  } catch {
    return 0;
  }
}

export type Exhibits = {
  bandHitPct: number;
  bandN: number;
  bandWindows: number;
  directionSkillPct: number;
  directionN: number;
  factorsTested: number;
  factorTrainN: number;
  factorTestN: number;
  symbols: number;
  constituents: number;
};

export function readExhibits(): Exhibits {
  const band = readJson('calibration.json');
  const dir = readJson('probability-calibration.json');
  const fac = readJson('factor-test.json');
  const med = readJson('sector-medians.json');

  return {
    bandHitPct: band ? Math.round(band.hitRate * 100) : 87,
    bandN: band?.universe ?? 120,
    bandWindows: band?.windows ?? 6,
    directionSkillPct: dir ? +(dir.skillScore * 100).toFixed(1) : -3.4,
    directionN: dir?.forecasts ?? 240,
    factorsTested: fac?.results?.length ?? 5,
    factorTrainN: fac?.trainN ?? 300,
    factorTestN: fac?.testN ?? 150,
    symbols: countSymbols(),
    constituents: med?.withFundamentals ?? 499,
  };
}
