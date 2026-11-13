# Evidence refresh dependency preparation implementation plan

> **For agentic workers:** Execute this single bounded task inline in the existing sole writer; independent agents review without delivery authority.

**Goal:** Make fresh native evidence refresh commands see authenticated private dependencies after restoring the candidate worktree.

**Architecture:** Reuse the existing native dependency producer in the evidence-only runtime after authenticated restoration. Keep existing downstream lease, source, publication and cleanup checks unchanged.

**Tech stack:** TypeScript ESM, Node test runner, existing P3-owned PostgreSQL integration fixture, Git worktrees.

**Spec:** `docs/superpowers/specs/2026-11-13-evidence-refresh-dependencies-design.md`.

## Global constraints

One existing writer, branch `fix/evidence-refresh-dependencies-20261113`, base `24b24bf98aae911a2e61ebe1996537c069257c93`. Preserve dirty files, historical evidence, keys and cache. No production change before the focused regression has actually failed. Builds require a clean committed source tree. No generated-project rescue or live service change is part of the source edit.

## Task 1: Preserve executable dependency availability across refresh restoration

**Files:**

- Modify `tests/execution-attempts/native-implementation-join.integration.test.ts`, existing `runNativeRefreshReviewScenario("control")`.
- Modify `src/recovery/v3-evidence-only-runtime.ts`, native packet branch in `loadOrReserveAttempt`.

**Interfaces:** Consume the existing authenticated custody `{repo, worktree}` and `prepareNativeImplementationDependencies(repo: string, worktree: string): void`. Keep the existing runtime dependency and worker interfaces.

- [ ] Seed a fixture-owned executable at `value.repo/node_modules/.bin/native-refresh-build` in the control scenario. Use mode `0700` and a Node shebang that prints `native dependency available`. Add `/.setfarm/` to that owned repository's Git info exclude so the existing dependency-custody control path has its required ignored status; do not change the candidate's tracked source.
- [ ] Observe the actual restored execution context by wrapping only the existing real dependency object's `executeEvidence`: record whether this tool exists, execute it if present, check that its resolved path is inside the restored worktree and its inode differs from the canonical copy, then delegate to the original real `executeEvidence`. After the worker finishes, assert the tool was available. Keep every existing real evidence, source-revision, branch, publication and cleanup assertion.
- [ ] Extend the existing control test, named `native Task11 real evidence-plane unavailability resolves through one unchanged-source non-model lease`. Capture the actual command, PID, exit and output. The expected RED is the missing private tool assertion, not an import/setup error. The existing constructor does not admit a new selector for this test; run its 25-test file through the existing six-cell grammar without changing that guard. The initial rejected command is retained as a pre-test invocation refusal.
Run:

```bash
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/execution-attempts/native-implementation-join.integration.test.ts
```

- [ ] Add the production import:

```ts
import { prepareNativeImplementationDependencies } from "../installer/worktree-ops.js";
```

- [ ] Immediately after the existing `nativeWorktrees.set(lease.dispatchId, custody)` add:

```ts
if (lease.mode === "fresh_execution") {
  prepareNativeImplementationDependencies(custody.repo, custody.worktree);
}
```

- [ ] Rerun the same 25-test native integration file. Require real evidence success and the same immutable candidate source. Run existing relevant private dependency-copy tests and TypeScript checking; widen only for a new failure or concrete review concern.
- [ ] Review the complete source/test diff independently, fix actual findings, and commit conventionally on the scoped branch. Use the established clean-main build transition after reviewed merge; retain original process results. Do not build dirty or skip guards.
- [ ] Push the scoped branch and deliver a reviewed PR. Record exact merged source/build identities. Continue the live software objective through its existing owner and service guards; do not replay attempts 16/17 or call the current game qualified from this regression alone.

## Self-review

The two production lines reuse an existing asset owner and do not create a new authority or installer. The regression observes runnable ignored assets at the real refresh boundary and preserves actual native evidence execution. The integration fixture owns its temporary paths and cleanup; live installation data and runtime artifacts are outside its scope. Existing user continuation authority covers this causally required root fix and ordinary reviewed delivery.
