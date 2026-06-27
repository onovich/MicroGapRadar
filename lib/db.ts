import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const logLevels: Array<"warn" | "error"> =
  process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type { Prisma } from "@prisma/client";
