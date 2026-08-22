/* POST /api/auth/verify — redeem the emailed code.
   ────────────────────────────────────────────────────────────────
   This is where the account actually comes into existence. Up to
   now there was only a `pending` row; a correct code turns it into a
   user and a session in one step, so nobody has to type their
   password a second time to log in after signing up.

   The attempt counter is the real defence. Six digits is a million
   possibilities, which sounds like plenty and is not — an unbounded
   endpoint would fall to a script in minutes. Five wrong guesses
   voids the code entirely and a new one has to be requested. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import { normaliseEmail, codeMatches, OTP_MAX_ATTEMPTS } from '@/lib/auth';
import {
  getPending,
  clearPending,
  bumpPendingAttempts,
  createUser,
  findUserByEmail,
  rateLimit,
} from '@/lib/users';
import { establishSession } from '@/lib/signin';
import { publicUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().max(254),
  code: z.string().max(12),
  /** This browser's anonymous id, so its history can be adopted. */
  anonId: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  return guard('auth:verify', async () => {
    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'That code could not be read.', 'Enter the 6-digit code.');
    }

    const email = normaliseEmail(body.email);
    const code = String(body.code).replace(/\s/g, '');

    const limit = await rateLimit(`verify:${email}`, 20, 60 * 60 * 1000);
    if (!limit.ok) {
      return fail('RATE_LIMITED', 'Too many attempts.', 'Request a new code in a few minutes.', {
        retryAfter: limit.retryAfterSec,
      });
    }

    const pending = await getPending(email, 'verify');
    if (!pending) {
      return fail(
        'AUTH_FAILED',
        'That code has expired.',
        'Request a new one — codes last 10 minutes.'
      );
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await clearPending(email, 'verify');
      return fail('AUTH_FAILED', 'Too many wrong codes.', 'Request a new code and try again.');
    }

    if (!codeMatches(code, pending.codeHash)) {
      await bumpPendingAttempts(email, 'verify');
      const left = OTP_MAX_ATTEMPTS - pending.attempts - 1;
      return fail(
        'AUTH_FAILED',
        'That code is not right.',
        left > 0 ? `${left} attempt${left === 1 ? '' : 's'} left.` : 'Request a new code.'
      );
    }

    // Correct. The code is single-use, so it dies here either way.
    await clearPending(email, 'verify');

    /* Someone may have completed a signup for this address in
       another tab while this code was in flight. Treat that as
       success rather than an error — the mailbox has been proven
       either way, and the outcome the user wanted is "I am signed
       in", which is what they get. */
    const existing = await findUserByEmail(email);
    const user =
      existing ??
      (await createUser({
        email,
        name: pending.name,
        passwordHash: pending.passwordHash,
        googleSub: null,
        emailVerified: new Date(),
      }));

    if (!user) {
      return fail('AUTH_FAILED', 'The account could not be created.', 'Try signing up again.');
    }

    const { adopted } = await establishSession(user, body.anonId);
    return ok({ user: publicUser(user), adopted });
  });
}
