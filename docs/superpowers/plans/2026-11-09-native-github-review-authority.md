# Native GitHub review authority implementation plan

Use subagent-driven-development and test-driven-development. Sole SFwriter remains .worktrees/setfarm-dashboard-cutover-controller-20261007-v1, branch fix/native-github-review-authority-20261109, base250521583dbf7d1ee8e170c094089c38f66e75aa. Preserve all private records/workspaces; Root alone Git/delivery/effects.

## File Map

- src/findings/v3-github-review-router.ts: exact packet reader and version-aware slice/evidence projection inside existing private default authority loader only.
- tests/findings/v3-github-review-native-authority.test.ts: focused regression invoking actual default-loader/body with real existing native/legacy schema/fixture data; external DB/reader ports may be bound, never reproduce selector/authority logic. Prefer existing fixtures/helpers; no new production export/framework.
- Existing tests/findings/v3-github-review-router.test.ts and v3-github-review-step-routing.test.ts: covering unchanged router/caller behavior, no edits unless a mechanical external fixture binding is genuinely affected.

## Task1

1. Read design and hash-pinned actual causal proof. Locate existing native fixture/schema builders; tests/evidence/native-packet-v3-evidence-fixture.ts and tests/execution-attempts/helpers/native-implementation-join-fixture.ts are available references. Do not copy private live artifact payloads into source/tests.
2. Add a meaningful native default-loader positive regression and legacy/crossed-family/ownership/provenance controls. Actual production loader/body must execute, with real schema validation. If the private body needs existing AST extraction, bind only external ports/real imports. Capture genuine old-code RED from actual loader type/slice refusal, not fixture setup or a fabricated rejection. Record original PID/exit/output and pre-edit hashes.
3. Implement the smallest one-production-file fix described in the design. Preserve exact closed-family and all existing authority checks; native evidence IDs come from the real contract. No catch downgrade, new export, canonicalV4 dispatch, new role or runtime guard relaxation.
4. Run focused new test plus existing router/step-routing tests and production tsc --noEmit -p tsconfig.json. Existing SFwriter node_modules is a canonical symlink: read only for tests/no-emit, no install/Vite/cache cleanup. Stock build is Root-only on clean merged main, never dirty-build/skip-guard flags. No full test matrix.
5. Freeze exact source/test diff+hash manifest and task report/original RED/GREEN/no-emit receipts under this workspace, then stop source writes. Root task/whole review, scoped commit/normal PR and clean-main stock build remain separate. No live SQL writes, network/model calls, service changes, old run repair or generated-project edits by implementer.

Current1b8 artifact-type failure remains unqualified until fixed delivery and real measurement; old53Q18 and all histories stay preserved. Runtime proof remains read-only. Further rollout/normal cancellation of disposable nonquarantined current run is a separate Root maintained operation, never raw SQL or replay.
