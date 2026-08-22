/* GET /api/auth/me — who is this browser?
   ────────────────────────────────────────────────────────────────
   The one call the client makes on load to decide whether to show
   "Sign in" or a name. Never cached: a stale answer here means the
   UI claims someone is signed in after they signed out. */

import { ok, guard } from '@/lib/api';
import { currentUser, publicUser } from '@/lib/current-user';
import { googleConfigured } from '@/lib/google';
import { firebaseConfigured } from '@/lib/firebase-verify';
import { mailConfigured } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard('auth:me', async () => {
    const user = await currentUser();
    /* The client is told which methods this server can actually
       offer, so the login page can hide a Google button that would
       only 500, or explain that email codes are unavailable, rather
       than presenting a control that cannot work. */
    return ok({
      user: user ? publicUser(user) : null,
      /* `google` is true if EITHER path can serve it: Firebase (which
         provisions Google's consent screen for you) or the direct
         OAuth implementation in lib/google.ts. The client prefers
         Firebase when both are available, because it is the one that
         works without hand-configuring the consent screen. */
      methods: {
        google: firebaseConfigured() || googleConfigured(),
        firebase: firebaseConfigured(),
        /* True when an email account can be CREATED, by either route:
           a real mail server, or an explicit decision to skip
           verification. The login page only needs to know whether the
           form will work. */
        email: mailConfigured() || (process.env.ALLOW_UNVERIFIED_SIGNUP ?? '').trim() === '1',
        emailVerification: mailConfigured(),
      },
    });
  });
}
