# Runtime and compatibility

PAUL remains a Claude Code Markdown command framework. The JavaScript helper performs deterministic filesystem operations through Claude Code's Bash tool; it neither calls an LLM nor replaces the Claude agent. It installs at `<claude-config>/paul-framework/runtime/cli.js`.

Core context is selected progressively. STATE is emitted in full, PROJECT constraints/decisions plus a section inventory are emitted, and relevant roadmap/research/source/history content is read as needed. A soft character budget reports oversized context without deleting or truncating rules. Phase reports have explicitly marked bounded historical excerpts; Claude must open relevant/truncated sections before relying on them. Unknown headings cannot be assumed irrelevant.

Typical commands from the project root:

```bash
node .claude/paul-framework/runtime/cli.js context --plan 01-01
node .claude/paul-framework/runtime/cli.js history --query authentication --limit 5
node .claude/paul-framework/runtime/cli.js handoff --plan 01-01
node .claude/paul-framework/runtime/cli.js result-section --plan 01-01 --field acceptance --item AC-1
node .claude/paul-framework/runtime/cli.js plan-check --plan 01-01
node .claude/paul-framework/runtime/cli.js phase-report --phase 01
node .claude/paul-framework/runtime/cli.js doctor
```

For a global installation use its absolute path or `node "$HOME/.claude/paul-framework/runtime/cli.js" ...`. All commands accept `--project DIR`; JSON input paths are relative to the shell's working directory. See `help` for the full interface and the installed `references/runtime*.md` contracts for schemas.

## Loop responsibilities

- PLAN: Claude investigates and writes a bounded plan. `plan-ready` registers its exact revision and synchronizes state/manifest/ledger.
- APPLY: Claude invokes required skills, executes tasks/checkpoints, verifies behavior and records progress in APPLY-LOG. `approve` records actual user approval for the plan hash; `apply-complete` validates evidence structure and stores RESULT with file fingerprints.
- UNIFY: Claude reconciles evidence against every AC and task, including project-required fresh tests. `close` renders SUMMARY and updates state/manifest/ledger once. A failed result stays failed. Phase completion requires a separate semantic review of roadmap scope.

A helper cannot prove a test ran, a waiver was authorized, or an omitted file is irrelevant. Claude must supply truthful evidence. Fingerprints cover declared files, not dependencies/environment/all repository files. Reverification can refresh a result before close; the former result remains archived. Required skills, boundaries, checkpoints and mandatory UNIFY apply to quickfix too. Git/release operations follow existing user authorization and project policies.

## Existing projects

No bulk migration is needed. Legacy Markdown remains readable. An absent paul.toml is not fabricated; legacy paul.json is reported by doctor and remains unchanged. If that legacy manifest is still actively used, reconcile it explicitly using the existing migration/manifest workflow before relying on manifest-based tools. Unsupported or ambiguous document syntax fails before a runtime transaction; inspect and adapt the relevant fields instead of rebuilding documents from memory.

Existing SUMMARY does not prove UNIFY happened. For a legacy applied loop, Claude reconstructs actual evidence and reviews whether counters already include that plan. A reviewed existing summary can be reconciled using `close --input REVIEW.json`; the original is archived and `already_counted` prevents a second increment. Do not guess the value. The active Blisstribute snapshot had a PLAN marker despite an existing SUMMARY; this inconsistency is deliberately not auto-resolved by installation.

Known STATE scalar fields and loop markers are updated; custom text and other sections remain active. Before/after content is retained under `.paul/runtime/history/`. This version does not automatically prune long active documents or delete old evidence: such compression needs a separate semantic review to avoid losing constraints.

## Interruption and concurrency

Transactions check source revisions and use an exclusive lock. A journal contains all before/after values and is written before document changes. On interruption, inspect `doctor`, the journal and lock process, then run `recover --mode finish` or `recover --mode rollback`. Recovery refuses content modified by another writer. Each successful transition has a lossless history file. No daemon or background process runs.

Do not manually duplicate runtime state/ledger writes. Reusing the same operation is idempotent; modifying an already reconciled plan/summary requires review. A phase transition is counted once per phase number; later corrections use reviewed roadmap updates. Existing specialized workflows remain available and use their documented manual paths where not integrated with the runtime. They must respect the same project rules and must not replay completed core transitions.

Detailed original templates/workflows are installed under `documentation/` as historical examples. Current workflow instructions take precedence. Optional CARL integration is not installed automatically; its source command path was corrected to `.claude/commands/paul/`.

## Bounded handoffs and compact SUMMARYs (1.6.0)

Future SUMMARYs store the outcome once and preserve complete decisions, deviations, issues and explicit waivers. Detailed AC/task evidence, file changes, verification and skills remain in the original RESULT, accessible by `result-section`. Nothing is deleted from RESULT. Status labels alone do not establish verification; record missing proof in issues as well as the affected AC evidence.

`handoff` works on existing long documents without rewriting them or changing receipt hashes. It previews a matching RESULT; unmatched or independently changed SUMMARY content is also surfaced, including unknown/German headings and pre-heading text. Source hashes and truncation/pagination are explicit. `history` searches individual words across both SUMMARY and RESULT, ranks coverage and limits serialized output. Limits are output characters (not tokens); `--offset` is an entry offset for history/handoff and a character offset for result-section/bounded section. Native `section` without paging options still returns complete required rules.

`plan-check` is read-only and reports syntax, UTF-8 size and a soft 6 KB target. The planning workflow resolves scope before writing, batches related discovery, and applies targeted corrections instead of printing successive full PLAN drafts. Size never overrides requirements, required skills or fresh verification.
