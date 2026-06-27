const signals = [
  "Low-competition search gaps",
  "AI-friendly microtool ideas",
  "48-hour MVP briefs",
];

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-5xl">
        <div className="grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-medium text-signal shadow-sm">
              Self-use-first opportunity radar
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-normal text-ink sm:text-6xl">
                MicroGap Radar
              </h1>
              <p className="max-w-2xl text-xl leading-8 text-ink/75">
                Daily scanning for low-competition, high-value search gaps that
                can become focused AI web microtools and concrete MVP specs.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {signals.map((signal) => (
                <span
                  className="rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-sm font-medium text-ink/70"
                  key={signal}
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink/10 bg-white/80 p-6 shadow-soft backdrop-blur">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-flare">
                  M0 scaffold
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  Ready for the first buildable foundation.
                </h2>
              </div>
              <p className="leading-7 text-ink/70">
                This base app keeps the first milestone intentionally narrow:
                App Router, TypeScript, Tailwind CSS, and server-only
                environment access. Radar tasks, scan orchestration, providers,
                auth, and data storage come in later milestones.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
