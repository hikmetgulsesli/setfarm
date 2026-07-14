import type postgres from "postgres";

import {
  ProtocolConfigurationError,
  parseSetfarmProtocol,
  type SetfarmProtocolMode,
} from "../product-compiler/protocol.js";
import type { InternalCanaryAdmissionContextV1 } from "./v3-release-admission.js";

const GIT_RELEASE_SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const SHA256 = /^[a-f0-9]{64}$/;

export type RunProtocolErrorCode =
  | "RUN_PROTOCOL_FLAG_INVALID"
  | "RUN_PROTOCOL_INVALID_MODE"
  | "RUN_PROTOCOL_INVALID_RELEASE"
  | "RUN_PROTOCOL_NOT_FOUND"
  | "RUN_PROTOCOL_PREFLIGHT_REQUIRED"
  | "RUN_PROTOCOL_RELEASE_ADMISSION_MISMATCH"
  | "RUN_PROTOCOL_RELEASE_ADMISSION_REQUIRED"
  | "RUN_PROTOCOL_STORED_INVALID"
  | "RUN_PROTOCOL_UNSUPPORTED_VERSION"
  | "RUN_PROTOCOL_V3_DISABLED";

export class RunProtocolError extends Error {
  readonly code: RunProtocolErrorCode;

  constructor(code: RunProtocolErrorCode, message: string) {
    super(message);
    this.name = "RunProtocolError";
    this.code = code;
  }
}

export type RunProtocolIdentity = Readonly<{
  mode: SetfarmProtocolMode;
  version: 1;
  compilerReleaseSha: string;
  activationPreflightHash: string | null;
  releaseAdmissionHash: string | null;
  releaseAdmissionKind: "convergence_canary" | "release_go" | null;
  canaryAdmission: InternalCanaryAdmissionContextV1 | null;
}>;

export type StoredRunProtocolIdentity = Readonly<{
  mode: SetfarmProtocolMode;
  version: 1;
  compilerReleaseSha: string | null;
  packetHash: string | null;
  activationPreflightHash: string | null;
  releaseAdmissionHash: string | null;
  releaseAdmissionKind: "convergence_canary" | "release_go" | null;
}>;

export type RunReleaseAdmissionSelection = Readonly<{
  admissionHash: string;
  kind: "convergence_canary" | "release_go";
  releaseSha: string;
  canary: InternalCanaryAdmissionContextV1 | null;
}>;

export function extractProtocolArgument(args: readonly string[]): Readonly<{
  requestedMode: string | undefined;
  remainingArgs: string[];
}> {
  const indexes = args.flatMap((value, index) => value === "--protocol" ? [index] : []);
  if (indexes.length === 0) {
    return { requestedMode: undefined, remainingArgs: [...args] };
  }
  if (indexes.length !== 1) {
    throw new RunProtocolError(
      "RUN_PROTOCOL_FLAG_INVALID",
      "--protocol must be provided at most once",
    );
  }
  const index = indexes[0]!;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new RunProtocolError(
      "RUN_PROTOCOL_FLAG_INVALID",
      "--protocol requires legacy, shadow, or v3",
    );
  }
  const remainingArgs = [...args];
  remainingArgs.splice(index, 2);
  return { requestedMode: value, remainingArgs };
}

export function resolveNewRunProtocol(input: Readonly<{
  requestedMode?: string;
  compilerReleaseSha: string;
  env?: NodeJS.ProcessEnv;
  activationPreflight?: Readonly<{
    status: "pass" | "fail";
    hash: string;
    stored: boolean;
  }>;
  releaseAdmission?: RunReleaseAdmissionSelection;
}>): RunProtocolIdentity {
  const env = input.env ?? process.env;
  const mode = selectNewRunProtocolMode(input.requestedMode, env);
  const compilerReleaseSha = input.compilerReleaseSha.trim().toLowerCase();
  if (!GIT_RELEASE_SHA.test(compilerReleaseSha)) {
    throw new RunProtocolError(
      "RUN_PROTOCOL_INVALID_RELEASE",
      "Compiler release SHA must be a full Git object hash",
    );
  }

  let activationPreflightHash: string | null = null;
  if (mode === "shadow" || mode === "v3") {
    if (
      input.activationPreflight?.status !== "pass"
      || input.activationPreflight.stored !== true
      || !SHA256.test(input.activationPreflight.hash)
    ) {
      throw new RunProtocolError(
        "RUN_PROTOCOL_PREFLIGHT_REQUIRED",
        `${mode} requires a stored passing activation preflight`,
      );
    }
    activationPreflightHash = input.activationPreflight.hash;
  }
  if (mode === "v3" && env.SETFARM_V3_ACTIVATION !== "enabled") {
    throw new RunProtocolError(
      "RUN_PROTOCOL_V3_DISABLED",
      "Product Compiler v3 run creation is not activated",
    );
  }

  let releaseAdmissionHash: string | null = null;
  let releaseAdmissionKind: "convergence_canary" | "release_go" | null = null;
  let canaryAdmission: InternalCanaryAdmissionContextV1 | null = null;
  if (mode === "v3") {
    const admission = input.releaseAdmission;
    if (!admission || !SHA256.test(admission.admissionHash)) {
      throw new RunProtocolError(
        "RUN_PROTOCOL_RELEASE_ADMISSION_REQUIRED",
        "Product Compiler v3 requires an immutable release admission",
      );
    }
    const exactCanary = admission.kind === "convergence_canary"
      && admission.canary !== null
      && admission.canary.admissionHash === admission.admissionHash;
    const exactReleaseGo = admission.kind === "release_go" && admission.canary === null;
    if (
      admission.releaseSha !== compilerReleaseSha
      || (!exactCanary && !exactReleaseGo)
    ) {
      throw new RunProtocolError(
        "RUN_PROTOCOL_RELEASE_ADMISSION_MISMATCH",
        "Release admission does not match the exact compiler release and admission kind",
      );
    }
    releaseAdmissionHash = admission.admissionHash;
    releaseAdmissionKind = admission.kind;
    canaryAdmission = admission.canary;
  } else if (input.releaseAdmission !== undefined) {
    throw new RunProtocolError(
      "RUN_PROTOCOL_RELEASE_ADMISSION_MISMATCH",
      "Only Product Compiler v3 runs may carry a release admission",
    );
  }

  return Object.freeze({
    mode,
    version: 1,
    compilerReleaseSha,
    activationPreflightHash,
    releaseAdmissionHash,
    releaseAdmissionKind,
    canaryAdmission,
  });
}

export function selectNewRunProtocolMode(
  requestedMode: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): SetfarmProtocolMode {
  const selected = requestedMode ?? env.SETFARM_PROTOCOL;
  let mode: SetfarmProtocolMode;
  try {
    mode = parseSetfarmProtocol(selected, { allowV3: true }).mode;
  } catch (error) {
    if (error instanceof ProtocolConfigurationError) {
      throw new RunProtocolError(
        "RUN_PROTOCOL_INVALID_MODE",
        `Unsupported run protocol: ${JSON.stringify(selected)}`,
      );
    }
    throw error;
  }
  return mode;
}

type RunProtocolRow = {
  protocol: string;
  protocol_version: number;
  compiler_release_sha: string | null;
  packet_hash: string | null;
  activation_preflight_hash: string | null;
  release_admission_hash: string | null;
  release_admission_kind: string | null;
};

export function createRunProtocolRepository(sql: postgres.Sql) {
  return Object.freeze({
    async read(runId: string): Promise<StoredRunProtocolIdentity> {
      const rows = await sql.unsafe<RunProtocolRow[]>(
        `SELECT r.protocol, r.protocol_version, r.compiler_release_sha,
                r.packet_hash, r.activation_preflight_hash,
                r.release_admission_hash,
                admission.kind AS release_admission_kind
           FROM runs r
           LEFT JOIN v3_release_admissions admission
             ON admission.admission_hash = r.release_admission_hash
          WHERE r.id = $1
          LIMIT 1`,
        [runId],
      );
      const row = rows[0];
      if (!row) {
        throw new RunProtocolError(
          "RUN_PROTOCOL_NOT_FOUND",
          `Run protocol identity not found for ${runId}`,
        );
      }
      let mode: SetfarmProtocolMode;
      try {
        mode = parseSetfarmProtocol(row.protocol, { allowV3: true }).mode;
      } catch {
        throw new RunProtocolError(
          "RUN_PROTOCOL_STORED_INVALID",
          `Run ${runId} has an invalid stored protocol`,
        );
      }
      if (row.protocol_version !== 1) {
        throw new RunProtocolError(
          "RUN_PROTOCOL_UNSUPPORTED_VERSION",
          `Run ${runId} uses unsupported protocol version ${row.protocol_version}`,
        );
      }
      if (
        (row.compiler_release_sha !== null && !GIT_RELEASE_SHA.test(row.compiler_release_sha))
        || (mode !== "legacy" && row.compiler_release_sha === null)
        || (row.packet_hash !== null && !SHA256.test(row.packet_hash))
        || (row.activation_preflight_hash !== null && !SHA256.test(row.activation_preflight_hash))
        || (mode !== "legacy" && row.activation_preflight_hash === null)
        || (row.release_admission_hash !== null && !SHA256.test(row.release_admission_hash))
        || (mode === "v3" && (
          row.release_admission_hash === null
          || !["convergence_canary", "release_go"].includes(row.release_admission_kind ?? "")
        ))
        || (mode !== "v3" && (
          row.release_admission_hash !== null
          || row.release_admission_kind !== null
        ))
      ) {
        throw new RunProtocolError(
          "RUN_PROTOCOL_STORED_INVALID",
          `Run ${runId} has an invalid stored protocol identity`,
        );
      }
      return Object.freeze({
        mode,
        version: 1,
        compilerReleaseSha: row.compiler_release_sha,
        packetHash: row.packet_hash,
        activationPreflightHash: row.activation_preflight_hash,
        releaseAdmissionHash: row.release_admission_hash,
        releaseAdmissionKind: row.release_admission_kind as "convergence_canary" | "release_go" | null,
      });
    },
  });
}
