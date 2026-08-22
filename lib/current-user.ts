/* WHO IS THIS REQUEST?
   ────────────────────────────────────────────────────────────────
   One place that answers it, so no route has to decide for itself.

   The important rule, and the reason this file is short: identity
   comes from the SESSION COOKIE and from nothing else. Before
   accounts existed, /api/decisions took a `who` straight off the
   query string, which meant anyone who guessed an id could read that
   track record. Now `who` is derived here, server-side, from a
   bearer token the client cannot forge, and the routes never read a
   user id out of the request body again.

   The cookie is HttpOnly so no script can read it, SameSite=Lax so
   it is not sent on cross-site POSTs (which is what stops CSRF on
   the mutating routes), and Secure everywhere except local http. */

import { cookies } from 'next/headers';
import { readSession, destroySession, SESSION_TTL_MS, type User } from './users';

/* Frozen across the rename: changing the cookie name signs out
   everyone who is currently signed in, for no user-visible gain. */
export const SESSION_COOKIE = 'plumbline_session';

const isProd = process.env.NODE_ENV === 'production';

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/** The signed-in user, or null. Never throws. */
export async function currentUser(): Promise<User | null> {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value ?? '';
    if (!token) return null;
    return await readSession(token);
  } catch {
    return null;
  }
}

/** The stable id used to own a track record. */
export function userKey(u: User): string {
  return String(u._id);
}

/** What the client is allowed to know about itself. Note what is
    absent: no password digest, no Google subject id, no session
    token. A shape like this is easy to keep honest precisely because
    it is built by hand rather than spread from the database row. */
export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  /* Whether a risk profile exists, and what it says. The profile is
     the user's own statement about their situation, so there is
     nothing to withhold — but it is still built by hand rather than
     spread from the row, so a field added to User later cannot leak
     here by accident. */
  riskProfile: import('./risk-profile').RiskProfile | null;
};

export function publicUser(u: User): PublicUser {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    riskProfile: u.riskProfile ?? null,
  };
}

export async function signOutCurrent(): Promise<void> {
  const jar = cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? '';
  if (token) await destroySession(token);
  jar.delete(SESSION_COOKIE);
}
