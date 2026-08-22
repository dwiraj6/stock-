'use client';

import Landing from '../src/landing/Landing.jsx';
import '../src/landing/landing.css';

export default function LandingClient({ stats }: { stats: any }) {
  return <Landing stats={stats} />;
}
