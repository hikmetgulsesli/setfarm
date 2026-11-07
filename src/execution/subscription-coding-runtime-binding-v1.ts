import { posix } from "node:path";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { ClaimEnvelopeV1Schema, type ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import type { ProcessIdentityV1 } from "./schemas/process-identity-v1.js";
import type { ModelExecutionProfileV1 } from "./operational-retry-directive.js";
import type { V3ImplementationContext } from "./v3-implementation-handoff.js";
import { V3StageClaimHandoffV1Schema, type V3StageClaimHandoffV1 } from "./v3-stage-execution-context.js";
import { isSubscriptionRuntimeCanonicalPathV1, parseSubscriptionRuntimeAuthorityV1,
  parseSubscriptionRuntimeBindingV1, type SubscriptionRuntimeAuthorityV1,
  type SubscriptionRuntimeBindingV1, type SubscriptionRuntimeClosureV1,
  subscriptionRuntimePreparationHashV1 } from "./subscription-runtime-attachment-v1.js";
export { subscriptionRuntimePreparationHashV1 } from "./subscription-runtime-attachment-v1.js";

/** DATA helpers only. No selected installation, credential, database or OS admission. */
export function subscriptionRuntimeRefusedV1(): never { throw new Error("SUBSCRIPTION_RUNTIME_AUTHORITY_REFUSED"); }
export function sameSubscriptionRuntimeDataV1(a: unknown, b: unknown): boolean {
  return canonicalJsonStringify(a) === canonicalJsonStringify(b);
}
export function deriveSubscriptionCodingRuntimePathsV1(input: Readonly<{ runtimeRoot: string; runtimeSessionId: string }>) {
  if (!isSubscriptionRuntimeCanonicalPathV1(input.runtimeRoot)
    || !/^RTS_[A-Za-z0-9-]{16,160}$/.test(input.runtimeSessionId)) subscriptionRuntimeRefusedV1();
  const container = `${input.runtimeRoot}/attempt-workspaces/subscription/${input.runtimeSessionId}`;
  return Object.freeze({ container, runtimePath: `${container}/owner`, root: `${container}/worker`, transcriptPath: `${container}/worker-output.log` });
}
export type SubscriptionCodingCanonicalAuthorityV1 = V3ImplementationContext | V3StageClaimHandoffV1;
export function projectSubscriptionCodingRuntimeBindingV1(input: Readonly<{
  envelope: ClaimEnvelopeV1; authority: SubscriptionCodingCanonicalAuthorityV1;
  runtimeSessionId: string; ownerInstanceId: string; selectedProfile: ModelExecutionProfileV1; platformSourceSha: string;
}>): SubscriptionRuntimeBindingV1 {
  const envelope = ClaimEnvelopeV1Schema.parse(input.envelope), authority = input.authority;
  if (envelope.protocol !== "v3" || !isSubscriptionRuntimeCanonicalPathV1(envelope.workdir)) subscriptionRuntimeRefusedV1();
  const profile = input.selectedProfile;
  if (!((profile.providerId === "minimax" && profile.modelId === "minimax/MiniMax-M3.1-Flash")
    || (profile.providerId === "kimi" && profile.modelId === "kimi/k3.1-pro"))
    || (profile.selection !== "primary" && profile.selection !== "fallback")) subscriptionRuntimeRefusedV1();
  if (authority.schema === "setfarm.implementation-context.v3") {
    // Complete schema admission belongs to the genuine facade. Keep this DATA
    // projector off implementation schema's eager selected-profile import.
    const h = authority.handoff;
    if (authority.handoffHash !== hashCanonicalJson(h) || !envelope.attempt
      || h.runId !== envelope.runId || h.stepId !== envelope.stepId || h.workflowStepId !== envelope.workflowStepId
      || h.storyId !== envelope.storyId || h.storyDbId !== envelope.storyDbId || h.claimId !== envelope.claimId
      || h.attemptId !== envelope.attempt.attemptId || h.attemptGeneration !== envelope.attempt.generation
      || h.workdir !== envelope.workdir || !sameSubscriptionRuntimeDataV1(h.executionProfile, profile)) subscriptionRuntimeRefusedV1();
  } else {
    const c = V3StageClaimHandoffV1Schema.parse(authority).context;
    if (profile.selection !== "primary" || c.runId !== envelope.runId || c.stepId !== envelope.stepId
      || c.workflowStepId !== envelope.workflowStepId || c.workdir !== envelope.workdir
      || c.claim.claimId !== envelope.claimId || c.claim.claimAgentId !== envelope.claimAgentId
      || c.claim.runtimeAgentId !== envelope.runtimeAgentId || c.claim.claimGeneration !== envelope.claimGeneration
      || c.claim.issuedAt !== envelope.issuedAt
      || (c.story?.storyId ?? undefined) !== envelope.storyId || (c.story?.storyDbId ?? undefined) !== envelope.storyDbId
      || (c.story?.attemptId ?? undefined) !== envelope.attempt?.attemptId
      || (c.story?.attemptGeneration ?? undefined) !== envelope.attempt?.generation) subscriptionRuntimeRefusedV1();
  }
  const common = { runtimeSessionId: input.runtimeSessionId, claimId: envelope.claimId, ownerInstanceId: input.ownerInstanceId,
    modelRef: profile.modelId, sourceSha: input.platformSourceSha, worktree: envelope.workdir };
  return parseSubscriptionRuntimeBindingV1(envelope.attempt
    ? { kind: "execution-attempt", ...common, ...envelope.attempt }
    : { kind: "stage-claim", ...common });
}
export function isSubscriptionRuntimePathV1(runtimePath: string | null | undefined): boolean {
  return typeof runtimePath === "string" && isSubscriptionRuntimeCanonicalPathV1(runtimePath)
    && /\/attempt-workspaces\/subscription\/RTS_[A-Za-z0-9-]{16,160}\/owner$/.test(runtimePath);
}
/** Exact published-process DATA join; observing or starting a process is not implied. */
export function assertSubscriptionRuntimePublishedWorkerV1(session: Readonly<{
  pid?: number; processStartedAt?: string; processGroupId?: number; processIdentity?: ProcessIdentityV1;
}>, worker: Readonly<{processIdentity: ProcessIdentityV1}>): void {
  const expected = worker.processIdentity;
  if (expected.schema !== "setfarm.process-identity.v1" || expected.source !== "observed_os"
    || !Number.isSafeInteger(expected.pid) || expected.pid <= 0
    || !Number.isSafeInteger(expected.processGroupId) || !expected.processGroupId || expected.processGroupId <= 0
    || typeof expected.processStartedAt !== "string" || !Number.isFinite(Date.parse(expected.processStartedAt))
    || session.pid !== expected.pid
    || session.processStartedAt !== expected.processStartedAt || session.processGroupId !== expected.processGroupId
    || !session.processIdentity || !sameSubscriptionRuntimeDataV1(session.processIdentity, expected)) subscriptionRuntimeRefusedV1();
}
export function parseSubscriptionRuntimeClosureV1(value: unknown): SubscriptionRuntimeClosureV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) subscriptionRuntimeRefusedV1();
  const v = value as Record<string, unknown>;
  const keys = ["binding", "attachmentHash", "status", "broker", "worker", "evidenceRefs"];
  if (Reflect.ownKeys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))
    || typeof v.attachmentHash !== "string" || !/^[a-f0-9]{64}$/.test(v.attachmentHash)
    || ![v.status, v.broker, v.worker].every(x => x === "closed" || x === "custody-uncertain")
    || (v.status === "closed" && (v.broker !== "closed" || v.worker !== "closed"))
    || !Array.isArray(v.evidenceRefs) || v.evidenceRefs.length > 100
    || !v.evidenceRefs.every(x => typeof x === "string" && x.length > 0 && x.length <= 500 && !/[\x00-\x1f\x7f]/.test(x))) subscriptionRuntimeRefusedV1();
  return Object.freeze({ binding: parseSubscriptionRuntimeBindingV1(v.binding), attachmentHash: v.attachmentHash,
    status: v.status, broker: v.broker, worker: v.worker, evidenceRefs: Object.freeze([...v.evidenceRefs]) }) as SubscriptionRuntimeClosureV1;
}
export type SubscriptionRuntimeStartSeedV1 = Readonly<{
  schema: "setfarm.subscription-runtime-start.v1";
  binding: SubscriptionRuntimeBindingV1; authority: SubscriptionRuntimeAuthorityV1; attachmentHash: string;
  envelope: ClaimEnvelopeV1; runtimePath: string; transcriptPath: string;
  attemptContract: Readonly<Record<string, unknown>> | null;
}>;
export function parseSubscriptionRuntimeStartSeedV1(value: unknown): SubscriptionRuntimeStartSeedV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) subscriptionRuntimeRefusedV1();
  const v = value as SubscriptionRuntimeStartSeedV1;
  const keys = ["schema", "binding", "authority", "attachmentHash", "envelope", "runtimePath", "transcriptPath", "attemptContract"];
  if (Reflect.ownKeys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) subscriptionRuntimeRefusedV1();
  const binding = parseSubscriptionRuntimeBindingV1(v.binding), authority = parseSubscriptionRuntimeAuthorityV1(v.authority, binding);
  if (v.schema !== "setfarm.subscription-runtime-start.v1" || !isSubscriptionRuntimePathV1(v.runtimePath)
    || !isSubscriptionRuntimeCanonicalPathV1(v.transcriptPath)
    || v.runtimePath !== posix.dirname(v.transcriptPath) + "/owner"
    || posix.basename(v.transcriptPath) !== "worker-output.log"
    || v.attachmentHash !== subscriptionRuntimePreparationHashV1(binding, authority)) subscriptionRuntimeRefusedV1();
  const envelope = ClaimEnvelopeV1Schema.parse(v.envelope);
  if (binding.claimId !== envelope.claimId || binding.worktree !== envelope.workdir
    || (binding.kind === "execution-attempt" ? (!envelope.attempt || binding.attemptId !== envelope.attempt.attemptId
      || binding.generation !== envelope.attempt.generation || binding.fenceToken !== envelope.attempt.fenceToken) : !!envelope.attempt)
    || (binding.kind === "execution-attempt" ? !v.attemptContract : v.attemptContract !== null)) subscriptionRuntimeRefusedV1();
  return Object.freeze({ ...v, binding, authority, envelope });
}
