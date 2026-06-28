import { NextResponse } from "next/server";

import {
  adminSessionCookieName,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  isAdminAuthConfigured,
  normalizeAuthRedirectPath,
  readAdminAuthConfig,
  verifyAdminPassword,
} from "@/lib/auth";

type LoginFields = {
  password: string;
  redirectTo: string;
  wantsJson: boolean;
};

export async function POST(request: Request) {
  const fields = await readLoginFields(request);

  if (!fields) {
    return loginFailure(request, "invalid_request", "/dashboard", true, 400);
  }

  const config = readAdminAuthConfig();

  if (!isAdminAuthConfigured(config)) {
    return loginFailure(
      request,
      "auth_not_configured",
      fields.redirectTo,
      fields.wantsJson,
      500,
    );
  }

  if (!(await verifyAdminPassword(fields.password, config))) {
    return loginFailure(
      request,
      "invalid_password",
      fields.redirectTo,
      fields.wantsJson,
      401,
    );
  }

  const redirectTo = normalizeAuthRedirectPath(fields.redirectTo);
  const response = fields.wantsJson
    ? NextResponse.json({ data: { authenticated: true, redirectTo } })
    : NextResponse.redirect(new URL(redirectTo, request.url), 303);

  response.cookies.set(
    adminSessionCookieName,
    await createAdminSessionToken(config),
    getAdminSessionCookieOptions(config),
  );

  return response;
}

async function readLoginFields(request: Request): Promise<LoginFields | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const wantsJson =
    contentType.includes("application/json") ||
    (request.headers.get("accept") ?? "").includes("application/json");

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        password?: unknown;
        redirectTo?: unknown;
      };

      return {
        password: typeof body.password === "string" ? body.password : "",
        redirectTo: normalizeAuthRedirectPath(
          typeof body.redirectTo === "string" ? body.redirectTo : undefined,
        ),
        wantsJson,
      };
    }

    const formData = await request.formData();
    const password = formData.get("password");
    const redirectTo = formData.get("redirectTo");

    return {
      password: typeof password === "string" ? password : "",
      redirectTo: normalizeAuthRedirectPath(
        typeof redirectTo === "string" ? redirectTo : undefined,
      ),
      wantsJson,
    };
  } catch {
    return null;
  }
}

function loginFailure(
  request: Request,
  error: string,
  redirectTo: string,
  wantsJson: boolean,
  status: number,
) {
  if (wantsJson) {
    return NextResponse.json(
      {
        error: {
          code: error,
          message: "Local admin login failed.",
        },
      },
      { status },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  loginUrl.searchParams.set("next", normalizeAuthRedirectPath(redirectTo));

  return NextResponse.redirect(loginUrl, 303);
}
