# Setup-Build Failure Authority v3 Design

## Problem

Clean convergence run `bcf8aa39-54fb-4c89-9576-d7a07fee7dce`
reached the v3 setup-build packet compiler and correctly rejected an invalid
`ImplementationSourceMapV1`. The compiler emitted
`SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED`, with exact subordinate
diagnostics for observable identity and source ownership mismatches.

The current runtime and PostgreSQL operational-failure authority is version 2.
Its immutable version-1 setup-packet binding predates three current
`SetupBuildPacketErrorCode` members:

- `SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED`
- `SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED`
- `SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED`

Version 2 adds only the DESIGN semantic-closure tuple. It therefore rejects the
setup-build termination with
`RUN_TERMINATION_FAILURE_CAUSE_AUTHORITY_INVALID:PRODUCER_TUPLE_UNAUTHORIZED`.
The claim/runtime lifecycle then fails closed before it can publish the terminal
request. The spawner repeatedly reacquired the unchanged setup-build work, which
produced 297 identical blocked observations over roughly ten hours.

The generated project is evidence, not a repair target. The platform must
authorize its current producer vocabulary and terminalize the first exact
contract rejection without sending unchanged source back through another model
claim.

## Decision

Add immutable operational-failure authority version 3 and contract-spine
migration 31. Version 3 is version 2 plus one exact setup-build binding that
contains only the three missing current packet codes. Version 1, version 2,
migrations 21 and 30, and every historical semantic digest remain unchanged.

The setup-build preclaim owns a compile-time-exhaustive mapping from every
`SetupBuildPacketErrorCode` to its operational failure code. All values preserve
the specific producer code except
`SETUP_PACKET_SEMANTICS_VERSION_MISMATCH`, which retains the existing deliberate
alias to `SETUP_PACKET_PROTOCOL_MISMATCH`. A runtime test evaluates every mapped
cause through authority v3. Adding a future packet code without updating the map
must fail TypeScript compilation; mapping a code to an unauthorized tuple must
fail the authority test.

Do not add a fallback that silently drops `operationalFailureCause`, weakens the
database constraint, or converts all packet rejections to a generic protocol
error. The existing terminal preclaim lifecycle is correct once runtime and SQL
share the same vocabulary: it closes the one claim, writes one termination
request, leaves no completion runtime, and refuses a second claim.

## Runtime Contract

Create `operational-failure-cause-authority-v3.ts` as the current authority
surface. It exports the frozen v3 bindings, runtime evaluators, and SQL predicate
builders. Existing v1 and v2 tuples continue to delegate to their historical
evaluators and evidence rules. The new binding is exact:

- requester: `setfarm.step-fail.single`
- workflow step: `setup-build`
- boundary: `product_compiler.setup_build_packet`
- class: `contract_invalid`
- codes: the three missing codes listed above

One-field mutations, unknown requesters, extra cause fields, and unregistered
codes remain rejected. Current consumers in run termination, convergence
evaluation, and operational snapshots move from v2 to v3. Historical tests keep
the v1 and v2 registry identities pinned.

## Database Contract

Migration 31 replaces only
`run_termination_requests_operational_failure_cause_check` with the exact v3
expression. It follows migration 30's fenced detect, verify, canonical-expression,
adoption, audit, rollback, and error-factory patterns. It upgrades only an exact
validated v2 predecessor, rejects partial or drifted constraints, and remains
idempotent after a committed application.

The contract-spine registry, semantic source manifest, generated digest map,
current-head audit, rollback contract, CLI migration tests, and all tests that
pin the supported head advance from 30 to 31. Migration 31's source digest binds
the v1, v2, and v3 authority sources plus its dedicated migration module. No
historical digest or migration region changes.

Live database mutation is forbidden on the feature branch. After review and
merge, clean canonical `main` must apply and verify migration 31 through the
official contract-spine CLI under a fresh zero-owner census.

## Failure and Recovery Semantics

For an exact setup-build packet rejection:

1. preclaim records one blocked observation containing the specific packet code;
2. preclaim throws `OperationalFailureCauseError` with the exact v3 tuple;
3. `terminalizeV3PlatformPreclaim` closes the one claim and requests failed run
   termination through the v3 runtime and SQL authorities;
4. no completion request or model runtime is created;
5. a subsequent claim attempt returns no work.

If migration 31 is absent or drifted, startup and migration verification remain
fail closed. The implementation does not introduce an untyped retry or a
cause-dropping fallback. Deployment ordering prevents new runtime bytes from
starting against the old constraint.

## Testing

Test-driven implementation must prove:

- RED: v2 rejects each of the three new tuples and the first live tuple cannot
  be inserted through the current constraint;
- GREEN: v3 accepts only the exact three tuples and preserves every v1/v2
  authority;
- the exhaustive setup-packet map covers the full current error-code union and
  every mapped cause is v3-authorized;
- migration 31 upgrades exact v30, survives response loss/reapply, rejects
  partial/drifted adoption, and keeps historical digests unchanged;
- a terminal platform preclaim using
  `SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED` produces one failed claim and
  one termination request, zero completion requests, and no second claim;
- current audit, rollback, migration CLI, source-integrity, TypeScript, and
  focused execution-attempt tests pass.

The clean-main proof then applies/verifies migration 31, rebuilds and restarts
Setfarm under zero owners, and launches a new clean canary followed by the golden
convergence matrix. The polluted run and generated repository are not resumed.

## Scope

This root fix is causally required by the active internal-production closure
goal. It includes runtime authority, exhaustive setup-packet mapping, migration
31, tests, reviewed PR delivery, clean-main rollout, and fresh convergence
evidence. It excludes generated-project rescue, unrelated failure taxonomies,
Mission Control feature work, and external signing/notarization/distribution.
