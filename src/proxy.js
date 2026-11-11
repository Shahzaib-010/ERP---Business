import { NextResponse } from "next/server";

// Convenience only: sends visitors with no session cookie straight to a login page.
// This is NOT security. Every page, Server Action and route handler checks the session
// itself (src/server/auth/current.js), because a cookie being present proves nothing.

const COOKIE_NAMES = ["__Host-bb_session", "bb_session"];

export function proxy(request) {
  const hasCookie = COOKIE_NAMES.some((n) => request.cookies.has(n));
  if (hasCookie) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const target = pathname.startsWith("/portal") ? "/login/customer" : "/login";
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/plans/:path*",
    "/bikes/:path*",
    "/cashbook/:path*",
    "/search",
    "/users/:path*",
    "/account/:path*",
    "/no-access",
    "/portal/:path*",
  ],
};
