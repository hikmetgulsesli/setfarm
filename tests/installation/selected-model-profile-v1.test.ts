/** Direct pure projection tests; no selected-installation or credential capture. */
import assert from "node:assert/strict";
import { test } from "node:test";

let api: typeof import("../../src/installation/selected-model-profile-v1.js") | undefined;
try {
  api = await import("../../src/installation/selected-model-profile-v1.js");
} catch (error) {
  const missing = error as { code?: unknown; url?: unknown };
  const urls = [".js", ".ts"].map(extension =>
    new URL("../../src/installation/selected-model-profile-v1" + extension, import.meta.url).href);
  if (missing.code !== "ERR_MODULE_NOT_FOUND" || !urls.includes(missing.url as string)) throw error;
}
const project = api?.projectSelectedModelExecutionProfileV1;

test("pure selected profile projection provides subscription execution profiles", () => {
  assert.equal(typeof project, "function", "subscription profile projection capability is missing");
});

test("explicit subscription maps primary and bounded fallback to detached frozen profiles", { skip: !api }, () => {
  const input = { runtime: "subscription", codexModel: "ignored-codex-model" };
  const primary = project!(input);
  assert.deepEqual(primary, { schema: "setfarm.model-execution-profile.v1", providerId: "minimax",
    modelId: "minimax/MiniMax-M3.1-Flash", selection: "primary" });
  assert.deepEqual(project!(input, "fallback"), { schema: "setfarm.model-execution-profile.v1", providerId: "kimi",
    modelId: "kimi/k3.1-pro", selection: "fallback" });
  assert.equal(Object.getPrototypeOf(primary), Object.prototype);
  assert.ok(Object.isFrozen(primary));
  assert.ok(Object.isFrozen(project!(input, "fallback")));
  input.runtime = "codex";
  assert.equal(primary.modelId, "minimax/MiniMax-M3.1-Flash");
});

test("Codex projection preserves exact qualified model and refuses selected fallback", { skip: !api }, () => {
  assert.deepEqual(project!({ runtime: "codex", codexModel: "org/gpt-6.1-sol" }), {
    schema: "setfarm.model-execution-profile.v1", providerId: "codex",
    modelId: "codex/org/gpt-6.1-sol", selection: "primary",
  });
  assert.throws(() => project!({ runtime: "codex", codexModel: "gpt-6.1-sol" }, "fallback"),
    { message: "FRESH_V3_FALLBACK_PROFILE_UNAVAILABLE" });
  for (const codexModel of [undefined, "", " bad", "a b", "-option", "x\ny", "x".repeat(195)]) {
    assert.throws(() => project!({ runtime: "codex", codexModel }),
      { message: "FRESH_V3_EXECUTION_PROFILE_REFUSED" });
  }
});

test("missing or unknown runtime and invalid selection cannot choose a hidden provider", { skip: !api }, () => {
  for (const runtime of [undefined, "", "openclaw", "gateway", "Subscription", " subscription"]) {
    assert.throws(() => project!({ runtime, codexModel: "gpt-6.1-sol" }),
      { message: "FRESH_V3_EXECUTION_PROFILE_REFUSED" });
  }
  assert.throws(() => project!({ runtime: "subscription", codexModel: undefined }, "other" as never),
    { message: "FRESH_V3_EXECUTION_PROFILE_REFUSED" });
});

test("exact annual selector chooses Kimi primary and MiniMax fallback while absence retains the existing pair", () => {
  assert.ok(project);
  assert.deepEqual(project!({ runtime: "subscription", codexModel: undefined,
    subscriptionPrimaryModel: "kimi/k3.1-pro" } as never), {
    schema: "setfarm.model-execution-profile.v1", providerId: "kimi", modelId: "kimi/k3.1-pro", selection: "primary",
  });
  assert.deepEqual(project!({ runtime: "subscription", codexModel: undefined,
    subscriptionPrimaryModel: "kimi/k3.1-pro" } as never, "fallback"), {
    schema: "setfarm.model-execution-profile.v1", providerId: "minimax", modelId: "minimax/MiniMax-M3.1-Flash", selection: "fallback",
  });
  for (const selection of ["primary", "fallback"] as const) assert.deepEqual(
    project!({ runtime: "subscription", codexModel: undefined, subscriptionPrimaryModel: "minimax/MiniMax-M3.1-Flash" } as never, selection),
    project!({ runtime: "subscription", codexModel: undefined }, selection));
});

test("subscription primary selector refuses partial foreign blank and normalized aliases", () => {
  for (const subscriptionPrimaryModel of [null, "", "kimi", "k3.1-pro", "kimi/K3.1-Pro", " kimi/k3.1-pro", "kimi/k3.1-pro ", "minimax/other", "codex/gpt-6.1-sol"])
    assert.throws(() => project!({ runtime: "subscription", codexModel: undefined, subscriptionPrimaryModel } as never),
      { message: "FRESH_V3_EXECUTION_PROFILE_REFUSED" });
  assert.deepEqual(project!({ runtime: "codex", codexModel: "gpt-6.1-sol", subscriptionPrimaryModel: "ignored-foreign-selector" } as never), {
    schema: "setfarm.model-execution-profile.v1", providerId: "codex", modelId: "codex/gpt-6.1-sol", selection: "primary",
  });
});
