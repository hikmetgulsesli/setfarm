# Implementation Slice V2 Design

Date: 2026-07-16; superseding decision 2026-07-21
Status: Historical PacketV3 wire superseded; V4-native shadow wire approved
Scope: Explicit legacy retention plus one canonical ProductBuildPacketV4 story slice

## Historical Branch-Only Decision (Superseded)

ImplementationSliceV2 is the implement agent's single self-contained,
least-privilege authority. It is compiled directly from ProductBuildPacketV3,
ProductSpecV2, DesignInteractionGraphV2 when the packet uses Stitch,
BuildTopologyV1, StoryPlanV2, DesignSourceClosureV2, and exact operational
source evidence. V1 payloads are rejected rather than inferred or upgraded.

The slice embeds the exact PacketV3 payload and its canonical hash, exact child
payload hashes, the selected ProductStoryV2, and only the semantic objects that
close that story. It does not embed unrelated product, design, topology, or
story objects. An authority hash additionally binds the story, source revision,
current file set, dependency outputs, and optional recovery directive.

## Story Closure

The product contract contains the story's exact routes, surfaces, actions,
states, persistence policies, and required evidence predicates. It also closes
only the entities and optional evidence predicates referenced transitively by
those exact actions or persistence policies; no unrelated product objects are
admitted. Action inputs and control-slot placements remain inside exact
ProductActionV2 payloads.

For Stitch authority, the design contract contains the exact graph surfaces,
action bindings, physical controls, action-input bindings, and observable
bindings selected by the story. Product hashes, placement hashes, selectors,
and graph references must resolve back to the embedded ProductSpecV2 objects.
For `designSourceKind=none`, the graph and design contract are both null and the
closure must be the typed no-design-source variant.

Every reference embedded by ProductStoryV2 must resolve exactly once. Every
internal action reference must remain inside the story closure. The compiler
rejects missing, extra, ambiguous, or prose-derived semantics.

## Source and Ownership Authority

The compiler receives one exact source revision and a canonical snapshot for
every accessible path. Accessible paths are precisely the story-owned paths and
the paths conveyed by its declared shared grants. Each file carries presence
and content hash. Absent files use BuildTopology's path-specific absence hash.

Owned paths are writable. Granted paths are read-only unless the exact grant
contains `write`; writable shared paths remain explicitly distinguished. No
undeclared path is included. Dependency outputs must exactly equal
`story.dependsOn` and bind prior slice hash, output hash, terminal source
revision, and canonical file signatures. A changed shared dependency file is
accepted only when the owning dependency's output signature proves its exact
current bytes.

## Build and Runtime Authority

The slice embeds the exact stack/repository identity, delivery selection,
entrypoints, commands, capabilities, policies, runtime-data contract, and
runtime-evidence contract required from BuildTopologyV1. Runtime contracts and
their hashes must be paired and must equal PacketV3 hashes. Collections use
canonical UTF-16 order.

## Design-Source and Recovery Authority

The exact DesignSourceClosureV2 payload and hash are embedded. Stitch closure
must bind the same DesignInteractionGraphV2 payload hash as PacketV3 and carry
one accepted ProductCompilationAttempt output seal plus the canonical artifact
manifest and projection-receipt references. No-design closure cannot carry a
graph or attempt projection.

Recovery is optional. When present it embeds one valid FindingSetV1, the exact
current source revision, and a non-empty source delta with before and after
presence/content hashes. Finding set packet/story/source identity must equal
the slice. Before hashes must equal current files; after identity must differ;
all changes must target owned or explicitly shared-writable paths. Recovery
cannot introduce prose instructions or write access.

## Compiler Result and Verification

The pure compiler returns either a typed, canonically sorted diagnostic list or
an ImplementationSliceV2 plus `hashCanonicalJson(slice)`. Tests cover direct V2
success, deterministic ordering/hash, V1 rejection, packet/child hash forgery,
nullable graph rules, exact story closure, ownership/grants/current files,
dependency outputs, accepted design-source closure, runtime contracts, and
bounded exact recovery. Existing V1 compiler, runtime, and preclaim code remain
unchanged.

## Superseding V4-Native Decision

The PacketV3/StoryPlanV2/SourceMapV1 shape above is not the new-write
ImplementationSliceV2 authority. It remains exact read/replay and current V3
runtime compatibility only. Its schema/compiler move to explicitly named
`implementation-slice-v2-legacy` and `slice-compiler-v2-legacy` modules; the
current PacketV3 implementation-attempt assembly imports those legacy names
directly. No generic union, fallback parser, version inference, projection, or
silent adaptation is introduced.

The canonical new-write payload keeps artifact/schema major identity
`setfarm.implementation-slice.v2` but uses string `sliceVersion: "2.0.0"`.
The historical compatibility payload uses numeric `sliceVersion: 2`; the two
are mechanically discriminated and neither schema accepts the other. The
canonical producer pass is exactly
`product-compiler-implementation-slice-v2`. Its code SHA must equal both the
verified ProductBuildPacketV4 producer and the SourceMapV2 producer. The first
implementation is shadow-only and is not wired into the PacketV3 runtime,
preclaim, DB, agent dispatch, or Mission Control.

## Compact Artifact Graph, Not An Oversized Blob

The existing CAS envelope limit is four MiB. A SourceMap story leaf may itself
approach four MiB, its full proof may approach five MiB, and PacketV4 may
approach four MiB. Embedding PacketV4 plus the full proof/leaf inside one slice
would be structurally incapable of satisfying the existing CAS limit even if
small fixtures passed.

ImplementationSliceV2 is therefore one compact manifest in an exact artifact
graph. It contains:

- a PacketV4 binding with artifact/schema/contract/producer identity, packet
  payload hash, packet envelope hash/byte length, SourceMap root envelope hash,
  and SourceMap authority hash;
- one compact SourceMap story-proof binding with original proof hash, exact
  root identity, exact leaf reference, leaf payload hash, and exact audit path;
- exact story ID/hash and logical runtime/test source receipt bindings;
- exact compilation/command/runtime contract hashes;
- a code-owned implementation disposition; and
- exact blocker and validation sets plus a domain-separated slice hash.

It does not embed the Packet envelope, SourceMap root, story leaf envelope, or
another story. The compiler result returns the freshly verified Packet envelope
and one story proof/leaf as immutable context attachments outside the slice
payload. Later HandoffV2/ContextV2 fetches those exact CAS identities and
assembles the agent-visible Product Build Packet. A missing, wrong, oversized,
or non-durable attachment is a typed context blocker; it is never reconstructed
from prose or inferred filenames.

The compact graph avoids two false claims. Individual slice preflight is not
atomic artifact-set durability, and a caller-provided leaf envelope is not
authority merely because its hash matches the manifest. Production activation
requires one artifact-set transaction proving PacketV4, SourceMap root, exact
leaf, and slice durability together.

One story slice is also not product-level implementation completeness.
Candidate source/build authority may consume only the every-and-only
`ImplementationClosureV2` defined in
`2026-07-21-implementation-closure-v2-design.md`; it may not select an
arbitrary valid slice as a proxy for the complete product.

## Current Node Implementation Disposition

Current no-design Node CLI/API realizations are completely owned by the
code-owned runtime and test generators. Their FileTreeV3 has zero story/model
write grants. The V4-native slice therefore records exactly:

```text
mode = generated_sources_complete_no_model_dispatch
modelDispatch = forbidden
modelWritablePathRefs = []
runtimeOwner = OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2
testOwner = OWNER_NODE_PRODUCT_TEST_GENERATOR_V2
```

This is not a temporary guard. Dispatching an implement model when every source
realization is already generator-owned would invent write authority and create
the same retry ambiguity the architecture is removing. EvidencePlanV2 may
consume the slice to test the generated candidate, but no implement-agent turn
exists for this current disposition. A future explicitly model-authored
realization requires a separately versioned slice disposition backed by
SemanticSourceDeclarations; it cannot widen this schema with nullable paths.

Current operational source revision, worktree snapshots, dependency-attempt
receipts, stdout/stderr, timestamps, source materialization receipt, candidate
commit/tree, and recovery prose are absent. Candidate source/build/evidence
receipts join later. Retry consumes a future typed delta artifact that names a
failed evidence node, exact before authority, exact current authority, and one
expected delta; it does not mutate or append a recovery directive to the base
slice.

## Authority And Verification

The pure compiler accepts bounded strict `unknown` containing the exact
PacketV4 compiler authority, expected and candidate PacketV4 envelope, exact
SourceMap root envelope, one full story proof, story ID, and SliceV2 producer.
It first calls `verifyProductBuildPacketV4`, which freshly reproduces
SourceMapV2 and PacketV4. It then calls
`verifyImplementationSourceMapStoryProofV2` using the Packet-bound root hash.

Compilation succeeds only when all of these are exact:

- Packet envelope hash and body equal fresh PacketV4 authority;
- proof root identities equal PacketV4's root binding in both directions;
- proof leaf is the requested story and freshly reproduces from StoryPlanV3,
  realization, generated source bytes/receipts, and BuildTopologyV3;
- leaf SourceMap authority, logical source receipts, and execution hashes equal
  PacketV4;
- leaf source owners equal the code-owned runtime/test generators; and
- the leaf grants no model-writable path or declaration in the current branch.

The compiler derives the compact slice, strictly parses it, recursively freezes
it, creates one semantic artifact envelope, and runs exact tier-zero bounded
artifact-store preflight. It performs no write or dispatch. The public verifier
calls the compiler fresh, then requires expected slice-envelope hash and
candidate canonical bytes to equal the reproduction. A locally self-rehashed
slice remains only a candidate.

The exact readiness blockers are atomic artifact-set activation, authenticated
candidate evidence, EvidenceAdapterRegistryV2, EvidencePlanV2, and release
manifest authority. The slice cannot report production-ready while any remains.

## Migration And Rollback

The legacy move is code-only and byte-preserving: its schema, compiler output,
hashes, tests, and current V3 runtime behavior must remain unchanged. The new
canonical module has no production importer. No DB row, claim, source tree, PR,
service, or live run is changed during this slice.

Rollback before cutover deletes only new shadow V4-native SliceV2 refs/code and
restores canonical filenames to the legacy modules. Rollback after a future
cutover must first drain V4-native attempts and restore the whole previous
release; it never converts string-version V4-native slices into numeric legacy
slices. Historical artifacts remain immutable.

## Dependency-Order Implementation Program

1. Move the current PacketV3 schema/compiler to explicit legacy modules and
   update only its current runtime/tests to explicit legacy imports. Prove byte
   and regression identity.
2. Add strict bounded canonical SliceV2 schema, producer, contract hash,
   compact Packet/proof bindings, generator-owned disposition, hash closure,
   envelope, and recursive freeze.
3. Add pure compiler/verifier with fresh PacketV4 and SourceMap proof
   verification, individual CAS preflight, immutable verified attachments, and
   no write/dispatch surface.
4. Extend the five private-materializer fixtures and sibling-attempt case.
   Prove exact Packet/proof/source/execution joins, no model write authority,
   stable slice identity across operational attempts, strict legacy rejection,
   self-rehash rejection, bounds, and four-MiB publication safety.
5. Run legacy focused tests, V4 focused tests, execution-attempt tests, complete
   Product Compiler regression, TypeScript, English/path/diff checks, and the
   normal guarded build without bypass.

## GO / NO-GO

GO for isolated implementation of the compact V4-native slice plus explicit
legacy relocation. NO-GO for live runtime import, DB activation, model dispatch,
EvidencePlanV2 production use, Mission Control, deploy, or a new Setfarm run.
The next product-level authority after verified story slices is
ImplementationClosureV2. EvidencePlanV2 remains predicate/story scoped, while
candidate source/build execution consumes the complete closure and stays
downstream of the plan.
