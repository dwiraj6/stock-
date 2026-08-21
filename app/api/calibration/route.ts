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
      return ok({ calibration: json }, { ttlSeconds: 3600 });
    } catch {
      return fail(
        'UPSTREAM_UNAVAILABLE',
        'The backtest has not been generated yet.',
        'Run `npm run backtest` to compute it from real history, then redeploy.'
      );
    }
  });
}
