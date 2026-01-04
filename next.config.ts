import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Local Supabase development
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      // Local Supabase via LAN IP (for mobile testing)
      {
        protocol: "http",
        hostname: "10.89.166.7",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Disable optimization for local development to avoid private IP issues
    unoptimized: isDevelopment,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
