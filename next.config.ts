import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const isDocker = process.env.DOCKER_BUILD === "true";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment only
  ...(isDocker ? { output: "standalone" } : {}),

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

export default nextConfig;
