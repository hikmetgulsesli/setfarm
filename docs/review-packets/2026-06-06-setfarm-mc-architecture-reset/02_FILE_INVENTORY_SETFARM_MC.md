# File Inventory: Setfarm + Mission Control

Bu dosya her kaynak dosyanın tam kodunu içermez. Amaç dış modele repo haritası vermek ve hangi dosyanın neye baktığını hızlı göstermek.

## Root And Build

- `package.json`: Node >=22, TypeScript ESM, Playwright/Postgres/YAML bağımlılıkları, build/test script'leri.
- `tsconfig.json`: TypeScript compile ayarları.
- `AGENTS.md`: contributor/agent guide; evidence gate ve self-certification kurallarını özetler.
- `README.md`, `ARCHITECTURE.md`, `SECURITY.md`: ürün ve güvenlik dokümantasyonu.
- `.env.example`: public configuration template. Secret içermemeli.

## CLI And Runtime Entrypoints

- `src/index.ts`: package-level entry.
- `src/runtime-config.ts`: runtime/env loading.
- `src/cli/cli.ts`: CLI commands.
- `src/cli/runtime-guard.ts`: CLI runtime protection.
- `src/spawner.ts`: detached/loop agent process orchestrator, watchdog, runtime guard, claim recovery, gateway readiness.
- `src/spawner-prompt.ts`: claim summary and prompt context builder.

## Database And Core State

- `src/db-pg.ts`: database tables and schema evolution. Key tables: `runs`, `steps`, `stories`, `claim_log`, `run_observations`.
- `src/installer/events.ts`: legacy/event observation bridge.
- `src/installer/observations.ts`: append-only `run_observations` writer.
- `src/installer/operation-observability.ts`: structured operation observations.
- `src/installer/status.ts`: status rendering/helpers.

## Workflow Orchestration

- `src/installer/run.ts`: starts workflow run, initializes step/story state.
- `src/installer/workflow-spec.ts`: workflow YAML parsing and types.
- `src/installer/workflow-fetch.ts`: workflow retrieval.
- `src/installer/step-ops.ts`: central claim/preclaim/complete/routing engine. High-risk large file.
- `src/installer/step-advance.ts`: step advancement helpers.
- `src/installer/step-fail.ts`: step failure helpers.
- `src/installer/step-guardrails.ts`: generic guardrail helpers.
- `src/installer/context-ops.ts`: context parse/update helpers.
- `src/installer/retry-feedback.ts`: retry feedback assembly.
- `src/installer/verify-retry-routing.ts`: verify failure routing.

## Step Modules

Each directory under `src/installer/steps/NN-name` owns a pipeline phase:

- `01-plan`: Product Contract PRD generation. No repo paths/screens.
- `02-design`: Stitch brief/artifact generation and product surface verification.
- `03-stories`: PRD + design -> user stories, scopes, action bindings.
- `04-setup-repo`: scaffold, repo, DB, initial contracts.
- `05-setup-build`: dependency install, baseline build, stitch-to-jsx, setup certificate.
- `06-implement`: story implementation, scope enforcement, build/test/evidence gates.
- `07-verify`: PR/review/merge verification.
- `08-security-gate`: security checks.
- `09-qa-test`: QA report, smoke/browser QA, QA-FIX routing.
- `10-final-test`: final smoke/runtime parity.
- `11-deploy`: local service/project registration/deploy.
- `12-supervise`: product supervisor pass/block.
- `registry.ts`, `types.ts`: step module registry and StepModule contract.

## Stack Contracts

- `src/installer/stack-contract/types.ts`: stack pack interfaces.
- `src/installer/stack-contract/packs.ts`: concrete stack pack definitions.
- `src/installer/stack-contract/context.ts`: stack context injection.
- `src/installer/stack-contract/validators.ts`: stack contract validation.
- `src/installer/stack-contract/reconcile.ts`: reconcile stack decisions with repo.
- `src/installer/stack-contract/detector.ts`: stack detection.
- `src/installer/stack-contract/ledger.ts`: stack state/evidence ledger.

## Evidence And Runtime

- `src/installer/runtime-driver.ts`: universal runtime driver interface.
- `src/installer/web-runtime-driver.ts`: browser/Vite preview runtime driver.
- `src/installer/runtime-ports.ts`: deterministic MC-owned ports.
- `src/installer/implement-evidence.ts`: artifact paths and validation.
- `src/installer/implement-evidence-runner.ts`: orchestrator-owned runtime execution/evidence.
- `src/installer/implement-evidence-writer.ts`: evidence JSON writer.
- `src/installer/stack-evidence.ts`: stack evidence capabilities.
- `src/installer/smoke-gate.ts`: smoke gate orchestration.
- `scripts/smoke-test.mjs`: browser/app smoke analysis.

## Design And Generated Screen Tooling

- `scripts/stitch-to-jsx.mjs`: strict Stitch HTML -> React compiler.
- `scripts/generated-screen-validator.mjs`: SCREEN_MAP/UI_CONTRACT/DESIGN_DOM/generated file validation.
- `scripts/design-dom-extract.mjs`: DOM metadata extraction.
- `scripts/stitch-api.mjs`, `scripts/stitch-download.sh`: Stitch API integration.
- `src/installer/design-contract.ts`: design contract helpers.
- `src/installer/design-rules.ts`: design rules.
- `src/installer/static-analysis.ts`: static source checks.

## Supervisor

- `src/installer/product-supervisor.ts`: durable product supervisor memory and product checks.
- `src/installer/supervisor/checklist.ts`: deterministic checklist rules.
- `src/installer/supervisor/scanner.ts`: source/DOM scanner.
- `src/installer/supervisor/visual-qa.ts`: visual QA layer.
- `src/installer/supervisor/fixer.ts`: supervisor repair support.
- `src/installer/supervisor/coordinator.ts`: supervisor orchestration.
- `src/installer/supervisor/intervention.ts`: intervention model.
- `src/installer/supervisor/ledger.ts`: supervisor ledger.
- `src/installer/supervisor/state.ts`: supervisor state.
- `src/installer/supervisor/types.ts`: shared supervisor types.
- `src/installer/supervisor/model-policy.ts`: model selection/policy.
- `src/installer/supervisor/run-supervisor.ts`: runner.

## Platform Self-Heal

- `src/installer/platform-self-heal/config.ts`: env controls.
- `src/installer/platform-self-heal/classifier.ts`: failure classification.
- `src/installer/platform-self-heal/known-patterns.ts` and `.json`: known failure signatures.
- `src/installer/platform-self-heal/ownership-map.ts`: patchable file ownership.
- `src/installer/platform-self-heal/patch-contract.ts`: patch plan validation.
- `src/installer/platform-self-heal/runner.ts`: self-heal runner.
- `src/installer/platform-self-heal/rollback.ts`: rollback support.
- `src/installer/platform-self-heal/patch-registry.ts`: cross-run patch registry.
- `src/installer/platform-self-heal/strictness-delta.ts`: relaxed assertion detection.
- `src/installer/platform-self-heal/write-interceptor.ts`: write safety.
- `src/installer/platform-self-heal/workspace.ts`: patch workspace helpers.
- `src/installer/platform-self-heal/types.ts`: shared types.

## Git, Repo, Worktrees

- `src/installer/repo.ts`: repo/GitHub operations.
- `src/installer/worktree-ops.ts`: story worktree management.
- `src/installer/story-scope.ts`: scope files and ownership.
- `src/installer/merge-queue-ops.ts`: merge queue helpers.
- `src/installer/pr-state.ts`: PR state parsing.
- `src/installer/steps/07-verify/pr-comments.ts`: GitHub PR comments/reviews.

## Mission Control

- `src/server/daemon.ts`: server daemon.
- `src/server/dashboard.ts`: API + projects/runs/observations endpoints.
- `src/server/index.html`: Mission Control UI.
- `src/server/spawnerctl.ts`: spawner control.
- `src/server/daemonctl.ts`: daemon control.
- `src/server/supervisor-summary.ts`: supervisor summary projection.

## Workflows And Agents

- `workflows/feature-dev/workflow.yml`: main product generation pipeline.
- `workflows/feature-dev/agents/*`: planner, designer, developer, reviewer, supervisor, QA, security, deployer identities.
- `workflows/bug-fix`, `security-audit`, `ui-refactor`, `daily-standup`: secondary workflows.
- `agents/shared/*`: shared agent instructions.

## Tests

- `tests/steps/*.test.ts`: step module tests.
- `tests/*`: orchestration, guard, self-heal, evidence, supervisor, runtime tests.
- `scripts/__tests__/*.test.js`: script-level tests.
- `tests/platform-invariants/*`: immutable-style platform invariant tests.

