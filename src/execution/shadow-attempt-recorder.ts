import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  lstat,
  readFile,
  readlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { readSetfarmProtocol } from "../product-compiler/protocol.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
} from "../product-compiler/schemas/common-v1.js";
import type {
  AttemptReservationResult,
  FenceUpdateResult,
} from "./attempt-repository.js";
import {
  SourceRevisionV1Schema,
  type ExecutionAttemptReservationV1,
  type ExecutionAttemptV1,
  type SourceRevisionV1,
  type TerminalAttemptDispositionV1,
} from "./schemas/execution-attempt-v1.js";

const MAX_GIT_BUFFER = 64 * 1024 * 1024;

function execGitText(
  cwd: string,
  args: readonly string[],
  timeout: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", [...args], {
      cwd,
      encoding: "utf8",
      timeout,
      maxBuffer: MAX_GIT_BUFFER,
      windowsHide: true,
    }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

const RuntimeIdentityV1Schema = z.object({
  runId: z.string().min(1).max(500),
  stepId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500),
}).strict();

const ShadowClaimInputV1Schema = RuntimeIdentityV1Schema.extend({
  legacyClaimGeneration: z.number().int().nonnegative(),
  role: z.string().min(1).max(500),
  agentId: z.string().min(1).max(500).optional(),
  branch: z.string().min(1).max(1_000),
  worktree: z.string().min(1).max(4_000),
  sourceBefore: SourceRevisionV1Schema,
  packetHash: Sha256Schema.optional(),
  compilationReportHash: Sha256Schema.optional(),
  sliceHash: Sha256Schema.optional(),
  findingSetHash: Sha256Schema.optional(),
}).strict().superRefine((value, context) => {
  if (value.sliceHash && !value.packetHash) {
    context.addIssue({ code: "custom", path: ["sliceHash"], message: "A slice requires a packet" });
  }
});

const ShadowCompletionInputV1Schema = RuntimeIdentityV1Schema.extend({
  sourceAfter: SourceRevisionV1Schema,
  outputHash: Sha256Schema.optional(),
  evidenceRefs: z.array(z.string().min(1).max(500)).max(1_000),
}).strict();

const ShadowFailureInputV1Schema = RuntimeIdentityV1Schema.extend({
  sourceAtFailure: SourceRevisionV1Schema,
}).strict();

export type ShadowDiagnostic = Readonly<{
  event: "product_compiler.shadow_observation" | "product_compiler.shadow_error";
  code: string;
  message: string;
  runId?: string;
  stepId?: string;
  storyId?: string;
  attemptId?: string;
}>;

type ShadowAttemptRepository = Readonly<{
  reserve(input: ExecutionAttemptReservationV1): Promise<AttemptReservationResult>;
  findActive(identity: { runId: string; stepId: string; storyId: string }): Promise<ExecutionAttemptV1 | undefined>;
  complete(input: {
    attemptId: string;
    generation: number;
    fenceToken: string;
    disposition: TerminalAttemptDispositionV1;
    sourceAfter?: SourceRevisionV1;
    outputHash?: string;
    evidenceRefs: string[];
  }): Promise<FenceUpdateResult>;
}>;

export type ShadowRecorderDependencies = Readonly<{
  repository: ShadowAttemptRepository;
  resolveCompilationReportHash(
    input: z.infer<typeof ShadowClaimInputV1Schema>,
  ): Promise<string>;
  emit(event: ShadowDiagnostic): void;
}>;

export type ShadowObservationResult =
  | Readonly<{ status: "observed"; code: string; attempt?: ExecutionAttemptV1 }>
  | Readonly<{ status: "shadow_error"; code: "SHADOW_RECORDER_ERROR" }>;

export type ShadowFailurePreparation =
  | Readonly<{
    status: "prepared";
    capture: {
      attemptId: string;
      generation: number;
      fenceToken: string;
      runId: string;
      stepId: string;
      storyId: string;
      sourceAtFailure: SourceRevisionV1;
    };
  }>
  | Readonly<{ status: "observed"; code: string }>
  | Readonly<{ status: "shadow_error"; code: "SHADOW_RECORDER_ERROR" }>
  | Readonly<{ status: "legacy" }>;

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw.replace(/[\r\n\t]+/g, " ").slice(0, 500) || "Unknown shadow recorder error";
}

function safeEmit(emit: (event: ShadowDiagnostic) => void, event: ShadowDiagnostic): void {
  try { emit(event); } catch { /* observation sink cannot own legacy control flow */ }
}

function identityEvent(
  event: Omit<ShadowDiagnostic, "event"> & { event?: ShadowDiagnostic["event"] },
): ShadowDiagnostic {
  return {
    event: event.event ?? "product_compiler.shadow_observation",
    code: event.code,
    message: event.message.slice(0, 500),
    ...(event.runId ? { runId: event.runId } : {}),
    ...(event.stepId ? { stepId: event.stepId } : {}),
    ...(event.storyId ? { storyId: event.storyId } : {}),
    ...(event.attemptId ? { attemptId: event.attemptId } : {}),
  };
}

export function createShadowAttemptRecorder(dependencies: ShadowRecorderDependencies) {
  const shadowError = (error: unknown, identity: Partial<z.infer<typeof RuntimeIdentityV1Schema>> = {}): ShadowObservationResult => {
    safeEmit(dependencies.emit, identityEvent({
      event: "product_compiler.shadow_error",
      code: "SHADOW_RECORDER_ERROR",
      message: errorMessage(error),
      ...identity,
    }));
    return { status: "shadow_error", code: "SHADOW_RECORDER_ERROR" };
  };

  return {
    async observeClaim(input: unknown): Promise<ShadowObservationResult> {
      let identity: Partial<z.infer<typeof RuntimeIdentityV1Schema>> = {};
      try {
        const value = ShadowClaimInputV1Schema.parse(input);
        identity = value;
        const compilationReportHash = value.compilationReportHash
          ?? await dependencies.resolveCompilationReportHash(value);
        const result = await dependencies.repository.reserve({
          runId: value.runId,
          stepId: value.stepId,
          storyId: value.storyId,
          attemptClass: "product_implementation",
          ...(value.packetHash ? { packetHash: value.packetHash } : {}),
          compilationReportHash,
          ...(value.sliceHash ? { sliceHash: value.sliceHash } : {}),
          sourceBefore: value.sourceBefore,
          ...(value.findingSetHash ? { findingSetHash: value.findingSetHash } : {}),
          role: value.role,
          ...(value.agentId ? { agentId: value.agentId } : {}),
          branch: value.branch,
          worktree: value.worktree,
          evidenceRefs: [],
        });
        const code = result.status === "reserved"
          ? "ATTEMPT_RESERVED"
          : result.status === "duplicate"
            ? "ATTEMPT_DUPLICATE"
            : "ATTEMPT_ACTIVE_CONFLICT";
        safeEmit(dependencies.emit, identityEvent({
          code,
          message: `Shadow claim observation: ${result.status}`,
          runId: value.runId,
          stepId: value.stepId,
          storyId: value.storyId,
          attemptId: result.attempt.attemptId,
        }));
        return { status: "observed", code, attempt: result.attempt };
      } catch (error) {
        return shadowError(error, identity);
      }
    },

    async observeSuccess(input: unknown): Promise<ShadowObservationResult> {
      let identity: Partial<z.infer<typeof RuntimeIdentityV1Schema>> = {};
      try {
        const value = ShadowCompletionInputV1Schema.parse(input);
        identity = value;
        const attempt = await dependencies.repository.findActive(value);
        if (!attempt) {
          const code = "ATTEMPT_ACTIVE_NOT_FOUND";
          safeEmit(dependencies.emit, identityEvent({
            code,
            message: "No active shadow attempt exists for successful legacy completion",
            ...value,
          }));
          return { status: "observed", code };
        }
        const changed = attempt.sourceBefore.sha !== value.sourceAfter.sha
          || attempt.sourceBefore.treeHash !== value.sourceAfter.treeHash;
        const result = await dependencies.repository.complete({
          attemptId: attempt.attemptId,
          generation: attempt.generation,
          fenceToken: attempt.fenceToken,
          disposition: changed ? "produced_delta" : "already_satisfied",
          sourceAfter: value.sourceAfter,
          ...(value.outputHash ? { outputHash: value.outputHash } : {}),
          evidenceRefs: value.evidenceRefs,
        });
        const code = result.status === "stale_fence" ? "ATTEMPT_STALE_FENCE" : "ATTEMPT_COMPLETED";
        safeEmit(dependencies.emit, identityEvent({
          code,
          message: `Shadow success observation: ${result.status}`,
          ...value,
          attemptId: attempt.attemptId,
        }));
        return result.status === "stale_fence"
          ? { status: "observed", code }
          : { status: "observed", code, attempt: result.attempt };
      } catch (error) {
        return shadowError(error, identity);
      }
    },

    async prepareFailure(input: unknown): Promise<ShadowFailurePreparation> {
      let identity: Partial<z.infer<typeof RuntimeIdentityV1Schema>> = {};
      try {
        const value = ShadowFailureInputV1Schema.parse(input);
        identity = value;
        const attempt = await dependencies.repository.findActive(value);
        if (!attempt) return { status: "observed", code: "ATTEMPT_ACTIVE_NOT_FOUND" };
        return {
          status: "prepared",
          capture: {
            attemptId: attempt.attemptId,
            generation: attempt.generation,
            fenceToken: attempt.fenceToken,
            runId: value.runId,
            stepId: value.stepId,
            storyId: value.storyId,
            sourceAtFailure: value.sourceAtFailure,
          },
        };
      } catch (error) {
        shadowError(error, identity);
        return { status: "shadow_error", code: "SHADOW_RECORDER_ERROR" };
      }
    },

    async finalizeFailure(
      preparation: ShadowFailurePreparation,
      disposition: "failed" | "inconclusive",
    ): Promise<ShadowObservationResult> {
      if (preparation.status !== "prepared") {
        return preparation.status === "shadow_error"
          ? preparation
          : { status: "observed", code: preparation.status === "legacy" ? "ATTEMPT_LEGACY_NOOP" : preparation.code };
      }
      const { capture } = preparation;
      try {
        const result = await dependencies.repository.complete({
          attemptId: capture.attemptId,
          generation: capture.generation,
          fenceToken: capture.fenceToken,
          disposition,
          sourceAfter: capture.sourceAtFailure,
          evidenceRefs: [],
        });
        const code = result.status === "stale_fence" ? "ATTEMPT_STALE_FENCE" : "ATTEMPT_FAILED_OBSERVED";
        safeEmit(dependencies.emit, identityEvent({
          code,
          message: `Shadow failure observation: ${result.status}`,
          runId: capture.runId,
          stepId: capture.stepId,
          storyId: capture.storyId,
          attemptId: capture.attemptId,
        }));
        return result.status === "stale_fence"
          ? { status: "observed", code }
          : { status: "observed", code, attempt: result.attempt };
      } catch (error) {
        return shadowError(error, capture);
      }
    },
  };
}

export async function captureShadowSourceRevision(worktree: string): Promise<SourceRevisionV1> {
  const root = path.resolve(worktree);
  const sha = (await execGitText(root, ["rev-parse", "HEAD"], 10_000)).trim().toLowerCase();
  GitObjectHashSchema.parse(sha);
  const trackedRaw = await execGitText(root, ["ls-files", "-s", "-z"], 30_000);
  const untrackedRaw = await execGitText(
    root,
    ["ls-files", "--others", "--exclude-standard", "-z"],
    30_000,
  );
  const tracked = trackedRaw.split("\0").filter(Boolean).map((entry) => {
    const separator = entry.indexOf("\t");
    if (separator <= 0) throw new Error("SHADOW_SOURCE_INDEX_INVALID");
    const metadata = entry.slice(0, separator).split(" ");
    if (metadata.length !== 3) throw new Error("SHADOW_SOURCE_INDEX_INVALID");
    return {
      mode: metadata[0]!,
      objectHash: metadata[1]!,
      stage: metadata[2]!,
      relative: entry.slice(separator + 1),
    };
  }).sort((left, right) => left.relative < right.relative ? -1 : left.relative > right.relative ? 1 : 0);
  const untracked = untrackedRaw.split("\0").filter(Boolean).sort();

  const digest = createHash("sha256");
  digest.update("setfarm.shadow-worktree-fingerprint.v1\0");
  const updateEntry = async (relative: string, identity: string): Promise<void> => {
    const absolute = path.resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error("SHADOW_SOURCE_PATH_ESCAPE");
    }
    digest.update("\0entry\0");
    digest.update(relative);
    digest.update(`\0identity:${identity}\0`);
    let stat;
    try { stat = await lstat(absolute); } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        digest.update("missing");
        return;
      }
      throw error;
    }
    digest.update(`actual-executable:${(stat.mode & 0o111) !== 0}\0`);
    if (stat.isSymbolicLink()) {
      digest.update("symlink\0");
      digest.update(await readlink(absolute));
    } else if (stat.isFile()) {
      digest.update("file\0");
      digest.update(await readFile(absolute));
    } else if (identity.startsWith("160000:")) {
      digest.update("gitlink\0");
      try {
        digest.update((await execGitText(absolute, ["rev-parse", "HEAD"], 5_000)).trim());
      } catch {
        digest.update("unavailable");
      }
    } else {
      throw new Error("SHADOW_SOURCE_UNSUPPORTED_ENTRY");
    }
  };
  for (const entry of tracked) {
    await updateEntry(entry.relative, `${entry.mode}:${entry.objectHash}:${entry.stage}`);
  }
  for (const relative of untracked) {
    await updateEntry(relative, "untracked");
  }
  return SourceRevisionV1Schema.parse({ sha, treeHash: digest.digest("hex") });
}

type ShadowRuntime = Readonly<{
  recorder: ReturnType<typeof createShadowAttemptRecorder>;
  resolveFailureIdentity(input: {
    runId: string;
    stepId: string;
    storyDbId: string;
    agentId?: string;
  }): Promise<{
    runId: string;
    stepId: string;
    storyId: string;
    worktree: string;
  }>;
}>;

export type ShadowRuntimeOptions = Readonly<{
  env?: NodeJS.ProcessEnv;
  createRuntime?: () => Promise<ShadowRuntime>;
  onDiagnostic?: (event: ShadowDiagnostic) => void;
}>;

let defaultRuntimePromise: Promise<ShadowRuntime> | undefined;

function runtimeCodeSha(): string {
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: moduleRoot,
    encoding: "utf8",
    timeout: 5_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim().toLowerCase();
  return z.string().regex(/^[a-f0-9]{7,64}$/).parse(sha);
}

async function createDefaultShadowRuntime(): Promise<ShadowRuntime> {
  const [db, artifactModule, repositoryModule, reportModule, diagnosticsModule, configModule, loggerModule] = await Promise.all([
    import("../db-pg.js"),
    import("../product-compiler/artifact-store.js"),
    import("./attempt-repository.js"),
    import("../product-compiler/schemas/compilation-report-v1.js"),
    import("../product-compiler/diagnostics.js"),
    import("../runtime-config.js"),
    import("../lib/logger.js"),
  ]);
  const codeSha = runtimeCodeSha();
  const artifactStore = new artifactModule.ContentAddressedArtifactStore(
    configModule.resolveProductArtifactDir(),
  );
  const repository = repositoryModule.createAttemptRepository(db.getSql());
  const emit = (event: ShadowDiagnostic) => {
    const message = `[${event.event}] ${event.code}: ${event.message}`;
    if (event.event === "product_compiler.shadow_error") {
      loggerModule.logger.warn(message, { runId: event.runId, stepId: event.stepId });
    } else {
      loggerModule.logger.info(message, { runId: event.runId, stepId: event.stepId });
    }
  };
  const recorder = createShadowAttemptRecorder({
    repository,
    emit,
    resolveCompilationReportHash: async (input) => {
      const inputHash = hashCanonicalJson({
        schema: "setfarm.legacy-shadow-source.v1",
        sourceBefore: input.sourceBefore,
      });
      const diagnostic = diagnosticsModule.makeCompilationDiagnostic({
        schema: "setfarm.compilation-diagnostic.v1",
        code: "LEGACY_BUILD_PACKET_UNAVAILABLE",
        category: "contract",
        severity: "error",
        message: "Legacy claim has no sealed Product Build Packet; shadow attempt is observational only",
        provenance: [],
        suggestions: [],
      });
      const report = reportModule.ProductCompilationReportV1Schema.parse({
        schema: "setfarm.product-compilation-report.v1",
        status: "rejected",
        compiler: { version: "3.0.0-shadow.1", codeSha },
        inputHashes: [inputHash],
        artifactHashes: {},
        diagnostics: [diagnostic],
        validationIds: ["VALIDATE_LEGACY_SHADOW_PACKET"],
        rejectionCodes: ["LEGACY_BUILD_PACKET_UNAVAILABLE"],
      });
      const stored = await artifactStore.put({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: "setfarm.product-compilation-report.v1",
        producer: {
          pass: "legacy-shadow-observation",
          codeSha,
          toolVersions: {},
        },
        payload: report,
      });
      return stored.hash;
    },
  });
  return {
    recorder,
    async resolveFailureIdentity(input) {
      const row = await db.pgGet<{
        story_id: string;
        story_branch: string | null;
        context: string;
      }>(
        `SELECT s.story_id, s.story_branch, r.context
           FROM stories s JOIN runs r ON r.id = s.run_id
          WHERE s.id = $1 AND s.run_id = $2
          LIMIT 1`,
        [input.storyDbId, input.runId],
      );
      if (!row) throw new Error("SHADOW_FAILURE_IDENTITY_NOT_FOUND");
      let context: Record<string, unknown> = {};
      try { context = JSON.parse(row.context || "{}"); } catch { /* typed error below */ }
      const worktree = String(context["story_workdir"] || context["repo"] || "").trim();
      if (!worktree) throw new Error("SHADOW_FAILURE_WORKTREE_MISSING");
      return {
        runId: input.runId,
        stepId: input.stepId,
        storyId: row.story_id,
        worktree,
      };
    },
  };
}

function getDefaultShadowRuntime(): Promise<ShadowRuntime> {
  defaultRuntimePromise ??= createDefaultShadowRuntime().catch((error) => {
    defaultRuntimePromise = undefined;
    throw error;
  });
  return defaultRuntimePromise;
}

export async function initializeShadowAttemptRuntime(
  options: ShadowRuntimeOptions = {},
): Promise<Readonly<{ mode: "legacy" }> | Readonly<{ mode: "shadow"; runtime: ShadowRuntime }>> {
  const protocol = readSetfarmProtocol(options.env ?? process.env);
  if (protocol.mode === "legacy") return { mode: "legacy" };
  return {
    mode: "shadow",
    runtime: await (options.createRuntime ? options.createRuntime() : getDefaultShadowRuntime()),
  };
}

async function publishRuntimeError(
  error: unknown,
  options: ShadowRuntimeOptions,
  identity: Partial<z.infer<typeof RuntimeIdentityV1Schema>> = {},
): Promise<ShadowObservationResult> {
  const event = identityEvent({
    event: "product_compiler.shadow_error",
    code: "SHADOW_RECORDER_ERROR",
    message: errorMessage(error),
    ...identity,
  });
  if (options.onDiagnostic) safeEmit(options.onDiagnostic, event);
  else {
    try {
      const { logger } = await import("../lib/logger.js");
      logger.warn(`[${event.event}] ${event.code}: ${event.message}`, {
        runId: event.runId,
        stepId: event.stepId,
      });
    } catch { /* shadow diagnostics never own legacy decisions */ }
  }
  return { status: "shadow_error", code: "SHADOW_RECORDER_ERROR" };
}

export async function observeShadowAttemptClaim(
  input: Omit<z.input<typeof ShadowClaimInputV1Schema>, "sourceBefore">,
  options: ShadowRuntimeOptions = {},
): Promise<ShadowObservationResult | Readonly<{ status: "legacy" }>> {
  try {
    const initialized = await initializeShadowAttemptRuntime(options);
    if (initialized.mode === "legacy") return { status: "legacy" };
    const sourceBefore = await captureShadowSourceRevision(input.worktree);
    return initialized.runtime.recorder.observeClaim({ ...input, sourceBefore });
  } catch (error) {
    return publishRuntimeError(error, options, input);
  }
}

export async function observeShadowAttemptSuccess(
  input: z.input<typeof RuntimeIdentityV1Schema> & {
    worktree: string;
    output?: string;
    evidenceRefs?: string[];
  },
  options: ShadowRuntimeOptions = {},
): Promise<ShadowObservationResult | Readonly<{ status: "legacy" }>> {
  try {
    const initialized = await initializeShadowAttemptRuntime(options);
    if (initialized.mode === "legacy") return { status: "legacy" };
    const sourceAfter = await captureShadowSourceRevision(input.worktree);
    const outputHash = input.output === undefined
      ? undefined
      : createHash("sha256").update(input.output, "utf8").digest("hex");
    return initialized.runtime.recorder.observeSuccess({
      runId: input.runId,
      stepId: input.stepId,
      storyId: input.storyId,
      sourceAfter,
      ...(outputHash ? { outputHash } : {}),
      evidenceRefs: input.evidenceRefs ?? [],
    });
  } catch (error) {
    return publishRuntimeError(error, options, input);
  }
}

export async function prepareShadowAttemptFailure(
  input: {
    runId: string;
    stepId: string;
    storyDbId: string;
    agentId?: string;
  },
  options: ShadowRuntimeOptions = {},
): Promise<ShadowFailurePreparation> {
  try {
    const initialized = await initializeShadowAttemptRuntime(options);
    if (initialized.mode === "legacy") return { status: "legacy" };
    const identity = await initialized.runtime.resolveFailureIdentity(input);
    return initialized.runtime.recorder.prepareFailure({
      runId: identity.runId,
      stepId: identity.stepId,
      storyId: identity.storyId,
      sourceAtFailure: await captureShadowSourceRevision(identity.worktree),
    });
  } catch (error) {
    await publishRuntimeError(error, options, input);
    return { status: "shadow_error", code: "SHADOW_RECORDER_ERROR" };
  }
}

export async function finalizeShadowAttemptFailure(
  preparation: ShadowFailurePreparation,
  disposition: "failed" | "inconclusive",
  options: ShadowRuntimeOptions = {},
): Promise<ShadowObservationResult | Readonly<{ status: "legacy" }>> {
  if (preparation.status === "legacy") return { status: "legacy" };
  try {
    const initialized = await initializeShadowAttemptRuntime(options);
    if (initialized.mode === "legacy") return { status: "legacy" };
    return initialized.runtime.recorder.finalizeFailure(preparation, disposition);
  } catch (error) {
    return publishRuntimeError(error, options);
  }
}
