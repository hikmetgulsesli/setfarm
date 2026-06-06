import { getStackPack, listStackPacks } from "../stack-contract/packs.js";
import type { StackContract, StackPack, StackPackId } from "../stack-contract/types.js";
import type {
  StackEvidenceClass,
  StackEvidencePlan,
  StackFailureClassification,
  StackFailureInput,
  StackModule,
  StackRuntimeKind,
} from "./types.js";

const BROWSER_PACKS = new Set<StackPackId>(["nextjs-web-app", "vite-react-web-app", "static-html-site", "browser-game-canvas", "desktop-electron"]);
const NATIVE_PACKS = new Set<StackPackId>(["react-native-expo", "android-app", "ios-app"]);
const SERVER_PACKS = new Set<StackPackId>(["node-express-api", "python-web"]);
const CLI_PACKS = new Set<StackPackId>(["node-cli", "python-cli"]);

const BROWSER_INFRA = /(?:\b(agent-browser|browser control|playwright|chromium|chrome|page\.goto|browser|context|target page|webpreviewruntimedriver)\b[\s\S]{0,520}\b(executable doesn't exist|npx playwright install|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EPIPE|timed out|timeout|target page|context or browser has been closed|browser has been closed|target closed|protocol error)\b|\bsystem smoke did not return structured JSON\b|\bsmoke did not return structured JSON\b)/i;
const NATIVE_INFRA = /\b(simulator|emulator|xcodebuild|gradle|adb|expo|maestro)\b[\s\S]{0,420}\b(boot|unavailable|not found|timed out|timeout|connection refused|device not found|license|toolchain|sdk)\b/i;
const TOOLING_INFRA = /\b(tooling_contract_missing|prewarm_failed|command not found|executable doesn't exist|missing browser|missing simulator|missing emulator)\b/i;
const MERGE_BLOCKER = /\b(?:VERIFY_MERGE_BLOCKER|merge conflict|CONFLICTING|DIRTY|unresolved merge conflicts?|conflict markers?)\b/i;
const DESIGN_IMPORT = /\b(?:DESIGN_IMPORT|stitch-to-jsx|generated-screen-validator|SCREEN_MAP)\b/i;
const IMPLEMENT_EVIDENCE = /\b(?:IMPLEMENT_EVIDENCE|runtime evidence|IMPLEMENT_VERIFICATION_REQUEST)\b/i;

function runtimeKindFor(packId: StackPackId): StackRuntimeKind {
  if (BROWSER_PACKS.has(packId)) return "browser";
  if (NATIVE_PACKS.has(packId)) return "native";
  if (SERVER_PACKS.has(packId)) return "server";
  if (CLI_PACKS.has(packId)) return "cli";
  return "unknown";
}

function evidenceClassesFor(stepId: string, runtimeKind: StackRuntimeKind): StackEvidenceClass[] {
  const browser = runtimeKind === "browser";
  if (stepId === "verify") return browser ? ["build", "test", "smoke", "dom", "visual"] : ["build", "test", "smoke"];
  if (stepId === "supervise") return browser ? ["dom", "visual"] : ["smoke"];
  if (stepId === "security-gate") return ["security"];
  if (stepId === "qa-test") return browser ? ["smoke", "dom", "visual"] : ["smoke"];
  if (stepId === "final-test") return browser ? ["build", "test", "smoke", "dom", "visual"] : ["build", "test", "smoke"];
  if (stepId === "deploy") return ["deploy"];
  return [];
}

function classifyFailureFor(packId: StackPackId, input: StackFailureInput): StackFailureClassification {
  const raw = String(input.failure || "");
  const runtimeKind = runtimeKindFor(packId);

  if (BROWSER_INFRA.test(raw)) {
    return {
      owner: "infra",
      action: "infra_retry",
      category: "browser_infra_failure",
      reason: `${packId} browser tooling failed; retry infrastructure without consuming product retry budget.`,
    };
  }
  if (runtimeKind === "native" && NATIVE_INFRA.test(raw)) {
    return {
      owner: "infra",
      action: "infra_retry",
      category: "native_infra_failure",
      reason: `${packId} native tooling failed; retry infrastructure without consuming product retry budget.`,
    };
  }
  if (TOOLING_INFRA.test(raw)) {
    return {
      owner: "infra",
      action: "infra_retry",
      category: "stack_tooling_infra_failure",
      reason: `${packId} stack tooling failed before product behavior could be judged.`,
    };
  }
  if (MERGE_BLOCKER.test(raw)) {
    return {
      owner: "platform",
      action: "platform_bug",
      category: "verify_merge_blocker",
      reason: `${packId} merge blockers require PR/story branch repair, not product retry.`,
    };
  }
  if (DESIGN_IMPORT.test(raw)) {
    return {
      owner: "platform",
      action: "platform_bug",
      category: "design_import_failure",
      reason: `${packId} design import/setup failed before implementation evidence could be trusted.`,
    };
  }
  if (IMPLEMENT_EVIDENCE.test(raw)) {
    return {
      owner: "product",
      action: "product_retry",
      category: "implement_evidence_failure",
      reason: `${packId} implementation evidence failed with stack-owned product evidence.`,
    };
  }

  const stepCategory = input.stepId === "qa-test"
    ? "qa_quality_failure"
    : input.stepId === "final-test"
      ? "final_test_quality_failure"
      : input.stepId === "verify"
        ? "verify_quality_failure"
        : "downstream_quality_failure";
  return {
    owner: "product",
    action: "product_retry",
    category: stepCategory,
    reason: `${packId} product evidence failed in ${input.stepId || "unknown step"}.`,
  };
}

function makeModule(pack: StackPack): StackModule {
  return {
    id: pack.id,
    pack,
    runtimeKind: () => runtimeKindFor(pack.id),
    isBrowserRuntime: () => runtimeKindFor(pack.id) === "browser",
    evidenceClassesForStep: (stepId) => evidenceClassesFor(stepId, runtimeKindFor(pack.id)),
    buildEvidencePlan: (stepId): StackEvidencePlan => ({
      stackPackId: pack.id,
      runtimeKind: runtimeKindFor(pack.id),
      evidenceClasses: evidenceClassesFor(stepId, runtimeKindFor(pack.id)),
      toolPreflightRequired: Boolean(pack.toolPreflight?.some((tool) => tool.required)),
    }),
    classifyFailure: (input) => classifyFailureFor(pack.id, input),
    resolveContract: (base) => base,
  };
}

const MODULES = new Map<StackPackId, StackModule>();
for (const pack of listStackPacks()) MODULES.set(pack.id, makeModule(pack));

export function getStackModule(packId: StackPackId): StackModule {
  const module = MODULES.get(packId);
  if (!module) return makeModule(getStackPack(packId));
  return module;
}

export function listStackModules(): StackModule[] {
  return [...MODULES.values()];
}

export function stackModuleForContract(contract: Pick<StackContract, "packId"> | null | undefined): StackModule | null {
  return contract?.packId ? getStackModule(contract.packId) : null;
}

export function classifyStackFailure(packId: StackPackId, input: StackFailureInput): StackFailureClassification {
  return getStackModule(packId).classifyFailure(input);
}
