/* FIREBASE, IN THE BROWSER, FOR ONE JOB.
   ────────────────────────────────────────────────────────────────
   Opening the Google popup and getting back an ID token. That token
   is posted to /api/auth/firebase once, exchanged for this app's own
   session cookie, and Firebase is never consulted again — no
   listener, no persisted Firebase session, no second opinion about
   who is signed in.

   That matters for more than tidiness. Two independent session
   systems drift: Firebase thinks you are signed in, the app has
   expired you, and the UI shows one thing while every request does
   another. So Firebase's own persistence is switched off, and the
   cookie the server sets is the only answer to "who is this".

   The SDK is imported dynamically so its ~200KB never enters the
   bundle for the people who sign in with a password. */

let cached = null;

export function firebaseEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

async function getAuth() {
  if (cached) return cached;

  const [{ initializeApp, getApps }, authMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = authMod.getAuth(app);

  /* No persistence. The app's own cookie is the session; a Firebase
     one sitting alongside it would be a second source of truth that
     can disagree with the first. */
  await authMod.setPersistence(auth, authMod.inMemoryPersistence).catch(() => undefined);

  cached = { auth, ...authMod };
  return cached;
}

/**
 * Open the Google popup and return an ID token.
 * @returns {Promise<{ ok: true, idToken: string } | { ok: false, message: string, action: string }>}
 */
export async function signInWithGoogle() {
  if (!firebaseEnabled()) {
    return {
      ok: false,
      message: 'Google sign-in is not configured on this server.',
      action: 'Use email and password instead.',
    };
  }

  try {
    const { auth, GoogleAuthProvider, signInWithPopup } = await getAuth();
    const provider = new GoogleAuthProvider();
    /* Always show the picker. Silently reusing whichever Google
       account the browser happens to hold is the wrong default on a
       shared machine. */
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { ok: true, idToken };
  } catch (e) {
    const code = e?.code ?? '';

    /* A closed popup is not an error worth shouting about — the user
       changed their mind, and an alarming red message for that is
       just noise. */
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled'
    ) {
      return { ok: false, cancelled: true, message: '', action: '' };
    }

    if (code === 'auth/popup-blocked') {
      return {
        ok: false,
        message: 'Your browser blocked the Google window.',
        action: 'Allow popups for this site, or sign in with email and password.',
      };
    }

    if (code === 'auth/unauthorized-domain') {
      return {
        ok: false,
        message: 'This site is not on the Firebase authorised domain list.',
        action:
          'Add this domain under Firebase console → Authentication → Settings → Authorised domains.',
      };
    }

    if (code === 'auth/account-exists-with-different-credential') {
      return {
        ok: false,
        message: 'That email already has an account here with a password.',
        action: 'Sign in with your password, and Google will be linked to it afterwards.',
      };
    }

    return {
      ok: false,
      message: 'That Google sign-in did not complete.',
      action: code ? `Try again. (${code})` : 'Try again.',
    };
  }
}
