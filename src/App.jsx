'use client';

import { useCallback, useEffect, useState } from 'react';
import { Masthead, Footer } from './components/Chrome.jsx';
import Entry from './screens/Entry.jsx';
import Computing from './screens/Computing.jsx';
import Results from './screens/Results.jsx';
import Methodology from './screens/Methodology.jsx';
import TrackRecord from './screens/TrackRecord.jsx';
import ConversationPanel from './components/ConversationPanel.jsx';
import PlumbCompanion from './components/PlumbCompanion.jsx';
import { StaleCacheStrip, FailedState, EmptyState } from './components/States.jsx';
import { useHashRoute } from './lib/hooks.js';
import * as api from './lib/client.js';
import { adaptStock, adaptSim, adaptScore } from './lib/adapt.js';

export default function App() {
  const [route, navigate] = useHashRoute();
  const [phase, setPhase] = useState('entry'); // entry | computing | results
  const [pending, setPending] = useState(null);
  const [run, setRun] = useState(null);
  const [failed, setFailed] = useState(null);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  /* A question the bob's observation handed over, asked the moment
     the panel opens so the conversation starts mid-thread rather
     than at a blank prompt. */
  const [seedQuestion, setSeedQuestion] = useState(null);
  const [market, setMarket] = useState(null);
  // Bumped when an answer finishes, so the bob can nudge once.
  const [answeredAt, setAnsweredAt] = useState(null);
  const [answering, setAnswering] = useState(false);

  /* Kick off the three requests as soon as the user submits, then
     let the computing screen play its sequence over the top. The
     network and the animation run concurrently — the screen never
     waits on a request that has already finished, and never cuts a
     request short. */
  const start = useCallback(async ({ symbol, amount, conviction }) => {
    setFailed(null);
    setPending({ symbol, amount, conviction, ready: null });
    setPhase('computing');

    /* News is fetched with the rest but never blocks: if the feed is
       down the page still renders and the news module says so. */
    const [stockRes, simRes, scoreRes, newsRes] = await Promise.all([
      api.getStock(symbol.symbol, 3),
      api.simulate(symbol.symbol, amount),
      api.score(symbol.symbol, conviction, amount),
      api.getNews(symbol.symbol).catch(() => ({ ok: false, items: [] })),
    ]);

    if (!stockRes.ok) {
      setFailed({ ticker: symbol.symbol, payload: stockRes });
      setPhase('entry');
      return;
    }
    if (!simRes.ok) {
      setFailed({ ticker: symbol.symbol, payload: simRes });
      setPhase('entry');
      return;
    }
    if (!scoreRes.ok) {
      setFailed({ ticker: symbol.symbol, payload: scoreRes });
      setPhase('entry');
      return;
    }

    setPending((p) =>
      p
        ? {
            ...p,
            ready: {
              quote: adaptStock(stockRes),
              sim: adaptSim(simRes),
              model: adaptScore(scoreRes),
              news: newsRes,
              amount,
              conviction,
            },
          }
        : p
    );
    /* Log the decision the moment the measurement exists — before
       the user has seen the answer and long before the outcome does.
       Fire-and-forget: a failure here must never block the results. */
    const priceAt = stockRes.quote?.price ?? null;
    const modelProb = scoreRes.modelProb ?? null;
    if (priceAt && modelProb != null) {
      void api.recordDecision({
        symbol: symbol.symbol,
        amount,
        userProb: conviction / 100,
        modelProb,
        priceAt,
      });
    }

    setMarket({
      marketState: stockRes.marketState,
      isLive: stockRes.isLive,
      asOfLabel: stockRes.asOfLabel,
      meta: stockRes.meta,
    });
  }, []);

  /* The computing screen calls this when its sequence finishes. If
     the data has not landed yet it waits for it rather than showing
     an empty results page. */
  const finish = useCallback(() => {
    setPending((p) => {
      if (p?.ready) {
        setRun(p.ready);
        setPhase('results');
        window.scrollTo(0, 0);
      }
      return p;
    });
  }, []);

  // If the log finished before the network did, show results the
  // moment the payload arrives.
  useEffect(() => {
    if (phase === 'computing' && pending?.ready && pending.logDone) {
      setRun(pending.ready);
      setPhase('results');
      window.scrollTo(0, 0);
    }
  }, [phase, pending]);

  const onLogDone = useCallback(() => {
    setPending((p) => (p ? { ...p, logDone: true } : p));
    finish();
  }, [finish]);

  const home = useCallback(() => {
    setPhase('entry');
    setRun(null);
    setPending(null);
    setFailed(null);
    setAskOpen(false);
    navigate('');
    window.scrollTo(0, 0);
  }, [navigate]);

  const retry = useCallback(() => {
    if (!pending) {
      setFailed(null);
      return;
    }
    start({
      symbol: pending.symbol,
      amount: pending.amount,
      conviction: pending.conviction,
    });
  }, [pending, start]);

  /* REAL TIME.
     While the market is open the server says pollMs=30000 and the
     masthead price follows the live (15-min delayed) quote. When it
     is shut the server says pollMs=0 and this stops entirely rather
     than hammering a feed that cannot change. The client never picks
     the interval — it does what the server's market clock tells it. */
  useEffect(() => {
    if (phase !== 'results' || !run) return;
    const stop = api.pollQuote(run.quote.ticker, (body) => {
      if (!body?.ok) return;
      setRun((r) =>
        r
          ? {
              ...r,
              quote: {
                ...r.quote,
                price: body.quote.price ?? r.quote.price,
                dayChange: body.quote.changePercent ?? r.quote.dayChange,
              },
            }
          : r
      );
      setMarket({
        marketState: body.marketState,
        isLive: body.isLive,
        asOfLabel: body.asOfLabel,
        meta: body.meta,
      });
    });
    return stop;
  }, [phase, run?.quote.ticker]);

  useEffect(() => {
    if (!askOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setAskOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [askOpen]);

  const quoteForChrome = phase === 'results' && run ? run.quote : null;
  const onMethodology = () => navigate('method');

  // The strip appears only when the server actually served stale or
  // degraded data — never as decoration.
  const showStale =
    phase === 'results' &&
    run &&
    !staleDismissed &&
    (run.quote.meta?.isStale || run.quote.meta?.degraded);

  if (route === 'record') {
    return (
      <>
        <Masthead
          quote={quoteForChrome}
          onMethodology={onMethodology}
          onAsk={() => { setSeedQuestion(null); setAskOpen(true); }}
          onHome={home}
          onRecord={() => navigate('record')}
        />
        <TrackRecord onBack={() => navigate('')} />
        <Footer market={market} />
      </>
    );
  }

  if (route === 'method') {
    return (
      <>
        <Masthead
          quote={quoteForChrome}
          onMethodology={onMethodology}
          onAsk={() => { setSeedQuestion(null); setAskOpen(true); }}
          onHome={home}
          onRecord={() => navigate('record')}
        />
        <Methodology onBack={() => navigate('')} />
        <Footer market={market} />
      </>
    );
  }

  return (
    <>
      <Masthead
        quote={quoteForChrome}
        onMethodology={onMethodology}
        onAsk={() => { setSeedQuestion(null); setAskOpen(true); }}
        onHome={home}
        onRecord={() => navigate('record')}
      />

      {showStale && (
        <StaleCacheStrip meta={run.quote.meta} onDismiss={() => setStaleDismissed(true)} />
      )}

      {failed && (
        <FailedState
          ticker={failed.ticker}
          payload={failed.payload}
          onRetry={retry}
          onHome={home}
          onPickSuggestion={(sym) =>
            start({
              symbol: { symbol: sym },
              amount: pending?.amount ?? 50000,
              conviction: pending?.conviction ?? 72,
            })
          }
        />
      )}

      {!failed && phase === 'entry' && <Entry onRun={start} />}

      {!failed && phase === 'computing' && pending && (
        <Computing
          symbol={pending.symbol}
          ready={Boolean(pending.ready)}
          onDone={onLogDone}
        />
      )}

      {!failed && phase === 'results' && run && <Results run={run} />}

      {!failed && phase === 'results' && !run && <EmptyState onHome={home} />}

      {run && (
        <>
          {/* The plumb bob docks here and becomes the way in. */}
          <PlumbCompanion
            open={askOpen}
            onOpen={(q) => {
              setSeedQuestion(typeof q === 'string' ? q : null);
              setAskOpen(true);
            }}
            symbol={run.quote.ticker}
            answering={answering}
            answeredAt={answeredAt}
            run={run}
          />
          <ConversationPanel
            open={askOpen}
            onClose={() => {
              setAskOpen(false);
              setSeedQuestion(null);
            }}
            run={run}
            seedQuestion={seedQuestion}
            onSeedConsumed={() => setSeedQuestion(null)}
            onAnswering={setAnswering}
            onAnswered={() => setAnsweredAt(Date.now())}
          />
        </>
      )}

      <Footer market={market} />
    </>
  );
}
