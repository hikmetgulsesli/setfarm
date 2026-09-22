# Sampled-process lookup absence implementation plan

Root sole source writer; agents review read-only. This is a causal refinement of
the approved preserved-deployment cutover under standing owner authorization.

## Evidence and design

PR139 normal clean-main build passed. Actual host44008 refused47.84s at
qualify/sampled-native. A separate fresh-child-per-call identity-only forensic
reproduced running PID5769 at12:22:25.216568Z, first proc_pidinfo return0/errno3,
then fixed-label idle0/noPID at12:22:25.272696Z. Eight preceding identities were
stable; each fresh Python child cost53–57ms. This demonstrates a natural exit race,
not proof of the exact prior refusal. Persistent Python inspection also observed
xpcproxy returning EPERM, which must never be classified as absence.

Apple primary sources: libproc proc_pidinfo converts syscall failure to return0;
kernel basic-BSD arg0 lookup returns ESRCH when no active process is found.
This is PID lookup absence, NOT proof of a particular generation's death.

- https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/wrappers/libproc/libproc.c
- https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/proc_info.c

Introduce a separate internal monitor operation used only after full authenticated
sampling. Its request binds PID/UID/GID/executable and expected parent/start tuple.
Any observed identity must match all of that before further native probes.
Clear errno immediately before proc_pidinfo and capture it immediately afterward.
Only exact return0 plus fresh ESRCH yields a closed absence response containing
distinct schema, requested PID and fixed lookup classification. Never echo the
expected start tuple as observed identity. Short/negative returns, stale errno,
EPERM, path failures and any observed mismatch still refuse. No environment
syscall is permitted in monitoring. Initial identify and measurement stay strict.

Transport validates the finite absence wire separately from live identity and
keeps errors/timeouts fatal. Owner has just observed its fixed label running with
the sampled PID. A typed absence then requires fresh authenticated same-label
idle/noPID before marking settled. Present/replacement PID, configuration drift
or restart after settlement refuses; final family/listener/census gates remain.

This is equivalent to existing sampled-monitor initial-idle acceptance. It does
not claim exclusion or that no unobserved intermediate generation ever ran.
Generic native-error-to-idle fallback is rejected. A persistent Python worker
could reduce latency but adds protocol/cleanup scope and is unnecessary for this
specific semantic distinction. Direct Xcode Python shaved only~4ms in owned-child
tests and does not solve the race; retain the fixed system interpreter.

## File map and sequence

- scripts/deployment-cutover-passive-home.py: private typed lookup absence,
  expected-identity-bound monitor_process, strict existing operations unchanged.
- scripts/deployment-cutover-passive-home.mjs: monitor export and exact finite
  absence validation, same input clearing and generic error behavior.
- src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts:
  sampled-only monitor call and mandatory fresh idle after typed absence.
- scripts/__tests__/deployment-cutover-passive-home.test.js: native boundary
  return/errno fixtures and owned-child live→exit coverage; zero env calls.
- tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts:
  typed absence→idle, still-running/replacement/drift and strict-failure cases.
- scripts/integration/deployment-cutover-default-context-composed.test.mjs:
  authenticated transport+owner absence handling and malformed response refusal.
- Existing bootstrap fixture/source inventories remain authenticated; no new
  caller-provided source, PID, environment or execution authority.

- [x] RED native first/second lookup ESRCH, successful identity and owned exit;
  reject stale errno, short+ESRCH, EPERM, mismatch then disappearance and pathfail.
- [x] RED launcher typed absence→idle; reject later occupied/replaced label,
  malformed/crossed wire, generic errors; initial identify/measure still strict.
- [x] GREEN minimal native/transport/monitor implementation with no native retry.
- [x] Focused native/launcher/composed, broadcutover, serialgenuine, manifest,
  noemit, English/path and diff checks; independent implementation review.
- [ ] Reviewed PR, exact-head cloud review, SHA-bound merge and separate normal
  clean-main build. One fresh sanitized host inspection; act on actual evidence.

Spec: docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md.
No service/link/archive/DB mutation. All unrelated controller/filesystem/helper/
phase/journal blockers remain. No full-goal or host-qualification claim.

## Local verification evidence

Fresh TDD evidence on the seven-file working diff: native45/45; transport RED
15pass/16fail before the monitor export, then hardened transport39/39; owner RED
87pass/11fail before sampled monitor ownership, then owner98/98; authenticated
composed15/15 including typed absence→idle and same/replacement/startup/error/
malformed refusals. Broad internal-production cutover passed342/342. Standard
serial genuine passed39/39 in82.9s. Exact source manifest18/18, TypeScript noemit,
English1567, paths892, Mission Control contracts12, migration digests and diff
whitespace checks passed. Authenticated source inventories required no membership
change because the implementation reuses their existing files. Independent
read-only implementation review found no findings. PR/merge/build/host evidence
is not yet claimed.
