# Cutover Pre32 Database Census Implementation Plan

> **Execution:** Primary-owner inline TDD with parallel read-only review. One
> writing branch; isolated DB suites serialized. No live mutations.

**Goal:** Reuse the complete existing pre32 database census from the authenticated
cutover diagnostic without loading the broad receipt module or exposing secrets.

**Architecture:** Move the existing catalog-absence and read-only census functions
into an import-inert shared leaf. Keep the receipt's private default-false wrapper.
The launcher's private held context supplies its agreed fixed URL to the leaf;
the zero-input external diagnostic always requests pre32 checking and exposes only
secret-free observations. This is not ownership exclusion or rollout authority.

**Tech Stack:** TypeScript ESM, authenticated postgres/Zod imports, existing SQL
transport fixtures, fixed physical launchctl/plist observations.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and File Map

- Preserve all13zero-owner counts, catalog/APRB integrity and validated bounded
  finding publication inventory. Do not replace these with four aggregate rows.
- Preserve one fresh repeatable-read/read-only transaction,5s statement timeout,
  1s lock timeout and bounded connection close. Pre32 absence precedes aggregate.
- Preserve journal, relation/index, function, type and trigger absence checks,
  including PostgreSQL's63-byte identifier behavior.
- No db-pg/runtime-config/receipt imports in the shared leaf; no output, migration,
  receipt publication, filesystem writes or service actions in the census.
- Add `src/internal-production/baseline-legacy-database-census-v1.ts`: shared leaf,
  explicit private caller URL argument, no environment mutation or top-level IO.
- Modify `baseline-post-handoff-receipt-v1.ts`: retain private
  `observeLegacyDatabaseCensusV1(coldBootstrap=false)` forwarding the original URL.
  Public receipt exports and callers remain unchanged.
- Modify `baseline-deployment-cutover-launcher-observation-v1.ts`: factor a private
  held context, preserve current synchronous public hash-only ABI, add zero-input
  async DB diagnostic. Never export credentials, parsed environment or an arbitrary
  callback that can consume secrets.
- Modify `scripts/deployment-cutover.mjs`: compose the authenticated diagnostic,
  retaining CLI/launcher/process pre/post brackets and ownership blockers.
- Tests: shared-leaf contract/transport tests; receipt transport fixture routing;
  launcher async drift/cleanup/secrecy cases; authenticated bootstrap composition.
- Update the approved spec File Map and standard test invocation manifest before
  delivery. Preserve every existing full receipt witness.

## Task1: shared census leaf with unchanged semantics

**Interface:** `observeLegacyDatabaseCensusV1(databaseUrl, coldBootstrap=false, profile?)`
returns the existing deeply frozen census and finding inventory. The receipt's
private wrapper still accepts only its existing optional boolean.

The optional internal profile is only `"cutover-local"`; the launcher always
supplies it. Existing receipt calls omit it and preserve their legacy behavior.
This stronger profile rejects every ambient PG-prefixed setting after imports,
requires a single-authority credential-bearing localhost/127.0.0.1 URL with
default5432 and exact `/setfarm`, and validates the actual constructed driver's
host/port/database/user before any transaction. The constructor remains lazy;
refusal closes it without any query. Driver debug and notices are suppressed.

- [x] Add import-inert and explicit-URL tests; prove missing leaf RED first.
- [x] Move the two functions currently at receipt8861–9110 and their private pure
  validation helpers. Keep SQL, bounds, count parsing, finding validation and
  failure classifications unchanged. Import postgres/finding code lazily.
- [x] Retarget the actual transport seam in `createLegacyDatabaseCensusFixture`
  and the cold-recovery source-copy loop to the leaf, not the now-forwarding
  receipt wrapper. Assert each replacement matches exactly once.
- [x] Run existing exact witnesses: cold absence before aggregate and fresh
  observations; aggregate refusal through cleanup; every later catalog owner;
  nonzero claim; all13predicates/malformed counts/integrity violations; two complete
  cold observations. Verify real publication validator remains unmocked.
- [ ] Explicitly assert transaction/options/query order and one bounded close on
  success and failure. Add notice/error credential canaries; never print driver
  errors or causes from the external diagnostic. No live database connection.

## Task2: private held credentials and asynchronous launcher fence

**Interface:** zero-input async launcher/database observation; secret-bearing
values remain lexical to the owning module and never enter return/error objects.

Concrete interface: `observeDeploymentCutoverLauncherDatabaseV1()` returns a
deeply frozen `{schema, launcherObservation, databaseCensus, observationHash}`.
Factor private `holdLauncherConfigurationV1()` with `observation`, `recheck()`,
`census()` and consume-once `close()`; never export this context or its URL.
The existing synchronous export opens this context, returns the same observation
and closes it before returning. The new async export awaits the private census,
rechecks the held context, hashes the secret-free result, and closes on every
path. Any error becomes the existing fixed launcher refusal; close uncertainty
continues to poison future attempts.

Observed fixed launchers agree with runtime-config.ts101: postgres protocol,
loopback, default5432, database `/setfarm`, no query/fragment. Require exact
agreement of raw URLs, `postgres:` or `postgresql:`, host `localhost`, `127.0.0.1`
absent/default5432 port, exact `/setfarm`, no whitespace/query/fragment.
IPv6 is refused: the reviewed driver splits its bracketed hostname incorrectly.
Require one `@` authority boundary and a nonempty username; reject PG-prefixed
ambient settings. Independent review reproduced ambient PGPORT adoption and a
multi-@ parser differential against the real driver without opening sockets.
Three regressions reproduced these failures before the stricter profile repair.
Do not import runtime-config or adopt environment fallback. The inspected live
configuration was read only and no credential values were printed.

Test the new export first (missing-export RED), then controlled shared-leaf
transport at its module boundary while retaining real held plist descriptors,
plutil conversion and launcher projection. Independently qualified leaf tests
retain real census SQL/publication validation. Cases: correct URL/true mode,
crossed URLs/remote or query override before calls, await-time file/parent/loaded
drift, canary errors, bounded close loss and unchanged environment/files.

- [x] Test crossed launcher URLs and unsafe target refusal before any connection.
  Derive the intended loopback/database policy from existing configuration code;
  do not invent a different database or change credentials.
- [x] Reuse existing fixed labels, userInfo-derived physical home, plist parser,
  loaded-environment checks and inherited SETFARM_ENV_DIR validation. Acquire and
  retain descriptors across the async census. Require identical nonempty URLs.
- [x] Bracket bytes/identities/loaded states before and after the complete pre32
  census. Consume each descriptor once; close uncertainty invalidates output.
- [ ] Test same-inode bytes, parent replacement, loaded-config drift during await,
  close response loss, secret canaries in connect/query/end/notices, unchanged
  environment and unchanged filesystem. No generic credential getter or parser.

## Task3: trusted composition and qualification

Add explicit `inspect-database --json` alongside existing read-only modes, so
ordinary `inspect-host` retains its no-DB behavior. The new mode performs the
same host bracket plus the private async launcher/census observation, compares
its launcher commitment to the outer one, then rechecks CLI/launcher/process and
source/build. Include the secret-free database observation in the host hash.
Replace only the missing-DB blocker with an explicit remaining filesystem/helper/
phase census blocker; retain controller-not-acquired and all process/root blocks.

- [x] Prove the bootstrap loads only authenticated compiled/shared-leaf and
  dependency bytes, executes full pre32 census, then rechecks host commitments.
- [x] Retain controller-not-acquired and all remaining runtime/helper/phase
  blockers. Database diagnostics alone never grant complete-zero admission.
- [ ] Run focused transport/launcher/host suites and noemit/contracts, then the
  affected isolated receipt suite using the authentic runner and owned DB pair.
  Do not use broad test-name patterns that can select adjacent DB reset cases.
- [ ] Obtain independent review and reviewed PR delivery. Only then consider a
  read-only live diagnostic from a normal clean-main build; no rollout effects.

## Still required afterward

Local qualification September16: exact existing receipt witnesses7/7; invoked
cutover236/236; manifest18/18; noemit and English1535/path877 contracts passed.
Bootstrap/owner/genuine gate61/61 passed on identical production code before the
last three negative fixtures/socket trap; all four final database integration
cases separately passed with sockets forbidden. Independent leaf, launcher and
composition reviews found no remaining blocker after the real-driver target
fixes. Full affected isolated receipt gate and reviewed delivery remain pending.
The old selected-build sample precedes the DB await; this diagnostic does not
claim final old-build stability or loaded-dashboard provenance.

Filesystem/helper/phase zero-owner proof, exact controller ownership and durable
ordinary refusal, immutable intent/completion for each service/link effect,
dashboard loaded-build authentication, sealed cold handoff and real Task6A ready.
Old deployment, eight archives and ports3080/3333/18789 remain unchanged.
