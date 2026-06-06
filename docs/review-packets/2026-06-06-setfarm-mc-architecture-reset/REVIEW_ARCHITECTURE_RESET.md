# Setfarm + Mission Control: Adversarial Architecture Review

**Date:** 2026-06-06
**Reviewer:** Senior Platform Architect (Adversarial Review)
**Scope:** Full architectural review of Setfarm + Mission Control based on attached review packet

---

# 1. Executive Diagnosis

**Verdict: You are building a reactive patch-loop machine that is metastasizing into an overcomplicated agent orchestration system. It is not a deterministic software factory. It needs a partial architecture reset, not reassurance.**

## Root Cause

The root cause is **authority inversion**: LLM agents are trusted to produce truth, and Setfarm is relegated to catching their mistakes after the fact. Every time an agent hallucinates a screen, misses a handler, or claims "build passes," you add another guard in Setfarm to catch it. But the agent's output was already accepted into the pipeline. The guard is downstream remediation, not upstream prevention.

This creates a **negative feedback loop that looks like quality control but is actually architectural debt accumulation**:

1. Agent produces output → Setfarm accepts it → downstream step discovers it's wrong → new guard added → agent prompt grows → agent behavior becomes more constrained and adversarial → agent finds new ways to be wrong → new guard added.

The second root cause is **dual-truth state**: `run_observations` and legacy events coexist. A story can be "verified" in observations but still show stale "OPEN PR" or "blocked" in MC activity. This means the system has no single source of truth for run state, which makes every guard, supervisor check, and QA-FIX decision operate on potentially stale data.

The third root cause is **supervisor role confusion**: the supervisor is simultaneously PM, static analyzer, visual QA, and fixer. When it finds a problem, it doesn't know if it's a product bug, a platform bug, or a pipeline bug. So it either blocks everything or patches everything.

The fourth root cause is **evidence without enforcement**: the implement evidence runner exists, but evidence is often advisory. An agent can pass without runtime proof. This means the factory produces claims, not proof.

**Bottom line**: You are not running a compiler. You are running a courtroom where agents testify and Setfarm cross-examines. Courtrooms are slow.

---

# 2. What The System Is Trying To Become

## Restated Vision

**Setfarm** should be a **compiler with LLM-powered passes**. Like a traditional compiler:
- Frontend pass: parse user intent into Product Contract AST (PLAN/DESIGN/STORIES)
- Middle-end pass: generate IR (repo scaffold, stack contracts, generated screens)
- Backend pass: emit code (story implementations)
- Verification pass: execute and prove correctness (build, test, smoke, runtime evidence)
- Optimization pass: supervisor checks for coherence, not correctness

**Mission Control** should be a **build farm dashboard**, not a company org chart. The "company" metaphor is useful for UX but dangerous for architecture. In a real company, people talk, negotiate, and override process. In Setfarm, there should be no negotiation. The pipeline is a DAG. MC should show the DAG executing, not a Slack channel.

## What Should Be Done by LLM Agents

- **Understand intent** and decompose into structured artifacts (PRD, stories, designs)
- **Generate code within bounded scope** (scoped files, no cross-story changes)
- **Propose verification requests** (what to test, what to screenshot)
- **Report anomalies** (not fix them)

## What Must Be Owned Mechanically by Setfarm

- **Scope enforcement** (what files an agent may touch)
- **Build/test execution** (agent claims nothing; Setfarm proves)
- **Runtime evidence capture** (screenshot, DOM, state, interaction trace)
- **PR lifecycle** (create, review comment routing, merge state)
- **Completion decision** (no agent self-certification)
- **Failure routing** (retry, abort, or platform bug — deterministic table)
- **Mission Control projection** (single source of truth: `run_observations`)

## Is the Vision Coherent?

**Yes, but reframed.** The "company" metaphor should be **presentation-layer only**. Architecturally, Setfarm is a compiler. MC is a build dashboard with company-themed skin. If you let the metaphor drive architecture, you get agents that "discuss" and "supervise" instead of deterministic passes that transform and verify.

---

# 3. Architecture Map Review

## Core Subsystems

| Subsystem | Assessment |
|-----------|------------|
| `src/cli/cli.ts` | Fine. Thin entrypoint. |
| `src/db-pg.ts` | Fine. Schema needs to drop legacy event tables eventually. |
| `src/installer/run.ts` | Fine. Run initialization. |
| `src/installer/workflow-spec.ts` | Fine. YAML parser. |
| `src/installer/step-ops.ts` | **Severely overloaded. This is your biggest problem.** |
| `src/spawner.ts` | Overloaded with runtime discipline guards. |
| `src/spawner-prompt.ts` | Fine. Context builder. |
| Step modules (`src/installer/steps/*`) | Good structural intent, but real logic leaks to `step-ops.ts`. |
| Evidence/runtime components | Good intent, fragmented enforcement. |
| Supervisor layer | Role-confused. Needs amputation. |
| Platform self-heal | Premature. Dangerous. |
| MC server | Dual-truth problem. Needs projection rewrite. |
| Script layer (`scripts/*`) | **This is the most correct layer.** Mechanical gates belong here. |

## Overloaded Files

### `step-ops.ts`
This file owns: claim, preclaim, completion, story loop, PR lifecycle, QA-FIX routing, verification, retry, side effects. It is the "god file" of the pipeline. Every new guard or routing rule lands here because there's nowhere else to put it.

**Recommendation**: Split into:
- `step-lifecycle.ts`: claim/preclaim/complete only
- `story-router.ts`: story state machine and failure routing table
- `pr-lifecycle.ts`: PR create/comment/merge state FSM
- `qa-fix-router.ts`: bounded QA-FIX creation and loop guard

### `spawner.ts`
Owns: process management, gateway health, runtime guards, claim recovery, watchdog, loop detection, context sprawl detection, git discipline detection. This is a process manager that became a behavior policeman.

**Recommendation**: Split into:
- `spawner.ts`: process lifecycle only
- `agent-guard.ts`: runtime discipline rules (separate file, testable in isolation)
- `claim-recovery.ts`: orphaned/stuck claim cleanup

### `src/server/index.html`
Single-file UI doing: projects list, run detail, activity feed, evidence filmstrip, PR status, supervisor summary. This is unmaintainable.

**Recommendation**: Split into component-based UI or at least separate JS modules:
- `mc-projects.js`: projects grid with stale/cancelled handling
- `mc-run-detail.js`: run state, story list, agent roles
- `mc-evidence.js`: filmstrip, screenshots, DOM
- `mc-pr.js`: PR comments, merge state
- `mc-activity.js`: projection-based activity (not raw events)

## Duplicated Responsibilities

- **Design validation**: `scripts/generated-screen-validator.mjs`, `src/installer/design-contract.ts`, `src/installer/steps/05-setup-build/guards.ts`, and supervisor scanner all check screen consistency. Pick one owner: the script layer.
- **Build gating**: `npm run build` is called in setup-build, implement, verify, and final-test. The gate logic is duplicated. Centralize in `build-gate.ts`.
- **Smoke/QA**: `scripts/smoke-test.mjs`, `src/installer/smoke-gate.ts`, QA-TEST step, and FINAL-TEST step all do runtime checking. Unify into evidence runner with per-step contract.

## Unclear Authority Boundaries

- **Supervisor vs. QA-TEST**: Both find problems. Who decides if it's a product bug or pipeline bug?
- **Agent vs. Setfarm**: Agent can claim "done." Setfarm decides completion. But agent can also write `IMPLEMENT_VERIFICATION_REQUEST.json`. Who owns verification?
- **Self-heal vs. Supervisor**: Both inspect and potentially fix. Self-heal targets Setfarm code; supervisor targets product code. But supervisor has a `fixer.ts`.

## Correctly Separated

- **Stack contracts** (`src/installer/stack-contract/*`): Good abstraction. Keep.
- **Runtime driver interface** (`runtime-driver.ts`): Good stack-agnostic intent. Keep.
- **Observations** (`run_observations`): Good append-only design. Need to finish migrating to it.
- **Script layer**: Correctly mechanical. Expand, don't shrink.

## Recommendations

1. **Kill the god file**: `step-ops.ts` must be split within 2 weeks.
2. **Make step modules real**: Each step module should export a `StepEngine` that handles its own preclaim, context, guards, and completion. `step-ops.ts` should only orchestrate handoff.
3. **Centralize build gate**: One function, one test file, called from multiple steps.
4. **Unify evidence**: One evidence runner, multiple evidence contracts per step.

---

# 4. Guard / Rule / Contract Review

## Essential Platform Invariants (Keep, Harden)

| Guard | Why Essential | Layer |
|-------|---------------|-------|
| Scope enforcement (`.story-scope-files`) | Prevents cross-story corruption | Setfarm mechanical |
| Build pass gate | Code must compile | Script/Setfarm |
| Generated screen file existence | Design contract must be satisfied | Script (`generated-screen-validator`) |
| SCREEN_MAP/UI_CONTRACT/DESIGN_DOM consistency | Design integrity | Script |
| PR merged before verified | Lifecycle integrity | Setfarm PR FSM |
| Runtime evidence artifact exists | Proof over claims | Setfarm evidence runner |
| Agent cannot self-certify | Authority inversion prevention | Setfarm completion decision |

## Symptoms of Bad Abstraction (Remove or Refactor)

| Guard | Why It's a Symptom | What To Do |
|-------|-------------------|------------|
| Unknown Material Symbols fallback | Should be caught by `stitch-to-jsx` hard fail, not runtime guard | Move to setup-build script, make hard fail |
| `transition: all` CSS sanitize | Agent shouldn't write CSS directly; design tokens should prevent this | Move to design contract, reject at design step |
| Generated screen shared read detection | Agent shouldn't need to read generated screen source; UI_CONTRACT should suffice | Improve context, remove guard |
| Raw Stitch context read detection | Same as above | Improve context, remove guard |
| Pre-delta context sprawl detection | Agent is reading too much because context is poor | Fix context builder, don't guard against reading |
| Repeated tool/self-loop detection | Agent is stuck because task is unclear or too large | Fix task decomposition, not loop detection |
| Runtime guard repeat limit | Agent is fighting guards instead of doing work | Reduce guards, improve contracts |

## Guards That Should Move Earlier

- **Screen coverage mismatch**: Currently caught in supervisor/QA. Should be caught in `setup-build` by `generated-screen-validator`.
- **Missing action handler**: Currently caught in smoke/QA. Should be caught in `stories` step by verifying action IDs have handler assignments.
- **Icon/font CSS leakage**: Currently caught in smoke. Should be caught in `stitch-to-jsx` compile.
- **Design/code mismatch**: Currently caught in visual QA. Should be caught by deterministic design contract comparison at setup-build.

## Guards That Should Be Deleted or Merged

- **Spawner runtime discipline guards** (15+ rules): Merge into 3 categories: resource limits, process health, and behavior bans. Most behavior bans are symptoms of bad context.
- **Supervisor deterministic checklist**: Merge with script-layer validators. Supervisor should not duplicate static analysis.
- **QA-FIX loop guard**: Replace with bounded retry counter in story router.

## Guards That Should Become Stack-Pack Responsibilities

- **Browser game static issues**: Stack pack evidence contract
- **Route/screen coverage**: Stack pack smoke contract
- **Weak interaction detection**: Stack pack interaction contract
- **Mobile-specific checks**: Future mobile stack pack

## Guards That Should Become Evidence Requirements

- **Runtime state reflected in UI**: Not a guard, an evidence contract
- **Button clickability**: Not a guard, screenshot + DOM evidence
- **Form submission**: Not a guard, interaction trace evidence

## Are There Too Many Contracts?

**Yes and no.** The contracts are mostly correct in intent, but they are in the wrong layer and the wrong form.

- **Wrong layer**: Design contracts enforced in QA instead of setup-build.
- **Wrong form**: Hardcoded guards instead of evidence artifacts.

**The fix is not fewer contracts. It is:**
1. **Earlier enforcement** (fail fast at the step that produces the artifact)
2. **Mechanical validation** (scripts, not agents)
3. **Evidence artifacts** (proof files, not runtime checks)

---

# 5. Pipeline Step Review

## 01 PLAN

| Question | Answer |
|----------|--------|
| Should own | Product Contract PRD, platform decision, testability contract, ACT_* actions |
| Should never own | Repo path, branch, package name, physical screen list, runtime identity |
| Required output | `PRODUCT_CONTRACT.json` with schema validation |
| Failures that stop here | Unparseable PRD, missing platform, no testability contract |
| Failures that route backward | None (first step) |
| Failures that become platform issues | Schema validation bug, prompt template error |
| Current behavior wrong | Too much prose, too little structured output. Agent can hallucinate screens. |

**Fix**: PLAN output must be JSON with schema. No markdown PRD as primary artifact. Markdown is human-readable derivative.

## 02 DESIGN

| Question | Answer |
|----------|--------|
| Should own | Stitch project ensure, screen generation, DESIGN_SYSTEM, SCREEN_MAP |
| Should never own | Story scope, file paths, implementation details |
| Required output | `SCREEN_MAP.json`, `DESIGN_SYSTEM.json`, generated screen files, setup certificate |
| Failures that stop here | Unknown icons, missing screens, design/repo mismatch |
| Failures that route backward | Out-of-scope screen (back to PLAN to shrink scope) |
| Failures that become platform issues | Stitch API failure, `stitch-to-jsx` bug |
| Current behavior wrong | Design import failures downstream. Setup-build certificate not hard gate. |

**Fix**: `stitch-to-jsx` and `generated-screen-validator` are hard gates here. No pass-through with warnings.

## 03 STORIES

| Question | Answer |
|----------|--------|
| Should own | Story decomposition, scope files, acceptance criteria, action mapping |
| Should never own | Implementation, design changes, repo setup |
| Required output | `STORIES.json` with scope files, action ID mapping, generated screen ownership |
| Failures that stop here | Hallucinated file path, missing scope, action without handler target |
| Failures that route backward | Too many stories (back to PLAN to simplify), design mismatch (back to DESIGN) |
| Failures that become platform issues | Scope file generation bug, action registry error |
| Current behavior wrong | Scope too narrow or too wide. Action mapping not validated. |

**Fix**: Action IDs from PLAN must map to handler targets in STORIES. Unmapped actions = hard fail.

## 04 SETUP-REPO

| Question | Answer |
|----------|--------|
| Should own | Repo scaffold, git init, branch, DB provisioning, contract files |
| Should never own | Design generation, story changes, build optimization |
| Required output | Clean repo, initialized git, branch, contract files committed |
| Failures that stop here | Scaffold failure, git error, contract file missing |
| Failures that route backward | None |
| Failures that become platform issues | Scaffold script bug, setup-repo template error |
| Current behavior wrong | Setup artifacts missing, agent guesses context. |

**Fix**: Setup must produce a `SETUP_CERTIFICATE.json` listing all created files. Agent cannot proceed without it.

## 05 SETUP-BUILD

| Question | Answer |
|----------|--------|
| Should own | Dependency install, baseline build, design import, generated screen compile, setup certificate |
| Should never own | Story implementation, runtime testing |
| Required output | `SETUP_BUILD_CERTIFICATE.json`: build pass, screen files exist, icon check, token check, no unknown CSS |
| Failures that stop here | Build failure, missing screen, unknown icon, token missing, CSS leakage |
| Failures that route backward | Design mismatch (back to DESIGN), too many screens (back to PLAN) |
| Failures that become platform issues | `stitch-to-jsx` bug, validator bug, dependency resolution bug |
| Current behavior wrong | "Build passed" overrides design import failure. Certificate not enforced. |

**Fix**: This is the most important hard gate in the pipeline. It must have a deterministic checklist that is 100% mechanical. No agent involvement in pass/fail.

## 06 IMPLEMENT

| Question | Answer |
|----------|--------|
| Should own | Scoped code changes within story scope, build/test pass, evidence request |
| Should never own | PR creation, merge, cross-story changes, self-certification |
| Required output | Code diff, build pass, test pass, `IMPLEMENT_EVIDENCE.json` or `IMPLEMENT_VERIFICATION_REQUEST.json` |
| Failures that stop here | Scope violation, build failure, test failure, missing evidence request |
| Failures that route backward | Design mismatch found during implement (back to DESIGN) |
| Failures that become platform issues | Evidence runner bug, scope enforcement bug |
| Current behavior wrong | Agent can claim done without evidence. QA-FIX can regress verified screens. |

**Fix**:
- Evidence is mandatory before completion. Advisory mode dies.
- If evidence runner cannot run (e.g., no request artifact), story cannot complete.
- QA-FIX story must inherit scope of original + regression test for previously verified screens.

## 07 VERIFY

| Question | Answer |
|----------|--------|
| Should own | PR review comment reading, merge state verification, comment-to-implement routing |
| Should never own | Code changes, test execution, design decisions |
| Required output | PR state (OPEN, MERGED), comment list, actionability classification |
| Failures that stop here | PR not merged, unactionable comments blocking |
| Failures that route backward | Actionable comments → IMPLEMENT retry |
| Failures that become platform issues | GitHub API bug, PR state parsing bug |
| Current behavior wrong | PR state OPEN observation stale after merge. Reviewer agent "done" vs GitHub state mismatch. |

**Fix**: PR state must be FSM with explicit transitions. MC must show current state, not historical observations.

## 08 SECURITY-GATE

| Question | Answer |
|----------|--------|
| Should own | Secret scan, unsafe sink detection, dangerous eval detection |
| Should never own | App semantics, feature correctness |
| Required output | `SECURITY_REPORT.json`: pass/fail, findings list, severity |
| Failures that stop here | Critical security finding |
| Failures that route backward | None (security findings are final) |
| Failures that become platform issue | False positive in security scanner |
| Current behavior wrong | None major. |

**Fix**: Keep lightweight. Don't let it grow into general QA.

## 09 QA-TEST

| Question | Answer |
|----------|--------|
| Should own | Structured QA report, smoke test execution, browser semantic checks |
| Should never own | Arbitrary test writing, design changes, code fixes |
| Required output | `QA_REPORT.json`: coverage, findings, pass/fail, evidence artifacts |
| Failures that stop here | Smoke failure, critical regression |
| Failures that route backward | Bounded: specific finding → original story retry or bounded QA-FIX |
| Failures that become platform issue | Smoke test bug, evidence runner bug |
| Current behavior wrong | QA agent can write arbitrary tests. QA-FIX unbounded. Smoke catches design import gap too late. |

**Fix**:
- QA does not write tests. QA executes predefined evidence contracts from stories.
- QA-FIX is capped at 1 per finding. If fix fails, route to platform issue.
- Smoke should be minimal; most runtime checking should happen at IMPLEMENT evidence.

## 10 FINAL-TEST

| Question | Answer |
|----------|--------|
| Should own | Deploy-preceding runtime parity check, final evidence capture |
| Should never own | New test creation, code changes |
| Required output | `FINAL_TEST.json`: evidence summary, parity check, deploy readiness |
| Failures that stop here | Runtime parity failure, missing evidence |
| Failures that route backward | None (if QA-TEST was correct, this should rarely fail) |
| Failures that become platform issue | Evidence runner inconsistency |
| Current behavior wrong | Prose-based pass possible. |

**Fix**: Must be 100% evidence-based. No prose. If evidence missing, fail.

## 11 DEPLOY

| Question | Answer |
|----------|--------|
| Should own | Service registration, runtime port assignment, project visibility |
| Should never own | Code changes, testing |
| Required output | `DEPLOY.json`: URL, port, status |
| Failures that stop here | Registration failure |
| Failures that route backward | None |
| Failures that become platform issue | Port allocation bug, service registry bug |
| Current behavior wrong | Stale project cards, cancelled projects still visible. |

**Fix**: Projects page must derive from current run state, not historical deploy records.

## 12 SUPERVISE

| Question | Answer |
|----------|--------|
| Should own | Product coherence check, policy enforcement, final approval |
| Should never own | Code changes, test execution, platform patches |
| Required output | `SUPERVISOR_REPORT.json`: checklist result, warnings, block/approve |
| Failures that stop here | Policy violation, coherence failure |
| Failures that route backward | None (supervisor is final gate) |
| Failures that become platform issue | Supervisor checklist bug |
| Current behavior wrong | Supervisor also acts as fixer, QA, and static analyzer. |

**Fix**: Supervisor is a read-only final gate. It reports. It does not fix. It does not patch.

---

# 6. Runtime Evidence / Inner Dev Loop Review

## Is the Universal Inner Dev Loop the Right Escape?

**Yes, but with strict boundaries.** The only way to avoid project-specific rules is to make the agent prove its work through runtime execution, not prose. However, the evidence loop must be a **contract**, not an open-ended test suite.

## Should Every Story Require Runtime Evidence?

**No.** Evidence should be required based on story type:

| Story Type | Evidence Required |
|------------|-------------------|
| UI component / screen | Screenshot + DOM + interaction trace |
| Game logic / state | State snapshot + interaction sequence + screenshot |
| API endpoint | HTTP request/response + schema validation |
| CLI command | Command execution + stdout/stderr + exit code |
| Config / infrastructure | Plan/diff validation (no runtime) |
| Pure function / utility | Unit test execution (no browser) |

## How Should It Work for Web Apps?

1. Agent implements story
2. Setfarm builds project
3. Setfarm starts temporary preview server (deterministic port)
4. Setfarm executes interaction script from `IMPLEMENT_VERIFICATION_REQUEST.json`
5. Setfarm captures: screenshot, DOM, console logs, network logs, state
6. Setfarm writes `IMPLEMENT_EVIDENCE.json`
7. Evidence gate compares actual vs. expected

**Key**: The interaction script is written by the agent as a **request**, but executed by Setfarm. The agent cannot fake execution.

## How Should It Generalize to Browser Games?

Same as web apps, but:
- Interaction script includes key presses, timing, canvas capture
- State capture includes game state JSON, not just DOM
- Evidence includes frame sequence (filmstrip)

## How Should It Generalize to Android/iOS/API/CLI?

| Stack | Runtime | Evidence |
|-------|---------|----------|
| Android | Emulator (Android Studio) | Screenshot + ADB logcat + UI hierarchy |
| iOS | Simulator | Screenshot + syslog + accessibility tree |
| API | Temporary server + HTTP client | Response JSON + schema + latency |
| CLI | Subprocess execution | stdout/stderr/exit code + file changes |

## Should Evidence Be Advisory or Blocking?

**Blocking for UI/game stories. Advisory for infrastructure stories. No "off" mode.**

The current 3-state gate (`off|advisory|blocking`) is a trap. "Off" means the factory produces unverified claims. "Advisory" means humans must check. The factory should not have an "unverified" mode for code that runs.

## Should VLM/Vision Be Required?

**Optional but recommended for visual stories. Avoid for non-visual stories.**

VLM should not be required for the pipeline to function. The primary evidence is deterministic: DOM structure, state JSON, interaction trace. VLM is a secondary check for visual coherence. Use it as:
- `advisory` visual gate (doesn't block pipeline)
- `blocking` only after VLM accuracy is proven on 50+ runs

## How to Avoid Shallow Screenshots?

Require **3 evidence types minimum** for visual stories:
1. **Screenshot** (what does it look like?)
2. **DOM/Accessibility tree** (what is the structure?)
3. **Interaction trace** (what was done to get there?)

A screenshot of a blank page is caught by DOM. A DOM with no buttons is caught by interaction trace failure.

## How to Avoid Too Much Runtime Overhead?

- **Parallel evidence**: Run screenshots + DOM + state in one browser session
- **Cached builds**: Don't rebuild for evidence if build already passed
- **Selective evidence**: Only stories with UI changes need browser evidence
- **Timeout caps**: 30s per evidence capture max

## Target Evidence Architecture

```
┌─────────────────────────────────────┐
│  Story Implementation Complete      │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Build Gate (mechanical)            │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Evidence Request Parser            │
│  (reads IMPLEMENT_VERIFICATION_     │
│   REQUEST.json)                     │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Stack Evidence Contract            │
│  (what evidence types required?)    │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Runtime Driver (stack-specific)    │
│  - start temporary runtime          │
│  - execute interaction              │
│  - capture evidence                 │
│  - stop runtime                     │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Evidence Artifact Writer           │
│  (IMPLEMENT_EVIDENCE.json)          │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Evidence Gate (mechanical)         │
│  - required artifacts present?      │
│  - DOM/state matches expectations?  │
│  - screenshot not blank?            │
└─────────────┬───────────────────────┘
              ▼
┌─────────────────────────────────────┐
│  Completion Decision (Setfarm)      │
└─────────────────────────────────────┘
```

---

# 7. QA-FIX Loop And Patch Loop Analysis

## Is QA-FIX a Valid Architecture?

**Only as a bounded, last-resort mechanism. Currently it is unbounded and misused.**

QA-FIX exists because failures are caught too late (in QA instead of IMPLEMENT). If design import gaps were caught in setup-build, and runtime state issues were caught in implement evidence, most QA-FIX stories would not exist.

## When Should QA-FIX Exist?

QA-FIX should only be created when:
1. A story was previously verified with evidence
2. A later story caused a regression in the previously verified story
3. The regression is caught by final-test or QA-test
4. The original story's scope files are unchanged (regression is in shared files)

In this case, QA-FIX is a **regression repair story** with:
- Scope = original story scope + shared files that caused regression
- Evidence requirement = original evidence + regression test
- Retry cap = 1

## When Should Failure Go Back to Original Story?

When:
- The failure is in the original story's scope files
- The failure was not caught because evidence was missing or advisory
- The story was "verified" prematurely

**This is the most common case today.** Most QA-FIX stories should instead be: **reopen original story, require evidence, retry.**

## When Should Failure Become a Platform Bug?

When:
- The failure is in Setfarm code (evidence runner, build gate, scope enforcement)
- The failure is a deterministic guard that is wrong
- The failure repeats across multiple projects with same signature

## How to Prevent Infinite Repair Loops?

1. **Retry cap per story**: Max 2 implement attempts per story. After that, platform issue.
2. **QA-FIX cap per run**: Max 2 QA-FIX stories per run. After that, abort.
3. **No QA-FIX of QA-FIX**: QA-FIX stories cannot spawn further QA-FIX stories.
4. **Evidence required before verified**: A story without evidence can never be verified. Therefore, it can never spawn QA-FIX.

## How to Prevent "Story Verified But Product Still Broken"?

1. **Evidence is mandatory before verify**
2. **Regression test on shared files**: When a story touches shared files (App.tsx, router, etc.), evidence must include all previously verified screens
3. **Final-test is cumulative**: Final-test runs full app evidence, not just latest story

## Should QA Happen Earlier, Later, or Continuously?

**Continuously at IMPLEMENT, final gate at FINAL-TEST.**

- IMPLEMENT: per-story evidence (continuous)
- VERIFY: PR/merge gate (mechanical)
- QA-TEST: minimal, predefined contracts
- FINAL-TEST: cumulative runtime parity

## Precise Failure-Routing Model

```
┌─────────────────────────────────────────────┐
│  Failure Detected                             │
└─────────────┬───────────────────────────────┘
              ▼
┌─────────────────────────────────────────────┐
│  Is failure in Setfarm/orchestrator code?   │
│  (evidence runner, build gate, scope bug)   │
└─────────────┬───────────────────────────────┘
         Yes /      \ No
            ▼        ▼
    ┌──────────┐  ┌──────────────────────────┐
    │ Platform │  │ Is failure in previously │
    │ Issue    │  │ verified story's scope?  │
    └──────────┘  └──────┬───────────────────┘
                    Yes /      \ No
                       ▼        ▼
              ┌──────────┐  ┌──────────────────┐
              │ Reopen   │  │ Is failure in    │
              │ original │  │ shared files     │
              │ story    │  │ affecting prior  │
              │ + retry  │  │ verified story?  │
              └──────────┘  └────┬─────────────┘
                              Yes /      \ No
                                 ▼        ▼
                          ┌──────────┐  ┌──────────┐
                          │ QA-FIX   │  │ Current  │
                          │ bounded  │  │ story    │
                          │ (cap=1)  │  │ retry    │
                          └──────────┘  └──────────┘
```

---

# 8. Supervisor Review

## What Should Supervisor Actually Be?

**A read-only product policy gate. Nothing more.**

The supervisor is the final human-like check, but it must not have write access. Its job is to answer: "Does this product match the original intent?" Not "Is the code correct?" (that's build/test/evidence). Not "Are there bugs?" (that's QA).

## Should Supervisor Inspect Generated App Code?

**No.** Code correctness is mechanical (build, test, evidence). Supervisor inspects product coherence:
- Are all ACT_* actions from PLAN implemented?
- Are all screens from DESIGN present?
- Does the product match the PRD description?
- Are there obvious user-facing gaps?

## Should Supervisor Inspect Setfarm/MC Code?

**No.** That is platform self-heal territory, and even that should be plan-only.

## Should Supervisor Be Allowed to Patch?

**Absolutely not.** Supervisor reports. Setfarm or human decides action.

## Should Supervisor Only Report?

**Yes.** Output: `SUPERVISOR_REPORT.json` with:
- `status`: `APPROVE`, `WARN`, `BLOCK`
- `findings`: list of issues
- `severity`: `CRITICAL`, `WARNING`, `INFO`
- `recommended_action`: `NONE`, `RETRY_STORY`, `PLATFORM_ISSUE`, `HUMAN_REVIEW`

## Should Supervisor Be Separated Into Multiple Roles?

**Yes. Split into:**

| Role | Responsibility | Implementation |
|------|---------------|----------------|
| Product Policy Checker | PRD/action/screen coherence | Deterministic script |
| Visual Coherence Checker | Design/code visual match | VLM or deterministic DOM comparison |
| Failure Pattern Classifier | Repeated failure taxonomy | Deterministic classifier |

**None of these roles patch. All report.**

## Clean Supervisor Authority Model

```
┌─────────────────────────────────────────┐
│  Supervisor (read-only)                 │
│  - Product policy checker (script)      │
│  - Visual coherence checker (VLM/DOM)   │
│  - Failure pattern classifier (script)  │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│  Supervisor Report                      │
│  (SUPERVISOR_REPORT.json)               │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│  Setfarm Decision Engine                │
│  - If BLOCK → stop run, human review    │
│  - If WARN → continue, log warning      │
│  - If APPROVE → proceed to deploy       │
└─────────────────────────────────────────┘
```

---

# 9. Platform Self-Healing Review

## Is Self-Healing Setfarm a Good Idea?

**Not yet. Maybe never autonomously.**

The attractiveness is real: fix the platform once, benefit forever. The danger is catastrophic: a bad patch breaks the factory, and now you can't trust any output.

## Catastrophic Failure Modes

1. **Smoke test relaxation**: Self-heal "fixes" a failure by making the smoke test pass everything
2. **Guard removal**: Self-heal removes a spawner guard that was catching real problems
3. **Failure classifier corruption**: Self-heal misclassifies product bugs as platform bugs and patches Setfarm to ignore them
4. **MC visibility hack**: Self-heal "fixes" MC by hiding blockers instead of fixing them
5. **Same-run resume corruption**: Module cache, state, or loaded code is inconsistent after hot patch

## Can It Safely Run in `plan_only`?

**Yes.** `plan_only` is safe because:
- No file writes
- Classification and patch plan are visible
- Human reviews before application
- MC shows plan as "proposed fix"

## Can It Safely Run in `patch_only`?

**Only with extreme restrictions:**
- Patch target in ownership map only
- Immutable tests cannot be modified
- Write interceptor at filesystem level
- Mandatory full test suite after patch
- Rollback within 60 seconds if tests fail
- Patch registry with lineage
- No same-run resume (patch applies to next run)

## Should `patch_and_resume` Ever Exist?

**No.** Same-run resume after platform patch is fundamentally unsafe:
- Module cache may have old code
- In-memory state may be inconsistent
- Agent process may have loaded old contracts
- Evidence from patched run is untrustworthy

If a platform patch is applied, the current run must abort. Next run uses patched code.

## What Immutable Tests Are Required?

Every file in `tests/platform-invariants/*` must be immutable. Self-heal cannot touch:
- Scope enforcement tests
- Build gate tests
- Evidence runner tests
- PR lifecycle tests
- Any test that tests Setfarm's core decision logic

## What Write Restrictions Are Required?

1. **Ownership map**: Only files mapped to a failure class can be patched
2. **No test modification**: `tests/` directory is read-only to self-heal
3. **No guard deletion**: Cannot remove or relax any existing guard
4. **No config modification**: Cannot change `.env`, `config.ts`, or environment
5. **Append-only logging**: Self-heal actions are logged, never deleted

## What Rollback Model Is Required?

1. Pre-patch file hash snapshot
2. Post-patch mandatory test run
3. If any test fails, auto-rollback within 60 seconds
4. Rollback restores exact pre-patch state, not git HEAD
5. MC shows patch attempt, test result, rollback action

## Should Current Run Resume After Platform Patching?

**No.** Abort current run. Patch is for next run.

## How Should Mission Control Show the Patch?

- Classification evidence (why was this classified as platform bug?)
- Patch plan (what will be changed?)
- Diff (exact changes)
- Test results (pass/fail)
- Rollback status (applied or reverted)
- Human approval status (for plan_only)

## Safe Rollout Plan

| Phase | Mode | Duration | Criteria to Advance |
|-------|------|----------|---------------------|
| 1 | `off` | Now | Baseline stability |
| 2 | `plan_only` | 50+ runs | Classification accuracy >90% |
| 3 | `patch_only` + human approval | 50+ runs | Zero rollbacks, all tests pass |
| 4 | `patch_only` auto | Never | Not recommended |
| 5 | `patch_and_resume` | Never | Rejected |

**Verdict**: Keep self-heal as `plan_only` diagnostician indefinitely. Do not enable autonomous patching.

---

# 10. Mission Control Review

## Should MC Derive Everything from `run_observations`?

**Yes.** Legacy events must be removed or migrated. Dual-truth is the source of stale blockers.

## Should Legacy Events Be Removed?

**Yes, after migration.** Steps:
1. Freeze legacy event writes
2. Migrate historical data to observations format
3. Update MC to read only observations
4. Drop legacy event tables

## What Read Models/Projections Are Needed?

| Projection | Source | Refresh |
|------------|--------|---------|
| Projects list | `runs` table + latest observation | On run state change |
| Run detail | `run_observations` for run_id | Real-time websocket |
| Story state | `run_observations` story events | Real-time |
| Agent roles | `run_observations` claim events | Real-time |
| PR state | `run_observations` PR events + GitHub poll | Every 30s |
| Runtime URL | `run_observations` deploy events | On deploy |
| Evidence filmstrip | `run_observations` evidence events | On evidence write |
| Supervisor findings | `run_observations` supervisor events | On supervisor complete |
| QA findings | `run_observations` QA events | On QA complete |
| Platform patches | `run_observations` self-heal events | On patch |

## What Should Be in Main View vs Detail Drawer?

**Main view (projects page)**:
- Project card: name, status, last run state, runtime URL (if running)
- Stale/failed projects: collapsed or marked "superseded"
- No fake "done" — show actual latest run state

**Run detail (drawer or page)**:
- Pipeline DAG visualization (steps as nodes, state as color)
- Story list with state, agent, evidence thumbnail
- PR timeline (open → comments → merged)
- Evidence filmstrip (screenshots in sequence)
- Supervisor report
- QA findings (if any)
- Self-heal patch plans (if any)

## How Should Live Progress Work?

1. **WebSocket from daemon**: Observations stream to MC in real-time
2. **Optimistic UI**: Show agent "working" when claim is active
3. **Evidence preview**: Show screenshot thumbnail as soon as evidence is written
4. **Stale detection**: If no observation for 5 minutes, mark agent as "stalled"
5. **No fake states**: Never show "done" until completion observation arrives

## Concrete MC Information Architecture

```
MC Information Model (single source: run_observations)

Project
├── id, name, slug, created_at
└── runs[] (ordered by created_at desc)
    ├── Run
    │   ├── id, status, started_at, completed_at
    │   ├── steps[] (from workflow spec + observations)
    │   │   ├── Step
    │   │   │   ├── name, status, started_at, completed_at
    │   │   │   ├── agent_role, claim_id
    │   │   │   └── observations[] (chronological)
    │   ├── stories[] (from story observations)
    │   │   ├── Story
    │   │   │   ├── id, title, scope, status
    │   │   │   ├── evidence[] (screenshot, DOM, state)
    │   │   │   └── pr_state (OPEN, MERGED, etc.)
    │   ├── pr_timeline[] (from PR observations)
    │   ├── supervisor_report (from supervisor observations)
    │   ├── qa_report (from QA observations)
    │   └── self_heal_plans[] (from self-heal observations)
    └── latest_run (pointer)
```

---

# 11. Agent Role / Company Design

## Is This Enough Roles?

**Too many LLM agents. Not enough deterministic tools.**

Current roles: planner, designer, setup-repo, setup-build, developer, reviewer, supervisor, security-gate, qa-tester, tester, deployer (11 agents).

## Are There Too Many Roles?

**Yes.** Setup-repo and setup-build should be deterministic scripts, not agents. Reviewer should be a mechanical PR comment reader + optional LLM summary. Security-gate should be a scanner tool.

## Should Some Roles Be Deterministic Tools?

**Yes:**

| Current Agent | Should Be | Why |
|---------------|-----------|-----|
| setup-repo | Script | Scaffold is template + file copy |
| setup-build | Script + build gate | npm install + build is mechanical |
| reviewer | Script + optional LLM | PR state is API call; comments are structured |
| security-gate | Security scanner | Semgrep, truffleHog, etc. |
| tester/final-test | Evidence runner | Mechanical execution |
| deployer | Script | Service registration is API call |

## Should Developer Agents Be Narrower?

**Yes.** One developer agent per story is correct. But developer agent should not:
- Create PRs (Setfarm does)
- Run tests (Setfarm does)
- Self-certify (Setfarm decides)
- Touch shared files without grant

## Should Reviewer Merge PRs?

**No.** Setfarm merges PRs when review is complete and build passes. Reviewer (LLM or human) comments. Setfarm acts.

## Should QA Write Tests?

**No.** QA executes predefined evidence contracts. Tests/evidence requests come from story acceptance criteria.

## Should There Be a Platform Architect Agent?

**No.** Platform architecture is human responsibility. Self-heal plan-only produces suggestions. Human decides.

## Should Codex Act as Supervisor Over Setfarm?

**No.** This is the most dangerous idea. Codex inspecting and potentially modifying its own orchestrator creates recursive instability.

## Clean Role Model

| Role | Type | Authority |
|------|------|-----------|
| Planner | LLM Agent | Writes PRD, stories, design brief |
| Designer | LLM Agent | Produces design artifacts, Stitch brief |
| Developer | LLM Agent (per story) | Writes scoped code, proposes verification |
| Evidence Runner | Setfarm Tool | Executes runtime, captures proof |
| Build Gate | Setfarm Tool | Compiles, runs tests |
| PR Lifecycle | Setfarm Tool | Creates PR, reads comments, merges |
| Security Scanner | Setfarm Tool | Scans for secrets, unsafe code |
| QA Executor | Setfarm Tool | Runs smoke, predefined checks |
| Supervisor | LLM Agent (read-only) | Product coherence report |
| Deployer | Setfarm Tool | Registers service, assigns port |
| MC Projection | Setfarm Tool | Derives UI from observations |

**Result: 3 LLM agents (planner, designer, developer), 7 deterministic tools, 1 read-only supervisor.**

---

# 12. Multi-Stack Future

## What Must Be Stack-Agnostic?

| Component | Stack-Agnostic? |
|-----------|-----------------|
| Pipeline DAG | Yes |
| Story scope model | Yes |
| PR lifecycle | Yes |
| Evidence runner framework | Yes |
| Build gate interface | Yes |
| Observation model | Yes |
| MC projection | Yes |
| Supervisor policy checker | Yes |

## What Belongs in Stack Packs?

| Component | Stack Pack |
|-----------|------------|
| Scaffold template | `web-vite`, `nextjs`, `api-node`, `cli-node`, `android`, `ios` |
| Build command | Stack pack |
| Runtime driver | Stack pack |
| Evidence contract | Stack pack |
| Smoke test contract | Stack pack |
| Design import | Stack pack (Stitch for web, Figma for mobile, etc.) |
| Interaction script format | Stack pack |

## What Should the Universal Interface Be?

```typescript
// StackPack interface
interface StackPack {
  name: string;
  detect(projectRoot: string): boolean;
  
  // Scaffold
  scaffold(contract: ProductContract): Promise<void>;
  
  // Build
  build(projectRoot: string): Promise<BuildResult>;
  
  // Runtime
  startRuntime(projectRoot: string, port: number): Promise<RuntimeHandle>;
  stopRuntime(handle: RuntimeHandle): Promise<void>;
  
  // Evidence
  executeEvidenceRequest(
    handle: RuntimeHandle,
    request: EvidenceRequest
  ): Promise<EvidenceArtifact[]>;
  
  // Smoke
  runSmoke(projectRoot: string, handle: RuntimeHandle): Promise<SmokeResult>;
}
```

## How Should Runtime/Evidence Work Per Stack?

| Stack | Runtime | Evidence |
|-------|---------|----------|
| Vite React | Vite preview | Browser screenshot + DOM |
| Next.js | Next dev server | Browser screenshot + DOM |
| Browser game | Vite preview | Browser screenshot + canvas + game state |
| API | Node server | HTTP request/response + schema |
| CLI | Subprocess | stdout/stderr + exit code |
| Android | Emulator | Screenshot + UI hierarchy + logcat |
| iOS | Simulator | Screenshot + accessibility tree |

## How to Avoid Endless Stack-Specific Rules?

**Evidence contracts, not rules.** Each stack pack defines:
- What evidence types it produces
- How to execute interaction scripts
- What constitutes a "pass"

Setfarm does not have stack-specific guards. It has:
- "Does evidence artifact exist?"
- "Does evidence match contract schema?"
- "Is screenshot not blank?"

## Should Mobile Wait Until Web Is Stable?

**Yes.** Web apps and browser games must be stable first. The stack pack interface should be designed for future expansion, but mobile implementation should wait until:
- Evidence runner is proven on 50+ web runs
- Stack pack interface is stable
- QA-FIX loop is bounded and rare

---

# 13. What To Stop Doing Immediately

1. **Stop running more random sample projects until core refactor is done.** Every run produces new symptoms that tempt you to add guards. You are treating the factory while the assembly line is running.

2. **Stop adding project-specific guards.** No more "if project is X, check Y." Guards must be stack-contract or evidence-contract based.

3. **Stop letting QA create unbounded QA-FIX stories.** Cap at 1 per finding. No QA-FIX chains.

4. **Stop trusting agent self-review.** Agent prose about correctness is worthless. Only evidence artifacts matter.

5. **Stop merging legacy events with observations.** Pick one. Migrate. Delete the other.

6. **Stop letting supervisor patch or fix.** Supervisor reports. Setfarm decides.

7. **Stop using advisory evidence mode.** Evidence is blocking for UI stories, or the story cannot complete.

8. **Stop considering `patch_and_resume`.** It is unsafe. Reject it.

9. **Stop adding spawner behavior guards.** Fix context and contracts instead.

10. **Stop treating MC as a debug log.** It is a projection. Raw events are for debugging, not display.

---

# 14. What To Build Next

## Phase 1: Authority Inversion Fix (Weeks 1-2)
**Goal**: Agent output becomes advisory. Setfarm owns completion.

| Files/Subsystems | Changes |
|-----------------|---------|
| `src/installer/step-ops.ts` | Split: extract `story-router.ts`, `pr-lifecycle.ts` |
| `src/installer/steps/06-implement/guards.ts` | Evidence mandatory before completion |
| `src/installer/implement-evidence-runner.ts` | Always run, never skip |
| `src/installer/steps/09-qa-test/` | QA-FIX cap = 1, no chains |

**Tests**:
- `tests/story-router.test.ts`: failure routing table
- `tests/evidence-mandatory.test.ts`: story cannot complete without evidence
- `tests/qa-fix-cap.test.ts`: QA-FIX bounded

**Acceptance Criteria**:
- No story completes without `IMPLEMENT_EVIDENCE.json`
- QA-FIX count per run ≤ 2
- `step-ops.ts` < 300 lines

**Risks**:
- Blocking evidence may stall agent. Mitigation: improve verification request templates.

## Phase 2: God File Amputation (Weeks 2-3)
**Goal**: `step-ops.ts` split, step modules become real engines.

| Files/Subsystems | Changes |
|-----------------|---------|
| `src/installer/step-ops.ts` | Delete. Replace with `step-lifecycle.ts` + `story-router.ts` + `pr-lifecycle.ts` |
| `src/installer/steps/*/module.ts` | Each exports `StepEngine` with preclaim, context, guards, complete |
| `src/spawner.ts` | Split: `agent-guard.ts`, `claim-recovery.ts` |

**Tests**:
- `tests/step-lifecycle.test.ts`
- `tests/pr-lifecycle-fsm.test.ts`
- `tests/step-engine-contract.test.ts`

**Acceptance Criteria**:
- No file > 400 lines in `src/installer/`
- Step module can be tested in isolation
- PR state FSM has explicit transitions

**Risks**:
- Refactoring breaks existing runs. Mitigation: run on test projects only.

## Phase 3: Evidence Architecture Hardening (Weeks 3-4)
**Goal**: Universal evidence runner with stack contracts.

| Files/Subsystems | Changes |
|-----------------|---------|
| `src/installer/runtime-driver.ts` | Finalize interface |
| `src/installer/web-runtime-driver.ts` | Implement stack pack |
| `src/installer/stack-contract/packs.ts` | Add evidence contract per stack |
| `scripts/smoke-test.mjs` | Merge into evidence runner as "cumulative evidence" |

**Tests**:
- `tests/evidence-runner.test.ts`
- `tests/web-evidence-contract.test.ts`
- `tests/stack-pack-interface.test.ts`

**Acceptance Criteria**:
- Evidence runner works for web apps
- Stack pack interface documented
- Smoke test is evidence contract, not separate script

**Risks**:
- Stack pack abstraction may be wrong. Mitigation: prove on web first.

## Phase 4: MC Projection Rewrite (Weeks 4-5)
**Goal**: Single source of truth. No stale blockers.

| Files/Subsystems | Changes |
|-----------------|---------|
| `src/server/dashboard.ts` | Read only from `run_observations` |
| `src/server/index.html` | Split into JS modules per projection |
| `src/installer/events.ts` | Freeze writes, begin migration |
| `src/installer/observations.ts` | Add projection helpers |

**Tests**:
- `tests/mc-projection.test.ts`
- `tests/stale-blocker.test.ts`

**Acceptance Criteria**:
- MC shows no stale PR state
- Cancelled projects clearly marked
- Activity is projection, not raw events

**Risks**:
- UI rewrite takes time. Mitigation: backend projection first, UI second.

## Phase 5: Supervisor Amputation (Weeks 5-6)
**Goal**: Supervisor is read-only. No fixer.

| Files/Subsystems | Changes |
|-----------------|---------|
| `src/installer/supervisor/fixer.ts` | Delete |
| `src/installer/supervisor/checklist.ts` | Merge with script-layer validators |
| `src/installer/supervisor/visual-qa.ts` | Make advisory only |
| `src/installer/supervisor/coordinator.ts` | Simplify to report generator |

**Tests**:
- `tests/supervisor-readonly.test.ts`
- `tests/supervisor-report-schema.test.ts`

**Acceptance Criteria**:
- Supervisor cannot modify files
- Supervisor report is JSON with schema
- No supervisor-initiated QA-FIX

**Risks**:
- Supervisor was catching real issues. Mitigation: move checks to earlier steps.

## Phase 6: Self-Heal Lockdown (Week 6)
**Goal**: Self-heal is plan-only forever.

| Files/Subsystems | Changes |
|-----------------|---------|
| `src/installer/platform-self-heal/config.ts` | Remove `patch_only` and `patch_and_resume` modes |
| `src/installer/platform-self-heal/runner.ts` | Disable file writes |
| `src/installer/platform-self-heal/rollback.ts` | Keep for future human-applied patches |

**Tests**:
- `tests/self-heal-plan-only.test.ts`
- `tests/immutable-tests.test.ts`

**Acceptance Criteria**:
- Self-heal mode enum: `off`, `plan_only`
- `patch_only` and `patch_and_resume` removed from code

**Risks**:
- Low risk. This is deletion.

---

# 15. Keep / Remove / Refactor Table

| Component | Current Role | Verdict | Why | New Owner/Layer | Required Tests |
|-----------|-------------|---------|-----|-----------------|---------------|
| `step-ops.ts` | God file: lifecycle, PR, QA-FIX, routing | **Refactor** | Overloaded, untestable | Split into `step-lifecycle.ts`, `story-router.ts`, `pr-lifecycle.ts` | `story-router.test.ts`, `pr-lifecycle-fsm.test.ts` |
| `spawner.ts` | Process manager + behavior policeman | **Refactor** | Too many concerns | `spawner.ts` (process only), `agent-guard.ts`, `claim-recovery.ts` | `spawner-process.test.ts`, `agent-guard.test.ts` |
| MC dashboard | Single-file UI, dual-truth | **Refactor** | Unmaintainable, stale data | Component-based JS modules, observation-only backend | `mc-projection.test.ts`, `stale-blocker.test.ts` |
| `run_observations` | Append-only observation log | **Keep** | Correct design, single source of truth | Core state layer | `observations-schema.test.ts` |
| Legacy events | Event bridge, dual-truth source | **Remove** | Causes stale blockers | Migrate to observations, then delete | Migration verification |
| Supervisor checklist | Deterministic rules + static analysis | **Refactor** | Duplicates script layer | Merge with `scripts/generated-screen-validator.mjs` | `design-contract-validation.test.ts` |
| Visual QA | Design/code mismatch detection | **Refactor** | Should be advisory, not blocking | Stack evidence contract | `visual-evidence-contract.test.ts` |
| QA-FIX | Unbounded repair stories | **Refactor** | Infinite loop risk | Bounded retry cap = 1, no chains | `qa-fix-cap.test.ts` |
| Implement evidence | Runtime proof capture | **Keep + Harden** | Core value, but advisory mode weakens it | Mandatory for UI stories | `evidence-mandatory.test.ts` |
| Smoke test | Browser semantic checks | **Refactor** | Catches things too late | Merge into evidence runner as cumulative contract | `evidence-cumulative.test.ts` |
| `stitch-to-jsx` | Stitch HTML → React compiler | **Keep** | Correct mechanical layer | Script layer | `stitch-to-jsx.test.ts` |
| `generated-screen-validator` | Screen consistency checker | **Keep + Expand** | Correct mechanical layer | Script layer, run at setup-build | `generated-screen-validator.test.ts` |
| Platform self-heal | Auto-patch Setfarm/MC | **Remove modes** | `patch_and_resume` unsafe | `plan_only` only, forever | `self-heal-plan-only.test.ts` |
| Stack contracts | Stack pack interfaces | **Keep + Expand** | Correct abstraction | Core interface, per-stack packs | `stack-pack-interface.test.ts` |
| Workflow agents | 11 LLM agents | **Reduce** | Too many, unclear boundaries | 3 LLM agents + 7 deterministic tools | `agent-authority.test.ts` |

---

# 16. Final Verdict

## **Partial Architecture Reset + Pause Generated Runs**

### Explanation

**Do not continue with targeted fixes.** The patch loop will consume you. Every fix adds complexity without fixing the root cause (authority inversion).

**Do not do a full architecture reset.** The core ideas are correct: observations, stack contracts, evidence runner, mechanical script layer. Throwing everything away would waste good work.

**Do pause generated runs until Phase 1 and Phase 2 are complete.** Running the factory while refactoring the assembly line produces more symptoms, more guards, more debt.

### What "Partial Reset" Means

1. **Keep**: Observations, stack contracts, evidence runner intent, script layer, PR model, MC live board concept
2. **Reset**: `step-ops.ts` architecture, supervisor role, QA-FIX model, self-heal modes, MC projection, agent role count
3. **Pause**: No new generated projects until evidence is mandatory, step-ops is split, and QA-FIX is bounded

### The Painful Truth

You have been trying to make agents trustworthy by adding guards. The correct approach is to **make Setfarm authoritative and agents advisory**. This means:
- Agents write code. Setfarm proves it works.
- Agents propose designs. Setfarm validates them mechanically.
- Agents suggest fixes. Setfarm routes failures deterministically.
- Supervisor observes. Setfarm decides.

This is a mindset shift from "orchestrated agents" to "compiler with LLM passes." It will feel like reducing agent autonomy. That is correct. The agents are not employees. They are compiler passes that happen to use natural language.

**Stop trying to build a company. Build a compiler that looks like a company on the outside.**
