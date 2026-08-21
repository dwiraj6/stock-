/* MongoDB connection + cache tier.
   ────────────────────────────────────────────────────────────────
   ONE client promise for the whole process. Atlas' free tier caps at
   500 connections; a serverless function that news up a client per
   request will exhaust that under trivial load and then every route
   fails at once. The promise is memoised on globalThis so Next's dev
   hot-reload doesn't leak a new pool on every edit.

   Every cache read is stale-while-revalidate: if a document exists
   but is past its TTL we serve it immediately with isStale:true and
   refresh in the background. The user never waits on a slow upstream
   (Part 10). */

import { MongoClient, type Db, type Collection } from 'mongodb';
import { getEnv } from './env';

const DB_NAME = 'plumbline';

declare global {
  // eslint-disable-next-line no-var
  var __plumblineMongo: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const { MONGODB_URI } = getEnv();
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    retryWrites: true,
  });
  return client.connect();
}

export function getClient(): Promise<MongoClient> {
  if (!global.__plumblineMongo) global.__plumblineMongo = connect();
  return global.__plumblineMongo;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(DB_NAME);
}

/** True when Mongo is reachable. Never throws — callers degrade. */
export async function mongoHealthy(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

/* ── collections ─────────────────────────────────────────────── */

export type CacheDoc<T> = {
  _id: string;
  data: T;
  fetchedAt: Date;
  source: string;
  expiresAt: Date;
};

export type SessionDoc = {
  symbol: string;
  conviction: number;
  modelScore: number;
  gap: number;
  createdAt: Date;
};

/* CACHE SCHEMA VERSION — bump on ANY change to a cached payload shape.
   ────────────────────────────────────────────────────────────────
   Cached documents outlive code. Twice during this build a shape
   change shipped while Mongo still held documents in the old shape,
   and the old shape was served: the fan chart drew "MNaN 190LNaN"
   when `band`/`density` were added, and the news provenance line
   reported zeroes when `filtered` became `audit`. Neither failed
   loudly — they just rendered wrong.

   Every key is now namespaced by this version, so bumping it retires
   the entire cache at once instead of waiting out a TTL. It costs one
   cold fetch per symbol and removes a whole class of bug. */
export const CACHE_SCHEMA = 'v3';

export const TTL = {
  quotes: 300,
  stocks: 900,
  news: 900,
  simulations: 86_400,
} as const;

export type CacheName = keyof typeof TTL;

async function coll<T>(name: CacheName): Promise<Collection<CacheDoc<T>>> {
  const db = await getDb();
  return db.collection<CacheDoc<T>>(name);
}

/** Every cache key is namespaced by the schema version. */
const versioned = (key: string) => `${CACHE_SCHEMA}:${key}`;

/** Create the TTL indexes. Idempotent; safe to call repeatedly. */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    ...(Object.keys(TTL) as CacheName[]).map((name) =>
      db
        .collection(name)
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' })
        .catch(() => undefined)
    ),
    db
      .collection('sessions')
      .createIndex({ createdAt: -1 }, { name: 'recent' })
      .catch(() => undefined),
  ]);
}

export type CacheHit<T> = {
  data: T;
  fetchedAt: Date;
  source: string;
  isStale: boolean;
};

/**
 * Read a cached document. `softTtlSeconds` decides staleness; the
 * Mongo TTL index decides deletion, and is set longer so a stale
 * document survives to be served when upstream is down.
 */
export async function cacheGet<T>(
  name: CacheName,
  key: string,
  softTtlSeconds: number = TTL[name]
): Promise<CacheHit<T> | null> {
  try {
    const c = await coll<T>(name);
    const doc = await c.findOne({ _id: versioned(key) });
    if (!doc) return null;
    const ageMs = Date.now() - new Date(doc.fetchedAt).getTime();
    return {
      data: doc.data,
      fetchedAt: new Date(doc.fetchedAt),
      source: doc.source,
      isStale: ageMs > softTtlSeconds * 1000,
    };
  } catch {
    // Mongo down is a degraded path, not an error path.
    return null;
  }
}

export async function cacheSet<T>(
  name: CacheName,
  key: string,
  data: T,
  source: string,
  hardTtlSeconds?: number
): Promise<void> {
  try {
    const c = await coll<T>(name);
    const now = new Date();
    // Keep documents well past their soft TTL: a stale quote is the
    // difference between a working demo and a blank screen.
    const hard = hardTtlSeconds ?? TTL[name] * 12;
    await c.updateOne(
      { _id: versioned(key) },
      {
        $set: {
          data,
          fetchedAt: now,
          source,
          expiresAt: new Date(now.getTime() + hard * 1000),
        },
      },
      { upsert: true }
    );
  } catch {
    /* cache writes are best-effort */
  }
}

/* ── sessions: the "three stocks people checked today" strip ──── */

export async function recordSession(s: Omit<SessionDoc, 'createdAt'>): Promise<void> {
  try {
    const db = await getDb();
    await db.collection<SessionDoc>('sessions').insertOne({ ...s, createdAt: new Date() });
  } catch {
    /* never block a response on analytics */
  }
}

export async function recentSymbols(limit = 3): Promise<string[]> {
  try {
    const db = await getDb();
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const rows = await db
      .collection<SessionDoc>('sessions')
      .aggregate<{ _id: string; n: number; last: Date }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$symbol', n: { $sum: 1 }, last: { $max: '$createdAt' } } },
        { $sort: { n: -1, last: -1 } },
        { $limit: limit },
      ])
      .toArray();
    return rows.map((r) => r._id);
  } catch {
    return [];
  }
}
