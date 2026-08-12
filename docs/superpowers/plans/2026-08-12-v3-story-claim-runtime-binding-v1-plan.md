# V3 Story Claim Runtime Binding V1 Implementation Plan

## Objective

Implement Migration 29 and application publication changes that durably bind
every V3 IMPLEMENT and SUPERVISE claim/runtime pair to its exact authenticated
STORY subject without weakening STORY admission or legacy compatibility.

## Workstream Ownership

### Migration and Topology

Owned files:

- A new Migration 29 semantic migration module.
- Migration registry, source-integrity manifest, generated digest, and CLI
  current-head/rollback wiring.
- Dedicated isolated PostgreSQL Migration 29 tests and affected exact migration
  expectations.

This workstream must not edit application publication or installer files.

### Application Publication

Owned files:

- STORY admission transaction helper and binding repository/module.
- Claim/runtime publication.
- Installer claim selection and SUPERVISE context injection.
- Focused claim/runtime and STORY integration tests.

This workstream must not edit migration registry, digest, or CLI files.

### Adversarial Review

Read-only review covers relation identity, adoption, rollback, lock order,
SUPERVISE scope, recovery, allocation bounds, false-authority surfaces, and test
coverage. Findings are resolved before broad verification.

## Task 1: Migration 29 Relation

Create an append-only `v3_story_claim_runtime_bindings_v1` relation with exact
subject constraints and foreign-key identity. Add guard functions and triggers
that reject UPDATE, DELETE, and TRUNCATE. Verify:

- ordinary permanent non-partition relation shape;
- no inheritance, RLS, policies, or rewrite rules;
- exact owner, owner-only ACL, and no column ACL;
- exact columns, types, defaults, constraints, indexes, and foreign keys;
- expected trigger names, definitions, function OIDs, owners, ACLs, and exact
  external-trigger census.

Because contract-spine apply precedes runtime base-table bootstrap, Migration 29
creates the full current canonical `steps` and `stories` relations only when
they are absent. It must reject partial or drifted preexisting definitions.
Runtime `CREATE TABLE IF NOT EXISTS` and column additions then remain
idempotent. Rollback retains those operational base relations while removing
only Migration 29 binding objects and supporting identity constraints.

Create an immutable singleton `v3_story_claim_runtime_binding_cutovers_v1`
relation in the same migration. Under ACCESS EXCLUSIVE locks on runs, claims,
runtimes, and completion requests, derive the cutover timestamp from the
database clock and the maximum claim identity from the locked database. A
historical owner is exactly a pair whose claim identity, claim timestamp, and
runtime timestamp are all at or before that cutover boundary.

Audit historical owners in bounded scalar and paged projections. Admit only
fully terminal runs and claims with released runtimes and no unsettled owner or
effect commit. Record a bounded digest of stable owner identity with exact
PostgreSQL microsecond timestamps. Never include inferred STORY subject
authority and never fabricate historical binding rows. Refuse open or malformed
claim/runtime ownership, active owners, unsettled completion, oversized
identity text, or any pair outside the exact boundary. Every post-cutover pair
requires one exact binding.

Do not adopt preinstalled Migration 29 topology. The migration-derived cutover
must be written atomically with the topology and journaled as `applied`; an
unjournaled topology or an `adopted` Migration 29 journal row is drift.

## Task 2: Current-Head and Rollback Integration

Register Migration 29 without changing any Migration 1-28 semantic source
region or digest. Add:

- implementation digest and source-integrity bindings;
- apply, detect, verify, and current-head audit paths with adoption explicitly
  forbidden for Migration 29;
- CLI `rollback-29-to-28` mode;
- empty-only rollback with future-journal and provenance refusal;
- exact current-head dispatch across supported predecessor heads.

## Task 3: Transaction-Derived Binding

Add an application helper that accepts only the transaction-authenticated STORY
authority and selected subject. It derives receipt hash, subject hash, story
database/public identifiers, and story index from locked rows. It inserts the
binding after claim/runtime publication and before transaction commit.

No public API accepts caller-supplied binding hashes, story index, timestamps,
story claim generation, or mutable context as authority. IMPLEMENT captures the
generation returned by its locked story transition. Story-scoped SUPERVISE
captures the generation from the locked story row. Reimplementation increments
the generation, so prior-generation supervision cannot block or authorize new
work.

## Task 4: Exact IMPLEMENT Publication

Keep existing recovery/preparation/run/story lock order. After STORY ledger and
member revalidation, publish story state, step pointer, claim, runtime, and exact
binding in one transaction. Any failure rolls back every mutation.

Return the authenticated subject in the publication result for later recovery
and audit plumbing.

## Task 5: Exact SUPERVISE Publication

Move SUPERVISE subject selection before claim/runtime publication.

- Story-scoped selection supplies exact database/public identifiers from
  Setfarm-owned rows. The transaction requires the locked step pointer and
  admitted `done` story member to match.
- Final-product selection is an explicit typed subject. The transaction proves
  the IMPLEMENT loop is done, its story pointer is empty, and the canonical
  story set is terminal. If the locked loop contract enables `superviseEach`,
  every canonical member must also have completed claim, released bound
  runtime, and accepted/effects-committed story-scoped SUPERVISE evidence. If
  `superviseEach` is disabled, story-scoped subjects are invalid and this
  per-story prerequisite is omitted. In `superviseEach` mode, the qualifying
  supervision binding must match each story's current claim generation.
- Remove mutable context and fallback query selection after publication.
- Context injection consumes only the subject returned by publication.

## Task 6: Recovery and Durable Consumption

Load the binding by exact claim/runtime identity before V3 IMPLEMENT or
SUPERVISE recovery. Revalidate the bound STORY receipt and subject. Reject
missing, duplicate, mismatched, or stale bindings before dispatch or mutation.

Runtime completion registration performs the same binding load inside its
ownership transaction. IMPLEMENT completion envelopes must match the bound
story member. Story-scoped SUPERVISE requests derive `story_db_id` and
`story_id` from the binding instead of an untrusted or absent envelope field.
Final-product SUPERVISE requests require the exact final-product binding and
carry no invented story identity. Completion request subject fields are never
caller-authored authority.

Legacy, shadow, and unrelated V3 workflow steps remain compatible and do not
require a binding.

## Task 7: Focused Verification

Run isolated tests for:

- exact IMPLEMENT story-member success and rollback;
- exact story-scoped and final-product SUPERVISE success;
- forged proof, hash, story identity, index, pointer, extra-row, and immutable
  story drift rejection;
- concurrent pointer/candidate swap;
- exact recovery binding;
- topology drift, adoption ambiguity, current-head audit, apply, rollback, and
  future-journal refusal;
- terminal historical cutover without binding backfill, fixed-size historical
  paging, exact microsecond digest drift, and bounded identity rejection;
- active, open, malformed, unreleased, or unsettled pre-cutover owner refusal;
- exact unjournaled cutover and impossible adopted-journal refusal;
- transaction rollback after late binding failure.

The same production failure may be retried at most three times. Stop and report
if the same systemic failure repeats three times after fixes.

## Task 8: Broad Verification

Run:

- TypeScript no-emit compilation;
- English-only source contract;
- whitespace checks;
- migration digest generation and verification;
- migration journal, Migration 29, claim/runtime, STORY ledger, recovery,
  spawner, and installer/package trust test suites;
- independent read-only final review.

Do not run a clean-worktree build while the intentionally dirty worktree guard
would reject it. Do not bypass that guard.

## Task 9: Production Admission Decision

Renew read-only live evidence after the code matrix is green:

- code-signing identities;
- Gatekeeper, SIP, architecture, OS, Xcode, notarytool, and stapler;
- installed Setfarm package/daemon census;
- Mission Control and Setfarm HTTP health;
- live migration-head and service-log evidence.

Do not apply a live migration, restart a service, sign, notarize, install, stage,
commit, or push without separate authority. Report credential and migration
gaps as explicit production blockers.
