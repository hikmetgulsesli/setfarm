# Preserved-deployment cutover design

Status: owner-approved September16; implementation in progress. Design approval
is not executable live authority or proof that qualification has passed.

## Objective and approved scope

Unblock the current Setfarm internal-production recovery without deleting any
retained generation. On September 16 the owner approved expanding the transition
beyond spawner-only maintenance after being told it could include a short
dashboard restart. Preserve Mission Control on 3080 and OpenClaw on 18789;
restart only Setfarm dashboard on its existing 3333 port when qualified.

The old deployment remains at
`/Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap`.
Its source is `1c7505476a6dbda8e45960aeb4a04a6a296573ae`, its retained executable
is `eef9f6c4059daa487a5a367f8f1609b1d1e39142`, and it has eight retained archives.
Do not move, replace, copy over, or delete its dist or retention ledger.
The prior ordinal-6 disposal is not part of this route.

## Evidence and alternatives

1. **Recommended: fresh normally built checkout, controlled service cutover.**
   Preserve old deployment and archives; change the fixed CLI symlink and move
   dashboard execution to a verified new build on the same port. This avoids
   needing an archive slot before obtaining a current executable.
2. **Stopped-spawner archive disposal.** The previous design requires retained-
   compatible durable admission refusal that this host does not have. The old
   parser's missing historical Git object is an error, not such authority. Do not
   continue wiring live disposal merely because its journal primitives pass.
3. **Copy new dist into old deployment or increase the archive limit.** Rejected:
   either evades the guarded build/rotation contract instead of satisfying it.

Current source derives its execution root from its own module path. Runtime
authority remains at the fixed workspace data root; Mission Control remains at
the fixed sibling repository. The detached service profile uses the stable
`~/.local/bin/setfarm` launcher. Thus a new checkout is supported structurally,
but dashboard and CLI must both authenticate against that checkout before cold
recovery. A new checkout alone does not satisfy those conditions.

Normal builds require clean `main == origin/main`, canonical origin, supported
physical modes and finalized build authority. A separate physical clone is
preferred over forcing main into two linked worktrees. No direct main commits,
ref edits to pretend a branch is delivered, dirty-build flags or copied output.

## Mandatory additional safety: cutover admission refusal

The current ordinary guard permits absent cold history. The cold observer also
requires the spawner launcher loaded and idle, no spawner family and no singleton
lock. Therefore neither bootout alone nor holding the reservation helper solves
the complete transition: the launcher must eventually be restored before cold
intent publication, and a held lock would make cold preflight fail.

Add a separately versioned, code-owned cutover intent and refusal-only observer
before any live cutover. Publish the intent durably before the CLI target changes.
It binds old and new physical checkout/build identities, the observed original
CLI link, unchanged launcher configuration hashes, fixed port, and maintenance
owner history. Use a fixed workspace authority root, not a caller-selected path.
The internal maintenance journal is reusable history infrastructure, not existing
live authority. Its death-hash commitment alone never authorizes file reclamation.

For this protocol, maintenanceIntentHash resolves a cutover-specific maintenance
intent, not the archive-maintenance grammar requiring candidateCompletionHash.
It commits the authenticated controller-source hash and a domain-separated plan
projection (old/new deployments, CLI and launcher commitments, port3333), excluding
maintenance and self pairs to avoid a hash cycle. A pure relation check binds that
history to the final cutover intent; fresh ownership/exclusion remains separately
required. Never invent an archive candidate to populate the preserved route.

In the new executable, every ordinary spawner start must observe this intent
before singleton/PID publication and before owner producers. An open intent,
malformed fixed authority or ambiguous partial publication refuses ordinary
admission. Refusal survives controller death and reboot. Absence preserves the
existing non-cutover behavior; publication must be proven before selecting the
new CLI target. No environment variable, supplied PID or caller boolean may
bypass refusal.

Existing authenticated direct/cold sealed startup routes remain distinct from
ordinary startup. They may proceed only through their existing validated intent,
dispatch and process-identity protocol; a cutover record alone cannot authorize
them. Ordinary admission remains blocked until the existing Task6A ready authority
is authenticated and a matching cutover completion is durably committed. Do not
replace that authority with a success label or mere dashboard health.

This is a necessary in-goal root fix: it closes the gap between activating the
new CLI and legitimately publishing the existing cold intent. It is not a weaker
zero-owner proof and does not change V1/V2 retention or cold proof semantics.

## Transition sequence

1. Deliver the scoped refusal/controller code through reviewed PR and its required
   gates. Create a new physical deployment checkout, clean main at the actual
   canonical remote revision. Run the ordinary full build there; authenticate
   finalized output and source independently. Keep the old services unchanged.
2. Preflight existing shared runtime/DB zero-owner conditions, exact CLI target,
   dashboard PID/birth/executable/listener, launcher configurations, available disk
   and the new build. Record the approved source/build and physical paths. Never
   print secret environment values or copy credential files into the checkout.
3. Durably record cutover intent and controller ownership. Temporarily unload only
   the spawner and dashboard automatic launchers, preserving their original plist
   bytes and configuration. Authenticate each exact loaded process and drain old
   launcher/spawner contenders before changing the CLI. Terminate only explicitly
   recorded exact targets; never kill by substring or remove a live/reused PID file.
4. Stop the exact old dashboard, verify its exit and port release, and atomically
   replace the previously authenticated CLI symlink with the verified new target.
   Journal intent before and completion after each effect. Preserve the original
   link target and old build; refuse concurrent link/configuration drift.
5. Restore the unchanged dashboard launcher, start the new dashboard on 3333 and
   authenticate its real loaded source/build, process family and HTTP output.
   Mission Control and OpenClaw remain unchanged. No alternate port is introduced.
6. Verify ordinary starts of the new executable are durably refused. Restore the
   unchanged spawner launcher and wait for an authenticated loaded-idle state.
   Short refused entry processes are not a zero census; retry the full observation
   after they exit. No synthetic daemon, lock or fabricated zero-owner record.
7. Invoke the existing cold recovery from the verified new checkout only after
   its unmodified preflight succeeds. Obtain the real sealed successor and proceed
   through the existing current-entry/Task6A protocol. Reobserve source, launcher,
   owner and runtime state at each externally visible transition.
8. Commit cutover completion only against actual ready admission authority and
   the matching new services. Revalidate ordinary admission and unchanged ports.
   Old dist and all archives remain preserved; cleanup is a separate future task.

## Crash recovery and rollback limits

The controller is the sole writer. Each side effect has immutable intent and
completion evidence. Resumption authenticates the physical partial state and
fresh process ownership; historical receipts are not a current lease. Unknown,
alive or reused owner identities refuse takeover. A record cannot authorize
unlinking another owner's lock or signaling a newly reused PID.

Before CLI replacement, recovery may restore the original launchers after proving
their original targets and configuration. After replacement, preserve the new
CLI and its durable refusal until recovery is qualified. Do not blindly restore
the old CLI: the retained executable cannot interpret the new cutover/cold journal.
Old files being preserved does not mean every phase permits full rollback.

If the new dashboard fails, an exact old-dashboard-only restart may restore the
3333 UI while keeping spawner launching suspended and cutover open. This is a
degraded service fallback, not successful cold recovery; the mixed-root dashboard
must still fail the cold preflight. No generic finally block restores spawner.

Bootout is not reboot persistent. Recovery after reboot must authenticate the
currently selected CLI, both loaded launcher states, global old/new process
families and open intent. Before cutover old behavior remains unchanged; after
cutover scheduled ordinary starts select the new executable and refuse. Any
old executable that was loaded before link replacement must have been drained.
Reappearance of an old family blocks recovery; a path change does not upgrade
already-loaded modules. The contract covers cooperative platform entrypoints,
not an arbitrary same-user actor deliberately launching a retired executable.

## File map and boundaries

- `tests/internal-production/baseline-service-restart-helper-v1.test.ts`: keep
  positive helper fixtures physically canonical under the isolated runner's
  sanitized temp environment; preserve all production guards and assertions.
- New `src/internal-production/baseline-deployment-cutover-process-observation-v1.ts`:
  global old/new-neutral process-family and fixed3333 listener bracket; exact
  per-process executable paths may differ across Node versions. This diagnostic
  grants neither executable build provenance nor signaling/zero-owner authority.
- New `tests/internal-production/baseline-deployment-cutover-process-observation-v1.test.ts`:
  all-root contenders, birth drift, listener ownership and Node-version tests.
- New `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`:
  fixed two-launcher read-only physical/configuration bracket without deployment
  root agreement; secret-free durable and transient commitments. Loaded-idle
  launcher state is not an absent-process or zero-owner proof.
- New `tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts`:
  real plist conversion, config drift, secret containment and close-loss tests.
- New `src/internal-production/baseline-deployment-cutover-cli-observation-v1.ts`:
  read-only fixed CLI link and physical target commitment. This removes the
  premature same-root prerequisite from diagnostic preflight only; it grants
  neither authenticated source/build identity nor link replacement authority.
- New `tests/internal-production/baseline-deployment-cutover-cli-observation-v1.test.ts`:
  physical relative/absolute link, containment, drift and descriptor-loss tests.
- New `src/internal-production/baseline-deployment-cutover-records-v1.ts`: pure
  strict cutover intent and cutover-specific historical owner-chain codecs,
  separate from live observation, ownership capabilities and publication.
- New `tests/internal-production/baseline-deployment-cutover-owner-records-v1.test.ts`:
  independent canonical owner history, predecessor/binding and hostile-input tests.
- New `src/internal-production/baseline-deployment-cutover-v1.ts`: fixed-root strict
  intent/status validation and read-only ordinary refusal; static imports only.
- `src/spawner.ts`: invoke refusal before ordinary startup effects, while keeping
  independently authenticated sealed startup paths intact.
- New `scripts/deployment-cutover.mjs`: code-owned journaled preflight/cutover/
  recovery controller with bounded exact process and symlink operations. It must
  not expose arbitrary source roots, commands, target PIDs or secret arguments.
- Reuse reviewed maintenance journal/owner observation primitives only where
  their historical/physical contract fits. Add physical owner-death evidence and
  safe release/recovery semantics before any live cleanup that needs them.
- New focused script and internal-production tests: real temporary filesystem,
  isolated process fixtures and actual startup branch qualification.
- Baseline implementation plan: record this causal deployment-root transition
  and its relation to unfinished Task6A/7/8. Do not relabel the whole goal complete.

## Required proof before live effects

- Clean-main ordinary build and authentic output in the new physical checkout;
  no access to or mutation of old retention stores during that build.
- Complete temporary integration: old-root service observation, journal before
  CLI effect, atomic link response loss, new dashboard authentication, loaded-idle
  spawner refusal, real cold-protocol handoff, ready-authority-bound completion.
- Crash/reboot at each edge, including after link replacement but before dashboard
  startup or cold intent; old-loaded contender drain and late-family refusal.
- Correct refusal before any ordinary singleton/PID/producer effect, malformed
  journal fail-closed, absent journal compatibility, sealed-route authentication,
  and rejection of a forged ready/completion record.
- Live/reused/ambiguous owner preservation, symlink/ancestor replacement, unexpected
  dashboard listener and failed restart. No broad kill, forced Git operations,
  disabled overrides, plist permission changes or secret modifications.
- Independent implementation review, focused tests, clean build and applicable
  acceptance gates. Any missing proof prevents live execution, even if a basic
  HTTP check passes. Ports 3080/3333/18789 remain unchanged throughout the design.

## Current qualification

Source and fresh read-only host checks support this route's checkout/launcher
compatibility. Both HTTP services returned 200 on September16. Available disk was
approximately19GiB; recheck the build/dependency space budget before preparation.
No new checkout, service stop, link replacement, archive deletion or admission
write has been performed. Ordinary refusal, immutable intent publication and
cutover-specific maintenance relation codecs now have focused test coverage.
The live controller, completion and complete crash/handoff qualification remain
unimplemented; these storage/history slices do not authorize live cutover.
