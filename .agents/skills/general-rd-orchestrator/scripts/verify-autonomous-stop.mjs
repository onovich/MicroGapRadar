#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const projectRoot = path.join(repoRoot, "project");
const activeDir = path.join(projectRoot, "tasks", "active");
const goalStatePath = path.join(projectRoot, "goal-mode-state.json");
const continuationPath = path.join(projectRoot, "messages", "outbox", "GOAL-MODE-CONTINUATION.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listTasks() {
  if (!fs.existsSync(activeDir)) return [];
  return fs.readdirSync(activeDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const filePath = path.join(activeDir, name);
      return { filePath, task: readJsonIfExists(filePath) };
    })
    .filter((item) => item.task && typeof item.task === "object");
}

function dependencyReady(task, byId) {
  const deps = Array.isArray(task.dependencies) ? task.dependencies : [];
  return deps.every((id) => byId.get(id)?.status === "CLOSED");
}

function hasHumanGate(value) {
  return Boolean(value?.human_gate?.required);
}

function hasProjectGoalComplete(state, continuation) {
  return Boolean(
    state?.project_goal_complete === true ||
    continuation?.project_goal_complete === true ||
    state?.goal_complete === true ||
    continuation?.goal_complete === true,
  );
}

function hasBlocker(state, continuation) {
  const values = [
    state?.blocker,
    state?.blocking_reason,
    continuation?.blocker,
    continuation?.blocking_reason,
  ];
  if (values.some((value) => typeof value === "string" && value.trim() !== "")) return true;
  const risks = Array.isArray(state?.unresolved_risks) ? state.unresolved_risks : [];
  return risks.some((risk) => {
    if (typeof risk === "string") return /\b(blocker|blocked|human gate)\b/i.test(risk);
    return Boolean(risk?.blocking === true || risk?.status === "BLOCKED");
  });
}

function summarize() {
  const state = readJsonIfExists(goalStatePath);
  const continuation = readJsonIfExists(continuationPath);
  const tasks = listTasks().map(({ task }) => task);
  const byId = new Map(tasks.map((task) => [task.id, task]));

  const dependencyReadyTasks = tasks
    .filter((task) => ["DRAFT", "READY"].includes(task.status))
    .filter((task) => dependencyReady(task, byId))
    .map((task) => ({ id: task.id, status: task.status, milestone: task.milestone }));

  const activeTasks = tasks
    .filter((task) => ["IN_PROGRESS", "REVIEW", "ACCEPTED", "PARTIAL"].includes(task.status))
    .map((task) => ({ id: task.id, status: task.status, milestone: task.milestone }));

  const reasons = [];
  const enabled = state?.enabled === true;

  if (!enabled) {
    return {
      verdict: "ALLOW_STOP",
      reason: "Autonomous goal mode is not enabled in project/goal-mode-state.json.",
      state: compactState(state),
      continuation: compactContinuation(continuation),
      dependency_ready_tasks: dependencyReadyTasks,
      active_tasks: activeTasks,
    };
  }

  if (hasProjectGoalComplete(state, continuation)) {
    return {
      verdict: "ALLOW_STOP",
      reason: "Project goal completion is explicitly recorded.",
      state: compactState(state),
      continuation: compactContinuation(continuation),
      dependency_ready_tasks: dependencyReadyTasks,
      active_tasks: activeTasks,
    };
  }

  if (hasHumanGate(state) || hasHumanGate(continuation)) {
    return {
      verdict: "ALLOW_STOP",
      reason: "A human gate is recorded.",
      state: compactState(state),
      continuation: compactContinuation(continuation),
      dependency_ready_tasks: dependencyReadyTasks,
      active_tasks: activeTasks,
    };
  }

  if (hasBlocker(state, continuation)) {
    return {
      verdict: "ALLOW_STOP",
      reason: "A blocker is recorded.",
      state: compactState(state),
      continuation: compactContinuation(continuation),
      dependency_ready_tasks: dependencyReadyTasks,
      active_tasks: activeTasks,
    };
  }

  if (state?.current_task) reasons.push(`current_task is ${state.current_task}`);
  if (Array.isArray(state?.active_threads) && state.active_threads.length > 0) {
    reasons.push(`active_threads has ${state.active_threads.length} entr${state.active_threads.length === 1 ? "y" : "ies"}`);
  }
  if (activeTasks.length > 0) reasons.push(`${activeTasks.length} active task(s) need routing or integration`);
  if (dependencyReadyTasks.length > 0) reasons.push(`${dependencyReadyTasks.length} dependency-ready task(s) exist`);
  if (Array.isArray(state?.next_ready_tasks) && state.next_ready_tasks.length > 0) {
    reasons.push(`goal-mode-state next_ready_tasks lists ${state.next_ready_tasks.length} task(s)`);
  }
  if (Array.isArray(continuation?.next_ready_tasks) && continuation.next_ready_tasks.length > 0) {
    reasons.push(`continuation next_ready_tasks lists ${continuation.next_ready_tasks.length} task(s)`);
  }
  if (continuation?.recommended_next_task?.id || continuation?.recommended_next_task?.summary) {
    reasons.push("continuation contains recommended_next_task that should become a task packet");
  }

  if (reasons.length === 0) {
    reasons.push("autonomous mode is enabled but no project_goal_complete, human gate, blocker, active task, or next task is recorded; derive the next task from accepted docs or persist a blocker");
  }

  return {
    verdict: "BLOCK_CONTINUE",
    reason: reasons.join("; "),
    state: compactState(state),
    continuation: compactContinuation(continuation),
    dependency_ready_tasks: dependencyReadyTasks,
    active_tasks: activeTasks,
  };
}

function compactState(state) {
  if (!state) return null;
  return {
    enabled: state.enabled,
    current_milestone: state.current_milestone,
    current_task: state.current_task,
    active_threads: state.active_threads,
    last_integrated_task: state.last_integrated_task,
    last_main_commit: state.last_main_commit,
    next_ready_tasks: state.next_ready_tasks,
    human_gate: state.human_gate,
    project_goal_complete: state.project_goal_complete,
  };
}

function compactContinuation(continuation) {
  if (!continuation) return null;
  return {
    current_milestone: continuation.current_milestone,
    current_task: continuation.current_task,
    last_integrated_task: continuation.last_integrated_task,
    main_commit: continuation.main_commit,
    next_ready_tasks: continuation.next_ready_tasks,
    recommended_next_task: continuation.recommended_next_task,
    human_gate: continuation.human_gate,
    project_goal_complete: continuation.project_goal_complete,
  };
}

try {
  const result = summarize();
  const asJson = process.argv.includes("--json");
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`${result.verdict}: ${result.reason}`);
    console.log(JSON.stringify({
      state: result.state,
      continuation: result.continuation,
      dependency_ready_tasks: result.dependency_ready_tasks,
      active_tasks: result.active_tasks,
    }, null, 2));
  }
  process.exit(result.verdict === "ALLOW_STOP" ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
