# Spawner pending claim ownership plan

Goal: prevent orphan recovery from invalidating a still-owned compiler preClaim invocation without weakening real orphan recovery or downstream authority validation.
Spec: docs/superpowers/specs/2026-10-20-spawner-inflight-claim-ownership-design.md.
Execution: subagent-driven-development with fresh non-delivery builder, genuine RED/GREEN, independent task and whole-branch review. Root performs all Git delivery, stock clean build and any admitted runtime work.

## File Map

| File | Responsibility |
| --- | --- |
| src/spawner.ts | Exact private pending invocation ownership, lifetime cleanup, candidate durable runtime projection and exact skip before orphan mutation |
| tests/spawner-inflight-claim-ownership.test.ts (new) | Genuine production function AST extraction and inert deferred ownership/race regressions; no live module entry/DB/process/provider/native/browser |
| tests/installation/fresh-installation-spawner-retention.test.ts | Existing affected genuine source components; modify only if the new exact invocation resource needs an inert fixture port |
| tests/spawner-gateway-recovery.test.ts | Existing affected source/contract regression; no weakening assertions or native effects |

## Constraints

- Sole writer .worktrees/setfarm-dashboard-cutover-controller-20261007-v1 branchfix/spawner-inflight-claim-ownership-20261020 based main5a9fbe74aea8d5a6390324a6918d0ae0d5618cf8. Root fetched only writer, not immutable live release.
- No other product files/schema/guards/credentials/runtime/test limits. No production code before meaningful RED. Keep pending invocation matching exact; no claimingSpawns role shortcut or ad-hoc identifier parsing.
- Inert tests may read bounded genuine Source and use actual function bodies/transpileModule with injected synthetic ports as existing retention harness. No actual spawner import/entry, live URLs, DB, process spawning/signals, providers, native/browser or blanket test/scripts. Root reviews exact focused commands before use if unsure.
- Preserve all original/new evidence and dirty files. No staging/commit/push/build/delivery by builder. Root stock build must run from a clean nonlive source context, never in immutable selected live release.

## Shared interfaces and consistency

| Boundary | Contract |
| --- | --- |
| Pending claim invocation -> runtime intent | Session ID, owner instance, full claim agent, runtime agent must identify the same invocation before durable publication |
| Maintenance SQL -> exact pending matcher | Join durable runtime by candidate claim/run/step and claim-agent identity; missing/mismatched runtime means no skip |
| Invocation -> active/draining/completion ownership | Keep record through postclaim publication or transfer; cleanup on every exit without deleting a later record |
| Tests -> real code | Run whole genuine maintenance and relevant spawning lifetime logic with inert ports; no duplicated reimplementation or regex-only proof |

### Task1: Exact pending claim ownership

1. Add meaningful deferred genuine-source regression(s) first. Run focused inert command and retain natural RED output before product edits.
2. Apply smallest spawner ownership/lifetime change. Preserve authority guard equality and original diagnostic behavior for true orphan recovery.
3. Run same focused command GREEN plus affected existing inert retention/source checks. Retain raw output, child exits, complete diff and Source pins. Do not sum nested TAP tests or claim live acceptance.
4. Freeze complete diff and report limitations for independent task review; follow scoped fix rounds if needed. Root whole-branch review and required clean stock build remain distinct delivery gates.
5. After actual full8 settles and current owners/receipts/source guards are reconciled, Root separately admits reviewed rollout and new clean real evaluation. Existing failed cases remain failures.

Ruling: fix the false-orphan producer first. Generic retry diagnostic masking is separately recorded, not a reason to exempt compiler output, invent retry input or broaden this minimal fix. If a different causal defect appears, Root updates spec/FileMap before Source edits.
