import type { NextConfig } from "next";

// GitHub Pages build: `NEXT_PUBLIC_BASE_PATH=/spacemissiondesigngame GITHUB_PAGES=1 npm run build` → static site in ./out
const pages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(pages ? { output: "export" as const, basePath: process.env.NEXT_PUBLIC_BASE_PATH, trailingSlash: true, images: { unoptimized: true } } : {}),
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
