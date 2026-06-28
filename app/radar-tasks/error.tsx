"use client";

type RadarTasksErrorProps = {
  reset: () => void;
};

export default function RadarTasksError({ reset }: RadarTasksErrorProps) {
  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl rounded-lg border border-flare/20 bg-white/90 p-6">
        <p className="text-sm font-semibold uppercase text-flare">
          Radar Tasks
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Could not load radar tasks.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          The local task list could not be read. Try again after checking the
          local database and admin session.
        </p>
        <button
          className="mt-5 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal/90"
          onClick={reset}
          type="button"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
