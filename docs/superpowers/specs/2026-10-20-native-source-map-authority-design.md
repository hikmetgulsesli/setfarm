# Native SourceMap assertion and generated-source authority

Root decision 2026-10-20: accepted bounded platform root fixes for original I5 case6. This continues the user-authorized full working Setfarm objective under Standing Owner Authorization v1. No additional product capability or approval request is needed. Actual retained evidence, alternative analysis and concrete interfaces below were independently prepared before selection.

Base: reviewed PR300 merged `4f74cb403bda4700c7e65c721fdd8567fe8ef147`. Existing sole writer remains `.worktrees/setfarm-dashboard-cutover-controller-20261007-v1`, branch `fix/native-source-map-authority-20261020`. Live stays SF5a/MC546. PR300 has focused qualified tests/review; no clean-main stockbuild or rollout of4f74 is claimed.

Root selects assertion Option A and generated-source Option A below. Shared ordering preserves complete original ProductSpec/observable authority; actual setup writer admits only strict indexed, validated, target/response/manifest-bound generated sources. Packet's accepted-attempt/converter/source/owner authority remains independently mandatory. Certificate membership alone is insufficient; no new schema, converter attestation threading or fifth writer argument is authorized.

Root sequence refinement: prove and fix assertion identity first with genuine existing SourceMap browser fixture; then prove the actual-writer generated-role defect before changing that writer. The two captured predicates are independent. A combined writer+noncanonical regression closes both. This avoids delaying the independent first causal witness on unrelated database fixture preparation. All native/DB/browser/build execution stays Root-owned. A guarded fixture refusal remains nonpass and cannot authorize allowlist/guard/runtime weakening.

## Context and completion contract

Actual sixth run `ec9d1dd4-76c4-4ebe-8436-83f83b4fb0c2` passed plan/design/stories/setup-repo then failed setup-build preclaim with two SourceMap codes. The first is sufficient at producer line 864: graph hashes phase/property-sorted assertions, SourceMap hashes raw ProductSpec order. Raw assertion hash `a0a29e7378997aad089462254d2b8d38ae8f0efbfb6d206efbf0857835fce4a7` differs from canonical graph hash `fe3560accc630c196f746c9a505eba93a3ab09a696f7013878a4cb9ff81cb7d0`. All directly retained selector/control/evidence/source comparisons match.

The second is sufficient at producer line 1006: actual setup certificate excludes generated TSX, because `setup-handoff.ts:470-476` scans only immediate stitch artifacts. Packet topology consequently assigns TSX role source, but SourceMap correctly requires generated. Existing native packet fixture manually lists TSX in certificate at `setup-build-packet-orchestrator-v2.test.ts:265`; it cannot detect the writer defect.

Completion requires (a) causally qualified RED and GREEN at both exact predicates, (b) unchanged rejection of value/phase/property/selector/evidence drift and unauthorized source/owner/hash, (c) a real actual-writer→packet positive using converter output and accepted-attempt source, (d) focused regression evidence and Root's clean build/review/delivery. It does not establish full8 GO or actual game runtime correctness.

## Design alternatives and recommendation

### Assertion identity

| Option | Effect and tradeoff | Decision |
| --- | --- | --- |
| A. Shared nonmutating phase/property canonicalizer, original observable hash plus canonical assertion payload/hash checks | Preserves graph output bytes and all original ProductSpec authority; one semantic ordering definition serves both producers; small additive checks | **Recommend** |
| B. Sort ProductSpec assertions during PLAN normalization | Alters ProductSpec and target hashes/accepted closures beyond the failed boundary; much wider compatibility surface | Reject for this fix |
| C. Remove assertion-hash check or replace with membership by phase/property only | Can miss changed expected/operator or original binding; weakens the gate | Reject |

Proposed helper file `src/product-compiler/observable-assertion-identity-v2.ts` exports exactly one pure function, using the existing graph rule:

```ts
export function canonicalizeObservableAssertionsV2<
  T extends { phase: string; property: string },
>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => {
    const a = `${left.phase}\0${left.property}`;
    const b = `${right.phase}\0${right.property}`;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
```

Do not deduplicate, rewrite expected/operator, sort nested expected arrays, or mutate the original array. Existing schemas already reject duplicate phase/property keys. Move the graph's private rule to this helper without changing graph bytes. SourceMap's affected block additionally requires:

```ts
const canonicalAssertions = canonicalizeObservableAssertionsV2(product.effect.assertions);
// In the existing mismatch condition, retain every other current conjunct:
|| graph.productObservableHash !== hashCanonicalJson(product.effect)
|| !sameCanonical(graph.assertions, canonicalAssertions)
|| graph.assertionsHash !== hashCanonicalJson(canonicalAssertions)
```

The graph schema independently binds its hash to its assertion payload, and StoryPlan projection already checks the full productObservableHash (`story-partition-v2.ts:257-269`). Explicit SourceMap binding keeps this local gate reviewable and independently fail closed. The ProductSpec/target raw lists and raw observable hash remain untouched. Reordering a valid original list changes its original authority hashes, but its faithfully produced canonical graph is still accepted; this is not permission to attach an old graph/closure to a changed ProductSpec.

### Generated source role

| Option | Effect and tradeoff | Decision |
| --- | --- | --- |
| A. Actual writer adds only strict index/source/target-admitted TSX; existing packet compiler independently proves accepted graph/converter/source closure | Fixes producer of missing certificate membership; survives both preclaim and onComplete rematerialization; no attestation schema/threading change | **Recommend** |
| B. Packet topology overrides role from its already admitted sources, leaving writer certificate incomplete | Small source diff, but leaves actual setup handoff describing generated TSX incorrectly and may hide certificate drift | Only if Root explicitly chooses compiler-owned role as contract; not default |
| C. Add every src/screens TSX, or change SourceMap to accept role source | Admits arbitrary handwritten/unindexed files or relaxes the failed gate | Reject |

Option A has a conjunctive authority chain, not a new certificate self-certification mechanism:

1. Real converter execution remains `executeAttestedStitchConverter(scriptPath, repo)` in `05-setup-build/preclaim.ts:182-228`; it snapshots bounded stable release bytes, executes a private immutable copy and returns the executed source. Do not replace this with a hash in context or the passed-result JSON.
2. Actual `materializeSetupBuildContracts(runId, repo, context, buildCommand)` reads story rows and resolves logical targets, then adds **only** source locators present in strict native SCREEN_INDEX that pass exact source validation and one matching resolved surface target. It retains existing immediate stitch artifact enumeration. It does not scan src/screens to grant membership.
3. Native packet assembly still verifies accepted attempt, projection receipt, deterministic graph, strict exact index, all action/control/observable identities, source validator and target/source topology (`setup-build-packet-orchestrator.ts:1555-1893`). It requires the attested converter object and exact bytes in SourceMap. The certificate's membership is necessary, not independently sufficient.
4. Exact topology content/owner and SourceMap generated role checks remain unchanged. No certificate claim may manufacture a source-map screen outside the accepted response/index/source set.

Recommended new pure admission helper `src/product-compiler/setup-generated-screen-admission-v2.ts` keeps the new validation out of the db-pg-importing writer module. Proposed interface (new, not an existing API):

```ts
export type SetupGeneratedScreenTargetV2 = Readonly<{
  storyId: string;
  role: string;
  path: string;
  surfaceId?: string;
  screenId?: string;
  source: string;
  sharedGrantRequestId?: string;
}>;
export type SetupGeneratedScreenSourceV2 = Readonly<{
  locator: string;
  text: string;
}>;
export function admitSetupGeneratedScreenSourcesV2(input: Readonly<{
  screenIndex: unknown;
  generationTargets: unknown;
  responseBindings: unknown;
  sources: readonly SetupGeneratedScreenSourceV2[];
  resolvedTargets: readonly SetupGeneratedScreenTargetV2[];
}>): readonly string[];
```

The helper parses existing `StitchScreenIndexV2Schema`, `DesignGenerationTargetsV2Schema`, `StitchTargetResponseBindingsV3Schema`; source inputs are exact bounded bytes read by the writer. For each indexed screen require exactly one targetRef, exact target hash, response screen ID/title, one unique source locator, and one source/manifest binding with role surface_component, matching root surface and screen and path, direct story ownership (no ambiguous direct owners). Invoke existing `validateStitchScreenSourceV2({screen, sourceText})`. Reject duplicates, extra index/screens/source entries, missing mappings and invalid source. Return a sorted unique list of exactly these locators. Do not infer root surface from label/file name or physical-control count. SourceMap/packet compilation still validates actual graph source identity and semantic story ownership; the helper does not substitute for it.

`setup-handoff.ts` should use a private wrapper to read strict native inputs only when a native graph/target/binding projection and SCREEN_INDEX exist. `context.product_semantics_version === "v2"` selects the native path. Pre-conversion calls with no index add no converted source locators, retaining today's preparation path. Once an index exists, missing/invalid native projection must fail with a bounded code such as `SETUP_GENERATED_SCREEN_ADMISSION_REJECTED`, not silently downgrade to a folder scan. Legacy/reference-only/no-design paths retain existing behavior.

Writer file reads must use existing `readRegularFileAtMostSync` (`src/lib/bounded-file-read.ts`) and normalized in-repo locators, check resolved root containment and stable path identity, with a 16 MiB per-source limit matching packet `readExactSource`. UTF-8 decoding must be fatal. The writer's local wrapper can follow packet `readExactSource`'s existing descriptor/path checks; do not import the entire packet orchestrator into setup-handoff or export a new unrestricted I/O API merely for reuse. Index count and total sources remain bounded by existing schemas. Validate before adding converted locators to the certificate; never store a caller-supplied trusted list.

No fifth parameter or new persisted attestation field is necessary. Both `writeSetupHandoff` in preclaim and `guards.onComplete` already call the same actual writer, so both get the correction. The writer alone does not prove an accepted provider attempt or executed converter: the unchanged packet path supplies those independent proofs. Root should reject this recommendation if it requires writer-local converter provenance rather than the end-to-end conjunctive chain; in that case choose explicit attestation threading as a separately sized design, including onComplete replay of immutable receipt bytes and schema changes. Context status strings are not an acceptable shortcut.

## Narrow File Map

Paths below are relative to Root's sole Setfarm writer after freeze release.

| Action | File | Responsibility |
| --- | --- | --- |
| Create | `src/product-compiler/observable-assertion-identity-v2.ts` | Pure nonmutating assertion ordering rule |
| Modify | `src/product-compiler/producers/design-graph-v2.ts` | Replace private canonicalAssertions with shared helper; graph output stable |
| Modify | `src/product-compiler/producers/implementation-source-map-v1.ts` | Bind original observable and canonical assertion payload/hash; retain all other gates and W1 changes |
| Create | `src/product-compiler/setup-generated-screen-admission-v2.ts` | Pure strict index/target/response/source/manifest admission |
| Modify | `src/installer/setup-handoff.ts` | Bounded native source reads; actual generatedDesignFiles producer invokes admission after resolving targets |
| Modify | `tests/product-compiler/implementation-source-map-v1.test.ts` | Genuine graph-producer assertion-order regression and mutation negatives; this suite uses real browser capture |
| Modify | `tests/product-compiler/setup-build-packet-orchestrator-v2.test.ts` | Actual setup writer→packet regression and certificate/ownership/source negatives using existing native fixture |
| Create | `tests/product-compiler/setup-generated-screen-admission-v2.test.ts` | Pure helper admission negative coverage; no db-pg, browser, child process or filesystem imports |
| Create | `tests/product-compiler/observable-assertion-identity-v2.test.ts` | Tiny pure conservation/order test: all complete values retained, original list unchanged |

No production orchestrator/preclaim/guards/schema change is planned under recommended option A. If existing APIs force an additional source change, stop that edit and update Root's File Map with the causal reason first. Existing `tests/setup-handoff-contracts.test.ts` can be run proportionally by Root but need not be edited for unrelated collision cases. Amend Root's canonical design/plan only after Root chooses this draft; do not copy this log as a claim of approval.


## Limits and downstream risks

The adjacent legacy slice assertion/raw order predicate is a latent, unexecuted risk. Do not edit it preemptively; if actual packet-to-slice continuation proves its failure, record exact evidence and amend this File Map first. PLAN typed-refusal transport and V2 evaluator/V3 snapshot compatibility are independently proven subsequent objectives, excluded from this wave.

No source-module extraction for the attested converter is yet approved. Static test author must inspect the preclaim import graph; if effectful or ownership-unsafe, report exact dependency and Root must amend the File Map before implementation. No source/guard changes to make a test launcher accept an arbitrary command.

No generated-project rescue, provider calls, paid activity, secret/ACL changes, live DB mutation, retry expansion, PM diagnostic execution, cleanup of old/new records, second source writer or main commits. Normal code-owned disposal of only this test's freshly owned resources remains existing fixture behavior; preserve new diagnostic roots and all original failure records. No full8 GO from offline tests.

## Self-review

The chosen contract keeps original ProductSpec hashes and existing source-map topology role generated strict. Every mapped source serves a captured predicate. Assertion canonicalizer is nonmutating, payload-preserving and does not deduplicate. No placeholder/API gap is treated as existing implementation. Exact pure/native test effect boundaries and original failed provenance are retained. Design/plan conflicts resolve against this Root sequence refinement.
