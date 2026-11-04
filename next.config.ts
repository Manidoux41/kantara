import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  typescript: { tsconfigPath: process.env.AGENCY_TEST_TSCONFIG ?? "tsconfig.json" },
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/agency/**": ["./public/fonts/NotoSansKhmer.ttf", "./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/browsers.json"],
  },
  outputFileTracingExcludes: {
    "/*": ["./.kantara-demo/**/*", "./.kantara-team/**/*"],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

export default withNextIntl(nextConfig);
