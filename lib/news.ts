/* News.
   ────────────────────────────────────────────────────────────────
   Wrong-company news is worse than no news, so the relevance filter
   is mandatory and discards rather than downranks (Part 4.2).
   Google News on "Infosys" will happily return an article about a
   different Infosys, or about Indian IT generally; unless the
   company name or ticker appears in the title, it does not ship.

   Headlines are returned VERBATIM with the publisher's name and a
   working link. Nothing here rewrites or summarises a headline —
   that would be putting words in a publisher's mouth. */

import { XMLParser } from 'fast-xml-parser';
import { yahooSearch } from './market-data';
import { cacheGet, cacheSet } from './mongo';
import { normaliseName } from './symbols';
import type { NewsItem } from './types';
import type { Symbol as SymbolRec } from './symbols';

const MAX_ITEMS = 8;
const MAX_AGE_DAYS = 30;
const SOFT_TTL = 900; // 15 minutes

/* ── age label, IST ───────────────────────────────────────────── */

const istDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
const istShort = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });

export function ageLabel(published: Date, now = new Date()): string {
  const ms = now.getTime() - published.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24 && istDay.format(published) === istDay.format(now)) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (istDay.format(published) === istDay.format(yesterday)) return 'Yesterday';
  return istShort.format(published);
}

/** Google's RSS carries HTML entities in titles. Decoding them is
    not "rewriting the headline" — it is rendering the publisher's own
    characters correctly. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/* ── relevance ────────────────────────────────────────────────── */

/** Distinctive tokens from a company name — the words that make it
    identifiable. "Reliance Industries Limited" → ["RELIANCE"]. */
function nameTokens(rec: SymbolRec): string[] {
  const norm = normaliseName(rec.name);
  const tokens = norm.split(' ').filter((t) => t.length >= 4);
  const out = new Set<string>(tokens);
  out.add(rec.symbol.toUpperCase());
  if (norm.length >= 4) out.add(norm);
  return [...out];
}

export function isRelevant(title: string, rec: SymbolRec, description = ''): boolean {
  const hay = `${title} ${description}`.toUpperCase();
  const normHay = normaliseName(hay);
  const sym = rec.symbol.toUpperCase();

  // A whole-word ticker match is decisive.
  if (new RegExp(`\\b${sym.replace(/[^A-Z0-9]/g, '')}\\b`).test(hay.replace(/[^A-Z0-9 ]/g, ' '))) return true;

  for (const t of nameTokens(rec)) {
    if (t.length < 4) continue;
    if (normHay.includes(t)) return true;
  }
  return false;
}

function normTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seenTitle = new Set<string>();
  const seenUrl = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const nt = normTitle(it.title);
    let host = '';
    try {
      const u = new URL(it.url);
      host = `${u.hostname}${u.pathname}`;
    } catch {
      host = it.url;
    }
    if (!nt || seenTitle.has(nt) || seenUrl.has(host)) continue;
    seenTitle.add(nt);
    seenUrl.add(host);
    out.push(it);
  }
  return out;
}

/* ── sources ──────────────────────────────────────────────────── */

async function fromYahoo(rec: SymbolRec): Promise<NewsItem[]> {
  const res = await yahooSearch(rec.yahooTicker);
  const raw: any[] = res?.news ?? [];
  const out: NewsItem[] = [];
  for (const n of raw) {
    const title = typeof n?.title === 'string' ? n.title.trim() : '';
    const url = typeof n?.link === 'string' ? n.link : '';
    if (!title || !url) continue;
    const t = n?.providerPublishTime;
    const published = t instanceof Date ? t : new Date(typeof t === 'number' ? t * 1000 : t);
    if (Number.isNaN(published.getTime())) continue;
    out.push({
      title,
      publisher: typeof n?.publisher === 'string' ? n.publisher : 'Yahoo Finance',
      url,
      publishedAt: published.toISOString(),
      ageLabel: ageLabel(published),
    });
  }
  return out;
}

async function fromGoogleNews(rec: SymbolRec): Promise<NewsItem[]> {
  const q = encodeURIComponent(`"${rec.name.replace(/ Limited$| Ltd\.?$/i, '')}" stock NSE`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stockಶಿಷ್ಯ/1.0)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const doc = parser.parse(xml);
    const items = doc?.rss?.channel?.item;
    const arr: any[] = Array.isArray(items) ? items : items ? [items] : [];
    const out: NewsItem[] = [];
    for (const it of arr) {
      const rawTitle = typeof it?.title === 'string' ? it.title : '';
      if (!rawTitle) continue;
      // Google appends " - Publisher" to the headline. Split it off so
      // the publisher is attributed properly and the title stays the
      // publisher's own words.
      const m = rawTitle.match(/^(.*)\s+-\s+([^-]+)$/);
      const title = decodeEntities((m ? m[1] : rawTitle).trim());
      const publisher = decodeEntities((m ? m[2] : it?.source?.['#text'] ?? 'Google News').trim());
      const published = new Date(it?.pubDate);
      if (Number.isNaN(published.getTime())) continue;
      out.push({
        title,
        publisher,
        url: typeof it?.link === 'string' ? it.link : '',
        publishedAt: published.toISOString(),
        ageLabel: ageLabel(published),
      });
    }
    return out.filter((x) => x.url);
  } catch {
    return [];
  }
}

/* ── entry point ──────────────────────────────────────────────── */

export type NewsResult = {
  items: NewsItem[];
  sources: string[];
  fetchedAt: Date;
  fromCache: boolean;
  isStale: boolean;
  /** An honest breakdown of what happened to the candidates.
      Reporting a single "discarded" count would let the UI claim
      items were rejected as off-topic when most were simply trimmed
      by the 8-item cap — which is a claim about the filter that the
      filter did not make. */
  audit: {
    fetched: number;
    tooOld: number;
    offTopic: number;
    duplicate: number;
    trimmed: number;
    kept: number;
  };
};

const EMPTY_AUDIT = { fetched: 0, tooOld: 0, offTopic: 0, duplicate: 0, trimmed: 0, kept: 0 };

export async function getNews(rec: SymbolRec): Promise<NewsResult> {
  const cached = await cacheGet<{ items: NewsItem[]; sources: string[]; audit?: NewsResult['audit'] }>(
    'news',
    rec.symbol,
    SOFT_TTL
  );
  if (cached && !cached.isStale) {
    return {
      items: relabel(cached.data.items),
      sources: cached.data.sources,
      fetchedAt: cached.fetchedAt,
      fromCache: true,
      isStale: false,
      audit: cached.data.audit ?? { ...EMPTY_AUDIT, kept: cached.data.items.length },
    };
  }

  /* Both sources, always.

     The brief lists Yahoo first as the primary source because its
     items arrive already company-matched. That holds for US tickers;
     it does NOT hold for NSE ones. Querying yahooFinance.search()
     for RELIANCE.NS returns stories about SanDisk, AMD, Micron and a
     migrant crossing in Ceuta — verified, ten of ten discarded by the
     relevance filter. Google News with an India locale returns real
     Reliance coverage.

     So both are queried on every request and the relevance filter
     decides. Yahoo still contributes when it has something genuine;
     it just no longer gets to short-circuit the better source. */
  const sources: string[] = [];
  let candidates: NewsItem[] = [];

  const [y, g] = await Promise.all([
    fromYahoo(rec).catch(() => [] as NewsItem[]),
    fromGoogleNews(rec).catch(() => [] as NewsItem[]),
  ]);

  const yKept = y.filter((it) => isRelevant(it.title, rec));
  if (yKept.length) sources.push('Yahoo Finance');
  if (g.length) sources.push('Google News');
  candidates = candidates.concat(y, g);

  const fetched = candidates.length;
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;

  const fresh = candidates.filter((it) => new Date(it.publishedAt).getTime() >= cutoff);
  const tooOld = fetched - fresh.length;

  const onTopic = fresh.filter((it) => isRelevant(it.title, rec));
  const offTopic = fresh.length - onTopic.length;

  const unique = dedupe(
    onTopic.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  );
  const duplicate = onTopic.length - unique.length;

  const kept = unique.slice(0, MAX_ITEMS);
  const trimmed = unique.length - kept.length;

  const audit = { fetched, tooOld, offTopic, duplicate, trimmed, kept: kept.length };

  if (kept.length > 0) {
    await cacheSet('news', rec.symbol, { items: kept, sources, audit }, sources.join('+') || 'none');
    return { items: kept, sources, fetchedAt: new Date(), fromCache: false, isStale: false, audit };
  }

  // Nothing fresh survived the filter — serve stale rather than empty.
  if (cached) {
    return {
      items: relabel(cached.data.items),
      sources: cached.data.sources,
      fetchedAt: cached.fetchedAt,
      fromCache: true,
      isStale: true,
      audit: cached.data.audit ?? { ...EMPTY_AUDIT, kept: cached.data.items.length },
    };
  }

  return { items: [], sources, fetchedAt: new Date(), fromCache: false, isStale: false, audit };
}

/** Age labels go stale in cache; recompute on read. */
function relabel(items: NewsItem[]): NewsItem[] {
  return items.map((i) => ({ ...i, ageLabel: ageLabel(new Date(i.publishedAt)) }));
}
