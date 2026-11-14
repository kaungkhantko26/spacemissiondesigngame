import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This project lives on an external drive that writes macOS "._*" files into
  // the Turbopack cache, which corrupts it ("Failed to open database").
  experimental: {
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  // Allow opening the dev server (and its HMR websocket) from a LAN device/IP.
  allowedDevOrigins: ["172.20.10.3"],
};

export default nextConfig;
