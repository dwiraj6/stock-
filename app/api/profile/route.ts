/* /api/profile — the user's stated risk constraints.
   ────────────────────────────────────────────────────────────────
   GET returns the profile on this account. POST replaces it.

   Requires a session, and reads the identity from the cookie rather
   than the body, for the same reason /api/decisions does: this is
   personal to an account and there is no version of "whose profile"
   that a client should get to assert.

   The profile is stored on the ACCOUNT and not in the browser. It is
   a statement about a person's situation, not about a device, and
   answering the same four questions again on a phone would be a
   small insult. */

import { NextRequest } from 'next/server';
import { ok, fail, guard } from '@/lib/api';
import { currentUser } from '@/lib/current-user';
import { setRiskProfile } from '@/lib/users';
import { parseProfile, profileIsStale } from '@/lib/risk-profile';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard('profile:get', async () => {
    const user = await currentUser();
    if (!user) {
      return fail('AUTH_REQUIRED', 'Sign in to see your risk profile.', 'It is kept with your account.');
    }
    const profile = user.riskProfile ?? null;
    return ok({ profile, stale: profileIsStale(profile) });
  });
}

export async function POST(req: NextRequest) {
  return guard('profile:post', async () => {
    const user = await currentUser();
    if (!user?._id) {
      return fail('AUTH_REQUIRED', 'Sign in to save your risk profile.', 'It is kept with your account.');
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return fail('BAD_REQUEST', 'That profile could not be read.', 'Answer all four questions.');
    }

    const profile = parseProfile(raw);
    if (!profile) {
      return fail(
        'BAD_REQUEST',
        'That profile is incomplete.',
        'All four answers are needed, and the loss limit must be a number.'
      );
    }

    await setRiskProfile(user._id, profile);
    return ok({ profile });
  });
}
