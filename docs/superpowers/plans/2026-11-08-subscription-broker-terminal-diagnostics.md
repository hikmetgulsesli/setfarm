# Subscription broker terminal diagnostics implementation plan

> **For agentic workers:** Execute the single bounded task below in the existing sole writer; request an independent review before delivery.

**Goal:** Preserve the validated broker refusal code needed to diagnose the actual Kimi supervisor failure.

**Architecture / spec:** The joint runtime owner already receives an original broker receipt, validates its bounded scalar fields, and uses its closure reason. Record only its validated terminal code, counters, and the existing claim/runtime/model identifiers in the service diagnostic log before continuing the same closure path. Logging failure must not affect custody or closure. No response body, request body, credential, capability, prompt, or fence token is logged.

**Tech stack:** Existing TypeScript runtime owner, Node test runner and tsx.

## Observed cause and scope

On Source `f7cc542f`, run `a17aaf98-62d5-4497-8df3-6ecc87ae96ab` produced a verified MiniMax fallback implementation with eight passing predicates. Kimi implementation claim 13 and supervisor claims 15–18 instead ended with original exit 97, zero stdout bytes and complete streams. The SDK report decoder therefore reports a generic refusal. The runtime owner currently discards the original broker's validated `terminalCode` and counters, preventing classification of quota, request, response or transport failures. Root normally stopped the spawner after the repeated supervisor failures; the generated source and records remain intact.

The SDK thinking-policy hypothesis is unproven and is not an implementation change. A read-only account usage query returned HTTP 200 and remaining weekly quota; that does not establish the original broker failure. This diagnostic change is causally necessary to distinguish the actual failure before any provider behavior fix.

## Global constraints

- Keep the 8192 output-token cap, retry policy, tool scope, provider selection and all runtime guards unchanged.
- Keep receipt/journal schemas and immutable installation material unchanged.
- Use the existing sole writer. Preserve canonical HEAD and `origin/main` at `2c139a54`; fetch exact objects without updating those refs.
- Do not edit generated application or retained runtime files, replay failed claims, or call a provider from unit tests.

## File map

- `src/execution/subscription-coding-runtime-v1.ts`: emit the existing validated broker refusal metadata without changing closure semantics.
- `tests/execution-attempts/subscription-coding-runtime-v1.test.ts`: exercise real owner callbacks using the existing owned-handle fixture; catch lost diagnostics and logging failures that could interrupt closure.
- This plan: record the actual causal relation and verification scope.

## Task 1: Retain the original refusal diagnostic

Consumes the existing `SubscriptionAttemptBrokerReceiptV1` from `broker.closed`; produces a `SUBSCRIPTION_BROKER_TERMINAL` service-log record only for non-null terminal codes. No new API or schema.

- [x] Add a test that resolves the original broker receipt with `reason: 'refused'`, `terminalCode: 'QUOTA'`, and literal counters; verify the emitted metadata identifies the runtime and that both resources still close normally.
- [x] Run `node --import tsx --test tests/execution-attempts/subscription-coding-runtime-v1.test.ts`; expect the diagnostic assertion to fail before production edits.
- [x] After receipt validation, emit only `{runtimeSessionId, claimId, modelRef, reason, terminalCode, acceptedRequests, responseBytes, redactions}` with the fixed log prefix. Isolate the logger in its own `try/catch`; preserve the existing broker-state, latch, stop and ready operations.
- [x] Add coverage that a throwing logger cannot change original closure or broker-before-worker revocation.
- [ ] Run the focused owner/binding tests, TypeScript no-emit check and `git diff --check`; obtain an independent review.
- [ ] Root delivers the scoped branch/PR after exact-head review and required checks. Build clean merged Source through the stock build before any rollout. A unit pass is not a Kimi fix or deployed-game pass.

## Verification limits

This change closes an observed diagnostic gap. The actual Kimi broker terminal code still requires a genuine maintained operational observation after reviewed delivery. Supervisor, VERIFY, final acceptance, deployment and Mission Control acknowledgement remain incomplete for the retained game.

Root verification: original RED process 26291 exited 1 on the missing diagnostic (14 passed, one failed); focused owner/binding GREEN process 26383 exited 0 (27 passed, no skips); TypeScript no-emit process 26384 and diff check 26385 exited 0. Independent review and clean stock build remain required before delivery/rollout claims.
