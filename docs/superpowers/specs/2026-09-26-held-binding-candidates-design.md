# Held physical/row binding candidates

The owner-approved cutover must not count visible development, deployment or historical worktrees as execution owners merely because they exist. A real owner needs a producer-authenticated physical worktree identity tied to its current PostgreSQL attempt/session generation, fence and source. The existing active-binding pair reads complete rows inside the physical catalog bracket, but discards the catalog's frozen first-pass entries; its output cannot name the exact physically observed runtime roots corresponding to those rows.

Add a separate, diagnostic-only held-candidate observer. It wraps the unchanged active-binding V1 pair and captures the physical first-pass view only while the callback is held. After the existing second-pass validation, require the first-pass entries to match the finalized physical catalog exactly. A pure bounded join emits a `receipt-required` candidate only for a unique runtime-zone linked-Git physical root with one active attempt and one active session sharing attempt/run/claim/root identity. Its record includes the observed dev/ino/birthtime/Git-primary identity hash and the database attempt/session IDs, generation, fence commitment and source. Unbound, orphaned, null-path, duplicate and crossed rows stay explicitly unresolved; retained-zone trees are never candidates and remain visible in the unchanged catalog. No hash supplied by a caller authenticates its own producer.

The separate zero-input observer continues to use the held two-launcher cutover-local URL and passive home qualification. A distinct authenticated no-write bootstrap verb outputs only the new schema with literal `diagnostic-only`, `physicalIdentityProvenance:unverified`, `receiptStatus:required-unpublished` and canonical hashes. V1–V7 pre32 and active-binding V1 shapes and behavior remain unchanged. This is not a positive owner, a zero-owner lease, continuous writer/process exclusion, a durable receipt, admission permission or cutover authority. In particular, the cold pre32 catalog is not altered and no migration or runtime write is introduced.

## Error and verification contract

- Reject malformed/non-frozen/proxy first-pass entries, duplicate physical roots, changed first/final catalog entries, forged nested hashes, or multiple callback/database invocations without publishing a partial pair.
- Preserve the existing finite phase and physical-refusal point sanitization, launcher cleanup and code-owned source/build authentication.
- RED tests must cover one-to-one matched runtime candidate, retained-root visibility, each unresolved row class, second-pass drift, forged diagnostic authority, wrong hash and extra bootstrap argv. GREEN runs focused pure/host/bootstrap tests, internal-production cutover/pure suites, scripts and contract checks. Build only after reviewed merge on a separate clean-main clone.

## File Map

- `src/internal-production/baseline-positive-worktree-held-binding-candidates-v1.ts`: strict bounded pure diagnostic join.
- `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`: separate held-candidate ports and zero-input observer; V1 paths remain unchanged.
- `scripts/deployment-cutover.mjs`: distinct authenticated no-write verb.
- Matching pure/host/bootstrap tests and `package.json` pure-suite registration.
- `docs/superpowers/plans/2026-09-26-held-binding-candidates.md`: implementation/verification record.
