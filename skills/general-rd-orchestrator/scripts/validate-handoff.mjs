#!/usr/bin/env node
import { assertValidHandoff, readJson } from "./handoff-lib.mjs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node validate-handoff.mjs <handoff.json>");
  process.exit(2);
}

try {
  const { absolutePath, value } = readJson(filePath);
  assertValidHandoff(value, absolutePath);
  console.log(`VALID ${absolutePath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
