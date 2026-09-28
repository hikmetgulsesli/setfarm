# Preserved-lineage recovery after device drift

> Superseded on 2026-09-28 by the owner's explicit decision to dispose of the
> old archives. See `2026-09-28-operator-archive-abandonment-design.md`.
> This document remains historical context, not rollout authority.

## Decision and evidence

The existing selected checkout cannot perform an ordinary in-place build:
eight active generations already fill its fixed capacity. Its immutable
completion records contain `st_dev=16777230`, while the current archives are
on `16777231`. An ad hoc read-only census matches paths, inodes, metadata,
and file digests, but it was not a full strict-ledger or atomic-read validation.
No contemporaneous record binds the old numeric device to the present APFS
volume UUID; the old numeric device now denotes another volume. Neither a
comparator exception nor a rewritten completion may turn
this into physical continuity. Retention prepare/resume target permanent
disposition and are out of this preserved route.

The chosen direction is the existing preserved-deployment cutover design: a
separate physical clean-main checkout receives its own ordinary finalized
build and ledger. The current `/private/tmp` clone proves source validity
only; it is outside the workspace path accepted by the selected CLI observer
and must not be selected. A future eligible deployment clone needs its own
ordinary build under the supported workspace path. The old selected checkout,
`dist`, immutable ledger, eight
archives, and all development/deployment worktrees remain visible and
unchanged. A successful independent build proves source/build validity only;
it never selects the new executable or authorizes the service transition.

## Safety contract

The fixed CLI symlink is the selection point used by both Setfarm LaunchAgents.
Any transition must bind its exact current link bytes/inode, resolved old
target and checkout, finalized new checkout/build, unchanged launcher plists,
controller owner, open refusal intent, and current process/listener state. The
new checkout must be clean `main == origin/main` with canonical origin and
terminal `BUILD_INFO` matching HEAD. No copied `dist`, alternate service port,
archive disposal, empty same-root ledger, branch/ref pretense, direct-main
commit, or runtime-guard exception is allowed.

Before link selection, the LaunchAgents still invoke the retained old
executable, which does not understand the new cutover intent. An independent,
continuous old-entrypoint and old-writer exclusion proof must cover intent
publication, both bootouts, launchd retries/reboot, and already-loaded old
modules. The current old executable's BUILD_INFO refusal is not that proof.
No such continuous fence has been established on this host. If its eventual
activation requires role, grant, credential, or access-control changes, that
step is outside standing authorization and needs separate direction.
After new CLI selection, its cutover-intent reader must durably refuse ordinary
starts through crashes until ready-bound completion. A cutover intent is
published before any service or link effect, but publication alone is not
old-writer exclusion. The controller holds exclusive ownership; each exact effect has
an immutable intent and completion and is preceded/followed by fresh held
physical, launcher, process, listener, and DB checks. Unknown or ambiguous
state fails closed; a record does not itself grant dispatch. The old spawner
and dashboard are drained only as exact authenticated targets. Because the
current dashboard is already exited, that branch needs separately tested
positive process/listener absence and exact loaded-launcher state; no old PID
or bootout completion may be fabricated. The CLI link
changes atomically only after both are quiescent and its original identity is
rechecked. The new dashboard is authenticated on port 3333, and the spawner
launcher is restored loaded-idle while ordinary starts still refuse. Completion
requires the existing sealed cold/Task6A ready authority, not dashboard HTTP
health or a zero-row sample alone. Mission Control 3080 and OpenClaw 18789
remain untouched.

The existing two-effect service-quiescence records/store are history-only: no
owner-held bootout controller or actual service effect is implemented. Their
`recorded-complete` value must not be reinterpreted as whole cutover completion.
The open-intent ordinary admission reader currently refuses until a separately
versioned, authenticated ready-bound completion reader is implemented. CLI
selection, service restoration, and final ready-bound completion need distinct
records and crash-recovery tests. If Task6A ready later requires live
PostgreSQL role, grant, credential, or other access-control changes, that
specific step needs separate authority; the approved deployment cutover does
not grant it. No live effect is authorized by this design document or by PR
#239's advisory device
classifier.

## Required proof sequence

1. Private tests prove the new selected-build candidate and cutover plan bind
   the exact old link/checkout and a separately built new checkout; old eight
   archives remain visible and unchanged.
2. Private tests prove a crash-safe, one-use controller/effect journal with
   fail-closed recovery across every service/link boundary, including ABA,
   replacement PID, partial publication, stale owner, and wrong new build.
3. Broad source, DB, process, cold, and Task6A integration gates pass on the
   exact reviewed source. The ordinary clean-main build succeeds in the new
   physical checkout without touching the old lineage.
4. A fresh real-host preflight authenticates the selected old state, all
   launchers and listeners, continuous old-entrypoint/DB/OS writer exclusion
   across the pre-link interval, positive physical+
   PostgreSQL owner classification, and the new build. Only then may a
   code-owned, journaled service/link transition be considered.
5. Reverify the running new services and ready-bound successor. Preserve old
   lineage for later separately authorized disposition; do not count it as
   absent or silently exempt it from physical census.

## Current boundary

As of main `f59830a9`, only a preliminary source-validity build has been
observed in `/private/tmp/setfarm-pr238-clean-main.QfAmDr`; an eligible
workspace deployment clone and the selection/effect and Task6A gates remain
incomplete. Continuous pre-link old-writer exclusion is also unproven. The
selected dashboard remains down. No host
cutover, link change, archive move/delete, retention resume, credential or DB
grant change is permitted from this evidence.
