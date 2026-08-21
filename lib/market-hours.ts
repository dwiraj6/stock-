/* NSE/BSE market hours.
   ────────────────────────────────────────────────────────────────
   Every calculation here is in Asia/Kolkata, derived with Intl
   rather than from the server clock. Vercel runs UTC; a naive
   `new Date().getHours()` would report the market closed at 21:00
   IST and open at 04:00, which is exactly the class of bug that
   only shows up in production.

   IST is UTC+5:30 year-round with no daylight saving, so the offset
   is constant — but we still go through the timezone database
   rather than hardcoding +330 minutes, because a hardcoded offset
   is a silent lie if it ever changes. */

export type MarketState = 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'WEEKEND' | 'HOLIDAY';

export const IST = 'Asia/Kolkata';

/* Session times, IST minutes from midnight. */
const PRE_OPEN_START = 9 * 60; // 09:00
const OPEN_AT = 9 * 60 + 15; // 09:15
const CLOSE_AT = 15 * 60 + 30; // 15:30

/**
 * NSE trading holidays, 2026.
 *
 * PROVENANCE WARNING — READ BEFORE TRUSTING THIS LIST.
 * NSE publishes its trading-holiday circular annually. The fixed
 * civil holidays below (Republic Day, Independence Day, Gandhi
 * Jayanti, Christmas) are certain. The festival dates are lunar and
 * are ESTIMATES until checked against the official circular:
 *   https://www.nseindia.com/resources/exchange-communication-holidays
 *
 * `HOLIDAYS_VERIFIED` stays false until a human has reconciled this
 * against that circular. Consumers can surface that, and nothing in
 * the app claims the list is authoritative while it is false.
 * A wrong holiday shifts `lastTradingDay()` by a day, which would
 * quietly mislabel a close — so this is deliberately loud.
 */
export const HOLIDAYS_VERIFIED = false;

export const NSE_HOLIDAYS_2026: ReadonlyArray<{ date: string; name: string; certain: boolean }> = [
  { date: '2026-01-26', name: 'Republic Day', certain: true },
  { date: '2026-03-04', name: 'Holi', certain: false },
  { date: '2026-03-20', name: 'Id-ul-Fitr (Ramzan Id)', certain: false },
  { date: '2026-03-31', name: 'Mahavir Jayanti', certain: false },
  { date: '2026-04-03', name: 'Good Friday', certain: true },
  { date: '2026-04-14', name: 'Dr. Ambedkar Jayanti', certain: true },
  { date: '2026-05-01', name: 'Maharashtra Day', certain: true },
  { date: '2026-05-27', name: 'Bakri Id', certain: false },
  { date: '2026-06-26', name: 'Muharram', certain: false },
  { date: '2026-08-15', name: 'Independence Day', certain: true },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', certain: false },
  { date: '2026-10-02', name: 'Gandhi Jayanti', certain: true },
  { date: '2026-10-20', name: 'Dussehra', certain: false },
  { date: '2026-11-09', name: 'Diwali Balipratipada', certain: false },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', certain: false },
  { date: '2026-12-25', name: 'Christmas', certain: true },
];

const HOLIDAY_SET = new Map(NSE_HOLIDAYS_2026.map((h) => [h.date, h]));

/* ── IST primitives ──────────────────────────────────────────── */

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' });

const labelFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "2026-08-22" in IST. */
export function istDateKey(d: Date = new Date()): string {
  return dateFmt.format(d);
}

/** Minutes from IST midnight. */
export function istMinutes(d: Date = new Date()): number {
  const [hh, mm] = timeFmt.format(d).split(':').map(Number);
  return hh * 60 + mm;
}

/** 0 = Sunday … 6 = Saturday, in IST. */
export function istWeekday(d: Date = new Date()): number {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names.indexOf(weekdayFmt.format(d));
}

export function isWeekend(d: Date = new Date()): boolean {
  const w = istWeekday(d);
  return w === 0 || w === 6;
}

export function holidayFor(d: Date = new Date()) {
  return HOLIDAY_SET.get(istDateKey(d)) ?? null;
}

export function isTradingDay(d: Date = new Date()): boolean {
  return !isWeekend(d) && !holidayFor(d);
}

/** A Date at a given IST wall-clock time on the IST calendar day of `d`. */
export function atIst(d: Date, minutesFromMidnight: number): Date {
  const key = istDateKey(d);
  const hh = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0');
  const mm = String(minutesFromMidnight % 60).padStart(2, '0');
  // +05:30 is fixed for IST, so this is exact.
  return new Date(`${key}T${hh}:${mm}:00.000+05:30`);
}

/** Shift by whole IST calendar days. */
function shiftDays(d: Date, days: number): Date {
  const key = istDateKey(d);
  const base = new Date(`${key}T12:00:00.000+05:30`);
  return new Date(base.getTime() + days * 86_400_000);
}

/**
 * The most recent completed trading day at or before `d`.
 * Walks backwards past weekends and holidays. If `d` is itself a
 * trading day but the session has not closed yet, the previous
 * trading day is returned — "last close" must mean a close that
 * actually happened.
 */
export function lastTradingDay(d: Date = new Date()): Date {
  let cursor = d;
  if (isTradingDay(cursor) && istMinutes(cursor) >= CLOSE_AT) {
    return atIst(cursor, CLOSE_AT);
  }
  for (let i = 0; i < 30; i++) {
    cursor = shiftDays(cursor, -1);
    if (isTradingDay(cursor)) return atIst(cursor, CLOSE_AT);
  }
  return atIst(cursor, CLOSE_AT);
}

/** The next 09:15 IST the market will actually open. */
export function nextOpen(d: Date = new Date()): Date {
  if (isTradingDay(d) && istMinutes(d) < OPEN_AT) return atIst(d, OPEN_AT);
  let cursor = d;
  for (let i = 0; i < 30; i++) {
    cursor = shiftDays(cursor, 1);
    if (isTradingDay(cursor)) return atIst(cursor, OPEN_AT);
  }
  return atIst(cursor, OPEN_AT);
}

export function marketState(d: Date = new Date()): MarketState {
  if (holidayFor(d)) return 'HOLIDAY';
  if (isWeekend(d)) return 'WEEKEND';
  const m = istMinutes(d);
  if (m >= PRE_OPEN_START && m < OPEN_AT) return 'PRE_OPEN';
  if (m >= OPEN_AT && m < CLOSE_AT) return 'OPEN';
  return 'CLOSED';
}

export type MarketStatus = {
  marketState: MarketState;
  /** True only while the session is actually running. */
  isLive: boolean;
  /** The instant the data refers to. */
  asOf: string;
  nextOpen: string;
  lastTradingDay: string;
  /** Human label the UI prints instead of a fake ticking price. */
  asOfLabel: string;
  holiday: string | null;
  holidaysVerified: boolean;
  /** Recommended client poll interval, ms. 0 = do not poll. */
  pollMs: number;
  /** Server cache TTL in seconds for quote payloads. */
  quoteTtlSeconds: number;
};

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const state = marketState(now);
  const holiday = holidayFor(now);
  const last = lastTradingDay(now);
  const open = nextOpen(now);
  const live = state === 'OPEN';

  // When the market is shut, the data refers to the last close, not
  // to now. Saying otherwise is the fake-ticking-price failure.
  const asOf = live ? now : last;

  const secondsToOpen = Math.max(30, Math.floor((open.getTime() - now.getTime()) / 1000));

  return {
    marketState: state,
    isLive: live,
    asOf: asOf.toISOString(),
    nextOpen: open.toISOString(),
    lastTradingDay: last.toISOString(),
    asOfLabel: live
      ? `Live · ${labelFmt.format(now)} IST`
      : `Last close: ${labelFmt.format(last)} IST`,
    holiday: holiday ? holiday.name : null,
    holidaysVerified: HOLIDAYS_VERIFIED,
    pollMs: state === 'OPEN' ? 30_000 : state === 'PRE_OPEN' ? 60_000 : 0,
    quoteTtlSeconds: state === 'OPEN' ? 30 : state === 'PRE_OPEN' ? 60 : secondsToOpen,
  };
}

/**
 * Yahoo quotes for NSE/BSE are delayed. We label the delay rather
 * than claiming live data — the label is the credibility asset.
 * When the market is closed there is no delay to speak of: the last
 * close is simply the last close.
 */
export function delayMinutesFor(state: MarketState): number {
  return state === 'OPEN' || state === 'PRE_OPEN' ? 15 : 0;
}
