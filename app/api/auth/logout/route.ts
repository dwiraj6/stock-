/* POST /api/auth/logout — end this session everywhere it counts.
   ────────────────────────────────────────────────────────────────
   Deletes the server-side row as well as the cookie. Clearing only
   the cookie would leave a token that still works if it was ever
   captured, which is the difference between "logged out" and "the
   browser stopped mentioning it". */

import { ok, guard } from '@/lib/api';
import { signOutCurrent } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function POST() {
  return guard('auth:logout', async () => {
    await signOutCurrent();
    return ok({ signedOut: true });
  });
}
