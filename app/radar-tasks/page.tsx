import Link from "next/link";

import { getRadarTaskListData } from "@/lib/radar-task-view-models";

export const dynamic = "force-dynamic";

type RadarTasksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RadarTasksPage({
  searchParams,
}: RadarTasksPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const showInactive = firstValue(resolvedSearchParams.showInactive) === "true";
  const tasks = await getRadarTaskListData({ showInactive });

  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink/55">
              {tasks.activeCount} active / {tasks.inactiveCount} inactive
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-9 text-ink">
              Radar Tasks
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link className={primaryLinkClassName} href="/radar-tasks/new">
              New Radar Task
            </Link>
            <Link className={secondaryLinkClassName} href="/dashboard">
              Dashboard
            </Link>
            <Link
              className={secondaryLinkClassName}
              href={showInactive ? "/radar-tasks" : "/radar-tasks?showInactive=true"}
            >
              {showInactive ? "Active only" : "Show inactive"}
            </Link>
          </nav>
        </header>

        {tasks.hasItems ? (
          <section className="grid gap-3">
            {tasks.items.map((task) => (
              <article
                className="rounded-lg border border-ink/10 bg-white/90 p-4 shadow-sm"
                key={task.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase text-ink/55">
                      <span>{task.statusLabel}</span>
                      <span>{task.riskLabel}</span>
                      <span>Daily {task.dailyLimit}</span>
                    </div>
                    <h2 className="text-xl font-semibold text-ink">
                      <Link
                        className="underline-offset-4 hover:text-signal hover:underline"
                        href={task.detailHref}
                      >
                        {task.name}
                      </Link>
                    </h2>
                    <p className="max-w-4xl text-sm leading-6 text-ink/70">
                      {task.domainDescription}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs font-medium text-ink/60">
                      <Badge label={task.countries.join(", ")} />
                      <Badge label={task.languages.join(", ")} />
                      <Badge label={`${task.seedExamples.length} seeds`} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link className={secondaryLinkClassName} href={task.editHref}>
                      Edit
                    </Link>
                    <Link className={primaryLinkClassName} href={task.detailHref}>
                      Open
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-ink/20 bg-white/75 p-6">
            <h2 className="text-lg font-semibold text-ink">No radar tasks yet.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
              Create the first local radar task, then run a mock scan from its detail page.
            </p>
            <Link className={`mt-4 inline-flex ${primaryLinkClassName}`} href="/radar-tasks/new">
              Create task
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-lg border border-ink/10 bg-panel px-2.5 py-1">
      {label || "None"}
    </span>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const primaryLinkClassName =
  "rounded-lg border border-signal/30 bg-signal px-3 py-2 text-sm font-semibold text-white hover:bg-signal/90";

const secondaryLinkClassName =
  "rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink/70 hover:border-signal/40 hover:text-signal";
