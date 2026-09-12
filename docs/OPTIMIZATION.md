# Optimization and validation

The analysis used the user's local Claude Code JSONL sessions for blisstribute and absencia and their `.paul` artifacts. No session contents or project source are included in this repository.

The 416 main sessions and 32 agent logs contained about 97.5% cache-read input tokens. PAUL is not responsible for every token in those sessions; cache reads, cache creation and output must be reported separately. In the analyzed 122 UNIFY segments, 2,095 of 2,916 tool calls touched PAUL files (71.8%). Repeated context loading, long generated documents and LLM-driven bookkeeping were the principal opportunities. Historical plans had median sizes about 41.5k/27.1k characters, summaries 18.3k/17.1k. The analysis did not establish a controlled before/after session cost.

## Implemented changes

Selective context and on-demand references; short executable templates with retained historical guides; compact PLAN/APPLY/UNIFY/audit/resume/progress/transition/milestone flows; deterministic evidence/summary/state handling; revision-specific approval, idempotence and recovery; upgrade/rollback with preservation of local customizations. Phase completion now requires explicit scope evidence. Project rules remain active, including fresh verification and manual commits.

## Reproducible static comparison

`npm run check:budget` compares direct framework input characters against the original checkout. The new measurement conservatively includes the runtime contract in each core stage, the result contract in both APPLY and UNIFY, and the SUMMARY contract in UNIFY. It excludes project/source content, tool output, optional checkpoint/TDD/audit branches and cache effects. It is a proxy for prompt size, not a tokenizer measurement or end-to-end savings claim.

| Stage | Before characters | After characters | Reduction |
|---|---:|---:|---:|
| PLAN | 29,399 | 8,398 | 71.4% |
| APPLY | 26,378 | 8,623 | 67.3% |
| UNIFY | 16,717 | 9,029 | 46.0% |
| Total | 72,494 | 26,050 | 64.1% |

## Validation

- 46 automated filesystem/runtime tests: installation, custom conflicts/extensions, rollback, corruption/path protection, full loop, exact-once counting, approval revisions, stale evidence, legacy summary reconciliation, retained custom rules, decimal phases, bounded context and interrupted transactions.
- Read-only compatibility scan: all 49 Blisstribute and 73 Absencia PLAN/FIX documents parsed successfully.
- Full upgrade and rollback on temporary copies of both actual installations and `.paul` trees: no conflicts; project contents unchanged by installation; managed installation file contents restored exactly by rollback. Local custom init/pause/handoff workflows and Absencia context-management reference were preserved. Original installations were not modified during that initial validation.
- Linked `.paul` roots are supported and tested; active-plan/state inconsistency in the Blisstribute snapshot is refused rather than silently reset.

Run `npm test` (Node >=18) and `npm run check:budget`. On Node versions supporting it, `node --test --test-isolation=none test/*.test.js` displays individual cases in environments that suppress subprocess output.

The helper and packaged installer are exercised locally; no live Claude Code end-to-end A/B run has been performed. To measure real savings, compare similar PLAN/APPLY/UNIFY cycles, count unique assistant message IDs, separate cache-read/cache-creation/input/output tokens, record task/AC coverage and verification quality, and avoid adding nested session totals twice. Do not apply the static percentage to the entire project's token bill.

## Live-session finding and correction (1.5.1)

A real UNIFY exposed a structural write defect not covered by the initial tests. The update helper accepted a replacement body containing its own heading, recognized only level-2 targets, and did not protect nested sections from omission. History confirmed duplicated headings and lost nested roadmap sections. The correction resolves heading levels, rejects missing/ambiguous targets, rejects repeated parent/sibling headings and overlapping edits, and guards against removal of existing child headings. An intro-only mode preserves nested content. Ten additional regression cases cover these paths, fenced heading examples and generated U+2014 characters. Structural protection does not establish semantic completeness of user/LLM-supplied prose.

## PLAN-session output regression (1.6.0)

The 10 September Blisstribute PLAN session grew from 42,296 to 134,769 main-input tokens. The largest early step (+10,921) followed reading a newly generated SUMMARY; writing two complete PLAN drafts added steps of +8,796 and +6,737. Those deltas include model output and tool overhead, not isolated file token counts. Old milestone archives were not read. A separate advisor iteration used 93,589 input and 6,249 output tokens; summed multi-iteration usage is not a context-window measurement.

The renderer now keeps outcome once and references full evidence. In a read-only replay of that plan's RESULT, SUMMARY size falls from 19,880 to 6,769 UTF-8 bytes (66.0%), preserving complete decisions/deviations/issues and keeping all evidence in RESULT. The first handoff page is approximately 4.5 KB with explicit continuation; it is a partial view, not a replacement for applicable full evidence. The four-word history query now ranks the actual predecessor first instead of returning no results. Existing SUMMARYs are not rewritten; new selective readers work immediately on them.

The planning contract now batches discovery, tracks answered questions, scopes before the initial write and requests targeted edits for audit/size corrections. Read-only plan-check reports a soft limit without echoing the whole PLAN. These extra instructions modestly increase static workflow size to prevent larger repeated outputs. Ten retrieval/summary regression cases cover exact paginated evidence, late limitations, actual waivers, ranked multiword search, large single-line records, legacy headings, changed SUMMARYs and read-only behavior. End-to-end Claude session savings still require a new comparable session.
