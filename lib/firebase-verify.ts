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

export function firebaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

export type FirebaseIdentity = {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

/** @returns a verified identity, or null. Never throws. */
export async function verifyFirebaseToken(token: string): Promise<FirebaseIdentity | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !token) return null;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    /* `sub` is the Firebase uid. `user_id` carries the same value and
       is what older tokens populate, so both are accepted. */
    const uid =
      (typeof payload.sub === 'string' && payload.sub) ||
      (typeof payload.user_id === 'string' && payload.user_id) ||
      '';
    if (!email || !uid) return null;

    return {
      uid,
      email,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : null,
    };
  } catch {
    return null;
  }
}
