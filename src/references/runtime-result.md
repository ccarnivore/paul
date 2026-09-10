# APPLY result (schema 1)

Write JSON beside the plan as `{id}-EVIDENCE.json`, then pass it to `apply-complete --plan ID --input PATH`. The helper stores `{id}-RESULT.json` with file fingerprints. Use real measured results, not predictions. One entry for every acceptance criterion and task (task IDs are task-1, task-2, … from context):

```json
{
  "schema": 1,
  "plan_sha256": "hash from context",
  "started": "2026-01-01T10:00:00Z",
  "completed": "2026-01-01T10:05:00Z",
  "outcome": "Concrete behavior delivered, including limitations",
  "acceptance": [{"id":"AC-1","status":"pass","evidence":"Command/check, observed result and durable log path"}],
  "tasks": [{"id":"task-1","status":"DONE","evidence":"Implemented and verified behavior"}],
  "files": [{"path":"src/example.js","change":"What changed"}],
  "verification": ["Exact command, working directory, timestamp, exit status, measured counts and log path"],
  "decisions": [], "deviations": [], "issues": [], "skills": []
}
```

Acceptance status: pass/fail/waived. Task status: DONE/DONE_WITH_CONCERNS/BLOCKED/SKIPPED. Waived and SKIPPED require `user_approval` with the actual waiver. Record concerns and unresolved issues; blocked work is not success. Include every changed source/config/test file in files, including deletions. Keep large logs on disk, cite paths and relevant failure excerpts. Preserve project-specific verification requirements. Empty arrays explicitly mean none; do not omit relevant decisions or skills.

Before UNIFY, `evidence` compares declared files only. It cannot detect stale environments, external dependencies or omitted files. Re-run checks when evidence is stale or project rules require it. Refresh the EVIDENCE input and run apply-complete again; prior results are archived. After close, additional work requires a new plan.

Legacy APPLY: reconstruct evidence from the selected plan, APPLY-LOG, relevant diff and actual verification. Existing SUMMARY is not proof of completed UNIFY. Record the actual approval (or obtain it if absent), then apply-complete. For an existing SUMMARY, review whether counters already include it and pass close `--input REVIEW.json` containing `summary_sha256`, substantive `evidence`, and boolean `already_counted`. The original summary is preserved in transaction history. Do not guess counters or claim old tests were rerun.
