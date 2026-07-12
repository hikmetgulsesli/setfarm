# Product Compiler Contract/Revision Spine — Delivery Evidence

Date: 2026-07-12

Branch: `feat/product-compiler-contract-revision-spine`

Code verification HEAD: `9d63803a297455913f0156c802083b7e290c1e61`

Base: `5840ae3` (`origin/main`)

## Decision

**GO for Phase 1 review/merge; NO-GO for live activation.**

Phase 1 provides the dormant contract and execution spine: strict versioned
artifacts, exact design linkage, packet/slice compilation, revision-fenced
attempt storage, legacy-default shadow hooks, and deterministic offline replay.
It does not authorize `SETFARM_PROTOCOL=shadow` or `v3` in production.

Live activation remains blocked until a separate operator decision covers the
PostgreSQL migration, capacity, deployment/rollback rehearsal, a bounded shadow
observation window, Mission Control projection, and clean-run evals for at
least three materially different product classes.

## Commit Record

1. `487283a docs(compiler): define contract revision spine`
2. `0ebfa20 docs(compiler): plan contract revision spine`
3. `0bf3139 docs(compiler): sequence test entry points`
4. `05b9455 feat(compiler): establish protocol and schema core`
5. `1c629c7 feat(compiler): add canonical artifact store`
6. `70ec3ac feat(compiler): define versioned product contracts`
7. `61852d5 feat(compiler): capture legacy replay sources`
8. `4df8ee5 feat(compiler): add provenance-aware adapters`
9. `a292ddf feat(stitch): preserve semantic action bindings`
10. `17ce748 feat(compiler): compile sealed product packets`
11. `d245510 feat(execution): add revision-fenced attempt ledger`
12. `aa4ca66 feat(execution): observe legacy attempts in shadow mode`
13. `418b2d6 test(evals): add product contract replay suite`
14. `6a78ec8 test(execution): expose isolated db teardown`
15. `9d63803 test(cli): isolate packaged ant integration`

The branch was not pushed by this implementation session.

## Verification Record

All commands below ran without runtime/build bypass environment variables.

| Command | Result |
|---|---|
| `npm run test:product-compiler` | PASS, 87/87 |
| `npm run test:execution-attempts` | PASS, 22/22 |
| `npm run test:scripts` | PASS, 8/8 |
| `npm run eval:contracts` | PASS, 6/6 fixtures |
| replay command twice with byte diff | PASS, no output difference |
| `npm test` | PASS: 759 + 361 + 8 + 87 + 22 = 1,237 tests |
| `npm ci --dry-run --no-audit --no-fund` | PASS |
| clean isolated clone, final code HEAD on local `main`, `npm ci`, `npm run build` | PASS |

The in-place build was intentionally rejected because the production build
guard requires branch `main`. No `SETFARM_ALLOW_DIRTY_BUILD` or
`SETFARM_SKIP_RUNTIME_GUARD` override was used. The same code HEAD was cloned
to an isolated temporary repository, checked out as clean local `main`, and
built successfully with:

```json
{
  "sha": "9d63803a297455913f0156c802083b7e290c1e61",
  "branch": "main",
  "dirty": false,
  "displayVersion": "2.3.79+9d63803a"
}
```

The temporary clone was removed by a fail-fast shell trap after verification.

## PostgreSQL Isolation Evidence

The final full run created and dropped only these generated databases:

- `setfarm_contract_spine_test_79591_32de7e1e6bc6`
- `setfarm_contract_spine_test_79592_5c5048d5b1df`

Both emitted explicit `created` and `dropped` lines. A separate administrative
read after the suite returned `leftoverTestDatabases: []`. The harness refuses
database names outside `^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$`.
No DDL was run against the operational `setfarm` database.

## Final Replay Hashes

Report hash at the code verification HEAD:

```text
1ca6bc60116580d184035f89019d9ce92b7db5f78345c5cf52c300428702456d
```

| Fixture | Source aggregate | Compilation artifact | Result |
|---|---|---|---|
| `1887-action-state` | `68a42a863b7f9fa0d738828dbcb40044a5cd70586fb1b33d9b1528fd98a3f03f` | `23112121969447f2831db090ebfbb5b5ea55d3911749b7ed6f2604daa7083184` | rejected, duplicate tuple |
| `1893-persistence` | `beb3828ef839816ded75925e80ea78b3b197b6c9289402011ce1e7046bf88979` | `a6409ce24ed353fd882008c65c34b46988b1b89a60ba3a98ceb2bd430c6ec99a` | rejected, duplicate tuple |
| `1894-branch-continuity` | `53a7c688df3267f6c260dce40659c487c9d1c093720c829fc96a5d6f5d150773` | `6d12fe06a92bdccc8c01091ee30adfb75c3a1a5606ca2cad0b255b326f707f92` | source revision changed |
| `1925-task-chip` | `6c901f8625a010d6f03a7f577ace7e11ef3c7f313e4a2058bf18a8ba110a5cac` | `2a8d97bff60a90a3eb5a8586820f67afe243195007298133a3b037a2791e7458` | exact save binding retained; packet rejected |
| `847-required-evidence` | `3876c6e421e7413dd788ff31ab03c9f0b90fbe838bd98d9bb3955cf97d8986fd` | `760bbff0528c8acd81fcfaa6d151d12d1386f275d9569759014ee8bfca354dc1` | required child failure retained |
| `vibe-control-id` | `dba4e158455ad21ad8347193ddeadcd78af41069dc6d905c3061b754096876c0` | `bfbcb5f56a22b0ca965f9034ca02f675762e835c8c294e15d4668167f94a3c82` | unspecified design identity retained |

The Vibe fixture corrects an earlier audit interpretation: pre-fix JavaScript
and HTML both used `menu-btn`. The proven contract failure is that Stitch
provided no stable design control ID; the later `main-menu-btn` change is
post-completion churn, not evidence of a pre-fix DOM mismatch.

## Static Boundary Results

- No historical run/project identifier appears in generic `src/` or `scripts/`
  implementation code.
- Product compiler core imports no PostgreSQL, GitHub, OpenClaw, supervisor,
  spawner, or PR-comment classifier module.
- `src/spawner.ts`, `src/spawner-prompt.ts`, and
  `src/installer/steps/07-verify/pr-comments.ts` have no branch diff.
- Artifact-store PID/UUID values name temporary operational files only; they do
  not enter semantic envelopes or content hashes.
- `runId` in the legacy source snapshot is request/observation metadata and is
  excluded from the stored semantic snapshot.
- Fixture secret/path scan found no credentials, private transcripts, absolute
  user paths, or mutable runtime paths. The only secret-like strings are the
  test regexes that enforce this rule.
- `execution_attempts` has no foreign key or cascade to `runs`; partial unique
  indexes enforce one active fence and exact non-null dedupe identity.
- Heartbeat and completion compare `attempt_id + generation + fence_token` and
  return `stale_fence` when no exact active row is updated.
- Shadow results are logged/recorded but never branch legacy workflow status,
  retry, merge, supervision, or completion decisions.
- With protocol unset/legacy, tests prove no artifact directory, repository
  construction, or attempt call occurs.

## Known Limitations and Next Authorization Boundary

1. `v3` remains fail-closed as `PROTOCOL_NOT_IMPLEMENTED`; legacy remains the
   default. Shadow code exists but was not deployed or enabled.
2. Current legacy claims do not possess sealed v3 packets. Shadow mode would
   therefore record a canonical rejected legacy compilation report and a
   non-dedupable observation until upstream producers emit complete artifacts.
3. Mission Control canonical packet/attempt/finding/evidence projection is not
   part of Phase 1; current MC behavior was not changed.
4. Offline historical replay covers six cases across two product classes
   (`utility`, `game`). It is regression evidence, not the required release
   proof of three clean end-to-end product classes.
5. Supervisor bounded recovery ownership and v3 enforcement require a later
   phase after canonical finding/evidence production exists.
6. A live migration review must assess table/index creation time, storage,
   retention, and rollback before shadow activation.

## Mutation Statement

This implementation started no Setfarm run, rescued no generated project,
restarted/deployed no service, migrated or manually edited no operational DB,
changed no PR state/comment/thread, and changed no Mission Control source. All
PostgreSQL writes were confined to uniquely named disposable test databases;
all historical GitHub/PostgreSQL/generated-repo acquisition was read-only.
