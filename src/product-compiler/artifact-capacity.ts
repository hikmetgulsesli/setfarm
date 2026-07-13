import { lstat, readdir, statfs } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ARTIFACT_CAPACITY_LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 512 * 1024 * 1024,
  minFreeBytes: 1024 * 1024 * 1024,
});

export type ArtifactCapacityLimits = Readonly<{
  maxPayloadBytes: number;
  rootQuotaBytes: number;
  minFreeBytes: number;
}>;

export type ArtifactCapacitySnapshot = Readonly<{
  rootBytes: number;
  freeBytes: number;
}>;

export type ArtifactCapacityErrorCode =
  | "ARTIFACT_CAPACITY_LOCK_TIMEOUT"
  | "ARTIFACT_FREE_SPACE_LOW"
  | "ARTIFACT_PAYLOAD_TOO_LARGE"
  | "ARTIFACT_ROOT_QUOTA_EXCEEDED";

export class ArtifactCapacityError extends Error {
  readonly code: ArtifactCapacityErrorCode;

  constructor(code: ArtifactCapacityErrorCode, message: string) {
    super(message);
    this.name = "ArtifactCapacityError";
    this.code = code;
  }
}

export type ArtifactCapacityAssessment = Readonly<{
  status: "pass" | "fail";
  code: "ARTIFACT_CAPACITY_OK" | ArtifactCapacityErrorCode;
  payloadBytes: number;
  rootBytes: number;
  projectedRootBytes: number;
  freeBytes: number;
  projectedFreeBytes: number;
  limits: ArtifactCapacityLimits;
}>;

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

export function normalizeArtifactCapacityLimits(
  limits: ArtifactCapacityLimits,
): ArtifactCapacityLimits {
  const normalized = {
    maxPayloadBytes: finiteNonNegative(limits.maxPayloadBytes, "maxPayloadBytes"),
    rootQuotaBytes: finiteNonNegative(limits.rootQuotaBytes, "rootQuotaBytes"),
    minFreeBytes: finiteNonNegative(limits.minFreeBytes, "minFreeBytes"),
  };
  if (normalized.maxPayloadBytes === 0 || normalized.rootQuotaBytes === 0) {
    throw new TypeError("Artifact payload and root quota limits must be positive");
  }
  return Object.freeze(normalized);
}

export function assessArtifactCapacity(input: Readonly<{
  payloadBytes: number;
  rootBytes: number;
  freeBytes: number;
  limits: ArtifactCapacityLimits;
}>): ArtifactCapacityAssessment {
  const payloadBytes = finiteNonNegative(input.payloadBytes, "payloadBytes");
  const rootBytes = finiteNonNegative(input.rootBytes, "rootBytes");
  const freeBytes = finiteNonNegative(input.freeBytes, "freeBytes");
  const limits = normalizeArtifactCapacityLimits(input.limits);
  const projectedRootBytes = rootBytes + payloadBytes;
  const projectedFreeBytes = Math.max(0, freeBytes - payloadBytes);
  let code: ArtifactCapacityAssessment["code"] = "ARTIFACT_CAPACITY_OK";
  if (payloadBytes > limits.maxPayloadBytes) {
    code = "ARTIFACT_PAYLOAD_TOO_LARGE";
  } else if (projectedRootBytes > limits.rootQuotaBytes) {
    code = "ARTIFACT_ROOT_QUOTA_EXCEEDED";
  } else if (projectedFreeBytes < limits.minFreeBytes) {
    code = "ARTIFACT_FREE_SPACE_LOW";
  }
  return Object.freeze({
    status: code === "ARTIFACT_CAPACITY_OK" ? "pass" : "fail",
    code,
    payloadBytes,
    rootBytes,
    projectedRootBytes,
    freeBytes,
    projectedFreeBytes,
    limits,
  });
}

async function closestExistingDirectory(target: string): Promise<string> {
  let current = path.resolve(target);
  while (true) {
    try {
      const info = await lstat(current);
      if (info.isDirectory()) return current;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error("ARTIFACT_CAPACITY_VOLUME_NOT_FOUND");
    current = parent;
  }
}

async function immutableRootBytes(root: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return 0;
    throw error;
  }
  let total = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const info = await lstat(path.join(root, entry.name));
    total += info.size;
    if (!Number.isSafeInteger(total)) throw new Error("ARTIFACT_CAPACITY_SIZE_OVERFLOW");
  }
  return total;
}

export async function measureArtifactCapacity(root: string): Promise<ArtifactCapacitySnapshot> {
  const resolved = path.resolve(root);
  const volumeDirectory = await closestExistingDirectory(resolved);
  const filesystem = await statfs(volumeDirectory);
  const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
  if (!Number.isSafeInteger(freeBytes) || freeBytes < 0) {
    throw new Error("ARTIFACT_CAPACITY_FREE_SPACE_INVALID");
  }
  return Object.freeze({
    rootBytes: await immutableRootBytes(resolved),
    freeBytes,
  });
}

export function throwForArtifactCapacity(assessment: ArtifactCapacityAssessment): void {
  if (assessment.status === "pass") return;
  throw new ArtifactCapacityError(
    assessment.code as ArtifactCapacityErrorCode,
    `${assessment.code}: artifact write rejected by capacity policy`,
  );
}
