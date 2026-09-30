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
