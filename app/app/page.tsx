'use client';

/* The client shell. Every visual component under /src is reused
   unchanged — the migration to Next.js moved where the app is
   mounted, not what it renders. */

import dynamic from 'next/dynamic';

const App = dynamic(() => import('../../src/App.jsx'), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: '60vh' }} aria-busy="true" />
  ),
});

export default function Page() {
  return <App />;
}
