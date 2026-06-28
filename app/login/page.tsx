import Link from "next/link";

import { normalizeAuthRedirectPath } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = firstValue(resolvedSearchParams.error);
  const redirectTo = normalizeAuthRedirectPath(
    firstValue(resolvedSearchParams.next),
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel/90 px-4 py-8 text-ink">
      <section className="w-full max-w-sm rounded-lg border border-ink/10 bg-white/90 p-6 shadow-soft">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase text-signal">
            Local admin
          </p>
          <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
          <p className="text-sm leading-6 text-ink/65">
            Use the local admin password from your private environment file.
          </p>
        </div>

        {error ? <LoginError error={error} /> : null}

        <form action="/api/auth/login" className="mt-6 space-y-4" method="post">
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <label className="block space-y-2 text-sm font-medium text-ink/70">
            <span>Password</span>
            <input
              autoComplete="current-password"
              autoFocus
              className="h-11 w-full rounded-lg border border-ink/15 bg-white px-3 text-base text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/20"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="h-11 w-full rounded-lg bg-signal px-4 text-sm font-semibold text-white hover:bg-signal/90"
            type="submit"
          >
            Continue
          </button>
        </form>

        <div className="mt-5 border-t border-ink/10 pt-4 text-sm">
          <Link className="font-semibold text-signal hover:underline" href="/">
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}

function LoginError({ error }: { error: string }) {
  const message =
    error === "auth_not_configured"
      ? "Local admin auth is not configured. Set ADMIN_PASSWORD and SESSION_SECRET in .env.local."
      : "Password was not accepted.";

  return (
    <div className="mt-5 rounded-lg border border-flare/25 bg-flare/10 px-3 py-2 text-sm leading-6 text-ink">
      {message}
    </div>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
