import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
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
    serverMinification: true,
    optimizeServerReact: true,
    scrollRestoration: true,
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
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
        ],
      },
    ];
  },
};

export default nextConfig;