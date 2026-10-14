# Consumer test loader resolution

Root remains the sole writer on the existing branch. Continue the approved
product verification; do not alter production gateway/Medic behavior, install
packages, change live services or count the owner-closed PM diagnostic as passed.

The ordinary core test command uses `node --import tsx`. Two maintained consumer
fixtures reuse that bare specifier after moving their child CWD into a temporary
directory. The child cannot resolve the repository dependency; Medic also feeds
the bare specifier into createRequire before registering its cases. The original
1101-case run retains1074pass/18fail/9skip and exact errors in product-verification
logs. These are loader setup failures before the business assertions.

## File Map

- tests/helpers/gateway-api-safe-consumer.ts: resolve the installed repository
  loader from this module before launching the original child in its fixture.
- tests/medic-owned-child-consumer-v3.test.ts: use the same absolute installed
  loader for child import and dependency resolution.
- This plan: evidence-selected scope, verification and delivery limits.

## Work

- [x] Retain and classify the original failing core run.
- [x] Resolve tsx using createRequire(import.meta.url).resolve in both fixtures.
- [x] Run all five affected gateway/Medic files with the unchanged ordinary bare
  parent invocation; inspect original terminals and assertion counts.
- [x] Repeat the complete core package after the correction; retain skip reasons.
- [x] Read-only review the bounded fixture diff and actual test evidence.

Other pending inert bootstrap edits remain preserved and are outside this fixture
change. Do not claim all project verification, production rollout or pending
bootstrap behavior has completed.

## Completed ordinary validation

Five affected files:25pass/0fail/0skip, original process exit0. Complete core:
1108tests/1099pass/0fail/9existing environment skips, original exit0. Initial
Medic module setup failed before all eight cases registered; the runner counted
that module failure as one test. The fix restores seven additional aggregate
cases (1101 to1108); no assertion was removed. Full core raw113934B SHA5e08b0ca33ffe8db5801e11b8c17e671e0648dc0312723005648be0a6f56f7ed.
Read-only review71checks0 plus9full-core checks0, C0/I0/M0.

Independent product compiler1405pass/0fail/0skip, recovery4pass andevals53pass.
Mission Control380pass/0fail/12context skips and stockbuildexit0. No claim that
the isolated database cases or the complete project have passed. The sole
owner-closed PM2 diagnostic is unrun, not a passing test.

The five unfinished inert bootstrap source/test/docs paths are retained exactly
in logs/2026-10-14-pending-bootstrap-held-v1/receipt.json with bytes, SHA, modes,
tracked patch and original held files. Only the primary agent's two tracked
edits were restored to deliveredee87 bytes after custody checks; three owned
untracked files were moved to the held area. This parks the unfinished work
without declaring it complete or broadening the one-step owner disposition.
The current delivery includes only the two loader fixtures and this plan;
production source, entry guards, credentials, services and migrations unchanged.
