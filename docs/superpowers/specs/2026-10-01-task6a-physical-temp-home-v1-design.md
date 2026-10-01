# Task6A physical temporary-home fixtures

## Cause and bounded scope

The sixth genuine private ALL on clean main a7d36ddc stopped at two positive
pre-schema tests. With TMPDIR removed, Darwin tmpdir() returns /tmp, a system
symlink. Injecting that lexical path as a fake owner home violates the existing
nofollow ancestor contract. Both production refusals are correct.

Root continues under standing owner authorization. This test-only correction
is causally necessary for the same cutover verification objective, not a new
runtime feature. The failed epoch and its source/build/root remain retained.

## Options and decision

1. Resolve only the freshly owned positive test homes to their physical paths
   (selected): smallest change; production ancestry rules remain unchanged.
2. Preserve TMPDIR in the private runner: environment-dependent fixtures remain
   fragile and the scrubbed invocation would no longer expose this mistake.
3. Accept /tmp aliases in production: unnecessary authority expansion; rejected.

## Contract

Use realpathSync(mkdtempSync(...)) for the two positive homes. Keep that exact
physical path for fixture creation, child injection and owned cleanup. Do not
canonicalize a caller-provided home in production or child injection helpers.

Add an explicit owned linked-home -> . fixture for each consumer. Ordinary
preflight must refuse with TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED; the
fixed-operation probe must refuse with
INTERNAL_PRODUCTION_BASELINE_WORKSPACE_ANCESTOR_IDENTITY_INVALID. Neither may
produce success output or modify the directory/operation. Existing malformed,
ai/root/file symlink, canonical checkout and read-only assertions stay intact.

## File Map

- tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts:
  physical positive homes and explicit symlink-home negatives.
- This spec and the matching plan: causal scope and verification receipts.
- No production source, package scripts, dependencies, manifests or runtime
  guard changes.

## Verification and delivery

Reproduce both failures with TMPDIR and database URLs removed before editing
the tests. After correction run the focused file both scrubbed and inherited
TMPDIR, then the whole internal-production:pure group scrubbed. Commit on the
scoped branch, build only when clean, obtain independent read-only review and
deliver a normal protected PR. A new clean-main build follows delivery.

No focused result repairs the historical failed ALL. A future ALL needs fresh
exact pre-effect review, an independent constructor root and definite closure.
This change grants no native/protected-origin/schema/live cutover authority.
