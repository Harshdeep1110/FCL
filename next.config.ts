import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // When running `next dev` and opening the app from another device on the LAN
  // (e.g. http://172.22.25.234:3000 instead of localhost), Next 16 blocks the
  // cross-origin /_next dev resources by default, which stops client JS from
  // loading. Allow the LAN host(s) used for local testing here.
  allowedDevOrigins: ["172.22.25.234"],
};

export default nextConfig;
