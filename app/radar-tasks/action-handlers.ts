import {
  parseRadarTaskFormData,
  parseRadarTaskUpdateFormData,
} from "@/lib/radar-task-view-models";

type RadarTaskMutationDeps = {
  requireLocalAdmin: () => Promise<void>;
  createRadarTask: (input: unknown) => Promise<{ id: string }>;
  updateRadarTask: (id: string, input: unknown) => Promise<{ id: string }>;
  deleteRadarTask: (id: string) => Promise<unknown>;
  revalidatePath: (path: string) => void;
  redirect: (path: string) => never;
};

export async function createRadarTaskFromForm(
  formData: FormData,
  deps: RadarTaskMutationDeps,
): Promise<never> {
  await deps.requireLocalAdmin();
  const task = await deps.createRadarTask(parseRadarTaskFormData(formData));

  deps.revalidatePath("/radar-tasks");
  return deps.redirect(`/radar-tasks/${task.id}`);
}

export async function updateRadarTaskFromForm(
  id: string,
  formData: FormData,
  deps: RadarTaskMutationDeps,
): Promise<never> {
  await deps.requireLocalAdmin();
  const task = await deps.updateRadarTask(id, parseRadarTaskUpdateFormData(formData));

  deps.revalidatePath("/radar-tasks");
  deps.revalidatePath(`/radar-tasks/${id}`);
  return deps.redirect(`/radar-tasks/${task.id}`);
}

export async function deactivateRadarTaskFromForm(
  id: string,
  formData: FormData,
  deps: RadarTaskMutationDeps,
): Promise<never> {
  await deps.requireLocalAdmin();

  if (formData.get("confirmDeactivate") !== "on") {
    return deps.redirect(`/radar-tasks/${id}`);
  }

  await deps.deleteRadarTask(id);
  deps.revalidatePath("/radar-tasks");
  deps.revalidatePath(`/radar-tasks/${id}`);
  return deps.redirect("/radar-tasks");
}
