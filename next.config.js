const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // yahoo-finance2 and mongodb are server-only; keep them out of the
  // client bundle and let Next trace their files for the Vercel build.
  experimental: {
    serverComponentsExternalPackages: ['yahoo-finance2', 'mongodb'],
  },
  webpack: (config, { dev }) => {
    // Set the alias explicitly rather than relying on tsconfig paths:
    // the API routes are .ts but src/ is .jsx, and the mixed tree
    // makes the implicit resolution unreliable.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(__dirname),
    };
    /* Next 14's bundled webpack hashes chunks with a WASM xxhash64
       that crashes on Node 22 ("Cannot read properties of undefined
       (reading 'length')"). The native sha256 path is unaffected and
       costs nothing measurable at this bundle size. */
    config.output.hashFunction = 'sha256';

    /* Next 14's persistent webpack cache corrupts across builds on
       Node 22 — the second build throws "The 'data' argument must be
       of type string ... Received undefined" from Hash.update, and
       only `rm -rf .next` clears it. An in-memory cache costs a few
       seconds on a cold build and makes every build reproducible.
       Revisit when the project moves to Next 15. */
    if (!dev) config.cache = { type: 'memory' };

    return config;
  },
};

module.exports = nextConfig;
