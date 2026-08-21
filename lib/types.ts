/* Shared payload types. Every route returns `meta`. */

export type SourceTier = 'yahoo' | 'twelvedata' | 'cache' | 'local';

export type Meta = {
  source: SourceTier;
  fetchedAt: string;
  isCached: boolean;
  isStale: boolean;
  degraded: boolean;
  delayMinutes: number;
  /** Set when we served something older than we wanted to. */
  note?: string;
};

export type ErrorCode =
  | 'SYMBOL_NOT_FOUND'
  | 'INSUFFICIENT_DATA'
  | 'UPSTREAM_DEGRADED'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'UPSTREAM_UNAVAILABLE';

export type ApiError = {
  ok: false;
  code: ErrorCode;
  message: string;
  /** What the caller should do next. Never vague, never an apology. */
  action: string;
  suggestions?: { symbol: string; name: string; exchange: string }[];
  daysAvailable?: number;
  retryAfter?: number;
  meta?: Meta;
};

export type Bar = {
  date: string; // ISO
  open: number;
  high: number;
  low: number;
  close: number;
  /** Split/bonus adjusted. ALL return and volatility maths use this. */
  adjClose: number;
  volume: number;
};

export type Quote = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  open: number | null;
  previousClose: number | null;
  volume: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  currency: string;
  exchange: string;
};

export type Fundamentals = {
  trailingPE: number | null;
  priceToBook: number | null;
  /** A RATIO (0.37), converted from Yahoo's percentage (36.653). */
  debtToEquity: number | null;
  /** A FRACTION (0.477 = 47.7%). */
  returnOnEquity: number | null;
  profitMargins: number | null;
  dividendYield: number | null;
  bookValue: number | null;
  sector: string | null;
  industry: string | null;
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  totalDebt: number | null;
  freeCashflow: number | null;
  marketCap: number | null;
  /** Quarterly net income, newest first — powers "earnings fell in N of last 4". */
  quarterlyEarnings: { date: string; netIncome: number | null }[] | null;
};

export type NewsItem = {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  ageLabel: string;
};
