import fs from "node:fs";
import path from "node:path";

export const HANDOFF_STATUSES = new Set([
  "PARTIAL",
  "BLOCKED",
  "REVIEW",
  "ACCEPT",
  "REQUEST_CHANGES",
  "INFO",
]);

export function readJson(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  return { absolutePath, value: parsed };
}

export function validateHandoff(value) {
  const errors = [];
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  if (!isObject) return ["root must be an object"];

  const requiredStrings = [
    "message_id",
    "task_id",
    "from_role",
    "status",
    "summary",
    "branch_or_worktree",
    "route_to",
    "requested_action",
    "created_at",
  ];

  for (const key of requiredStrings) {
    if (typeof value[key] !== "string" || value[key].trim() === "") {
      errors.push(`${key} must be a non-empty string`);
    }
  }

  if (typeof value.status === "string" && !HANDOFF_STATUSES.has(value.status)) {
    errors.push(`status must be one of ${[...HANDOFF_STATUSES].join(", ")}`);
  }

  for (const key of ["artifacts", "tests_run", "decisions", "risks", "blockers"]) {
    if (!Array.isArray(value[key])) errors.push(`${key} must be an array`);
  }

  if (!(value.commit === null || typeof value.commit === "string")) {
    errors.push("commit must be a string or null");
  }

  if (Array.isArray(value.artifacts)) {
    value.artifacts.forEach((item, index) => {
      if (typeof item !== "string" || item.trim() === "") {
        errors.push(`artifacts[${index}] must be a non-empty string`);
      }
    });
  }

  if (Array.isArray(value.tests_run)) {
    value.tests_run.forEach((item, index) => {
      const ok = item !== null && typeof item === "object" && !Array.isArray(item);
      if (!ok) {
        errors.push(`tests_run[${index}] must be an object`);
        return;
      }
      if (typeof item.command !== "string" || item.command.trim() === "") {
        errors.push(`tests_run[${index}].command must be a non-empty string`);
      }
      if (!Number.isInteger(item.exit_code)) {
        errors.push(`tests_run[${index}].exit_code must be an integer`);
      }
      if (typeof item.result !== "string") {
        errors.push(`tests_run[${index}].result must be a string`);
      }
    });
  }

  if (typeof value.created_at === "string" && Number.isNaN(Date.parse(value.created_at))) {
    errors.push("created_at must be an ISO-compatible date-time string");
  }

  return errors;
}

export function assertValidHandoff(value, source = "handoff") {
  const errors = validateHandoff(value);
  if (errors.length > 0) {
    throw new Error(`${source} is invalid:\n- ${errors.join("\n- ")}`);
  }
  return value;
}
