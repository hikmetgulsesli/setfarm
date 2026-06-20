# Stack Memory Registry Design

Date: 2026-06-20
Status: Draft for operator review
Scope: Setfarm stack memory, supervisor repair learning, prompt context, Mission Control visibility

## Purpose

Setfarm should learn from repeated stack-specific failures without turning every
lesson into a global rule. A fix that is correct for `static-html-site` can be
wrong for `nextjs-web-app`, `browser-game-canvas`, iOS, or Android. The system
needs a small, living memory per stack that workers can read before acting and
that supervisors can update after real evidence.

The goal is not to prevent every generated project error. Errors are expected.
The goal is to route errors through the right recovery path:

1. gate detects the problem
2. supervisor classifies it
3. worker receives a targeted repair instruction
4. the same stack memory records the lesson if it is reusable
5. later runs read only the relevant memory

## Non-Goals

- Do not create project-specific rules for names, files, icons, or one-off UI
  mistakes.
- Do not inject all stack guidance into every agent prompt.
- Do not let implementation agents write permanent memory directly.
- Do not relax guards just because a generated app failed.
- Do not make setup/build fail for repairable product defects such as missing
  icons, missing handlers, or fixable DOM/security findings.

## Core Model

The registry is hybrid:

- **Canonical memory lives in the repo** as reviewed Markdown or JSON fragments.
- **Live observations live in the database** with run, step, story, stack, gate,
  evidence, and classification metadata.
- **Supervisor memory candidates bridge the two**. A supervisor can propose a
  stack-memory update, but Setfarm records it as a candidate until it is accepted
  into canonical memory.

This keeps the system adaptive without letting noisy runs corrupt the long-term
memory.

## Memory Layers

Agents receive memory in four layers, ordered from broad to narrow:

1. **Global Memory**
   - Applies to every stack.
   - Contains durable invariants: inspect live DB, respect scope, do not
     hardcode project behavior, build/test before concluding, route product
     defects through recovery.

2. **Stack Memory**
   - Applies only to the resolved stack pack.
   - Examples: `static-html-site`, `vite-react-web-app`,
     `browser-game-canvas`, `nextjs-web-app`, `react-native-expo`,
     `ios-native`, `android-native`.

3. **Failure Memory**
   - Applies to the current failure category.
   - Examples: `xss_inner_html`, `semantic_action_id_equivalent`,
     `missing_icon_asset`, `post_merge_quality_regression`,
     `scope_write_violation`.

4. **Run Memory**
   - Applies only to the current run/story.
   - Includes current story scope, retry state, PR state, supervisor findings,
     active gate output, and recovery attempts.

Workers read memory. Supervisors classify and propose updates. Setfarm persists
approved canonical memory.

## Canonical File Layout

Initial repo layout:

```text
memory/
  global.md
  stacks/
    static-html-site.md
    vite-react-web-app.md
    nextjs-web-app.md
    browser-game-canvas.md
    react-native-expo.md
    ios-native.md
    android-native.md
  failures/
    xss-inner-html.md
    semantic-action-id-equivalence.md
    missing-icon-asset.md
    post-merge-quality-regression.md
    scope-write-violation.md
```

The files must stay short. They are operational memory, not documentation dumps.
Each stack file should be understandable in one screen.

## Stack Memory Shape

Each stack memory file uses the same sections:

```md
# static-html-site memory

## Behavior
- Static HTML may have no package build. `BUILD_CMD=true` can be valid.
- DOM behavior often lives in inline scripts or plain JS assets.

## Recovery Recipes
- `xss_inner_html`: Convert dynamic HTML construction to DOM
  `createElement`/`textContent`; preserve action IDs and ARIA semantics.

## Supervisor Handoff
- Missing icons, missing handlers, and visible DOM gaps are product repair
  findings unless they block app startup or final security.

## Platform Watch
- If a guard rejects a semantically equivalent stack-native pattern, classify as
  platform detector gap, not project failure.

## Do Not Do
- Do not force npm build tooling into a static HTML project.
- Do not turn one project filename, icon name, or app name into a stack rule.
```

## Live Database Model

Add a live memory candidate table rather than writing canonical memory directly:

```sql
stack_memory_candidates
  id uuid primary key
  stack_pack_id text not null
  failure_category text not null
  source_run_id uuid not null
  source_step_id text
  source_story_id text
  evidence jsonb not null
  proposed_memory_md text not null
  confidence numeric not null
  status text not null -- proposed, accepted, rejected, superseded
  created_at timestamptz not null
  reviewed_at timestamptz
  reviewed_by text
```

Mission Control can show proposed lessons separately from accepted memory.

## Prompt Injection

Claim context should inject a compact memory block:

```text
# Setfarm Memory

## Global
<global memory excerpt>

## Stack: static-html-site
<resolved stack memory excerpt>

## Current Failure: xss_inner_html
<failure memory excerpt, if applicable>

## Run Notes
<current supervisor intervention and run memory>
```

Rules:

- Inject exactly one stack memory block, matching the resolved stack contract.
- Omit unrelated stack memories.
- Cap memory length with deterministic trimming.
- Prefer accepted canonical memory over live candidates.
- Include live candidates only as advisory and clearly label them as proposed.

## Supervisor Update Flow

Supervisor writes memory candidates only after evidence exists.

Flow:

1. A gate fails or emits a repairable finding.
2. Supervisor determines whether the failure is product-level, platform-level,
   ambiguous, or environment-level.
3. If the lesson is reusable and stack-specific, supervisor emits a memory
   candidate.
4. Candidate is stored in DB with the source evidence.
5. Operator or platform self-heal process accepts, edits, rejects, or supersedes
   it.
6. Accepted memory is committed to repo canonical memory.

Implementation agents do not write canonical memory and do not edit stack
memory while implementing a generated project.

## Classification Policy

Use four ownership classes:

- **Product Repair**
  Generated app is wrong, but repair is expected. Worker fixes scoped files.

- **Supervisor Repair**
  Product issue needs focused diagnosis or multi-file coordination. Supervisor
  emits a concrete intervention and hands back to worker.

- **Platform Detector Gap**
  Setfarm guard, scanner, stack pack, or MC endpoint misreads valid behavior or
  misses invalid behavior. Platform code needs a targeted fix and tests.

- **Environment/Provider**
  Kimi/API/network/process issue. Requeue or retry without consuming product
  retry budget when mechanically confirmed.

Example from the current run:

- Security gate correctly found dynamic `innerHTML` XSS.
- Worker correctly converted dynamic HTML to DOM API.
- Implement guard then rejected the change because it compared the old literal
  `data-action-id` string instead of recognizing an equivalent DOM
  `setAttribute` pattern.
- Classification: `platform_detector_gap` for static-html semantic action ID
  equivalence.
- Memory candidate: static HTML security repairs may replace HTML strings with
  DOM API, and semantic guards must recognize equivalent action ID preservation.

## Guard Strategy

Guards remain strict where they protect real invariants:

- scope safety
- build/test command integrity
- critical security
- generated screen reachability
- action/control semantics
- PR review comments
- retry exhaustion

But guards should compare behavior and contracts, not incidental source shape.
If a stack-native refactor preserves the observable contract, the guard should
accept it. If the guard cannot mechanically prove equivalence, it should route
to supervisor/platform diagnosis instead of repeatedly consuming story retries.

## Mission Control Visibility

Mission Control should expose:

- resolved stack memory used by the current claim
- current failure category
- supervisor intervention text
- memory candidates proposed by the run
- accepted/rejected memory history
- whether a failure is product repair, supervisor repair, platform detector gap,
  or environment/provider

This lets the operator see whether Setfarm is learning correctly or merely
looping.

## Initial Stack Memory Seeds

Seed only proven lessons:

- `static-html-site`
  - `BUILD_CMD=true` can be valid.
  - Dynamic HTML security fixes should prefer DOM API/textContent.
  - DOM API action ID preservation is equivalent to literal action attributes
    when mechanically proven.

- `browser-game-canvas`
  - First viewport must be playable game surface, not dashboard or landing page.
  - Runtime loop/state/input failures are product repair findings before run
    failure, unless app cannot start.

- `vite-react-web-app`
  - App/router edits must preserve prior generated screen branches.
  - Missing icons are repairable UI fidelity findings, not setup-build failure.

Other stack files can start empty except for behavior boundaries and build
expectations.

## Success Criteria

- Agent prompts include only global memory, selected stack memory, current
  failure memory, and run memory.
- Product defects are routed to worker/supervisor repair instead of becoming
  brittle global rules.
- Platform detector gaps produce memory candidates plus platform test targets.
- A static HTML XSS repair that preserves action IDs through DOM API is not
  falsely rejected as semantic regression.
- Mission Control shows which memory influenced a claim and which new lessons
  were proposed.
- Canonical memory stays short, reviewed, and stack-specific.

## Rollout Plan

1. Add canonical memory file layout with short seeds.
2. Add a memory loader that resolves `global + stack + failure + run`.
3. Inject compact memory into implement, verify, supervise, security, QA, and
   final-test contexts.
4. Add `stack_memory_candidates` DB storage and API.
5. Teach supervisor to emit memory candidates from classified failures.
6. Add MC view for memory used/proposed/accepted.
7. Migrate old `stack-rules.ts` prose into stack memory or stack contracts where
   appropriate.
8. Add tests proving unrelated stack memory is not injected.

