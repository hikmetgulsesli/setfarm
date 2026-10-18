# Dispatch readiness diagnostics before business imports

## Problem and scope

The exact `platform-release preflight --json` command has an existing,
non-authoritative exception from the initial deployment-cutover refusal. However,
`src/cli/cli.ts` currently imports ordinary business modules before entering that
diagnostic branch. In particular, importing `runtime-config` immediately reads
ambient environment files and changes the process environment. Diagnostic-only
execution must not acquire those unrelated initializer effects.

This is a Setfarm CLI root fix causally required for the existing Task6A startup
investigation. Standing owner authorization covers this reversible source change
and normal reviewed delivery. It does not admit protected startup, native probes,
credential changes, service changes, or a live workflow run.

## Design

Keep the existing initial `!exactEntryDiagnostic` refusal unchanged. Immediately
after it, dispatch the exact diagnostic through its existing observer and
canonical encoder. Put ordinary business imports and the existing CLI body in
the alternate branch. Remove the now-unreachable duplicate diagnostic branch
from `main`. The successful observation remains newline-terminated JSON and exit
code 2; observation failures remain the fixed public error and exit code 1.
All non-exact arguments retain the initial refusal and ordinary runtime guard.

A separate diagnostic entry module would add an unnecessary public/module
boundary. Moving environment loading alone would leave other business
initializers reachable. The early branch isolates the whole dependency set with
the smallest change and leaves the observer's own behavior unchanged.

## File Map

- `src/cli/cli.ts`: isolate the existing exact diagnostic before business imports.
- `scripts/__tests__/deployment-cutover-cli-entry-v4.test.js`: execute the genuine
  transpiled CLI and initial refusal against controlled dependency boundaries;
  distinguish diagnostic resolution from business resolution/evaluation.
- This specification and its paired implementation plan: record causal scope,
  verification, and explicit limits.

## Verification and constraints

- Add the behavioral regression before changing production code. A business
  resolution/evaluation before exact diagnostic dispatch must fail the test.
- Test initial OPEN and absent workspace states, at resolution and evaluation
  cutpoints. Retain ordinary, malformed, near-miss, and late-OPEN cases.
- Diagnostic dependencies stop at a controlled resolver boundary: these fixture
  tests execute no system readiness commands and fabricate no diagnostic receipt.
- Preserve the fixed static runtime closure and 31 literal business imports.
  Update the old body hash only for the explicitly reviewed relocation/removal.
- Run focused script tests and applicable source contracts. Run the ordinary
  build only from a clean, reviewed main equal to origin/main, as required by the
  existing build guard. Never set a guard-bypass environment variable.
- No new dependency, environment override, command option, or runtime authority.
- Passing these tests does not qualify native/initial-TCB, OS/DB32/33, protected
  startup, port3333, or an actual Setfarm workflow run.
