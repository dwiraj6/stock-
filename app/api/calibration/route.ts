/* GET /api/calibration — serves the committed backtest. Never
   recomputes at request time. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, fail, guard } from '@/lib/api';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  return guard('calibration', async () => {
    try {
      const p = path.join(process.cwd(), 'data', 'calibration.json');
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));

      /* Two separate claims, kept separate on purpose.
         `calibration` validates the WIDTH of the band — that is the
         claim the app leads with.
         `probability` validates the DIRECTION forecast, and it says
         plainly that the model has no directional skill. Publishing
         the second alongside the first is the point: a tool that
         only shows the test it passes is not showing you a test. */
      let probability = null;
      try {
        const q = path.join(process.cwd(), 'data', 'probability-calibration.json');
        probability = JSON.parse(fs.readFileSync(q, 'utf8'));
      } catch {
        probability = null;
      }

      /* The third exhibit: six attempts at predicting direction, none
         of which worked. This is what turns "our model can't forecast
         direction" from an apology into a result. */
      let factors = null;
      try {
        const f = path.join(process.cwd(), 'data', 'factor-test.json');
        factors = JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch {
        factors = null;
      }

      return ok({ calibration: json, probability, factors }, { ttlSeconds: 3600 });
    } catch {
      return fail(
        'UPSTREAM_UNAVAILABLE',
        'The backtest has not been generated yet.',
        'Run `npm run backtest` to compute it from real history, then redeploy.'
      );
    }
  });
}
