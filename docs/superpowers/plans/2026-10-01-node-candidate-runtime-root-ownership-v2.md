# Candidate runtime fresh-root ownership V2 Implementation Plan

> **For agentic workers:** Execute inline with checkpoints. The usual
> executing-plans skill is unavailable; root is the sole writer by user policy.
> Use test-driven-development, requesting-code-review and
> verification-before-completion; agents perform read-only review only.

**Goal:** Repair fresh runtime root group preparation without weakening guards.

**Architecture:** A single internal constructor owns only its newly created
root. The existing layout consumes its immutable original inode pin, while
failure retains partial directories instead of deleting by pathname.

**Tech Stack:** TypeScript ESM/Node26.4.0, POSIX filesystem, node:test, tsx,
TypeScript5.9.3 test-only VM transpilation; unchanged locked dependencies.

**Spec:** docs/superpowers/specs/2026-10-01-node-candidate-runtime-root-ownership-v2-design.md

## Global Constraints

- Ordinary matching real/effective UID/GID, Darwin501/20 here; mode0700.
- Preserve device/inode/fullmode/UID; only fresh root GID may change.
- Preserve old worktrees/roots/archives, live DB/services/selector and guards.
- No bare DB-backed suite; unchanged private wrapper only after fresh review.
- Builds only from clean source; no direct-main commit or safety bypass.

## File Map

Use the exact three source/test paths mapped in the spec; no dependency changes.
This causal fix follows fourth all outer1; its discarded root GID is a hypothesis
until the actual-constructor regression records a fresh inherited group.

### Task1: Actual layout RED and fresh-root descriptor preparation

**Files:** Create the helper and root-ownership test; modify private materializer.

**Interfaces:** `createNodeCandidateRuntimeAttemptRootInternalV2(prefix: string)`
returns `Readonly<{absolutePath:string;device:bigint;inode:bigint}>` and never
accepts an existing directory or caller-supplied ownership evidence.

- [x] Compile actual source into a VM with createRequire bound to the source
  filename, append test-context export of createLayout, and call both scopes.
  Preserve real imports and source logic; no production export or copied body.
  In a scoped mkdtemp hook retain actual created metadata; on success assert
  root/children currentUID/currentGID0700, empty application and exact root pin.
  Example behavior assertion:

  ```ts
  const layout = createLayout("test_fixture");
  assert.equal(fs.lstatSync(layout.attemptRoot).gid, process.getgid!());
  assert.equal(fs.lstatSync(layout.applicationRoot).mode & 0o7777, 0o700);
  ```

- [x] Run with `env -u TMPDIR -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL
  /opt/homebrew/Cellar/node/26.4.0/bin/node --import tsx --test
  tests/product-compiler/node-candidate-runtime-root-ownership-v2.test.ts`.
  Expected actual existing LAYOUT_INVALID denial and captured inheritedGID0;
  do not mistake loader/VM errors for semantic RED.
- [x] Add scoped pre/post fstat drift, fchown failure, close failure, combined
  group+close, post-close alias rebind, and child mkdir denial tests. Assert
  LAYOUT_INVALID, actual original/replacement retention, no replacement chmod/
  chown/deletion, EBADF after real close and ordered cause preservation.
- [x] Implement fresh creation/open/precheck/fchown/postcheck/exactclose/final
  original-pin check, as specified. Wire existing layout to original pin:

  ```ts
  const prepared = createNodeCandidateRuntimeAttemptRootInternalV2(prefix);
  const attemptRoot = prepared.absolutePath;
  const exact = lstatSync(attemptRoot, { bigint: true });
  if (exact.dev !== prepared.device || exact.ino !== prepared.inode) {
    return fail("NODE_CANDIDATE_RUNTIME_PRIVATE_V2_LAYOUT_INVALID",
      "Candidate runtime attempt root identity changed");
  }
  ```

  Retain existing owner/mode/canonical/empty guards; remove pre-pin pathchmod
  and unconditional failure rm. Wrap raw errors using existing typed fail.
- [x] Run new suite plus existing runtime identity test; record RED/GREEN and
  whole output, then proportional DB-free catalog/closure/environment/
  materialization/fixture suites. Run tsc --noEmit, English/path/version/
  migration/MC contracts and git diff --check. Request independent read-only
  exact-diff review; fix findings via RED and rerun affected verification.
- [ ] Commit explicit scoped files conventionally after evidence; push branch,
  create PR and inspect exact-head reviews/comments/checks. Do not invent bot
  approval; no privileged/admin merge or billing/access changes.

### Task2: Reviewed delivery and genuine complete verification

- [ ] After resolved review and normal SHA-bound merge, create a NEW clean-main
  checkout, preserve all previous builds, use unchanged locked dependencies.
- [ ] Run normal guarded npm run build on clean main; record exact source,
  tree/build/manifest/CLI/dependency digests and actual exit.
- [ ] Read-only live PG/HTTP/resource audit, then fresh independent clearance
  for exactly `/opt/homebrew/Cellar/node/26.4.0/bin/node
  scripts/run-private-postgres-tests.mjs all` from that checkout.
- [ ] Freeze source/Git/build/dependencies during actual invocation. Follow
  strict held journal until exitANDclose for init/test/server, sixEOF, two
  quiescence passes, adminend/serverclose/terminal and separately outerexit.
- [ ] Post-live audit and record actual graph results; if a new root cause
  appears refine scope from evidence and continue safely. No stitching or
  full-project completion claim based on partial/compiler-only successes.

Plan self-review: all spec fences/denials covered; constructor interface and
paths consistent; implementation inline, review read-only, no placeholder.

## Verification checkpoints

- Docs-first commit1aeb7fab on new solewriter branch based095220, old canonical
  repos/worktrees untouched. Existing locked dependencies linked, no install.
- Initial VM fixture had esModuleInterop missing; corrected BEFORE accepting
  test-fixture failure as semantic evidence. Normal ambient source run1PASS1FAIL:
  productionGID0 denial/fixtureGID20 pass. ScrubbedTMPDIR0PASS10FAIL919.287208ms:
  both actual fresh root GID0, intended source denial; no loader failures.
- Minimal source helper/layout first11PASS737.430917ms, then proportional13
  DB-free files165PASS0FAIL61516.2355ms. ESBUILD_BINARY_PATH explicitly selects
  unchanged private arm64 binary10573778bytes/hash e2dc9a52440a2a34f09434a2f4843cb1e30f84e40dcf238976ec61ef8cd7f36a;
  it does not change the fixed all wrapper or shared dependency bytes.
- Independent review found numeric-stat repinning. Actual consumer rebind RED
  10PASS3FAIL720.215083ms (three missing exceptions); fixed original pin binding
  and first-effect/final-return fences. Focused14PASS698.577791ms includes prior
  identity case. Secondmkdir retained-partial case added; final gates pending.
- Noemit exit0; version2.3.79/English1920/path966/migrationdigests/MC12/diff0.
  These pre-final checks are not complete npm, build or protected-origin proof.
- Final proportional18637 CLOSED0:169PASS0FAIL0CANCELLED0SKIP0TODO62869.597416ms;
  all13 file outputs read. Final noemit/contracts85880 CLOSED0 with same counts.
  Independent frozen-source final review C0/I0/M0, all three findings resolved:
  helper b2d2abca4bf81fb0f39fc31990efcb16baab1798321f81343ceeb98086dffb51;
  materializer2e29c461a96d39e3d5be48dbe88090c8bc4c1455d418c119cb86653d44ce3aef;
  test eac5776ae02d209eec7b8b1767ef8ad2cbd0b27e68a1225ee49b8ddb59fdfe83.
  Reviewer did not rerun tests or clear an ALL/protected effect; exact committed
  head/delivery audit follows. Five mapped paths only, unchanged dependency bytes.
