# Product compiler fixture ownership implementation plan

> **For agentic workers:** Execute inline as the sole primary writer; use read-only independent review. `executing-plans` is unavailable, so keep explicit checkpoints here and in the retained external log. No implementation delegation.

**Goal:** Repair fresh fixture ownership so unchanged product-compiler guards can exercise their intended cases in the clean ALL environment.

**Architecture:** Nine TS test suites reuse the existing descriptor-pinned script helper. The false-authority content-store source fixture prepares only its own fresh held build root, with checked identity before and after fchown and ordered close errors.

**Tech Stack:** Node 26.4.0, TypeScript ESM, node:test, Darwin filesystem descriptors.

**Spec:** `docs/superpowers/specs/2026-10-01-product-compiler-fixture-ownership-design.md`

## Global constraints

- Base `3e137989d24eac0a1cda6e0e00e5f83fd537d7c0`; one writer on `fix/product-compiler-fixture-ownership-v1`.
- Preserve all old worktrees, evidence, builds, services and consumer security gates.
- No TMPDIR override, private PG adoption, root/native startup, secret or access changes.
- Clean guarded build only after commit; no dirty-build or runtime-guard bypass.
- Every prepared directory is fresh, same-device/inode, UID-owned 0700, and descriptor-bound; errors retain evidence and deny return.

## File Map

- Modify nine `tests/product-compiler/` suites: `host-node-toolchain-authority-v2.test.ts`, `node-scaffold-execution-environment-v2.test.ts`, `node-scaffold-private-materializer-v2.test.ts`, `node-scaffold-production-materialization-v2.test.ts`, `node-toolchain-provisioning-v2.test.ts`, `platform-release-bootstrap-registry-activation-v2.test.ts`, `platform-release-bootstrap-registry-physical-activation-darwin-lock-fixture-v2.test.ts`, `platform-release-content-store-darwin-filesystem-fixture-v2.test.ts`, `platform-release-content-store-global-census-test-support-v3.test.ts`.
- Modify `src/product-compiler/platform-release-content-store-darwin-filesystem-fixture-v2.ts`: only fresh build-root preparation and fs import.
- Create `tests/product-compiler/content-store-build-root-ownership-v2.test.ts`: actual constructor regression and scoped FS fault cases, no compiler/native binary invocation.
- Create this plan and its spec. Existing script helper and all five native builders stay byte-identical.

## Task 1: Reproduce intended failures

- [ ] Add standalone constructor regression that calls `observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2("stdout_stream_error")`, expects its injected stdout error, and checks false authority and retained mode 0700.
- [ ] Run it and the host/environment/production affected tests with `env -u TMPDIR`, exact Node and `--import tsx --test`; record semantic ownership RED, not loader errors.

## Task 2: Prepare owned roots

**Interfaces:** Existing `createPrivateOutputParent(prefix: string): string` provides a fresh canonical path; async callers may retain `await`. Public content-store APIs remain unchanged.

- [ ] Import `createPrivateOutputParent` from `../../scripts/__tests__/fixtures/private-output-parent.mjs`; replace only each suite's fresh `mkdtemp` or `mkdtempSync` call and remove the unused fs import. Preserve realpath, chmod, intentional bad-mode inputs and cleanup assertions.
- [ ] In `createBuildRootV2`, capture fresh pin, open `O_RDONLY|O_DIRECTORY|O_NOFOLLOW`, verify held/alias/canonical current metadata, `fchownSync(fd, process.getuid!(), process.getgid!())`, verify current GID then close. Keep the existing `assertRootCurrentV2` after preparation with the updated pin.
- [ ] Add regression branches for pre-change identity drift, fchown denial, post-change drift, close failure and combined primary/close error. Sync builtin named exports only within the isolated test worker; restore them after every test. No failed-preparation branch may invoke a builder.
- [ ] Run standalone regression and helper tests, then all nine complete affected suites with TMPDIR absent. Record actual counts and every failure.

## Task 3: Review and deliver

- [ ] Run version/English/path contracts, `git diff --check` and scoped secret inspection. Review File Map against diff.
- [ ] Obtain independent read-only review of exact source/test/docs diff; resolve concrete findings without widening authority.
- [ ] Stage only the 13 File Map paths and commit conventionally. Run normal guarded clean build and relevant focused tests; inspect real exit/output.
- [ ] Push scoped branch, create/update honest PR, read every available comment and exact-head check. Review silence is not approval.
- [ ] Deliver only with review and passing proportional evidence; full npm remains unverified until a new clean-main ALL graph completes.
- [ ] Prepare a new retained clean-main checkout/build after reviewed integration. Obtain new per-invocation private-ALL review and fresh host health before another ALL run. Never rebuild the closed third epoch checkout.
