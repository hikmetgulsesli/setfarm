# Rules, Guards, Gates, And Loops Inventory

This inventory is intended to help an external model answer: "Which rules exist, where is there excessive complexity, and which rules should be preserved or removed?"

## Phase Boundary Rules

- PLAN should produce only the Product Contract; it should not produce a repository path, branch, package name, physical screen list, or runtime identity.
- DESIGN should bind Product Surfaces to Stitch artifacts; an out-of-scope screen or unmapped surface should be a hard failure.
- STORIES should produce stories and scopes from the PRD + SCREEN_MAP; a hallucinated file path or missing scope file should fail.
- SETUP-BUILD should import the design, install dependencies, run the baseline build, and produce a generated-screen setup certificate.
- IMPLEMENT should work only within the story scope and granted shared files.
- VERIFY should mechanically verify PR, comment, merge, and post-merge state.
- QA/FINAL-TEST should complete based on JSON, evidence, and smoke results, not agent prose.

## Design And Stitch Guards

- Unknown Material Symbols should not fall back; `stitch-to-jsx` should fail.
- Material Symbols/icon-font CSS should not leak into the generated runtime.
- Blanket CSS rules such as `transition: all` should be sanitized or rejected.
- `SCREEN_MAP`, `UI_CONTRACT`, `DESIGN_DOM`, and `SCREEN_INDEX` should be consistent with one another.
- Every generated screen in SCREEN_MAP should have a file and component.
- Generated screens should pass required-prop, action-ID, shell-chrome, and regression gates.
- Raw Stitch HTML should not be the implementation agent's primary context; the agent should work from UI_CONTRACT, SCREEN_INDEX, and the claim summary.

## Scope And Ownership Guards

- Every story should have `.story-scope-files` or a resolved scope list.
- Changes to files outside the story should fail or be hard-blocked.
- Shared files should be edited only through an explicit grant.
- The implementation agent should not stage, commit, or push; Setfarm should create the scoped commit and PR.
- If a retry patch reapplies a previously rejected deletion or change, the runtime guard should terminate it.
- The agent should not enter a loop parsing raw claim JSON; it should use `CLAIM_SUMMARY_FILE`.

## Runtime/Spawner Guards

`src/spawner.ts` contains many runtime-discipline guards:

- gateway readiness wait/restart/backoff
- runtime usage limit cooldown
- stale OpenClaw task cleanup
- orphaned loop claim recovery
- untracked running single step retry
- process startup silent timeout
- model turn stalled watchdog
- hard stuck watchdog
- repeated tool/self-loop detection
- repeated write/edit no-op detection
- broad process cleanup ban (such as `pkill` and `killall`)
- git discipline violation detection
- pre-delta context sprawl detection
- irrelevant reference context read detection
- generated screen shared read detection
- raw Stitch context read detection
- runtime guard repeat limit

Risk: These guards catch real problems, but too many runtime-discipline rules can turn agent behavior from "writing code" into a game of "avoiding guards."

## Build/Test/Smoke Gates

- `npm run build` is used as a baseline and post-story gate.
- Step-specific and project tests are run.
- `scripts/smoke-test.mjs` catches runtime semantic issues: routes, buttons, generated screens, static browser-game issues, and weak interactions.
- A smoke failure can create a QA-FIX story.
- A QA-FIX loop guard is required; without it, the quality phase can create new stories indefinitely.

Risk: The smoke gate catches semantic bugs, but if it catches one too late, a QA-FIX is opened after the story has been verified. This creates the impression that "it was finished, then it broke again."

## PR/Review/Merge Guards

- At the end of an implementation story, Setfarm creates a scoped commit.
- A story PR is opened or reused.
- VERIFY reads PR review comments.
- If there is an actionable comment, VERIFY routes the story back to IMPLEMENT.
- The story should not be verified unless the PR state is `MERGED`.
- A post-merge build/smoke gate can run.
- The review-comment lifecycle currently appears as events and observations, but it is not sufficiently first-class as an explicit FSM.

Risk: A stale "PR state OPEN" observation can appear as an active blocker in MC activity even after the story is verified. Event sourcing is correct, but the projection/read model is incomplete.

## Supervisor Guards

- The product supervisor checks story and final coherence.
- The deterministic checklist catches issues such as static buttons, missing handlers, missing generated screens, and scope drift.
- Supervisor memory carries prior blocker context into later stories.
- The visual QA layer attempts to catch design/code mismatches.

Risk: If the supervisor acts as PM, QA, static analyzer, and fixer, its authority boundary becomes unclear. In a QA-FIX story in particular, the supervisor checklist can conflict with a new runtime fix because it still reflects an old design expectation.

## Evidence Rules

- An agent should not self-certify runtime correctness in prose.
- An agent can request `IMPLEMENT_INTENT.json` and `IMPLEMENT_VERIFICATION_REQUEST.json`.
- Setfarm should start the runtime, execute the interaction, capture screenshots, DOM, and state, and write `IMPLEMENT_EVIDENCE.json`.
- The evidence gate can be `off|advisory|blocking`.
- Visual evidence can also be `off|advisory|blocking`.

Risk: If a missing request passes in advisory mode, the evidence system is visible but not binding. If blocking mode is enabled too early, existing agents may become blocked too frequently.

## Platform Self-Heal Rules

- The safe default mode should be `plan_only`.
- A platform patch requires classification, an ownership map, a write interceptor, rollback, a patch registry, and a strictness delta.
- An LLM should not self-certify the success of its own patch.
- Self-heal should not be allowed to modify immutable platform tests.
- Broad categories such as `mc_visibility_bug` should be narrowed.

Risk: If self-heal relaxes the smoke test or removes a guard, the success rate rises while the platform becomes less correct.

## Mission Control Rules

- MC should display run, step, and story status; observations; the evidence filmstrip; PR status; and the runtime URL.
- Cancelled, failed, or stale cards should not mislead users.
- Activity should be a projection/read model, not a raw event stream.
- Evidence screenshots, DOM, runtime URL, and port lifecycle should be visible.

Risk: If MC presents a stale blocker or old event as an active issue, users will not trust the system.
