# Task6A V2 writer-topology preflight design

## Decision and scope

Task6A V1 cannot be made reachable by reinterpreting its zero-owner census: it counts preserved development and deployment worktrees as owners and binds that meaning through pre-schema rebind, migration 32, and ready evidence. A guard appended after V1 is unreachable. The cutover therefore needs a separately versioned V2 physical/DB owner observation and authority chain, selected before the first effect. V1 records and the frozen migration-32/33 source regions, SQL semantics, and digests remain unchanged. V2 must have its own migration provenance readers; it may not write V1-shaped evidence with V2 references.

The first independently reviewable subproject is a **diagnostic-only writer-topology preflight**. Its purpose is to reject a false premise before any DB/OS admission fence is designed or activated. Current read-only host evidence shows the spawner, dashboard, and Mission Control launchers all select PostgreSQL role `setrox`; that role is a superuser and owns the `setfarm` database. PostgreSQL superusers bypass permission checks, so revocation, RLS, or an application head row cannot fence those existing writers. An idle `setrox` backend was also visible; a future connection-only restriction would not itself prove that existing sessions are gone.

This slice adds no live DB write, new role, grant/revoke, plist change, launcher action, service switch, migration, owner admission, or cutover effect. It preserves all existing worktrees, selected historical dist, and CLI link. The user has delegated ordinary in-scope decisions and approved the separately reviewed V2/access-control direction; this design does not treat that as permission to bypass any runtime or evidence gate.

## Approaches considered

1. Reuse V1 with renamed counters or add a post-V1 fence: rejected because it either changes historical meaning or cannot reach dispatch.
2. Add a purely application-level V2 admission marker: rejected as a mechanical fence because direct SQL, old CLI paths, and the current superuser bypass it.
3. Build a parallel V2 authority path, preceded by an explicit writer-topology check, then move runtime writers to a distinct least-privilege role with a journaled DB/OS transition: selected. The preflight delivered here is only the first read-only piece.

## Diagnostic contract

A new import-inert pure module accepts a strict, bounded snapshot of one database identity, one named runtime role, one separately named controller/admin role, and the database role names selected by the three fixed launchers. These are explicitly caller-supplied diagnostic facts, not authenticated authority. It validates exact plain data, fixed labels and order, unique names, canonical role strings, booleans, and nonnegative session count. No URL, password, token, arbitrary SQL, path, PID, or host action enters this API.

The result is frozen and canonical-hashed. It always says `authority: "diagnostic-only"` and `cutoverAdmission: "not-granted"`. It reports sorted, unique blocker codes for a runtime role that is superuser, owns the database, can bypass RLS, can create roles/databases, lacks login, differs between launchers, equals the designated controller/admin role, or still has sessions. Even if none of these sampled facts blocks, the result is `unverified`, never `ready`: caller-provided topology cannot authenticate launcher bytes, full role membership, object/function/sequence grants, other SQL writers, future sessions, process exclusion, or temporal continuity.

The live host's known `setrox` profile must produce `blocked`, including `runtime-superuser` and `runtime-database-owner`. A forged apparently safe profile may produce only `unverified`, not authority. Malformed or ambiguous profiles refuse rather than returning a partial blocker list. Serialization must contain no credentials and no success/zero-owner lease field.

## Successor design boundaries

The later source-authenticated preflight must bind exact held launcher configuration to a read-only PostgreSQL role/session/object topology query without leaking its private URL. A future separate least-privilege runtime-role transition must discover the complete current object catalog, function execution and defaults, role membership, ownership and pooled sessions; prove old launcher generations cannot reconnect or write; discover all direct and indirect writer entrypoints, including Mission Control; and journal exact process/DB effects with crash replay and rollback. The observed 61 relations/sequences and 27 direct `getSql()` source consumers are baselines, never fixed caps or an exhaustive allowlist. Catalog or writer-topology drift fails closed. PostgreSQL admission and OS launcher/process exclusion must remain effective across Task6A's separate commits. A bounded `pg_stat_activity` or ps/lsof sample is not continuous exclusion.

Only after that boundary is proven may the separate V2 zero-owner observation and rebind → sealed admission → guarded-32 provenance → ordinary-33 → A/ready chain be implemented and reviewed. Physical owner status requires a producer-authenticated, current PostgreSQL attempt/session binding to a held physical identity; retained code/deployment worktrees remain visible but are not silently counted or hidden. Unknown physical entries fail closed. No existing diagnostic `zero-candidate` result is promoted to a lease.

## File Map and verification

- `src/internal-production/baseline-task6a-writer-topology-preflight-v2.ts`: strict pure diagnostic projection and hash; no I/O or authority grant.
- `tests/internal-production/baseline-task6a-writer-topology-preflight-v2.test.ts`: RED/GREEN current-host-shaped blocker fixture, safe-shaped unverified fixture, malformed/crossed input, and no-authority/secret assertions.
- `package.json`: register the test in the internal-production pure suite.
- `docs/superpowers/plans/2026-09-26-task6a-v2-writer-topology-preflight.md`: exact implementation and verification sequence.

Run focused tests, the pure suite, migration-source digests, TypeScript and source contracts, then independent read-only review. A PR and clean-main build may deliver the diagnostic code; they do not authorize live role changes or Task6A. Report live sanitized role/launcher/session evidence separately, with the result explicitly blocked or unverified.
