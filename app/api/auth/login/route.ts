/* POST /api/auth/login — email and password.
   ────────────────────────────────────────────────────────────────
   One failure message for every reason. "No such account" and "wrong
   password" are the same sentence here, because telling them apart
   turns this endpoint into a way to test which email addresses are
   registered.

   The unknown-user branch still runs a scrypt verification against a
   dummy digest. Without it, a missing account returns in a
   millisecond and a real one takes a hundred, and that difference is
   readable over the network — the timing leaks exactly what the
   shared message was written to hide. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import { normaliseEmail, verifyPassword, hashToken } from '@/lib/auth';
import { findUserByEmail, rateLimit } from '@/lib/users';
import { establishSession } from '@/lib/signin';
import { publicUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().max(254),
  password: z.string().max(200),
  anonId: z.string().max(64).optional(),
});

/* A real scrypt digest of a value nobody will type, used only to
   burn the same CPU on the unknown-account path. */
const DECOY =
  'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);

export async function POST(req: NextRequest) {
  return guard('auth:login', async () => {
    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'That sign-in could not be read.', 'Enter your email and password.');
    }

    const email = normaliseEmail(body.email);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const perEmail = await rateLimit(`login:${email}`, 10, 15 * 60 * 1000);
    const perIp = await rateLimit(`login-ip:${hashToken(ip).slice(0, 24)}`, 50, 15 * 60 * 1000);
    if (!perEmail.ok || !perIp.ok) {
      const wait = Math.max(perEmail.retryAfterSec, perIp.retryAfterSec);
      return fail(
        'RATE_LIMITED',
        'Too many sign-in attempts.',
        `Wait ${Math.ceil(wait / 60)} minutes, or reset your password.`,
        { retryAfter: wait }
      );
    }

    /* An unreachable account store is NOT a failed sign-in. Letting
       it fall through to "that email and password do not match" would
       tell a user their password is wrong when it is not, and send
       them off resetting a password that was fine. */
    let user;
    try {
      user = await findUserByEmail(email);
    } catch {
      return fail(
        'UPSTREAM_DEGRADED',
        'Sign-in is unavailable right now.',
        'The account store could not be reached. Your password is fine — try again shortly.'
      );
    }

    const good = user?.passwordHash
      ? await verifyPassword(body.password, user.passwordHash)
      : await verifyPassword(body.password, DECOY).then(() => false);

    if (!user || !good) {
      /* Deliberately identical for: no such account, wrong password,
         and an account that only has Google sign-in. The last one is
         a real usability cost, so the action line names it as a
         possibility without confirming anything. */
      return fail(
        'AUTH_FAILED',
        'That email and password do not match.',
        'Check them and try again — or use Google if that is how you signed up.'
      );
    }

    const { adopted } = await establishSession(user, body.anonId);
    return ok({ user: publicUser(user), adopted });
  });
}
