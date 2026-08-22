/* TALKING TO THE AUTH ROUTES.
   ────────────────────────────────────────────────────────────────
   Every call sends `credentials: 'same-origin'` so the session
   cookie rides along, and every call returns the same typed payload
   the rest of the app uses — { ok:true, ... } or { ok:false, code,
   message, action } — so a sign-in failure renders through exactly
   the same path as a failed quote.

   Note what this file does NOT do: store a token, read a cookie, or
   keep the user in localStorage. The session lives in an HttpOnly
   cookie the browser attaches by itself, which is precisely why no
   script here can touch it — including anything injected into the
   page. The client's only source of truth about who you are is
   asking the server. */

import { whoAmI } from './client.js';

async function post(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body ?? {}),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Could not reach the server.',
      action: 'Check your connection and try again.',
    };
  }
}

/** Who is signed in, and which methods this server can offer. */
export async function getMe() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    return await res.json();
  } catch {
    return { ok: false, user: null, methods: { google: false, email: false } };
  }
}

/* The anonymous browser id rides along with every sign-in so the
   history built before the account existed can be adopted. It is
   read here rather than in each caller so no flow forgets it. */
const withAnon = (body) => ({ ...body, anonId: whoAmI() || undefined });

/* anonId rides along because signup can complete immediately when
   the server is configured to skip email verification — in that case
   this call IS the sign-in, and the browser's anonymous history
   should be adopted the same as any other. */
export const signUp = (email, password, name) =>
  post('/api/auth/signup', withAnon({ email, password, name }));
export const verifyCode = (email, code) => post('/api/auth/verify', withAnon({ email, code }));
export const resendCode = (email) => post('/api/auth/resend', { email });
export const logIn = (email, password) => post('/api/auth/login', withAnon({ email, password }));
export const forgotPassword = (email) => post('/api/auth/forgot', { email });
export const resetPassword = (email, code, password) =>
  post('/api/auth/reset', withAnon({ email, code, password }));
export const logOut = () => post('/api/auth/logout');

/* ── Google, via Firebase ──
   Firebase opens the popup and returns an ID token; the server
   verifies it and issues THIS app's session. Firebase's own session
   is discarded — see src/lib/firebase-client.js for why two session
   systems side by side is a bug waiting to happen. */
export async function signInWithGooglePopup() {
  const { signInWithGoogle } = await import('./firebase-client.js');
  const popup = await signInWithGoogle();
  if (!popup.ok) return { ok: false, cancelled: popup.cancelled, message: popup.message, action: popup.action };
  return post('/api/auth/firebase', withAnon({ idToken: popup.idToken }));
}

/** Used after the Google redirect, which cannot carry localStorage. */
export const adoptAnonymous = () => {
  const anonId = whoAmI();
  return anonId ? post('/api/auth/adopt', { anonId }) : Promise.resolve({ ok: true, adopted: false });
};

/** Where Google sends the browser back to. */
export const googleStartUrl = (next = '/app') =>
  `/api/auth/google/start?next=${encodeURIComponent(next)}`;

/* The reasons the Google callback can bounce back to /login, in
   plain words. A redirect that lands on a page saying only
   "error=state" is a dead end for whoever hits it. */
export const GOOGLE_ERRORS = {
  'google-unconfigured':
    'Google sign-in is not configured on this server. Use email and password instead.',
  cancelled: 'That Google sign-in was cancelled. Nothing has changed.',
  state:
    'That sign-in could not be verified — it may have been started in another tab, or taken too long. Try again.',
  exchange: 'Google could not confirm that sign-in. Try again.',
  'unverified-google':
    'That Google account has not verified its email address, so it cannot be used to sign in here.',
  account: 'The account could not be opened. Try again in a moment.',
  server: 'That sign-in failed on our side.',
};
