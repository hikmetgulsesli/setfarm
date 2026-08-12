# Pipeline Behavior By Step

## 01 PLAN

Purpose: Convert the user's request into a portable Product Contract PRD.

Expected output: project name/slug, platform, technology stack, DB/design decisions, PRD, Product Surfaces, ACT_* actions, and a testability contract.

Forbidden: repository path, branch, package name, physical screen list, and runtime identity.

Risk: If PLAN remains too general, DESIGN/STORIES produce poor surfaces and actions; if it includes too much physical detail, it constrains downstream layers.

## 02 DESIGN

Purpose: Produce Stitch design artifacts from Product Surfaces and bind every screen to its surface contract.

Preclaim: ensure the Stitch project, generate/download screens, and produce DESIGN.md, HTML, PNG, DOM, tokens, and the manifest.

Expected: SCREEN_MAP, DESIGN_SYSTEM, device type, and surface mapping.

Risk: If the number of physical Stitch screens is matched incorrectly to stories/scopes, the generated app can appear "complete" while screens are missing.

## 03 STORIES

Purpose: Produce implementable user stories from the PRD + SCREEN_MAP.

Expected: story scope, acceptance criteria, owned files, generated-screen ownership, and action mapping.

Risk: If the scope is too narrow, the required App.tsx/router/action wiring cannot be implemented; if it is too broad, story isolation breaks down.

## 04 SETUP-REPO

Purpose: Prepare the project repository, scaffold, Git state, database, and design contracts.

Preclaim: setup script, branch, DB provisioning, Stitch contracts, and route/component contracts.

Risk: If setup artifacts are missing, the implementation agent guesses context that does not exist.

## 05 SETUP-BUILD

Purpose: Prove mechanically that the baseline build and generated-screen import are clean.

Preclaim: npm install, baseline build, compatibility, Tailwind, `stitch-to-jsx`, and the setup certificate.

Required hard gates:

- unknown icons
- missing generated screen file
- token/CSS source missing
- build failure
- SCREEN_MAP/UI_CONTRACT mismatch

Risk: If setup-build overrides a design-import failure because "the build passed," the rest of the pipeline is contaminated.

## 06 IMPLEMENT

Purpose: Implement each story in a scoped worktree and pass it through mechanical gates before Setfarm creates a commit and PR.

Expected:

- changes within the story scope
- build/test pass
- generated-screen/action-wiring pass
- runtime-bridge pass
- an implementation evidence artifact or at least advisory evidence
- supervisor-checklist pass
- Setfarm-owned commit + PR

Risks:

- the agent claims to have tested its work, but no runtime evidence exists
- App.tsx/shared-shell changes break later stories
- a QA-FIX story regresses an existing verified screen

## 07 VERIFY

Purpose: Verify PR review comments, merge state, CI/checks, and post-merge correctness.

Expected:

- actionable PR comments are normalized
- a comment is routed back to IMPLEMENT when a fix is required
- a story is not verified before its PR is merged
- post-merge build/smoke checks run when required

Risks:

- an OPEN PR-state observation remains a stale blocker in MC even after the story is verified
- GitHub state differs from the reviewer agent's "done" claim
- the story lifecycle becomes complicated when a VERIFY failure becomes a QA-FIX

## 12 SUPERVISE

Purpose: Have the product supervisor check story and final coherence.

Expected:

- deterministic checklist pass/block
- memory update
- visual/design warnings
- safe intervention

Risk: If the supervisor assumes the product, QA, static-analyzer, and fixer roles at the same time, it requests a fix in the wrong layer.

## 08 SECURITY-GATE

Purpose: Perform a security-sensitive source scan and repository guard.

Expected: detection of risks such as secrets, unsafe sinks, dangerous eval usage, and sensitive storage.

Risk: The security gate should not become entangled with application semantics; it should examine only the security contract.

## 09 QA-TEST

Purpose: Perform user-facing runtime QA and produce a structured QA report.

Expected:

- QA JSON artifact
- smoke/browser evidence
- real route/screen/button/form coverage
- a QA-FIX story only for an explicit, bounded issue

Risk: If the QA agent writes arbitrary tests or produces a hallucinated issue, the pipeline enters a repair loop.

## 10 FINAL-TEST

Purpose: Perform the final runtime/evidence gate before deployment.

Expected: a machine-readable final-test artifact consistent with QA.

Risk: If FINAL-TEST passes based on prose or raw logs, the last gate is weakened.

## 11 DEPLOY

Purpose: Register the completed project with the local/server runtime and make it visible in MC Projects.

Expected:

- runtime port/domain metadata
- service registration
- project visibility
- stop/start semantics

Risk: local-port confusion, cancelled/failed old project cards, and a missing runtime URL.

## Cross-Step Problem

The pipeline currently contains many appropriate protections at every step, but when failure routing happens too late, the same problem returns as a new story/QA-FIX/supervisor cycle. The external model should examine this question in particular:

Which failures should terminate within their step, which should move downstream into QA-FIX, and which should stop the run and require an architecture/platform patch?
