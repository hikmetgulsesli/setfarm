import {
  BuildTopologyV1Schema,
  type BuildTopologyV1,
} from "../product-compiler/schemas/build-topology-v1.js";
import {
  ProductSpecV1OrV2Schema,
  type ProductSpecV1OrV2,
} from "../product-compiler/schemas/product-spec-v2.js";
import { isPlatformOwnedV3PreviewCommand } from "../product-compiler/stack-topology-catalog.js";
import {
  RuntimeEvidenceContractV1Schema,
  type RuntimeEvidenceContractV1,
} from "./runtime-evidence-contract-v1.js";

export const RUNTIME_EVIDENCE_CONTRACT_PRODUCER_VERSION = "1.2.0";

const WEB_STACK_PACKS = new Set([
  "nextjs-web-app",
  "vite-react-web-app",
  "static-html-site",
  "browser-game-canvas",
]);

function jsonPointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

export type RuntimeEvidenceContractProductionV1 =
  | Readonly<{
      status: "produced";
      contract: Extract<RuntimeEvidenceContractV1, { adapter: "browser-service" }>;
    }>
  | Readonly<{
      status: "unsupported";
      stackPackId: string;
    }>
  | Readonly<{
      status: "rejected";
      rejectionCode:
        | "RUNTIME_EVIDENCE_ENTRY_ROUTE_AMBIGUOUS"
        | "RUNTIME_EVIDENCE_ENTRYPOINT_UNBOUND"
        | "RUNTIME_EVIDENCE_PREVIEW_COMMAND_AMBIGUOUS"
        | "RUNTIME_EVIDENCE_RUNTIME_TOKENS_MISSING";
    }>;

export function produceRuntimeEvidenceContractV1(input: Readonly<{
  productSpec: ProductSpecV1OrV2;
  buildTopology: BuildTopologyV1;
}>): RuntimeEvidenceContractProductionV1 {
  const productSpec = ProductSpecV1OrV2Schema.parse(input.productSpec);
  const buildTopology = BuildTopologyV1Schema.parse(input.buildTopology);
  const stackPackId = buildTopology.stackPack.id;
  if (!WEB_STACK_PACKS.has(stackPackId)) {
    return Object.freeze({ status: "unsupported", stackPackId });
  }

  const previewCommands = buildTopology.commands.filter((command) => command.kind === "preview");
  if (previewCommands.length !== 1) {
    return Object.freeze({ status: "rejected", rejectionCode: "RUNTIME_EVIDENCE_PREVIEW_COMMAND_AMBIGUOUS" });
  }
  const entryRoutes = productSpec.routes.filter((route) => route.entry);
  if (entryRoutes.length !== 1) {
    return Object.freeze({ status: "rejected", rejectionCode: "RUNTIME_EVIDENCE_ENTRY_ROUTE_AMBIGUOUS" });
  }
  const entryRoute = entryRoutes[0]!;
  const runtimeEntrypoints = buildTopology.entrypoints.filter((entrypoint) =>
    ["web", "game"].includes(entrypoint.kind) && entrypoint.routeRefs.includes(entryRoute.id));
  if (runtimeEntrypoints.length !== 1) {
    return Object.freeze({ status: "rejected", rejectionCode: "RUNTIME_EVIDENCE_ENTRYPOINT_UNBOUND" });
  }
  const preview = previewCommands[0]!;
  const runtimeEnvironment = isPlatformOwnedV3PreviewCommand(preview)
    ? { HOST: "{{HOST}}", PORT: "{{PORT}}" }
    : undefined;
  const runtimeTokens = [
    ...preview.argv,
    ...Object.values(runtimeEnvironment ?? {}),
  ].join("\u0000");
  if (!runtimeTokens.includes("{{HOST}}") || !runtimeTokens.includes("{{PORT}}")) {
    return Object.freeze({ status: "rejected", rejectionCode: "RUNTIME_EVIDENCE_RUNTIME_TOKENS_MISSING" });
  }

  const contract = RuntimeEvidenceContractV1Schema.parse({
    schema: "setfarm.runtime-evidence-contract.v1",
    adapter: "browser-service",
    stackPackId,
    server: {
      argv: [...preview.argv],
      cwd: preview.cwd,
      timeoutMs: preview.timeoutMs,
      ...(runtimeEnvironment ? { env: runtimeEnvironment } : {}),
    },
    readiness: {
      method: "GET",
      path: entryRoute.path,
      expectedStatus: 200,
      timeoutMs: Math.min(preview.timeoutMs, 300_000),
    },
    capture: {
      schema: "setfarm.browser-state-capture.v1",
      globalName: "__SETFARM_TEST_BRIDGE__",
      actionInvocation: {
        schema: "setfarm.browser-action-invocation.v1",
        method: "invokeAction",
      },
      scenarioMode: {
        schema: "setfarm.browser-scenario-mode.v1",
        globalName: "__SETFARM_SCENARIO_MODE__",
        value: "manual",
      },
      stateBindings: productSpec.states
        .map((state) => ({ stateRef: state.id, pointer: `/states/${jsonPointerToken(state.id)}` }))
        .sort((left, right) => left.stateRef.localeCompare(right.stateRef)),
    },
    flowIsolation: {
      schema: "setfarm.browser-flow-isolation.v1",
      method: "clear-local-session-storage-and-reload",
    },
  });
  if (contract.adapter !== "browser-service") {
    throw new Error("RUNTIME_EVIDENCE_BROWSER_CONTRACT_TYPE_MISMATCH");
  }
  return Object.freeze({ status: "produced", contract });
}
