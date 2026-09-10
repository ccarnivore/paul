# Optimization and validation

The analysis used the user's local Claude Code JSONL sessions for blisstribute and absencia and their `.paul` artifacts. No session contents or project source are included in this repository.

The 416 main sessions and 32 agent logs contained about 97.5% cache-read input tokens. PAUL is not responsible for every token in those sessions; cache reads, cache creation and output must be reported separately. In the analyzed 122 UNIFY segments, 2,095 of 2,916 tool calls touched PAUL files (71.8%). Repeated context loading, long generated documents and LLM-driven bookkeeping were the principal opportunities. Historical plans had median sizes about 41.5k/27.1k characters, summaries 18.3k/17.1k. The analysis did not establish a controlled before/after session cost.

## Implemented changes

Selective context and on-demand references; short executable templates with retained historical guides; compact PLAN/APPLY/UNIFY/audit/resume/progress/transition/milestone flows; deterministic evidence/summary/state handling; revision-specific approval, idempotence and recovery; upgrade/rollback with preservation of local customizations. Phase completion now requires explicit scope evidence. Project rules remain active, including fresh verification and manual commits.

## Reproducible static comparison

`npm run check:budget` compares direct framework input characters against the original checkout. The new measurement conservatively includes the runtime contract in each core stage, the result contract in both APPLY and UNIFY, and the SUMMARY contract in UNIFY. It excludes project/source content, tool output, optional checkpoint/TDD/audit branches and cache effects. It is a proxy for prompt size, not a tokenizer measurement or end-to-end savings claim.

| Stage | Before characters | After characters | Reduction |
|---|---:|---:|---:|
| PLAN | 29,399 | 7,160 | 75.6% |
| APPLY | 26,378 | 7,890 | 70.1% |
| UNIFY | 16,717 | 8,227 | 50.8% |
| Total | 72,494 | 23,277 | 67.9% |

## Validation

- 26 automated filesystem/runtime tests: installation, custom conflicts/extensions, rollback, corruption/path protection, full loop, exact-once counting, approval revisions, stale evidence, legacy summary reconciliation, retained custom rules, decimal phases, bounded context and interrupted transactions.
- Read-only compatibility scan: all 47 Blisstribute and 73 Absencia PLAN/FIX documents parsed successfully.
- Full upgrade and rollback on temporary copies of both actual installations and `.paul` trees: no conflicts; project contents unchanged by installation; managed installation file contents restored exactly by rollback. Local custom init/pause/handoff workflows and Absencia context-management reference were preserved. Original installations were not modified.
- Linked `.paul` roots are supported and tested; active-plan/state inconsistency in the Blisstribute snapshot is refused rather than silently reset.

Run `npm test` (Node >=18) and `npm run check:budget`. On Node versions supporting it, `node --test --test-isolation=none test/*.test.js` displays individual cases in environments that suppress subprocess output.

The helper and packaged installer are exercised locally; no live Claude Code end-to-end A/B run has been performed. To measure real savings, compare similar PLAN/APPLY/UNIFY cycles, count unique assistant message IDs, separate cache-read/cache-creation/input/output tokens, record task/AC coverage and verification quality, and avoid adding nested session totals twice. Do not apply the static percentage to the entire project's token bill.
