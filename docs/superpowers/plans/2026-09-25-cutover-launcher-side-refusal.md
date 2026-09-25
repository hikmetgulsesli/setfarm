# Cutover Launcher-Side Refusal Plan

Status: implementation in progress. This is a cooperative-entry safety fix,
not a live cutover controller or proof of global writer exclusion.

## Causal relation

The approved preserved deployment cutover requires every ordinary spawner start
from the selected new CLI to refuse while the fixed-root cutover intent is open.
The child spawner already refuses before its singleton/PID publication, but
`startSpawner()` first calls `isSpawnerRunning()`. That helper may unlink a stale
PID file or create one from a process listing before the child can refuse. The
launcher therefore needs its own fixed-root refusal at function entry, ahead of
the explicit runtime-env call and any PID/log/process side effect. The static
`runtime-config` import already performs module-load environment setup before
`startSpawner()` is called, so this slice does not claim to fence that preload
or every CLI module import. This does not change
direct/cold authenticated startup, a running spawner loop, raw SQL writers, or
the pre-32 migration boundary. The entry check is point-in-time; it is not an
atomic exclusion against a concurrent intent publication. The future controller
must still hold exact launcher/process exclusion and reobserve before effects.
The CLI also calls `isSpawnerRunning()` before `startSpawner()` in install and
workflow-run flows, and restart stops the old spawner before starting the new
one; all three paths need the same early refusal.
Creation-like CLI commands must also refuse before their own install, symlink,
cron, run or resume effects rather than reaching the launcher guard afterward.
Ordinary update and global/workflow uninstall can rewrite the selected
CLI/deployment or remove services/workflows, so they also refuse at entry;
this guard is not bypassed by
their unrelated `--force` option. Cutover controller effects remain separately
authenticated.

## File Map

- `src/server/spawnerctl.ts`: call the existing refusal-only fixed-root observer
  at the start of `startSpawner()`, before `isSpawnerRunning()`.
- `src/cli/cli.ts`: call the same observer before the install/run PID prechecks
  and before the restart stop effect. Guard ordinary update, global/workflow
  uninstall/install, run, resume and ensure-crons at branch entry before
  their own effects. The core `startSpawner()` recheck remains.
- `tests/internal-production/baseline-deployment-cutover-launcher-start-v1.test.ts`:
  real copied controller fixture with an open-intent refusal stub and stale PID
  file; assert no unlink, rewrite, log, explicit runtime-env call or
  process-list side effect.
  Absence permits the preexisting path unchanged. The fixture explicitly
  records the preexisting runtime-config module preload, distinct from the
  guarded explicit runtime-env call. Source-order regressions check CLI
  pre-effect sites without loading the full CLI command
  graph into the fixture.
- `tests/internal-production/baseline-service-restart-helper-v1.test.ts`: its
  copied controller fixture must include a minimal observer stub so the existing
  detached-daemon adoption test still tests the same path.
The existing `baseline-deployment-cutover-*.test.ts` cutover-suite glob already
includes the new regression; no package-script change is needed.

## Verification

RED showed an open intent still reached `ps`, stale PID removal and explicit
runtime-env loading. A second RED caught unguarded CLI prechecks and a third
RED caught update/uninstall entry effects; a final RED caught workflow
uninstall. GREEN focused tests passed 4/4;
the existing detached-daemon adoption test and two spawner-gateway wiring
tests passed. TypeScript no-emit, English/path contracts, and the full cutover
suite 389/389 passed. Independent read-only review found the upstream CLI
prechecks, restart-stop, update and workflow-uninstall gaps, which this diff
now closes; its final pass found no blocker. PR,
clean-main build and host recheck remain pending. No guard bypass, historical
dist replacement, service action, or worktree cleanup.
