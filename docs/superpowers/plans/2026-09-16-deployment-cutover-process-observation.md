# Deployment Cutover Process Observation Implementation Plan

> **Execution:** Primary-owner inline TDD with parallel read-only review; no
> second writer. Existing approved preserved-deployment design applies.

**Goal:** Supply old/new-neutral global process-family and port3333 diagnostics
for the approved cutover without emitting raw unrelated command lines.

**Architecture:** Bracket wide global process rows and a global TCP3333 listener
query. Validate observer presence, classify all-root spawner/dashboard daemons
and CLI contenders, compare stable relevant identities and listeners, return
frozen primitive identities and hashes. Presence never grants signal authority;
empty inventory never independently grants zero-owner admission.

**Tech Stack:** TypeScript, bounded ps/lsof subprocesses and fresh-process fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## File map

- Create `src/internal-production/baseline-deployment-cutover-process-observation-v1.ts`:
  zero-argument `observeDeploymentCutoverProcessFamiliesV1()`.
- Create `tests/internal-production/baseline-deployment-cutover-process-observation-v1.test.ts`:
  narrow subprocess fixtures; actual classification/bracketing/hashing logic.
- Update approved spec File Map after qualification.

## Interface and constraints

PR125 review4021928595 identifies unrelated generic `cli.js` commands falsely
blocking the transition. Restrict CLI contenders to the known `dist/cli/cli.js`
and `src/cli/cli.ts` layouts plus existing `setfarm` aliases, preserving relative
forms and every checkout root. The mapped source/test files carry negative
generic-basename cases and positive source/compiled/alias starter matrices.
No daemon/listener/identity guard changes or ownership authority are introduced.

Return versioned schema, families and listener (null or one exact loopback3333
listener), plus processObservationHash. Family entries carry uid/pid/ppid/pgid,
birth identity, commandHash, classification, and only exact recognized executable,
entrypoint and checkout paths. Never emit raw command lines or unknown arguments.
Unknown/malformed contender commands remain ambiguous; do not filter them out
because they do not match the currently selected checkout. A short CLI starter
is a family member. No inputs, process signals, DB, service actions or mutation.

## Task

- [x] Add a fixture with both old/new spawners and a detached old dashboard and
  one global3333 listener; unrelated secret-bearing arguments must stay private:

```ts
assert.equal(result.families.length, 3);
assert.equal(result.listener.pid, 4103);
assert.equal(JSON.stringify(result).includes("UNRELATED_SECRET"), false);
assert.ok(Object.isFrozen(result.families));
```

- [x] Run RED before source implementation:

```sh
node --import tsx --test tests/internal-production/baseline-deployment-cutover-process-observation-v1.test.ts
```

- [x] Implement bounded fixed `/bin/ps -ww -axo
  uid=,pid=,ppid=,pgid=,stat=,lstart=,command=` and global `/usr/sbin/lsof -nP
  -iTCP:3333 -sTCP:LISTEN -F0pcfn`. Require strict UTF8/newline rows, finite numeric
  IDs, unique PIDs, valid observer row and bounded counts. Use existing receipt
  algorithms7471/8528/8537 without importing its source/build/DB graph.
- [x] Classify all-root spawner entries and CLI starters, plus dashboard
  `dist/server/daemon.js` and dashboard CLI starters. Exact recognized daemons
  require current UID, PPID1, PGID=PID, valid non-zombie state and exact node/entry
  argument grammar. Each daemon may use its own absolute normalized Node path,
  not necessarily the controller's Node version. Query that executable with
  fixed ps comm and compare before and after. This authenticates the observed
  process command relationship, not executable-file/build provenance. Hash
  unknown contender command bytes without returning them.
- [x] Require global lsof status1 with empty output for absence; otherwise one
  strict PID/command/fd/127.0.0.1:3333 record bound to the observed dashboard.
  Foreign, wildcard, IPv6, duplicate or unexpected listener output refuses.
- [x] Bracket relevant families and global listeners; ignore unrelated host
  process turnover. Add late-old-family, disappeared/reused PID, transient CLI,
  unrelated-root spawner, duplicate PID, missing observer, wrong daemon shape,
  malformed/truncated output and secret-bearing command failure cases.
- [x] Verify full new suite, noemit, contracts and independent review; then run
  read-only live diagnostic. No service effect is authorized by this task.
- [x] Checkpoint the reviewed source unit (3449f606).

## Remaining controller boundary

Live ownership/exclusion and recoverable journaled side effects still need their
own qualification. Existing archive-maintenance owner attempts cannot consume
the cutover-specific maintenance intent; never fabricate an archive candidate.
The spawner singleton reservation cannot remain held through cold preflight.

## Review and live diagnostic findings

Initial8REDmissing-module tests passed after implementation. Independent review
found relative/source dashboard paths were missed before opening a listener;
two no-listener RED fixtures reproduced the omission, then detection was widened
while exact detached identity requirements remained unchanged.

First live read-only smoke safely refused: retained dashboard PID88763 uses
Node22.23.1 while the controller uses Node26.4.0. A new positive fixture proved
the old/current-runtime equality prerequisite was wrong for a preserved cutover.
Its RED was fixed by checking each daemon's own exact command against observed
comm in both passes, with a separate crossed-comm negative witness. No services
or files were modified, and no executable build authority is inferred.

Final23/23 tests passed,zero skips5150.502459ms; noemit0,English1512/path865.
Re-review found no must-fix. Live read-only recheck passed with one retained
dashboard PID88763, Node22.23.1, exact loopback3333 listener and no spawner family
in that bracket. This point-in-time diagnostic is not a zero-owner lease.
