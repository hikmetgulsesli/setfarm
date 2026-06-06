# Source Attachment Manifest

Bu dosya Gemini/Sonnet daha fazla kanıt isterse hangi orijinal kaynak dosyalarının ekleneceğini listeler. Hepsini birden eklemek şart değildir.

## Priority 1: Core Architecture

- `package.json`
- `AGENTS.md`
- `workflows/feature-dev/workflow.yml`
- `src/installer/steps/registry.ts`
- `src/installer/steps/types.ts`
- `src/installer/step-ops.ts`
- `src/spawner.ts`
- `src/spawner-prompt.ts`
- `src/db-pg.ts`

## Priority 2: Evidence And Runtime

- `src/installer/runtime-driver.ts`
- `src/installer/web-runtime-driver.ts`
- `src/installer/runtime-ports.ts`
- `src/installer/implement-evidence.ts`
- `src/installer/implement-evidence-runner.ts`
- `src/installer/implement-evidence-writer.ts`
- `src/installer/stack-evidence.ts`
- `src/installer/smoke-gate.ts`
- `scripts/smoke-test.mjs`

## Priority 3: Design And Generated Screens

- `scripts/stitch-to-jsx.mjs`
- `scripts/generated-screen-validator.mjs`
- `scripts/design-dom-extract.mjs`
- `src/installer/design-contract.ts`
- `src/installer/design-rules.ts`
- `src/installer/steps/02-design/preclaim.ts`
- `src/installer/steps/05-setup-build/preclaim.ts`
- `src/installer/steps/05-setup-build/guards.ts`

## Priority 4: Supervisor

- `src/installer/product-supervisor.ts`
- `src/installer/supervisor/checklist.ts`
- `src/installer/supervisor/scanner.ts`
- `src/installer/supervisor/visual-qa.ts`
- `src/installer/supervisor/fixer.ts`
- `src/installer/supervisor/coordinator.ts`
- `src/installer/supervisor/intervention.ts`
- `src/installer/supervisor/types.ts`

## Priority 5: Platform Self-Heal

- `src/installer/platform-self-heal/config.ts`
- `src/installer/platform-self-heal/classifier.ts`
- `src/installer/platform-self-heal/known-patterns.ts`
- `src/installer/platform-self-heal/known-failure-patterns.json`
- `src/installer/platform-self-heal/ownership-map.ts`
- `src/installer/platform-self-heal/patch-contract.ts`
- `src/installer/platform-self-heal/runner.ts`
- `src/installer/platform-self-heal/rollback.ts`
- `src/installer/platform-self-heal/patch-registry.ts`
- `src/installer/platform-self-heal/strictness-delta.ts`
- `src/installer/platform-self-heal/write-interceptor.ts`

## Priority 6: Mission Control

- `src/server/daemon.ts`
- `src/server/dashboard.ts`
- `src/server/index.html`
- `src/server/spawnerctl.ts`
- `src/server/supervisor-summary.ts`
- `src/installer/observations.ts`
- `src/installer/operation-observability.ts`
- `src/installer/events.ts`

## Priority 7: Step Rules And Prompts

If the reviewer needs exact agent instructions, attach:

- `src/installer/steps/01-plan/prompt.md`
- `src/installer/steps/01-plan/rules.md`
- `src/installer/steps/02-design/prompt.md`
- `src/installer/steps/03-stories/prompt.md`
- `src/installer/steps/06-implement/prompt.md`
- `src/installer/steps/06-implement/rules.md`
- `src/installer/steps/07-verify/prompt.md`
- `src/installer/steps/09-qa-test/prompt.md`
- `src/installer/steps/10-final-test/prompt.md`
- `src/installer/steps/12-supervise/prompt.md`

## Priority 8: Tests

Attach tests when reviewer asks "what is already enforced?"

- `tests/implement-evidence.test.ts`
- `tests/implement-evidence-runner.test.ts`
- `tests/web-runtime-driver.test.ts`
- `tests/platform-self-heal.test.ts`
- `tests/spawner-gateway-recovery.test.ts`
- `tests/spawner-prompt.test.ts`
- `tests/generated-screen-validator.test.ts`
- `tests/stitch-to-jsx.test.ts`
- `tests/smoke-gate.test.ts`
- `tests/steps/06-implement.test.ts`
- `tests/steps/07-verify.test.ts`
- `tests/steps/09-qa-test.test.ts`
- `tests/steps/10-final-test.test.ts`

## Do Not Attach

- `.env`
- `~/.openclaw/setfarm/.env.local`
- API keys or tokens
- generated project `node_modules`
- raw browser/session transcripts unless manually redacted
- database dumps with secrets

