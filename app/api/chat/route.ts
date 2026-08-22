/* POST /api/chat — grounded, streaming.
   The model receives context assembled server-side and is told, in
   the strongest terms the prompt allows, to answer only from it. */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fail, guard, rateLimit, clientKey } from '@/lib/api';
import { resolveSymbol } from '@/lib/symbols';
import { fetchFundamentals, fetchHistory, fetchQuote } from '@/lib/market-data';
import { estimateParams, simulate } from '@/lib/simulate';
import { scoreStock } from '@/lib/score';
import { getNews } from '@/lib/news';
import { getMarketStatus } from '@/lib/market-hours';
import {
  buildContext,
  contextBlock,
  SYSTEM_PROMPT,
  MODEL_CHAIN,
  isAdviceRequest,
  ADVICE_REFUSAL,
  MAX_MESSAGES_PER_WINDOW,
  RATE_WINDOW_MS,
  MODEL_TIMEOUT_MS,
  UNREACHABLE_COOLDOWN_MS,
  markUnreachable,
  loadSharedCooldowns,
  saveSharedCooldowns,
  supportsThinkingConfig,
  FREE_TIER_DAILY_PER_MODEL,
  isQuotaError,
  retryAfterSeconds,
  isCoolingDown,
  markExhausted,
} from '@/lib/chat';
import { cacheGet } from '@/lib/mongo';
import { istDateKey } from '@/lib/market-hours';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  symbol: z.string().min(1),
  question: z.string().min(1).max(1000),
  conviction: z.number().min(0).max(100).optional(),
  amount: z.number().positive().max(1_000_000_000).optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string().max(4000) }))
    .max(12)
    .optional(),
});

function textStream(text: string): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(text));
        c.close();
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  return guard('chat', async () => {
    let parsed;
    try {
      parsed = Body.parse(await req.json());
    } catch {
      return fail('BAD_REQUEST', 'The request body is not valid.', 'Send { symbol: string, question: string }.');
    }

    // 20 messages per IP per hour (Part 8.3).
    const rl = rateLimit(`chat:${clientKey(req)}`, MAX_MESSAGES_PER_WINDOW, RATE_WINDOW_MS);
    if (!rl.allowed) {
      return fail(
        'RATE_LIMITED',
        `You've reached ${MAX_MESSAGES_PER_WINDOW} questions this hour.`,
        `Wait ${Math.ceil(rl.retryAfter / 60)} minutes and ask again. The page itself keeps working.`,
        { retryAfter: rl.retryAfter }
      );
    }

    const r = resolveSymbol(parsed.symbol);
    if (!r.found) {
      return fail(
        'SYMBOL_NOT_FOUND',
        `${parsed.symbol.toUpperCase()} isn't listed on NSE or BSE.`,
        'Pick one of the suggested symbols, or search again.',
        { suggestions: r.suggestions.map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange })) }
      );
    }
    const rec = r.symbol;

    // Refuse advice before spending a model call on it.
    if (isAdviceRequest(parsed.question)) {
      return textStream(ADVICE_REFUSAL(rec.symbol));
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return fail(
        'UPSTREAM_UNAVAILABLE',
        'The chat service is not configured.',
        'Set GEMINI_API_KEY in the environment. Everything else on the page still works.'
      );
    }

    // ── assemble grounding from data we already have ──
    const [hist, fund, quote, news] = await Promise.all([
      fetchHistory(rec, 3),
      fetchFundamentals(rec),
      fetchQuote(rec),
      getNews(rec).catch(() => ({ items: [] as any[] })),
    ]);

    const params = hist ? estimateParams(hist.data, rec.symbol, 2) : null;
    const amount = parsed.amount ?? 50_000;

    /* Reuse the simulation the results page already produced. Running
       10,000 fresh paths on every chat message is ~110ms of work to
       reproduce a result that is, by construction, identical — the
       PRNG is seeded from symbol + IST date. Only compute when the
       cache genuinely has nothing. */
    const simKey = `${rec.symbol}_${Math.round(amount)}_${istDateKey()}`;
    const cachedSim = await cacheGet<any>('simulations', simKey, 86_400);
    const sim =
      cachedSim?.data?.lumpsum && cachedSim?.data?.params
        ? ({
            lumpsum: cachedSim.data.lumpsum,
            sip: cachedSim.data.sip,
            params: {
              sigmaAnnual: cachedSim.data.params.sigma,
              muAnnual: cachedSim.data.params.mu,
              dataPoints: cachedSim.data.params.dataPoints,
            },
          } as any)
        : params
          ? simulate(params, amount)
          : null;
    const score = hist && fund ? scoreStock(hist.data, fund.data, params) : null;
    const status = getMarketStatus();

    const ctx = buildContext({
      symbol: rec.symbol,
      name: rec.name,
      asOfLabel: status.asOfLabel,
      marketState: status.marketState,
      quote: quote?.data ?? null,
      fundamentals: fund?.data ?? null,
      score,
      conviction: parsed.conviction ?? null,
      sim,
      amount,
      news: ((news as any).items ?? []) as any[],
    });

    const genAI = new GoogleGenerativeAI(key);
    const history = (parsed.history ?? []).map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    }));

    let lastErr: unknown;
    let quotaHits = 0;
    let retryAfter: number | null = null;

    /* What other instances already learned. One indexed read, and it
       is the difference between answering in two seconds and paying a
       dead model's timeout on every cold start. */
    await loadSharedCooldowns();

    /* A cooldown exists to avoid PAYING a dead model's timeout when a
       live one is available. If every model in the chain is cooling
       down there is no live one to protect, so skipping them all
       guarantees a failure that trying could not have made worse.
       Better to pay one timeout than to refuse to try. */
    const allCoolingDown = MODEL_CHAIN.every((m) => isCoolingDown(m));
    if (allCoolingDown) {
      console.warn('[stockshishya] chat: every model is cooling down — trying anyway');
    }

    for (const modelName of MODEL_CHAIN) {
      // Skip a model we already know is out of quota.
      if (!allCoolingDown && isCoolingDown(modelName)) {
        quotaHits++;
        continue;
      }
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: `${SYSTEM_PROMPT}\n\n${contextBlock(ctx)}`,
          generationConfig: {
            temperature: 0.2,
            /* 600 was not enough. gemini-2.5-flash reasons internally
               and charges those thought tokens against this budget —
               measured at 248-278 thoughts against 78 visible tokens,
               i.e. ~45% of the budget spent before a word is written.
               With this route's much larger grounding context the
               budget could be consumed entirely, which is what
               produced answers that stopped mid-sentence or came back
               empty. */
            maxOutputTokens: 2048,
            /* This is grounded extraction from a JSON object that is
               already in the prompt — there is nothing to reason
               about. Turning thinking off removes the failure mode
               rather than papering over it, and cuts total tokens per
               answer from ~443 to ~185.

               Cast: the installed @google/generative-ai types predate
               thinkingConfig. The API accepts it — verified against
               the live endpoint, thoughtsTokenCount drops to 0. */
            /* Only for models that accept it. The lite models answer
               a request carrying thinkingConfig with a bare 400, so
               sending it to everything is what kept them out of the
               chain entirely. */
            ...(supportsThinkingConfig(modelName)
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          } as any,
        });

        const chat = model.startChat({ history });

        /* Prompt size, behind a flag. It was worth measuring once —
           1,445 tokens — when the chat was slow and it was not
           obvious whether the delay was the context or the model. It
           was the model chain. Left in because the next person
           asking that question should not have to add it back. */
        if (process.env.PLUMBLINE_CHAT_PROFILE === '1') {
          const sysLen = `${SYSTEM_PROMPT}

${contextBlock(ctx)}`.length;
          console.log(
            `[stockshishya] chat prompt: system ${sysLen} chars (~${Math.round(sysLen / 4)} tokens), history ${history.length} turns`
          );
        }

        /* A hard deadline. Without one a queued or stalled request
           hangs indefinitely — measured at 104 seconds against a
           quota-limited key, with nothing on screen the whole time. */
        const result = await Promise.race([
          chat.sendMessageStream(parsed.question),
          new Promise<never>((_, rej) =>
            setTimeout(
              () => rej(new Error(`no first token after ${MODEL_TIMEOUT_MS}ms`)),
              MODEL_TIMEOUT_MS
            )
          ),
        ]);

        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            let wrote = 0;
            let finish = '';
            try {
              for await (const chunk of result.stream) {
                /* chunk.text() THROWS when a chunk carries no usable
                   part — a safety block, or a finishReason arriving
                   with no content. Letting that escape ends the
                   stream silently and leaves the panel holding half
                   an answer, which is exactly the reported failure. */
                let t = '';
                try {
                  t = chunk.text();
                } catch {
                  t = '';
                }
                const fr = (chunk as any)?.candidates?.[0]?.finishReason;
                if (fr && fr !== 'STOP') finish = String(fr);
                if (t) {
                  wrote += t.length;
                  controller.enqueue(enc.encode(t));
                }
              }

              /* Never end on silence. If the model produced nothing,
                 or stopped early, the panel says so instead of
                 showing a blank or truncated reply with no
                 explanation. */
              if (wrote === 0) {
                controller.enqueue(
                  enc.encode(
                    finish === 'SAFETY'
                      ? 'The model declined to answer that one. Try asking about a specific number on the page.'
                      : 'The model returned nothing for that question. Try rephrasing it, or ask about a specific number on the page.'
                  )
                );
              } else if (finish === 'MAX_TOKENS') {
                controller.enqueue(
                  enc.encode(' …(answer truncated — ask a narrower question for the rest.)')
                );
              }
            } catch (e) {
              console.error('[stockshishya] chat stream broke:', e);
              controller.enqueue(
                enc.encode(
                  wrote > 0
                    ? ' …(the answer was cut short — the model stream failed.)'
                    : 'The model stream failed before it produced anything. The rest of the page is unaffected.'
                )
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            /* Without this the platform proxy buffers the whole
               response and "streaming" arrives as one block at the
               end — measured: 25 chars, then 327 in a single step. */
            'X-Accel-Buffering': 'no',
            'Transfer-Encoding': 'chunked',
            /* ASCII, and it must stay ASCII. The rename to stockಶಿಷ್ಯ
               rewrote these two header NAMES along with everything
               else, which put ಶ (U+0CB6) at index 7 of
               `X-stockಶಿಷ್ಯ-Model`. HTTP header names and values are
               ByteStrings — Latin-1 — so setting them threw
               "Cannot convert argument to a ByteString" before a
               single request reached Gemini. Every model in the chain
               failed identically, which read as "the chat service did
               not respond" when the service was perfectly fine. */
            'X-Shishya-Model': modelName,
            'X-Shishya-Grounded': 'true',
          },
        });
      } catch (e) {
        lastErr = e;
        if (isQuotaError(e)) {
          quotaHits++;
          const secs = retryAfterSeconds(e);
          retryAfter = secs ?? retryAfter;
          markExhausted(modelName, secs);
          void saveSharedCooldowns();
          console.warn(`[stockshishya] chat model ${modelName}: quota exhausted, trying the next bucket`);
        } else {
          /* Not a quota problem — a timeout, a dead model name, a
             network fault. Skip it for a few minutes rather than
             paying its timeout again on the very next question. This
             is what turned 26 seconds to first word into under two. */
          markUnreachable(modelName);
          void saveSharedCooldowns();
          console.warn(
            `[stockshishya] chat model ${modelName} failed (${(e as Error).message?.slice(0, 100)}) — skipping it for ${UNREACHABLE_COOLDOWN_MS / 60000} min`
          );
        }
      }
    }

    /* Every model exhausted. Each has its own free-tier daily bucket,
       so this means the whole chain is spent — say that precisely
       rather than "the service did not respond", which would send
       someone hunting for a bug that isn't there. */
    if (quotaHits > 0) {
      console.error(`[stockshishya] chat: all ${MODEL_CHAIN.length} model quotas exhausted`);
      return fail(
        'RATE_LIMITED',
        `The free Gemini quota is used up — ${FREE_TIER_DAILY_PER_MODEL} questions per model per day, across ${MODEL_CHAIN.length} models.`,
        retryAfter
          ? `Try again in about ${retryAfter} seconds, or add billing to the Google AI Studio project to lift the limit. Everything else on this page still works.`
          : 'It resets on Google’s daily schedule. Add billing to the Google AI Studio project to lift the limit. Everything else on this page still works.',
        { retryAfter: retryAfter ?? undefined }
      );
    }

    /* Say what actually broke. "The chat service did not respond"
       sent someone hunting a network fault for an hour when the real
       cause was a Kannada character in an HTTP header name — the
       service was never contacted at all. The upstream message is
       surfaced because a TypeError and a 503 need completely
       different fixes. */
    const reason = lastErr instanceof Error ? lastErr.message : String(lastErr ?? '');
    console.error('[stockshishya] all chat models failed:', lastErr);
    return fail(
      'UPSTREAM_UNAVAILABLE',
      'The assistant could not be reached.',
      reason
        ? `${reason.slice(0, 140)} — the rest of the page is unaffected.`
        : 'The rest of the page is unaffected — the score, the simulation and the charts all still work.'
    );
  });
}
