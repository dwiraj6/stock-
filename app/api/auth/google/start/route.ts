/* GET /api/auth/google/start — begin the Google redirect.
   ────────────────────────────────────────────────────────────────
   Mints the CSRF state and the PKCE verifier, parks both in
   short-lived HttpOnly cookies, and sends the browser to Google.

   The cookies are SameSite=Lax on purpose. The callback arrives as a
   top-level GET navigation from accounts.google.com, and Lax sends
   cookies on exactly that while still withholding them from
   cross-site POSTs — Strict would withhold them here too and the
   callback could never read its own state. */

import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeUrl,
  googleConfigured,
  newState,
  newVerifier,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  GOOGLE_RETURN_COOKIE,
} from '@/lib/google';

export const dynamic = 'force-dynamic';

const TEN_MINUTES = 600;

export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/login?error=google-unconfigured', req.nextUrl.origin));
  }

  const state = newState();
  const verifier = newVerifier();

  /* Where to land afterwards. Only a same-site PATH is kept — never
     a full URL — because echoing an attacker-supplied absolute URL
     back into a redirect is how a sign-in page becomes an open
     redirect that lends its domain to a phishing page. */
  const raw = req.nextUrl.searchParams.get('next') ?? '/app';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/app';

  const res = NextResponse.redirect(
    authorizeUrl({ origin: req.nextUrl.origin, state, verifier })
  );

  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TEN_MINUTES,
  };
  res.cookies.set(GOOGLE_STATE_COOKIE, state, opts);
  res.cookies.set(GOOGLE_VERIFIER_COOKIE, verifier, opts);
  res.cookies.set(GOOGLE_RETURN_COOKIE, next, opts);
  return res;
}
