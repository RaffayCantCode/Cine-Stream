import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      // Anime API image sources
      {
        protocol: "https",
        hostname: "**.vercel.app",
      },
      {
        protocol: "https",
        hostname: "**.animekai.to",
      },
      {
        protocol: "https",
        hostname: "**.gogoanime.**",
      },
      {
        protocol: "https",
        hostname: "**.hianime.**",
      },
      {
        protocol: "https",
        hostname: "**.aniwatch.**",
      },
      {
        protocol: "https",
        hostname: "**.m3u8",
      },
      // General image sources
      {
        protocol: "https",
        hostname: "**.png",
      },
      {
        protocol: "https",
        hostname: "**.jpg",
      },
      {
        protocol: "https",
        hostname: "**.jpeg",
      },
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
    // Optimize for serverless
    serverMinification: true,
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
        ],
      },
    ];
  },
};

export default nextConfig;
