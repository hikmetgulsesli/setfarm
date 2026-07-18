# Semantic Source Authority Design

Date: 2026-07-18
Status: Approved for shadow implementation
Scope: Release-bound semantic source rules, planned source intents, exact declarations, and projectable story proofs

## Context

The current semantic chain knows what the product must do and which story owns
each semantic subject. It does not know, before implementation, which exact
source responsibility, file, and structural slot must implement that subject.

`BuildTopologyV1` owns paths, roles, grants, entrypoints, commands, and coarse
capabilities. It cannot prove that an action belongs to one handler, a state to
one store, a persistence policy to one adapter, or a route to one registration
slot. `ImplementationSourceMapV1` closes exact Stitch-generated screen source,
but it does not cover no-design products or the complete action/state/
persistence/platform source closure. `ImplementationStorySourceMapV1` also
embeds the full global V1 witness in every slice.

Deriving SourceMapV2 directly from those artifacts would reintroduce the root
failure in a typed-looking form: Setfarm would still guess semantic ownership
from filenames, broad writable paths, generated titles, or whichever file was
already present.

## Decision

Use one release-owned source-authority chain:

```text
StackSemanticSourceRulesCatalogV1
  + ProductDeliveryProfileV2
  + ProductSpecV2 partition
    -> SemanticSourceIntentSetV1            # before physical setup
    -> FileTreeManifestV2 / BuildTopologyV2 # materialized exact paths
    -> SemanticSourceDeclarationsV1         # every-and-only closure
    -> StoryPlanV3                           # semantic + source ownership
    -> ImplementationSourceMapV2 root/leaves
    -> ImplementationSourceMapStoryProofV2  # least-privilege projection
```

The implement agent receives a verified story proof and exact writable
declarations. It does not receive the global source map, caller-authored path
maps, catalog rules, unrelated story leaves, or inferred filenames.

The current PacketV3 and SliceV2 shapes are branch-only and have not been
persisted or activated in the live artifact store. Their V1 source-map fields
are therefore replaced before the first production write, as one wire shape,
rather than retained as a dual branch. Optional V2 fields are forbidden. The
live cutover preflight must reproduce that the count of persisted/activated
PacketV3 plus V1-source-map authority is still zero; any nonzero count forces a
packet/report/slice version bump before proceeding.

## Considered Approaches

### Treat every story-owned path as a source slot

Rejected. Path ownership answers where a story may write, not which behavior a
path implements. Recovery would still target a broad file set and could resend
the same defect without identifying the expected semantic delta.

### Let planning/setup or the implement agent author a semantic path map

Rejected. A caller-authored map is another claim. It can omit hard behavior,
reuse a path without a safe structural slot, select a convenient filename, or
assign two stories to the same source responsibility.

### Infer paths from stack templates, titles, or source discovery

Rejected. Titles, slugs, regex-discovered filenames, existing imports, and the
first matching entrypoint are mutable observations, not release authority.
They are exactly the mechanisms that made new product classes create new guard
classes.

### Release rules -> compiler intents -> setup declarations

Selected. Rules define the complete source obligations for a stack/profile.
The compiler derives intents only from sealed product authority. Setup
materializes those intents, and a separate compiler reproduces every
declaration from rules plus exact topology. No stage accepts a replacement
mapping from the caller.

## Core Invariants

- Catalog rules are code-owned, versioned, content-hashed, and bound to one
  exact stack-pack identity. ProductDeliveryProfileV2 binds one exact rule set
  in the forward direction; the rule set does not bind back to the profile.
- Product delivery selects rules by exact catalog identity. The caller cannot
  provide rule bodies, path templates, cardinality, or locator contracts.
- Every required semantic responsibility produces exactly one intent unless a
  rule explicitly declares bounded aggregation or a typed exemption.
- Titles, descriptions, labels, entity names, route prose, story prose,
  `domain_slug`, `target_slug`, regexes, glob discovery, and arbitrary caller
  fragments never participate in path or slot identity.
- Writable intents never contain future content hashes. They bind only the
  current base presence/hash after physical materialization.
- A generated immutable source may bind a known output hash only through its
  verified generation receipt.
- Every writable or granted implementation path has at least one declaration.
  Setup/config/asset/generated/dependency paths have an explicit non-writable
  classification.
- Multiple declarations may share one file only through a catalog-declared
  aggregation policy and unique structural locator slots.
- SourceMapV2 roots and story proofs are freshly reproducible. A serialized
  `verified` marker or self-consistent hash is not authority.
- Public inputs are bounded canonical snapshots before schema traversal. Proxy,
  accessor, cycle, sparse-container, excessive-depth/work/byte, unsafe Unicode,
  and publication failures become typed rejection.

## StackSemanticSourceRulesCatalogV1

The catalog is an immutable release artifact.

```ts
type StackSemanticSourceRulesCatalogV1 = {
  schema: "setfarm.stack-semantic-source-rules-catalog.v1";
  catalogVersion: string;
  producer: SemanticArtifactProducerV1;
  releaseAuthority: {
    codeSha: GitCodeSha;
    platformBundleHash: Sha256;
  };
  ruleSets: StackSemanticSourceRuleSetV1[];
  catalogPayloadHash: Sha256;
};

type StackSemanticSourceRuleSetV1 = {
  schema: "setfarm.stack-semantic-source-rule-set.v1";
  ruleSetRef: StableReference;
  ruleSetVersion: string;
  readiness: {
    status: "shadow";
    blockerCodes: SemanticSourceRuleSetShadowBlockerCodeV1[];
  };
  stackPackBinding: {
    stackPackId: string;
    stackPackVersion: string;
    stackPackContentHash: Sha256;
  };
  rules: StackSemanticSourceRuleV1[];
  ruleSetHash: Sha256;
};
```

The rule catalog deliberately has no ProductDeliveryProfileV2 hash or profile
catalog hash. Rules are produced first. The profile catalog then selects an
exact `(ruleSetRef, ruleSetVersion, ruleSetHash)`. This one-way identity removes
the otherwise impossible profile-hash/rule-set-hash cycle.

Every rule contains:

- a stable rule ref and domain-separated rule hash;
- one exact semantic subject kind;
- one exact source responsibility;
- a typed activation predicate and cardinality; and
- one discriminated target: project/generated source slot, platform contract,
  typed exemption, or predicate relation.

A source-slot target additionally carries one owner policy, path-resolution
contract, structural locator contract, access/output policy, and bounded
aggregation authority when sharing is allowed. Its mandatory
`subjectContractResolution` is `none` except for action-input source: web/game
bind exact `ActionInputTransportV2`, CLI binds the future CLI invocation ABI,
and API binds the future HTTP invocation ABI. Platform, exemption, and
predicate-relation rules cannot smuggle placeholder source paths or ownership
claims.

Supported subject kinds are `entrypoint`, `command`, `route`, `surface`, `control_slot`,
`physical_control`, `action`, `action_input`, `state`, `persistence_policy`,
`entity`, `observable`, `evidence_predicate`, and `runtime_data_contract`.

Supported source responsibilities are:

- `route_registration`;
- `command_registration` or `platform_command`;
- `surface_primary`;
- `control_binding`;
- `action_handler`;
- `action_input_transport`;
- `state_store`;
- `persistence_adapter` or `persistence_exemption`;
- `entity_model`;
- `observable_projection`;
- `entrypoint_registration`;
- `api_response_adapter`;
- `cli_output_adapter`;
- `runtime_data_fixture`;
- `runtime_registration` or `platform_registration`.

Generated source is a discriminated target of `surface_primary` or
`physical_control_binding`, not a second overlapping semantic responsibility.

Activation is a strict discriminated union over facts already in ProductSpecV2
and the selected profile: always, action trigger kind, persistence
kind/durability, entrypoint kind, command kind, design/no-design kind, or an
exact conjunction of those predicates. Subject existence is the compiler's
iteration domain, not a caller-authored activation fact. Activation never
executes code or accepts a free-form expression.

Cardinality is one of `exactly_one_per_subject`,
`exactly_one_per_entrypoint`, `typed_exemption_per_subject`, or
`catalog_bounded_aggregate`. Aggregate rules include a maximum member count and
one parser-owned unique slot-key domain. There is no story-wide singleton that
could collapse multiple semantic subjects into one untraceable obligation.

Path resolution is one of:

- `compiler_semantic_token_path`: a fixed release-owned prefix/suffix plus the
  full SHA-256 of `(ruleSetHash, storyId, subjectKind, subjectRef,
  responsibility)`, bound to the code-owned
  `SEMANTIC_SOURCE_PATH_TOKEN_V1` contract and contract hash;
- `selected_entrypoint_path`: the exact topology-selected entrypoint path;
- `generated_receipt_path`: one exact verified
  `setfarm.generated-source-receipt.v2` identity;
- `fixed_release_path`: an exact catalog path; or
- `shared_structural_slot_path`: an exact catalog path or selected entrypoint
  plus a required structural locator.

There is no title token, slug token, basename scan, regex path, glob path,
allowed-root fallback, or first-existing candidate.

Structural locators are strict unions: whole-file exclusive, versioned export,
versioned AST slot, or generated element receipt. AST slot kinds cover exact
entrypoint/route/action/control/state/persistence/observable/CLI/API/runtime
registrations. Each structural locator binds the code-owned parser ref and
parser-contract hash except whole-file exclusive and generated-receipt
locators.

The first code-owned catalog slice contains exact stack-specific rule sets:

- Vite React and browser-game use Stitch receipt-owned surface/physical-control
  source, browser-local persistence, and project-owned action/state wiring;
- Node CLI uses typed no-design surface source, none/memory persistence
  exemptions, and an exact CLI output adapter, with no invented rendered-control
  or durable persistence rule; and
- Node Express API uses typed no-design surface source, exact file/database
  persistence, and an API response adapter.

All shared entrypoint/route/runtime slots bind the exact code-owned TypeScript
parser contract hash. Writable rules bind one responsibility-specific
structural-postcondition ref and exact slot-domain refs. Predicate rules resolve
each predicate through one exact support signature in the verified
`EvidenceAdapterRegistryV1`; a broad stack capability is not sufficient.

Catalog V1 is intentionally shadow-only. It has no `active` state and no public
resolver that can turn a catalog row into production authority. Its exact
blockers are:

- web/game: `SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED`, parser
  implementation, and release manifest;
- CLI/API: `SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED`, parser
  implementation, and release manifest.

The descriptor hash proves only the code-owned contract description. It does
not prove that a parser, generator, transport, or release manifest exists. A
future separately verified `SemanticSourceRuleSetActivationReceiptV1` must bind
the exact catalog/rule-set hashes and evidence that discharges every blocker;
the catalog itself is never rewritten or relabeled active.

### GeneratedSourceReceiptV2 prerequisite

The existing Stitch screen index is an input, not a source receipt.
`GeneratedSourceReceiptV2` must bind the design-source closure and exact
`StitchScreenIndexV2` payload hashes, generator implementation and platform
bundle hashes, generated-source CAS identity, byte length/content hash, and the
exact index-entry, component-API, and semantic-identity-closure hashes for its
target, surfaces, physical controls, actions, action inputs, and observables.
The rule contract fixes this required authority set under
`GENERATOR_STITCH_GENERATED_SOURCE_V2`; no title, path scan, or mutable screen
prose can substitute for the receipt.

### InvocationInputTransportV2 prerequisite

CLI/API action-input authority cannot be derived from an action handler path.
The transport artifact must bind every ProductSpec input field to an exact ABI:
CLI argv position/flag/stdin/env encoding plus exit/stdout readback, or HTTP
method/path parameter/query/header/body encoding plus response/readback. It
also binds the exact evidence-adapter support signature that can execute that
ABI. Until this artifact fresh-verifies, CLI/API rule-set selection remains
blocked.

## ProductDeliveryProfileV2

V2 preserves the exact V1 delivery/topology/evidence bindings and adds:

```ts
semanticSourceRules: {
  catalogVersion: string;
  catalogHash: Sha256;
  ruleSetRef: StableReference;
  ruleSetVersion: string;
  ruleSetHash: Sha256;
};
```

Selection and verification fresh-reproduce both the delivery catalog and the
semantic-rule catalog. A V1 selection is historical input only and cannot be
promoted to V2 by attaching hashes.

Initial V2 profile/rule coverage is deliberately cross-class:

- Vite React utility/operations;
- browser-game React/canvas;
- Node CLI; and
- Node Express API.

Web utility/operations and browser game remain the first activation candidates.
All four initial rule sets begin in shadow. Web/game additionally require exact
generated-source receipts; CLI/API require exact invocation-input transports;
all require the parser implementation and typed release manifest. A V2 profile
may select a rule set only with the separate activation receipt proving that
its exact blocker set is discharged. Unsupported or shadow-only stacks fail
production selection with a typed source-rules blocker; they never fall back to
coarse topology.

## SemanticSourceIntentSetV1

The intent compiler consumes exact ProductSpecV2, deterministic semantic story
partition, verified ProductDeliveryProfileV2, design-source receipts when the
profile requires design and an exact typed absence when it does not, and the
semantic-rule catalog verification input. It does not consume
BuildTopology, setup output, DB story rows, or caller path proposals.

Each intent has one common identity:

```ts
type SemanticSourceIntentCommonV1 = {
  intentRef: StableReference;
  storyId: StoryId;
  subjectKind: SemanticSourceSubjectKindV1;
  subjectRef: StableReference;
  subjectHash: Sha256;
  responsibility: SemanticSourceResponsibilityV1;
  ruleRef: StableReference;
  ruleHash: Sha256;
  intentHash: Sha256;
};

type SemanticSourceIntentV1 = SemanticSourceIntentCommonV1 & (
  | {
      targetKind: "project_source" | "generated_source";
      ownerPolicy: SemanticSourceOwnerPolicyV1;
      pathResolution: SemanticPathResolutionV1;
      locatorContract: SemanticLocatorContractV1;
      accessPolicy: SemanticSourceAccessPolicyV1;
      outputPolicy: SemanticSourceOutputPolicyV1;
      subjectContractResolution: SemanticSubjectContractResolutionV1;
    }
  | {
      targetKind: "platform_contract";
      platformAuthorityRef: StableReference;
      platformContractProjectionHash: Sha256;
      capabilityRefs: CapabilityId[];
    }
  | {
      targetKind: "typed_exemption";
      exemptionCode: PersistenceExemptionCodeV1;
      backingResponsibility: "state_store" | null;
    }
  | {
      targetKind: "predicate_relation";
      bindingResolution: ExactEvidenceAdapterSupportSignatureResolutionV1;
    }
);
```

Intent identity is content-derived. The complete set is canonical and must
equal the every-and-only obligations re-derived from ProductSpec and rules.
Every story-contract evidence predicate, including action-referenced optional
predicates, has exactly one canonical predicate-source relation. The relation
binds predicate ref, subject ref, a non-empty exact declaration-ref set and/or
one platform-adapter authority ref, and a binding hash. Predicates do not create
invented instrumentation files. Requiredness controls verdict policy later; it
does not control SourceMap completeness.

An entity-model intent carries the exact entity field-ID set and field-contract
hash. It does not require one file per field unless a release rule explicitly
chooses a bounded per-field layout. Every action input field always has its own
exact action-input source obligation and contract hash.

## FileTreeManifestV2 And BuildTopologyV2

Setup materializes only compiler intents and release-owned setup paths.
`FileTreeManifestV2` records each intent-to-path resolution and its source:
semantic token, selected entrypoint, generated receipt, or fixed release path.
It cannot accept legacy `scope_targets` as native authority.

`BuildTopologyV2` preserves physical path, owner, grant, entrypoint, command,
capability, and current base authority, and adds exact semantic declaration
refs per path. Shared writable paths require parser-owned unique locator slots.
Paths without semantic declarations are explicitly classified as setup,
config, test, asset, generated-readonly, dependency-readonly, or build output.

## SemanticSourceDeclarationsV1

The declaration compiler fresh-reproduces intents and joins them to exact
materialized topology. A declaration binds:

- intent/rule/subject/responsibility identity;
- story, owner, path ref, normalized path, and access mode;
- current base presence and current base content/absence hash;
- exact structural locator and parser contract;
- generated receipt identity when applicable;
- aggregation group and unique slot key when applicable; and
- structural postcondition, without a future writable content hash.

Every intent has exactly one declaration or its exact typed exemption. Every
writable declaration resolves to one owned or write-granted path. Every
writable/granted path is closed by declarations. Missing, extra, duplicate,
ambiguous, overlapping structural slots, unowned paths, and undeclared writable
paths are compile blockers.

The pair `(pathRef, locatorCanonicalHash)` is globally unique. An exclusive-file
locator cannot coexist with another writable declaration on that file. Shared
files require catalog-bounded aggregation, exact write grants, unique slot keys,
and parser-proven non-overlapping structural locators.

## StoryPlanV3

StoryPlanV3 is produced after declarations. Each story retains its V2 semantic
sets and adds exact `sourceDeclarationRefs`, `sourceIntentRefs`, and declaration
set hash. Dependency edges include semantic shared-slot ownership as well as
physical shared grants. A story cannot consume a declaration owned by a later
or unrelated story.

V2 story plans remain historical. V3 is not obtained by adding declaration
refs to an already sealed V2 object.

## ImplementationSourceMapV2

SourceMapV2 is a root artifact plus one artifact per story leaf.

The root manifest binds exact ProductSpecV2, ProductDeliveryProfileV2,
SemanticSourceIntentSetV1, BuildTopologyV2,
SemanticSourceDeclarationsV1, StoryPlanV3, and verified design-source hashes.
It contains canonical leaf refs with `(index, storyId, storyHash,
leafEnvelopeHash, byteLength)` and one Merkle commitment, not every leaf
payload. The manifest does not bind its future packet hash; PacketV3 binds the
manifest envelope hash, root, leaf count, and story-ID-set hash in the forward
direction so no identity cycle exists.

Each story leaf contains every and only:

- the story's semantic subject sets;
- exact planned source declarations;
- generated design source bindings;
- entrypoint and command refs required by that story;
- evidence-predicate-to-source-declaration bindings; and
- exact source coverage/cardinality hashes.

Leaf, pair-node, and unary-node hashes use separate canonical domains. Leaves
are ordered by UTF-16 story ID. Each level pairs left-to-right; an odd child is
wrapped in one explicit unary node and is never duplicated or padded. A proof
records leaf index/count and exact `left`, `right`, or `unary` steps. A verifier
derives the only legal orientation and proof length from index/count and rejects
non-canonical steps, wrong direction, duplicate/unnecessary unary steps, wrong
leaf index/count, root mismatch, or a leaf that does not freshly reproduce from
compiler input.

`ImplementationSourceMapStoryProofV2` carries only root artifact/authority
hashes, one leaf envelope/hash/index, leaf count, story-ID-set hash, and its
audit path. It contains no other story leaf, global V1 witness, catalog body, or
unrelated topology.

## Compiler And Verifier APIs

Every public compiler/verifier accepts `unknown`, snapshots it with bounded
canonical JSON, validates strict schemas, loads code-owned catalogs by exact
identity, and returns typed diagnostics.

The public stages are:

```ts
compileStackSemanticSourceRulesCatalogV1(releaseInput)
verifyStackSemanticSourceRulesCatalogV1(verificationInput)
resolveProductDeliverySelectionV2(selectionInput)
verifyProductDeliverySelectionV2(verificationInput)
deriveSemanticSourceIntentSetV1(authorityInput)
verifySemanticSourceIntentSetV1(verificationInput)
compileSemanticSourceDeclarationsV1(authorityInput)
verifySemanticSourceDeclarationsV1(verificationInput)
compileImplementationSourceMapV2(authorityInput)
verifyImplementationSourceMapStoryProofV2(verificationInput)
```

Successful results are recursively immutable and expose distinct payload hashes
and full-envelope CAS hashes. Full envelopes pass bounded artifact-store batch
preparation before they can be returned as publishable.

The first shadow compiler may receive release identity as bounded input, as the
current adapter registry does. Production admission remains blocked until code
SHA, platform bundle, semantic-rule catalog, parser contracts, and external
resolution are derived from typed verified release manifests rather than
caller-supplied hashes.

Diagnostics are canonical, bounded to 100 entries including an overflow
sentinel, and never use thrown caller values as text.

Manifest and leaf envelopes are individually bounded by the four-MiB CAS
limit. A manifest has at most 5,000 leaves; one leaf has at most 20,000 planned
slots and 100,000 semantic bindings. Proof depth and step orientation must equal
the deterministic tree for the declared leaf count. Root activation occurs
only after every referenced leaf CAS identity is proven in one DB authority
transaction.

## Compatibility And Cutover

Historical branch:

```text
ProductBuildPacketV1/V2 + StoryPlanV1 + ImplementationSliceV1
```

New-write branch after activation:

```text
ProductBuildPacketV3 + StoryPlanV3 + ImplementationSourceMapV2 proof
  + ImplementationSliceV2 + EvidencePlanV2 + HandoffV2 + ContextV2
```

PacketV3 and SliceV2 are not implemented in the first catalog slice. Before
their first live write, their current branch-only V1 witness fields are removed
and replaced by the one final V2 proof contract. Historical V1/V2 packet and
SliceV1 read/replay remains discriminated. No historical artifact is rewritten,
promoted, or silently projected into the new branch.

Rollback before cutover removes only shadow artifact refs and profile-selection
enablement.
Rollback after cutover drains new claims first and restores the previous whole
new-write release; it does not translate V3 attempts into historical attempts.

## Dependency-Order Implementation Program

1. Add this design and keep production NO-GO.
2. Implement strict StackSemanticSourceRulesCatalogV1 schema/compiler/verifier
   with four cross-class shadow rule sets and exact unresolved blockers.
3. Implement GeneratedSourceReceiptV2 for Stitch source and
   InvocationInputTransportV2 for CLI/API ABIs.
4. Implement required structural parser implementation, typed release manifest,
   activation receipt, and negative fixtures. Do not activate a catalog label.
5. Implement ProductDeliveryProfileV2 exact rules/activation-receipt binding and
   selection tests.
6. Implement pure SemanticSourceIntentSetV1 derivation and every-and-only
   coverage tests across utility, operations/data, game, CLI, and API fixtures.
7. Implement FileTreeManifestV2 and BuildTopologyV2 materialization/verification.
8. Implement SemanticSourceDeclarationsV1 and concurrent artifact-batch
   publication authority.
9. Implement StoryPlanV3, SourceMapV2 root/leaves/proofs, and least-privilege
   story proof verification.
10. Finalize ProductBuildPacketV3/ImplementationSliceV2 field replacement before
   their first live write and then resume
   EvidencePlanV2 -> HandoffV2 -> ContextV2.
11. Only after release manifests, DB provenance, typed receipts, recovery, and
    three-class clean evals may the new-write branch cut over.

## Test Matrix

Catalog unit tests cover strict parsing, exact stack/profile reproduction,
domain hashes, canonical order, duplicate rule ownership, invalid activation/
cardinality/path/locator combinations, unknown refs, hostile inputs, immutable
outputs, 4 MiB publication bounds, release drift, self-consistent blocker/domain/
topology forgeries, and rejection of an invented active label.

Intent tests cover exact semantic obligation closure, title/slug independence,
determinism, missing/extra/duplicate subjects, persistence exemptions, generated
source receipts, shared structural slots, and unsupported stack blockers.

Declaration tests cover every-and-only topology joins, ownership/grants,
current base hashes, absent paths, generated immutable hashes, overlapping
locators, undeclared writable paths, and no future writable hash.

Proof tests cover one/two/non-power-of-two story sets, reordered leaves, forged
root/leaf/sibling/index/count, global witness leakage, bounded proof work, and
fresh reproduction.

Integration fixtures cover:

- Vite utility with action input, state, and reload persistence;
- operations/data product with create/select/delete and shared registration;
- browser game with system/timer actions and durable high score;
- no-design Node CLI; and
- no-design Node API.

Production release still requires clean utility, operations/data, and browser-
game runs with zero new project-specific guards and canonical Mission Control
evidence.

## GO / NO-GO

GO for the isolated catalog schema/compiler/verifier and fixture slice.

NO-GO for source intent activation, setup topology replacement, packet/slice
version cutover, model dispatch, runtime evidence, retry, supervisor, Mission
Control, deploy, or live runs until their dependency stages pass independently.
