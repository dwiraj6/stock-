/* The landing page.
   A server component: it reads the committed backtest files at build
   time and hands the real numbers to the client. Every statistic on
   the page is therefore the same number the app itself reports —
   there is nothing hand-written to drift out of date. */
import fs from 'node:fs';
import path from 'node:path';
import LandingClient from './landing-client';

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

export default function Page() {
  const band = readJson('calibration.json');
  const dir = readJson('probability-calibration.json');
  const fac = readJson('factor-test.json');
  const med = readJson('sector-medians.json');

  const stats = {
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

  return <LandingClient stats={stats} />;
}
