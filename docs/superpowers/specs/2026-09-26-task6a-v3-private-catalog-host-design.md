# Task6A V3 private catalog host design

## Boundary

PR #203 delivered an import-inert, read-only V3 selected catalog projector but
no authenticated host path. A direct feature-worktree read-only SQL test proved
syntax only; it could not attest the selected clean-main source, held launcher
bytes, or exact shared private URL. This slice connects that projector to the
existing three-launcher holder and clean-main bootstrap without changing V2
output or promoting the V3 detail hash to permission/owner authority.

The new result remains `diagnostic-only/not-granted/unverified`. No object name,
ACL entry, membership row, URL, credential, SQL error, or private exception is
serialized. A deterministic detail hash is a commitment, not encryption or an
independently recomputable public proof. Existing same-UID launchers and the
shared `setrox` superuser continue to block live admission.

## Held observation

Add one qualified private V3 method to the existing Setfarm launcher holder.
It requires both Setfarm launcher URLs byte-equal and the Mission Control
holder to attest that same URL and role before and after the awaited V3 DB
observer. It compares the decoded URL user to the held role before calling the
observer; the observer verifies its session role privately and returns no role
field. Any exception poisons the holder and is sanitized. Existing methods and
their order remain unchanged.

A separate V3 host composer reuses the held three-launcher V2 sequence. It
invokes the V3 method once after V7 and writer snapshots, inside the first to
second physical catalog pass. It validates the exact frozen public V3 shape,
counts, labels and canonical diagnostic hash, but treats the private detail
hash only as an opaque 64-hex commitment. It binds the result into its own
versioned canonical hash and closes both holders on success and failure. It
does not copy the V2 coarse catalog or infer effective privileges.
The wrapper tracks its own awaited V3 callback: if a faulty physical observer
returns before that callback settles, it retains the launcher holders until
settlement and then refuses. A late rejection is handled, never detached.
If an observer retains the callback without invoking it, a post-return call
must reject before starting V7, writer or V3 work on closed holders.

The additive `inspect-task6a-private-catalog-host-v3 --json` bootstrap verb
authenticates exact clean-main source/build before import, validates the public
V3 and nested V2 projections independently, rechecks pinned files before and
after observation, and emits only sanitized refusal on failure. It cannot be
run from a feature worktree. The legacy V2 verb and outputs remain unchanged.

## File Map and verification

- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`:
  additive private held V3 method, role/URL pre/post binding.
- `src/internal-production/baseline-task6a-private-catalog-host-v3.ts`:
  separate held-host composer/zero-input adapter and strict public projection.
- `scripts/deployment-cutover.mjs`: additive authenticated verb and exact result
  gate; no V2 route rewrite.
- Adjacent V3 host/bootstrap tests and `package.json`: RED/GREEN held order,
  callback/role/count/hash/drift/close failure, worktree refusal and redaction.

Run focused, pure, cutover/script contracts, migration/source manifests,
TypeScript and independent read-only review. After exact-head PR delivery,
perform normal preserved clean-main build and a sanitized no-write V3 host
probe. No role/grant/credential/plist/service/selected CLI/migration change,
physical owner, continuous fence or Task6A cutover is in scope.
