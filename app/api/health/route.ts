/* GET /api/health — what is actually reachable from this server.
   ────────────────────────────────────────────────────────────────
   Written after an afternoon of guessing. A deployment that says
   only "the account store could not be reached" gives whoever is
   debugging it nothing to work with: is the connection string
   missing, is it malformed, is the database refusing the address, or
   is the network simply slow? Those are four different fixes and the
   symptom is identical.

   WHAT IT WILL NOT DO IS LEAK ANYTHING. No connection string, no
   key, no password — only whether each variable is PRESENT, whether
   it is well-FORMED, and what the driver said when the connection
   was attempted. The host of a Mongo URI is shown because it is
   needed to tell "pointing at the wrong cluster" from "cannot reach
   the right one", and a hostname is not a credential — the password
   in front of it is, and that is stripped.

   Deliberately uncached, and safe to leave in place: everything here
   is observable from the outside already, just slower and by
   guesswork. */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

/** The host, with any credentials removed. */
function safeMongoHost(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    // mongodb+srv://user:pass@host/db  ->  host
    const at = uri.lastIndexOf('@');
    const afterScheme = at >= 0 ? uri.slice(at + 1) : uri.replace(/^mongodb(\+srv)?:\/\//, '');
    return afterScheme.split(/[/?]/)[0] || null;
  } catch {
    return null;
  }
}

/* Whitespace around a value is invisible in every dashboard UI and
   was, for one long afternoon, fatal. Reported explicitly. */
const padded = (k: string) => {
  const v = process.env[k] ?? '';
  return v.length > 0 && v !== v.trim();
};

const present = (k: string) => {
  const v = process.env[k];
  return typeof v === 'string' && v.trim().length > 0;
};

/* A value pasted straight out of a .env file into a hosting
   dashboard keeps its quotes, which is invisible in most UIs and
   breaks everything downstream. Worth reporting by name. */
const quoted = (k: string) => {
  const v = process.env[k] ?? '';
  return /^["']|["']$/.test(v.trim());
};

export async function GET() {
  const uri = process.env.MONGODB_URI;

  const env = {
    MONGODB_URI: {
      present: present('MONGODB_URI'),
      quoted: quoted('MONGODB_URI'),
      padded: padded('MONGODB_URI'),
      wellFormed: Boolean(uri && /^mongodb(\+srv)?:\/\//.test(uri.trim())),
      host: safeMongoHost(uri),
    },
    GEMINI_API_KEY: { present: present('GEMINI_API_KEY'), quoted: quoted('GEMINI_API_KEY') },
    TWELVEDATA_API_KEY: {
      present: present('TWELVEDATA_API_KEY'),
      quoted: quoted('TWELVEDATA_API_KEY'),
    },
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: {
      present: present('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
      quoted: quoted('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    },
    GOOGLE_CLIENT_ID: { present: present('GOOGLE_CLIENT_ID'), quoted: quoted('GOOGLE_CLIENT_ID') },
    SMTP_HOST: { present: present('SMTP_HOST'), quoted: quoted('SMTP_HOST') },
    SMTP_USER: { present: present('SMTP_USER') },
    SMTP_PASS: { present: present('SMTP_PASS') },
  };

  /* The actual attempt, with the driver's own message on failure.
     `ping` is the cheapest command that proves a real round trip
     rather than just a resolved DNS name. */
  const t0 = Date.now();
  let mongo: { ok: boolean; ms: number; error?: string; hint?: string };
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    mongo = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    /* The two failures that account for almost every occurrence,
       named so nobody has to recognise the driver's wording. */
    let hint: string | undefined;
    if (/whitelist|not allowed|IP address/i.test(msg)) {
      hint =
        'This server’s address is not on the Atlas IP access list. Add 0.0.0.0/0 under Network Access — serverless functions have no fixed IP.';
    } else if (/authentication failed|bad auth/i.test(msg)) {
      hint = 'The username or password in MONGODB_URI is wrong.';
    } else if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) {
      hint = 'The cluster hostname in MONGODB_URI does not resolve. Check it for typos.';
    } else if (/timed out|ETIMEDOUT|ServerSelection/i.test(msg)) {
      hint =
        'The cluster did not answer in time — it may be paused, or the address may not be allowed.';
    }
    mongo = { ok: false, ms: Date.now() - t0, error: msg.slice(0, 300), hint };
  }

  const res = NextResponse.json({
    ok: mongo.ok,
    now: new Date().toISOString(),
    env,
    mongo,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
