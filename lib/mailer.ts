/* SENDING THE CODE.
   ────────────────────────────────────────────────────────────────
   Plain SMTP, deliberately. Not an SDK.

   The reason is a practical one about free tiers. Resend, Postmark
   and the rest will hand you an API key in thirty seconds, but until
   you verify a DOMAIN they will only deliver to your own address —
   which means anyone else who signs up never receives their code,
   and the failure is silent and looks like the app is broken. A
   Gmail app password sends to anybody, around 500 a day, and takes
   about the same thirty seconds.

   Because it is only SMTP, moving to SES or Brevo or Postmark later
   is four environment variables and no code.

   IF MAIL IS NOT CONFIGURED, this module says so loudly rather than
   pretending to send. Silent email failure is the single most
   confusing thing an auth system can do — the user waits for a code
   that was never sent, and no error appears anywhere. */

import nodemailer, { type Transporter } from 'nodemailer';

export type MailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/* Trimmed and unquoted, the same as lib/env.ts, and for the same
   reason: a value pasted into a hosting dashboard carries whatever
   invisible characters came with it. A trailing newline on
   MONGODB_URI cost an afternoon; the identical mistake on SMTP_PASS
   would produce "Invalid login" from Gmail and look for all the
   world like a wrong password.

   The app password specifically is shown by Google as four
   space-separated groups — `abcd efgh ijkl mnop` — and people copy
   it exactly as displayed. Gmail wants it without the spaces, so
   they are removed here rather than left as a trap. */
const clean = (v: string | undefined) =>
  typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '').trim() : undefined;

export function mailConfig(): MailConfig | null {
  const host = clean(process.env.SMTP_HOST);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS)?.replace(/\s+/g, '');
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(clean(process.env.SMTP_PORT) ?? 587) || 587,
    user,
    pass,
    from: clean(process.env.SMTP_FROM) || `Plumbline <${user}>`,
  };
}

export function mailConfigured(): boolean {
  return mailConfig() !== null;
}

let cached: Transporter | null = null;

function transport(cfg: MailConfig): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return cached;
}

export type SendResult = { ok: true } | { ok: false; reason: string };

async function send(to: string, subject: string, text: string, html: string): Promise<SendResult> {
  const cfg = mailConfig();
  if (!cfg) {
    return {
      ok: false,
      reason:
        'Email is not configured on this server. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local.',
    };
  }
  try {
    await transport(cfg).sendMail({ from: cfg.from, to, subject, text, html });
    return { ok: true };
  } catch (e) {
    /* The upstream message is genuinely useful here — "Invalid
       login" and "self-signed certificate" need completely different
       fixes — so it is returned to the caller, which decides whether
       the user or only the server log should see it. */
    return { ok: false, reason: e instanceof Error ? e.message : 'SMTP failed' };
  }
}

/* ── the messages ────────────────────────────────────────────────
   Plain, short, and in the product's voice. No marketing, no logo
   image, no tracking pixel. An email whose only job is to carry six
   digits should look like exactly that, because a code buried in a
   newsletter layout reads as phishing. */

const shell = (heading: string, body: string) => `
<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f2e8e2;padding:40px 24px;color:#1a1a1c">
  <div style="max-width:440px;margin:0 auto;background:#faf5f2;padding:36px 32px;border:1px solid #e0d5cd">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b6560">Plumbline</div>
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:600;margin:20px 0 16px">${heading}</h1>
    ${body}
  </div>
</div>`;

const codeBlock = (code: string) => `
  <div style="font-size:34px;letter-spacing:.34em;font-weight:600;margin:26px 0;padding:18px 0;text-align:center;background:#f2e8e2">${code}</div>`;

export function sendVerificationCode(to: string, code: string): Promise<SendResult> {
  return send(
    to,
    `${code} is your Plumbline code`,
    `Your Plumbline verification code is ${code}. It expires in 10 minutes.\n\n` +
      `If you did not try to create an account, ignore this — no account exists until this code is used.`,
    shell(
      'Confirm your email',
      codeBlock(code) +
        `<p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#4a4540;margin:0">
          Enter this to finish creating your account. It expires in 10 minutes.</p>
         <p style="font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#6b6560;margin:18px 0 0">
          If you did not try to sign up, you can ignore this. No account exists until the code is used.</p>`
    )
  );
}

export function sendResetCode(to: string, code: string): Promise<SendResult> {
  return send(
    to,
    `${code} is your Plumbline reset code`,
    `Your Plumbline password reset code is ${code}. It expires in 10 minutes.\n\n` +
      `If you did not ask to reset your password, ignore this and nothing changes.`,
    shell(
      'Reset your password',
      codeBlock(code) +
        `<p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#4a4540;margin:0">
          Enter this to set a new password. It expires in 10 minutes.</p>
         <p style="font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#6b6560;margin:18px 0 0">
          If you did not ask for this, ignore it — your password has not changed and every
          existing session stays as it was.</p>`
    )
  );
}

/* Sent when someone tries to register an address that already has an
   account. The signup endpoint must answer identically whether or
   not the address is taken — otherwise it becomes an oracle for
   which emails are registered — so the difference is carried here,
   in the mailbox, where only the actual owner can see it. */
export function sendAlreadyRegistered(to: string): Promise<SendResult> {
  return send(
    to,
    'You already have a Plumbline account',
    `Someone tried to create a Plumbline account with this address, but it already has one.\n\n` +
      `If that was you, just sign in instead — or use "forgot password" if you cannot remember it.\n\n` +
      `If it was not you, nothing has happened and you can ignore this.`,
    shell(
      'You already have an account',
      `<p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#4a4540;margin:0">
         Someone just tried to sign up with this address, but it already has a Plumbline account.
         If that was you, sign in instead — or reset your password if you cannot remember it.</p>
       <p style="font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#6b6560;margin:18px 0 0">
         If it was not you, nothing has happened and no change was made.</p>`
    )
  );
}
