import type postgres from "postgres";
import { ControlEvidenceExpectedV1Schema, type ControlEvidenceExpectedV1, type ControlEvidenceProjectionV1 } from "../execution/schemas/manual-control-job-v1.js";
import { V3ReleaseAdmissionV1Schema } from "../execution/v3-release-admission.js";
import { assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { readSelectedControlEvidenceSnapshotV1 } from "./control-evidence-reader-v1.js";

type AdmissionRow = {
  admission_hash: unknown; kind: unknown; release_sha: unknown; suite_hash: unknown;
  result_hash: unknown; result_ref: unknown; gate_hash: unknown; gate_ref: unknown;
  expires_at: unknown; payload: unknown;
};

/** Private captured-owner observation, never a workflow admission authority. */
export async function readSelectedControlEvidenceWithAdmissionV1(
  input: ControlEvidenceExpectedV1,
  sql: postgres.Sql,
): Promise<ControlEvidenceProjectionV1> {
  const snapshot = await readSelectedControlEvidenceSnapshotV1(input);
  const projection = snapshot.projection, report = projection.evaluation.report;
  if (!snapshot.candidate || !report || projection.evaluation.availability.state !== "available"
    || report.compatibility !== "current" || report.executionMode !== "execute" || report.resultStatus !== "pass"
    || report.gateDecision !== "go" || report.cases.length !== 8
    || report.cases.some(row => row.evidenceState !== "recorded" || row.passed !== true)) return projection;
  const expected = ControlEvidenceExpectedV1Schema.parse(input);
  snapshot.assertUnchanged();
  let code: string | null;
  try {
    code = await sql.begin("isolation level repeatable read read only", async transaction => {
      await transaction.unsafe(
        "SELECT pg_catalog.set_config('lock_timeout', $1, true), pg_catalog.set_config('statement_timeout', $2, true)",
        ["1000", "5000"],
      );
      const rows = await transaction.unsafe<AdmissionRow[]>(
        `SELECT admission_hash, kind, release_sha, suite_hash,
                result_hash, result_ref, gate_hash, gate_ref, expires_at, payload
           FROM public.v3_release_admissions
          WHERE kind = 'release_go' AND release_sha = $1
          LIMIT 2`,
        [expected.releaseSha],
      );
      if (rows.length === 0) return "CONTROL_RELEASE_ADMISSION_MISSING";
      if (rows.length !== 1) return "CONTROL_RELEASE_ADMISSION_CONFLICT";
      const row = rows[0]!;
      const parsed = V3ReleaseAdmissionV1Schema.safeParse(row.payload);
      if (!parsed.success || parsed.data.kind !== "release_go") return "CONTROL_RELEASE_ADMISSION_INVALID";
      const admission = parsed.data;
      const exact = admission.admissionHash === row.admission_hash && admission.kind === row.kind
        && admission.releaseSha === row.release_sha && admission.suiteHash === row.suite_hash
        && admission.result.hash === row.result_hash && admission.result.ref === row.result_ref
        && admission.gate.hash === row.gate_hash && admission.gate.ref === row.gate_ref && row.expires_at === null
        && admission.releaseSha === expected.releaseSha && admission.suiteHash === expected.suiteHash
        && admission.result.hash === report.resultHash && admission.gate.hash === report.gateHash
        && admission.preflightHash === snapshot.candidate!.preflightHash && admission.issuedAt === snapshot.candidate!.finishedAt;
      return exact ? null : "CONTROL_RELEASE_ADMISSION_INVALID";
    });
  } catch {
    // Includes transaction completion errors: a callback observation alone is
    // insufficient. Never cache positive rows or rewrite artifact-derived truth.
    code = "CONTROL_RELEASE_ADMISSION_UNKNOWN";
  }
  assertFreshInstallationSelectionUnchangedV1();
  snapshot.assertUnchanged();
  return { ...projection, evaluation: {
    availability: { state: "available", code },
    report: { ...report, qualification: code === null ? "qualified" : "unqualified" },
  } };
}
