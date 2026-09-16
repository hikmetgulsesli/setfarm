# Selected Deployment Build Observation Implementation Plan

> **Execution:** Serialized primary-owner TDD; parallel read-only review. Existing
> isolated worktree only. This is the approved preserved-cutover preflight.

**Goal:** Authenticate the on-disk build selected by the fixed CLI without
executing old modules, rotating archives or conflating build SHA with checkout SHA.

**Architecture:** A zero-argument builtins-only observer in the plain-JS verifier
physically authenticates the fixed CLI selection without compiled imports.
Factor its current finalized-build wrapper into a private root-bound observation;
the current wrapper keeps exact-current semantics. The selected wrapper permits a
historical finalized build and returns separate checkout and build identities.

**Tech Stack:** Existing Git/output verifier, immutable file observations, Node
ESM, physical temporary Git repositories and compiled CLI observer fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and causal scope

- Preserve old installation and all eight archives; never read/repair retention
  ledgers to establish this evidence. No builds or old module imports.
- Fixed CLI selects the root; no public root, SHA or expected-build inputs.
- Authenticate selected checkout as physical canonical clean synchronized main;
  authenticate build against its own historical commit/tree and exact dist.
- Return actual current checkout identity separately. A historical build SHA must
  not be mislabeled the current origin/main SHA. This is on-disk evidence, not
  proof of the dashboard's loaded bytes or permission to signal it.
  Here historical means verified against the build's own Git commit/tree; this
  diagnostic does not assert ancestry or an approved transition relationship.
  Retention authorization's existing strict-ancestor check remains unchanged.
- Compiled diagnostic is loaded only from the new controller. Production use must
  remain behind the trusted bootstrap's authenticated loader; no tsx/source fallback.
  The selected observer itself has no compiled dependency: the retained closure
  forbids dynamic imports. Bootstrap independently cross-checks its complete CLI
  projection against the existing compiled CLI observer before accepting output.

## File map

- `scripts/build-generation-retention.mjs`: private root-bound finalized observer,
  unchanged current-build public contract, new selected-build zero-argument observer,
  and bounded common regular-file read with unchanged drift checks.
- `scripts/__tests__/build-generation-retention.test.js`: selected old checkout
  fixture, builtins-only selection, historical-build mismatch acceptance,
  file/link/ancestry tampering and read-only preservation assertions.
- Preserved-deployment spec: describe the selected on-disk evidence boundary.
- `package.json` and `tests/internal-production/task-0-source-manifest.test.ts`:
  actual no-DB leaf selection and standard invocation of the cutover regression suite.

## Task1: selected historical build diagnostic

**Interface:** `observeSelectedSetfarmDeploymentBuildV1()` returns frozen
`{schema,cli,checkoutSource,buildSource,selectedDeploymentObservationHash}`.
`checkoutSource` is `{branch:'main',clean:true,sha,treeHash,originMainSha}`;
`buildSource` is `{sha,treeHash,buildHash}`. Physical CLI and full-output brackets
must remain unchanged across the observation. Failures poison this observer for
the process; uncertain descriptors are consumed once.

- [x] Create two physical fixture roots and a fixed home CLI pointing at the old
  one. Build the old fixture, then commit a newer source revision without rebuilding.
  Run the real selected observer and initially observe missing-export failure:

```js
assert.equal(result.buildSource.sha, oldBuildSha);
assert.equal(result.checkoutSource.sha, newCheckoutSha);
assert.notEqual(result.buildSource.sha, result.checkoutSource.sha);
assert.equal(result.cli.checkoutPath, selectedRoot);
```

- [x] Factor existing finalized wrapper into private root-bound logic. Derive
  historical commit/tree/input hash from BUILD_INFO only for selected observation;
  pass that root explicitly to a private historical dist verifier. Preserve the
  old verifier wrapper and current-build equality check for existing callers.
- [x] Observe fixed CLI before and after all build checks; compare complete
  observations, not merely target strings. Hash separate checkout/build bodies.
- [x] Add malformed/missing historical commit, output/manifest mismatch, unsafe
  mode, link/root replacement and same-inode byte-change cases. Preserve complete
  old dist and eight fixture archives in positive before/after snapshots. Reject
  write APIs during observation and prove no old code execution.
- [x] Run focused tests, full retention suite and bootstrap/owner suites, noemit/
  contracts; independent review, update spec/evidence and checkpoint. Bootstrap
  integration may proceed after focused tests and independent review while the
  unchanged observer's full regression suite runs; no checkpoint or live use
  precedes complete qualification.

## Task2: trusted host integration

**Files:** Modify `scripts/deployment-cutover.mjs` and its script tests.

**Interface:** Existing `inspect-host --json` gains `host.selectedDeployment`.
Invoke `observeSelectedSetfarmDeploymentBuildV1()` between the first host census
and the reverse comparison, require its complete CLI observation to equal the
outer CLI observation, and include it in the host hash. Remove only the diagnostic
`old-build-not-authenticated` blocker when this actual proof succeeds. DB and
current-owner blockers remain mandatory. No new command mode or mutation path.

- [x] Upgrade the owned host fixture's selected directory to a real finalized
  historical Git/build fixture. Advance its checkout without rebuilding. Assert:

```js
assert.notEqual(host.selectedDeployment.buildSource.sha, host.selectedDeployment.checkoutSource.sha);
assert.deepEqual(host.selectedDeployment.cli, host.cli);
assert.ok(host.blockers.includes('database-zero-owner-not-observed'));
```

- [x] Observe missing selected-deployment output RED, then implement the awaited
  internal read inside the existing bracket after Task1 focused qualification and
  independent review. Keep its source fixed during the full suite. Malformed
  selected build must refuse all host output; selected modules never execute.
- [x] Re-run complete bootstrap/owner/process and cutover suites; noemit/contracts,
  independent review, evidence update and commit. Ordinary startup/Task6A behavior
  remains untouched.

## Full-suite regression and root refinement

First full suite completed215tests:158passed/57failed489022.897834ms. Every failure
was downstream of the unchanged retention closure's dynamic-import prohibition.
The initial selected observer's compiled-CLI import violated that existing rule.
Do not weaken the closure guard. The selected observer now uses only builtins,
holds full CLI/target ancestry, brackets physical link/entry bytes and returns the
same complete CLI projection. Bootstrap's independent compiled observer must
match it exactly. Existing v1/v2 prepare positives are rerun before repeating the
entire suite. Failed log remains preserved as historical evidence.

Review then reproduced a transitive read-cap gap: `readStableRegular` checked the
file size and then used unbounded `readFileSync(fd)`. Growth between those actions
could exceed the declared cap; the selected CLI regression read16777218 bytes
against its16MiB limit. Fix the common read primitive, not just one caller: allocate
exactly the accepted initial size plus one byte, perform one bounded `readSync`,
retain all existing before/after/path metadata and byte-length comparisons, and
reject short/grown reads. This also protects the selected observer's historical
verifier calls. Update the two existing fault-injection hooks to the new read
boundary without weakening their replacement evidence assertions. Preserve the
already-running immutable-source full result, then rerun the complete suite on
the final bounded-read candidate. No live mutation is needed for this root fix.

## Qualification evidence

### Verification-command root refinement

An additional anchored-gate run exposed a false-green receipt invocation: its
four selected names no longer exist. This blocks honest broader qualification,
not live state. Repair `package.json` to select four exact currently registered
no-DB receipt leaves, including the suite prefix. Extend
`tests/internal-production/task-0-source-manifest.test.ts` to derive literal
registered suite/leaf paths with the existing TypeScript AST and assert each
anchored command selects exactly its reviewed3/3/4leaf set. Model ancestor matches
too, so matching a suite cannot silently run all its DB cases. Exclude skipped/todo
registrations. Tests must reject stale selectors, renamed leaves, missing suite
prefixes and broad patterns. Run the actual corrected command with both DB URLs
absent and prove four receipt leaf passes, zero skips. Keep production retention
source fixed during its independent full-suite run. This adds no DB capability.
The new assertion first failed with an empty third selection. After correcting
the command, complete source-manifest18/18 and actual anchored3/3/4passed, zero
skips. Tests also cover skipped registrations. Independent review found no
must-fix issue; the adjacent real DB-reset lifecycle test cannot match. This
restores focused no-DB coverage, not the removed names' implied parser coverage.

PR125 review4021865346 found a second invocation gap: the ten new cutover files
and pre-DB boundary tests were run directly but omitted from `npm test`. Add the
invoked `test:internal-production:cutover` script, clearing both PG URLs and
selecting only those eleven files. The manifest surface regression reproduced
the missing invocation before repair. Run the actual script before the review
fix checkpoint; this does not claim a complete repository-wide `npm test` run.
The actual new suite passed189/189, zero skips,22425.235ms; complete manifest
passed18/18, zero skips,7635.293708ms. Independent review found no must-fix issue.

- Corrected builtins-only candidate before the common read fix: complete218/218,
  zero skips,638209.884541ms. This does not qualify the later bounded-read change.
- Bounded-read growth regression reproduced the16777218-byte overread before the
  fix. After the fix,29current/selected/boundary tests passed, zero skips,
  20026.054875ms. Empty, exact-cap, over-cap and short reads retain their semantics.
- Final candidate cutover suite181/181, zero skips,30953.746417ms; TypeScript
  noemit, English1525files, path870files and whitespace checks passed.
- Independent final scoped review found no remaining material issue. Complete
  changed-script gate passed103/103, zero skips,106946.292958ms.
- The bounded candidate's first complete retention run finished223tests with
  222passed/1failed,651122.069375ms. The failure was a prepare-time loaded/plist
  path-commitment mismatch, not the read-cap regression. Its isolated rerun passed
  unchanged. A private diagnostic reproduced the same refusal by adding one owned
  sibling under shared Darwin temp: the ancestor linkCount changed9209to9210 while
  device/inode/mode were unchanged. This proves the mechanism, not the original
  failure's exact cause, because that run did not retain differing projections.
  Preserve its failed log. Rerun the identical complete source with a dedicated
  physical TMPDIR under workspace logs, outside the repo, removing shared system
  temp ancestry without modifying or bypassing production identity checks.
- That unchanged retention candidate passed the complete223/223suite, zero
  failures/skips,641172.96975ms. Log:
  `logs/2026-09-16-selected-deployment-retention-isolated-temp.log` in the workspace.
  Final selector repair also passed noemit/version/English/path/whitespace checks.
- Foundation delivery must explicitly exclude complete DB/runtime zero-owner
  proof, effect orchestration, CLI/dashboard transition and Task6A completion.
  Normal finalized build and live diagnostics require reviewed clean-main delivery;
  neither the dirty feature branch nor these fixture tests substitute for it.
