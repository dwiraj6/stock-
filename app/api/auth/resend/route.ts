/* POST /api/auth/resend — send the signup code again.
   ────────────────────────────────────────────────────────────────
   Only ever resends for a signup already in flight. It will not
   create a pending row, so it cannot be turned into a way to mail
   somebody who never started signing up. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import { normaliseEmail, generateOtp, hashToken, OTP_TTL_MS } from '@/lib/auth';
import { getPending, putPending, rateLimit } from '@/lib/users';
import { mailConfigured, sendVerificationCode } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const Body = z.object({ email: z.string().max(254) });

export async function POST(req: NextRequest) {
  return guard('auth:resend', async () => {
    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'That request could not be read.', 'Start the signup again.');
    }
    const email = normaliseEmail(body.email);

    if (!mailConfigured()) {
      return fail(
        'AUTH_NOT_CONFIGURED',
        'This server cannot send email.',
        'Sign in with Google instead.'
      );
    }

    const limit = await rateLimit(`resend:${email}`, 4, 15 * 60 * 1000);
    if (!limit.ok) {
      return fail(
        'RATE_LIMITED',
        'A code was just sent.',
        `Wait ${limit.retryAfterSec}s, and check the spam folder.`,
        { retryAfter: limit.retryAfterSec }
      );
    }

    const pending = await getPending(email, 'verify');
    if (!pending) {
      // Same answer either way — this must not report who is mid-signup.
      return ok({ sent: true, email });
    }

    const code = generateOtp();
    await putPending({
      email,
      kind: 'verify',
      codeHash: hashToken(code),
      attempts: 0,
      name: pending.name,
      passwordHash: pending.passwordHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    const sent = await sendVerificationCode(email, code);
    if (!sent.ok) console.error('[plumbline] auth:resend mail failed —', sent.reason);

    return ok({ sent: true, email });
  });
}
