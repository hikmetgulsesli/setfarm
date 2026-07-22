import path from "node:path";

import { canonicalJsonBytes } from "./canonical-json.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
  NodeToolchainProvisionerBootstrapFailureV2Schema,
  hashNodeToolchainProvisionerBootstrapFailureV2,
  type NodeToolchainProvisionerBootstrapFailureCodeV2,
  type NodeToolchainProvisionerBootstrapFailureHashPayloadV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";

export type NodeToolchainProvisionerBootstrapLauncherInputV2 = Readonly<{
  rootLocator: string;
  expectedOwnerUid: number;
  expectedOwnerGid: number;
  bundleSha256: string;
  bundleByteLength: number;
  runtimeSha256: string;
  runtimeByteLength: number;
}>;

function fail(message: string): never {
  throw new TypeError(message.slice(0, 1_000));
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function bootstrapFailure(code: NodeToolchainProvisionerBootstrapFailureCodeV2): string {
  const identity: NodeToolchainProvisionerBootstrapFailureHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA,
    failureVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
    failureCode: code,
    exitCode: 70,
  };
  return canonicalJsonBytes(NodeToolchainProvisionerBootstrapFailureV2Schema.parse({
    ...identity,
    failureHash: hashNodeToolchainProvisionerBootstrapFailureV2(identity),
  })).toString("utf8");
}

export function renderNodeToolchainProvisionerBootstrapLauncherV2(
  input: NodeToolchainProvisionerBootstrapLauncherInputV2,
): Buffer {
  const root = path.normalize(input.rootLocator);
  if (
    !path.isAbsolute(root)
    || root !== input.rootLocator
    || root.includes("\0")
    || root.includes("\n")
    || root.includes("\r")
    || root.includes("'")
    || !Number.isSafeInteger(input.expectedOwnerUid)
    || input.expectedOwnerUid < 0
    || !Number.isSafeInteger(input.expectedOwnerGid)
    || input.expectedOwnerGid < 0
    || !/^[a-f0-9]{64}$/.test(input.bundleSha256)
    || input.bundleByteLength < 1
    || input.bundleByteLength > NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2
    || !/^[a-f0-9]{64}$/.test(input.runtimeSha256)
    || input.runtimeByteLength < 1
    || input.runtimeByteLength > NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2
  ) {
    return fail("Bootstrap launcher input is outside its exact bounded contract");
  }
  const rootRequired = shellQuote(bootstrapFailure(
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_ROOT_REQUIRED",
  ));
  const fileInvalid = shellQuote(bootstrapFailure(
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_FILE_INVALID",
  ));
  const fileMismatch = shellQuote(bootstrapFailure(
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_FILE_MISMATCH",
  ));
  const manifest = path.join(root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2);
  const bundle = path.join(root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2);
  const runtime = path.join(root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2);
  const lines = [
    "#!/bin/sh",
    "set -fu",
    "umask 077",
    `ROOT=${shellQuote(root)}`,
    `MANIFEST=${shellQuote(manifest)}`,
    `BUNDLE=${shellQuote(bundle)}`,
    `RUNTIME=${shellQuote(runtime)}`,
    `FAIL_ROOT=${rootRequired}`,
    `FAIL_FILE=${fileInvalid}`,
    `FAIL_MISMATCH=${fileMismatch}`,
    "fail() {",
    "  /usr/bin/printf '%s' \"$1\"",
    "  exit 70",
    "}",
    "verify_file() {",
    "  file=$1",
    "  mode=$2",
    "  length=$3",
    "  digest=$4",
    "  metadata=$(/usr/bin/stat -f '%HT|%u|%g|%Lp|%l|%z' \"$file\" 2>/dev/null) || fail \"$FAIL_FILE\"",
    `  expected="Regular File|${input.expectedOwnerUid}|${input.expectedOwnerGid}|$mode|1|$length"`,
    "  [ \"$metadata\" = \"$expected\" ] || fail \"$FAIL_FILE\"",
    "  observed=$(/usr/bin/shasum -a 256 \"$file\" 2>/dev/null) || fail \"$FAIL_FILE\"",
    "  observed=${observed%% *}",
    "  [ \"$observed\" = \"$digest\" ] || fail \"$FAIL_MISMATCH\"",
    "}",
    "verify_manifest() {",
    "  metadata=$(/usr/bin/stat -f '%HT|%u|%g|%Lp|%l|%z' \"$MANIFEST\" 2>/dev/null) || fail \"$FAIL_FILE\"",
    "  old_ifs=$IFS",
    "  IFS='|'",
    "  set -- $metadata",
    "  IFS=$old_ifs",
    "  [ \"$#\" -eq 6 ] || fail \"$FAIL_FILE\"",
    `  [ "$1" = 'Regular File' ] && [ "$2" = '${input.expectedOwnerUid}' ] && [ "$3" = '${input.expectedOwnerGid}' ] || fail "$FAIL_FILE"`,
    "  [ \"$4\" = '444' ] && [ \"$5\" = '1' ] || fail \"$FAIL_FILE\"",
    `  [ "$6" -ge 1 ] 2>/dev/null && [ "$6" -le ${NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2} ] 2>/dev/null || fail "$FAIL_FILE"`,
    "}",
    `[ "$(/usr/bin/id -u 2>/dev/null)" = '${input.expectedOwnerUid}' ] || fail "$FAIL_ROOT"`,
    "verify_manifest",
    `verify_file "$BUNDLE" 444 ${input.bundleByteLength} ${input.bundleSha256}`,
    `verify_file "$RUNTIME" 555 ${input.runtimeByteLength} ${input.runtimeSha256}`,
    "cd \"$ROOT\" || fail \"$FAIL_FILE\"",
    "exec /usr/bin/env -i \\",
    "  HOME=/var/empty \\",
    "  LANG=C \\",
    "  LC_ALL=C \\",
    "  NO_COLOR=1 \\",
    "  TMPDIR=/private/var/tmp \\",
    "  TZ=UTC \\",
    "  SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2=1 \\",
    "  SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2=\"$MANIFEST\" \\",
    "  \"$RUNTIME\" \"$BUNDLE\" \"$@\"",
    "",
  ];
  const bytes = Buffer.from(lines.join("\n"), "utf8");
  if (bytes.byteLength > NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2) {
    return fail("Rendered bootstrap launcher exceeds its byte bound");
  }
  return bytes;
}
