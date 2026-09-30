# Task6A explicit PostgreSQL socket transport

## Purpose and decision

The protected-cluster OS/HBA rehearsal passed in PR #242, but Setfarm and MC
still construct Postgres.js 3.4.8 pools from URL/PG environment. Local dependency
inspection proved URI query host and encoded socket hostname do not select the
Unix transport. An explicit full `.s.PGSQL.<port>` path is causally necessary
for the same approved Task6A fence.

Implement the transport primitive first and prove it on the existing private
peer fixture. Keeping URL socket conventions is incorrect. Wiring all runtime
pools and a protected descriptor simultaneously makes transport faults hard to
separate from physical authority and migration startup. That integration is the
next independent reviewed deliverable, not an inferred effect of this primitive.
Root is sole writer; read-only agents review. Existing owner approval covers
this small source refinement and private fixture; no additional permission asked.

## Contract

- Node >=22, PostgreSQL 17, Postgres.js 3.4.8; no new dependencies.
- Import is inert: no environment loading, pool construction or connection.
- Typed candidate schema `setfarm.postgres-socket-transport.v1` contains only
  socketDirectory, port, database, user and osUid. It is transport data, not an
  authenticated descriptor, role grant, worktree owner or admission capability.
- Require a normalized absolute directory, no URL/encoding/relative segments,
  newline/NUL, or socket filename as the directory; encoded or ambiguous forms
  refuse. Require integer port 1–65535 except live 5432, nonempty identifier
  database/user, positive non-root OS UID and exact keys.
- Refuse any PG-prefixed environment key, SETFARM_PG_URL or DATABASE_URL, even
  if other explicit transport fields would override it. Check inherited keys in
  a bounded prototype chain as well as own keys. Never accept password,
  URL, custom socket factory or caller-supplied client options.
- Factory checks actual current process UID against osUid before constructing
  Postgres.js. Both pool and listener profiles construct explicit full `path`,
  database/user/port and fixed bounded connection settings. Verify resolved
  options.path/user/database/port and empty password before returning lazy SQL.
  Any mismatch refuses; connection failures do not choose a URL/TCP alternative.
- This API cannot assert physical file/ancestor trust or database role scope.
  Future production consumers require a separate fixed-path root-protected
  descriptor loader, restricted no-default-migration lifetime latch, consistent
  pool/LISTEN binding and actual readiness facts. Generated child UID isolation,
  Mission Control transport, cluster identity and live exclusion remain gates.

## Tests and evidence

Pure behavior tests first fail against absent guard/empty path, then prove exact
resolved Postgres.js options (no connection), hostile inputs and environment
refusal, UID mismatch and pool/listener agreement. The actual opt-in private
cluster runs the factory under `_www`, checks `inet_client_addr() IS NULL` and
role identity, allowed INSERT/SELECT, genuine LISTEN/NOTIFY, admin impersonation,
actual ambient-password refusal and missing Unix socket ENOENT; repeat after
exact restart. The separated UID cannot traverse the protected Home/worktree,
so existing esbuild bundles the actual source/dependency unchanged into a
root-owned 0444 fixture module. Do not open repository permissions or claim this
test bundle is a production deployment. Scrubbed child commands never contact
live 5432. Existing
fixture cleanup and production deny bridges remain unchanged.

## File map

- `src/internal-production/task6a-postgres-socket-transport-v1.ts`: typed
  validation, fixed profiles and explicit-path lazy factory; no runtime auto-wiring.
- `tests/internal-production/task6a-postgres-socket-transport-v1.test.ts`:
  independent literal options and hostile-input tests without DB access.
- `tests/execution-attempts/task6a-private-protected-cluster.integration.test.ts`:
  real source-factory child proof under the scoped peer UID.
- `docs/superpowers/plans/2026-09-30-task6a-postgres-socket-transport.md`:
  root execution, review/delivery and remaining integration boundaries.
