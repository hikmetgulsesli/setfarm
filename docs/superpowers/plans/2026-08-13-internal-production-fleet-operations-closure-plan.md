# Internal Production Fleet and Operations Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one bounded ten-case Setfarm fleet, a resumable cold-operator rehearsal, and a reference-only closure packet while keeping Subproject B as the only run classifier, cleanup authority, final-release-epoch settlement evaluator, result store, private golden-report finalizer, and tracked-report materializer.

**Architecture:** The fleet catalog is one raw `GoldenCampaignV1` file, created idempotently from literal new-product cases and two immutable path-free Subproject C templates; it contains no pre-created fixture, repository, or remote identity. Subproject C supplies the authenticated assertion-enabled case executor and the sole per-intent attempt provisioner; Subproject E selects the next B-derived effective current-epoch result slot and persists only hash-only scheduling status, while Subproject B validates raw results plus authenticated committed timeout-reconciliation-pair authorities and evaluates the typed fleet settlement against one exact `GoldenFinalReleaseEpochV1`. Source code, tests, catalog, and runbook merge before any live fleet or cold-rehearsal action; live evidence and B's finalized report stay in fixed private content-addressed stores until one authenticated exact-base Setfarm docs claim materializes the reviewed six files. After that docs-only merge, an A-style private post-handoff receipt binds the operational epoch to the metadata-only documentation SHA without treating that SHA as a new accepted operational epoch; final acceptance additionally requires current clean Setfarm HEAD at that documentation SHA and current clean Mission Control HEAD at the operational Mission Control SHA, while historical resolution is archival only.

**Tech Stack:** TypeScript ESM, Node.js 22+, Zod, `node:test`, existing Setfarm golden contracts/result store, PostgreSQL client tools, macOS LaunchAgents, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-08-13-setfarm-mission-control-internal-production-closure-design.md`

## 2026-08-16 Execution Rebaseline

Product Build Authority V2 and `setfarm.run-operational-snapshot.v3` are already delivered inputs. Fleet and cold-rehearsal execution starts only from an execution-time exact clean synchronized Setfarm `main` descendant that retains reviewed Authority-V3 PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor, after contract-spine migration 31 is independently verified current, services are rebound through the code-owned zero-owner path, and a fresh clean prerequisite canary proves its one terminal-preclaim lifecycle. The historical `865a7157`/migrations-1-through-29 baseline and polluted run 2075 cannot authorize fleet capacity or acceptance.

Every E fleet/cold/docs preflight, scheduler transition, execution, recovery, status, finalization, and acceptance chain freshly resolves A's exact `InternalProductionPostRebindEntryAuthorityPairV1`, requires byte equality with the pair propagated B→C→D in `RecoveryOperationalAcceptanceV1`, and equality-binds it to the same execution-time source pair. Missing, stale, copied, cross-paired, or source-drifted successor authority blocks before capacity or mutation.

### Exact D-to-E post-rebind binding

The E scheduler/composition, fleet status/preflight guard, cold coordinator, pre-packet input, final-closure finalizer, and post-handoff verifier statically import without alias `InternalProductionPostRebindEntryAuthorityPairV1`, `resolveInternalProductionPostRebindEntryAuthorityV1`, and `verifyCurrentInternalProductionPostRebindEntryAuthorityV1` only from `./baseline-post-handoff-receipt-v1.js`. Before E's first D-import acceptance read, capacity/preflight/status seal, scheduler transition, cold action, docs/final-closure input, or mutation, production zero-input verifies A's successor, pair-only resolves it, resolves D's exact operational acceptance, and requires pair equality through D/C/B. No CLI, fleet/cold/final-closure input, port, guard issuer, or caller accepts either scalar locator.

`GoldenFleetStatusV1`, `GoldenFleetPreflightGuardV1`, fleet settlement/finalization, cold status/receipt, `InternalProductionFinalClosureInputV1`, packet/finalization, docs completion, and post-handoff/final-acceptance receipts repeat exact non-null `postRebindEntryAuthorityRef`/`postRebindEntryAuthorityHash`. Only an E status before authenticated D import has both null; every prepared/running/frozen/blocked/accepted successor has both non-null, with no half-null branch. Source-boundary/AST tests enforce the direct A imports and first-call order. Runtime/store tests reject caller locators, structural clones, stale-current A, A/D cross-pairs, null splits, pair drift through fleet/cold/closure/docs handoff, nested predecessor tamper, status/input/finalization tamper, or source mismatch before any capacity or publication effect. Status/preflight shell JSON extracts and byte-compares the pair with a fresh A verifier response but never feeds it back.

For every operational package command, the owning resolver supplies authenticated read-only `SETFARM_ROOT` and `SETFARM_ROOT_EXPECTED_SHA` bindings. The command independently proves that root is clean literal `main` and that `HEAD === refs/remotes/origin/main === SETFARM_ROOT_EXPECTED_SHA` before use; there is no workstation-path fallback.

## Global Constraints

- This is Subproject E. Begin source implementation only after reviewed A-D source changes are merged. Begin live fleet execution only after the E source PR is merged and both repositories are clean synchronized `main` builds.
- The canonical fleet artifact is exactly `evals/suites/internal-production-golden-fleet-v1.json`, and its root schema is B's `setfarm.internal-production-golden-campaign.v1`. There is no E fleet-manifest wrapper or second case schema.
- B alone admits/starts, collects canonical run evidence, reconciles immutable timeout observations into exact committed terminal reconciliation pairs, derives the effective-result projection, classifies, validates cleanup, counts trusted systemic causes across epochs, creates the final epoch, evaluates settlement, stores `GoldenRunResultV1` plus authenticated committed-pair authorities, privately finalizes the report, and materializes its exact tracked bytes in the docs claim.
- C alone authenticates `GoldenAssertionSubjectV1`, executes product assertions, provides the assertion-enabled one-case gateway into B, and owns the mandatory bug-fix post-PR review action/checkpoint adapter.
- E is only a catalog materializer, scheduler, hash-only status aggregator, cold-rehearsal coordinator, and reference-only final-packet writer. E never queries run rows, parses snapshots, derives a cause, judges an assertion, or creates a cleanup census.
- The fleet is exactly ten distinct new cases: two Node CLI, two Node Express API, two Vite/React, one stateful multi-page web, one browser game, one existing-repository bug fix, and one existing-repository security audit.
- The fleet campaign configures B `maximumConcurrency:2`; standard/matrix campaigns remain `1`. E never derives the ramp. On every status/pre-stage transition it imports and calls B's exact `deriveGoldenCampaignExecutionCapacityV1({campaign,campaignHash,finalReleaseEpoch,results,timeoutReconciliations,platform})` and stores its strict `GoldenCampaignExecutionCapacityV1`. B alone returns `eligibleMaximum:1` until the exact first-five current-epoch effective-result gate passes, then `2`, and never `3`. Historical results never unlock a new epoch. Separate CLI processes may durably coordinate/stage two distinct same-campaign/same-epoch cases only when B reports two; expected-predecessor status CAS and C/B admission prevent a third.
- A Setfarm-core or Mission-Control classification freezes new starts immediately. Three validated occurrences of one trusted systemic cause hash settle the campaign as blocked with B's existing repeated-root rule.
- Accepted fleet settlement requires exactly ten distinct terminal B effective results whose two release SHAs equal one B `GoldenFinalReleaseEpochV1`, at least eight of those current-epoch effective results `accepted`, no current-epoch effective result outside `accepted | generated_product_failure | provider_or_quota_failure | infrastructure_failure`, and clean B cleanup across every stored current or historical effective result. One original timeout plus its B-authenticated terminal replacement is one valid effective slot; both raw receipts remain immutable history. Historical epochs remain immutable cleanup and cumulative root-cause evidence but never fill, consume, freeze, or otherwise obstruct a final-epoch slot or allowed-failure budget. Historical cleanup failure can still block global settlement because cleanup is mandatory; the only historical classification that blocks current-epoch progress is the third validated occurrence of one exact systemic root.
- Never repair a generated project manually, revive a pre-fix run, weaken a gate, bypass a dirty/runtime guard, or commit a database dump, token, log, screenshot bytes, generated repository, or private runtime receipt.
- External production authority remains `false` and production admission remains `blocked`. Signed external distribution is deferred.
- Every private E store consumes B `resolveInternalProductionDataRootV1()`, whose only production root is the real mode-`0700`, non-symlink `${runtimeConfig.setfarmDir}/internal-production`. E appends fixed children only and exposes no root override. Private files are mode `0600`, no-follow, and link-count one. Package-root `.setfarm`, `setfarm/data`, and managed story worktrees are never private evidence roots.
- Every E owner-producing File Map entry imports A's exact seven-field row/manifest schema, registry assembler, phase-versioned activation store/head/resolvers, reservation APIs, category/census schema, and hashes. `golden-fleet-scheduler.ts` exports the literal nine-row `INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_E_V1` table and exact `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_E_V1` shown below. Every row has a distinct implementation ID/module-function/owner-key derivation even when categories repeat. A delegated B/C/D operation retains its producer's reservation, but every E phase/publication/process opens E's own row before its first byte and closes against its terminal authority; the database reaper never adopts the operation's process reservation. E's activation controller calls A's zero-input current resolver, consumes its exact `{head,receipt}`, fresh/equality-validates `headRef`/`headHash` and the bound predecessor receipt, and expected-predecessor advances A's sole head from `A+B+C+D` counts `11/10/6/16 = 43` to `A+B+C+D+E` counts `11/10/6/16/9 = 52`. Only after resolving that A-owned activation receipt/current head and E's content-addressed activation receipt does E call A's assembler and export `INTERNAL_PRODUCTION_OWNER_PRODUCER_REGISTRY_V1` plus `registryHash`. `golden-fleet-source-boundary.test.ts` is the first and only all-row check: it requires 52 globally unique implementation IDs/module-functions/owner-key derivations, exactly 35 covered categories, byte-equal census keys, every module in its owning File Map, and named begin/close AST order. Earlier A–D tests remain plan-local. Runtime tests race every E producer against B migration apply and A cutover and prove pending reservations block both fences while a held fence yields zero E/C/D writes.
- Every `bash` fence starts with `set -euo pipefail`. Plan/source-boundary tests parse every shell fence and reject a service, database, run/workflow, or Git mutation unless the immediately preceding command obtains a fresh code-owned authority guard and the mutating command consumes that exact canonical ref/hash. They specifically ban raw `launchctl`, raw workflow starts, and `git switch|checkout|pull|fetch|merge|reset|add|commit|push`; E uses only B/C/D guarded coordinators and owner-returned immutable claim/delivery receipts. The same tests reject a negative `rg` scan hidden in a pipeline, a match-then-exit expression followed by an unconditional-success fallback, `$(` anywhere in a `test`, `[`, or `[[` predicate, a `readonly`, `export`, `local`, or `declare` invocation, another outer command's argv, or a redirection, and any other masked/bare fallback; command substitution is allowed only in a standalone simple assignment or the enumerated status-aware `if VAR="$(negative scan)"` captures. Transcript fixtures prove that a match status `0` fails, only status `1` with exactly empty captured output passes, status `1` with output and statuses `2`/`127` fail, an upstream Git-diff failure stops before `rg` runs, every inner producer's injected nonzero status stops the fence before its consumer, both producers formerly embedded in every dual-substitution equality fail independently before the predicate, and nonempty tracked or untracked cleanliness output stops all later mutation and evidence publication.

---

The E producer manifest is literal and complete:

```typescript
import type {
  InternalProductionOwnerProducerManifestV1,
  InternalProductionOwnerProducerRowV1,
} from "./baseline-post-handoff-receipt-v1.js";

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_E_V1 = [
  { plan: "E", module: "src/internal-production/golden-fleet-scheduler.ts", function: "reserveGoldenFleetStageOwnerV1", implementationId: "e-fleet-stage-v1", category: "fleet-stage", ownerKeyDerivationId: "fleet-campaign-stage-coordination-v1", censusKeys: ["fleetStageCount"] },
  { plan: "E", module: "src/internal-production/golden-fleet-status-store.ts", function: "reserveGoldenFleetInflightOwnerV1", implementationId: "e-fleet-inflight-v1", category: "fleet-inflight", ownerKeyDerivationId: "fleet-campaign-case-attempt-v1", censusKeys: ["fleetInflightCount"] },
  { plan: "E", module: "src/internal-production/golden-fleet-scheduler.ts", function: "reserveGoldenFleetReviewOwnerV1", implementationId: "e-fleet-review-v1", category: "fleet-review", ownerKeyDerivationId: "fleet-result-review-transition-v1", censusKeys: ["fleetPendingReviewCount"] },
  { plan: "E", module: "src/internal-production/cold-rehearsal-v1.ts", function: "reserveColdRehearsalOwnerV1", implementationId: "e-cold-rehearsal-v1", category: "cold-rehearsal", ownerKeyDerivationId: "cold-campaign-epoch-attempt-service-v1", censusKeys: ["coldRehearsalOwnerCount"] },
  { plan: "E", module: "src/internal-production/cold-rehearsal-database-child-operation-v1.ts", function: "reserveColdDatabaseChildOperationOwnerV1", implementationId: "e-cold-database-child-operation-v1", category: "process", ownerKeyDerivationId: "cold-database-operation-generation-v1", censusKeys: ["ownedProcessCount"] },
  { plan: "E", module: "src/internal-production/cold-rehearsal-database-child-reaper-v1.ts", function: "reserveColdDatabaseChildReaperOwnerV1", implementationId: "e-cold-database-child-reaper-v1", category: "process", ownerKeyDerivationId: "cold-database-reaper-generation-v1", censusKeys: ["ownedProcessCount"] },
  { plan: "E", module: "src/internal-production/final-closure-packet-v1.ts", function: "reserveFinalClosurePublicationOwnerV1", implementationId: "e-final-closure-publication-v1", category: "artifact-publication", ownerKeyDerivationId: "final-closure-generation-publication-v1", censusKeys: ["publicationBatchCount", "artifactPublicationCount"] },
  { plan: "E", module: "src/internal-production/final-closure-post-handoff-v1.ts", function: "reserveFinalClosureDeliveryOwnerV1", implementationId: "e-final-closure-delivery-v1", category: "operational-delivery", ownerKeyDerivationId: "final-closure-post-handoff-service-v1", censusKeys: ["operationalDeliveryCount"] },
  { plan: "E", module: "src/internal-production/source-release-service-rebind-v1.ts", function: "reserveSourceReleaseServiceRebindOwnerV1", implementationId: "e-source-release-service-rebind-v1", category: "operational-delivery", ownerKeyDerivationId: "source-release-final-epoch-service-v1", censusKeys: ["operationalDeliveryCount"] },
] as const satisfies readonly InternalProductionOwnerProducerRowV1[];

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_E_V1 = {
  schema: "setfarm.internal-production-owner-producer-manifest.v1",
  plan: "E",
  rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_E_V1,
  manifestHash: hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan: "E",
    rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_E_V1,
  }),
} as const satisfies InternalProductionOwnerProducerManifestV1;

export interface InternalProductionFleetOwnerProducerManifestActivationReceiptV1 {
  schema: "setfarm.internal-production-fleet-owner-producer-manifest-activation.v1";
  phase: "A+B+C+D+E";
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  reviewedSetfarmSourceRef: CanonicalRef;
  reviewedSetfarmSourceHash: string;
  cleanSetfarmBuildRef: CanonicalRef;
  cleanSetfarmBuildHash: string;
  predecessorActivationRef: CanonicalRef;
  predecessorActivationHash: string;
  predecessorActivationHeadRef: CanonicalRef;
  predecessorActivationHeadHash: string;
  predecessorPhase: "A+B+C+D";
  predecessorProducerCount: 43;
  orderedPlans: readonly ["A", "B", "C", "D", "E"];
  orderedManifestHashes: readonly [string, string, string, string, string];
  planProducerCounts: readonly [11, 10, 6, 16, 9];
  producerCount: 52;
  activationRef: CanonicalRef;
  activationHash: string;
  activationHeadRef: CanonicalRef;
  activationHeadHash: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}

export type InternalProductionFleetOwnerProducerManifestActivationStatusV1 =
  | Readonly<{
      status: "absent";
      postRebindEntryAuthorityRef: null;
      postRebindEntryAuthorityHash: null;
      receipt: null;
    }>
  | Readonly<{
      status: "activated";
      postRebindEntryAuthorityRef: CanonicalRef;
      postRebindEntryAuthorityHash: string;
      receipt: InternalProductionFleetOwnerProducerManifestActivationReceiptV1;
    }>;

export function activateInternalProductionFleetOwnerProducerManifestSetV1():
  Promise<InternalProductionFleetOwnerProducerManifestActivationReceiptV1>;
export function resolveInternalProductionFleetOwnerProducerManifestActivationV1(
  input: Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>,
): Promise<InternalProductionFleetOwnerProducerManifestActivationReceiptV1>;
export function observeInternalProductionFleetOwnerProducerManifestActivationStatusV1():
  Promise<InternalProductionFleetOwnerProducerManifestActivationStatusV1>;
```

## Authority Interfaces

Subproject E consumes these exact B/C interfaces and does not redeclare their run-level semantics:

```typescript
import type { GoldenRunResultStore } from "./golden-run-store.js";

import type {
  GoldenCommittedTimeoutReconciliationPairAuthorityV1,
  GoldenProductAssertionContractV1,
  LoadedGoldenCampaignV1,
} from "./golden-run-contract-v1.js";
import {
  authenticateGoldenCommittedTimeoutReconciliationPairAuthorityV1,
  GoldenCommittedTimeoutReconciliationPairAuthorityV1Schema,
  GoldenProductAssertionContractV1Schema,
} from "./golden-run-contract-v1.js";

// Import B's exact docs-session ABI; E declares no session/receipt lookalike.
import type {
  GoldenDocsMaterializationCompletionReceiptV1,
  GoldenDocsMaterializationEntryCommitReceiptV1,
  GoldenDocsMaterializationEntryV1,
  GoldenDocsMaterializationExpectedContentHashesV1,
  GoldenDocsMaterializationOwnerEntrySelectorV1,
  GoldenDocsMaterializationSessionV1,
} from "./golden-run-report.js";
import {
  abandonGoldenDocsMaterializationSessionV1,
  beginGoldenDocsMaterializationSessionV1,
  commitNextGoldenDocsMaterializationEntryV1,
  completeGoldenDocsMaterializationSessionV1,
  inspectGoldenDocsMaterializationLeaseCensusV1,
  materializeFinalizedGoldenCampaignReportInSessionV1,
  resolveGoldenDocsLeaseRetirementReceiptV1,
  resolveGoldenDocsMaterializationCompletionReceiptV1,
} from "./golden-run-report.js";

// Import C's exact pointer resolver and runner identities without aliases.
import type {
  GoldenMatrixFinalizationPointerV1,
} from "./golden-matrix-finalization-pointer-v1.js";
import {
  resolveGoldenMatrixFinalizationPointerV1,
} from "./golden-matrix-finalization-pointer-v1.js";
import type {
  GoldenAssertionEnabledCaseExecutorV1,
  GoldenAssertionEnabledStagedCaseV1,
  GoldenMatrixPorts,
} from "./golden-matrix-runner.js";
import {
  createGoldenAssertionEnabledCaseExecutorV1,
  createGoldenMatrixPortsV1,
  resolveGoldenMatrixReceiptV1,
} from "./golden-matrix-runner.js";
import type {
  GoldenNonacceptedResultReviewAcknowledgementResolverV1,
  GoldenNonacceptedResultReviewAcknowledgementV1,
} from "./golden-nonaccepted-result-review-acknowledgement-v1.js";
import {
  createGoldenNonacceptedResultReviewAcknowledgementResolverV1,
} from "./golden-nonaccepted-result-review-acknowledgement-v1.js";

// Import D's exact operational gate, finalized-packet reader, and session writer.
import type {
  RecoveryFinalizedPacketV1,
  RecoveryOperationalAcceptanceV1,
} from "./recovery-packet.js";
import {
  createRecoveryFinalizedPacketResolverV1,
  createRecoveryOperationalAcceptanceResolverV1,
  materializeFinalizedRecoveryPacketInSessionV1,
} from "./recovery-packet.js";
import type {
  RecoveryDocsDeliveryAcceptancePortV1,
  RecoveryDocsDeliveryAcceptanceV1,
} from "./recovery-docs-delivery-acceptance.js";
import {
  createRecoveryDocsDeliveryAcceptancePortV1,
} from "./recovery-docs-delivery-acceptance.js";
```

E owns one strict readiness-v2 adapter and content-addressed external-distribution census authority; no downstream packet accepts the readiness CLI object directly, an untyped hash, or caller-authored evidence:

```typescript
import type {
  PlatformReleaseProductionAdmissionReadinessV2,
} from "../execution/schemas/platform-release-production-admission-readiness-v2.js";
import {
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2,
  canonicalPlatformReleaseProductionAdmissionReadinessV2,
  parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2,
} from "../execution/schemas/platform-release-production-admission-readiness-v2.js";

export type PlatformReleaseReadinessBlockerCodeV2 =
  (typeof PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2)[number];

export type ExternalDistributionBlockerCodeV1 =
  | "DEVELOPER_ID_IDENTITIES_UNAVAILABLE"
  | "NOTARIZATION_AUTHORITY_UNAVAILABLE"
  | "SIGNED_STAPLED_PACKAGE_UNAVAILABLE"
  | "INSTALLER_RECEIPT_PAYLOAD_AUTHORITY_UNAVAILABLE"
  | "AUTHENTICATED_INSTALL_HELPER_UNAVAILABLE";

export type ExternalDistributionObservationStatusV1 =
  | "blocked"
  | "unverifiable"
  | "satisfied";

export interface ExternalDistributionAuthorityObservationV1<
  Code extends ExternalDistributionBlockerCodeV1,
> {
  code: Code;
  status: ExternalDistributionObservationStatusV1;
  readinessReasonCodes: readonly PlatformReleaseReadinessBlockerCodeV2[];
  details: readonly string[];
  evidenceRefs: readonly CanonicalRef[];
  observationHash: string;
}

export type ExternalDistributionAuthorityObservationCensusV1 = readonly [
  ExternalDistributionAuthorityObservationV1<"DEVELOPER_ID_IDENTITIES_UNAVAILABLE">,
  ExternalDistributionAuthorityObservationV1<"NOTARIZATION_AUTHORITY_UNAVAILABLE">,
  ExternalDistributionAuthorityObservationV1<"SIGNED_STAPLED_PACKAGE_UNAVAILABLE">,
  ExternalDistributionAuthorityObservationV1<"INSTALLER_RECEIPT_PAYLOAD_AUTHORITY_UNAVAILABLE">,
  ExternalDistributionAuthorityObservationV1<"AUTHENTICATED_INSTALL_HELPER_UNAVAILABLE">,
];

export interface ExternalDistributionBlockerV1<
  Code extends ExternalDistributionBlockerCodeV1,
> {
  code: Code;
  status: "blocked" | "unverifiable";
  readinessReasonCodes: readonly PlatformReleaseReadinessBlockerCodeV2[];
  details: readonly string[];
  evidenceRefs: readonly CanonicalRef[];
  observationHash: string;
}

export type ExternalDistributionCurrentClosureBlockerCensusV1 = readonly [
  ExternalDistributionBlockerV1<"DEVELOPER_ID_IDENTITIES_UNAVAILABLE">,
  ExternalDistributionBlockerV1<"NOTARIZATION_AUTHORITY_UNAVAILABLE">,
  ExternalDistributionBlockerV1<"SIGNED_STAPLED_PACKAGE_UNAVAILABLE">,
  ExternalDistributionBlockerV1<"INSTALLER_RECEIPT_PAYLOAD_AUTHORITY_UNAVAILABLE">,
  ExternalDistributionBlockerV1<"AUTHENTICATED_INSTALL_HELPER_UNAVAILABLE">,
];

export type ExternalDistributionPreflightBindingV1 = Readonly<{
  evidenceRef: CanonicalRef;
  evidenceHash: string;
  readinessV2Hash: string;
  observations: ExternalDistributionAuthorityObservationCensusV1;
  blockers: ExternalDistributionCurrentClosureBlockerCensusV1;
  productionAuthority: false;
  productionAdmission: "blocked";
}>;

export type ExternalDistributionPreflightEvidenceV1 = Readonly<
  ExternalDistributionPreflightBindingV1 & {
  schema: "setfarm.internal-production-external-distribution-preflight-evidence.v1";
}>;

export interface ExternalDistributionPreflightEvidenceResolverV1 {
  resolve(input: Readonly<{
    evidenceRef: CanonicalRef;
    evidenceHash: string;
  }>): Promise<ExternalDistributionPreflightEvidenceV1>;
}

export function recordExternalDistributionPreflightEvidenceV1():
  Promise<ExternalDistributionPreflightEvidenceV1>;
export function createExternalDistributionPreflightEvidenceResolverV1():
  ExternalDistributionPreflightEvidenceResolverV1;
```

The existing `setfarm platform-release preflight --json` contract remains exactly `PlatformReleaseProductionAdmissionReadinessV2`; E never changes or pretends that CLI output is its closure evidence schema. The E recorder accepts the bounded parsed JSON value only from its code-owned adapter, invokes the existing exact readiness-v2 parser (this E adapter is the one new allowlisted internal-parser consumer), requires canonical reserialization, literal diagnostic/false/blocked authority, exact readiness hash, Darwin host, and the finite source reason-code order, then joins five new fixed host observations. No public E function or CLI accepts readiness bytes/stdin/path/ref, host observations, commands, or a fixture override.

`observations` always has exactly five members in the tuple order above, retaining every authority even if a future member becomes `satisfied`; this is the completeness census, not a blocker subset. The adapter maps readiness-v2 plus code-owned fixed host observers to configured Developer ID identities, notarization authority, signed-and-stapled package, installer receipt/payload, and authenticated install helper. Each member has one exact finite code, a status `blocked | unverifiable | satisfied`, readiness reason codes drawn only from the imported readiness-v2 tuple type, 1–8 sorted unique normalized details (1–256 UTF-8 bytes), 1–8 sorted unique `CanonicalRefSchema` refs from that code's fixed content-addressed observation family, and its recomputed observation hash. `blockers` is derived mechanically as the same ordered projection of exactly those observations whose status is not `satisfied`; it copies code/status/reasons/details/refs/hash byte-for-byte and contains nothing else. For this closure-generation schema, external distribution is intentionally deferred, so all five observations must be `blocked | unverifiable` and `blockers` is the exact five-member `ExternalDistributionCurrentClosureBlockerCensusV1` in the same order. A later versioned design may admit a satisfied observation and a shorter derived blocker tuple; v1 cannot silently change its census or tuple type.

`readinessV2Hash` equals the exact source receipt's `readinessHash`. `evidenceHash` is `hashCanonicalJson` of the strict evidence without its derived ref/hash, and `evidenceRef` is exactly `setfarm://internal-production/external-distribution-preflight-evidence/sha256/${evidenceHash}`. The resolver opens only that address with the private no-follow store, re-parses, rehashes, proves the five-member census completeness, readiness reason ordering, observation/ref relations, blocker projection, and returns frozen bytes. A missing/duplicate/reordered census member, arbitrary string reason, generic URI, path, URL, caller ref, cross-code ref, log, prose, secret, blocker not backed by one observation, or non-satisfied observation omitted from blockers is rejected.

The exact E command is `npm run acceptance:external-distribution-preflight -- record-readiness-v2 --json`. It accepts no other flag, argument, stdin, path, ref, hash, host observation, or command override. It calls the zero-input readiness-v2 observer through the adapter, records/reopens the strict E evidence, and expected-predecessor-CAS advances one fixed `external-distribution-preflight/current-ref.json` pair only after full verification. Cold rehearsal resolves that exact pointer/pair and then freezes it in its phase receipt; it never invokes or parses the public `setfarm` CLI itself. Equal same-readiness/observation bytes adopt; a changed host observation creates a new content address and advances the pointer without deleting history.

C exports `GoldenPostPrReviewActionPortV1`, `createGoldenPostPrReviewActionPortV1()`, and `createGoldenPostPrReviewLifecycleCheckpointV1({ actions })`. Its fixed `createGoldenMatrixPortsV1()` production factory supplies the complete five-adapter assertion bundle, result history, clock, post-PR action port, existing-repository attempt provisioner, repair resolver, and repair-consumption port while its harness structurally omits every caller override named above. The C gateway rejects caller-supplied assertion/history/clock/lifecycle/provisioning authority and internally binds the selected adapter, `ports.existingRepositoryAttempts`, and `createGoldenPostPrReviewLifecycleCheckpointV1({actions:ports.postPrReviewActions})` for the fleet bug-fix case. C's generalized checkpoint uses a code-owned allowlist and accepts the exact approved fleet tuple `campaignId:"internal-production-fleet-2026-08-14"` plus `caseId:"fleet-repository-bug-fix"`; a no-op checkpoint is forbidden for that profile, while non-bug-fix profiles receive no action-capable checkpoint. The E production composition root immediately passes the C-created ports to `createGoldenAssertionEnabledCaseExecutorV1(...)`; E scheduler and CLI constructors receive only that constructed narrow gateway, never `GoldenMatrixPorts` or any raw assertion/review/provisioning mutation port. The checkpoint accepts only B's exact open `post-pr-review` workflow-step claim generation, posts C's fixed actionable inline review through the exact PR/head/path/line authority, and returns B's lifecycle receipt; it cannot act for another case, campaign, or generation.

The C gateway exposes exactly `stage`, `executeStaged`, `recoverStaged`, and `collect`, while C's separate coordination module exposes `prepareGoldenStageCoordinationV1` and `resolveGoldenStageCoordinationV1`. E first prepares, status-persists, and reopens the strict pair. `stage({loaded,caseId,setfarmSha,missionControlSha,coordinationRef,coordinationHash})` reuses C's clean pinned release check, resolves that exact pair, and returns C's exact imported `GoldenAssertionEnabledStageOutcomeV1`: `{kind:"staged",staged}`, `{kind:"pre_run",resultRef,resultHash}`, or `{kind:"blocked",preflight}` where `preflight` is B's exact imported `GoldenBlockedPreflightResultV1`. Only the `staged` branch has C durably persist B's intent/outbox without an external start. E exhaustively switches on the discriminant and durably records the exact returned branch before continuing; a default/fallthrough is forbidden. C's no-replace coordination-to-outcome index makes stage idempotent: response loss repeats the same pair and returns identical outcome bytes without another result, intent, or outbox. `executeStaged({staged})` is the one fresh start seam after E has persisted and reopened a `staged` member; C alone delegates it to B `executePreparedGoldenCaseV1({prepared,ports})`. `recoverStaged({staged})` is the idempotent fresh-process finish/adoption seam, C alone delegates it to B lookup-only `recoverPreparedGoldenCaseV1({prepared,ports})`, and it never creates another logical launch. Both B functions return exact `GoldenPreparedExecutionOutcomeV1 = Extract<GoldenCaseExecutionOutcomeV1,{kind:"pre_run"|"run"}>` and rerun neither preflight nor capacity; E imports or calls none of those B prepared types/functions directly. The `pre_run` branch references C/B's already stored immutable configuration result and is never executed, recovered, or collected as a run. The `blocked` branch stores no B result, intent, outbox, or run. The result-producing staged methods store the exact returned B result through B `GoldenRunResultStore.put` and return only `{resultHash,resultRef}`. `collect` consumes C's already constructed exact nested B `GoldenCollectionPorts`, passes that value unchanged to B's exact collection boundary, stores the exact result, and returns only its hash/ref. E never constructs, narrows, casts, or structurally approximates collection/harness ports and receives no B persisted-intent/outbox structure, admission, starter, assertion, SQL, snapshot, classifier, census, or arbitrary review-mutation port.

For allowed nonaccepted results, E also imports C's exact `GoldenNonacceptedResultReviewAcknowledgementV1`, `GoldenNonacceptedResultReviewAcknowledgementResolverV1`, and `createGoldenNonacceptedResultReviewAcknowledgementResolverV1()` from `./golden-nonaccepted-result-review-acknowledgement-v1.js`. The read-only resolver exposes only `locateForRepairReceipt({repairReceiptHash}) -> {acknowledgementRef,acknowledgementHash}` and `resolve({acknowledgementRef,acknowledgementHash})`. E never declares an acknowledgement shape, accepts a caller acknowledgement ref/hash, or writes C acknowledgement authority.

E also imports, without redeclaration, B's exact `GoldenEffectiveRunResultProjectionV1` and `deriveEffectiveGoldenRunResultsV1({campaign,campaignHash,finalReleaseEpoch,results,timeoutReconciliations})`; exact types `GoldenCampaignExecutionCapacityV1` and `GoldenReasonCodeV1` plus value schema `GoldenCampaignExecutionCapacityV1Schema` only from `./golden-run-contract-v1.js`; and exact `GoldenBlockedPreflightResultV1` plus value `deriveGoldenCampaignExecutionCapacityV1({campaign,campaignHash,finalReleaseEpoch,results,timeoutReconciliations,platform})` only from `./golden-run-harness.js`. E imports exact `GoldenCommittedTimeoutReconciliationPairAuthorityV1`, `GoldenCommittedTimeoutReconciliationPairAuthorityV1Schema`, and `authenticateGoldenCommittedTimeoutReconciliationPairAuthorityV1(value)` only from `./golden-run-contract-v1.js`, plus unaliased exact `GoldenRunResultStore` only from `./golden-run-store.js`. It uses only that store's `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`, `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})`, and `resolveCommittedTimeoutReconciliationPair({authority})` reads; the resolved `{authority,pair,terminalResult,supersession}` values, in B index order, are the `timeoutReconciliations` passed unchanged to every B deriver. It never authenticates a structural clone, accepts a bare supersession, or opens/scans an index path. `GoldenFleetBlockerCodeV1` is exactly B's finite reason union plus the ten listed E scheduling literals; no status member, parser, schema, or CLI admits `string`. It additionally consumes `GoldenFinalReleaseEpochV1Schema`, `createGoldenFinalReleaseEpochV1({setfarmSha,missionControlSha})`, `reconcileTimedOutGoldenRunV1(...)`, `isGoldenRunCleanupExactlySettledV1(result: GoldenRunResultV1): boolean`, `GoldenDocsMaterializationCompletionReceiptV1`, and `resolveGoldenDocsMaterializationCompletionReceiptV1({receiptRef,receiptHash})`. It imports C's exact `GoldenAssertionEnabledStageOutcomeV1` only from `./golden-matrix-runner.js`. It consumes C's exact `GoldenStageCoordinationV1`, including its code-owned bounded `launchAttemptOrdinal:number`, `prepareGoldenStageCoordinationV1(...)`, and `resolveGoldenStageCoordinationV1(...)` only from `./golden-stage-coordination-v1.js`, plus C's exact `prepareGoldenExistingRepositoryTemplatesV1` whose finite `campaignId` union is only `"setfarm-mc-internal-production-v1" | "internal-production-2026-08-13" | "internal-production-fleet-2026-08-14"` and whose return is the immutable path-free template set, plus C's exact `GoldenRepairReviewReceiptV1` campaign variant, `GoldenRepairReviewReceiptResolverV1`, fixed production `createGoldenRepairReviewReceiptResolverV1()`, and `resolveGoldenMatrixReceiptV1({matrixReceiptRef,matrixReceiptHash})`. E never reimplements any of these authorities or opens C's receipt store directly.

## File Map

- Create `tests/internal-production/golden-fleet-b-contract.test.ts`: pin E to B's already implemented `fleet-threshold-v1` campaign/settlement/finalizer ABI without changing B.
- Create `tests/internal-production/golden-fleet-c-gateway-contract.test.ts`: pin E to C's already implemented assertion-enabled one-case executor without changing C.
- Create `tests/internal-production/golden-fleet-source-boundary.test.ts`: forbid local C gateway/ports declarations, pre-created fixture identities, local effective-result/timeout logic, raw store/index access, alternate docs-session writers, and alternate post-handoff recorders.
- Create `src/internal-production/fleet-owner-producer-manifest-activation-v1.ts` and `tests/internal-production/fleet-owner-producer-manifest-activation-v1.test.ts`: call A's zero-input current resolver, consume exact `{head,receipt}`, fresh/equality-bind predecessor head ref/hash and receipt, and expected-predecessor activate exact `A+B+C+D` count 43 to `A+B+C+D+E` count 52; enforce strict content-addressed E receipt/resolver/status, reviewed clean-source/build gate, crash/response-loss adoption, and before-any-E-producer ordering.
- Create `src/internal-production/external-distribution-readiness-v2-adapter.ts`, `src/internal-production/external-distribution-preflight-evidence-v1.ts`, `src/internal-production/external-distribution-preflight-cli.ts`, and focused adapter/CLI/evidence tests: parse the unchanged readiness-v2 receipt, join the exact five fixed host observations, record/resolve the complete census and exact blocker projection, and forbid arbitrary inputs/refs.
- Create `src/internal-production/golden-fleet-catalog.ts`, `src/internal-production/golden-fleet-catalog-cli.ts`, and focused tests: materialize the one raw B campaign.
- Create `src/internal-production/schemas/golden-fleet-status-v1.ts`, `src/internal-production/golden-fleet-status-store.ts`, `src/internal-production/golden-fleet-scheduler.ts`, and focused tests: hash-only scheduling status with exhaustive C staged/pre-run/blocked outcome persistence.
- Modify `src/internal-production/golden-run-cli.ts` and its test: add guard-returning `fleet-preflight`, guard-consuming `fleet-execute-next`, `fleet-collect`, `fleet-recover-inflight`, `fleet-reconcile-timeouts`, and `fleet-status`; add no report command.
- Create `src/internal-production/golden-fleet-preflight-guard-v1.ts` and `tests/internal-production/golden-fleet-preflight-guard-v1.test.ts`: strict content-addressed issue/resolve/one-use consume, expiry, replay, response-loss, and campaign/epoch/status/capacity/build/acceptance drift.
- Create `src/internal-production/cold-rehearsal-v1.ts`, `src/internal-production/cold-rehearsal-store.ts`, `src/internal-production/cold-rehearsal-restart-coordinator-v1.ts`, `src/internal-production/cold-rehearsal-restart-admission-v1.ts`, `src/internal-production/cold-rehearsal-database-child-operation-v1.ts`, `src/internal-production/cold-rehearsal-database-child-reaper-v1.ts`, `src/internal-production/cold-rehearsal-cli.ts`, and focused tests. Create `src/internal-production/internal-production-restart-phase-failure-v1.ts` with `tests/internal-production/internal-production-restart-phase-failure-v1.test.ts` as the sole all-scope content-addressed failure receipt/store/status/resolver owner, including exact cold/source/docs identity discriminants, `scopeIdentityHash`, no-replace publication, and expected-predecessor status CAS. Cold/source/docs modules are pair-wrapper consumers only: they resolve the shared pair under their exact identity then write their own failed state/status/journal wrapper; they declare no receipt/store/status/resolver authority. These modules import D's already merged shared restart authority/head and create no restart-helper executable, restart occurrence/index, D restart child/PID/marker writer, or direct `launchctl` seam. The named E database-child operation/reaper pair alone owns the separately fenced `pg_dump`/`pg_restore`/audit child-operation protocol.
- Create `src/internal-production/final-closure-packet-v1.ts`, `src/internal-production/final-closure-packet-cli.ts`, `src/internal-production/final-closure-post-handoff-v1.ts`, `src/internal-production/recovery-docs-delivery-adapter-v1.ts`, and focused tests.
- Create `src/internal-production/source-release-service-rebind-v1.ts` and `tests/internal-production/source-release-service-rebind-v1.test.ts`: own the literal `reserveSourceReleaseServiceRebindOwnerV1` manifest row, one `source-release-final-epoch-service-v1` reservation per service, one pre-prepare plus seven post-prepare strict pending states where only the locator-live target state carries mutable current identity, close-free E terminal core, post-core A close, completed source-rebind receipt, and pair-wrapper source failed union/member. The shared failure module alone owns failure status-head CAS.
- Create `docs/runbooks/internal-production-operator.md`.
- Require D's shared restart authority/helper, all-three-hook readiness plus atomic A-retirement/D-activation cutover authority, both finite B `d-ordinary-start|d-managed-restart` successors, and generic Mission Control startup consumer to be merged, loaded, and resolved before the E Setfarm branch; E creates no Mission Control startup source, B admission branch, or cutover branch.
- Create during source preparation `evals/suites/internal-production-golden-fleet-v1.json`.
- After live settlement, derive the closure generation from the accepted epoch hash plus C matrix, D recovery, and B fleet finalization hashes before rendering final JSON/Markdown; bind the single `docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/` six-path tuple through input, packet, finalization, B completion, and post-handoff, while B alone writes the fixed basenames in one immutable session.
- Modify `package.json`: include focused tests and add `internal:golden-fleet-catalog`, `acceptance:external-distribution-preflight`, `acceptance:cold-rehearsal`, and `acceptance:final-closure-packet`; the final-closure CLI owns the two fleet-manifest activation verbs below.

---

## Source Branch Gate

Before Task 1 changes any source, report branch name `feat/internal-production-fleet-closure`, base SHA, and Tasks 1–5 Setfarm path scopes to the owning Setfarm implementation claim. Only that owner creates/reserves the single canonical Setfarm writing branch/worktree. D's shared Setfarm authority/helper/hooks and serialized Mission Control generic startup-consumer PR must already be merged on clean synchronized `main`; E never allocates a Mission Control writer. Mission Control remains read-only for all E tasks. The Setfarm worker validates the assigned worktree without fetching, switching, or creating a branch:

```bash
set -euo pipefail
: "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
readonly E_SF_ROOT="$SETFARM_ROOT"
E_SOURCE_WORKTREE="$(git rev-parse --show-toplevel)"
readonly E_SOURCE_WORKTREE
test "$E_SOURCE_WORKTREE" != "$E_SF_ROOT"
cd "$E_SOURCE_WORKTREE"
E_SHELL_TEST_VALUE_001="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_001" = "feat/internal-production-fleet-closure"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
git merge-base --is-ancestor origin/main HEAD
E_SHELL_TEST_VALUE_002="$(git -C /Users/setrox/ai/setrox/mission-control branch --show-current)"
test "$E_SHELL_TEST_VALUE_002" = "main"
E_SHELL_GUARD_OUTPUT="$(git -C /Users/setrox/ai/setrox/mission-control status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_003="$(git -C /Users/setrox/ai/setrox/mission-control rev-parse HEAD)"
E_SHELL_TEST_VALUE_004="$(git -C /Users/setrox/ai/setrox/mission-control rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_003" = "$E_SHELL_TEST_VALUE_004"
```

Do not start a fleet run, restore a backup, or restart a service on this source branch.
After each Task 1-5 focused review passes, the owning Setfarm orchestrator stages only that task's listed Setfarm files and commits with its stated authorized handoff subject before the next task begins. Thus Task 6 broad build starts from a clean committed Setfarm feature branch; implementation workers themselves do not mutate Git. D's all-three-hook readiness/cutover pair, its nested A retirement/D activation pair, the loaded D Setfarm/Mission Control startup hooks, and both exact B admission successors are reviewed preconditions and are never authored by an E branch, claim, commit, or PR.

---

### Task 1: Pin E to B's Existing Fleet-Threshold Contract

**Files:**
- Test: `tests/internal-production/golden-fleet-b-contract.test.ts`

**Interfaces:**
- Consumes without modification: B `GoldenCampaignV1Schema`, `GoldenCampaignSettlementPolicyV1Schema`, `GoldenCampaignSettlementV1Schema`, `GoldenRunResultV1Schema`, exact `GoldenCommittedTimeoutReconciliationPairAuthorityV1` plus its schema/authenticator and store locator/resolver, `GoldenFinalReleaseEpochV1Schema`, `createGoldenFinalReleaseEpochV1(...)`, `deriveEffectiveGoldenRunResultsV1(...)`, `evaluateGoldenCampaignSettlementV1(...)`, and the existing no-extra-flag `finalize-report` command.
- Produces: one compatibility test that fails if E's catalog/scheduler assumptions drift from B.

- [ ] **Step 1: Write the B-consumer compatibility test**

Import B's schemas/functions and assert the existing fleet policy is exactly:

```typescript
const fleetPolicy = {
  kind: "fleet-threshold-v1",
  requiredTerminalResults: 10,
  minimumAcceptedResults: 8,
  allowedNonAcceptedClassifications: [
    "generated_product_failure",
    "provider_or_quota_failure",
    "infrastructure_failure",
  ],
  requireEveryResultCleanupSettled: true,
  rejectSystemicClassifications: true,
} as const;

assert.deepEqual(GoldenCampaignSettlementPolicyV1Schema.parse(fleetPolicy), fleetPolicy);
```

Assert the standard B policy remains `{kind:"all-cases-required-accepted-v1"}` and that the fleet uses only `fleet-threshold-v1`. Reject either old provisional name, a changed terminal/accepted threshold, changed tuple/order, changed cleanup/systemic literal, more/fewer than ten cases, or any case whose `requiredAcceptedResults` is not `1`.

- [ ] **Step 2: Pin the exact B settlement outputs**

Using validated B result fixtures and one exact `createGoldenFinalReleaseEpochV1(...)` value, assert B alone returns:

- `complete` with the byte-identical `finalReleaseEpoch`, `policy.kind:"fleet-threshold-v1"`, exactly ten current-epoch terminal results, accepted count `8..10`, the fixed ordered current-epoch nonaccepted tuple, `everyResultCleanupSettled:true` across current and historical results, `systemicResultCount:0`, and a settlement hash bound to `epochHash`;
- `in_progress` with the byte-identical `finalReleaseEpoch` for nine/eleven current-epoch results, seven current-epoch accepted results, acceptance supplied only by a historical epoch, duplicate subjects, nonterminal results, open/unavailable cleanup in either epoch, a current-epoch configuration/Setfarm/MC classification, or global owners; the historical-only case includes B code `GOLDEN_FINAL_RELEASE_EPOCH_ACCEPTANCE_INCOMPLETE`;
- `blocked` with the byte-identical `finalReleaseEpoch`, one B-validated repeated systemic hash accumulated across current and historical epochs, capped occurrence count `3`, and an epoch-bound settlement hash.

The test must call B `deriveEffectiveGoldenRunResultsV1({campaign,campaignHash,finalReleaseEpoch,results,timeoutReconciliations})` and then B `evaluateGoldenCampaignSettlementV1({campaign,campaignHash,results,timeoutReconciliations,platform,finalReleaseEpoch})`; it cannot reproduce timeout replacement, epoch partitioning, or settlement logic or construct a complete/blocked value directly. Add a regression with eight historical accepted plus two current accepted effective results and require `in_progress`, then add the remaining eight current-epoch slots and require completion while every historical hash remains cleanup/root-cause input. Add an original nonterminal timeout plus its exact committed B reconciliation-pair authority: the raw history contains both results, the projection exposes one effective subject/slot, and settlement accepts that slot only after `resolveCommittedTimeoutReconciliationPair({authority})` returns the authenticated terminal result/supersession pair and the replacement has exact cleanup.

- [ ] **Step 3: Pin B's sole finalizer ABI**

The private authority command remains:

```text
finalize-report --campaign evals/suites/internal-production-golden-fleet-v1.json --json
```

The compatibility test asserts `finalize-report` rejects `--release-sha`, `--mission-control-sha`, `--final-release-epoch`, `--epoch-hash`, `--finalization-hash`, `--fleet`, `--policy`, `--output`, and concurrency flags. It reads policy from the B campaign, loads `listCampaign(campaignHash)`, lists only `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`, authenticates every authority, fresh-resolves every pair through `resolveCommittedTimeoutReconciliationPair({authority})`, and derives the pre-build epoch through `createGoldenFinalReleaseEpochV1` from exact clean release observations, evaluates with the immutable raw results and exact resolved `timeoutReconciliations` plus that epoch, builds Setfarm then Mission Control, reobserves identical clean SHAs/zero global ownership, derives the authoritative identical epoch, and fresh-resolves the same authority sequence and reevaluates with the same raw results/reconciliations before private finalization. Its strict `GoldenFinalizedCampaignReportV1` binds the full `finalReleaseEpoch` and `epochHash`, ordered committed timeout-pair-authority/reconciliation/effective-result mapping, private report ref/hash, target path, source/build/platform/settlement identities, and `finalizationHash`; an unresolved timeout or epoch change between either observation fails before finalization. It leaves `docs/review-packets` unchanged. Pin B's separate exact `materialize-finalized-report --finalization-hash SHA256 --json` ABI: it accepts no campaign/release/epoch/path/root/content flag and may create the receipt-derived tracked report only inside the later Setfarm-owned clean docs claim after revalidating source/build/report identities. No E command constructs or supplies an epoch to `finalize-report`, and no E command writes the tracked golden report.

- [ ] **Step 4: Run the compatibility test and checkpoint**

```bash
set -euo pipefail
node --import tsx --test tests/internal-production/golden-fleet-b-contract.test.ts
git diff --check
```

Expected: PASS with no B source file changed. Authorized handoff subject: `test(acceptance): pin golden fleet authority`.

---

### Task 2: Materialize One Raw B Campaign and Pin C's One-Case Gateway

**Files:**
- Test: `tests/internal-production/golden-fleet-c-gateway-contract.test.ts`
- Create: `src/internal-production/golden-fleet-catalog.ts`
- Create: `src/internal-production/golden-fleet-catalog-cli.ts`
- Create: `tests/internal-production/golden-fleet-catalog.test.ts`
- Create: `tests/internal-production/golden-fleet-catalog-cli.test.ts`
- Create: `tests/internal-production/golden-fleet-source-boundary.test.ts`
- Create during reviewed source preparation: `evals/suites/internal-production-golden-fleet-v1.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: B `LoadedGoldenCampaignV1`, exact `GoldenProductAssertionContractV1`/`GoldenProductAssertionContractV1Schema`, B execute/collect/store, C `prepareGoldenExistingRepositoryTemplatesV1({campaignId:"internal-production-fleet-2026-08-14"})`, C's sole `GoldenExistingRepositoryAttemptProvisioningPortV1`, C `GoldenProfileAssertionIdsV1`, and C's authenticated assertion dispatcher.
- Consumes without modification: C `GoldenAssertionEnabledCaseExecutorV1` and `createGoldenAssertionEnabledCaseExecutorV1(...)`.
- Produces: `buildInternalProductionFleetCampaignV1(...)`, `materializeInternalProductionFleetCampaignV1()`, and one C-gateway compatibility test.

- [ ] **Step 1: Write failing gateway tests**

Consume C's already merged gateway. The contract/source-boundary test imports the exact type values `GoldenAssertionEnabledCaseExecutorV1`, `GoldenAssertionEnabledStageOutcomeV1`, `GoldenAssertionEnabledStagedCaseV1`, and `GoldenMatrixPorts` plus value exports `createGoldenAssertionEnabledCaseExecutorV1` and `createGoldenMatrixPortsV1` only from `./golden-matrix-runner.js`; it imports `GoldenStageCoordinationV1`, `prepareGoldenStageCoordinationV1`, and `resolveGoldenStageCoordinationV1` unaliased only from `./golden-stage-coordination-v1.js`, and exact `GoldenBlockedPreflightResultV1` only from B `./golden-run-harness.js`. It proves identity with those exports and rejects any E-local declaration/wrapper. Test that C's fixed production factory supplies the complete named five-adapter assertion bundle, one B result store/clock, one `GoldenPostPrReviewActionPortV1`, C's sole existing-repository attempt provisioner, C's repair resolver/consumption ports, and C's exact already constructed nested B `GoldenCollectionPorts`. `prepareGoldenStageCoordinationV1` creates no B intent/outbox/start. E persists/reopens the pair, then passes C's exact returned stage outcome through a compile-time exhaustive discriminant switch and persists the exact branch. `staged` persists/reopens one strict object with matching coordination and produces zero external start before publication; `pre_run` resolves and records the immutable B configuration result but creates no intent/outbox/run and never invokes execute/recover/collect; `blocked` records exact preflight but writes no B result or outbox. Response loss after C outcome durability but before E's outcome CAS re-calls stage with the exact pair and adopts the same union member bytes. Only `executeStaged` may make a first start, only after the fixture E store has durably reopened an exact staged object, and only `recoverStaged` adopts/completes that same durable operation after process loss. Both result-producing staged methods store the unchanged B result and return the store hash/ref. `collect` passes C's exact nested collection ports unchanged to B and can only resolve prior action/attempt authority read-only; E contains no structural collection-port literal, cast, wrapper, or compatibility overload. For the fleet bug-fix case, prove staged execution internally installs C's generalized `createGoldenPostPrReviewLifecycleCheckpointV1({actions})`, admits only the exact approved fleet campaign/case identity, observes the exact open `post-pr-review` workflow-step claim generation, performs the one C-owned fixed review action, and cannot settle `bug-review-retry-settled` with a no-op/wrong-campaign/wrong-generation/wrong-PR action. For either existing-repository case, B must fsync its persisted launch intent before C provisions that intent's fresh attempt; same-coordination/staged recovery is idempotent, while another coordination/retry/epoch cannot reuse its repository, remote, fixture identity, or provision hash. For every other case, prove no action-capable checkpoint fires. Test that no unavailable adapter or caller assertion/history/clock/lifecycle/provisioning override can be wired, every profile reaches its exact C adapter before B classification, a Mission Control SHA mismatch blocks before coordination, and no method returns a B intent/outbox, task, path, run row, assertion body, cleanup object, or review/provisioning mutation handle. Type-level production composition tests prove E's scheduler and CLI receive only `GoldenAssertionEnabledCaseExecutorV1`, not `GoldenMatrixPorts`; E does not modify or redeclare either C module.

- [ ] **Step 2: Write failing idempotent catalog tests**

Require the output root to parse directly through `GoldenCampaignV1Schema`; exactly ten unique case IDs and task hashes; profile counts `2,2,2,1,1,1,1`; the exact B `fleet-threshold-v1` policy pinned in Task 1; `maximumConcurrency:2`; `rootCauseRepeatLimit:3`; and exact B case assertion-contract bytes plus C assertion IDs. In particular, the two API cases embed B's closed inventory `/items` and appointment `/appointments` contracts, and the two Vite cases embed B's closed reading `/queue` and volunteer-shifts `/shifts` contracts. E imports those four exact contract identities and their schemas from B; it does not redeclare a generic `profile-owned-v1` substitute, infer a route from prose, or add a route/selector at execution time.

- `node-cli`: `cli-add-canonical-jsonl`, `cli-list-canonical-jsonl`, `cli-state-persists`, `cli-title-required`;
- `node-express-api`: `api-health-json`, `api-crud-roundtrip`, `api-validation-json`, `api-state-persists`;
- `vite-react-web`: `web-route-navigation`, `web-form-validation`, `web-keyboard-accessible`, `web-state-persists`, `web-console-clean`;
- `stateful-multipage-web`: `service-desk-list-detail`, `service-desk-edit-validation`, `service-desk-empty-not-found`, `service-desk-shared-state`, `service-desk-console-clean`;
- `interactive-browser-game`: `game-state-machine`, `game-keyboard-control`, `game-high-score-persists`, `game-console-clean`;
- `existing-repository-bug-fix`: `bug-before-failure`, `bug-scoped-source-delta`, `bug-verification-passes`, `bug-review-retry-settled`, `bug-worktree-clean`;
- `existing-repository-security-audit`: `security-traversal-finding`, `security-html-escaping-finding`, `security-scoped-remediation`, `security-verification-passes`, `security-residual-advisory-preserved`, `security-worktree-clean`.

Require the last two cases to embed the two exact deeply frozen templates returned by C and no fixture-attempt identity. For all ten cases, resolve and hash the complete `assertionContract` through B's exact schema and require the C dispatcher to receive that same frozen member. Reject any hard-coded fixture/attempt/repository/remote hash, SHA, URL, or ref; any assertion ID not equal to `GoldenProfileAssertionIdsV1[profileId]`; inventory on a path other than `/items`, appointments on a path other than `/appointments`, reading queue on a path other than `/queue`, volunteer shifts on a path other than `/shifts`, a swapped closed contract, a generic profile-owned replacement, a caller-selected route/selector/output/remote/owner/path/protocol; a template whose campaign is not `internal-production-fleet-2026-08-14`; or a second invocation whose canonical bytes differ.

Source-boundary tests require unaliased static imports of `GoldenProductAssertionContractV1` and `GoldenProductAssertionContractV1Schema` only from `./golden-run-contract-v1.js`, exact `satisfies GoldenProductAssertionContractV1` checks for all four constants, and byte equality between each catalog case and its named constant after schema parsing/freezing. Ban local contract interfaces/schemas, `as` casts, `Pick`/`Omit`, generic `profile-owned-v1` for these four cases, route/selector maps outside the four constants, dynamic/namespace imports, string replacement, task-text route extraction, runtime route probing/fallback, and any C adapter that invents a path not already present in the B contract.

- [ ] **Step 3: Implement the literal case catalog**

Use these exact ten task strings in order:

```typescript
export const INTERNAL_PRODUCTION_FLEET_TASKS_V1 = [
  "cli: Build an English task register with add --title and list commands. Blank title writes no stdout, writes exactly TITLE_REQUIRED followed by one newline to stderr, and exits 2. Success emits canonical JSON Lines, no stderr, exits 0, persists state for a later process, includes deterministic tests, and has no UI, listener, fixed port, authentication, or external service.",
  "cli: Build an English stock ledger with add --title and list commands. Blank title writes no stdout, writes exactly TITLE_REQUIRED followed by one newline to stderr, and exits 2. Success emits canonical JSON Lines, no stderr, exits 0, persists state for a later process, includes deterministic tests, and has no UI, listener, fixed port, authentication, or external service.",
  "api: Build an English inventory REST API with GET /health and create, read, update, and list item routes only under /items. Blank title returns exact JSON validation. Use only the injected loopback origin, persist state in SQLite across the product-owned restart test, include deterministic tests, and release every listener.",
  "api: Build an English appointment REST API with GET /health and create, read, update, and list appointment routes only under /appointments. Blank title returns exact JSON validation. Use only the injected loopback origin, persist state in SQLite across the product-owned restart test, include deterministic tests, and release every listener.",
  "vite: Build an English reading queue with exact application route /queue plus Home and Settings navigation, required-title validation, keyboard-operable controls, an empty state, local-storage persistence across reload, stable accessible labels, a clean console, and deterministic tests.",
  "vite: Build an English volunteer shift queue with exact application route /shifts plus Home and Settings navigation, required-title validation, keyboard-operable controls, an empty state, local-storage persistence across reload, stable accessible labels, a clean console, and deterministic tests.",
  "web: Build an English service desk with list, detail, edit, empty, and not-found behavior. Use at least four stories with detail dependent on the shared ticket entity foundation, persist shared ticket state, validate edits, expose stable accessible controls, keep a clean console, and include deterministic tests.",
  "game: Build an English keyboard-controlled canvas checkpoint game with explicit ready, active, paused, resumed, and terminal states. Expose the admitted deterministic input/state bridge, persist high score across reload, keep a clean console, avoid a fixed port, include deterministic tests, and release the runtime.",
  "Repair the seeded Unicode slug defect in campaign fixture fleet-bug-fix. Preserve evidence that Crème Brûlée initially fails to become creme-brulee, change only the declared slug source and regression test, run the exact fixture verification, settle one canonical actionable review retry, and leave the repository clean.",
  "Audit campaign fixture fleet-security-audit for path traversal containment and unsafe HTML comment rendering. Cite exact source evidence for both findings, repair only the declared path-policy, comment-renderer, and security-test scope, run the exact security verification, preserve the external dependency advisory as unresolved out-of-scope risk, and leave the repository clean."
] as const;

export const INTERNAL_PRODUCTION_FLEET_CLOSED_ASSERTION_CONTRACTS_V1 = {
  inventory: {
    kind: "node-api-resource-crud-v1",
    contractId: "inventory-items-v1",
    collectionPath: "/items",
    validPayloadId: "inventory-item-title-v1",
    invalidPayloadId: "inventory-item-blank-title-v1",
    expectedResponseId: "inventory-item-crud-response-v1",
  },
  appointments: {
    kind: "node-api-resource-crud-v1",
    contractId: "appointments-v1",
    collectionPath: "/appointments",
    validPayloadId: "appointment-scheduled-at-v1",
    invalidPayloadId: "appointment-missing-scheduled-at-v1",
    expectedResponseId: "appointment-crud-response-v1",
  },
  readingQueue: {
    kind: "vite-react-workflow-v1",
    contractId: "reading-queue-v1",
    routePath: "/queue",
    inputSelectorId: "reading-queue-title-input-v1",
    submitSelectorId: "reading-queue-add-button-v1",
    stateSelectorId: "reading-queue-list-v1",
    validPayloadId: "reading-queue-entry-v1",
    expectedStateId: "reading-queue-persisted-entry-v1",
  },
  volunteerShifts: {
    kind: "vite-react-workflow-v1",
    contractId: "volunteer-shifts-v1",
    routePath: "/shifts",
    inputSelectorId: "volunteer-shift-name-input-v1",
    submitSelectorId: "volunteer-shift-add-button-v1",
    stateSelectorId: "volunteer-shift-list-v1",
    validPayloadId: "volunteer-shift-entry-v1",
    expectedStateId: "volunteer-shift-persisted-entry-v1",
  },
} as const satisfies Readonly<Record<
  "inventory" | "appointments" | "readingQueue" | "volunteerShifts",
  GoldenProductAssertionContractV1
>>;
```

`buildInternalProductionFleetCampaignV1` accepts only the two schema-valid immutable templates returned by C's preparer. It uses case IDs `fleet-cli-task-register`, `fleet-cli-stock-ledger`, `fleet-api-inventory`, `fleet-api-appointments`, `fleet-vite-reading-queue`, `fleet-vite-volunteer-shifts`, `fleet-web-service-desk`, `fleet-game-checkpoint`, `fleet-repository-bug-fix`, and `fleet-repository-security-audit`. The first eight cases use `v3-feature-dev-canary`; the last two embed the returned full path-free templates in `canonical-existing-repository-workflow`. Every case embeds the exact B-owned assertion contract selected at catalog construction. Inventory, appointments, reading queue, and volunteer shifts use their four closed route-bearing B contracts byte-for-byte; other profile-owned cases use only their exact B contract variant with assertion IDs copied from `GoldenProfileAssertionIdsV1`, and CLI uses B's exact fixed CLI contract. C receives the already frozen contract and never invents `/items`, `/appointments`, `/queue`, `/shifts`, a selector, or a fallback route. No pre-created fixture identity, attempt receipt, repository/remote URL, route override, selector, or provisioning field is accepted from JSON, environment, argv, or a constant outside those imported contract values.

- [ ] **Step 4: Implement the fixed catalog materializer and CLI**

`materializeInternalProductionFleetCampaignV1()` calls C's immutable template preparer exactly once:

```typescript
const prepared = await prepareGoldenExistingRepositoryTemplatesV1({
  campaignId: "internal-production-fleet-2026-08-14",
});
```

The preparer returns exactly one deeply frozen `bug-fix` and one `security-audit` template whose `campaignId` is the requested finite literal and whose `templateSetHash` binds both. Catalog construction performs no fixture inspection, copy, Git init, baseline commit, GitHub authentication, remote creation, workflow-capability mint, or attempt provisioning. It then builds and re-parses one `GoldenCampaignV1`, and writes canonical JSON plus one newline only to `evals/suites/internal-production-golden-fleet-v1.json`. The repository root and target parent must be real non-symlink directories. Exclusive creation is required; identical existing bytes return the same campaign hash, while different bytes fail `GOLDEN_FLEET_CATALOG_COLLISION`. The source-boundary test fails if the catalog imports any fixture-attempt port, remote adapter, Git client, fixture inspector, legacy one-shot fixture materializer, or private-path capability; only the C template preparer may provide the two campaign members. The CLI is exactly:

```text
prepare --campaign internal-production-fleet-2026-08-14 --campaign-date 2026-08-14 --json
```

It rejects every other campaign/date, duplicate/unknown flag, and output/path/remote/fixture/attempt/provisioning/assertion override. Add:

```json
"internal:golden-fleet-catalog": "node --import tsx src/internal-production/golden-fleet-catalog-cli.ts"
```

- [ ] **Step 5: Run focused tests and materialize the reviewed source artifact**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
node --import tsx --test \
  tests/internal-production/golden-fleet-c-gateway-contract.test.ts \
  tests/internal-production/golden-fleet-catalog.test.ts \
  tests/internal-production/golden-fleet-catalog-cli.test.ts \
  tests/internal-production/golden-fleet-source-boundary.test.ts
require_authenticated_clean_main_setfarm_root_v1
npm run internal:golden-fleet-catalog -- prepare \
  --campaign internal-production-fleet-2026-08-14 \
  --campaign-date 2026-08-14 \
  --json
require_authenticated_clean_main_setfarm_root_v1
npm run internal:golden-fleet-catalog -- prepare \
  --campaign internal-production-fleet-2026-08-14 \
  --campaign-date 2026-08-14 \
  --json
git diff --check
```

Expected: PASS; the second materialization returns the same campaign hash and bytes; the catalog embeds only C's immutable template bytes; no fixture/repository/remote exists yet and no fabricated hash exists; only the raw B campaign is tracked. Authorized handoff subject: `feat(acceptance): materialize golden fleet catalog`.

---

### Task 3: Implement the Hash-Only Fleet Scheduler and Private Status Store

**Files:**
- Create: `src/internal-production/schemas/golden-fleet-status-v1.ts`
- Create: `src/internal-production/golden-fleet-status-store.ts`
- Create: `src/internal-production/golden-fleet-scheduler.ts`
- Test: `tests/internal-production/golden-fleet-status-store.test.ts`
- Test: `tests/internal-production/golden-fleet-scheduler.test.ts`
- Test: `tests/internal-production/golden-fleet-source-boundary.test.ts`
- Consume without modification: `src/internal-production/golden-run-contract-v1.ts` — sole `GoldenCampaignExecutionCapacityV1` type/schema module.
- Consume without modification: `src/internal-production/golden-run-harness.ts` — sole `deriveGoldenCampaignExecutionCapacityV1` value export.
- Modify: `src/internal-production/golden-run-cli.ts`
- Modify: `tests/internal-production/golden-run-cli.test.ts`

**Interfaces:**
- Consumes: one loaded B campaign, the exact B result/committed-timeout-pair store, B `reconcileTimedOutGoldenRunV1(...)`, B `deriveEffectiveGoldenRunResultsV1(...)`, exact contract type/schema `GoldenCampaignExecutionCapacityV1`/`GoldenCampaignExecutionCapacityV1Schema`, harness value `deriveGoldenCampaignExecutionCapacityV1(...)`, B policy evaluator, B `isGoldenRunCleanupExactlySettledV1(...)`, C `GoldenAssertionEnabledCaseExecutorV1` whose collect method closes over C's exact nested B `GoldenCollectionPorts`, C `GoldenRepairReviewReceiptResolverV1`, C `GoldenNonacceptedResultReviewAcknowledgementResolverV1`, and release/zero-owner preflight hashes returned by B.
- Produces: `GoldenFleetStatusV1`, `GoldenFleetStatusStore`, `GoldenFleetPreflightGuardV1`, `GoldenFleetPreflightGuardAuthorityV1`, `evaluateGoldenFleetStatusV1(...)`, `runGoldenFleetNextV1(...)`, `acknowledgeGoldenFleetNonacceptedReviewV1(...)`, `recoverGoldenFleetInflightV1(...)`, and `collectGoldenFleetRunV1(...)`.

- [ ] **Step 1: Write the failing strict status/store tests**

Use this exact public private-receipt schema:

```typescript
export interface GoldenFleetPendingReviewAcknowledgementV1 {
  failedResultHash: string;
  caseId: string;
  classification:
    | "provider_or_quota_failure"
    | "infrastructure_failure"
    | "generated_product_failure";
  requiredSourceKind: "external-resolution" | "clean-generated-retry";
}

export interface GoldenFleetStageCoordinationMemberV1 {
  coordination: GoldenStageCoordinationV1;
  repairReceiptHash: string | null;
  predecessorEpochHash: string;
  targetEpochHash: string;
}

export type GoldenFleetTerminalStageOutcomeV1 =
  | Readonly<{
      kind: "pre_run";
      coordinationHash: string;
      resultRef: CanonicalRef;
      resultHash: string;
    }>
  | Readonly<{
      kind: "blocked";
      coordinationHash: string;
      preflight: GoldenBlockedPreflightResultV1;
    }>;

export type GoldenFleetBlockerCodeV1 =
  | GoldenReasonCodeV1
  | "FLEET_NO_UNOCCUPIED_CASE"
  | "FLEET_RELEASE_IDENTITY_MISMATCH"
  | "FLEET_RESULT_STORE_IDENTITY_MISMATCH"
  | "FLEET_TIMEOUT_RECONCILIATION_REQUIRED"
  | "FLEET_REPAIR_REVIEW_REQUIRED"
  | "FLEET_REPAIR_REVIEW_MISMATCH"
  | "FLEET_NONACCEPTED_REVIEW_ACKNOWLEDGEMENT_REQUIRED"
  | "FLEET_NONACCEPTED_REVIEW_ACKNOWLEDGEMENT_MISMATCH"
  | "FLEET_STAGE_PRE_RUN_CONFIGURATION_FAILURE"
  | "FLEET_STAGE_PREFLIGHT_BLOCKED";

export interface GoldenFleetStatusV1 {
  schema: "setfarm.internal-production-golden-fleet-status.v1";
  campaignHash: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  orderedResultHashes: readonly string[];
  timeoutReconciliationAuthorities: readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  currentEpochResultHashes: readonly string[];
  consumedRepairReceiptHashes: readonly string[];
  consumedReviewAcknowledgementHashes: readonly string[];
  pendingReviewAcknowledgement: GoldenFleetPendingReviewAcknowledgementV1 | null;
  pendingStages: readonly GoldenFleetStageCoordinationMemberV1[];
  inflight: readonly GoldenAssertionEnabledStagedCaseV1[];
  terminalStageOutcomes: readonly GoldenFleetTerminalStageOutcomeV1[];
  settlementHash: string | null;
  executionCapacity: GoldenCampaignExecutionCapacityV1;
  decision: "ready" | "running" | "frozen" | "blocked" | "accepted" | "incomplete";
  blockerCodes: readonly GoldenFleetBlockerCodeV1[];
  statusHash: string;
}

export interface GoldenFleetPreflightGuardV1 {
  schema: "setfarm.internal-production-golden-fleet-preflight-guard.v1";
  campaignHash: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  loadedCampaignHash: string;
  operationalAcceptanceRef: CanonicalRef;
  operationalAcceptanceHash: string;
  statusRef: CanonicalRef;
  statusHash: string;
  statusPointerHash: string;
  executionCapacityHash: string;
  executableBuildIdentityHash: string;
  cleanSourceAuthorityHash: string;
  observedAt: string;
  expiresAt: string;
  oneUseNonceHash: string;
  guardRef: CanonicalRef;
  guardHash: string;
}

export interface GoldenFleetPreflightGuardAuthorityV1 {
  issue(input: Readonly<{
    loaded: LoadedGoldenCampaignV1;
    setfarmSha: string;
    missionControlSha: string;
  }>): Promise<GoldenFleetPreflightGuardV1>;
  resolve(input: Readonly<{
    guardRef: CanonicalRef;
    guardHash: string;
  }>): Promise<GoldenFleetPreflightGuardV1>;
  consume(input: Readonly<{
    guardRef: CanonicalRef;
    guardHash: string;
  }>): Promise<GoldenFleetPreflightGuardV1>;
}

export function createGoldenFleetPreflightGuardAuthorityV1():
  GoldenFleetPreflightGuardAuthorityV1;

export function runGoldenFleetNextV1(input: Readonly<{
  loaded: LoadedGoldenCampaignV1;
  setfarmSha: string;
  missionControlSha: string;
  preflightGuardRef: CanonicalRef;
  preflightGuardHash: string;
}>): Promise<GoldenFleetStatusV1>;
```

Each `pendingStages` member embeds C's exact imported frozen `GoldenStageCoordinationV1` plus only E's repair-transition linkage. That C type has literal schema `setfarm.internal-production-golden-stage-coordination.v1`, campaign/case/repetition/full epoch, code-owned bounded `launchAttemptOrdinal`, canonical coordination ref/hash, and no path or B identity. E persists the ordinal byte-for-byte but never supplies or derives it. E first CAS-publishes and reopens this member. Only then may C `stage({loaded,caseId,setfarmSha,missionControlSha,coordinationRef,coordinationHash})` return its exact discriminated outcome. The in-flight tuple contains only a `kind:"staged"` branch's exact imported `GoldenAssertionEnabledStagedCaseV1`; that C-owned type has literal schema `setfarm.internal-production-golden-assertion-enabled-staged-case.v1`, campaign/case/repetition/full epoch, `coordinationHash`, `inflightRef:CanonicalRef`, and `inflightHash`. E neither aliases nor redeclares either shape and embeds each returned object byte-for-byte. The stage-outcome CAS always removes the exact pending member. It either adds the staged object to `inflight`, appends a strict `pre_run` result pair to `terminalStageOutcomes` and B raw history, or appends the exact blocked preflight to `terminalStageOutcomes` without any B result hash. Only the staged repair branch may atomically install the successor epoch and append the consumed repair receipt hash; a non-staged repair outcome leaves that receipt unconsumed, keeps the prior epoch authoritative, and blocks progression. Response loss repeats the same pair and ordinal and adopts the byte-identical branch; a distinct reviewed retry must use a newly prepared C-owned ordinal/address. Only `pendingStages` plus `inflight` reserve execution capacity; terminal outcomes never do. Those active tuples are ordered by campaign case order, cannot exceed `executionCapacity.eligibleMaximum`, and reject duplicate case/repetition/launch ordinal/coordination/ref/hash or cross-campaign/epoch members.

`GoldenFleetStatusV1Schema` is strict and re-parses `finalReleaseEpoch` through B `GoldenFinalReleaseEpochV1Schema`. `orderedResultHashes` is B's immutable raw result history. `timeoutReconciliationAuthorities` is the ordered, bounded array of B's exact imported `GoldenCommittedTimeoutReconciliationPairAuthorityV1` values; every persisted member is schema-parsed, matched byte-for-byte to B's same-position list result, and only that fresh list-returned nominal authority is authenticated and resolved through B's store, and its campaign/supersession/original/terminal/pair/index/authority identities must equal the returned pair before use. A `pre_run` outcome's already stored result pair is included in that raw history, but B's exact effective projection exposes it only as configuration-failure authority: it is excluded from executable/current acceptance slots, the first-five capacity ramp, active capacity, accepted counts, and terminal completion. `currentEpochResultHashes` is copied only from B's executable effective-result mapping for the selected epoch; it contains the terminal replacement hash rather than an original timeout hash, at most one effective terminal run result for each of the ten case IDs, and at most ten hashes. A bare `blocked` outcome contributes no result hash anywhere. `executionCapacity` is the byte-identical B `GoldenCampaignExecutionCapacityV1`; E verifies its schema/campaign/epoch/configured maximum `2`, eligible maximum, active same-campaign count, exact first-five effective hashes, and `capacityHash`, and declares no `eligibleConcurrency` mirror or capacity calculator. `statusHash` is E's one and only derived status hash and equals `hashCanonicalJson(payloadWithoutStatusHash)`, thereby binding the full final epoch/`epochHash`, ordered raw B history, the ordered full committed timeout-pair authorities and freshly resolved reconciliation identities, B's effective and capacity projections, consumed C repair-review receipts, consumed C nonaccepted-result acknowledgement hashes, the exact pending-review member, pending stage coordination tuple, in-flight tuple, terminal stage outcomes, B settlement hash, decision, and blockers. E defines no second timeout/effective-result/capacity projection or separate result-set/decision/aggregate hash. `settlementHash` remains the byte-identical B-owned epoch-bound hash when B returns it; each repair/acknowledgement hash remains the byte-identical C-owned receipt hash. `blockerCodes` are empty for selectable `ready | running`; ordinary B `in_progress` missing-count codes describe expected current-epoch progress and are not blockers. A resolved `pre_run` branch makes status `blocked` using B's exact configuration-failure settlement reason and E code `FLEET_STAGE_PRE_RUN_CONFIGURATION_FAILURE`; a resolved bare `blocked` branch makes status `blocked` with `FLEET_STAGE_PREFLIGHT_BLOCKED`. Both start nothing and prevent progression until a separately reviewed new attempt/epoch authority exists; neither can unlock fleet capacity or satisfy acceptance. A non-null pending review makes the status `frozen` with exact E code `FLEET_NONACCEPTED_REVIEW_ACKNOWLEDGEMENT_REQUIRED` only while the current-epoch allowed-nonaccepted count is at most two. The third such result has strict precedence: status is `incomplete`, retains the pending member and acknowledgement-required code, and starts nothing; after acknowledgement clears the member it remains `incomplete` because B's allowance is still exceeded. For other `frozen | blocked | incomplete` states, codes are sorted unique B `GoldenReasonCodeV1` members that actually prevent another start/settlement plus only E scheduling codes `FLEET_NO_UNOCCUPIED_CASE`, `FLEET_RELEASE_IDENTITY_MISMATCH`, `FLEET_RESULT_STORE_IDENTITY_MISMATCH`, `FLEET_TIMEOUT_RECONCILIATION_REQUIRED`, `FLEET_REPAIR_REVIEW_REQUIRED`, `FLEET_REPAIR_REVIEW_MISMATCH`, `FLEET_NONACCEPTED_REVIEW_ACKNOWLEDGEMENT_REQUIRED`, `FLEET_NONACCEPTED_REVIEW_ACKNOWLEDGEMENT_MISMATCH`, `FLEET_STAGE_PRE_RUN_CONFIGURATION_FAILURE`, and `FLEET_STAGE_PREFLIGHT_BLOCKED`; they contain no prose. Type/schema/source tests import `GoldenReasonCodeV1` unaliased from B, enumerate the exact ten E literals, accept every branch, and reject `readonly string[]`, `string`, a local B-reason copy, unknown codes, duplicates, or unsorted order.

Reject more than B's fixed bound of `64` result hashes or `64` committed timeout-pair authorities, more than twenty repair or review-acknowledgement hashes, duplicate supersession/authority/pair refs or hashes, an unauthenticated structural authority, an authority not returned byte-identically by `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})`, or a pair whose original/terminal/supersession/index relations do not fresh-resolve through B's store, a current-epoch hash absent from or out of order relative to B's effective projection, two effective current-epoch hashes for one case, noncanonical B history/index order, a repair hash not resolved through C's fixed scope index, or an acknowledgement hash not resolved through C's exact acknowledgement resolver. A pending member must name the earliest unacknowledged effective current-epoch result in B order, repeat its exact case/classification, and map provider/quota/infrastructure only to `external-resolution` and generated product only to `clean-generated-retry`; accepted/systemic/timeout results can never appear. Reject a missing pending member for such a result, a later pending result while an earlier one is unacknowledged, an acknowledgement from another campaign/case/result/classification/root/epoch or wrong source kind, any pending/staged case while pending review exists, a pending/staged case that already has an effective current-epoch result, a coordination or staged member from another campaign/unauthorized epoch, ref/hash drift C cannot reopen byte-for-byte, combined pending/staged members above `executionCapacity.eligibleMaximum`, a B active count above that maximum, configured maximum other than `2`, stale/wrong capacity hash, caller-authored epoch/status/run/capacity hashes, raw result/classification/cleanup/assertion/cause/task/path fields outside the exact pending projections, and any status whose result-store records do not match campaign/case/release identities. `ready`, `frozen`, `blocked`, `accepted`, and settled `incomplete` require both pending-stage and in-flight tuples empty; either tuple nonempty is `running` and reserves that case/repetition. An original timeout and its exact terminal replacement may share B's logical subject only through one valid B committed reconciliation-pair authority and occupy exactly one slot. Historical hashes are never deleted or reset. Hitting either B history bound before complete/blocked is a typed `incomplete` outcome and starts nothing.

Tests cover two epochs explicitly: epoch A has eight accepted results, one allowed generated-product result, and one Setfarm-core result; the C receipt for a reviewed repair of that exact systemic result creates epoch B. Status for epoch B has zero current slots and ten historical hashes and remains `running`. The underlying B evaluator returns `GOLDEN_FINAL_RELEASE_EPOCH_ACCEPTANCE_INCOMPLETE`, but E does not promote that expected-progress code into its selectable `blockerCodes`. The repaired case runs first, then the remaining nine epoch-B cases. Eight epoch-A accepted plus two epoch-B accepted never reaches `accepted`; ten epoch-B effective terminal results with eight accepted does. Add one epoch-B original timeout and its exact terminal replacement/supersession: raw history grows by two, but B's effective projection and E status contain one replacement-backed slot, concurrency counts it once, and completion remains valid. The original without a supersession produces `FLEET_TIMEOUT_RECONCILIATION_REQUIRED` and starts nothing. An epoch-A unclean effective result blocks global settlement through B cleanup validation without occupying an epoch-B slot, and the third same trusted systemic root across A/B blocks cumulatively; no other historical classification consumes, freezes, or obstructs an epoch-B slot/allowance.

The fixed store root is child `golden-fleet` of B `resolveInternalProductionDataRootV1()`. Status receipts are immutable mode-`0600` canonical JSON at `sha256/${statusHash}.json` under real mode-`0700` directories; their canonical content ref is derived only from `statusHash`. The mutable pointer is exactly:

```typescript
export interface GoldenFleetStatusPointerV1 {
  schema: "setfarm.internal-production-golden-fleet-status-pointer.v1";
  campaignHash: string;
  statusRef: CanonicalRef;
  statusHash: string;
  predecessorPointerHash: string | null;
  pointerHash: string;
}
```

It lives only at `campaigns/${campaignHash}/status-ref.json`. `compareAndSwapStatusV1({expectedPredecessorPointerHash,nextStatus})` first seals/reopens `nextStatus`, then acquires the fixed recoverable campaign pointer lock and reopens the current pointer with `O_RDONLY|O_NOFOLLOW`. Null expectation is valid only when the pointer is absent; otherwise its recomputed `pointerHash` must equal the exact non-null expectation and becomes `next.predecessorPointerHash`. Under the lock, persist a strict mode-`0600` CAS intent containing campaign, expected predecessor hash, next status ref/hash, next pointer bytes/hash, and operation hash by unpredictable-temp write, file fsync, no-replace publication, and parent fsync. Write the next pointer to another unpredictable mode-`0600` sibling, fsync/close it, atomically replace only the mutable fixed pointer, fsync the parent, reopen with `O_NOFOLLOW`, and require exact canonical bytes/hash/ref/predecessor before deleting the CAS intent and releasing the lock. Immutable status receipts are never replaced.

The lock is reclaimable only after its recorded process is absent and its strict CAS intent reopens. If the current pointer is still the expected predecessor, recovery completes that same replacement; if it already equals the intended next pointer, recovery adopts it and clears the intent; absent/malformed intent, a third pointer value, mismatched predecessor, different next bytes, concurrent writer, stale fencing token, or ambiguous owner fails closed. Crash tests stop before/after lock publication, CAS-intent temp write/fsync/no-replace publication/parent fsync, pointer temp write/fsync, atomic replacement, pointer-parent fsync, final reopen, intent cleanup, lock release, and response. Each retry returns the same pointer/status and never repeats stage/execute/recovery side effects. Resolution never scans a directory, guesses newest state, or trusts a pointer without reopening its exact immutable status. Identical immutable writes are idempotent; same-hash unequal bytes fail closed.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --import tsx --test tests/internal-production/golden-fleet-status-store.test.ts tests/internal-production/golden-fleet-scheduler.test.ts`

Expected: FAIL because the schemas, store, and scheduler do not exist.

- [ ] **Step 3: Implement result-hash-only scheduling**

Load cumulative raw history only through B `listCampaign(campaignHash)` and verify each referenced result through `get(resultHash)`. Load timeout history only through B `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`. For each returned exact authority, schema-parse and authenticate it, require `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})` to return byte-identical authority, then call `resolveCommittedTimeoutReconciliationPair({authority})` and require its returned authority/pair/terminal-result/supersession plus `resultIndexHash`, `supersessionIndexHash`, and `committedPairIndexHash` relations to rehash exactly before projection. Never list a bare supersession or resolve one by a filesystem path. Construct the selected epoch only with B `createGoldenFinalReleaseEpochV1({setfarmSha,missionControlSha})` after the B release observer proves those exact worktrees are clean. Call the imported exact `deriveEffectiveGoldenRunResultsV1({campaign,campaignHash,finalReleaseEpoch,results,timeoutReconciliations})`; never redeclare or reproduce its same-subject, replacement, cleanup, or epoch logic. Occupy a case only from that returned projection: one exact current-epoch effective B terminal result whose campaign/case/prompt/case/release identities match fills that case's current slot; every mismatched-release effective result stays historical, and an original timeout plus its terminal replacement fills one slot with the replacement hash only through the corresponding resolved committed-pair authority. Call B `evaluateGoldenCampaignSettlementV1({campaign,campaignHash,results,timeoutReconciliations,platform,finalReleaseEpoch})`; E copies only the returned epoch-bound settlement hash/status. For a frozen latest current-epoch effective result, resolve C's fixed campaign-scope index only through `createGoldenRepairReviewReceiptResolverV1().resolve({coordinationScope:{kind:"campaign",campaignHash},caseId,failedResultHash})`; validate the strict receipt, exact trusted root, new clean-main SHAs, review/test/build refs, and one-use consumption before authorizing the epoch transition and a fresh attempt of that repaired case.

Release identity is a receipt-authorized epoch lineage, not an instruction to rewrite history. Initial results must match the initial B epoch. A consumed C receipt binds the immediately preceding systemic failed result and the next exact Setfarm/Mission-Control clean-main pair. The next status installs B's new epoch and the repaired case runs first; every other case then receives one fresh result in that same epoch. All earlier B results retain their original release identities and remain cleanup/cumulative-root evidence, but no historical `accepted` or allowed failure counts toward the new epoch's ten slots or minimum eight. An unlinked epoch transition, a retry that does not match its receipt, or an attempt to make older results claim the new epoch yields `FLEET_RELEASE_IDENTITY_MISMATCH`.

Scheduling rules are exact:

1. `accepted` exactly when B returns bounded `complete` for the status's byte-identical `finalReleaseEpoch`, `pendingReviewAcknowledgement` is null, and every allowed nonaccepted current-epoch result has one resolved consumed C acknowledgement; this necessarily has ten current-epoch results and at least eight current-epoch accepted results.
2. `blocked` when B returns repeated-root `blocked`, including the third cumulative schema-validated occurrence of one trusted systemic root, or when the durable current coordination has an exact `pre_run` or `blocked` C stage outcome. For `pre_run`, E resolves the immutable B result pair and preserves B's configuration-failure settlement authority; for bare `blocked`, E preserves C's exact `GoldenBlockedPreflightResultV1` and creates no result. Neither branch is a case result, active slot, capacity-ramp input, accepted slot, or completion candidate.
3. `ready` only when history is empty and preflight is valid; it has no blockers and settlement is B `in_progress`.
4. `running` when history is valid and B is `in_progress`, fewer than ten current-epoch case slots are occupied, `pendingReviewAcknowledgement:null`, no unreviewed current-epoch systemic result freezes starts, and either the first current-epoch-unoccupied case or the repaired-case first run of a newly authorized epoch is selectable. This state describes campaign scheduling readiness, not a claim that a Setfarm run is currently active.
5. `frozen` immediately when the latest current-epoch schema-validated B result carries `setfarm_core_failure` or `mission_control_failure`, B has not yet blocked, and no exact unconsumed C campaign-scope repair-review receipt authorizes the new epoch. It reports `FLEET_REPAIR_REVIEW_REQUIRED` and starts nothing. A historical systemic result alone does not freeze the authorized successor epoch, but remains cumulative blocking evidence.
6. `incomplete` when all ten current-epoch slots exist but B cannot settle, current-epoch allowed nonaccepted count exceeds two, the B history bound is reached, a C receipt mismatches/is reused, or any current/historical result-store/release/cleanup identity validation fails. Allowed-count overflow wins over the pending-review freeze: the third allowed nonacceptance atomically installs its pending member but yields `decision:"incomplete"`; acknowledgement remains mandatory evidence and may clear that member, but cannot reopen scheduling or change the decision. It can collect an exact already-started run but cannot start another.
7. E calls only B `deriveGoldenCampaignExecutionCapacityV1(...)`, copies the returned `GoldenCampaignExecutionCapacityV1` into status, and never inspects the first five to derive capacity itself. Require `configuredMaximum:2`; B returns `eligibleMaximum:1|2`, `activeSameCampaignCount`, exact ordered `firstFiveEffectiveResultHashes`, and `capacityHash`. E's CAS may reserve at most the remaining eligible slots with distinct pending-stage members. Two concurrent same-campaign/same-epoch invocations can each win one coordination CAS when eligible maximum is two; a third reopens the authoritative projection/status and refuses before coordination/stage. Standard/matrix campaigns remain configured one. Historical results and a timeout original replaced by its supersession cannot be double-counted because only B computes the projection.
8. After every effective current-epoch `provider_or_quota_failure`, `infrastructure_failure`, or `generated_product_failure`, including the third, the same result-settling status transition removes the staged member and persists `pendingReviewAcknowledgement` before returning. Provider/quota/infrastructure require `external-resolution`; generated product requires `clean-generated-retry`. `runGoldenFleetNextV1`, preflight, and every stage path refuse while that member exists. `acknowledgeGoldenFleetNonacceptedReviewV1(...)` resolves C's fixed repair-review receipt for the exact pending result without caller receipt input, calls only `acknowledgements.locateForRepairReceipt({repairReceiptHash})`, then `resolve({acknowledgementRef,acknowledgementHash})`, and requires the strict C acknowledgement's campaign/case/failed-result/classification/trusted-root/final-epoch/source-observation/repair-receipt/evidence authority to match. It expected-predecessor-CAS appends `acknowledgementHash` and clears the pending member. Counts one and two reopen status before another stage is selectable; count three or greater remains `incomplete` and cannot stage. It never changes B result classification, allowed-failure count, or settlement.
9. `runGoldenFleetNextV1` first freshly resolves and rehashes the required E `GoldenFleetPreflightGuardV1`, requires exact campaign/full B epoch/operational-acceptance/status-pointer/status/capacity/build/clean-source equality with the parsed invocation and current stores, and atomically consumes its one-use nonce immediately before any coordination or stage call. This E scheduling guard never replaces or widens B admission or C staging authority. It then reconstructs any missing pending-review member from the earliest unacknowledged allowed nonaccepted result in B's exact effective projection, CAS-publishes it, and returns review-required without staging. Only when none exists does it choose one distinct unoccupied case within B's exact remaining capacity, giving priority to a repaired case. It calls C `prepareGoldenStageCoordinationV1(...)`, then expected-predecessor CAS-publishes/reopens a `pendingStages` member before `stage`. It passes C's exact `GoldenAssertionEnabledStageOutcomeV1` to an exhaustive switch. The `staged` branch atomically removes pending and adds only `outcome.staged` to `inflight`; the `pre_run` branch reopens the exact immutable B result, atomically removes pending and appends its strict terminal outcome plus raw-history pair, sets the configuration blocker, and calls no run method; the `blocked` branch atomically removes pending and appends the exact preflight with no result/history write, then sets the finite blocker. For a systemic repair, E first resolves and validates the exact still-unconsumed C receipt and successor epoch, but does not append its hash or change epoch. It persists one repair-linked coordination member for the repaired case/target epoch, then calls C `stage` with the exact pair. Only a `staged` outcome may prove C/B repair consumption and, in one successor CAS, install the successor epoch, remove coordination, add staged, and append the consumed repair receipt hash. A non-staged repair outcome leaves the receipt unconsumed and the predecessor epoch unchanged. A crash after guard consumption recovers only the exact persisted coordination/status suffix; it never reuses or remints the guard. A crash after C seals any outcome but before E's CAS repeats stage with the same pair and adopts the same discriminant/member bytes; it prepares no second coordination. An expired/replayed/cross-campaign guard, ref/hash or argument/source/epoch/status/capacity/build/acceptance drift, stale/replayed repair receipt, invalid outcome, or CAS loss cannot authorize another case. One invocation reserves/stages at most one case; two processes may do so only within B capacity, never three.
10. `executeStaged({staged})` is the only fresh external start and is reachable only from the exhaustively narrowed `kind:"staged"` branch after the exact member is reopened from status. E passes the same frozen staged object, then reopens/stores the returned B result. If it is an allowed nonaccepted result, the one expected-predecessor-CAS successor both removes the staged member and persists the exact pending-review member; there is no intermediate stageable status. For accepted or systemic results, it publishes the applicable normal/frozen successor. A response loss after execution never calls `executeStaged` again: fresh recovery uses C `recoverStaged({staged})`, which resolves/adopts the same durable launch/run/result chain and applies the same atomic pending-review derivation. A `pre_run` or `blocked` terminal stage outcome is recovered by reopening the current status and its exact C/B authority only; it may never call `executeStaged`, `recoverStaged`, or `collect`. `collectGoldenFleetRunV1` also must settle the pending member atomically and remains only the explicit known-case/run read-only collection surface; it cannot stage, execute, or recover a replacement.
11. `recoverGoldenFleetInflightV1({campaignHash,inflightRef,inflightHash})` is the sole fleet fresh-process run-resume seam. It loads the fixed catalog by exact campaign hash, reopens the current E status pointer/immutable status, selects exactly one embedded `GoldenAssertionEnabledStagedCaseV1` whose canonical ref/hash equal the two caller identities, and calls only C `recoverStaged({staged})`. C reopens its own authenticated receipt and B durable chain; it may finish the never-invoked staged operation or adopt the already invoked/bound/stored operation, but cannot allocate a new intent, outbox, repository attempt, operation, or logical run. E verifies the returned result matches staged campaign/case/repetition/epoch, then expected-predecessor-CAS publishes the status with that member removed and, for an allowed nonaccepted result, the exact pending review member present. If the supplied ref/hash belongs to a terminal `pre_run` or `blocked` stage outcome, recovery refuses the run seam and returns the already persisted finite status without a C run-recovery call. The function accepts no case, run, release SHA, Mission Control SHA, status body, task, path, port, B intent, or B operation from caller or shell state.

Crash tests terminate a child process immediately before/after preflight-guard immutable publication/reopen, one-use consume intent/CAS/reopen, C coordination preparation, E coordination-member status CAS/reopen, C sealing/returning each of the three stage outcomes, every outcome-status CAS, staged-only repair consumption, the atomic repair epoch/staged/consumed-hash CAS, every other E immutable-status/pointer-CAS boundary, `executeStaged` entry, B external invocation/run binding/result storage, result verification, staged-member removal plus pending-review publication, C repair/acknowledgement publication, acknowledgement locate/resolve, acknowledgement status CAS, and CLI response. Before guard consumption and staged status publication, zero external start is observed. Response loss after consume but before coordination reopens the consume receipt and resumes only the exact suffix; replaying the same guard or issuing a substitute guard for that operation starts nothing. A crash after C stage but before local CAS resolves the pending coordination and re-calls `stage` with the same pair; it never prepares another coordination and adopts the identical staged object, pre-run result pair, or blocked preflight. The pre-run branch proves one existing B result and zero intent/outbox/run/execute/recover/collect calls; the blocked branch proves zero B result-store writes and zero intent/outbox/run calls. Neither counts toward B capacity, the first-five ramp, a current acceptance slot, or completion, and both prevent the next case. After staged publication, a fresh child uses only campaign hash plus exact staged ref/hash, calls `recoverStaged` rather than `executeStaged`, and returns the byte-identical terminal status; terminal non-staged status recovery is read-only. A crash after B stores an allowed nonaccepted result but before E publishes status is repaired by the next preflight/status evaluation, which CAS-persists the deterministic pending-review member and starts nothing. A crash after C acknowledgement publication but before E consumes it re-locates/re-resolves the same receipt and adopts one status transition. Capacity tests use two processes with two independently issued current guards to CAS two distinct pending coordination members and stage both in the same campaign/epoch after B returns eligible two; a third process receives capacity refusal before coordination. Repeat under eligible one, mixed epoch, duplicate case, one B-active plus pending local work, either non-staged outcome, guard expiry/replay/ref/hash/campaign/epoch/status/pointer/capacity/build/acceptance drift, and response loss; never observe three starts. Master tests prove no second case reaches stage while a nonaccepted review or terminal stage blocker is pending, across fresh processes and all classifications. A dedicated three-result sequence proves results one/two are frozen until acknowledgement then may continue, result three is immediately `incomplete` with pending acknowledgement, and clearing that third member leaves the byte-identical B allowed-count overflow and `incomplete` decision with zero further stage calls. Reject a missing/corrupt/cross-campaign/cross-epoch coordination, outcome, or staged member, wrong ref/hash, a member absent from current status, stale predecessor/capacity, repair hash recorded for a non-staged outcome, pre-stage repair consumption, duplicate case/repetition, missing/wrong/cross-result acknowledgement, non-exhaustive/default dispatch, directory scan, newest-file inference, direct access to B intent/outbox paths, and every recovery attempt that could invoke a second external start.

This is aggregation of immutable B/C fields, not another classifier or census: E parses each raw object through `GoldenRunResultV1Schema`, each committed-pair authority through B's exact schema/authenticator and store locator/resolver, obtains current/historical effective membership only from `deriveEffectiveGoldenRunResultsV1(...)`, copies only B's exact allowed classification into the pending member, and calls B's exact `isGoldenRunCleanupExactlySettledV1(result)` used by `evaluateGoldenCampaignSettlementV1`. It resolves every acknowledgement only through C's exact resolver and derives no review verdict. E never checks a host directly. It does not expose an epoch/classification/timeout/acknowledgement schema, effective-result mapper, cause derivation, cleanup schema, or SQL/process observer. The single `statusHash` binds the B epoch plus ordered raw/effective B hashes and the complete ordered committed timeout-pair authorities, C repair/acknowledgement receipt hashes, pending review, and B-derived scheduling fields.

- [ ] **Step 4: Add exact CLI commands and tests**

Extend the existing B/C CLI with only:

```text
fleet-preflight --campaign evals/suites/internal-production-golden-fleet-v1.json --release-sha 0123456789abcdef0123456789abcdef01234567 --mission-control-sha 89abcdef0123456789abcdef0123456789abcdef --json
fleet-execute-next --campaign evals/suites/internal-production-golden-fleet-v1.json --release-sha 0123456789abcdef0123456789abcdef01234567 --mission-control-sha 89abcdef0123456789abcdef0123456789abcdef --preflight-guard-ref setfarm://internal-production/golden-fleet/preflight-guards/sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --preflight-guard-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --json
fleet-collect --campaign evals/suites/internal-production-golden-fleet-v1.json --case fleet-api-inventory --run-id 00000000-0000-4000-8000-000000000001 --release-sha 0123456789abcdef0123456789abcdef01234567 --mission-control-sha 89abcdef0123456789abcdef0123456789abcdef --json
fleet-recover-inflight --campaign-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --inflight-ref setfarm://internal-production/golden-matrix-inflight-statuses/sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --inflight-hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --json
fleet-reconcile-timeouts --campaign evals/suites/internal-production-golden-fleet-v1.json --release-sha 0123456789abcdef0123456789abcdef01234567 --mission-control-sha 89abcdef0123456789abcdef0123456789abcdef --json
fleet-acknowledge-review --campaign evals/suites/internal-production-golden-fleet-v1.json --release-sha 0123456789abcdef0123456789abcdef01234567 --mission-control-sha 89abcdef0123456789abcdef0123456789abcdef --json
fleet-status --campaign evals/suites/internal-production-golden-fleet-v1.json --release-sha 0123456789abcdef0123456789abcdef01234567 --mission-control-sha 89abcdef0123456789abcdef0123456789abcdef --json
```

The `fleet-recover-inflight` ref is restricted to C's exact derived family `setfarm://internal-production/golden-matrix-inflight-statuses/sha256/${inflightHash}`. CLI/schema/source tests reject every fleet-specific or alternate inflight prefix, ref/hash drift, and a structurally valid canonical ref from another C store before recovery.

The SHA/UUID strings above are test fixtures, not live identities. Production operators derive actual values from Git. `fleet-preflight` returns the strict E guard plus its canonical ref/hash and performs no stage/start; `fleet-execute-next` requires exactly that pair in addition to the same campaign/SHA tuple and exposes no optional/default/bypass guard. It consumes the pair once immediately before scheduler coordination. Response loss adopts the already durable E/C suffix; replay, expiry, pair drift, campaign/SHA/status/pointer/capacity/build/operational-acceptance drift, or concurrent consumption starts nothing. `fleet-recover-inflight` accepts exactly the three authenticated identity flags shown plus optional `--json`; it rejects `--campaign`, `--case`, `--run-id`, `--run-number`, `--release-sha`, `--mission-control-sha`, B intent/operation flags, a status ref/hash/body, path/root/task, and every environment fallback. It derives and revalidates campaign/case/repetition/full epoch only from the staged member in the resolved E current status and passes that exact object to C `recoverStaged`.

`fleet-reconcile-timeouts` performs a bounded deterministic loop over B's unresolved timeout subjects: after reloading `listCampaign`, listing `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`, authenticating/locating/fresh-resolving every returned authority, and deriving the projection from those exact `timeoutReconciliations`, it invokes only B `reconcileTimedOutGoldenRunV1(...)` for each unresolved original in B order. For one terminal reconciliation it performs exactly one `GoldenRunResultStore.putTimeoutReconciliationPair({originalTimeoutResultHash,terminalResult,supersession})` and receives one exact `GoldenCommittedTimeoutReconciliationPairAuthorityV1`; it never calls a standalone terminal-result writer, a split supersession-only writer, another timeout writer, or a D/E-local store facade. That B transaction validates original/terminal/supersession identity, atomically publishes both immutable objects and all three indices, and returns only the authenticated authority after result, supersession, and committed-pair index visibility is complete. E authenticates the returned value, requires `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})` to return it byte-identically, calls `resolveCommittedTimeoutReconciliationPair({authority})`, requires every returned member/hash/index relation, reloads the ordered authority list, and only then rederives the effective projection. Kill before the pair call, at each B-injected result/supersession/committed-pair-index transaction boundary, and after durable commit before response; fresh-process retry must observe either no authority or the one complete exact authority, locate/resolve and adopt the committed pair, and never accept a terminal result, bare supersession, or partial index visibility without that authority. It never calls admission, starter, lifecycle action, C assertion gateway, or another run start. A still-active timeout returns the typed reconciliation-required status and leaves the original immutable; an invalid/cross-run/duplicate supersession fails closed. `fleet-acknowledge-review` accepts only the campaign and exact SHA pair, derives the pending result and C repair receipt from fixed stores, and uses only C's exact locate/resolve methods; it rejects result/case/classification/root/epoch/source/repair/evidence mismatch before status CAS and accepts no acknowledgement/repair ref/hash. `fleet-execute-next` refuses whenever B's projection still reports an unresolved timeout or E status reports pending review, so operators run the explicit reconciliation or acknowledgement command before another start. Reject a report/finalize/output/root/concurrency/admission/repair-receipt/review-acknowledgement/result-hash/supersession-hash flag on fleet commands; repair, acknowledgement, and timeout identities are resolved only from B's campaign/supersession-keyed committed-pair authority index and exact locator/resolver. Static tests reject imports of PostgreSQL, child process, snapshot, classifier, cleanup observer, admission repository, assertion adapter, GitHub client, C receipt filesystem path, B intent/outbox shape, a local `GoldenRunResultStore`, local `LoadedGoldenCampaignV1`, local acknowledgement schema/resolver, locally defined effective-result mapper, obsolete split timeout writers, or a split terminal-result write from E scheduler/status modules.

- [ ] **Step 5: Run focused and adjacent verification**

```bash
set -euo pipefail
node --import tsx --test \
  tests/internal-production/golden-fleet-status-store.test.ts \
  tests/internal-production/golden-fleet-preflight-guard-v1.test.ts \
  tests/internal-production/golden-fleet-scheduler.test.ts \
  tests/internal-production/golden-run-cli.test.ts \
  tests/internal-production/golden-fleet-source-boundary.test.ts
npm run test:internal-production
npx tsc -p tsconfig.json --noEmit
git diff --check
```

Expected: PASS. Authorized handoff subject: `feat(acceptance): schedule fleet by golden result hash`.

---

### Task 4: Implement a Resumable Cold Rehearsal with Content-Addressed Receipts

**Files:**
- Create: `src/internal-production/cold-rehearsal-v1.ts`
- Create: `src/internal-production/cold-rehearsal-store.ts`
- Create: `src/internal-production/cold-rehearsal-restart-coordinator-v1.ts`
- Create: `src/internal-production/cold-rehearsal-restart-admission-v1.ts`
- Create: `src/internal-production/cold-rehearsal-database-child-operation-v1.ts`
- Create: `src/internal-production/cold-rehearsal-database-child-reaper-v1.ts`
- Create: `src/internal-production/cold-rehearsal-cli.ts`
- Create: `src/internal-production/internal-production-restart-phase-failure-v1.ts`
- Create: `tests/internal-production/internal-production-restart-phase-failure-v1.test.ts`
- Create: `tests/internal-production/cold-rehearsal-shared-restart-integration-v1.test.ts`
- Create: `tests/internal-production/cold-rehearsal-restart-admission-v1.test.ts`
- Create: `tests/internal-production/cold-rehearsal-database-child-operation-v1.test.ts`
- Create: `tests/internal-production/cold-rehearsal-database-child-reaper-v1.test.ts`
- Test: `tests/internal-production/cold-rehearsal-v1.test.ts`
- Test: `tests/internal-production/cold-rehearsal-store.test.ts`
- Test: `tests/internal-production/cold-rehearsal-cli.test.ts`
- Consume D's already merged spawner/dashboard/Mission Control generic startup hooks without modifying those sources in E.
- Modify: `package.json`

**Interfaces:**
- Consumes: A's zero-input unaliased `observeCompleteInternalProductionZeroOwnerCensusV1()` and exact `InternalProductionCompleteZeroOwnerCensusObservationV1` only for initial/final read-only checkpoints; D's fixed discovery locator, immutable `RecoveryRestartTargetAuthorizationOperationV1`, `RecoveryRestartTargetAuthorizationV1`, exact `InternalProductionServiceRestartTerminalCoreV1`, `InternalProductionRecoveryRestartTargetSetCloseV1`, occurrence/head/release/final-envelope types and resolvers, `prepareRecoveryRestartTargetAuthorizationV1(...)`, zero-input `resumeActiveRecoveryRestartTargetAuthorizationV1()`, status/resolvers, and authorization-pair-consuming `InternalProductionServiceRestartAuthorityV1` from `./internal-production-service-restart-authority-v1.js`; D's exact resolved startup-hooks-ready/cutover/activation chain; A's nested restart-authority retirement pair; B's exact `SetfarmCompletionOwnerReceiptProducerStartupAdmissionV1`/pair-only resolver for cross-flow verification only; A `observeInternalProductionRuntimeSourceV1`; B's accepted fleet settlement/status; `ColdDatabaseChildProcessPort`; bounded health/render observers; and platform-release preflight. E passes no observer, census body, or D global-zero ref/hash.
- Produces: `ColdRehearsalStateV1`, `ColdRehearsalReceiptV1`, `ColdRehearsalStore`, `ColdRehearsalCoordinatorLeaseV1`, `ColdRehearsalPhaseEvidenceStore`, `ColdRehearsalTargetAuthorityPort`, `ColdDatabaseChildReaperV1`, strict `ColdDatabaseChildReaperExitV1`, the cold remediation/source-repair admission adapter, the thin shared-authority coordinator, one deterministic E coordinator reservation and post-release close per service, and `runColdRehearsalV1(...)`. D alone produces every namespace/service occurrence/head/index, restart operation, seven target reservations, helper/child/PID/marker/settlement, TerminalCore, target-set close, release, final completion/failure envelope, and startup hook.

The isolated database subprocess boundary is exact:

```typescript
export type ColdDatabaseChildInvocationV1 =
  | Readonly<{
      kind: "postgres-tool";
      tool: "pg_dump" | "pg_restore" | "pg_restore-list";
      args: readonly string[];
      databaseUrl: string | null;
      targetDatabaseName: string | null;
      fixedOutput:
        | "intent-owned-archive-partial"
        | "intent-owned-list-partial"
        | "none";
    }>
  | Readonly<{
      kind: "setfarm-db-script";
      script:
        | "db:contract-spine:plan"
        | "db:contract-spine:verify"
        | "db:contract-spine:audit-current-authority-ledgers"
        | "db:contract-spine:audit-artifact-batches"
        | "db:contract-spine:audit-artifact-store-authority-ledger"
        | "db:contract-spine:audit-platform-release-store-records";
      args: readonly [];
      databaseUrl: string;
    }>;

export interface ColdDatabaseChildProcessPort {
  prepare(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    campaignHash: string;
    epochHash: string;
    attemptHash: string;
    phase: ColdRehearsalPhase;
    invocation: ColdDatabaseChildInvocationV1;
  }>): Promise<ColdDatabaseChildOperationV1>;
  executeOrRecover(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    operationRef: CanonicalRef;
    operationHash: string;
  }>): Promise<ColdDatabaseChildExecutionResultV1>;
  resolveOperation(input: Readonly<{
    operationRef: CanonicalRef;
    operationHash: string;
  }>): Promise<ColdDatabaseChildOperationV1>;
  resolveClaim(input: Readonly<{
    claimRef: CanonicalRef;
    claimHash: string;
  }>): Promise<ColdDatabaseChildClaimV1>;
  resolveReaperReceipt(input: Readonly<{
    reaperReceiptRef: CanonicalRef;
    reaperReceiptHash: string;
  }>): Promise<ColdDatabaseChildReaperReceiptV1>;
  resolveSpawnDecision(input: Readonly<{
    spawnDecisionRef: CanonicalRef;
    spawnDecisionHash: string;
  }>): Promise<ColdDatabaseChildSpawnDecisionV1>;
  resolveReaperExit(input: Readonly<{
    reaperExitRef: CanonicalRef;
    reaperExitHash: string;
  }>): Promise<ColdDatabaseChildReaperExitV1>;
  resolveSettlement(input: Readonly<{
    settlementRef: CanonicalRef;
    settlementHash: string;
  }>): Promise<ColdDatabaseChildSettlementV1>;
}

export interface ColdDatabaseChildOperationV1 {
  schema: "setfarm.internal-production-cold-database-child-operation.v1";
  campaignHash: string;
  epochHash: string;
  attemptHash: string;
  phase: ColdRehearsalPhase;
  invocationHash: string;
  operationIdHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
}

export interface ColdDatabaseChildClaimV1 {
  schema: "setfarm.internal-production-cold-database-child-claim.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  coordinatorFencingToken: number;
  reaperClaimKeyHash: string;
  claimRef: CanonicalRef;
  claimHash: string;
}

export interface ColdDatabaseChildReaperReceiptV1 {
  schema: "setfarm.internal-production-cold-database-child-reaper-receipt.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  claimRef: CanonicalRef;
  claimHash: string;
  reaperPid: number;
  reaperProcessIdentityHash: string;
  processGroupId: number;
  processGroupIdentityHash: string;
  registrationSinkRef: CanonicalRef;
  registrationSinkHash: string;
  reaperReceiptRef: CanonicalRef;
  reaperReceiptHash: string;
}

export interface ColdDatabaseChildReaperV1 {
  run(input: Readonly<{
    operationRef: CanonicalRef;
    operationHash: string;
  }>): Promise<
    | Readonly<{ status: "claim-lost"; reaperReceiptRef: CanonicalRef; reaperReceiptHash: string }>
    | Readonly<{
        status: "live";
        reaperReceiptRef: CanonicalRef;
        reaperReceiptHash: string;
        reaperPid: number;
        reaperProcessIdentityHash: string;
        processGroupId: number;
        processGroupIdentityHash: string;
      }>
  >;
}

export interface ColdDatabaseChildRegistrationV1 {
  schema: "setfarm.internal-production-cold-database-child-registration.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  reaperReceiptRef: CanonicalRef;
  reaperReceiptHash: string;
  spawnDecisionRef: CanonicalRef;
  spawnDecisionHash: string;
  processGroupId: number;
  processGroupIdentityHash: string;
  helperPid: number;
  helperProcessIdentityHash: string;
  childPid: number;
  childProcessIdentityHash: string;
  registrationRef: CanonicalRef;
  registrationHash: string;
}

export interface ColdDatabaseChildSpawnDecisionCommonV1 {
  schema: "setfarm.internal-production-cold-database-child-spawn-decision.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  reaperReceiptRef: CanonicalRef;
  reaperReceiptHash: string;
  processGroupId: number;
  processGroupIdentityHash: string;
  registrationSinkRef: CanonicalRef;
  registrationSinkHash: string;
}

export type ColdDatabaseChildSpawnDecisionV1 =
  | Readonly<ColdDatabaseChildSpawnDecisionCommonV1 & {
      kind: "spawn_not_issued";
      decidedBy: "coordinator" | "successor";
      reason: "pre_spawn_refusal" | "reaper_exited_before_decision";
      decisionCoordinatorOwnerProcessIdentityHash: string;
      decisionCoordinatorLeaseRecordRef: CanonicalRef;
      decisionCoordinatorLeaseRecordHash: string;
      decisionCoordinatorFencingTokenHash: string;
      decisionCoordinatorAcquiredAt: string;
      decisionCoordinatorExpiresAt: string;
      predecessorCoordinatorAbsenceAuthorityHash: string | null;
      reaperAbsenceAuthorityHash: string;
      processGroupAbsenceAuthorityHash: string;
      guardRef: CanonicalRef;
      guardHash: string;
      spawnDecisionRef: CanonicalRef;
      spawnDecisionHash: string;
    }>
  | Readonly<ColdDatabaseChildSpawnDecisionCommonV1 & {
      kind: "spawn_issued";
      decidedBy: "reaper";
      reason: "fixed_child_spawn_authorized";
      spawnDecisionRef: CanonicalRef;
      spawnDecisionHash: string;
    }>;

export interface ColdDatabaseChildPidReceiptV1 {
  schema: "setfarm.internal-production-cold-database-child-pid-receipt.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  claimRef: CanonicalRef;
  claimHash: string;
  reaperReceiptRef: CanonicalRef;
  reaperReceiptHash: string;
  spawnDecisionRef: CanonicalRef;
  spawnDecisionHash: string;
  processGroupIdentityHash: string;
  childPid: number;
  childProcessIdentityHash: string;
  pidReceiptRef: CanonicalRef;
  pidReceiptHash: string;
}

export type ColdDatabaseChildReaperExitV1 =
  | Readonly<{
      schema: "setfarm.internal-production-cold-database-child-reaper-exit.v1";
      kind: "no_child";
      operationRef: CanonicalRef;
      operationHash: string;
      reaperReceiptRef: CanonicalRef;
      reaperReceiptHash: string;
      spawnDecisionKind: "spawn_not_issued";
      spawnDecisionRef: CanonicalRef;
      spawnDecisionHash: string;
      decisionCoordinatorOwnerProcessIdentityHash: string;
      decisionCoordinatorLeaseRecordRef: CanonicalRef;
      decisionCoordinatorLeaseRecordHash: string;
      decisionCoordinatorFencingTokenHash: string;
      decisionCoordinatorAcquiredAt: string;
      decisionCoordinatorExpiresAt: string;
      predecessorCoordinatorAbsenceAuthorityHash: string | null;
      reaperAbsenceAuthorityHash: string;
      guardRef: CanonicalRef;
      guardHash: string;
      registrationRef: null;
      registrationHash: null;
      reaperExitCode: number | null;
      processGroupAbsenceAuthorityHash: string;
      reaperExitRef: CanonicalRef;
      reaperExitHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-cold-database-child-reaper-exit.v1";
      kind: "child_settled";
      operationRef: CanonicalRef;
      operationHash: string;
      reaperReceiptRef: CanonicalRef;
      reaperReceiptHash: string;
      spawnDecisionKind: "spawn_issued";
      spawnDecisionRef: CanonicalRef;
      spawnDecisionHash: string;
      registrationRef: CanonicalRef;
      registrationHash: string;
      pidReceiptRef: CanonicalRef;
      pidReceiptHash: string;
      childDisposition: "completed" | "failed" | "terminated-and-reaped";
      childExitCode: number | null;
      stdoutHash: string;
      stderrHash: string;
      processGroupAbsenceAuthorityHash: string;
      reaperExitRef: CanonicalRef;
      reaperExitHash: string;
    }>
  | Readonly<{
      schema: "setfarm.internal-production-cold-database-child-reaper-exit.v1";
      kind: "unregistered_child_terminated";
      operationRef: CanonicalRef;
      operationHash: string;
      reaperReceiptRef: CanonicalRef;
      reaperReceiptHash: string;
      spawnDecisionKind: "spawn_issued";
      spawnDecisionRef: CanonicalRef;
      spawnDecisionHash: string;
      registrationRef: null;
      registrationHash: null;
      reaperExitCode: number | null;
      processGroupTerminationAuthorityHash: string;
      processGroupReapAuthorityHash: string;
      processGroupAbsenceAuthorityHash: string;
      reaperExitRef: CanonicalRef;
      reaperExitHash: string;
    }>;

export interface ColdDatabaseChildSettlementV1 {
  schema: "setfarm.internal-production-cold-database-child-settlement.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  claimRef: CanonicalRef;
  claimHash: string;
  reaperReceiptRef: CanonicalRef;
  reaperReceiptHash: string;
  spawnDecisionKind: ColdDatabaseChildSpawnDecisionV1["kind"];
  spawnDecisionRef: CanonicalRef;
  spawnDecisionHash: string;
  reaperExitRef: CanonicalRef;
  reaperExitHash: string;
  terminal: ColdDatabaseChildReaperExitV1;
  publishedBy: "coordinator" | "successor";
  settlementRef: CanonicalRef;
  settlementHash: string;
}

export type ColdDatabaseChildExecutionResultV1 =
  | Readonly<{
      status: "in_progress";
      operationRef: CanonicalRef;
      operationHash: string;
      observationHash: string;
    }>
  | Readonly<{
      status: "settled";
      settlement: ColdDatabaseChildSettlementV1;
    }>;

export interface ColdRehearsalTargetAuthorityPort {
  requireAbsent(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    campaignHash: string;
    epochHash: string;
    attemptHash: string;
    targetDatabaseName: string;
  }>): Promise<Readonly<{ absenceObservationHash: string }>>;
  createOwnedTarget(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    campaignHash: string;
    epochHash: string;
    attemptHash: string;
    setfarmSha: string;
    targetDatabaseName: string;
    stateHash: string;
    pendingCreateIntentHash: string;
    expectedTargetDatabaseIdentityHash: string;
  }>): Promise<Readonly<{
    targetDatabaseIdentityHash: string;
    ownershipMarkerHash: string;
  }>>;
  reopenIdentity(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    campaignHash: string;
    epochHash: string;
    attemptHash: string;
    setfarmSha: string;
    targetDatabaseName: string;
    expectedStateHash: string;
    expectedOwnershipMarkerHash: string;
    expectedTargetDatabaseIdentityHash: string;
  }>): Promise<Readonly<{
    targetDatabaseIdentityHash: string;
    ownershipMarkerHash: string;
  }>>;
}

export interface ColdRehearsalCoordinatorLeaseV1 {
  readonly kind: "authenticated-cold-rehearsal-coordinator-lease";
  readonly ownerProcessIdentityHash: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly fencingToken: number;
  readonly leaseRecordRef: CanonicalRef;
  readonly leaseRecordHash: string;
  readonly leaseHash: string;
  readonly capability: unknown;
}

export interface ColdRehearsalCoordinatorLeaseRecordV1 {
  schema: "setfarm.internal-production-cold-rehearsal-coordinator-lease-record.v1";
  campaignHash: string;
  epochHash: string;
  attemptHash: string;
  leaseIdHash: string;
  ownerPid: number;
  ownerProcessIdentityHash: string;
  acquiredAt: string;
  expiresAt: string;
  leaseDurationMs: 30000;
  fencingToken: number;
  acquiredStateHash: string | null;
  predecessorLeaseRecordHash: string | null;
  ownerAbsenceAuthorityHash: string | null;
  leaseRecordRef: CanonicalRef;
  leaseRecordHash: string;
}

export function authenticateColdRehearsalCoordinatorLeaseV1(
  value: unknown,
): ColdRehearsalCoordinatorLeaseV1;

export interface ColdRehearsalServiceGenerationV1 {
  schema: "setfarm.internal-production-cold-rehearsal-service-generation.v1";
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  label: "com.setrox.setfarm-spawner" | "com.setrox.setfarm-dashboard" | "com.setrox.mission-control";
  generation: number;
  liveness: "alive" | "dead";
  actualPid: number | null;
  actualProcessIdentityHash: string;
  entrypointBuildIdentityHash: string;
  restartOperationIdHash: string | null;
  loadedSourceSha: string;
  processGenerationMarkerRef: CanonicalRef;
  processGenerationMarkerHash: string;
  generationHash: string;
}

// Imported without aliases from D's already merged
// `./internal-production-service-restart-authority-v1.js`:
// InternalProductionServiceRestartAuthorityV1,
// InternalProductionServiceRestartOperationV1,
// InternalProductionServiceRestartCompletionReceiptV1,
// InternalProductionServiceRestartFailureReceiptV1,
// InternalProductionServiceRestartTerminalCoreV1,
// InternalProductionRecoveryRestartTargetSetCloseV1,
// InternalProductionServiceRestartTerminalPredecessorV1,
// InternalProductionServiceRestartOccurrenceV1,
// InternalProductionServiceRestartHeadV1,
// InternalProductionServiceRestartDispatchReservationV1,
// InternalProductionServiceRestartNamespaceV1,
// RecoveryRestartTargetAuthorizationPreparedSnapshotV1,
// RecoveryRestartTargetAuthorizationActivePendingV1,
// RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1,
// RecoveryRestartTargetAuthorizationOperationV1,
// RecoveryRestartTargetAuthorizationV1,
// RecoveryRestartTargetAuthorizationStatusV1,
// InternalProductionServiceRestartExecutionResultV1, and
// deriveInternalProductionServiceRestartOperationIdV1, and
// createInternalProductionServiceRestartAuthorityV1,
// prepareRecoveryRestartTargetAuthorizationV1,
// resumeActiveRecoveryRestartTargetAuthorizationV1,
// observeRecoveryRestartTargetAuthorizationStatusV1, and
// resolveRecoveryRestartTargetAuthorizationOperationV1,
// resolveRecoveryRestartTargetAuthorizationV1,
// resolveRecoveryRestartTargetAuthorizationPreparedSnapshotV1,
// resolveRecoveryRestartTargetAuthorizationActivePendingV1,
// resolveInternalProductionServiceRestartTerminalCoreV1, and
// resolveInternalProductionRecoveryRestartTargetSetCloseV1.

export interface ColdRehearsalRestartAdmissionV1 {
  authorize(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    campaignHash: string;
    finalReleaseEpoch: GoldenFinalReleaseEpochV1;
    attemptHash: string;
    service: ColdRehearsalServiceGenerationV1["service"];
    remediationReceiptRef: CanonicalRef | null;
    remediationReceiptHash: string | null;
  }>): Promise<InternalProductionServiceRestartTerminalPredecessorV1 | null>;
}

export interface ColdRehearsalSharedRestartCoordinatorV1 {
  prepareTargetAuthorization(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    campaignHash: string;
    finalReleaseEpoch: GoldenFinalReleaseEpochV1;
    attemptHash: string;
    service: ColdRehearsalServiceGenerationV1["service"];
    beforeGeneration: ColdRehearsalServiceGenerationV1;
    terminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
    coordinationRef: CanonicalRef;
    coordinationHash: string;
    coordinationIdHash: string;
    expectedOperationIdHash: string;
    coordinatorReservationRef: CanonicalRef;
    coordinatorReservationHash: string;
  }>): Promise<Readonly<{
    preparedActivePendingRef: CanonicalRef;
    preparedActivePendingHash: string;
    currentActivePendingRef: typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1;
    currentActivePendingHash: string;
  }>>;
  observeTargetAuthorizationStatus(): Promise<RecoveryRestartTargetAuthorizationStatusV1>;
  resumeTargetAuthorization(): Promise<Readonly<{
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>>;
  prepareRestart(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>): Promise<InternalProductionServiceRestartOperationV1>;
  executeOrRecover(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    operationRef: CanonicalRef;
    operationHash: string;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>): Promise<InternalProductionServiceRestartExecutionResultV1>;
}

export function createColdRehearsalSharedRestartCoordinatorV1():
  ColdRehearsalSharedRestartCoordinatorV1;

export interface ColdRehearsalRestartPort {
  observe(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
  }>): Promise<readonly [
    ColdRehearsalServiceGenerationV1,
    ColdRehearsalServiceGenerationV1,
    ColdRehearsalServiceGenerationV1
  ]>;
}

export interface ColdRehearsalStore {
  acquireCoordinatorLease(input: Readonly<{
    campaignHash: string;
    epochHash: string;
    attemptHash: string;
    expectedStateHash: string | null;
  }>): Promise<
    | Readonly<{ status: "acquired"; lease: ColdRehearsalCoordinatorLeaseV1 }>
    | Readonly<{ status: "busy"; refusalCode: "COLD_REHEARSAL_COORDINATOR_BUSY" }>
  >;
  compareAndSwapState(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    previousStateHash: string | null;
    next: ColdRehearsalStateV1;
  }>): Promise<void>;
  renewCoordinatorLease(input: Readonly<{
    lease: ColdRehearsalCoordinatorLeaseV1;
    expectedLeaseRecordHash: string;
  }>): Promise<ColdRehearsalCoordinatorLeaseV1>;
  releaseCoordinatorLease(lease: ColdRehearsalCoordinatorLeaseV1): Promise<void>;
}

export interface ColdRehearsalPhaseEvidenceStore {
  putZeroOwnerObservation(input: Readonly<{
    phase: "zero-owner-before" | "zero-owner-after";
    observation: InternalProductionCompleteZeroOwnerCensusObservationV1;
  }>): Promise<Readonly<{ evidenceRef: string; evidenceHash: string }>>;
  getZeroOwnerObservation(input: Readonly<{
    phase: "zero-owner-before" | "zero-owner-after";
    evidenceRef: string;
    evidenceHash: string;
  }>): Promise<Readonly<{
    phase: "zero-owner-before" | "zero-owner-after";
    observation: InternalProductionCompleteZeroOwnerCensusObservationV1;
  }>>;
  putRestartAuthorization(input: Readonly<{
    phase: "pre-restart-spawner" | "pre-restart-dashboard" | "pre-restart-mission-control";
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>): Promise<Readonly<{ evidenceRef: string; evidenceHash: string }>>;
  getRestartAuthorization(input: Readonly<{
    phase: "pre-restart-spawner" | "pre-restart-dashboard" | "pre-restart-mission-control";
    evidenceRef: string;
    evidenceHash: string;
  }>): Promise<Readonly<{
    phase: "pre-restart-spawner" | "pre-restart-dashboard" | "pre-restart-mission-control";
    authorizationOperationRef: CanonicalRef;
    authorizationOperationHash: string;
    authorizationRef: CanonicalRef;
    authorizationHash: string;
  }>>;
}

export type ColdRehearsalCompletedPhaseNameV1 = Exclude<
  ColdRehearsalStateV1["phase"],
  "admitted" | "failed"
>;

export type ColdRehearsalCompletedPhaseEntryV1 = Readonly<{
  phase: ColdRehearsalCompletedPhaseNameV1;
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

export type ColdRehearsalCompletedPhaseListV1 = readonly ColdRehearsalCompletedPhaseEntryV1[] &
  Readonly<{ length: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 }>;

export type ColdRehearsalZeroOwnerObservationBindingV1 = Readonly<{
  observationHash: string;
  ownerCategoryRegistryHash: string;
  ownerCategoryCensusMapHash: string;
  activeProducerManifestSetActivationRef: CanonicalRef;
  activeProducerManifestSetActivationHash: string;
  activeProducerManifestSetHash: string;
  reservationIdentitySetHash: string;
  ownerIdentitySetHash: string;
  phaseEvidenceRef: CanonicalRef;
  phaseEvidenceHash: string;
}>;

export type InternalProductionERestartPhaseTerminalCoreV1 = Readonly<{
  schema: "setfarm.internal-production-e-restart-phase-terminal-core.v1";
  namespace: "source-release-barrier" | "cold-rehearsal" | "documentation-handoff";
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  coordinationRef: CanonicalRef;
  coordinationHash: string;
  coordinatorReservationRef: CanonicalRef;
  coordinatorReservationHash: string;
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
  targetSetCloseRef: CanonicalRef;
  targetSetCloseHash: string;
  occurrenceRef: CanonicalRef;
  occurrenceHash: string;
  namespaceServiceHeadRef: CanonicalRef;
  namespaceServiceHeadHash: string;
  ownerAdmissionFenceReleaseRef: CanonicalRef;
  ownerAdmissionFenceReleaseHash: string;
  finalEnvelopeKind: "complete" | "failed";
  finalEnvelopeRef: CanonicalRef;
  finalEnvelopeHash: string;
  eRestartPhaseTerminalCoreRef: CanonicalRef;
  eRestartPhaseTerminalCoreHash: string;
}>;

type InternalProductionERestartTerminalizedCommonV1 = Readonly<{
  namespace: InternalProductionERestartPhaseTerminalCoreV1["namespace"];
  service: InternalProductionERestartPhaseTerminalCoreV1["service"];
  coordinationRef: CanonicalRef;
  coordinationHash: string;
  coordinatorReservationRef: CanonicalRef;
  coordinatorReservationHash: string;
  preparedActivePendingRef: CanonicalRef;
  preparedActivePendingHash: string;
  authorizationOperationRef: CanonicalRef;
  authorizationOperationHash: string;
  authorizationRef: CanonicalRef;
  authorizationHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
  terminalCoreRef: CanonicalRef;
  terminalCoreHash: string;
  targetSetCloseRef: CanonicalRef;
  targetSetCloseHash: string;
  occurrenceRef: CanonicalRef;
  occurrenceHash: string;
  namespaceServiceHeadRef: CanonicalRef;
  namespaceServiceHeadHash: string;
  ownerAdmissionFenceReleaseRef: CanonicalRef;
  ownerAdmissionFenceReleaseHash: string;
  finalEnvelopeRef: CanonicalRef;
  finalEnvelopeHash: string;
  eRestartPhaseTerminalCoreRef: CanonicalRef;
  eRestartPhaseTerminalCoreHash: string;
  coordinatorReservationCloseRef: CanonicalRef;
  coordinatorReservationCloseHash: string;
}>;

export type InternalProductionERestartTerminalizedBindingV1 =
  | Readonly<InternalProductionERestartTerminalizedCommonV1 & {
      terminalKind: "complete";
      terminalCoreDispositionKind: "complete";
      occurrenceTerminalDisposition: "complete";
      finalEnvelopeKind: "complete";
      completionRef: CanonicalRef;
      completionHash: string;
      failureRef: null;
      failureHash: null;
      beforeGenerationHash: string;
      afterGenerationHash: string;
      generationChanged: true;
    }>
  | Readonly<InternalProductionERestartTerminalizedCommonV1 & {
      terminalKind: "failed";
      terminalCoreDispositionKind: "failed";
      occurrenceTerminalDisposition: "failed";
      finalEnvelopeKind: "failed";
      completionRef: null;
      completionHash: null;
      failureRef: CanonicalRef;
      failureHash: string;
      beforeGenerationHash: string;
      afterGenerationHash: null;
      generationChanged: false;
    }>;

export type InternalProductionECompletedRestartPhaseBindingV1 = Extract<
  InternalProductionERestartTerminalizedBindingV1,
  Readonly<{ terminalKind: "complete" }>
>;

export type InternalProductionEFailedRestartPhaseBindingV1 = Extract<
  InternalProductionERestartTerminalizedBindingV1,
  Readonly<{ terminalKind: "failed" }>
>;

export type InternalProductionERestartPhaseFailureReceiptPairV1 = Readonly<{
  failureReceiptRef: CanonicalRef;
  failureReceiptHash: string;
}>;

export type InternalProductionERestartPhaseFailureScopeIdentityV1 =
  | Readonly<{
      scope: "cold-rehearsal";
      campaignHash: string;
      epochHash: string;
      attemptHash: string;
      service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
      scopeIdentityHash: string;
    }>
  | Readonly<{
      scope: "source-release-barrier";
      epochHash: string;
      service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
      scopeIdentityHash: string;
    }>
  | Readonly<{
      scope: "documentation-handoff";
      intentHash: string;
      service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
      scopeIdentityHash: string;
    }>;

export type InternalProductionERestartPhaseFailureReceiptV1 =
  | Readonly<Extract<InternalProductionERestartPhaseFailureScopeIdentityV1, Readonly<{ scope: "cold-rehearsal" }>> & {
      schema: "setfarm.internal-production-e-restart-phase-failure-receipt.v1";
      terminal: InternalProductionEFailedRestartPhaseBindingV1 & Readonly<{ namespace: "cold-rehearsal" }>;
      failureReceiptRef: CanonicalRef;
      failureReceiptHash: string;
    }>
  | Readonly<Extract<InternalProductionERestartPhaseFailureScopeIdentityV1, Readonly<{ scope: "source-release-barrier" }>> & {
      schema: "setfarm.internal-production-e-restart-phase-failure-receipt.v1";
      terminal: InternalProductionEFailedRestartPhaseBindingV1 & Readonly<{ namespace: "source-release-barrier" }>;
      failureReceiptRef: CanonicalRef;
      failureReceiptHash: string;
    }>
  | Readonly<Extract<InternalProductionERestartPhaseFailureScopeIdentityV1, Readonly<{ scope: "documentation-handoff" }>> & {
      schema: "setfarm.internal-production-e-restart-phase-failure-receipt.v1";
      terminal: InternalProductionEFailedRestartPhaseBindingV1 & Readonly<{ namespace: "documentation-handoff" }>;
      failureReceiptRef: CanonicalRef;
      failureReceiptHash: string;
    }>;

export interface InternalProductionERestartPhaseFailureReceiptStoreV1 {
  put(input: Readonly<{ receipt: InternalProductionERestartPhaseFailureReceiptV1 }>): Promise<
    InternalProductionERestartPhaseFailureReceiptPairV1
  >;
  resolve(input: Readonly<{
    scopeIdentity: InternalProductionERestartPhaseFailureScopeIdentityV1;
    failureReceiptRef: CanonicalRef;
    failureReceiptHash: string;
  }>): Promise<InternalProductionERestartPhaseFailureReceiptV1>;
}

export interface InternalProductionERestartPhaseFailureStatusV1 {
  schema: "setfarm.internal-production-e-restart-phase-failure-status.v1";
  scopeIdentity: InternalProductionERestartPhaseFailureScopeIdentityV1;
  failureReceiptRef: CanonicalRef;
  failureReceiptHash: string;
  previousStatusHash: string | null;
  statusRef: CanonicalRef;
  statusHash: string;
}

export interface InternalProductionERestartPhaseFailureStatusStoreV1 {
  compareAndSwap(input: Readonly<{
    scopeIdentity: InternalProductionERestartPhaseFailureScopeIdentityV1;
    expectedStatusHash: string | null;
    next: InternalProductionERestartPhaseFailureStatusV1;
  }>): Promise<void>;
  resolve(input: Readonly<{
    scopeIdentity: InternalProductionERestartPhaseFailureScopeIdentityV1;
  }>): Promise<InternalProductionERestartPhaseFailureStatusV1 | null>;
}
```

`InternalProductionERestartPhaseFailureReceiptV1` is acyclic: canonical receipt bytes bind the strict scope identity, service, and exact failed terminal chain `D failed final envelope -> close-free E core -> A coordinator close`, then derive their own canonical receipt ref/hash. Cold identity is exactly `campaignHash + epochHash + attemptHash + service`; source identity is exactly final-release `epochHash + service`; documentation identity is exactly `intentHash + service`; every receipt and status derives and binds `scopeIdentityHash` from that finite discriminant. They contain no later cold/source/docs state, source status, documentation journal/phase, or status-head field. Each outer failed state/status/phase stores only `InternalProductionERestartPhaseFailureReceiptPairV1`, freshly resolves it through the strict discriminated identity resolver, and only then performs its fixed identity/service status/head CAS; neither direction embeds the other record. `compareAndSwap` and `resolve` accept the full exact discriminated identity plus service, never a bare scope/hash or scan; content addresses are no-replace, statuses are expected-predecessor CAS only, and historical cold attempts/source epochs/docs intents remain resolvable forever. E imports and uses D's unaliased `resolveRecoveryRestartTargetAuthorizationPreparedSnapshotV1` only to reopen the immutable prepared snapshot pair, and D's unaliased `resolveRecoveryRestartTargetAuthorizationActivePendingV1` only to reopen the mutable current fixed-locator pair, both from `./internal-production-service-restart-authority-v1.js`, before validating them before locator clear. Hash-order tests prove `D failure envelope -> E core -> A close -> E failure receipt -> outer failure status/head`; crash/tamper/reopen tests at each boundary reject a receipt that embeds, derives from, or is substituted by its later outer state/status/phase, a cross-scope/identity/service pair, an overwrite/scan, or a status-head CAS before full receipt resolution.

`InternalProductionSourceReleaseServiceRebindFailedRestartV1` and the documentation `restart-service-failed` phase are pair-only outer records: each names only its namespace, service, and canonical failure receipt pair (plus the documentation phase common journal fields). They do not intersect, copy, or structurally embed `InternalProductionEFailedRestartPhaseBindingV1`, TerminalCore, D envelope, A close, operation, authorization, or pending identities. Their resolver reopens the pair and verifies scope/service before admitting the fixed failed status/head; source-boundary and crash/tamper tests reject every structural terminal duplication.

`InternalProductionRestartPendingProgressV1` has exactly eight variants: `prepare-input-persisted` is the sole pre-prepare variant and has every prepared/current field null; `target-authorization-pending-persisted` is the sole locator-live post-prepare variant and carries the immutable prepared pair plus the initial current observation snapshot whose ref is exactly `typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1`; the other exactly six post-prepare variants retain immutable authority but set both current fields null. No ninth E state exists. The initial current ref/hash proves only what prepare returned and is never reopened as historical or predecessor authority after D advances the fixed locator. On every target-state recovery, E calls D's zero-input status, requires a non-absent active phase `pending-input | operation-published | authorized`, resolves only that freshly observed current pair through D's active-pending resolver, and binds the resolved authority to the persisted immutable prepared snapshot plus exact namespace/service/coordination. Missing, foreign, failure, or terminal status fails. E invokes zero-input resume idempotently from any of the three active phases, including `authorized` after response loss. After resume returns the immutable authorization-operation/authorization quartet, E calls status again, requires exact phase `authorized`, resolves only that currently observed pair, and requires it to bind the same prepared/namespace/service/coordination and the returned quartet. E then reopens/validates the immutable operation and authorization pairs and atomically publishes `authorization-operation-persisted` with both while clearing all current fields. There is no E same-literal current-state CAS, old-current reopen, predecessor comparison, or chain adoption. `authorization-persisted` is the later fresh resolution/validation of the already persisted authorization pair, never its first storage. Crash/retry tests cover all three status phases and authorized response loss, and reject an old-current resolver call, missing/foreign/terminal status, quartet mismatch, direct skip to the operation state, an operation transition that retains the locator, or one that omits either returned immutable pair.

`preparedActivePendingRef/preparedActivePendingHash` is D's immutable, distinct content-addressed prepared snapshot. `currentActivePendingRef/currentActivePendingHash` in the target state is only the initial prepare-time observation of D's mutable fixed locator, whose ref is exactly `typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1`; it is not content-addressed history and may become unresolvable as soon as D advances. D restart operations bind only the prepared snapshot hash. Every recovery ignores the stored old current pair for authorization, obtains zero-input status, and resolves only the currently observed D pair. Pre-resume accepts any non-absent active phase with the same immutable prepared/namespace/service/coordination identity and repeats resume. Post-resume accepts only exact D `authorized` status whose current authority binds the returned quartet and the same identity. It then reopens/validates both returned immutable pairs and atomically stores them in the locator-clearing authorization-operation state. Once that atomic transition is durable, E never invokes a current resolver/status again or serializes the locator into authorization, lease, D-terminal, E-core, close, completed, failure, or historical records; recovery uses only the immutable prepared snapshot, operation, authorization, and terminal chain. `authorization-persisted` only fresh-resolves and validates the already stored authorization pair, including its reciprocal prepared snapshot plus namespace/service/coordination relation. It never substitutes, overwrites, or uses an old/current equality or predecessor relation as an acceptance criterion.

The shared coordinator interface and source-boundary AST tests require unaliased static import of D's `RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1` and both D resolvers: `resolveRecoveryRestartTargetAuthorizationPreparedSnapshotV1({preparedActivePendingRef,preparedActivePendingHash})` is the only prepared-pair resolver, while `resolveRecoveryRestartTargetAuthorizationActivePendingV1({currentActivePendingRef,currentActivePendingHash})` resolves only the pair returned by the immediately preceding zero-input status call. The latter is called only with a ref statically typed as `typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1`; it is never called with the target state's stale initial hash after D has advanced. Cold, source, and docs tests exercise current resolution only through fresh pre/post-resume status and immediately before atomic immutable authorization-operation-plus-authorization persistence; they assert that transition clears the current pair durably, contains both returned immutable pairs, and no later state/recovery calls either current resolver or status. They reject reopening the stored initial current snapshot as history, resolving a prepared pair with the active-pending resolver, a current pair with the prepared-snapshot resolver, a widened `CanonicalRef` locator type, swapped pairs, a missing resolver, post-clear current resolution, an authorization first persisted after the clear, or any structural substitute.

```typescript
export type ColdRehearsalRestartAuthorizationBindingV1 =
  InternalProductionECompletedRestartPhaseBindingV1 & Readonly<{
  phaseEvidenceRef: CanonicalRef;
  phaseEvidenceHash: string;
}>;

export type ColdRehearsalPhaseReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-cold-rehearsal-phase-receipt.v1";
  campaignHash: string;
  epochHash: string;
  attemptOrdinal: 1 | 2 | 3;
  attemptHash: string;
  phase: ColdRehearsalCompletedPhaseNameV1;
  predecessorReceiptHash: string | null;
  evidence:
    | Readonly<{ kind: "zero-owner"; observation: ColdRehearsalZeroOwnerObservationBindingV1 }>
    | Readonly<{ kind: "backup"; backupRef: CanonicalRef; archiveHash: string; archiveListHash: string; checksumFileHash: string }>
    | Readonly<{
        kind: "restore-created";
        targetNameHash: string;
        targetDatabaseIdentityHash: string;
        ownershipMarkerHash: string;
      }>
    | Readonly<{
        kind: "restore-verified";
        migrationPlanHash: string;
        migrationVerifyHash: string;
        authorityAuditHashes: readonly string[];
      }>
    | Readonly<{
        kind: "restart";
        service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
        restartAuthorization: ColdRehearsalRestartAuthorizationBindingV1;
        operationRef: CanonicalRef;
        operationHash: string;
        beforeGenerationHash: string;
        afterGenerationHash: string;
      }>
    | Readonly<{
        kind: "health-runtime-host";
        health: Readonly<{
          missionControlHash: string;
          dashboardHash: string;
          openClawHash: string;
          renderSmokeHash: string;
        }>;
        runtimeSource: Readonly<{
          setfarmSha: string;
          missionControlSha: string;
          spawnerServiceIdentityHash: string;
          dashboardServiceIdentityHash: string;
          missionControlServiceIdentityHash: string;
          observationHash: string;
        }>;
        hostConfirmation: Readonly<{
          processHash: string;
          portHash: string;
          worktreeHash: string;
        }>;
      }>
    | Readonly<{
        kind: "external-preflight";
        preflight: ExternalDistributionPreflightBindingV1;
        completedAt: string;
      }>
    | Readonly<{ kind: "complete"; terminalReceiptHash: string }>;
  receiptHash: string;
}>;

export interface ColdRehearsalCompletedPhaseStore {
  put(receipt: ColdRehearsalPhaseReceiptV1): Promise<Readonly<{
    receiptRef: CanonicalRef;
    receiptHash: string;
  }>>;
  get(input: Readonly<{
    receiptRef: CanonicalRef;
    receiptHash: string;
  }>): Promise<ColdRehearsalPhaseReceiptV1>;
}

export interface ColdRehearsalIncidentRemediationReceiptV1 {
  schema: "setfarm.internal-production-cold-rehearsal-remediation-receipt.v1";
  campaignHash: string;
  epochHash: string;
  failedAttemptHash: string;
  failedReceiptHash: string;
  failureClass: "provider" | "infrastructure" | "host";
  systemicRootHash: string;
  occurrence: 1 | 2;
  remediationEvidenceRefs: readonly CanonicalRef[];
  remediationEvidenceHash: string;
  independentReviewReceiptRef: CanonicalRef;
  independentReviewReceiptHash: string;
  unchangedSourceEpochHash: string;
  receiptHash: string;
}

export interface ColdRehearsalFailureReceiptV1 {
  schema: "setfarm.internal-production-cold-rehearsal-failure-receipt.v1";
  campaignHash: string;
  epochHash: string;
  attemptOrdinal: 1 | 2 | 3;
  attemptHash: string;
  failedBoundary: Exclude<ColdRehearsalStateV1["phase"], "complete" | "failed">;
  failureCode: ColdRehearsalFailureCodeV1;
  failureClass: "provider" | "infrastructure" | "host" | "platform" | "product";
  systemicRootHash: string;
  lastCompletedPhaseRef: CanonicalRef | null;
  lastCompletedPhaseHash: string | null;
  failureObservedFromStateHash: string;
  restartPhaseFailure: InternalProductionERestartPhaseFailureReceiptPairV1 | null;
  cleanup: Readonly<{
    zeroOwnerObservationHash: string | null;
    cleanupDisposition: "clean" | "incomplete" | "not_applicable";
  }>;
  failureReceiptHash: string;
}

export type ColdRehearsalFailureCodeV1 =
  | "COLD_ADMISSION_REJECTED"
  | "COLD_ZERO_OWNER_NOT_ZERO"
  | "COLD_BACKUP_FAILED"
  | "COLD_BACKUP_COLLISION"
  | "COLD_RESTORE_FAILED"
  | "COLD_RESTORE_AUDIT_FAILED"
  | "COLD_RESTART_FAILED"
  | "COLD_RESTART_DISPATCH_OUTCOME_UNCERTAIN"
  | "COLD_RESTART_EXPECTED_PROCESS_DIED"
  | "COLD_RESTART_SELF_AMBIGUOUS"
  | "COLD_RESTART_UNRELATED_AMBIGUOUS"
  | "COLD_HEALTH_FAILED"
  | "COLD_RUNTIME_SOURCE_MISMATCH"
  | "COLD_HOST_CONFIRMATION_FAILED"
  | "COLD_EXTERNAL_PREFLIGHT_MISMATCH";

export interface ColdRehearsalFailureReceiptStore {
  put(receipt: ColdRehearsalFailureReceiptV1): Promise<Readonly<{
    receiptRef: CanonicalRef;
    receiptHash: string;
  }>>;
  get(input: Readonly<{
    receiptRef: CanonicalRef;
    receiptHash: string;
  }>): Promise<ColdRehearsalFailureReceiptV1>;
}

export interface ColdRehearsalIncidentRemediationAuthorityV1 {
  observe(input: Readonly<{
    campaignHash: string;
    epochHash: string;
    failedAttemptHash: string;
  }>): Promise<ColdRehearsalIncidentRemediationReceiptV1>;
  consume(input: Readonly<{
    receiptHash: string;
    expectedNextOrdinal: 2 | 3;
  }>): Promise<Readonly<{ consumedReceiptHash: string }>>;
}

export interface ColdRehearsalIncidentReviewReceiptV1 {
  schema: "setfarm.internal-production-cold-rehearsal-incident-review-receipt.v1";
  campaignHash: string;
  epochHash: string;
  failedAttemptHash: string;
  failureReceiptHash: string;
  systemicRootHash: string;
  reviewerKind: "independent-agent";
  verdict: "clear";
  unresolved: Readonly<{ critical: 0; high: 0; medium: 0 }>;
  remediationEvidenceRefs: readonly CanonicalRef[];
  remediationEvidenceHash: string;
  receiptHash: string;
}
```

The production child port has fixed executables, `shell:false`, the Setfarm package root as fixed `cwd`, bounded time/output, and a replace-not-merge child environment. Its private controller resolves the two fixed output literals from the authenticated lease/pending-backup intent and never accepts a path. `pg_dump` requires `fixedOutput:"intent-owned-archive-partial"`; the controller appends its descriptor-owned partial archive target. `pg_restore-list` requires `databaseUrl:null`, `fixedOutput:"intent-owned-list-partial"`, has no database environment, and invokes pinned `pg_restore --list --file INTERNAL_PARTIAL_LIST SEALED_STAGED_ARCHIVE`; stdout must be empty and the reopened list must be nonempty, bounded, and parse as the pinned archive-list form before sealing. Direct restore uses `fixedOutput:"none"`. For `postgres-tool`, the port parses the supplied PostgreSQL URL in memory into only `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and the finite supported TLS mode. `targetDatabaseName` is non-null only for direct `pg_restore`, passes the strict internally derived identifier in argv, and must equal child `PGDATABASE`; host/user/password remain environment-only. Target creation is unavailable through this generic port and belongs only to `ColdRehearsalTargetAuthorityPort`. For `setfarm-db-script`, the sole database entry is `SETFARM_PG_URL`. Both modes also receive only validated `PATH`, `HOME`, `TMPDIR`, `LANG:C`, and `LC_ALL:C`; they inherit nothing else. The port rejects a database URL, password, or connection-string fragment in argv, output, error text, or a receipt. Tests receive a freshly allocated isolated database URL only through this port.

Every `pg_dump`, `pg_restore-list`, direct `pg_restore`, and fixed `setfarm-db-script` child is mediated by the operation-specific `ColdDatabaseChildReaperV1`; the E coordinator has no direct child-spawn seam. `prepare` derives one deterministic operation ID from campaign/epoch/attempt/phase plus the canonical invocation hash, content-addresses the operation, and installs its fixed no-replace operation key before any process exists. `executeOrRecover` first persists and reopens the one operation-bound `ColdDatabaseChildClaimV1` under the current coordinator fencing token. Only then may its fixed no-shell launcher start `cold-rehearsal-database-child-reaper-v1.ts` with exactly `operationRef` and `operationHash`. The reaper creates its exact isolated process group, opens the operation-specific registration pipe and descriptor-backed sink, CAS-claims `reaperClaimKeyHash`, and durably records its own PID/process identity, process-group ID/identity, and sink ref/hash before spawning anything. `run()` returns only `claim-lost` or the authenticated live reaper/process-group execution identity; it never waits for, constructs, returns, or implies an exit/settlement. Immediately before the first OS spawn call, the CAS winner exclusively publishes, fsyncs, reopens, and authenticates the `kind:"spawn_issued"` member of `ColdDatabaseChildSpawnDecisionV1` at the operation's fixed no-replace key. Only that reopened member permits the fixed helper/database child spawn. A pre-spawn refusal is written to the fixed sink and the reaper exits without publishing a decision. Only the coordinator after directly reaping it, or a fenced successor after exact predecessor-coordinator/reaper/group absence, may publish `kind:"spawn_not_issued"`; this is sound because source boundaries prove no OS spawn can precede durable `spawn_issued`.

The `spawn_not_issued` publisher first authenticates and reopens the current `ColdRehearsalCoordinatorLeaseRecordV1` plus WeakMap lease guard and the exact database-child operation. It derives `decisionCoordinatorFencingTokenHash` from campaign/epoch/attempt, lease-record ref/hash, owner process identity, acquired/expiry values, numeric fencing token, guard ref/hash, and operation ref/hash. The member repeats those identities, exact reaper and process-group absence authorities, and `predecessorCoordinatorAbsenceAuthorityHash`; that predecessor member is null only when `decidedBy:"coordinator"` still owns the original live lease and is non-null only when `decidedBy:"successor"` has authenticated the expired predecessor owner absent and acquired the next fenced record. A stale/expired current coordinator, live/ambiguous predecessor, missing predecessor absence for a successor, non-null predecessor absence for the original coordinator, wrong owner/times/token/guard/operation, or reaper/group still live fails before decision publication. The resolver reopens every named authority, recomputes the token/decision hashes and temporal/null relations, and returns frozen bytes. Retrying the launcher is safe: one CAS winner may reach spawn; every loser resolves the winning receipt and exits before spawn. A durable claim with no winning reaper receipt may relaunch the same reaper command, but once the receipt exists no retry may create another child.

The winning reaper is the durable parent of the fixed helper and database child and owns bounded stdout/stderr capture, termination, and direct reap while it remains alive. It passes the already opened registration pipe/sink into the helper. The spawn boundary emits and fsyncs one authenticated `ColdDatabaseChildRegistrationV1` binding helper PID/identity, child PID/identity, operation, reaper, spawn-decision receipt, and exact process-group identity before the ordinary PID receipt is published. Therefore a helper or reaper crash after child spawn but before PID-receipt publication leaves the durable `spawn_issued` upper bound plus an authenticated group recovery key. A recovery coordinator or fenced successor first proves the recorded reaper exited or is absent, then queries only that exact authenticated process-group ID/identity, terminates any matching helper/child members, waits for or proves their reaping/absence, and reconstructs/adopts registration/PID/output authority from the preopened sink when a complete frame exists. It never searches by command, nearest PID, directory, or time, and never spawns a replacement after a reaper receipt exists. An authenticated `spawn_not_issued` decision plus exact reaper exit/absence and group absence can produce only `kind:"no_child"`. An authenticated `spawn_issued` plus a valid registration produces only `kind:"child_settled"`; the same decision plus an empty, missing, truncated, or unauthenticated registration frame produces only `kind:"unregistered_child_terminated"` after exact process-group termination, reap, and absence authority are durable. Absence of a decision, a mismatched union member, foreign/reused PGID, mixed group, or ambiguity fails closed.

The reaper publishes only its immutable live receipt, `spawn_issued` when it crosses the OS-spawn boundary, registration/PID/output records, and a final frame to the preopened sink; that frame is evidence of its intended return, never proof that the reaper exited. It never publishes `spawn_not_issued`, returns/publishes `ColdDatabaseChildReaperExitV1` or `ColdDatabaseChildSettlementV1`, or claims its own absence while live. The current fenced coordinator may create the exit record only after it has captured and reaped its exact reaper child; a fenced successor may create it only after authenticating the prior coordinator and reaper absent plus exact process-group settlement. Both first resolve/re-hash the exact spawn-decision union member, then and only then publish exit plus settlement. A `no_child` exit repeats the complete not-issued coordinator lease/token/predecessor/reaper/group/guard/operation authority, while every settlement repeats the exact decision kind/ref/hash and embeds the strict `no_child | child_settled | unregistered_child_terminated` terminal member plus `publishedBy:"coordinator"|"successor"`. The resolver requires byte equality from decision through exit through settlement and rejects a publisher/lease/token/absence field lost or changed at either boundary. A live reaper yields `in_progress`; a clean registered child exit yields the exact child-settled result; `no_child` and `unregistered_child_terminated` are finite failed child operations and never authorize replay. All records use mode-`0600`, unpredictable temporary siblings, file fsync, atomic no-replace publication, parent fsync, and `O_NOFOLLOW` regular/one-link reopen. A response loss or coordinator death resolves the exact operation, claim, live reaper receipt, spawn decision, registration sink, process-group authority, coordinator/successor-authored exit, and settlement. A reclaimed coordinator is refused from the next operation until the prior reaper/helper/child group is terminal and absent. Invocation reconstruction from prose and new logical child-operation rollover are forbidden.

- [ ] **Step 1: Write failing receipt and phase-order tests**

Define the resumable state journal exactly:

```typescript
export type InternalProductionRestartPendingProgressV1 =
  | Readonly<{
      state: "prepare-input-persisted";
      preparedActivePendingRef: null; preparedActivePendingHash: null;
      currentActivePendingRef: null; currentActivePendingHash: null;
      authorizationOperationRef: null; authorizationOperationHash: null;
      authorizationRef: null; authorizationHash: null;
      operationRef: null; operationHash: null;
      terminalCoreRef: null; terminalCoreHash: null;
      targetSetCloseRef: null; targetSetCloseHash: null;
      occurrenceRef: null; occurrenceHash: null;
      namespaceServiceHeadRef: null; namespaceServiceHeadHash: null;
      ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null;
      finalEnvelopeKind: null; finalEnvelopeRef: null; finalEnvelopeHash: null;
      eRestartPhaseTerminalCoreRef: null; eRestartPhaseTerminalCoreHash: null;
      coordinatorReservationCloseRef: null; coordinatorReservationCloseHash: null;
    }>
  | Readonly<{
      state: "target-authorization-pending-persisted";
      preparedActivePendingRef: CanonicalRef; preparedActivePendingHash: string;
      currentActivePendingRef: typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1; currentActivePendingHash: string;
      authorizationOperationRef: null; authorizationOperationHash: null;
      authorizationRef: null; authorizationHash: null;
      operationRef: null; operationHash: null;
      terminalCoreRef: null; terminalCoreHash: null;
      targetSetCloseRef: null; targetSetCloseHash: null;
      occurrenceRef: null; occurrenceHash: null;
      namespaceServiceHeadRef: null; namespaceServiceHeadHash: null;
      ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null;
      finalEnvelopeKind: null; finalEnvelopeRef: null; finalEnvelopeHash: null;
      eRestartPhaseTerminalCoreRef: null; eRestartPhaseTerminalCoreHash: null;
      coordinatorReservationCloseRef: null; coordinatorReservationCloseHash: null;
    }>
  | Readonly<{
      state: "authorization-operation-persisted";
      preparedActivePendingRef: CanonicalRef; preparedActivePendingHash: string;
      currentActivePendingRef: null; currentActivePendingHash: null;
      authorizationOperationRef: CanonicalRef; authorizationOperationHash: string;
      authorizationRef: CanonicalRef; authorizationHash: string;
      operationRef: null; operationHash: null;
      terminalCoreRef: null; terminalCoreHash: null;
      targetSetCloseRef: null; targetSetCloseHash: null;
      occurrenceRef: null; occurrenceHash: null;
      namespaceServiceHeadRef: null; namespaceServiceHeadHash: null;
      ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null;
      finalEnvelopeKind: null; finalEnvelopeRef: null; finalEnvelopeHash: null;
      eRestartPhaseTerminalCoreRef: null; eRestartPhaseTerminalCoreHash: null;
      coordinatorReservationCloseRef: null; coordinatorReservationCloseHash: null;
    }>
  | Readonly<{
      state: "authorization-persisted";
      preparedActivePendingRef: CanonicalRef; preparedActivePendingHash: string;
      currentActivePendingRef: null; currentActivePendingHash: null;
      authorizationOperationRef: CanonicalRef; authorizationOperationHash: string;
      authorizationRef: CanonicalRef; authorizationHash: string;
      operationRef: null; operationHash: null;
      terminalCoreRef: null; terminalCoreHash: null;
      targetSetCloseRef: null; targetSetCloseHash: null;
      occurrenceRef: null; occurrenceHash: null;
      namespaceServiceHeadRef: null; namespaceServiceHeadHash: null;
      ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null;
      finalEnvelopeKind: null; finalEnvelopeRef: null; finalEnvelopeHash: null;
      eRestartPhaseTerminalCoreRef: null; eRestartPhaseTerminalCoreHash: null;
      coordinatorReservationCloseRef: null; coordinatorReservationCloseHash: null;
    }>
  | Readonly<{
      state: "operation-persisted";
      preparedActivePendingRef: CanonicalRef; preparedActivePendingHash: string;
      currentActivePendingRef: null; currentActivePendingHash: null;
      authorizationOperationRef: CanonicalRef; authorizationOperationHash: string;
      authorizationRef: CanonicalRef; authorizationHash: string;
      operationRef: CanonicalRef; operationHash: string;
      terminalCoreRef: null; terminalCoreHash: null;
      targetSetCloseRef: null; targetSetCloseHash: null;
      occurrenceRef: null; occurrenceHash: null;
      namespaceServiceHeadRef: null; namespaceServiceHeadHash: null;
      ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null;
      finalEnvelopeKind: null; finalEnvelopeRef: null; finalEnvelopeHash: null;
      eRestartPhaseTerminalCoreRef: null; eRestartPhaseTerminalCoreHash: null;
      coordinatorReservationCloseRef: null; coordinatorReservationCloseHash: null;
    }>
  | Readonly<{
      state: "d-terminal-persisted";
      preparedActivePendingRef: CanonicalRef; preparedActivePendingHash: string;
      currentActivePendingRef: null; currentActivePendingHash: null;
      authorizationOperationRef: CanonicalRef; authorizationOperationHash: string;
      authorizationRef: CanonicalRef; authorizationHash: string;
      operationRef: CanonicalRef; operationHash: string;
      terminalCoreRef: CanonicalRef; terminalCoreHash: string;
      targetSetCloseRef: CanonicalRef; targetSetCloseHash: string;
      occurrenceRef: CanonicalRef; occurrenceHash: string;
      namespaceServiceHeadRef: CanonicalRef; namespaceServiceHeadHash: string;
      ownerAdmissionFenceReleaseRef: CanonicalRef; ownerAdmissionFenceReleaseHash: string;
      finalEnvelopeKind: "complete" | "failed";
      finalEnvelopeRef: CanonicalRef; finalEnvelopeHash: string;
      eRestartPhaseTerminalCoreRef: null; eRestartPhaseTerminalCoreHash: null;
      coordinatorReservationCloseRef: null; coordinatorReservationCloseHash: null;
    }>
  | Readonly<{
      state: "e-terminal-core-persisted";
      preparedActivePendingRef: CanonicalRef; preparedActivePendingHash: string;
      currentActivePendingRef: null; currentActivePendingHash: null;
      authorizationOperationRef: CanonicalRef; authorizationOperationHash: string;
      authorizationRef: CanonicalRef; authorizationHash: string;
      operationRef: CanonicalRef; operationHash: string;
      terminalCoreRef: CanonicalRef; terminalCoreHash: string;
      targetSetCloseRef: CanonicalRef; targetSetCloseHash: string;
      occurrenceRef: CanonicalRef; occurrenceHash: string;
      namespaceServiceHeadRef: CanonicalRef; namespaceServiceHeadHash: string;
      ownerAdmissionFenceReleaseRef: CanonicalRef; ownerAdmissionFenceReleaseHash: string;
      finalEnvelopeKind: "complete" | "failed";
      finalEnvelopeRef: CanonicalRef; finalEnvelopeHash: string;
      eRestartPhaseTerminalCoreRef: CanonicalRef; eRestartPhaseTerminalCoreHash: string;
      coordinatorReservationCloseRef: null; coordinatorReservationCloseHash: null;
    }>
  | Readonly<{
      state: "coordinator-reservation-close-persisted";
      preparedActivePendingRef: CanonicalRef; preparedActivePendingHash: string;
      currentActivePendingRef: null; currentActivePendingHash: null;
      authorizationOperationRef: CanonicalRef; authorizationOperationHash: string;
      authorizationRef: CanonicalRef; authorizationHash: string;
      operationRef: CanonicalRef; operationHash: string;
      terminalCoreRef: CanonicalRef; terminalCoreHash: string;
      targetSetCloseRef: CanonicalRef; targetSetCloseHash: string;
      occurrenceRef: CanonicalRef; occurrenceHash: string;
      namespaceServiceHeadRef: CanonicalRef; namespaceServiceHeadHash: string;
      ownerAdmissionFenceReleaseRef: CanonicalRef; ownerAdmissionFenceReleaseHash: string;
      finalEnvelopeKind: "complete" | "failed";
      finalEnvelopeRef: CanonicalRef; finalEnvelopeHash: string;
      eRestartPhaseTerminalCoreRef: CanonicalRef; eRestartPhaseTerminalCoreHash: string;
      coordinatorReservationCloseRef: CanonicalRef; coordinatorReservationCloseHash: string;
    }>;

export type ColdRehearsalPendingRestartV1 = Readonly<{
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  beforeGenerationHash: string;
  terminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
  coordinationRef: CanonicalRef;
  coordinationHash: string;
  coordinationIdHash: string;
  coordinatorReservationRef: CanonicalRef;
  coordinatorReservationHash: string;
  expectedOperationIdHash: string;
}> & InternalProductionRestartPendingProgressV1;

export interface ColdRehearsalStateV1 {
  schema: "setfarm.internal-production-cold-rehearsal-state.v1";
  campaignHash: string;
  setfarmSha: string;
  missionControlSha: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  epochHash: string;
  attemptOrdinal: 1 | 2 | 3;
  attemptHash: string;
  fleetStatusHash: string;
  phase:
    | "admitted"
    | "zero-owner-before"
    | "backup-created"
    | "restore-created"
    | "restore-verified"
    | "spawner-restarted"
    | "dashboard-restarted"
    | "mission-control-restarted"
    | "health-verified"
    | "zero-owner-after"
    | "external-preflight-verified"
    | "complete"
    | "failed";
  previousStateHash: string | null;
  coordinatorFencingToken: number;
  completedPhases: ColdRehearsalCompletedPhaseListV1;
  pendingBackup: Readonly<{
    operationId: string;
    stagingDirectoryIdentityHash: string;
    stagedSealedPrefixCount: 0 | 1 | 2 | 3;
    intendedArchiveHash: string | null;
    intendedArchiveListHash: string | null;
    intendedChecksumFileHash: string | null;
    publishedPrefixCount: 0 | 1 | 2 | 3;
    intentHash: string;
  }> | null;
  pendingRestart: ColdRehearsalPendingRestartV1 | null;
  pendingTargetCreate: Readonly<{
    targetDatabaseNameHash: string;
    expectedTargetDatabaseIdentityHash: string;
    premappedTemplateIdentityHash: string;
    intentHash: string;
  }> | null;
  failureReceipt: Readonly<{
    receiptRef: CanonicalRef;
    receiptHash: string;
    restartPhaseFailure: InternalProductionERestartPhaseFailureReceiptPairV1 | null;
  }> | null;
  targetNameHash: string;
  failureCode: ColdRehearsalFailureCodeV1 | null;
  stateHash: string;
}
```

`completedPhases` has one entry per completed phase in the enum order, is capped at exactly eleven by `ColdRehearsalCompletedPhaseListV1`, and each entry binds the exact canonical ref/hash of a strict bounded content-addressed phase receipt. The completed-phase store writes at `phase-receipts/sha256/${receiptHash}.json` with the same private mode/no-follow/fsync rules, recomputes the receipt hash, validates exact phase-to-evidence discrimination (`restore-created` and `restore-verified` are distinct), the predecessor chain, and campaign/epoch/attempt equality. It contains no raw output, credential, path, PID, port, command, database URL, or D census row. D zero-owner bytes remain in their private envelope and the generic receipt carries only that envelope hash. On every resume and terminal assembly, reopen/reparse/recompute the complete ordered chain and reconstruct the terminal backup, restore/audits, restart, health/runtime-source/host, zero-owner and external-preflight members solely from those authenticated receipts. For the external phase, resolve the exact current pair previously sealed by E's `record-readiness-v2` command, persist the entire `ExternalDistributionPreflightBindingV1`, then fresh-resolve its ref/hash and require byte equality of the readiness hash, five ordered observations, five current-closure blockers, details, reason codes, evidence refs, observation hashes, and false/blocked literals before advancing. The cold coordinator never expects the public readiness-v2 CLI output to have E's schema and never writes the census. The external-preflight phase captures `completedAt` once; the terminal receipt must reuse that exact timestamp and exact binding. Terminal-receipt and complete-phase publication are content-addressed and may be one authenticated filesystem member ahead of state CAS, using the same exact-adopt rule as backup, so recovery recomputes the same hashes and never chooses a new time. Tests accept lengths `0..11` only and reject a twelfth phase before receipt/state publication. A missing/corrupt/wrong-phase/cross-attempt/cross-epoch receipt, incomplete/reordered census, arbitrary ref/reason, changed blocker projection, or hash-only shortcut blocks before another side effect; hashes alone are never treated as reconstructable evidence.

One invocation first acquires the fixed campaign-, exact-epoch-, and exact-attempt-scoped coordinator lease by an exclusive no-follow durable `ColdRehearsalCoordinatorLeaseRecordV1`. The store derives and authenticates the actual owner PID/process identity internally, freezes `acquiredAt`, sets `expiresAt` to exactly 30,000 milliseconds later, and publishes/reopens the record with lease ID, owner identity, fencing token, acquired state hash and predecessor. The WeakMap-authenticated public capability repeats owner identity, times, token and record pair; clones, serialized values, caller PID/time/expiry, cross-attempt capabilities and another store instance fail. Every intent write, subprocess/target boundary, fixed-file publication, D restart call and state settlement requires that exact still-current record/capability plus the exact prior state and fencing token. `renewCoordinatorLease` is an expected-record-hash CAS by the same live owner only; it advances the record and bounded expiry without changing token or intent. A concurrent invocation returns `COLD_REHEARSAL_COORDINATOR_BUSY` while the authenticated owner is live, before expiry, or ambiguous. Reclaim is allowed only after both `now >= expiresAt` under the code-owned monotonic/wall-clock projection and a fresh OS observation proves the exact recorded owner PID/process identity absent; it persists that absence hash, requires fixed pointer and state unchanged, advances the fencing token by exactly one through CAS, keeps every pending intent, and publishes a new owner record. Expiry alone, owner absence before expiry, PID reuse, unverifiable identity, stale predecessor/token, renewal race, changed state, or a live old owner refuses reclaim. The old capability can never write after the reclaim CAS, and the new owner resumes rather than repeats any settled backup/restore/D restart mutation.

For a brand-new `(campaignHash, epochHash, attemptHash)` only, `expectedStateHash:null` is valid when that exact attempt pointer is absent, and the first compare-and-swap uses `previousStateHash:null` to publish the admitted state. The append-only epoch attempt index must already authenticate the attempt's ordinal and exact prior-failure/remediation lineage; an absent/mismatched index blocks even when the pointer is absent. Null is rejected if that attempt pointer already exists; a non-null expectation is rejected if the pointer is absent or unequal. Every later transition requires the exact non-null predecessor hash.

Before backup subprocesses or fixed publication, persist/fsync `pendingBackup` with one exclusive mode-`0700` staging-directory identity and deterministic operation ID. Build archive, list, and checksum in that order. Each component first writes to an intent-owned exclusive `.partial` leaf; only a successful bounded subprocess/write, descriptor rehash, fsync, and atomic no-replace rename produces the canonical sealed staging leaf. The same state CAS then records its hash and increments `stagedSealedPrefixCount`. On resume, authenticate the contiguous sealed prefix and its hashes. Because filesystem publication and state CAS cannot be one transaction, exactly one next intent-owned sealed leaf may exist ahead of the recorded count: reopen it by descriptor, require the expected name/inode/mode/hash and the successful-wrapper seal identity, then CAS-adopt it without rerunning the subprocess/rename. The same rule permits exactly one next public hardlink ahead of `publishedPrefixCount`: require its expected name, inode equality to the sealed source, mode and hash, then CAS-adopt it without relinking. More than one ahead, a gap, a corrupt/foreign member, or the wrong suffix fails closed. An intent-owned unsealed `.partial` suffix may be removed and recomputed; never rerun a sealed component. Once all three staging bytes are sealed and journaled, publish the fixed hard links only in archive/list/checksum order, advancing `publishedPrefixCount` after each link under the same lease/CAS. On resume, reopen every sealed and already-published member with `O_NOFOLLOW`, require exact inode/content/mode/hash equality to the intent, finish only the missing suffix, and atomically publish the completed `backup-created` phase while clearing `pendingBackup`. A crash after any component or before the final state CAS never repeats a sealed/publication side effect and never produces a collision-only dead end.

Before each restart, the coordinator calls `restartPort.observe({lease})`, authenticates the exact three code-owned labels and current live semantic generations, then asks `ColdRehearsalRestartAdmissionV1` to resolve D's current namespace-`cold-rehearsal`/service head and exact predecessor. An absent D head returns null only for the authority's first-ever occurrence. An existing head requires E's reviewed same-epoch infrastructure remediation or authenticated successor-epoch source repair, after which the admission adapter freshly resolves D's immutable authorization-operation/authorization/consumption/operation/terminal-core/target-set-close/occurrence/head/fence-release/final-envelope chain and returns that exact predecessor without copying or advancing the head. E derives exactly one coordinator owner key per service with `cold-campaign-epoch-attempt-service-v1` from campaign, full epoch, attempt, and service, opens the matching reservation, and canonicalizes a `prepare-input-persisted` member containing that unchanged pair plus before-generation/build identity, predecessor, coordination identity, and expected operation ID. Only that member calls D `prepareRecoveryRestartTargetAuthorizationV1(...)`; D returns the immutable distinct-content-addressed `{preparedActivePendingRef,preparedActivePendingHash}` snapshot and the mutable fixed-locator `{currentActivePendingRef,currentActivePendingHash}` pair, whose ref is exactly `RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1`. E persists/reopens all four fields as `target-authorization-pending-persisted`; the current fields are explicitly the initial observation snapshot only, while the prepared pair never changes. Before consume, a fresh process calls D zero-input status, requires non-absent phase `pending-input | operation-published | authorized`, resolves only the status-returned current pair, and binds that authority to the frozen prepared snapshot/namespace/service/coordination. It never resolves or compares the stored old current hash. It calls zero-input `resumeActiveRecoveryRestartTargetAuthorizationV1()` from any active phase, including authorized response loss. Resume returns only the distinct immutable content-addressed authorization-operation pair and its authorization pair. E immediately calls status again, requires exact phase `authorized`, resolves only that freshly observed current pair, and requires it to bind the same identity tuple plus returned quartet. It then reopens and validates both immutable returned pairs and atomically persists/reopens them as `authorization-operation-persisted`, with all current fields null. `authorization-persisted` subsequently fresh-resolves and validates the already stored authorization pair; it never performs the first authorization-pair write. Response loss before that atomic transition repeats status and zero-input resume and adopts the same immutable quartet; response loss after it reopens only the immutable prepared snapshot, operation, authorization, and later terminal chain. E calls D service-restart `prepare({authorizationOperationRef,authorizationOperationHash,authorizationRef,authorizationHash})` with no observer/census/guard body. D's operation binds `preparedActivePendingHash` only; D consumes the authorization once, publishes/adopts its operation/outbox, and E CAS-advances to `operation-persisted`. E owns no D/A fence, authorization, target reservation, or operation store and passes no occurrence ordinal.

The shared D helper protocol is the only code that may launch the fixed no-shell child, claim the outbox, capture the exact child PID/output/exit, terminate/reap it, and publish helper/child/PID/marker/settlement/completion/failure receipts. D's zero-input resume return is the strict exact four-field object `{authorizationOperationRef,authorizationOperationHash,authorizationRef,authorizationHash}` with no fifth field; its separate non-absent status returns the prepared/current pair and exact active phase. In every cold/source/docs path, pre-resume status is the sole current truth and resume is idempotent from `pending-input | operation-published | authorized`. Post-resume status must be exact `authorized`; E resolves only its current pair and requires that authority to bind the returned quartet and persisted immutable identity. It never reopens the target state's initial current hash or publishes a same-literal current successor. E reopens/validates both immutable returned pairs and atomically persists them in the locator-clearing authorization-operation state. `authorization-persisted` only fresh-resolves/validates the stored authorization pair. The E wrapper is called exactly as `executeOrRecover({lease,operationRef,operationHash,authorizationRef,authorizationHash})`; after authenticating the E lease and stored pending phase, it calls D directly as `executeOrRecover({operationRef,operationHash,authorizationRef,authorizationHash})`. An operation-only call, omitted/crossed authorization, wrapper without lease, execution before both persisted pairs, or direct D `prepare` without `authorizationOperationRef/authorizationOperationHash` plus the authorization pair is forbidden. The already merged D spawner/dashboard/MC startup hooks claim the generic fixed private outbox before their first owner/listener boundary for every approved namespace, including `cold-rehearsal`; Task 4 adds no startup command or Mission Control adapter. No E source contains `launchctl`, helper spawning, a LaunchAgent plist/environment mutation, process/directory scan, or a structural copy of a D restart receipt.

D's already merged generic startup authority, not E, owns fixed-outbox claims and process-generation markers. E only observes the resulting semantic service generation and resolves the D operation/completion pair through the exported authority; it never reads or writes the startup marker, dispatch, PID, helper, child, or outbox representation.

A reopened `prepare-input-persisted` member may only call D prepare; it must persist/reopen D's frozen prepared pair and initial current observation snapshot as `target-authorization-pending-persisted`. Only that state may call zero-input status/resume. Every target-state recovery ignores the stored old current hash, resolves only the current pair returned by fresh status, verifies active phase plus immutable identity, resumes idempotently, then requires exact authorized status and returned-quartet binding. It reopens/validates both returned immutable pairs and atomically writes them while clearing current fields. `authorization-operation-persisted` carries all three immutable prepared/operation/authorization pairs but has both current fields null; `authorization-persisted` only fresh-resolves and validates its already stored authorization pair, after which it may prepare the restart with both operation and authorization pairs; neither state may execute. Only a reopened `operation-persisted` member may call the thin cold coordinator, which invokes D's `executeOrRecover` with the exact stored operation and authorization pairs. An `in_progress` D result preserves/reopens only immutable pending authority and starts no later phase while A's fence remains held; it does not resolve D status or serialize a locator after operation persistence. D publishes `InternalProductionServiceRestartTerminalCoreV1`, closes all seven targets in `InternalProductionRecoveryRestartTargetSetCloseV1`, publishes occurrence/head, obtains release bound to core+close+occurrence/head, and only then publishes its final completion/failure envelope. E records that chain as `d-terminal-persisted` while its coordinator reservation remains byte-identical/open. It then publishes the close-free `InternalProductionERestartPhaseTerminalCoreV1`, whose hash omits its own derived ref/hash, binds the immutable D final envelope, the frozen prepared snapshot, and all preceding immutable pairs, and excludes both current fields, coordinator-reservation close, completed E phase/receipt, occurrence of that E phase, and every later head; this advances only to `e-terminal-core-persisted`. A fresh process resolves that E core and D release, asks A to close the exact E reservation against that core, and persists only the close pair as `coordinator-reservation-close-persisted`. Only a reopened member of that state may publish the completed E phase/receipt and atomically clear pending. Thus the acyclic order is `D final envelope -> E terminal core -> A coordinator reservation close -> completed E phase/receipt`. `failed` follows the same ordering and ends the attempt. Crashes before operation persistence cover each D active phase, missing/foreign/terminal status, quartet mismatch, and authorized response loss; crashes after it reopen only immutable prepared/operation/authorization/final authority. Two sequential service/attempt restarts reuse the locator while old immutable operation pairs resolve forever and old current hashes do not. A completed resolver validates the stored prepared snapshot against the immutable authorization operation but never treats the cleared/reused locator or initial hash as historical authority.

`InternalProductionERestartTerminalizedBindingV1` is the sole shared terminal discriminant. Its `terminalKind:"complete"` branch must fresh-call D `resolveCompletion({completionRef,completionHash})`, resolve A's terminal core with `disposition.kind:"complete"`, resolve D's occurrence with `terminalDisposition:"complete"`, require `finalEnvelopeKind:"complete"`, and reobserve the exact service as alive at a valid `afterGenerationHash` that is different from `beforeGenerationHash` and bound by the D completion. Only `InternalProductionECompletedRestartPhaseBindingV1` may enter a cold/source/docs completed phase or any success/final-acceptance receipt. Its `terminalKind:"failed"` branch must instead fresh-call D `resolveFailure({failureRef,failureHash})`, require terminal-core disposition and occurrence disposition both `failed`, require `finalEnvelopeKind:"failed"`, preserve the full D-final-envelope → E-core → A-close chain, set `afterGenerationHash:null`, and publish a separate `InternalProductionERestartPhaseFailureReceiptV1`. That branch clears/seals the failed pending state but can never publish a completed E phase, advance to the next service, produce a cold/source/post-handoff success receipt, ready receipt, final acceptance, or reuse the same authorization. Cross-disposition core/occurrence/envelope/resolver pairs, equal before/after generations, an invalid/dead/unbound after generation, or a failure projected as completion fail closed.

D's fixed namespace/service head is the only rollover authority. The cold admission adapter may authorize another attempt only after freshly resolving that head and E's separate remediation/source-repair policy; D independently enforces exact current predecessor and derives the next ordinal during `prepare`. Same-epoch retry requires a distinct reviewed infrastructure-remediation attempt; source repair requires the authenticated successor epoch. A same operation/attempt, missing review, changed epoch without source authority, null predecessor behind an existing head, non-null predecessor with no head, unsettled/live helper or child, swapped terminal/settlement, stale head, or cross-service predecessor fails before operation publication. E source and tests must not declare an occurrence/head/index schema, path, CAS, append method, root, or caller ordinal.

`failureCode` is null unless `phase:"failed"`; failure states use only finite `COLD_*` mappings from D's terminal codes. A restart-originated cold failure stores only the exact scope-`cold-rehearsal` `InternalProductionERestartPhaseFailureReceiptPairV1` in both the failed state and its content-addressed `ColdRehearsalFailureReceiptV1`, freshly resolving the shared receipt before state publication; a non-restart failure has `restartPhaseFailure:null`. `stateHash` equals `hashCanonicalJson(payloadWithoutStateHash)`.

Define the exact terminal receipt:

```typescript
export interface ColdRehearsalReceiptV1 {
  schema: "setfarm.internal-production-cold-rehearsal-receipt.v1";
  campaignHash: string;
  setfarmSha: string;
  missionControlSha: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  epochHash: string;
  attemptOrdinal: 1 | 2 | 3;
  attemptHash: string;
  fleetStatusHash: string;
  fleetSettlementHash: string;
  allTenCleanupClean: true;
  zeroOwnerBefore: ColdRehearsalZeroOwnerObservationBindingV1;
  backup: Readonly<{
    backupRef: CanonicalRef;
    archiveHash: string;
    archiveListHash: string;
    checksumFileHash: string;
  }>;
  restore: Readonly<{
    targetNameHash: string;
    targetDatabaseIdentityHash: string;
    ownershipMarkerHash: string;
    migrationPlanHash: string;
    migrationVerifyHash: string;
    authorityAuditHashes: readonly string[];
  }>;
  restarts: readonly ColdRehearsalRestartAuthorizationBindingV1[];
  health: Readonly<{
    missionControlHash: string;
    dashboardHash: string;
    openClawHash: string;
    renderSmokeHash: string;
  }>;
  runtimeSource: Readonly<{
    setfarmSha: string;
    missionControlSha: string;
    spawnerServiceIdentityHash: string;
    dashboardServiceIdentityHash: string;
    missionControlServiceIdentityHash: string;
    observationHash: string;
  }>;
  hostConfirmation: Readonly<{
    processHash: string;
    portHash: string;
    worktreeHash: string;
  }>;
  zeroOwnerAfter: ColdRehearsalZeroOwnerObservationBindingV1;
  externalPreflight: ExternalDistributionPreflightBindingV1;
  completedAt: string;
  receiptHash: string;
}
```

Test exact phase order: load accepted B fleet status and require its `finalReleaseEpoch` to equal a fresh B `createGoldenFinalReleaseEpochV1` for the clean source pair; resolve its ten `currentEpochResultHashes`; resolve every additional historical result hash; and require B's `isGoldenRunCleanupExactlySettledV1(result) === true` for all of them. Then call A's exact zero-input unaliased `observeCompleteInternalProductionZeroOwnerCensusV1()`, require all 36 census keys zero plus current registry/map/`A+B+C+D+E` activation/reservation/owner identity hashes, and persist that exact read-only observation only through `putZeroOwnerObservation({phase:"zero-owner-before",observation})`; backup; archive inspection; isolated restore; restored-target migration plan/verify/four authority audits. For each spawner/dashboard/MC restart, persist/reopen the E service reservation, pending input, immutable prepared pair, and initial current observation snapshot. Each recovery obtains fresh zero-input D status, resolves only its currently returned pair, validates active phase and immutable identity, resumes idempotently, requires a fresh exact-authorized status whose current authority binds the returned operation/authorization quartet, resolves both immutable pairs, and atomically persists them together in `authorization-operation-persisted` while clearing all current fields. It never resolves the initial current snapshot or publishes a same-literal E locator successor. Then fresh-resolve/revalidate the stored authorization pair, verify reciprocal prepared snapshot/namespace/service/coordination identities, and prepare/reopen/execute the exact D restart with both operation and authorization pairs. Then perform HTTP/render; call A's code-owned `observeInternalProductionRuntimeSourceV1()` and require the three loaded identities equal the clean source pair; normalized host confirmation; call A's zero-input census observer again and persist the exact all-zero result under `zero-owner-after`; observe/persist/resolve external preflight; terminal receipt. The phase store has exactly five envelopes: two A observation wrappers and three strict restart-chain wrappers. Initial/final wrappers store A's exact observation and accept no observer/ref/hash body override. Each completed restart requires `D final envelope -> close-free E terminal core -> A coordinator reservation close -> completed E phase/receipt`; an unsuccessful restart follows the same chain into the scope-`cold-rehearsal` failure receipt/status nested in its failed cold state and ends the attempt. The E core hash omits its own derived ref/hash and excludes close/completed-phase/receipt/later-head fields. No public cold receipt contains A census rows, D helper/child/PID/marker bodies, service paths, or raw PIDs. Any nonzero census, stale activation, failed authorization, dead marker, target drift, or leak records a bounded failure and performs no later phase.

Normative phase-evidence rule: initial and final checkpoints invoke A's exact zero-input census observer directly and store only the exact frozen observation inside their phase-versioned E wrappers. Restart checkpoints never call that observer and never accept census bytes; they store only D's `RecoveryRestartTargetAuthorizationV1` pair after zero-input resume. `evidenceRef`/`evidenceHash` always addresses the E wrapper, never substitutes for the A observation hash or D authorization identity. E has no observer parameter, fake production dependency, D guard schema/store/resolver, or reduced census projection.

- [ ] **Step 2: Implement fixed private stores and exact backup safety**

The private E state root is fixed child `cold-rehearsal` of B `resolveInternalProductionDataRootV1()`; immutable state transitions live at `states/sha256/${stateHash}.json`, strict phase receipts at `phase-receipts/sha256/${receiptHash}.json`, D phase evidence at `phase-evidence/sha256/${evidenceHash}.json`, terminal receipts at `receipts/sha256/${receiptHash}.json`, and database-child operations/claims/live-reaper receipts/spawn-decision receipts/registration sinks/registrations/PID receipts/exits/settlements at their respective `database-child/{operations,claims,reapers,spawn-decisions,registration-sinks,registrations,pids,exits,settlements}/sha256/${hash}.json` content addresses. The sole reaper CAS key is `database-child/by-reaper-claim-key/${reaperClaimKeyHash}.json`, the sole decision key is `database-child/by-operation-spawn-decision/${operationIdHash}.json`, and each deterministic operation key is `database-child/by-operation-id/${operationIdHash}.json`. The attempt pointer is `campaigns/${campaignHash}/epochs/${epochHash}/attempts/${attemptHash}/status-ref.json`, the append-only epoch attempt index is `campaigns/${campaignHash}/epochs/${epochHash}/attempt-index.json`, the passing-current-epoch pointer is `campaigns/${campaignHash}/accepted-ref.json`, and the exclusive coordinator record is `campaigns/${campaignHash}/epochs/${epochHash}/attempts/${attemptHash}/coordinator-lease.json`. The fixed per-scope/service failure status CAS keys are `failure-status/cold-rehearsal/${campaignHash}/${epochHash}/${attemptHash}/${service}.json`, `source-release-service-rebind/failure-status/${finalReleaseEpoch.epochHash}/${service}.json`, and `final-closure/post-handoff/failure-status/${intentHash}/${service}.json`; each accepts only its discriminated scope and exact service, expected predecessor status hash, exact reopened failure receipt, and matching failed D final-envelope -> E core -> A close chain. The receipt store writes only `restart-phase-failures/sha256/${failureReceiptHash}.json` and the resolver accepts only an exact scope/ref/hash; neither store/resolver scans or falls back. D's shared authority owns every restart operation/outbox/helper/child/PID/marker/settlement/completion/failure location; E stores only their canonical pairs. All E directories are real mode-`0700`; files are canonical mode-`0600`, created exclusively, reopened with `O_NOFOLLOW`, required to be regular with link count one, hash-verified, fsynced, and atomically published without replacement. Only D owns and advances the restart occurrence/head/index; the E state pointer records the last completed cold phase and exact D operation/terminal/occurrence/head pairs so the same invocation resumes rather than repeats a mutation. E database recovery opens only fixed operation-derived addresses and may issue a bounded OS process-group membership query for the one authenticated PGID/identity; it never scans directories, commands, or unrelated processes.

`attemptHash = hashCanonicalJson({campaignHash,epochHash,attemptOrdinal,priorFailureReceiptHash,remediationReceiptHash})`; attempt one uses both prior/remediation hashes null. On a finite failure, the coordinator constructs the strict `ColdRehearsalFailureReceiptV1` from code-owned observations, derives `failureClass` and `systemicRootHash` without caller input, and binds `failureObservedFromStateHash` to the exact last state before failure. It stores the receipt content-addressed at `failure-receipts/sha256/${failureReceiptHash}.json`, then publishes the failed state whose `previousStateHash` equals that same pre-failure hash and whose failure ref/hash points to the receipt. The receipt never hashes the failed state, removing any hash cycle; parser tests recompute both directions. A failed attempt remains immutable. A new same-epoch attempt is allowed only when a strict content-addressed `ColdRehearsalIncidentRemediationReceiptV1` from the code-owned observer reopens and binds the immediately prior failure receipt/attempt, finite infrastructure/provider/host class and root hash, independent review with zero Critical/High/Medium, remediation evidence, and unchanged clean source epoch. Platform/product failures require the normal source/product repair epoch flow and cannot use this receipt. The observer accepts no caller root/disposition and the new-attempt allocator consumes the receipt once by compare-and-swap. The exact same root at occurrence three blocks; ordinals are capped at three. A source repair instead derives a fresh B `GoldenFinalReleaseEpochV1` and starts ordinal one in a distinct namespace. Only a passing attempt can advance `accepted-ref`; no prior attempt/epoch satisfies current acceptance, while all failed history remains mandatory review/cleanup evidence.

The only backup targets are:

```text
/Users/setrox/ai/setrox/data/backups/internal-production-cold-rehearsal/EPOCH_HASH/ATTEMPT_HASH/setfarm.dump
/Users/setrox/ai/setrox/data/backups/internal-production-cold-rehearsal/EPOCH_HASH/ATTEMPT_HASH/setfarm.list.txt
/Users/setrox/ai/setrox/data/backups/internal-production-cold-rehearsal/EPOCH_HASH/ATTEMPT_HASH/setfarm.sha256
```

First validate `/Users/setrox/ai/setrox/data/backups` as the fixed real non-symlink trusted parent: reopen every component without following links and require the expected ownership/mode. `lstat` the `internal-production-cold-rehearsal` leaf before mutation. If absent, create exactly that leaf once with mode `0700`; if present, require a real non-symlink directory already owned by the current user and mode `0700`. Reopen the parent and leaf by descriptor, require containment and stable device/inode identities, and only then create the exact lowercase SHA-256 `epochHash` and `attemptHash` children with the same absent-or-real-mode-`0700` rule. A symlink, ownership/mode drift, replaced parent, or unexpected leaf type fails before `mkdir`, `chmod`, dump, or publication.

Create the intent-owned staging directory as one exclusive real contained mode-`0700` child and each sealed output as a mode-`0600`, link-count-one file on the same filesystem. Publish by atomic no-replace `linkat`/hard-link operations to the absent fixed targets in the recorded prefix order; never use overwriting rename. Reopen staging and archive/list/checksum with `O_NOFOLLOW`; require regular mode-`0600`, expected inode/link-count transition and recompute every hash. On retry, the pending intent authenticates and completes its exact sealed/published prefixes; a completed backup phase permits read-only same-byte reuse; a target not owned by either authority fails `COLD_BACKUP_COLLISION`. After the completed phase is durable, unlink each authenticated sealed staging member, require each public target now has link count one and unchanged bytes, then remove the empty staging directory. Invoke `pg_dump` with only `--format=custom --no-owner --no-privileges --file INTENT_OWNED_PARTIAL_ARCHIVE`, and pinned `pg_restore --list --file INTENT_OWNED_PARTIAL_LIST SEALED_STAGED_ARCHIVE`, through separately prepared and reaper-settled `ColdDatabaseChildProcessPort` operations. After sealing archive/list, create the checksum partial by descriptor with the exact ASCII bytes `${archiveHash}  setfarm.dump\n`, fsync/reopen/hash it, and seal it by the same no-replace rule; no shell or path-derived basename is used. Live connection components exist only in the normalized child environment and are absent from argv/receipts. Tests cover absent-leaf first use, hostile symlink leaf/ancestor and replacement races; exact nonempty archive-list validation and checksum bytes; crash before/after operation, claim, reaper launch/CAS/identity+PGID receipt, registration pipe/sink creation, helper/child spawn, registration frame/sink fsync, PID receipt, child exit/termination/reap, reaper exit, exact group absence, coordinator/successor settlement, each `.partial`, sealed staging component, fixed-link publication, and final phase CAS. Every resume preserves sealed work, relaunches only while the claim has no reaper receipt, otherwise adopts/reconciles its exact group authority, settles the old operation before a reclaimed coordinator can proceed, safely computes only an unsealed suffix, and produces one identical backup without overwrite or duplicate child.

- [ ] **Step 3: Implement resumable isolated restore and service rehearsal**

Derive the target internally as `setfarm_rehearsal_${epochHash.slice(0,10)}_${attemptHash.slice(0,10)}`; accept no target/database/path flag. `ColdRehearsalTargetAuthorityPort` is the sole catalog/marker boundary: it uses fixed code-owned statements inside the isolated administrative connection, accepts only the internally derived target identity, and exposes no raw SQL, URL, root, or arbitrary marker body. Before mutation, call `requireAbsent`, derive the expected target-database identity from the authenticated cluster generation plus campaign/epoch/attempt/target tuple, then persist/fsync all of it in `pendingTargetCreate`. `createOwnedTarget` creates one private intent-bound premarked template database containing the fixed `setfarm_rehearsal_control.identity` row, reopens and authenticates that template, and creates the target from it so the first externally observable target already contains the exact campaign/epoch/attempt/Setfarm/state marker and expected database identity. It returns the same target-database identity hash and marker hash. A crash immediately after target creation calls `reopenIdentity` with both expected hashes; only exact equality can settle the same pending intent. A pre-existing target without the marker or with a different database identity remains foreign and fails without `dropdb`, mutation, or adoption. The restore-created phase receipt and terminal restore projection bind both hashes. Clear `pendingTargetCreate` only in the durable restore-created transition. Restore with `pg_restore --clean --if-exists --no-owner --no-privileges` only into that owned isolated target. The private premarked template is retained content-addressed for the attempt and is never reused by another campaign/epoch/attempt.

Run against the restored target, in order. Target creation occurs only through `ColdRehearsalTargetAuthorityPort`; the generic child port does not accept `createdb` from the coordinator. `pg_restore` receives `--clean --if-exists --no-owner --no-privileges --dbname TARGET_NAME FIXED_ARCHIVE`; only the nonsecret target name is argv, while host/user/password are child-only and `PGDATABASE` equals the same target. Each npm audit is a separately prepared, persisted, reopened, executed/recovered, and settled `ColdDatabaseChildProcessPort` `setfarm-db-script` operation whose only database value is child `SETFARM_PG_URL`. The port replaces rather than inherits the environment, and the coordinator never changes a LaunchAgent plist, parent environment, live service, or receipt. A crash or lease-owner death at any operation/claim/PID/exit/reap boundary must settle that exact child before the next audit or a new coordinator may continue. Neither URL is present in argv, stdout/stderr evidence, persisted phase data, or an error:

```text
npm run db:contract-spine:plan
npm run db:contract-spine:verify
npm run db:contract-spine:audit-current-authority-ledgers
npm run db:contract-spine:audit-artifact-batches
npm run db:contract-spine:audit-artifact-store-authority-ledger
npm run db:contract-spine:audit-platform-release-store-records
```

Immediately before each restart, persist/reopen that service's E cold-rehearsal reservation and strict pending input plus D's immutable prepared pair and initial current observation snapshot. Only while `target-authorization-pending-persisted` is live, call zero-input status and resolve only its current pair; require exact reciprocal prepared snapshot/namespace/service/coordination and active phase `pending-input | operation-published | authorized`. In a fresh process call zero-input `resumeActiveRecoveryRestartTargetAuthorizationV1()` from any active phase. Require a second status at exact `authorized`, resolve only its current pair, and require it to bind the same identity and returned quartet. Never reopen or compare the stored initial current hash. Reopen/validate both returned immutable pairs and atomically persist them under `pre-restart-spawner`, `pre-restart-dashboard`, or `pre-restart-mission-control` while clearing both current fields. `authorization-persisted` only fresh-resolves/validates the stored authorization pair. Every later pending member carries only immutable prepared/operation/authorization/final authority. Ask the thin coordinator to prepare and execute D's exact namespace-`cold-rehearsal` operation for spawner, dashboard, then Mission Control with all four authorization-operation/authorization fields. Publish the close-free E terminal core only after D's final envelope; close the E reservation through A against that core; only then bind the completed phase/receipt. An `in_progress` result preserves only immutable pending authority and performs no later phase; `failed` seals the same ordered chain into the exact cold failure receipt/status and attempt. A new unrelated owner at authorization resume fails under A's shared head before restart publication; a previous authorization cannot be replayed. Then run the fixed HTTP/render/runtime-source/normalized-host observations. Publish `health-verified` atomically. Only after that phase is durable call A's zero-input `observeCompleteInternalProductionZeroOwnerCensusV1()` directly, require the complete current all-zero observation, and persist it under `zero-owner-after`; no D guard or observer parameter exists.

- [ ] **Step 4: Add exact CLI and failure/idempotence tests**

Add:

```json
"acceptance:cold-rehearsal": "node --import tsx src/internal-production/cold-rehearsal-cli.ts"
```

The exact production forms are:

```text
run --campaign evals/suites/internal-production-golden-fleet-v1.json --setfarm-sha 0123456789abcdef0123456789abcdef01234567 --mission-control-sha 89abcdef0123456789abcdef0123456789abcdef --render-result-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --json
```

E exposes no service-startup CLI command, parser branch, package script, or adapter. The already merged D-owned Setfarm spawner/dashboard and serialized Mission Control startup hooks are the sole startup consumers and remain outside every E task/file scope; E only resolves their exported path-free restart authority receipts.

After a non-platform same-epoch failure, the only remediation form is:

```text
allocate-incident-review --campaign evals/suites/internal-production-golden-fleet-v1.json --epoch-hash EPOCH_SHA256 --failed-attempt-hash ATTEMPT_SHA256 --json
record-incident-review --observation-ref setfarm://internal-production/cold-rehearsal/incident-review/inbox/OBSERVATION_ID --json
observe-remediation --campaign evals/suites/internal-production-golden-fleet-v1.json --epoch-hash EPOCH_SHA256 --failed-attempt-hash ATTEMPT_SHA256 --json
```

`allocate-incident-review` creates one unpredictable mode-`0600` no-follow inbox file and returns its private local path plus canonical observation ref; the path is never accepted back as CLI input. The independent reviewer writes the strict bounded observation that binds the resolved failure receipt/root and exact remediation evidence refs/hash. `record-incident-review` accepts only the allocated canonical ref, reopens it under the fixed root, requires zero unresolved Critical/High/Medium, publishes `ColdRehearsalIncidentReviewReceiptV1` content-addressed, indexes it by failed attempt/root, and consumes the inbox leaf. `observe-remediation` resolves that exact review ref/hash plus the failed attempt/index/receipt, derives class/root internally, reobserves unchanged source/remediation authority, stores/indexes one immutable remediation receipt, and prints only its canonical ref/hash. These commands accept no class, root, disposition, PR, command, path, evidence hash, review hash, or next ordinal. The next `run` resolves and consumes that indexed receipt automatically, allocates the exact next ordinal/attempt hash, and cannot reuse it. If cleanup is incomplete, the receipt is not eligible; occurrence three returns a typed block before allocation. Tests reject predictable/caller paths, missing/wrong review, cross-attempt/root evidence, replay, and nonzero review findings before remediation indexing.

Test fixture hashes are shown above. Reject target/database/backup/output/root/service/command flags. Test resume after every phase in a fresh process and reconstruct the byte-identical terminal receipt exclusively from reopened E phase refs/hashes and freshly resolved D operation/terminal pairs; same-input completed idempotence, phase receipt missing/tamper/swap/predecessor drift, prepared/current identity drift, operation snapshot drift, forbidden old-current history assumption, crash immediately after target creation but before state settlement, foreign existing target without drop/mutation/adoption, symlink/hardlink/path swap, absent backup leaf safe creation, incorrect modes, child failure redaction, restart order, all-ten-cleanup failure, and external authority/admission mismatch. Start two concurrent invocations at backup and at each restart boundary: exactly one acquires the E lease and can persist a prepare-input member/call D, while the other returns the typed busy refusal. Exercise fresh pre-resume status at each exact active phase `pending-input`, `operation-published`, and `authorized`; resolve only that currently observed pair, bind it to the immutable identity, and prove resume is idempotent from all three. Post-resume must be exact `authorized`; resolve only its current pair and require the returned quartet. Crash before/after each status/current resolution, resume response, operation/authorization resolution, and atomic locator-clear transition. Also crash before/after pre-prepare input publication, D prepare response, initial observation publication, authorization-pair revalidation, operation-pending CAS, every `in_progress` reconciliation, D terminal return, occurrence write, head/root CAS, exact failure receipt/status CAS, phase receipt, and state CAS. Reject any attempt to reopen/compare/adopt the old current snapshot, any same-literal current-state CAS, missing/foreign/failure/terminal status, unauthorized post-resume status, quartet mismatch, or current resolution after clear. Response-loss recovery repeats D prepare only from the pre-prepare state. From `target-authorization-pending-persisted` only, it reopens the immutable prepared snapshot, obtains current truth exclusively from zero-input D status, resumes, and accepts only exact authorized current authority. From `authorization-operation-persisted` and every later state, it reopens only immutable prepared snapshot/operation/authorization/final authority, never D status or a current resolver, and adopts the same immutable operation/authorization; it never asks for a replacement.

Lease tests use real child owner processes and a deterministic code-owned clock. Require the durable record to bind the actual owner PID/process identity, exact `acquiredAt`, `expiresAt = acquiredAt + 30000ms`, state hash, monotonically increasing fencing token and predecessor record. A live owner remains busy before and after nominal expiry until it renews or is observed absent; expiry without exact absence is insufficient. A dead owner before expiry remains unreclaimable until bounded expiry. After both conditions, exactly one contender publishes the absence proof and wins the expected-record/state CAS with token plus one; every other contender and the old capability fail before mutation. Exercise PID reuse, ambiguous/unreadable identity, wall/monotonic drift, renewal versus reclaim, crash before/after record fsync/publication/pointer CAS, stale token, changed state, and missing pending intent. Reclaim preserves the complete pending backup/target/restart state and resumes its exact suffix.

In `cold-rehearsal-shared-restart-integration-v1.test.ts`, inject D's exact activated authority. Require the resolved A retirement/D activation pair, namespace `cold-rehearsal`, authenticated full epoch/attempt/service/E-reservation/before-generation/build tuple, D's namespace/service head and exact terminal predecessor, and exact call order `observe -> resolve predecessor -> persist/reopen input -> prepare distinct immutable prepared snapshot pair + fixed-locator initial current observation with ref statically typed as RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1 -> persist both -> zero-input status -> resolve only status current authority -> validate active phase+immutable identity -> fresh zero-input resume returns immutable operation+authorization -> zero-input status exact authorized -> resolve only its current authority -> validate returned-quartet binding -> reopen/validate operation+authorization -> atomically persist both with current clear -> fresh-resolve/validate authorization -> prepare/reopen restart with operation+authorization pairs -> executeOrRecover`. The three pre-resume fixtures cover `pending-input`, `operation-published`, and authorized response loss. Reopen every E boundary in a fresh process. Assert the one pre-prepare and seven post-prepare pending variants' exact prepared/current/nullability relations, unchanged/non-null E reservation throughout, and the acyclic terminal order `D final envelope -> close-free E terminal core -> A E-reservation close -> completed E phase/receipt`. Prove the E core contains immutable prepared/operation/authorization/final authority but excludes both current fields, close/completed-phase/receipt/head-of-E-phase fields; two sequential service/attempt operations reuse the locator while both immutable operations resolve forever and old current hashes do not; and response loss at status/resume/atomic-operation-plus-authorization/authorization-revalidation, every D terminal boundary, E core, A close, E failure receipt/status, and E completed phase adopts one exact immutable pair set. Reject any old-current reopen, current equality/predecessor/chain assertion, same-literal current CAS, missing/foreign/terminal pre-resume status, non-authorized post-resume status, quartet mismatch, an observer argument, census/guard body, prepared snapshot mismatch, widened locator ref type, operation bound to mutable current hash, authorization replay, locator-as-operation-history, omitted authorization, direct prepare without authorization operation, restart before authorization validation, early E close, cyclic core, local D schemas/factory, caller ordinal, raw process mutation, cross-namespace receipt, unbound terminal, or D private-path read.

In `cold-rehearsal-restart-admission-v1.test.ts`, feed the adapter D heads for terminal complete, expected-process-dead, dispatch-uncertain, and ambiguity occurrences. An absent head returns null only for the first-ever D occurrence. An existing head returns its exact current terminal predecessor only after the separate E reviewed infrastructure-remediation or successor-epoch source-repair authority resolves; D `prepare` then derives the next ordinal and advances the universal index. Reject a same attempt, missing/replayed review, changed epoch without source repair, live/unsettled helper/child, wrong occurrence/operation/terminal/settlement pair, stale/cross-namespace/cross-service head, or caller ordinal. AST/filesystem tests forbid E occurrence/head/index types, append/CAS/root paths and direct D-store reads; retained D history is verified only through its exported resolvers.

In `cold-rehearsal-database-child-operation-v1.test.ts` and `cold-rehearsal-database-child-reaper-v1.test.ts`, exercise all nine fixed child invocations. Crash before/after operation publication, coordinator claim publication, reaper launch and live-identity return, reaper CAS claim, reaper PID/process/PGID receipt, registration pipe and preopened sink durability, each spawn-decision union temp write/fsync/no-replace publication/parent fsync/reopen, the OS spawn call, helper spawn, child spawn, registration-frame emission/sink fsync, child PID receipt, output capture, terminate/reap, reaper exit/reap, coordinator/successor exit publication, exact process-group absence, settlement publication, and caller response. Kill the coordinator, reaper, or helper at every boundary, acquire a new fenced lease where applicable, and prove recovery resolves and settles only the old operation/reaper/group before any next child is prepared. A durable claim with no reaper receipt may retry the same launcher; concurrent reapers yield one CAS winner and every loser exits before spawn. Once a reaper receipt exists, no retry may spawn. Reaper refusal/exit before spawn yields or recovery-seals exact `spawn_not_issued`, and only that member permits `no_child`. Exit after durable `spawn_issued` but before a complete registration frame must terminate/reap the exact group and seal only `unregistered_child_terminated`, even when the OS spawn call did not actually create a visible process. A valid registered child, including the spawn-to-PID crash, seals only `child_settled`. Response loss returns the byte-identical operation or settlement; a live reaper/helper/child yields `in_progress`. Prove `run()` returns only claim-lost/live execution identity and the reaper cannot publish/return exit, settlement, or an absence observation naming itself while live; only the coordinator or a fenced successor after reaper exit may publish both exit and settlement. Reject stale fencing, PID/PGID reuse, mixed/extra group members, mismatched process identity, truncated/forged registration, absent/conflicting decision or group authority, operation/invocation drift, OS spawn without reopened `spawn_issued`, direct coordinator child spawn, two winning reapers, a second child for one operation, replay after either failure terminal, a next audit before settlement, unbounded process/command/directory scans, `no_child` without `spawn_not_issued`, either other terminal without `spawn_issued`, and any settlement outside the exact three-member union.

Task 4 AST boundaries require unaliased static named imports of D's restart authority/activation/operation/head/final-envelope types plus immutable content-addressed `RecoveryRestartTargetAuthorizationPreparedSnapshotV1` and `resolveRecoveryRestartTargetAuthorizationPreparedSnapshotV1`, mutable fixed-locator `RecoveryRestartTargetAuthorizationActivePendingV1`, `RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1`, and `resolveRecoveryRestartTargetAuthorizationActivePendingV1`, `RecoveryRestartTargetAuthorizationOperationV1`, `RecoveryRestartTargetAuthorizationV1`, `RecoveryRestartTargetAuthorizationStatusV1`, `InternalProductionServiceRestartTerminalCoreV1`, `InternalProductionRecoveryRestartTargetSetCloseV1`, their exact remaining resolvers, `prepareRecoveryRestartTargetAuthorizationV1`, `resumeActiveRecoveryRestartTargetAuthorizationV1`, `observeRecoveryRestartTargetAuthorizationStatusV1`, and `resolveRecoveryRestartTargetAuthorizationV1` only from `./internal-production-service-restart-authority-v1.js`. They require the exact `typeof RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1` current-ref annotation in the wrapper and locator-live state. They require A's `InternalProductionCompleteZeroOwnerCensusObservationV1` and zero-input `observeCompleteInternalProductionZeroOwnerCensusV1` unaliased only from `./baseline-post-handoff-receipt-v1.js`. They reject D `InternalProductionServiceRestartGuardV1`, any D global-zero symbol, observer parameter/injection, locator-as-operation history, alias/wrapper/dynamic import, local authorization/fence/operation schema, raw service mutation, D private-path reads, an active-pending alias, a widened `CanonicalRef` locator type, or any prepare return other than the exact `{preparedActivePendingRef,preparedActivePendingHash,currentActivePendingRef,currentActivePendingHash}` pair. Tests require the target state to retain only the initial current observation; every recovery must call zero-input status and resolve only its current pair; all three active phases must resume idempotently; post-resume status must be exact authorized and bind the quartet; both immutable pairs must be resolved before atomic current-clear persistence; and every wrapper/direct D `prepare` call must carry both pairs. They reject reopening/comparing the old current hash, treating it as history or predecessor, any same-literal current-state CAS/adoption, missing/foreign/failure/terminal status, non-authorized post-resume status, quartet mismatch, reordered prepare/initial-observation-persist/status/current-resolve/resume/authorized-status/current-resolve/quartet-check/operation+authorization-resolve/atomic-clear/authorization-revalidation/prepare/execute/D-core/target-close/occurrence/head/release/final-envelope/E-core/A-close/E-completed-or-failed-phase calls, status/current resolution after clear, or either current field in E core. Existing database-child static ownership and crash/race assertions remain unchanged and independently require the fixed E reaper as the sole process producer.

The same Task 4 AST boundary additionally requires unaliased static named imports of `InternalProductionServiceRestartStartupHooksReadyV1`, `resolveInternalProductionServiceRestartStartupHooksReadyV1`, `InternalProductionServiceRestartAuthorityCutoverV1`, and `resolveInternalProductionServiceRestartAuthorityCutoverV1` from `./internal-production-service-restart-authority-v1.js`. Before accepting the existing activation, every cold/source-release/docs cross-flow freshly resolves the cutover and proves its nested readiness, retirement, activation, epoch, source/build, and three hook identities. A direct activation-only, retirement-only, or structural authority is rejected.

- [ ] **Step 5: Run focused verification**

```bash
set -euo pipefail
node --import tsx --test \
  tests/internal-production/cold-rehearsal-v1.test.ts \
  tests/internal-production/cold-rehearsal-store.test.ts \
  tests/internal-production/cold-rehearsal-shared-restart-integration-v1.test.ts \
  tests/internal-production/cold-rehearsal-restart-admission-v1.test.ts \
  tests/internal-production/cold-rehearsal-database-child-operation-v1.test.ts \
  tests/internal-production/cold-rehearsal-database-child-reaper-v1.test.ts \
  tests/internal-production/cold-rehearsal-cli.test.ts
npm run test:internal-production
npx tsc -p tsconfig.json --noEmit
git diff --check
```

Expected: PASS. Authorized handoff subject: `feat(ops): add resumable cold rehearsal`.

---

### Task 5: Implement Pre-Packet Review and the Reference-Only Final Packet

**Files:**
- Create: `src/internal-production/fleet-owner-producer-manifest-activation-v1.ts`
- Test: `tests/internal-production/fleet-owner-producer-manifest-activation-v1.test.ts`
- Create: `src/internal-production/final-closure-packet-v1.ts`
- Create: `src/internal-production/final-closure-packet-cli.ts`
- Create: `src/internal-production/final-closure-post-handoff-v1.ts`
- Create: `src/internal-production/canonical-remote-main-observer-v1.ts`
- Create: `src/internal-production/final-closure-post-handoff-journal-v1.ts`
- Create: `src/internal-production/final-closure-post-handoff-restart-coordinator-v1.ts`
- Create: `src/internal-production/source-release-service-rebind-v1.ts`
- Create: `src/internal-production/recovery-docs-delivery-adapter-v1.ts`
- Test: `tests/internal-production/final-closure-packet-v1.test.ts`
- Test: `tests/internal-production/final-closure-packet-cli.test.ts`
- Test: `tests/internal-production/final-closure-post-handoff-v1.test.ts`
- Test: `tests/internal-production/canonical-remote-main-observer-v1.test.ts`
- Test: `tests/internal-production/final-closure-post-handoff-journal-v1.test.ts`
- Test: `tests/internal-production/final-closure-post-handoff-restart-coordinator-v1.test.ts`
- Test: `tests/internal-production/source-release-service-rebind-v1.test.ts`
- Test: `tests/internal-production/recovery-docs-delivery-adapter-v1.test.ts`
- Test: `tests/internal-production/golden-fleet-source-boundary.test.ts`
- Create: `docs/runbooks/internal-production-operator.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: A's exact current ABCD43 activation receipt/head/store/resolver plus reviewed clean E source/build; the fixed tracked A baseline, historical A receipt, private content-addressed C matrix/D recovery/B fleet authorities and future targets, fleet raw-result/timeout-supersession status, fleet/cold receipts, clean source identities, an independent pre-packet review observation, D's exact discovery-locator/immutable-authorization-operation/TerminalCore/target-set-close/occurrence/head/release/final-envelope chain, and D's exact `RecoveryDocsDeliveryAcceptancePortV1` one-way boundary.
- Produces: the strict content-addressed ABCDE52 activation receipt/resolver/status and exact two CLI verbs before any E work; bounded content-addressed `InternalProductionPrePacketReviewFindingV1`/`InternalProductionPrePacketReviewHistoryV1`, `InternalProductionPrePacketReviewReceiptV1`, `InternalProductionFinalClosureInputV1`, `InternalProductionFinalClosurePacketV1`, exact JSON/Markdown writers, the fixed post-handoff intent/journal head/pending-restart/phase/ready chain with one deterministic coordinator reservation per service and post-release close, `InternalProductionFinalClosurePostHandoffReceiptV1` as the final acceptance authority plus its current/historical/final resolver, and the E-owned post-handoff-to-D integration command.

- [ ] **Step 1: Write failing schema and anti-circularity tests**

Define the exact input schema:

```typescript
export type InternalProductionClosureGenerationDirectoryV1 =
  `epoch-${string}-closure-${string}`;

export type InternalProductionClosureDocumentPathsV1 = readonly [
  `docs/review-packets/internal-production/${InternalProductionClosureGenerationDirectoryV1}/golden-matrix-report.md`,
  `docs/review-packets/internal-production/${InternalProductionClosureGenerationDirectoryV1}/recovery-matrix.md`,
  `docs/review-packets/internal-production/${InternalProductionClosureGenerationDirectoryV1}/recovery-reconciliation.md`,
  `docs/review-packets/internal-production/${InternalProductionClosureGenerationDirectoryV1}/golden-fleet-report.md`,
  `docs/review-packets/internal-production/${InternalProductionClosureGenerationDirectoryV1}/final-closure.json`,
  `docs/review-packets/internal-production/${InternalProductionClosureGenerationDirectoryV1}/final-closure.md`,
];

export function deriveInternalProductionClosureGenerationV1(input: Readonly<{
  epochHash: string;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
}>): Readonly<{
  epochHash: string;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  closureGenerationHash: string;
  closureGenerationDirectory: InternalProductionClosureGenerationDirectoryV1;
  documentPaths: InternalProductionClosureDocumentPathsV1;
}>;

export interface InternalProductionFinalClosureInputV1 {
  schema: "setfarm.internal-production-final-closure-input.v1";
  closureId: "internal-production-closure-2026-08-14";
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  source: Readonly<{ setfarmSha: string; missionControlSha: string }>;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  closureGenerationHash: string;
  closureGenerationDirectory: InternalProductionClosureGenerationDirectoryV1;
  targetPaths: InternalProductionClosureDocumentPathsV1;
  baseline: Readonly<{
    path: "docs/review-packets/2026-08-13-internal-production-baseline.md";
    hash: string;
    postHandoffRef: "setfarm://internal-production/baseline/post-handoff";
    postHandoffHash: string;
    operationalSourceSha: string;
    finalDocumentationSha: string;
    missionControlSourceSha: string;
  }>;
  goldenMatrix: Readonly<{
    campaignHash: string;
    // Exact C matrix receipt identity; never the pointer/finalizer ref.
    statusRef: CanonicalRef;
    statusHash: string;
    epochHash: string;
    reportHash: string;
    privateReportRef: CanonicalRef;
    finalizationHash: string;
    finalizerOutputRef: CanonicalRef;
    finalizerOutputHash: string;
  }>;
  golden: Readonly<{
    campaignHash: string;
    reportHash: string;
    privateReportRef: CanonicalRef;
    epochHash: string;
    finalizationHash: string;
    finalizerOutputRef: CanonicalRef;
    finalizerOutputHash: string;
  }>;
  recovery: Readonly<{
    campaignHash: string;
    epochHash: string;
    operationalAcceptanceRef: CanonicalRef;
    operationalAcceptanceHash: string;
    recoveryMatrixMarkdownHash: string;
    recoveryMatrixMarkdownPrivateRef: CanonicalRef;
    recoveryReconciliationMarkdownHash: string;
    recoveryReconciliationMarkdownPrivateRef: CanonicalRef;
    finalizationRef: CanonicalRef;
    finalizationHash: string;
  }>;
  fleet: Readonly<{
    statusRef: CanonicalRef;
    statusHash: string;
    timeoutReconciliationAuthorities: readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
    settlementHash: string;
    epochHash: string;
  }>;
  coldRehearsal: Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>;
  independentReview: Readonly<{
    receiptRef: CanonicalRef;
    receiptHash: string;
    reviewHistoryRef: CanonicalRef;
    reviewHistoryHash: string;
    verdict: "clear";
  }>;
  externalPreflight: ExternalDistributionPreflightBindingV1;
  inputHash: string;
}
```

Define the review receipt exactly:

```typescript
export interface InternalProductionPrePacketReviewFindingV1 {
  schema: "setfarm.internal-production-pre-packet-review-finding.v1";
  scopeHash: string;
  findingId: string;
  problemText: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  disposition: "open" | "rejected" | "resolved" | "accepted_low" | "informational";
  location: Readonly<{
    artifactRef: CanonicalRef;
    anchor: string;
  }>;
  evidenceRefs: readonly CanonicalRef[];
  findingRef: CanonicalRef;
  findingHash: string;
  resolutionRef: CanonicalRef | null;
  resolutionHash: string | null;
}

export interface InternalProductionPrePacketReviewHistoryV1 {
  schema: "setfarm.internal-production-pre-packet-review-history.v1";
  scopeHash: string;
  reviewOrdinal: number;
  verdict: "open" | "rejected" | "clear";
  predecessor: Readonly<{
    scopeHash: string;
    historyRef: CanonicalRef;
    historyHash: string;
  }> | null;
  carriedFindingHashes: readonly string[];
  orderedFindings: readonly Readonly<{
    findingId: string;
    severity: InternalProductionPrePacketReviewFindingV1["severity"];
    disposition: InternalProductionPrePacketReviewFindingV1["disposition"];
    findingRef: CanonicalRef;
    findingHash: string;
    resolutionRef: CanonicalRef | null;
    resolutionHash: string | null;
  }>[];
  unresolved: Readonly<{ critical: number; high: number; medium: number; low: number; info: number }>;
  historyRef: CanonicalRef;
  historyHash: string;
}

export interface InternalProductionPrePacketReviewReceiptV1 {
  schema: "setfarm.internal-production-pre-packet-review-receipt.v1";
  scopeHash: string;
  reviewedRefs: readonly [
    "docs/review-packets/2026-08-13-internal-production-baseline.md",
    "setfarm://internal-production/baseline/post-handoff",
    string,
    CanonicalRef,
    string,
    CanonicalRef,
    string,
    string,
    CanonicalRef,
    CanonicalRef,
    CanonicalRef
  ];
  reviewedHashes: readonly [string, string, string, string, string, string, string, string, string, string, string];
  source: Readonly<{ setfarmSha: string; missionControlSha: string }>;
  reviewerKind: "independent-agent";
  verdict: "clear";
  unresolved: Readonly<{ critical: 0; high: 0; medium: 0 }>;
  reviewHistoryRef: CanonicalRef;
  reviewHistoryHash: string;
  externalPreflight: ExternalDistributionPreflightBindingV1;
  reviewedAt: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}

export interface InternalProductionPrePacketReviewReceiptResolverV1 {
  resolve(input: Readonly<{
    receiptRef: CanonicalRef;
    receiptHash: string;
  }>): Promise<InternalProductionPrePacketReviewReceiptV1>;
}

export function createInternalProductionPrePacketReviewReceiptResolverV1():
  InternalProductionPrePacketReviewReceiptResolverV1;

export type InternalProductionFinalClosurePacketV1 = Readonly<
  Omit<InternalProductionFinalClosureInputV1, "schema"> & {
    schema: "setfarm.internal-production-final-closure-packet.v1";
    packetHash: string;
  }
>;

export interface InternalProductionFinalClosureFinalizationV1 {
  schema: "setfarm.internal-production-final-closure-finalization.v1";
  inputHash: string;
  postRebindEntryAuthorityRef: CanonicalRef;
  postRebindEntryAuthorityHash: string;
  prePacketReviewReceiptRef: CanonicalRef;
  prePacketReviewReceiptHash: string;
  reviewHistoryRef: CanonicalRef;
  reviewHistoryHash: string;
  operationalSetfarmSha: string;
  missionControlSha: string;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  timeoutReconciliationAuthorities: readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  closureGenerationHash: string;
  closureGenerationDirectory: InternalProductionClosureGenerationDirectoryV1;
  targetPaths: InternalProductionClosureDocumentPathsV1;
  orderedExpectedContentHashes: GoldenDocsMaterializationExpectedContentHashesV1;
  packetHash: string;
  markdownHash: string;
  packetPrivateRef: CanonicalRef;
  markdownPrivateRef: CanonicalRef;
  finalizationHash: string;
}

export function finalizeInternalProductionClosureV1():
  Promise<InternalProductionFinalClosureFinalizationV1>;

export function materializeInternalProductionClosureDocsV1(input: Readonly<{
  finalizationHash: string;
}>):
  Promise<Readonly<{
    finalizationHash: string;
    closureGenerationHash: string;
    targetPaths: InternalProductionClosureDocumentPathsV1;
    receiptRef: CanonicalRef;
    receiptHash: string;
    sessionHash: string;
    orderedMaterializationHashes: readonly [string, string, string, string, string, string];
  }>>;

export interface InternalProductionCanonicalRemoteMainEvidenceV1 {
  schema: "setfarm.internal-production-canonical-remote-main-evidence.v1";
  setfarm: Readonly<{
    ref: "refs/heads/main";
    sha: string;
    observationHash: string;
  }>;
  missionControl: Readonly<{
    ref: "refs/heads/main";
    sha: string;
    observationHash: string;
  }>;
  evidenceHash: string;
}

export interface InternalProductionCanonicalRemoteMainObserverV1 {
  observe(): Promise<InternalProductionCanonicalRemoteMainEvidenceV1>;
}

export function createInternalProductionCanonicalRemoteMainObserverV1():
  InternalProductionCanonicalRemoteMainObserverV1;

export interface InternalProductionFinalClosurePostHandoffIntentV1 {
  schema: "setfarm.internal-production-final-closure-post-handoff-intent.v1";
  epochHash: string;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  closureGenerationHash: string;
  closureGenerationDirectory: InternalProductionClosureGenerationDirectoryV1;
  targetPaths: InternalProductionClosureDocumentPathsV1;
  canonicalRemoteMain: InternalProductionCanonicalRemoteMainEvidenceV1;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  recordedAt: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  operationalSetfarmSha: string;
  documentationSha: string;
  missionControlSha: string;
  closurePacketHash: string;
  finalizationHash: string;
  prePacketReviewReceiptRef: CanonicalRef;
  prePacketReviewReceiptHash: string;
  prePacketReviewHistoryRef: CanonicalRef;
  prePacketReviewHistoryHash: string;
  docsSessionHash: string;
  docsSessionReceiptRef: CanonicalRef;
  docsSessionReceiptHash: string;
  docsLeaseRetirementReceiptRef: CanonicalRef;
  docsLeaseRetirementReceiptHash: string;
  docsLeaseTerminalRetirementSetHash: string;
  documentationPullRequestIdentityHash: string;
  documentationIndependentReviewHistoryRef: CanonicalRef;
  documentationIndependentReviewHistoryHash: string;
  documentationCheckSetHash: string;
  externalPreflight: ExternalDistributionPreflightBindingV1;
  plannedObservationSlots: readonly [
    "semantic-build-equality",
    "restart-spawner",
    "restart-dashboard",
    "restart-mission-control",
    "runtime-source-and-health",
    "authority-audits",
    "final-zero-owner"
  ];
  intentRef: CanonicalRef;
  intentHash: string;
}

export interface InternalProductionFinalClosurePostHandoffCoordinatorLeaseV1 {
  readonly kind: "authenticated-final-closure-post-handoff-coordinator-lease";
  readonly ownerProcessIdentityHash: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly fencingToken: number;
  readonly leaseRecordRef: CanonicalRef;
  readonly leaseRecordHash: string;
  readonly capability: unknown;
}

export interface InternalProductionFinalClosurePostHandoffCoordinatorLeaseRecordV1 {
  schema: "setfarm.internal-production-final-closure-post-handoff-coordinator-lease-record.v1";
  intentRef: CanonicalRef;
  intentHash: string;
  ownerPid: number;
  ownerProcessIdentityHash: string;
  acquiredAt: string;
  expiresAt: string;
  leaseDurationMs: 30000;
  fencingToken: number;
  acquiredJournalHeadHash: string | null;
  predecessorLeaseRecordHash: string | null;
  ownerAbsenceAuthorityHash: string | null;
  leaseRecordRef: CanonicalRef;
  leaseRecordHash: string;
}

export interface InternalProductionFinalClosurePostHandoffCoordinatorLeaseStoreV1 {
  acquire(input: Readonly<{
    intentRef: CanonicalRef;
    intentHash: string;
    expectedJournalHeadHash: string | null;
  }>): Promise<
    | Readonly<{ status: "acquired"; lease: InternalProductionFinalClosurePostHandoffCoordinatorLeaseV1 }>
    | Readonly<{ status: "busy"; refusalCode: "FINAL_CLOSURE_POST_HANDOFF_COORDINATOR_BUSY" }>
  >;
  renew(input: Readonly<{
    lease: InternalProductionFinalClosurePostHandoffCoordinatorLeaseV1;
    expectedLeaseRecordHash: string;
  }>): Promise<InternalProductionFinalClosurePostHandoffCoordinatorLeaseV1>;
  resolve(input: Readonly<{
    leaseRecordRef: CanonicalRef;
    leaseRecordHash: string;
  }>): Promise<InternalProductionFinalClosurePostHandoffCoordinatorLeaseRecordV1>;
  release(lease: InternalProductionFinalClosurePostHandoffCoordinatorLeaseV1): Promise<void>;
}

export type InternalProductionFinalClosurePostHandoffPendingRestartV1 = Readonly<{
  schema: "setfarm.internal-production-final-closure-post-handoff-pending-restart.v1";
  intentRef: CanonicalRef;
  intentHash: string;
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  beforeGenerationHash: string;
  entrypointBuildIdentityHash: string;
  terminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
  coordinationRef: CanonicalRef;
  coordinationHash: string;
  coordinationIdHash: string;
  coordinatorReservationRef: CanonicalRef;
  coordinatorReservationHash: string;
  expectedOperationIdHash: string;
  previousPendingHash: string | null;
  coordinatorFencingToken: number;
  pendingRef: CanonicalRef;
  pendingHash: string;
}> & InternalProductionRestartPendingProgressV1;

export type InternalProductionSourceReleaseServiceRebindPendingV1 = Readonly<{
  schema: "setfarm.internal-production-source-release-service-rebind-pending.v1";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  beforeGenerationHash: string;
  terminalPredecessor: InternalProductionServiceRestartTerminalPredecessorV1 | null;
  coordinationRef: CanonicalRef;
  coordinationHash: string;
  coordinationIdHash: string;
  coordinatorReservationRef: CanonicalRef;
  coordinatorReservationHash: string;
  expectedOperationIdHash: string;
  previousPendingHash: string | null;
  coordinatorFencingToken: number;
  pendingRef: CanonicalRef;
  pendingHash: string;
}> & InternalProductionRestartPendingProgressV1;

export type InternalProductionSourceReleaseServiceRebindCompletedRestartV1 =
  InternalProductionECompletedRestartPhaseBindingV1 & Readonly<{
    namespace: "source-release-barrier";
  }>;

export type InternalProductionSourceReleaseServiceRebindFailedRestartV1 =
  Readonly<{
    namespace: "source-release-barrier";
    service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
    failure: InternalProductionERestartPhaseFailureReceiptPairV1;
  }>;

export type InternalProductionSourceReleaseServiceRebindStatusV1 =
  | Readonly<{
      kind: "running";
      currentService: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
      statusRef: CanonicalRef;
      statusHash: string;
      previousStatusHash: string | null;
    }>
  | Readonly<{
      kind: "failed";
      failedRestart: InternalProductionSourceReleaseServiceRebindFailedRestartV1;
      statusRef: CanonicalRef;
      statusHash: string;
      previousStatusHash: string;
    }>
  | Readonly<{
      kind: "complete";
      statusRef: CanonicalRef;
      statusHash: string;
      previousStatusHash: string;
    }>;

export interface InternalProductionSourceReleaseServiceRebindV1 {
  schema: "setfarm.internal-production-source-release-service-rebind.v1";
  namespace: "source-release-barrier";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  orderedRestarts: readonly [
    InternalProductionSourceReleaseServiceRebindCompletedRestartV1 & Readonly<{ service: "setfarm-spawner" }>,
    InternalProductionSourceReleaseServiceRebindCompletedRestartV1 & Readonly<{ service: "setfarm-dashboard" }>,
    InternalProductionSourceReleaseServiceRebindCompletedRestartV1 & Readonly<{ service: "mission-control" }>,
  ];
  finalZeroOwnerCensusHash: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}

export interface InternalProductionFinalClosurePostHandoffJournalHeadV1 {
  schema: "setfarm.internal-production-final-closure-post-handoff-journal-head.v1";
  intentRef: CanonicalRef;
  intentHash: string;
  orderedPhaseRefs: readonly CanonicalRef[];
  orderedPhaseHashes: readonly string[];
  pendingRestartRef: CanonicalRef | null;
  pendingRestartHash: string | null;
  previousHeadHash: string | null;
  coordinatorFencingToken: number;
  headRef: CanonicalRef;
  headHash: string;
}

type InternalProductionFinalClosurePostHandoffPhaseCommonV1 = Readonly<{
  schema: "setfarm.internal-production-final-closure-post-handoff-phase.v1";
  intentRef: CanonicalRef;
  intentHash: string;
  phaseOrdinal: number;
  previousPhaseHash: string | null;
  coordinatorLeaseRecordRef: CanonicalRef;
  coordinatorLeaseRecordHash: string;
  coordinatorFencingToken: number;
  phaseRef: CanonicalRef;
  phaseHash: string;
}>;

export type InternalProductionFinalClosurePostHandoffPhaseV1 =
  | Readonly<InternalProductionFinalClosurePostHandoffPhaseCommonV1 & {
      phase: "semantic-build-equality";
      semanticBuildEqualityHash: string;
      setfarmBuildEvidenceRef: CanonicalRef;
      missionControlBuildEvidenceRef: CanonicalRef;
    }>
  | Readonly<
      InternalProductionFinalClosurePostHandoffPhaseCommonV1 &
      InternalProductionECompletedRestartPhaseBindingV1 & {
        phase: "restart-service";
        namespace: "documentation-handoff";
      }
    >
  | Readonly<
      InternalProductionFinalClosurePostHandoffPhaseCommonV1 & {
        phase: "restart-service-failed";
        namespace: "documentation-handoff";
        service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
        failure: InternalProductionERestartPhaseFailureReceiptPairV1;
      }
    >
  | Readonly<InternalProductionFinalClosurePostHandoffPhaseCommonV1 & {
      phase: "runtime-source-and-health";
      runtimeSourceObservationHash: string;
      serviceIdentityHashes: Readonly<{
        spawner: string;
        dashboard: string;
        missionControl: string;
      }>;
      orderedHealthObservationHashes: readonly [string, string, string];
    }>
  | Readonly<InternalProductionFinalClosurePostHandoffPhaseCommonV1 & {
      phase: "authority-audits";
      authorityAuditHashes: readonly [string, string, string, string];
    }>
  | Readonly<InternalProductionFinalClosurePostHandoffPhaseCommonV1 & {
      phase: "final-zero-owner";
      completeZeroOwnerCensusHash: string;
      docsMaterializationLeaseCensus: Awaited<
        ReturnType<typeof inspectGoldenDocsMaterializationLeaseCensusV1>
      >;
    }>;

export interface InternalProductionFinalClosurePostHandoffReadyV1 {
  schema: "setfarm.internal-production-final-closure-post-handoff-ready.v1";
  intentRef: CanonicalRef;
  intentHash: string;
  orderedPhaseRefs: readonly [CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef];
  orderedPhaseHashes: readonly [string, string, string, string, string, string, string];
  finalCoordinatorLeaseRecordRef: CanonicalRef;
  finalCoordinatorLeaseRecordHash: string;
  finalCoordinatorFencingToken: number;
  readyRef: CanonicalRef;
  readyHash: string;
}

export interface InternalProductionFinalClosurePostHandoffReceiptV1 {
  schema: "setfarm.internal-production-final-closure-post-handoff-receipt.v1";
  epochHash: string;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  closureGenerationHash: string;
  closureGenerationDirectory: InternalProductionClosureGenerationDirectoryV1;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  operationalSetfarmSha: string;
  documentationSha: string;
  missionControlSha: string;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  closurePacketHash: string;
  finalizationHash: string;
  prePacketReviewReceiptRef: CanonicalRef;
  prePacketReviewReceiptHash: string;
  prePacketReviewHistoryRef: CanonicalRef;
  prePacketReviewHistoryHash: string;
  docsSessionHash: string;
  docsSessionReceiptRef: CanonicalRef;
  docsSessionReceiptHash: string;
  docsLeaseRetirementReceiptRef: CanonicalRef;
  docsLeaseRetirementReceiptHash: string;
  docsMaterializationLeaseCensus: Awaited<
    ReturnType<typeof inspectGoldenDocsMaterializationLeaseCensusV1>
  >;
  postHandoffIntentRef: CanonicalRef;
  postHandoffIntentHash: string;
  finalCoordinatorLeaseRecordRef: CanonicalRef;
  finalCoordinatorLeaseRecordHash: string;
  finalCoordinatorFencingToken: number;
  orderedPostHandoffPhaseRefs: readonly [CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef, CanonicalRef];
  orderedPostHandoffPhaseHashes: readonly [string, string, string, string, string, string, string];
  documentationPullRequest: Readonly<{
    url: string;
    baseSha: string;
    headSha: string;
    squashMergeSha: string;
    soleParentSha: string;
  }>;
  documentationIndependentReview: Readonly<{
    historyRef: CanonicalRef;
    historyHash: string;
    unresolved: Readonly<{ critical: 0; high: 0; medium: 0 }>;
  }>;
  documentationChecks: Readonly<{
    orderedChecks: readonly Readonly<{
      name: string;
      conclusion: "success";
      evidenceRef: CanonicalRef;
      checkHash: string;
    }>[];
    checkSetHash: string;
  }>;
  orderedTargetPaths: InternalProductionClosureDocumentPathsV1;
  orderedContentHashes: GoldenDocsMaterializationExpectedContentHashesV1;
  canonicalRemoteMain: InternalProductionCanonicalRemoteMainEvidenceV1;
  sixFileDeltaHash: string;
  ancestryHash: string;
  semanticBuildEqualityHash: string;
  documentationHandoffRestarts: readonly [
    InternalProductionECompletedRestartPhaseBindingV1 & Readonly<{ namespace: "documentation-handoff"; service: "setfarm-spawner" }>,
    InternalProductionECompletedRestartPhaseBindingV1 & Readonly<{ namespace: "documentation-handoff"; service: "setfarm-dashboard" }>,
    InternalProductionECompletedRestartPhaseBindingV1 & Readonly<{ namespace: "documentation-handoff"; service: "mission-control" }>,
  ];
  runtimeSourceObservationHash: string;
  serviceIdentityHashes: Readonly<{
    spawner: string;
    dashboard: string;
    missionControl: string;
  }>;
  authorityAuditHashes: readonly [string, string, string, string];
  completeZeroOwnerCensusHash: string;
  externalPreflight: ExternalDistributionPreflightBindingV1;
  canonicalRef: "setfarm://internal-production/final-closure/post-handoff";
  recordedAt: string;
  receiptHash: string;
}

export type InternalProductionFinalAcceptanceAuthorityV1 =
  InternalProductionFinalClosurePostHandoffReceiptV1;

export interface InternalProductionFinalClosureHistoricalArchiveV1 {
  schema: "setfarm.internal-production-final-closure-historical-archive.v1";
  archivalOnly: true;
  postHandoffRef: "setfarm://internal-production/final-closure/post-handoff";
  postHandoffHash: string;
  operationalSetfarmSha: string;
  documentationSha: string;
  operationalMissionControlSha: string;
  ancestryReverificationHash: string;
  archiveHash: string;
}

export function recordInternalProductionFinalClosurePostHandoffV1():
  Promise<InternalProductionFinalClosurePostHandoffReceiptV1>;
export function beginInternalProductionFinalClosurePostHandoffV1():
  Promise<InternalProductionFinalClosurePostHandoffIntentV1>;
export function executeInternalProductionFinalClosurePostHandoffV1():
  Promise<InternalProductionFinalClosurePostHandoffReadyV1>;
export function verifyCurrentInternalProductionFinalClosurePostHandoffV1():
  Promise<InternalProductionFinalClosurePostHandoffReceiptV1>;
export function resolveHistoricalInternalProductionFinalClosurePostHandoffV1():
  Promise<InternalProductionFinalClosureHistoricalArchiveV1>;
export function resolveInternalProductionFinalAcceptanceAuthorityV1():
  Promise<InternalProductionFinalAcceptanceAuthorityV1>;

export function recordRecoveryDocsDeliveryFromFinalClosureV1(input: Readonly<{
  campaignHash: string;
}>): Promise<RecoveryDocsDeliveryAcceptanceV1>;

export interface InternalProductionDocsMaterializationCompletionBindingV1 {
  schema: "setfarm.internal-production-docs-materialization-completion-binding.v1";
  closureFinalizationHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  closureGenerationHash: string;
  closureGenerationDirectory: InternalProductionClosureGenerationDirectoryV1;
  targetPaths: InternalProductionClosureDocumentPathsV1;
  receiptRef: CanonicalRef;
  receiptHash: string;
  sessionHash: string;
  bindingHash: string;
}
```

`prepare-input` first resolves the accepted full epoch plus C matrix, D recovery, and B fleet finalization authorities, requires their epoch hashes and source pair to agree, and derives `closureGenerationHash = hashCanonicalJson({epochHash:finalReleaseEpoch.epochHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash})` before rendering either E output or creating `InternalProductionFinalClosureFinalizationV1`. No schema, operational SHA, full epoch object, later E `closureFinalizationHash`, content hash, path, or timestamp participates in that formula. The input stores the exact four-member derivation tuple, hash, directory `epoch-${finalReleaseEpoch.epochHash}-closure-${closureGenerationHash}`, ordered six paths, and the six immutable pre-render owner identities only; `InternalProductionFinalClosurePacketV1` inherits those values and both deterministic E renderers include the same binding. Neither input nor pre-packet review claims the final six-content tuple. Finalization later resolves all six owners' reviewed private bytes, stores the identical tuple/hash/directory/paths, the exact ordered content-hash tuple `[C matrix Markdown,D recovery-matrix Markdown,D recovery-reconciliation Markdown,B fleet Markdown,E JSON,E Markdown]`, the full `finalReleaseEpoch`, and the byte-identical ordered `GoldenCommittedTimeoutReconciliationPairAuthorityV1` array fresh-resolved above, then derives its independent `finalizationHash` from that strict object. Only finalization, B completion, and post-handoff may bind that actual six-content tuple. It reopens the three upstream finalization authorities and rejects any tuple or generation drift before sealing. B receives no caller path or entry: begin independently recomputes the same pre-render generation hash and single directory from the exact epoch/matrix/recovery/fleet finalization inputs, derives the six fixed basenames and content mapping, and separately binds the later E closure-finalization hash. Review finding/history hashes use their stated omit rules. A clear receipt's `receiptHash` omits only `receiptHash` and `receiptRef`, then `receiptRef` is exactly `setfarm://internal-production/pre-packet-review/receipts/sha256/${receiptHash}` parsed by `CanonicalRefSchema`. `createInternalProductionPrePacketReviewReceiptResolverV1().resolve({receiptRef,receiptHash})` rederives both identities, opens only that exact content address, and resolves the complete history; no pointer-only/hash-only lookup is authoritative. Review refs are unique; every ref/hash is bounded; JSON keys and Markdown section order are deterministic. The JSON writer re-parses its private bytes before sealing, and the Markdown writer is generated only from that validated packet. The post-handoff receipt is created only after the generation's six-file docs merge and is not an input to C, D, fleet settlement, cold rehearsal, or either pre-packet/final packet hash. Once recorded, that exact receipt is `InternalProductionFinalAcceptanceAuthorityV1`: final acceptance is the tracked generation packet plus this private non-circular receipt, which freshly binds the pre-packet review/finalization and the reviewed docs-only handoff. No second final-acceptance wrapper, hash, or mutable verdict exists.

The final two tuple entries are the canonical content refs for fleet status and cold rehearsal. `goldenMatrix.statusRef` is exactly C's `GoldenMatrixReceiptV1.matrixReceiptRef`, and `goldenMatrix.statusHash` is its `matrixReceiptHash`; neither may be replaced by the finalization pointer ref/hash or finalizer output. `prepare-input` calls C `resolveGoldenMatrixReceiptV1({matrixReceiptRef:statusRef,matrixReceiptHash:statusHash})`, then requires the resolved receipt and current `GoldenMatrixFinalizationPointerV1` to repeat the same ref/hash byte-for-byte before accepting the report/finalizer fields. It also calls `createExternalDistributionPreflightEvidenceResolverV1().resolve(...)` on the cold receipt's exact pair and requires the returned full sorted blocker/detail/evidence-ref list to equal the pre-packet review, final input, generated JSON, and generated Markdown projection byte-for-byte. `scopeHash` is exactly `hashCanonicalJson({reviewedRefs,reviewedHashes,source,externalPreflight})`, where `externalPreflight` is that complete strict binding and `reviewedHashes` is the same ordered eleven-entry tuple: A tracked baseline hash; A private post-handoff receipt hash; C matrix report hash; C private finalizer-output hash; fleet report hash; fleet private finalizer-output hash; D recovery-matrix Markdown hash; D recovery-reconciliation Markdown hash; D private finalization hash; fleet `statusHash`; and cold `receiptHash`. The bounded `fleet.timeoutReconciliationAuthorities` tuple contains the exact imported B authorities and must equal the ordered `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)` result already bound by status and B finalization. `prepare-input` schema-parses each persisted member, matches it to the same-position freshly listed authority, authenticates only that B-returned nominal value, requires `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})` byte equality, then fresh-calls `resolveCommittedTimeoutReconciliationPair({authority})` and verifies every campaign/original/terminal/pair/index/ref/hash relation before deriving or rendering; it embeds no result, terminal-result, pair, or supersession body and never reads a bare supersession. A's `resolve-historical --json` must rederive the strict post-handoff receipt, tracked baseline marker, recorded build/service/audit/complete-zero authority, and ancestor continuity from its historical Setfarm/Mission Control pair to the current clean pair; it deliberately does not require current services to equal A's old SHAs. Final operational source/build/service authority is proven separately by C/D/fleet/B on `source`. Each C/fleet finalizer-output ref must resolve to a fixed private mode-`0600` file whose strict body is B's `GoldenFinalizedCampaignReportV1`; `hashCanonicalJson(fullStrictObject)` equals the recorded output hash, its independently recomputed payload-without-`finalizationHash` equals the corresponding finalization hash, and its report identity equals the recorded target path/hash. D's private finalization resolver must recompute both packet bytes and bind the same recovery campaign and final epoch. C matrix status, D recovery selection, fleet status/settlement, both B finalizations, and `source` must all carry the same exact `GoldenFinalReleaseEpochV1` and current Setfarm/Mission Control source pair. The pre-packet review therefore scopes A baseline/post-handoff authority, the complete ordered matrix, all ten recovery selections, the fleet raw/committed-timeout-authority/effective mapping, cold rehearsal, and exact external false/blocked blocker authority before any tracked report is materialized. The Markdown writer renders the five-code-order blocker list with each bounded detail and canonical evidence ref; it never substitutes prose for the evidence object. Its schema forbids either final closure output path/hash, so the review is not circular. The one later docs PR receives its own normal code/docs review.

Reject raw B results, classifications, assertion rows, cleanup rows, tasks, prompts, database/process/port rows, backup paths, logs, screenshots, tokens, or arbitrary additional refs in review/input/packet schemas.

Materialization crash tests inject response loss immediately before and after B's atomic claim/worktree/generation-lease ownership, source-build authority reopen, each E owner callback, immediate byte copy/hash verification, no-replace physical publication, target reopen, expected-session-hash/ordinal CAS, and receipt return. A pre-advance physical file is visible only to B's private recovery as uncommitted and is never returned, accepted, or counted by E/D without the matching B CAS advance. Same-live-session retry may adopt that exact file and perform the one missing CAS transition; after the advance it returns the exact `GoldenDocsMaterializationEntryCommitReceiptV1`. A caught failure enters one `try/finally`: it attempts `abandonGoldenDocsMaterializationSessionV1(session)` in the `try`, but the `finally` unconditionally invokes the documentation owner's authenticated discard even when abandon throws. The owner hook internally creates and consumes its opaque disposed-claim capability through owner-only `completeGoldenDocsClaimOwnerTerminalDisposalV1({disposedClaim})`; E neither imports nor receives that capability, operation, mutator, or module. The owner returns only strict `{schema:"setfarm.internal-production-docs-claim-owner-terminal-disposal-result.v1",receiptRef,receiptHash}`. E copies only the pair, fresh-calls `resolveGoldenDocsLeaseRetirementReceiptV1({receiptRef,receiptHash})`, and binds the reopened terminal receipt; an `active-lease-retired` receipt must bind the retired lease/session/generation, while `no-active-lease` requires every such member null. Process loss makes that session and claim permanently nonretryable; a fresh E process can receive only the owner's already durable receipt ref/hash and can call only the B resolver/census—it never receives, reconstructs, or consumes a disposal capability. After this authenticated retirement and unconditional claim discard, recovery proves the unchanged full epoch/finalization/source/generation/content inputs, obtains a new clean exact-base owner claim and new B session with all six current-generation targets absent, and permits a new claim-bound session/completion pair rather than asserting identity with the orphaned pair. Crash tests cover abandon success/failure, owner discard before/after its private terminal-disposal call, owner response before/after durable pair return, resolver before/after terminal receipt, resolver response loss, and reject generation/finalization-derived lease keys, any E import/receipt of a disposed capability or owner-only operation, malformed/extra-key owner result, wrong retirement pair, non-null no-active members, or unretired/pending leases. Tests also reject an advance without exact reopened bytes, source-authority drift, lease mismatch, retry/adoption after process loss, acceptance of an uncommitted file, wrong owner callback, mutable-after-return bytes, Buffer/subclass/SharedArrayBuffer view, callback extra key, reentrancy, or either final entry committed twice.

Post-handoff tests start from a temporary Git history containing one complete older six-file generation, then an operational commit for a distinct epoch followed by one docs-PR squash commit adding exactly the six newly derived targets. Require `completeGoldenDocsMaterializationSessionV1(session)` to return B's unchanged exact four-field value `{receiptRef:CanonicalRef,receiptHash:string,sessionHash:string,orderedMaterializationHashes:readonly string[]}` after persisting B's strict `GoldenDocsMaterializationCompletionReceiptV1`. E wraps those fields unchanged in `{finalizationHash,closureGenerationHash,targetPaths,receiptRef,receiptHash,sessionHash,orderedMaterializationHashes}`. The new epoch must derive one distinct `epoch-${epochHash}-closure-${closureGenerationHash}` directory and six initially absent B-defined paths while every older generation remains byte-identical. A fresh-process `begin-post-handoff` resolves the completion only through `resolveGoldenDocsMaterializationCompletionReceiptV1({receiptRef,receiptHash})`, reopens the C/D/B finalizations, independently rederives the exact four-member generation tuple/hash/directory/path/content binding, and requires B's completion receipt to repeat all of it plus the separate E finalization hash. It also resolves the Setfarm docs handoff, exact squash PR URL/base/head/merge/sole-parent relation, immutable independent-review history with zero unresolved Critical/High/Medium, bounded all-success check set/hash, and fresh code-owned canonical remote-main evidence for both repositories. Before build, restart, audit, or time-dependent observation, the fixed-key intent freezes one `recordedAt`, all SHAs, PR/review/check/session/pre-packet/finalization/packet/external identities, generation tuple/hash/directory/paths, canonical remote SHAs/evidence hash, and exactly seven planned slots: semantic build, three restarts, runtime/health, authority audits, and final read-only zero-owner census. There is no pre-restart zero slot or second restart guard. Require `documentationSha === squashMergeSha`, `baseSha === soleParentSha === operationalSetfarmSha`, Setfarm canonical remote main at `documentationSha`, and Mission Control canonical remote main at `operationalMissionControlSha`. Current/final acceptance reruns the bounded remote observer and also requires clean local synchronized repositories with those exact HEADs; historical resolution returns only the nonassignable `archivalOnly:true` wrapper. Reject caller-authored identities, draft/unmerged/rebased/multi-parent/multi-commit PRs, wrong base/head/merge/parent, unresolved review/checks, corrupt or cross-generation completion/finalization/packet authority, altered tuple/formula/suffix, existing current targets at begin, prior-generation mutation, external binding drift, remote movement/zero/multiple/malformed refs, equal operational/docs SHAs, nonancestry, local or remote HEAD drift, dirty/diverged main, a seventh path, wrong bytes/mode/build/service/owner/audit authority, forged timestamp/hash/ref, collision, link/mode drift, or caller identity flags. Prove `documentationSha` never enters `createGoldenFinalReleaseEpochV1`, C/D/fleet/cold status, or tracked operational source.

Docs-review recovery tests inject a byte-affecting finding before merge and require the original claim/session/finalization to remain immutable and nonaccepting. A packet/evidence-only repair must append a new pre-packet review node with exact predecessor lineage, derive a different input/finalization, allocate a distinct authenticated worktree at the same exact operational base, begin an empty six-entry session, and materialize all six files from scratch; it may not copy or patch any abandoned file. A generator/source finding must reject same-epoch materialization entirely and require a successor operational epoch with fresh C matrix, D recovery/operational acceptance, E fleet/cold/finalization, review, and docs session. Reject amend/force-push of corrected generated bytes onto the original claim, partial-file adoption, session reuse, or a repaired finalization that still references the old clear-review head.

Inject process crashes for the by-finalization binding, failed/successful owner discard, owner-private terminal disposal, durable retirement-pair return, docs-lease retirement resolution, read-only A zero-census observation and, after the docs merge, before/after post-handoff intent publication, coordinator lease record/pointer CAS/renew/reclaim/release, semantic build observation, every strict restart pending transition, D prepared-pair/current-pair/status/resume/authorization/operation/core/target-set-close/occurrence/head/release/final-envelope boundary, close-free E core, A coordinator-reservation close, scope/service failure receipt/status-head CAS, restart-phase publication/head CAS, runtime/audit/final-zero phase write and head CAS, final lease-pair embedding, ready receipt, fresh-process lease resolution, final receipt publication, fixed current binding, and CLI response. Before intent publication no build, restart, audit, or final observation may begin. After intent publication every mutating/observing boundary authenticates the still-current lease capability and fencing token. A fresh process can proceed only after bounded expiry plus exact prior-owner process absence and token/CAS reclaim; it resolves the fixed intent, journal head, phase prefix and optional pending-restart pair, preserves its frozen `recordedAt`, and executes only the exact missing suffix. Count shared-authority calls and prove D prepare never begins before prepare-input durability. Response-loss recovery reopens the immutable prepared authority but never the initial current snapshot, calls zero-input status, resolves only its current pair, validates active phase and identity, resumes from any active phase, then requires exact authorized status whose freshly resolved current authority binds the returned quartet. It reopens/validates both immutable returned pairs and adopts them only through one durable current-clear transition. D execution never begins before `operation-persisted`; all later recovery excludes status/current resolution and locator serialization; E core never begins before D final-envelope resolution; A close never begins before fresh E-core/D-release resolution; completed or failed E phase never begins before the close; and a completed phase is never repeated. Start two concurrent coordinators at build and every restart/pending/head boundary: one owns the lease; the other returns `FINAL_CLOSURE_POST_HANDOFF_COORDINATOR_BUSY` before observation or mutation. Kill the coordinator after final-zero, after ready, and before/during record; the recorder must derive the same final lease pair/token solely from intent/phases/ready, resolve it through the read-only lease resolver, and produce byte-identical final bytes without an active capability or shell lease value. A crash between final receipt and current binding derives the exact expected receipt pair from the intent/ready authority, adopts it, and returns byte-identically without a scan or fresh clock. Equal existing bytes are adopted only after strict schema/hash/ref/mode/type/link verification; unequal existing bytes, a truncated temporary/final file, symlink/hardlink, wrong mode, collision, stale/missing/cross-intent final lease ref/hash/token, unresolved lease record, stale lease/token/pointer, skipped/reordered phase or pending subphase, wrong D namespace/service pair, crash-created partial state, active/pending docs lease, retirement/census ref/hash/set drift, or a fresh census that is not observed zero fails closed. Tests forbid old-current resolution/comparison/history, same-literal current CAS/adoption, missing/foreign/terminal status, quartet drift, directory scans, glob/newest-file discovery, replacement rename, in-place write/truncate, caller/shell final lease input, and deriving a receipt or pending pair from a filename.

`final-closure-post-handoff-restart-coordinator-v1.test.ts` additionally exercises the `documentation-handoff` spawner transition through D and B as one cross-flow. Before D terminal success, the replacement spawner is healthy but B normal completion polling remains blocked. After the coordinator persists/reopens D's exact operation, startup admission, settled reservation, completion, occurrence, namespace head, and service-start-slot head, D's startup hook appends and freshly resolves exactly one `d-managed-restart` B admission whose namespace, source/build, before/after generation, terminal predecessor, and B predecessor-head CAS match the restart phase. Crash before/after every D terminal and B candidate/head/response/poll-release boundary; recovery adopts the same pair and never calls ordinary/A fallback. A failed/in-progress D result, wrong `source-release-barrier|cold-rehearsal` namespace, missing retirement/activation, stale activation/registration, or a second B successor prevents the dashboard restart and final receipt.

`source-release-service-rebind-v1.test.ts` proves the earlier clean-main barrier also uses D's activated shared authority, never a raw command. It freshly resolves the exact A retirement/D activation pair, creates one fixed intent for the clean SHA pair/full epoch, and for each service uses the literal E manifest row `reserveSourceReleaseServiceRebindOwnerV1` with `source-release-final-epoch-service-v1` to derive/open exactly one per-service coordinator reservation. Its sole `prepare-input-persisted` pre-prepare variant carries null prepared/current fields; `target-authorization-pending-persisted` alone carries D's immutable prepared pair and initial current observation snapshot, whose ref has the exact fixed-locator constant type, while the other six post-prepare variants retain the prepared pair and require both current fields null. D resume returns exactly four fields. Pre-resume E calls zero-input status, resolves only its current pair, requires active phase plus exact identity, and resumes idempotently. Post-resume requires exact `authorized`; E resolves only that currently observed pair and requires it to bind the returned quartet. It never reopens the old snapshot or writes a same-literal current successor. It reopens/validates both returned immutable pairs and transitions to `authorization-operation-persisted` by atomically persisting them while clearing current fields. `authorization-persisted` only fresh-resolves/validates the stored authorization pair. Both wrapper and direct D `prepare` calls carry `authorizationOperationRef`, `authorizationOperationHash`, `authorizationRef`, and `authorizationHash`; D's operation binds only the immutable prepared hash. Recovery after clear uses only immutable prepared/operation/authorization/final authority and neither status nor a current resolver. After D's final envelope, E publishes its close-free core and A closes the reservation against it. Only fresh D `resolveCompletion`, complete core/occurrence/envelope, and a valid `afterGenerationHash !== beforeGenerationHash` may publish `InternalProductionSourceReleaseServiceRebindCompletedRestartV1` and continue. A failed D resolver preserves the full chain, publishes only the scope-`source-release-barrier` failure receipt, and expected-predecessor-CASes the `InternalProductionSourceReleaseServiceRebindStatusV1` failed member; it produces no completed rebind receipt or runtime-source continuation. Tests cover all three active phases, authorized response loss, fresh status-only current resolution, atomic operation-plus-authorization locator clear, authorization revalidation, D final-envelope/E-core/A-close, failure receipt/status, and status-head CAS boundaries; reject extra resume fields, active-pending aliases, a widened locator ref type, operation-only/direct-prepare-without-operation authority, old-current resolution/history/comparison, same-literal current CAS, missing/foreign/terminal status, non-authorized post-resume, quartet mismatch, authorization omitted or first stored later, post-clear status/current resolution, cross-disposition authority, equal/invalid generation, replay, early close/completion, failure-status reopening to running/complete, and cyclic core.

`golden-fleet-source-boundary.test.ts` parses the production TypeScript AST rather than matching text. It pins the exact unaliased B/C/D imports listed in Tasks 1–5, including D's immutable content-addressed `RecoveryRestartTargetAuthorizationPreparedSnapshotV1` plus its prepared-snapshot resolver, mutable fixed-locator `RecoveryRestartTargetAuthorizationActivePendingV1`, `RECOVERY_RESTART_TARGET_AUTHORIZATION_ACTIVE_PENDING_REF_V1`, and its active-pending resolver, `RecoveryRestartTargetAuthorizationOperationV1`, authorization, TerminalCore, target-set-close, final-envelope types/resolvers and A's zero-input census observer. It rejects any D global-zero guard type/function, observer injection, locator-as-operation history, alias, namespace/dynamic import, wrapper/facade, raw private store/path access, alternate docs writer, any `activePendingRef/activePendingHash` alias, a widened `CanonicalRef` locator type, a prepare return other than `{preparedActivePendingRef,preparedActivePendingHash,currentActivePendingRef,currentActivePendingHash}`, a resume return other than the exact four fields `{authorizationOperationRef,authorizationOperationHash,authorizationRef,authorizationHash}`, an operation-only D execution call, a direct D `prepare` missing its authorization-operation pair, or reordered prepare-return/prepared+initial-current-persist/status/current-resolve/active-phase-and-identity-check/resume/authorized-status/current-resolve/quartet-binding/immutable-operation+authorization-resolve/atomic-current-clear/authorization-revalidation/restart/D-final-envelope/E-core/A-close/E-completed-or-failed-record calls. It requires all three active status phases and authorized response loss; it rejects any resolver call using the stored initial current hash, a current equality/predecessor/chain check, same-literal current CAS/adoption, missing/foreign/terminal status, non-authorized post-resume status, quartet mismatch, or current resolution after clear. It requires every shared restart wrapper call to carry `lease` plus both immutable operation and authorization pairs and every direct D call to carry both pairs. It requires the literal nine E manifest rows, source-release per-service row, counts 52/35, E core AST inclusion of the immutable prepared/operation/authorization pairs, and exclusion of both current fields, reservation-close, completed-phase, and receipt fields. It requires `internal-production-restart-phase-failure-v1.ts` and its matching test to be the sole all-scope receipt/store/status/resolver owner, scope-discriminated exact identity/service failure resolution and fixed status CAS, a cold failed-state nested pair, a source failed status/member, and a documentation failed journal member; it rejects a structural terminal duplication, cross-scope/identity/service receipt, continuation, or final acceptance after any failure member. Scheduler AST assertions still require the exhaustive C stage-outcome switch, staged-only execute/recovery, exact status CAS/reopen, acknowledgement resolution, and no E access to B intent/outbox/starter internals.

The docs-session AST contract additionally requires unaliased static imports of B `GoldenDocsMaterializationExpectedContentHashesV1`, `abandonGoldenDocsMaterializationSessionV1`, `resolveGoldenDocsLeaseRetirementReceiptV1`, and `inspectGoldenDocsMaterializationLeaseCensusV1` only from `./golden-run-report.js`. It requires the exact ten-field begin object `{operationalSetfarmSha,closureFinalizationHash,finalReleaseEpoch,sourceBuildAuthorityRef,sourceBuildAuthorityHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash,closureGenerationHash,orderedExpectedContentHashes}`, B's imported expected-content type in finalization/post-handoff content fields, source authority equality through input/finalization/completion binding/post-handoff, and an unconditional owner discard in `finally` even when abandon fails, owner-returned durable retirement-pair consumption, exact retirement resolution, and zero docs-lease census before final acceptance. It rejects a local tuple alias, omitted/extra begin field, closure-finalization input to the generation hash, source authority accepted by path or bare hash, session retry/reconstruction after process loss, E access to B's claim/worktree/generation lease, a lease key containing generation/finalization, a local retirement/census type, any import from `./golden-docs-claim-owner-terminal-disposal.js`, any reference/import/use of `GoldenDocsDisposedClaimAuthorityV1`, `GoldenDocsClaimOwnerTerminalDisposalResultV1`, `completeGoldenDocsClaimOwnerTerminalDisposalV1`, or `retireGoldenDocsMaterializationLeaseV1`, a persisted/serialized disposed capability, or final zero without B's census.

The same AST test forbids E imports or calls of B `GoldenPreparedExecutionOutcomeV1`, `GoldenPreparedExecutionPorts`, `executePreparedGoldenCaseV1`, and `recoverPreparedGoldenCaseV1`; those exact prepared-continuation seams are C implementation details behind `executeStaged`/`recoverStaged`. Contract fakes prove a fresh staged execution reaches B execute-prepared exactly once through C, recovery reaches only B recover-prepared through C, and neither path reruns B preflight or dynamic capacity.

Only the catalog may call C's template preparer; only C's composition may own the attempt provisioner; only the E scheduler/CLI may import B's effective projection and timeout reconciliation surfaces. AST tests require unaliased static imports of `GoldenCommittedTimeoutReconciliationPairAuthorityV1`, its schema, and `authenticateGoldenCommittedTimeoutReconciliationPairAuthorityV1` only from `./golden-run-contract-v1.js`, and exact `GoldenRunResultStore` only from `./golden-run-store.js`; calls may use only the store's named writer/list/locator/resolver. No E module may redeclare/mint an authority, define a timeout/effective-result mapper, accept/list a bare supersession, alias/wrap/dynamically import these surfaces, or read/scan a result, supersession, pair, authority, or index path directly. `prepare-input` must call `resolveGoldenMatrixFinalizationPointerV1(loadedMatrix)`, pass that pointer's exact `matrixReceiptRef`/`matrixReceiptHash` to `resolveGoldenMatrixReceiptV1(...)`, call `createRecoveryOperationalAcceptanceResolverV1().resolveByRef(operationalAcceptanceRef)`, then `createRecoveryFinalizedPacketResolverV1().resolveByRef(finalizationRef)` with the gate's exact identity, and resolve clear review only through `createInternalProductionPrePacketReviewReceiptResolverV1().resolve({receiptRef,receiptHash})`; no caller opens a C/D/review pointer, index, receipt, or content-addressed file itself. Input, packet, and finalization bind the exact clear receipt/history plus full epoch, upstream matrix/recovery/fleet finalization hashes, derived generation hash, single suffix, and six paths. Review source tests retain open/rejected/clear lineage with bounded findings and reject hash-only lookup, ref/hash drift, lineage reset, omitted prior findings, cross-scope forgery, consumed-inbox reconstruction, unbounded history, or finalization without fresh complete-lineage resolution.

Only `materializeInternalProductionClosureDocsV1` may resolve the authenticated finalization, reopen the source-build authority plus three upstream finalizations, rederive and compare the exact generation tuple/hash/suffix/paths plus B-typed content hashes, call B begin/complete/abandon, invoke B's fixed report writer for entries one/four, invoke D's owner-mediated writer for entries two/three, call B's exact owner-mediated commit twice for E entries five/six, and write the fixed E completion binding. E imports and uses B's exact `GoldenDocsMaterializationExpectedContentHashesV1` only from `./golden-run-report.js`; it declares no local six-string expected-content tuple. It constructs no `GoldenDocsMaterializationEntryV1` and passes no entry or path to begin. Source-order tests require `resolve source/upstream finalizations -> derive hashCanonicalJson({epochHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash}) before E rendering/finalization -> bind source pair plus tuple/hash/suffix/paths through input/packet/finalization -> authenticate content tuple -> B begin exact ten-field path-free input`. They reject a schema, operational SHA, full epoch, E closure-finalization hash, content hash, path, or timestamp in the generation formula; a later derivation; omitted source/tuple/hash/suffix/path member; old nested directory; caller entry/path; wrong basename; or begin before equality authentication.

The materializer consumes the authenticated owner-returned worktree/branch/base and rejects canonical-root inference. Only the post-handoff journal publishes the intent/pending/phase/ready chain, and only its restart coordinator calls D under `documentation-handoff` through fixed locator discovery, zero-input resume, immutable authorization-operation, authorization, and restart operation with the exact namespace/service predecessor. Only the post-handoff module reopens that chain and completion binding. Current/final resolution calls the fresh canonical-remote observer and checks clean local heads; historical resolution is archival only. AST tests reject observer/global-zero injection, locator history, aliases, local authority lookalikes, raw B/C/D path reads, premature restart, restart before durable pending input/authorization, early E close, terminal cold-operation reuse, abandoned-session reuse, or promotion of `documentationSha` to an operational epoch.

Round20 extends the source-boundary AST contract with B's exact unaliased type `GoldenCampaignExecutionCapacityV1` and value `GoldenCampaignExecutionCapacityV1Schema` only from `./golden-run-contract-v1.js`, value `deriveGoldenCampaignExecutionCapacityV1` only from `./golden-run-harness.js`, and C's exact `GoldenStageCoordinationV1`, `prepareGoldenStageCoordinationV1`, and `resolveGoldenStageCoordinationV1` only from `./golden-stage-coordination-v1.js`. The scheduler order is `derive capacity -> prepare coordination -> persist exact C-owned launchAttemptOrdinal/ref/hash -> status CAS/reopen coordination -> stage same ref/hash -> exhaustive stage-outcome dispatch -> status CAS/reopen exact branch`; only `kind:"staged"` continues to `executeStaged`. Response loss before the outcome CAS is `resolve pending coordination -> stage same ref/hash and ordinal -> adopt exact discriminated outcome`. A legitimately reviewed retry must call prepare and persist C's next bounded ordinal/address. Repair order is `resolve unconsumed repair -> persist repair-linked coordination -> stage`; only a staged outcome may prove C/B consumption and enter the atomic successor epoch+staged+consumed-hash CAS, while pre-run/blocked keep the receipt unconsumed. AST tests reject an alternate capacity module, import alias, namespace/dynamic import, local capacity or stage-outcome type/schema/deriver, E capacity calculation, `eligibleConcurrency`, direct first-five classification/cleanup inspection for capacity, local coordination types/resolvers/ordinal allocation, stage before coordination status, repair consumption/hash append before a narrowed staged outcome, a third pending/staged member above B capacity, a reused prior ordinal for a distinct retry, and any second coordination on response loss.

The same source-boundary suite makes `external-distribution-readiness-v2-adapter.ts` the only E consumer of the existing readiness-v2 parser/observer and `external-distribution-preflight-evidence-v1.ts` the sole store/resolver for `ExternalDistributionPreflightEvidenceV1`. It requires every cold, review, input, packet, Markdown, intent, and post-handoff path to carry `ExternalDistributionPreflightBindingV1` and call the exact resolver at each trust boundary. It pins the exact five-code observation tuple, status union, readiness-reason tuple type, five-current-blocker projection, and E record command's zero-input call order. It bans a bare `externalPreflightHash`, expecting `setfarm platform-release preflight --json` to emit E's schema, a locally redeclared readiness/blocker/binding type, caller readiness/observation/blocker/ref input, generic ref/reason acceptance, filesystem path/URL/log evidence, dynamic/namespace import, direct store/index read, a second recorder, list sorting outside the authority module, or equality checks that omit readiness hash, observations, status, ref, hash, blockers, details, reason codes, evidence refs, observation hashes, or false/blocked literals.

- [ ] **Step 2: Implement fixed input/review stores and exact CLI**

The operator obtains B `resolveInternalProductionDataRootV1()` and creates fixed child `pre-packet-review/inbox` as a real mode-`0700` directory, then allocates the reviewer observation with `mktemp` using basename `.observation.XXXXXXXX.json`, mode `0600`, and `umask 077`. `record-review` accepts only that generated basename under the exact real inbox, opens it with `O_RDONLY|O_NOFOLLOW`, and requires a regular link-count-one mode-`0600` file. It validates the observation's exact `scopeHash` against current fixed artifacts and materializes every bounded finding as an immutable content-addressed `InternalProductionPrePacketReviewFindingV1` before consuming the observation. Finding IDs are stable and limited to `64` UTF-8 slug bytes; `problemText` is normalized UTF-8 capped at `2,048` bytes; `location.artifactRef` is canonical and its nonempty exact anchor is capped at `256` bytes; evidence refs are canonical, unique, and capped at `16`; one review has at most `64` findings, lineage has at most `16` review rounds, and every array/ref is bounded and unique. Each finding hash omits only its derived `findingHash`/`findingRef`, then derives the one canonical ref from that hash; history uses the same omit-hash/ref rule. Parsers recompute both and reject unknown fields, cross-scope current findings, invalid anchors/evidence, or an unresolved resolution relation.

Every immutable history node binds its own `scopeHash`, finite `verdict`, and exact predecessor tuple. `verdict:"open" | "rejected"` is retained with nonzero unresolved counts and open/rejected findings; it cannot produce the final clear receipt. `disposition:"resolved"` requires exact non-null resolution ref/hash; `open | rejected` requires both null; Low may use `accepted_low` and Info may use `informational` with both null. A same-scope round requires predecessor scope equality and a strictly next ordinal. When a repair/source advance changes the review scope, the new node points to the prior scope's exact history ref/hash, reopens its entire bounded lineage, and lists every still-relevant prior `findingHash` in `carriedFindingHashes`; each carried hash must resolve to the prior node and is either reissued under the new scope with the same stable finding ID plus a new disposition/resolution, or explicitly closed by a canonical resolution. It may not reset ordinal/lineage, omit an open prior finding, or attach an unrelated scope. All nodes remain immutable and reachable. Only a head node with `verdict:"clear"`, zero Critical/High/Medium unresolved counts, and every inherited finding accounted for may produce `InternalProductionPrePacketReviewReceiptV1`.

After every finding and resolution plus one complete history node have been canonicalized, fsynced, published, reopened with `O_NOFOLLOW`, and rehashed, `record-review` advances the expected-predecessor history pointer even for `open` or `rejected`; those commands return the immutable history ref/hash and retain the observation-derived authority but do not emit a clear receipt. Only a qualifying clear head may derive the strict receipt ref from its hash and write the immutable receipt at fixed child `pre-packet-review/receipts/sha256/${receiptHash.slice(0,2)}/${receiptHash}.json`. The recorder then advances its expected-predecessor clear-receipt pointer with that exact ref/hash and unlinks the consumed generated observation. The observation file is transport only and is never the sole authority after deletion: the clear receipt binds `reviewHistoryRef`/`reviewHistoryHash`, and input, packet, and finalization repeat and resolve that exact pair and full predecessor lineage. Directories are real mode-`0700`; stored files use exclusive mode-`0600`, `O_NOFOLLOW`, link-count checks, hash verification, fsync, and atomic no-replace publication. Crash tests cover every boundary before/after finding publication, resolution publication, open/rejected/clear history publication, pointer CAS, clear receipt publication, and observation unlink; resume adopts only exact content-addressed bytes and never reconstructs history from a missing inbox file.

`prepare-input` reads the fixed A tracked baseline plus historical receipt and B/C/D/E private content-addressed pointers, recomputes every hash, calls C `resolveGoldenMatrixFinalizationPointerV1(loadedMatrix)`, resolves C's matrix receipt only by that pointer's exact `matrixReceiptRef`/`matrixReceiptHash`, calls D `createRecoveryOperationalAcceptanceResolverV1().resolveByRef(recovery.operationalAcceptanceRef)` with the exact ref/hash exported before E, requires that operational gate's epoch and recovery finalization ref/hash to equal the current fleet authority, and then calls `createRecoveryFinalizedPacketResolverV1().resolveByRef(recovery.finalizationRef)`. It resolves and rehashes the exact C matrix, D recovery, and B fleet finalization hashes, requires one full final epoch, derives `closureGenerationHash` from only `{epochHash:finalReleaseEpoch.epochHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash}`, and derives the single exact suffix and six paths before either E document is rendered. It passes `independentReview.receiptRef` and `receiptHash` unchanged to `createInternalProductionPrePacketReviewReceiptResolverV1().resolve(...)`, requires the resolved clear receipt to repeat both plus the exact current scope/history pair, and reopens the complete immutable open/rejected/clear predecessor lineage. It loads B's raw fleet results and persisted ordered committed timeout-pair projections, schema-parses them, requires byte equality with the fresh B authority list, then authenticates, locates, and resolves only those fresh nominal authorities; passes only those resolved `timeoutReconciliations` to B's exact helper; verifies all epoch/pair/index/effective-result bindings; and stores canonical input bytes containing the exact generation tuple/hash/suffix/paths at fixed-root content address `final-closure/inputs/sha256/${inputHash}.json`; older rejected inputs and histories remain immutable. `finalize-private` reads that input, revalidates every ref/hash/epoch and the generation derivation, deterministically renders and privately stores final JSON/Markdown with the same binding, and creates `InternalProductionFinalClosureFinalizationV1` at `final-closure/finalizations/sha256/${finalizationHash}.json`. Its B-imported `GoldenDocsMaterializationExpectedContentHashesV1` value is exactly C matrix Markdown, D recovery-matrix Markdown, D recovery-reconciliation Markdown, B fleet Markdown, E JSON, E Markdown; the finalization repeats the generation tuple/hash/suffix/paths and independently adds its later `finalizationHash`. It advances a hash-only current-epoch finalization pointer without replacing prior finalizations and does not touch Git.

`materialize-all --finalization-hash SHA256` first resolves the explicitly reviewed finalization, recomputes its B-typed six ordered content hashes, reopens the exact source-build authority plus the three named upstream finalizations, and authenticates the already-bound generation tuple/hash/suffix/paths while the exact-base docs claim is still clean. In one Node process it then calls only `beginGoldenDocsMaterializationSessionV1({operationalSetfarmSha,closureFinalizationHash:finalizationHash,finalReleaseEpoch,sourceBuildAuthorityRef,sourceBuildAuthorityHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash,closureGenerationHash,orderedExpectedContentHashes})`; it passes no entries or path. B atomically owns the docs claim/worktree/generation lease, freshly reopens and authenticates the exact source-build ref/hash, requires `operationalSetfarmSha === finalReleaseEpoch.setfarmSha`, independently recomputes `closureGenerationHash = hashCanonicalJson({epochHash:finalReleaseEpoch.epochHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash})`, derives the single directory `docs/review-packets/internal-production/epoch-${finalReleaseEpoch.epochHash}-closure-${closureGenerationHash}`, installs the fixed six basenames/content hashes itself, and binds the independent later `closureFinalizationHash` without using it as a generation input. Any source, tuple, hash, suffix, lease, or content drift fails before B returns the live session. E next calls `materializeFinalizedGoldenCampaignReportInSessionV1(...)` for C's matrix entry, exact D `materializeFinalizedRecoveryPacketInSessionV1(...)`, and B's same report writer for the fleet entry.

E then calls `commitNextGoldenDocsMaterializationEntryV1(...)` exactly twice: first with `{ownerId:"e-final-closure-v1",expectedKind:"final-closure-json",session,reopenOwnerContent}` and then with `{ownerId:"e-final-closure-v1",expectedKind:"final-closure-markdown",session,reopenOwnerContent}`. Each zero-argument callback freshly resolves the immutable E private finalization and only its corresponding private byte stream, recomputes its content hash, and returns exactly `{bytes:Uint8Array,contentHash}`. It validates no hidden B path/controller state. B requires an exact ordinary-`ArrayBuffer`-backed `Uint8Array` with no Buffer/subclass/`SharedArrayBuffer`-backed view or extra key, synchronously copies it immediately after the callback await and before any further await or side effect, and hashes/writes only that copy. B's private per-session mutex rejects reentrancy; its expected-session-hash/ordinal CAS commits one advance. A physically published pre-advance file is explicitly uncommitted: no caller may return, accept, or count it until the matching B CAS advance succeeds. Same-live-session retry may adopt that exact uncommitted file and complete the one CAS transition; a process loss discards the isolated docs claim rather than reconstructing the hidden session. E retains the two exact path-free `GoldenDocsMaterializationEntryCommitReceiptV1` values for verification but never reads/authenticates/mutates B's private controller, constructs or receives a target path through the commit ABI, calls a raw entry writer, or exposes an advance operation. Only then does E call `completeGoldenDocsMaterializationSessionV1(session)`. Completion returns exactly `{receiptRef,receiptHash,sessionHash,orderedMaterializationHashes}` and B has already persisted the strict `GoldenDocsMaterializationCompletionReceiptV1`. E immediately calls the exact B resolver with the returned pair and requires the receipt's operational SHA, full `finalReleaseEpoch`, source-build authority ref/hash, `matrixFinalizationHash`, `recoveryFinalizationHash`, `fleetFinalizationHash`, independent `closureFinalizationHash`, `closureGenerationHash`, session hash, six B-derived ordered entries/content/materialization hashes, and both E commit receipts to equal the authenticated materialization plan and return tuple. Any caught session failure uses the unconditional owner-disposal `try/finally` above: abandonment is best-effort, the owner hook still runs if it throws, the owner alone consumes the opaque disposed capability and returns only `{receiptRef,receiptHash}`, and E fresh-resolves that terminal retirement receipt before another claim. After process loss E never retries, reconstructs, or adopts that session/claim and may continue only with a newly allocated clean exact-base docs claim and a new B begin.

Only after that equality check may E canonicalize the strict hash-only `InternalProductionDocsMaterializationCompletionBindingV1` and install it at fixed B-rooted child `final-closure/docs-materialization-completions/by-finalization/${finalizationHash}.json`. Create an exclusive unpredictable same-directory mode-`0600` sibling, write the complete canonical bytes, fsync and close, publish at the fixed name with the platform's atomic same-filesystem no-replace rename (`renameatx_np(..., RENAME_EXCL)` on the Mac mini), fsync the parent, and reopen the fixed target with `O_RDONLY|O_NOFOLLOW`; require regular one-link mode-`0600`, exact schema/canonical bytes, recomputed `bindingHash`, closure key, generation hash/path tuple, B ref/hash, and session hash. An existing target is never replaced and is adopted only if every byte and recomputed relation is identical. Resolution opens this one exact by-finalization name; it never scans or selects a newest completion. A crash before B completion authority is returned, or after B completion but before E's binding is durable, retires and discards that isolated docs claim; its claim/worktree-bound `sessionHash`, completion ref/hash, and materialization hashes are not reproducible and the unbound completion becomes an undiscoverable orphan. Recovery first proves exact full-epoch, three upstream finalization, E finalization, source-build ref/hash, closure-generation tuple/hash/path, and six expected-content equality, then obtains a newly allocated clean exact-base claim and a new B session, rematerializes all six entries, resolves and rehashes the newly returned completion pair, and accepts that potentially different pair only if every semantic member is equal. It then creates the still-absent fixed by-finalization binding from the new pair. A binding that was already durable is resolved and adopted only byte-for-byte and prevents another session; no new pair may replace it, and no process scans for or adopts the old orphan. The CLI emits exactly the seven wrapper fields in this order: `finalizationHash`, `closureGenerationHash`, `targetPaths`, then B's unchanged `receiptRef`, `receiptHash`, `sessionHash`, and `orderedMaterializationHashes`. It creates exactly:

```text
docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/final-closure.json
docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/final-closure.md
```

plus the same generation's C matrix report, D two files, and B fleet report. The JSON is the strict reference-only packet plus `packetHash`; Markdown is a bounded index of the same references. Each session entry is byte-equal to the already reviewed private hash. The active docs claim must be clean at session start and its authenticated claim `HEAD`, owner-recorded merge base, and `operationalSetfarmSha` must all equal the finalization's exact operational Setfarm SHA. A descendant, sibling, merge-base-only match, or prior docs commit is rejected before `beginGoldenDocsMaterializationSessionV1`. B begin alone derives and checks the empty current-generation six-target set plus target-scoped tracked/staged/untracked state; E supplies no path to that call. Older generation directories are allowed only when tracked and unchanged. A pre-existing current-generation subset is rejected even when its bytes match; no new session adopts a partial prefix. Before every owner callback B's hidden controller authenticates the exact committed prefix/session hash/ordinal. Owner code sees only its selector, opaque session, and private content. An identical physical pre-advance file is adoptable only inside the same live B session and remains uncommitted until B's matching CAS; a different byte fails. After completion exactly six B-derived paths and no other worktree delta exist, and historical generations remain byte-identical. A new process cannot reconstruct a partially advanced WeakMap session, so the Setfarm owner discards the interrupted isolated claim and retries from the unchanged clean operational base with all six current-generation targets absent. Tests create every one-through-five-file stale prefix and require B begin to refuse before a callback, completion, or binding publication.

`recordInternalProductionFinalClosurePostHandoffV1()` is the A-style noncircular final-acceptance authority used only after the docs PR merges. It accepts no identity, PR, review, check, path, hash, service, command, root, timestamp, receipt-body, or output flag. In its fresh process it resolves the immutable closure finalization and input, re-resolves the exact pre-packet receipt/history, rehashes `closurePacketHash`, reopens the fixed completion binding, calls only `resolveGoldenDocsMaterializationCompletionReceiptV1({receiptRef,receiptHash})`, and requires exact operational SHA, closure finalization hash, session hash, and six ordered entry/content/materialization hashes. It derives `documentationSha` from current clean synchronized Setfarm `main`, resolves the Setfarm delivery owner's exact docs handoff and GitHub PR by that squash merge, and requires `documentationPullRequest.squashMergeSha === documentationSha`, `baseSha === soleParentSha === operationalSetfarmSha`, one parent, and one intervening commit. The code-owned docs-review resolver reopens the complete immutable independent-review history and requires zero unresolved Critical/High/Medium findings. The code-owned check resolver lists the fixed PR/head check set, sorts by exact check identity, requires every conclusion `success`, rehashes every evidence ref/check body, and derives `checkSetHash`; caller omissions or aliases are impossible.

`execute-post-handoff` resolves only the fixed intent binding and advances the immutable expected-predecessor phase chain. It computes the exact Git delta and accepts only the six registered target paths with byte hashes equal to the finalization and B completion receipt; any seventh path, rename, mode drift, altered historical file, or nonancestor fails. Its first phase reruns the code-owned clean builds, requires Setfarm `BUILD_INFO.sha === documentationSha` and Mission Control still at the recorded operational SHA, then proves application source/installed-output semantic equality to the operational B source/build authority after excluding only the six tracked Markdown/JSON files and the schema-declared build-info source-SHA marker. All other executable/build bytes, package/remote/common-dir/source roots, and Mission Control semantic manifest must match.

For each `documentation-handoff` service the leased coordinator derives exactly one owner key with `final-closure-post-handoff-service-v1`, persists/reopens the fixed initial locator observation, and resolves D's zero-input non-absent status only while `target-authorization-pending-persisted` is live. It freezes the immutable `preparedActivePendingRef/preparedActivePendingHash` from D prepare but never reopens the stored old current hash. Each recovery calls status, accepts only active phase `pending-input | operation-published | authorized`, resolves only the status-returned current pair, and binds it to the prepared snapshot/namespace/service/coordination. D zero-input resume is idempotent from all three phases and returns exactly `{authorizationOperationRef,authorizationOperationHash,authorizationRef,authorizationHash}`. Post-resume status must be exact `authorized`; E resolves only its fresh current pair and requires the same identity plus returned-quartet binding. E then reopens/validates both immutable returned pairs and atomically persists them in `authorization-operation-persisted` with the current pair null. `authorization-persisted` only fresh-resolves/validates the stored authorization pair. It calls both its wrapper and D direct `prepare` with all four authorization-operation/authorization fields. All later documentation states, terminal bindings, receipts, journals, and historical resolvers retain only immutable prepared/operation/authorization/final authority and neither call status/current resolver nor serialize the locator. After D final envelope, E publishes/reopens the close-free core and A closes the reservation against it. A completed documentation phase additionally fresh-resolves D completion, complete core/occurrence/envelope, and a distinct valid after generation. A failed branch fresh-resolves D failure, failed core/occurrence/envelope, publishes the scope-`documentation-handoff` content-addressed `InternalProductionERestartPhaseFailureReceiptV1`, expected-predecessor-CASes its fixed service failure status/head, and appends only the `restart-service-failed` journal/phase member after the same E-core/A-close chain. It cannot start the next service, publish ready/post-handoff success, record a current receipt, or reach final acceptance. Only three successful `InternalProductionECompletedRestartPhaseBindingV1` branches allow runtime/audits and the sole final all-zero checkpoint; there are no pre-restart zero slots or second restart guard.

After each documentation-handoff resume, before persisting returned immutable authority or preparing the restart, the coordinator fresh-calls D status, requires exact phase `authorized`, resolves only that status's current pair, and requires unchanged prepared snapshot/namespace/service/coordination plus returned authorization-operation/authorization quartet binding. The stored initial current snapshot is neither opened nor compared. E reopens/validates both immutable returned pairs and atomically persists them as the durable locator-clear transition; `authorization-persisted` only revalidates the stored authorization. This same fresh-status-only current resolution, exact post-resume authorized/quartet check, atomic capture, and durable clear is mandatory in cold rehearsal and source release; no later state or recovery calls status or a current-pair resolver.

Intent, lease records, each pending-restart subphase and every completed phase are canonical content-addressed mode-`0600` records published from unpredictable siblings with file fsync, atomic same-filesystem no-replace, parent fsync, and final `O_RDONLY|O_NOFOLLOW` regular/one-link reopen. The store derives the lease owner PID/process identity internally, freezes `acquiredAt`, sets `expiresAt = acquiredAt + 30000ms`, and requires the WeakMap-authenticated capability at every build/restart/pending/head/phase boundary. Renew is exact record-hash CAS. Reclaim requires both bounded expiry and authenticated prior-owner absence, unchanged intent/head, and token-plus-one CAS; expiry alone, absence before expiry, PID reuse, ambiguity or stale token refuses. The fixed journal head binds the exact ordered phase prefix plus either no pending or one exact pending pair and current fencing token, advancing only by expected predecessor CAS. Its parser caps both phase arrays at seven successful phases plus one terminal `restart-service-failed` member, requires exact service order, and rejects a pending service not uniquely next. A fresh lease owner resolves intent/head/phases/pending and follows exactly one suffix: no pending prepares the next service; `prepare-input-persisted` alone repeats D prepare; `target-authorization-pending-persisted` alone obtains fresh D status, resolves only the status-returned current authority, validates active phase and immutable identity, resumes idempotently, then requires exact authorized status whose freshly resolved current authority binds the returned quartet. The ensuing immutable operation transition resolves both returned pairs and atomically records them while clearing current fields, after which `authorization-persisted` only validates the stored authorization and later states persist or reconcile only immutable authority. Terminal states publish only their exact E core, reservation close, completed phase, or the one failed phase/status. It never reopens the initial current observation, writes a same-literal current successor, or repeats a completed build/restart/audit mutation. A failed head is terminal and makes `record-post-handoff` and every current/final resolver refuse. `record-post-handoff` requires the ready receipt, assembles the strict receipt solely from frozen intent and phase bodies, and returns byte-identical bytes/original `recordedAt`; it never calls a clock again.

The recorder writes the receipt to an exclusive unpredictable mode-`0600` sibling below fixed real mode-`0700` `final-closure/post-handoff`, fsyncs and closes the file, publishes with atomic same-filesystem no-replace at `sha256/${receiptHash.slice(0,2)}/${receiptHash}.json`, fsyncs that parent, and reopens the fixed content address with `O_RDONLY|O_NOFOLLOW` to require regular one-link mode-`0600` canonical bytes and recomputed receipt/canonical-ref equality. It then publishes the single fixed hash-only current binding with the same protocol. A crash after receipt publication but before current binding resolves the receipt only through the intent-derived expected receipt ref/hash and adopts it after full revalidation; it never scans or invents a new timestamp. Equal existing intent/phase/ready/receipt/binding bytes are adopted only after full validation and unequal bytes fail closed. Neither record/current/historical resolution scans directories. The canonical ref remains `setfarm://internal-production/final-closure/post-handoff`.

`verifyCurrentInternalProductionFinalClosurePostHandoffV1()` reopens and rehashes that receipt, pre-packet/finalization/packet, docs PR/review/check authorities, the completion binding, B's completion receipt, exact docs-lease retirement receipt, and the strict external-distribution preflight receipt before rederiving the current Git/build/service/audit/all-zero identities immediately after handoff. It fresh-calls `inspectGoldenDocsMaterializationLeaseCensusV1()` and requires byte equality with the bound census, zero active/pending counts, `observedZero:true`, and unchanged terminal-retirement-set hash. It requires exact external ref/hash/full blocker-list equality across cold receipt, pre-packet review, input, tracked JSON/Markdown, fixed post-handoff intent, and final receipt. It requires Setfarm and Mission Control each on clean synchronized `main`, then exact Setfarm `HEAD === receipt.documentationSha` and exact Mission Control `HEAD === receipt.missionControlSha === operationalMissionControlSha`. `resolveHistoricalInternalProductionFinalClosurePostHandoffV1()` later reopens the immutable authority chain and returns only the distinct `InternalProductionFinalClosureHistoricalArchiveV1` wrapper with `archivalOnly:true`, named receipt ref/hash and ancestry re-verification hash. It deliberately does not assert current HEAD, never returns the acceptance receipt type, and no acceptance function or adapter may consume its result. `resolveInternalProductionFinalAcceptanceAuthorityV1()` calls the current verifier, not the historical resolver, requires its complete receipt and tracked packet bytes plus both exact current HEAD equalities, and returns that same strict post-handoff receipt under the final-acceptance type alias; it creates no second receipt. The authority explicitly treats `documentationSha` as a metadata-only descendant: `operationalSetfarmSha` and the recorded Mission Control SHA remain the sole accepted `GoldenFinalReleaseEpochV1`. C, D, fleet, and cold need not rerun only while this exact current receipt resolves. Any HEAD drift, dirty/diverged repository, or missing/invalid PR-review-check/six-file/semantic/service/audit/zero/docs-lease-retirement/external relation voids the docs-only exception and requires a new operational epoch rather than weakening or rewriting this receipt.

`recovery-docs-delivery-adapter-v1.ts` is the sole one-way E-to-D integration. `recordRecoveryDocsDeliveryFromFinalClosureV1({campaignHash})` first calls E's exact `resolveInternalProductionFinalAcceptanceAuthorityV1()` and requires its fixed canonical ref/hash plus current clean Setfarm/MC HEAD equalities; it must never call or accept the archival historical resolver. It then resolves the E finalization/input and B completion receipt already bound by that handoff. Only after all E/B relations rehash does it create D's exact production `RecoveryDocsDeliveryAcceptancePortV1` with `createRecoveryDocsDeliveryAcceptancePortV1()` and call `record(...)` once with D's own input shape: campaign, operational-acceptance ref/hash, post-handoff ref/hash, docs-session ref/hash/session hash, and documentation SHA. D derives its own matrix/Markdown hashes. E does not write D's store, redeclare D's receipt, or pass an E receipt object through the boundary; D never imports E. The production function accepts no port/resolver/receipt/hash/path override, while the test-only fixture injects a fake D port and fake E current-acceptance resolver through an unexported constructor.

`recovery-docs-delivery-adapter-v1.test.ts` proves call order `E current final-acceptance resolver -> E finalization/B completion verification -> D port.record`, exact field mapping, one returned D receipt, and idempotent fresh-process resolution while both exact HEADs remain current. Reject use of the historical resolver, Setfarm or Mission Control HEAD drift, dirty/diverged main, unresolved/tampered/cross-campaign post-handoff, wrong operational acceptance, completion/session/documentation/D-byte drift, a D call before E resolution, a second D writer, or any reverse D-to-E import. AST tests require E's unaliased static type/value imports `RecoveryDocsDeliveryAcceptancePortV1`, `RecoveryDocsDeliveryAcceptanceV1`, and `createRecoveryDocsDeliveryAcceptancePortV1` only from `./recovery-docs-delivery-acceptance.js`; D source tests separately ban E imports.

Add:

```json
"acceptance:final-closure-packet": "node --import tsx src/internal-production/final-closure-packet-cli.ts"
```

The exact commands are:

```text
activate-fleet-owner-producer-manifest --json
fleet-owner-producer-manifest-activation-status --json
record-finalizer-output --json
allocate-review-observation --json
record-review --observation-ref setfarm://internal-production/pre-packet-review/inbox/OBSERVATION_ID --json
prepare-input --json
finalize-private --json
materialize-all --finalization-hash SHA256 --json
source-delivery-status --json
rebind-source-services --json
begin-post-handoff --json
execute-post-handoff --json
record-post-handoff --json
verify-current-post-handoff --json
resolve-post-handoff --json
verify-final-acceptance --json
record-recovery-docs-delivery --campaign-hash SHA256 --json
```

The exact list has seventeen commands: the two activation verbs plus the prior fifteen final-closure commands. `activate-fleet-owner-producer-manifest --json` accepts no identity input, fresh-resolves the reviewed clean E source/build, calls A's zero-input current resolver, consumes exact `{head,receipt}`, equality-validates the predecessor `headRef`/`headHash` and receipt pair, and expected-predecessor activates `A+B+C+D+E` with plan counts `[11,10,6,16,9]`, producer count 52 and 35 categories. It then fresh-resolves the A-owned activation receipt/current head and E content-addressed receipt, all of which repeat the predecessor head pair. `fleet-owner-producer-manifest-activation-status --json` is zero-input read-only and returns only absent or that fully revalidated receipt. Crash and response loss adopt byte-identical activation; a stale predecessor head, receipt, count, manifest hash, source, build, activation receipt, or current head fails closed. This activation must complete after reviewed clean merge/build and before source rebind or any E producer, cold, fleet, documentation, or publication work.

`record-finalizer-output` retains the strict B report and fixed-root rules. `rebind-source-services --json` reopens the exact source handoffs, derives the clean epoch, and uses D namespace `source-release-barrier` in fixed service order through the discovery locator, immutable prepared snapshot, zero-input status-driven resolution of only the current observed authority, zero-input resume from any active phase, exact post-resume authorized status and returned-quartet binding, durable atomic current-clear authorization-operation transition, immutable authorization pair, and restart chain; it takes no observer or complete-zero guard. It never opens the stored initial current hash or performs a same-literal locator CAS. It returns a failed source-rebind status/receipt rather than a success receipt when the D envelope fails, and every later fleet/cold/docs command rejects that status. Initial/final checks call A's zero-input census observer directly. Post-handoff commands retain their no-identity-input, fixed-intent, current/historical/final authority rules, and final acceptance requires every TerminalCore/target-set-close/occurrence/head/fence-release/final-envelope/E-reservation-close and A observation relation. No CLI exposes the B root, filesystem observation path, D guard pair, or observer override.

- [ ] **Step 3: Write the exact operator runbook**

Document the source-PR barrier; derivation of Git SHAs/campaign hash/final epoch; the six fleet commands including exact ref/hash-only fresh-shell in-flight recovery and explicit timeout reconciliation; freeze/repair/new-epoch all-ten refresh loop; cumulative stop-after-three; current-and-historical effective cleanup check; cold rehearsal; B's exact no-extra-flag private finalizer with supersessions; independent pre-packet review; exact-operational-base B session materialization inside the authenticated docs claim worktree; packet creation; docs-only PR; A-style post-handoff record/current/historical verification; `verify-final-acceptance`; and clean-main verification. State that historical resolution is archival only, final authority requires the tracked packet plus private receipt and exact current Setfarm documentation/Mission Control operational HEADs, interrupted-run recovery copies neither case nor run into shell variables, and the documentation SHA remains metadata-only only when the receipt proves exact PR/review/check/six-file/semantic/service/audit/zero equality. A byte-affecting docs finding abandons the claim and immutable files; packet-only correction creates fresh review/input/finalization/session/claim, while source/generator correction creates a new C-to-D-to-E epoch. Generated projects are never hand-repaired, and external distribution remains deferred.

- [ ] **Step 4: Run focused verification**

```bash
set -euo pipefail
node --import tsx --test \
  tests/internal-production/fleet-owner-producer-manifest-activation-v1.test.ts \
  tests/internal-production/final-closure-packet-v1.test.ts \
  tests/internal-production/final-closure-packet-cli.test.ts \
  tests/internal-production/final-closure-post-handoff-v1.test.ts \
  tests/internal-production/final-closure-post-handoff-journal-v1.test.ts \
  tests/internal-production/final-closure-post-handoff-restart-coordinator-v1.test.ts \
  tests/internal-production/source-release-service-rebind-v1.test.ts \
  tests/internal-production/recovery-docs-delivery-adapter-v1.test.ts \
  tests/internal-production/golden-fleet-source-boundary.test.ts
npm run test:internal-production
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
git diff --check
```

Expected: PASS. Authorized handoff subject: `feat(ops): add internal closure packet`.

---

Every fresh-process consumer of the completion binding resolves its exact B `receiptRef`/`receiptHash` pair and requires the reopened completion receipt's full `finalReleaseEpoch`, source-build authority ref/hash, matrix/recovery/fleet finalization hashes, independent E `closureFinalizationHash`, and `closureGenerationHash` to equal the binding, finalization, and authenticated pre-render derivation before it may use the session, paths, or contents. The post-handoff recorder applies this check to its frozen intent; operational-SHA-only, epoch-hash-only, generation-hash-only, or source-hash-only equality is insufficient. Completion-binding tests round-trip the source pair, full final epoch, upstream tuple, E finalization, and closure generation through B's strict resolver, E's by-finalization binding, the fixed post-handoff intent, and final receipt, and reject an otherwise byte-identical authority with any mismatched member. Source-boundary tests require all B completion members to be consumed and forbid a reduced local projection.

`createInternalProductionCanonicalRemoteMainObserverV1()` is code-owned and accepts no repository, URL, ref, command, shell, cwd, environment, timeout, parser, expected SHA, or process dependency from a production caller. It creates and reopens one fixed code-owned empty mode-`0700` non-symlink observer directory outside either repository and uses that exact real path as `cwd`; repository cwd, caller cwd, and an inherited `.git` context are forbidden. Before every observation it replaces, rather than extends, the process environment: it drops caller `HOME`/`XDG_CONFIG_HOME`, every inherited `GIT_CONFIG*`, `GIT_SSH*`, `SSH_*`, askpass variable, upper/lowercase proxy variable, `NO_PROXY`, `LANG`, and every `LC_*`; rejects command-line `-c`/URL rewrite input; and installs only a fixed trusted executable search path, an isolated empty HOME/XDG directory, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_TERMINAL_PROMPT=0`, and normalized `LANG=C`/`LC_ALL=C`. No system/global/repository config, `url.*.insteadOf`, credential helper, SSH command, askpass program, proxy, or locale may influence resolution. For each repository it selects the configured canonical remote URL from the fixed production registry and invokes `execFile("git", ["ls-remote","--refs",canonicalRemoteUrl,"refs/heads/main"], {cwd:fixedSafeObserverDirectory,env:normalizedObserverEnvironment,shell:false,timeout:15_000,maxBuffer:4096,encoding:"utf8"})`. It requires a normal exit code `0`, no timeout/signal, empty stderr, bounded stdout, and exactly one complete line matching `^([0-9a-f]{40})\\trefs/heads/main\\n$`; zero records, duplicate/multiple records, another ref, abbreviated/uppercase/nonhex SHA, trailing output, nonzero exit, signal, timeout, or overflow fails closed. The observer hashes the fixed repository identity, canonical-remote identity hash, literal ref, exact SHA, and safe-cwd identity, normalized-environment contract hash, and command-contract version; its pair evidence is deterministic for the same remote heads and contains no clock or caller field.

`begin-post-handoff` obtains this evidence fresh before sealing its fixed intent and requires Setfarm remote main to equal `documentationSha` plus Mission Control remote main to equal `operationalMissionControlSha`. The post-handoff receipt repeats both remote SHAs, observation hashes, and pair `evidenceHash`. `verifyCurrentInternalProductionFinalClosurePostHandoffV1()` and `resolveInternalProductionFinalAcceptanceAuthorityV1()` each invoke a new observer in their own fresh process, require byte-equal remote evidence and exact SHAs in addition to local clean `HEAD === origin/main`, and return no acceptance when either remote moved. Unit tests use a private fake process runner only inside the observer module and cover exact success, zero/multiple/malformed records, nonzero exit, stderr, timeout, signal, output overflow, shell injection, wrong URL/ref, and Setfarm/MC movement. They poison caller cwd plus HOME/XDG, system/global/repository Git config, every `GIT_CONFIG*`, URL rewrite, credential helper, SSH/askpass, upper/lowercase proxy, `NO_PROXY`, and locale variables and prove the fixed safe cwd plus replacement normalized environment yields the same canonical observation; a nonempty/symlink/wrong-mode safe cwd or inherited/extra environment key fails before `git`. Source-boundary tests require `shell:false`, the finite literal argv/timeout/maxBuffer, fixed canonical URL registry, safe-cwd resolver, exact environment allowlist, exact parser, and fresh calls in post-handoff/current/final paths; they reject `exec`, shell strings, caller cwd/environment/remotes/refs/SHAs, cached observation reuse, local `origin/main` as remote authority, or a receipt omitting the two SHAs and evidence hash.

### Task 6: Review and Merge All Source Work Before Live Actions

**Files:**
- Review: all source/tests/catalog/runbook/package changes from Tasks 1-5.
- Review explicitly: `src/internal-production/fleet-owner-producer-manifest-activation-v1.ts` and `tests/internal-production/fleet-owner-producer-manifest-activation-v1.test.ts`; their activation gate cannot be omitted from the E source handoff.
- Verify read-only: D's already merged shared restart authority/helper plus spawner/dashboard/Mission Control startup hooks and tests.
- Exclude: every live result, private receipt, dump, log, screenshot, and final report/packet.

**Interfaces:**
- Consumes: D's already resolved all-three-hook readiness and atomic cutover, their nested one-way A retirement/D activation/epoch-two chain, D's already reviewed/merged/loaded generic Setfarm helper and three startup hooks, both exact D-owned B admission successors, and then Tasks 1-5 E Setfarm source.
- Produces: one reviewed/merged E Setfarm PR, clean synchronized Setfarm/MC build identities, then the fresh expected-predecessor `A+B+C+D` 43 -> `A+B+C+D+E` 52 activation receipt/head/status before any live action or E producer. E creates no Mission Control branch or duplicate startup source.

- [ ] **Step 1: Run focused, adjacent, broad, and secret checks**

```bash
set -euo pipefail
test "$E_SOURCE_WORKTREE" != "$E_SF_ROOT"
cd "$E_SOURCE_WORKTREE"
E_SHELL_TEST_VALUE_005="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_005" = "feat/internal-production-fleet-closure"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
npm run test:internal-production
npm run test:evals
npm run test:evidence
npm run test:execution-attempts
npm run test:product-compiler
npm run test:steps
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
npm run check:migration-digests
npm run check:mission-control-contracts
npm test
npm run build
E_POST_BUILD_STATUS="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_POST_BUILD_STATUS"
E_SOURCE_SCAN_ROOT="$(cd "$E_SOURCE_WORKTREE" && pwd -P)"
readonly E_SOURCE_SCAN_ROOT
E_SHELL_TEST_VALUE_006="$(pwd -P)"
test "$E_SHELL_TEST_VALUE_006" = "$E_SOURCE_SCAN_ROOT"
E_SHELL_TEST_VALUE_007="$(git -C "$E_SOURCE_SCAN_ROOT" rev-parse --show-toplevel)"
test "$E_SHELL_TEST_VALUE_007" = "$E_SOURCE_SCAN_ROOT"
git -C "$E_SOURCE_SCAN_ROOT" diff --check origin/main...HEAD

E_SOURCE_DIFF_CAPTURE="$(mktemp "${TMPDIR:-/tmp}/e-source-diff.XXXXXX")"
readonly E_SOURCE_DIFF_CAPTURE
E_SOURCE_DIFF_DIAGNOSTICS="$(mktemp "${TMPDIR:-/tmp}/e-source-diff-diagnostics.XXXXXX")"
readonly E_SOURCE_DIFF_DIAGNOSTICS
trap 'rm -f -- "$E_SOURCE_DIFF_CAPTURE" "$E_SOURCE_DIFF_DIAGNOSTICS"' EXIT
if git -C "$E_SOURCE_SCAN_ROOT" diff --no-ext-diff origin/main...HEAD >"$E_SOURCE_DIFF_CAPTURE" 2>"$E_SOURCE_DIFF_DIAGNOSTICS"; then
  E_SOURCE_DIFF_STATUS=0
else
  E_SOURCE_DIFF_STATUS=$?
fi
if test "$E_SOURCE_DIFF_STATUS" -ne 0 || test -s "$E_SOURCE_DIFF_DIAGNOSTICS"; then
  printf 'Setfarm fleet source diff capture failed closed\n' >&2
  exit 1
fi

if E_SOURCE_SECRET_SCAN_OUTPUT="$(rg --no-heading --color never -n -e 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY' -e 'sk-[A-Za-z0-9_-]{20,}' -e 'gh[pousr]_[A-Za-z0-9]{20,}' -e 'postgres(?:ql)?://[^[:space:]]+:[^[:space:]@]+@' -- "$E_SOURCE_DIFF_CAPTURE" 2>&1)"; then
  E_SOURCE_SECRET_SCAN_STATUS=0
else
  E_SOURCE_SECRET_SCAN_STATUS=$?
fi
case "$E_SOURCE_SECRET_SCAN_STATUS" in
  0)
    printf 'Setfarm fleet source secret scan matched forbidden bytes\n' >&2
    exit 1
    ;;
  1)
    if test -n "$E_SOURCE_SECRET_SCAN_OUTPUT"; then
      printf 'Setfarm fleet source secret scan returned output with no-match status\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'Setfarm fleet source secret scan failed with status %s\n' "$E_SOURCE_SECRET_SCAN_STATUS" >&2
    exit "$E_SOURCE_SECRET_SCAN_STATUS"
    ;;
esac
```

Expected: every positive command exits `0`; the committed `origin/main...HEAD` delta contains source, tests, the one raw campaign, runbook, and package wiring only. The standalone post-build full tracked/untracked porcelain capture must be empty immediately before the diff/secret evidence path. The exact-root diff capture must return status `0` with empty diagnostics before the separate secret scan runs; that scan accepts only no-match status `1` with empty captured output. Transcript/source tests inject tracked and untracked dirt after the long test/build sequence and prove neither diff capture, secret scan, nor handoff runs. They also inject `rg` statuses `0`, `1`, `2`, and `127`, status-`1` nonempty output, and upstream `git diff` failure; every condition except status-`1` empty output fails closed, and upstream failure proves `rg` is never invoked. An empty worktree diff is not evidence for the committed source branch.

- [ ] **Step 2: Obtain independent source review**

Use `requesting-code-review`. Resolve every actionable Critical, High, and Medium finding with a failing regression first. Repeat Step 1 after fixes.

- [ ] **Step 3: Report the reviewed source handoff to the Setfarm delivery owner**

From the one active assigned Setfarm worktree, read-only verify the owner-completed scoped commits and return the review/build receipts plus this exact PR metadata:

```bash
set -euo pipefail
E_SHELL_TEST_VALUE_008="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_008" = "feat/internal-production-fleet-closure"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD
```

PR metadata is fixed: repository `hikmetgulsesli/setfarm`; base `main`; head `feat/internal-production-fleet-closure`; title `feat(acceptance): close internal production fleet`; body `Adds the B-owned bounded fleet policy, one raw B campaign, C assertion gateway, hash-only scheduler, resumable cold rehearsal, reference-only closure writer, focused tests, and operator runbook. It includes no live evidence and leaves external distribution blocked.` Only the Setfarm delivery owner stages any approved residual, commits, pushes, opens the PR, and later merges/deletes the branch after checks and independent review are clear. Workers use read-only `gh pr view/checks`, resolve findings test-first, and report each repair scope back to that owner for Git handoff.

- [ ] **Step 4: Merge and synchronize the Setfarm producer before Mission Control writing begins**

The Setfarm delivery owner alone pushes, opens/updates the fixed PR, waits for required checks and independent review, squash-merges it, deletes its branch, cleans the assigned worktree/claim, and returns the durable handoff receipt. In the canonical read-only checkout require:

```bash
set -euo pipefail
cd "$E_SF_ROOT"
E_SHELL_TEST_VALUE_009="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_009" = "main"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_010="$(git rev-parse HEAD)"
E_SHELL_TEST_VALUE_011="$(git rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_010" = "$E_SHELL_TEST_VALUE_011"
E_SETFARM_PRODUCER_SHA="$(git rev-parse HEAD)"
readonly E_SETFARM_PRODUCER_SHA
```

Expected: the handoff receipt, `HEAD`, and `origin/main` identify the same reviewed E Setfarm merge whose base already contains D's shared authority/helper. There is now no Setfarm writing branch or writing claim. Mission Control remains clean at D's already reviewed generic startup-consumer merge.

- [ ] **Step 5: Verify D's loaded-hook readiness, atomic cutover, B successors, and generic Mission Control startup consumer**

Do not allocate or write either repository. From clean synchronized Setfarm `main`, first resolve D's exact `InternalProductionServiceRestartStartupHooksReadyV1` and `InternalProductionServiceRestartAuthorityCutoverV1` pairs, then their nested A retirement/D activation/epoch-two authorities and both D source handoff receipts. Require readiness to bind the currently loaded spawner/dashboard/Mission Control hook implementation hashes and exact source/build pair under predecessor epoch one; require the cutover's sole visibility CAS to bind that same readiness plus A's freshly resolved read-only complete zero-owner census observation and indivisible retirement/activation successor. Also require the exact B activation-controller/test tree containing both `createOrResumeSetfarmCompletionOwnerReceiptProducerDOrdinaryStartAdmissionV1` and `createOrResumeSetfarmCompletionOwnerReceiptProducerDManagedRestartAdmissionV1`. Then, from clean synchronized Mission Control `main`, prove D's generic consumer exists and is ordered before ownership:

```text
server/services/internal-production-service-restart-startup-v1.ts
server/services/internal-production-service-restart-startup-v1.test.ts
server/index.ts
```

The adapter was delivered by D, invokes the merged D generic startup-claim protocol with `execFile`/`shell:false`, accepts only bounded strict path-free JSON, and is awaited before any Mission Control database/background/listener ownership. Run its focused test and full read-only verification:

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/mission-control
E_SHELL_TEST_VALUE_012="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_012" = "main"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_013="$(git rev-parse HEAD)"
E_SHELL_TEST_VALUE_014="$(git rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_013" = "$E_SHELL_TEST_VALUE_014"
node --import tsx --test server/services/internal-production-service-restart-startup-v1.test.ts
npm run check:setfarm-contract
npm test
npm run build
rg -n 'internal-production-service-restart-startup-v1' server/index.ts
```

Save `E_MISSION_CONTROL_CONSUMER_SHA` from this clean main and require it to equal D's durable helper-consumer handoff. Any missing/drifted readiness/cutover/retirement/activation, B branch/function, loaded hook/source/build, or hook ordering returns to D's serialized source repair workflow; E never patches or replaces it. Prove no active writing branch remains in either repository.

- [ ] **Step 6: Establish the clean-main live barrier after D's helper/consumer and E's source merge**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$E_SF_ROOT"
E_SHELL_TEST_VALUE_015="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_015" = "main"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_016="$(git rev-parse HEAD)"
E_SHELL_TEST_VALUE_017="$(git rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_016" = "$E_SHELL_TEST_VALUE_017"
E_SHELL_TEST_VALUE_018="$(git -C /Users/setrox/ai/setrox/mission-control branch --show-current)"
test "$E_SHELL_TEST_VALUE_018" = "main"
E_SHELL_GUARD_OUTPUT="$(git -C /Users/setrox/ai/setrox/mission-control status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_019="$(git -C /Users/setrox/ai/setrox/mission-control rev-parse HEAD)"
E_SHELL_TEST_VALUE_020="$(git -C /Users/setrox/ai/setrox/mission-control rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_019" = "$E_SHELL_TEST_VALUE_020"
require_authenticated_clean_main_setfarm_root_v1
npm ci
require_authenticated_clean_main_setfarm_root_v1
npm run build
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:verify
require_authenticated_clean_main_setfarm_root_v1
npm run db:contract-spine:audit-current-authority-ledgers
git -C /Users/setrox/ai/setrox/mission-control clean -ndX >/dev/null
require_authenticated_clean_main_setfarm_root_v1
(cd /Users/setrox/ai/setrox/mission-control && npm ci && npm run build && npm test)

require_authenticated_clean_main_setfarm_root_v1
E_FLEET_MANIFEST_ACTIVATION="$(npm run --silent acceptance:final-closure-packet -- activate-fleet-owner-producer-manifest --json)"
printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION" | jq -e '
  .schema == "setfarm.internal-production-fleet-owner-producer-manifest-activation.v1" and
  .phase == "A+B+C+D+E" and
  .predecessorPhase == "A+B+C+D" and
  .predecessorProducerCount == 43 and
  (.predecessorActivationHeadRef | startswith("setfarm://internal-production/")) and
  (.predecessorActivationHeadHash | test("^[0-9a-f]{64}$")) and
  .orderedPlans == ["A","B","C","D","E"] and
  .planProducerCounts == [11,10,6,16,9] and
  .producerCount == 52 and
  (.receiptRef | startswith("setfarm://internal-production/")) and
  (.receiptHash | test("^[0-9a-f]{64}$")) and
  (.activationRef | startswith("setfarm://internal-production/")) and
  (.activationHash | test("^[0-9a-f]{64}$")) and
  (.activationHeadRef | startswith("setfarm://internal-production/")) and
  (.activationHeadHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
E_FLEET_MANIFEST_ACTIVATION_STATUS="$(npm run --silent acceptance:final-closure-packet -- fleet-owner-producer-manifest-activation-status --json)"
E_FLEET_MANIFEST_ACTIVATION_RECEIPT_REF="$(printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION" | jq -er '.receiptRef')"
E_FLEET_MANIFEST_ACTIVATION_RECEIPT_HASH="$(printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION" | jq -er '.receiptHash')"
E_FLEET_MANIFEST_ACTIVATION_REF="$(printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION" | jq -er '.activationRef')"
E_FLEET_MANIFEST_ACTIVATION_HASH="$(printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION" | jq -er '.activationHash')"
E_FLEET_MANIFEST_ACTIVATION_HEAD_REF="$(printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION" | jq -er '.activationHeadRef')"
E_FLEET_MANIFEST_ACTIVATION_HEAD_HASH="$(printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION" | jq -er '.activationHeadHash')"
printf '%s\n' "$E_FLEET_MANIFEST_ACTIVATION_STATUS" | jq -e \
  --arg receiptRef "$E_FLEET_MANIFEST_ACTIVATION_RECEIPT_REF" \
  --arg receiptHash "$E_FLEET_MANIFEST_ACTIVATION_RECEIPT_HASH" \
  --arg activationRef "$E_FLEET_MANIFEST_ACTIVATION_REF" \
  --arg activationHash "$E_FLEET_MANIFEST_ACTIVATION_HASH" \
  --arg activationHeadRef "$E_FLEET_MANIFEST_ACTIVATION_HEAD_REF" \
  --arg activationHeadHash "$E_FLEET_MANIFEST_ACTIVATION_HEAD_HASH" '
  .status == "activated" and
  .receipt.receiptRef == $receiptRef and
  .receipt.receiptHash == $receiptHash and
  .receipt.activationRef == $activationRef and
  .receipt.activationHash == $activationHash and
  .receipt.activationHeadRef == $activationHeadRef and
  .receipt.activationHeadHash == $activationHeadHash and
  .receipt.predecessorProducerCount == 43 and
  (.receipt.predecessorActivationHeadRef | startswith("setfarm://internal-production/")) and
  (.receipt.predecessorActivationHeadHash | test("^[0-9a-f]{64}$")) and
  .receipt.producerCount == 52 and
  .receipt.planProducerCounts == [11,10,6,16,9]
' >/dev/null

require_authenticated_clean_main_setfarm_root_v1
E_SOURCE_DELIVERY_STATUS="$(npm run --silent acceptance:final-closure-packet -- source-delivery-status --json)"
E_DURABLE_SETFARM_HANDOFF_SHA="$(printf '%s\n' "$E_SOURCE_DELIVERY_STATUS" | jq -er '.setfarm.mergeSha')"
E_DURABLE_MC_HANDOFF_SHA="$(printf '%s\n' "$E_SOURCE_DELIVERY_STATUS" | jq -er '.missionControl.mergeSha')"
E_POSTBUILD_SF_BRANCH="$(git -C "$E_SF_ROOT" branch --show-current)"
test "$E_POSTBUILD_SF_BRANCH" = "main"
E_POSTBUILD_SF_STATUS="$(git -C "$E_SF_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_POSTBUILD_SF_STATUS"
E_POSTBUILD_SF_HEAD="$(git -C "$E_SF_ROOT" rev-parse HEAD)"
E_POSTBUILD_SF_ORIGIN="$(git -C "$E_SF_ROOT" rev-parse refs/remotes/origin/main)"
test "$E_POSTBUILD_SF_HEAD" = "$E_POSTBUILD_SF_ORIGIN"
test "$E_POSTBUILD_SF_HEAD" = "$E_DURABLE_SETFARM_HANDOFF_SHA"
E_POSTBUILD_MC_BRANCH="$(git -C /Users/setrox/ai/setrox/mission-control branch --show-current)"
test "$E_POSTBUILD_MC_BRANCH" = "main"
E_POSTBUILD_MC_STATUS="$(git -C /Users/setrox/ai/setrox/mission-control status --porcelain=v1 --untracked-files=all)"
test -z "$E_POSTBUILD_MC_STATUS"
E_POSTBUILD_MC_HEAD="$(git -C /Users/setrox/ai/setrox/mission-control rev-parse HEAD)"
E_POSTBUILD_MC_ORIGIN="$(git -C /Users/setrox/ai/setrox/mission-control rev-parse refs/remotes/origin/main)"
test "$E_POSTBUILD_MC_HEAD" = "$E_POSTBUILD_MC_ORIGIN"
test "$E_POSTBUILD_MC_HEAD" = "$E_DURABLE_MC_HANDOFF_SHA"
E_FINAL_SETfarm_SHA="$E_POSTBUILD_SF_HEAD"
readonly E_FINAL_SETfarm_SHA
E_FINAL_MC_SHA="$E_POSTBUILD_MC_HEAD"
readonly E_FINAL_MC_SHA
require_authenticated_clean_main_setfarm_root_v1
E_SOURCE_REBIND="$(npm run --silent acceptance:final-closure-packet -- rebind-source-services --json)"
printf '%s\n' "$E_SOURCE_REBIND" | jq -e \
  --arg sf "$E_FINAL_SETfarm_SHA" --arg mc "$E_FINAL_MC_SHA" '
  .schema == "setfarm.internal-production-source-release-service-rebind.v1" and
  .namespace == "source-release-barrier" and
  .finalReleaseEpoch.setfarmSha == $sf and
  .finalReleaseEpoch.missionControlSha == $mc and
  (.orderedRestarts | map(.service)) == ["setfarm-spawner","setfarm-dashboard","mission-control"] and
  (.orderedRestarts | all(
    .namespace == "source-release-barrier" and
    (.coordinatorReservationRef | startswith("setfarm://internal-production/")) and
    (.coordinatorReservationHash | test("^[0-9a-f]{64}$")) and
    (.coordinatorReservationCloseRef | startswith("setfarm://internal-production/")) and
    (.coordinatorReservationCloseHash | test("^[0-9a-f]{64}$")) and
    (.authorizationOperationRef | startswith("setfarm://internal-production/")) and
    (.authorizationOperationHash | test("^[0-9a-f]{64}$")) and
    (.authorizationRef | startswith("setfarm://internal-production/")) and
    (.authorizationHash | test("^[0-9a-f]{64}$")) and
    (.operationRef | startswith("setfarm://internal-production/")) and
    (.operationHash | test("^[0-9a-f]{64}$")) and
    (.terminalCoreRef | startswith("setfarm://internal-production/")) and
    (.terminalCoreHash | test("^[0-9a-f]{64}$")) and
    (.targetSetCloseRef | startswith("setfarm://internal-production/")) and
    (.targetSetCloseHash | test("^[0-9a-f]{64}$")) and
    (.occurrenceRef | startswith("setfarm://internal-production/")) and
    (.occurrenceHash | test("^[0-9a-f]{64}$")) and
    (.namespaceServiceHeadRef | startswith("setfarm://internal-production/")) and
    (.namespaceServiceHeadHash | test("^[0-9a-f]{64}$")) and
    (.ownerAdmissionFenceReleaseRef | startswith("setfarm://internal-production/")) and
    (.ownerAdmissionFenceReleaseHash | test("^[0-9a-f]{64}$")) and
    .terminalKind == "complete" and
    .terminalCoreDispositionKind == "complete" and
    .occurrenceTerminalDisposition == "complete" and
    .finalEnvelopeKind == "complete" and
    (.completionRef | startswith("setfarm://internal-production/")) and
    (.completionHash | test("^[0-9a-f]{64}$")) and
    .failureRef == null and .failureHash == null and
    (.beforeGenerationHash | test("^[0-9a-f]{64}$")) and
    (.afterGenerationHash | test("^[0-9a-f]{64}$")) and
    .afterGenerationHash != .beforeGenerationHash and
    .generationChanged == true and
    (.finalEnvelopeRef | startswith("setfarm://internal-production/")) and
    (.finalEnvelopeHash | test("^[0-9a-f]{64}$")) and
    (.eRestartPhaseTerminalCoreRef | startswith("setfarm://internal-production/")) and
    (.eRestartPhaseTerminalCoreHash | test("^[0-9a-f]{64}$"))
  )) and
  (.finalZeroOwnerCensusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:baseline-post-handoff -- runtime-source \
  --setfarm-sha "$E_FINAL_SETfarm_SHA" \
  --mission-control-sha "$E_FINAL_MC_SHA" \
  --json
```

Expected: after D's helper/consumer handoffs and E's serialized Setfarm delivery owner report their merges, both repositories are clean synchronized `main`; both complete long build/test chains pass; the activation controller fresh-resolves A's exact `{head,receipt}` ABCD43 predecessor, activates and re-resolves ABCDE52 plus status, and only then may any source-rebind or other E work begin. The immediately following contiguous post-build gate freshly resolves the two durable owner handoffs, requires both literal `main` branches, captures both full tracked/untracked porcelain outputs separately and requires them empty, and proves each `HEAD === refs/remotes/origin/main === durable owner handoff mergeSha` before either final SHA is assigned or `rebind-source-services` runs. The complete census is zero immediately before every mutation, and the three loaded internal services prove the exact final operational Setfarm/Mission Control source pair including D's merged generic startup hook. Transcript tests inject crash/response loss around activation and failure into each predecessor head/receipt/count/hash/source/build/activation receipt/current-head/status relation, post-build handoff resolver, branch/ref command, equality predicate, and tracked or untracked dirt observation independently; they prove no source delivery, rebind, E reservation, fleet/cold/docs operation, final SHA capture, or runtime-source evidence follows. The worker does not switch or pull. Do not execute C's matrix, D recovery, the fleet, or cold rehearsal before these merges and this barrier. Every later reviewed Setfarm/MC repair must repeat the same serialized delivery when applicable, full clean build, post-build two-repository owner-handoff gate, guarded three-service rebind, and exact runtime-source check before a successor epoch starts.

---

### Task 7: Execute and Settle the Ten-Case Fleet

**Files:**
- Write private only below B `resolveInternalProductionDataRootV1()`: B `golden-results`, E `golden-fleet`, and C assertion artifacts.
- Do not write tracked documentation in this task.

**Interfaces:**
- Consumes: clean-main SHAs, B's exact `GoldenLaunchOperationMigrationCurrentVerificationV1` and zero-input `verifyCurrentGoldenLaunchOperationMigrationV1()` from `./golden-launch-operation-migration-release-v1.js`, and the reviewed raw B campaign.
- Produces: ten exact current-final-epoch B results, any retained historical-epoch B results, plus one accepted or blocked content-addressed fleet status bound to B `epochHash`.

- [ ] **Step 0: Require the ordered matrix and private recovery finalizations on this exact release pair**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
readonly E_SF_ROOT="$SETFARM_ROOT"
readonly E_MC_ROOT=/Users/setrox/ai/setrox/mission-control
readonly E_MATRIX="$E_SF_ROOT/evals/suites/internal-production-golden-matrix-v1.json"
E_SETFARM_SHA="$(git -C "$E_SF_ROOT" rev-parse HEAD)"
readonly E_SETFARM_SHA
E_MISSION_CONTROL_SHA="$(git -C "$E_MC_ROOT" rev-parse HEAD)"
readonly E_MISSION_CONTROL_SHA
E_SHELL_GUARD_OUTPUT="$(git -C "$E_SF_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_GUARD_OUTPUT="$(git -C "$E_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
cd "$E_SF_ROOT"
require_authenticated_clean_main_setfarm_root_v1
E_LAUNCH_MIGRATION_VERIFICATION="$(node dist/internal-production/golden-run-cli.js \
  verify-launch-operation-migration --json)"
printf '%s\n' "$E_LAUNCH_MIGRATION_VERIFICATION" | jq -e \
  --arg currentSha "$E_SETFARM_SHA" '
  .schema == "setfarm.internal-production-golden-launch-operation-migration-current-verification.v1" and
  .currentSourceSha == $currentSha and
  (.applicationSourceSha | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.receiptRef | type == "string") and
  (.receiptHash | test("^[0-9a-f]{64}$")) and
  (.migrationModuleBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.migrationStatementsHash | test("^[0-9a-f]{64}$")) and
  (.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
  (.schemaProjectionHash | test("^[0-9a-f]{64}$")) and
  (.verificationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
E_MATRIX_STATUS="$(npm run --silent internal:golden-matrix -- status \
  --matrix "$E_MATRIX" \
  --release-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
printf '%s\n' "$E_MATRIX_STATUS" | jq -e \
  --arg sf "$E_SETFARM_SHA" --arg mc "$E_MISSION_CONTROL_SHA" '
  .decision == "accepted" and
  (.matrixReceiptRef | type == "string" and startswith("setfarm://internal-production/")) and
  (.matrixReceiptHash | type == "string" and test("^[0-9a-f]{64}$")) and
  .finalReleaseEpoch.schema == "setfarm.internal-production-final-release-epoch.v1" and
  .finalReleaseEpoch.setfarmSha == $sf and
  .finalReleaseEpoch.missionControlSha == $mc and
  (.finalReleaseEpoch.epochHash | type == "string" and test("^[0-9a-f]{64}$")) and
  (.orderedResultHashes | type == "array" and length >= 10 and length <= 64)
' >/dev/null
E_MATRIX_RECEIPT_REF="$(printf '%s\n' "$E_MATRIX_STATUS" | jq -er '.matrixReceiptRef')"
E_MATRIX_RECEIPT_HASH="$(printf '%s\n' "$E_MATRIX_STATUS" | jq -er '.matrixReceiptHash')"
require_authenticated_clean_main_setfarm_root_v1
E_MATRIX_FINALIZATION="$(npm run --silent internal:golden-matrix -- finalization-status \
  --matrix "$E_MATRIX" \
  --json)"
printf '%s\n' "$E_MATRIX_FINALIZATION" | jq -e \
  --arg sf "$E_SETFARM_SHA" --arg mc "$E_MISSION_CONTROL_SHA" \
  --arg receiptRef "$E_MATRIX_RECEIPT_REF" --arg receiptHash "$E_MATRIX_RECEIPT_HASH" '
  .schema == "setfarm.internal-production-golden-matrix-finalization-pointer.v1" and
  .matrixReceiptRef == $receiptRef and
  .matrixReceiptHash == $receiptHash and
  .finalReleaseEpoch.schema == "setfarm.internal-production-final-release-epoch.v1" and
  .finalReleaseEpoch.setfarmSha == $sf and
  .finalReleaseEpoch.missionControlSha == $mc and
  (.finalReleaseEpoch.epochHash | type == "string" and test("^[0-9a-f]{64}$")) and
  (.finalizationHash | type == "string" and test("^[0-9a-f]{64}$")) and
  (.finalizerOutputHash | type == "string" and test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
E_D_CONTROL="$(npm run --silent acceptance:recovery -- control-value --name recovery-campaign-hash --json)"
E_D_CAMPAIGN_HASH="$(printf '%s\n' "$E_D_CONTROL" | jq -er '
  select(.schema == "setfarm.internal-production-recovery-control-value.v1") |
  select(.name == "recovery-campaign-hash") | .value
')"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:recovery -- verify-campaign --campaign-hash "$E_D_CAMPAIGN_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:recovery -- verify-browser-acceptance --campaign-hash "$E_D_CAMPAIGN_HASH"
require_authenticated_clean_main_setfarm_root_v1
E_D_FINALIZATION="$(npm run --silent acceptance:recovery -- finalize-packet \
  --campaign-hash "$E_D_CAMPAIGN_HASH" \
  --setfarm-source-sha "$E_SETFARM_SHA" \
  --mission-control-source-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
printf '%s\n' "$E_D_FINALIZATION" | jq -e \
  --arg sf "$E_SETFARM_SHA" --arg mc "$E_MISSION_CONTROL_SHA" '
  .schema == "setfarm.internal-production-recovery-finalized-packet.v1" and
  .setfarmSourceSha == $sf and
  .missionControlSourceSha == $mc and
  (.finalizationHash | type == "string" and test("^[0-9a-f]{64}$")) and
  (.recoveryMatrixMarkdownHash | type == "string" and test("^[0-9a-f]{64}$")) and
  (.recoveryReconciliationMarkdownHash | type == "string" and test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
E_D_OPERATIONAL_ACCEPTANCE="$(npm run --silent acceptance:recovery -- \
  record-operational-acceptance --campaign-hash "$E_D_CAMPAIGN_HASH" --json)"
E_D_OPERATIONAL_ACCEPTANCE_REF="$(printf '%s\n' "$E_D_OPERATIONAL_ACCEPTANCE" | jq -er '.acceptanceRef')"
E_D_OPERATIONAL_ACCEPTANCE_HASH="$(printf '%s\n' "$E_D_OPERATIONAL_ACCEPTANCE" | jq -er '.acceptanceHash')"
E_D_FINALIZATION_REF="$(printf '%s\n' "$E_D_FINALIZATION" | jq -er '.finalizationRef')"
E_D_FINALIZATION_HASH="$(printf '%s\n' "$E_D_FINALIZATION" | jq -er '.finalizationHash')"
printf '%s\n' "$E_D_OPERATIONAL_ACCEPTANCE" | jq -e \
  --arg ref "$E_D_FINALIZATION_REF" \
  --arg hash "$E_D_FINALIZATION_HASH" '
  .schema == "setfarm.internal-production-recovery-operational-acceptance.v1" and
  .finalizationRef == $ref and .finalizationHash == $hash and
  (.acceptanceRef | startswith("setfarm://internal-production/recovery/operational-acceptances/sha256/")) and
  (.acceptanceHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:recovery -- verify-operational-acceptance \
  --acceptance-ref "$E_D_OPERATIONAL_ACCEPTANCE_REF" \
  --acceptance-hash "$E_D_OPERATIONAL_ACCEPTANCE_HASH" --json
E_SHELL_TEST_VALUE_021="$(git -C "$E_SF_ROOT" branch --show-current)"
test "$E_SHELL_TEST_VALUE_021" = "main"
E_SHELL_TEST_VALUE_022="$(git -C "$E_SF_ROOT" rev-parse HEAD)"
E_SHELL_TEST_VALUE_023="$(git -C "$E_SF_ROOT" rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_022" = "$E_SHELL_TEST_VALUE_023"
```

Before any fleet status transition or case mutation, B's exact zero-input current verifier freshly resolves the immutable terminal launch-migration release, proves the clean canonical `E_SETFARM_SHA` descends from its application source, and equality-checks the dedicated B migration module, ordered statements, named digest entry, digest, and schema projection. A strict E descendant passes and unrelated append-only aggregate registry/digest entries remain valid; a nonancestor, changed B named module/entry/projection, corrupt terminal pair, or absent verification starts no fleet case. The strict matrix status is B/C's ordered ten-slot acceptance: Profiles 1–3 have two accepted current-epoch results and Profiles 4–7 have one, all on the exact current Setfarm/Mission Control pair. `orderedResultHashes` retains failed, repaired, timeout-reconciled, and historical attempts and may therefore exceed ten; C's strict parser has recomputed the nested `finalReleaseEpoch.epochHash`, and the validated `decision:"accepted"`, exact nested release pair, canonical `matrixReceiptRef`/`matrixReceiptHash`, bounded history, and private B finalization pointer prove the slots and report bytes. The pointer repeats the exact status ref/hash and C's resolver must return that same strict receipt; a pointer-only ref or independently selected status ref is invalid. Root-level `releaseSha` or `missionControlSha` is never a C authority field. D verification resolves all ten selected recovery attempts, its browser/restart evidence, and its private finalized packet on that same exact epoch, then the named `RecoveryOperationalAcceptanceV1` seals those operational authorities without reading any E docs state. E consumes that ref/hash before starting a fleet case. No C or D tracked report exists yet. A missing, blocked, dirty, invalid, prior-epoch, unreviewed operational gate, or unmerged barrier starts no fleet case. Task 8 repeats these private barriers before cold mutation; it is not the first gate.

- [ ] **Step 1: Derive and validate live identities**

Reuse the read-only roots and source identities established in Step 0 in the same operator shell:

```bash
set -euo pipefail
readonly E_CAMPAIGN="$E_SF_ROOT/evals/suites/internal-production-golden-fleet-v1.json"
E_SHELL_GUARD_OUTPUT="$(git -C "$E_SF_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_GUARD_OUTPUT="$(git -C "$E_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_024="$(jq -er '.campaignId' "$E_CAMPAIGN")"
test "$E_SHELL_TEST_VALUE_024" = "internal-production-fleet-2026-08-14"
E_SHELL_TEST_VALUE_025="$(jq -er '.cases | length' "$E_CAMPAIGN")"
test "$E_SHELL_TEST_VALUE_025" = "10"
```

- [ ] **Step 2: Preflight and execute one successor per invocation**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$E_SF_ROOT"
require_authenticated_clean_main_setfarm_root_v1
E_FLEET_PREFLIGHT_GUARD="$(npm run --silent internal:golden -- fleet-preflight \
  --campaign "$E_CAMPAIGN" \
  --release-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
E_FLEET_PREFLIGHT_GUARD_REF="$(printf '%s\n' "$E_FLEET_PREFLIGHT_GUARD" | jq -er '.guardRef')"
E_FLEET_PREFLIGHT_GUARD_HASH="$(printf '%s\n' "$E_FLEET_PREFLIGHT_GUARD" | jq -er '.guardHash')"
require_authenticated_clean_main_setfarm_root_v1
npm run internal:golden -- fleet-execute-next \
  --campaign "$E_CAMPAIGN" \
  --release-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --preflight-guard-ref "$E_FLEET_PREFLIGHT_GUARD_REF" \
  --preflight-guard-hash "$E_FLEET_PREFLIGHT_GUARD_HASH" \
  --json
```

The guard capture and consuming execute are one fail-fast block; no command may intervene. After every returned result, run `fleet-status` with the same three identity flags. If the operator process is interrupted after launch authority exists, start a new shell, rerun Task 7 Step 0 in full, then rerun Step 1 before any recovery command; do not reuse the guard or exported case/run/release values from the dead shell and do not call `fleet-execute-next`. Capture the newly reopened current status, select its exact in-flight canonical ref/hash (never its case/run), and invoke only:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
E_A_POST_REBIND_JSON="$(npm run --silent acceptance:baseline-post-handoff -- verify-post-rebind-entry --json)"
require_authenticated_clean_main_setfarm_root_v1
E_FLEET_STATUS_JSON="$(npm run --silent internal:golden -- fleet-status \
  --campaign "$E_CAMPAIGN" \
  --release-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
test "$(printf '%s\n' "$E_FLEET_STATUS_JSON" | jq -er '.postRebindEntryAuthorityRef')" = \
  "$(printf '%s\n' "$E_A_POST_REBIND_JSON" | jq -er '.postRebindEntryAuthorityRef')"
test "$(printf '%s\n' "$E_FLEET_STATUS_JSON" | jq -er '.postRebindEntryAuthorityHash')" = \
  "$(printf '%s\n' "$E_A_POST_REBIND_JSON" | jq -er '.postRebindEntryAuthorityHash')"
E_FLEET_CAMPAIGN_HASH="$(printf '%s' "$E_FLEET_STATUS_JSON" | jq -er '.campaignHash')"
E_INFLIGHT_REF="$(printf '%s' "$E_FLEET_STATUS_JSON" | jq -er '.inflight[0].inflightRef')"
E_INFLIGHT_HASH="$(printf '%s' "$E_FLEET_STATUS_JSON" | jq -er '.inflight[0].inflightHash')"
require_authenticated_clean_main_setfarm_root_v1
npm run internal:golden -- fleet-recover-inflight \
  --campaign-hash "$E_FLEET_CAMPAIGN_HASH" \
  --inflight-ref "$E_INFLIGHT_REF" \
  --inflight-hash "$E_INFLIGHT_HASH" \
  --json
```

The command derives the case, repetition, and full final epoch only from the resolved immutable staged member/current status; no run identity is present in or accepted beside that E member. C derives any internal run binding from its own staged authority. If status reports `FLEET_TIMEOUT_RECONCILIATION_REQUIRED`, repeatedly invoke `fleet-reconcile-timeouts` with only the campaign and exact SHA pair until B either publishes the same-run terminal result plus supersession or confirms that exact run remains nonterminal; never start another case while unresolved. Reload `fleet-status` after each reconciliation. Continue only when B's effective projection has no unresolved timeout and reports no Setfarm/MC failure. After five clean effective terminal results, the status may report eligible concurrency two, but each command still starts at most one case and B admission remains authoritative.

- [ ] **Step 3: Apply the bounded repair loop**

On an allowed generated-product/provider/infrastructure nonacceptance, retain the immutable result but do not continue to another current-epoch case yet. The result-settling status must show `pendingReviewAcknowledgement` and `FLEET_NONACCEPTED_REVIEW_ACKNOWLEDGEMENT_REQUIRED`. Record C's strict `GoldenRepairReviewReceiptV1` through its exact `record-generated` or `record-external` form, which causes C to persist the corresponding immutable `GoldenNonacceptedResultReviewAcknowledgementV1`. Then run `fleet-acknowledge-review` with only campaign and exact SHA pair; E locates the acknowledgement from the fixed repair receipt, resolves/rehashes it, and clears pending by status CAS. Only after a reloaded status proves the exact acknowledgement hash consumed may the next case reach C `stage`. Exactly two acknowledged allowed nonaccepted current-epoch results are permitted. The third result atomically persists its pending acknowledgement but has allowance-overflow precedence: status is immediately `incomplete`, never `frozen`, and starts nothing. Its acknowledgement is still mandatory evidence; after the exact acknowledgement is consumed and the pending member clears, status remains `incomplete` and scheduling stays closed. Historical allowed failures and their acknowledgements remain evidence but do not consume the final epoch's allowance.

On a systemic Setfarm/MC result, freeze this same campaign and resolve the B result hash. Open one owning Setfarm root-fix claim with that immutable evidence; its owner alone allocates the scoped writing branch/worktree and performs Git handoff. The implementation worker adds a failing regression and the smallest repair, reports focused/broad/review gates to the owner, and never stages, commits, pushes, or opens/merges a PR. After the owner delivers the reviewed repair and returns clean synchronized `main`, record C's exact campaign-scope `GoldenRepairReviewReceiptV1` with the failed result/root, merged repair, independent review, focused/broad checks, clean build, and new clean-main SHAs. Re-run `fleet-status`; only C's indexed receipt may authorize B `createGoldenFinalReleaseEpochV1(...)` for the new pair. Run the repaired case first, then obtain fresh results for the other nine cases in that same epoch. Never revive, relabel, omit, edit, or replace the failed generated repository/result. Retain every B result and root occurrence in the same campaign. If a later epoch repeats the systemic root, repeat the reviewed repair/epoch process; the third cumulative validated occurrence settles B `blocked`. Fewer than three historical systemic occurrences do not themselves obstruct a clean final epoch from completing, but they remain visible cleanup/root-cause evidence. Starting a new versioned campaign is an explicit separately reviewed operator decision after this campaign reaches its honest terminal outcome, not a way to erase occurrences.

Use C's exact observer and writer; never manufacture verification hashes in the shell. Substitute only values resolved from the immutable failed B result and the owning repository's merged PR receipt:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
E_REPAIR_BUNDLE_JSON="$(npm run --silent internal:golden-repair-review -- observe-repair \
  --campaign "$E_CAMPAIGN" \
  --case "$E_FAILED_CASE_ID" \
  --failed-result-hash "$E_FAILED_RESULT_HASH" \
  --owning-repository "$E_REPAIR_OWNER" \
  --pull-request "$E_REPAIR_PR_URL" \
  --merge-sha "$E_REPAIR_MERGE_SHA" \
  --json)"
E_INDEPENDENT_REVIEW_HASH="$(printf '%s\n' "$E_REPAIR_BUNDLE_JSON" | jq -er '.independentReviewHash')"
E_FOCUSED_VERIFICATION_HASH="$(printf '%s\n' "$E_REPAIR_BUNDLE_JSON" | jq -er '.focusedVerificationHash')"
E_BROAD_VERIFICATION_HASH="$(printf '%s\n' "$E_REPAIR_BUNDLE_JSON" | jq -er '.broadVerificationHash')"
E_CLEAN_BUILD_HASH="$(printf '%s\n' "$E_REPAIR_BUNDLE_JSON" | jq -er '.cleanBuildHash')"
require_authenticated_clean_main_setfarm_root_v1
npm run internal:golden-repair-review -- record \
  --campaign "$E_CAMPAIGN" \
  --case "$E_FAILED_CASE_ID" \
  --failed-result-hash "$E_FAILED_RESULT_HASH" \
  --owning-repository "$E_REPAIR_OWNER" \
  --pull-request "$E_REPAIR_PR_URL" \
  --merge-sha "$E_REPAIR_MERGE_SHA" \
  --independent-review "$E_INDEPENDENT_REVIEW_HASH" \
  --focused-verification "$E_FOCUSED_VERIFICATION_HASH" \
  --broad-verification "$E_BROAD_VERIFICATION_HASH" \
  --clean-build "$E_CLEAN_BUILD_HASH" \
  --json
```

`E_REPAIR_OWNER` is exactly `setfarm` or `mission-control`. C resolves the failed result/root, PR review, merge, clean-main source, fixed focused/broad commands, and build identities itself; the CLI accepts no caller command, cwd, environment, authority payload, or output path. Provider/quota/infrastructure and generated-product nonacceptance use C's separate exact `record-external` and `record-generated` forms and never this repository-repair form.

After each repair merge, end the old shell that holds read-only SHA variables. In a new operator shell, derive the successor clean-main pair, run C's ordered matrix from retained history until all ten slots are accepted on that pair, privately finalize it, prove the status receipt ref/hash equals the finalization pointer ref/hash, relink D to that C epoch, advance all ten D selections, and revalidate/finalize D. The required gate order is then explicit: execute Task 7 **Step 0 in full** so it re-resolves those same-epoch C/D authorities, and only after that complete block exits `0` execute Task 7 **Step 1** in the same new shell to derive `E_CAMPAIGN` and run the fleet preflight. Repeating Step 1 alone is forbidden. The repaired fleet case starts first, followed by the other nine fresh fleet cases. C/D/fleet historical epochs remain immutable cleanup/root evidence but fill no current slot. C's repair receipt, not mutable shell state, authorizes the exact old-to-new transition; a C or D nonacceptance follows its own reviewed repair flow, and the third exact systemic root stops the program.

- [ ] **Step 4: Prove exact settlement and all-ten cleanup**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
E_FLEET_STATUS_JSON="$(npm run --silent internal:golden -- fleet-status \
  --campaign "$E_CAMPAIGN" \
  --release-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
printf '%s\n' "$E_FLEET_STATUS_JSON" | jq -e \
  --arg sf "$E_SETFARM_SHA" \
  --arg mc "$E_MISSION_CONTROL_SHA" '
  .decision == "accepted" and
  .finalReleaseEpoch.schema == "setfarm.internal-production-final-release-epoch.v1" and
  .finalReleaseEpoch.setfarmSha == $sf and
  .finalReleaseEpoch.missionControlSha == $mc and
  (.finalReleaseEpoch.epochHash | type == "string" and length == 64) and
  (.orderedResultHashes | length) >= 10 and
  (.orderedResultHashes | length) <= 64 and
  (.timeoutReconciliationAuthorities | type == "array" and length <= 64) and
  (all(.timeoutReconciliationAuthorities[];
    (keys | sort) == ["authorityHash","campaignHash","committedPairIndexHash","originalTimeoutResultHash","pairHash","pairRef","resultIndexHash","schema","supersessionHash","supersessionIndexHash","terminalResultHash"] and
    (.schema | type == "string") and
    (.pairRef | type == "string") and
    (all([.campaignHash,.supersessionHash,.originalTimeoutResultHash,.terminalResultHash,.pairHash,.resultIndexHash,.supersessionIndexHash,.committedPairIndexHash,.authorityHash][]; test("^[0-9a-f]{64}$"))))) and
  (.currentEpochResultHashes | length) == 10 and
  .pendingReviewAcknowledgement == null and
  (.consumedReviewAcknowledgementHashes | type == "array" and length <= 20) and
  .executionCapacity.configuredMaximum == 2 and
  .executionCapacity.eligibleMaximum == 2 and
  (.executionCapacity.capacityHash | test("^[0-9a-f]{64}$")) and
  (.settlementHash | type == "string" and length == 64)
' >/dev/null
```

Expected for success: B's `fleet-threshold-v1` policy proves exactly ten final-epoch effective terminal results, at least eight final-epoch effective accepted results, only final-epoch allowed nonaccepted classifications, no final-epoch systemic/configuration result, and clean B cleanup across the entire current/historical effective history. Every allowed nonaccepted result also has its exact C review acknowledgement consumed before a later case, and no pending review remains. Every raw timeout and its terminal replacement remain in `orderedResultHashes`, every reconciliation is represented by one exact authenticated, located, fresh-resolved B authority in `timeoutReconciliationAuthorities`, and `currentEpochResultHashes` contains only the one replacement-backed effective slot; unresolved timeouts are impossible. The status epoch equals current exact clean Setfarm/Mission Control SHAs, and its `epochHash` validates through B. E writes no shell-output file: `fleet-status` has already persisted the validated content-addressed status below B's data root, and the bounded JSON lives only in the current shell variable for the immediate predicate. A cumulative repeated-root blocked receipt is a legitimate stop artifact but does not satisfy internal-production success.

---

### Task 8: Run Cold Rehearsal, Finalize Once, Review Evidence, and Deliver Docs

**Files:**
- Create through B session only: `docs/review-packets/internal-production/epoch-<epochHash>-closure-<closureGenerationHash>/golden-matrix-report.md`.
- Create through B's D-owner-mediated commits only: the same generation's `recovery-matrix.md` and `recovery-reconciliation.md`; D receives no path.
- Create through B only: the same generation's `golden-fleet-report.md`.
- Create through final writer only: the same generation's `final-closure.json` and `final-closure.md`.
- Write private content-addressed cold/review/finalizer receipts below B `resolveInternalProductionDataRootV1()` only.

**Interfaces:**
- Consumes: accepted same-epoch C matrix finalization, D `RecoveryOperationalAcceptanceV1` and its named recovery finalization, fleet status/finalization, A historical baseline authority, clean-main SHAs, cold coordinator, and independent reviewer.
- Produces: one cold receipt, one C report, two D packet files, one fleet report, one non-circular review receipt, two final reference files, one six-entry authenticated docs-session receipt, reviewed docs-only PR, and one strict private post-handoff receipt that links the operational epoch to the metadata-only docs SHA after clean-main runtime-source/audit/all-zero verification.

- [ ] **Step 0: Re-enforce the same-epoch C matrix and private D finalization barriers**

Task 8 cannot begin merely because D source merged or the fleet settled. Re-resolve the complete C matrix finalization and D's ten live/process selections, reconciliation, browser acceptance, independent evidence review, and private packet on the exact current fleet epoch. No tracked C/D report may exist yet:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
readonly E_SF_ROOT="$SETFARM_ROOT"
readonly E_MC_ROOT=/Users/setrox/ai/setrox/mission-control
readonly E_CAMPAIGN="$E_SF_ROOT/evals/suites/internal-production-golden-fleet-v1.json"
E_SETFARM_SHA="$(git -C "$E_SF_ROOT" rev-parse HEAD)"
readonly E_SETFARM_SHA
E_MISSION_CONTROL_SHA="$(git -C "$E_MC_ROOT" rev-parse HEAD)"
readonly E_MISSION_CONTROL_SHA
cd "$E_SF_ROOT"
require_authenticated_clean_main_setfarm_root_v1
D_RECOVERY_CONTROL="$(npm run --silent acceptance:recovery -- control-value --name recovery-campaign-hash --json)"
D_RECOVERY_CAMPAIGN_HASH="$(printf '%s\n' "$D_RECOVERY_CONTROL" | jq -er '
  select(.schema == "setfarm.internal-production-recovery-control-value.v1") |
  select(.name == "recovery-campaign-hash") |
  .value
')"
E_SHELL_TEST_VALUE_026="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_026" = "main"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_027="$(git rev-parse HEAD)"
E_SHELL_TEST_VALUE_028="$(git rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_027" = "$E_SHELL_TEST_VALUE_028"
E_SHELL_TEST_VALUE_029="$(git -C "$E_MC_ROOT" branch --show-current)"
test "$E_SHELL_TEST_VALUE_029" = "main"
E_SHELL_GUARD_OUTPUT="$(git -C "$E_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_030="$(git -C "$E_MC_ROOT" rev-parse HEAD)"
E_SHELL_TEST_VALUE_031="$(git -C "$E_MC_ROOT" rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_030" = "$E_SHELL_TEST_VALUE_031"
E_SHELL_TEST_VALUE_032="$(printf '%s' "$D_RECOVERY_CAMPAIGN_HASH" | rg -o '^[0-9a-f]{64}$')"
test "$D_RECOVERY_CAMPAIGN_HASH" = "$E_SHELL_TEST_VALUE_032"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:recovery -- verify-campaign --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:recovery -- verify-browser-acceptance --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH"
require_authenticated_clean_main_setfarm_root_v1
C_MATRIX_STATUS="$(npm run --silent internal:golden-matrix -- status \
  --matrix "$E_SF_ROOT/evals/suites/internal-production-golden-matrix-v1.json" \
  --release-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
C_MATRIX_RECEIPT_REF="$(printf '%s\n' "$C_MATRIX_STATUS" | jq -er '
  select(.decision == "accepted") | .matrixReceiptRef
')"
C_MATRIX_RECEIPT_HASH="$(printf '%s\n' "$C_MATRIX_STATUS" | jq -er '
  .matrixReceiptHash | select(test("^[0-9a-f]{64}$"))
')"
require_authenticated_clean_main_setfarm_root_v1
C_FINALIZATION_STATUS="$(npm run --silent internal:golden-matrix -- finalization-status \
  --matrix "$E_SF_ROOT/evals/suites/internal-production-golden-matrix-v1.json" \
  --json)"
printf '%s\n' "$C_FINALIZATION_STATUS" | jq -e \
  --arg sf "$E_SETFARM_SHA" --arg mc "$E_MISSION_CONTROL_SHA" \
  --arg receiptRef "$C_MATRIX_RECEIPT_REF" --arg receiptHash "$C_MATRIX_RECEIPT_HASH" '
  .schema == "setfarm.internal-production-golden-matrix-finalization-pointer.v1" and
  .matrixReceiptRef == $receiptRef and
  .matrixReceiptHash == $receiptHash and
  .finalReleaseEpoch.schema == "setfarm.internal-production-final-release-epoch.v1" and
  .finalReleaseEpoch.setfarmSha == $sf and
  .finalReleaseEpoch.missionControlSha == $mc and
  (.finalReleaseEpoch.epochHash | type == "string" and test("^[0-9a-f]{64}$")) and
  (.finalizationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
C_REPORT_TARGET="$(printf '%s\n' "$C_FINALIZATION_STATUS" | jq -er '.reportPath')"
case "$C_REPORT_TARGET" in docs/review-packets/*-golden-run-report.md) ;; *) exit 1 ;; esac
require_authenticated_clean_main_setfarm_root_v1
D_FINALIZATION_STATUS="$(npm run --silent acceptance:recovery -- finalize-packet \
  --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" \
  --setfarm-source-sha "$E_SETFARM_SHA" \
  --mission-control-source-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
printf '%s\n' "$D_FINALIZATION_STATUS" | jq -e \
  --arg sf "$E_SETFARM_SHA" --arg mc "$E_MISSION_CONTROL_SHA" '
  .setfarmSourceSha == $sf and .missionControlSourceSha == $mc and
  (.finalizationHash | test("^[0-9a-f]{64}$")) and
  (.recoveryMatrixMarkdownHash | test("^[0-9a-f]{64}$")) and
  (.recoveryReconciliationMarkdownHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
D_OPERATIONAL_ACCEPTANCE_STATUS="$(npm run --silent acceptance:recovery -- \
  record-operational-acceptance --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --json)"
D_OPERATIONAL_ACCEPTANCE_REF="$(printf '%s\n' "$D_OPERATIONAL_ACCEPTANCE_STATUS" | jq -er '.acceptanceRef')"
D_OPERATIONAL_ACCEPTANCE_HASH="$(printf '%s\n' "$D_OPERATIONAL_ACCEPTANCE_STATUS" | jq -er '.acceptanceHash')"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:recovery -- verify-operational-acceptance \
  --acceptance-ref "$D_OPERATIONAL_ACCEPTANCE_REF" \
  --acceptance-hash "$D_OPERATIONAL_ACCEPTANCE_HASH" --json
test -n "$C_REPORT_TARGET"
```

Expected: C's status receipt and finalization pointer repeat one exact `matrixReceiptRef`/`matrixReceiptHash`, C's resolver reopens that same strict accepted receipt, and C/D private content-addressed authorities reverify against the accepted fleet's exact source pair. D's operational-acceptance resolver freshly authenticates all ten current-epoch scenario summaries, zero leaks/mismatches/browser console errors, reconciliation/browser/zero-owner evidence, and the same private finalization without consulting the later docs gate. Both repositories remain clean. Older generation directories may exist and are immutable history; their presence is not a blocker. After E derives the current `closureGenerationHash`, every one of its six distinct targets must be absent before the new session begins. A missing, prior-epoch, corrupt, pointer/status mismatch, missing operational acceptance, or already-materialized current-generation authority blocks Task 8.

- [ ] **Step 1: Run the cold rehearsal from accepted fleet state**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
E_FLEET_STATUS_JSON="$(npm run --silent internal:golden -- fleet-status \
  --campaign "$E_CAMPAIGN" \
  --release-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --json)"
printf '%s\n' "$E_FLEET_STATUS_JSON" | jq -e \
  --arg sf "$E_SETFARM_SHA" \
  --arg mc "$E_MISSION_CONTROL_SHA" '
  .decision == "accepted" and
  .finalReleaseEpoch.schema == "setfarm.internal-production-final-release-epoch.v1" and
  .finalReleaseEpoch.setfarmSha == $sf and
  .finalReleaseEpoch.missionControlSha == $mc and
  (.finalReleaseEpoch.epochHash | type == "string" and length == 64) and
  (.orderedResultHashes | length) >= 10 and
  (.orderedResultHashes | length) <= 64 and
  (.timeoutReconciliationAuthorities | type == "array" and length <= 64) and
  (all(.timeoutReconciliationAuthorities[];
    (keys | sort) == ["authorityHash","campaignHash","committedPairIndexHash","originalTimeoutResultHash","pairHash","pairRef","resultIndexHash","schema","supersessionHash","supersessionIndexHash","terminalResultHash"] and
    (.schema | type == "string") and
    (.pairRef | type == "string") and
    (all([.campaignHash,.supersessionHash,.originalTimeoutResultHash,.terminalResultHash,.pairHash,.resultIndexHash,.supersessionIndexHash,.committedPairIndexHash,.authorityHash][]; test("^[0-9a-f]{64}$"))))) and
  (.currentEpochResultHashes | length) == 10 and
  .pendingReviewAcknowledgement == null and
  (.consumedReviewAcknowledgementHashes | type == "array" and length <= 20) and
  (.settlementHash | type == "string" and length == 64)
' >/dev/null
E_RENDER_RESULT_HASH="$(printf '%s\n' "$E_FLEET_STATUS_JSON" | jq -er '.currentEpochResultHashes[0]')"
require_authenticated_clean_main_setfarm_root_v1
E_EXTERNAL_PREFLIGHT_JSON="$(npm run --silent acceptance:external-distribution-preflight -- \
  record-readiness-v2 --json)"
printf '%s\n' "$E_EXTERNAL_PREFLIGHT_JSON" | jq -e '
  .schema == "setfarm.internal-production-external-distribution-preflight-evidence.v1" and
  (.evidenceRef | startswith("setfarm://internal-production/external-distribution-preflight-evidence/sha256/")) and
  (.evidenceHash | test("^[0-9a-f]{64}$")) and
  (.readinessV2Hash | test("^[0-9a-f]{64}$")) and
  (.observations | map(.code)) == [
    "DEVELOPER_ID_IDENTITIES_UNAVAILABLE",
    "NOTARIZATION_AUTHORITY_UNAVAILABLE",
    "SIGNED_STAPLED_PACKAGE_UNAVAILABLE",
    "INSTALLER_RECEIPT_PAYLOAD_AUTHORITY_UNAVAILABLE",
    "AUTHENTICATED_INSTALL_HELPER_UNAVAILABLE"
  ] and
  (.observations | length == 5 and all(.status == "blocked" or .status == "unverifiable")) and
  (.blockers | length == 5) and
  .productionAuthority == false and .productionAdmission == "blocked"
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
E_COLD_RECEIPT_JSON="$(npm run --silent acceptance:cold-rehearsal -- run \
  --campaign "$E_CAMPAIGN" \
  --setfarm-sha "$E_SETFARM_SHA" \
  --mission-control-sha "$E_MISSION_CONTROL_SHA" \
  --render-result-hash "$E_RENDER_RESULT_HASH" \
  --json)"
E_EXTERNAL_PREFLIGHT_EVIDENCE_HASH="$(printf '%s\n' "$E_EXTERNAL_PREFLIGHT_JSON" | jq -er '.evidenceHash')"
printf '%s\n' "$E_COLD_RECEIPT_JSON" | jq -e \
  --arg externalHash "$E_EXTERNAL_PREFLIGHT_EVIDENCE_HASH" '
  .schema == "setfarm.internal-production-cold-rehearsal-receipt.v1" and
  .allTenCleanupClean == true and
  (.restarts | map(.service)) == ["setfarm-spawner","setfarm-dashboard","mission-control"] and
  (.restarts | all(
    .terminalKind == "complete" and
    .terminalCoreDispositionKind == "complete" and
    .occurrenceTerminalDisposition == "complete" and
    .finalEnvelopeKind == "complete" and
    (.completionRef | type == "string" and startswith("setfarm://internal-production/")) and
    (.completionHash | test("^[0-9a-f]{64}$")) and
    .failureRef == null and .failureHash == null and
    (.beforeGenerationHash | test("^[0-9a-f]{64}$")) and
    (.afterGenerationHash | test("^[0-9a-f]{64}$")) and
    .afterGenerationHash != .beforeGenerationHash and
    .generationChanged == true
  )) and
  (.externalPreflight.evidenceRef | startswith("setfarm://internal-production/external-distribution-preflight-evidence/sha256/")) and
  .externalPreflight.evidenceHash == $externalHash and
  (.externalPreflight.observations | length == 5) and
  (.externalPreflight.blockers | length == 5 and all(
    (.code | IN(
      "DEVELOPER_ID_IDENTITIES_UNAVAILABLE",
      "NOTARIZATION_AUTHORITY_UNAVAILABLE",
      "SIGNED_STAPLED_PACKAGE_UNAVAILABLE",
      "INSTALLER_RECEIPT_PAYLOAD_AUTHORITY_UNAVAILABLE",
      "AUTHENTICATED_INSTALL_HELPER_UNAVAILABLE"
    )) and
    (.status == "blocked" or .status == "unverifiable") and
    (.readinessReasonCodes | type == "array") and
    (.details | length >= 1 and length <= 8 and all(type == "string" and length >= 1 and length <= 256)) and
    (.evidenceRefs | length >= 1 and length <= 8 and all(startswith("setfarm://internal-production/")))
  )) and
  .externalPreflight.productionAuthority == false and
  .externalPreflight.productionAdmission == "blocked"
' >/dev/null
```

Expected: all phases complete in order and the private terminal receipt is content-addressed below B's data root. The bounded command outputs live only in current shell variables. A same-input rerun returns the same receipt without another backup, restore, or restart.

- [ ] **Step 2: Re-establish clean source and invoke B's private finalizer**

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
E_SHELL_GUARD_OUTPUT="$(git -C "$E_SF_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_GUARD_OUTPUT="$(git -C "$E_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
require_authenticated_clean_main_setfarm_root_v1
E_FINALIZATION_JSON="$(npm run --silent internal:golden -- finalize-report \
  --campaign "$E_CAMPAIGN" \
  --json)"
require_authenticated_clean_main_setfarm_root_v1
npm run --silent acceptance:final-closure-packet -- record-finalizer-output --json \
  <<<"$E_FINALIZATION_JSON"
E_FINALIZATION_HASH="$(printf '%s\n' "$E_FINALIZATION_JSON" | jq -er '
  select(.schema == "setfarm.internal-production-finalized-campaign-report.v1") |
  select(.finalReleaseEpoch.epochHash | type == "string" and length == 64) |
  .finalizationHash
')"
E_SHELL_GUARD_OUTPUT="$(git -C "$E_SF_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
```

There is no release-SHA, MC-SHA, epoch, fleet, policy, output, or concurrency flag. B loads the exact raw result history plus `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`, authenticates/locates/fresh-resolves every authority into exact `timeoutReconciliations`, derives the effective projection, performs its clean-source builds, rederives the unchanged authoritative epoch, reevaluates settlement with `timeoutReconciliations`, and writes only the private content-addressed report/receipt. An unresolved timeout blocks finalization; an original plus its terminal replacement is reported as immutable raw history but one effective result. E's stdin recorder validates and indexes only B's exact output under the B-rooted fixed private ref; it cannot choose a path, epoch, supersession, or report. Both repositories remain clean.

- [ ] **Step 3: Obtain and record the non-circular pre-packet review**

Ask an independent reviewer to inspect the fixed A baseline, B finalizer output/report, both D packets, accepted fleet status, cold receipt, source SHAs, and external false/blocked evidence. First allocate the observation in the fixed private inbox; the reviewer writes the strict bounded object to that unpredictable mode-`0600` file, explicitly excluding both final closure output files. Resolve every Critical, High, and Medium finding before recording it.

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
require_authenticated_clean_main_setfarm_root_v1
E_REVIEW_ALLOCATION="$(npm run --silent acceptance:final-closure-packet -- allocate-review-observation --json)"
E_REVIEW_OBSERVATION="$(printf '%s\n' "$E_REVIEW_ALLOCATION" | jq -er '.path')"
E_REVIEW_OBSERVATION_REF="$(printf '%s\n' "$E_REVIEW_ALLOCATION" | jq -er '.observationRef')"
# The independent reviewer now writes the validated bounded observation here.
test -f "$E_REVIEW_OBSERVATION"
test ! -L "$E_REVIEW_OBSERVATION"
E_SHELL_TEST_VALUE_033="$(stat -f '%l' "$E_REVIEW_OBSERVATION")"
test "$E_SHELL_TEST_VALUE_033" = "1"
E_SHELL_TEST_VALUE_034="$(stat -f '%Lp' "$E_REVIEW_OBSERVATION")"
test "$E_SHELL_TEST_VALUE_034" = "600"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:final-closure-packet -- record-review \
  --observation-ref "$E_REVIEW_OBSERVATION_REF" \
  --json
test ! -e "$E_REVIEW_OBSERVATION"
```

Expected: one content-addressed private review receipt with `verdict:"clear"` and zero unresolved Critical/High/Medium counts. This receipt precedes and cannot hash the final packet.

Still on clean canonical `main`, seal the exact reviewed final input and its two final packet byte streams privately:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$E_SF_ROOT"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:final-closure-packet -- prepare-input --json
require_authenticated_clean_main_setfarm_root_v1
E_CLOSURE_FINALIZATION="$(npm run --silent acceptance:final-closure-packet -- finalize-private --json)"
E_CLOSURE_FINALIZATION_HASH="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.finalizationHash | select(test("^[0-9a-f]{64}$"))')"
E_CLOSURE_PACKET_HASH="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.packetHash | select(test("^[0-9a-f]{64}$"))')"
E_PRE_PACKET_RECEIPT_REF="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.prePacketReviewReceiptRef')"
E_PRE_PACKET_RECEIPT_HASH="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.prePacketReviewReceiptHash | select(test("^[0-9a-f]{64}$"))')"
E_PRE_PACKET_HISTORY_REF="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.reviewHistoryRef')"
E_PRE_PACKET_HISTORY_HASH="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.reviewHistoryHash | select(test("^[0-9a-f]{64}$"))')"
printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -e '
  .schema == "setfarm.internal-production-final-closure-finalization.v1" and
  (.finalReleaseEpoch.epochHash | test("^[0-9a-f]{64}$")) and
  (.operationalSetfarmSha == .finalReleaseEpoch.setfarmSha) and
  (.sourceBuildAuthorityRef | type == "string" and startswith("setfarm://")) and
  (.sourceBuildAuthorityHash | test("^[0-9a-f]{64}$")) and
  (.matrixFinalizationHash | test("^[0-9a-f]{64}$")) and
  (.recoveryFinalizationHash | test("^[0-9a-f]{64}$")) and
  (.fleetFinalizationHash | test("^[0-9a-f]{64}$")) and
  (.closureGenerationHash | test("^[0-9a-f]{64}$")) and
  (.closureGenerationDirectory == ("epoch-" + .finalReleaseEpoch.epochHash + "-closure-" + .closureGenerationHash)) and
  (.targetPaths | length) == 6 and
  (all(.targetPaths[]; startswith("docs/review-packets/internal-production/" + .closureGenerationDirectory + "/"))) and
  (.orderedExpectedContentHashes | length) == 6 and
  (all(.orderedExpectedContentHashes[]; test("^[0-9a-f]{64}$"))) and
  (has("entries") | not) and
  (.finalizationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
```

Expected: private finalization resolves all eleven reviewed refs/hashes, repeats the pre-render epoch/matrix/recovery/fleet generation tuple, exact hash/suffix/six paths, full final epoch, and B-typed six ordered private content hashes, contains no session entry, and leaves both repositories clean. Tests independently recompute the four-member generation formula and reject any extra hash input or a value derived from the later E finalization.

- [ ] **Step 4: Materialize all six reviewed files in one authenticated Setfarm docs session**

Report requested branch `docs/internal-production-fleet-closure`, clean operational Setfarm base SHA, and the private closure finalization hash to the Setfarm documentation owner. Only that owner allocates the clean docs claim/worktree at the exact recorded source SHA and returns one authenticated claim receipt whose exact exported values are `E_DOCS_CLAIM_WORKTREE`, `E_DOCS_CLAIM_BRANCH`, and `E_DOCS_CLAIM_MERGE_BASE_SHA`. The operator must not derive any of them from the canonical worktree or current `cwd`. First `cd` to the returned worktree, only then derive its top level and require byte equality, canonical realpath equality, and inequality from the canonical Setfarm root. The branch must equal the returned branch and fixed requested literal; the merge base must equal both the returned merge-base SHA and the finalization's `operationalSetfarmSha`. Provision dependencies before the session; `node_modules` remains ignored and cannot appear in `git status`. Then run the sole path-free composition command once:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
test -n "$E_DOCS_CLAIM_WORKTREE"
test -n "$E_DOCS_CLAIM_BRANCH"
test -n "$E_DOCS_CLAIM_MERGE_BASE_SHA"
cd "$E_DOCS_CLAIM_WORKTREE"
E_DOCS_WORKTREE="$(git rev-parse --show-toplevel)"
readonly E_DOCS_WORKTREE
test "$E_DOCS_WORKTREE" = "$E_DOCS_CLAIM_WORKTREE"
E_SHELL_TEST_VALUE_035="$(realpath "$E_DOCS_WORKTREE")"
E_SHELL_TEST_VALUE_036="$(realpath "$E_DOCS_CLAIM_WORKTREE")"
test "$E_SHELL_TEST_VALUE_035" = "$E_SHELL_TEST_VALUE_036"
test "$E_DOCS_WORKTREE" != "$E_SF_ROOT"
E_SHELL_TEST_VALUE_037="$(realpath "$E_DOCS_WORKTREE")"
E_SHELL_TEST_VALUE_038="$(realpath "$E_SF_ROOT")"
test "$E_SHELL_TEST_VALUE_037" != "$E_SHELL_TEST_VALUE_038"
test "$E_DOCS_CLAIM_BRANCH" = "docs/internal-production-fleet-closure"
E_SHELL_TEST_VALUE_039="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_039" = "$E_DOCS_CLAIM_BRANCH"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_040="$(git rev-parse HEAD)"
test "$E_SHELL_TEST_VALUE_040" = "$E_SETFARM_SHA"
E_SHELL_TEST_VALUE_041="$(git rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_041" = "$E_SETFARM_SHA"
test "$E_DOCS_CLAIM_MERGE_BASE_SHA" = "$E_SETFARM_SHA"
E_SHELL_TEST_VALUE_042="$(git merge-base HEAD origin/main)"
test "$E_SHELL_TEST_VALUE_042" = "$E_DOCS_CLAIM_MERGE_BASE_SHA"
git merge-base --is-ancestor "$E_SETFARM_SHA" HEAD
require_authenticated_clean_main_setfarm_root_v1
npm ci
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_EXPECTED_EPOCH_HASH="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.finalReleaseEpoch.epochHash')"
E_EXPECTED_CLOSURE_GENERATION_HASH="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.closureGenerationHash')"
E_EXPECTED_CLOSURE_GENERATION_DIRECTORY="epoch-${E_EXPECTED_EPOCH_HASH}-closure-${E_EXPECTED_CLOSURE_GENERATION_HASH}"
E_SHELL_TEST_VALUE_043="$(printf '%s\n' "$E_CLOSURE_FINALIZATION" | jq -er '.closureGenerationDirectory')"
test "$E_SHELL_TEST_VALUE_043" = "$E_EXPECTED_CLOSURE_GENERATION_DIRECTORY"
require_authenticated_clean_main_setfarm_root_v1
E_MATERIALIZATION="$(npm run --silent acceptance:final-closure-packet -- materialize-all \
  --finalization-hash "$E_CLOSURE_FINALIZATION_HASH" \
  --json)"
E_CLOSURE_GENERATION_HASH="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.closureGenerationHash | select(test("^[0-9a-f]{64}$"))')"
E_CLOSURE_TARGET_PATHS="$(printf '%s\n' "$E_MATERIALIZATION" | jq -cer '.targetPaths | select(length == 6)')"
test "$E_CLOSURE_GENERATION_HASH" = "$E_EXPECTED_CLOSURE_GENERATION_HASH"
printf '%s\n' "$E_MATERIALIZATION" | jq -e \
  --arg finalization "$E_CLOSURE_FINALIZATION_HASH" \
  --arg generation "$E_CLOSURE_GENERATION_HASH" \
  --arg directory "$E_EXPECTED_CLOSURE_GENERATION_DIRECTORY" '
  (keys == ["closureGenerationHash","finalizationHash","orderedMaterializationHashes","receiptHash","receiptRef","sessionHash","targetPaths"]) and
  (.finalizationHash == $finalization) and
  (.closureGenerationHash == $generation) and
  (.sessionHash | test("^[0-9a-f]{64}$")) and
  (.receiptRef | type == "string" and startswith("setfarm://internal-production/")) and
  (.receiptHash | test("^[0-9a-f]{64}$")) and
  (.orderedMaterializationHashes | length) == 6 and
  ([.targetPaths[] | split("/")[-1]] == [
    "golden-matrix-report.md",
    "recovery-matrix.md",
    "recovery-reconciliation.md",
    "golden-fleet-report.md",
    "final-closure.json",
    "final-closure.md"
  ]) and
  (all(.targetPaths[]; startswith("docs/review-packets/internal-production/" + $directory + "/")))
' >/dev/null
E_DOCS_SESSION_HASH="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.sessionHash')"
E_DOCS_SESSION_RECEIPT_REF="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.receiptRef')"
E_DOCS_SESSION_RECEIPT_HASH="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.receiptHash')"
E_SHELL_TEST_VALUE_044="$(git status --porcelain=v1 --untracked-files=all -- docs/review-packets | wc -l | tr -d ' ')"
test "$E_SHELL_TEST_VALUE_044" = "6"
```

Expected: the authenticated owner-returned worktree/branch/merge-base triple, not canonical `cwd`, selects the isolated claim. One live WeakMap-authenticated session validates every private authority while clean, then materializes C matrix Markdown, D recovery-matrix Markdown, D recovery-reconciliation Markdown, B fleet Markdown, final JSON, and final Markdown in that order under one code-derived generation directory. B completes and persists one `GoldenDocsMaterializationCompletionReceiptV1`; B's result remains the exact four fields `receiptRef`, `receiptHash`, `sessionHash`, and `orderedMaterializationHashes`. The command output is the exact seven-field wrapper `{finalizationHash,closureGenerationHash,targetPaths,receiptRef,receiptHash,sessionHash,orderedMaterializationHashes}`, with the four B values copied unchanged, while fresh-process resolution of that exact pair proves the closure finalization, generation, and six-entry/content/materialization binding. Exactly six byte-identical reviewed current-generation paths are dirty/untracked; every prior generation remains byte-identical and no standalone materializer runs after the first write. The JSON schema is `setfarm.internal-production-final-closure-packet.v1`; its C/D/fleet epochs all match, and Markdown contains the same bounded refs with no expanded run rows.

- [ ] **Step 5: Report the docs-only handoff to the Setfarm documentation owner**

```bash
set -euo pipefail
test "$E_DOCS_WORKTREE" != "$E_SF_ROOT"
cd "$E_DOCS_WORKTREE"
E_SHELL_TEST_VALUE_045="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_045" = "docs/internal-production-fleet-closure"
E_SHELL_TEST_VALUE_046="$(git -C "$E_SF_ROOT" rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_046" = "$E_SETFARM_SHA"
E_DOC_TARGET_PATH_0="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.targetPaths[0]')"
E_DOC_TARGET_PATH_1="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.targetPaths[1]')"
E_DOC_TARGET_PATH_2="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.targetPaths[2]')"
E_DOC_TARGET_PATH_3="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.targetPaths[3]')"
E_DOC_TARGET_PATH_4="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.targetPaths[4]')"
E_DOC_TARGET_PATH_5="$(printf '%s\n' "$E_MATERIALIZATION" | jq -er '.targetPaths[5]')"
E_DOC_PATHS=(
  "$E_DOC_TARGET_PATH_0"
  "$E_DOC_TARGET_PATH_1"
  "$E_DOC_TARGET_PATH_2"
  "$E_DOC_TARGET_PATH_3"
  "$E_DOC_TARGET_PATH_4"
  "$E_DOC_TARGET_PATH_5"
)
E_SHELL_TEST_VALUE_047="$(git status --porcelain=v1 --untracked-files=all -- docs/review-packets | wc -l | tr -d ' ')"
test "$E_SHELL_TEST_VALUE_047" = "6"
for E_DOC_PATH in "${E_DOC_PATHS[@]}"; do
  E_SHELL_TEST_VALUE_048="$(git status --porcelain=v1 --untracked-files=all -- "$E_DOC_PATH")"
  test "$E_SHELL_TEST_VALUE_048" = "?? $E_DOC_PATH"
  if E_DOC_DIFF_CHECK="$(git diff --no-index --check /dev/null "$E_DOC_PATH" 2>&1)"; then
    E_DOC_DIFF_CHECK_STATUS=0
  else
    E_DOC_DIFF_CHECK_STATUS=$?
  fi
  test "$E_DOC_DIFF_CHECK_STATUS" = "1"
  test -z "$E_DOC_DIFF_CHECK"
  if E_DOC_SECRET_SCAN="$(rg -n -e 'postgres(?:ql)?://' -e 'SETFARM_OPERATIONAL_WRITE_TOKEN' -e 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY' -- "$E_DOC_PATH" 2>&1)"; then
    E_DOC_SECRET_SCAN_STATUS=0
  else
    E_DOC_SECRET_SCAN_STATUS=$?
  fi
  test "$E_DOC_SECRET_SCAN_STATUS" = "1"
  test -z "$E_DOC_SECRET_SCAN"
done
git status --short -- "${E_DOC_PATHS[@]}"
```

Expected: exactly the six named untracked documentation paths in the already assigned docs claim are reported; every explicit no-index whitespace check emits nothing with expected diff status `1`, every separate exact-file secret scan emits nothing with expected no-match status `1`, and no combined no-index-diff/secret-scan pipeline can mask a secret under `pipefail`. The empty tracked `git diff` is not treated as evidence. Use authorized subject/title `docs(ops): record internal production closure`, and body `Records the accepted ordered matrix, same-epoch recovery packet, settled ten-result fleet, all-history cleanup proof, cold-rehearsal receipt, non-circular pre-packet review, and reference-only final closure packet. External distribution remains blocked.` The Setfarm documentation owner alone stages, commits, pushes, and opens the draft PR. Obtain normal independent read-only PR review. If any actionable finding changes even one byte of the six generated paths, the owner closes/abandons that entire docs claim and preserves its immutable completion/review history; nobody edits, amends, or regenerates a member in place. A packet/evidence-only correction returns to Step 3, records a corrected pre-packet review with predecessor lineage, creates a new input and private finalization, then obtains a fresh authenticated exact-`E_SETFARM_SHA` docs claim and empty six-entry session through Step 4. A source or generator correction invalidates the operational SHA and restarts the full new-epoch sequence `C matrix -> D recovery/acceptance -> E fleet/cold/finalization` before another docs claim. Only a review with no byte-affecting finding may mark the original six-file PR ready. Immediately before merge, require `origin/main` still equals `E_SETFARM_SHA`; the owner uses one squash merge and rejects a merge commit, rebase merge, or any result with more than one commit after the operational SHA. After merge and owner cleanup, the documentation owner unconditionally disposes that successful claim, internally calls its owner-only terminal-disposal operation with the opaque capability, and returns only the strict durable `{receiptRef,receiptHash}` result pair. E imports none of the owner module/capability/operation, fresh-resolves the exact terminal retirement receipt from that pair, then calls `inspectGoldenDocsMaterializationLeaseCensusV1()` and requires `activeLeaseCount:0`, `pendingRetirementCount:0`, `observedZero:true`, and the exact terminal retirement set hash. `begin-post-handoff` freezes that retirement ref/hash/set hash; neither the owner result schema body, capability, owner operation, nor a claim path is serialized by E. Only after the owner also returns the merged SHA and synchronized canonical worktree does the operator run:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf "SETFARM_ROOT must be absolute\n" >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
cd "$E_SF_ROOT"
E_SHELL_TEST_VALUE_049="$(git branch --show-current)"
test "$E_SHELL_TEST_VALUE_049" = "main"
E_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_050="$(git rev-parse HEAD)"
E_SHELL_TEST_VALUE_051="$(git rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_050" = "$E_SHELL_TEST_VALUE_051"
E_DOCUMENTATION_SHA="$(git rev-parse HEAD)"
readonly E_DOCUMENTATION_SHA
test "$E_DOCUMENTATION_SHA" != "$E_SETFARM_SHA"
E_SHELL_TEST_VALUE_052="$(git rev-list --count "$E_SETFARM_SHA".."$E_DOCUMENTATION_SHA")"
test "$E_SHELL_TEST_VALUE_052" = "1"
E_SHELL_TEST_VALUE_053="$(git rev-parse "$E_DOCUMENTATION_SHA^")"
test "$E_SHELL_TEST_VALUE_053" = "$E_SETFARM_SHA"
E_SHELL_TEST_VALUE_054="$(git show -s --format='%P' "$E_DOCUMENTATION_SHA")"
test "$E_SHELL_TEST_VALUE_054" = "$E_SETFARM_SHA"
E_SHELL_TEST_VALUE_055="$(git rev-list --parents -n 1 "$E_DOCUMENTATION_SHA" | wc -w | tr -d ' ')"
test "$E_SHELL_TEST_VALUE_055" = "2"
E_SHELL_TEST_VALUE_056="$(git -C "$E_MC_ROOT" branch --show-current)"
test "$E_SHELL_TEST_VALUE_056" = "main"
E_SHELL_GUARD_OUTPUT="$(git -C "$E_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$E_SHELL_GUARD_OUTPUT"
E_SHELL_TEST_VALUE_057="$(git -C "$E_MC_ROOT" rev-parse HEAD)"
test "$E_SHELL_TEST_VALUE_057" = "$E_MISSION_CONTROL_SHA"
E_SHELL_TEST_VALUE_058="$(git -C "$E_MC_ROOT" rev-parse origin/main)"
test "$E_SHELL_TEST_VALUE_058" = "$E_MISSION_CONTROL_SHA"
require_authenticated_clean_main_setfarm_root_v1
npm test
require_authenticated_clean_main_setfarm_root_v1
(cd "$E_MC_ROOT" && npm test)
require_authenticated_clean_main_setfarm_root_v1
E_POST_HANDOFF_INTENT="$(npm run --silent acceptance:final-closure-packet -- begin-post-handoff --json)"
printf '%s\n' "$E_POST_HANDOFF_INTENT" | jq -e \
  --arg operational "$E_SETFARM_SHA" \
  --arg docs "$E_DOCUMENTATION_SHA" \
  --arg mc "$E_MISSION_CONTROL_SHA" \
  --arg packet "$E_CLOSURE_PACKET_HASH" \
  --arg finalization "$E_CLOSURE_FINALIZATION_HASH" \
  --arg session "$E_DOCS_SESSION_HASH" '
  .schema == "setfarm.internal-production-final-closure-post-handoff-intent.v1" and
  .operationalSetfarmSha == $operational and .documentationSha == $docs and
  .missionControlSha == $mc and .closurePacketHash == $packet and
  .finalizationHash == $finalization and .docsSessionHash == $session and
  (.recordedAt | type == "string" and length > 0) and
  .plannedObservationSlots == [
    "semantic-build-equality",
    "restart-spawner", "restart-dashboard", "restart-mission-control",
    "runtime-source-and-health", "authority-audits", "final-zero-owner"
  ] and
  (.intentRef | type == "string" and startswith("setfarm://internal-production/")) and
  (.intentHash | test("^[0-9a-f]{64}$"))
' >/dev/null
E_POST_HANDOFF_INTENT_REF="$(printf '%s\n' "$E_POST_HANDOFF_INTENT" | jq -er '.intentRef')"
E_POST_HANDOFF_INTENT_HASH="$(printf '%s\n' "$E_POST_HANDOFF_INTENT" | jq -er '.intentHash')"
require_authenticated_clean_main_setfarm_root_v1
E_POST_HANDOFF_READY="$(npm run --silent acceptance:final-closure-packet -- execute-post-handoff --json)"
printf '%s\n' "$E_POST_HANDOFF_READY" | jq -e \
  --arg intentRef "$E_POST_HANDOFF_INTENT_REF" \
  --arg intentHash "$E_POST_HANDOFF_INTENT_HASH" '
  .schema == "setfarm.internal-production-final-closure-post-handoff-ready.v1" and
  .intentRef == $intentRef and .intentHash == $intentHash and
  (.orderedPhaseRefs | length == 7 and all(startswith("setfarm://internal-production/"))) and
  (.orderedPhaseHashes | length == 7 and all(test("^[0-9a-f]{64}$"))) and
  (.finalCoordinatorLeaseRecordRef | startswith("setfarm://internal-production/")) and
  (.finalCoordinatorLeaseRecordHash | test("^[0-9a-f]{64}$")) and
  (.finalCoordinatorFencingToken | type == "number" and . >= 1 and floor == .) and
  (.readyRef | type == "string" and startswith("setfarm://internal-production/")) and
  (.readyHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
E_POST_HANDOFF="$(npm run --silent acceptance:final-closure-packet -- record-post-handoff --json)"
E_POST_HANDOFF_FINAL_LEASE_REF="$(printf '%s\n' "$E_POST_HANDOFF_READY" | jq -er '.finalCoordinatorLeaseRecordRef')"
E_POST_HANDOFF_FINAL_LEASE_HASH="$(printf '%s\n' "$E_POST_HANDOFF_READY" | jq -er '.finalCoordinatorLeaseRecordHash')"
E_POST_HANDOFF_FINAL_FENCING_TOKEN="$(printf '%s\n' "$E_POST_HANDOFF_READY" | jq -er '.finalCoordinatorFencingToken')"
E_POST_HANDOFF_RECORDED_AT="$(printf '%s\n' "$E_POST_HANDOFF_INTENT" | jq -er '.recordedAt')"
printf '%s\n' "$E_POST_HANDOFF" | jq -e \
  --arg operational "$E_SETFARM_SHA" \
  --arg docs "$E_DOCUMENTATION_SHA" \
  --arg mc "$E_MISSION_CONTROL_SHA" \
  --arg packet "$E_CLOSURE_PACKET_HASH" \
  --arg finalization "$E_CLOSURE_FINALIZATION_HASH" \
  --arg prePacketRef "$E_PRE_PACKET_RECEIPT_REF" \
  --arg prePacketHash "$E_PRE_PACKET_RECEIPT_HASH" \
  --arg prePacketHistoryRef "$E_PRE_PACKET_HISTORY_REF" \
  --arg prePacketHistoryHash "$E_PRE_PACKET_HISTORY_HASH" \
  --arg session "$E_DOCS_SESSION_HASH" \
  --arg sessionRef "$E_DOCS_SESSION_RECEIPT_REF" \
  --arg sessionReceiptHash "$E_DOCS_SESSION_RECEIPT_HASH" \
  --arg intentRef "$E_POST_HANDOFF_INTENT_REF" \
  --arg intentHash "$E_POST_HANDOFF_INTENT_HASH" \
  --arg finalLeaseRef "$E_POST_HANDOFF_FINAL_LEASE_REF" \
  --arg finalLeaseHash "$E_POST_HANDOFF_FINAL_LEASE_HASH" \
  --argjson finalFencingToken "$E_POST_HANDOFF_FINAL_FENCING_TOKEN" \
  --arg recordedAt "$E_POST_HANDOFF_RECORDED_AT" '
  .schema == "setfarm.internal-production-final-closure-post-handoff-receipt.v1" and
  .operationalSetfarmSha == $operational and
  .documentationSha == $docs and
  .missionControlSha == $mc and
  .closurePacketHash == $packet and
  .finalizationHash == $finalization and
  .prePacketReviewReceiptRef == $prePacketRef and
  .prePacketReviewReceiptHash == $prePacketHash and
  .prePacketReviewHistoryRef == $prePacketHistoryRef and
  .prePacketReviewHistoryHash == $prePacketHistoryHash and
  .docsSessionHash == $session and
  .docsSessionReceiptRef == $sessionRef and
  .docsSessionReceiptHash == $sessionReceiptHash and
  .postHandoffIntentRef == $intentRef and
  .postHandoffIntentHash == $intentHash and
  .finalCoordinatorLeaseRecordRef == $finalLeaseRef and
  .finalCoordinatorLeaseRecordHash == $finalLeaseHash and
  .finalCoordinatorFencingToken == $finalFencingToken and
  .recordedAt == $recordedAt and
  (.orderedPostHandoffPhaseRefs | length == 7 and all(startswith("setfarm://internal-production/"))) and
  (.orderedPostHandoffPhaseHashes | length == 7 and all(test("^[0-9a-f]{64}$"))) and
  (.documentationPullRequest.url | type == "string" and test("^https://github\\.com/[^/]+/[^/]+/pull/[1-9][0-9]*$")) and
  .documentationPullRequest.baseSha == $operational and
  (.documentationPullRequest.headSha | test("^[0-9a-f]{40}$")) and
  .documentationPullRequest.squashMergeSha == $docs and
  .documentationPullRequest.soleParentSha == $operational and
  (.documentationIndependentReview.historyRef | type == "string" and startswith("setfarm://internal-production/")) and
  (.documentationIndependentReview.historyHash | test("^[0-9a-f]{64}$")) and
  .documentationIndependentReview.unresolved == {critical:0,high:0,medium:0} and
  (.documentationChecks.orderedChecks | length > 0 and all(
    (.name | type == "string" and length > 0) and
    .conclusion == "success" and
    (.evidenceRef | type == "string" and startswith("setfarm://internal-production/")) and
    (.checkHash | test("^[0-9a-f]{64}$"))
  )) and
  (.documentationChecks.checkSetHash | test("^[0-9a-f]{64}$")) and
  (.orderedTargetPaths | length) == 6 and
  (.orderedContentHashes | length) == 6 and
  (.sixFileDeltaHash | test("^[0-9a-f]{64}$")) and
  (.ancestryHash | test("^[0-9a-f]{64}$")) and
  (.semanticBuildEqualityHash | test("^[0-9a-f]{64}$")) and
  (.documentationHandoffRestarts | map(.service)) == ["setfarm-spawner","setfarm-dashboard","mission-control"] and
  (.documentationHandoffRestarts | all(
    .terminalKind == "complete" and
    .terminalCoreDispositionKind == "complete" and
    .occurrenceTerminalDisposition == "complete" and
    .finalEnvelopeKind == "complete" and
    (.operationRef | type == "string" and startswith("setfarm://internal-production/")) and
    (.operationHash | test("^[0-9a-f]{64}$")) and
    (.completionRef | type == "string" and startswith("setfarm://internal-production/")) and
    (.completionHash | test("^[0-9a-f]{64}$")) and
    .failureRef == null and .failureHash == null and
    (.beforeGenerationHash | test("^[0-9a-f]{64}$")) and
    (.afterGenerationHash | test("^[0-9a-f]{64}$")) and
    .afterGenerationHash != .beforeGenerationHash and
    .generationChanged == true
  )) and
  (.runtimeSourceObservationHash | test("^[0-9a-f]{64}$")) and
  (.serviceIdentityHashes | [.spawner, .dashboard, .missionControl] | all(test("^[0-9a-f]{64}$"))) and
  (.authorityAuditHashes | length == 4 and all(test("^[0-9a-f]{64}$"))) and
  (.completeZeroOwnerCensusHash | test("^[0-9a-f]{64}$")) and
  (.externalPreflight.evidenceRef | startswith("setfarm://internal-production/external-distribution-preflight-evidence/sha256/")) and
  (.externalPreflight.evidenceHash | test("^[0-9a-f]{64}$")) and
  (.externalPreflight.readinessV2Hash | test("^[0-9a-f]{64}$")) and
  (.externalPreflight.observations | length == 5 and all(.status == "blocked" or .status == "unverifiable")) and
  (.externalPreflight.blockers | length == 5 and all(
    (.code | IN(
      "DEVELOPER_ID_IDENTITIES_UNAVAILABLE",
      "NOTARIZATION_AUTHORITY_UNAVAILABLE",
      "SIGNED_STAPLED_PACKAGE_UNAVAILABLE",
      "INSTALLER_RECEIPT_PAYLOAD_AUTHORITY_UNAVAILABLE",
      "AUTHENTICATED_INSTALL_HELPER_UNAVAILABLE"
    )) and
    (.status == "blocked" or .status == "unverifiable") and
    (.readinessReasonCodes | type == "array") and
    (.details | length >= 1 and length <= 8) and
    (.evidenceRefs | length >= 1 and length <= 8 and all(startswith("setfarm://internal-production/")))
  )) and
  .externalPreflight.productionAuthority == false and
  .externalPreflight.productionAdmission == "blocked" and
  (.receiptHash | test("^[0-9a-f]{64}$"))
' >/dev/null
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:final-closure-packet -- verify-current-post-handoff --json
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:final-closure-packet -- resolve-post-handoff --json
require_authenticated_clean_main_setfarm_root_v1
E_FINAL_ACCEPTANCE="$(npm run --silent acceptance:final-closure-packet -- verify-final-acceptance --json)"
E_SHELL_TEST_VALUE_059="$(printf '%s\n' "$E_FINAL_ACCEPTANCE" | jq -er '.receiptHash')"
E_SHELL_TEST_VALUE_060="$(printf '%s\n' "$E_POST_HANDOFF" | jq -er '.receiptHash')"
test "$E_SHELL_TEST_VALUE_059" = \
  "$E_SHELL_TEST_VALUE_060"
require_authenticated_clean_main_setfarm_root_v1
D_DOCS_DELIVERY_ACCEPTANCE="$(npm run --silent acceptance:final-closure-packet -- \
  record-recovery-docs-delivery --campaign-hash "$D_RECOVERY_CAMPAIGN_HASH" --json)"
printf '%s\n' "$D_DOCS_DELIVERY_ACCEPTANCE" | jq -e \
  --arg operationalAcceptanceRef "$D_OPERATIONAL_ACCEPTANCE_REF" \
  --arg operationalAcceptanceHash "$D_OPERATIONAL_ACCEPTANCE_HASH" \
  --arg postHandoffRef "setfarm://internal-production/final-closure/post-handoff" \
  --arg postHandoffHash "$E_SHELL_TEST_VALUE_060" \
  --arg docs "$E_DOCUMENTATION_SHA" \
  --arg session "$E_DOCS_SESSION_HASH" '
  .schema == "setfarm.internal-production-recovery-docs-delivery-acceptance.v1" and
  .operationalAcceptanceRef == $operationalAcceptanceRef and
  .operationalAcceptanceHash == $operationalAcceptanceHash and
  .postHandoffRef == $postHandoffRef and .postHandoffHash == $postHandoffHash and
  .documentationSha == $docs and .docsSessionHash == $session and
  (.deliveryHash | test("^[0-9a-f]{64}$"))
' >/dev/null
D_DOCS_DELIVERY_ACCEPTANCE_REF="$(printf '%s\n' "$D_DOCS_DELIVERY_ACCEPTANCE" | jq -er '.deliveryRef')"
D_DOCS_DELIVERY_ACCEPTANCE_HASH="$(printf '%s\n' "$D_DOCS_DELIVERY_ACCEPTANCE" | jq -er '.deliveryHash')"
require_authenticated_clean_main_setfarm_root_v1
npm run acceptance:recovery -- verify-docs-delivery-acceptance \
  --delivery-ref "$D_DOCS_DELIVERY_ACCEPTANCE_REF" \
  --delivery-hash "$D_DOCS_DELIVERY_ACCEPTANCE_HASH" --json
curl -fsS http://127.0.0.1:3080/api/health | jq -e '.status == "healthy"' >/dev/null
curl -fsS http://127.0.0.1:3333/ >/dev/null
require_authenticated_clean_main_setfarm_root_v1
E_EXTERNAL_PREFLIGHT_RECHECK="$(npm run --silent acceptance:external-distribution-preflight -- \
  record-readiness-v2 --json)"
E_POST_HANDOFF_EXTERNAL_PREFLIGHT_HASH="$(printf '%s\n' "$E_POST_HANDOFF" | jq -er '.externalPreflight.evidenceHash')"
printf '%s\n' "$E_EXTERNAL_PREFLIGHT_RECHECK" | jq -e \
  --arg acceptedHash "$E_POST_HANDOFF_EXTERNAL_PREFLIGHT_HASH" '
  .schema == "setfarm.internal-production-external-distribution-preflight-evidence.v1" and
  (.evidenceRef | startswith("setfarm://internal-production/external-distribution-preflight-evidence/sha256/")) and
  .evidenceHash == $acceptedHash and
  (.readinessV2Hash | test("^[0-9a-f]{64}$")) and
  (.observations | length == 5 and all(.status == "blocked" or .status == "unverifiable")) and
  (.blockers | length == 5) and
  .productionAuthority == false and .productionAdmission == "blocked"
' >/dev/null
```

Expected: both repositories finish on clean synchronized main; current Setfarm `HEAD === E_DOCUMENTATION_SHA` and current Mission Control `HEAD === E_MISSION_CONTROL_SHA`. `E_DOCUMENTATION_SHA` is the docs PR's sole-parent squash merge directly atop unchanged `E_SETFARM_SHA`, never a merge commit or multi-commit chain. Broad verification passes; the private post-handoff/final-acceptance receipt freshly resolves the exact docs PR URL/base/head/merge/parent, independent review history with zero unresolved Critical/High/Medium, every successful check and check-set hash, tracked closure-packet and pre-packet/finalization authority, B session completion, exact six-file delta/content, semantic application-build equality, loaded Setfarm services at the docs SHA, unchanged Mission Control authority, all four audits, and complete all-zero census. `verify-final-acceptance` calls the current resolver and returns that same receipt, so the tracked packet plus this private authority is the final accepted packet only while both HEAD equalities remain exact. `resolve-post-handoff` is archival ancestry evidence and cannot replace that check. D's later docs-delivery acceptance binds the same current handoff/session to the already settled operational acceptance and does not feed back into fleet admission. Only under this exact receipt is `E_DOCUMENTATION_SHA` metadata-only and C/D/fleet/cold evidence need not rerun. If a HEAD or receipt relation fails, the docs-only exception is void and the changed Setfarm SHA requires a new operational epoch and complete C/D/E sequence. External distribution remains blocked.

---

## Plan Self-Review

### Spec coverage

Tasks 1-3 provide one raw B campaign with immutable C templates, per-intent fresh attempts, exact C assertions, a B-owned final epoch with `10 current-epoch effective terminal / minimum 8 current-epoch effective accepted / allowed nonaccepted / no current-epoch systemic / every historical and current effective cleanup clean` settlement, an explicit B timeout-reconciliation loop, and a hash-only E scheduler. Raw originals, replacements, and supersessions remain immutable while B's projection assigns one effective slot. Every allowed nonaccepted result installs a durable pending-review gate, and no later case may stage until E locates, resolves, and consumes C's exact generated/external repair acknowledgement. Historical epochs retain cleanup, consumed acknowledgement, and cumulative root-cause authority without filling or obstructing current slots except the three-repeat stop. Task 4 provides fixed safe backup paths, resumable cold phases, exact service order, and an E remediation/source-repair admission adapter over D's universal append-only namespace/service occurrence head/index: E persists the D operation before execution, reconciles only that pair, and permits a new distinct attempt only from D's freshly resolved exact terminal predecessor and settled helper/child absence. D alone owns every occurrence/head/index plus helper/child/PID/marker/completion/failure authority across all four namespaces. Tasks 5-8 enforce the source-PR/clean-main barrier, execute the fleet, use B's sole no-extra-flag private finalizer and hash-only tracked materializer, retain every immutable open/rejected/clear pre-packet review round across scope changes, materialize exact final JSON/Markdown paths from the authenticated operational-base worktree, abandon rather than edit a byte-defective docs claim, deliver a docs-only PR, and then record the PR/review/check/pre-packet/finalization/six-file/semantic/service/audit/zero-bound final acceptance receipt whose current resolver requires both exact repository HEADs.

### No-second-engine audit

E defines no run/epoch/timeout schema, effective-result mapper, classification enum, trusted-cause derivation, cleanup census, SQL reader, snapshot parser, product assertion adapter, admission, starter, provisioning port, nonaccepted acknowledgement, or tracked golden renderer. B creates the epoch, reconciles timeouts, derives effective membership, partitions/evaluates settlement, privately finalizes, and materializes the only golden report; C prepares immutable templates, provisions each persisted intent's fresh attempt, executes assertions, owns repair-review and nonaccepted-result acknowledgement authority, and delegates execution to B. E stores the exact B final epoch, ordered raw/effective B hashes plus complete committed timeout-pair authorities, consumed C repair and acknowledgement hashes, the one pending acknowledgement scheduling member, copied B settlement hash, and one derived fleet `statusHash` only; it can only call C's exact acknowledgement `locateForRepairReceipt(...)` then `resolve(...)` before clearing that pending member.

### Completeness and type audit

Every production path, finite template campaign ID/date, case ID, profile count, assertion ID, task string, policy literal, CLI verb/flag, backup path/mode, B-rooted receipt child, final output path, and Setfarm-owned handoff order is explicit. Fixture-attempt hashes are intentionally absent from campaign bytes because C creates and verifies a fresh identity only after B persists each launch intent; tests reject invented constants and pre-created repositories. The final packet review precedes the packet and cannot reference it. The post-handoff receipt follows the six-file merge, is the sole private final-acceptance authority paired with the tracked packet, and preserves the accepted operational epoch only while every docs-only relation and exact current Setfarm-documentation/Mission-Control-operational HEAD equality resolves. The distinct historical wrapper is archival only and cannot flow into final acceptance or D delivery.

## Execution Handoff

Execute with subagent-driven development as already approved: one implementation task per worker, followed by specification and quality review. Merge the source PR and prove clean main before Tasks 7-8 perform live fleet, cold rehearsal, or tracked evidence writes.
