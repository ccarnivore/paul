# Reviewed lifecycle updates

Use `node "~/.claude/paul-framework/runtime/cli.js" update --input UPDATE.json` for section-level lifecycle changes. First inspect the affected sections and their hashes. Supply schema 1, a stable unique event_id, action (transition/milestone_create/milestone_complete/pause/resume/verify/roadmap), and edits:

```json
{"schema":1,"event_id":"phase-02-close-2026-01-01","action":"transition","phase":"02","scope_evidence":"Every roadmap deliverable checked against actual behavior; cite verification", "edits":[{"path":"ROADMAP.md","section":"Phase 2: Example","sha256":"whole-file hash","content":"Complete reviewed replacement for this section, retaining unrelated entries"}], "manifest_sha256":"hash of paul.toml", "manifest":{"phase":{"status":"complete"}}}
```

Allowed documents: STATE.md, PROJECT.md, ROADMAP.md, config.md, SPECIAL-FLOWS.md. Include all affected sections, STATE continuity and manifest changes in one input. Omit manifest fields if no paul.toml exists. Framework version, last activity, and the transition phase counter are synchronized automatically. The ledger is appended automatically; no manual duplicate entry. All edits to the same file use its original whole-file hash. Unsupported TOML syntax fails before changes; preserve it and reconcile explicitly.

Transition requires complete plan/summary pairing and semantic scope_evidence. Legacy summaries additionally need reviewed_summaries entries with path (relative to .paul), sha256, result (pass/waived), evidence. Failed results block transition. Missing plans or future roadmap work cannot be inferred from file counts. Other actions require Claude's corresponding workflow checks; the helper is not a milestone validator.

## Section safety (1.5.1)

`section` is the exact heading title without `#` markers. Existing heading levels 1-6 are resolved and retained. `content` is the replacement body only: never include the target heading itself. Missing or ambiguous titles fail; no new section is implicitly appended. Create/rename a section through a reviewed explicit edit instead.

The default `scope: "subtree"` replaces the selected body including nested sections and therefore requires retaining every existing child heading and its relevant content. To change only the introductory text before the first child heading, use `scope: "intro"`; all child sections remain unchanged. Edit a child separately by its exact title. Overlapping parent/subtree and child edits in the same operation are rejected; a parent intro plus a child edit is allowed. These checks protect structure, not the factual completeness of replacement prose.

After a lifecycle write, inspect headings of changed STATE/ROADMAP documents and any project-required typography checks. The runtime's generated separators use ASCII hyphens. Existing or supplied content is preserved verbatim; project rules must also be respected in input prose.
