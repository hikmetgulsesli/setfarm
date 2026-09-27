# Task6A held diagnostic receipt protocol

**Goal:** Fail closed on inconsistent physical/source/DB candidate inputs while keeping every output explicitly diagnostic and unpublished. This prepares a testable call order for a later code-owned, durable producer; it is not that producer.

## Boundary and design

- Existing held physical catalog and active attempt/session join are diagnostic; their source-build provenance is `unverified`, and the canonical receipt candidate is `required-unpublished`. A path-only join cannot name a real owner.
- Add a pure, injected-port coordinator. The trusted physical hold must enclose one read-only DB transaction callback and two source observations. Require exactly one physical callback and DB callback; match source SHA/tree and physical root/Git-primary identity before returning a canonical candidate. Any rejection or cleanup failure yields no result. Raw fence token is consumed only to derive its commitment and never returned or logged.
- The DB port must supply exactly one active attempt and session for an exact claim/attempt/root; terminal, duplicate, missing or crossed rows refuse. The physical port remains responsible for descriptor/path stability through callback exit. Because these are injected ports, this result remains `diagnostic-only` and cannot be elevated to ownership by itself.
- No schema, historical migration, live DB grant, credential, selected CLI, service, or worktree mutation. Retained development/deployment worktrees remain visible but are not owners merely by being present.

## File map and TDD

- `src/internal-production/baseline-positive-worktree-receipt-protocol-v1.ts`: diagnostic coordinator, exact input validation, no authority status upgrade.
- `tests/internal-production/baseline-positive-worktree-receipt-protocol-v1.test.ts`: RED then GREEN for order, single invocation, source drift, exact row crossing, terminal/duplicates, no raw fence in output, callback/cleanup failure, no observable writes.
- Focused tests, TypeScript, source manifest/digests, independent read-only review, exact-head PR, clean-main build/test.

Actual physical-source authentication, immutable PostgreSQL receipt publication, crash/retry/no-replace semantics, continuous DB/OS writer exclusion and guarded 32/33 remain separate hard gates.

## Recorded result before delivery

- RED: the new protocol test failed because no coordinating module existed.
- GREEN: one held physical callback encloses two source observations, one single-row DB callback and an end physical tuple recheck; crossed, terminal, missing, duplicate and drifted evidence refuses. Raw fence is absent from the frozen candidate. Physical/DB cleanup refusal returns no candidate.
- Focused protocol 4/4, adjacent binding/held-candidate/physical-catalog 54/54, TypeScript, source manifest 18/18, migration digests, and diff check passed. Independent read-only review found no Medium+ issue; it emphasized that injected ports are not producer authentication. Exact-head PR and clean-main checks pending.
