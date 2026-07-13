import { z } from "zod";

import { BuildTopologyV1Schema, type BuildTopologyV1 } from "../schemas/build-topology-v1.js";
import { SourceArtifactRefV1Schema } from "../schemas/common-v1.js";
import {
  adapterDiagnostic,
  finalizeAdapterResult,
  invalidCandidateDiagnostics,
  provenanceFromSource,
  type AdapterResult,
} from "./types.js";

const SetupTopologyAdapterInputSchema = z
  .object({
    sources: z.array(SourceArtifactRefV1Schema).min(1).max(100),
    topology: z.unknown(),
  })
  .strict();

export function adaptSetupTopology(input: unknown): AdapterResult<BuildTopologyV1> {
  const parsed = SetupTopologyAdapterInputSchema.safeParse(input);
  if (!parsed.success) {
    return finalizeAdapterResult({
      diagnostics: parsed.error.issues.slice(0, 100).map((issue) => adapterDiagnostic({
        code: "ADAPTER_TOPOLOGY_INPUT_INVALID",
        severity: "error",
        message: `Setup topology input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      })),
    });
  }
  const provenance = parsed.data.sources.map((source) =>
    provenanceFromSource(source, "derived_with_provenance"));
  const result = BuildTopologyV1Schema.safeParse(parsed.data.topology);
  if (!result.success) {
    return finalizeAdapterResult({
      diagnostics: invalidCandidateDiagnostics(
        "ADAPTER_TOPOLOGY_CONTRACT_INVALID",
        parsed.data.sources[0],
        result.error,
      ),
      provenance,
    });
  }
  return finalizeAdapterResult({ candidate: result.data, provenance });
}
