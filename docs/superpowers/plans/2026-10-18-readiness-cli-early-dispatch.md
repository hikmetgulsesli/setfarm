# Readiness CLI Early Dispatch Implementation Plan

> **For agentic workers:** Execute this bounded task inline as the sole writer;
> use independent read-only reviewers before delivery. Do not delegate edits.

**Goal:** Run the existing exact readiness diagnostic without evaluating ordinary
CLI business dependencies first.

**Architecture:** Preserve the initial ordinary-entry fence. Move the existing
diagnostic handler ahead of fixed business imports and retain the normal CLI in
the alternate branch. Keep its observation/error/output contract unchanged.

**Tech Stack:** TypeScript ESM, Node.js test runner and module resolver hooks.

**Spec:** `docs/superpowers/specs/2026-10-18-readiness-cli-early-dispatch-design.md`

## Global Constraints

- No new dependency, environment override, command option, or runtime authority.
- All non-exact arguments retain the initial refusal and ordinary runtime guard.
- No guard bypass; build only from clean main equal to origin/main.
- Fixture diagnostics stop at dependency resolution; no live readiness commands.
- Native/initial-TCB, OS/DB32/33, protected startup and actual run remain separate.

## Task 1: Isolate the existing diagnostic entry

**Files:** Modify `src/cli/cli.ts` and
`scripts/__tests__/deployment-cutover-cli-entry-v4.test.js`. The specification's
File Map is authoritative for scope.

**Interfaces:** Consume the exact three-token argv and the existing observer and
canonical encoder. Produce unchanged JSON/exit2 or fixed error/exit1, with zero
ordinary business resolutions/evaluations on the exact diagnostic path.

- [x] Extend `runCli` to record only the two fixed diagnostic module resolutions
  and refuse them with `DIAGNOSTIC_DEPENDENCY_BOUNDARY`. Leave ordinary business
  resolution/evaluation cutpoints intact.
- [x] Replace the old exact-argv dependency test with OPEN/absent and
  resolve/evaluate cases. Assert zero business effects, a diagnostic resolution,
  empty stdout, exit1 and `PLATFORM_RELEASE_PREFLIGHT_OBSERVATION_FAILED\n`.
- [x] Run `node --test --test-name-pattern='exact diagnostic dispatch'
  scripts/__tests__/deployment-cutover-cli-entry-v4.test.js`. Verify genuine RED:
  current code resolves a business dependency before either diagnostic module.
- [x] Relocate the existing diagnostic handler after the initial fence, wrap the
  ordinary import/body section in its `else`, and remove the duplicate branch in
  `main`. Preserve the diagnostic handler byte-for-byte except its predicate,
  indentation and removal of the function-only `return`.
- [x] Update static closure inspection to inspect the ordinary `else` block;
  retain 31 literal imports after the fence. Explicitly update the tail hash for
  removal of the old duplicate branch and the added closing brace only.
- [x] Run the focused regression, then the complete v4 fixture file and applicable
  version/English/path contracts. Capture original terminal results. Do not run
  wildcard tests that include owner-closed PM2 or live diagnostic commands.
- [ ] Request independent read-only whole-diff review; resolve concrete findings.
  Commit only the four File Map paths on the scoped branch, push, and use normal
  SHA-bound reviewed PR delivery. Preserve previous branches and build evidence.
- [ ] After normal merge, synchronize this same writer with ff-only main and run
  the default build. Qualify the resulting artifacts before any separately
  admitted non-authoritative diagnostic or startup action. Update continuity
  records with exact results and remaining limits before yielding.
