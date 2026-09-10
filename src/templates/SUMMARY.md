# SUMMARY contract

UNIFY normally renders `{id}-SUMMARY.md` from validated RESULT.json via runtime close. Do not write a second manual summary. For legacy/manual reconciliation retain:

- Frontmatter: phase, plan, started, completed, duration, description, type: Summary, result: pass/fail/waived, plan_sha256.
- Concrete outcome and acceptance criteria results with actual evidence.
- Every task's status, concerns and approved waivers.
- Accomplishments and files created/modified/deleted.
- Verification commands/results and durable log paths.
- Decisions, deviations, unresolved issues, required skill audit.
- Next work; phase completion requires a separate roadmap scope review.

Use short factual entries and links instead of repeating the plan. Full raw evidence remains on disk. Detailed legacy examples: documentation/SUMMARY-guide.md, loaded only when needed. Absence of old frontmatter fields is not proof of failure or success; inspect legacy evidence.
