# Current-Entry Prerequisite Overlay Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make exact-poison current-entry recovery accept the exact settled records produced by the current public audit and pending-bootstrap observers, preserve the frozen legacy poison evidence byte-for-byte, and let Task6A Step 1 converge before any migration or service mutation.

**Architecture:** Keep the frozen exact-poison inventory and operation immutable. Refactor the two current-entry observers around private no-write builders, derive a closed two-record expected overlay from those builders, authenticate that overlay under the already-held recovery authority, and thread the admitted current prerequisite pairs through every recovery/replay fence and successor projection. The overlay is an authenticated view of settled current records, not a new migration schema or a mutable “latest” lookup.

**Spec:** `docs/superpowers/specs/2026-09-08-current-entry-prerequisite-overlay-recovery-design.md`

**Primary files:**

- Modify: `src/internal-production/baseline-post-handoff-receipt-v1.ts`
- Modify: `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`
- Modify: `docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md`
- Verify/update only if the authoritative path inventory changes: `tests/internal-production/task-0-source-manifest.test.ts`
- Verify/update only if the P3 tracked scope changes: `scripts/run-isolated-postgres-tests.ts`

**Non-goals:**

- Do not delete, rename, overwrite, or reinterpret the frozen `e2`/`ce` legacy records.
- Do not add a database migration, CLI flag, environment variable, Mission Control change, or new durable schema.
- Do not permit arbitrary caller-supplied paths or bodies.
- Do not call the public publishing observers from the recovery prehook.
- Do not weaken no-follow, mode, UID, device, link-count, exact-inventory, zero-effect, or replay fences.

## Task 1: Freeze the current failure and extract private no-write prerequisite builders

**Files:**

- Modify: `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`
- Modify: `src/internal-production/baseline-post-handoff-receipt-v1.ts`

- [ ] **Step 1: Add the failing builder/publication boundary test**

  Add an exact test titled:

  ```text
  P4c current prerequisite builders remain no-write until public publication
  ```

  The test must execute copied production code with instrumented publication seams and prove all of the following:

  - the audit builder returns the exact audit value, canonical bytes, and `{ref,hash}` pair without publishing;
  - the pending-bootstrap builder returns the exact projection, canonical bytes, and `{ref,hash}` pair without publishing;
  - the existing public observer publishes exactly once and returns the same value and pair produced by its builder;
  - the builder does not enumerate a “latest” directory, mutate the store, call a public observer, or repair a missing record;
  - the recovery source region contains no call to either public observer.

- [ ] **Step 2: Run the exact RED test**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    --test-name-pattern='^P4c current prerequisite builders remain no-write until public publication$' \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

  Require failure because the private no-write builders do not yet exist. A fixture or source-anchor failure is not the intended RED; repair the test harness until it fails on the missing production boundary.

- [ ] **Step 3: Introduce one private immutable prerequisite-record shape**

  In `baseline-post-handoff-receipt-v1.ts`, add a private readonly type that carries exactly:

  ```ts
  {
    value: TValue;
    bytes: Buffer;
    pair: { ref: string; hash: string };
  }
  ```

  Use the repository’s existing exact pair types where possible. Keep the type and builders private to this module.

- [ ] **Step 4: Split each public observer into builder plus unchanged publisher wrapper**

  Refactor these exports:

  - `observeCurrentInternalProductionAuthorityV3Migration31AuditV1`
  - `observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1`

  Add private builders with explicit no-write names, for example:

  - `buildCurrentInternalProductionAuthorityV3Migration31AuditNoWriteV1`
  - `buildCurrentInternalProductionPendingBootstrapHandoffMigrationNoWriteV1`

  Each builder must derive its body from `SelectedCurrentEntryStoreContextV1`, canonicalize once, hash those exact bytes, and return the value/bytes/pair. Each public wrapper must call the corresponding builder and then use the existing exact publication path. Preserve public return values and on-disk bytes.

- [ ] **Step 5: Run the focused GREEN test and adjacent public-observer tests**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    --test-name-pattern='^(P4c current prerequisite builders remain no-write until public publication|.*current.*authority-v3.*audit.*|.*pending.*bootstrap.*handoff.*)$' \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

  If the broad adjacent regex selects no relevant test, replace it with the exact existing test titles obtained from `node --test --test-only` output; do not accept a skipped or zero-test pass.

- [ ] **Step 6: Review the diff for accidental public surface or byte drift**

  ```bash
  git diff -- src/internal-production/baseline-post-handoff-receipt-v1.ts \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  git diff --check
  ```

  Confirm no new export, no second canonicalization, and no public-observer call from an exact-poison recovery function.

- [ ] **Step 7: Commit Task 1**

  ```bash
  git add src/internal-production/baseline-post-handoff-receipt-v1.ts \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  git commit -m "refactor(current-entry): expose no-write records"
  ```

## Task 2: Admit a closed, exact current-prerequisite overlay

**Files:**

- Modify: `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`
- Modify: `src/internal-production/baseline-post-handoff-receipt-v1.ts`

- [ ] **Step 1: Add the settled-prefix RED matrix**

  Add an exact test titled:

  ```text
  P4c exact-poison inventory admits every settled current prerequisite overlay prefix
  ```

  Build from `seedExactOriginalPoisonStoreV1`. Derive the audit and pending candidates through copied private builders, then cover exactly these states:

  1. neither current record present;
  2. audit only present;
  3. pending only present;
  4. both present.

  For every row assert:

  - the original exact inventory body/hash and original 10-directory/5-file identities are unchanged;
  - a present overlay record is exact canonical bytes, mode `0600`, same UID/device, and `nlink === 1`;
  - an absent overlay record is proven absent through a stable authenticated parent;
  - admission returns the same expected overlay paths/bytes/pairs and a stability assertion;
  - no publication, database, owner, service, migration, or cleanup mutation occurs.

- [ ] **Step 2: Add the crossed-overlay RED matrix**

  Add an exact test titled:

  ```text
  P4c exact-poison inventory rejects crossed current prerequisite overlays
  ```

  Include at least:

  - wrong path or hash shard;
  - wrong bytes with the expected basename;
  - third-generation or unknown sibling;
  - exact temp sibling or partial empty shard;
  - symlink leaf;
  - hard-linked leaf;
  - wrong file mode;
  - wrong directory mode;
  - simulated UID/device crossing through copied-stat seams;
  - overlay presence changing between the first and final stability fences.

  Assert fail-closed before successor publication or any migration/service mutation, and assert all external victims remain byte-identical.

- [ ] **Step 3: Run both RED tests**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    --test-name-pattern='^P4c exact-poison inventory (admits every settled current prerequisite overlay prefix|rejects crossed current prerequisite overlays)$' \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

- [ ] **Step 4: Add a private expected-overlay descriptor**

  Derive exactly two candidates from the no-write builders:

  - current authority-v3 migration31 audit content;
  - current pending bootstrap handoff content.

  Each descriptor must be constructed internally from exact bytes and pair, derive its deterministic content path through the existing content-store locator rules, and carry no caller-selected path. Freeze the collection and reject duplicate target/hash identities.

- [ ] **Step 5: Activate `expectedPublished` in `observeExactPoisonQuarantinedInventoryV1`**

  Replace `void expectedPublished` with a closed overlay observation:

  - keep `EXACT_POISON_ORIGINAL_DIRECTORY_LOCATORS_V1`, original file snapshots, frozen inventory body, and frozen inventory hash unchanged;
  - inspect only the two internally derived overlay targets;
  - for each candidate accept only stable absence or one exact settled final file;
  - if a candidate’s hash shard is shared, authenticate the complete local member set and allow only the frozen members plus exact settled overlay members;
  - if a new shard exists, require exact `0700`, same UID/device, and exactly the expected settled member set;
  - never accept temp files, incomplete directories, arbitrary extra members, or “latest” scans;
  - retain pinned physical identities or stable absence observations until admission closes;
  - extend the admission stability function so both the frozen original topology and overlay presence remain stable.

  Keep the overlay outside the frozen poison inventory serialization and hash.

- [ ] **Step 6: Return the admitted overlay with the inventory evidence**

  Extend the private admission/inventory shape so later recovery code receives the exact admitted current records and stability fence without re-deriving paths from ambient filesystem state. Do not export this capability.

- [ ] **Step 7: Run GREEN plus existing poison-inventory hostile tests**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    --test-name-pattern='^(P4c exact-poison inventory (admits every settled current prerequisite overlay prefix|rejects crossed current prerequisite overlays)|P4 exact-poison publisher authenticates its deterministic admission fixture|P4a exact-poison recovery leaf.*)$' \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

- [ ] **Step 8: Commit Task 2**

  ```bash
  git add src/internal-production/baseline-post-handoff-receipt-v1.ts \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  git commit -m "fix(current-entry): authenticate recovery overlay"
  ```

## Task 3: Bind recovery, replay, and successor state to the current prerequisite pairs

**Files:**

- Modify: `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`
- Modify: `src/internal-production/baseline-post-handoff-receipt-v1.ts`

- [ ] **Step 1: Add the live-shaped combined RED test**

  Add an exact test titled:

  ```text
  P4c exact-poison recovery binds current prerequisite pairs without mutating legacy history
  ```

  The fixture must combine, in one copied-production path:

  - the frozen exact-poison store and operation;
  - a selected current entry advanced to the current source/build identity;
  - both settled public current records in their deterministic legacy content locations;
  - `prepareInternalProductionCurrentEntryOperationV1` entering exact-poison recovery.

  Require the preparation result to converge and prove:

  - recovery uses the new current audit/pending pairs rather than frozen `e2`/`ce` pairs;
  - frozen legacy files retain identical bytes, inodes, link counts, modes, and directory inventory;
  - overlay files retain identical bytes and physical identities;
  - the durable successor/genesis binds the current pair refs/hashes;
  - the A/B observation and zero-effect brackets match;
  - no database migration, service restart, Mission Control mutation, or cleanup occurs.

- [ ] **Step 2: Add replay and concurrency RED tests**

  Add an exact test titled:

  ```text
  P4c exact-poison overlay recovery survives response loss and concurrent publication
  ```

  Exercise at least:

  - none, audit-only, pending-only, and both-present prefixes across a retry;
  - response loss after admission but before successor publication;
  - response loss after successor publication but before acknowledgement;
  - a public observer settling a previously absent expected overlay between attempts;
  - presence changing inside one admitted attempt, which must fail before mutation;
  - current source/context changing between prerequisite observation A and B;
  - two recovery attempts contending on the existing held writer, with one exact final successor and no replacement of legacy or overlay records.

- [ ] **Step 3: Run the RED tests**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    --test-name-pattern='^P4c exact-poison (recovery binds current prerequisite pairs without mutating legacy history|overlay recovery survives response loss and concurrent publication)$' \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

- [ ] **Step 4: Replace the hardcoded recovery-current prerequisite reader**

  Refactor `observeExactPoisonRecoveryCurrentPrerequisitesNoWriteV1` so it calls only the two private no-write builders. Remove the frozen `e2`/`ce` paths as semantic “current” inputs; retain those constants solely for frozen original-inventory authentication and diagnostics.

  Continue to observe prerequisites twice around the zero-effect bracket and require exact value/bytes/pair equality.

- [ ] **Step 5: Thread the expected overlay into initial admission**

  In the exact-poison publisher/prepare path:

  1. acquire the existing predecessor-derived H writer;
  2. build prerequisite observation A;
  3. derive the exact expected overlay from A;
  4. call `observeExactPoisonQuarantineAdmissionCoreV1` with that overlay;
  5. rebuild prerequisite observation B;
  6. require A/B equality and admitted-overlay equality before publication.

  Do not add a second writer, lock, or publication route.

- [ ] **Step 6: Make recovery candidates consume admitted current prerequisites**

  Change `observeExactPoisonRecoveryCandidatesNoWriteV1` to accept the admitted overlay/current prerequisite bundle. It must build the recovery successor from those exact current pairs, not read the old fixed records or discover new records from disk.

- [ ] **Step 7: Preserve the bundle across all replay fences**

  Extend the private `ExactPoisonQuarantineAdmissionV1` capability so these paths reuse and revalidate the same exact bundle:

  - `observeExactPoisonRecoveryPostVisibleZeroFenceV1`;
  - `assertExactPoisonRecoveryPublicationFenceV1`;
  - every response-loss adoption/publication branch in the exact-poison publisher core;
  - final durable successor/chain verification.

  Re-admission must receive the originally admitted expected overlay. Rebuilding current candidates is allowed only for equality checking; it must not replace the admitted authority.

- [ ] **Step 8: Keep public observers outside the recovery call graph**

  Add/retain a bounded source assertion proving that the exact-poison preselection, admission, candidate, fence, and publisher regions reference the private builders but not:

  - `observeCurrentInternalProductionAuthorityV3Migration31AuditV1`;
  - `observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1`.

- [ ] **Step 9: Run GREEN and the existing full exact-poison response-loss cluster**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    --test-name-pattern='^(P4c exact-poison (recovery binds current prerequisite pairs without mutating legacy history|overlay recovery survives response loss and concurrent publication)|P4a exact-poison recovery leaf.*|P4 exact-poison publisher.*)$' \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

- [ ] **Step 10: Commit Task 3**

  ```bash
  git add src/internal-production/baseline-post-handoff-receipt-v1.ts \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  git commit -m "fix(current-entry): bind poison recovery to current"
  ```

## Task 4: Update the authoritative closure plan and source contracts

**Files:**

- Modify: `docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md`
- Modify: `tests/internal-production/task-0-source-manifest.test.ts` only if required by the authoritative path inventory
- Modify: `scripts/run-isolated-postgres-tests.ts` only if required by the P3 tracked scope
- Modify: `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`

- [ ] **Step 1: Amend the exact-poison causal narrative**

  Near the existing exact-poison amendment, record that:

  - the frozen 10-directory/5-file original inventory and its hash remain exact;
  - the only permissible extra records are the two internally derived, exact settled current prerequisite overlay records;
  - overlay presence is authenticated and stability-fenced but is not serialized into the frozen inventory hash;
  - recovery binds current prerequisite pairs and never calls the public publishers;
  - the change is causally required because Task6A Step 1 publishes current prerequisites before prepare and otherwise deadlocks on frozen-current assumptions;
  - Task6A still stops before migration/service mutation if recovery fails.

  Remove or qualify any stale sentence that says no additional file may exist without distinguishing the closed current overlay.

- [ ] **Step 2: Amend Task6A Step 1 evidence requirements**

  Require the rerun to prove that the audit and pending record bytes/inodes survive preparation and that the returned operation/status references match the current pairs before migration or service mutation begins.

- [ ] **Step 3: Add plan/source-consistency assertions**

  In the receipt test or source-manifest test, assert the authoritative plan contains the closed-overlay rule and current-pair successor rule. Add mutation negatives so removing either rule or reintroducing public-observer repair fails.

- [ ] **Step 4: Decide the exact File Map mechanically**

  Run the existing source-manifest parser test before changing tuple cardinalities:

  ```bash
  node --import tsx --test --test-concurrency=1 \
    tests/internal-production/task-0-source-manifest.test.ts
  ```

  The design and implementation plan documents do not automatically become Task 0 runtime-source members. Change the frozen Task 0 tuple or P3 tracked scope only if the authoritative parser contract explicitly requires these paths. If it does, update the plan arithmetic, insertion order, manifest, and tests in one change; otherwise leave exact counts unchanged and add an assertion explaining the separation.

- [ ] **Step 5: Run documentation and manifest verification**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    tests/internal-production/task-0-source-manifest.test.ts
  git diff --check
  ```

- [ ] **Step 6: Commit Task 4**

  ```bash
  git add docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  if ! git diff --quiet -- tests/internal-production/task-0-source-manifest.test.ts scripts/run-isolated-postgres-tests.ts; then
    git add tests/internal-production/task-0-source-manifest.test.ts scripts/run-isolated-postgres-tests.ts
  fi
  git commit -m "docs(current-entry): bind overlay recovery closure"
  ```

## Task 5: Run focused, full-file, and build verification on the clean branch

**Files:**

- Verify: all files changed by Tasks 1–4

- [ ] **Step 1: Confirm the branch is clean and record the exact commit**

  ```bash
  git status --short --branch
  git rev-parse HEAD
  git diff --check
  ```

  Do not run the clean-worktree build until every intended file is committed.

- [ ] **Step 2: Run the focused P4c test group**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    --test-name-pattern='^P4c ' \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

  Require every P4c test to execute; zero selected tests is failure.

- [ ] **Step 3: Run the full receipt suite through the authenticated isolated PostgreSQL runner**

  With `SETFARM_TEST_PG_ADMIN_URL` loaded securely from the approved local service configuration and never printed:

  ```bash
  env -u SETFARM_PG_URL \
    node --import tsx scripts/run-isolated-postgres-tests.ts -- \
    node --import tsx --test --test-concurrency=1 \
    tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
  ```

  Preserve the runner’s clean-source and exact-scope checks. Do not inject heap, skip, or isolation bypass flags.

- [ ] **Step 4: Run static and digest verification**

  ```bash
  node --import tsx --test --test-concurrency=1 \
    tests/internal-production/task-0-source-manifest.test.ts
  npx tsc --noEmit
  npm run check:migration-digests
  git diff --check
  ```

- [ ] **Step 5: Run the clean-worktree production build**

  ```bash
  npm run build
  ```

  Record the resulting Setfarm version/build identity and confirm `git status --short` remains empty.

- [ ] **Step 6: Run the authoritative P3 full gate**

  Execute the exact Step 3 block from:

  ```text
  docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md
  ```

  Use `/bin/bash`, the approved loopback admin URL loaded without disclosure, `SETFARM_PG_URL` unset, and the clean committed branch. Require the full gate and cleanup verification to pass; do not weaken the tracked scope or test isolation.

- [ ] **Step 7: Obtain an independent diff review**

  Ask a read-only reviewer to inspect the exact committed range for:

  - accidental mutation of frozen legacy evidence;
  - public-observer calls inside recovery;
  - path/bytes authority widening;
  - absence/presence TOCTOU;
  - response-loss and concurrency gaps;
  - stale plan/File Map/test assertions.

  Convert every critical or important finding into a causal RED test, implement the smallest fix, commit it, and rerun the proportional tests plus Steps 3–6.

## Task 6: Deliver the reviewed PR and synchronize clean main

**Files:**

- Delivery only; no new product scope unless review proves it causally necessary

- [ ] **Step 1: Push the scoped branch and open/update the PR**

  ```bash
  git push -u origin fix/current-entry-prerequisite-overlay-recovery
  gh pr create \
    --title "fix(current-entry): recover exact prerequisite overlays" \
    --body $'## Summary\n- authenticate the two settled current-entry prerequisite records as a closed exact-poison overlay\n- preserve the frozen legacy poison inventory and physical evidence\n- bind recovery replay and successor state to the current audit/pending pairs\n\n## Verification\n- focused P4c recovery tests\n- full isolated receipt suite\n- Task 0 manifest, TypeScript, migration digests, clean build\n- authoritative P3 full gate\n\n## Safety\nDiagnosis and recovery verification performed no DB migration, service restart, or Mission Control mutation.'
  ```

  The PR body must include the live failure, root cause, frozen-history guarantee, exact tests/gates, and explicit statement that no migration or service mutation occurred during diagnosis.

- [ ] **Step 2: Resolve review feedback with evidence**

  Read every current-head review comment. For actionable findings, add RED tests and scoped commits; for stale/non-applicable comments, reply with exact source/test evidence. Require zero unresolved actionable threads and passing required checks.

- [ ] **Step 3: Merge through the protected PR path**

  Use the repository’s normal merge policy. Do not commit directly to `main`, force-push, rewrite history, or bypass checks.

- [ ] **Step 4: Synchronize the canonical clean-main worktree**

  ```bash
  git fetch origin
  git pull --ff-only origin main
  git status --short --branch
  git rev-parse HEAD
  ```

  Confirm the merge commit is the current clean main before rollout.

- [ ] **Step 5: Rebuild and rerun the clean-main gate if the merge identity changed build output**

  ```bash
  npm run build
  ```

  Then rerun the exact P3 full gate on clean main. Preserve its authenticated DB and tracked-scope constraints.

## Task 7: Re-run Task6A Step 1 and resume the broader closure goal

**Files:**

- Execute: exact Task6A Step 1 block in `docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md`
- Update: that plan’s checkbox/evidence log only after real proof

- [ ] **Step 1: Capture pre-run immutable evidence**

  Before the Task6A command, record without printing secrets:

  - clean-main commit and Setfarm build identity;
  - audit record ref/hash/path, bytes hash, inode, mode, and link count;
  - pending record ref/hash/path, bytes hash, inode, mode, and link count;
  - current service PIDs/launch identities and migration ledger position;
  - Mission Control and Setfarm HTTP liveness.

- [ ] **Step 2: Execute exact Task6A Step 1 from the beginning**

  Use `/bin/bash`, the approved authenticated loopback admin URL, and the exact commands in the authoritative plan. Do not skip the public audit/pending observations even when the existing files are already present; their idempotency is part of the proof.

- [ ] **Step 3: Prove recovery convergence before mutation**

  Require:

  - public audit and pending observations return the existing exact current pairs;
  - `prepare-current-entry` succeeds or idempotently adopts its durable successor;
  - the successor binds those current pairs;
  - both overlay files and all frozen legacy evidence retain their pre-run bytes and physical identities;
  - no unknown file or directory appears in the protected store;
  - no DB migration, service restart, or Mission Control mutation occurred before the prepare boundary passed.

- [ ] **Step 4: Continue the remaining Task6A rollout only after Step 3 passes**

  Proceed with the controlled migration/restart and post-rollout assertions already defined in the authoritative plan. If a new root defect appears, stop only at that mutation boundary, record live DB/log/HTTP evidence, and add the smallest causally required plan amendment before editing.

- [ ] **Step 5: Resume the overall production-closure sequence**

  After Task6A completes, continue in this order:

  1. Mission Control DB/API/UI reconciliation;
  2. golden-run harness and recovery/idempotency scenarios;
  3. controlled example-project fleet;
  4. broad clean-main verification;
  5. final independent review and clean PR delivery.

  External signing, notarization, distribution, or public release remain explicitly deferred and outside this goal.

## Completion Evidence

- [ ] The exact-poison frozen legacy inventory body/hash and physical identities are unchanged.
- [ ] All four settled overlay prefixes pass; hostile/crossed overlays fail before mutation.
- [ ] Recovery successor/ref/hash evidence binds the current audit and pending pairs.
- [ ] Public observers remain idempotent publishers and are absent from the recovery call graph.
- [ ] Focused P4c, full receipt, Task 0 manifest, TypeScript, migration digest, build, and P3 full gates pass on an exact clean commit.
- [ ] Independent review reports no unresolved critical/important finding.
- [ ] The protected PR is merged and clean main is synchronized and reverified.
- [ ] Exact Task6A Step 1 converges with existing current records preserved and no premature migration/service mutation.
- [ ] The authoritative closure plan records evidence and the next Mission Control/golden-run work is resumed.
