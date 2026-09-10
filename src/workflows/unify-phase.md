<purpose>Reconcile approved intent with observed results and close the loop exactly once.</purpose>

1. Read references/runtime.md if needed. Run `context --plan ID` and `evidence --plan ID`. Read the selected PLAN and RESULT, including decisions, deviations, issues and skills. Reuse unchanged session context; do not reread all central documents or historical summaries.
2. Compare every task and AC to actual behavior and verification. Check coverage, project boundaries, required skill use and authorization for waivers. File fingerprints alone do not prove correctness. Reuse evidence only when still valid and project rules permit; run fresh checks when required. Correct incomplete evidence via apply-complete before closing. Never manufacture a pass.
3. For legacy APPLY or an existing SUMMARY without a close receipt, follow references/runtime-result.md's legacy path. Existing SUMMARY does not skip reconciliation. Preserve prior content and review counters before replacement. If evidence or current state is ambiguous, resolve the ambiguity instead of counting a second completion.
4. Run `close --plan ID` (legacy reviewed SUMMARY: add --input REVIEW.json). The helper renders the summary and updates STATE, existing manifest, ledger and receipts transactionally. Inspect its result; do not manually duplicate these writes. Failed work remains documented and routes to corrective planning. A repeated close is idempotent.
5. Carry newly relevant constraints/decisions and unresolved blockers into appropriate active project sections using targeted edits (runtime-update.md if transactional updates are useful). Retain existing standing rules. Review current phase's explicit ROADMAP scope. Matching PLAN/SUMMARY counts are necessary evidence of reconciliation, never proof of phase completion. If all scope is actually delivered and verified, follow transition-phase.md; otherwise identify remaining work.
6. Report concrete result, material deviations and checks, summary path and exactly one next action. UNIFY remains mandatory on every track.

## Extensions

<!-- Extension hooks may be appended here. -->
