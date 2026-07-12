import { z } from "zod";

import { ProductSpecV1Schema, type ProductSpecV1 } from "../schemas/product-spec-v1.js";
import { SourceArtifactRefV1Schema } from "../schemas/common-v1.js";
import {
  adapterDiagnostic,
  finalizeAdapterResult,
  invalidCandidateDiagnostics,
  provenanceFromSource,
  type AdapterResult,
} from "./types.js";

const LegacyPlanAdapterInputSchema = z
  .object({
    source: SourceArtifactRefV1Schema,
    text: z.string().max(10_000_000),
  })
  .strict();

function structuredCandidates(text: string): unknown[] {
  const candidates: unknown[] = [];
  try {
    candidates.push(JSON.parse(text));
  } catch {
    // Legacy Markdown is expected and is inspected below without inference.
  }
  const fence = /```(?:json|product-spec-v1)\s*\n([\s\S]*?)```/g;
  for (const match of text.matchAll(fence)) {
    try {
      candidates.push(JSON.parse(match[1]!));
    } catch {
      // Invalid structured blocks become diagnostics only if no valid packet exists.
    }
  }
  return candidates;
}

export function adaptLegacyPlan(input: unknown): AdapterResult<ProductSpecV1> {
  const parsedInput = LegacyPlanAdapterInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return finalizeAdapterResult({
      diagnostics: parsedInput.error.issues.slice(0, 100).map((issue) => adapterDiagnostic({
        code: "ADAPTER_PLAN_INPUT_INVALID",
        severity: "error",
        message: `Legacy plan input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      })),
    });
  }

  const { source, text } = parsedInput.data;
  for (const candidate of structuredCandidates(text)) {
    const result = ProductSpecV1Schema.safeParse(candidate);
    if (result.success) {
      return finalizeAdapterResult({
        candidate: result.data,
        provenance: [provenanceFromSource(source, "exact")],
      });
    }
  }

  const diagnostics = [];
  const provenance = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const action = lines[index]!.match(/^### ACTION:\s*(ACT_[A-Z0-9_]+)\s*$/)?.[1];
    if (!action) continue;
    let surface: string | undefined;
    let surfaceLine = index;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^###\s+/.test(lines[cursor]!)) break;
      const match = lines[cursor]!.match(/^- Surface Bound:\s*(SURF_[A-Z0-9_]+)\s*$/);
      if (match) {
        surface = match[1];
        surfaceLine = cursor;
        break;
      }
    }
    const exact = provenanceFromSource(source, "exact", {
      lineStart: index + 1,
      lineEnd: surfaceLine + 1,
    });
    provenance.push(exact);
    diagnostics.push(adapterDiagnostic({
      code: surface ? "ADAPTER_EXACT_ACTION_SURFACE_REF" : "ADAPTER_ACTION_SURFACE_MISSING",
      severity: surface ? "info" : "error",
      message: surface
        ? `Legacy plan explicitly binds ${action} to ${surface}`
        : `Legacy plan action ${action} has no exact surface binding`,
      source,
      reference: surface ? `${action}->${surface}` : action,
      provenance: [exact],
    }));
  }

  if (provenance.length === 0) {
    provenance.push(provenanceFromSource(source, "missing", {
      note: "No exact ProductSpec or ACTION/Surface Bound relation was present",
    }));
  }
  diagnostics.push(adapterDiagnostic({
    code: "CONTRACT_PRODUCT_SPEC_MISSING",
    category: "contract",
    severity: "error",
    message: "Legacy plan text is not a complete strict ProductSpec v1",
    source,
    provenance,
  }));

  const invalidStructured = structuredCandidates(text)
    .map((candidate) => ProductSpecV1Schema.safeParse(candidate))
    .find((result) => !result.success);
  if (invalidStructured && !invalidStructured.success) {
    diagnostics.push(...invalidCandidateDiagnostics(
      "ADAPTER_STRUCTURED_PRODUCT_SPEC_INVALID",
      source,
      invalidStructured.error,
    ));
  }

  return finalizeAdapterResult({ diagnostics, provenance });
}
