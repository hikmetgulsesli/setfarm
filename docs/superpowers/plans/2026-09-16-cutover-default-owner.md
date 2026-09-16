# Default launcher owning composition implementation plan

> **For agentic workers:** Root is sole writer; independent agents perform
> bounded read-only reviews. No service/link/archive or database mutation.

**Goal:** Bind actual default-launcher process generation and environment to held
retained build/resolution and default-file absence before private DB observation.

**Architecture:** Extend the authenticated native bridge with an identity-only
operation and a finite exact optional-environment profile. A separate zero-input
held launcher context owns configuration, Node/PATH, account/temp derivation,
passive acquisition and private URL. One zero-input script owner composes it with
the retained/profile and env-absence lifetimes, then rechecks around census.

**Tech Stack:** Existing TypeScript/Node builtin bootstrap and trusted isolated
Xcode Python/Darwin measurement. No new installed dependency or native build.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`

## Global constraints

- Preserve old installation/eight archives and ports3333/3080/18789.
- Keep strict explicit-env launcher APIs unchanged. No caller-supplied root,
  URL, PID, source registration, acceptance boolean or callback on the owner API.
- Required environment = authenticated configured/loaded/inherited maps with
  declared PATH override, plus account HOME. Reject undeclared collisions.
- Optional USER/LOGNAME/SHELL match account values; TMPDIR matches fixed sanitized
  getconf DARWIN_USER_TEMP_DIR; optional XPC_FLAGS only0x0; optional CF encoding
  only UID-bound0x%X:0:0. These are supported admission restrictions, not claims
  about all OS defaults. Unknown names/values and duplicate/missing keys refuse.
- Native measurement consumes one pair of buffers against the finite private
  family; presence drift fails exact double-read. No target-derived expectations.
- Separate pre-measurement identity operation must not call KERN_PROCARGS2.
  Returned PID/start seconds/microseconds bind the following measurement before
  any environment read. Both physical and saved invoked Node paths remain bound.
- Existing scheduled retries only: no launch/suspend/extension. Bound acquisition
  time; disappearance/refusal never counts as qualification or zero-owner.
- Keep resources held across waits/DB await; consume-once close drains all. No
  raw environment, credential or credential-derived hash in returned evidence.
- Sampled running retries require a subsequent fresh idle/process-zero census.
  Filesystem/helper phase and controller exclusion remain separate blockers.
- Saved initial stack bytes are not current `getenv`. Reviewed retained startup
  replaces live PATH (`dist/runtime-config.js:83`) and Playwright DEBUG; no
  HOME/PG/root-selector replacement is admitted. Held env-file absence excludes
  the runtime-config file-assignment branch. Trusted Node/libsystem behavior
  preserves initial unowned stack strings during these live replacements.
  Apple reference: https://github.com/apple-oss-distributions/Libc/blob/main/stdlib/FreeBSD/setenv.c
  Actual owned-Node mutation regression confirms original-stack measurement after
  shorter/longer PATH replacement and DEBUG set/delete on this host; this does
  not turn mutable stack evidence into immutable exec history or exclusion.

## File map

- Python helper and fixed transport: separate native identity operation,
  precommitted generation comparison and finite optional exact-value validation.
- Native/transport tests: identity-only syscall trap, generation mismatch before
  env read, optional profile positives/refusals and real owned-child binding.
- Launcher observation module and tests: shared private physical holder with
  distinct strict/default modes, account/getconf/Node holds, fixed-label sampling.
- `scripts/deployment-cutover-default-context.mjs`: zero-input owning conjunction.
- Bootstrap/fixture/test files: authenticate new owner; full composed lifetimes,
  no DB before all qualification and unchanged existing diagnostics.
- `scripts/integration/deployment-cutover-default-context-composed.test.mjs` and
  standard serial genuine command: real authenticated owner/selected/profile/
  resolution/absence/launcher/transport graph; only external OS/Node and DB
  boundaries substituted. Test artifacts stay inside independently owned fixtures.

## Task1: Native generation and finite profile

- [x] Add identity-only failing test with sysctl env reads trapped; implement
  `identify_process({pid,uid,gid,executable})` returning only identity fields.
- [x] Require `expectedStartSeconds` and `expectedStartMicroseconds` for native
  environment measurement; mismatched first identity refuses before sysctl.
  Trap env reads in the stale-generation regression, then test mid-read drift.
- [x] Add `optionalEnvironment` exact-value map bounded by the fixed optional
  name list. Require mandatory HOME and full observed membership in the finite
  family. Test wrong optional values, unknown keys and optional presence drift.
- [x] Add fixed `identifyDeploymentCutoverPassiveProcessV1(request)` transport;
  operation-tagged private stdin, exact output schema and scalar checks. Update
  real owned physical/symlink test to identify first, then measure same generation.
- [x] Run focused native/transport and authenticated-source bootstrap tests.
  Initial43/43 and Python-source5/5 passed. Later owned mutation case also passed.

## Task2: Held default launcher

- [x] Add failing tests for zero-input `holdDeploymentCutoverDefaultLauncherV1()`.
  Interface: `observation`, `qualifyPassiveHome()`, `recheck()`, `census()`, `close()`.
  `census()` refuses until both private samples and fresh idle qualification.
- [x] Factor shared physical plist checking without changing strict wrappers.
  Default config accepts only exact current inheritedSSH profile; state may move
  through reviewed idle/running retry transitions without changing configuration.
- [x] Bind account uid/gid/home/username/shell and getconf before/after sampling;
  hold each configured PATH's Node identity. Build mandatory/optional maps privately.
- [x] Derive PID from fixed labels; identity-only probe, label recheck, generation-
  bound env probe, label recheck. Expected argv comes from reviewed env-node CLI
  invocation. No unexplained native-refusal retry within the same held context.
- [x] Test PID/generation/path/argv/config/account/temp drift, one-label-only,
  native timeout, credential secrecy and complete resource drain.

## Task3: Owning conjunction and proportional delivery

- [x] Add failing full-owner tests, then implement zero-input
  `observeDeploymentCutoverDefaultContextV1()`. Hold retained profile/resolution,
  env absence and default launcher together; cross-check CLI/account, qualify
  samples, fresh idle/process-zero, private pre32 census, reverse recheck/drain.
- [x] Authenticate owner in bootstrap and expose only completed composed evidence.
  Test every failed conjunction prevents DB; preserve unresolved phase/controller
  blockers and all existing standalone snapshot behavior.
- [ ] Independent review, focused native/launcher/full-owner tests, affected
  bootstrap group, noemit/contracts, reviewed scoped PR and clean-main build.
- [ ] Only then attempt bounded passive host qualification and record actual
  evidence. No full-goal completion or live transition without remaining gates.

## Verification and review ledger

- Native/transport43/43, then actual owned live-PATH/DEBUG replacement regression
  passed; final combined native/bootstrap/owner119/119 passed (session94505).
- Launcher68/68 and broader cutover312/312 passed; noemit passed. Independent
  reviewer found account double-read acquisition race and sampled-PID replacement
  waiting gap. Failing regressions reproduced both; single account baseline and
  monitoring of sampled generations fixed them. Re-review found no blockers.
- Full launcher intermediate65/66 exposed optional `pid:undefined` canonical
  hashing during initially idle configuration. Omit absent PID; final68/68 passed.
- Owner final20/20 covers joins, partial acquisition, failed awaits, malformed/
  nonzero counts, concurrency, reverse drain and sticky close uncertainty.
- Authenticated composed fixture3/3 passed (session25596), including two failures
  before DB. Review identified socket-sentinel assertion typo; corrected to the
  actual fixture sentinel. Standard serial integration gate remains in progress.
- Source manifest18/18; English1561/path891 passed. New endpoint is observation
  only. No actual launcher environment read, live service/link/archive effects,
  or database mutation; PR, clean-main build, host qualification still pending.
- Final standard serial genuine gate27/27 (85s), retained-profile suite32/32
  including nested standard command passed9468; corrected secrecy assertion
  positive passed47498. Prior overlapping retained suite33703 had31/32 and lost
  its nested child stdout; do not reinterpret it as green. Independent genuine
  groups must not overlap account-HOME absence pins. Parent assertions now expose
  failed child stdout; timeout150s accounts for the three added integration cases.
- Final noemit34702 and diff checks passed. Independent final owner/composed
  review found no blocking findings. Ready for scoped reviewed PR, not rollout.
