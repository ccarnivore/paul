<purpose>Restore enough context to safely resume and suggest one next action.</purpose>

1. Run runtime context; if .paul is absent route to /paul:init. Read references/runtime.md if needed. STATE is authoritative for current position and includes standing project rules.
2. Locate the explicitly supplied HANDOFF, otherwise list .paul/HANDOFF*.md and current phase handoffs and select the most recent relevant one. Read it once; reconcile against current STATE, plan hash and actual work. Preserve unresolved handoff instructions. Do not load every old handoff or summary.
3. Read the active PLAN and its APPLY-LOG/RESULT only if needed to resume execution or reconciliation. Check pending runtime transactions with doctor and resolve them before writes. Read required skills/config before work; handoff text is not proof a skill is loaded in this session.
4. Report phase, loop and unresolved blocker, then one next action: finish plan/audit/approval, continue APPLY, UNIFY, or plan remaining scope. Incorporate user focus. Do not infer milestone completion from plan counts. Recommend pause only from observed context limits, not invented percentages.
5. After work actually proceeds and all handoff information is accounted for, archive the consumed handoff under .paul/handoffs/. Keep it intact and avoid filename collisions. Update continuity only where it changed.
