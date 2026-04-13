import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const isDocker = process.env.DOCKER_BUILD === "true";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable in development to avoid Turbopack conflicts
  disable: isDevelopment,
  // Exclude sound files from precaching - they should be loaded on-demand
  // Use pattern that matches both forward and back slashes (Windows build issue)
  exclude: [/sounds[\\/]/],
});

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment only
  ...(isDocker ? { output: "standalone" } : {}),

  // Empty turbopack config silences Next.js 16 warning about webpack config
  // Serwist is disabled in dev anyway, so Turbopack can be used for fast dev builds
  turbopack: {},

  // Increase server actions body size limit for ZIP file uploads (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  // jsdom (used by isomorphic-dompurify for SVG sanitization) reads CSS files
  // from disk at runtime — webpack can't bundle those, so keep it external
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],

  images: {
    remotePatterns: isDevelopment
      ? [
          // Local uploads (development)
          {
            protocol: "http",
            hostname: "localhost",
            port: "3000",
            pathname: "/uploads/**",
          },
        ]
      : [
          // Production uploads
          {
            protocol: "https",
            hostname: "kakamalem.com",
            pathname: "/uploads/**",
          },
          // Production uploads (www subdomain)
          {
            protocol: "https",
            hostname: "www.kakamalem.com",
            pathname: "/uploads/**",
          },
        ],
    // Disable optimization for local development to avoid private IP issues
    unoptimized: isDevelopment,
  },
};

export default withSerwist(nextConfig);
