import { getMarketStatus, marketState, lastTradingDay, nextOpen, istDateKey, istWeekday } from '../lib/market-hours';

const at = (iso: string) => new Date(iso);
const show = (label: string, d: Date) => {
  const s = getMarketStatus(d);
  console.log(
    `${label.padEnd(34)} ${s.marketState.padEnd(9)} live=${String(s.isLive).padEnd(5)} ` +
    `${s.asOfLabel.padEnd(34)} next=${istDateKey(new Date(s.nextOpen))}`
  );
};

console.log('\n── NOW ──');
show(`now (${istDateKey()} ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][istWeekday()]})`, new Date());

console.log('\n── SESSION BOUNDARIES (Mon 24 Aug 2026) ──');
for (const t of ['08:59','09:00','09:14','09:15','12:00','15:29','15:30','23:59']) {
  show(`Mon ${t} IST`, at(`2026-08-24T${t}:00+05:30`));
}

console.log('\n── WEEKEND ──');
show('Sat 22 Aug 12:00 IST', at('2026-08-22T12:00:00+05:30'));
show('Sun 23 Aug 12:00 IST', at('2026-08-23T12:00:00+05:30'));

console.log('\n── HOLIDAY ──');
show('Fri 02 Oct (Gandhi Jayanti)', at('2026-10-02T11:00:00+05:30'));
show('Mon 26 Jan (Republic Day)', at('2026-01-26T11:00:00+05:30'));

console.log('\n── UTC SERVER TRAP ──');
// 04:00 UTC == 09:30 IST -> must be OPEN even though UTC says pre-dawn
show('04:00 UTC Mon = 09:30 IST', at('2026-08-24T04:00:00Z'));
// 21:00 UTC Mon == 02:30 IST Tue -> must be CLOSED, and on the NEXT day
show('21:00 UTC Mon = 02:30 IST Tue', at('2026-08-24T21:00:00Z'));

console.log('\n── lastTradingDay WALKS BACK ──');
const cases: [string, string][] = [
  ['2026-08-22T12:00:00+05:30', 'Saturday  -> Friday 21st'],
  ['2026-08-23T12:00:00+05:30', 'Sunday    -> Friday 21st'],
  ['2026-08-17T10:00:00+05:30', 'Mon pre-open -> Fri 14th (15th is Independence Day, Sat)'],
  ['2026-10-03T12:00:00+05:30', 'Sat after Gandhi Jayanti -> Thu 1 Oct'],
  ['2026-01-27T10:00:00+05:30', 'Tue after Republic Day -> Fri 23 Jan'],
];
for (const [iso, label] of cases) {
  const d = at(iso);
  console.log(`  ${label.padEnd(52)} ${istDateKey(lastTradingDay(d))}  nextOpen=${istDateKey(nextOpen(d))}`);
}

console.log('\n── POLL + TTL CONTRACT ──');
for (const [label, iso] of [['OPEN','2026-08-24T12:00:00+05:30'],['PRE_OPEN','2026-08-24T09:05:00+05:30'],['WEEKEND','2026-08-22T12:00:00+05:30']] as const) {
  const s = getMarketStatus(at(iso));
  console.log(`  ${label.padEnd(9)} pollMs=${String(s.pollMs).padEnd(7)} quoteTtl=${s.quoteTtlSeconds}s`);
}
