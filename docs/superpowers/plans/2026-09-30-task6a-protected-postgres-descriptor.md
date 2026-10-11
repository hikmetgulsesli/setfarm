# Task6A Protected PostgreSQL Descriptor Implementation Plan

> **For agentic workers:** Root executes inline with TDD and verification-before-completion. Agents are read-only reviewers/investigators. Explicit root-only owner instructions override implementation delegation; executing-plans is unavailable in this session.

**Goal:** Authenticate a fixed root-protected PostgreSQL descriptor, without ambient fallback or live runtime wiring.

**Architecture:** Import-inert strict parser, generic read-only root-file holder, zero-input fixed-path descriptor holder. Retain directory/file FDs, recheck physical identities/ACLs/bytes, revoke on failure.

**Tech Stack:** Node >=22, TypeScript ESM, macOS, node:test, existing esbuild and canonical JSON serializer; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-protected-postgres-descriptor-design.md`

## Global Constraints

- Root sole writer, PR branch only, preserve all worktrees and unrelated changes.
- No live descriptor namespace, account, ACL, database, service, selector or archive mutation.
- Fixed root-owned source; no production path/environment override or URL fallback.
- Root0755 ACL-free ancestors, root0444 one-link bounded regular file, no-follow FDs.
- Descriptor data is not socket/grant/readiness/owner/deployment/exclusion proof.
- Optional private fixture never runs Node as root; retain uncertain resources.

## File Map

Create `src/internal-production/task6a-protected-postgres-descriptor-v1.ts`
(strict descriptor data and zero-input production holder),
`src/internal-production/task6a-root-owned-json-file-v1.ts` (read-only physical
leaf), `tests/internal-production/task6a-protected-postgres-descriptor-v1.test.ts`
(pure/default refusal tests), and
`tests/internal-production/task6a-private-protected-descriptor.integration.test.ts`
(explicit opt-in actual-file proof). Modify `package.json` only to register
focused/default discovery and explicit private-fixture command. Create this
plan/spec. These tests keep the authenticated-source boundary in normal CI.

## Task 1: Strict data and physical source

**Interfaces:** `parseTask6aProtectedPostgresDescriptorV1(bytes: Buffer)` returns
frozen descriptor data. `holdTask6aRootOwnedJsonFileV1(path: string)` returns
`read(): Buffer`, `recheck(): void`, `close(): void`. Zero-argument
`holdTask6aProtectedPostgresDescriptorV1()` returns `read()` frozen typed
descriptor, `recheck()` and `close()`; rejects extra arguments.

- [x] Write intended RED parser tests: canonical valid value is cloned/frozen;
  malformed keys/UIDs/fixed paths, duplicated JSON and alternate bytes deny.
  Example: `assert.throws(() => parseTask6aProtectedPostgresDescriptorV1(Buffer.from('{"schema":1,"schema":2}\n')), /TASK6A_PROTECTED_POSTGRES_DESCRIPTOR_INVALID/)`.
- [x] Write actual unprivileged temp-file/symlink/oversize/default-loader refusal
  tests, watch expected guard failures against minimal empty guards; do not
  import db-pg or contact any DB.
- [x] Implement bounded canonical parser using `canonicalJsonStringify`, exact
  schema/transport keys and role/path/identity policy. Implement physical file
  holder with root/ACL/no-follow checks and sticky recheck/close failure.
- [x] Run GREEN: `npm run test:task6a-protected-postgres-descriptor`.

## Task 2: Real isolated protected-file proof and delivery

- [x] Add opt-in fixture using system mktemp/install/chmod/chown under exact
  random Library fixture; actual unchanged compiled module runs as `_www`.
  `assert.equal(scopedResult.status, 0)` must cover read/recheck and closed-holder
  denial. As `_www`/nobody, append and replacement return EACCES/EPERM.
- [x] Perturb exact private file mode, bytes, one-link identity and ACL under
  trusted admin; scoped source refuses and revokes existing holder. Never touch
  the production fixed path. Revalidate exact anchor/children before cleanup.
- [x] Run `SETFARM_TASK6A_TEST_PROTECTED_DESCRIPTOR_FIXTURE=1 npm run test:task6a-protected-descriptor:isolated`; independently check exact fixture absent.
- [ ] Strict TS includes new tests, transport4 and existing pure suite372,
  source contracts and diff check. Read-only independent review; resolve and
  reverify every blocking finding.
- [ ] Commit/push scoped branch, one Copilot/Gemini request each, exact-head
  cloud/security gate, exact-head reviewed PR merge with no branch deletion.
- [ ] Fast-forward clean standby main and ordinary guarded build; verify full
  SHA/main/dirtyfalse BUILD_INFO. Then continue restricted runtime wiring.

## Evidence

Record observed counts, exact private lifecycle and delivery in this plan or
the owner checkpoint. No whole-app suite or production-cutover success claim.

- Intended RED: five failures against empty physical guards and permissive
  parser, including missing freeze/refusals and leaked SyntaxError. GREEN5/5;
  normal focused discovery adds one explicit private skip with zero effects.
  Strict TypeScript including both actual test files passed.
- Independent pre-execution review caught missing fixture ancestor ACL checks;
  root added pinned root/Library/ApplicationSupport identities, full ACL-free
  path/home checks before each root effect, bounded exact child-close wait and
  a restrictive0750 directory perturbation instead of widening access. Reviewer
  rechecked and cleared the private fixture; no root Node runs.
- Actual final fixture6/6, zero skips/failures, exit0 (1.956s), exact temporary
  `/Library/Application Support/setfarm-task6a-descriptor.ha9EWhtu`,
  device16777231/inode201599412. `_www` real/effective UID/GID verified. Returned
  buffer mutation leaves held original unchanged. Mode drift, same-inode byte
  writes, inode replacement, hard-link, traversal restriction, actual @-masked
  ACL rows, oversized file and symlink all denied; restored paths never revive
  a revoked holder. Exact scoped clients closed before known-file rm+rmdir.
  Independent exact absence check and empty fixture-prefix inventory passed.
  Earlier dBBFZuDu fixture also removed/independently absent.
- Existing transport4/4 and internal-production pure372/372 zero skips exit0;
  source and actual tests strict TS, English1853/path945/version2.3.79, semantic
  migration digests and12MC artifacts passed. Fixed missing production-path
  loader refused without creating anything. HTTP remains200/000/200. No complete
  application suite, live socket/grant verification or cutover is claimed.

## Explicit release after revocation correction (2026-10-11)

Causal scope: actual native client close now joins its originals, but composing
the fixed protected socket holder would release descriptor/ancestry FDs earlier
on recheck failure. Separate sticky refusal from release in the existing nested
holders before adding any backend initializer. Root sole writer; existing linked
worktree and draft PR280 stay, no integration/rollout or guard bypass.

File Map: modify existing generic file holder, protected descriptor holder,
`src/internal-production/task6a-socket-physical-evidence-v1.ts`, actual private
descriptor integration fixture, this plan and paired spec ONLY. Outside diagnostic
capture may reuse pinned existing read-only declared-dependency resolver/tsx and
complete-write/original-close capture helper; no candidate dependency mutation.
Actual outside owner is `logs/setfarm-protected-descriptor-run-v1.mjs`, with
fixed argv/env/base-only descriptor opt-in and thirteen pre/post physical/byte
pins. Original actual child close, complete writes, independent fsync/close and
sticky final/capture failures; sampled8GiB reserve/64MiB admission margin. No
native-graph/full-dependency or universal descendant-extinction claim follows.

**Interfaces unchanged:** generic hold(path), zero-input protected descriptor and
socket holds; returned read/recheck/close. Returned failure invalidates forever;
constructor failures close partial resources; explicit close releases every FD.

- [x] Extend existing private fixture CHILD with an observational wrapper around
  actual fs.openSync/closeSync. Delegate each original unchanged, record actual
  acquired FDs and exact close attempts. Healthy returned holder records5 FDs.
  After drift and refused reads/rechecks, run `fs.fstatSync(fd)` on each; they
  must remain open. After explicit close twice, each original was closed once
  and `assert.throws(()=>fs.fstatSync(fd),e=>e.code==='EBADF')` must pass.
- [x] Default tests remain unprivileged. Review exact test/capture before the
  existing approved temporary root-file fixture opt-in. Old source must produce
  intended RED when its failed recheck already closed a held original.
- [x] Change only returned-callback catches from `invalid=true;close();refuse()`
  to `invalid=true;refuse()` in all three nested FD holders (including protected
  socket read). Keep acquisition catch/explicit close/physical-only data holder
  policy intact. No authentication, ACL/path, identity or uncertainty relaxation.
- [x] Fresh actual protected-file GREEN and default descriptor/physical/socket
  tests, exact cleanup corroboration, strict source/actual-test types/contracts.
  Root self-review verifies every acquired FD has constructor-failure or explicit
  release ownership; independent source/raw review before scoped delivery.

This fixture observes genuine FD ownership only; not a synthetic file-system
acceptance stub. It does not prove a fixed production descriptor was deployed,
joint backend cleanup, zero historical owners or dashboard startup. No live
Setfarm path/DB, accounts, services or deployment selector are modified.

Preparation refinement: an early candidate-worktree attempt failed before the
FD oracle, while the old finally masked its initial error. It earns no RED.
An independent pre-effect dependency probe reproduced MODULE_NOT_FOUND for
declared esbuild in that worktree. Use a fresh10-member exact-source capsule
with an ordinary symlink to existing canonical dependencies, never mutate the
candidate dependency binding or expand the resolution hook. The fixture now
completes actual write:false bundling and local bytes before root allocation,
logs the allocated path before anchor lstat, and retains tagged initial/cleanup
failures with ordered AggregateError after finally. Existing cleanup guards
remain unchanged; the uncertain earlier root0700 fixture stays visible, not
deleted. This infrastructure repair is necessary to earn the same FD evidence.
Outside successor `logs/setfarm-protected-descriptor-capsule-run-v2.mjs`
pins the used nomination bytes, all20 source/copy observations, actual node and
capture helper, with the same sticky original-close/full-write/final-failure
and sampled8GiB custody. Capsule builder is the distinct
`logs/setfarm-protected-descriptor-source-capsule-v1.mjs`. Used older tools and
captures remain unchanged. This is source verification, not dependency freeze.

Actual intended RED: five pure passes, one native failure, zero skips, natural
1/null. The healthy holder ran first; mode drift then caused the delegated
original close count to be1 rather than absent before explicit close. Exact
private fixture cleanup and independent absence were verified. Actual first
GREEN:6/6,0 skips, natural0/null, all perturbations and genuine fstat/EBADF
oracles passed, exact fixture cleanup/absence corroborated. No capture faults
or8GiB reserve breach. Read-only source and RED reviews cleared the bounded
four-catch correction. Final failure-presence hardening was freshly reverified:
6/6 actual private tests,0 skips, natural0/null, raw SHA256
`b5747ed5491a77ec1fa3cb908d359e11067a248fe8ae271ecc157cf833011b0e`,
receipt SHA256
`41fcd5f2d32b4738edcda58a2c687cd79ba244412637d29ee34ca589bafd9dfe`.
Root rehashed all20 source/copy snapshots,4 fixed pins and3 stream artifacts;
independent material review corroborates exact fixture absence and bounded
capture. Final owner free9,297,797,120B, no capture faults or sampled8GiB breach.
Actual candidate focused transport/descriptor/native-close/physical tests:
23 passes,1 explicit privileged skip,0 failures. Strict TS5.9.3 actual source
and four test roots:843 roots/1192 files,0 diagnostics/noEmit. Version2.3.79,
English1996/path1002, semantic migration digests and12MC artifacts passed.
Independent source/test/type-helper review closed all findings. This remains
a partial draft-PR checkpoint, not branch integration or whole-app completion.
Ordinary stock build still requires the eventual reviewed clean main custody;
no fake main, origin rewrite, dirty-build flag or guard skip is used here.
