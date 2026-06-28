export const adminSessionCookieName = "microgap_admin_session";
export const adminSessionMaxAgeSeconds = 60 * 60 * 12;

export type AdminAuthConfig = {
  adminEmail?: string;
  adminPassword?: string;
  sessionSecret?: string;
  nodeEnv?: string;
};

type SessionPayload = {
  v: 1;
  sub: "local-admin";
  iat: number;
  exp: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const placeholderPasswords = new Set([
  "change-me-local-only",
  "password",
  "admin",
]);
const placeholderSecrets = new Set([
  "replace-with-local-dev-secret",
  "replace-with-local-dev-secret-if-auth-is-enabled",
  "replace-with-a-random-32-plus-character-local-secret",
  "session-secret",
]);
const protectedPathPrefixes = [
  "/dashboard",
  "/opportunities",
  "/radar-tasks",
  "/api/opportunities",
  "/api/radar-tasks",
  "/api/scans/run",
];

export function readAdminAuthConfig(
  source: Record<string, string | undefined> = process.env,
): AdminAuthConfig {
  return {
    adminEmail: readOptional(source.ADMIN_EMAIL),
    adminPassword: readOptional(source.ADMIN_PASSWORD),
    sessionSecret: readOptional(source.SESSION_SECRET),
    nodeEnv: readOptional(source.NODE_ENV),
  };
}

export function isAdminAuthConfigured(
  config: AdminAuthConfig = readAdminAuthConfig(),
): boolean {
  return Boolean(
    config.adminPassword &&
      config.sessionSecret &&
      !isPlaceholderAdminPassword(config.adminPassword) &&
      !isPlaceholderSessionSecret(config.sessionSecret),
  );
}

export async function verifyAdminPassword(
  password: string,
  config: AdminAuthConfig = readAdminAuthConfig(),
): Promise<boolean> {
  if (!isAdminAuthConfigured(config)) {
    return false;
  }

  const [submittedHash, configuredHash] = await Promise.all([
    sha256(password),
    sha256(config.adminPassword ?? ""),
  ]);

  return constantTimeEqual(submittedHash, configuredHash);
}

export async function createAdminSessionToken(
  config: AdminAuthConfig = readAdminAuthConfig(),
  options: {
    now?: Date;
    maxAgeSeconds?: number;
  } = {},
): Promise<string> {
  const secret = getSessionSecret(config);
  const now = options.now ?? new Date();
  const maxAgeSeconds = options.maxAgeSeconds ?? adminSessionMaxAgeSeconds;
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: SessionPayload = {
    v: 1,
    sub: "local-admin",
    iat: issuedAt,
    exp: issuedAt + maxAgeSeconds,
  };
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signPayload(encodedPayload, secret);

  return `v1.${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  config: AdminAuthConfig = readAdminAuthConfig(),
  options: {
    now?: Date;
  } = {},
): Promise<boolean> {
  const secret = config.sessionSecret;

  if (!token || !secret || !isAdminAuthConfigured(config)) {
    return false;
  }

  const [version, encodedPayload, signature, extra] = token.split(".");

  if (version !== "v1" || !encodedPayload || !signature || extra !== undefined) {
    return false;
  }

  const expectedSignature = await signPayload(encodedPayload, secret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return false;
  }

  const payload = parseSessionPayload(encodedPayload);

  if (!payload) {
    return false;
  }

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);

  return payload.v === 1 && payload.sub === "local-admin" && payload.exp > nowSeconds;
}

export function getAdminSessionCookieOptions(
  config: AdminAuthConfig = readAdminAuthConfig(),
) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds,
  };
}

export function getClearedAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: readAdminAuthConfig().nodeEnv === "production",
    path: "/",
    maxAge: 0,
  };
}

export function shouldProtectPathname(pathname: string): boolean {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function normalizeAuthRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value.startsWith("/api/") || value.startsWith("/login")) {
    return fallback;
  }

  return value;
}

export function isApiPathname(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function buildLoginRedirectUrl(requestUrl: URL): URL {
  const loginUrl = new URL("/login", requestUrl);
  const currentPath = `${requestUrl.pathname}${requestUrl.search}`;

  loginUrl.searchParams.set("next", normalizeAuthRedirectPath(currentPath));

  return loginUrl;
}

function readOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function getSessionSecret(config: AdminAuthConfig): string {
  if (!isAdminAuthConfigured(config) || !config.sessionSecret) {
    throw new Error("Local admin session secret is not configured.");
  }

  return config.sessionSecret;
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
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
    textEncoder.encode(payload),
  );

  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function parseSessionPayload(encodedPayload: string): SessionPayload | null {
  try {
    const payload = JSON.parse(base64UrlDecodeText(encodedPayload)) as {
      v?: unknown;
      sub?: unknown;
      iat?: unknown;
      exp?: unknown;
    };

    if (payload.v !== 1 || payload.sub !== "local-admin") {
      return null;
    }

    const issuedAt = payload.iat;
    const expiresAt = payload.exp;

    if (!Number.isInteger(issuedAt) || !Number.isInteger(expiresAt)) {
      return null;
    }

    return {
      v: 1,
      sub: "local-admin",
      iat: issuedAt as number,
      exp: expiresAt as number,
    };
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function base64UrlEncodeText(value: string): string {
  return base64UrlEncodeBytes(textEncoder.encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecodeText(value: string): string {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return textDecoder.decode(bytes);
}

function isPlaceholderAdminPassword(value: string): boolean {
  return value.length < 8 || placeholderPasswords.has(value.toLowerCase());
}

function isPlaceholderSessionSecret(value: string): boolean {
  return value.length < 32 || placeholderSecrets.has(value.toLowerCase());
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(value),
  );

  return base64UrlEncodeBytes(new Uint8Array(digest));
}
