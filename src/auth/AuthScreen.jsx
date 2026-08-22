'use client';

/* THE SIGN-IN PAGE.
   ────────────────────────────────────────────────────────────────
   Five steps in one component, because they are one task and a
   router hop between them would lose the half-typed email.

     signin → the default
     signup → name, email, password
     verify → the six digits
     forgot → ask for the address
     reset  → digits plus a new password

   THE PANEL ON THE LEFT IS NOT DECORATION. Most sign-in pages put a
   stock illustration there. This one answers the question the user
   is actually asking — why does this thing want an account at all —
   and answers it with the real reason and the real numbers, which is
   the only argument this product is entitled to make.

   Every field carries the autocomplete token password managers look
   for. Getting `new-password` vs `current-password` right is the
   difference between a manager offering to generate a password and
   silently filling the wrong one. */

import { useEffect, useMemo, useState } from 'react';
import CodeInput from './CodeInput.jsx';
import {
  getMe,
  signUp,
  verifyCode,
  resendCode,
  logIn,
  forgotPassword,
  resetPassword,
  googleStartUrl,
  signInWithGooglePopup,
  GOOGLE_ERRORS,
} from '../lib/auth-client.js';
import { MIN_PASSWORD } from './constants.js';

/**
 * @param {object} props
 * @param {object|null} [props.stats]   published exhibit numbers for the left panel
 * @param {string} [props.next]         same-site path to land on once signed in
 * @param {string|null} [props.initialError]
 *        a failure code bounced back from the Google callback
 * @param {string} [props.initialStep]
 *        'signup' to open on the create-account step, so a "Sign up"
 *        link anywhere in the app lands on the right form rather than
 *        on a login box the visitor has to notice and click past
 */
export default function AuthScreen({ stats, next = '/app', initialError = null, initialStep = 'signin' }) {
  const [step, setStep] = useState(initialStep === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    initialError ? GOOGLE_ERRORS[initialError] ?? 'That sign-in did not complete.' : null
  );
  const [notice, setNotice] = useState(null);
  const [methods, setMethods] = useState({ google: true, firebase: false, email: true });
  /* Autofocus is right on a desktop and wrong on a phone, where it
     throws the keyboard up over the page before the user has read a
     word of it. Resolved after mount so the server-rendered markup
     is identical either way. */
  const [autoFocus, setAutoFocus] = useState(false);
  useEffect(() => {
    setAutoFocus(window.matchMedia('(min-width: 880px)').matches);
  }, []);

  /* Ask the server which methods it can actually offer, so a Google
     button is never shown on a server with no client id — a control
     that can only fail is worse than no control. */
  useEffect(() => {
    let cancelled = false;
    getMe().then((res) => {
      if (cancelled) return;
      if (res?.methods) setMethods(res.methods);
      if (res?.user) window.location.replace(next);
    });
    return () => { cancelled = true; };
  }, [next]);

  const go = (to) => { setStep(to); setError(null); setNotice(null); setCode(''); };

  const done = () => window.location.assign(next);

  /* One place where a failed call becomes something on screen. The
     API already returns a message and an action, so the UI does not
     invent its own wording — it shows what the server said. */
  const handle = (res, onOk) => {
    if (res?.ok) return onOk(res);
    setError([res?.message, res?.action].filter(Boolean).join(' '));
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const res = await signUp(email, password, name);
    setBusy(false);
    // go() clears any previous message, so the notice is set after it.
    handle(res, () => {
      go('verify');
      setNotice(`A 6-digit code is on its way to ${email}.`);
    });
  };

  const submitVerify = async (supplied) => {
    const c = supplied ?? code;
    if (busy || c.length < 6) return;
    setBusy(true); setError(null);
    const res = await verifyCode(email, c);
    setBusy(false);
    handle(res, done);
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const res = await logIn(email, password);
    setBusy(false);
    handle(res, done);
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const res = await forgotPassword(email);
    setBusy(false);
    handle(res, () => {
      go('reset');
      setNotice(`If ${email} has an account, a code is on its way.`);
    });
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (busy || code.length < 6) return;
    setBusy(true); setError(null);
    const res = await resetPassword(email, code, password);
    setBusy(false);
    handle(res, done);
  };

  /* Firebase does the popup and hands back an ID token; the server
     verifies it and issues this app's own session. A cancelled popup
     is not an error — the user changed their mind, and a red banner
     for that is noise. */
  const googlePopup = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    const res = await signInWithGooglePopup();
    setBusy(false);
    if (res?.ok) return done();
    if (res?.cancelled) return;
    setError([res?.message, res?.action].filter(Boolean).join(' '));
  };

  const resend = async () => {
    setBusy(true); setError(null);
    const res = await resendCode(email);
    setBusy(false);
    handle(res, () => setNotice('Another code is on its way. Check spam if it does not arrive.'));
  };

  const heading = useMemo(
    () =>
      ({
        signin: 'Sign in',
        signup: 'Create an account',
        verify: 'Check your email',
        forgot: 'Reset your password',
        reset: 'Set a new password',
      })[step],
    [step]
  );

  const sub = useMemo(
    () =>
      ({
        signin: 'To record a measurement and keep your track record.',
        signup: 'It takes one email address and nothing else.',
        verify: `Enter the 6-digit code sent to ${email}. It expires in 10 minutes.`,
        forgot: 'We will send a 6-digit code to your address.',
        reset: 'Enter the code, then choose a new password.',
      })[step],
    [step, email]
  );

  return (
    <main className="au">
      {/* ── the argument ── */}
      <aside className="au-aside" aria-labelledby="au-why">
        <div className="au-plumb" aria-hidden="true">
          <span className="au-plumb-line" />
          <svg width="22" height="30" viewBox="0 0 18 26" className="au-plumb-bob">
            <path d="M9 0 V13" stroke="var(--color-ink)" strokeWidth="1" />
            <path d="M9 13 C4.6 15 4.3 19 9 26 C13.7 19 13.4 15 9 13 Z" fill="var(--color-ink)" />
          </svg>
        </div>

        <p className="eyebrow">Plumbline</p>
        <h2 id="au-why" className="au-aside-h">
          A record that disappears cannot be a record.
        </h2>
        <p className="au-aside-p">
          Every measurement writes down what you believed <em>before</em> the outcome existed, and
          settles twelve months later. Kept in the browser alone, that promise does not survive —
          Safari deletes site storage after a week of not visiting, and a cleared cache or a new
          phone ends it anywhere.
        </p>
        <p className="au-aside-p">
          An account is how the promise lasts long enough to be checked. It holds your email and
          nothing else — no phone number, no PAN, no broker link. This tool holds no money and has
          no business asking.
        </p>

        {stats && (
          <dl className="au-stats">
            <div>
              <dt>{stats.bandHitPct}%</dt>
              <dd>
                of {stats.bandN} point-in-time forecasts landed inside the 80% band
              </dd>
            </div>
            <div>
              <dt>{stats.directionSkillPct}%</dt>
              <dd>
                skill on direction across {stats.directionN} forecasts — worse than guessing, and
                published anyway
              </dd>
            </div>
          </dl>
        )}
      </aside>

      {/* ── the form ── */}
      <section className="au-panel">
        <div className="au-form">
          <p className="eyebrow au-step">{heading}</p>
          <h1 className="au-h1">{heading === 'Sign in' ? 'Welcome back.' : heading}</h1>
          <p className="au-sub">{sub}</p>

          {error && (
            <p className="au-msg au-msg-bad" role="alert">
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="au-msg au-msg-ok" role="status">
              {notice}
            </p>
          )}

          {/* ── Google ── */}
          {methods.google && (step === 'signin' || step === 'signup') && (
            <>
              {/* Two routes to the same place. Firebase opens a popup
                  and is preferred because it provisions Google's
                  consent screen automatically; the direct OAuth
                  redirect in lib/google.ts is the fallback for a
                  server configured that way instead. */}
              {methods.firebase ? (
                <button type="button" className="au-google" onClick={googlePopup} disabled={busy}>
                  <GoogleMark />
                  Continue with Google
                </button>
              ) : (
                <a className="au-google" href={googleStartUrl(next)}>
                  <GoogleMark />
                  Continue with Google
                </a>
              )}
              <div className="au-or" aria-hidden="true">
                <span>or</span>
              </div>
            </>
          )}

          {!methods.email && (step === 'signup' || step === 'forgot') && (
            <p className="au-msg au-msg-bad">
              This server has no email configured, so it cannot send a verification code. Use Google,
              or set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local.
            </p>
          )}

          {step === 'signin' && (
            <form onSubmit={submitLogin} noValidate>
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                autoFocus={autoFocus}
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                aside={
                  <button type="button" className="au-link" onClick={() => go('forgot')}>
                    Forgot?
                  </button>
                }
              />
              <Submit busy={busy} label="Sign in" />
              <p className="au-alt">
                No account?{' '}
                <button type="button" className="au-link" onClick={() => go('signup')}>
                  Create one
                </button>
              </p>
            </form>
          )}

          {step === 'signup' && (
            <form onSubmit={submitSignup} noValidate>
              <Field
                label="Name"
                hint="optional"
                type="text"
                value={name}
                onChange={setName}
                autoComplete="name"
                autoFocus={autoFocus}
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint={`at least ${MIN_PASSWORD} characters`}
              />
              <Submit busy={busy} label="Send me a code" />
              <p className="au-alt">
                Already have an account?{' '}
                <button type="button" className="au-link" onClick={() => go('signin')}>
                  Sign in
                </button>
              </p>
            </form>
          )}

          {step === 'verify' && (
            <div>
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={submitVerify}
                disabled={busy}
                invalid={Boolean(error)}
              />
              <Submit busy={busy} label="Verify" onClick={() => submitVerify()} disabled={code.length < 6} />
              <p className="au-alt">
                No code?{' '}
                <button type="button" className="au-link" onClick={resend} disabled={busy}>
                  Send another
                </button>
                {' · '}
                <button type="button" className="au-link" onClick={() => go('signup')}>
                  Change address
                </button>
              </p>
            </div>
          )}

          {step === 'forgot' && (
            <form onSubmit={submitForgot} noValidate>
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                autoFocus={autoFocus}
              />
              <Submit busy={busy} label="Send a code" />
              <p className="au-alt">
                <button type="button" className="au-link" onClick={() => go('signin')}>
                  Back to sign in
                </button>
              </p>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={submitReset} noValidate>
              <CodeInput value={code} onChange={setCode} disabled={busy} invalid={Boolean(error)} />
              <Field
                label="New password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint={`at least ${MIN_PASSWORD} characters`}
              />
              <Submit busy={busy} label="Set password" disabled={code.length < 6} />
              <p className="au-alt">
                Signing in here ends every other session on this account.
              </p>
            </form>
          )}

          <p className="au-fine">
            Educational only. Nothing here is investment advice, and no money moves through it.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ── pieces ─────────────────────────────────────────────────────── */

function Field({ label, hint, aside, type, value, onChange, autoComplete, autoFocus }) {
  const id = `au-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="au-field">
      <div className="au-field-top">
        <label htmlFor={id}>
          {label}
          {hint && <span className="au-hint"> — {hint}</span>}
        </label>
        {aside}
      </div>
      <input
        id={id}
        className="au-input font-data"
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        autoCapitalize="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Submit({ busy, label, onClick, disabled }) {
  return (
    <button
      className="au-submit font-data"
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={busy || disabled}
    >
      {busy ? 'Working…' : label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.3-.2-1.9H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.3h2.9c1.7-1.6 2.7-3.9 2.7-6.6Z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.4A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V4.9H.9a9 9 0 0 0 0 8.2l3-2.4Z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 4.9l3 2.4C4.6 5.1 6.6 3.6 9 3.6Z" />
    </svg>
  );
}
