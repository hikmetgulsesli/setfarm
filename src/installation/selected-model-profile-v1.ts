import type { ModelExecutionProfileV1 } from "../execution/operational-retry-directive.js";

/** Pure identity projection. Selection, credentials and runtime admission belong to callers. */
export function projectSelectedModelExecutionProfileV1(
  input: Readonly<{ runtime: string | undefined; codexModel: string | undefined }>,
  selection: "primary" | "fallback" = "primary",
): ModelExecutionProfileV1 {
  if (selection !== "primary" && selection !== "fallback") {
    throw new Error("FRESH_V3_EXECUTION_PROFILE_REFUSED");
  }
  if (input.runtime === "subscription") {
    return Object.freeze({
      schema: "setfarm.model-execution-profile.v1" as const,
      providerId: selection === "primary" ? "minimax" : "kimi",
      modelId: selection === "primary" ? "minimax/MiniMax-M3.1-Flash" : "kimi/k3.1-pro",
      selection,
    });
  }
  if (input.runtime !== "codex" || typeof input.codexModel !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,193}$/.test(input.codexModel)) {
    throw new Error("FRESH_V3_EXECUTION_PROFILE_REFUSED");
  }
  if (selection === "fallback") throw new Error("FRESH_V3_FALLBACK_PROFILE_UNAVAILABLE");
  return Object.freeze({
    schema: "setfarm.model-execution-profile.v1" as const,
    providerId: "codex",
    modelId: `codex/${input.codexModel}`,
    selection,
  });
}
