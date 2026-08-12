# V3 Story Claim Runtime Binding V1 Design

## Status

Approved design. Migration 29 uses the immutable cutover contract described
below; application publication work follows the same binding authority.

## Problem

V3 STORY admission currently proves that the complete canonical story set is
authentic when an IMPLEMENT or SUPERVISE claim is published. The durable claim
and runtime rows do not preserve which admitted story member, or which explicit
final-product scope, authorized that publication.

IMPLEMENT already revalidates an exact story database identifier and public
story identifier inside the publication transaction. SUPERVISE only revalidates
the admitted set. Its story-scoped subject can be selected later from
`steps.current_story_id`, mutable run context, or a fallback query. A later audit
therefore cannot prove that the runtime received the same subject that crossed
the STORY admission gate.

## Goals

- Bind every V3 IMPLEMENT claim and runtime to one exact admitted story member.
- Bind every V3 SUPERVISE claim and runtime to either one exact admitted story
  member or an explicit final-product subject.
- Publish the binding in the same transaction as claim and runtime ownership.
- Preserve existing lock order and recovery serialization.
- Keep the authority append-only and fail closed during adoption and rollback.
- Preserve legacy and shadow behavior byte-for-byte where possible.

## Non-Goals

- Do not infer historical SUPERVISE subjects from mutable context or output.
- Do not create deletion, repair, or mutation authority from STORY receipts.
- Do not change canonical STORY receipt schemas.
- Do not make the binding table a replacement for STORY ledger revalidation.
- Do not migrate live production data as part of tests.

## Durable Relation

Migration 29 adds `public.v3_story_claim_runtime_bindings_v1` with one row per
bound claim/runtime pair.

Migration 29 also adds the singleton
`public.v3_story_claim_runtime_binding_cutovers_v1`. The migration creates its
only row under ACCESS EXCLUSIVE locks on runs, claims, runtimes, and completion
requests. The database clock supplies `cutover_at`; the locked claim census
supplies `maximum_pre_cutover_claim_id`. Historical identity is the exact
conjunction:

- `claim.id <= maximum_pre_cutover_claim_id`;
- `claim.claimed_at <= cutover_at`; and
- `runtime.created_at <= cutover_at`.

Every pair outside that conjunction is post-cutover and requires one exact
binding. The cutover row records a bounded digest of stable owner identity:
claim identity and exact claim timestamp, run identity, workflow step, runtime
identity, and exact runtime timestamp. It does not claim or infer a historical
STORY subject. PostgreSQL microsecond precision is preserved in the digest.
The cutover row is owner-only and rejects UPDATE, DELETE, and TRUNCATE.

Contract-spine migration currently runs before the runtime bootstrap creates
`steps` and `stories`. Migration 29 therefore establishes the full current
canonical definitions of those two operational base relations when they are
absent. Existing exact relations are left unchanged; partial or drifted
relations fail before binding authority is installed. This preserves runtime
startup's verify-before-mutation order. Rollback removes only Migration 29
binding objects and supporting identity constraints, and retains operational
base relations.

Required columns:

- `claim_id` as the primary key.
- `runtime_session_id` as a unique key.
- `run_id`, `step_db_id`, and `workflow_step_id`.
- `subject_kind`, exactly `story_member` or `final_product`.
- `story_db_id`, `story_id`, `story_index`, and positive
  `story_claim_generation` for `story_member` only.
- `story_admission_receipt_hash` and `story_admission_subject_hash`.
- `bound_at` from the database clock used by claim publication.

The exact subject check is:

- `story_member`: all story identity fields are present. The workflow step is
  `implement` or `supervise`. The generation is captured from the locked story
  row; a later IMPLEMENT claim increments it and invalidates prior supervision
  evidence without rewriting historical bindings.
- `final_product`: all story identity fields are absent. The workflow step is
  `supervise`.

The relation uses exact foreign keys to the owning claim, runtime, run, step,
and story where applicable. It has owner-only privileges, no row-level security,
no policies, no rewrite rules, and no inheritance. A guard rejects UPDATE,
DELETE, and TRUNCATE. The migration verifier checks exact relation shape,
ownership, ACLs, constraints, indexes, trigger function identity, trigger
definition, and external-trigger census.

## Publication Flow

### IMPLEMENT

1. Keep the existing recovery-story and preparation-story advisory lock order.
2. Lock the run.
3. Revalidate the STORY ledger and exact `(storyDbId, storyId)` member and
   current claim generation.
4. Publish the story transition, step pointer, claim, and runtime.
5. Insert the binding from the transaction-authenticated STORY authority and
   exact locked story row. Caller-supplied hashes or indexes are not accepted.
6. Commit all ownership and binding mutations together.

### SUPERVISE

SUPERVISE subject selection moves before claim publication.

For story-scoped supervision, the caller supplies only the candidate database
and public identifiers selected from Setfarm-owned rows. Inside the publication
transaction, Setfarm locks the run and canonical story set, requires the selected
row to be an admitted `done` member, and verifies that the locked step pointer
identifies the same database row. Mutable run context and reported agent output
are never selection authority.

For final-product supervision, the publication transaction proves that the
IMPLEMENT loop is done, its current story pointer is empty, and the canonical
story set is terminal. When the locked loop contract enables `superviseEach`,
every canonical member must also have exact settled story-scoped SUPERVISE
evidence: a completed claim, released bound runtime, and accepted,
effects-committed runtime completion for the same current story claim
generation. When `superviseEach` is disabled,
story-scoped supervision is not a valid workflow subject and no per-story
SUPERVISE evidence is required. The transaction then records
`subject_kind = final_product`. No synthetic or nullable story identity is
invented. Mutable supervised-story context is never authority.

The published subject is returned with the claim/runtime result. Context
injection consumes that authenticated subject instead of rerunning fallback
selection.

## Recovery and Consumption

Recovery must load the binding by exact claim and runtime identity before using
story-scoped work. It revalidates the current STORY ledger receipt and subject
hash, then verifies the bound story remains the expected canonical member.
Bindings do not authorize deletion or mutation of story rows.

An absent binding is valid only for legacy/shadow work and V3 workflow steps
outside IMPLEMENT and SUPERVISE. V3 IMPLEMENT or SUPERVISE without exactly one
binding fails closed before model dispatch.

## Adoption and Rollback

Migration 29 does not adopt unjournaled preinstalled binding or cutover
authority. Only the migration transaction may derive and record the cutover;
an exact but unjournaled topology is an adoption mismatch. Migration 29 can
therefore never have the journal state `adopted`.

The locked pre-cutover census admits only bounded historical V3 IMPLEMENT and
SUPERVISE owners whose run is terminal, claim has a terminal outcome, runtime
is released, and completion state is fully settled. Accepted completion must
have effects committed, exact claim-outcome agreement, and no unapplied
mandatory effect.
Rejected or quarantined completion is historical only before owner commit.
Open claims without runtimes, mismatched claim/runtime ownership, active runs,
open claims, unreleased runtimes, and unsettled completion all reject the
migration atomically. Terminal legacy claims without a runtime are not owner
pairs and receive no authority.

Historical owners receive no fabricated binding. Verification recomputes their
exact bounded identity digest and fully terminal state every time. The binding
insert guard rejects a binding for the exact historical conjunction. Loaders
remain fail closed without a binding; the exemption belongs only to migration
data auditing, not runtime consumption.

Rollback 29 to 28 locks the same owner and completion relations, re-verifies the
immutable cutover and historical digest, and is allowed only when the binding
relation is empty. It removes the cutover and binding topology together while
retaining operational base relations. Once any binding provenance exists,
rollback refuses removal and directs operators to roll forward.

All migration-1-through-28 semantic regions and digests remain byte-identical.
Migration 29 receives its own semantic region, digest, current-head audit path,
CLI rollback mode, and exact source-integrity coverage.

## Failure Semantics

- Missing or forged STORY proof: reject before claim/runtime mutation.
- Candidate mismatch or stale step pointer: return no publication or a typed
  authority error without partial ownership.
- Ambiguous final-product eligibility: reject before publication.
- Binding conflict or trigger failure: roll back story, step, claim, runtime,
  and binding mutations as one transaction.
- Adoption ambiguity: leave the database at head 28.
- Active, malformed, oversized, or unsettled historical owner: leave the
  database at head 28 without cutover objects or a journal row.
- Exact unjournaled cutover topology: refuse adoption.
- Rollback with provenance: retain migration 29 and return an explicit refusal.

No failure path weakens a guard, deletes retained evidence, or derives mutation
authority from a path, PID, context value, or agent claim.

## Verification

Focused tests must prove:

- Exact IMPLEMENT story-member publication and rollback.
- Exact story-scoped SUPERVISE publication and context injection.
- Explicit final-product SUPERVISE publication without a story identity.
- Forged receipt, forged subject, story database/public identifier mismatch,
  stale step pointer, extra story, and late immutable story drift rejection.
- Concurrent story-pointer/candidate swap cannot cross publication.
- Recovery requires the exact stored binding.
- INSERT authority is transaction-derived; caller hashes and indexes cannot
  mint a binding.
- UPDATE, DELETE, TRUNCATE, foreign owner/ACL, trigger, policy, rewrite,
  persistence, inheritance, and relation-shape drift are rejected.
- Exact apply, unjournaled-adoption refusal, current-head audit, empty rollback,
  provenance rollback refusal, and future-journal refusal.
- No ambiguous historical SUPERVISE backfill.
- Terminal historical owners cross the cutover without fabricated bindings;
  active, malformed, or unsettled owners fail atomically.
- Historical identity paging crosses its fixed page boundary, refuses
  oversized identity text before allocation, and detects one-microsecond drift.
- Exact unjournaled cutover topology and impossible `adopted` journal state are
  rejected.

Broad verification includes TypeScript, English-only, whitespace, migration
digests, migration journal tests, claim/runtime publication tests, STORY ledger
tests, recovery tests, and installer/package trust tests.

## Compatibility

Legacy and shadow publication signatures remain source-compatible. V3 callers
gain a private typed subject handoff. Public STORY receipts and agent-visible
completion schemas do not change. No credential, code-signing identity, live
database mutation, service restart, commit, stage, or push is required for the
implementation and test cycle.
