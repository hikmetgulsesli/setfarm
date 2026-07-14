# V3 Sealed Runtime Manifest Design

## Decision

V3 local deploy materializes every runtime dependency directory into the sealed
runtime. It never links a sealed runtime to mutable worktree dependencies.
Legacy deploy behavior is unchanged.

## Canonical artifact

`setfarm.v3-sealed-runtime-manifest.v1` records:

- the exact AcceptedCandidate source revision;
- the exact build artifact hash;
- canonically sorted dependency roots;
- the exact directory topology;
- every launched file's relative path, byte length, SHA-256 content hash, and
  executable bit;
- the total byte count and a canonical manifest hash.

The full manifest is stored inside the atomically renamed sealed directory. The
runtime deployment and health proof carry its hash and evidence reference; the
deploy receipt therefore commits to the same full-tree identity.

Before that rename, Setfarm create-exclusively persists a sibling
`setfarm.v3-seal-authority.v1` outside the runtime root. This immutable CAS binds
the run, candidate, AcceptedCandidate source, build artifact, sealed-runtime
reference, and manifest hash/reference under its own canonical authority hash.
An existing runtime root is never allowed to create or replace its authority;
adoption requires the pre-existing authority and verifies the root against it.

## Materialization and verification

Dependency copy dereferences symlinks into ordinary files/directories and is
bounded by file, directory, per-file byte, and total-byte limits. Special files,
cycles, destination conflicts, and source drift fail closed. After source,
build output, and dependencies are copied, Setfarm captures the full-tree
manifest, writes it durably, makes the tree read-only, and atomically renames it.
Verification also requires canonical read-only file and directory modes.

Replay and health read the stored manifest, verify its source/build/dependency
bindings, recapture every launched byte, and require an exact manifest match.
Any source, build-output, dependency, manifest, or executable-mode drift is a
terminal identity error for that deploy attempt.

If authority exists without a final root after a pre-rename crash, retry may
materialize only the same manifest identity. Concurrent identical writers share
the authority CAS and verify the single rename winner; conflicting writers fail
without deleting either authority or final-root evidence. Runtime cleanup keeps
both artifacts so retry and investigation retain the original authority.

## Tests

Focused tests prove that worktree dependency mutations cannot affect the served
runtime, and that sealed source/dependency mutations are rejected during replay
and health. Crash-window tests reject a coordinated runtime-tree/internal-
manifest rewrite, adopt an unchanged root, and serialize identical concurrent
materialization. Schema tests reject mismatched runtime/health manifest bindings.
