# Deployment Cutover Launcher Observation Implementation Plan

> **For agentic workers:** Use serialized primary-owner inline execution with
> independent read-only review. The executing-plans skill is unavailable;
> retain its checkpointed test-first workflow without adding another writer.

**Goal:** Observe both fixed launcher configurations without requiring old and
new deployment roots to already agree or exposing credential values.

**Architecture:** A zero-argument diagnostic pins both physical plist files,
converts their held bytes with bounded plutil, and brackets bounded launchctl
print observations. Compare loaded and durable configurations privately, return
separate immutable configuration and transient-state commitments. No process,
source/build or zero-owner authority follows from this diagnostic.

**Tech Stack:** TypeScript ESM, Node filesystem descriptors, existing canonical
hashing, bounded child processes and temporary physical plist fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Global constraints

- Preserve old installation and all eight archives.
- Keep ports3080/3333/18789 unchanged; no launcher or service mutation.
- No DB access, CLI replacement, arbitrary command/root/PID arguments or secrets
  in returned objects, errors, nested causes or test logs.
- Do not import the large receipt module or weaken its same-root service census.
- Loaded-idle configuration is not proof of absent process families.

## File map and interface

- Create `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`.
  Export only `observeDeploymentCutoverLauncherConfigurationV1()` with no inputs.
  Return a deeply frozen versioned object containing exactly two launcher
  entries: label, plistPath, launchArguments, plist identity, plistBytesHash,
  configurationHash, state, activeCount0 and loadedStateHash; include an overall
  launcherObservationHash. Never return parsed environment objects.
- Create `tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts`.
  Fresh children use temporary owner-home fixtures and intercept only the fixed
  launchctl print boundary. Actual plutil converts fixture plist bytes.
- Update the approved spec File Map after qualification.

## Task: fixed launcher diagnostic

- [x] Write positive physical fixtures using fake PG/token/socket sentinels and
  both exact labels. Create real plist files using plutil, provide matching
  launchctl text and assert frozen, deterministic diagnostic results:

```ts
assert.equal(observed.launchers.length, 2);
assert.equal(observed.launchers[0].activeCount, 0);
assert.ok(Object.isFrozen(observed.launchers));
for (const secret of secretSentinels) {
  assert.equal(JSON.stringify(observed).includes(secret), false);
}
assert.deepEqual(afterFiles, beforeFiles);
```

- [x] Run the new test file before implementation; require missing-module or
  missing-export failure. Implement the zero-argument observer and rerun:

```sh
node --import tsx --test tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts
```

- [x] Use fixed owner-home labels `com.setrox.setfarm-spawner` and
  `com.setrox.setfarm-dashboard`; fixed CLI arguments are spawner start and
  dashboard start --port3333. Follow receipt contracts8367–8453 for strict scalar,
  block, environment, interval60, RunAtLoad and fixed log-path validation.
  Keep private local parsers instead of importing executable/service observers.
  Read both plists with complete held ancestor chains, no-follow/nonblocking
  regular-file opens, owner/safe-mode/nlink1 checks, bounded exact reads and
  full identity/bytes revalidation. Consume each descriptor before closing;
  uncertain close makes future calls refuse without descriptor reuse.

- [x] Bound command output and duration, send held plist bytes to fixed
  `/usr/bin/plutil -convert json -o - -`; use fixed `/bin/launchctl print`
  gui/uid/label only. Command failure must become a constant sanitized error
  without attaching stdout, stderr or original error causes. Bracket both
  launchers and compare configuration projections, not volatile raw text.

- [x] Add crossed token, duplicate scalar/block/environment keys, unexpected
  plist keys, wrong arguments/interval/logs, active launcher and malformed
  envelope fixtures. Inject command failures containing secret sentinels and
  inspect the complete error chain:

```ts
assert.throws(observe, error => {
  const rendered = inspect(error, { depth: null });
  for (const secret of secretSentinels) assert.equal(rendered.includes(secret), false);
  return rendered.includes("DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID");
});
```

- [x] Add plist/ancestor symlink, hardlink, mode, FIFO and oversized refusal;
  replace file/ancestor and alter bytes during command observation. Assert all
  foreign replacements remain untouched and invalid files never reach plutil.
  Inject close-response loss with actual descriptor reuse and prove no retry
  closes the sentinel. Keep durable configuration hash separate from transient
  inherited socket/state hash; changed socket must not change durable config.

- [x] Run the complete new suite, `npx tsc --noEmit -p tsconfig.json`, English/path
  contracts and `git diff --check`. Obtain independent read-only review, repair
  findings. Normal build still requires clean
  finalized main under the existing build guard; no override is permitted.
- [x] Checkpoint the reviewed bounded unit (74aefcef).
- [x] Perform a read-only live diagnostic only after fixture qualification;
  report fixed labels/state/hashes only. A failure is evidence for preflight,
  never permission to rewrite plists or restart services.

## Qualification evidence

Six initial missing-module RED tests passed after implementation. Independent
review found empty duplicate scalar assignments and success-with-stderr were
accepted: four regression tests reproduced acceptance before the fixes, then
passed. Expanded full suite33/33,zero failures/skips9758.132208ms. TypeScript
noemit exited0; English1509/path864 contracts passed. Re-review found no remaining
must-fix. Close-response-loss test proves one close attempt and live reused FD.

Read-only live diagnostic succeeded: both fixed launcher configurations matched
their held plists, state spawn scheduled and activeCount0. Configuration hashes:
spawner `378718b3268498c7760f61bec1069b89c3b4b307e0361f75f199e8f5098658e2`,
dashboard `0ef5be5bac2276daff940d60e52a00228d17df35000ff5d6ddf4320415ad5f31`.
No credentials were returned or logged and no live files/services were changed.
This result does not assert that detached daemon families are absent.

## Deliberately remaining outside this task

Physical controller ownership/exclusion, deployment source/build authentication,
global process families, phase-sensitive DB census, journaled service effects,
cold-protocol recovery and ready-bound completion remain separate required
parts of the already approved cutover. This diagnostic cannot authorize them.
