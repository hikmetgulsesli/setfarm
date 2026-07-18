import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  NODE_CLI_PACKAGE_JSON_TEXT_V2,
  NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2,
  NODE_CLI_TSCONFIG_JSON_TEXT_V2,
  NODE_EXPRESS_API_PACKAGE_JSON_TEXT_V2,
  NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2,
  NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2,
  NODE_SCAFFOLD_CANONICAL_TEXT_BY_PROFILE_V2,
} from "../../src/product-compiler/node-scaffold-assets-v2.js";

const ASSET_GOLDENS_V2 = Object.freeze({
  cli: Object.freeze({
    packageJson: Object.freeze({
      byteLength: 301,
      rawHash: "8c8249391b57fc7b7d3f440335d3e1b9b9fd75f7baa4e7d3bf615f5e3054700c",
    }),
    packageLockJson: Object.freeze({
      byteLength: 1_197,
      rawHash: "e30f7d18cec621f492825b7ead4b9cfe2d624b4105b25df6684885fe1f87f519",
    }),
    tsconfigJson: Object.freeze({
      byteLength: 333,
      rawHash: "87cee8ff1887b0bccf7ee2a48f80d7260bfbf2fb67ac1ce1e6ca77abb8fb9bdc",
    }),
  }),
  api: Object.freeze({
    packageJson: Object.freeze({
      byteLength: 369,
      rawHash: "d36a97f3cf8f73fa00a3102683d734a846138c8519205933388ad3b0e719237a",
    }),
    packageLockJson: Object.freeze({
      byteLength: 27_244,
      rawHash: "bb91e8e0ff68969491f37e1dd3f1c1f50b8a1aeb8f1b6ae765adbe48e74803d2",
    }),
    tsconfigJson: Object.freeze({
      byteLength: 333,
      rawHash: "87cee8ff1887b0bccf7ee2a48f80d7260bfbf2fb67ac1ce1e6ca77abb8fb9bdc",
    }),
  }),
} as const);

type JsonRecord = Record<string, any>;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function exactCanonicalJson(text: string): JsonRecord {
  assert.equal(text.startsWith("\ufeff"), false);
  assert.equal(text.includes("\r"), false);
  assert.equal(text.includes("\0"), false);
  assert.equal(text.endsWith("\n"), true);
  assert.equal(text.endsWith("\n\n"), false);
  const value = JSON.parse(text) as JsonRecord;
  assert.equal(`${canonicalJsonStringify(value)}\n`, text);
  return value;
}

function resolveDependencyPath(
  packages: JsonRecord,
  ownerPath: string,
  dependencyName: string,
): string | null {
  let base = ownerPath;
  for (;;) {
    const candidate = base.length > 0
      ? `${base}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (Object.hasOwn(packages, candidate)) return candidate;
    const nestedMarker = base.lastIndexOf("/node_modules/");
    if (nestedMarker >= 0) {
      base = base.slice(0, nestedMarker);
      continue;
    }
    if (base.startsWith("node_modules/")) {
      base = "";
      continue;
    }
    return null;
  }
}

function assertCompleteLockGraph(
  lock: JsonRecord,
  expectedPackageCount: number,
): void {
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.requires, true);
  assert.deepEqual(Object.keys(lock), [
    "lockfileVersion",
    "name",
    "packages",
    "requires",
    "version",
  ]);
  const packages = lock.packages as JsonRecord;
  const paths = Object.keys(packages);
  assert.equal(paths.length, expectedPackageCount);
  assert.deepEqual(paths, [...paths].sort());
  assert.equal(paths[0], "");

  for (const packagePath of paths.slice(1)) {
    assert.match(packagePath, /^(?:node_modules\/)+(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*$/u);
    const entry = packages[packagePath] as JsonRecord;
    assert.equal(typeof entry.version, "string");
    assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//u);
    assert.match(entry.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/u);
    assert.notEqual(entry.hasInstallScript, true);
    assert.notEqual(entry.gypfile, true);
    assert.notEqual(entry.link, true);
    assert.equal(entry.optionalDependencies, undefined);
    assert.equal(entry.peerDependencies, undefined);
  }

  const root = packages[""] as JsonRecord;
  const pending = Object.keys({
    ...(root.dependencies ?? {}),
    ...(root.devDependencies ?? {}),
  }).map((dependencyName) => {
    const resolved = resolveDependencyPath(packages, "", dependencyName);
    assert.ok(resolved, `root dependency ${dependencyName} must resolve`);
    return resolved;
  });
  const reached = new Set<string>();
  while (pending.length > 0) {
    const packagePath = pending.pop()!;
    if (reached.has(packagePath)) continue;
    reached.add(packagePath);
    const entry = packages[packagePath] as JsonRecord;
    for (const dependencyName of Object.keys(entry.dependencies ?? {})) {
      const resolved = resolveDependencyPath(
        packages,
        packagePath,
        dependencyName,
      );
      assert.ok(
        resolved,
        `${packagePath} dependency ${dependencyName} must resolve`,
      );
      pending.push(resolved);
    }
  }
  assert.deepEqual([...reached].sort(), paths.slice(1));
}

const EXPECTED_TSCONFIG_V2 = Object.freeze({
  compilerOptions: Object.freeze({
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    module: "NodeNext",
    moduleResolution: "NodeNext",
    noEmitOnError: true,
    outDir: "dist",
    resolveJsonModule: true,
    rootDir: "src",
    strict: true,
    target: "ES2022",
    verbatimModuleSyntax: true,
  }),
  exclude: Object.freeze(["dist", "node_modules"]),
  include: Object.freeze(["src/**/*.ts"]),
});

describe("Node scaffold V2 code-owned source assets", () => {
  it("pins exactly six canonical-LF byte artifacts with no product-derived bytes", () => {
    assert.deepEqual(Object.keys(NODE_SCAFFOLD_CANONICAL_TEXT_BY_PROFILE_V2), [
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
    ]);
    const profiles = [
      {
        key: "cli" as const,
        assets: NODE_SCAFFOLD_CANONICAL_TEXT_BY_PROFILE_V2
          .PROFILE_NODE_CLI_STATELESS_EXACT_V2,
      },
      {
        key: "api" as const,
        assets: NODE_SCAFFOLD_CANONICAL_TEXT_BY_PROFILE_V2
          .PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2,
      },
    ];
    for (const profile of profiles) {
      assert.deepEqual(Object.keys(profile.assets), [
        "packageJson",
        "packageLockJson",
        "tsconfigJson",
      ]);
      for (const assetName of Object.keys(profile.assets) as Array<
        keyof typeof profile.assets
      >) {
        const text = profile.assets[assetName];
        exactCanonicalJson(text);
        assert.equal(Buffer.byteLength(text, "utf8"),
          ASSET_GOLDENS_V2[profile.key][assetName].byteLength);
        assert.equal(sha256(text), ASSET_GOLDENS_V2[profile.key][assetName].rawHash);
      }
      const combined = Object.values(profile.assets).join("\n");
      for (const forbidden of [
        "productId",
        "runId",
        "storyId",
        "repositoryName",
        "src/cli.ts",
        "src/app.ts",
        ".gitignore",
      ]) assert.equal(combined.includes(forbidden), false);
    }
    assert.equal(NODE_CLI_TSCONFIG_JSON_TEXT_V2, NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2);
  });

  it("owns exact private manifests without lifecycle, start, preview, or bin surfaces", () => {
    const cli = exactCanonicalJson(NODE_CLI_PACKAGE_JSON_TEXT_V2);
    const api = exactCanonicalJson(NODE_EXPRESS_API_PACKAGE_JSON_TEXT_V2);
    assert.deepEqual(Object.keys(cli), [
      "devDependencies",
      "engines",
      "name",
      "packageManager",
      "private",
      "scripts",
      "type",
      "version",
    ]);
    assert.deepEqual(Object.keys(api), [
      "dependencies",
      "devDependencies",
      "engines",
      "name",
      "packageManager",
      "private",
      "scripts",
      "type",
      "version",
    ]);
    assert.equal(cli.name, "@setfarm/generated-node-cli-v2");
    assert.equal(api.name, "@setfarm/generated-node-express-api-v2");
    for (const manifest of [cli, api]) {
      assert.equal(manifest.version, "0.0.0");
      assert.equal(manifest.private, true);
      assert.equal(manifest.type, "module");
      assert.equal(manifest.packageManager, "npm@10.9.8");
      assert.deepEqual(manifest.engines, {
        node: ">=22.13.0 <23",
        npm: "10.9.8",
      });
      assert.deepEqual(manifest.scripts, {
        build: "tsc -p tsconfig.json",
        test: "node --test",
      });
      for (const forbidden of [
        "preinstall",
        "install",
        "postinstall",
        "prepare",
        "prepublish",
        "start",
        "dev",
        "preview",
      ]) assert.equal(Object.hasOwn(manifest.scripts, forbidden), false);
      assert.equal(manifest.bin, undefined);
    }
    assert.deepEqual(cli.devDependencies, {
      "@types/node": "22.19.11",
      typescript: "5.9.3",
    });
    assert.equal(cli.dependencies, undefined);
    assert.deepEqual(api.dependencies, { express: "5.2.1" });
    assert.deepEqual(api.devDependencies, {
      "@types/express": "5.0.6",
      "@types/node": "22.19.11",
      typescript: "5.9.3",
    });
  });

  it("binds exact compiler semantics and no source bootstrap", () => {
    assert.deepEqual(
      exactCanonicalJson(NODE_CLI_TSCONFIG_JSON_TEXT_V2),
      EXPECTED_TSCONFIG_V2,
    );
    assert.deepEqual(
      exactCanonicalJson(NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2),
      EXPECTED_TSCONFIG_V2,
    );
    for (const text of [
      NODE_CLI_TSCONFIG_JSON_TEXT_V2,
      NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2,
    ]) {
      assert.equal(text.includes("src/cli.ts"), false);
      assert.equal(text.includes("src/app.ts"), false);
      assert.equal(text.includes("allowJs"), false);
    }
  });

  it("closes both exact lock graphs and their root-manifest joins", () => {
    const cases = [
      {
        manifest: exactCanonicalJson(NODE_CLI_PACKAGE_JSON_TEXT_V2),
        lock: exactCanonicalJson(NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2),
        packageCount: 4,
      },
      {
        manifest: exactCanonicalJson(NODE_EXPRESS_API_PACKAGE_JSON_TEXT_V2),
        lock: exactCanonicalJson(NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2),
        packageCount: 80,
      },
    ];
    for (const item of cases) {
      assert.equal(item.lock.name, item.manifest.name);
      assert.equal(item.lock.version, item.manifest.version);
      const root = item.lock.packages[""] as JsonRecord;
      assert.deepEqual(root, {
        ...(item.manifest.dependencies
          ? { dependencies: item.manifest.dependencies }
          : {}),
        devDependencies: item.manifest.devDependencies,
        engines: item.manifest.engines,
        name: item.manifest.name,
        version: item.manifest.version,
      });
      assertCompleteLockGraph(item.lock, item.packageCount);
    }
  });
});
