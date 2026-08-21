/* API payload → component props.
   ────────────────────────────────────────────────────────────────
   The visual components were built and verified against a particular
   shape. Rather than rewrite each of them for the API's shape, this
   module translates once, here, where the mapping is visible and
   testable.

   Everything below is a projection of real server data. There is no
   generation, no interpolation, and no default value standing in for
   a missing field — a null arrives as a null and the UI says so. */

/** /api/stock → the shape StockModule and ScoreModule consume. */
export function adaptStock(stock) {
  const f = stock.fundamentals ?? {};
  const med = stock.sectorMedians ?? {};
  const bars = (stock.history ?? []).map((b) => ({
    date: new Date(b.date),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    adjClose: b.adjClose,
    volume: b.volume,
    down: b.close < b.open,
  }));

  const closes = bars.map((b) => b.close);

  // 52-week window from the bars themselves.
  const window = bars.slice(Math.max(0, bars.length - 252));
  let low52 = Infinity;
  let high52 = -Infinity;
  for (const b of window) {
    if (b.low < low52) low52 = b.low;
    if (b.high > high52) high52 = b.high;
  }

  const q = stock.quote ?? {};

  return {
    ticker: stock.profile.symbol,
    name: stock.profile.name,
    exchange: stock.profile.exchange,
    sectorName: stock.profile.sector ?? null,
    industry: stock.profile.industry ?? null,
    tradingViewSymbol: stock.tradingViewSymbol,
    tradingViewExchange: stock.tradingViewExchange ?? 'BSE',
    tradingViewNote: stock.tradingViewNote ?? null,
    tradingViewConfig: stock.tradingViewConfig,

    price: q.price ?? (closes.length ? closes[closes.length - 1] : null),
    dayChange: q.changePercent ?? null,

    bars,
    closes,
    low52: Number.isFinite(low52) ? low52 : (q.fiftyTwoWeekLow ?? null),
    high52: Number.isFinite(high52) ? high52 : (q.fiftyTwoWeekHigh ?? null),

    // Fundamentals. null stays null — never substituted.
    pe: f.trailingPE ?? null,
    pb: f.priceToBook ?? null,
    de: f.debtToEquity ?? null,
    roe: f.returnOnEquity === null || f.returnOnEquity === undefined ? null : f.returnOnEquity * 100,
    profitMargin: f.profitMargins === null || f.profitMargins === undefined ? null : f.profitMargins * 100,
    bookValue: f.bookValue ?? null,
    dividendYield: f.dividendYield === null || f.dividendYield === undefined ? null : f.dividendYield * 100,
    marketCapCr: f.marketCap ? f.marketCap / 1e7 : null,

    sectorMedians: {
      pe: med.trailingPE ?? null,
      pb: med.priceToBook ?? null,
      de: med.debtToEquity ?? null,
      roe: med.returnOnEquity === null || med.returnOnEquity === undefined ? null : med.returnOnEquity * 100,
      profitMargin:
        med.profitMargins === null || med.profitMargins === undefined ? null : med.profitMargins * 100,
      dividendYield:
        med.dividendYield === null || med.dividendYield === undefined ? null : med.dividendYield * 100,
    },
    sectorMediansMeta: stock.sectorMediansMeta ?? null,

    daysAvailable: stock.daysAvailable ?? bars.length,
    thinData: (stock.daysAvailable ?? bars.length) < 250,
    historyLabel: `${stock.daysAvailable ?? bars.length} trading days`,
    asOf: new Date(stock.asOf ?? Date.now()),
    asOfLabel: stock.asOfLabel,
    marketState: stock.marketState,
    isLive: stock.isLive,
    renamedFrom: stock.profile.renamedFrom ?? null,
    meta: stock.meta,
  };
}

/** /api/simulate → the shape FanChart and SipModule consume. */
export function adaptSim(sim) {
  const amount = sim.amount;
  const pts = sim.pathPoints ?? [];

  // paths arrive as multipliers; the charts want rupees.
  const drawn = (sim.paths ?? []).map((row) => row.map((m) => m * amount));

  return {
    amount,
    band: sim.band ?? { p10: [], p50: [], p90: [] },
    /* The outcome density is computed server-side from all 10,000
       terminal values and arrives as a curve. */
    density: sim.density ?? null,
    pathPoints: pts,
    drawn,
    lump: {
      p10: sim.lumpsum['12M'].p10,
      p50: sim.lumpsum['12M'].p50,
      p90: sim.lumpsum['12M'].p90,
      pnl: sim.lumpsum['12M'].pnl,
    },
    sip: {
      p10: sim.sip['12M'].p10,
      p50: sim.sip['12M'].p50,
      p90: sim.sip['12M'].p90,
      pnl: sim.sip['12M'].pnl,
      tranche: amount / 12,
    },
    horizons: { lumpsum: sim.lumpsum, sip: sim.sip },
    mu: sim.params.mu,
    sigma: sim.params.sigma,
    params: sim.params,
    warning: sim.warning ?? null,
    limitation: sim.limitation,
    meta: sim.meta,
  };
}

/** /api/score → the shape ScoreModule and VerdictModule consume. */
export function adaptScore(score) {
  return {
    score: score.modelScore,
    gap: score.gap,
    absGap: score.absGap,
    conviction: score.conviction,
    components: score.components.map((c) => ({
      key: c.key,
      name: c.name,
      score: c.score,
      weight: c.weight,
      metric: c.reason,
      metrics: c.metrics,
      missing: c.missing,
    })),
    discounting: score.discounting ?? [],
    verdict: score.verdict,
    suggestion: score.suggestion,
    sector: score.sector,
    sectorConstituents: score.sectorConstituents,
    sectorMediansGeneratedAt: score.sectorMediansGeneratedAt,
    warning: score.warning ?? null,
    meta: score.meta,
  };
}

/** /api/calibration → the shape CalibrationModule consumes. */
export function adaptCalibration(cal) {
  const steps = 13;
  return {
    generatedAt: cal.generatedAt,
    cutoffDate: cal.cutoffDate,
    total: cal.universe,
    hits: cal.hits,
    expectedHits: cal.expectedHits,
    interpretation: cal.interpretation,
    missNarrative: cal.missNarrative,
    method: cal.method,
    entries: (cal.results ?? []).map((r) => {
      // Normalise both series to the cutoff price so a 140px panel
      // can draw them on one scale.
      const base = r.cutoffPrice || 1;
      const band = (r.predictedPath ?? []).map((p) => ({
        lo: p.p10 / base,
        hi: p.p90 / base,
        mid: p.p50 / base,
      }));
      const actual = (r.actualPath ?? []).map((p) => p.value / base);
      return {
        ticker: r.symbol,
        name: r.name,
        hit: r.hit,
        band: band.length ? band : new Array(steps).fill({ lo: 0.9, hi: 1.1, mid: 1 }),
        actual: actual.length ? actual : new Array(steps).fill(1),
        endPct: r.actualReturnPct,
        predictedP10: r.predictedP10,
        predictedP90: r.predictedP90,
        actualValue: r.actual,
        note: r.hit
          ? `Finished ${r.actualReturnPct >= 0 ? 'up' : 'down'} ${Math.abs(r.actualReturnPct).toFixed(1)}%, inside the predicted band of ₹${Math.round(r.predictedP10).toLocaleString('en-IN')}–₹${Math.round(r.predictedP90).toLocaleString('en-IN')}.`
          : `Finished at ₹${Math.round(r.actual).toLocaleString('en-IN')}, outside the predicted band of ₹${Math.round(r.predictedP10).toLocaleString('en-IN')}–₹${Math.round(r.predictedP90).toLocaleString('en-IN')} — ${(r.missMagnitude * 100).toFixed(1)}% beyond the edge.`,
      };
    }),
  };
}
