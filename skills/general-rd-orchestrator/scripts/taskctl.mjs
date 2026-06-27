#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const projectRoot = path.join(repoRoot, "project");
const taskRoot = path.join(projectRoot, "tasks");
const activeDir = path.join(taskRoot, "active");
const archiveDir = path.join(taskRoot, "archive");
const registryPath = path.join(taskRoot, "thread-registry.json");
const messagesOutbox = path.join(projectRoot, "messages", "outbox");
const messagesRoutes = path.join(projectRoot, "messages", "routes");
const goalStatePath = path.join(projectRoot, "goal-mode-state.json");
const modelStatePath = path.join(projectRoot, "model-routing-state.json");
const validStatuses = new Set(["DRAFT", "READY", "IN_PROGRESS", "REVIEW", "ACCEPTED", "CLOSED", "BLOCKED", "PARTIAL"]);
const validRiskLevels = new Set(["R0", "R1", "R2", "R3", "R4"]);

function now() { return new Date().toISOString(); }

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDirs() {
  fs.mkdirSync(activeDir, { recursive: true });
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(messagesOutbox, { recursive: true });
  fs.mkdirSync(messagesRoutes, { recursive: true });
  if (!fs.existsSync(registryPath)) {
    atomicWrite(registryPath, { version: 1, updated_at: now(), threads: {} });
  }
  if (!fs.existsSync(goalStatePath)) {
    atomicWrite(goalStatePath, {
      version: 1,
      enabled: false,
      current_milestone: null,
      current_task: null,
      active_threads: [],
      last_integrated_task: null,
      last_main_commit: null,
      next_ready_tasks: [],
      unresolved_risks: [],
      human_gate: { required: false, reason: null },
      last_updated_at: now(),
    });
  }
  if (!fs.existsSync(modelStatePath)) {
    atomicWrite(modelStatePath, {
      version: 1,
      active_fallbacks: [],
      roles: {},
      last_updated_at: now(),
    });
  }
}

function taskPath(id) { return path.join(activeDir, `${id}.json`); }

function loadTask(idOrPath) {
  const candidate = fs.existsSync(idOrPath) ? path.resolve(idOrPath) : taskPath(idOrPath);
  if (!fs.existsSync(candidate)) throw new Error(`Task not found: ${idOrPath}`);
  return { filePath: candidate, task: readJson(candidate) };
}

function listTaskFiles() {
  if (!fs.existsSync(activeDir)) return [];
  return fs.readdirSync(activeDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(activeDir, name))
    .sort();
}

function validateTask(task) {
  const errors = [];
  if (!task || typeof task !== "object" || Array.isArray(task)) return ["root must be object"];
  for (const key of ["id", "summary", "milestone", "status", "owner_role", "reviewer_role", "risk_level", "route_to", "created_at", "updated_at"]) {
    if (typeof task[key] !== "string" || task[key].trim() === "") errors.push(`${key} must be non-empty string`);
  }
  if (typeof task.status === "string" && !validStatuses.has(task.status)) errors.push(`invalid status: ${task.status}`);
  if (typeof task.risk_level === "string" && !validRiskLevels.has(task.risk_level)) errors.push(`invalid risk_level: ${task.risk_level}`);
  for (const key of ["dependencies", "acceptance_criteria", "required_tests", "notes"]) {
    if (!Array.isArray(task[key])) errors.push(`${key} must be array`);
  }
  if (task.non_goals !== undefined && !Array.isArray(task.non_goals)) errors.push("non_goals must be array when present");
  if (!task.scope || typeof task.scope !== "object" || !Array.isArray(task.scope.allowed_paths) || !Array.isArray(task.scope.forbidden_paths)) {
    errors.push("scope must contain allowed_paths and forbidden_paths arrays");
  }
  if (!task.threads || typeof task.threads !== "object" || Array.isArray(task.threads)) errors.push("threads must be object");
  return errors;
}

function assertTask(task) {
  const errors = validateTask(task);
  if (errors.length) throw new Error(`Invalid task ${task?.id ?? "<unknown>"}:\n- ${errors.join("\n- ")}`);
}

function allTasks() {
  return listTaskFiles().map((filePath) => ({ filePath, task: readJson(filePath) }));
}

function parseFlags(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    result[key] = value;
    i += 1;
  }
  return result;
}

function updateTask(filePath, task) {
  task.updated_at = now();
  assertTask(task);
  atomicWrite(filePath, task);
}

function usage() {
  console.log(`taskctl commands:\n  init\n  create --id ID --summary TEXT --owner ROLE [--reviewer ROLE --milestone M0 --risk R1 --route-to ROLE]\n  import <task.json>\n  list [--status STATUS]\n  show <ID>\n  validate [ID|path|all]\n  set-status <ID> <STATUS>\n  set-thread <ID> <ROLE> <THREAD_ID>\n  clear-thread <ID> <ROLE>\n  get-thread <ID> <ROLE>\n  ready\n  check-registry\n  archive <ID>`);
}

ensureDirs();
const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case undefined:
    case "help":
    case "--help":
      usage();
      break;

    case "init":
      console.log(`Initialized orchestration under ${projectRoot}`);
      break;

    case "create": {
      const f = parseFlags(args);
      if (!f.id || !f.summary || !f.owner) throw new Error("create requires --id, --summary, --owner");
      const filePath = taskPath(f.id);
      if (fs.existsSync(filePath)) throw new Error(`Task already exists: ${f.id}`);
      const task = {
        id: f.id,
        summary: f.summary,
        milestone: f.milestone ?? "M0",
        status: "DRAFT",
        owner_role: f.owner,
        reviewer_role: f.reviewer ?? "qa_reviewer",
        risk_level: f.risk ?? "R1",
        dependencies: [],
        scope: { allowed_paths: [], forbidden_paths: [] },
        acceptance_criteria: [],
        required_tests: [],
        branch_or_worktree: null,
        threads: {},
        route_to: f["route-to"] ?? (f.reviewer ?? "qa_reviewer"),
        notes: [],
        non_goals: [],
        created_at: now(),
        updated_at: now(),
      };
      assertTask(task);
      atomicWrite(filePath, task);
      console.log(`Created ${filePath}`);
      break;
    }

    case "import": {
      const input = args[0];
      if (!input) throw new Error("import requires <task.json>");
      const task = readJson(input);
      assertTask(task);
      const target = taskPath(task.id);
      if (fs.existsSync(target)) throw new Error(`Task already exists: ${task.id}`);
      atomicWrite(target, task);
      console.log(`Imported ${target}`);
      break;
    }

    case "list": {
      const f = parseFlags(args);
      const rows = allTasks()
        .map(({ task }) => task)
        .filter((task) => !f.status || task.status === f.status)
        .sort((a, b) => a.id.localeCompare(b.id));
      for (const task of rows) {
        console.log(`${task.id}\t${task.status}\t${task.milestone}\towner=${task.owner_role}\treviewer=${task.reviewer_role}\trisk=${task.risk_level}\t${task.summary}`);
      }
      if (rows.length === 0) console.log("No matching tasks.");
      break;
    }

    case "show": {
      const id = args[0];
      if (!id) throw new Error("show requires <ID>");
      const { task } = loadTask(id);
      console.log(JSON.stringify(task, null, 2));
      break;
    }

    case "validate": {
      const target = args[0] ?? "all";
      const items = target === "all" ? allTasks() : [loadTask(target)];
      let count = 0;
      for (const { filePath, task } of items) {
        assertTask(task);
        count += 1;
        console.log(`VALID ${filePath}`);
      }
      console.log(`Validated ${count} task(s).`);
      break;
    }

    case "set-status": {
      const [id, status] = args;
      if (!id || !status) throw new Error("set-status requires <ID> <STATUS>");
      if (!validStatuses.has(status)) throw new Error(`Invalid status: ${status}`);
      const { filePath, task } = loadTask(id);
      task.status = status;
      updateTask(filePath, task);
      console.log(`${id} -> ${status}`);
      break;
    }

    case "set-thread": {
      const [id, role, threadId] = args;
      if (!id || !role || !threadId) throw new Error("set-thread requires <ID> <ROLE> <THREAD_ID>");
      const { filePath, task } = loadTask(id);
      task.threads[role] = threadId;
      updateTask(filePath, task);
      const registry = readJson(registryPath);
      registry.threads[threadId] = { role, task_id: id, status: "active", updated_at: now() };
      registry.updated_at = now();
      atomicWrite(registryPath, registry);
      console.log(`${id}.${role} = ${threadId}`);
      break;
    }

    case "clear-thread": {
      const [id, role] = args;
      if (!id || !role) throw new Error("clear-thread requires <ID> <ROLE>");
      const { filePath, task } = loadTask(id);
      const threadId = task.threads[role];
      delete task.threads[role];
      updateTask(filePath, task);
      if (threadId) {
        const registry = readJson(registryPath);
        if (registry.threads[threadId]) {
          registry.threads[threadId].status = "closed";
          registry.threads[threadId].updated_at = now();
        }
        registry.updated_at = now();
        atomicWrite(registryPath, registry);
      }
      console.log(`Cleared ${id}.${role}`);
      break;
    }

    case "get-thread": {
      const [id, role] = args;
      if (!id || !role) throw new Error("get-thread requires <ID> <ROLE>");
      const { task } = loadTask(id);
      console.log(task.threads[role] ?? "");
      break;
    }

    case "ready": {
      const tasks = allTasks().map(({ task }) => task);
      const byId = new Map(tasks.map((task) => [task.id, task]));
      const ready = [];
      for (const task of tasks) {
        if (!["DRAFT", "READY"].includes(task.status)) continue;
        const depsClosed = task.dependencies.every((dep) => byId.get(dep)?.status === "CLOSED");
        if (depsClosed) ready.push(task);
      }
      ready.sort((a, b) => a.id.localeCompare(b.id));
      for (const task of ready) {
        console.log(`${task.id}\t${task.status}\t${task.milestone}\towner=${task.owner_role}\t${task.summary}`);
      }
      if (ready.length === 0) console.log("No READY candidates.");
      break;
    }

    case "check-registry": {
      const registry = readJson(registryPath);
      const ids = Object.keys(registry.threads ?? {});
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      const active = ids.filter((id) => registry.threads[id]?.status === "active");
      console.log(`threads=${ids.length} active=${active.length} duplicates=${duplicates.length}`);
      if (duplicates.length > 0) {
        console.error(`Duplicate thread IDs: ${duplicates.join(", ")}`);
        process.exit(1);
      }
      break;
    }

    case "archive": {
      const id = args[0];
      if (!id) throw new Error("archive requires <ID>");
      const source = taskPath(id);
      if (!fs.existsSync(source)) throw new Error(`Task not found: ${id}`);
      const task = readJson(source);
      if (task.status !== "CLOSED") throw new Error(`Only CLOSED tasks may be archived; ${id} is ${task.status}`);
      const target = path.join(archiveDir, `${id}.json`);
      fs.renameSync(source, target);
      console.log(`Archived ${id} -> ${target}`);
      break;
    }

    default:
      usage();
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
