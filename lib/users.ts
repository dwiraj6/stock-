/* ACCOUNTS, SESSIONS, AND THE THINGS THAT EXPIRE.
   ────────────────────────────────────────────────────────────────
   WHY THIS EXISTS AT ALL, since the app was deliberately account-free:

   The track record matures in twelve months. localStorage does not
   reliably last twelve months. Safari's Intelligent Tracking
   Prevention deletes script-writable storage after seven days
   without interaction, so on an iPhone an anonymous track record can
   be gone inside a week — and clearing site data, switching to a
   laptop, or buying a new phone ends it anywhere.

   The track record's entire claim is "you wrote this down before you
   knew". A record that quietly evaporates before it matures cannot
   make that claim. That is the reason for accounts here, and it is
   the only reason: an account is durable storage for a promise, not
   a growth funnel.

   WHAT IS STORED, AND NOTHING ELSE: an email address, a display
   name if the user gave one, a password digest, and Google's opaque
   user id if they used Google. No phone number, no date of birth,
   no PAN, nothing a broker would ask for. The app is educational and
   holds no money, so it has no business holding any of that.

   FOUR COLLECTIONS:
     users      the account
     sessions   live logins, revocable, hashed
     pending    signups and resets awaiting an emailed code
     throttle   rate-limit counters

   The last three all expire on their own via TTL indexes. Nothing
   here accumulates. */

import type { Collection, ObjectId } from 'mongodb';
import { getDb } from './mongo';
import { hashToken, newToken } from './auth';
import type { RiskProfile } from './risk-profile';

export type User = {
  _id?: ObjectId;
  email: string;
  name: string | null;
  /** null for accounts that only ever sign in with Google. */
  passwordHash: string | null;
  /** Google's stable subject id. null if they never used Google. */
  googleSub: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  /* Anonymous browser ids this account has absorbed. Kept as a list
     rather than overwritten, because someone may sign in on a phone
     and a laptop that each built up their own anonymous history, and
     both are genuinely theirs. */
  adopted: string[];
  /* The user's stated constraints — when they need the money, how
     much they could lose, what they would do on a fall. Optional: the
     app works without one and simply does not run the comparison.
     Stored on the account rather than in the browser because it is
     the kind of thing worth being asked once, not once per device. */
  riskProfile?: RiskProfile | null;
};

export type Session = {
  /** SHA-256 of the token. The token itself is never stored. */
  _id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

/** Long enough that a twelve-month horizon does not log you out
    every week, short enough that an abandoned session on a shared
    machine does not live forever. Renewed on use. */
export const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

const USERS = 'users';
const SESSIONS = 'sessions';
const PENDING = 'pending';
const THROTTLE = 'throttle';

/* ── indexes ─────────────────────────────────────────────────────
   Idempotent and best-effort, matching the pattern the rest of the
   app uses: a failed index creation must never turn into a failed
   request. The unique index on email is the one that genuinely
   matters — it is the last line of defence against two accounts
   claiming the same mailbox if two signups race. */
let indexed = false;
async function ensureAuthIndexes(): Promise<void> {
  if (indexed) return;
  indexed = true;
  try {
    const db = await getDb();
    await Promise.all([
      db.collection(USERS).createIndex({ email: 1 }, { unique: true, name: 'uniq_email' }),
      /* PARTIAL, not sparse — and the difference is the whole bug.

         `sparse` only skips documents where the field is ABSENT.
         Every password account is written with `googleSub: null`,
         which is present-and-null, so a sparse unique index treats
         them all as the same key: the first such account succeeds
         and the second dies with E11000 on `{ googleSub: null }`.
         It surfaced as "the account could not be created" with a
         perfectly healthy database sitting behind it.

         A partial index over string values only indexes accounts
         that actually have a Google identity, which is what the
         constraint was always meant to say: one account per Google
         subject, and no opinion about accounts without one. */
      db.collection(USERS).createIndex(
        { googleSub: 1 },
        {
          unique: true,
          name: 'uniq_google_v2',
          partialFilterExpression: { googleSub: { $type: 'string' } },
        }
      ),
      db.collection(SESSIONS).createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'ttl_session' }
      ),
      db.collection(SESSIONS).createIndex({ userId: 1 }, { name: 'by_user' }),
      db.collection(PENDING).createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'ttl_pending' }
      ),
      db.collection(PENDING).createIndex({ email: 1, kind: 1 }, { name: 'by_email' }),
      db.collection(THROTTLE).createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'ttl_throttle' }
      ),
    ]);
    /* The old sparse index, if this deployment predates the fix
       above. Dropping it is safe and idempotent: the partial index
       created alongside enforces the same rule correctly, and a
       missing index is simply nothing to drop. */
    await db
      .collection(USERS)
      .dropIndex('uniq_google')
      .catch(() => undefined);
  } catch {
    indexed = false; // let a later request try again
  }
}

async function users(): Promise<Collection<User>> {
  await ensureAuthIndexes();
  return (await getDb()).collection<User>(USERS);
}

/* ── accounts ────────────────────────────────────────────────── */

/* Throws if the account store is unreachable, and deliberately so.
   A null here means "no such account", which the login route turns
   into "wrong email or password" — reporting that when the truth is
   "the database is down" would tell someone their password is wrong
   when it is not. The routes catch it and say which it was. */
export async function findUserByEmail(email: string): Promise<User | null> {
  return (await users()).findOne({ email });
}

export async function findUserById(id: string): Promise<User | null> {
  const { ObjectId: OID } = await import('mongodb');
  if (!OID.isValid(id)) return null;
  return (await users()).findOne({ _id: new OID(id) });
}

export async function createUser(input: {
  email: string;
  name: string | null;
  passwordHash: string | null;
  googleSub: string | null;
  emailVerified: Date | null;
}): Promise<User | null> {
  try {
    const doc: User = { ...input, createdAt: new Date(), adopted: [] };
    const res = await (await users()).insertOne(doc);
    return { ...doc, _id: res.insertedId };
  } catch (e) {
    /* Usually the unique-email index firing on a race, which is
       benign and handled by the caller. Anything else is a real
       fault and must not vanish — a swallowed error here looks
       identical to "the database is down" from the outside. */
    console.error('[stockshishya] createUser failed —', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Attach a Google identity to an account that already exists.
    Only ever called when Google asserted the address is verified —
    otherwise anyone could register an unverified Google address and
    take over the matching password account. */
export async function linkGoogle(userId: ObjectId, googleSub: string, name: string | null) {
  await (await users()).updateOne(
    { _id: userId },
    {
      $set: {
        googleSub,
        emailVerified: new Date(),
        ...(name ? { name } : {}),
      },
    }
  );
}

export async function setRiskProfile(userId: ObjectId, riskProfile: RiskProfile) {
  await (await users()).updateOne({ _id: userId }, { $set: { riskProfile } });
}

export async function setPassword(userId: ObjectId, passwordHash: string) {
  await (await users()).updateOne({ _id: userId }, { $set: { passwordHash } });
}

/* ── sessions ────────────────────────────────────────────────── */

/** @returns the raw token — the only time it exists in plaintext. */
export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const db = await getDb();
  await ensureAuthIndexes();
  await db.collection<Session>(SESSIONS).insertOne({
    _id: hashToken(token),
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

/** Look up a session and, if it is more than a day old, push its
    expiry back. Sliding expiry keeps an active user signed in
    without making the absolute lifetime unbounded. */
export async function readSession(token: string): Promise<User | null> {
  if (!token) return null;
  try {
    const db = await getDb();
    const s = await db.collection<Session>(SESSIONS).findOne({ _id: hashToken(token) });
    if (!s) return null;
    if (s.expiresAt.getTime() < Date.now()) return null; // TTL sweep is lazy

    const user = await findUserById(s.userId);
    if (!user) return null;

    const fresh = new Date(Date.now() + SESSION_TTL_MS);
    if (fresh.getTime() - s.expiresAt.getTime() > 24 * 60 * 60 * 1000) {
      await db
        .collection<Session>(SESSIONS)
        .updateOne({ _id: s._id }, { $set: { expiresAt: fresh } })
        .catch(() => undefined);
    }
    return user;
  } catch {
    return null;
  }
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  try {
    const db = await getDb();
    await db.collection<Session>(SESSIONS).deleteOne({ _id: hashToken(token) });
  } catch {
    /* signing out must never fail loudly */
  }
}

/** Used after a password change: every other login is cut. */
export async function destroyAllSessions(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.collection<Session>(SESSIONS).deleteMany({ userId });
  } catch {
    /* best effort */
  }
}

/* ── pending signups and resets ──────────────────────────────────
   An unverified email never becomes an account. The password is
   hashed at this stage, so even a pending row holds no plaintext. */

export type Pending = {
  _id?: ObjectId;
  email: string;
  kind: 'verify' | 'reset';
  codeHash: string;
  attempts: number;
  name: string | null;
  passwordHash: string | null;
  expiresAt: Date;
  createdAt: Date;
};

export async function putPending(p: Omit<Pending, '_id' | 'createdAt'>): Promise<void> {
  const db = await getDb();
  await ensureAuthIndexes();
  // One live challenge per address per kind; a new code voids the old.
  await db.collection<Pending>(PENDING).deleteMany({ email: p.email, kind: p.kind });
  await db.collection<Pending>(PENDING).insertOne({ ...p, createdAt: new Date() });
}

export async function getPending(email: string, kind: Pending['kind']): Promise<Pending | null> {
  const db = await getDb();
  const p = await db.collection<Pending>(PENDING).findOne({ email, kind });
  if (!p) return null;
  if (p.expiresAt.getTime() < Date.now()) return null;
  return p;
}

export async function bumpPendingAttempts(email: string, kind: Pending['kind']): Promise<void> {
  const db = await getDb();
  await db.collection<Pending>(PENDING).updateOne({ email, kind }, { $inc: { attempts: 1 } });
}

export async function clearPending(email: string, kind: Pending['kind']): Promise<void> {
  const db = await getDb();
  await db.collection<Pending>(PENDING).deleteMany({ email, kind });
}

/* ── rate limiting ───────────────────────────────────────────────
   Mongo-backed rather than in-memory, because serverless instances
   do not share memory and an in-memory limiter on Vercel limits
   roughly nothing. Counters expire on their own.

   Fails OPEN on a Mongo error. That is a deliberate trade: the
   alternative is that a database blip locks every user out of their
   account, which is a worse outcome than a brief window with no
   throttle in front of scrypt. */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec: number }> {
  try {
    const db = await getDb();
    await ensureAuthIndexes();
    const now = Date.now();
    const doc = await db.collection(THROTTLE).findOneAndUpdate(
      { _id: key as never },
      {
        $inc: { hits: 1 },
        $setOnInsert: { expiresAt: new Date(now + windowMs) },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const hits = (doc as { hits?: number } | null)?.hits ?? 1;
    const expiresAt = (doc as { expiresAt?: Date } | null)?.expiresAt ?? new Date(now + windowMs);
    if (hits > limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
      };
    }
    return { ok: true, retryAfterSec: 0 };
  } catch {
    return { ok: true, retryAfterSec: 0 };
  }
}

/* ── adopting an anonymous history ───────────────────────────────
   See lib/decisions.ts for the migration itself. This only records
   that the account now owns that id, and is idempotent. */
export async function recordAdoption(userId: ObjectId, anonId: string): Promise<void> {
  await (await users()).updateOne({ _id: userId }, { $addToSet: { adopted: anonId } });
}
