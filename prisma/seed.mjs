import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.resolve(dirname, "../mock-data/sample_radar_tasks.json");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function requiredString(task, field) {
  const value = task[field];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Seed radar task is missing string field: ${field}`);
  }

  return value.trim();
}

function requiredArray(task, field) {
  const value = task[field];

  if (!Array.isArray(value)) {
    throw new Error(`Seed radar task is missing array field: ${field}`);
  }

  return value;
}

function requiredObject(task, field) {
  const value = task[field];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Seed radar task is missing object field: ${field}`);
  }

  return value;
}

async function main() {
  const raw = await readFile(samplePath, "utf8");
  const tasks = JSON.parse(raw);

  if (!Array.isArray(tasks)) {
    throw new Error("Sample radar tasks seed must be a JSON array.");
  }

  for (const task of tasks) {
    const name = requiredString(task, "name");
    const id = `seed-${slugify(name)}`;
    const data = {
      name,
      userId: null,
      domainDescription: requiredString(task, "domainDescription"),
      seedExamples: requiredArray(task, "seedExamples"),
      countries: requiredArray(task, "countries"),
      languages: requiredArray(task, "languages"),
      userAdvantages: requiredArray(task, "userAdvantages"),
      monetizationPreferences: requiredArray(task, "monetizationPreferences"),
      riskPreferences: requiredObject(task, "riskPreferences"),
      excludedTopics: requiredArray(task, "excludedTopics"),
      dailyLimit: Number.isInteger(task.dailyLimit) ? task.dailyLimit : 10,
      isActive: typeof task.isActive === "boolean" ? task.isActive : true,
    };

    await prisma.radarTask.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  console.log(
    `Seeded ${tasks.length} radar tasks from ${path.relative(process.cwd(), samplePath)}.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
