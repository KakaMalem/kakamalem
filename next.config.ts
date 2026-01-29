import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const isDocker = process.env.DOCKER_BUILD === "true";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable in development to avoid Turbopack conflicts
  disable: isDevelopment,
});

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment only
  ...(isDocker ? { output: "standalone" } : {}),

  // Empty turbopack config silences Next.js 16 warning about webpack config
  // Serwist is disabled in dev anyway, so Turbopack can be used for fast dev builds
  turbopack: {},

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
