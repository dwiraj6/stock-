/* Indian numeric formatting. Every numeral the product prints
   passes through here so a sentence and a chart speak the same
   language (Part 12). */

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const INR2 = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* Every formatter tolerates null.
   A field the upstream did not report prints as an em dash — never
   as ₹0, never as 0.0%. Part 0.1: a missing number is fine, an
   invented one is fatal, and "0" is an invented one. */
const NA_DASH = '—';
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** 50000 -> "50,000"  ·  500000 -> "5,00,000" (Indian grouping) */
export const group = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? INR.format(Math.round(n)) : '—';

/** Two-decimal Indian grouping, for prices. */
export const group2 = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? INR2.format(n) : '—';

/** "₹54,100" */
export const rupees = (n) => `\u20B9${group(n)}`;

/** "₹2,847.30" */
export const rupees2 = (n) => `\u20B9${group2(n)}`;

/** Signed rupees: "+₹4,100" / "−₹18,400" (true minus, U+2212) */
export const rupeesSigned = (n) => {
  if (!isNum(n)) return NA_DASH;
  const s = n < 0 ? '\u2212' : '+';
  return `${s}\u20B9${group(Math.abs(n))}`;
};

/** "−1.2%" with a true minus sign. */
export const pct = (n, dp = 1) => {
  if (!isNum(n)) return NA_DASH;
  const s = n < 0 ? '\u2212' : '';
  return `${s}${Math.abs(n).toFixed(dp)}%`;
};

/** Signed percent, always carries its sign: "+12.4%" / "−18.4%" */
export const pctSigned = (n, dp = 1) => {
  if (!isNum(n)) return NA_DASH;
  const s = n < 0 ? '\u2212' : '+';
  return `${s}${Math.abs(n).toFixed(dp)}%`;
};

/** Indian crore/lakh-crore market cap: "₹19.2L Cr" */
export const marketCap = (crore) => {
  if (!isNum(crore)) return NA_DASH;
  if (crore >= 100000) return `\u20B9${(crore / 100000).toFixed(1)}L Cr`;
  if (crore >= 1000) return `\u20B9${(crore / 1000).toFixed(1)}K Cr`;
  return `\u20B9${crore.toFixed(0)} Cr`;
};

/** Parse "5,00,000" or "₹5,00,000" back to 500000. */
export const parseAmount = (s) => {
  const digits = String(s).replace(/[^0-9]/g, '');
  return digits === '' ? null : parseInt(digits, 10);
};

/** Volume: 4200000 -> "4.2M" */
export const compactVol = (n) => {
  if (!isNum(n)) return NA_DASH;
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
};

/** Axis label for share prices: full Indian grouping, no abbreviation.
    A price axis running 2,772 to 4,092 has to show those digits —
    abbreviating it prints "₹3K" three times and stops being an axis. */
export const axisPrice = (n) => (isNum(n) ? `₹${group(n)}` : NA_DASH);

/** Axis label for money amounts: "₹79.2K". One decimal below a lakh,
    because a ₹50,000 investment produces outcomes a few thousand
    apart and "₹54K" repeated down an axis is not a scale. */
export const axisRupee = (n) => {
  if (!isNum(n)) return NA_DASH;
  if (Math.abs(n) >= 1e7) return `\u20B9${(n / 1e7).toFixed(1)}Cr`;
  if (Math.abs(n) >= 1e5) return `\u20B9${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e3) return `\u20B9${(n / 1e3).toFixed(1)}K`;
  return `\u20B9${Math.round(n)}`;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "14 Aug 2026" */
export const longDate = (d) =>
  `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** "Aug '26" for dense axes */
export const axisMonth = (d) =>
  `${MONTHS[d.getMonth()]} \u2019${String(d.getFullYear()).slice(2)}`;

export { MONTHS };
