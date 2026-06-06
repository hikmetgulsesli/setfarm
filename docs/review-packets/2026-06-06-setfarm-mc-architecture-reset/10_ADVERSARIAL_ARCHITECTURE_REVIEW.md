# Setfarm + Mission Control — Adversarial Architecture Review

> Reviewer: adversarial senior platform architect.
> Source: `00_README_REVIEW_PACKET.md` through `09_SOURCE_ATTACHMENT_MANIFEST.md` in this folder.
> Posture: blunt, structural, non-reassuring. No source files were read beyond the packet; the architecture map, file inventory, and rules inventory are sufficient at the architectural layer.

## 0. Pre-diagnosis facts confirmed from disk

- `src/installer/step-ops.ts` = **8,627 lines** (god file confirmed).
- `src/spawner.ts` = **4,687 lines** (god file confirmed).
- **Three parallel observation systems** exist on disk: `events.ts` (149 lines), `observations.ts` (126 lines), `operation-observability.ts` (110 lines). The packet understates this — it is worse than "dual truth", it is a triple-event-stream.
- The `src/installer/` directory contains at least 70+ files across `steps/`, `supervisor/`, `platform-self-heal/`, `stack-contract/`, plus loose files like `quality-gates.ts`, `error-taxonomy.ts`, `bottleneck.ts`, `compat-engine.ts`, `main-agent-guidance.ts`, `prompt-contracts.ts` — many of which are likely overlapping or underused.

---

## 1. Executive Diagnosis

Setfarm is a **reactive patch-loop machine wrapped around a correct vision**. The Product Contract → Design → Stories → Scope → PR → Evidence → Deploy spine is right. The implementation is wrong, in a specific, repeatable way: every time the system cannot mechanically verify what an LLM agent just claimed, it adds a guard, a checklist, a QA-FIX story, or a self-heal plan instead of fixing the verification itself. The accumulation is now self-defeating.

**True root cause, not symptoms:**

The system has no sharp **LLM-produces / Setfarm-proves** contract. Agents are allowed to authoritatively claim correctness of things Setfarm can prove mechanically: "the build passed", "the test passed", "the screen is wired", "the action fires", "the screen looks right". Whenever an agent's claim is wrong, the response is one more layer of guard rather than one more machine check. That is why the patch loop is stable — every guard added is a confession that the previous layer's claim was unverified.

Three secondary root causes compound it:

1. **Centralized god files** absorb all lifecycle responsibility and become impossible to refactor without a regression. `step-ops.ts` (8.6k lines) owns claim, preclaim, completion, PR, QA-FIX routing, verification, retry, and side effects. `spawner.ts` (4.7k lines) owns process management, watchdog, gateway recovery, runtime discipline, and 19+ agent-behavior guards. Both are too big to be trustworthy and too valuable to delete.
2. **Verification is late and fragmented.** Build/test pass and smoke are not the same thing. Runtime correctness (state actually moves, action actually fires, screen actually renders the new state) is a third thing. The pipeline conflates them, then catches the gap at QA, then routes the fix as a new story, then the supervisor finds a different checklist item, then a new story, then the user sees "completed, but…".
3. **Three event/observation streams** (`events.ts`, `observations.ts`, `operation-observability.ts`) are the substrate MC reads from. That is not "legacy + new", it is a write surface that nobody fully owns. MC's "verified but old PR state OPEN still visible" problem is downstream of this.

You are not building the wrong product. You are building the right product on a **leaky substrate**. The compiler metaphor is the correct one — keep it.

---

## 2. What the System Is Trying To Become

Restated bluntly: Setfarm is supposed to be a **compiler/evidence pipeline** for software, and Mission Control is supposed to be its **build/test/deploy report UI**. The "company" metaphor is a UX device, not a runtime model. The moment it leaks into runtime authority ("supervisor is the PM", "QA is the tester", "reviewer merges the PR") the system becomes a theatre of roles with no one mechanically accountable for the artifact.

What must be true at the end:

- **Setfarm owns**: scope enforcement, build, test, evidence execution, PR creation/merge state, runtime port lifecycle, completion decision, observation emission, MC projection. None of these may be LLM-decided.
- **LLM agents own**: intent (PRD prose, surface list, action catalog), design prose, code diff, review comments, security prose, deploy prose. Their output is **advisory** until Setfarm proves it.
- **Deterministic tools own**: Stitch HTML → JSX compile, generated-screen validation, smoke checks, stack-specific build/start/evidence capture, security scanners, supervisor deterministic checklist.
- **Mission Control owns**: projection from `run_observations` only. It is read-only with respect to the run; it does not emit commands.

The "company" view is what the user sees in the dashboard, but the company never makes a product decision. Setfarm does.

This vision is coherent. **Do not reframe it.** Just enforce it.

---

## 3. Architecture Map Review

### 3.1 `src/installer/step-ops.ts` (8,627 lines)

**Diagnosis**: god file. The "StepModule" contract (per-step module under `src/installer/steps/NN-name/`) is structurally correct, but lifecycle, PR, QA-FIX routing, retry feedback, and cross-step side effects all live in this one file. Steps become "things `step-ops.ts` does" rather than autonomous units with their own contract.

**Concrete refactor**:

- Keep a thin `run-coordinator.ts` (target <600 lines) that owns: claim leasing, run/steps/stories state, observation emission, cross-step invariants (one in-flight claim per run, no re-claim of verified story).
- Move per-step completion logic into each step module: `src/installer/steps/NN-name/completion.ts` (or a method on `StepModule`). Steps must own: how their preclaim artifacts are validated, how their completion criteria are checked, and what their evidence contract is.
- Move QA-FIX routing (which is currently a cross-cutting concern) out. Replace it with a single, small **failure-router** in `src/installer/failure-router.ts` that takes `{story, failure_class, evidence}` and emits one of `{re_claim, link_story, platform_bug}`. The router has a config and a test, not a god mode.
- Move PR lifecycle (`merge-queue-ops.ts`, `pr-state.ts`, `step-verify` comment handling) into a single `src/installer/pr-fsm.ts` with an explicit state machine. Steps call into it; steps do not own it.

**Why**: the current shape means every new step is "edit step-ops.ts". That is the patch loop's source.

### 3.2 `src/spawner.ts` (4,687 lines)

**Diagnosis**: process manager + watchdog + gateway health + 19+ agent-behavior guards in one file. The process-management half is correct and essential. The agent-behavior half is a symptom of the fuzzy LLM/Setfarm contract.

**Concrete refactor**:

- Keep `spawner.ts` to: claim, process spawn, lifecycle, gateway readiness, stale task cleanup. Target <1,500 lines.
- Move all "agent is doing something weird" guards (`runtime-guard.ts`, repeated-tool/self-loop detection, repeated write/edit no-op, git discipline violation, pre-delta context sprawl, irrelevant reference read, generated screen shared read, raw Stitch context read, runtime guard repeat limit) into either:
  - The step module (the step knows what its claim context should contain and what its writes should look like), or
  - The `spawner-prompt.ts` layer (claim context is built so the agent does not see things it shouldn't, removing the need to detect it at runtime), or
  - Delete (most of these are "agent might do X" theater; the right fix is to never give the agent the chance).
- Move gateway health into its own `src/gateway-health.ts` with a state machine.

**Why**: 4,687 lines is unmaintainable. Half of those lines are guards that exist because prompt context is too wide. Shrink the context; the guards become unnecessary.

### 3.3 Step modules

**Diagnosis**: structurally correct (`preclaim / context / prompt / rules / guards / module`), but completion ownership is unclear because `step-ops.ts` does most of it. Step modules also inherit "rules.md + guards.ts + prompts/" as separate files; in practice, a step's full contract is `preclaim + completion + evidence` and the rest is supporting.

**Concrete refactor**: define `StepModule` as owning exactly: `{ preclaim, buildContext, buildClaim, validateCompletion, emitObservations }`. The `StepModule` does not know about PRs, claims, retries, QA-FIX, or other steps. Those live in `run-coordinator.ts` and `failure-router.ts`.

### 3.4 Supervisor

**Diagnosis**: at least six concerns in one layer (`coordinator`, `scanner`, `checklist`, `visual-qa`, `fixer`, `intervention`, `ledger`, `state`, `product-supervisor.ts`). When one component does PM + static analyzer + visual QA + fixer, the authority model is incoherent.

**Concrete refactor**: split into three:

1. **`supervisor-checklist`** — deterministic rules, not an agent. Owns scope drift, missing handler, missing generated screen, design/code mismatch. Output: pass/block per check.
2. **`supervisor-visual`** — optional LLM critic over evidence. Output: structured findings. **Never a fixer.** Can be disabled without breaking the pipeline.
3. **`supervisor-platform-heal`** — see §9. Plan-only, no writes, no resume.

The `fixer.ts` file should be deleted in this reset. It is the single most dangerous file in the repo because it encourages the supervisor to act like a developer.

### 3.5 Platform self-heal

**Diagnosis**: correct intent, correct safety framing in the packet, dangerous if enabled beyond `plan_only`. Components look right (`classifier`, `ownership-map`, `patch-contract`, `runner`, `rollback`, `patch-registry`, `strictness-delta`, `write-interceptor`). The risk is the same as everywhere else: the moment a self-heal runner can write, reward hacking is one PR away.

**Concrete recommendation**: §9.

### 3.6 Implement evidence / runtime driver

**Diagnosis**: this is **the correct exit from the patch loop** and should be the spine of the reset. `runtime-driver.ts` + `web-runtime-driver.ts` + `runtime-ports.ts` + `implement-evidence*` + `stack-evidence.ts` is the right shape. It is currently **advisory**, which is why the loop is still patch-driven.

**Concrete refactor**: §6.

### 3.7 Mission Control

**Diagnosis**: correct vision, wrong substrate. Reads from three event streams, projects inconsistently, and renders stale observations as live blockers. `index.html` is a single-file UI doing too much (projection + activity + filmstrip + project cards).

**Concrete refactor**: §10.

### 3.8 Stitch / design / generated screen pipeline

**Diagnosis**: `scripts/stitch-to-jsx.mjs` + `scripts/generated-screen-validator.mjs` + `scripts/design-dom-extract.mjs` is a **deterministic compiler** for design-to-code. This is correct. The problem is that the gates are scattered: design consistency in setup-build, generated-screen validation in a separate script, unknown icon fallback in stitch-to-jsx, blanket CSS in design rules. Same logical check, different layers.

**Concrete refactor**: collapse all design/import consistency into one **design import gate** run at the end of `05-setup-build`. Output: a signed design import certificate. No IMPLEMENT story begins without it. Delete `generated-screen-validator.mjs` as a separate concern — fold its checks into the gate.

---

## 4. Guard / Rule / Contract Review

You are not "adding too many contracts" in the abstract. You are **adding contracts in the wrong layer**. The fix is not fewer contracts; it is **moving them to where they can be enforced mechanically**, and **deleting the ones that exist to compensate for an unfocused LLM context**.

### 4.1 Essential platform invariants (keep, harden)

- Scope enforcement at write time (not post-hoc diff). Owned by step module + write interceptor.
- PR FSM with explicit `OPEN → REVIEWED → CHANGES_REQUESTED → APPROVED → MERGED → POST_MERGE_CHECKED` states. Owned by `pr-fsm.ts`.
- Deterministic build + test gate. Owned by stack pack.
- Stack contract validation at `05-setup-build`. Owned by stack pack.
- Design import certificate. Owned by design import gate.
- Immutable platform tests. Owned by `tests/platform-invariants/*` and **enforced by write interceptor at write time**, not at code review.
- Runtime evidence contract for any story that produces UI/state/route. Blocking.
- Three-observation-stream → **one** observation stream. Owned by `observations.ts`. The other two are removed.

### 4.2 Symptoms of a bad abstraction (delete or relocate)

- Most `spawner.ts` runtime discipline guards (loop detection, no-op write, context sprawl, raw Stitch read, irrelevant reference read, generated screen shared read, broad `pkill`/`killall` ban). These exist because the agent's claim context is too wide. Fix the context, not the guard.
- "Supervisor as fixer" (`fixer.ts`). Delete.
- "QA opens new stories" (QA-FIX). Replace with re-claim / link_story / platform_bug.
- Triple event stream. Remove two of them.
- Per-project guards in `step-ops.ts` and `spawner.ts`. If a guard only matters for one stack, move it to that stack pack.

### 4.3 Move earlier in the pipeline

- SCREEN_MAP/UI_CONTRACT/DESIGN_DOM consistency → end of `05-setup-build`, hard gate, with a certificate. Stop checking in IMPLEMENT/QA.
- Unknown Material Symbol fallback → `scripts/stitch-to-jsx.mjs` (already there, but make it **hard fail** at design import gate).
- Blanket `transition: all` → design import gate, sanitize or hard fail.
- Generated screen shared read → either narrow claim context (preferred) or design import gate.

### 4.4 Move to stack pack

- Stack-specific build, dev server start, port, evidence capture, smoke checks. Do not leak Vite/Web specifics into Setfarm core.
- Stack-specific lint / typecheck / format / test commands. Step modules say "stack must pass these"; stack pack knows how.

### 4.5 Move to evidence (delete from guards)

- Anything that needs the running app: button visible, action fires, state changes, route works, form submits, screen renders after action. These are **evidence contracts**, not guard checks. The agent should not be asked "did the button work?"; Setfarm should run an interaction and read DOM/state.

### 4.6 Delete

- `fixer.ts`.
- Redundant runtime discipline guards (the ones that detect the same thing twice).
- The QA-FIX story category (see §7).
- `events.ts` and `operation-observability.ts` (or merge into `observations.ts` and pick one — but pick one).

### 4.7 Are we adding too many contracts?

Wrong framing. You are **adding contracts in the wrong layer**. The contracts on the LLM side ("agent may not do X") are unreliable and the guards that enforce them are the patch loop. The contracts on the **mechanical** side (build, test, evidence, scope enforcement, PR state) are reliable and underused. Move the budget there.

---

## 5. Pipeline Step Review

For each step: what it owns, what it never owns, output/evidence, what stops here, what routes back, what is a platform issue, and what current behavior is wrong.

### 01 PLAN
- **Owns**: portable Product Contract — project name/slug, platform, stack family, DB/design decisions, PRD, Product Surfaces, ACT_* actions, testability contract.
- **Never owns**: repo path, branch, package name, physical screen list, runtime identity, port.
- **Output**: a single `product-contract.json` (and prose PRD if used).
- **Stops here**: PRD too vague to drive a design, surface list internally inconsistent, action catalog self-contradictory.
- **Routes back**: nothing (this is the first step). Re-run is the only path.
- **Platform issue**: LLM cannot produce a coherent PRD with the current model. Not a step fix.
- **Current behavior that seems wrong**: PLAN is too free-form in practice; without a strict schema, DESIGN inherits a vague surface list and downstream steps compensate with more guards.

### 02 DESIGN
- **Owns**: binding each Product Surface to a Stitch design artifact (HTML/PNG/DOM/tokens/manifest). Produces SCREEN_MAP, DESIGN_SYSTEM, surface mapping.
- **Never owns**: repo, branch, import, generated React files.
- **Output**: design artifact bundle + `surface-map.json` (surface_id → stitch_screen_id).
- **Stops here**: Stitch project unreachable, screen count ≠ surface count, unmapped surface, missing required tokens.
- **Routes back**: PLAN (if PRD surface list is internally inconsistent).
- **Platform issue**: Stitch API outage, material symbols catalog drift.
- **Current behavior that seems wrong**: Stitch physical screen count is allowed to disagree with Product Surfaces until very late. This is the **design import gap** failure class and it is caught at IMPLEMENT/QA, not here. Catch it at the end of DESIGN as a hard gate.

### 03 STORIES
- **Owns**: per-story scope, acceptance criteria, owned files, generated screen ownership, action bindings.
- **Never owns**: design artifacts, repo, PR.
- **Output**: `stories.json` (one entry per story with: id, summary, scope_files, acceptance_criteria, evidence_contract, action_bindings, generated_screen_ref).
- **Stops here**: story references a surface that does not exist, scope file is outside the project, generated screen has no action bindings.
- **Routes back**: DESIGN (if surface mapping is missing).
- **Platform issue**: STORIES itself is a deterministic expansion once PRD + SCREEN_MAP are stable. If it is not deterministic, the PRD/SCREEN_MAP is under-constrained.
- **Current behavior that seems wrong**: scope is generated as prose, not as a deterministic file set. This makes scope drift hard to detect mechanically.

### 04 SETUP-REPO
- **Owns**: repo scaffold, git init, branch, DB provisioning, design contract copy.
- **Never owns**: dependency install (that is setup-build), runtime start, port (that is deploy/runtime).
- **Output**: repo at known path, branch created, design contracts in place.
- **Stops here**: git init failed, branch already exists and is dirty, DB unreachable.
- **Routes back**: nothing mechanical — human.
- **Platform issue**: git/db layer.
- **Current behavior that seems wrong**: this step is currently mostly correct; the issue is that it is sometimes asked to do design import. That belongs in setup-build.

### 05 SETUP-BUILD
- **Owns**: dependency install, baseline build, design import (`stitch-to-jsx`), generated screen registration, design import certificate.
- **Never owns**: implement logic, PR, runtime.
- **Output**: `setup-certificate.json` (build pass, all generated screens registered, no unknown icons, no blanket CSS, SCREEN_MAP ↔ UI_CONTRACT ↔ DESIGN_DOM consistent, design import gate pass).
- **Stops here (hard)**: build fail, missing generated screen, unknown icon, blanket CSS, SCREEN_MAP mismatch.
- **Routes back**: SETUP-REPO (env/dep), DESIGN (artifact).
- **Platform issue**: stack pack.
- **Current behavior that seems wrong**: this step is sometimes allowed to mark "build pass" as success even when design import is broken. The fix is a single hard gate: **no certificate, no IMPLEMENT**.

### 06 IMPLEMENT
- **Owns**: scoped code change in a worktree. Reads claim summary + UI_CONTRACT/SCREEN_INDEX. Writes only files in `.story-scope-files` (and explicitly granted shared files).
- **Never owns**: stage, commit, push, PR, merge. Never self-certifies runtime correctness in prose.
- **Output**: scope diff + `IMPLEMENT_INTENT.json` + (optional) `IMPLEMENT_VERIFICATION_REQUEST.json` + implement evidence (run by Setfarm) + `IMPLEMENT_EVIDENCE.json` (written by Setfarm).
- **Stops here**: scope drift, generated screen missing action wiring, build/test fail, evidence fail, supervisor deterministic checklist fail.
- **Routes backward**: re-claim same story (default, with a retry-feedback). After 3 re-claims → platform bug or story graph bug.
- **Platform issue**: stack pack can't capture evidence, runtime driver port conflict, build environment.
- **Current behavior that seems wrong**: agent is allowed to write "build/test passed" prose and have it accepted. It must not be. The evidence artifact is the only acceptable signal of correctness.

### 07 VERIFY
- **Owns**: PR FSM transitions, comment lifecycle, post-merge correctness.
- **Never owns**: implement logic, merge decision (Setfarm owns the merge after review is clean and CI is green).
- **Output**: `pr-state.json` per PR.
- **Stops here**: merge conflict, CI fail, post-merge check fail.
- **Routes back**: IMPLEMENT (actionable comment, conflict, CI).
- **Platform issue**: GitHub state misread, CI provider down.
- **Current behavior that seems wrong**: PR state OPEN observation can outlive the actual merge, because MC reads from multiple streams. Fix the streams first; the FSM will then be sufficient.

### 08 SECURITY-GATE
- **Owns**: deterministic secret scan, unsafe sink, dangerous eval, sensitive storage checks. Bounded LLM critic for prose.
- **Never owns**: QA, runtime smoke, design.
- **Output**: `security-report.json` (severity, location, recommendation).
- **Stops here**: critical (fail run), high (route to IMPLEMENT retry with security context).
- **Routes back**: IMPLEMENT for high; PLATFORM BUG for analyzer false positives.
- **Current behavior that seems wrong**: security is sometimes conflated with QA. It is a separate gate with a separate artifact; it must not block on prose.

### 09 QA-TEST
- **Owns**: runtime smoke + structured QA report from the same evidence pipeline that IMPLEMENT used.
- **Never owns**: writing tests, opening new stories, fixing code.
- **Output**: `qa-report.json` (per-check pass/fail with evidence references).
- **Stops here**: nothing — it always emits a report.
- **Routes**: re-claim current story (default) / link_story (cross-file) / platform_bug (evidence pipeline). **No QA-FIX stories.**
- **Current behavior that seems wrong**: QA is currently allowed to open QA-FIX stories, which is the primary patch-loop source. Remove this authority.

### 10 FINAL-TEST
- **Owns**: pre-deploy final smoke + evidence parity (re-runs the same evidence contract as QA-TEST, must produce a deterministic pass).
- **Never owns**: opinionated pass on prose.
- **Output**: `final-test.json`.
- **Stops here**: same as QA-TEST routing.
- **Current behavior that seems wrong**: final-test can pass on prose or raw log. It must be a re-run of the evidence pipeline.

### 11 DEPLOY
- **Owns**: runtime port allocation, service registration, project visibility, stop/start, runtime URL.
- **Never owns**: correctness verification.
- **Output**: `project-runtime.json` (port, URL, state, last_healthcheck).
- **Stops here**: port conflict, missing runtime URL, stale service registration.
- **Current behavior that seems wrong**: cancelled/failed old project cards remain in MC; runtime URL can be missing. Project visibility must be a function of `DEPLOY` state, not a function of card creation time.

### 12 SUPERVISE
- **Owns**: product coherence (deterministic checklist), visual evidence review (LLM critic, optional), platform failure classification (self-heal plan-only).
- **Never owns**: fixing code, opening new stories, inspecting Setfarm/MC code (that's the self-heal planner with a separate trust boundary).
- **Output**: `supervisor-report.json` (checklist results), `supervisor-visual.json` (findings), `self-heal-plan.json` (proposed patches, never applied automatically).
- **Current behavior that seems wrong**: SUPERVISE is currently allowed to act as fixer and as platform patcher. Split it.

### Cross-step problem to address
- **What is wrong**: the failure routing policy is implicit. Each step "decides" what to do, but the decision is scattered across `step-ops.ts`, supervisor, and QA logic. Replace with an explicit `failure-router.ts` with a test. The router has three outputs: `re_claim`, `link_story`, `platform_bug`. Period.

---

## 6. Runtime Evidence / Inner Dev Loop Review

**Yes, the universal inner dev loop is the right escape from endless project-specific rules.** The principle: any time the system has to ask "does this actually work at runtime?", Setfarm must answer that mechanically, not the LLM.

### 6.1 Is this the right way to escape endless project-specific rules?
Yes. The patch loop exists because correctness is judged by **what the LLM said** rather than **what the running system did**. The inner dev loop flips that. The LLM proposes; Setfarm proves. Once proof is mechanical, the rule count collapses because every "did the agent do X" guard becomes "did Setfarm observe X" evidence.

### 6.2 Should every story require runtime evidence?
No. Stories that produce **runtime surface** (UI, state, route, action, screen) require runtime evidence. Stories that produce **non-runtime surface** (config, types, schema, internal refactor) require build + test + typecheck evidence. The evidence contract is per story type, set at STORIES time, not at runtime.

### 6.3 How for web apps?
Stack pack for Vite/React: `RuntimeDriver.start()` boots dev server on an MC-allocated port, waits for a deterministic readiness signal (HTTP 200 on a known route, or DOM `__READY__` marker), runs the story's interaction plan (click, type, navigate), captures (a) screenshot, (b) DOM, (c) state snapshot (Redux/Zustand/etc. via a small bridge), then `stop()`. Evidence contract is a JSON file with: initial state, interactions, captured artifacts, post-state, assertion results. The runner, not the agent, produces the assertion results against a contract emitted at story time.

### 6.4 How for browser games?
Same shape: start dev server, wait for canvas/render, run interaction plan (input events), capture (a) screenshot of game state, (b) canvas readback or visible DOM, (c) `window.__GAME_STATE__` if exposed via a small bridge. State assertion is the main signal; screenshot is supplementary. Game-loop deterministic play is unrealistic; interaction plan and state diff are what prove it works.

### 6.5 How to generalize to API / CLI / mobile?
- **API**: `RuntimeDriver.start()` boots the server, then `interact()` is HTTP requests with expected status + body schema. Evidence is a HAR-like trace plus JSON response diffs. No screenshots.
- **CLI**: `RuntimeDriver.start()` runs the binary in a controlled environment, then `interact()` is stdin/argv, capture is stdout/stderr/exit code. Evidence is a recorded run + diff against expected output.
- **Android/iOS**: native build + simulator/emulator launch + UI hierarchy capture + screenshot + logcat. Same interface, different driver. The interface does not change; the driver does.

### 6.6 Advisory vs blocking?
**Blocking** for any story whose evidence contract says runtime. Advisory for any story that does not need runtime. The toggle exists for transition; default is blocking. The packet's own fear — "blocking moda erken geçilirse mevcut agent'lar çok fazla takılır" — is real, but the answer is **fix the evidence pipeline so it is reliable**, not weaken the gate. A flaky blocking gate is a different problem (flakiness) and is solved by deterministic readiness + retries, not by making it advisory.

### 6.7 VLM / vision?
**Advisory, never primary, always on top of structured evidence.** A VLM judge looking at a screenshot is not a correctness proof; it is a critic. The contract is: structured evidence (DOM, state, HTTP) is primary; VLM is a critic that flags visual regressions and design/code mismatch. The VLM never decides pass/fail on its own. This keeps evidence cheap, fast, and stack-agnostic; VLM is a per-stack optional add-on.

### 6.8 Avoid shallow screenshots
- Require **at least two captures per story** (initial + after-action) so a static blank/loading screen is structurally detectable.
- Require **interaction** before the post-capture; if there is no interaction step, the evidence contract is invalid.
- Require **DOM/state assertion** alongside the screenshot; a screenshot with no assertion is invalid.
- Stamp a **story-unique salt** into the UI (e.g. data attribute set by the runner) so a cached or stale page is detected.

### 6.9 Avoid runtime overhead
- One runtime per run, not per story — reuse the dev server between stories. Stop only at the end of IMPLEMENT/QA/FINAL-TEST.
- Deterministic port allocation and readiness probe; no polling hell.
- Capture in parallel (screenshot + DOM + state) on one navigation, not three.
- Cap evidence size (downscaled screenshots, truncated DOM). The evidence is for the gate, not the gallery.

### 6.10 Target evidence architecture
- `RuntimeDriver` interface: `start, stop, interact, capture, assert`. Stack packs implement it.
- `EvidenceContract` emitted at STORIES time: `{ story_id, interactions, assertions, artifacts }`.
- `EvidenceRunner` (Setfarm-owned): orchestrates driver, captures, runs assertions, writes `IMPLEMENT_EVIDENCE.json`. **Not an LLM step.**
- `EvidenceGate`: blocking/advisory per story type. Default blocking for runtime stories.
- `EvidenceFilmstrip` (read model): per story, sequence of capture tuples. Rendered in MC detail view, not main view.

---

## 7. QA-FIX Loop and Patch Loop Analysis

**QA-FIX as currently implemented is invalid as a default.** It exists because IMPLEMENT was allowed to "verify" on its own claim rather than on evidence, and QA was allowed to compensate by opening a new story. That is a feedback loop in the wrong direction.

### 7.1 When should QA-FIX exist?
**Only when the failure requires touching files outside the failing story's scope and the same story cannot be re-claimed with a broader scope grant.** That is rare. Most failures are: (a) the current story's fault (re-claim), (b) a story graph bug (link_story), or (c) a platform bug.

### 7.2 When should a failure go back to the original story?
- Build/test/evidence fail in current story.
- Generated screen missing action wiring (story owns that screen).
- Scope drift (story wrote outside scope).
- Design/code mismatch caught by deterministic checklist.
Default: re-claim with retry feedback. Bounded retries per story (recommend 3).

### 7.3 When should a failure become a platform bug?
- Evidence pipeline fails (port conflict, readiness timeout, capture failure, browser crash).
- Smoke gate produces a deterministic false positive on the same stack repeatedly.
- `stitch-to-jsx` cannot compile a valid design.
- `setup-build` cannot produce a design import certificate for a valid surface.
- Supervisor deterministic checklist misfires on a known pattern.
These are not stories; they are patches. In `plan_only` self-heal mode, they become patch plans; human/Codex applies.

### 7.4 How to prevent infinite repair loops?
- **Bounded re-claim per story** (3 retries → escalate).
- **Bounded total re-claim per run** (configurable; default 20).
- **No QA-FIX stories by default**; the only way to exceed the retry budget is a `link_story` (explicit cross-scope grant) or a `platform_bug` (patch plan).
- **No self-modification of platform code during a run.** Self-heal is plan-only in the same run.

### 7.5 How to prevent "story verified but product still broken"?
- **Final-test re-runs the evidence pipeline that IMPLEMENT/QA used**, against the merged state. If it passes, deploy; if it fails, it is the same evidence contract that failed, routed the same way.
- **Final-test is the only thing that can mark a project deployable.** A "story verified" badge is a story-level fact, not a project-level fact.
- **MC projects page** shows deployability, not story count. A project with all stories verified but final-test not passed is **not deployable** and is shown that way.

### 7.6 Should QA happen earlier, later, or continuously?
- **After every IMPLEMENT story** (deterministic, evidence-based). This is the inner dev loop.
- **Once before DEPLOY** as FINAL-TEST (re-run, deterministic).
- **Not continuously** in the streaming sense; the inner dev loop is per story, not per LLM token.

### 7.7 Precise failure routing model
```
on failure:
  if evidence_pipeline_failed(platform)        -> platform_bug
  elif story_graph_inconsistency               -> link_story
  elif within current story scope               -> re_claim(bounded=3)
  else                                          -> platform_bug   # unknown failure class is a platform bug, not a story
```

Three outputs, deterministic, testable.

---

## 8. Supervisor Review

### 8.1 What supervisor actually should be
Three narrow, clearly bounded things, none of which fix code:

1. **Deterministic product checklist** (not an agent). Output: `{check_id, pass, evidence_ref}`. Owns: scope drift, missing handler, missing generated screen, design/code mismatch, dead routes.
2. **Visual evidence critic** (optional LLM, can be disabled). Output: `{finding, severity, evidence_ref}`. Owns: visual design regression, design/code coherence beyond what DOM diff can catch. **Never a fixer.**
3. **Platform self-heal planner** (separate trust boundary). Output: `{classification, patch_plan, confidence, rollback_handle}`. **Never a writer.**

### 8.2 Should supervisor inspect generated app code?
Only the deterministic checklist, on a read-only basis. No LLM supervisor should write or modify generated app code.

### 8.3 Should supervisor inspect Setfarm/MC code?
Only the self-heal planner, and only to **propose patches**. No write authority. The trust boundary is: planner can read, cannot write; human (or future external Codex with explicit approval) writes.

### 8.4 Should supervisor be allowed to patch?
No. Delete `supervisor/fixer.ts`. Patching is a human activity gated by a patch plan and a rollback handle.

### 8.5 Should supervisor only report?
Yes. That is the model. Reporting means: a structured artifact (`supervisor-report.json` / `supervisor-visual.json` / `self-heal-plan.json`) consumed by `run-coordinator` and by MC. The coordinator reads it; it does not act on it except to emit observations and route failures per §7.

### 8.6 Should supervisor be separated into multiple roles?
Yes — three roles, as above. They share a folder for now but have **separate entry points and separate output artifacts**. They must not be importable into each other.

---

## 9. Platform Self-Heal Review

**Verdict: self-healing Setfarm in any patch-writing mode is not safe in the current architecture.** The plan-only mode is safe and useful. Patch-writing modes must wait.

### 9.1 Is self-healing Setfarm a good idea?
Plan-only: **yes**. Patch-only / patch-and-resume: **not yet, not in this architecture**. The reason is not that the components are wrong (they are mostly right: `classifier`, `ownership-map`, `patch-contract`, `runner`, `rollback`, `patch-registry`, `strictness-delta`, `write-interceptor`). The reason is that the **immutable test suite and the ownership boundary are not yet strong enough to constrain reward hacking**.

### 9.2 Catastrophic failure modes
- **Relax the smoke test** to make it pass → green build, broken product.
- **Delete a guard** the planner misclassifies as redundant → patch loop returns worse.
- **Misclassify "MC visibility bug"** as a code bug → MC hides the very blocker the user is looking at.
- **Hot-patch a running build** during `patch_and_resume` → module cache/state corruption, half-applied changes.
- **Self-certify own patch success** with prose → the same agent that wrote the bug is the only one saying it is fixed.

### 9.3 Can it run in `plan_only`?
**Yes.** This is the only mode I would enable by default. Outputs: classification, patch plan, diff preview, expected tests, rollback handle. No file writes. MC shows the plan as a finding. Human decides whether to apply.

### 9.4 Can it run in `patch_only`?
**No, not yet.** The preconditions are not met:
- Immutable platform tests must be enforced at write time by `write-interceptor.ts`, not at review time.
- The full platform test suite must pass after every patch, not only patch-selected tests.
- `strictness-delta.ts` must **auto-reject** any patch that removes a `throw`, deletes an assertion, or relaxes a threshold.
- Patch lineage must be recorded in `patch-registry.ts` and visible in MC.
- A human or external Codex approval must be required per patch.

If those are met, `patch_only` becomes plausible for a narrow class (e.g. known-pattern JSON updates, ownership map corrections, deterministic bug fixes with a regression test). It is **not** plausible for "fix the runtime guard that is firing too often" type patches — those are the ones most likely to be reward hacks.

### 9.5 Should `patch_and_resume` ever exist?
**Not in this architecture, not in this generation.** Resume after platform patch implies hot module reload of the orchestrator mid-run. That is a research project, not a feature. If you want autonomous improvement, do it **between runs**, not during a run. Run N completes; patch is applied; run N+1 starts with the new code.

### 9.6 Required immutable tests
- `tests/platform-invariants/*` — define what is immutable.
- These tests run on every patch attempt and on every platform build.
- They are enforced at write time: any patch that would modify a file under `tests/platform-invariants/` is rejected by `write-interceptor.ts` before the patch is written.
- A second class: `tests/regression/*` for every patch-registry entry. Every patch must add a regression test or it does not get applied.

### 9.7 Required write restrictions
- `ownership-map.ts` is the only source of truth for "which files this class of failure may patch".
- `write-interceptor.ts` runs at write time, hashes pre-state, blocks out-of-scope writes, blocks immutable paths, blocks strictness-delta violations.
- A patch is a single transaction: write → test → rollback on fail. No partial states.

### 9.8 Required rollback model
- Pre-patch file hashes (not just git HEAD) recorded by `write-interceptor.ts` at write time.
- Rollback restores those hashes, not the latest commit, because a patch may have been applied after a commit and we want to revert **the patch**, not the work.
- `patch-registry.ts` records `{patch_id, files, hashes_pre, hashes_post, tests_run, rollback_handle}`. Visible in MC.

### 9.9 Should the current run resume after platform patching?
**No.** Patches apply between runs. Run state is not "hot reloaded". If a run was using a patched-out feature, it is failed with a clear "platform changed, restart run" state.

### 9.10 Should MC show the patch?
**Yes, prominently.** MC should show: classification evidence, patch plan, diff, tests run, rollback handle, applied/not-applied status, who approved.

### 9.11 Safe rollout plan
- **Phase A (now)**: `plan_only` only. No writes. MC exposes plans.
- **Phase B (after)**: `patch_only` for a narrow class (e.g. ownership-map updates, known-pattern JSON updates) with human approval and a regression test. No same-run resume.
- **Phase C (later, if ever)**: `patch_and_resume` is a research project, not a product. Reject for now.
- **At all phases**: immutable platform tests enforced at write time; strictness-delta auto-rejection; full test suite on every patch; rollback by file hash.

---

## 10. Mission Control Review

### 10.1 Should MC derive everything from `run_observations`?
**Yes, exclusively.** Remove `events.ts` and `operation-observability.ts` (or pick one and delete the other two; do not keep all three). MC reads from a single observation stream + a small set of read models derived from it.

### 10.2 Should legacy events be removed?
**Yes.** Dual/triple truth is the source of "stale PR state OPEN still visible" and "verified but blocked". Removing the legacy streams is non-negotiable for the reset.

### 10.3 Read models / projections needed
- **RunSummary**: project, current step, current story, current agent, last activity, status (running / paused / failed / succeeded / cancelled).
- **StoryTimeline**: per story — claims, evidence, PR state, comments, status transitions, supervisor findings, QA findings.
- **PRBoard**: per PR — state, comments (open/resolved), reviewers, merge status, last activity.
- **EvidenceFilmstrip**: per story — capture tuples (timestamp, screenshot, DOM, state, assertion results).
- **SupervisorFindings**: per run — classifications, intervention proposals, platform patch plans.
- **QAFindings**: per story — structured check results.
- **PlatformPatchLineage**: per run — patch plans, applied status, rollback handles, approval.
- **ProjectCard**: deployable? last final-test, last deploy, runtime URL, port, health.

### 10.4 Main view vs detail view
- **Main view (Projects)**: project card with deployable / not deployable, current state, last activity. Cancelled / failed / stale cards hidden by default, surfaced via filter.
- **Run detail (current run)**: stepper (12 steps), per-step state, current story, current agent avatar, live activity stream (server-derived, not raw events), runtime URL.
- **Story detail drawer**: scope files, evidence filmstrip, PR state, supervisor findings, QA findings, last few observations.
- **PR detail drawer**: comment lifecycle (open → resolved), review state, merge state, post-merge checks.
- **Platform patch detail drawer**: classification evidence, patch plan, diff, tests, rollback handle, approval status.

### 10.5 Live progress
- Server polls `run_observations` at a short interval (e.g. 1s) and updates read models. Push to UI via SSE or short-poll. UI does not subscribe to events directly; it consumes derived state.

### 10.6 Stale / superseded blockers
- A finding is "superseded" when a later observation references the same entity and resolves it (e.g. PR state MERGED supersedes PR state OPEN). The read model must compute current state, not replay events. Superseded items are kept in the timeline (audit) but hidden from the main blocker list.

### 10.7 No fake "done" states
- A story is "done" only when its evidence contract is satisfied.
- A run is "succeeded" only when FINAL-TEST passes and DEPLOY registers.
- A project is "deployable" only when its current run is succeeded and not cancelled.

---

## 11. Agent Role / Company Design

### 11.1 Is the current role set enough?
Roles are roughly right; the problem is authority, not count.

### 11.2 Are there too many roles?
Not really, but the **deterministic checklist** and **visual critic** should not be LLM agents — they should be deterministic tools with optional LLM criticism. That removes two "agents" in practice without changing the UX metaphor.

### 11.3 Should some roles be deterministic tools instead of agents?
- **setup-build** is mostly mechanical. Make it deterministic; the LLM is only invoked if a non-deterministic decision is needed.
- **stitch-to-jsx / generated-screen-validator / smoke-test** are already scripts; keep them as deterministic tools.
- **security scanner** is deterministic; the LLM is a bounded critic on the report, not a free agent.
- **supervisor-checklist** is deterministic; the LLM is the visual critic.
- **platform-self-heal-planner** is deterministic classification + bounded LLM critic; no agent writes.

### 11.4 Should developer agents be narrower?
Yes. The developer agent should only:
- read its claim summary + UI_CONTRACT/SCREEN_INDEX + scope files;
- produce a code diff;
- optionally request verification (`IMPLEMENT_VERIFICATION_REQUEST.json`);
- not stage, commit, push, open PR, run build, run test, or claim runtime correctness.

### 11.5 Should reviewer merge PRs?
**No.** Setfarm merges after: (a) all actionable comments resolved, (b) CI green, (c) post-merge check pass. The reviewer LLM criticizes; Setfarm acts.

### 11.6 Should QA write tests, or only execute predefined evidence contracts?
**Only execute predefined evidence contracts.** A missing test is a stack-pack gap or a story-graph gap, not a QA responsibility. If QA finds a test is missing, that becomes a `link_story` or `platform_bug`, not a new story.

### 11.7 Should there be a platform architect agent?
No. The platform architect's job is **structural decisions** (e.g. "should we add a new stack pack", "should this guard be moved"). That is a human role, possibly augmented by an LLM that proposes options. It is not a runtime agent.

### 11.8 Should Codex act as supervisor over Setfarm itself?
**Codex as supervisor = the self-heal planner in `plan_only` mode.** That is a real and useful role. Codex as **executor** of platform patches = not yet, only with human approval and the safety invariants in §9.

### 11.9 Role model with authority boundaries
- **planner** (LLM): produces PRD + surface list + actions. Read-only on repo.
- **designer** (LLM): produces design prose, surface mapping. Read-only on repo.
- **developer** (LLM): produces code diff in scope. Read claim, not repo.
- **reviewer** (LLM critic): produces comment list. Cannot merge.
- **qa-tester** (deterministic + bounded LLM): runs evidence contract, produces structured report. Cannot open stories.
- **security-gate** (deterministic scanner + bounded LLM critic): produces security report. Cannot patch.
- **supervisor-checklist** (deterministic): pass/block. No LLM.
- **supervisor-visual** (optional LLM critic): produces findings. No fix.
- **self-heal-planner** (deterministic + bounded LLM): produces patch plan. No write.
- **deployer** (Setfarm): registers project, allocates port, starts runtime. No LLM.
- **run-coordinator** (Setfarm): owns lifecycle, claims, observations, failure routing. No LLM.
- **evidence-runner** (Setfarm): owns runtime capture, assertions, evidence artifact. No LLM.
- **mc-projection** (Setfarm): owns read models. No LLM.

---

## 12. Multi-Stack Future

### 12.1 What must be stack-agnostic?
- Step lifecycle, claim / preclaim / completion.
- Scope ownership and write interceptor.
- PR FSM and merge state.
- Observation writer.
- `RuntimeDriver` interface.
- `StackContract` interface.
- `EvidenceContract` per story.
- Failure router.
- MC read models.

### 12.2 What belongs in stack packs?
- Build command, dev server start, port conventions, evidence capture driver, smoke checks, stack-specific lint / typecheck / test commands, design contract conventions (e.g. SCREEN_MAP for React, manifest for Android).

### 12.3 Universal interface
- `RuntimeDriver` — `start, stop, interact, capture, assert`.
- `StackContract` — `detect, validate, evidence_capabilities, build_steps, design_artifacts`.
- `EvidenceContract` — emitted at STORIES time, consumed at IMPLEMENT / QA-TEST / FINAL-TEST.

### 12.4 Runtime/evidence per stack
- Vite/React: web driver, screenshot + DOM + state, HTTP probe.
- Next.js: same as Vite + server-side render check.
- Browser game: canvas + state bridge, no DOM in the same way; interaction plan via input events.
- API: HTTP probe, response diff.
- CLI: stdin/argv, stdout/rc diff.
- Android: emulator, UI hierarchy, logcat, screenshot.
- iOS: simulator, UI hierarchy, screenshot.

### 12.5 Avoiding endless stack-specific rules
- Rules live in stack packs. Setfarm core has no "Vite says…" or "Expo says…". If a rule is only true for one stack, it is in that stack pack.
- A stack pack is a bounded module with the same shape as every other stack pack. You can add a stack by adding a pack, not by editing core.
- The failure router has a small set of failure classes (`evidence_pipeline_failed`, `story_graph_inconsistency`, `within_scope`, `unknown`). New stacks must map into these classes; if they cannot, that is a stack-pack problem, not a core problem.

### 12.6 Should mobile wait until web is stable?
**No, in parallel.** Mobile is a different runtime driver, not a different Setfarm. The interface is the same. Build the `AndroidRuntimeDriver` and `iOSRuntimeDriver` against the existing `RuntimeDriver` interface. The only thing that should wait is the design pipeline (Stitch is web-first), which mobile can mock via its own design contract until a mobile design source is plugged in.

---

## 13. What To Stop Doing Immediately

- **Stop running new sample projects to discover new failure modes.** You are not learning anything about the architecture from the Nth generated app; you are confirming that the patch loop is stable. The next failure mode is inevitable.
- **Stop adding project-specific guards.** Any guard that exists because one project misbehaved is a sign the wrong layer is enforcing the rule. Move it to the right layer or delete it.
- **Stop letting QA open QA-FIX stories.** This is the single largest source of the patch loop. Replace with re-claim / link_story / platform_bug.
- **Stop letting supervisor patch anything.** Delete `supervisor/fixer.ts`.
- **Stop trusting agent self-review for runtime correctness.** The agent can request verification; only Setfarm can certify it.
- **Stop merging legacy events with `run_observations`.** Remove `events.ts` and `operation-observability.ts` (or pick one and delete the other two). Single observation stream.
- **Stop adding new spawner runtime discipline guards.** Shrink the claim context; the guards become unnecessary.
- **Stop adding new agent roles.** Roles are roughly right; the problem is authority, not headcount.
- **Stop letting a single run touch platform code.** Self-heal is plan-only in the same run, full stop.
- **Stop using prose as a completion signal.** A story is not done because the LLM said so.

---

## 14. What To Build Next

A decision-complete roadmap. Phases are ordered by leverage, not by date.

### Phase 0 — Stop the bleeding (1–2 days)
**Goal**: stop the patch loop from getting worse.
- **Files / subsystems**: `src/installer/step-ops.ts` (frozen), `src/installer/supervisor/fixer.ts` (deleted), `src/installer/events.ts` and `src/installer/operation-observability.ts` (frozen, not deleted yet).
- **Behavior changes**: disable QA-FIX story creation. Disable `supervisor/fixer` invocation. Freeze new spawner discipline guards.
- **Tests required**: a regression test that asserts no QA-FIX story is opened; a regression test that asserts `fixer.ts` is not imported.
- **Acceptance**: a run with a smoke failure routes to `re_claim` or `platform_bug`, not to a new story.
- **Risks**: existing runs mid-flight will break; acceptable.

### Phase 1 — One observation stream (1 week)
**Goal**: MC reads from a single source of truth.
- **Files**: `src/installer/observations.ts` (canonical), `src/installer/events.ts` and `src/installer/operation-observability.ts` (delete or merge into observations). `src/server/dashboard.ts` reads from observations only. `src/server/index.html` UI updated.
- **Behavior changes**: all writes go to one place; all reads come from one place; legacy streams stop receiving writes.
- **Tests**: read-model parity tests for known historical run shapes; assertion that no other writer exists.
- **Acceptance**: MC projects PR state correctly through merge; superseded observations no longer surface as live blockers.
- **Risks**: telemetry gaps during transition; mitigate by snapshotting one legacy stream.

### Phase 2 — Evidence gate becomes blocking (2 weeks)
**Goal**: stories prove themselves mechanically.
- **Files**: `src/installer/implement-evidence.ts`, `src/installer/implement-evidence-runner.ts`, `src/installer/implement-evidence-writer.ts`, `src/installer/runtime-driver.ts`, `src/installer/web-runtime-driver.ts`, `src/installer/runtime-ports.ts`, `src/installer/stack-evidence.ts`, `src/installer/smoke-gate.ts`. `scripts/smoke-test.mjs` becomes the assertion engine for the evidence contract.
- **Behavior changes**: `IMPLEMENT_EVIDENCE.json` is required for any story whose `evidence_contract.kind = runtime`. `SETFARM_IMPLEMENT_EVIDENCE_GATE=blocking` is the default. Visual evidence is advisory by default, can be promoted per story.
- **Tests**: deterministic flakiness tests on the runner; assertion language tests; port-allocation determinism; runner-driven story parity.
- **Acceptance**: a story that the agent claims is "done" but whose evidence fails does not advance; a story with passing evidence advances mechanically.
- **Risks**: flakiness if readiness probes are not deterministic; mitigate with explicit readiness markers.

### Phase 3 — Failure router (1 week)
**Goal**: replace implicit failure routing with an explicit, testable router.
- **Files**: new `src/installer/failure-router.ts`; `src/installer/step-ops.ts` callers route through it.
- **Behavior changes**: three outputs (`re_claim`, `link_story`, `platform_bug`). Bounded retries (3 per story, 20 per run). QA-FIX story creation is removed.
- **Tests**: exhaustive table of failure class → output; bounded retry enforcement; platform-bug detection.
- **Acceptance**: any failure during a run maps to exactly one of the three outputs; no new story is created by QA-FIX.

### Phase 4 — step-ops / spawner split (2–3 weeks)
**Goal**: make the god files refactorable.
- **Files**: new `src/installer/run-coordinator.ts` (target <600 lines), per-step `completion.ts` in each `src/installer/steps/NN-name/`, new `src/installer/pr-fsm.ts`, new `src/gateway-health.ts`. `src/installer/step-ops.ts` shrinks; eventually becomes a thin shim. `src/spawner.ts` keeps only process management.
- **Behavior changes**: steps own their completion; the coordinator owns lifecycle; PR FSM is explicit.
- **Tests**: per-step completion tests; coordinator lifecycle tests; PR FSM transition tests; spawner unit tests.
- **Acceptance**: `step-ops.ts` <2,000 lines; `spawner.ts` <1,500 lines; behavior preserved.

### Phase 5 — Supervisor split (1 week)
**Goal**: three narrow supervisor components, no fixer.
- **Files**: `src/installer/supervisor/checklist.ts` (deterministic, no LLM), `src/installer/supervisor/visual-qa.ts` (optional LLM critic), `src/installer/platform-self-heal/` (planner only). Delete `supervisor/fixer.ts`, `supervisor/intervention.ts` (or narrow it to "propose, do not execute").
- **Behavior changes**: supervisor reports; does not patch; does not open stories.
- **Tests**: deterministic checklist unit tests; visual critic disabled-by-default tests; self-heal planner never writes tests.
- **Acceptance**: no code path in supervisor can write to generated app code or Setfarm code.

### Phase 6 — Self-heal `plan_only` only (1 week)
**Goal**: safe, useful self-heal.
- **Files**: `src/installer/platform-self-heal/*` (already exists; tighten).
- **Behavior changes**: `plan_only` is the only enabled mode. `patch_only` and `patch_and_resume` are compile-time disabled. `write-interceptor.ts` enforces immutable test paths. `strictness-delta.ts` auto-rejects assertion removals. `patch-registry.ts` is visible in MC.
- **Tests**: write-interceptor tests; strictness-delta tests; rollback by file hash tests; full-suite-on-patch tests.
- **Acceptance**: self-heal produces plans; no file write path exists in the production build.

### Phase 7 — Stack packs (ongoing, parallel)
**Goal**: web, browser game, API, CLI as first-class stack packs; mobile follows.
- **Files**: `src/installer/stack-contract/*`, plus per-stack `RuntimeDriver` implementations.
- **Behavior changes**: each stack pack declares evidence capabilities and build steps; core Setfarm has no stack-specific code.
- **Tests**: per-stack driver tests; cross-stack contract parity tests.
- **Acceptance**: adding a new stack is "add a stack pack", not "edit core".

### Phase 8 — MC read models (2 weeks, can start after Phase 1)
**Goal**: MC derives from observations; stale blockers are gone.
- **Files**: `src/server/dashboard.ts` (read models), `src/server/index.html` (UI), `src/server/supervisor-summary.ts` (findings projection), `src/server/spawnerctl.ts` (control).
- **Behavior changes**: read models; SSE updates; superseded findings hidden from main view; project card shows deployability.
- **Tests**: read-model snapshot tests; SSE integration tests; superseded-finding tests.
- **Acceptance**: no stale blocker in MC; project card reflects final-test state, not story count.

### How to know the patch loop is solved
- Adding a new stack requires zero changes to `run-coordinator`, `failure-router`, `evidence-runner`, supervisor, or MC read models.
- Adding a new failure class is a row in a table, not editing a step.
- A run with a smoke failure routes through `failure-router` to one of three outputs; no human-written code is patched during the run.
- MC projects page is correct without explanation.
- A new generated project does not produce a new "we need a guard for that" decision.

---

## 15. Keep / Remove / Refactor Table

| Component | Current role | Keep / Remove / Refactor | Why | New owner / layer | Required tests |
|---|---|---|---|---|---|
| `step-ops.ts` | Lifecycle, PR, QA-FIX, verification, routing, side effects (8,627 lines) | **Refactor** | God file; the source of the patch loop | `run-coordinator.ts` (<600) + per-step `completion.ts` + `failure-router.ts` + `pr-fsm.ts` | Per-step completion; coordinator lifecycle; PR FSM; failure router table |
| `spawner.ts` | Process manager + runtime discipline + gateway health (4,687 lines) | **Refactor** | Half is correct, half is symptom of fuzzy LLM context | `spawner.ts` (process only) + `gateway-health.ts`; most discipline guards deleted | Spawner unit; gateway health state machine; claim context scoping |
| MC dashboard | API + activity rendering + filmstrip + project cards | **Refactor** | UI doing too much; reads from three streams | `dashboard.ts` (read models) + `index.html` (projection UI) | Read-model snapshots; SSE; superseded finding hiding |
| `run_observations` (`observations.ts`) | Append-only observation writer | **Keep + promote** | The right substrate; needs to be the only one | `observations.ts` becomes the single writer | Parity tests for all event shapes |
| Legacy events (`events.ts`, `operation-observability.ts`) | Two parallel observation/event writers | **Remove** | Triple truth; stale blockers | Deleted; merged into `observations.ts` | Assert no other writer exists |
| Supervisor checklist (`supervisor/checklist.ts`) | Deterministic rules | **Keep + isolate** | Correct; should not be an LLM | Standalone deterministic module | Rule unit tests; non-LLM dependency check |
| Visual QA (`supervisor/visual-qa.ts`) | LLM critic over evidence | **Keep + narrow** | Useful as critic, dangerous as fixer | Optional critic; never writes | Critic disabled-by-default; never-invokes-fixer test |
| QA-FIX story creation | QA opens new story on failure | **Remove** | The single largest patch-loop source | Replaced by `re_claim` / `link_story` / `platform_bug` | Failure router table tests; bounded retry tests |
| Implement evidence (`implement-evidence*`) | Runtime evidence artifact + runner + writer | **Keep + promote to blocking** | This is the escape from the patch loop | `evidence-runner` as a first-class Setfarm component | Determinism; flakiness; assertion language; port determinism |
| Smoke test (`scripts/smoke-test.mjs`) | Browser/app semantic checks | **Keep + integrate** | Currently a script; should be the assertion engine for evidence | Stack-pack-owned assertion engine | Per-stack smoke parity; integration with `evidence-runner` |
| `stitch-to-jsx.mjs` | Stitch HTML → React compile | **Keep + harden** | Correct deterministic compiler; only needs harder fail modes | Stack pack (design import gate) | Compile tests; unknown icon hard-fail; blanket CSS hard-fail |
| `generated-screen-validator.mjs` | SCREEN_MAP / UI_CONTRACT / DESIGN_DOM / file validation | **Refactor (fold in)** | Same logical check, different layer | Folded into design import gate at end of `05-setup-build` | Gate certificate tests |
| Platform self-heal (`platform-self-heal/*`) | Failure classifier + patch plan + rollback | **Keep in plan_only** | Correct in plan-only; dangerous in patch modes | Plan-only mode; `write-interceptor` at write time; `strictness-delta` auto-reject | Write interceptor; strictness delta; rollback by file hash; full-suite tests |
| Stack contracts (`stack-contract/*`) | Stack pack interfaces | **Keep + expand** | Right abstraction; needs to be the boundary for all stack-specific rules | Per-stack pack implementations | Per-stack driver tests; cross-stack parity |
| Workflow agents (`workflows/feature-dev/agents/*`) | planner/designer/developer/reviewer/QA/security/deployer/supervisor | **Refactor (authority, not count)** | Roles are roughly right; boundaries are wrong | LLM agents produce intent/code; Setfarm acts; deterministic tools enforce | Per-role output schema tests; no-write tests for non-writers |
| `supervisor/fixer.ts` | Supervisor as fixer | **Remove** | The single most dangerous file | Deleted; replaced by report-only supervisor | Assert not imported |
| `runtime-guard.ts` (in spawner) | Many agent-behavior guards | **Refactor (mostly remove)** | Symptom of wide claim context | Shrink claim context; delete guards | Claim context scope tests; assert no guard needed |
| `events.ts` / `operation-observability.ts` | Parallel event writers | **Remove** | Triple truth | Deleted | Assert no writer exists outside `observations.ts` |
| `failure-router.ts` (new) | — | **Add** | Replace implicit failure routing | `src/installer/failure-router.ts` | Exhaustive failure-class table tests |
| `run-coordinator.ts` (new) | — | **Add** | Thin lifecycle owner | `src/installer/run-coordinator.ts` (<600) | Lifecycle tests; no-step-knowledge tests |
| `pr-fsm.ts` (new) | — | **Add** | Explicit PR state machine | `src/installer/pr-fsm.ts` | FSM transition tests |
| `gateway-health.ts` (new) | — | **Add** | Owns gateway readiness | `src/gateway-health.ts` | State machine tests |

---

## 16. Final Verdict

**Partial architecture reset, with strict non-negotiables.**

The vision is correct. The implementation is too centralized and the contracts are in the wrong layer. A full reset would throw away good work (Product Contract, scope ownership, run_observations, stack contracts, evidence runner, the entire PR FSM concept). A "continue with targeted fixes" path will keep producing the same patch loop, because the targeted fixes are exactly what created it.

The reset is structural, not feature-additive. Concretely, in order of leverage:

1. **One observation stream.** Remove `events.ts` and `operation-observability.ts`. MC reads from `observations.ts` only.
2. **No QA-FIX stories.** Replace with `re_claim` / `link_story` / `platform_bug` via an explicit `failure-router.ts`.
3. **Evidence is blocking.** For any story whose contract is `runtime`, completion requires `IMPLEMENT_EVIDENCE.json` from a Setfarm-owned runner, not from the agent.
4. **Split the god files.** `run-coordinator.ts` (<600 lines) + per-step `completion.ts` + `failure-router.ts` + `pr-fsm.ts` + slim `spawner.ts` (<1,500 lines) + `gateway-health.ts`. Steps own their completion; the coordinator owns lifecycle; PR is an explicit FSM.
5. **Split the supervisor.** Deterministic checklist + optional visual critic + self-heal planner. Delete `fixer.ts`.
6. **Self-heal in `plan_only` only.** Compile-time disable `patch_only` and `patch_and_resume`. Write-interceptor at write time; strictness-delta auto-reject; rollback by file hash; full test suite on every patch; no same-run resume.
7. **MC as projection.** Read models from `observations`; SSE; superseded findings hidden; project card shows deployability (final-test + deploy), not story count.
8. **Stack packs as the boundary.** No stack-specific code in core. Add a new stack by adding a pack.

The patch loop is solved when:
- A new failure class is a row in a table, not a new guard.
- A new stack is a new pack, not a new branch in `step-ops.ts`.
- MC is correct without explanation.
- A run with a smoke failure does not produce a new story.

If you do only one thing this week, do **Phase 0 + Phase 1 + Phase 3** (stop the bleeding, one observation stream, explicit failure router). Those three changes alone will collapse the patch loop more than any other combination.

---

## Source files requested (none, for now)

This review was produced from the packet alone (`00`–`09`). I would not benefit from Priority 1 source files at this layer; the architecture map, file inventory, and rules inventory are sufficient. Going line-level on `step-ops.ts` and `spawner.ts` now would be premature — the right next step is the structural split, after which those files become readable. If a follow-up wants to design the `RuntimeDriver` interface with exact signatures, write the `failure-router.ts` table, or define the MC read-model schema, point at the target file and the work resumes from there.
