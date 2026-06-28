"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  adminSessionCookieName,
  verifyAdminSessionToken,
} from "@/lib/auth";
import {
  createRadarTask,
  deleteRadarTask,
  updateRadarTask,
} from "@/lib/radar-tasks";

import {
  createRadarTaskFromForm,
  deactivateRadarTaskFromForm,
  updateRadarTaskFromForm,
} from "./action-handlers";

export async function createRadarTaskAction(formData: FormData) {
  return createRadarTaskFromForm(formData, mutationDeps);
}

export async function updateRadarTaskAction(id: string, formData: FormData) {
  return updateRadarTaskFromForm(id, formData, mutationDeps);
}

export async function deleteRadarTaskAction(id: string, formData: FormData) {
  return deactivateRadarTaskFromForm(id, formData, mutationDeps);
}

async function requireLocalAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminSessionCookieName)?.value;

  if (!(await verifyAdminSessionToken(token))) {
    redirect("/login?next=/radar-tasks");
  }
}

const mutationDeps = {
  requireLocalAdmin,
  createRadarTask,
  updateRadarTask,
  deleteRadarTask,
  revalidatePath,
  redirect,
};
