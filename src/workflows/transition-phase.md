<purpose>Close a phase only after explicit scope review; prepare the next phase without losing project knowledge.</purpose>

1. Run runtime `phase-status --phase N`. Every plan must have its matching reconciled summary. Inspect failures/waivers, unresolved issues and relevant summary evidence using history search. Review legacy summaries explicitly; do not infer pass from their presence.
2. Compare delivered behavior with every goal/deliverable in the current ROADMAP phase, including work never given a plan. Resolve remaining work and blockers before transition. A failure remains a blocker until corrected with verified evidence and its original failed summary reconciled through explicit review; never change it to pass merely to advance.
3. Evolve PROJECT.md where actual decisions change current constraints/requirements. Preserve standing rules and custom fields. Update ROADMAP completion/progress, STATE position/continuity and existing manifest phase/stats coherently using references/runtime-update.md. Supply substantive scope_evidence and reviewed legacy summary hashes. Do not equate reconciliation counts with scope completion.
4. Honor the project's commit/branch policy. Git operations require existing user authorization; if authorized inspect status, stage only reviewed paths, verify tests and resolve real conflicts before merge. Do not use diffstat as a conflict test. Keep unrelated changes intact.
5. Archive only confirmed consumed handoffs with their content intact. Preserve active/root handoffs. Route to the next planned phase or the existing complete-milestone workflow after its separate milestone checks. Report phase outcome and one next action.

## Extensions

<!-- Extension hooks may be appended here. -->
