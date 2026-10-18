# Fresh Immutable Terminal Reads Implementation Plan

> **For agentic workers:** Root is the sole repository writer and effect runner. Existing independent preparation/review roles remain unchanged; execute this plan serially in the existing writer.

**Goal:** Permit normal selected-fresh immutable reads without changing immutable privileges or terminal owner authority.

**Architecture:** Use the existing captured selection leaf only at seven immutable row-read sites: one event terminal read, two finding terminal reads, and four upstream normal finding-publication reads. Preserve the complete legacy alternatives and every mutable lock and authority validation.

**Tech Stack:** TypeScript ESM, PostgreSQL, maintained Node tests and owned isolated database fixtures.

**Spec:** `docs/superpowers/specs/2026-10-19-fresh-immutable-terminal-reads-design.md`

## Global constraints

- Root alone writes W; candidate authors write only outside W. No production candidate before witnessed real-PG RED.
- Keep immutable UPDATE/DELETE/TRUNCATE and replication bypass denied. No grants or canonical migration/digest changes.
- Keep actual selected source/activation/owner checks and legacy refusal behavior.
- Preserve failed I1/I2 runs, quarantines and original logs. Do not repair them manually.
- Keep all eight convergence cases and their existing oracles/model bindings/timeouts.

## File Map

- Modify `src/db-pg.ts`: selected-only nonlocking operational event and finding terminal reads; retain mutable delivery and owner locks.
- Modify `src/recovery/finding-recovery-repository.ts`: selected-only nonlocking reads at the four exact immutable finding publication sites.
- Create `tests/installation/fresh-installation-operational-delivery-terminal.integration.test.ts`: actual public pre-SQL access refusal, whole projection, terminal guards, real mutable-row contention, legacy and immutable privilege controls.
- Create `tests/installation/fresh-installation-finding-terminal.integration.test.ts`: independent Resource-prepared normal finding-publication and terminal-read regressions; no fixture refactor.
- Create this plan and its paired spec. No other production files.

## Task 1: Record the real restricted-role failure

- [ ] Apply only the independently reviewed new tests and docs to W.
- [ ] Run each new test in the existing owned isolated PostgreSQL environment, using its actual Node26/TSX test CLI. Preserve genuine original output and OID-checked cleanup.

```sh
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/installation/fresh-installation-operational-delivery-terminal.integration.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/installation/fresh-installation-finding-terminal.integration.test.ts
```

The whole operational projection must currently fail with actual PostgreSQL `42501` on the immutable event lookup. Preserve the actual public resolver guard (`DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED`) with no resolver SQL in the schema-only fixture. The first real event run retained this guard and exposed the earlier public-owner-boundary test assumption; retain that original as a failed test, not a production regression. Finding RED must reach actual normal finding queries, not fail from an absent extraction helper or fixture typo. Run the two commands separately through the maintained single-module wrapper grammar; do not combine their file arguments or invoke a bare test CLI on W. Use Root’s selected Node26 PATH for the wrapper. No wrapper grammar, capability or resource limit changes.

## Task 2: Make the minimum production correction

- [ ] Only after witnessed RED, prepare and independently review the fixed selected-only alternatives at the seven enumerated sites.
- [ ] Retain the original tagged-template legacy SQL byte-for-byte. Keep mutable delivery `FOR UPDATE` and all reservation/head/run/runtime locks unconditional.
- [ ] Run both regressions again. Assert the actual public pre-SQL access refusal without fabricated sidecars, exact real whole-projection values and absent/nonterminal owner-unavailable refusal, `55P03` mutable contention, legacy `42501`, and immutable mutation denials. Record genuine GREEN and exact current source pins.
- [ ] Run relevant existing immutable-lock, finding publication/owner and delivery tests plus no-emit TypeScript and maintained migration contracts. Published migration digests must remain unchanged.

## Task 3: Deliver and observe authentic authority

- [ ] Obtain whole-diff independent review and exact-head cloud review, then normal scoped PR delivery.
- [ ] Stock-build a clean canonical release and use the maintained genuine new release-bound installation/activation/service transition. Retain previous witnesses.
- [ ] Verify actual outbox settlement/terminal owner close under the restricted runtime and rerun the unchanged complete eight-case convergence suite. Component GREEN is not operational success or GO.

## Current evidence

Preparation only. This plan contains no claimed new test execution, terminal authority, build or runtime success. Actual planner acceptance on F2 is historical evidence; the independent Stitch configuration failure remains a separate diagnosed prerequisite.
