import {
  CompilationDiagnosticV1Schema,
  type CompilationDiagnosticV1,
} from "./schemas/compilation-report-v1.js";

export function makeCompilationDiagnostic(value: unknown): CompilationDiagnosticV1 {
  return CompilationDiagnosticV1Schema.parse(value);
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function diagnosticSortKey(value: CompilationDiagnosticV1): string {
  return [
    value.category,
    value.code,
    value.artifactHash ?? "",
    value.reference ?? "",
    value.message,
  ].join("\0");
}

export function sortCompilationDiagnostics(
  values: readonly CompilationDiagnosticV1[],
): CompilationDiagnosticV1[] {
  return values
    .map((value) => CompilationDiagnosticV1Schema.parse(value))
    .sort((left, right) => compareUtf16(diagnosticSortKey(left), diagnosticSortKey(right)));
}
