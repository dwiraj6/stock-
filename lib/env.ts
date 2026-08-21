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
