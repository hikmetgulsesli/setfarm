# Stopped Retention Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualify the existing old/new startup refusal boundaries before implementing a destructive maintenance controller.

**Architecture:** Exercise extracted production functions in an isolated test context with explicit observation ports, without importing live runtime modules. Preserve exact historical source as the compatibility input. This is the first, independently reviewable qualification slice, not the complete stopped-retention implementation or permission to execute it.

**Tech Stack:** Node.js test runner, TypeScript parser/transpiler already declared by the repository, read-only Git observations.

**Spec:** `docs/superpowers/specs/2026-09-15-stopped-spawner-retention-design.md` (user approved).

## Global Constraints

- No runtime source changes, live parser invocation, launchctl mutation or disposal in this slice.
- Mission Control (3080) and dashboard (3333) stay running.
- Do not manufacture a `loadedProcess` for the stopped spawner.
- No cap increase, fabricated process or override.
- The exact approved ordinal-6 candidate remains unchanged; qualification grants no alternative candidate authority.
- Root is the sole writing/delivery owner. Parallel agents inspect/review only unless ownership is explicitly handed over.
- Fixtures must not share source-transform instrumentation with the full P3 suite.
- Passing unit qualification does not prove physical launch exclusion, reboot recovery or the complete build/handoff transition.

## File Map

- Create `scripts/__tests__/stopped-retention-startup-qualification.test.js`: source extraction helper and focused startup-gate characterization; no exported runtime API.
- Modify this plan: record commands, source findings, test evidence and remaining qualification gaps.
- Read only `src/spawner.ts`, `src/internal-production/baseline-post-handoff-receipt-v1.ts`, and `src/internal-production/baseline-spawner-startup-admission-v1.ts`.
- Read only historical `eef9f6c4059daa487a5a367f8f1609b1d1e39142:src/spawner.ts` using Git.

### Task 1: Establish the current refusal and transition evidence

**Files:** this plan only; runtime stores and Git are read-only inputs.

**Interfaces:** produces the observation ledger below; no callable runtime authority.

- [x] Inspect fixed current-entry and pre-schema store inventories without invoking their public selectors.
- [x] Hash the existing operation bytes and probe its stored source commit using `git cat-file -e <sha>^{commit}`.
- [x] Inspect old prepared-operation validation before absent-status handling.
- [x] Independently inspect cold-history publication before successor recovery.

Observed on 2026-09-15:

| Evidence | Result | Limitation |
| --- | --- | --- |
| Fixed current-entry root | Operation plus prerequisite records | Inventory is not parser acceptance |
| Operation hash | `90fc2fedc56db22bb013ad1b243e9dc386473d6b4284ede135e26fd1ab82fe3d` | Existing poison history, not a new refusal record |
| Operation byte hash | `ebcba187e953fda9e7962a0ce0cf4fc10feed881e9ce69b6d59140a9ef43d7f6` | Unchanged on reread |
| Stored source commit | `4fc67f20df0e935c703c4658a29dbbaa9aa0a956` | Local `git cat-file -e` exit 128 |
| Fixed pre-schema store | Absent | Old executable can admit normal work if operation validation succeeds |
| Recovery ordering | `ensureExactPoisonSpawnerBeforeQuarantineV1` precedes successor publication | Existing-live compatibility branch must be excluded |
| New ordinary startup | Non-absent cold history requires ready status | Old executable lacks this guard |

Do not invoke `observePreparedInternalProductionCurrentEntryOperationV1` as a
presumed pure inspector: successor selection can durably authenticate activation.
The current byte/commit evidence is a refusal candidate, not complete live parser
authentication and not a proof for all successor phases.

### Task 2: Characterize the new cold-history refusal in isolation

**Files:** create `scripts/__tests__/stopped-retention-startup-qualification.test.js`.

**Interfaces:** test-local `extractFunction(source, name)` returns the exact single
top-level function text. `compileColdGate(cold, status)` returns a zero-argument
async function containing production `observeOrdinarySpawnerColdRecoveryAdmissionV1`.

- [x] Add the following imports/helper and tests. Use TypeScript AST extraction,
  not substring-based body parsing or copied production logic:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function extractFunction(source, name) {
  const tree = ts.createSourceFile('spawner.ts', source, ts.ScriptTarget.Latest, true);
  const matches = tree.statements.filter(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, `exactly one ${name}`);
  return matches[0].getText(tree);
}

const source = readFileSync(new URL('../../src/spawner.ts', import.meta.url), 'utf8');

function compileColdGate(cold, status) {
  const name = 'observeOrdinarySpawnerColdRecoveryAdmissionV1';
  const original = extractFunction(source, name);
  const dependency = 'await import("./internal-production/baseline-spawner-startup-admission-v1.js")';
  assert.equal(original.split(dependency).length, 2);
  const isolated = original.replace(dependency, 'startupPort');
  const js = ts.transpileModule(isolated, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  const startupPort = {
    observeInternalProductionPreSchemaSpawnerRebindStatusV1: async () => {
      if (status instanceof Error) throw status;
      return status;
    },
    resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1: async () => {
      throw Error('unexpected restart resolver');
    },
  };
  return new Function('observeInternalProductionColdSpawnerBootstrapJournalCensusV1',
    'startupPort', `${js}\nreturn ${name};`)(() => cold, startupPort);
}

test('absent cold history alone does not establish maintenance refusal', async () => {
  assert.equal(await compileColdGate({ state: 'absent' }, { state: 'absent' })(), null);
});

test('settled cold history rejects absent pre-schema status', async () => {
  await assert.rejects(compileColdGate({ state: 'settled', incompleteOwnerCount: 0 },
    { state: 'absent' }), /COLD_BOOTSTRAP_NOT_ABSENT/);
});

test('unsettled cold history rejects ordinary admission', async () => {
  await assert.rejects(compileColdGate({ state: 'unsettled', incompleteOwnerCount: 1 },
    Error('unexpected status observation before cold settlement')), /COLD_BOOTSTRAP_NOT_ABSENT/);
});

test('ready label without authority pairs does not authorize admission', async () => {
  await assert.rejects(compileColdGate({ state: 'settled', incompleteOwnerCount: 0 },
    { state: 'normal_task0_admission_ready' }), /COLD_BOOTSTRAP_NOT_ABSENT/);
});
```

- [x] Run `node --test scripts/__tests__/stopped-retention-startup-qualification.test.js`.
  Expected: five named passes including the mutation check, no runtime import,
  DB connection, child launch or filesystem mutation.
- [x] Demonstrate test sensitivity using an in-memory mutation of the extracted
  guard that returns null for settled history with absent status. The second test
  must reject that mutation. Do not edit production source to perform this check.
- [x] Have an independent reviewer inspect source extraction and test isolation.
  These are characterization tests for existing behavior, not a claimed new root fix.

### Task 3: Convert qualification into the next implementation boundary

**Files:** modify this plan and the approved spec only if evidence changes a premise.

**Interfaces:** consumes Task 1 source findings and Task 2 test evidence; produces
an explicit list of still-unproven physical/integration requirements.

- [x] Record test results and mutation sensitivity evidence separately from live observations.
- [x] Keep the following requirements open for the controller implementation plan:
  complete alternate-invocation census; atomic populated singleton publication;
  post-census identity bracket; controller-death/PID-reuse recovery; old-loaded
  process drain across dist replacement; exclusion of the existing-live cold
  preselection shortcut; exact retained-parser refusal authentication; and every
  durable build/sealed-handoff/reboot interval.
- [x] Do not implement stopped disposal merely because Task 2 passes. The next
  implementation plan must define versioned operation/proof schemas and a physical
  adapter test harness that proves those requirements, while preserving existing
  quarantine/disposition machinery. This slice intentionally does not claim full
  spec coverage or operational readiness.
- [x] Run `git diff --check`, review the exact scoped diff, and commit only the
  qualification tests and documentation on the isolated branch. No build is
  required for documentation/test-only changes; no full P3 rerun is justified yet.

## Execution choice and progress

The user already requested parallel work and delegated sensible execution.
Continue in this session with serialized writes and independent read-only review;
do not ask the same execution-choice question again.

Task 1 is complete as a bounded source/metadata audit. Task 2 has five named
passes, zero failures, exit 0 (691.090 ms total after review refinement); the fifth test confirms the
absent-status assertion detects an in-memory fail-open mutation. These are unit
characterizations, not live authority proofs. Independent review found no Critical
or Important issues. Its early-refusal test improvement is applied: an unexpected
status observation now throws a distinct error so the later status gate cannot
mask loss of the early cold-history refusal. Scoped re-review resolved both minor
findings; no findings remain. This plan and the tests are delivered together in
the qualification commit, not as a production retention implementation.
No retention code, service state, archive, admission
record or database row was changed while executing this qualification slice.

Source ordering refinement: the stopped recovery route calls
`ensureExactPoisonSpawnerBeforeQuarantineV1` before successor publication
(`baseline-post-handoff-receipt-v1.ts:6973`). Its strict branch requires settled
cold history and matching census (`:6897`). The old-live compatibility shortcut
at `:6882` is not equivalent and must be excluded by the maintenance integration.
New startup checks that durable cold history before singleton/PID publication
(`spawner.ts:11151`); old already-loaded processes lack this new gate and remain
subject to the explicit build-boundary drain requirement.
