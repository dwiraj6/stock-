/* POST /api/auth/adopt — claim this browser's anonymous history.
   ────────────────────────────────────────────────────────────────
   The password and code flows can adopt inline, because the browser
   posts its anonymous id along with the credentials. Google cannot:
   it comes back as a top-level redirect, and localStorage is not
   readable from the server. So the callback sends the browser to
   `?adopt=1` and the client posts the id here instead.

   Requires a live session, and adopts only for the account that
   session belongs to. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import { currentUser } from '@/lib/current-user';
import { adoptAnonymousHistory } from '@/lib/signin';

export const dynamic = 'force-dynamic';

const Body = z.object({ anonId: z.string().max(64) });

export async function POST(req: NextRequest) {
  return guard('auth:adopt', async () => {
    const user = await currentUser();
    if (!user?._id) {
      return fail('AUTH_REQUIRED', 'You are not signed in.', 'Sign in and try again.');
    }

    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'That request could not be read.', 'Nothing was changed.');
    }

    const result = await adoptAnonymousHistory(user._id, body.anonId);
    return ok({ adopted: result === 'adopted', result });
  });
}
