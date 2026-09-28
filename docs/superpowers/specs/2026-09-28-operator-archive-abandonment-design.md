# Operator archive abandonment after device drift

## Decision and scope

The owner explicitly does not want the old build archives and wants the
selected Setfarm installation restored. The selected clean-main checkout has
eight active rotation completions, ordinals 6–13. Their recorded device is
`16777230`; the present archives are on `16777231`. The previous advisory
census found matching inodes, paths, modes, links, and file content but did
not prove historical volume continuity. The original volume UUID was not
recorded. Accordingly, a new operation may authorize abandonment of these
claims, but it must never claim that the old and new devices are identical.

The exact disposal targets are the eight ledger-named `.dist` directories in
the selected checkout's `.setfarm/build-generations-v1`. The selected `dist`,
source checkout, immutable completion ledger, Git worktrees, deployment
clones, database, and other services are not disposal targets. A separate
workspace-eligible clean-main deployment clone has already completed an
ordinary build at `f59830a9`; it is a verified standby, not the selected CLI.

## Contract

Create a distinct, explicit, versioned operator-discard command. It has no
caller-supplied path or relaxed retention mode. Before its first effect it
must authenticate the clean selected root, immutable completion chain and
exact active archive set, independently bound and no-follow inspect each
physical tree, compare every non-device identity and content field with its
completion, and observe the device-only drift consistently across at least
two complete inventories. The advisory inspector currently uses a third
whole-tree inventory after the first two to detect late file and nested
directory changes; this is still not an atomic snapshot or dispatch authority. It must
prove no live process, launcher, loaded runtime, current build, Mission
Control, or database owner references an archive, with fresh checks at each
effect. A changed field, ambiguous observation, other device pattern, or
reference fails closed. The existing ordinary retention and build scanners
remain strict.

One immutable batch commitment binds the original completion tip, exact eight
ordered completion pairs/paths, and already-terminal historical dispositions.
A separate, chained operation for each archive binds that batch commitment,
its own freshly observed current inventory, and the explicit abandonment
decision. Full inventories are not embedded together in one record because
the authority-record byte cap is 1 MiB. Each archive is quarantined and erased
through bounded no-follow steps with
durable before/after records, one exact target at a time. Crash recovery
adopts only matching prior records and observed physical state; it must not
reinterpret unknown absence as success. A new terminal disposition schema
retains the historical completion identity and separately records the current
device/physical erase evidence. Both the retention and build scanners accept
only that fully authenticated terminal schema. The retention scanner must
resolve the full new operation, candidate index, receipt, erase chain, and
cross-eight batch commitment; the writer must agree with that strict closure.
A parser or terminal flag alone is insufficient. A partial batch still blocks
ordinary build; all eight terminal dispositions unblock it. Historical
records are never rewritten, ordinary retention's newest-two protection is
unchanged, and an unindexed archive still blocks.

After disposition, the selected checkout may run its normal `npm run build`.
That normal build can rotate its prior `dist` into one new archive; it is not
one of the eight abandoned historical archives and must itself be disposed
through the same explicit operator path before claiming zero old archives.
Before the selected `dist` is rotated, a separate durable service-quiescence
operation must exclude both loaded Setfarm launchers and every old/new ordinary
start continuously through build, crash, launchd retry/reboot, and restoration.
It must drain exact old processes and prove zero DB/OS owners. Merely observing
the current stale-build runtime-guard failure is not exclusion. The normal
build is a live mutation, not a post-disposal check: its prepare phase moves
the old `dist` before contracts, compilation and finalization. A private
exact-host-shaped rebuild/handoff test and prebuild checks for selected `dist`,
disk/ordinal capacity, source/ref state, and contract/compile inputs are
required. A failed or interrupted build must remain fenced and recoverable;
the fixed CLI must never be treated as ready merely because a prepared `dist`
exists. Live service restoration requires matching terminal build metadata,
clean `main`, exact selected CLI, zero stale process owners, and
HTTP/DB/launcher evidence. No
runtime guard, test, owner, or safety gate is bypassed.

## Current boundary

As of this design, no archive has been moved or deleted and no service link
has been changed. The clean standby build alone does not restore the selected
services. Implement and verify the transaction in private fixtures, deliver
through reviewed PR, then run fresh exact-host preflight before any live
disposal or build.
