# Positive worktree binding contract V1

Status: proposed diagnostic-only leaf under the owner-approved positive physical-plus-PostgreSQL direction. No live producer, sidecar, migration, owner count, or cutover authority is introduced here.

## Boundary

Current `execution_attempts.worktree` and `runtime_sessions.worktree` values are nullable path text. The V2 active-row snapshot labels physical identity unverified. Path equality, a matching hash supplied by a caller, and a pure validator cannot authenticate a filesystem observation or a PostgreSQL transaction. A future producer must durably bind the exact active row identities to a held physical identity after worktree creation, and a future reader must independently authenticate that producer and the rows in one bracketed observation. This leaf defines the strict data comparison needed at that later boundary without claiming it exists now.

Pre-migration-32 live publication of even a pending sidecar would create a new owner/effect not counted by the frozen zero-owner census. This change publishes none. Integration waits for an activated, counted owner-admission producer or a separately reviewed pre-32 protocol; it must not repurpose the process-identity JSONB or reinterpret historical V1 receipts.

## Input and output

`projectPositiveWorktreeBindingCandidateV1` accepts only an exact plain object with `attempt`, `session`, `physical`, and `receipt`. The attempt contains positive generation; canonical run/claim/attempt IDs, a raw 64-hex fence token from the trusted caller boundary, non-null canonical root, source SHA/tree, and active disposition. The session contains matching run/claim/attempt IDs, its own session and owner-instance IDs, identical non-null root, and an active state. The physical entry contains canonical root, positive decimal device/inode/birthtime identity, and a non-null canonical Git primary root. The immutable receipt repeats all binding keys, root, a domain-separated fence-token commitment, physical identity hash, source SHA/tree, and a canonical body hash. The raw fence token is never returned or serialized into the receipt/result: it is an active database CAS capability. The receipt cannot be an arbitrary path/hash-only claim: every field is checked against both row tuples and the current physical entry, and the physical identity hash is recomputed using the existing V2 identity formula.

The result is deeply frozen, has `authority: "diagnostic-only"`, `physicalIdentityProvenance: "unverified"`, `status: "consistent-candidate"`, the complete validated inputs, and a canonical projection hash. It has no `owner`, `zero`, `eligible`, `ready`, or `cutover` field. It does not read a host, database, or receipt store; a consistent result remains non-authoritative until the later producer and reader are implemented and verified. The leaf refuses null/path-only roots, crossed row identities, changed source/tree/fence/generation, duplicate or unexpected fields, malformed Unicode/paths/hashes, accessor/proxy evidence, wrong receipt hash, changed inode/birthtime/Git primary, and inactive rows. Caller mutation after return cannot change the captured result. A copied receipt with the same path but changed physical identity refuses.

## Integration boundary, not part of this PR

The future writer must cover every relevant claim/worktree/attempt/session path, publish an immutable record through a code-owned no-replace store only after an activated counted reservation, and reauthenticate the exact locked PostgreSQL rows and held root before dispatch. Source SHA/tree in this contract must be read from immutable attempt `source_before_sha`/`source_before_tree_hash`, never nullable after-source fields. The current V2 active-row snapshot omits generation, fence and source fields, so the future reader needs independently locked exact attempt/session/claim rows; it cannot project authority from that V2 snapshot. Crash gaps remain pending/unresolved, never implicitly empty. The future reader must prove sidecar provenance, source/build provenance, row-set completeness, held physical stability and every historical blocker independently before any V2 partition or cold guard may consume it. No current service, database, runtime artifact, or safety gate changes in this slice.

## File map

- `src/internal-production/baseline-positive-worktree-binding-contract-v1.ts`: strict pure candidate comparison and canonical commitment.
- `tests/internal-production/baseline-positive-worktree-binding-contract-v1.test.ts`: literal matching and adversarial mismatches.
- `package.json`: register the pure test under the default internal-production test chain.
- `docs/superpowers/plans/2026-09-24-positive-worktree-binding-contract-v1.md`: RED/GREEN, review and delivery plan.
