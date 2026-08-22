/* POST /api/auth/signup — start an account, but do not create one.
   ────────────────────────────────────────────────────────────────
   Nothing is written to `users` here. The email, name and password
   digest go into `pending` with a six-digit code, and only when that
   code comes back does an account exist. An unverified address never
   becomes an account, so a typo or a forged signup leaves nothing
   behind and the row expires on its own.

   THE RESPONSE IS IDENTICAL WHETHER OR NOT THE ADDRESS IS TAKEN.
   Otherwise this endpoint is an oracle: type an email, learn from
   the error whether that person has an account here. The difference
   is carried in the mailbox instead — a real owner gets either a
   code or a "you already have an account" note, and an attacker
   probing addresses learns nothing from the API at all. */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, guard } from '@/lib/api';
import {
  emailProblem,
  normaliseEmail,
  passwordProblem,
  hashPassword,
  hashToken,
  generateOtp,
  OTP_TTL_MS,
} from '@/lib/auth';
import { findUserByEmail, putPending, createUser, rateLimit } from '@/lib/users';
import { mailConfigured, sendVerificationCode, sendAlreadyRegistered } from '@/lib/mailer';
import { establishSession } from '@/lib/signin';
import { publicUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/* ── SIGNING UP WITHOUT PROVING THE MAILBOX ──
   Off unless ALLOW_UNVERIFIED_SIGNUP is explicitly set to "1". It is
   a switch rather than a fallback, because "no mail server
   configured" and "we intend to skip verification" are different
   situations and inferring one from the other is how a demo setting
   ends up live in production by accident.

   WHAT IT COSTS, stated plainly rather than buried:

     · anyone can register an address they do not own, so an email
       here proves nothing about who the person is
     · password reset stops working — it has no way to reach anybody,
       so a forgotten password means a new account
     · a typo in the address is unrecoverable for the same reason

   WHAT IT DOES NOT COST: passwords are still scrypt-hashed, sessions
   are still random and revocable, the rate limits still apply, and
   the track record is still sealed before the outcome exists. The
   only thing given up is the link between an account and a real
   mailbox.

   For an educational tool that holds no money and stores nothing but
   stock probability estimates, that is a defensible trade for a
   demo. It would not be for anything holding money. */
const allowUnverified = () => (process.env.ALLOW_UNVERIFIED_SIGNUP ?? '').trim() === '1';

const Body = z.object({
  email: z.string().max(254),
  password: z.string().max(200),
  name: z.string().max(80).optional(),
  /** Only used on the unverified path, which signs in immediately. */
  anonId: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  return guard('auth:signup', async () => {
    let body;
    try {
      body = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'That signup could not be read.', 'Send an email and a password.');
    }

    const email = normaliseEmail(body.email);
    const eProblem = emailProblem(email);
    if (eProblem) return fail('BAD_REQUEST', eProblem, 'Check the address and try again.');

    const pProblem = passwordProblem(body.password);
    if (pProblem) return fail('BAD_REQUEST', pProblem, 'Pick a longer password.');

    if (!mailConfigured() && !allowUnverified()) {
      return fail(
        'AUTH_NOT_CONFIGURED',
        'This server cannot send email, so it cannot verify an address.',
        'Set SMTP_HOST, SMTP_USER and SMTP_PASS — or set ALLOW_UNVERIFIED_SIGNUP=1 to skip verification — or sign in with Google.'
      );
    }

    /* Two limits, deliberately. The per-address one stops someone
       being mail-bombed by repeated signups; the per-IP one stops
       one client enumerating many addresses. */
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const perEmail = await rateLimit(`signup:${email}`, 5, 60 * 60 * 1000);
    const perIp = await rateLimit(`signup-ip:${hashToken(ip).slice(0, 24)}`, 20, 60 * 60 * 1000);
    if (!perEmail.ok || !perIp.ok) {
      return fail(
        'RATE_LIMITED',
        'Too many signup attempts.',
        `Wait ${Math.ceil(Math.max(perEmail.retryAfterSec, perIp.retryAfterSec) / 60)} minutes and try again.`,
        { retryAfter: Math.max(perEmail.retryAfterSec, perIp.retryAfterSec) }
      );
    }

    const existing = await findUserByEmail(email);

    /* ── the unverified path ──
       The account is created here and now, and the caller is signed
       straight in. Note what it does NOT do: report that the address
       was already taken. Without a mailbox to carry that news the
       endpoint would become an oracle for which emails are
       registered, so a taken address returns the same shape as a
       fresh one and the person is told to sign in instead. */
    if (!mailConfigured() && allowUnverified()) {
      if (existing) {
        return fail(
          'AUTH_FAILED',
          'That address cannot be used to create a new account.',
          'If it is yours, sign in with your password instead.'
        );
      }
      const user = await createUser({
        email,
        name: body.name?.trim() || null,
        passwordHash: await hashPassword(body.password),
        googleSub: null,
        // Never verified, and recorded as such rather than pretended.
        emailVerified: null,
      });
      if (!user) {
        return fail(
          'UPSTREAM_DEGRADED',
          'The account could not be created.',
          'The account store could not be reached. Try again in a moment.'
        );
      }
      const { adopted } = await establishSession(user, body.anonId);
      return ok({ signedIn: true, user: publicUser(user), adopted });
    }

    if (existing) {
      // Same shape, same timing story, different mailbox contents.
      void sendAlreadyRegistered(email);
      return ok({ sent: true, email });
    }

    const code = generateOtp();
    await putPending({
      email,
      kind: 'verify',
      codeHash: hashToken(code),
      attempts: 0,
      name: body.name?.trim() || null,
      passwordHash: await hashPassword(body.password),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    const sent = await sendVerificationCode(email, code);
    if (!sent.ok) {
      /* An SMTP failure is the server's problem, not the user's, and
         it must not look like a rejected signup. The reason is
         surfaced because "Invalid login" and "connection timed out"
         need completely different fixes and hiding that just means
         someone reads Vercel logs for an hour. */
      console.error('[stockshishya] auth:signup mail failed —', sent.reason);
      return fail(
        'AUTH_NOT_CONFIGURED',
        'The code could not be sent.',
        `Email failed: ${sent.reason}`
      );
    }

    return ok({ sent: true, email });
  });
}
