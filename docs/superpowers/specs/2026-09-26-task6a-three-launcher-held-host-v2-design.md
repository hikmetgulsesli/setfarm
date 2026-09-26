# Task6A V2 three-launcher held host diagnostic design

## Decision and boundary

The current host has two intermittent Setfarm LaunchAgents that must be idle, one separate persistent/running Mission Control LaunchAgent, and a strict local PostgreSQL URL shared by all three. The V7 physical/DB pair and the V2 writer database snapshot are independently diagnostic, but they do not yet attest that these three launcher configurations were held and rechecked across the same physical interval. Add a separately versioned host diagnostic; retain every V1/V7 output, migration digest, and the current owner/admission guards. It must never label a sampled interval as continuous writer exclusion or positive physical ownership.

## Composition

The zero-input code-owned observer acquires both the existing two-idle Setfarm holder and the separate Mission Control holder. It qualifies the two Setfarm passive homes using the existing held protocol, rechecks both holders, and starts a held physical catalog. The catalog's exactly-once awaited between-passes callback runs the existing V7 journal/binding database observer and then the V2 writer database snapshot sequentially while both launchers remain held. A narrowly scoped new method on the Setfarm holder privately extracts its already-authenticated agreed local URL and runs the V2 DB call through the holder's existing qualified database wrapper, including passive `idle()` checks before and after the call; configuration `recheck()` alone is insufficient to verify process idleness. It invokes the Mission Control holder's exact-URL check before and after that qualified call, sticks invalid on any failure, and never returns URL/token bytes. The code-owned observer rechecks both holders before and after the physical pair, closes both on every path, and refuses on uncertain cleanup. Mission Control stays out of the V1 two-idle launcher array.

A pure injected-ports composer tests exact callback count/awaiting, holder recheck order, malformed/crossed evidence and cleanup without any OS/DB effect. It validates the existing V7 pair and the new V2 writer snapshot's schema/hash, compares the three observed role names, and returns a frozen canonical-hashed diagnostic with `authority:"diagnostic-only"`, `cutoverAdmission:"not-granted"`, `physicalIdentityProvenance:"unverified"`, and `temporalScope:"held-physical-two-pass-sequential-database-samples"`. The two DB observations are sequential, not an atomic transaction. The Mission Control PID and loaded configuration are rechecked, not continuously monitored. No controller role is invented or fed into the pure topology preflight.

A distinct `inspect-task6a-three-launcher-host-v2 --json` deployment-cutover bootstrap verb must authenticate the clean-main source/build before loading the observer, validate its exact public shape and hashes, and return only the diagnostic body under a versioned key. Any bootstrap, holder, physical, DB, URL, source, or cleanup failure refuses closed with sanitized stage data. The existing verbs and V1/V7 response members are unchanged.

## Test and File Map

- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`: add only a private V2 writer snapshot method to the existing held default-mode capability; do not change its V1 observation schema or two-idle label set.
- `src/internal-production/baseline-task6a-three-launcher-host-v2.ts`: injected-ports composer and zero-input code-owned host adapter.
- `scripts/deployment-cutover.mjs`: one new authenticated, no-write V2 inspect verb and strict response validation; retain old verb semantics.
- `tests/internal-production/baseline-task6a-three-launcher-host-v2.test.ts`: RED/GREEN pure callback, sequencing, role/hash, URL secrecy and failure tests with fake ports.
- Existing launcher and deployment-cutover script tests: focused fake holder and bootstrap branch regressions.
- `package.json`: enroll tests in appropriate pure/cutover suites.
- `docs/superpowers/plans/2026-09-26-task6a-three-launcher-held-host-v2.md`: exact implementation and verification record.

No live DB write, role/grant/plist/service change, selected CLI switch, migration32, worktree cleanup, positive owner receipt, or final cutover is included. The mechanical DB/OS writer fence and distinct Task6A V2 authority chain remain later prerequisites.
