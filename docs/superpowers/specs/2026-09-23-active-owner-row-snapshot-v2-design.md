# Active owner row snapshot V2

Status: diagnostic-only continuation of the approved positive physical-plus-PostgreSQL ownership cutover. PRs #146–#148 provide a pure owner projection and held physical catalog, but no authenticated PostgreSQL row set can yet be paired with that catalog. This slice adds row evidence, not an owner claim.

## Decision and boundary

Choose a bounded, read-only active-row snapshot before schema migration or physical joining. Reusing the historical post-manifest aggregate census would hide row identities, and adding a physical-identity column now would change durable production schema before the current rows and provenance are understood. A nullable `worktree` string is location evidence only; it is never an inode identity, retained-code classification, or primary-project ownership proof.

The observer has one zero-input code-owned entry point backed by Setfarm's existing lazy PostgreSQL connection. It begins exactly one `REPEATABLE READ READ ONLY` transaction, reads all four active row sets independently, and returns a frozen canonical diagnostic object and SHA-256 hash. A fixture-only transaction seam tests the real validation/query logic; neither entry point calls the V2 owner projector or any cutover/launch/DB-write code.

## Row sets

- Active `runs`: `status IN ('running','resuming','cancelling','failing')`; select `id`, `status`.
- Open `claim_log`: `outcome IS NULL`; select `id::text`, `run_id`, `step_id`, `story_id`, `agent_id`.
- Active `execution_attempts`: `disposition IN ('claimed','running')`; select `attempt_id`, `run_id`, `step_id`, `story_id`, `claim_id::text`, `worktree`, `disposition`.
- Active `runtime_sessions`: `state NOT IN ('released','quarantined')`; select `session_id`, `run_id`, `claim_id::text`, `attempt_id`, `worktree`, `state`, `owner_instance_id`.

Every set is selected independently with a stable primary-key order (`COLLATE "C"` for text IDs, numeric order for claim IDs) and `LIMIT 257`. The same transaction obtains independent aggregate counts for those exact predicates. Reject an overflow, malformed/duplicate/unsorted IDs, malformed or oversized field, count mismatch, unexpected result shape, or lost transaction. Keep null and noncanonical worktree paths visible as raw bounded evidence; do not silently drop rows or infer identity from path text. BIGINT identifiers stay canonical decimal strings, never JavaScript numbers.

The output includes all four frozen row arrays, their verified counts, `physicalIdentityProvenance: "unverified"`, `authority: "diagnostic-only"`, and a canonical snapshot hash. Empty arrays are only empty rows in this snapshot: they do not prove complete zero ownership because other owner categories, physical paths, source/build provenance, controller ownership, and journaled transition remain separate. No environment-supplied scope, caller-supplied zero assertion, V1 behavior change, migration, write query, or service action is allowed.

## Tests and delivery

Exercise the fixed SQL through a bounded fake transaction port at the external DB boundary. Verify the exact read-only transaction option and query predicates/order/limit; literal empty and occupied row fixtures; null worktree and large BIGINT preservation; 257th row, count drift, duplicate/order drift, and malformed result refusals. Run focused tests, existing pure/cutover suites, TypeScript, independent read-only review, exact-head PR review, clean-main build, and a read-only host probe if credentials are available. A host inability to connect or an occupied/unknown row set is evidence, not permission to bypass guards.

## File map

- `src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts`: bounded SQL observer, canonical validator, diagnostic response, code-owned wrapper.
- `tests/internal-production/baseline-positive-worktree-active-row-snapshot-v2.test.ts`: fake-transaction boundary and literal row fixtures.
- `package.json`: register the new focused suite under `test:internal-production:pure`.
- `docs/superpowers/plans/2026-09-23-active-owner-row-snapshot-v2.md`: RED/GREEN and delivery plan.
