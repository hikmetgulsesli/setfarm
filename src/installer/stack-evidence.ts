import type { StackContract } from "./stack-contract/types.js";
import { resolveStackContract } from "./stack-contract/reconcile.js";
import { writeStackContract } from "./stack-contract/ledger.js";

export type EvidenceClass = "build" | "test" | "smoke" | "dom" | "visual" | "security" | "deploy";

const BROWSER_PACKS = new Set(["nextjs-web-app", "vite-react-web-app", "static-html-site", "browser-game-canvas", "desktop-electron"]);
const NATIVE_PACKS = new Set(["react-native-expo", "android-app", "ios-app"]);
const SERVER_PACKS = new Set(["node-express-api", "python-web"]);
const CLI_PACKS = new Set(["node-cli", "python-cli"]);

export function resolveOperationalStackContract(context: Record<string, string>, persist = true): StackContract {
  const repoPath = context["story_workdir"] || context["repo"] || context["REPO"] || "";
  const taskText = context["prd"] || context["task"] || context["TASK"] || "";
  const contract = resolveStackContract({
    repoPath: repoPath || undefined,
    taskText,
    projectSlug: context["project_slug"] || context["PROJECT_SLUG"] || undefined,
  });
  if (persist && repoPath && contract.status === "resolved") {
    writeStackContract(repoPath, contract);
  }
  return contract;
}

export function isBrowserRuntimeStack(contract: Pick<StackContract, "packId" | "verification"> | null | undefined): boolean {
  if (!contract) return false;
  if (contract.packId && BROWSER_PACKS.has(contract.packId)) return true;
  const verification = contract.verification || { build: [], smoke: [], dom: [], visual: [], tests: [] };
  const text = [
    ...(verification.smoke || []),
    ...(verification.dom || []),
    ...(verification.visual || []),
  ].join(" ").toLowerCase();
  return /\b(browser|route|dom|playwright|screenshot|web page|viewport)\b/.test(text);
}

export function stackRuntimeKind(contract: Pick<StackContract, "packId"> | null | undefined): "browser" | "native" | "server" | "cli" | "unknown" {
  const packId = contract?.packId || "";
  if (BROWSER_PACKS.has(packId)) return "browser";
  if (NATIVE_PACKS.has(packId)) return "native";
  if (SERVER_PACKS.has(packId)) return "server";
  if (CLI_PACKS.has(packId)) return "cli";
  return "unknown";
}

export function stackEvidenceSummary(contract: StackContract): string {
  const verification = contract.verification || { build: [], smoke: [], dom: [], visual: [], tests: [] };
  const parts = [
    verification.build?.length ? `build=${verification.build.join("; ")}` : "",
    verification.tests?.length ? `tests=${verification.tests.join("; ")}` : "",
    verification.smoke?.length ? `smoke=${verification.smoke.join("; ")}` : "",
    verification.dom?.length ? `dom=${verification.dom.join("; ")}` : "",
    verification.visual?.length ? `visual=${verification.visual.join("; ")}` : "",
  ].filter(Boolean);
  return parts.join(" | ") || "no stack-specific verification contract";
}

export function stackEvidenceMetadata(contract: StackContract): Record<string, unknown> {
  return {
    stackPackId: contract.packId || "needs-reconcile",
    stackStatus: contract.status,
    stackConfidence: contract.confidence,
    runtimeKind: stackRuntimeKind(contract),
    browserRuntime: isBrowserRuntimeStack(contract),
    verification: contract.verification,
  };
}

export function evidenceClassesForStep(stepId: string, contract: StackContract): EvidenceClass[] {
  const browser = isBrowserRuntimeStack(contract);
  if (stepId === "verify") return browser ? ["build", "test", "smoke", "dom", "visual"] : ["build", "test", "smoke"];
  if (stepId === "supervise") return browser ? ["dom", "visual"] : ["smoke"];
  if (stepId === "security-gate") return ["security"];
  if (stepId === "qa-test") return browser ? ["smoke", "dom", "visual"] : ["smoke"];
  if (stepId === "final-test") return browser ? ["build", "test", "smoke", "dom", "visual"] : ["build", "test", "smoke"];
  if (stepId === "deploy") return ["deploy"];
  return [];
}
