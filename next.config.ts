import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Card art is pulled from Scryfall's CDN at runtime rather than bundled.
  // These hosts only ever serve static images, never executable code.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "c1.scryfall.com" },
    ],
  },
};

export default nextConfig;
