import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Uploads (job/client/event photos, receipts) flow through Server Actions
    // as multipart FormData. Next's default body cap is 1 MB, which silently
    // rejected normal phone photos. Client-side compression (see
    // src/lib/image-compress.ts) keeps real payloads small; this is the safety
    // ceiling for the occasional uncompressible file (e.g. a multi-page PDF).
    serverActions: { bodySizeLimit: "15mb" },
  },
  async redirects() {
    return [
      // Settle the /settings landing at the HTTP layer so no component mounts
      // just to call redirect() (avoids a React DevTools timing warning).
      { source: "/:locale/settings", destination: "/:locale/settings/profile", permanent: false },
      { source: "/settings", destination: "/settings/profile", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
