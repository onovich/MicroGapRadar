import { NextResponse } from "next/server";

import {
  adminSessionCookieName,
  getClearedAdminSessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(
    adminSessionCookieName,
    "",
    getClearedAdminSessionCookieOptions(),
  );

  return response;
}
