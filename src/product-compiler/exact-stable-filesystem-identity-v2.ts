/**
 * The legacy V2 receipts expose device/inode as JSON numbers.  This helper
 * is deliberately data-only: callers must capture the filesystem values with
 * `lstatSync(..., { bigint: true })` before asking whether they can be
 * projected into that ABI without rounding.
 */
export type ExactStableFilesystemIdentityV2 = Readonly<{
  device: bigint;
  inode: bigint;
}>;

export type SafeNumericStableFilesystemIdentityV2 = Readonly<{
  device: number;
  inode: number;
}>;

export type ExactStableFilesystemObjectKindV2 =
  | "ordinary_file"
  | "directory";

/**
 * Minimal structural view of a bigint lstat result.  Keeping this helper
 * data-only lets legacy V2 callers retain their numeric receipt ABI while
 * requiring every destructive boundary to prove the object kind and injective
 * device/inode projection from the exact bigint values.
 */
export type ExactStableFilesystemStatV2 = Readonly<{
  dev: bigint;
  ino: bigint;
  isSymbolicLink(): boolean;
  isFile(): boolean;
  isDirectory(): boolean;
}>;

const MAX_SAFE_INTEGER_BIGINT_V2 = BigInt(Number.MAX_SAFE_INTEGER);

export function projectExactStableFilesystemIdentityToSafeNumbersV2(
  value: ExactStableFilesystemIdentityV2,
): SafeNumericStableFilesystemIdentityV2 | undefined {
  if (
    value === null
    || typeof value !== "object"
    || typeof value.device !== "bigint"
    || typeof value.inode !== "bigint"
    || value.device < 0n
    || value.inode < 0n
    || value.device > MAX_SAFE_INTEGER_BIGINT_V2
    || value.inode > MAX_SAFE_INTEGER_BIGINT_V2
  ) {
    return undefined;
  }
  return Object.freeze({
    device: Number(value.device),
    inode: Number(value.inode),
  });
}

export function matchesExactStableFilesystemObjectV2(input: Readonly<{
  stat: ExactStableFilesystemStatV2;
  expected: SafeNumericStableFilesystemIdentityV2;
  objectKind: ExactStableFilesystemObjectKindV2;
}>): boolean {
  const projected = projectExactStableFilesystemIdentityToSafeNumbersV2({
    device: input.stat.dev,
    inode: input.stat.ino,
  });
  return projected !== undefined
    && Number.isSafeInteger(input.expected.device)
    && Number.isSafeInteger(input.expected.inode)
    && projected.device === input.expected.device
    && projected.inode === input.expected.inode
    && !input.stat.isSymbolicLink()
    && (input.objectKind === "ordinary_file"
      ? input.stat.isFile()
      : input.stat.isDirectory());
}

/**
 * Exact counterpart for private authorities that retain the native bigint
 * identity instead of projecting it into the legacy JSON-number ABI.
 */
export function matchesExactStableFilesystemObjectIdentityV2(input: Readonly<{
  stat: ExactStableFilesystemStatV2;
  expected: ExactStableFilesystemIdentityV2;
  objectKind: ExactStableFilesystemObjectKindV2;
}>): boolean {
  return input.stat.dev === input.expected.device
    && input.stat.ino === input.expected.inode
    && !input.stat.isSymbolicLink()
    && (input.objectKind === "ordinary_file"
      ? input.stat.isFile()
      : input.stat.isDirectory());
}
