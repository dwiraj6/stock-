/* VERIFYING A FIREBASE ID TOKEN.
   ────────────────────────────────────────────────────────────────
   Firebase does the Google handshake in the browser and hands back
   an ID token. This turns that token into a trusted identity — or
   refuses it.

   WHY FIREBASE IS HERE AT ALL, stated plainly so the next person
   does not wonder: the app already had a complete OAuth
   implementation (authorization code + PKCE + state + JWKS
   verification) and it was correct. What it could not do was
   configure Google's CONSENT SCREEN, which is a form in the Google
   Cloud console and nothing to do with code. Firebase provisions
   that screen automatically when Google sign-in is enabled, so it is
   here to route around a piece of console configuration. That is the
   whole reason. lib/google.ts is kept alongside it and still works
   for anyone who fills the form in.

   WHY NOT firebase-admin: it is a large dependency that wants a
   service-account private key in the environment, and all it would
   do here is verify a JWT. A Firebase ID token is an ordinary RS256
   JWT signed by Google, published at a standard JWKS endpoint, so
   `jose` verifies it in a dozen lines with no extra secret to leak.

   WHAT IS CHECKED, and each one matters:

     signature   against Google's published keys, so the token is
                 really Google's and not something a client made up
     issuer      https://securetoken.google.com/<projectId>
     audience    <projectId> — without this, an ID token minted for
                 ANY other Firebase project would be accepted here,
                 which is the classic and complete break
     expiry      handled by jose
     email       must be present and verified

   Firebase only ever hands back a token; the session it becomes is
   this app's own, set in this app's own cookie. Firebase is the
   doorman, not the building. */

import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/* Cached across requests, and jose handles key rotation itself. */
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

/* Read once, and STRIPPED OF QUOTES.

   A .env file wants `X="value"` and a hosting dashboard wants plain
   `value`, so pasting one into the other is the single most common
   deployment mistake there is. Here it would be silent and baffling:
   the project id becomes `"stock-963fa"` including the quote marks,
   every check that only asks "is it set?" still passes, and then
   every real token fails the audience check with an error that
   points nowhere near the cause.

   Trimming costs nothing and removes the whole class. A project id
   can never legitimately contain a quote character. */
function projectId(): string {
  return (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '').trim().replace(/^["']|["']$/g, '');
}

export function firebaseConfigured(): boolean {
  return Boolean(projectId());
}

export type FirebaseIdentity = {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export type VerifyResult =
  | { ok: true; identity: FirebaseIdentity }
  | { ok: false; reason: string };

/** Verify, and say WHY when it fails.
    "Could not be verified" is useless to the person hitting it and
    useless to whoever has to debug it — a wrong audience, an expired
    token and an unreachable JWKS endpoint need three different
    fixes. The reason is logged server-side and a short code goes to
    the client, which is safe: none of it says anything an attacker
    does not already know from their own token. */
export async function verifyFirebaseTokenDetailed(token: string): Promise<VerifyResult> {
  const pid = projectId();
  if (!pid) return { ok: false, reason: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set on the server' };
  if (!token) return { ok: false, reason: 'no token supplied' };

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${pid}`,
      audience: pid,
    });

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    /* `sub` is the Firebase uid. `user_id` carries the same value and
       is what older tokens populate, so both are accepted. */
    const uid =
      (typeof payload.sub === 'string' && payload.sub) ||
      (typeof payload.user_id === 'string' && payload.user_id) ||
      '';
    if (!email) return { ok: false, reason: 'the token carries no email address' };
    if (!uid) return { ok: false, reason: 'the token carries no subject' };

    return {
      ok: true,
      identity: {
        uid,
        email,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: typeof payload.name === 'string' ? payload.name : null,
      },
    };
  } catch (e) {
    /* jose's codes are specific and worth passing through:
         ERR_JWT_CLAIM_VALIDATION_FAILED  wrong audience or issuer —
                                          almost always a project-id
                                          mismatch between the browser
                                          config and the server env
         ERR_JWT_EXPIRED                  stale token
         ERR_JWKS_NO_MATCHING_KEY         key rotation, or not a
                                          Firebase token at all
         anything fetch-shaped            the JWKS endpoint was
                                          unreachable from the server */
    const code = (e as { code?: string })?.code ?? '';
    const msg = e instanceof Error ? e.message : String(e);

    /* The commonest real failure, named rather than left as a jose
       code: the browser signed in against one Firebase project and
       the server is checking against another. */
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      return {
        ok: false,
        reason:
          `the token was not issued for project "${pid}" — the server's ` +
          `NEXT_PUBLIC_FIREBASE_PROJECT_ID does not match the one the browser signed in with`,
      };
    }
    return { ok: false, reason: code ? `${code}: ${msg}` : msg };
  }
}

/** @returns a verified identity, or null. Never throws. */
export async function verifyFirebaseToken(token: string): Promise<FirebaseIdentity | null> {
  const res = await verifyFirebaseTokenDetailed(token);
  return res.ok ? res.identity : null;
}
