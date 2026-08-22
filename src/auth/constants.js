/* Shared with lib/auth.ts, which enforces it server-side.
   Duplicated rather than imported because that module is TypeScript
   running on the server and this one ships to the browser; the
   server is the authority and this copy only shapes the hint text. */
export const MIN_PASSWORD = 8;
