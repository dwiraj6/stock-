/* POST /api/auth/reset — set a new password with the emailed code.
   ────────────────────────────────────────────────────────────────
   Every other session is destroyed on success. That is the whole
   point of a reset when the reason for it is "someone else may be in
   my account": changing the password while leaving their existing
   session alive would change nothing at all for them. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import {
  normaliseEmail,
  codeMatches,
  passwordProblem,
  hashPassword,
  OTP_MAX_ATTEMPTS,
} from '@/lib/auth';
import {
  getPending,
  clearPending,
  bumpPendingAttempts,
  findUserByEmail,
  setPassword,
  destroyAllSessions,
  rateLimit,
} from '@/lib/users';
import { establishSession } from '@/lib/signin';
import { publicUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().max(254),
  code: z.string().max(12),
  password: z.string().max(200),
  anonId: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  return guard('auth:reset', async () => {
    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail(
        'BAD_REQUEST',
        'That reset could not be read.',
        'Enter the code and a new password.'
      );
    }

    const email = normaliseEmail(body.email);
    const code = String(body.code).replace(/\s/g, '');

    const problem = passwordProblem(body.password);
    if (problem) return fail('BAD_REQUEST', problem, 'Pick a longer password.');

    const limit = await rateLimit(`reset:${email}`, 20, 60 * 60 * 1000);
    if (!limit.ok) {
      return fail('RATE_LIMITED', 'Too many attempts.', 'Request a new code shortly.', {
        retryAfter: limit.retryAfterSec,
      });
    }

    const pending = await getPending(email, 'reset');
    if (!pending) {
      return fail(
        'AUTH_FAILED',
        'That code has expired.',
        'Request a new one — codes last 10 minutes.'
      );
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await clearPending(email, 'reset');
      return fail('AUTH_FAILED', 'Too many wrong codes.', 'Request a new code.');
    }
    if (!codeMatches(code, pending.codeHash)) {
      await bumpPendingAttempts(email, 'reset');
      const left = OTP_MAX_ATTEMPTS - pending.attempts - 1;
      return fail(
        'AUTH_FAILED',
        'That code is not right.',
        left > 0 ? `${left} attempt${left === 1 ? '' : 's'} left.` : 'Request a new code.'
      );
    }

    await clearPending(email, 'reset');

    const user = await findUserByEmail(email);
    if (!user?._id) {
      return fail('AUTH_FAILED', 'That account no longer exists.', 'Create a new one.');
    }

    await setPassword(user._id, await hashPassword(body.password));
    // Cut every existing login, including any an attacker holds.
    await destroyAllSessions(String(user._id));

    const { adopted } = await establishSession(user, body.anonId);
    return ok({ user: publicUser(user), adopted });
  });
}
