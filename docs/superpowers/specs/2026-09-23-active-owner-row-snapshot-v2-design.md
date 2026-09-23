# Active owner row snapshot V2

Status: diagnostic-only continuation of the approved positive physical-plus-PostgreSQL ownership cutover. PRs #146–#148 provide a pure owner projection and held physical catalog, but no authenticated PostgreSQL row set can yet be paired with that catalog. This slice adds row evidence, not an owner claim.

## Decision and boundary

Choose a bounded, read-only active-row snapshot before schema migration or physical joining. Reusing the historical post-manifest aggregate census would hide row identities, and adding a physical-identity column now would change durable production schema before the current rows and provenance are understood. A nullable `worktree` string is location evidence only; it is never an inode identity, retained-code classification, or primary-project ownership proof.

The observer has one zero-input code-owned entry point in `db-pg.ts`, backed by Setfarm's existing lazy PostgreSQL connection. It begins exactly one `REPEATABLE READ READ ONLY` transaction, reads all four active row sets independently, and returns a frozen canonical diagnostic object and SHA-256 hash. A fixture-only transaction seam in a small internal-production module tests the real validation/query logic; neither entry point calls the V2 owner projector or any cutover/launch/DB-write code.

The production adapter converts each postgres.js `Result extends Array` container to a plain array before the strict parser. This removes driver metadata (`count`, `state`, `command`, `columns`, `statement`) without altering row objects. A production-shaped result fixture covers this boundary; the parser still rejects sparse arrays, unexpected fields, and malformed rows.

## Row sets

- Active `public.runs`: `status IN ('running','resuming','cancelling','failing')`; select `id`, `status`.
- Open `public.claim_log`: `outcome IS NULL`; select `id::text`, `run_id`, `step_id`, `story_id`, `agent_id`.
- Active `public.execution_attempts`: `disposition IN ('claimed','running')`; select `attempt_id`, `run_id`, `step_id`, `story_id`, `claim_id::text`, `worktree`, `disposition`.
- Active `public.runtime_sessions`: `state NOT IN ('released','quarantined')`; select `session_id`, `run_id`, `claim_id::text`, `attempt_id`, `worktree`, `state`, `owner_instance_id`.

Every query names its `public` table explicitly so a changed `search_path` cannot produce a false empty snapshot. The first query in the transaction obtains independent aggregate counts for the four exact active predicates and counts rows with any oversized selected `TEXT` field, without returning raw text. Reject any oversized-field count before selecting raw rows. Use a 256-byte limit for identifiers and other selected scalar text, and 2,048 bytes for nullable worktree paths. These are response-byte and row-count bounds, not a claim of bounded query latency.

Every set is then selected independently with a stable primary-key order (`COLLATE "C"` for text IDs, numeric order for claim IDs) and `LIMIT 257`. Validate text order using UTF-8 byte comparison, not JavaScript UTF-16 string order. Compare row lengths to the aggregate counts from the same transaction. Reject an overflow, malformed/duplicate/unsorted IDs, malformed or oversized field, count mismatch, unexpected result shape, or lost transaction. Keep null and noncanonical worktree paths visible as raw bounded evidence; do not silently drop rows or infer identity from path text. BIGINT identifiers stay canonical decimal strings, never JavaScript numbers.

The output includes all four frozen row arrays, their verified counts, `physicalIdentityProvenance: "unverified"`, `authority: "diagnostic-only"`, and a canonical snapshot hash. Empty arrays are only empty rows in this snapshot: they do not prove complete zero ownership because other owner categories, physical paths, source/build provenance, controller ownership, and journaled transition remain separate. No environment-supplied scope, caller-supplied zero assertion, V1 behavior change, migration, write query, or service action is allowed.

## Tests and delivery

Exercise the fixed SQL through a bounded fake transaction port at the external DB boundary. Verify the exact read-only transaction option, `public` qualification, preflight byte checks, predicates/order/limit; literal empty and occupied row fixtures; null worktree and large BIGINT preservation; 257th row, count drift, duplicate/order drift including a UTF-8/UTF-16 divergent pair, and malformed result refusals. Run focused tests, existing pure/cutover suites, TypeScript, independent read-only review, exact-head PR review, clean-main build, and a read-only host probe if credentials are available. A host inability to connect or an occupied/unknown row set is evidence, not permission to bypass guards.

## File map

- `src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts`: bounded SQL observer, canonical validator, diagnostic response, fixture transaction seam.
- `src/db-pg.ts`: zero-input code-owned wrapper using its existing lazy connection and the fixed read-only transaction mode.
- `tests/internal-production/baseline-positive-worktree-active-row-snapshot-v2.test.ts`: fake-transaction boundary and literal row fixtures.
- `package.json`: register the new focused suite under `test:internal-production:pure`.
- `docs/superpowers/plans/2026-09-23-active-owner-row-snapshot-v2.md`: RED/GREEN and delivery plan.
