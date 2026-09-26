# Task6A V2 default-deny entry plan

1. Preserve the two existing dirty roots and all historical/deployment worktrees. Work only in a new isolated branch from clean main; inspect Setfarm and Mission Control status before edits.
2. Add RED tests for the separately selected V2 prepare/resume verbs. Assert stable nonzero refusal with no stdout, no import/call of a poisonous V1 module, no filesystem sentinel change, strict zero-input/argument handling, and no V1 effect graph edge. Keep the current V1 CLI and Task6A operator shell byte-unchanged.
3. Implement the smallest import-inert refusal controller and V2 CLI, with an additive npm script and internal-production pure-test enrollment. Do not consume diagnostic host hashes as authority or add an affirmative path.
4. Run focused tests, internal-production pure and cutover suites, TypeScript and source-manifest/contract checks. Ask an independent read-only reviewer to inspect the final diff. Fix any finding before delivery.
5. Commit and push only this scoped branch, deliver a reviewed PR, perform a normal guarded build on preserved clean main after merge, and verify the authenticated host remains diagnostic-only/not-granted. Do not select the V2 CLI for live Task6A or attempt a role/service/DB transition.

This slice is causally necessary because V1 prepare/resume have an effectful first prehook; a gate inserted inside them cannot safely prevent that effect. It is preparatory routing only. A future separately reviewed plan must implement and prove the mechanical DB/OS fence, positive physical-owner authority, private V2 effect admission with rechecks, and operator selection before Task6A proceeds.
