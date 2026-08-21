/* Independent verification of the volatility estimate.
   Recomputes sigma from scratch with a separate implementation and
   compares. Prints the intermediate values so they can be checked
   by hand in Excel or pandas. */
import { resolveSymbol } from '../lib/symbols';
import { fetchHistory } from '../lib/market-data';
import { estimateParams, simulate, winsorize, logReturns } from '../lib/simulate';

const SYM = process.argv[2] ?? 'RELIANCE';

(async () => {
  const r = resolveSymbol(SYM);
  if (!r.found) { console.log('not found'); process.exit(1); }
  const h = await fetchHistory(r.symbol, 3);
  const bars = h!.data;

  // ── window: last 2 years, same rule as estimateParams ──
  const cutoff = Date.now() - 2 * 365.25 * 86400000;
  const win = bars.filter(b => new Date(b.date).getTime() >= cutoff);
  const adj = win.map(b => b.adjClose);

  // ── INDEPENDENT implementation (deliberately naive) ──
  const rets: number[] = [];
  for (let i = 1; i < adj.length; i++) rets.push(Math.log(adj[i] / adj[i-1]));
  let sum = 0; for (const x of rets) sum += x;
  const mu = sum / rets.length;
  let ss = 0; for (const x of rets) ss += (x - mu) ** 2;
  const sdRaw = Math.sqrt(ss / (rets.length - 1));

  // winsorized version, computed independently
  const s = [...rets].sort((a,b)=>a-b);
  const q = (p: number) => { const i=(s.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i);
    return lo===hi ? s[lo] : s[lo]+(s[hi]-s[lo])*(i-lo); };
  const lo = q(0.01), hi = q(0.99);
  const w = rets.map(v => v < lo ? lo : v > hi ? hi : v);
  let wsum = 0; for (const x of w) wsum += x;
  const wmu = wsum / w.length;
  let wss = 0; for (const x of w) wss += (x - wmu) ** 2;
  const sdW = Math.sqrt(wss / (w.length - 1));

  console.log(`=== ${r.symbol.symbol} — ${r.symbol.name} ===`);
  console.log(`bars(3y)=${bars.length}  window(2y)=${adj.length}  logReturns=${rets.length}`);
  console.log(`first adjClose ${adj[0].toFixed(4)} (${win[0].date.slice(0,10)})`);
  console.log(`last  adjClose ${adj[adj.length-1].toFixed(4)} (${win[win.length-1].date.slice(0,10)})`);
  console.log('');
  console.log('INDEPENDENT (raw, no winsorize)');
  console.log(`  mu_daily     ${mu.toExponential(10)}`);
  console.log(`  sigma_daily  ${sdRaw.toFixed(12)}`);
  console.log(`  sigma_annual ${(sdRaw*Math.sqrt(252)*100).toFixed(6)} %`);
  console.log('INDEPENDENT (winsorized 1%/99%)');
  console.log(`  clip bounds  [${lo.toFixed(8)}, ${hi.toFixed(8)}]`);
  console.log(`  mu_daily     ${wmu.toExponential(10)}`);
  console.log(`  sigma_daily  ${sdW.toFixed(12)}`);
  console.log(`  sigma_annual ${(sdW*Math.sqrt(252)*100).toFixed(6)} %`);

  const p = estimateParams(bars, r.symbol.symbol, 2)!;
  console.log('\nlib/simulate.ts estimateParams()');
  console.log(`  mu_daily     ${p.muDaily.toExponential(10)}`);
  console.log(`  sigma_daily  ${p.sigmaDaily.toFixed(12)}`);
  console.log(`  sigma_annual ${(p.sigmaAnnual*100).toFixed(6)} %`);
  console.log(`  winsorized   ${p.winsorized} of ${rets.length} returns clipped`);
  console.log(`  dataPoints   ${p.dataPoints}   warning=${p.warning ?? 'none'}`);

  const dMu = Math.abs(p.muDaily - wmu), dSd = Math.abs(p.sigmaDaily - sdW);
  console.log(`\nMATCH: mu delta=${dMu.toExponential(3)}  sigma delta=${dSd.toExponential(3)}  ${dMu < 1e-15 && dSd < 1e-15 ? 'EXACT ✓' : 'MISMATCH ✗'}`);
  console.log(`winsorizing moved sigma_annual by ${((sdW-sdRaw)*Math.sqrt(252)*100).toFixed(4)} pp`);

  // ── simulate ──
  const amount = 50000;
  const t0 = Date.now();
  const sim = simulate(p, amount);
  const ms = Date.now() - t0;
  console.log(`\n=== SIMULATION (10,000 paths) — ${ms}ms ===`);
  for (const k of ['2M','6M','12M'] as const) {
    const L = sim.lumpsum[k], S = sim.sip[k];
    console.log(`  ${k.padEnd(4)} lump p10=${L.p10.toFixed(0).padStart(7)} p50=${L.p50.toFixed(0).padStart(7)} p90=${L.p90.toFixed(0).padStart(7)}   sip p10=${S.p10.toFixed(0).padStart(7)} p50=${S.p50.toFixed(0).padStart(7)} p90=${S.p90.toFixed(0).padStart(7)}`);
  }
  const ord = (['2M','6M','12M'] as const).every(k => {
    const L = sim.lumpsum[k];
    return L.p10 <= L.p25 && L.p25 <= L.p50 && L.p50 <= L.p75 && L.p75 <= L.p90;
  });
  console.log(`  percentiles ordered: ${ord}`);
  const lumpSpread = sim.lumpsum['12M'].p90 - sim.lumpsum['12M'].p10;
  const sipSpread  = sim.sip['12M'].p90 - sim.sip['12M'].p10;
  console.log(`  12M spread: lump=${lumpSpread.toFixed(0)}  sip=${sipSpread.toFixed(0)}  sip narrower: ${sipSpread < lumpSpread}`);

  // determinism
  const again = simulate(estimateParams(bars, r.symbol.symbol, 2)!, amount);
  console.log(`  deterministic across runs: ${again.lumpsum['12M'].p50 === sim.lumpsum['12M'].p50}`);

  // payload
  const bytes = Buffer.byteLength(JSON.stringify({ ...sim }), 'utf8');
  console.log(`  paths: ${sim.paths.length} x ${sim.paths[0].length} points`);
  console.log(`  payload: ${(bytes/1024).toFixed(1)} KB  ${bytes < 200*1024 ? '(under 200KB ✓)' : '(OVER 200KB ✗)'}`);
  process.exit(0);
})();
