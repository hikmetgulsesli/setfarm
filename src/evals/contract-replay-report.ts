import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  ActionIdSchema,
  Sha256Schema,
} from "../product-compiler/schemas/common-v1.js";

const DiagnosticCodeSchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/).max(160);

const ReplayBindingV1Schema = z.object({
  actionRef: ActionIdSchema,
  generatedLocalId: z.string().min(1).max(500),
  provenance: z.enum(["structured_index", "same_element", "exact_manifest"]),
}).strict();

const ReplayCompilationV1Schema = z.object({
  status: z.enum(["rejected", "sealed"]),
  diagnosticCodes: z.array(DiagnosticCodeSchema),
  exactBindings: z.array(ReplayBindingV1Schema),
  artifactHash: Sha256Schema,
}).strict();

const ReplayAttemptV1Schema = z.object({
  disposition: z.enum([
    "duplicate",
    "source_revision_changed",
    "active_conflict",
    "reserved",
    "not_applicable",
  ]),
  dedupeEligible: z.boolean(),
  diagnosticCodes: z.array(DiagnosticCodeSchema),
}).strict();

const ReplayFixtureResultV1Schema = z.object({
  caseId: z.string().min(1).max(160),
  productClass: z.enum(["utility", "operations", "game", "content", "service", "other"]),
  sourceAggregateHash: Sha256Schema,
  compilation: ReplayCompilationV1Schema,
  attempt: ReplayAttemptV1Schema.optional(),
  expectedMatched: z.literal(true),
}).strict();

const ReplaySummaryV1Schema = z.object({
  fixtures: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  productClasses: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  sealed: z.number().int().nonnegative(),
}).strict();

const ContractReplayPayloadV1Schema = z.object({
  schema: z.literal("setfarm.contract-replay-report.v1"),
  compilerCodeSha: z.string().regex(/^[a-f0-9]{7,64}$/),
  fixtures: z.array(ReplayFixtureResultV1Schema),
  summary: ReplaySummaryV1Schema,
}).strict();

export const ContractReplayReportV1Schema = ContractReplayPayloadV1Schema.extend({
  reportHash: Sha256Schema,
}).strict();

export type ContractReplayFixtureResultV1 = z.infer<typeof ReplayFixtureResultV1Schema>;
export type ContractReplayReportV1 = z.infer<typeof ContractReplayReportV1Schema>;

export function createContractReplayReport(input: unknown): ContractReplayReportV1 {
  const payload = ContractReplayPayloadV1Schema.parse(input);
  return ContractReplayReportV1Schema.parse({
    ...payload,
    reportHash: hashCanonicalJson(payload),
  });
}

export function stableContractReplayJson(report: ContractReplayReportV1): string {
  return `${JSON.stringify(ContractReplayReportV1Schema.parse(report), null, 2)}\n`;
}

export function contractReplayTable(report: ContractReplayReportV1): string {
  const rows = report.fixtures.map((fixture) => {
    const diagnostics = fixture.compilation.diagnosticCodes.join(",") || "-";
    return [
      fixture.caseId,
      fixture.productClass,
      fixture.compilation.status,
      fixture.attempt?.disposition ?? "-",
      diagnostics,
    ];
  });
  const headers = ["CASE", "CLASS", "PACKET", "ATTEMPT", "DIAGNOSTICS"];
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => row[index]!.length),
  ));
  const format = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index]!)).join("  ").trimEnd();
  return [
    format(headers),
    format(widths.map((width) => "-".repeat(width))),
    ...rows.map(format),
    `PASS ${report.summary.passed}/${report.summary.fixtures}  HASH ${report.reportHash}`,
  ].join("\n") + "\n";
}
