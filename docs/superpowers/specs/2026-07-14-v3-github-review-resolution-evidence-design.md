# V3 GitHub Review Resolution Evidence

## Decision

Use one immutable, versioned batch artifact for each complete observation that
resolves an unstructured GitHub-review recovery case. The batch is the exact
set of originally actionable threads; per-thread rows and prose classifiers are
not authority.

## Artifact

`setfarm.github-review-resolution-evidence.v1` binds the run, story, recovery
case, finding set, dispatch, attempt, repository node/owner/name, pull request,
original review head, observed candidate source revision, and a canonically
ordered thread list. Each thread binds its finding ID, GitHub thread ID,
original review artifact hash and body revision hash, and observed terminal
state (`RESOLVED` or `OUTDATED`). A canonical SHA-256 hash covers the complete
payload.

The observer reads GitHub only. It never invokes a mutation. Incomplete GraphQL
pagination, changed identity/head, unresolved expected threads, missing expected
threads, duplicate threads, or an extra supplied thread fail closed.

## Durable authority

A new immutable PostgreSQL ledger stores the exact artifact payload. Its
repository validates, in one transaction, the original FindingSet, every
original semantic review artifact and run reference, the recovery
case/revision/dispatch/delivery/attempt identity chain, and the observed
post-repair source revision. Duplicate identical publication is idempotent;
hash collision or identity drift is rejected.

## Recovery transition

The v3 recovery coordinator exposes a typed GitHub-review resolution path.
Before terminalizing a case it loads the durable artifact and revalidates exact
original-thread completeness and all identity bindings. Only then may the
unstructured review case become `resolved`. Structured evidence recovery and
legacy/shadow behavior remain unchanged.

## Tests

Unit tests cover canonical hashing, read-only observation, missing/unresolved/
stale/extra/tampered evidence, and exact set matching. Isolated PostgreSQL tests
cover migration shape and immutability, idempotent insert, original artifact
and run-ref authority, dispatch/attempt binding, and coordinator terminalization.
