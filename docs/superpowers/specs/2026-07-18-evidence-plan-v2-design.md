# Evidence Plan V2 Design

Date: 2026-07-18
Status: Approved for shadow implementation
Scope: Release-bound evidence adapter authority and compiler-owned typed evidence graph

## Context

The current branch-only `ImplementationSliceV2` closes PacketV3, story,
product, design, build, current source, dependency, and typed browser-input
authority. It does not yet carry the superseding semantic-source declarations
or a projectable SourceMapV2 proof, and it does not make the current evidence
path safe.
`EvidencePlanV1` accepts only SliceV1 and lowers
semantics to generic interactions. The V1 runner can therefore associate a
predicate with the first command of the same kind, cannot prove several
lifecycle outcomes, and cannot identify the exact semantic source binding that
must change after a failure.

The permanent correction is not another runner guard. Evidence execution must
be a deterministic compiler output whose nodes bind exact product semantics,
source slots, release-owned adapters, checks, and typed receipts.

## Decision

Use one superseding evidence chain for new writes:

```text
fresh-verified ImplementationSliceV2
  + release-bound EvidenceAdapterRegistryV1
    -> EvidencePlanV2                     # before implementation
    -> implementation
    -> CandidateSourceReceiptV1           # after implementation
    -> CandidateEvidenceContractV2
    -> EvidenceReceiptV2[]
    -> EvidenceBundleV3
    -> AcceptedCandidateV2
```

`EvidencePlanV2` is produced before the implement agent writes code. It cannot
contain a future source hash, final tree, runtime session, candidate receipt, or
timestamp. `CandidateEvidenceContractV2` is the later authority that joins the
verified plan to the actual final source receipt and runtime authority.

This temporal split supersedes any design in which EvidencePlanV2 consumes
`CandidateSourceReceiptV1`. Such a plan would either be unavailable to the
implement agent or would fabricate future source identity.

## Considered Approaches

### Project SliceV2 into EvidencePlanV1

Rejected. Projection loses typed control-slot/input identity, exact source
bindings, lifecycle semantics, and full semantic coverage. It would create a
second authority branch and preserve the classifier/retry failure mode.

### Let the implement agent author the evidence plan

Rejected. Agent output is a claim, not Setfarm authority. It also permits the
agent to omit hard behavior, choose a weaker adapter, or reinterpret a
predicate after implementation.

### Compile EvidencePlanV2 from the final candidate

Rejected. The implement agent must know the exact acceptance graph before
writing code. Candidate-specific facts belong in CandidateSourceReceiptV1 and
CandidateEvidenceContractV2.

### Compiler-owned pre-plan plus post-candidate contract

Selected. The plan is deterministic from already sealed semantic authority and
the release registry. The later contract resolves planned source slots against
the exact candidate without changing the plan or its required checks.

## Goals

- Bind every required entrypoint, command, route, surface, control slot,
  physical control, action, action input, state, persistence policy,
  observable, predicate, and source slot to exact evidence graph nodes.
- Resolve each node/check to exactly one release-owned adapter before model
  dispatch.
- Give the implement agent a minimal story plan with no global source-map
  witness and no unrelated story topology.
- Emit typed receipts that identify the exact semantic subject, node, check,
  adapter, lifecycle, environment, and candidate source authority.
- Make missing adapter support and duplicate support ownership compile-time
  blockers rather than runtime inconclusive success.
- Make unchanged-source retry suppression depend on typed failed evidence and
  exact source bindings, not GitHub prose or regex classifier output.

## Non-Goals

- Do not wire this shadow slice into the production implement loop.
- Do not start a Setfarm run, mutate live PostgreSQL state, resolve a PR thread,
  or rescue a generated repository.
- Do not remove V1 artifacts needed for historical replay.
- Do not weaken an existing evidence, review, QA, or final-test gate.
- Do not invent broad writable-path source bindings while SourceMapV2 is absent.
- Do not implement runtime browser, HTTP, CLI, persistence, visual, or download
  adapters in the registry/schema slice.

## Required Upstream Authority

Successful PlanV2 compilation requires a fresh verification of the final
ImplementationSliceV2 wire contract, including one projectable
`ImplementationSourceMapStoryProofV2`. SourceMapV2 must provide planned
semantic source slots for design and no-design products, including entrypoint,
action, state, persistence, predicate, and platform registration ownership.
The proof must reproduce from ProductBuildPacketV3, StoryPlanV3,
BuildTopologyV2, SemanticSourceDeclarationsV1, and the code-owned semantic-rule
catalog. The current V1-witness SliceV2 shape is replaced before its first live
write; a separately attached proof or dual wire shape is not authority.

The current `ImplementationStorySourceMapV1` is not sufficient:

- it embeds the full global SourceMapV1 witness in every story slice;
- it covers Stitch screen/control source projection but not all CLI/API,
  command, state, persistence, predicate, and recovery subjects;
- exposing it in ContextV2 violates least privilege; and
- substituting the story's full writable file set would make recovery broad and
  ambiguous again.

Until the SourceMapV2 proof exists, a PlanV2 compiler may implement schema and
fresh-verification plumbing but must return the typed blocker
`EVIDENCE_PLAN_V2_SOURCE_MAP_V2_REQUIRED`. It must never fall back to
SourceMapV1, inferred filenames, selectors, regexes, or prose.

## EvidenceAdapterRegistryV1

The registry is an immutable release artifact, not runtime discovery. It binds
adapter selection to the Setfarm code release, platform byte bundle, resolved
external dependencies, and environment capsule.

```ts
type EvidenceAdapterRegistryV1 = {
  schema: "setfarm.evidence-adapter-registry.v1";
  registryVersion: 1;
  producer: SemanticArtifactProducerV1;
  releaseAuthority: {
    codeSha: GitCodeSha;
    platformBundleHash: Sha256;
    externalResolutionHash: Sha256;
    environmentCapsuleHash: Sha256;
  };
  adapters: EvidenceAdapterDescriptorV1[];
  registryPayloadHash: Sha256;
};

type EvidenceAdapterDescriptorV1 = {
  adapterRef: StableReference;
  adapterVersion: string;
  owner: "setfarm-orchestrator";
  supportSignatures: EvidenceAdapterSupportSignatureV1[];
  receiptSchema: "setfarm.evidence-receipt.v2";
  runtimeDependencyRefs: StableReference[];
  toolchainHash: Sha256;
  runnerEntrypointRef: StableReference;
  adapterEntryHash: Sha256;
};

type EvidenceAdapterSupportSignatureV1 = {
  schema: "setfarm.evidence-adapter-support-signature.v1";
  stackPackBinding: {
    stackPackId: LowercaseStackPackId;
    stackPackVersion: string;
    stackPackContentHash: Sha256;
  };
  deliveryBinding:
    | { kind: "unprofiled" }
    | {
        kind: "profile";
        profileId: UppercaseProfileId;
        catalogVersion: string;
        catalogHash: Sha256;
      };
  invocationKind:
    | "command"
    | "browser_dom"
    | "cli_process"
    | "http_service"
    | "state_probe"
    | "persistence_lifecycle"
    | "visual"
    | "download";
  predicateKind: EvidencePredicateKindV1;
  evidenceCapabilityRefs: CapabilityId[];
  inputTransportSchemaRefs: string[];
  checkKind: EvidenceCheckKindReferenceV1;
  lifecycleMode:
    | "none"
    | "reload"
    | "process_restart"
    | "durable_readback"
    | "flow_isolation"
    | "download_completion";
  supportSignatureHash: Sha256;
};
```

Registry invariants:

- `releaseAuthority.codeSha` equals `producer.codeSha`.
- `registryPayloadHash` binds the exact strict payload without that field. The
  compiler separately returns `registryArtifactHash`, the SHA-256 identity of
  the full SemanticArtifactEnvelopeV1 bytes used by CAS/index/DB authority.
- Adapter refs are unique and canonically UTF-16 sorted. One release registry
  contains at most one active version for an adapter ref.
- Each support signature is one exact tuple. Independent support arrays are
  forbidden because their Cartesian product would authorize undeclared
  predicate/check/capability/lifecycle combinations.
- Support-signature hashes and adapter-entry hashes are domain-separated.
  Signatures are canonical by hash; one signature has exactly one adapter owner
  across the whole registry.
- One logical `(stackPackId, version)` or `(profileId, catalogVersion)` cannot
  carry conflicting hashes. Stack/profile identities and enabled capabilities
  must reproduce from canonical release catalogs.
- Input transports, check kinds, runner entrypoints, and runtime dependency
  refs come from exact code-owned enums; syntactically plausible unknown refs
  are rejected.
- The exported runner ABI binds each runner entrypoint to one invocation kind
  and an exact runtime-dependency profile. The exported exhaustive
  predicate-to-check mapping is the sole mapping PlanV2 may use.
- Compiler and verifier inputs are bounded canonical snapshots before Zod;
  proxies, accessors, cycles, sparse containers, excessive depth/work/bytes,
  and publication-incompatible Unicode become typed rejection results.
- The full envelope must pass artifact-store batch preparation, including the
  four-MiB CAS limit and DB producer identity rules. Returned payload/envelope
  snapshots are recursively immutable.
- Registry validation performs no filesystem scan, network discovery,
  environment probing, or fallback.

An EvidencePlan node has one exact requirement signature formed from its stack
pack, discriminated delivery binding, invocation kind, predicate kind, exact
capability set, exact input transport set, check kind, and lifecycle mode. An
adapter matches only when the complete canonical tuple equals one declared
signature. Cardinality zero is `EVIDENCE_PLAN_V2_ADAPTER_MISSING`. Duplicate
ownership is rejected while compiling or verifying RegistryV1, before PlanV2
selection; ordering never breaks a tie. A defensive internal `>1` assertion may
remain, but it is not a reachable public state under fresh registry authority.

The shadow compiler currently reproduces stack/profile catalogs and publication
compatibility. Production admission remains blocked until
`platformBundleHash`, `externalResolutionHash`, `environmentCapsuleHash`,
toolchain hashes, runner entrypoints, and runtime dependency refs are derived
from typed verified release manifests rather than supplied as compiler input.

## EvidencePlanV2

```ts
type EvidencePlanV2 = {
  schema: "setfarm.evidence-plan.v2";
  planVersion: 2;
  producer: SemanticArtifactProducerV1;
  packetHash: Sha256;
  sliceHash: Sha256;
  sliceAuthorityHash: Sha256;
  storyId: StoryId;
  adapterRegistryPayloadHash: Sha256;
  adapterRegistryArtifactHash: Sha256;
  semanticCoverage: SemanticCoverageV2;
  scenarios: EvidenceScenarioV2[];
  nodes: EvidenceNodeV2[];
  edges: Array<{ from: StableReference; to: StableReference }>;
  graphHash: Sha256;
  coverageHash: Sha256;
  registryProjectionHash: Sha256;
  planHash: Sha256;
};
```

`SemanticCoverageV2` contains canonical exact sets for entrypoints, commands,
routes, surfaces, control slots, controls, actions, action inputs with contract
hashes, entities with exact field-set/contract hashes, states, persistence
policies, observables, every story-contract predicate, predicate-source
relations, and SourceMapV2 source bindings. It must equal the complete story
proof in both directions. Missing and extra values are equally invalid.

Each scenario has a stable compiler-derived ref, an optional action ref, exact
canonical input values, and prerequisite node refs. Every verdict-bearing node
owns exactly one predicate/check and has:

- a compiler-derived stable node ref and typed evidence phase;
- exact semantic subjects and optional subject contract hashes;
- exact SourceMapV2 binding refs;
- one `(adapterRef, adapterVersion, adapterEntryHash,
  supportSignatureHash)` binding;
- one discriminated typed operation;
- canonical dependency node refs; and
- one required check with exact predicate, subject, assertion,
  required-receipt, postcondition, and `required_pass` policy authority.

Multiple checks compile to separate DAG nodes. A node never splices checks
served by different adapters. Adapter session preparation and cleanup are
runner-owned typed receipts outside verdict-node cardinality; they do not add or
remove semantic checks.

The typed operation union includes exact build/test/evidence command execution,
route navigation, browser control action, HTTP/CLI invocation, state capture,
persistence write/read/reload/restart lifecycle, observable assertion, visual
assertion, download assertion, and isolation/cleanup. Browser action input is
identified by `(controlSlotRef, controlRef, actionRef, actionInputRef,
contractHash)`. HTTP/CLI operations consume a future
`InvocationInputTransportV2`; they do not reuse DOM codecs.

The plan contains no free-form selector, target, shell command, source path,
future source hash, runtime session ID, timestamp, provider prose, GitHub text,
or agent-authored instruction. Exact commands and paths are referenced through
sealed build and source-binding authority.

## Compiler and Verifier Boundary

Public APIs accept raw authority and reproduce it internally. They do not trust
a serialized `{ verified: true }` marker.

```ts
compileEvidencePlanV2(input: {
  sliceVerificationInput: ImplementationSliceVerificationInputV2;
  adapterRegistryVerificationInput: EvidenceAdapterRegistryVerificationInputV1;
}): EvidencePlanCompilationResultV2;

verifyEvidencePlanV2(input: {
  sliceVerificationInput: ImplementationSliceVerificationInputV2;
  adapterRegistryVerificationInput: EvidenceAdapterRegistryVerificationInputV1;
  candidatePlan: unknown;
}): EvidencePlanVerificationResultV2;
```

Both APIs call `verifyImplementationSliceV2` and
`verifyEvidenceAdapterRegistryV1` themselves. Registry verification fresh
reproduces the candidate envelope from the release compiler input supplied by
verified release admission; a self-consistent envelope/hash is not sufficient
authority. The compiler then verifies exact release/stack/profile authority,
verifies the SourceMapV2 story proof, derives
coverage and graph, checks adapter cardinality, validates DAG/cardinality, and
emits a semantic artifact envelope. The verifier performs a fresh compile and
requires canonical byte equality with the candidate plan. A caller-provided
plan hash or mutable parsed object is never authority.

Diagnostics are typed, canonically sorted, and bounded. At minimum they cover
invalid input/envelope, slice verification failure, SourceMapV2 prerequisite or
proof failure, registry authority/hash failure, missing adapter or duplicate
registry ownership,
semantic coverage mismatch, graph cycle, orphan node/check, unsupported
operation/input/lifecycle, and candidate authority mismatch.

## CandidateEvidenceContractV2

After implementation, a separate compiler consumes:

```ts
compileCandidateEvidenceContractV2({
  planVerificationInput,
  candidateSourceReceiptVerificationInput,
  finalSourceRevision,
  runtimeAuthority,
});
```

The result binds exact PlanV2 and registry hashes, CandidateSourceReceiptV1,
final source commit/tree, resolved source slots, runtime release/environment
authority, and exact scenario/node/check set hashes. It cannot add, remove, or
weaken PlanV2 checks. A candidate with missing, duplicate, ambiguous, or
unplanned source slots is rejected before evidence execution.

## Agent-visible Context Boundary

HandoffV2 carries two deliberately different projections:

- verifier-only authority: full compiler inputs, packet envelopes, registry
  envelope, SourceMapV2 root/proof witnesses, and fresh-reproduction inputs;
- agent-visible ContextV2: exact story SliceV2 projection, planned story source
  slots, EvidencePlanV2, allowed files, dependencies, commands, and bounded
  acceptance summaries.

ContextV2 never includes the full global SourceMapV1/SourceMapV2 witness,
unrelated story leaves, registry entries not selected by the plan, or
operational secrets. Context serialization has an explicit byte limit and is
measured against utility, operations/data, and browser-game fixtures.

## Compatibility, Migration, and Rollback

Compatibility is discriminated, not projected:

```text
historical read/replay only:
  SliceV1 + PlanV1 + BundleV2 + AcceptedCandidateV1

new-write branch after cutover:
  PacketV3 + SliceV2 + PlanV2 + CandidateSourceReceiptV1
  + CandidateEvidenceContractV2 + ReceiptV2 + BundleV3
  + AcceptedCandidateV2
```

There is no V2-to-V1 projection, dual authority, runtime fallback, or in-place
artifact conversion. Attempt reservation freezes the artifact version branch.
Admission flips only after active V1 implementation/recovery attempts drain.
Rollback closes new V2 admission and leaves immutable V2 rows/artifacts intact;
it does not rewrite them as V1.

## Module Order

1. Add this design and correct the audit temporal wording.
2. Implement strict `EvidenceAdapterRegistryV1` schema, hash/reproduction
   validator, envelope helper, and adversarial tests. Keep it unreferenced by
   production runtime.
3. Implement semantic source rules, intents, declarations, StoryPlanV3,
   SourceMapV2 planned slot authority, and projectable story proof.
4. Replace the branch-only ProductBuildPacketV3 and ImplementationSliceV2
   V1-source-map fields before their first live write, then implement
   EvidencePlanV2 schema/compiler/verifier with no V1 fallback.
5. Implement CandidateSourceReceiptV1 and versioned source-slot parsers.
6. Implement CandidateEvidenceContractV2, EvidenceReceiptV2, adapters, DAG
   runner, BundleV3, and AcceptedCandidateV2.
7. Add HandoffV2/ContextV2 and atomically wire PacketV3 through evidence
   planning before any model dispatch.
8. Add immutable DB contract rows, typed retry/recovery ownership, Mission
   Control projection, cutover drain, and three-class clean-run evaluation.

## Test Matrix

Registry unit tests cover strict parsing, deterministic hash, canonical
ordering, duplicate refs/bindings, producer/release drift, tamper, unknown
fields, invalid capability/input/check/lifecycle values, and exact envelope
reproduction.

Plan compiler tests cover fresh SliceV2 verification, SourceMapV2 prerequisite,
exact semantic set equality, deterministic graph/hash, missing adapter and
duplicate registry ownership, exact stack/profile/runner resolution, input transport binding, graph cycles,
orphan nodes/checks, candidate tamper, and rejection of future source/runtime
fields.

Integration tests cover PacketV3 -> PreparationAuthorityV2 -> SliceV2 ->
PlanV2 -> HandoffV2 -> ContextV2 atomicity, final source receipt resolution,
typed evidence receipts, unchanged-source retry suppression, and recovery
ownership. Concurrency tests prove one immutable plan/contract branch per
attempt and no latest-generation re-read. E2E evals require clean utility,
operations/data, and browser-game runs without new project-specific guards.

## Cutover Decision

Shadow registry/schema work is GO. Production evidence and implement dispatch
remain NO-GO until SourceMapV2, PlanV2, CandidateSourceReceiptV1,
CandidateEvidenceContractV2, HandoffV2/ContextV2, immutable DB provenance, and
typed runtime receipts are implemented and reproduced. Missing adapter or
missing source authority is a blocker, never an excuse to run V1 silently.
