/* POST /api/auth/firebase — turn a Firebase ID token into a session.
   ────────────────────────────────────────────────────────────────
   The browser completes the Google popup, Firebase hands it an ID
   token, and it posts that here exactly once. From this point on the
   app's own session cookie carries the identity and Firebase is not
   consulted again — no Firebase SDK on any other request, no second
   source of truth about who someone is.

   Linking is by verified email, the same rule the direct-OAuth route
   uses: an account that already exists for this address belongs to
   this person, and they should have one account rather than two that
   each hold half a track record.

   The `emailVerified` check is not optional. Firebase will issue a
   token for an unverified address, and accepting one would mean
   anyone who can register that address with any Firebase-federated
   provider could take over the matching password account here. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import { verifyFirebaseToken, firebaseConfigured } from '@/lib/firebase-verify';
import { findUserByEmail, createUser, linkGoogle } from '@/lib/users';
import { establishSession } from '@/lib/signin';
import { publicUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const Body = z.object({
  idToken: z.string().min(20).max(4096),
  /** This browser's anonymous id, so its history can be adopted. */
  anonId: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  return guard('auth:firebase', async () => {
    if (!firebaseConfigured()) {
      return fail(
        'AUTH_NOT_CONFIGURED',
        'Google sign-in is not configured on this server.',
        'Set NEXT_PUBLIC_FIREBASE_PROJECT_ID, or sign in with email and password.'
      );
    }

    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'That sign-in could not be read.', 'Try again.');
    }

    const identity = await verifyFirebaseToken(body.idToken);
    if (!identity) {
      return fail(
        'AUTH_FAILED',
        'That Google sign-in could not be verified.',
        'Try again — if it keeps failing, use email and password.'
      );
    }
    if (!identity.emailVerified) {
      return fail(
        'AUTH_FAILED',
        'That Google account has not verified its email address.',
        'Verify it with Google first, or sign up with email and password.'
      );
    }

    let user = await findUserByEmail(identity.email).catch(() => null);
    if (user?._id) {
      // First Google sign-in on an existing password account.
      if (!user.googleSub) {
        await linkGoogle(user._id, identity.uid, user.name ?? identity.name);
      }
    } else {
      user = await createUser({
        email: identity.email,
        name: identity.name,
        passwordHash: null,
        googleSub: identity.uid,
        emailVerified: new Date(),
      });
      // Lost a race with a parallel signup; the row exists now.
      if (!user) user = await findUserByEmail(identity.email).catch(() => null);
    }

    if (!user?._id) {
      return fail(
        'UPSTREAM_DEGRADED',
        'The account could not be opened.',
        'The account store could not be reached. Try again in a moment.'
      );
    }

    const { adopted } = await establishSession(user, body.anonId);
    return ok({ user: publicUser(user), adopted });
  });
}
