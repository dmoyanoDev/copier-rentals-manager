import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Baseline headers this app never had. All are pure restrictions on how
          // OTHER sites/browsers may interact with this one — none change what the
          // app itself is allowed to load, so none of them touch app behavior.
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // The app loads no external scripts/styles/fonts anywhere (next/font
          // self-hosts Inter, every fetch() call target is same-origin /api/...),
          // so default-src 'self' costs nothing functionally. script-src/style-src
          // keep 'unsafe-inline' (Next.js's own hydration/CSS-in-JS needs it) rather
          // than a nonce-based policy — weaker than ideal, but still blocks the part
          // that matters most for a stored/reflected-XSS payload: connect-src 'self'
          // stops it from exfiltrating cookies/session data to an attacker's domain,
          // and frame-ancestors 'none' stops the whole app from being framed.
          // worker-src blob: and connect-src data: are both required by
          // @react-pdf/renderer specifically — confirmed live (Presupuestos "Descargar
          // PDF") that without them the CSP silently breaks every PDF in the app: it
          // spins up its layout engine in a Worker built from a blob: URL, which loads
          // a WASM module via a data: URI fetch.
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
          }
        ]
      },
      // Prevent caching of main HTML routes and page shell
      {
        source: '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.webp).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
        ],
      },
      // Disable caching for dynamic API endpoints
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
