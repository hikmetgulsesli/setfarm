import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  type PlatformReleaseHostCompositionFixtureV2,
} from
  "../../../src/execution/platform-release-host-composition-authority-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_EXECUTABLE_SOURCE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_MODULE_SOURCE_V2,
} from
  "../../../src/execution/platform-release-bootstrap-module-export-operation-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_V2,
} from
  "../../../src/execution/platform-release-bootstrap-metadata-operation-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_MODULE_SOURCE_V2,
} from
  "../../../src/execution/platform-release-bootstrap-network-negative-operation-v2.js";

const FILES_V2 = Object.freeze([
  ["bin/release-bootstrap", 0o555],
  ["lib/release-bootstrap.mjs", 0o444],
  ["bin/host-verifier", 0o555],
  ["lib/metadata-bootstrap.mjs", 0o444],
  ["tools/xattr-observe", 0o755],
  ["tools/xattr-clear", 0o755],
  ["tools/acl-observe", 0o755],
  ["tools/acl-clear", 0o755],
  ["tools/sandbox-exec", 0o755],
  ["lib/network-wrapper.mjs", 0o444],
] as const);

function fixtureBytesV2(relativeLocator: string): string {
  switch (relativeLocator) {
    case "bin/release-bootstrap":
      return PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_EXECUTABLE_SOURCE_V2;
    case "lib/release-bootstrap.mjs":
      return PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_MODULE_SOURCE_V2;
    case "lib/metadata-bootstrap.mjs":
      return PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_V2;
    case "lib/network-wrapper.mjs":
      return PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_MODULE_SOURCE_V2;
    default:
      return `#!/bin/sh\n# fixture:${relativeLocator}\nexit 64\n`;
  }
}

function operationalToolWrapperBytesV2(
  relativeLocator:
    | "tools/xattr-observe"
    | "tools/acl-observe"
    | "tools/sandbox-exec",
): string {
  // Test-only installed-role mechanics. macOS kills copied Apple platform
  // binaries from this private package location, so the fixture uses one
  // immutable fixed-argv wrapper. Neither the interpreter nor delegated
  // canonical system tools are admitted by this single-root fixture;
  // downstream evidence must retain its wrapper-observer characterization.
  const executable = relativeLocator === "tools/xattr-observe"
    ? "/usr/bin/xattr"
    : relativeLocator === "tools/acl-observe"
      ? "/bin/ls"
      : "/usr/bin/sandbox-exec";
  const command = relativeLocator === "tools/sandbox-exec"
    ? `/usr/bin/env -u PWD -u SHLVL ${executable} \"$@\"`
    : `${executable} \"$@\"`;
  return [
    "#!/bin/sh",
    "set -efu",
    `exec ${command}`,
    "",
  ].join("\n");
}

export type MaterializedPlatformReleaseHostCompositionFixtureV2 =
  Readonly<{
    root: string;
    fixture: PlatformReleaseHostCompositionFixtureV2;
    files: Readonly<Record<string, string>>;
  }>;

export function materializePlatformReleaseHostCompositionFixtureV2(
  prefix = "setfarm-platform-host-composition-v2-",
  options: Readonly<{
    operationalMetadataObserverWrappers?: boolean;
    operationalNetworkSandboxWrapper?: boolean;
  }> = {},
): MaterializedPlatformReleaseHostCompositionFixtureV2 {
  const root = realpathSync(
    mkdtempSync(path.join(tmpdir(), prefix)),
  );
  for (const directory of ["bin", "lib", "tools"]) {
    mkdirSync(path.join(root, directory), {
      mode: 0o700,
    });
    chmodSync(path.join(root, directory), 0o700);
  }
  const files: Record<string, string> = {};
  for (const [relativeLocator, mode] of FILES_V2) {
    const absolutePath = path.join(root, relativeLocator);
    const operationalTool =
      options.operationalMetadataObserverWrappers === true
        && (
          relativeLocator === "tools/xattr-observe"
          || relativeLocator === "tools/acl-observe"
        )
          ? relativeLocator
          : options.operationalNetworkSandboxWrapper === true
              && relativeLocator === "tools/sandbox-exec"
            ? relativeLocator
            : undefined;
    writeFileSync(
      absolutePath,
      operationalTool === undefined
        ? fixtureBytesV2(relativeLocator)
        : operationalToolWrapperBytesV2(
          operationalTool,
        ),
      { mode },
    );
    chmodSync(absolutePath, mode);
    files[relativeLocator] = absolutePath;
  }
  chmodSync(root, 0o700);
  const owner = lstatSync(root);
  const ownerUid = owner.uid;
  const runtimeUid = ownerUid === 65_532
    ? 65_531
    : 65_532;
  const runtimeGid = owner.gid === 65_532
    ? 65_531
    : 65_532;
  return Object.freeze({
    root,
    fixture: Object.freeze({
      fixtureRoot: root,
      runtimeAccount: Object.freeze({
        accountRef:
          "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2",
        uid: runtimeUid,
        gid: runtimeGid,
      }),
    }),
    files: Object.freeze(files),
  });
}
