import { DEFAULT_ARTIFACT_CAPACITY_LIMITS } from "../product-compiler/artifact-capacity.js";

/** Fixed fresh-instance policy; generic installations retain their own defaults. */
export const FRESH_INSTALLATION_ARTIFACT_CAPACITY_LIMITS_V1 = Object.freeze({
  ...DEFAULT_ARTIFACT_CAPACITY_LIMITS,
  minFreeBytes: 8 * 1024 ** 3,
});
