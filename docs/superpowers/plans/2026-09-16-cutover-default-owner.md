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

## Task1: Native generation and finite profile

- [ ] Add identity-only failing test with sysctl env reads trapped; implement
  `identify_process({pid,uid,gid,executable})` returning only identity fields.
- [ ] Require `expectedStartSeconds` and `expectedStartMicroseconds` for native
  environment measurement; mismatched first identity refuses before sysctl.
  Trap env reads in the stale-generation regression, then test mid-read drift.
- [ ] Add `optionalEnvironment` exact-value map bounded by the fixed optional
  name list. Require mandatory HOME and full observed membership in the finite
  family. Test wrong optional values, unknown keys and optional presence drift.
- [ ] Add fixed `identifyDeploymentCutoverPassiveProcessV1(request)` transport;
  operation-tagged private stdin, exact output schema and scalar checks. Update
  real owned physical/symlink test to identify first, then measure same generation.
- [ ] Run focused native/transport and authenticated-source bootstrap tests.

## Task2: Held default launcher

- [ ] Add failing tests for zero-input `holdDeploymentCutoverDefaultLauncherV1()`.
  Interface: `observation`, `qualifyPassiveHome()`, `recheck()`, `census()`, `close()`.
  `census()` refuses until both private samples and fresh idle qualification.
- [ ] Factor shared physical plist checking without changing strict wrappers.
  Default config accepts only exact current inheritedSSH profile; state may move
  through reviewed idle/running retry transitions without changing configuration.
- [ ] Bind account uid/gid/home/username/shell and getconf before/after sampling;
  hold each configured PATH's Node identity. Build mandatory/optional maps privately.
- [ ] Derive PID from fixed labels; identity-only probe, label recheck, generation-
  bound env probe, label recheck. Expected argv comes from reviewed env-node CLI
  invocation. No unexplained native-refusal retry within the same held context.
- [ ] Test PID/generation/path/argv/config/account/temp drift, one-label-only,
  native timeout, credential secrecy and complete resource drain.

## Task3: Owning conjunction and proportional delivery

- [ ] Add failing full-owner tests, then implement zero-input
  `observeDeploymentCutoverDefaultContextV1()`. Hold retained profile/resolution,
  env absence and default launcher together; cross-check CLI/account, qualify
  samples, fresh idle/process-zero, private pre32 census, reverse recheck/drain.
- [ ] Authenticate owner in bootstrap and expose only completed composed evidence.
  Test every failed conjunction prevents DB; preserve unresolved phase/controller
  blockers and all existing standalone snapshot behavior.
- [ ] Independent review, focused native/launcher/full-owner tests, affected
  bootstrap group, noemit/contracts, reviewed scoped PR and clean-main build.
- [ ] Only then attempt bounded passive host qualification and record actual
  evidence. No full-goal completion or live transition without remaining gates.
