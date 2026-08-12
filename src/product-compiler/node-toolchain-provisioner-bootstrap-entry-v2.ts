import { canonicalJsonBytes } from "./canonical-json.js";
import {
  createNodeToolchainProvisionerCliOperationsV2ForTest,
  createProductionNodeToolchainProvisionerCliOperationsV2,
  runNodeToolchainProvisionerCliV2,
} from "./node-toolchain-provisioner-cli-v2.js";
import {
  NodeToolchainProvisionerBootstrapPackageErrorV2,
  openExecutingNodeToolchainProvisionerBootstrapV2,
} from "./node-toolchain-provisioner-bootstrap-package-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
  NodeToolchainProvisionerBootstrapFailureV2Schema,
  hashNodeToolchainProvisionerBootstrapFailureV2,
  type NodeToolchainProvisionerBootstrapFailureCodeV2,
  type NodeToolchainProvisionerBootstrapFailureHashPayloadV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";

function failureCode(error: unknown): NodeToolchainProvisionerBootstrapFailureCodeV2 {
  if (!(error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2)) {
    return "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INTERNAL_FAILURE";
  }
  if (error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_MANIFEST_INVALID") {
    return "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_MANIFEST_INVALID";
  }
  if (error.code === "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PROCESS_INVALID") {
    return "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PROCESS_INVALID";
  }
  return "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID";
}

function writeBootstrapFailure(error: unknown): number {
  const code = failureCode(error);
  const identity: NodeToolchainProvisionerBootstrapFailureHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA,
    failureVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
    failureCode: code,
    exitCode: 70,
  };
  const failure = NodeToolchainProvisionerBootstrapFailureV2Schema.parse({
    ...identity,
    failureHash: hashNodeToolchainProvisionerBootstrapFailureV2(identity),
  });
  process.stdout.write(canonicalJsonBytes(failure));
  const diagnostic = error instanceof Error
    ? `${code}: ${error.message}`
    : `${code}: bootstrap failed`;
  process.stderr.write(`${diagnostic.replace(/[\r\n]+/g, " ").slice(0, 1_200)}\n`);
  return 70;
}

async function main(): Promise<number> {
  try {
    // CoreFoundation injects this key into Darwin Node processes even after
    // /usr/bin/env -i. Remove only that OS-owned value before reproducing the
    // launcher's every-and-only environment contract.
    delete process.env.__CF_USER_TEXT_ENCODING;
    const bootstrap = openExecutingNodeToolchainProvisionerBootstrapV2();
    const operations = bootstrap.admissionScope === "production_root"
      ? createProductionNodeToolchainProvisionerCliOperationsV2()
      : createNodeToolchainProvisionerCliOperationsV2ForTest({
          parent: bootstrap.provisionerParent,
          scratchParent: bootstrap.scratchParent,
          architecture: bootstrap.architecture,
        });
    return await runNodeToolchainProvisionerCliV2(
      process.argv.slice(2),
      operations,
      {
        writeStdout: (bytes) => {
          process.stdout.write(bytes);
        },
        writeStderr: (text) => {
          process.stderr.write(text);
        },
      },
    );
  } catch (error) {
    return writeBootstrapFailure(error);
  }
}

void main().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error) => {
    process.exitCode = writeBootstrapFailure(error);
  },
);
