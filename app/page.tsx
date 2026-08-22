/* The landing page.
   A server component: it reads the committed backtest files at build
   time and hands the real numbers to the client. Every statistic on
   the page is therefore the same number the app itself reports —
   there is nothing hand-written to drift out of date. */
import LandingClient from './landing-client';
import { readExhibits } from '@/lib/exhibits';

export default function Page() {
  return <LandingClient stats={readExhibits()} />;
}
