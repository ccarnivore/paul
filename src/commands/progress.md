---
name: paul:progress
description: Show current loop and one next action
argument-hint: "[context]"
allowed-tools: [Read, Bash, Glob, Grep]
---

User context: $ARGUMENTS

Run `node "~/.claude/paul-framework/runtime/cli.js" context` from the project root. Use complete STATE and relevant ROADMAP sections to report milestone/phase, loop position and blockers. Inspect config and current AUDIT only when routing requires them. Suggest exactly one next action, incorporating the user's focus: resolve blocker, finish plan, audit if configured, approve if still needed, APPLY, UNIFY, or plan remaining scope. Matching plan/summary counts never imply phase completion. Report progress percentages only from explicit roadmap data. Use already loaded unchanged context; do not load all histories. No project changes are needed for status.
