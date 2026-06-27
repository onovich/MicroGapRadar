#!/usr/bin/env node
import { assertValidHandoff, readJson } from "./handoff-lib.mjs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node render-route-message.mjs <handoff.json>");
  process.exit(2);
}

const list = (items) => items.length === 0
  ? "- none"
  : items.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");

try {
  const { absolutePath, value } = readJson(filePath);
  const h = assertValidHandoff(value, absolutePath);
  const tests = h.tests_run.length === 0
    ? "- none recorded"
    : h.tests_run.map((test) => `- [exit ${test.exit_code}] ${test.command}: ${test.result}`).join("\n");

  console.log(`[ROUTED HANDOFF]\nTASK_ID: ${h.task_id}\nFROM: ${h.from_role}\nSTATUS: ${h.status}\nTARGET_ROLE: ${h.route_to}\nREQUESTED_ACTION: ${h.requested_action}\nSUMMARY: ${h.summary}\nBRANCH_OR_WORKTREE: ${h.branch_or_worktree}\nCOMMIT: ${h.commit ?? "none"}\nHANDOFF_FILE: ${absolutePath}\n\nARTIFACTS:\n${list(h.artifacts)}\n\nTESTS_RUN:\n${tests}\n\nDECISIONS:\n${list(h.decisions)}\n\nRISKS:\n${list(h.risks)}\n\nBLOCKERS:\n${list(h.blockers)}\n\nRead the task file and relevant project documents. Perform only the requested action. Do not expand scope. Emit a validated handoff with the required next ROUTE_TO.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
