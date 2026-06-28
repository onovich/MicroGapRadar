import { type NextRequest, NextResponse } from "next/server";

import {
  adminSessionCookieName,
  buildLoginRedirectUrl,
  isApiPathname,
  shouldProtectPathname,
  verifyAdminSessionToken,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!shouldProtectPathname(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(adminSessionCookieName)?.value;
  const isAuthenticated = await verifyAdminSessionToken(token);

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (isApiPathname(request.nextUrl.pathname)) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Local admin authentication is required.",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.redirect(buildLoginRedirectUrl(request.nextUrl));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/opportunities/:path*",
    "/radar-tasks/:path*",
    "/api/opportunities/:path*",
    "/api/radar-tasks/:path*",
    "/api/scans/run",
  ],
};
