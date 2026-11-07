import {
  assertFreshInstallationSelectionUnchangedV1,
  freshInstallationSelectionV1,
} from "./fresh-installation-selection-v1.js";
import { projectSelectedModelExecutionProfileV1 } from "./selected-model-profile-v1.js";
import type { ModelExecutionProfileV1 } from "../execution/operational-retry-directive.js";

const capturedRunnerV1 = process.env.SETFARM_AGENT_RUNTIME;
const capturedModelV1 = process.env.SETFARM_CODEX_MODEL;
const capturedSubscriptionPrimaryModelV1 = process.env.SETFARM_SUBSCRIPTION_PRIMARY_MODEL;
let profileRefusedV1 = false;

function refuse(): never {
  profileRefusedV1 = true;
  throw new Error("FRESH_V3_CODEX_PROFILE_REFUSED");
}

function refuseExecutionProfile(): never {
  profileRefusedV1 = true;
  throw new Error("FRESH_V3_EXECUTION_PROFILE_REFUSED");
}

/** Captured selection only; never adopt a runtime or installation selected later. */
export function assertSelectedFreshExecutionProfileUnchangedV1(): void {
  assertFreshInstallationSelectionUnchangedV1();
  if (!freshInstallationSelectionV1) return;
  if (profileRefusedV1 || process.env.SETFARM_AGENT_RUNTIME !== capturedRunnerV1
    || process.env.SETFARM_CODEX_MODEL !== capturedModelV1
    || (capturedRunnerV1 === "subscription" && process.env.SETFARM_SUBSCRIPTION_PRIMARY_MODEL !== capturedSubscriptionPrimaryModelV1)
    || (capturedRunnerV1 !== "codex" && capturedRunnerV1 !== "subscription")) refuseExecutionProfile();
  freshInstallationSelectionV1.assertUnchanged();
}

export function readSelectedFreshExecutionProfileV1(
  selection: "primary" | "fallback" = "primary",
): ModelExecutionProfileV1 | null {
  assertSelectedFreshExecutionProfileUnchangedV1();
  if (!freshInstallationSelectionV1) return null;
  try {
    return projectSelectedModelExecutionProfileV1({ runtime: capturedRunnerV1, codexModel: capturedModelV1,
      subscriptionPrimaryModel: capturedSubscriptionPrimaryModelV1 }, selection);
  } catch (error) {
    // Unsupported Codex retry does not retarget or poison a valid primary profile.
    if (error instanceof Error && error.message === "FRESH_V3_FALLBACK_PROFILE_UNAVAILABLE") throw error;
    return refuseExecutionProfile();
  }
}

/** Inert import; absent models refuse only when an actual V3 profile is read. */
export function assertSelectedFreshCodexProfileUnchangedV1(): void {
  assertFreshInstallationSelectionUnchangedV1();
  if (!freshInstallationSelectionV1) return;
  if (profileRefusedV1 || process.env.SETFARM_AGENT_RUNTIME !== capturedRunnerV1
    || process.env.SETFARM_CODEX_MODEL !== capturedModelV1) refuse();
  freshInstallationSelectionV1.assertUnchanged();
}

export function readSelectedFreshCodexExecutionProfileV1(): Readonly<{
  schema: "setfarm.model-execution-profile.v1";
  providerId: "codex";
  modelId: string;
  selection: "primary";
}> | null {
  assertSelectedFreshCodexProfileUnchangedV1();
  if (!freshInstallationSelectionV1) return null;
  if (capturedRunnerV1 !== "codex" || typeof capturedModelV1 !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,193}$/.test(capturedModelV1)) refuse();
  // codex identifies the actual CLI adapter. It does not attest a remote
  // provider/backend response. The raw --model argument is bound below.
  return Object.freeze({ schema: "setfarm.model-execution-profile.v1" as const,
    providerId: "codex" as const, modelId: `codex/${capturedModelV1}`,
    selection: "primary" as const });
}

/** Validate the real immutable handoff before producing the exact raw argv. */
export function selectedFreshCodexModelArgumentsV1(profile: Readonly<{
  providerId: string; modelId: string; selection: "primary" | "fallback";
}>): string[] {
  const expected = readSelectedFreshCodexExecutionProfileV1();
  if (!expected || profile.providerId !== expected.providerId
    || profile.modelId !== expected.modelId || profile.selection !== expected.selection) refuse();
  return ["--model", capturedModelV1!];
}
