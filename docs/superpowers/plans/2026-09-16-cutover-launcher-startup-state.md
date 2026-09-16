# Default launcher startup-state qualification

Root sole source writer. Standing authorization covers this bounded root fix to
the approved preserved-installation transition; no new live-effect authority.

## Evidence, design and alternatives

PR138 clean-main normal build passed. Actual host inspection29717 refused in
qualify/waiting after50.53s, below the70s passive deadline. It does not identify
the exact underlying check. Independent fixed-label metadata audit caught both
labels in xpcproxy/active1/PID at12:04:13.760–.763Z, then running with the same
PIDs at12:04:13.778–.780Z, idle0/noPID at12:04:14.354–.357Z. Current parser rejects
xpcproxy even while waiting for the next natural generation. No env values were
emitted or process controls used. This supports a concrete compatibility defect,
not proof that it was the exact prior refusal.

Choose a default-only recognized occupied startup state: xpcproxy requires
activeCount1 and a valid PID, identical configuration/physical checks. Acquisition
and baseline still require no active/PID; candidate sampling requires running.
Wait through pre-sample xpcproxy without identity or environment measurement.
Once sampled, any non-running occupied state refuses as generation/state drift;
post-identity same-PID xpcproxy also refuses. Idle remains authenticated no-PID.
Strict legacy observers, unknown states, malformed count/PID tuples and deadline
remain unchanged. Generic native errors still fail immediately.

Reject accepting xpcproxy as a sampleable process or idle state. Reject retrying
all parser failures. Broad state wildcards would hide malformed configuration.
No service start/stop, signals, links, archives, DB writes or intent publication.

## File map and test-first steps

- src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts:
  default-only occupied-state parser and explicit running eligibility/monitoring.
- tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts:
  startup→running positive, no native calls while starting, baseline occupied,
  malformed tuples, unknown states, sampled regression and strict API negatives.
- scripts/integration/deployment-cutover-default-context-composed.test.mjs:
  real authenticated composition sees startup transition before running.

- [ ] RED positive startup lifecycle in launcher and composed graph; assert
  no native sampling before running, and later same-generation sample/census.
- [ ] GREEN parse xpcproxy only with default mode and active1/validPID; unsampled
  loop skips non-running, sampled pre/post checks require running or proven idle.
- [ ] Negative startup active0/missingPID, unknown state, initial occupied,
  sampled xpcproxy and unchanged strict-mode behavior remain refusals/no DB.
- [ ] Focused tests, broadcutover, serialgenuine, manifest, noemit and contracts.
- [ ] Independent/cloud review, SHA-bound merge, separate normal clean-main build.
- [ ] One fresh sanitized host epoch; qualify or act on new actual evidence.

Spec: docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md.
All other held absence/source/controller/filesystem/helper/phase/journal gates
remain. Never equate this parser compatibility with complete host qualification.
