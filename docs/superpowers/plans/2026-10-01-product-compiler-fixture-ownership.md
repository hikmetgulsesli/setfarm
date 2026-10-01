# Product compiler fixture ownership implementation plan

> **For agentic workers:** Execute inline as the sole primary writer; use read-only independent review. `executing-plans` is unavailable, so keep explicit checkpoints here and in the retained external log. No implementation delegation.

**Goal:** Repair fresh fixture ownership so unchanged product-compiler guards can exercise their intended cases in the clean ALL environment.

**Architecture:** Nine TS test suites reuse the existing descriptor-pinned script helper. The false-authority content-store source fixture prepares only its own fresh held build root, with checked identity before and after fchown and ordered close errors.

**Tech Stack:** Node 26.4.0, TypeScript ESM, node:test, Darwin filesystem descriptors.

**Spec:** `docs/superpowers/specs/2026-10-01-product-compiler-fixture-ownership-design.md`

## Global constraints

- Base `3e137989d24eac0a1cda6e0e00e5f83fd537d7c0`; one writer on `fix/product-compiler-fixture-ownership-v1`.
- Preserve all old worktrees, evidence, builds, services and consumer security gates.
- No TMPDIR override, private PG adoption, root/native startup, secret or access changes. Never dispatch DB-backed suites with ambient/default localhost connections; a new reviewed owned-private epoch is required.
- Clean guarded build only after commit; no dirty-build or runtime-guard bypass.
- Every prepared directory is fresh, same-device/inode, UID-owned 0700, and descriptor-bound; errors retain evidence and deny return.

## File Map

- Modify nine `tests/product-compiler/` suites: `host-node-toolchain-authority-v2.test.ts`, `node-scaffold-execution-environment-v2.test.ts`, `node-scaffold-private-materializer-v2.test.ts`, `node-scaffold-production-materialization-v2.test.ts`, `node-toolchain-provisioning-v2.test.ts`, `platform-release-bootstrap-registry-activation-v2.test.ts`, `platform-release-bootstrap-registry-physical-activation-darwin-lock-fixture-v2.test.ts`, `platform-release-content-store-darwin-filesystem-fixture-v2.test.ts`, `platform-release-content-store-global-census-test-support-v3.test.ts`.
- Modify `src/product-compiler/platform-release-content-store-darwin-filesystem-fixture-v2.ts`: only fresh build-root preparation and fs import.
- Create `tests/product-compiler/content-store-build-root-ownership-v2.test.ts`: actual constructor regression and scoped FS fault cases, no compiler/native binary invocation.
- Create this plan and its spec. Existing script helper and all five native builders stay byte-identical.

## Task 1: Reproduce intended failures

- [x] Add standalone constructor regression that calls `observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2("stdout_stream_error")`, expects its injected stdout error, and checks false authority and retained mode 0700.
- [x] Run it and the host/environment/production affected tests with `env -u TMPDIR`, exact Node and `--import tsx --test`; record semantic ownership RED, not loader errors. Actual 51 tests: 21 passes, 30 failures, no cancellation/skip, exit 1, 7626.12525 ms. Standalone six constructor cases separately failed before implementation.

## Task 2: Prepare owned roots

**Interfaces:** Existing `createPrivateOutputParent(prefix: string): string` provides a fresh canonical path; async callers may retain `await`. Public content-store APIs remain unchanged.

- [x] Import `createPrivateOutputParent` from `../../scripts/__tests__/fixtures/private-output-parent.mjs`; replace only each suite's 36 fresh `mkdtemp` or `mkdtempSync` calls and remove unused fs imports. Preserve realpath, chmod, intentional bad-mode inputs and cleanup assertions.
- [x] In `createBuildRootV2`, capture fresh pin, open `O_RDONLY|O_DIRECTORY|O_NOFOLLOW`, verify held/alias/canonical current metadata, `fchownSync(fd, process.getuid!(), process.getgid!())`, verify current GID then close. Keep the existing `assertRootCurrentV2` after preparation with the updated pin. Verify the original pin again after close; do not repin a replacement.
- [x] Add regression branches for pre-change identity drift, fchown denial, post-change drift, close failure and combined primary/close error. Sync builtin named exports only within the isolated test worker; restore them after every test. No failed-preparation branch may invoke a builder. A seventh actual post-close path-rebind regression failed with missing rejection, then passed after the original-pin fence was added. Existing helper plus seven constructor cases: 19 passes, no failure/cancellation/skip, exit 0, 131.463958 ms.
- [x] Run standalone regression and helper tests, then confirmed DB-free affected suites with TMPDIR absent. The standalone fault contains fixed `/bin/sleep`; no compiler is invoked. Defer private-materializer and any other DB-backed suite to a new reviewed private epoch; never use its helper's default localhost5432. Actual first scoped run: 135 tests, 128 passes, 7 esbuild fixture failures, no cancellation/skip, exit 1, 18351.54325 ms.
- [x] Causal refinement from scoped135tests/128PASS7FAIL: in the already listed provisioning test, prepare ONLY the fresh private esbuild copy from its exact pinned registry wrapper to the selected private platform binary. Recognize the literal wrapper hash in the spec, reject other non-paired bytes, preserve shared dependencies and keep all final production tree/binary guards unchanged. New regression observed RED: 9350 bytes instead of 10573778; second complete DB-free scoped run CLOSED exit 0: 136 passes, no failure/cancellation/skip, 60893.580958 ms. DB-backed suite remains deferred, not claimed passed.

## Task 3: Review and deliver

- [x] Run version/English/path contracts, `git diff --check` and scoped secret inspection. Review File Map against diff. Version 2.3.79, English 1916 files, paths 965; actual no-emit TypeScript exit 0. Scoped credential-pattern scan matched zero lines (rg exit 1); this is not a universal secret guarantee.
- [x] Obtain independent read-only review of exact source/test/docs diff; resolve concrete findings without widening authority. C0/I0/M1 optional direct characterization of already-paired and non-paired private esbuild input branches; unchanged downstream full-tree authority still rejects invalid packages. No private-ALL or protected-startup clearance was given.
- [ ] Stage only the 13 File Map paths and commit conventionally. Run TypeScript no-emit checking, contracts and relevant DB-free focused tests; inspect real exit/output. Do not attempt a dirty or feature-branch guarded build.
- [ ] Push scoped branch, create/update honest PR, read every available comment and exact-head check. Review silence is not approval.
- [ ] Deliver only with review and passing proportional evidence; full npm remains unverified until a new clean-main ALL graph completes.
- [ ] Prepare a new retained clean-main checkout and genuine guarded build after reviewed integration, proving clean main == origin/main. Obtain new per-invocation private-ALL review and fresh host health before another ALL run, including the deferred DB-backed fixtures. Never rebuild the closed third epoch checkout.
