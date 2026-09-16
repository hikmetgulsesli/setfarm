# Held selected-startup resolution implementation plan

> **For agentic workers:** Main is sole writer; independent agents perform
> read-only review and completeness investigation. No live service effects.

**Goal:** Resolve the fixed retained startup's reviewed package edges without
evaluating retained code, keeping lookup boundaries held through later awaits.

**Architecture:** Add zero-input `resolveModules()` to the retained-profile held
context. Its private selected root and authenticated profile supply all inputs.
Snapshot API/schema/blockers remain unchanged. Return separate evidence limited
to HOME-absent and account-HOME contexts, not actual-launcher qualification.

**Tech Stack:** Node builtins, fixed inline resolver child, physical fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`

## Global constraints

- Preserve old deployment/eight archives and ports3333/3080/18789.
- No retained application/native evaluation; resolve paths only.
- No caller-controlled roots, edges, expected targets, HOME or conditions.
- Trusted Node/macOS/Homebrew runtime remains a prerequisite. Owning launcher
  composition separately binds PR132 PATH identity and actual effective HOME.
- No DB connection, service operation, new diagnostic endpoint or guard change.
- No claim of all possible imports: deferred branches remain outside the fixed
  startup profile, including browser plugins, Cloudflare and instrumentation.

## File map

- `scripts/deployment-cutover-retained-profile.mjs`: private lazy resolver,
  fixed child code and held candidate absence boundaries; existing close owns
  all pins and keeps consume-once/sticky uncertainty behavior.
- `scripts/deployment-cutover-retained-profile.v1.json`: literal29edge table:
  21static application groups,2producer metadata edges,6package bare edges.
- `scripts/__tests__/fixtures/deployment-cutover-retained-profile.mjs`: private
  literal canary edges bound to physical fixture inventory.
- `scripts/integration/deployment-cutover-retained-resolution-physical.test.mjs`:
  actual child resolution, optional shadows, drift and no-evaluation regressions.
- `scripts/integration/deployment-cutover-retained-profile-genuine.test.mjs`:
  materialize all10SRI-authenticated archives in a private fixture and exercise
  all29real metadata/target edges; wrong-target refusal is separately witnessed.
- `scripts/__tests__/fixtures/deployment-cutover-bootstrap.mjs`: optional private
  fixture parent and extra compiled placeholder sources before finalization.
- `package.json` and the existing retained-profile standard-command test:
  run only this environment-sensitive integration group serially, preserving
  parallel ordinary script tests; verify the standard command runs the new tests.

This test-runner refinement is causally required: optional CJS absence pins
include ancestor directory timestamps. Shared OS-temp churn, then concurrent
account-HOME fixture churn, caused fail-closed positive-test refusals (initial
combinedgate103/105). A private lazy suite base and serialized integration group
avoid test-created cross-worker noise without relaxing production ABA checks.
No retry-on-generic-error or acceptance bypass was added.

## Task 1: Resolve held reviewed edges without evaluation

- [x] Add fixture edges from authenticated `dist/cli/cli.js` to throwing package
  `reviewed-fixture/index.js`, with CJS+ESM modes and an absent optional package.
  Write test: `const h=module.holdDeploymentCutoverRetainedProfileV1();
  const r=h.resolveModules(); h.recheck(); h.close(); return r;`.
- [x] Run focused test and observe missing-method RED.
- [x] Implement argument-free method; validate <=64 edges against held selected
  output/package membership, exact modes/specifiers and expected package targets.
  Fixed child reads bounded stdin and returns resolve.paths first; parent pins
  nearer package candidates (bare/.js/.json/.node) and nearest absent ancestors.
  Actual second child calls import.meta.resolve(spec,parent) or
  createRequire(parent).resolve(spec), never import/require target modules.
- [x] Use same trusted Node with only fixed flags, sanitized environment,
  <=1MiB input/output and5second timeout. Match literal targets or optional
  MODULE_NOT_FOUND; unexpected child errors/refusals remain failure.
- [x] Repeat for absent HOME and account HOME, hold all acquired pins, recheck
  selected source/inventory around children and across subsequent awaits.
- [x] Add actual nearer shadow, optional shadow, same-byte replacement and
  creation/removal regressions. Assert recheck itself refuses and drains pins.
- [x] Verify repeated operation/closed context/caller inputs refuse, children
  cannot emit canary evaluation, and existing snapshot wire remains unchanged.

## Task 2: Bind exact reviewed production table and verify delivery

- [x] Add literal29reviewed edges; metadata includes producer
  playwright/package.json and playwright-core/package.json. Relative inventory
  remains required, including browsers.json and fsevents.node.
- [x] Run genuine fixed packages without retained evaluation, focused physical
  suite and affected bootstrap tests; noemit/source contracts as applicable.
- [x] Independent implementation/test reviews; fix findings with RED/GREEN.
- [ ] Reviewed scoped PR and clean independent normal build under standing
  owner authorization. Effective HOME/DB/phase/controller remain unfinished.

## Verification evidence

- Final retained-profile/bootstrap group:87/87passed,exit0.
- Standard serialized genuine/physical integration command:24/24passed,exit0.
- Manifest contracts:18/18passed; TypeScript noemit, English1553files,
  path contracts885files and diff whitespace checks passed.
- Two independent read-only reviews cleared the implementation and test
  isolation. The original103/105failure is retained above, not hidden by retries.
- Read-only retained-installation smoke resolved all29edges under both fixed
  HOME contexts without evaluating package code. This is not actual-launcher
  environment evidence and does not authorize service or DB effects.
