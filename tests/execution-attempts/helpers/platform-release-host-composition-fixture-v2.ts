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
    case "lib/release-bootstrap.mjs":
      return [
        "export function runPlatformReleaseHostOperationV2() { return null; }",
        "export function runPlatformReleaseModuleExportProbeV2() { return null; }",
        "",
      ].join("\n");
    case "lib/metadata-bootstrap.mjs":
      return "export function runPlatformReleaseMetadataProbeV2() { return null; }\n";
    case "lib/network-wrapper.mjs":
      return "export function runPlatformReleaseNetworkNegativeProbeV2() { return null; }\n";
    default:
      return `#!/bin/sh\n# fixture:${relativeLocator}\nexit 64\n`;
  }
}

export type MaterializedPlatformReleaseHostCompositionFixtureV2 =
  Readonly<{
    root: string;
    fixture: PlatformReleaseHostCompositionFixtureV2;
    files: Readonly<Record<string, string>>;
  }>;

export function materializePlatformReleaseHostCompositionFixtureV2(
  prefix = "setfarm-platform-host-composition-v2-",
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
    writeFileSync(
      absolutePath,
      fixtureBytesV2(relativeLocator),
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
