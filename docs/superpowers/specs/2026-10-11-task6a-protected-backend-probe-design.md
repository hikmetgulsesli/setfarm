# Task6A Closed Protected Backend Probe Design

The existing fixed socket holder has no production consumer. Compose it with
the existing one-attempt client without publishing a pool, capability or result.
Root remains sole writer; parallel agents investigate and review read-only.
Standing owner authorization covers this causally required source refinement.

## Chosen boundary

`probeTask6aProtectedPostgresBackendV1(): Promise<void>` is import-inert and
accepts no arguments. Extra arguments and overlapping entries refuse before
inspecting input or allocating resources. Acquire only
`holdTask6aProtectedPostgresSocketV1()`, read its fixed descriptor, then create
one lazy single-backend client. No caller transport, SQL, callback, URL, raw
client, returned holder, alternate path or fixture override exists.

Retain the original reserve promise and two original queries privately. Both
queries are the literal own-backend pg_stat_activity SELECT already proven in
the private fixture; there is no LISTEN, DDL or transaction write. Validate
exactly one six-field row: positive integer PID, microsecond-preserving textual
backend_start, session/current role setfarm_runtime, database setfarm and null
client address. Compare the entire tuple, not PID alone. Recheck held authority
before and after every reserve/query await. No fact grants readiness or admission.

In all outcomes revoke before reserved release. Join the existing client's
original close (driver end plus genuine native socket close) before closing
descriptor/ancestry holders. Never race a timeout or release FDs while work is
pending. Rejection with undefined still counts as failure. If close throws before
returning its original promise, retain resources privately and permanently refuse
future entry; unknown cleanup is not retried. Other close failures are sticky
and sanitized after known settlement; explicitly attempted FD close is not retried.
Client construction can throw after creating the driver but before returning its
ending original. Treat that branch as unknown too: retain the acquired holder
and quarantine future entry. Independently attempt revoke, release and close;
a synchronous revoke/release failure must not skip the close join.

Alternatives: publishing an initializer now would conflate unproved role/grant,
catalog and admission requirements; a refusal-only wrapper would make no functional
progress. This closed consumer adds useful composition with no live selection.

## Proof and limits

Default tests execute the complete real module after TypeScript translation with
only its two external owner imports replaced by explicit protocol doubles. These
are composition controls, not positive descriptor/socket authentication. Test
real Promise pending/settlement, exact literal SQL, tuple drift, cleanup order,
concurrent refusal and sticky cleanup uncertainty. A successful companion must
reject an immediate-refusal implementation. No production test seam is exported.

Actual fixed /Library/Application Support/Setfarm namespace is absent. Do not
manufacture it, exempt a temporary path, copy private fixture authority or claim
positive anchored execution. Existing genuine PostgreSQL lifetime and native FD
tests remain separate prerequisites. Full initializer, grants/base catalog,
historical owner exclusion, controller/effects, PR integration, stock clean-main
build and live3333 verification remain required.
