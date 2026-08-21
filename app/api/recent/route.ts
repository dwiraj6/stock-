/* GET /api/recent — the "stocks people checked today" strip.
   Real session records from Mongo. If nobody has run a score in the
   last 24 hours this returns an empty array and the strip does not
   render; it is never padded with invented activity. */
import { ok, guard } from '@/lib/api';
import { recentSymbols } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard('recent', async () => {
    const symbols = await recentSymbols(3);
    return ok({ symbols, window: '24h' }, { ttlSeconds: 60 });
  });
}
