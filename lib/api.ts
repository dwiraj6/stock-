/* Response helpers and the error contract.
   ────────────────────────────────────────────────────────────────
   Part 12: every error returns HTTP 200 with a typed payload, never
   a bare 500. A route that throws renders a blank screen; a route
   that returns { ok:false, code, message, action } lets the UI say
   something true and offer a way forward.

   The only non-200s here are for genuinely malformed requests, and
   even those carry the typed body. */

import { NextResponse } from 'next/server';
import type { ApiError, ErrorCode, Meta } from './types';
import { getMarketStatus } from './market-hours';

export type Ok<T> = { ok: true } & T;

export function ok<T extends object>(
  body: T,
  init: { ttlSeconds?: number; staleWhileRevalidate?: number } = {}
): NextResponse {
  const res = NextResponse.json({ ok: true, ...body } as Ok<T>);
  const ttl = init.ttlSeconds ?? 0;
  const swr = init.staleWhileRevalidate ?? Math.max(ttl * 4, 60);
  res.headers.set(
    'Cache-Control',
    ttl > 0
      ? `public, s-maxage=${ttl}, stale-while-revalidate=${swr}`
      : 'no-store'
  );
  return res;
}

export function fail(
  code: ErrorCode,
  message: string,
  action: string,
  extra: Partial<ApiError> = {}
): NextResponse {
  const body: ApiError = { ok: false, code, message, action, ...extra };
  // 200 on purpose. See the header comment.
  const res = NextResponse.json(body);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/** Log which tier served a request, with symbol and timestamp (Part 12). */
export function logTier(route: string, symbol: string, meta: Meta): void {
  const bits = [
    `[plumbline] ${route}`,
    symbol,
    `tier=${meta.source}`,
    meta.isCached ? 'cached' : 'fresh',
    meta.isStale ? 'STALE' : '',
    meta.degraded ? 'DEGRADED' : '',
  ].filter(Boolean);
  console.log(bits.join(' '));
}

/** Market status block appended to payloads that show prices. */
export function marketBlock() {
  const s = getMarketStatus();
  return {
    marketState: s.marketState,
    isLive: s.isLive,
    asOf: s.asOf,
    asOfLabel: s.asOfLabel,
    nextOpen: s.nextOpen,
    lastTradingDay: s.lastTradingDay,
    holiday: s.holiday,
    holidaysVerified: s.holidaysVerified,
    pollMs: s.pollMs,
  };
}

/** Wrap a handler so an unexpected throw still returns a typed body.
    Typed as Response rather than NextResponse because /api/chat
    returns a raw streaming Response, and narrowing this would force
    that route to buffer its answer before sending it. */
export async function guard(
  route: string,
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[plumbline] ${route} threw:`, err);
    return fail(
      'UPSTREAM_DEGRADED',
      'Something failed while building this response.',
      'Try again in a moment. If it keeps happening the upstream data source is down.',
      { meta: undefined }
    );
  }
}

/* ── tiny per-IP rate limiter, in-memory ──
   Enough for the chat endpoint's 20-messages-per-session cap. On
   serverless this is per-instance, which is a real limitation and
   is stated rather than papered over. */

const BUCKETS = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
} {
  const now = Date.now();
  const b = BUCKETS.get(key);
  if (!b || now > b.resetAt) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { allowed: true, remaining: limit - b.count, retryAfter: 0 };
}

export function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'local'
  );
}
