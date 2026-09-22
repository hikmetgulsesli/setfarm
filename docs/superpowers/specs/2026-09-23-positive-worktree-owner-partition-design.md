# Positive worktree owner partition V2

Status: owner approved the versioned physical-plus-PostgreSQL ownership direction on September 23. This document bounds the first, diagnostic-only slice. It is not live cutover authority.

## Problem and boundary

The historical physical V1 census treats every managed Git worktree as an owner, and its complete-zero/cold guards require the entire worktree inventory to be empty. The host retains development and deployment worktrees by design. Changing the V1 count or silently filtering its receipts would invalidate their historical semantics. Several host development entries are not Git worktrees, and some V1 fixed bases are absent. Existing `execution_attempts.worktree` and `runtime_sessions.worktree` are nullable path text, not durable physical identity. A pre-migration-32 cutover cannot add a new database migration without contradicting its schema-absence proof.

Keep every V1 schema, count, hash, parser and guard unchanged. Introduce a separate V2 evidence chain in stages. Stage 1 is a pure, source-agnostic partition validator. It accepts two bounded physical snapshots around one bounded database-owner snapshot and returns a frozen, hashed diagnostic partition. It never reads the host or database, publishes authority, or changes admission.

## Stage-1 input contract

`projectPositiveWorktreeOwnersV2(input)` accepts exact plain data only:

- `physicalBefore` and `physicalAfter`: at most 256 ordered entries, each with an absolute normalized root, namespace (`retained-code` or `runtime`), kind (`git-worktree` or `artifact`), positive decimal-string `dev`, `ino` and `birthtimeNs`, one Git primary root for a Git worktree or null for an artifact, boolean dirty state, and sorted distinct positive referencing PIDs. The complete snapshots must match exactly; changing membership, identity, dirty state or process references refuses. The later physical adapter must authenticate these facts with held descriptors, Git and complete process/listener observations.
- `retainedGitPrimaries`: sorted distinct absolute normalized primary roots, later authenticated against code-owned Setfarm/Mission Control/deployment Git identities. A retained-code Git entry must name one of these primaries; a runtime entry cannot use one. A non-Git artifact is accepted only in the retained-code namespace and only without a DB binding or process reference. The later physical adapter must prove its code-owned namespace and physical safety; caller labels alone are never authority.
- `database`: an exact immutable snapshot hash and at most 256 sorted active owner rows. A row has a unique owner key, an absolute normalized worktree root or null, and an exact physical identity hash or null. Null root/hash pairs represent active primary-project owners already counted by the database census; they do not have to be in the non-primary physical list. A non-null pair must match one runtime physical entry's root and identity hash one-to-one. The later DB adapter must prove row-set completeness in repeatable-read, canonical active states, owner sidecars, and persistent/fresh identity provenance. Nullable legacy path text by itself never supplies a V2 identity hash.

The identity hash is the canonical SHA-256 of `{schema:'setfarm.internal-production-positive-worktree-identity.v2',root,dev,ino,birthtimeNs,gitPrimaryRoot}`. It is a join value, not a claim that an untrusted database string attests to an inode.

## Partition and refusal

The result lists every physical entry exactly once as `retained-code`, `retained-artifact`, or `bound-execution`, with its original identity and process references. Only `bound-execution` contributes to `ownedWorktreeCount`; only its dirty entries contribute to `dirtyOwnedWorktreeCount`. Primary-project DB owners are reported separately and keep the partition occupied. The result is `zero-candidate` only when there are no bound execution entries, no primary-project owners, and no process references. This is diagnostic and does **not** imply complete zero-owner admission.

The result commits `activeOwnerSetHash` over the exact validated active-owner rows and `retainedGitPrimariesHash` over the complete trusted-primary declaration, as well as the caller's `databaseSnapshotHash`. A changed owner key or declared primary must change the projection hash even if a caller reuses the same claimed snapshot hash. None of these hashes alone proves the future adapters' authenticity or completeness obligations.

Refuse malformed, duplicate, reordered, unnormalized or crossed data; two roots with one physical identity; runtime entries without exactly one active DB binding; active DB entries with no matching runtime root; an active binding to a retained-code entry; wrong identity hashes; or any retained-code/artifact process reference. The physical adapter, not this pure leaf, must refuse symlinks and unsafe directory identities. No unknown entry is dropped or counted as harmless by default. An active runtime entry is occupied even if its process list is empty. The join does not infer owner death or clean up an orphan.

## Later stages (not implemented by Stage 1)

1. A read-only held physical adapter must enumerate all present managed bases and their child entries without treating an absent optional base as a fake empty one, distinguish code-owned retained entries from runtime entries through authenticated ancestry/Git provenance, and fail on unknown non-Git artefacts. It must pin path, inode, birth and relevant mutation metadata across both passes and preserve process/listener/stale checks independently.
2. A read-only database adapter must collect complete active attempt/session/claim/run-owner evidence with one repeatable-read snapshot and bind nullable primary-project paths separately. A non-primary active row without authenticated physical identity provenance refuses. Do not add a pre32 migration or treat path equality as identity.
3. A new V2 cold/complete-zero receipt and guard must explicitly consume the held join, full visible inventory, zero DB owner/effect census, phase/helper proof and controller exclusion. Historical V1 receipts remain resolvable only under V1 rules; V2 cannot be substituted into their hash chains. Actual cutover effects stay blocked until this and the independent controller/journal/ready-bound completion work pass.

## Stage-1 file map and verification

- `src/internal-production/baseline-positive-worktree-owner-partition-v2.ts`: pure exact-shape validator, canonical identity/join and frozen diagnostic partition. No filesystem, DB or live authority.
- `tests/internal-production/baseline-positive-worktree-owner-partition-v2.test.ts`: literal expected outcomes for retained code/artifacts, matched runtime owner, primary-project owner and adversarial mismatch/ABA/crossed evidence.
- `package.json`: include the pure V2 regression file in the default `npm test` chain.
- `docs/superpowers/plans/2026-09-23-positive-worktree-owner-partition.md`: TDD and delivery gates.

Run focused RED/GREEN tests, `npx tsc --noEmit`, source/path contracts and independent review. A reviewed PR and clean-main build are required before any host observation. Stage 1 must leave the current three default-context blockers unchanged.
