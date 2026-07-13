import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

import { ContentAddressedArtifactStore } from "../product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  ActionIdSchema,
  SurfaceIdSchema,
} from "../product-compiler/schemas/common-v1.js";
import { computeAttemptDedupeKey } from "../execution/lease-fence.js";
import type { ExecutionAttemptReservationV1 } from "../execution/schemas/execution-attempt-v1.js";
import {
  ContractReplayFixtureV1Schema,
  ExpectedAttemptResultV1Schema,
  ExpectedCompilationResultV1Schema,
  type ContractReplayFixtureV1,
} from "./contract-fixture-schema.js";
import {
  contractReplayTable,
  createContractReplayReport,
  stableContractReplayJson,
  type ContractReplayFixtureResultV1,
  type ContractReplayReportV1,
} from "./contract-replay-report.js";

const ContractRelationsV1Schema = z.object({
  schema: z.literal("setfarm.fixture.contract-relations.v1"),
  declaredActions: z.array(z.object({
    actionRef: ActionIdSchema,
    surfaceRef: SurfaceIdSchema,
  }).strict()),
  projectedActions: z.array(z.object({
    actionRef: ActionIdSchema,
    surfaceRef: SurfaceIdSchema,
  }).strict()),
  knownSurfaces: z.array(SurfaceIdSchema),
  renames: z.array(z.object({
    fromActionRef: ActionIdSchema,
    toActionRef: ActionIdSchema,
  }).strict()),
}).strict();

const IntegrationGapV1Schema = z.object({
  generatedScreenReceivesActions: z.boolean(),
  persistenceExists: z.boolean(),
  savePayloadBindingExists: z.boolean(),
}).strict();

const RevisionContinuityV1Schema = z.object({
  correctHead: z.object({
    sha: z.string().regex(/^[a-f0-9]{40}$/),
    treeHash: z.string().regex(/^[a-f0-9]{40}$/),
    committedAt: z.string().min(1),
    containsIntegratedActions: z.boolean(),
  }).strict(),
  laterBase: z.object({
    sha: z.string().regex(/^[a-f0-9]{40}$/),
    treeHash: z.string().regex(/^[a-f0-9]{40}$/),
    committedAt: z.string().min(1),
    containsIntegratedActions: z.boolean(),
  }).strict(),
  observedLifecycle: z.object({
    correctHeadBranchDeletedBeforeNextClaim: z.boolean(),
    nextClaimStartedFromLaterBase: z.boolean(),
  }).strict(),
}).strict();

const ObservationV1Schema = z.object({
  id: z.string().min(1).max(500),
  checkId: z.string().min(1).max(500),
  status: z.enum(["pass", "fail", "warning", "running", "pending", "skipped"]),
  summary: z.string().max(2_000).optional(),
  detail: z.string().max(4_000).optional(),
}).strict();

type LoadedSource = Readonly<{
  locator: string;
  mediaType: string;
  bytes: Buffer;
  text: string;
  json?: unknown;
}>;

type ReplayAnalysis = Readonly<{
  status: "rejected" | "sealed";
  diagnosticCodes: string[];
  exactBindings: Array<{
    actionRef: string;
    generatedLocalId: string;
    provenance: "same_element";
  }>;
  sourceRevisionChanged: boolean;
}>;

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compare);
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertWithin(root: string, target: string): void {
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("FIXTURE_PATH_ESCAPE");
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function resolveFixtureFile(root: string, locator: string): Promise<string> {
  const candidate = path.resolve(root, locator);
  assertWithin(root, candidate);
  const canonical = await realpath(candidate);
  assertWithin(root, canonical);
  const info = await lstat(candidate);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`FIXTURE_FILE_NOT_REGULAR:${locator}`);
  }
  return canonical;
}

async function listRelativeFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => compare(left.name, right.name))) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error("FIXTURE_SYMLINK_FORBIDDEN");
    if (entry.isDirectory()) files.push(...await listRelativeFiles(root, absolute));
    else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join("/"));
    else throw new Error("FIXTURE_ENTRY_UNSUPPORTED");
  }
  return files.sort(compare);
}

async function loadFixtureSources(
  fixtureRoot: string,
  fixture: ContractReplayFixtureV1,
): Promise<LoadedSource[]> {
  const declared = fixture.sources.map((source) => source.locator).sort(compare);
  const actual = (await listRelativeFiles(path.join(fixtureRoot, "sources")))
    .map((locator) => `sources/${locator}`)
    .sort(compare);
  if (hashCanonicalJson(declared) !== hashCanonicalJson(actual)) {
    throw new Error(`FIXTURE_SOURCE_SET_DRIFT:${fixture.caseId}`);
  }
  const loaded: LoadedSource[] = [];
  for (const source of fixture.sources.slice().sort((left, right) => compare(left.locator, right.locator))) {
    const absolute = path.resolve(fixtureRoot, source.locator);
    assertWithin(fixtureRoot, absolute);
    const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`FIXTURE_SOURCE_NOT_REGULAR:${source.locator}`);
    const canonicalPath = await realpath(absolute);
    assertWithin(fixtureRoot, canonicalPath);
    const bytes = await readFile(canonicalPath);
    if (sha256(bytes) !== source.sha256) {
      throw new Error(`FIXTURE_SOURCE_HASH_DRIFT:${fixture.caseId}:${source.locator}`);
    }
    const text = bytes.toString("utf8");
    let json: unknown;
    if (source.mediaType === "application/json") json = JSON.parse(text);
    loaded.push({
      locator: source.locator,
      mediaType: source.mediaType,
      bytes,
      text,
      ...(json === undefined ? {} : { json }),
    });
  }
  return loaded;
}

function collectOwnedActionRefs(value: unknown, refs: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectOwnedActionRefs(item, refs));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record["ownedAction"] && typeof record["ownedAction"] === "object") {
    const action = record["ownedAction"] as Record<string, unknown>;
    if (typeof action["id"] === "string" && ActionIdSchema.safeParse(action["id"]).success) {
      refs.add(action["id"]);
    }
  }
  Object.values(record).forEach((item) => collectOwnedActionRefs(item, refs));
}

function analyzeSources(sources: readonly LoadedSource[]): ReplayAnalysis {
  const diagnostics = new Set<string>();
  const declaredActions = new Set<string>();
  const bindings: ReplayAnalysis["exactBindings"] = [];
  let sourceRevisionChanged = false;

  for (const source of sources) {
    if (source.json !== undefined) collectOwnedActionRefs(source.json, declaredActions);
    const relations = ContractRelationsV1Schema.safeParse(source.json);
    if (relations.success) {
      relations.data.declaredActions.forEach((action) => declaredActions.add(action.actionRef));
      if (relations.data.renames.some((rename) => rename.fromActionRef !== rename.toActionRef)) {
        diagnostics.add("CONTRACT_ACTION_RENAMED");
      }
      const knownSurfaces = new Set(relations.data.knownSurfaces);
      if (relations.data.declaredActions.some((action) => !knownSurfaces.has(action.surfaceRef))) {
        diagnostics.add("LINK_UNRESOLVED_SURFACE");
      }
    }

    const gap = IntegrationGapV1Schema.safeParse(source.json);
    if (gap.success) {
      if (!gap.data.generatedScreenReceivesActions) diagnostics.add("LINK_ACTION_PROP_UNBOUND");
      if (gap.data.persistenceExists && !gap.data.savePayloadBindingExists) {
        diagnostics.add("CONTRACT_PERSISTENCE_BINDING_MISSING");
      }
    }

    const continuity = RevisionContinuityV1Schema.safeParse(source.json);
    if (continuity.success) {
      const changed = continuity.data.correctHead.sha !== continuity.data.laterBase.sha
        || continuity.data.correctHead.treeHash !== continuity.data.laterBase.treeHash;
      if (
        changed
        && continuity.data.observedLifecycle.correctHeadBranchDeletedBeforeNextClaim
        && continuity.data.observedLifecycle.nextClaimStartedFromLaterBase
      ) {
        diagnostics.add("ATTEMPT_SOURCE_REVISION_CHANGED");
        sourceRevisionChanged = true;
      }
    }

    const observations = z.array(ObservationV1Schema).safeParse(source.json);
    if (observations.success) {
      const firstRequiredFailure = observations.data.findIndex((observation) =>
        observation.status === "fail"
        && /(?:runtime\.interaction|evidence\.artifact|evidence_runner)/.test(observation.checkId));
      const laterAggregatePass = observations.data.findIndex((observation, index) =>
        index > firstRequiredFailure
        && observation.status === "pass"
        && /(?:^|\.)(?:evidence|product_supervisor)$/.test(observation.checkId));
      if (firstRequiredFailure >= 0 && laterAggregatePass > firstRequiredFailure) {
        diagnostics.add("EVIDENCE_REQUIRED_CHILD_FAILED");
      }
    }

    if (source.mediaType === "text/html") {
      for (const match of source.text.matchAll(/<(button|input|select|textarea|a)\b([^>]*)>/gi)) {
        const attributes = match[2] ?? "";
        if (!/\b(?:id|data-action|data-control-id)\s*=/.test(attributes)) {
          diagnostics.add("LINK_CONTROL_ID_UNSPECIFIED");
        }
      }
    }
  }

  for (const source of sources.filter((item) => item.mediaType === "text/typescript")) {
    for (const match of source.text.matchAll(/<(input|select|textarea|button|div)\b([^>]*)>/gi)) {
      const kind = match[1]!.toLowerCase();
      const attributes = match[2] ?? "";
      const actionRef = attributes.match(/\bdata-action=["'](ACT_[A-Z0-9_]+)["']/)?.[1];
      if (!actionRef) continue;
      const localId = attributes.match(/\bdata-action-id=["']([^"']+)["']/)?.[1];
      const hasHandler = /\bon(?:Click|Change|Input|Submit)=/.test(attributes);
      if (["input", "select", "textarea"].includes(kind) && !localId && !hasHandler) {
        diagnostics.add("LINK_CONTROL_VALUE_UNBOUND");
      }
      if (!["input", "select", "textarea", "button"].includes(kind) && !localId && !hasHandler) {
        diagnostics.add("CONTRACT_STATE_BINDING_MISSING");
      }
      if (localId && declaredActions.has(actionRef)) {
        bindings.push({ actionRef, generatedLocalId: localId, provenance: "same_element" });
      }
    }
  }

  const diagnosticCodes = uniqueSorted([...diagnostics]);
  const exactBindings = bindings
    .filter((binding, index, all) => all.findIndex((candidate) =>
      candidate.actionRef === binding.actionRef
      && candidate.generatedLocalId === binding.generatedLocalId
      && candidate.provenance === binding.provenance) === index)
    .sort((left, right) => compare(
      `${left.actionRef}\0${left.generatedLocalId}`,
      `${right.actionRef}\0${right.generatedLocalId}`,
    ));
  return {
    status: diagnosticCodes.length > 0 ? "rejected" : "sealed",
    diagnosticCodes,
    exactBindings,
    sourceRevisionChanged,
  };
}

export class InMemoryAttemptDecisionModel {
  readonly #dedupeKeys = new Set<string>();

  reserve(input: ExecutionAttemptReservationV1): Readonly<{
    status: "reserved" | "duplicate";
    dedupeKey: string | null;
  }> {
    const dedupeKey = computeAttemptDedupeKey(input);
    if (!dedupeKey) return { status: "reserved", dedupeKey: null };
    if (this.#dedupeKeys.has(dedupeKey)) return { status: "duplicate", dedupeKey };
    this.#dedupeKeys.add(dedupeKey);
    return { status: "reserved", dedupeKey };
  }
}

function evaluateAttempt(
  fixture: ContractReplayFixtureV1,
  analysis: ReplayAnalysis,
  sourceAggregateHash: string,
  compilationArtifactHash: string,
): z.infer<typeof ExpectedAttemptResultV1Schema> | undefined {
  if (!fixture.expected.attemptResult) return undefined;
  if (analysis.sourceRevisionChanged) {
    return {
      schema: "setfarm.expected-attempt-result.v1",
      disposition: "source_revision_changed",
      dedupeEligible: false,
      diagnosticCodes: ["ATTEMPT_SOURCE_REVISION_CHANGED"],
    };
  }
  const packetIdentityHash = hashCanonicalJson({
    schema: "setfarm.eval-contract-identity.v1",
    productClass: fixture.productClass,
    sourceAggregateHash,
  });
  const findingSetHash = hashCanonicalJson({
    schema: "setfarm.eval-finding-set.v1",
    diagnosticCodes: analysis.diagnosticCodes,
  });
  const sourceSha = fixture.provenance.find((item) => item.revision)?.revision ?? sourceAggregateHash;
  const reservation: ExecutionAttemptReservationV1 = {
    runId: `eval:${fixture.caseId}`,
    stepId: "implement",
    storyId: fixture.caseId,
    attemptClass: "product_implementation",
    packetHash: packetIdentityHash,
    compilationReportHash: compilationArtifactHash,
    sourceBefore: { sha: sourceSha, treeHash: sourceAggregateHash },
    findingSetHash,
    role: "developer",
    evidenceRefs: [],
  };
  const model = new InMemoryAttemptDecisionModel();
  model.reserve(reservation);
  const repeated = model.reserve(reservation);
  return {
    schema: "setfarm.expected-attempt-result.v1",
    disposition: repeated.status,
    dedupeEligible: repeated.dedupeKey !== null,
    diagnosticCodes: repeated.status === "duplicate" ? ["ATTEMPT_DUPLICATE_UNCHANGED_SOURCE"] : [],
  };
}

function compilerCodeSha(): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim().toLowerCase();
}

function expectedProjection(analysis: ReplayAnalysis) {
  return ExpectedCompilationResultV1Schema.parse({
    schema: "setfarm.expected-compilation-result.v1",
    status: analysis.status,
    diagnosticCodes: analysis.diagnosticCodes,
    exactBindings: analysis.exactBindings,
  });
}

export async function runContractReplay(options: Readonly<{
  fixtureRoot?: string;
}> = {}): Promise<ContractReplayReportV1> {
  const fixtureRoot = path.resolve(options.fixtureRoot ?? "evals/fixtures");
  const fixtureRootReal = await realpath(fixtureRoot);
  const entries = await readdir(fixtureRootReal, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(compare);
  if (directories.length === 0) throw new Error("FIXTURE_ROOT_EMPTY");
  const codeSha = compilerCodeSha();
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "setfarm-contract-replay-artifacts-"));
  const artifactStore = new ContentAddressedArtifactStore(path.join(artifactRoot, "sha256"));
  const results: ContractReplayFixtureResultV1[] = [];
  try {
    for (const directory of directories) {
      const root = path.resolve(fixtureRootReal, directory);
      assertWithin(fixtureRootReal, root);
      const fixturePath = await resolveFixtureFile(root, "fixture.json");
      const fixture = ContractReplayFixtureV1Schema.parse(await readJson(fixturePath));
      if (fixture.caseId !== directory) throw new Error(`FIXTURE_CASE_DIRECTORY_MISMATCH:${directory}`);
      const sources = await loadFixtureSources(root, fixture);
      const sourceAggregateHash = hashCanonicalJson({
        schema: "setfarm.fixture-source-aggregate.v1",
        sources: fixture.sources
          .map((source) => ({ locator: source.locator, sha256: source.sha256 }))
          .sort((left, right) => compare(left.locator, right.locator)),
      });
      const analysis = analyzeSources(sources);
      const replayedAnalysis = analyzeSources(sources);
      if (hashCanonicalJson(analysis) !== hashCanonicalJson(replayedAnalysis)) {
        throw new Error(`NONDETERMINISTIC_COMPILATION_RESULT:${fixture.caseId}`);
      }
      const compilation = expectedProjection(analysis);
      const expectedCompilationPath = await resolveFixtureFile(
        root,
        fixture.expected.compilationResult,
      );
      const expectedCompilation = ExpectedCompilationResultV1Schema.parse(await readJson(expectedCompilationPath));
      if (hashCanonicalJson(compilation) !== hashCanonicalJson(expectedCompilation)) {
        throw new Error(`EXPECTED_COMPILATION_MISMATCH:${fixture.caseId}`);
      }
      const compilationArtifact = await artifactStore.put({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: "setfarm.contract-replay-compilation.v1",
        producer: {
          pass: "contract-replay",
          codeSha,
          toolVersions: {},
        },
        payload: compilation,
      });
      const attempt = evaluateAttempt(
        fixture,
        analysis,
        sourceAggregateHash,
        compilationArtifact.hash,
      );
      if (fixture.expected.attemptResult) {
        const expectedAttemptPath = await resolveFixtureFile(
          root,
          fixture.expected.attemptResult,
        );
        const expectedAttempt = ExpectedAttemptResultV1Schema.parse(await readJson(expectedAttemptPath));
        if (!attempt || hashCanonicalJson(attempt) !== hashCanonicalJson(expectedAttempt)) {
          throw new Error(`EXPECTED_ATTEMPT_MISMATCH:${fixture.caseId}`);
        }
      } else if (attempt) {
        throw new Error(`UNEXPECTED_ATTEMPT_RESULT:${fixture.caseId}`);
      }
      results.push({
        caseId: fixture.caseId,
        productClass: fixture.productClass,
        sourceAggregateHash,
        compilation: {
          status: compilation.status,
          diagnosticCodes: compilation.diagnosticCodes,
          exactBindings: compilation.exactBindings,
          artifactHash: compilationArtifact.hash,
        },
        ...(attempt ? {
          attempt: {
            disposition: attempt.disposition,
            dedupeEligible: attempt.dedupeEligible,
            diagnosticCodes: attempt.diagnosticCodes,
          },
        } : {}),
        expectedMatched: true,
      });
    }
  } finally {
    await rm(artifactRoot, { recursive: true, force: true });
  }
  results.sort((left, right) => compare(left.caseId, right.caseId));
  return createContractReplayReport({
    schema: "setfarm.contract-replay-report.v1",
    compilerCodeSha: codeSha,
    fixtures: results,
    summary: {
      fixtures: results.length,
      passed: results.length,
      failed: 0,
      productClasses: new Set(results.map((result) => result.productClass)).size,
      rejected: results.filter((result) => result.compilation.status === "rejected").length,
      sealed: results.filter((result) => result.compilation.status === "sealed").length,
    },
  });
}

function parseArgs(argv: readonly string[]): { fixtureRoot?: string } {
  const result: { fixtureRoot?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--fixtures") {
      const next = argv[index + 1];
      if (!next) throw new Error("CLI_FIXTURE_ROOT_MISSING");
      result.fixtureRoot = next;
      index += 1;
      continue;
    }
    throw new Error(`CLI_UNKNOWN_ARGUMENT:${value}`);
  }
  return result;
}

async function main(): Promise<void> {
  const report = await runContractReplay(parseArgs(process.argv.slice(2)));
  process.stdout.write(stableContractReplayJson(report));
  process.stderr.write(contractReplayTable(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
