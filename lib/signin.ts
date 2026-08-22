/* FINISHING A SIGN-IN.
   ────────────────────────────────────────────────────────────────
   Every route that authenticates someone — password, code, Google —
   ends here, so the session cookie is set exactly one way and the
   anonymous history is adopted exactly one way.

   ── ON ADOPTING AN ANONYMOUS TRACK RECORD ──

   The decisions this account made before it was an account live
   under a random id in that browser's localStorage. To claim them,
   the browser has to tell us the id, which means it arrives in a
   request — so the honest description of the guarantee is not "the
   server proved you own it", because the server cannot prove that.

   What actually protects it is two things, and it is worth being
   precise rather than reassuring:

     · the id is 128 random bits, so it cannot be guessed; knowing
       one effectively means having had access to that browser
     · an id can be adopted ONCE. The first account to claim it owns
       it, and every later claim is refused. So even a leaked id
       cannot be used to silently attach to someone else's account
       later, and the real owner's record cannot be stolen out from
       under them after the fact.

   The decision documents themselves are NEVER rewritten. Ownership
   is a separate list on the user, and the track record reads the
   union of it. That is not incidental tidiness — this whole product
   rests on the claim that a decision is written before the outcome
   and never revised afterwards, and quietly rewriting a field on
   every historical row at signup would make that claim false. */

import { cookies } from 'next/headers';
import type { ObjectId } from 'mongodb';
import { createSession, recordAdoption, type User } from './users';
import { SESSION_COOKIE, sessionCookieOptions } from './current-user';
import { anonIdIsClaimed } from './decisions';

/** The shape a browser id must have to be considered at all. */
const ANON_RE = /^[a-z0-9]{16,64}$/i;

export async function adoptAnonymousHistory(
  userId: ObjectId,
  anonId: unknown
): Promise<'adopted' | 'skipped' | 'already-claimed'> {
  if (typeof anonId !== 'string' || !ANON_RE.test(anonId)) return 'skipped';
  try {
    if (await anonIdIsClaimed(anonId, String(userId))) return 'already-claimed';
    await recordAdoption(userId, anonId);
    return 'adopted';
  } catch {
    /* Failing to adopt must never fail the sign-in. The user gets
       into their account; the old rows stay where they are and can
       be adopted on a later sign-in from the same browser. */
    return 'skipped';
  }
}

/** Sets the cookie and returns what the client is told. */
export async function establishSession(
  user: User,
  anonId?: unknown
): Promise<{ adopted: boolean }> {
  const token = await createSession(String(user._id));
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  let adopted = false;
  if (anonId && user._id) {
    adopted = (await adoptAnonymousHistory(user._id, anonId)) === 'adopted';
  }
  return { adopted };
}
