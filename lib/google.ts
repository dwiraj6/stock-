/* SIGN IN WITH GOOGLE.
   ────────────────────────────────────────────────────────────────
   The OAuth 2.0 Authorization Code flow with PKCE, written out.

   Three things are doing the security work here, and it is worth
   naming them because they are the parts people leave out:

     STATE   a random value put in a cookie and echoed through
             Google. If what comes back does not match the cookie,
             the callback was not started by this browser — that is
             login CSRF, and this is what stops it.

     PKCE    a random verifier kept in a cookie; only its SHA-256
             goes to Google. An attacker who intercepts the
             authorization code cannot redeem it without the
             verifier. Google does not require PKCE for confidential
             web clients, but it costs two cookies and removes a
             whole class of interception attack.

     ID TOKEN VERIFICATION
             the identity is read from the id_token, and the token is
             checked — signature against Google's published keys,
             issuer, audience, and expiry. Skipping this is the
             classic OAuth bug: without it, any token from any Google
             app would be accepted as a login here.

   The email is only trusted when Google says email_verified. An
   unverified Google address must never be able to claim an existing
   password account with the same email — that would be a complete
   account takeover with no password needed. */

import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const GOOGLE_STATE_COOKIE = 'plumbline_oauth_state';
export const GOOGLE_VERIFIER_COOKIE = 'plumbline_oauth_verifier';
export const GOOGLE_RETURN_COOKIE = 'plumbline_oauth_return';

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** The redirect URI must match what is registered in the Google
    Cloud console byte for byte, so it is derived from one place. */
export function googleRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/auth/google/callback`;
}

function base64url(b: Buffer): string {
  return b.toString('base64url');
}

export function newState(): string {
  return base64url(randomBytes(24));
}

export function newVerifier(): string {
  return base64url(randomBytes(48));
}

export function challengeFor(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

export function authorizeUrl(opts: {
  origin: string;
  state: string;
  verifier: string;
}): string {
  const u = new URL(AUTH_ENDPOINT);
  u.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  u.searchParams.set('redirect_uri', googleRedirectUri(opts.origin));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', opts.state);
  u.searchParams.set('code_challenge', challengeFor(opts.verifier));
  u.searchParams.set('code_challenge_method', 'S256');
  /* select_account, not consent: returning users get a one-tap
     account picker instead of being asked to re-approve scopes they
     already granted. */
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

/* Google's signing keys, fetched once and cached by jose, which also
   handles key rotation. Verifying against these is what makes the
   id_token trustworthy. */
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Redeem the code and return a verified identity, or null. */
export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  origin: string;
}): Promise<GoogleIdentity | null> {
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: opts.code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(opts.origin),
        grant_type: 'authorization_code',
        code_verifier: opts.verifier,
      }),
    });
    if (!res.ok) return null;

    const tokens = (await res.json()) as { id_token?: string };
    if (!tokens.id_token) return null;

    const { payload } = await jwtVerify(tokens.id_token, jwks, {
      issuer: ISSUERS,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!email || !sub) return null;

    return {
      sub,
      email,
      // Google sends this as a boolean or the string "true".
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : null,
    };
  } catch {
    return null;
  }
}
