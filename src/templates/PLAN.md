# Executable PLAN template

Save as `.paul/phases/{NN}-{name}/{NN}-{PP}-PLAN.md`. Replace placeholders; omit optional empty sections. Typical size 3–6 KB, advisory. Resolve scope before writing; later changes use focused edits. State requirements once and reference their AC IDs in tasks/checks. Detailed examples: documentation/PLAN-guide.md (read only when needed).

```markdown
---
phase: NN-name
plan: PP
plan_type: execute
track: standard
wave: 1
depends_on: []
files_modified: []
autonomous: true
description: "Observable outcome"
type: Plan
about: "project-name"
---

<objective>
Goal, purpose, concrete output and connection to the current roadmap scope.
</objective>

<context>
Relevant source paths and selected prior decisions/artifacts with a one-line reason.
Project constraints and remaining phase scope; do not copy entire central documents.
</context>

<skills>
Required Claude Code skills and when to invoke them; or explicitly none after checking SPECIAL-FLOWS.
</skills>

<acceptance_criteria>
## AC-1: Observable behavior
Given [precondition], when [action], then [measurable outcome].
</acceptance_criteria>

<tasks>
<task type="auto">
  <name>Task 1: Concrete outcome</name>
  <files>Exact paths</files>
  <action>Implementation steps, constraints and error handling; fulfills AC-1.</action>
  <verify>Exact command or observable check and expected result.</verify>
  <done>Completion conditions.</done>
</task>
</tasks>

<boundaries>
Explicit allowed scope and exclusions; decisions requiring renewed approval.
</boundaries>

<verification>
Final AC coverage and regression checks, including project-specific freshness rules.
</verification>

<success_criteria>
All ACs evaluated; required skills used; decisions/deviations preserved; UNIFY pending after APPLY.
</success_criteria>
```

Tracks change detail, never safeguards. Supported task types: auto, checkpoint:decision, checkpoint:human-verify, checkpoint:human-action. Load checkpoints or TDD references only for applicable tasks.
