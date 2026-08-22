/* /login — sign in, sign up, verify, reset.
   ────────────────────────────────────────────────────────────────
   A server component only so the panel on the left can quote the
   real backtest numbers from the committed exhibits. Everything
   interactive is in the client component below it. */
import type { Metadata } from 'next';
import LoginClient from './login-client';
import { readExhibits } from '@/lib/exhibits';

export const metadata: Metadata = {
  title: 'Sign in — stockಶಿಷ್ಯ',
  description: 'Sign in to record a measurement and keep your track record.',
  // A sign-in page has nothing to offer a search index.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LoginClient stats={readExhibits()} />;
}
