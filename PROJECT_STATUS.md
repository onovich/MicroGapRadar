# Project Status

Updated at: 2026-06-27T17:51:40Z

## Current Milestone

`M1`: database and base data model.

## Current Outcome

Completed the M0 scaffold and project orchestration setup:

- The orchestrator skill is installed globally and in the repository.
- Project orchestration state exists under `project/`.
- `M0-SCAFFOLD-NEXT-001` is accepted and integrated.
- The Next.js App Router, TypeScript, Tailwind CSS scaffold builds successfully.

## Product Summary

MicroGap Radar is a self-use-first AI microtool opportunity radar. The 48-hour MVP must let the admin create Radar tasks, run scans with a mock SERP provider, rank opportunities, view score explanations, generate MVP specs, and copy Markdown briefs.

## Accepted Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- React Hook Form + Zod for forms and validation
- Prisma or Drizzle ORM; local SQLite is acceptable if the schema stays PostgreSQL-compatible
- OpenAI-compatible LLM provider
- Replaceable SERP provider adapter with mandatory mock provider

## Active Task

- None. The next task should start M1: database and ORM setup.

## Human Gates

Stop for human input before:

- adding paid services, accounts, secrets, or budgeted APIs;
- public deployment or release;
- changing the accepted product scope, platform, or core architecture;
- introducing legal, medical, financial, adult, gambling, gray-market, or similarly high-risk product claims;
- destructive Git or filesystem operations.

## Validation Policy

Use the project workflow wrappers when possible. At this stage no repository validation commands are configured yet, so each task must define its own required tests.
