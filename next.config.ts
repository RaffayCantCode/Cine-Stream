import type { NextConfig } from "next";

// Force a redeploy for Cloudflare nodejs_compat flag
const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  generateBuildId: async () => `build-${Date.now()}`,
  images: {
    minimumCacheTTL: 86400,
    formats: ["image/webp", "image/avif"],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      // Anime API image sources
      {
        protocol: "https",
        hostname: "*.vercel.app",
      },
      {
        protocol: "https",
        hostname: "*.animekai.to",
      },
      {
        protocol: "https",
        hostname: "*.gogoanime.*",
      },
      {
        protocol: "https",
        hostname: "*.hianime.*",
      },
      {
        protocol: "https",
        hostname: "*.aniwatch.*",
      },
      {
        protocol: "https",
        hostname: "dropfile.cc",
      },
      {
        protocol: "https",
        hostname: "api.anipub.xyz",
      },
      {
        protocol: "https",
        hostname: "api.tatakai.me",
      },
      {
        protocol: "https",
        hostname: "s4.anilist.co",
      },
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
      },
      {
        protocol: "https",
        hostname: "artworks.thetvdb.com",
      }
    ],
  },
  // Vercel specific optimizations
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    scrollRestoration: true,
    staleTimes: {
      dynamic: 0,
      static: 60,
    },
  },
  // Security & Cache control headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;