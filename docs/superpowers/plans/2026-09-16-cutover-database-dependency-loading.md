# Cutover Database Dependency Loading Implementation Plan

> **Execution:** Serialized primary-owner TDD with read-only parallel review.
> Start implementation only after the selected-build checkpoint is qualified.

**Goal:** Permit the existing pre32 read-only database/finding census dependencies
inside the trusted controller without admitting arbitrary npm modules.

**Architecture:** Authenticate the Git-owned package lock, then the exact SHA512
compressed npm-cache objects it names, then strict owned tar member bytes. Compare
installed members under physical pins and extend the existing immutable-byte
loader only to the two reviewed dependency trees and fixed ESM entry mappings.
No new bundle/output topology, download, install, cache repair or runtime writes.

**Tech Stack:** Node builtins, SHA512 SRI, bounded gzip/tar parsing, existing loader
physical snapshots and actual installed/cache package fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Causal requirement and alternatives

The existing pre32 census uses postgres and the finding inventory uses Zod. The
bootstrap currently allows only builtins and authenticated local output. Existing
dependency-materialization APIs require unrelated release admission records; the
provisioner bundler is purpose-bound and a new bundle would change exact finalized
output topology. Local verified tarballs provide a narrower source of dependency
bytes. Cache metadata or a hash of installed files alone is not authenticity.

Read-only host evidence: postgres3.4.8 has37 ordinary tar members/331264 bytes;
zod4.4.3 has718 ordinary members/5140480 bytes. Both installed packages declare no
dependencies. Both local cache objects match the lock's SHA512 integrity. This
evidence selects the strict format; it does not waive future authentication.

## Fixed reviewed package contract

- postgres3.4.8, ESM entry `node_modules/postgres/src/index.js`, integrity
  `sha512-d+JFcLM17njZaOLkv6SCev7uoLaBtfK86vMUXhW1Z4glPWh4jozno9APvW/XKFJ3CCxVoC7OL38BqRydtu5nGg==`.
- zod4.4.3, ESM entry `node_modules/zod/index.js`, integrity
  `sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==`.
- Reject changed version/integrity and dependencies/peer/optional dependencies.
  A future dependency update requires explicit contract and test review.
- Derive content cache path from SHA512 digest under the code owner's fixed
  `.npm/_cacache/content-v2/sha512`; never use cache index or resolved URL as proof.
- Bound compressed bytes to2MiB, inflated bytes to8MiB, members to1024 and each
  member to2MiB. Only reviewed regular-file USTAR members under `package/`.
- Reject links/extensions, noncanonical/duplicate paths, unchecked octal fields,
  bad checksum, truncation, overflow and nonzero trailing tar payload. Explicitly
  characterize and enforce gzip member/trailer handling before implementation.
- Both authenticated cache objects have gzip compression method8 and flags0.
  Require this fixed ten-byte header form. Node26.4.0 characterization showed
  `gunzipSync` accepts concatenated members (including an empty second member)
  and trailing zero padding, so it cannot alone prove a single-member envelope.
  Bounded `inflateRawSync({info:true,maxOutputLength})` reports only the DEFLATE
  bytes consumed. Require10+consumed+8 to equal the entire compressed length,
  then verify trailer CRC32 and ISIZE against owned output. Feature-check built-in
  `crc32`; reject unsupported runtime rather than importing another dependency.
  Test concatenation, trailing bytes, truncation, CRC/size mismatch, expansion cap
  and unsupported flags independently before accepting the real fixed archives.
- Installed dependency trees must be physical, same-device, owner-controlled and
  unchanged. Execute owned archive-authenticated bytes, never native rereads.
- Map bare `postgres` and `zod` to the exact fixed entries; deny package subpaths,
  unknown packages, query/fragment URLs and CommonJS. Resolve local imports only
  into the already-authenticated map; changed disk package metadata cannot redirect.
- Errors contain only a fixed refusal code; no cache contents or credentials.

## File map

- Create `scripts/deployment-cutover-dependencies.mjs`: bounded archive decoding
  and the fixed package contract. No module evaluation or external commands.
- Create `scripts/__tests__/deployment-cutover-dependencies.test.js`: portable
  fixed archive positives and small malformed archive fixtures.
- Create `scripts/__tests__/fixtures/deployment-cutover-dependencies.mjs`: tiny
  literal archives and independently fixed SRIs; private helper copies replace
  only the two reviewed integrity values. Production remains unchanged.
- Create `scripts/integration/deployment-cutover-dependencies-genuine.test.mjs`:
  mandatory Mac mini checkpoint using the unmodified helper and real cache.
- Modify `scripts/deployment-cutover.mjs`: authenticate helper/lockfile before
  use, pin/cache-check installed files, fixed resolution and immutable loading.
- Modify `scripts/deployment-cutover-owner.mjs` and its tests: include helper in
  the committed script closure; no owner semantics change.
- Modify bootstrap tests: authenticated harmless postgres/Zod operations and
  cache/installed-file/resolution substitution failures, no DB connection.
- Create `scripts/__tests__/fixtures/deployment-cutover-bootstrap.mjs`: shared
  Git/finalized-output fixture with separate physical home and checkout; portable
  package defaults, explicit genuine integration option. Host fixtures keep
  service/CLI paths under home and source/build paths under checkout.
- Create `scripts/integration/deployment-cutover-loader-genuine.test.mjs`: real
  postgres/Zod import with socket connection disabled and real CommonJS-subtree
  refusal. This gate is mandatory and cannot skip missing prerequisites.
- Update spec File Map with the dependency boundary.

## Task1: bounded archive verification

**Interface:** `readCutoverDependencyArchivesV1()` zero-argument code-root-bound
read-only operation returns owned authenticated member bytes with fixed locators
and package entry mappings. It must compare lockfile identity/bytes before/after;
the bootstrap separately authenticates that lockfile against Git before invoking.
This helper is not a process ownership, database or deployment capability.

- [x] Write positive fixtures with fixed genuine archives and matching lock;
  assert literal entry mappings. Known package execution belongs to Task2's
  trusted-loader integration, not this archive-only primitive.
  Missing helper is RED; no dynamic package hash may define its own expected SRI.
- [x] Implement fixed contract and bounded physical reads, then strict decompression
  and member parsing. Pure internal decoder tests use independently built tar
  fixtures; production export remains zero-argument and rejects unsupported inputs.
- [x] Cover corruption/missing cache, wrong lock/version/SRI, gzip expansion cap,
  malformed numeric/checksum/length, duplicates/traversal, links/extensions and
  trailing payload. Assert zero writes and sanitized errors.

Task1 qualification:44/44tests, zero skips,1494.830417ms; noemit, English1527files,
path872files and whitespace checks passed. Missing-helper RED preceded the first
nine cases. Two file/parent path collisions reproduced RED before adding rejection
in both archive orders. Physical tests cover bounded growth, same-inode lock drift,
ancestor replacement preserving descendant/file identities, actual reused file and
directory descriptors, single close consumption and sticky refusal. Independent
review found no material implementation issue and improved the ancestor fixture.
These files are not integrated into the bootstrap or a database connection yet.

Portability review separated the44-case unit matrix from the genuine archive
gate. Standard unit tests now use two tiny literal USTAR/gzip packages and fixed
independently generated SRIs, not the host npm cache or self-derived expectations.
The explicit genuine gate requires the two actual reviewed archives, fails if
absent, and cannot skip/download. Both gates are required for this checkpoint;
unit green alone cannot qualify real package compatibility. Combined45/45passed,
zero skips,1158.0865ms; independent read-only review found no must-fix.

```sh
node --test scripts/__tests__/deployment-cutover-dependencies.test.js
node --test scripts/integration/deployment-cutover-dependencies-genuine.test.mjs
```

## Task2: loader integration

- [x] Make a fresh bootstrap fixture load harmless `zod.string().parse('ok')` and
  `typeof postgres` through fixed authenticated mappings; require failure before
  integration. Never open a database connection in these package-loading tests.
- [x] Extend the helper closure and authenticate lock Git bytes. Hold all installed
  directory/file pins, compare each member against tar bytes, install fixed bare
  resolution and retain the existing owned-byte load hook.
- [x] Test installed bytes/mode/symlink/ancestor drift, changed package metadata,
  unknown package/subpath/CommonJS requests and load-time replacement markers.
- [x] Run archive and bootstrap/owner suites, noemit/contracts and independent
  review. No live effect or package download is authorized by this diagnostic.

Separate authenticated inventory from execution permission: postgres includes
CommonJS `.js` files under `cjs/src`. All archive members are compared, but only
`postgres/src/**/*.js` and Zod's reviewed ESM `.js` tree enter the executable map.
All10Zod package scopes declare type module. A genuine CommonJS-subtree regression
first reached the forbidden load hook, then refused after the allowlist split.
Both snapshot readers also reproduced legal partial-read refusal before adopting
the same bounded accumulation algorithm as the shared retention primitive.
No native package main/exports lookup, CommonJS fallback or cache repair is added.

Task2 local qualification: final bootstrap/owner56/56, zero skips,156441.741ms;
archive plus genuine integration48/48, zero skips,19731.951708ms; noemit and
English1531/path876 contracts passed. Independent scoped review approved the
execution allowlist, load-boundary witness and bounded reads, with no must-fix.
This qualifies only dependency loading; no DB census, ownership or live cutover
completion is claimed. Following full local qualification and independent review,
deliver this prerequisite as a separate commit in PR125 with explicit scope
update, alongside the same-root partial-read closure; do not claim DB integration.

## Remaining after this prerequisite

Extract/reuse the complete pre32 read-only census without weakening the existing
receipt protocol; authenticate credentials privately from the fixed launcher;
retain filesystem/helper/phase checks, owner-fenced ordinary refusal, exact
journaled service/link effects, cold handoff and actual Task6A-ready completion.
