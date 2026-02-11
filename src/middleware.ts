import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie (NextAuth sets this)
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  // Protected routes -- redirect to sign-in if no session
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin")
  ) {
    if (!hasSession) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  // Redirect signed-in users away from sign-in page
  if (pathname === "/sign-in" && hasSession) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/sign-in"],
};
