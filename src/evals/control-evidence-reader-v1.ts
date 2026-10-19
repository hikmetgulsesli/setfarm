import { constants, lstatSync, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { ControlEvidenceExpectedV1Schema, ControlEvidenceProjectionV1Schema, hashControlSelectionIdentityV1,
  type ControlEvidenceExpectedV1, type ControlEvidenceProjectionV1, type ControlEvidenceAvailabilityV1 } from "../execution/schemas/manual-control-job-v1.js";
import { ActivationPreflightReportV1Schema } from "../execution/schemas/activation-preflight-report-v1.js";
import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-envelope.js";
import { canonicalJsonBytes, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { taskIntentOracleHashV1 } from "./task-intent-oracle.js";
import { taskIntentOracleHashV2 } from "./task-intent-oracle-v2.js";
import { ProductConvergenceSuiteV1Schema } from "./suite-schema.js";
import { ProductConvergenceSuiteV2Schema } from "./suite-schema-v2.js";
import { ConvergenceEvalResultVersionedSchema } from "./result-schema-v2.js";
import { ConvergenceReleaseGateV1Schema, evaluateConvergenceReleaseGate } from "./release-gate.js";

const CAP = 16 * 1024 * 1024;
class EvidenceError extends Error {
  constructor(readonly state: ControlEvidenceAvailabilityV1["state"], readonly code: string) { super(code); }
}
function unsafe(): never { throw new EvidenceError("unsafe", "CONTROL_EVIDENCE_UNSAFE"); }
function invalid(): never { throw new EvidenceError("invalid", "CONTROL_EVIDENCE_INVALID"); }
function same(a: Stats, b: Stats): boolean {
  const identity = (["dev", "ino", "uid", "gid", "mode"] as const).every(key => a[key] === b[key]);
  // Directory sizes/timestamps/link counts describe siblings, not this path's
  // binding. Files retain full link, size and change-time pins.
  return identity && (a.isDirectory() || (["nlink", "size", "mtimeMs", "ctimeMs"] as const).every(key => a[key] === b[key]));
}
type Pin = { locator: string; stat: Stats };
async function boundedRead(locator: string, trustedRoot: string, retained: Pin[]): Promise<Buffer> {
  const pins: Pin[] = [];
  let observedLeaf = false;
  const absolute = path.resolve(locator), root = path.resolve(trustedRoot);
  if (!absolute.startsWith(`${root}${path.sep}`)) unsafe();
  try {
    // Pin every physical ancestor. Shared system ancestors may be root-owned;
    // the captured root and descendants must belong to this process's owner.
    let current = path.parse(absolute).root;
    for (const part of path.dirname(absolute).slice(current.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) unsafe();
      if (current === root || current.startsWith(`${root}${path.sep}`)) {
        if (stat.uid !== process.getuid?.() || (stat.mode & 0o022) !== 0) unsafe();
      }
      pins.push({ locator: current, stat });
    }
    const prior = await fs.lstat(absolute);
    observedLeaf = true;
    if (!prior.isFile() || prior.isSymbolicLink() || prior.nlink !== 1 || prior.uid !== process.getuid?.()
      || (prior.mode & 0o022) !== 0 || prior.size > CAP) unsafe();
    const handle = await fs.open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!same(prior, await handle.stat())) unsafe();
      const bytes = Buffer.alloc(CAP + 1); let offset = 0;
      while (offset < bytes.length) {
        const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (bytesRead === 0) break;
        offset += bytesRead;
      }
      if (offset > CAP || offset !== prior.size || !same(prior, await handle.stat()) || !same(prior, await fs.lstat(absolute))) unsafe();
      for (const pin of pins) if (!same(pin.stat, await fs.lstat(pin.locator))) unsafe();
      retained.push(...pins, { locator: absolute, stat: prior });
      return bytes.subarray(0, offset);
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof EvidenceError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (observedLeaf) unsafe();
      // Disappearance after a pin is a race, not a missing original leaf.
      for (const pin of pins) { try { if (!same(pin.stat, await fs.lstat(pin.locator))) unsafe(); } catch { unsafe(); } }
      throw new EvidenceError("missing", "CONTROL_EVIDENCE_MISSING");
    }
    unsafe();
  }
}
function failure(error: unknown): { availability: ControlEvidenceAvailabilityV1; report: null } {
  return { availability: error instanceof EvidenceError ? { state: error.state, code: error.code }
    : { state: "invalid", code: "CONTROL_EVIDENCE_INVALID" }, report: null };
}
function absent(code: string) { return { availability: { state: "unconfigured" as const, code }, report: null }; }

/** Internal Source-only snapshot; never an HTTP or worker ABI. */
export async function readSelectedControlEvidenceSnapshotV1(input: ControlEvidenceExpectedV1) {
  const retained: Pin[] = [];
  const assertFilesUnchanged = (): void => {
    for (const pin of retained) {
      try { if (!same(pin.stat, lstatSync(pin.locator))) unsafe(); } catch { unsafe(); }
    }
  };
  const assertUnchanged = (): void => { assertFreshInstallationSelectionUnchangedV1(); assertFilesUnchanged(); };
  let candidate: { preflightHash: string; finishedAt: string } | null = null;
  const finish = (projection: ControlEvidenceProjectionV1) => ({ projection, candidate, assertUnchanged });
  assertFreshInstallationSelectionUnchangedV1();
  const selected = freshInstallationSelectionV1;
  if (!selected?.activation?.acknowledged || !selected.activation.activatedPin) {
    return finish({ activation: absent("CONTROL_SELECTION_UNCONFIGURED"), evaluation: absent("CONTROL_SELECTION_UNCONFIGURED") });
  }
  const parsed = ControlEvidenceExpectedV1Schema.safeParse(input);
  if (!parsed.success) return finish({ activation: failure(null), evaluation: failure(null) });
  const expected = parsed.data;
  const selectionHash = hashControlSelectionIdentityV1({ schema: "setfarm.manual-control-selection.v1",
    installationId: selected.state.origin.installationId, sourceSha: selected.state.origin.sourceSha,
    installationDir: selected.directory, releaseDir: selected.paths.repository, catalogHash: selected.catalogHash,
    activationPreparedHash: selected.activation.preparedPin.sha256, activationAcknowledgedHash: selected.activation.activatedPin.sha256 });
  if (expected.selectionHash !== selectionHash || expected.sourceSha !== selected.state.origin.sourceSha) {
    return finish({ activation: failure(null), evaluation: failure(null) });
  }
  const compatibility = expected.releaseSha === expected.sourceSha ? "current" as const : "historical" as const;
  const output: { -readonly [K in keyof ControlEvidenceProjectionV1]: ControlEvidenceProjectionV1[K] } = { activation: absent("CONTROL_REFERENCE_UNCONFIGURED"), evaluation: absent("CONTROL_REFERENCE_UNCONFIGURED") };
  if (expected.refs.activationHash) {
    try {
      const bytes = await boundedRead(path.join(selected.paths.artifacts, `${expected.refs.activationHash}.json`), selected.directory, retained);
      if (createHash("sha256").update(bytes).digest("hex") !== expected.refs.activationHash) invalid();
      const envelope = SemanticArtifactEnvelopeV1Schema.parse(JSON.parse(bytes.toString("utf8")));
      const report = ActivationPreflightReportV1Schema.parse(envelope.payload);
      if (!canonicalJsonBytes({ ...envelope, payload: report }).equals(bytes)
        || envelope.artifactType !== "setfarm.activation-preflight.v1" || envelope.producer.pass !== "activation-preflight"
        || envelope.producer.codeSha !== expected.releaseSha || report.compilerReleaseSha !== expected.releaseSha
        || new Set(report.checks.map(check => check.id)).size !== 6
        || report.checks.some(check => check.blocking !== (check.status === "fail"))
        || report.status !== (report.checks.some(check => check.status === "fail") ? "fail" : "pass")) invalid();
      output.activation = { availability: { state: "available", code: null }, report: { hash: expected.refs.activationHash,
        status: report.status, protocol: report.protocol, compatibility, observedAt: null,
        checks: report.checks.map(({ id, status, blocking, code }) => ({ id, status, blocking, code })) } };
    } catch (error) { output.activation = failure(error); }
  }
  if (expected.refs.resultHash || expected.refs.gateHash) {
    try {
      if (!expected.refs.resultHash || !expected.suiteHash) invalid();
      const raw = JSON.parse((await boundedRead(path.join(selected.paths.repository, "evals/suites/product-convergence-codex-v1.json"), selected.paths.repository, retained)).toString("utf8"));
      const suite = raw.schema === "setfarm.product-convergence-suite.v1" ? ProductConvergenceSuiteV1Schema.parse(raw) : ProductConvergenceSuiteV2Schema.parse(raw);
      if (hashCanonicalJson(suite) !== expected.suiteHash || suite.repetitionsPerCase !== 1) invalid();
      const readEval = (hash: string) => boundedRead(path.join(selected.paths.evals, "sha256", hash.slice(0, 2), `${hash}.json`), selected.directory, retained);
      const bytes = await readEval(expected.refs.resultHash);
      const result = ConvergenceEvalResultVersionedSchema.parse(JSON.parse(bytes.toString("utf8")));
      if (!bytes.equals(Buffer.from(`${JSON.stringify(result, null, 2)}\n`)) || result.resultHash !== expected.refs.resultHash
        || result.releaseSha !== expected.releaseSha || result.suiteHash !== expected.suiteHash || result.suiteId !== suite.suiteId
        || result.suiteVersion !== suite.suiteVersion || result.plannedRuns !== 8) invalid();
      const seen = new Set<string>();
      const runIds = new Set<string>();
      for (const run of result.runs) {
        const item = suite.cases.find(item => item.caseId === run.caseId);
        if (!item || seen.has(run.caseId) || runIds.has(run.runId) || run.repetition !== 1 || run.caseHash !== hashCanonicalJson(item)
          || run.suiteId !== suite.suiteId || run.suiteVersion !== suite.suiteVersion || run.productClass !== item.productClass
          || run.taskHash !== hashCanonicalJson(item.task) || run.oracleHash !== (suite.suiteVersion === 2 ? taskIntentOracleHashV2(item.task, item.oracle) : taskIntentOracleHashV1(item.task, item.oracle))) invalid();
        seen.add(run.caseId);
        runIds.add(run.runId);
      }
      let gate = null;
      if (expected.refs.gateHash) {
        const gateBytes = await readEval(expected.refs.gateHash);
        gate = ConvergenceReleaseGateV1Schema.parse(JSON.parse(gateBytes.toString("utf8")));
        if (!gateBytes.equals(Buffer.from(`${JSON.stringify(gate, null, 2)}\n`)) || gate.gateHash !== expected.refs.gateHash
          || hashCanonicalJson(gate) !== hashCanonicalJson(evaluateConvergenceReleaseGate(result))) invalid();
      }
      const isCandidate = compatibility === "current" && result.executionMode === "execute" && result.status === "pass" && gate?.decision === "go";
      if (isCandidate) candidate = { preflightHash: result.preflight.preflightHash, finishedAt: result.finishedAt };
      output.evaluation = { availability: { state: "available", code: isCandidate ? "CONTROL_RELEASE_ADMISSION_UNOBSERVED" : null }, report: {
        resultHash: result.resultHash, gateHash: gate?.gateHash ?? null, compatibility, executionMode: result.executionMode,
        resultStatus: result.status, gateDecision: gate?.decision ?? null, qualification: compatibility === "historical" ? "historical" : "unqualified",
        preflightChecks: result.preflight.checks.map(({ id, status, code }) => ({ id, status, code })),
        cases: suite.cases.map(item => { const run = result.runs.find(run => run.caseId === item.caseId); return { caseId: item.caseId, repetition: 1,
          evidenceState: run ? "recorded" : "not_started", disposition: run?.disposition ?? null, passed: run?.passed ?? null, runId: run?.runId ?? null, resultHash: run?.resultHash ?? null }; }),
        completedCases: result.runs.length, plannedCases: 8, blockerCodes: result.blockerCodes } };
    } catch (error) { output.evaluation = failure(error); }
  }
  assertFreshInstallationSelectionUnchangedV1();
  try { assertFilesUnchanged(); } catch (error) { candidate = null; return finish({ activation: failure(error), evaluation: failure(error) }); }
  return finish(ControlEvidenceProjectionV1Schema.parse(output));
}

export async function readSelectedControlEvidenceV1(input: ControlEvidenceExpectedV1): Promise<ControlEvidenceProjectionV1> {
  return (await readSelectedControlEvidenceSnapshotV1(input)).projection;
}
