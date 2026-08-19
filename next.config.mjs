/** @type {import('next').NextConfig} */

// Content Security Policy.
// - MediaPipe wasm/model assets are fetched from a CDN unless self-hosted in /public/models,
//   so the CDN origin is allowlisted for script/wasm/connect.
const CDN = 'https://cdn.jsdelivr.net';
// Host of the MediaPipe face-detection model (self-host it in /public/models to drop this).
const MODEL_HOST = 'https://storage.googleapis.com';

const csp = [
  `default-src 'self'`,
  // Next.js injects inline bootstrap scripts; 'unsafe-eval' is required by the
  // MediaPipe wasm glue in dev-mode instantiation paths.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CDN}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `media-src 'self' blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' blob: data: ${CDN} ${MODEL_HOST} https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com`,
  `worker-src 'self' blob:`,
  `frame-src 'self' https://www.mercadopago.com https://*.mercadopago.com.mx https://*.mercadopago.com.ar`,
  `form-action 'self' https://www.mercadopago.com https://*.mercadopago.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `object-src 'none'`,
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // The app needs the camera on its own origin only.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
