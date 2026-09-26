# Task6A V2 direct CLI peek refusal design

## Decision

The merged V2 pre-schema check covers ordinary spawner startup, new spawns,
and direct CLI `step claim`. Direct CLI `step peek` is another writer entry:
`peekStep()` can unlink stale output and call `completeStep()` for orphaned
output before it reaches its COUNT query. If a fixed current-entry operation
appears after CLI startup, peek must sample the same refusal before these
effects or any `HAS_WORK`/`NO_WORK` response.

Await the existing no-write `assertTask6aPreSchemaOrdinaryStartupV2()`
immediately before `peekStep(target, callerAgent)` in the direct CLI route.
Absent operation or an exact through-33 journal continues to unchanged peek
behavior. Present operation without that journal refuses with the existing
fixed code and top-level sanitized error handling. Do not change the shared
`peekStep()` library, recovery semantics, operation observer, migration or
live service. Other callers and already-running sessions remain separate
gaps; this is sampled refusal, not continuous exclusion or cutover authority.

## File Map and verification

- `src/cli/cli.ts`: await the existing V2 check immediately before direct
  `step peek` enters the potentially mutating library call.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  extract the actual CLI AST, prove refusal precedes peek and output, and
  exercise refusal and pass-through effect ordering.
- `docs/superpowers/plans/2026-09-26-task6a-v2-direct-cli-peek-refusal.md`:
  RED/GREEN and delivery sequence.

Verify focused, pure and cutover tests, TypeScript and source contracts;
obtain independent read-only review before scoped PR delivery. Preserve all
existing development, historical and deployment worktrees. Root writes alone.
