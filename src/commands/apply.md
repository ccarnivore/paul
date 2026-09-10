---
name: paul:apply
description: Execute the approved plan
argument-hint: "[plan ID/path or context]"
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Skill]
---

Arguments: $ARGUMENTS

@~/.claude/paul-framework/workflows/apply-phase.md

Follow that workflow. Load other framework documents only at the step that needs them. Preserve user/project rules and the mandatory PLAN → APPLY → UNIFY loop.
