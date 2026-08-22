/* THE SERVER-SIDE GATE.
   ────────────────────────────────────────────────────────────────
   The UI redirects to /login before it will run an analysis, but a
   gate that lives only in the client is decoration: the routes are
   public URLs and curl does not run React. This is the one that
   actually holds.

   Applied to the routes that constitute the measurement itself —
   the Monte Carlo and the score. Search and quotes stay open,
   because the entry screen has to work before you sign in: you pick
   a stock, size the position and commit your number, and only then
   are you asked who you are. */

import { fail } from './api';
import { currentUser } from './current-user';
import type { User } from './users';

export type Gate = { user: User } | { response: Response };

export async function requireUser(): Promise<Gate> {
  const user = await currentUser();
  if (user) return { user };
  return {
    response: fail(
      'AUTH_REQUIRED',
      'Sign in to run a measurement.',
      'Your stock, amount and conviction are kept — signing in seals them with today’s price and starts the twelve-month clock.'
    ),
  };
}
