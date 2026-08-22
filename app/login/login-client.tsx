'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthScreen from '../../src/auth/AuthScreen.jsx';
import '../../src/auth/auth.css';

function Inner({ stats }: { stats: any }) {
  const params = useSearchParams();
  /* `next` decides where a completed sign-in lands. Only a same-site
     path is honoured — an absolute URL here would turn the sign-in
     page into an open redirect, which is a phishing primitive: a
     link that genuinely starts on this domain and finishes somewhere
     else entirely. */
  const raw = params.get('next') ?? '/app';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/app';
  return (
    <AuthScreen
      stats={stats}
      next={next}
      initialError={params.get('error')}
      initialStep={params.get('mode') === 'signup' ? 'signup' : 'signin'}
    />
  );
}

export default function LoginClient({ stats }: { stats: any }) {
  return (
    <Suspense fallback={null}>
      <Inner stats={stats} />
    </Suspense>
  );
}
