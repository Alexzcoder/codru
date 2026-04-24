import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./auth";
import { NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

const DEV_BYPASS = process.env.DEV_BYPASS === "true";

const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/settings"];
const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const tail = stripLocale(pathname);
  const session = req.auth;

  if (!DEV_BYPASS) {
    if (!session && PROTECTED_PATHS.some((p) => tail === p || tail.startsWith(`${p}/`))) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    if (session && AUTH_ONLY_PATHS.some((p) => tail === p)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
