# Controller PID Reservation Implementation Plan

> **For agentic workers:** Use test-driven-development and independent code review. Writes are serialized by the primary owner; parallel review remains read-only.

**Goal:** Implement the isolated physical publication/ownership component of stopped retention, without exposing live maintenance.

**Architecture:** Publish fully written, fsynced real-controller PID bytes using a no-replace hard link. Retain the original descriptor and validate path, bytes and ancestor identities on demand. Closing invalidates the handle but never removes the fixed target.

**Tech Stack:** Node.js ESM and synchronous filesystem calls; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-15-stopped-spawner-retention-design.md` (approved).

## Global Constraints

- No CLI integration, live lock publication, service stop, archive deletion or admission mutation.
- Real `process.pid` only, generated internally; never write `spawner.pid`.
- Existing target always refuses, including matching bytes. No stale-owner recovery.
- No target cleanup on errors or close. A publication error can have effects and must not imply absence.
- Publication alone is NOT launch exclusion. The later controller must perform the zero-process census and post-census identity bracket, journal owner start identity, and qualify reboot/handoff.
- Physical tests use newly created private temporary directories only.

## File Map and interface

- Create `scripts/build-generation-controller-reservation.mjs`.
- Create `scripts/__tests__/build-generation-controller-reservation.test.js`.
- Preserve `scripts/build-generation-retention.mjs` and all runtime source unchanged.

`publishControllerPidReservationV1(directory)` accepts an absolute physical existing
private directory. It fixes the basename to `spawner.lock` and returns a frozen
`{ path, pid, assertStable(), close() }` handle. `assertStable()` returns no
authority record; it throws after close, file/parent replacement or byte changes.
`close()` is idempotent, marks the descriptor consumed before closing, and performs
no unlink. Caller chooses directory only inside the eventual authenticated adapter;
this internal helper has no command entrypoint.

### Task 1: Test publication and preservation first

- [x] Write tests using `mkdtempSync`, `realpathSync` and `try/finally` cleanup of
  only the returned fixture root. Assert these literal outcomes:

```js
const held = publishControllerPidReservationV1(directory);
assert.equal(readFileSync(held.path, 'utf8'), `${process.pid}\n`);
assert.equal(lstatSync(held.path).nlink, 1);
held.assertStable();
assert.throws(() => publishControllerPidReservationV1(directory));
held.close();
held.close();
assert.throws(() => held.assertStable());
assert.equal(readFileSync(held.path, 'utf8'), `${process.pid}\n`);
```

- [x] Add separate tests for replacement with identical bytes but new inode,
  in-place byte modification, symlink parent, and replacement of an ancestor
  while the immediate directory/file inodes survive. Original and replacement
  files must remain intact after handle close.
- [x] Run `node --test scripts/__tests__/build-generation-controller-reservation.test.js` and observe missing implementation failure.

### Task 2: Implement the physical handle

- [x] Validate the physical ancestor chain to filesystem root using `lstatSync`;
  reject symlinks/non-directories and non-absolute/non-normalized inputs. The
  immediate directory must belong to current UID and forbid group/other writes.
- [x] Create a unique staging file in that directory with O_EXCL/O_NOFOLLOW,
  mode0600; retain its descriptor before other fallible work. Write only
  `Buffer.from(`${process.pid}\n`)`, fsync, and verify descriptor/path bytes and
  identity before linking. Link with `linkSync(staging, fixed)`; never adopt an
  existing target. Verify both paths at nlink2, unlink only the verified staging
  file, fsync the directory, then snapshot final nlink1 identity.
- [x] Retained checks compare dev/ino/uid/gid/mode/birthtime/size/mtime/ctime/nlink,
  read bounded exact bytes from the original descriptor, and bracket that read
  with descriptor/path/ancestor checks. Error handling closes the owned descriptor
  once and preserves any fixed target; staging remnants on failure are not an
  authority for recovery. Do not create parent directories.
- [x] Run the focused suite; fix implementation without weakening test outcomes.

### Task 3: Qualify old-executable compatibility and review

- [x] Extract the retained old `processIsAlive` and `acquireSpawnerSingletonLock`
  functions using TypeScript AST from pinned Git `eef9f6c4`. Execute only these
  functions in a child Node process against the fixture lock. The parent holds
  its real PID reservation; the child must exit0 without reaching an acquisition
  marker. Do not import the old spawner or use its real runtime directories.
- [x] Revalidate the held reservation after child exit. No source transformation
  outside this isolated child script; no fake parent/daemon PID.
- [x] Run both reservation and existing startup qualification tests together,
  `node --check` the module, and `git diff --check`.
- [x] Independent reviewer checks source/filesystem lifetime and test evidence.
  Commit the scoped reviewed slice; no claim of full retention readiness.

## Remaining integration boundaries

Durable intent/owner-start binding, ambiguous-close recovery, census completeness,
post-census exclusion, launchd suspension/restoration, versioned zero-reference
proofs and complete build/sealed handoff remain separate required controller work.
This helper deliberately cannot reclaim or release the fixed lock, or erase an
archive. The approved live workflow remains unavailable until those gates pass.

## Verification evidence

- Initial test-first run failed because the module did not exist (exit1).
- Added physical publication/identity module; initial five tests passed.
- Actual retained old singleton ran in a distinct process and exited as duplicate;
  parent reservation revalidation passed afterwards.
- Isolated-child link-after-effect and directory-fsync-after-effect injections
  preserved the fixed target and left zero tracked open descriptors.
- Independent review identified lost primary error if directory fsync and close
  both fail. Added reproducer: RED reported `INJECTED_CLOSE` instead of aggregate.
  Fixed directory cleanup to retain both causes, close once, and preserve evidence.
- Latest combined run: 15 tests, 15 pass, 0 fail, exit0, 810.378 ms. Ten physical
  tests plus five prior admission characterizations. No live modules invoked.
- `node --check scripts/build-generation-controller-reservation.mjs`: exit0.
- English contract: 1,477 files; path contract: 851 files; both exit0.
- No TypeScript compilation needed for this disconnected ESM module; physical
  smoke tests execute it directly. No full-build or full-P3 success claimed.
- Scoped re-review resolved the error-preservation finding; no remaining Critical,
  Important or Minor findings. This plan ships with the reviewed module/tests.
