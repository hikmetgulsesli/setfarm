# Candidate Source and Private Build Authority V2 Design

Date: 2026-07-21
Status: Approved for isolated shadow implementation
Scope: Content-addressed candidate source authority and one-shot private Node build

## Context

The current no-design Node pipeline now closes:

```text
ProductSemanticsV2
  -> StoryPlanV3
  -> ImplementationSourceMapV2
  -> ProductBuildPacketV4
  -> ImplementationSliceV2
```

The slice correctly selects
`generated_sources_complete_no_model_dispatch`, but there is no authenticated
consumer that turns the private generated source tree into a candidate build.
The existing `CandidateBuildReceiptV2` is only a strict caller DTO. It has no
issuer, fresh verifier, private filesystem authority or runnable handle.

Two fields in that DTO are structurally wrong for the current pipeline:

1. `sourceBefore` and `sourceAfter` require `SourceRevisionV1`, whose `sha` and
   `treeHash` are Git object hashes. The generated private stage is not a Git
   repository and owns no commit.
2. `selectedBuildCommand` is shaped from BuildTopologyV1, while PacketV4 and
   SliceV2 bind BuildTopologyV3.1's exact direct Node/TypeScript command.

Filling the first field with a hash that merely has Git's textual shape or
projecting the second through a V1 adapter would recreate the upstream
specification failure that the new architecture is intended to remove.

BuildTopologyV3.1 also lacks a complete process policy. It names direct argv
and forbids a shell, but does not bind timeout, stdin, stdout/stderr bounds or
the outcome classification expected from the future executor. A receipt
cannot prove an operation more precise than the operation contract it cites.

## Decision

Use one content-first source and build authority chain:

```text
fresh ImplementationSliceV2
  + authenticated private source materialization
    -> CandidateSourceReceiptV1
    -> VerifiedCandidateSourceAuthorityV1       # branded, pathless
  + BuildTopologyV3.2 exact build operation
  + authenticated host toolchain and sealed environment
    -> CandidateBuildReceiptV2
    -> CandidateBuildAuthorityV2                # branded, pathless
    -> CandidateRuntimeBundleV2                 # later slice
```

The serialized receipts are evidence. The branded handles are operational
authority. Parsing a self-consistent receipt never creates a handle.

Git revision remains valid origin evidence for a future repository-backed
implementation branch, but it is not the universal source identity. The
universal retry/build identity is a canonical content-tree revision. A future
repository-backed source producer must lower its exact admitted source slots
to that same content-tree model under a new, explicitly discriminated source
receipt version; it must not make current generated-source V1 accept an
unimplemented union branch.

## Temporal Placement

EvidencePlanV2 is still compiled before model implementation. Candidate source
authority is produced after the source for the selected slice is final:

- for the current generated Node branch, final source already exists and the
  slice forbids model dispatch, so CandidateSourceReceiptV1 can be produced
  immediately after the pre-implementation plan boundary;
- for a future model-authored branch, the corresponding versioned source
  receipt is produced only after the implementation attempt closes its exact
  source slots.

The current shadow source/build implementation may be completed before
RegistryV2 and EvidencePlanV2 code because it remains non-runnable and
production-forbidden. Production orchestration may not execute it until the
pre-implementation plan and activation branch exist.

## CandidateSourceReceiptV1

CandidateSourceReceiptV1 has two deliberately different identities.

### Semantic content revision

`semanticRevision` contains:

- schema/version/contract hash;
- profile and logical repository root;
- exactly five present source inputs, canonically ordered by normalized
  locator:
  - `package-lock.json`;
  - `package.json`;
  - the profile runtime TypeScript source;
  - the profile generated-test TypeScript source;
  - `tsconfig.json`;
- for each entry: FileTree path ref, owner ref, role, normalized locator,
  media type, mode, content hash and byte length;
- the exact `.npmrc` absence commitment from FileTreeV3;
- FileTree manifest, BuildTopology logical build and PacketV4 envelope joins;
- runtime/test logical receipt and source-identity hashes;
- a domain-separated entry membership hash and `revisionHash`.

Dependencies are not source entries. CandidateBuildReceiptV2 separately binds
the verified dependency identity, toolchain and environment. This prevents a
physical npm attempt from changing semantic source retry identity.

`revisionHash` excludes private roots, device/inode values, timestamps,
materialization receipt hashes, stdout/stderr and attempt identifiers. Two
private attempts containing the same five bytes and absence commitment must
produce the same revision hash.

### Operational materialization evidence

`materialization` binds:

- the exact Node product source materialization receipt and receipt hash;
- scaffold base and dependency receipt hashes;
- runtime/test publication and CAS verification receipt hashes;
- private root and source-directory physical identity hashes;
- admission scope and the path-disclosure-forbidden policy.

The outer receipt hash includes both semantic and operational sections. Two
equivalent private attempts may therefore have different receipt hashes while
retaining one revision hash. Retry, dedupe and unchanged-source suppression use
the revision hash, never the outer operational receipt hash.

The V1 compiler accepts a full ImplementationSliceV2 verification input and an
authentic `MaterializedNodeScaffoldPrivateStageV2`. It fresh-verifies the slice,
requires the no-model-dispatch disposition, revalidates the private source
materialization and derives every source entry itself. It accepts no caller
path, source entry, revision hash, Git SHA or receipt body.

The verifier repeats compilation and requires canonical byte equality with the
candidate receipt/envelope. On success it returns an opaque
`VerifiedCandidateSourceAuthorityV1`. The handle stores the authentic private
stage, a bounded immutable verification input and the reproduced receipt in a
private WeakMap. Its public surface contains hashes only.

## BuildTopologyV3.2 Process Contract

Before candidate execution, BuildTopology advances from `3.1.0` to `3.2.0`.
The schema major remains V3 because the artifact remains the same logical
topology, but every downstream hash is reproduced from the version-forward
contract.

The build command adds one exact `processPolicy`:

```ts
{
  stdin: "closed";
  timeoutMs: 120_000;
  maxStdoutBytes: 1_048_576;
  maxStderrBytes: 1_048_576;
  shell: "forbidden";
  ambientEnvironment: "forbidden";
  outputLimitDisposition: "typed_build_rejection";
  timeoutDisposition: "typed_build_rejection";
  nonzeroOrSignalDisposition: "typed_build_rejection";
}
```

The exact process policy is part of the BuildTopology command contract hash.
There is no caller timeout, environment overlay, cwd, command or output-limit
override.

The direct operation remains exactly:

```text
authenticated Node runtime
  node_modules/typescript/bin/tsc -p tsconfig.json
```

The serialized logical argv retains `node` as argv[0]. The private host
authority resolves it to the already verified Node binary and resolves the
compiler target only inside the authenticated private project. The operation
fresh-checks the compiler target's expected content and link identities before
spawn and after completion.

## CandidateBuildReceiptV2 Superseding Wire

There are no live CandidateBuildReceiptV2 artifacts. The schema-only V2 DTO is
therefore replaced before activation rather than supported through a dual
parser. The schema name remains `setfarm.candidate-build-receipt.v2`; its
component version advances explicitly and all current tests/fixtures move to
the superseding wire.

The receipt binds:

- PacketV4 envelope/hash and SliceV2 envelope/hash;
- CandidateSourceReceiptV1 receipt hash and stable semantic revision hash;
- BuildTopology V3.2 manifest/logical/command/compilation hashes;
- an exact V3.2 build-operation projection, not a BuildTopologyV1 shape;
- exact host Node identity, TypeScript target identity, dependency identity and
  sealed environment contract/effective-config hashes;
- source-before and source-after fences, both referring to the same candidate
  source receipt/revision and freshly reproduced physical materialization;
- typed process outcome `exited_zero`, exit code zero, null signal, bounded
  stdout/stderr hashes and byte lengths;
- an every-and-only `dist` output membership contract;
- the freshly captured CanonicalRuntimeTreeV2 output tree and its CAS envelope
  reference;
- a domain-separated receipt hash.

It contains no absolute path, mutable cwd, arbitrary capability list, caller
environment ref, Git-shaped placeholder, timestamp, log prose or future
runtime/evidence assertion.

The selected build-operation projection is derived from the verified
BuildTopology command and carries its exact contract hash. A schema-valid
caller operation cannot become authority without fresh topology reproduction.

## Private Lifecycle and Ownership

The private scaffold lifecycle becomes:

```text
sources_ready
  -> build_claimed
  -> building
  -> build_ready
  -> runtime_bundle_claimed             # later slice
  -> destroyed
```

Every transition is single-use. Any build spawn failure, timeout, output-limit
failure, nonzero/signal exit, source/dependency/toolchain/environment drift,
unexpected output or capture failure destroys only the authenticated private
attempt. No failed stage returns to `sources_ready`, and no retry runs unchanged
source in the same physical attempt.

The materializer owns project-root topology and source/output filesystem
capture. The execution-environment boundary owns the deny-all-then-exact-set
environment. The host-toolchain boundary owns the real Node executable. The
candidate builder coordinates brands and hashes but receives no caller path.

The materializer exposes one narrow internal build scope only after fresh
source/dependency validation. The scope contains the private project path for
the environment boundary, but the path never enters a receipt or public
result. Settlement consumes the scope on every process outcome.

Source revalidation becomes lifecycle-aware. Before spawn it requires exact
project membership with no `dist`. After spawn it admits only the exact
topology-owned `dist` root while independently reproducing scaffold assets,
dependencies and source physical/CAS identity. This is not a generic
ignore-extra-files rule.

## Output Authority

Before spawn, `dist` must be absent. After a zero exit, the materializer
requires exactly the two profile-owned output files:

- CLI: `dist/cli.js`, `dist/cli.setfarm.test.js`;
- API: `dist/app.js`, `dist/app.setfarm.test.js`.

No source maps, declarations, caches, hidden members, symlinks, hard links,
devices or extra directories are accepted. Output files are regular,
single-link, process-owned files. The builder normalizes admitted output to
read-only modes, clears code-owned Darwin metadata, fsyncs, and captures the
root with CanonicalRuntimeTreeV2 profile `dist`.

The canonical tree envelope passes exact tier-zero artifact-store preflight
and is published only through an authenticated artifact-store authority in the
isolated shadow operation. The CandidateBuildReceipt is created only after a
fresh tree reproduction. A private CandidateBuildAuthorityV2 handle retains
the exact physical output authority for the later runtime-bundle copy. The
serialized tree summary alone is never runnable.

## Compiler, Issuer and Verifier APIs

```ts
compileCandidateSourceReceiptV1(
  stage,
  { sliceVerificationInput }
): Promise<CandidateSourceCompilationResultV1>;

verifyCandidateSourceReceiptV1(
  stage,
  { sliceVerificationInput, candidateEnvelope, expectedEnvelopeHash }
): Promise<VerifiedCandidateSourceResultV1>;

buildCandidateV2({
  sourceAuthority,
  artifactAuthority
}): Promise<CandidateBuildResultV2>;

verifyCandidateBuildV2({
  buildAuthority,
  expectedReceiptHash
}): Promise<VerifiedCandidateBuildResultV2>;
```

Production and test-fixture entrypoints remain distinct. A test-fixture handle
cannot be promoted to production, and production APIs reject fixture metadata
probes. Public inputs are strict, bounded and proxy/accessor hostile.

`buildCandidateV2` accepts no serialized source receipt. It accepts the brand
returned by source verification. The builder fresh-revalidates that brand
before and after execution. `verifyCandidateBuildV2` reproduces the output tree
and all upstream brands; it does not merely parse and rehash the receipt.

## Failure Taxonomy

At minimum the source boundary emits typed failures for:

- invalid or hostile input;
- SliceV2/PacketV4/proof reproduction failure;
- unsupported implementation disposition;
- source materialization/CAS drift;
- source entry or FileTree closure mismatch;
- candidate receipt mismatch;
- unauthenticated, consumed or cross-scope handle.

The build boundary emits typed failures for:

- source authority rejection or unchanged handle replay;
- topology/command/process-policy mismatch;
- toolchain, compiler target, dependency or environment drift;
- `dist` present before build;
- spawn failure, timeout or output limit;
- nonzero or signal exit;
- source changed during build;
- unexpected/missing/unsafe output;
- canonical tree capture or CAS publication failure;
- candidate receipt mismatch;
- cleanup/physical ownership loss.

No failure class is derived from stderr regexes or GitHub prose. Process text
is bounded capture evidence only; the owner/code comes from the typed boundary
that failed.

## Compatibility and Migration

- Historical Git-backed V1 execution-attempt rows continue using
  `SourceRevisionV1`; they are not reinterpreted.
- The old schema-only CandidateBuildReceiptV2 test fixture has no durable/live
  artifact and receives no compatibility parser.
- BuildTopology V3.1 remains visible in Git history but has no active durable
  artifact branch. New shadow compilations use V3.2 and reproduce every
  downstream StoryPlan/SourceMap/Packet/Slice hash.
- Rollback reverts shadow admission to the prior commits. It does not convert
  V3.2 or candidate-source/build artifacts into older identities.
- Production activation stays forbidden; no database migration is needed for
  this isolated slice.

## Dependency-Order Implementation Program

1. Add this design and correct PlatformRelease/EvidencePlan wording so Git is
   origin-specific evidence, not universal candidate identity.
2. Add the BuildTopologyV3.2 process policy and update exact golden/downstream
   hashes.
3. Add CandidateSourceReceiptV1 schema, domain hashes and adversarial pure
   tests.
4. Add the fresh source compiler/verifier and branded pathless handle over the
   current private materializer.
5. Replace CandidateBuildReceiptV2's schema-only V1-command/Git fields with the
   exact source receipt and V3.2 operation bindings.
6. Add one-shot build lifecycle, private scope bridge, exact host Node/tsc
   runner, bounded typed process outcome and cleanup.
7. Add exact `dist` normalization/capture, CAS publication and branded build
   authority.
8. Integrate CLI/API and sibling-attempt fixtures; prove stable semantic source
   revision with distinct operational receipts.
9. Run focused, complete Product Compiler, execution component, TypeScript,
   contract and feature-branch guard checks. Keep production NO-GO.
10. Continue to CandidateRuntimeBundleV2 and launch authority only after this
    slice closes.

## Test Matrix

Pure source tests pin schema/contract hashes, exact entry order, content
revision determinism, operational receipt separation, strict parsing,
self-rehash rejection, bounded work and immutability.

Source integration tests cover fresh SliceV2 reproduction, current no-dispatch
disposition, five exact source files plus `.npmrc` absence, source/CAS/base/
dependency drift, cross-profile/cross-scope handles, sibling-attempt revision
convergence and consumed-handle replay.

Build command tests pin V3.2 process policy and command hash, and reject any
argv, cwd, environment, timeout, stdin, output or receipt-schema drift.

Build integration tests cover real CLI/API TypeScript compilation, exact two-
file output, canonical runtime-tree reproduction, CAS authority, source before/
after fencing, compiler/dependency/environment drift, preexisting/extra/missing
output, symlink/hard-link/mode/metadata attacks, nonzero, timeout, output limit,
spawn failure, crash-boundary cleanup and single-use concurrency.

End-to-end shadow integration reproduces
SliceV2 -> CandidateSourceReceiptV1 -> CandidateBuildReceiptV2 across at least
the CLI, one-story API, prerequisite API and entity-field API fixtures. Two
identical private attempts must have the same source revision, Packet/Slice and
build output tree identities while retaining distinct physical receipt hashes.

## Cutover Decision

Design and isolated shadow implementation are **GO**. Production build,
EvidencePlanV2 execution, runtime launch, DB activation and clean-run success
claims are **NO-GO** until candidate source/build/runtime brands, verified
release/RegistryV2, EvidencePlanV2, atomic artifact activation, typed recovery
and three-class convergence evals all close.
