# Operational Retry Authority Design

Date: 2026-07-15

Status: accepted implementation slice of the Product Compiler v3 architecture

## Problem and evidence

Clean canary run `26f5a921-22ab-4b51-a64f-74ef127eedf3` reached IMPLEMENT on
release `c5e6ad9a345857bbd96e9b3ff46a2bfbc32146dc`. Claims 5429 through 5432
reserved four `product_implementation` attempts against the same packet,
implementation slice, and source revision. The compiler handoff reported
`writeAuthority.mode=initial` and carried no recovery authority on every
attempt. MiniMax M3 was selected every time.

The failures were operational, not new product requirements: no model-produced
delta, a real out-of-scope write, and a masked advisory test command. The
spawner closed each claim, erased the guarded worktree, stored prose in
`stories.output`, and exposed the story as pending. Product Compiler v3 ignores
that legacy prose by design, so the next reservation was indistinguishable from
an initial product attempt. This is the proven unchanged-source redispatch
loop.

`MASKED_CHECK_COMMAND` also ran at the wrong authority layer. Native v3 owns the
candidate commit and subsequently executes the canonical EvidenceBundleV2
plan. Killing the model and deleting valid source merely because the model
filtered its own advisory terminal output destroys useful delta without adding
evidence authority.

## Decision

Introduce one strict, hash-bound `setfarm.operational-retry-directive.v1`.
Runtime guards may request exactly one infrastructure retry only by producing
this directive. The directive binds the previous claim and attempt, exact
packet, exact slice, reset source revision, generic platform failure code,
immutable diagnostic hash, allowed paths, expected delta, retry budget, and an
explicit fallback execution profile.

The next Product Compiler reservation must prove every binding before it can
reserve an `infrastructure_retry` attempt. The directive is handed to the model
inside `setfarm.implementation-context.v3`; raw story output and guard prose do
not become product authority. OpenClaw receives the exact model from the
handoff. The platform defaults are MiniMax M3 for an initial implementation and
Kimi for the one bounded operational fallback.

An operational retry cannot recursively mint another operational retry. A
second runtime failure is terminalized as platform-owned exhausted operational
recovery; the same unchanged source is never blindly sent to the same fallback
again. Product FindingSet recovery remains owned by the existing bounded
implementation/supervisor chain.

For native v3, `MASKED_CHECK_COMMAND` becomes a deduplicated non-authoritative
observation. Legacy behavior remains unchanged. Setfarm-owned canonical build,
test, runtime, interaction, and visual evidence remains blocking, so this does
not weaken a gate.

## Versioned contracts

### `setfarm.operational-retry-directive.v1`

- `directiveHash`: SHA-256 of the canonical directive without this field.
- run, workflow step, and story identities.
- `priorAttempt`: claim ID, attempt ID/generation/class, packet/slice hashes,
  exact source-before revision, and terminal disposition.
- `failure`: generic platform error code, bounded diagnostic, and its canonical
  evidence hash.
- `nextSourceRevision`: the exact clean revision to which the guarded worktree
  is reset.
- `expectedDelta`: bounded source implementation, canonical allowed paths,
  required source delta, and `setfarm` as evidence owner.
- `retryBudget`: ordinal 1 of limit 1.
- `executionProfile`: fallback provider/model selected by the platform.

### `setfarm.v3-implementation-claim-handoff.v1`

Adds an always-present execution profile and an optional operational retry.
`infrastructure_retry` is valid only when the exact directive is present;
product and FindingSet recovery attempts reject it. Write authority mode becomes
`operational_retry`, with paths required to equal both the compiled slice and
the directive.

## Lifecycle

1. A fatal runtime guard identifies one generic platform code from its canonical
   diagnostic prefix.
2. The spawner loads the active v3 attempt and exact compiled slice.
3. While the drained previous claim/attempt still blocks new ownership, Setfarm
   removes its guarded worktree, resets the story ref to the exact source-before
   commit, and verifies both facts. A reset mismatch publishes no retry state.
4. One PostgreSQL transaction then terminalizes the exact claim/attempt and CAS
   publishes the story's pending directive plus the step transition. If either
   visible state CAS fails, the claim and attempt closure rolls back too.
5. The spawner records the hash-bound directive as a canonical observation.
6. The next claim strict-parses the directive. Malformed lookalikes fail closed.
7. The compiler validates the previous terminal attempt and exact
   run/workflow-step/story/packet/slice/source/path bindings. The attempt
   repository then enforces, under its per-story advisory transaction lock,
   that this exact attempt is still the latest terminal predecessor before it
   reserves the next consecutive generation as `infrastructure_retry`.
8. The handoff selects `kimi/kimi-for-coding`; OpenClaw receives that exact
   model using `--model`.
9. Setfarm commits candidate source and executes canonical evidence. A further
   runtime-guard failure atomically closes the retry, fails the story, and parks
   the step instead of redispatching.

## Compatibility and rollback

Legacy and shadow runs retain their current prose retry and fatal masked-check
behavior. Existing v3 stories without the exact schema continue as initial
product attempts. Rollback is a code rollback: no database migration or manual
row rewrite is required. Pending directives remain self-identifying JSON and
will not be interpreted by the rolled-back runtime.

## Required proof

- schema/hash/canonical-order unit tests;
- handoff identity and authority rejection tests;
- attempt compiler tests for exact previous-terminal binding and mismatches;
- spawner regression tests for typed persistence, one-retry exhaustion,
  OpenClaw model override, and v3 masked-check observation-only behavior;
- focused suites, full build, and full tests;
- exact-SHA release attestation and clean multi-class convergence canaries.
