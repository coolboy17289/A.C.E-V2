/** @type {import('next').NextConfig} */
const nextConfig = {
  // The A.C.E backend lives on :4318 (Express + SQLite). We expose it
  // through Next.js so client + server code can keep using relative
  // /api/* URLs. The :path* wildcard forwards every path the SPA hits.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4318/api/:path*',
      },
    ];
  },
  // Allow the rewrite target to be a different host without tripping
  // the default same-origin checks. Internal-only — keep the host list
  // tight when this graduates to a public deployment.
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
