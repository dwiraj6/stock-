import { resolveSymbol, searchSymbols, symbolCount, getSymbol } from '../lib/symbols';

console.log(`loaded ${symbolCount()} NSE equities (SERIES=EQ)\n`);

console.log('── RESOLVE ──');
for (const q of ['RELIANCE', 'reliance', 'RELIANCE.NS', 'Reliance Industries Limited', 'TCS', 'INFY', 'TATAMOTORS']) {
  const r = resolveSymbol(q);
  console.log(`  ${q.padEnd(30)} ${r.found ? `${r.symbol.symbol} | ${r.symbol.yahooTicker} | ${r.symbol.tradingViewSymbol} | ${r.symbol.name}` : 'NOT FOUND'}`);
}

console.log('\n── THE SODEXO CASE (must never throw) ──');
for (const q of ['SODEXO', 'GOOGLE', 'TESLA', 'zzzzzz', '', '   ', '!!!', 'RELIANC']) {
  const r = resolveSymbol(q);
  const label = JSON.stringify(q);
  if (r.found) console.log(`  ${label.padEnd(12)} FOUND ${r.symbol.symbol}`);
  else console.log(`  ${label.padEnd(12)} notFound + suggestions: [${r.suggestions.map((s) => s.symbol).join(', ') || '(none)'}]`);
}

console.log('\n── SEARCH RANKING ──');
for (const q of ['TA', 'TATA', 'HDFC', 'BANK', 'infosys']) {
  console.log(`  ${q.padEnd(8)} -> ${searchSymbols(q, 5).map((s) => s.symbol).join(', ')}`);
}

console.log('\n── TRADINGVIEW STRINGS (never the Yahoo ticker) ──');
for (const s of ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS']) {
  const sym = getSymbol(s)!;
  const bad = sym.tradingViewSymbol.includes('.NS');
  console.log(`  ${s.padEnd(12)} tv=${sym.tradingViewSymbol.padEnd(18)} yahoo=${sym.yahooTicker.padEnd(16)} ${bad ? 'FAIL: .NS leaked into TV' : 'ok'}`);
}
