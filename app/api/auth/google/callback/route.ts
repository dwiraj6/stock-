/* GET /api/auth/google/callback — come back from Google.
   ────────────────────────────────────────────────────────────────
   The order of checks matters, so it is written out plainly:

     1. state must match the cookie      → the browser started this
     2. code redeems with the verifier   → PKCE, and it proves the
                                           code was not intercepted
     3. the id_token verifies            → signature against Google's
                                           JWKS, issuer, audience
     4. email_verified must be true      → see below

   Step 4 is the one that is easy to skip and expensive to skip.
   Google will happily assert an address it has not verified. If an
   unverified address were accepted, anyone could register that
   address with Google, sign in here, and be handed the existing
   password account that owns it — a full takeover with no password
   involved. So an unverified Google email is refused outright.

   This route redirects rather than returning JSON: it is a browser
   navigation, not a fetch, so every outcome ends at a page. */

import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCode,
  googleConfigured,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  GOOGLE_RETURN_COOKIE,
} from '@/lib/google';
import { createSession, createUser, findUserByEmail, linkGoogle } from '@/lib/users';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

function back(req: NextRequest, error: string, detail?: string) {
  const u = new URL(`/login`, req.nextUrl.origin);
  u.searchParams.set('error', error);
  if (detail) u.searchParams.set('detail', detail.slice(0, 160));
  return NextResponse.redirect(u);
}

/* THIS IS A BROWSER NAVIGATION, NOT A FETCH.
   Every outcome has to end at a page the user can read. Before this
   wrapper an exception anywhere below — an unreachable account
   store, a Mongo timeout mid-signup — surfaced as a bare HTTP 500
   in the address bar, which tells the person nothing and tells
   whoever is debugging it even less. Now it lands on /login with a
   stated reason, and the full error goes to the server log. */
export async function GET(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[stockshishya] auth:google callback threw —', msg);
    return back(req, 'server', msg);
  }
}

async function handle(req: NextRequest) {
  if (!googleConfigured()) return back(req, 'google-unconfigured');

  const url = req.nextUrl;
  const jar = req.cookies;

  // The user pressed cancel on Google's screen.
  if (url.searchParams.get('error')) return back(req, 'cancelled');

  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const cookieState = jar.get(GOOGLE_STATE_COOKIE)?.value ?? '';
  const verifier = jar.get(GOOGLE_VERIFIER_COOKIE)?.value ?? '';

  if (!code || !state || !cookieState || state !== cookieState) return back(req, 'state');
  if (!verifier) return back(req, 'state');

  const identity = await exchangeCode({ code, verifier, origin: url.origin });
  if (!identity) return back(req, 'exchange');
  if (!identity.emailVerified) return back(req, 'unverified-google');

  /* Link by email. Google has verified the address, so an existing
     password account for it belongs to this same person and the two
     should be one account rather than two that each hold half a
     track record. */
  let user = await findUserByEmail(identity.email);
  if (user) {
    if (!user.googleSub) await linkGoogle(user._id!, identity.sub, user.name ?? identity.name);
  } else {
    user = await createUser({
      email: identity.email,
      name: identity.name,
      passwordHash: null,
      googleSub: identity.sub,
      emailVerified: new Date(),
    });
    // Lost a race with a parallel signup; the row now exists.
    if (!user) user = await findUserByEmail(identity.email);
  }
  if (!user?._id) return back(req, 'account');

  const token = await createSession(String(user._id));

  const next = jar.get(GOOGLE_RETURN_COOKIE)?.value ?? '/app';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';

  /* `adopt` tells the client to offer this browser's anonymous
     history to the account it just signed into. It cannot happen
     here because localStorage is not readable from the server. */
  const dest = new URL(safeNext, url.origin);
  dest.searchParams.set('adopt', '1');

  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  for (const c of [GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE, GOOGLE_RETURN_COOKIE]) {
    res.cookies.set(c, '', { path: '/', maxAge: 0 });
  }
  return res;
}
