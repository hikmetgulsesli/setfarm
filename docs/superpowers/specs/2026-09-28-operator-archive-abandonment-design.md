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
workspace-eligible clean-main deployment clone has completed an ordinary
build at merged `main` `75a597e0`; it is a verified standby, not the selected
CLI. The selected source checkout is also at `75a597e0`, but its `dist` is
still the older fixed-CLI target and cannot pass the current build guard.

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

Darwin has no atomic conditional unlink-by-inode. A descriptor-relative
`fstatat`/`unlinkat` helper can hold no-follow parent directories and reject
changed names before and after a syscall, but cannot itself exclude a
same-UID basename replacement in the final interval. Live destructive
effects therefore also require a continuously held, independently enforced
single-writer/ordinary-start exclusion; a transient `lsof` or path `lstat`
sample is not that exclusion. Existing Darwin filesystem fixture kernels are
test-only (`PRODUCTION_AUTHORITY_V2=0`) and cannot be promoted by import.

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

The earlier proposed post-disposition `npm run build` in the selected checkout
is superseded by the OS fence feasibility audit below. That ordinary build
would rotate the prior `dist` into one new archive before compilation and
cannot be run live under the current same-UID topology. Any eventual
selected-build or staged-promotion protocol must account for that prior
`dist` with its own explicit disposition before claiming zero old archives.
Before the selected `dist` is changed, a durable service-quiescence operation
must exclude both loaded Setfarm launchers and every old/new ordinary start
continuously through build or promotion, crash, launchd retry/reboot, and restoration.
It must drain exact old processes and prove zero DB/OS owners. Merely observing
the current stale-build runtime-guard failure is not exclusion. The normal
build is a live mutation, not a post-disposal check: its prepare phase moves
the old `dist` before contracts, compilation and finalization. A private
exact-host-shaped rebuild/handoff test and prebuild checks for selected `dist`,
disk/ordinal capacity, source/ref state, and contract/compile inputs are
required. A failed or interrupted build/promotion must remain fenced and recoverable;
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

## OS fence feasibility audit (2026-09-29)

Authorization update (2026-09-30): the owner reaffirmed full authority in
response to the concrete request for OS/PostgreSQL identity separation,
protected deployment paths, and scoped role/credential/access changes. The
Task6A transition plan already records that scope's explicit 2026-09-27
approval. Proceed with implementation and private qualification; reviewed
live effects remain conditional on their technical gates, not another
request for the same authority.

The owner approved a temporary OS-level execution/access-control fence for
the selected installation. That approval does not make the current same-UID
build safe to run. The selected checkout, fixed CLI symlink under `$HOME`,
archive root, and ordinary launchers are owned by the same `setrox` UID.
`write-build-info.mjs` verifies that the process UID owns every tracked input,
reads the old `dist`, rotates it before compilation, and exposes a new `dist`
incrementally. Denying that UID read/traversal of the old tree stops the
writer too; denying JS execute does not stop `node file.js`. `launchctl`
bootout/disable affects the configured jobs, not direct Node starts. A
root-owned leaf cannot protect the fixed pathname while writable ancestors
under the same user's home can be replaced. The present PostgreSQL role is
also a superuser, so a filesystem-only fence is not an effective writer
capability fence.

An enforceable successor design would have to split the old and new OS and
database writer identities, protect the complete selector/authority path
with an independently controlled promoter, stage and attest a complete build
before promotion, and deny the old identity's DB and physical writer
capabilities through crash/reboot and restoration. The current selected-build
observer assumes the CLI ancestor, symlink, and target UID equals its process
UID, and build receipts bind repository/dist physical identities; these
contracts need versioned changes and private exact-host tests before any
staged promotion. Merely copying the clean standby `dist` or chowning the
selected tree is not equivalent to a verified selected build. Denying the old
identity's write capability alone also does not prove the stricter existing
ordinary-start exclusion: a user can copy old JavaScript and invoke Node
outside a protected tree. That requirement needs an enforceable, narrowly
defined deployment-start boundary or separate OS execution policy, reviewed
without silently weakening the gate. This is a
candidate architecture; the owner's authority permits making it concrete,
but grants no technical proof that it is safe to deploy. Until it is reviewed and
proven, the current v3 operator `resume` and selected `npm run build` remain
unsafe on the host.

## First delivery: enforced exclusion lifetime

The v3 discard path must acquire an internal exclusion holder before preparing
authority or resuming effects. Its host implementation initially refuses with
`BUILD_GENERATION_OPERATOR_EXCLUSION_UNAVAILABLE`; there is no environment,
CLI path, caller token, or imported fixture that can grant this capability.
Disposable tests replace only this internal host bridge in their own copied
source. They exercise real inventory, ledger, quarantine and erase code.

Hold the capability across the entire operation. Recheck it immediately before
quarantine rename, every erase syscall, response-loss adoption, and terminal
receipt/disposition publication. A failed recheck leaves the authenticated
prefix visible and recoverable; close observation handles on success and
failure without lifting the future durable OS/DB fence.
This establishes the code-owned lifetime needed to attach an independently
enforced OS/DB implementation and per-effect evidence. It does not claim that
a process lock or a fixture holder excludes host writers.

Terminal readers independently require historical exclusion verification, even
when all operation, index, quarantine authorization, erase, receipt, batch and
disposition hashes match. Present absence and self-consistent hashes cannot
prove continuously held exclusion. The shared strict closure's separate private
historical verifier initially refuses with
`BUILD_GENERATION_OPERATOR_TERMINAL_EXCLUSION_UNVERIFIED`; there is no caller or
environment override. It must later consume independently protected durable
effect evidence, not a freshly acquired live holder. This also protects the
normal writer's strict closure cross-check before sanitation or rotation.
Disposable source-copy fixtures exercise both negative production bridges and
the future lifetime wiring; they grant no host capability.
