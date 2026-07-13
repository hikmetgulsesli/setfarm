import type { z } from "zod";

import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  ProvenanceRefV1Schema,
  type ProvenanceRefV1,
  type SourceArtifactRefV1,
} from "../schemas/common-v1.js";

export type AdapterResult<T> = Readonly<{
  candidate?: T;
  diagnostics: CompilationDiagnosticV1[];
  provenance: ProvenanceRefV1[];
}>;

export function provenanceFromSource(
  source: SourceArtifactRefV1,
  confidence: ProvenanceRefV1["confidence"],
  options: {
    lineStart?: number;
    lineEnd?: number;
    jsonPointer?: string;
    note?: string;
  } = {},
): ProvenanceRefV1 {
  return ProvenanceRefV1Schema.parse({
    schema: "setfarm.provenance-ref.v1",
    sourceHash: source.hash,
    locator: source.locator,
    confidence,
    ...(options.jsonPointer !== undefined ? { jsonPointer: options.jsonPointer } : {}),
    ...(options.lineStart !== undefined && options.lineEnd !== undefined
      ? { range: { startLine: options.lineStart, endLine: options.lineEnd } }
      : {}),
    ...(options.note ? { note: options.note } : {}),
  });
}

export function adapterDiagnostic(input: {
  code: string;
  category?: CompilationDiagnosticV1["category"];
  severity: CompilationDiagnosticV1["severity"];
  message: string;
  source?: SourceArtifactRefV1;
  reference?: string;
  provenance?: ProvenanceRefV1[];
  suggestions?: CompilationDiagnosticV1["suggestions"];
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: input.category ?? "adapter",
    severity: input.severity,
    message: input.message,
    ...(input.source ? { artifactHash: input.source.hash } : {}),
    ...(input.reference ? { reference: input.reference } : {}),
    provenance: input.provenance ?? [],
    suggestions: input.suggestions ?? [],
  });
}

export function invalidCandidateDiagnostics(
  code: string,
  source: SourceArtifactRefV1 | undefined,
  error: z.ZodError,
): CompilationDiagnosticV1[] {
  return error.issues.slice(0, 100).map((issue) => adapterDiagnostic({
    code,
    severity: "error",
    message: `Contract validation failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
    source,
    reference: issue.path.join("/") || "$",
  }));
}

export function finalizeAdapterResult<T>(input: {
  candidate?: T;
  diagnostics?: CompilationDiagnosticV1[];
  provenance?: ProvenanceRefV1[];
}): AdapterResult<T> {
  return {
    ...(input.candidate !== undefined ? { candidate: input.candidate } : {}),
    diagnostics: sortCompilationDiagnostics(input.diagnostics ?? []),
    provenance: [...(input.provenance ?? [])],
  };
}
