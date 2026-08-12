# Implementation Closure V2 Design

Date: 2026-07-21
Status: Approved for isolated shadow implementation
Scope: Product-level every-and-only ImplementationSliceV2 completeness authority

## Context

ProductBuildPacketV4 binds one complete ImplementationSourceMapV2 root, while
ImplementationSliceV2 intentionally binds exactly one story proof. Candidate
source and build authority are product-wide: the generated runtime and test
sources are compiled once and the resulting candidate is exercised as one
product. A single story slice therefore cannot prove that every story in the
packet was admitted, verified and assigned an implementation disposition.

Binding CandidateSourceReceiptV1 directly to one slice would create three
false authorities:

1. a multi-story product could become build-eligible while another story was
   missing, duplicated or stale;
2. selecting a different valid story slice could produce a second canonical
   source revision for the same product bytes; and
3. retry identity would be story-selection-dependent even though the build
   and source tree are product-level.

No current artifact closes this boundary. SourceMapV2 proves every planned
story has one semantic leaf, and each SliceV2 proves one leaf is a valid
implementation unit, but no artifact proves every-and-only SourceMap leaf has
one freshly reproduced SliceV2.

## Decision

Insert one product-level `ImplementationClosureV2` between story slices and
candidate source:

```text
ProductBuildPacketV4 + ImplementationSourceMapV2 root
  + every freshly reproduced ImplementationSliceV2
    -> ImplementationClosureV2
    -> CandidateSourceReceiptV1
    -> CandidateBuildReceiptV2
```

The closure is a compact completion manifest, not another embedded build
packet. Its semantic identity is stable across physical private scaffold
attempts. It contains no filesystem path, Git revision, model transcript,
attempt receipt, timestamp, recovery prose or candidate source bytes.

The current V2 wire supports exactly the code-owned Node disposition
`generated_sources_complete_no_model_dispatch`. A future model-authored
implementation branch requires a separately versioned closure entry that
binds its verified source-delta result. It cannot widen this current wire with
nullable completion fields.

## Compact Closure Artifact

The closure envelope remains below the four-MiB semantic artifact limit. It
contains:

- the exact compact PacketV4 binding already carried by SliceV2;
- SourceMap root leaf count and story-set identity through that binding;
- a canonical story entry for every SourceMap leaf, in leaf-index order;
- one domain-separated story-entry hash and one ordered membership hash;
- one code-owned product implementation disposition;
- exact blocker and validation sets; and
- a domain-separated closure hash.

Each story entry binds:

- story ID, story hash and one-based story order;
- the exact SourceMap leaf reference, including leaf index, leaf-envelope hash
  and byte length;
- the exact SourceMap proof hash and compact SliceV2 proof-binding hash;
- SliceV2 envelope hash, slice hash and disposition hash; and
- its own entry hash.

The closure does not embed full PacketV4, SourceMap root, leaf/proof or slice
envelopes. Those remain separate CAS artifacts. The closure's compiled result
may return verified immutable attachments outside its payload, but those
attachments are context and publication inputs rather than duplicated wire
authority.

## Every-And-Only Invariants

Compilation succeeds only when all of the following are true:

1. PacketV4 and SourceMapV2 reproduce freshly from the supplied upstream
   product, source and topology authority.
2. Candidate slice count equals SourceMap root `leafCount` and StoryPlanV3
   `storyCount`.
3. Candidates are in exact SourceMap leaf-index order; no sorting repairs a
   caller error.
4. Every SourceMap story ID, story hash and leaf-envelope hash appears exactly
   once, with no missing, duplicate or extra candidate.
5. `storyIdSetHash` recomputed from closure entries equals PacketV4's bound
   SourceMap story-set hash.
6. Every candidate SliceV2 is freshly reproduced through the existing
   PacketV4 and SourceMap proof verifier and is canonically byte-equal to that
   reproduction.
7. Every slice binds the same PacketV4 envelope/root and the matching story
   proof at that exact index.
8. Every slice has the exact current generated-source/no-model-dispatch
   disposition and grants zero model-writable paths.
9. The closure entry membership, closure body, envelope and tier-zero
   publication preflight all preserve exact canonical identity.

Schema parsing proves internal closure and hashing only. It cannot establish
fresh upstream authority. A self-consistent caller-authored closure remains a
candidate until the public verifier reproduces the complete chain.

## Compiler And Verifier Inputs

The compiler receives one bounded strict object containing:

- closure, slice, packet and SourceMap producers;
- the shared PacketV4/SourceMap compiler authority;
- the candidate PacketV4 and SourceMap root envelopes plus expected PacketV4
  envelope hash; and
- a bounded canonical array of candidate slice envelope/hash pairs.

The caller does not supply proof bodies for each candidate. The closure
compiler obtains the canonical proof array from one explicit fresh SourceMapV2
reproduction; the independent PacketV4 verifier rechecks that same root. For
each exact index the closure uses the same pure SliceV2 sealer as the existing
compiler, then requires the candidate slice hash and canonical bytes to equal
that derivation. The sealer does not create authority by itself; only its use
behind these fresh upstream verifiers does. This prevents a caller from
choosing a different valid proof/story subset without making multi-story
verification quadratic.

The verifier accepts the same compiler authority plus expected closure-envelope
hash and candidate closure envelope. It compiles fresh, then requires envelope
hash and canonical bytes to match. Production and test-fixture entrypoints
remain distinct and preserve the private materializer admission scope.

## Identity And Retry Semantics

`closureHash` is the product-level implementation completion identity.
CandidateSourceReceiptV1 binds the closure envelope/hash, story-set hash,
membership hash and producer revision. It never binds a selected story slice.

Candidate source `revisionHash` remains the unchanged-source retry identity and
also binds the closure. Operational source materialization receipt changes do
not change either closure identity or semantic source revision. A real source
delta must change the future implementation closure and source revision; a
fresh physical attempt over unchanged bytes must not.

## Publication And Activation

The closure receives individual tier-zero artifact-store preflight only.
Production activation remains forbidden until one authenticated atomic
artifact-set transaction proves durability for:

- PacketV4;
- SourceMapV2 root and every referenced story leaf;
- every referenced SliceV2;
- ImplementationClosureV2;
- EvidencePlanV2 and later release artifacts.

The compact closure membership is the semantic input to that future atomic
transaction. It is not itself proof that any referenced artifact was written.

## Failure Taxonomy

The closure boundary emits typed failures for:

- hostile or oversized input;
- producer or admission-scope mismatch;
- PacketV4 or SourceMapV2 reproduction failure;
- missing, duplicate, extra or non-canonical story candidate;
- candidate slice schema/hash mismatch;
- fresh SliceV2 verification failure;
- cross-packet, cross-root, cross-story or cross-disposition mismatch;
- closure schema/hash mismatch; and
- individual publication-preflight rejection.

No failure is classified from agent prose, GitHub comments, stderr text or
regexes. The failing typed verifier owns the code and exact authority path.

## Migration And Rollback

ImplementationClosureV2 is shadow-only and has no current runtime, DB,
Mission Control or live-run importer. Existing legacy PacketV3 execution and
V4 shadow artifacts remain unchanged. CandidateSourceReceiptV1 is revised
before its first commit so no durable singular-slice source wire exists.

Rollback deletes the closure shadow schema/compiler/tests and restores the
CandidateSource design branch to NO-GO. It never projects a closure into one
arbitrarily selected slice and never reinterprets historical V3 runtime rows.

## Dependency-Order Implementation Program

1. Add this design and revise CandidateSource/Build authority to consume a
   product closure rather than one slice.
2. Add the bounded strict closure schema, producer, entries, membership hash,
   product disposition, closure hash, envelope and recursive freeze.
3. Add the fresh compiler/verifier using one SourceMap reproduction and
   every-and-only SliceV2 verification.
4. Integrate the five private-materializer fixtures, including one-story and
   multi-story products plus sibling physical attempts.
5. Prove missing, duplicate, extra, reordered, cross-packet, self-rehashed,
   oversized and hostile inputs are rejected.
6. Revise CandidateSourceReceiptV1 schema/tests/compiler to bind the verified
   closure and remove singular story-slice identity.
7. Run focused closure tests, full Product Compiler tests, TypeScript and
   contract checks, then invoke the normal feature-branch build guard without
   bypass.

## GO / NO-GO

GO for isolated shadow ImplementationClosureV2 schema/compiler/verifier and
CandidateSource schema correction. NO-GO for live orchestration, model
dispatch, candidate build execution, DB activation, Mission Control, deploy or
a new Setfarm run.
