import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./auth";
import { NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

// Routes that require a signed-in user. Expressed as path tails (locale prefix is stripped before matching).
const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/settings"];
// Routes that signed-in users shouldn't see (send them to /dashboard).
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

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
