/** @type {import('next').NextConfig} */
const backend = process.env.NYA_API_BACKEND || "http://127.0.0.1:8001";

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backend}/health`,
      },
    ];
  },
  images: {
    // Originals are served via the API; we don't use next/image optimization.
    unoptimized: true,
  },
};

export default nextConfig;
