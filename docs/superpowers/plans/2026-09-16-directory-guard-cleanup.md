# Directory Guard Cleanup Implementation Plan

> **Execution:** Primary-owner serialized edits, test-first and independent review.

**Goal:** Prevent a failed directory-guard close from closing a subsequently reused
descriptor during the approved deployment/cold-start transition.

**Architecture:** Consume ownership before each close, drain all other owned
descriptors, preserve primary and cleanup errors, and poison new authentication
after any ambiguous cleanup. Never infer from a close exception whether the OS
already consumed the descriptor. A pre-close injected failure may leave an
uncertain descriptor until process exit; retrying it is not safe cleanup.

**Tech Stack:** Existing TypeScript directory guards and isolated Node fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Causal scope and file map

The cutover observer's acquisition-failure regression reproduced three closes of
one consumed descriptor in the shared workspace guard. Cold recovery also uses
that guard and the similarly structured private directory guard, so removing the
new observer's dependency alone is insufficient for live qualification.

- Modify `src/internal-production/baseline-workspace-authority-path-v1.ts`:
  consume-before-close, drain, aggregate errors, sticky uncertainty.
- Modify `src/internal-production/baseline-restart-authority-retirement-v1.ts`:
  same semantics only for `authenticatePrivateDirectoryChainV1`; preserve other
  lifecycle schemas and authorization rules.
- Modify the existing directory-close and affected cold-cleanup regressions in
  `tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`.
  Preserve the169-test registration inventory; add fault variants within tests.

## Task: eliminate retry of ambiguous descriptors

- [x] Update regressions first: interrupted close drains all untouched owners,
  preserves the single uncertain pre-close owner without retry, invalidates old
  guard and refuses fresh authentication. For post-close faults reopen a sentinel
  file into the released slot; assert it survives and no descriptor is retried.

```ts
assert.throws(() => guard.close());
assert.equal(closeAttemptsForConsumedDescriptor, 1);
assert.equal(fstatSync(sentinel).ino, lstatSync(sentinelPath).ino);
assert.throws(() => authenticateAgain());
```

- [x] Run selected tests RED before source edits:
  `node --import tsx --test --test-name-pattern='workspace anchor|failed workspace and private-chain' tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`.
- [x] Pop each descriptor before close. Accumulate exceptions while draining.
  Both closes are idempotent after consuming ownership. This allows existing outer
  retained stacks to discard consumed guards and reach older guards on retry;
  it never retries an underlying descriptor or restores authentication.
  Any cleanup error sets process-local sticky refusal. Failed acquisition throws
  both original validation and cleanup errors instead of silently retrying close.
- [x] Repeat focused fault cases GREEN, run no-emit and independent review.
- [ ] Before delivery run relevant startup/restart/helper/retirement/receipt/
  completion suites in their prescribed isolation. Preserve all failing output;
  no skip, runtime guard bypass or test budget/registration reduction.

This does not certify every other resource wrapper in the repository. Additional
causally relevant cleanup findings must be recorded and tested, not silently
folded into an unrelated refactor. No live service effect is part of this slice.

## Verification checkpoint

The full169-body isolated retirement run completed without early termination:
166passed,3failed,zero skipped,1465106.918833ms. Its after-hook also reported the
three unsuccessful bodies, giving the runner aggregate170tests/166pass/4fail.
The three failures were obsolete expectations that uncertain directory cleanup
could be retried and fresh authentication restored. Other cases, including the
foreign-descriptor guard stability scenario, passed.

Guard-specific fixture branches now preserve pre-unlink leases and immutable
history, verify exactly one close attempt, distinguish post-unlink draining from
fresh authentication, and explicitly dispose only fixture-known pre-syscall
failures. Reader/physical-close and foreign-owner expectations remain unchanged.
Fresh focused history/raw cases pass (98688.303ms/1840.270666ms); final full release
case passes42680.113667ms. Its cleanup-only phase inspector is test-only; the test
also verifies the original usable-lease inspector refuses that revoked capability.

Fresh full retirement run at8845d2df completed169/169 registered bodies,
246/246 nested child tests, zero failures/skips,1690075.530084ms. Durable output:
`logs/2026-09-16-retirement-8845d2df.log` in the canonical workspace logs directory.
This supersedes the earlier failed run for this unchanged guard/retirement source;
other applicable delivery suites remain required.
Earlier six focused guard/frame cases and36 startup/restart/helper caller tests
passed. No-emit, English1495, paths861 and diff checks pass; independent review
found no material production or fixture issues. A later complete affected-suite
run remains required with final startup integration before delivery; these
results do not relabel the failed full run as green.
