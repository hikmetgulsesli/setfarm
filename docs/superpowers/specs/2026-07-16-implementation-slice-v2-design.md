# Implementation Slice V2 Design

Date: 2026-07-16
Status: Approved for implementation
Scope: Pure ProductBuildPacketV3 story-closure compilation only

## Decision

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
