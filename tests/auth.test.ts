import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adminSessionCookieName,
  buildLoginRedirectUrl,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  isAdminAuthConfigured,
  normalizeAuthRedirectPath,
  shouldProtectPathname,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "../lib/auth";

import { POST as loginPost } from "../app/api/auth/login/route";
import { POST as logoutPost } from "../app/api/auth/logout/route";

const authConfig = {
  adminEmail: "admin@example.com",
  adminPassword: "correct-local-password",
  sessionSecret: "test-session-secret-with-at-least-32-chars",
  nodeEnv: "development",
};

describe("local admin auth", () => {
  it("requires both a password and session secret before login can succeed", () => {
    assert.equal(isAdminAuthConfigured(authConfig), true);
    assert.equal(isAdminAuthConfigured({ adminPassword: "one" }), false);
    assert.equal(isAdminAuthConfigured({ sessionSecret: "one" }), false);
  });

  it("validates the configured admin password without accepting blanks or placeholders", async () => {
    assert.equal(
      await verifyAdminPassword("correct-local-password", authConfig),
      true,
    );
    assert.equal(
      await verifyAdminPassword("wrong-local-password", authConfig),
      false,
    );
    assert.equal(await verifyAdminPassword("", authConfig), false);
    assert.equal(
      await verifyAdminPassword("correct-local-password", {
        sessionSecret: "test-session-secret",
      }),
      false,
    );
    assert.equal(
      isAdminAuthConfigured({
        adminPassword: "change-me-local-only",
        sessionSecret: authConfig.sessionSecret,
      }),
      false,
    );
    assert.equal(
      isAdminAuthConfigured({
        adminPassword: authConfig.adminPassword,
        sessionSecret: "replace-with-local-dev-secret",
      }),
      false,
    );
    assert.equal(
      isAdminAuthConfigured({
        adminPassword: authConfig.adminPassword,
        sessionSecret: "replace-with-a-random-32-plus-character-local-secret",
      }),
      false,
    );
  });

  it("signs, verifies, and expires local admin session tokens", async () => {
    const now = new Date("2026-06-29T00:00:00.000Z");
    const token = await createAdminSessionToken(authConfig, {
      now,
      maxAgeSeconds: 60,
    });

    assert.equal(
      await verifyAdminSessionToken(token, authConfig, {
        now: new Date("2026-06-29T00:00:30.000Z"),
      }),
      true,
    );
    assert.equal(
      await verifyAdminSessionToken(token, authConfig, {
        now: new Date("2026-06-29T00:01:01.000Z"),
      }),
      false,
    );
    assert.equal(
      await verifyAdminSessionToken(`${token}tampered`, authConfig, {
        now,
      }),
      false,
    );
    await assert.rejects(
      createAdminSessionToken(
        {
          adminPassword: authConfig.adminPassword,
          sessionSecret: "replace-with-a-random-32-plus-character-local-secret",
        },
        {
          now,
          maxAgeSeconds: 60,
        },
      ),
      /Local admin session secret is not configured/,
    );

    const placeholderToken = await forgeSessionToken(
      "replace-with-a-random-32-plus-character-local-secret",
      {
        v: 1,
        sub: "local-admin",
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(now.getTime() / 1000) + 60,
      },
    );

    assert.equal(
      await verifyAdminSessionToken(
        placeholderToken,
        {
          adminPassword: authConfig.adminPassword,
          sessionSecret: "replace-with-a-random-32-plus-character-local-secret",
        },
        { now },
      ),
      false,
    );
  });

  it("uses a httpOnly strict cookie with secure enabled only for production", () => {
    assert.equal(adminSessionCookieName, "microgap_admin_session");
    assert.deepEqual(getAdminSessionCookieOptions(authConfig), {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: 43200,
    });
    assert.equal(
      getAdminSessionCookieOptions({
        ...authConfig,
        nodeEnv: "production",
      }).secure,
      true,
    );
  });

  it("protects only the local admin workspace routes", () => {
    assert.equal(shouldProtectPathname("/dashboard"), true);
    assert.equal(shouldProtectPathname("/dashboard/runs"), true);
    assert.equal(shouldProtectPathname("/opportunities/opportunity_1"), true);
    assert.equal(shouldProtectPathname("/radar-tasks/new"), true);
    assert.equal(shouldProtectPathname("/login"), false);
    assert.equal(shouldProtectPathname("/api/auth/login"), false);
    assert.equal(shouldProtectPathname("/api/radar-tasks"), true);
    assert.equal(shouldProtectPathname("/api/opportunities/opportunity_1"), true);
    assert.equal(shouldProtectPathname("/api/scans/run"), true);
    assert.equal(shouldProtectPathname("/_next/static/app.js"), false);
  });

  it("keeps redirect targets local and away from auth API loops", () => {
    assert.equal(normalizeAuthRedirectPath("/radar-tasks/new"), "/radar-tasks/new");
    assert.equal(normalizeAuthRedirectPath("https://example.com"), "/dashboard");
    assert.equal(normalizeAuthRedirectPath("//example.com/path"), "/dashboard");
    assert.equal(normalizeAuthRedirectPath("/api/auth/logout"), "/dashboard");
    assert.equal(normalizeAuthRedirectPath("/login"), "/dashboard");

    const loginUrl = buildLoginRedirectUrl(
      new URL("http://localhost:3000/opportunities?status=saved"),
    );

    assert.equal(loginUrl.pathname, "/login");
    assert.equal(loginUrl.searchParams.get("next"), "/opportunities?status=saved");
  });

  it("sets a session cookie on successful login without leaking credentials", async () => {
    const originalPassword = process.env.ADMIN_PASSWORD;
    const originalSecret = process.env.SESSION_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.ADMIN_PASSWORD = authConfig.adminPassword;
    process.env.SESSION_SECRET = authConfig.sessionSecret;
    process.env.NODE_ENV = "development";

    try {
      const response = await loginPost(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            password: "correct-local-password",
            redirectTo: "/dashboard",
          }),
        }),
      );
      const payload = await response.json();
      const setCookie = response.headers.get("set-cookie") ?? "";

      assert.equal(response.status, 200);
      assert.deepEqual(payload, {
        data: {
          authenticated: true,
          redirectTo: "/dashboard",
        },
      });
      assert.match(setCookie, new RegExp(adminSessionCookieName));
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Strict/i);
      assert.equal(setCookie.includes("correct-local-password"), false);
      assert.equal(setCookie.includes(authConfig.sessionSecret), false);
    } finally {
      restoreEnv("ADMIN_PASSWORD", originalPassword);
      restoreEnv("SESSION_SECRET", originalSecret);
      restoreEnv("NODE_ENV", originalNodeEnv);
    }
  });

  it("fails closed when login env still uses placeholders", async () => {
    const originalPassword = process.env.ADMIN_PASSWORD;
    const originalSecret = process.env.SESSION_SECRET;

    process.env.ADMIN_PASSWORD = "change-me-local-only";
    process.env.SESSION_SECRET = "replace-with-local-dev-secret";

    try {
      const response = await loginPost(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            password: "change-me-local-only",
            redirectTo: "/dashboard",
          }),
        }),
      );
      const payload = await response.json();

      assert.equal(response.status, 500);
      assert.equal(payload.error.code, "auth_not_configured");
    } finally {
      restoreEnv("ADMIN_PASSWORD", originalPassword);
      restoreEnv("SESSION_SECRET", originalSecret);
    }
  });

  it("clears the session cookie on logout", async () => {
    const response = await logoutPost(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    assert.equal(response.status, 303);
    assert.match(setCookie, new RegExp(adminSessionCookieName));
    assert.match(setCookie, /Max-Age=0/i);
    assert.match(response.headers.get("location") ?? "", /\/login$/);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function forgeSessionToken(
  secret: string,
  payload: {
    v: 1;
    sub: "local-admin";
    iat: number;
    exp: number;
  },
): Promise<string> {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );

  return `v1.${encodedPayload}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

function base64UrlEncode(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
