import type { NextConfig } from "next";

/**
 * Dev-only: hosts allowed to load Next's dev resources (HMR, dev overlays)
 * when the app is reached through a proxy rather than localhost. Next blocks
 * these cross-origin by default, which shows up as a page that loads but never
 * hot-reloads.
 *
 * Production builds are unaffected — this has no effect once `next start` runs.
 * Add your own preview hosts via NEXT_ALLOWED_DEV_ORIGINS (comma separated).
 */
const devOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Produces .next/standalone, which is what the Dockerfile ships. It also
  // keeps `next start` working for a plain VPS + systemd install.
  output: "standalone",
  allowedDevOrigins: ["*.e2b.app", ...devOrigins],
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
