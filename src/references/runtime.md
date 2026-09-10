# Claude Code runtime contract

Invoke through Claude Code's Bash tool, from the project root:
`node "~/.claude/paul-framework/runtime/cli.js" COMMAND [options]`
The installer substitutes the actual Claude configuration path. `--project DIR` selects another project. No dependencies beyond Node >=16.7; no separate agent or service.

Read-only: `context [--plan ID] [--phase N]`, `section --file PROJECT.md --heading Constraints`, `history --query TEXT --limit 5`, `phase-status --phase N`, `evidence --plan ID`, `doctor`. Output is JSON. Context includes complete STATE, required PROJECT sections, section inventory and revision hashes; its size budget is soft and never truncates rules. Open relevant omitted sections, phase scope and source files. Reuse already-read unchanged content within this session. Never load every historical summary by default.

Writes: `plan-ready --plan ID`; `approve --plan ID --signal "actual user instruction"`; `apply-complete --plan ID --input path.json`; `close --plan ID`. These synchronize STATE, existing paul.toml, ledger and receipts. Do not repeat those writes manually. Approval applies to one exact plan hash. A user instruction to execute the presented plan is sufficient; never invent an approval or ask again for an already approved unchanged plan. Helpers validate structure, not truth: Claude remains responsible for scope, skills, evidence and authorization.

All writes have revision checks, a lock and lossless before/after history under `.paul/runtime/history/`. Repeated identical operations do not count a plan twice. STATE remains current-state authority; sidecars are evidence/receipts. No automatic phase completion. On error, inspect the message and `doctor`; do not bypass a pending transaction. `recover --mode finish|rollback` handles an interrupted write after inspecting the journal. Remove a stale lock only after checking its recorded process has stopped. Unknown/ambiguous legacy syntax requires targeted manual reconciliation with backups, never wholesale reconstruction of project documents.

For reviewed lifecycle changes, read `references/runtime-update.md` only when needed. For APPLY evidence, read `references/runtime-result.md`. Project rules take precedence: fresh tests, commit policy, skill requirements and boundaries are never relaxed to meet a token budget.
