/* AUTHENTICATION PRIMITIVES.
   ────────────────────────────────────────────────────────────────
   Hand-written, and the reasoning is worth stating because "never
   roll your own auth" is good advice that people apply too widely.

   What that advice is really about is inventing CRYPTOGRAPHY — your
   own hash, your own cipher, your own token format. None of that
   happens here. Every primitive below is a standard construction
   from node:crypto: scrypt for passwords, a CSPRNG for tokens,
   SHA-256 for storage digests, constant-time comparison for every
   secret check.

   What IS hand-written is the plumbing: which cookie, which
   redirect, which lookup. That part is ordinary application code,
   and writing it out is what lets the whole surface fit in three
   files you can actually read. Auth.js v5 is still beta and its
   Credentials provider is explicitly limited; bending it around an
   email-OTP flow and an anonymous-record migration would have been
   more framework-fighting than building.

   THE RULES THIS FILE KEEPS:

     · A password is never stored, only its scrypt digest.
     · A session token is never stored, only its SHA-256 digest — a
       database leak cannot be replayed as a login.
     · An OTP is never stored, only its digest, and it is single-use.
     · Every comparison of a secret is timing-safe.
     · Nothing here is reversible. There is no "recover my password",
       only "prove the mailbox again and set a new one".
*/

import {
  randomBytes,
  scrypt as scryptCb,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

/* ── passwords ───────────────────────────────────────────────────
   scrypt, not bcrypt. Two reasons: it is in the Node standard
   library, so there is no native module to fail to build on Windows
   and no extra dependency to audit; and it is memory-hard, which is
   the property that actually matters against GPU cracking.

   N=16384 is the Node default work factor. It costs roughly 100ms
   per hash on a small Vercel instance, which is the right order:
   slow enough to make offline cracking expensive, fast enough that
   a login does not feel broken. */
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

/** @returns `scrypt$<salt-hex>$<key-hex>` — self-describing, so the
    format can be migrated later without guessing what old rows are. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(plain.normalize('NFKC'), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

/** Constant-time. Returns false on any malformed input rather than
    throwing, so a corrupt row is a failed login and not a 500. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const [scheme, saltHex, keyHex] = stored.split('$');
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length !== SCRYPT_KEYLEN) return false;
    const actual = await scrypt(plain.normalize('NFKC'), Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* Deliberately permissive. Length is the only rule that reliably
   predicts strength; composition rules ("one symbol, one digit")
   mostly produce Password1! and a sticky note. The real defences are
   scrypt above and the rate limit on the login route. */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;

export function passwordProblem(plain: string): string | null {
  if (typeof plain !== 'string' || plain.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters.`;
  }
  if (plain.length > MAX_PASSWORD) {
    // Not a policy — an unbounded input is a scrypt denial-of-service.
    return `That is longer than ${MAX_PASSWORD} characters.`;
  }
  return null;
}

/* ── opaque tokens ───────────────────────────────────────────────
   Session tokens and OAuth state are random, not signed. A signed
   token (JWT and friends) needs a secret to verify, cannot be
   revoked before it expires, and invites the family of algorithm
   confusion bugs. A random token looked up in Mongo has neither
   problem: revoking it is a delete, and there is nothing to forge
   because there is no structure to forge.

   The consequence, stated plainly: every request that needs a user
   costs one indexed Mongo lookup. That is the price of revocability
   and it is worth paying. */
const TOKEN_BYTES = 32; // 256 bits

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** What actually goes in the database. Tokens are bearer secrets: if
    they were stored raw, anyone who read the collection could log in
    as anyone. Hashed, a dump is inert. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/* ── one-time codes ──────────────────────────────────────────────
   Six digits, because it has to be read off a phone and typed. That
   is only a million possibilities, so the entropy is not doing the
   work here — the short expiry, the five-attempt ceiling and the
   single-use rule are. A code is worthless the moment it is used or
   the moment it is missed five times. */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  /* Rejection sampling rather than `% 1_000_000`. The modulo would
     bias the low end of the range, and while that bias is tiny it
     costs nothing to not have it. */
  const ceiling = 10 ** OTP_LENGTH;
  const limit = Math.floor(0xffffffff / ceiling) * ceiling;
  let n: number;
  do {
    n = randomBytes(4).readUInt32BE(0);
  } while (n >= limit);
  return String(n % ceiling).padStart(OTP_LENGTH, '0');
}

/** Timing-safe compare for user-supplied codes. */
export function codeMatches(supplied: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(String(supplied).trim()), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ── email ───────────────────────────────────────────────────────
   Normalised once, here, so that Foo@Gmail.com and foo@gmail.com
   cannot become two accounts that each believe they own the mailbox. */
export function normaliseEmail(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailProblem(raw: string): string | null {
  const e = normaliseEmail(raw);
  if (!e) return 'Enter your email address.';
  if (e.length > 254) return 'That address is too long.';
  if (!EMAIL_RE.test(e)) return 'That does not look like an email address.';
  return null;
}
