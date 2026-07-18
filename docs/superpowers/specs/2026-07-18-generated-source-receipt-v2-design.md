# GeneratedSourceReceiptV2 Design

**Status:** approved dependency slice of the Product Semantics V2 authority
program; shadow-only until a typed release manifest and activation receipt exist.

## Decision

`StitchScreenIndexV2` remains the generated-screen semantic contract, but it is
not evidence that the generated source bytes in CAS are those bytes, that the
generator release is the expected release, or that every index entry has one
receipt. Add one `setfarm.generated-source-receipt.v2` artifact per exact screen
index entry. The receipt binds three distinct identities without conflating
them:

1. design authority: the exact `DesignSourceClosureV2`,
   `DesignGenerationTargetsV2`, `DesignInteractionGraphV2`, and
   `StitchScreenIndexV2` payloads;
2. byte authority: the exact generated UTF-8 bytes in a canonical
   `ByteBundleV1`, including raw content hash and byte length;
3. release identity: the exact converter implementation source hash and the
   caller's shadow generator-platform bundle hash.

The compiler accepts source authorities and bytes, never caller-authored
receipts. The verifier reproduces all byte artifacts and receipts from those
authorities and compares canonical publication bytes.

## Why the byte bundle is separate

`generatedSourceContentHash` is the SHA-256 of raw UTF-8 source bytes.
`generatedSourceArtifactHash` is the CAS envelope hash of the canonical
`setfarm.byte-bundle.v1` that owns those bytes. The receipt envelope has a third,
independent artifact hash. Reusing any one of these hashes for another role
would make a valid raw-byte claim indistinguishable from a valid semantic
receipt or CAS object.

The existing `ByteBundleV1` contract is reused. A new generated-source blob
format is deliberately not introduced.

## Compiler input

The strict compiler input is:

```ts
{
  producer: SemanticArtifactProducerV1;
  releaseAuthority: {
    schema: "setfarm.generated-source-release-authority.v2";
    codeSha: GitCodeSha;
    generatorPlatformBundleHash: Sha256;
  };
  generatorImplementationSource: {
    source: SourceArtifactRefV1; // scripts/stitch-to-jsx.mjs
    bytes: Uint8Array;
  };
  productSpec: ProductSpecV2;
  designSourceClosureInput: DesignSourceClosureCompilerInputV2; // kind=stitch
  screenIndexSource: {
    source: SourceArtifactRefV1; // src/screens/SCREEN_INDEX.json
    bytes: Uint8Array;
  };
  generatedSources: Array<{
    targetRef: GenerationTargetId;
    responseScreenId: string;
    source: SourceArtifactRefV1;
    bytes: Uint8Array;
  }>;
}
```

`producer.codeSha` must equal `releaseAuthority.codeSha`. The compiler freshly
runs `compileDesignSourceClosureV2`, `produceDesignGenerationTargetsV2`, and
`produceDesignInteractionGraphV2`; caller-provided final closure, targets, or
graph objects are not accepted as independent authority.
`generatorImplementationSource.source.hash` is the
`generatorImplementationHash`; it must reproduce from the exact converter
source text. `generatorPlatformBundleHash` is bound but is not declared trusted
by this slice. The future release manifest must prove it.

Raw byte inputs are copied before schema work, decoded with fatal UTF-8, and
required to round-trip byte-for-byte. The compiler input has a 128 MiB aggregate
raw-source budget. Every generated
source must be non-empty and at most 14 MiB. This is the largest single source
that fits the current nine-item atomic batch authority: seven 2 MiB chunks, one
bundle, and one receipt. This limit is a platform capacity invariant, not a
project-specific heuristic.

The byte boundary accepts only an exact `Uint8Array` or `Buffer` prototype. It
rejects proxies, subclasses, shared backing memory, and own properties that
shadow typed-array storage getters. Snapshotting calls the intrinsic
`%TypedArray%.prototype` buffer/length/offset getters with `Reflect.apply`; it
does not read caller-authored `buffer`, `byteLength`, `byteOffset`, or `length`
properties. Shared backing storage is detected with Node's realm-independent
typed-array intrinsic rather than `instanceof`, so a cross-realm
`SharedArrayBuffer` cannot be laundered by replacing its view prototype. Two
intrinsic-storage copies must agree before the owned buffer is accepted.

## Every-and-only joins

Compilation rejects unless all of these maps are one-to-one and every-and-only:

- generation target `targetId`;
- design graph source-authority `targetRef`;
- screen-index `projection.targetRef`;
- generated-source `targetRef`;
- response screen ID and generated source locator;
- target surfaces and design-graph surfaces;
- target physical controls and index physical controls;
- target action inputs and index input bindings;
- target observables and index observables.

For each entry, `validateStitchScreenSourceV2` must also prove that the exact
source AST implements that exact index entry. In addition, every graph surface
must resolve to exactly one returned JSX element carrying both its literal
`data-surface-id` and its graph-owned `data-setfarm-element-ref`; duplicate,
missing, mismatched, and uncontracted surface markers are rejected. This closes
the source-side proof needed before a receipt may expose a surface
`subject_ref` binding. The shared pure join lives in
`generated-source-authority-v2.ts` so later SourceMapV2 and receipt consumers do
not fork the same identity algorithm. Title text, basename, glob,
first-existing-file choice, DOM-ID guessing, and prose are never identity
inputs.

## Semantic identity closure

Every receipt carries this canonical closure and its domain-separated hash:

```ts
{
  schema: "setfarm.generated-source-semantic-identity-closure.v2";
  targetRef: GenerationTargetId;
  surfaceRefs: SurfaceId[];
  physicalControlRefs: ControlId[];
  actionRefs: ActionId[];
  actionInputRefs: string[]; // ACT_X.field
  observableRefs: ObservableId[];
  generatedElementBindings: Array<
    | { kind: "surface"; subjectRef: SurfaceId; elementRef: string; elementHash: Sha256 }
    | { kind: "physical_control"; subjectRef: ControlId; elementRef: string; elementHash: Sha256 }
  >;
}
```

All arrays are unique and strictly UTF-16 sorted. Element bindings cover every
and only surface and physical-control subject so the catalog's
`elementKeySource=subject_ref` locator is executable without inference.
`surfaceRefs` comes from the
exact generation target. Physical controls, inputs, and observables come from
the exact design graph and must match the index. `actionRefs` is the union of
the target's affecting actions, physical-control actions, action-input actions,
and observable actions.

## Receipt payload

Each receipt payload is:

```ts
{
  schema: "setfarm.generated-source-receipt.v2";
  receiptVersion: 2;
  contractRef: "GENERATOR_STITCH_GENERATED_SOURCE_V2";
  contractHash: Sha256;
  receiptRef: string;                 // GSRC_ + full 64-hex commitment
  entryCommitmentHash: Sha256;
  receiptSet: {
    schema: "setfarm.generated-source-receipt-set-commitment.v2";
    entryCount: number;
    entries: Array<{ targetRef: GenerationTargetId; entryCommitmentHash: Sha256 }>;
    commitmentHash: Sha256;
  };
  targetRef: GenerationTargetId;
  responseScreenId: string;
  generatedSourceLocator: NormalizedRelativeLocator;
  componentApiHash: Sha256;
  designSourceClosurePayloadHash: Sha256;
  generatorImplementationHash: Sha256;
  generatorPlatformBundleHash: Sha256;
  generatorExecution: {
    status: "unverified";
    blockerCode: "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED";
  };
  generatedSourceArtifactHash: Sha256;     // ByteBundleV1 envelope
  generatedSourceArtifactByteLength: number;
  generatedSourceByteLength: number;       // raw UTF-8 bytes
  generatedSourceContentHash: Sha256;      // raw UTF-8 bytes
  semanticIdentityClosure: GeneratedSourceSemanticIdentityClosureV2;
  semanticIdentityClosureHash: Sha256;
  stitchScreenIndexEntryHash: Sha256;
  stitchScreenIndexPayloadHash: Sha256;
  stitchScreenIndexSourceHash: Sha256;
  stitchScreenIndexSourceByteLength: number;
  generatedSourceBundle: {
    artifactType: "setfarm.byte-bundle.v1";
    envelopeHash: Sha256;
    envelopeByteLength: number;
    rawHash: Sha256;
    rawByteLength: number;
  };
}
```

`entryCommitmentHash` hashes the authority body without the content-derived
receipt ref or set commitment. `receiptRef` derives from that hash. The set
commitment hashes the target-sorted canonical list of every target/entry pair. Every receipt
in one compile carries the same count, leaf list, and commitment. This makes omission,
duplication, or cross-run receipt substitution detectable downstream without a
mutable registry.

## Publication and verification

For each generated source, compilation prepares one atomic CAS batch:

- durability tier 0: every canonical `ByteChunkV1` envelope;
- durability tier 1: the canonical `ByteBundleV1` envelope;
- durability tier 2: the generated-source receipt envelope.

The batch contains at most nine artifacts by construction. Compilation returns
the opaque prepared batch capability plus immutable artifact views; it performs
no write. Publication ordering across different sources is irrelevant because
each receipt is self-contained and all downstream consumers must require the
common every-and-only receipt-set commitment.

Verification accepts the original compiler input plus candidate publication
groups. It freshly compiles, prepares each candidate group through the same
batch-plan authority, and compares target set, occurrence count, plan identity,
canonical artifact identities, and canonical bytes. A receipt envelope alone
is insufficient verification.

Verification does not canonical-snapshot the complete multi-target candidate
set under one unrelated global byte limit. It first reproduces the expected
target set, then snapshots and verifies one target group at a time. Each hostile
group is capped by the exact canonical byte length of the fresh expected group
and by a hard 32 MiB per-group ceiling. The compiler runs the same per-group
capacity preflight, so it cannot emit a group that its verifier cannot ingest.
Publication views preserve the original chunk occurrence list, including
identical CAS chunks, while the prepared batch continues to compare normalized
identities plus exact occurrence count. Verification separately compares the
sorted multiset of `durabilityTier + canonicalByteLength + envelopeHash`, so a
candidate cannot keep the same unique CAS set and total count while moving one
duplicate occurrence from identity A to identity B.

## Shadow boundary

This slice does not:

- activate semantic source rules;
- prove the platform-bundle hash belongs to a released Setfarm build;
- publish CAS artifacts;
- change PacketV3, SourceMapV1, SliceV2, runtime reads, or live DB rows;
- clear either the parser-implementation or release-manifest blocker.
- claim that binding converter bytes proves those bytes produced the outputs.

Until a hermetic generator invocation receipt or deterministic fresh-run adapter
binds exact inputs, implementation hash, outputs, exit status, and execution
policy, web/game rule sets also retain
`SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED`.

The generated-receipt blocker may be discharged only by a later typed
activation receipt that binds verified receipt groups, the release manifest,
the parser implementation, the exact catalog/rule-set hashes, and its accepted
publication authority.

## Required negative evidence

Tests must reject at least: self-consistent forged index/source pairs that do
not match graph authority; missing/extra/duplicate target maps; stale closure
hashes; converter-source drift; platform-bundle substitution; raw source hash,
length, locator, screen, component API, semantic identity, bundle, receipt, or
set-commitment drift; candidate receipt without byte artifacts; duplicate
candidate artifacts; cross-target substitution; malformed UTF-8/Unicode;
missing/ambiguous source surface bindings; duplicate CAS chunk occurrences;
sparse arrays, typed-array storage accessors, subclasses, shared buffers,
proxies, cycles, oversized inputs, and mutation after compile. Outputs and
caller inputs must be byte-stable and compilation must not mutate caller state.
