/* Environment validation.
   ────────────────────────────────────────────────────────────────
   Validated once, at first import, so a missing variable fails at
   boot with a message naming it — not at 2am inside a route handler
   with a stack trace pointing at the Mongo driver. */

import { z } from 'zod';

const schema = z.object({
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is empty')
    .refine((v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    }),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is empty'),
  TWELVEDATA_API_KEY: z.string().min(1, 'TWELVEDATA_API_KEY is empty'),
});

export type Env = z.infer<typeof schema>;

/* ── auth, and why none of it is in the schema above ──
   The three variables above are load-bearing: without Mongo or
   Gemini the app has nothing to show. Auth is different. A missing
   Google client should disable the Google button, and a missing SMTP
   host should make the signup form say "email is not configured on
   this server" — neither should stop the app from booting, because
   the whole product still works for a visitor who never signs in.

   So these are read where they are used, through the two predicates
   below, and every auth surface degrades to a clear message instead
   of a boot failure. */
export const AUTH_ENV_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
] as const;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TWELVEDATA_API_KEY: process.env.TWELVEDATA_API_KEY,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Plumbline cannot start — environment is incomplete:\n${missing}\n\n` +
        `Copy .env.example to .env.local and fill in the values above.`
    );
  }

  cached = parsed.data;
  return cached;
}

/** Non-throwing probe, so a route can degrade instead of crashing
    when only one integration is misconfigured. */
export function hasEnv(key: keyof Env): boolean {
  const v = process.env[key];
  return typeof v === 'string' && v.length > 0;
}
