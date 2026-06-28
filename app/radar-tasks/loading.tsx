export default function RadarTasksLoading() {
  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="border-b border-ink/10 pb-5">
          <div className="h-4 w-32 rounded-lg bg-ink/10" />
          <div className="mt-3 h-9 w-52 rounded-lg bg-ink/10" />
        </header>
        <section className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <div
              className="rounded-lg border border-ink/10 bg-white/85 p-4"
              key={item}
            >
              <div className="h-4 w-40 rounded-lg bg-ink/10" />
              <div className="mt-4 h-6 w-64 rounded-lg bg-ink/10" />
              <div className="mt-4 h-4 max-w-3xl rounded-lg bg-ink/10" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
