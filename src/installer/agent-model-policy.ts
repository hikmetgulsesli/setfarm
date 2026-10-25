export const MINIMAX_SUBSCRIPTION_MODEL_REF = "minimax/MiniMax-M3.1-Flash";
export const KIMI_CODING_MODEL_REF = "kimi/k3.1-pro";

function isOldPlatformPreset(model: unknown): boolean {
  const isOldPrimary = (value: unknown) =>
    value === "minimax/MiniMax-M3" || value === "minimax-openai/MiniMax-M3";
  if (isOldPrimary(model)) return true;
  if (model === null || typeof model !== "object" || Array.isArray(model)) return false;
  const keys = Reflect.ownKeys(model);
  if (keys.length !== 2 || !keys.includes("primary") || !keys.includes("fallbacks")) return false;
  const { primary, fallbacks } = model as Record<string, unknown>;
  return isOldPrimary(primary) && Array.isArray(fallbacks) && fallbacks.length === 1
    && (fallbacks[0] === "kimi/kimi-for-coding" || fallbacks[0] === "kimi-coding/kimi-for-coding");
}

/** Preserve explicit and custom selections; migrate only exact platform presets. */
export function resolveWorkflowAgentModel(explicitModel: string | undefined, existingModel: unknown): unknown {
  if (explicitModel !== undefined) return explicitModel;
  if (existingModel !== undefined && !isOldPlatformPreset(existingModel)) return existingModel;
  return { primary: MINIMAX_SUBSCRIPTION_MODEL_REF, fallbacks: [KIMI_CODING_MODEL_REF] };
}
