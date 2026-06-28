import { notFound } from "next/navigation";

import { updateRadarTaskAction } from "@/app/radar-tasks/actions";
import { RadarTaskForm } from "@/components/RadarTaskForm";
import {
  getRadarTaskDetailData,
  toRadarTaskFormValues,
  type RadarTaskDetailViewModel,
} from "@/lib/radar-task-view-models";
import { RadarTaskNotFoundError } from "@/lib/radar-tasks";

type EditRadarTaskPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditRadarTaskPage({
  params,
}: EditRadarTaskPageProps) {
  const { id } = await params;
  let task: RadarTaskDetailViewModel;

  try {
    task = await getRadarTaskDetailData(id);
  } catch (error) {
    if (error instanceof RadarTaskNotFoundError) {
      notFound();
    }

    throw error;
  }

  const action = updateRadarTaskAction.bind(null, id);

  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="border-b border-ink/10 pb-5">
          <p className="text-sm font-medium text-ink/55">Local admin</p>
          <h1 className="mt-1 text-3xl font-semibold leading-9 text-ink">
            Edit Radar Task
          </h1>
        </header>

        <RadarTaskForm
          action={action}
          cancelHref={task.detailHref}
          submitLabel="Save changes"
          values={toRadarTaskFormValues(task)}
        />
      </div>
    </main>
  );
}
