# Preserved cutover service-effect records design

The selected historical CLI cannot read new cutover intent, and the two fixed LaunchAgents can start it while loaded. The approved preserved-deployment design therefore requires journaled spawner/dashboard quiescence before any CLI link transition. This slice defines only the immutable record grammar for that journal; it performs no `launchctl`, process signaling, service restart, link change, or live write.

## Choice

Add a separate pure record codec for the first two service effects: ordinal 1 is spawner bootout; ordinal 2 is dashboard bootout. Each intent binds the existing cutover-intent hash, current owner-claim hash, fixed action, ordinal, preceding completion hash (null only at ordinal 1), pre-effect launcher/process observation hashes, and `maximumDispatchCount:1`. Each completion binds its exact intent hash and post-effect launcher/process observation hashes. Canonical bytes and self-hashes are strict and bounded. An intent without its completion is an explicit `unsettled` history, never permission to replay or continue; both completions produce only `recorded-complete`, not physical exclusion authority.

The alternative of putting effect records into the existing owner-claim grammar is rejected: owner history and effect dispatch have different crash and replay semantics. A mutable journal flag is rejected because replacing it can erase whether an effect ran. The chosen separate intent/completion records are append-only historical commitments; a later store will use the reviewed `0600` exclusive-stage, fsync, no-replace link and exact-replay pattern.

## Boundaries

- This is only a pure codec. Caller-fed hashes, including an owner-claim hash, do not authenticate current ownership, launchd, process birth, a drained listener, or any effect. Neither `recorded-complete` nor a self-hash is a cutover gate.
- The later dispatch controller must hold the live owner capability and source/plist/CLI pins, publish an intent durably before an effect, recheck ownership around each effect, prove unloaded fixed jobs and no old process/listener, then durably publish completion. It must not retry an unsettled intent without physical reconciliation.
- After a future CLI switch, no rollback to the old dist is allowed: that dist lacks the ordinary-start refusal. The old dist, link, archives, ports, and worktrees remain untouched by this slice.

## File map

- `src/internal-production/baseline-deployment-cutover-service-effect-records-v1.ts`: exact intent/completion factories, strict canonical wire parser, bounded history classifier.
- `tests/internal-production/baseline-deployment-cutover-service-effect-records-v1.test.ts`: independent literal wire fixtures, crossed-link/duplicate/gap/hostile-input/unfinished-history cases.
- This spec and paired plan: explicit non-authority boundary and RED/GREEN evidence.
