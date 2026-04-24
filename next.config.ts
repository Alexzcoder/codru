import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
