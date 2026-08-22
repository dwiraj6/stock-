/* SCREEN 3 · RESULTS
   ────────────────────────────────────────────────────────────────
   A single scrolling page. Seven modules, 96px apart, each
   introduced by its eyebrow.

   Nothing here animates on scroll. The whole page runs its entry
   sequence once and is then completely still. */

import GapModule from '../modules/GapModule.jsx';
import FanChart from '../modules/FanChart.jsx';
import StockModule from '../modules/StockModule.jsx';
import ScoreModule from '../modules/ScoreModule.jsx';
import NewsModule from '../modules/NewsModule.jsx';
import SipModule from '../modules/SipModule.jsx';
import CalibrationModule from '../modules/CalibrationModule.jsx';
import VerdictModule from '../modules/VerdictModule.jsx';
import { ThinDataNote } from '../components/States.jsx';
import { useEffect, useState } from 'react';
import { useReducedMotion, useSettled } from '../lib/hooks.js';
import { getCalibration } from '../lib/client.js';
import { adaptCalibration } from '../lib/adapt.js';

export default function Results({ run }) {
  const reduced = useReducedMotion();
  const [calibration, setCalibration] = useState(null);
  const [probability, setProbability] = useState(null);
  const [factors, setFactors] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCalibration().then((res) => {
      if (!cancelled && res?.ok) {
        setCalibration(adaptCalibration(res.calibration));
        setProbability(res.probability ?? null);
        setFactors(res.factors ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  /* 2600ms clears the longest entry sequence on this page (the gap
     module's caption at 1300+240, the fan's median draw at 900+400,
     the candle stagger at ~130x4+500+400). After that the page is
     genuinely still: the animations detach rather than merely
     finishing. */
  const settled = useSettled(2600);
  const animate = !reduced && !settled;
  const { quote, model, sim, news, amount, conviction } = run;

  return (
    <main
      className="pl-page"
      style={{ animation: animate ? 'pl-fade-in 200ms linear both' : 'none' }}
    >
      <h1 className="sr-only">
        {quote.name} — your conviction {conviction}, the model’s {model.score}
      </h1>

      {/* The warning is the server's own, computed from how many
          trading days it actually had. */}
      {(sim.warning || model.warning) && (
        <ThinDataNote text={sim.warning ?? model.warning} />
      )}

      <div className="pl-modules">
        <GapModule
          conviction={conviction}
          score={model.score}
          model={model}
          amount={amount}
          animate={animate}
        />

        <FanChart sim={sim} amount={amount} asOf={quote.asOf} animate={animate} />

        <StockModule quote={quote} animate={animate} />

        <ScoreModule
          quote={quote}
          model={model}
          conviction={conviction}
          animate={animate}
        />

        {/* Directly after the score: these headlines are not in it. */}
        <NewsModule news={news} symbol={quote.ticker} animate={animate} />

        <SipModule sim={sim} amount={amount} animate={animate} />

        <CalibrationModule
          calibration={calibration}
          probability={probability}
          factors={factors}
          animate={animate}
        />

        <VerdictModule
          quote={quote}
          model={model}
          sim={sim}
          amount={amount}
          conviction={conviction}
          animate={animate}
        />
      </div>
    </main>
  );
}
