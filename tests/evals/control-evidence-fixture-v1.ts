import { taskIntentOracleHashV1 } from "../../src/evals/task-intent-oracle.js";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { registerHooks } from "node:module";
import { randomUUID } from "node:crypto";
import { hashCanonicalJson, canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import { ProductConvergenceSuiteV1Schema } from "../../src/evals/suite-schema.js";
import { createConvergencePreflight, createConvergenceResult, createConvergenceRunResult } from "../../src/evals/result-schema.js";
import type { ConvergenceEvalResultVersioned } from "../../src/evals/result-schema-v2.js";
import { evaluateConvergenceReleaseGate } from "../../src/evals/release-gate.js";
import type { TestContext } from "node:test";

const SOURCE = "b".repeat(40), HASH = "a".repeat(64), TIME = "2026-10-19T00:00:00.000Z";
const CHECKS = ["migration_shape", "migration_attestation", "database", "artifact_capacity", "activity", "protocol_activation"];
// Component evidence only. No fixture value grants actual selection or DB authority.
export async function fixture(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "control-evidence-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repository = path.join(root, "release"), artifacts = path.join(root, "runtime/artifacts"), evals = path.join(root, "runtime/evals");
  for (const dir of [repository, artifacts, evals, path.join(repository, "evals/suites")]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const suite = ProductConvergenceSuiteV1Schema.parse(JSON.parse(fs.readFileSync("evals/suites/product-convergence-v1.json", "utf8")));
  suite.repetitionsPerCase = 1;
  fs.writeFileSync(path.join(repository, "evals/suites/product-convergence-codex-v1.json"), JSON.stringify(suite), { mode: 0o600 });
  const suiteHash = hashCanonicalJson(suite);
  const selected = { directory: root, paths: { root: path.join(root, "runtime"), repository, artifacts, evals }, state: { origin: { sourceSha: SOURCE, installationId: randomUUID() } }, catalogHash: HASH,
    activation: { acknowledged: true, preparedPin: { sha256: HASH }, activatedPin: { sha256: HASH } } };
  const input = { selectionHash: hashCanonicalJson({ schema: "setfarm.manual-control-selection.v1", installationId: selected.state.origin.installationId, sourceSha: SOURCE, installationDir: root, releaseDir: repository, catalogHash: HASH, activationPreparedHash: HASH, activationAcknowledgedHash: HASH }), sourceSha: SOURCE, releaseSha: SOURCE, suiteHash, refs: {} as Record<string, string> };
  const key = randomUUID(); const state = { drift: false }; Reflect.set(globalThis, Symbol.for(key), state);
  t.after(() => Reflect.deleteProperty(globalThis, Symbol.for(key)));
  const source = `const state=globalThis[Symbol.for(${JSON.stringify(key)})]; export const freshInstallationSelectionV1=${JSON.stringify(selected)}; export function assertFreshInstallationSelectionUnchangedV1(){if(state.drift)throw new Error('FIXTURE_SELECTION_DRIFT')}; freshInstallationSelectionV1.assertUnchanged=assertFreshInstallationSelectionUnchangedV1; function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}} freeze(freshInstallationSelectionV1);`;
  const selectionUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const readerUrl = new URL(`../../src/evals/control-evidence-reader-v1.ts?fixture=${key}`, import.meta.url).href;
  const adapterUrl = new URL(`../../src/evals/control-evidence-admission-reader-v1.ts?fixture=${key}`, import.meta.url).href;
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if ([readerUrl, adapterUrl].includes(context.parentURL ?? "")) {
      if (/fresh-installation-selection-v1\.[jt]s$/.test(specifier)) return { url: selectionUrl, shortCircuit: true };
      if (/control-evidence-reader-v1\.[jt]s$/.test(specifier)) return { url: readerUrl, shortCircuit: true };
    }
    return next(specifier, context);
  }});
  let reader: typeof import("../../src/evals/control-evidence-reader-v1.js");
  try { reader = await import(readerUrl); } finally { hooks.deregister(); }
  const activation = { schema: "setfarm.activation-preflight.v1", status: "pass", protocol: "v3", compilerReleaseSha: SOURCE,
    checks: CHECKS.map(id => ({ id, status: "pass", blocking: false, code: "CHECK_PASSED" })) };
  function putActivation(value = activation) {
    const envelope = { schema: "setfarm.semantic-artifact-envelope.v1", artifactType: "setfarm.activation-preflight.v1", producer: { pass: "activation-preflight", codeSha: SOURCE, toolVersions: { node: process.versions.node } }, payload: value };
    const hash = hashCanonicalJson(envelope); fs.writeFileSync(path.join(artifacts, `${hash}.json`), canonicalJsonBytes(envelope), { mode: 0o600 }); input.refs.activationHash = hash; return hash;
  }
  const preflight = createConvergencePreflight({ checks: ["release_identity", "release_cleanliness", "migration_attestation", "database_ownership", "setfarm_health", "mission_control_health", "execution_profile", "result_store"].map(id => ({ id: id as any, status: "pass", code: "CHECK_PASSED", evidenceHash: HASH })) });
  function result(runs: any[] = [], executionMode: "preflight" | "execute" = "preflight", blockerCodes: string[] = []) {
    return createConvergenceResult({ schema: "setfarm.product-convergence-result.v1", suiteId: suite.suiteId, suiteVersion: 1, suiteHash, releaseSha: SOURCE, runnerHash: HASH, environmentHash: HASH,
      startedAt: TIME, finishedAt: TIME, executionMode, status: blockerCodes.includes("EVAL_CANCEL_REQUESTED") ? "blocked" : executionMode === "preflight" ? "planned" : runs.length === 8 ? "pass" : "blocked", plannedRuns: 8, preflight, runs, rootCauseCounts: [], stoppedOnRepeatedRootCause: null, blockerCodes });
  }
  function putEval(value: any) {
    const hash = value.gateHash ?? value.resultHash, leaf = path.join(evals, "sha256", hash.slice(0, 2), `${hash}.json`);
    fs.mkdirSync(path.dirname(leaf), { recursive: true, mode: 0o700 }); fs.writeFileSync(leaf, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); return leaf;
  }
  function storeResult(value: ConvergenceEvalResultVersioned = result()) { putEval(value); input.refs.resultHash = value.resultHash; const gate = evaluateConvergenceReleaseGate(value); putEval(gate); input.refs.gateHash = gate.gateHash; return { result: value, gate }; }
  return { root, repository, artifacts, evals, suite, input, state, reader, adapterUrl, runs: () => suite.cases.map((item, index) => passingRun(suite, item, index, suiteHash, key)), hooksFactory: () => registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === adapterUrl) { if (/fresh-installation-selection-v1\.[jt]s$/.test(specifier)) return { url: selectionUrl, shortCircuit: true }; if (/control-evidence-reader-v1\.[jt]s$/.test(specifier)) return { url: readerUrl, shortCircuit: true }; }
    return next(specifier, context);
  }}), activation, putActivation, result, putEval, storeResult };
}
export function snapshot(root: string): unknown {
  return fs.readdirSync(root).sort().map(name => { const file = path.join(root, name), stat = fs.lstatSync(file); return [name, stat.mode, stat.ino, stat.mtimeMs, stat.isDirectory() ? snapshot(file) : fs.readFileSync(file).toString("base64")]; });
}

// Schema-valid component facts; this creates no operational evidence or DB admission.
function passingRun(suite: any, item: any, index: number, suiteHash: string, identity: string) {
  const accepted = item.oracle.expectedDecision.kind === "accepted_candidate", count = accepted ? 1 : 0;
  const oraclePayload = { schema: "setfarm.task-intent-oracle-evaluation.v1", oracleHash: taskIntentOracleHashV1(item.task, item.oracle), expectedDecision: item.oracle.expectedDecision.kind, actualDecision: item.oracle.expectedDecision.kind,
    contractComplete: true, decisionEvidenceVerified: true, matchedIntentIds: [], requiredEvidenceRefs: [], mismatchCodes: [] };
  const stack = accepted ? item.oracle.expectedDecision.stackPackId : null;
  return createConvergenceRunResult({ schema: "setfarm.product-convergence-run-result.v1", suiteId: suite.suiteId, suiteVersion: 1, suiteHash, caseId: item.caseId, caseHash: hashCanonicalJson(item), productClass: item.productClass,
    repetition: 1, runId: `reader-${identity}-${index}`, runNumber: index + 1, protocol: "v3", releaseSha: SOURCE, taskHash: hashCanonicalJson(item.task), oracleHash: taskIntentOracleHashV1(item.task, item.oracle), expectedDecision: item.oracle.expectedDecision.kind,
    expectedProviderHash: HASH, expectedModelHash: HASH, expectedStackHash: HASH, runnerHash: HASH, environmentHash: HASH, expectedStackPackId: stack, actualStackPackId: stack, runtimeAdapter: accepted ? "browser" : null,
    startedAt: TIME, finishedAt: TIME, disposition: accepted ? "completed" : "failed", passed: true, rootCauseHash: null,
    canonical: { stateHash: HASH,
      packet: { stateHash: HASH, packetHash: accepted ? HASH : null, casAuditHash: HASH, casDeepVerified: accepted, sealedStackPackId: stack, packetRows: count, artifactRefs: count, missingRequiredRefs: 0, missingArtifacts: 0, invalidBindings: 0 },
      attempts: { stateHash: HASH, attempts: count, active: 0, duplicateActiveTuples: 0, staleOwnership: 0, incompleteBindings: 0 },
      findings: { stateHash: HASH, findingSets: 0, openFindings: 0, invalidBindings: 0 },
      recovery: { stateHash: HASH, cases: 0, activeCases: 0, activeDeliveries: 0, overBudget: 0, invalidBindings: 0 },
      evidence: { stateHash: HASH, predicateCoverageHash: HASH, bundles: count, passing: count, nonPassing: 0, missingAttemptEvidence: 0, invalidBindings: 0, missingExpectedPredicates: 0, unexpectedProductPredicates: 0, missingInvariantRefs: 0, nonPassingRequiredPredicates: 0 },
      acceptance: { stateHash: HASH, candidateHash: accepted ? HASH : null, candidates: count, storyEvidence: count, sourceSha: accepted ? SOURCE : null, sourceTreeHash: accepted ? SOURCE : null, invalidBindings: 0 },
      oracle: { ...oraclePayload, evaluationHash: hashCanonicalJson(oraclePayload) }, invariantCodes: [] },
    projection: { setfarmSnapshotHash: HASH, missionControlSnapshotHash: HASH, exactHashMatch: true, setfarmProjection: "complete", missionControlProjection: "complete", operationalSettled: true,
      capabilities: Object.fromEntries(["attempts", "claimBinding", "runtimeOwnership", "managerCompletion", "effectLedger", "findingRecovery", "evidenceLedger", "acceptedCandidate", "deploymentReceipt", "projectTransferAck"].map(key => [key, true])),
      transferAcknowledged: accepted, projectTransferAckHash: accepted ? HASH : null, projectRecordHash: accepted ? HASH : null },
    ownership: { stateHash: HASH, openClaims: 0, activeAttempts: 0, activeRuntimes: 0, activeRecoveryDeliveries: 0, manualProjectMutationDetected: false, sourceHeadMatchesCanonical: true,
      projectHeadSha: accepted ? SOURCE : null, projectTreeHash: accepted ? SOURCE : null, canonicalHeadSha: accepted ? SOURCE : null, canonicalTreeHash: accepted ? SOURCE : null },
    github: { stateHash: HASH, pullRequests: count, unverified: 0, open: 0 } });
}

