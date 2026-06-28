import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Per-request Content Security Policy with a fresh script nonce.
 *
 * Next 16 renamed the `middleware` file convention to `proxy` (see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * This proxy generates a unique base64 nonce per request, writes it into the
 * `Content-Security-Policy` header AND the `x-nonce` request header. During SSR
 * Next.js parses the CSP header, extracts the `'nonce-{value}'`, and stamps it
 * onto every inline bootstrap/hydration script it emits, so we no longer need
 * `script-src 'unsafe-inline'`. `'strict-dynamic'` lets those nonce'd loaders
 * pull in the hashed `_next/static` chunk scripts transitively.
 *
 * Deliberate divergence from the Next doc sample: style-src keeps
 * `'self' 'unsafe-inline'` rather than a style nonce. Tailwind v4 and
 * framer-motion inject inline STYLES (governed by style-src, not script-src),
 * and the graph flow renders an inline <style> for edge animation. Styles are
 * not an XSS script vector, so keeping `'unsafe-inline'` there preserves every
 * animation while the script tightening (the actual weakness) still lands.
 *
 * Every non-script directive from the previous static next.config.ts CSP is
 * preserved verbatim: connect-src allowlist (self + Supabase https/wss +
 * backend origin), img-src, font-src, worker-src, frame-src 'none',
 * object-src 'none', base-uri 'self', form-action 'self',
 * frame-ancestors 'none', upgrade-insecure-requests.
 *
 * The middleware owns the CSP now; next.config.ts emits the rest of the
 * security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy,
 * Permissions-Policy) so there is no conflicting duplicate CSP.
 */

const SUPABASE_ORIGIN = "https://gwytslpqvqfewsjcqmuj.supabase.co";
const SUPABASE_WSS = "wss://gwytslpqvqfewsjcqmuj.supabase.co";
const BACKEND_ORIGIN = "https://backend-three-puce-75.vercel.app";

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  // In dev, React uses eval for richer error stacks, so 'unsafe-eval' is
  // required; it is never emitted in production.
  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WSS} ${BACKEND_ORIGIN}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // The CSP must be on the REQUEST headers so Next reads the nonce during SSR,
  // and on the RESPONSE headers so the browser enforces it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  /*
   * Run on every page request EXCEPT static assets, image optimizer, favicon,
   * and next/link prefetches (which do not need a per-request CSP nonce and
   * would otherwise force dynamic work on cacheable assets).
   */
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
