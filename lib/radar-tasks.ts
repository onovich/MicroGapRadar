import "server-only";

import { Prisma, type RadarTask } from "@prisma/client";

import { db } from "@/lib/db";
import {
  radarTaskInputSchema,
  radarTaskListQuerySchema,
  radarTaskRouteParamsSchema,
  radarTaskUpdateInputSchema,
  type RadarTaskInput,
  type RadarTaskUpdateInput,
} from "@/lib/schemas";

export type RadarTaskDto = Omit<RadarTask, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export class RadarTaskNotFoundError extends Error {
  readonly code = "RADAR_TASK_NOT_FOUND";

  constructor(id: string) {
    super(`Radar task not found: ${id}`);
    this.name = "RadarTaskNotFoundError";
  }
}

function serializeRadarTask(task: RadarTask): RadarTaskDto {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function parseRadarTaskId(id: unknown): string {
  return radarTaskRouteParamsSchema.parse({ id }).id;
}

function toCreateData(input: RadarTaskInput): Prisma.RadarTaskCreateInput {
  return {
    userId: input.userId ?? null,
    name: input.name,
    domainDescription: input.domainDescription,
    seedExamples: input.seedExamples,
    countries: input.countries,
    languages: input.languages,
    userAdvantages: input.userAdvantages,
    monetizationPreferences: input.monetizationPreferences,
    riskPreferences: input.riskPreferences as Prisma.InputJsonValue,
    excludedTopics: input.excludedTopics,
    dailyLimit: input.dailyLimit,
    isActive: input.isActive,
  };
}

function toUpdateData(
  input: RadarTaskUpdateInput,
): Prisma.RadarTaskUpdateInput {
  const data: Prisma.RadarTaskUpdateInput = {};

  if (input.userId !== undefined) {
    data.userId = input.userId;
  }

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.domainDescription !== undefined) {
    data.domainDescription = input.domainDescription;
  }

  if (input.seedExamples !== undefined) {
    data.seedExamples = input.seedExamples;
  }

  if (input.countries !== undefined) {
    data.countries = input.countries;
  }

  if (input.languages !== undefined) {
    data.languages = input.languages;
  }

  if (input.userAdvantages !== undefined) {
    data.userAdvantages = input.userAdvantages;
  }

  if (input.monetizationPreferences !== undefined) {
    data.monetizationPreferences = input.monetizationPreferences;
  }

  if (input.riskPreferences !== undefined) {
    data.riskPreferences = input.riskPreferences as Prisma.InputJsonValue;
  }

  if (input.excludedTopics !== undefined) {
    data.excludedTopics = input.excludedTopics;
  }

  if (input.dailyLimit !== undefined) {
    data.dailyLimit = input.dailyLimit;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  return data;
}

function isMissingRecordError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export async function listRadarTasks(input: unknown = {}): Promise<{
  items: RadarTaskDto[];
}> {
  const query = radarTaskListQuerySchema.parse(input ?? {});
  const tasks = await db.radarTask.findMany({
    where:
      query.isActive === undefined ? undefined : { isActive: query.isActive },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit,
  });

  return { items: tasks.map(serializeRadarTask) };
}

export async function createRadarTask(input: unknown): Promise<RadarTaskDto> {
  const data = radarTaskInputSchema.parse(input);
  const task = await db.radarTask.create({
    data: toCreateData(data),
  });

  return serializeRadarTask(task);
}

export async function getRadarTask(idInput: unknown): Promise<RadarTaskDto> {
  const id = parseRadarTaskId(idInput);
  const task = await db.radarTask.findUnique({
    where: { id },
  });

  if (!task) {
    throw new RadarTaskNotFoundError(id);
  }

  return serializeRadarTask(task);
}

export async function updateRadarTask(
  idInput: unknown,
  input: unknown,
): Promise<RadarTaskDto> {
  const id = parseRadarTaskId(idInput);
  const data = radarTaskUpdateInputSchema.parse(input);

  try {
    const task = await db.radarTask.update({
      where: { id },
      data: toUpdateData(data),
    });

    return serializeRadarTask(task);
  } catch (error) {
    if (isMissingRecordError(error)) {
      throw new RadarTaskNotFoundError(id);
    }

    throw error;
  }
}

export async function deleteRadarTask(idInput: unknown): Promise<{
  id: string;
  action: "deactivated";
  isActive: false;
  historyPreserved: true;
}> {
  const id = parseRadarTaskId(idInput);

  try {
    await db.radarTask.update({
      where: { id },
      data: { isActive: false },
    });
  } catch (error) {
    if (isMissingRecordError(error)) {
      throw new RadarTaskNotFoundError(id);
    }

    throw error;
  }

  return {
    id,
    action: "deactivated",
    isActive: false,
    historyPreserved: true,
  };
}
