# Cutover Owner-Held Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The primary owner executes inline because this repository requires one writer; review agents are read-only.

**Goal:** Make durable preserved-cutover intent publication callable only with a current authenticated controller-owner capability and a matching maintenance plan.

**Architecture:** Keep the existing fixed-root intent store and ordinary-start refusal unchanged. Add one synchronous owner-module composition that validates the intent-to-maintenance relation, checks the opaque owner immediately before publication, publishes through the existing store, then rechecks both owner and fixed-root intent. This is a fail-closed prerequisite, not a live cutover controller, DB fence, or zero-owner certificate.

**Tech Stack:** Node.js ESM, TypeScript compiled internal-production modules, `node:test`, temporary physical fixture roots.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`, especially “Mandatory additional safety: cutover admission refusal” and its owner/publication file map.

## Global Constraints

- Root is the only writer. Do not alter selected historical `dist`, CLI symlink, services, secrets, runtime state, or user worktrees.
- No direct `main` commit, guard bypass, force push, archive deletion, or ambient credential use.
- Maintain V1 intent/refusal semantics and public inspection schemas; this slice grants no cutover effects.
- A publication failure or lost owner capability must never return success or reopen ordinary admission.

## File Map

- `scripts/deployment-cutover-owner.mjs`: add the narrowly scoped owner-held publication composition, using the existing opaque capability, source/build recheck, maintenance relation codec, fixed-root publisher, and observer.
- `scripts/__tests__/deployment-cutover-owner.test.js`: compile only required internal-production fixture modules and test real durable bytes/refusal, forged/stale/crossed owner failures, and post-publication recheck failure.
- `scripts/__tests__/fixtures/deployment-cutover-bootstrap.mjs`: include the two new compiled imports in the authenticated clean-Git bootstrap fixture; without them all existing inspect modes refuse at owner-source load before reaching their intended assertions.
- `docs/superpowers/plans/2026-09-25-cutover-owner-held-publication.md`: causal relation, scope, RED/GREEN and delivery evidence. The missing coupling is a systemic root prerequisite of the approved cutover, not an unrelated feature.

### Task 1: Owner-held intent publication

**Interfaces:** `publishDeploymentCutoverIntentWithOwnerV1(capability, cutoverIntent)` consumes the opaque handle from `acquireDeploymentCutoverOwnerV1`; it returns the strict observed V1 intent only after a matching fixed-root publication and a fresh owner check. It cannot accept a caller-supplied authority root.

- [x] **Step 1: Write RED tests.** In the owner fixture, compile `baseline-deployment-cutover-publication-v1.ts` and `baseline-deployment-cutover-v1.ts`, create a V1 cutover intent from the fixture plan and maintenance hash, then assert that a valid capability publishes exact `intent.json` bytes and a fresh process refuses ordinary start. Assert a forged capability and a crossed plan leave the intent root absent. Assert an owner changed after the publication write cannot produce success.
- [x] **Step 2: Verify RED.** `node --test scripts/__tests__/deployment-cutover-owner.test.js` failed specifically because `publishDeploymentCutoverIntentWithOwnerV1` did not exist; the after-publication test also showed the expected missing side effect.
- [x] **Step 3: Implement minimum composition.** The owner module validates the relation, checks capability before and after the existing fixed-root publication, reobserves exact encoded bytes and permanently refuses after any post-write uncertainty. No live entrypoint was enabled.
- [ ] **Step 4: Verify GREEN and regressions.** Run the focused owner, publication, admission-effect, and script tests; then run the normal clean-worktree build after committing the scoped diff. Never use dirty-build or runtime-guard override flags.
- [ ] **Step 5: Review and deliver.** Independent read-only review, conventional commit on this branch, push, PR checks/comments, merge through PR, clean-main build in the separate deployment clone, and real diagnostic HTTP/host recheck. Do not interpret the diagnostic as cutover authority.

## Spec self-review

The approved transition still requires a purpose-specific admission fence, physical-plus-PostgreSQL tri-state binding, process/service exclusion, journaled effects, Task6A-ready completion and final fleet proof. None is claimed by this task. This slice changes no V1 guard or runtime producer behavior.

## Verification in progress

The focused owner suite passed 24/24, existing ordinary admission/publication/observer tests passed 57/57, authenticated bootstrap tests passed 114/114, genuine dependency/resolution tests passed 43/43, and the internal-production cutover suite passed 385/385. An initial default-concurrency `npm run test:scripts` run exposed missing compiled imports in the clean-Git bootstrap fixture; those imports were added and its 114 tests passed. A second default-concurrency run reached an unrelated retention fixture failure (`dashboard loaded/plist commitments are crossed`); the exact failing test passed alone. The entire script suite then passed 798/798 with `node --test --test-concurrency=1 scripts/__tests__/*.test.js`, including the retention test. This supports a cross-file concurrency interaction in the default run, not a deterministic owner-publication defect. An independent read-only review found no blocking issue and verified the final fixture manifest and strengthened exact-byte/fresh-process tests. Clean build, PR checks, and live cutover remain separate gates.
