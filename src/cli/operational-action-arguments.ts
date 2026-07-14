export type OperationalActionArguments = Readonly<{
  expectedSnapshotHash: string;
  forceConsent: boolean;
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function parseOperationalActionArguments(
  args: readonly string[],
): OperationalActionArguments {
  const positions = args.flatMap((value, index) => value === "--expected-snapshot-hash" ? [index] : []);
  if (positions.length === 0) throw new Error("RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_REQUIRED");
  if (positions.length !== 1) throw new Error("RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_DUPLICATE");
  const position = positions[0]!;
  if (position < 3) throw new Error("RUN_OPERATIONAL_ACTION_ARGUMENT_INVALID");
  const expectedSnapshotHash = args[position + 1];
  if (!expectedSnapshotHash || !SHA256_PATTERN.test(expectedSnapshotHash)) {
    throw new Error("RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_INVALID");
  }
  if (args.some((value) => value.startsWith("--expected-snapshot-hash="))) {
    throw new Error("RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_DUPLICATE");
  }
  const optionValues = new Set([position, position + 1]);
  const trailing = args.filter((_value, index) => index >= 3 && !optionValues.has(index));
  if (trailing.some((value) => value !== "--force")) {
    throw new Error("RUN_OPERATIONAL_ACTION_ARGUMENT_INVALID");
  }
  if (trailing.filter((value) => value === "--force").length > 1) {
    throw new Error("RUN_OPERATIONAL_ACTION_ARGUMENT_INVALID");
  }
  return Object.freeze({
    expectedSnapshotHash,
    forceConsent: trailing.includes("--force"),
  });
}
