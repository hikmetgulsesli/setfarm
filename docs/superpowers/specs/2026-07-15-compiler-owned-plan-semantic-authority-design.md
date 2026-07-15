# Compiler-Owned PLAN Semantic Authority

Date: 2026-07-15

Status: accepted architecture; implementation is release-pinned and must pass
the full convergence suite before activation is considered GO.

## 1. Problem and live evidence

Product Compiler v3 currently asks the PLAN model to emit the complete
`ProductSpecV3Proposal`. That transport includes both primary product semantics
and fields that are mechanically derivable from those semantics. The compiler
validates the result, but it does not own enough of its production.

Clean run `#2031` (`db871b4a-7c9a-4c3f-9497-eeadfdf75b50`) failed all three PLAN
claims before DESIGN:

- claim `5421` supplied a literal `/value = "refreshed"` state delta and no
  action inputs, but declared persistence payload fields `value` and
  `updatedAt` as though they were action inputs;
- claim `5422` preserved the same state, policy, action, outcome, and evidence
  semantics but deleted the required `persistenceEffects` array;
- claim `5423` repeated claim `5421` byte-for-semantics and failed with the same
  typed diagnostic.

The model had already received the complete JSON Schema and an explicit prompt
rule saying that a fixed button outcome has no synthetic input or payload
field. More prompt text therefore does not establish authority. Offline replay
proves that replacing only the redundant payload fields with the exact fields
used by matching state deltas canonicalizes claims `5421` and `5423` with no
other semantic change.

The existing deterministic `produceProductSpecV1` is not a replacement. On the
eight convergence tasks it rejects all eight; it encodes a few historical
utility/operations/game profiles and cannot express the suite's requested
actions. A hardcoded producer would merely move project-specific guessing into
Setfarm.

## 2. Decision

PLAN will use a compiler-owned semantic authority boundary:

1. The model may propose only primary semantic facts and exact requirement
   bindings.
2. Setfarm generates every redundant identity, cross-reference projection,
   delivery value, persistence payload/state projection, outcome/evidence
   reference, capability reference, task-source byte, and traceability hash.
3. Only the generated canonical `ProductSpecV3` becomes an artifact and enters
   the Product Build Packet.
4. A semantic ambiguity or unsupported product class produces a compiler-owned
   typed rejection. A malformed proposal is not repaired by guessing and is
   never passed downstream.

The target transport is `setfarm.plan-semantic-proposal.v1`. The current
full-ProductSpec planner transport is a temporary compatibility input and will
be removed after parity fixtures and clean canaries pass.

Rejected approaches:

- Adding another prompt warning or retry classifier leaves the same duplicated
  authority in place.
- Silently accepting any invalid ProductSpec and filling arbitrary defaults
  would hide semantic loss.
- Making the current profile producer authoritative would reject valid new
  product behavior and require a new hardcoded profile for each project class.

## 3. Authority matrix

| Field family | Proposal owner | Compiler owner | Canonical rule |
| --- | --- | --- | --- |
| Product name/class/language | model candidate | validates | Must bind exact task requirements |
| Goals/non-goals | model candidate | IDs and traceability | Every item cites exact `REQ_*` refs |
| Entities and fields | model candidate | canonical IDs/ref checks | No invented unbound entity |
| State and deltas | model candidate | ref/path/type validation | Every input is behaviorally consumed |
| Route/surface/action semantics | model candidate | canonical IDs and graph closure | No label/prose inference downstream |
| Persistence intent | model candidate | complete effect projection | Payload fields come only from matching input-backed deltas |
| Delivery profile/topology | none | Setfarm catalog | Exact activated profile only |
| Requirement source bytes | none | requirement ledger | Model supplies IDs/classification only |
| Traceability hash/bindings | semantic refs only | Setfarm | Exact task hash and complete graph coverage |
| Observable evidence | assertion facts | Setfarm | Evidence IDs, outcome refs and capability refs are derived |
| Canonical JSON/artifact hash | none | Setfarm | Content-addressed immutable bytes |

## 4. Versioned proposal and compiler output

`PlanSemanticProposalV1` contains:

- `schema` and exact `sourceTaskHash`;
- product name, semantic class, UI language, database intent and UI vision;
- goals and non-goals with requirement refs;
- entities, fields, states, routes and surfaces with local semantic keys and
  requirement refs;
- actions with triggers, inputs, preconditions, evidence scenario inputs,
  state deltas, navigation, persistence intents and observable assertions;
- assumptions with explicit source requirement refs;
- requirement classification and expected semantic kinds by exact `REQ_*` ID.

The proposal does not contain:

- copied task clauses or source locators;
- platform, framework, stack pack or capability IDs;
- ProductSpec global IDs;
- persistence payload fields or state-path copies;
- success/failure/evidence reference arrays;
- observable evidence IDs;
- traceability source hashes or full binding objects;
- Product Build Packet or source revision identity.

`compilePlanSemanticProposalV1` performs this deterministic sequence:

1. verify proposal schema, source task hash and exact requirement ID set;
2. resolve the activated delivery profile from semantic product class and any
   explicit stack request;
3. allocate deterministic namespace IDs from semantic keys;
4. resolve all local references and reject ambiguity, cycles or missing owners;
5. derive persistence effects from persistence intents and matching state
   deltas;
6. derive payload fields only from `valueFrom.kind=input|inputs` for the exact
   persisted state paths;
7. derive outcome, observable evidence and physical capability refs;
8. copy source-owned requirement bytes from the canonical ledger and compile
   complete traceability bindings;
9. validate the resulting strict `ProductSpecV3ProposalSchema`;
10. emit canonical bytes, hashes and compiler evidence.

No later stage can read the raw semantic proposal as product authority.

## 5. Compatibility bridge and dependency order

The migration is release-pinned and needs no database DDL.

### Slice A: remove redundant persistence authority

Before changing the model transport, add a versioned compiler projection over
the current candidate. For every action/persistence effect it derives
`payloadFields` from matching state deltas and exact action inputs. A candidate
cannot influence those bytes. Missing or ambiguous primary persistence intent
still fails closed.

This slice must replay `#2031` claim `5421` as canonicalized, preserve its exact
state/policy/action semantics, and reject a mutation whose state path has no
matching delta. It is a vertical authority change, not a project-specific
normalizer.

### Slice B: introduce `PlanSemanticProposalV1`

Add the schema, deterministic compiler and prompt. The v3 PLAN resolver accepts
only one semantic proposal or one typed rejection. The current full ProductSpec
transport remains readable only in explicit compatibility fixtures and cannot
be emitted by new v3 prompts.

### Slice C: retire full planner ProductSpec authority

Delete the v3 full-ProductSpec prompt/schema projection and its compatibility
acceptance after all historical fixtures plus the three-class convergence suite
have semantic parity. Legacy/shadow PLAN behavior remains isolated by the
run-pinned protocol.

Implementation order:

1. pure compiler projections and unit fixtures;
2. v3 PLAN decoder/authority adapter;
3. prompt/context transport;
4. preclaim/completion evidence and retry ownership;
5. downstream compatibility rendering;
6. full tests, release build, migration attestation, MC pin and clean canaries;
7. compatibility deletion only after parity evidence.

## 6. Failure and retry ownership

- Transport/schema errors are typed PLAN proposal failures.
- Missing or ambiguous primary semantic facts are compiler-owned typed
  rejection or bounded semantic amendment, not generic PLAN retry prose.
- Compiler-derived field failures are Setfarm bugs and consume no model retry
  budget.
- The same semantic proposal hash plus same compiler diagnostic hash is never
  redispatched to a model unchanged.
- A model amendment carries only the rejected semantic paths, current proposal
  hash, exact source task hash and expected delta schema.
- Supervisor cannot rewrite packet semantics. It may authorize one bounded
  semantic amendment only when the compiler identifies a unique PLAN owner.

## 7. Verification matrix

Unit:

- input-backed, composite-input, literal, state and entity-field deltas produce
  exact persistence payload fields;
- nonexistent/mismatched state paths reject;
- requirement bytes, delivery and capability values cannot be overridden;
- semantic IDs and output hashes are deterministic;
- negative ambiguous/unsupported tasks produce source-bound typed rejection.

Integration:

- captured `#2031` claims replay through the compiler projection;
- PLAN completion publishes canonical ProductSpec and legacy PRD from the same
  typed value;
- DESIGN/STORIES/SETUP consume only the canonical projection;
- unchanged invalid semantic proposals dedupe before another model dispatch.

Concurrency and lifecycle:

- exactly one claim can publish a PLAN artifact;
- late/stale claim output cannot replace a newer proposal revision;
- terminal OpenClaw task reconciliation and completion drain preserve the same
  claim fence.

E2E/eval:

- six positive cases across utility, operations and game, including Turkish
  variants, reach exact accepted-candidate evidence;
- two negative cases reach compiler-owned typed rejection with zero downstream
  product side effects and zero model redispatch;
- no new project-specific guard or prose classifier is added;
- one repeated canonical root cause three times stops the suite.

## 8. Rollback and GO criteria

Rollback changes the default release for future runs and restores the prior
Mission Control contract pin. Run protocol and compiler release identity are
immutable, so an in-flight v3 run is never resumed under another compiler.
Content-addressed artifacts are retained for audit and replay.

GO requires all eight convergence cases on one exact clean release, exact
Mission Control projection parity, invariant-free terminal ownership, and a
deep-verified content-addressed release-gate artifact. Until then the system
remains NO-GO regardless of local unit-test success.
