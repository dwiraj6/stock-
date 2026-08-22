/* POST /api/auth/forgot — send a reset code.
   ────────────────────────────────────────────────────────────────
   Answers identically for a registered and an unregistered address,
   for the same reason signup does: otherwise it reports which emails
   have accounts here. An unknown address simply gets no email.

   There is no reset LINK, only a code. A link in an email is a
   bearer token that lives in an inbox, gets forwarded, and turns up
   in referrer headers and mail-scanner logs; a six-digit code that
   dies in ten minutes and after five wrong guesses does the same job
   with a far shorter tail. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import { normaliseEmail, emailProblem, generateOtp, hashToken, OTP_TTL_MS } from '@/lib/auth';
import { findUserByEmail, putPending, rateLimit } from '@/lib/users';
import { mailConfigured, sendResetCode } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const Body = z.object({ email: z.string().max(254) });

export async function POST(req: NextRequest) {
  return guard('auth:forgot', async () => {
    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'That request could not be read.', 'Enter your email address.');
    }

    const email = normaliseEmail(body.email);
    const problem = emailProblem(email);
    if (problem) return fail('BAD_REQUEST', problem, 'Check the address.');

    if (!mailConfigured()) {
      return fail(
        'AUTH_NOT_CONFIGURED',
        'This server cannot send email.',
        'Sign in with Google, or set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local.'
      );
    }

    const limit = await rateLimit(`forgot:${email}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return fail('RATE_LIMITED', 'Too many reset requests.', 'Try again in an hour.', {
        retryAfter: limit.retryAfterSec,
      });
    }

    const user = await findUserByEmail(email);
    if (user) {
      const code = generateOtp();
      await putPending({
        email,
        kind: 'reset',
        codeHash: hashToken(code),
        attempts: 0,
        name: null,
        passwordHash: null,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
      const sent = await sendResetCode(email, code);
      if (!sent.ok) console.error('[stockshishya] auth:forgot mail failed —', sent.reason);
    }

    return ok({ sent: true, email });
  });
}
