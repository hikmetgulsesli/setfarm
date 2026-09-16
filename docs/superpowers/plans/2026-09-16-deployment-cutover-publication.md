# Deployment Cutover Publication Implementation Plan

> **Execution:** Approved inline primary-owner implementation in the existing
> isolated worktree, with independent read-only review. The executing-plans
> skill is unavailable; retain serialized test-first execution as the fallback.

**Goal:** Durably publish a fixed-root refusal intent without granting live
controller authority, and accept only exact finalized replay.

**Architecture:** A synchronous internal publisher owns the complete physical
directory chain and creates only the cutover root beneath existing authenticated
data/baseline directories. A private exclusive staging file is fsynced, linked
without replacement, authenticated, unlinked only by its current owner and
followed by a directory fsync. An independent observer authenticates the result.
Existing partial state refuses; this task does not reclaim or repair it.

**Tech Stack:** TypeScript ESM, Node filesystem, fresh child-process fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Global constraints and causal relation

This implements durable refusal before selecting the new executable. No live
invocation is authorized by this storage slice. Preserve the old checkout and
eight archives; do not change CLI links, launchers, services, DB or ports.
No caller-selected root, environment override, ownership boolean or public CLI.
Input is a historical strict intent, not authenticated current controller power.
The maintenanceIntentHash remains an opaque commitment here; do not manufacture
an archive candidateCompletionHash to bind it. Truthful controller-history
binding, fresh exclusion, recoverable owner death, completion and crash/handoff
qualification are separate required controller work before live publication.

## File map and interface

- Create `src/internal-production/baseline-deployment-cutover-publication-v1.ts`:
  storage-only `publishDeploymentCutoverIntentV1(intent: unknown):
  DeploymentCutoverIntentV1`. Use existing encode/parse codecs, fixed workspace
  resolver and independent read-only observer. Never call external processes.
- Create `tests/internal-production/baseline-deployment-cutover-publication-v1.test.ts`:
  real temporary home/project roots and fresh process imports. Inject filesystem
  faults only in children, preserving actual writes, links, reads and fsyncs.
- Existing observer, codec and ordinary-startup behavior remain unchanged.

## Task: immutable publication and finalized replay

- [x] Write physical publication/replay/conflict tests first. Removing the
  publication or replacing a committed intent must fail these behaviors:

```ts
assert.equal(result.state, "open");
assert.deepEqual(fs.readFileSync(intentPath), originalIntentBytes);
assert.deepEqual(fs.readdirSync(root), ["intent.json"]);
assert.equal(fs.lstatSync(intentPath).nlink, 1);
assert.equal(fs.lstatSync(intentPath).mode & 0o7777, 0o600);
assert.equal(replayedInode, originalInode);
assert.equal(freshOrdinaryStart.error, "DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
```

- [x] Run `node --import tsx --test tests/internal-production/baseline-deployment-cutover-publication-v1.test.ts`
  and confirm the missing publisher is the expected RED cause.
- [x] Implement fixed-root publication. Validate input before filesystem effects.
  Require existing physical data and baseline parents owned by current uid,
  same device as workspace and not group/world writable. Create only the final
  root with mode0700 and fsync its parent before writing intent staging.
  Hold/pin every ancestor descriptor; revalidate before and after effects.
  If mkdir reports EEXIST, use the independent observer for strict exact replay;
  no mutation of empty, staging, malformed or conflicting roots.
- [x] Write stage with O_CREAT|O_EXCL|O_NOFOLLOW and mode0600, fsync and bounded
  readback; link to intent.json without replacement. Verify file inode/bytes,
  exactly two authenticated links, original stage identity and exact inventory
  before unlinking only that stage. Fsync root, consume descriptors before
  close, drain all untouched descriptors and preserve errors. Any close error
  poisons subsequent publication in the same process. Independent observation
  must return the exact intent after successful cleanup.
- [x] Add fault cases after root creation, stage write/fsync, link, owned-stage
  unlink and parent fsync. Fresh observer must never report absence once a root
  is visible; only a fully authenticated intent may be open. Failed calls retain
  all partial evidence and never perform generic cleanup.
- [x] Add symlink/ancestor/inode replacements, unexpected files, foreign links,
  wrong modes, invalid input and close-response loss with descriptor reuse.
  Assert unrelated sentinels and changed evidence survive every refusal.
- [x] Run the complete new file plus existing codec/observer/effect files, noemit,
  English/path contracts and diff check; get independent review. Fix any findings
  with a failing physical regression first. Commit only the reviewed storage
  slice. Do not claim controller/live transition completion.

## Self-review

No service effect or historical-owner takeover is enabled. Finalized replay does
not repair partial publication and does not authorize replacing the CLI. A later
controller must provide qualified recovery of retained partial state rather than
loosening this observer or deleting unknown evidence. Current full P3/retirement
tests qualify8845d2df, not this future module.

## Verification and review

Initial3 publication/replay/partial cases failed because the publisher was absent,
then3/3 passed after implementation. Review found replay only synced the directory,
not existing intent data. Added real file-fsync failure:11/12 passed and replay
incorrectly succeeded RED; pinned fixed descriptor with file/root/baseline fsync
and identity checks corrected it,12/12 GREEN. Expanded physical suite22/22 passed
8579.215166ms. Combined publisher/observer/codec/effect suite63/63 passed,
zero skips,9985.069792ms. Noemit produced no errors; English1499/paths862 and
diff checks passed. Independent final review found no remaining must-fix in
this storage-only slice. No live publication or service effect occurred.
