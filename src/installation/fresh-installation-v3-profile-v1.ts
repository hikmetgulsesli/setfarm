import {
  assertFreshInstallationSelectionUnchangedV1,
  freshInstallationSelectionV1,
} from "./fresh-installation-selection-v1.js";

const capturedRunnerV1 = process.env.SETFARM_AGENT_RUNTIME;
const capturedModelV1 = process.env.SETFARM_CODEX_MODEL;
let profileRefusedV1 = false;

function refuse(): never {
  profileRefusedV1 = true;
  throw new Error("FRESH_V3_CODEX_PROFILE_REFUSED");
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
