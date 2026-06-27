#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROLE_ASSIGNMENTS = {
  lead_orchestrator: "deep",
  systems_architect: "deep",
  domain_designer: "deep",
  implementation_engineer: "balanced",
  client_engineer: "balanced",
  data_content_engineer: "balanced",
  test_engineer: "balanced",
  qa_reviewer: "deep",
  security_reviewer: "deep",
  research_scout: "fast",
  release_engineer: "fast",
  spark_worker: "fast",
};

function now() { return new Date().toISOString(); }

function parseGlobalFlags(argv) {
  const args = [];
  let repoRootOverride = null;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--repo-root") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("--repo-root requires a path");
      repoRootOverride = value;
      i += 1;
      continue;
    }
    args.push(token);
  }
  return { args, repoRootOverride };
}

function parseFlags(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = value;
      i += 1;
    }
  }
  return result;
}

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(dir, ".git")) ||
      fs.existsSync(path.join(dir, "AGENTS.md")) ||
      fs.existsSync(path.join(dir, "package.json"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, filePath);
}

function assertInsideRepo(targetPath) {
  const relativePath = path.relative(repoRoot, targetPath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Target must stay inside repo root: ${targetPath}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function splitModels(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeInitialState() {
  return {
    version: 1,
    status: "needs_discovery",
    source: null,
    available_models: [],
    tiers: { deep: null, balanced: null, fast: null },
    role_assignments: ROLE_ASSIGNMENTS,
    notes: [
      "Discover available models before assigning roles.",
      "Use deep for lead/review/architecture/security, balanced for implementation/tests, and fast for scoped scans or mechanical tasks.",
    ],
    last_updated_at: now(),
  };
}

function chooseFallbacks(models, explicit) {
  const first = models[0] ?? null;
  const second = models[1] ?? first;
  const last = models[models.length - 1] ?? first;
  return {
    deep: explicit.deep ?? first,
    balanced: explicit.balanced ?? second,
    fast: explicit.fast ?? last,
  };
}

function validateState(state) {
  const errors = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) return ["root must be object"];
  if (!Array.isArray(state.available_models)) errors.push("available_models must be array");
  if (!state.tiers || typeof state.tiers !== "object" || Array.isArray(state.tiers)) {
    errors.push("tiers must be object");
  } else {
    for (const tier of ["deep", "balanced", "fast"]) {
      if (typeof state.tiers[tier] !== "string" || state.tiers[tier].trim() === "") {
        errors.push(`tiers.${tier} must be a non-empty string`);
      } else if (Array.isArray(state.available_models) && state.available_models.length > 0 && !state.available_models.includes(state.tiers[tier])) {
        errors.push(`tiers.${tier} is not listed in available_models`);
      }
    }
  }
  if (!state.role_assignments || typeof state.role_assignments !== "object" || Array.isArray(state.role_assignments)) {
    errors.push("role_assignments must be object");
  }
  return errors;
}

function assertReadyState(state, source) {
  const errors = validateState(state);
  if (errors.length > 0) throw new Error(`${source} is invalid:\n- ${errors.join("\n- ")}`);
}

function usage() {
  console.log(`modelctl commands:\n  init [--force]\n  record --models A,B,C [--deep A --balanced B --fast C --source TEXT]\n  show\n  validate\n  render-agents --target DIR\n\nGlobal option:\n  --repo-root PATH     Target repository root. Also supports JUST_GOAL_REPO_ROOT.`);
}

const globalFlags = parseGlobalFlags(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(
  globalFlags.repoRootOverride ??
  process.env.JUST_GOAL_REPO_ROOT ??
  findRepoRoot(process.cwd()) ??
  process.cwd()
);
const statePath = path.join(repoRoot, "project", "model-routing-state.json");
const [command, ...args] = globalFlags.args;

try {
  switch (command) {
    case undefined:
    case "help":
    case "--help":
      usage();
      break;

    case "init": {
      const flags = parseFlags(args);
      if (fs.existsSync(statePath) && !flags.force) {
        console.log(`Model routing already exists: ${statePath}`);
        break;
      }
      atomicWrite(statePath, makeInitialState());
      console.log(`Initialized model routing at ${statePath}`);
      break;
    }

    case "record": {
      const flags = parseFlags(args);
      const models = splitModels(flags.models);
      if (models.length === 0) throw new Error("record requires --models A,B,C");
      const tiers = chooseFallbacks(models, {
        deep: flags.deep,
        balanced: flags.balanced,
        fast: flags.fast,
      });
      const state = {
        ...makeInitialState(),
        status: "ready",
        source: flags.source ?? "manual-or-agent-discovery",
        available_models: models,
        tiers,
        last_updated_at: now(),
      };
      assertReadyState(state, "model routing");
      atomicWrite(statePath, state);
      console.log(`Recorded model routing at ${statePath}`);
      console.log(`deep=${tiers.deep} balanced=${tiers.balanced} fast=${tiers.fast}`);
      break;
    }

    case "show": {
      if (!fs.existsSync(statePath)) throw new Error(`Model routing not found: ${statePath}`);
      console.log(JSON.stringify(readJson(statePath), null, 2));
      break;
    }

    case "validate": {
      if (!fs.existsSync(statePath)) throw new Error(`Model routing not found: ${statePath}`);
      const state = readJson(statePath);
      assertReadyState(state, statePath);
      console.log(`VALID ${statePath}`);
      break;
    }

    case "render-agents": {
      const flags = parseFlags(args);
      if (!flags.target || flags.target === true) throw new Error("render-agents requires --target DIR");
      if (!fs.existsSync(statePath)) throw new Error(`Model routing not found: ${statePath}`);
      const state = readJson(statePath);
      assertReadyState(state, statePath);

      const sourceDir = path.join(skillRoot, "assets", "agents");
      const targetDir = path.resolve(repoRoot, flags.target);
      assertInsideRepo(targetDir);
      fs.mkdirSync(targetDir, { recursive: true });
      let count = 0;
      for (const name of fs.readdirSync(sourceDir).filter((item) => item.endsWith(".toml")).sort()) {
        const sourcePath = path.join(sourceDir, name);
        const targetPath = path.join(targetDir, name);
        const rendered = fs.readFileSync(sourcePath, "utf8")
          .replaceAll("JUST_GOAL_DEEP_MODEL", state.tiers.deep)
          .replaceAll("JUST_GOAL_BALANCED_MODEL", state.tiers.balanced)
          .replaceAll("JUST_GOAL_FAST_MODEL", state.tiers.fast);
        fs.writeFileSync(targetPath, rendered, "utf8");
        count += 1;
      }
      console.log(`Rendered ${count} agent template(s) to ${targetDir}`);
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
