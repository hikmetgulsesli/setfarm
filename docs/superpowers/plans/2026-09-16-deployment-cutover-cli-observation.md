# Deployment Cutover CLI Observation Implementation Plan

> **Execution:** Approved inline primary-owner implementation with independent
> read-only review; serialized TDD in the existing isolated worktree.

**Goal:** Produce the fixed CLI-link commitment needed by cutover preflight
without requiring old and new service roots to already agree.

**Architecture:** A zero-argument read-only observer pins physical ancestors of
the owner's fixed `.local/bin/setfarm` link and its workspace-contained resolved
target. Preserve raw link text, bounded-read the regular CLI entry, revalidate
link/target/ancestors, consume descriptors once and return a frozen versioned
canonical diagnostic. Neither layout nor a digest authenticates source/build or
grants controller ownership or permission to replace the link.

**Tech Stack:** TypeScript ESM, filesystem descriptors, canonical hashes and real
temporary filesystem fixtures in fresh child processes.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## File map and interface

- Create `src/internal-production/baseline-deployment-cutover-cli-observation-v1.ts`:
  `observeDeploymentCutoverCliLinkV1()` with no inputs. Return schema,
  cliLinkPath/rawLinkTarget/targetPath/checkoutPath, link and target identities,
  targetBytesHash, pinned ancestor identities and cliLinkObservationHash.
- Create `tests/internal-production/baseline-deployment-cutover-cli-observation-v1.test.ts`:
  physical absolute/relative link compatibility, drift and refusal cases.
- Do not modify the existing strict same-root service census or cold observer.

## Constraints

Only fixed owner-home CLI link may select the observed target. Resolve relative
link text against `.local/bin`; preserve its raw bytes with a UTF8 round-trip
check. Target must be a component-contained workspace descendant ending in
`dist/cli/cli.js`, with a distinct checkout directory. Reject intermediate
symlinks. Normal link0777 mode is not a regular-file permission violation;
require link owner/type/nlink and safe parent directory permissions instead.
Target must be owner-owned, regular, singly linked, nonempty, no group/world
write, at most16MiB and physically on the workspace device. Open with
O_NOFOLLOW|O_NONBLOCK. Read-only: no mkdir, chmod, unlink, services, DB or network.

## Task

- [x] Add absolute and relative physical fixtures with a real CLI file. Assert
  exact target/root, hash of literal fixture bytes, frozen output and byte/inode
  preservation. Run RED before source implementation.

```ts
assert.equal(observed.checkoutPath, checkout);
assert.equal(observed.targetBytesHash, createHash("sha256").update("fixture cli\n").digest("hex"));
assert.equal(fs.readlinkSync(link), originalLinkText);
assert.equal(fs.lstatSync(link).ino, originalLinkInode);
```

- [x] Implement complete held ancestor acquisition, component containment,
  strict link/target metadata, bounded exact read and before/after resolution.
  Hash a versioned immutable body; include no observation timestamp or caller
  object. Close each owned descriptor once before discarding ownership and
  refuse future calls after any close uncertainty.
- [x] Add missing/nonlink, sibling-prefix escape, ancestor and target symlink,
  unsafe modes/hardlinks, empty/oversized/special target, link/target/parent
  replacement and same-inode byte-change faults. Preserve every foreign path.
- [x] Prove close-response loss cannot close a reused descriptor. Verify invalid
  target is rejected before entry bytes are read. Run full new tests GREEN,
  noemit/contracts and independent review.
- [ ] Checkpoint the reviewed read-only unit.
- [x] Perform one read-only live observation after qualification; report only
  paths and commitments, never source bytes or environment secrets.

## Qualification evidence

Initial five tests failed before implementation, then passed. Expanded physical
suite passed20/20 with zero skips; TypeScript noemit exited0 and English/path
contracts passed. Independent read-only review found no must-fix issue.
Live read-only observation resolved the unchanged fixed CLI to the retained
bootstrap checkout. Its target bytes hash was
`c7d7b4750949e5a7115290725a3a6b4bbd6c7e45956079879d7d7df248f2bc47`.
This is diagnostic evidence only, not a build or rollout authorization.

## Scope review

This supplies a physical candidate for the existing cliLinkObservationHash field.
The future controller must still bind it to source/build, launcher/process and
zero-owner observations under exclusion. No link replacement, launcher action,
new checkout or archive cleanup belongs to this implementation task.
