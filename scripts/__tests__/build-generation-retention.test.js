import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUILD_ID = "10000000-0000-4000-8000-000000000001";
const BUILD_ID_2 = "20000000-0000-4000-8000-000000000002";
const BUILD_ID_3 = "30000000-0000-4000-8000-000000000003";

function fixtureBuildId(ordinal) {
  return `10000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
}

function git(root, args) {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fixtureFile(root, locator, bytes, mode = 0o644) {
  const target = join(root, locator);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  chmodSync(target, mode);
}

function canonicalFixtureJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalFixtureJson).join(",")}]`;
  return `{${Object.keys(value).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))).map((key) => `${JSON.stringify(key)}:${canonicalFixtureJson(value[key])}`).join(",")}}`;
}

function hashCanonicalFixture(value) {
  return createHash("sha256").update(canonicalFixtureJson(value)).digest("hex");
}

function fixturePinnedInputSet(root, sourceSha) {
  const sourceTreeHash = git(root, ["rev-parse", `${sourceSha}^{tree}`]);
  const listing = execFileSync("/usr/bin/git", ["ls-tree", "-r", "-z", "--full-tree", sourceSha], { cwd: root });
  const entries = listing.toString("utf8").split("\0").filter(Boolean).map((record) => {
    const match = /^(100644|100755) blob ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/.exec(record);
    assert.ok(match, `invalid fixture Git entry: ${record}`);
    return { locator: match[3], gitMode: match[1], gitBlobHash: match[2] };
  }).sort((left, right) => Buffer.compare(Buffer.from(left.locator), Buffer.from(right.locator)));
  const body = {
    schema: "setfarm.internal-production-pinned-build-input-set.v1",
    sourceSha,
    sourceTreeHash,
    entries,
  };
  return { ...body, buildInputSetHash: hashCanonicalFixture(body) };
}

function writeFinalizedRuntimeDist(root) {
  const sourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
  const { sourceTreeHash, entries, buildInputSetHash } = fixturePinnedInputSet(root, sourceSha);
  const serviceBytes = Buffer.from("export const fixtureRuntime = true;\n", "utf8");
  const outputEntries = [{
    locator: "dist/service.js",
    mode: 0o644,
    byteLength: serviceBytes.length,
    sha256: createHash("sha256").update(serviceBytes).digest("hex"),
  }];
  const outputProjection = {
    schema: "setfarm.platform-build-output-tree.v1",
    sourceSha,
    sourceTreeHash,
    entries: outputEntries,
  };
  const outputTree = { ...outputProjection, outputTreeHash: hashCanonicalFixture(outputProjection) };
  const stitchBytes = readFileSync(join(root, "scripts/stitch-to-jsx.mjs"));
  const releaseManifest = {
    schema: "setfarm.platform-release-manifest.v1",
    releaseSha: sourceSha,
    branch: "main",
    dirty: false,
    stitchConverter: {
      converterId: "setfarm.stitch-to-jsx",
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: createHash("sha256").update(stitchBytes).digest("hex"),
        mediaType: "text/javascript",
        locator: "scripts/stitch-to-jsx.mjs",
        byteLength: stitchBytes.length,
      },
    },
  };
  const buildInfo = {
    sha: sourceSha,
    shortSha: sourceSha.slice(0, 8),
    branch: "main",
    dirty: false,
    packageVersion: "1.0.0",
    displayVersion: `1.0.0+${sourceSha.slice(0, 8)}`,
    builtAt: "2026-08-20T00:00:00.000Z",
  };
  const stableBuildInfo = {
    schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
    sha: buildInfo.sha,
    shortSha: buildInfo.shortSha,
    branch: buildInfo.branch,
    dirty: buildInfo.dirty,
    packageVersion: buildInfo.packageVersion,
    displayVersion: buildInfo.displayVersion,
  };
  const buildHash = hashCanonicalFixture({
    schema: "setfarm.internal-production-controller-build.v1",
    stableBuildInfo,
    buildInputSetHash,
    outputTreeHash: outputTree.outputTreeHash,
    releaseManifestHash: hashCanonicalFixture(releaseManifest),
  });
  rmSync(join(root, "dist"), { recursive: true, force: true });
  fixtureFile(root, "dist/service.js", serviceBytes, 0o644);
  fixtureFile(root, "dist/BUILD_INFO.json", `${JSON.stringify(buildInfo, null, 2)}\n`, 0o444);
  fixtureFile(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json", `${JSON.stringify(outputTree)}\n`, 0o444);
  fixtureFile(root, "dist/PLATFORM_RELEASE_MANIFEST.json", `${JSON.stringify(releaseManifest)}\n`, 0o444);
  chmodSync(join(root, "dist"), 0o755);
  return buildHash;
}

const FIXTURE_WRITER_ROTATION_HELPER_V1 = String.raw`
function runWriterRotationUnderLock({ buildId, rotationControllerSource }) {
  if (!UUID_V4.test(buildId)) fail("writer build ID is invalid");
  assertRotationControllerSource(rotationControllerSource);
  const root = repositoryRootV1();
  const dist = path.join(root, "dist");
  const roots = ensureAuthorityRoots(root);
  const retentionStores = existingRetentionStoreDirectoriesV1();
  if (retentionStores) normalizeRetentionPublisherStoresV1(retentionStores);
  const inspection = scanRotationLedgerFromRoots(roots, { recoverPublisherTemps: true });
  let intent;
  if (inspection.danglingIntent) {
    intent = inspection.danglingIntent;
    if (canonicalJsonV1(intent.rotationControllerSource) !== canonicalJsonV1(rotationControllerSource)) fail("writer candidate does not own the dangling rotation intent");
  } else {
    if (!optionalLstat(dist)) return Object.freeze({ rotated: false, intent: null, completion: null });
    if (inspection.generations.filter((generation) => generation.disposition === null).length >= 8) fail("eight retained generations already exist", "BUILD_GENERATION_RETENTION_REQUIRED");
    const ordinal = inspection.generations.length + 1;
    const destinationLocator = ARCHIVE_DIRECTORY + "/" + buildId + ".dist";
    const destination = path.join(root, destinationLocator);
    if (optionalLstat(destination)) fail("rotation destination already exists");
    const inventory = inventoryBuildGenerationV1(dist);
    intent = publishRotationRecord(roots.intents, "intent", {
      schema: "setfarm.platform-build-generation-rotation-intent.v1", ordinal, buildId,
      predecessorCompletion: inspection.completionTip,
      sourceParentIdentity: directoryIdentity(root, roots.device),
      destinationParentIdentity: directoryIdentity(roots.archive, roots.device),
      sourceLocator: "dist", destinationLocator, inventory, rotationControllerSource,
    });
  }
  const destination = path.join(root, intent.destinationLocator);
  const sourcePresent = optionalLstat(dist);
  const destinationPresent = optionalLstat(destination);
  if (sourcePresent && !destinationPresent) {
    const sourceInventory = inventoryBuildGenerationV1(dist);
    if (sourceInventory.physicalInventoryHash !== intent.inventory.physicalInventoryHash || sourceInventory.contentInventoryHash !== intent.inventory.contentInventoryHash) fail("dangling rotation source inventory changed");
    renameSync(dist, destination);
    fsyncDirectory(root);
    fsyncDirectory(roots.archive);
  } else if (!sourcePresent && destinationPresent) {
    // Lost rename response: the exact destination is adopted below.
  } else fail("rotation intent has an ambiguous source/destination state");
  if (optionalLstat(dist)) fail("rotation source remained after rename");
  const archiveIdentity = directoryIdentity(destination, roots.device);
  const movedInventory = inventoryBuildGenerationV1(destination);
  if (movedInventory.physicalInventoryHash !== intent.inventory.physicalInventoryHash || movedInventory.contentInventoryHash !== intent.inventory.contentInventoryHash) fail("rotated archive inventory changed");
  const completion = publishRotationRecord(roots.completions, "completion", {
    schema: "setfarm.platform-build-generation-rotation-completion.v1", ordinal: intent.ordinal, buildId: intent.buildId,
    predecessorCompletion: intent.predecessorCompletion, intent: pairOf(intent, "intent"),
    sourceParentIdentity: intent.sourceParentIdentity, destinationParentIdentity: intent.destinationParentIdentity,
    archiveLocator: intent.destinationLocator, archiveIdentity, inventory: movedInventory,
    rotationControllerSource: intent.rotationControllerSource,
  });
  return Object.freeze({ rotated: true, intent, completion });
}

function runBuildGenerationWriterRotationV1(input) {
  const { buildId, rotationControllerSource } = input;
  const root = repositoryRootV1();
  const repository = directoryIdentity(root);
  const device = BigInt(repository.devDecimal);
  const setfarm = path.join(root, ".setfarm");
  if (!optionalLstat(setfarm)) ensureDirectory(setfarm, 0o700, root, device);
  let maintenanceBuildId = buildId;
  const ledger = path.join(root, ROTATION_LEDGER_DIRECTORY);
  if (optionalLstat(ledger)) {
    const inspection = scanRotationLedgerFromRoots({ root, archive: path.join(root, ARCHIVE_DIRECTORY), ledger, intents: path.join(ledger, "intents"), completions: path.join(ledger, "completions"), dispositions: path.join(ledger, "dispositions") }, { deferDisposedClosure: true });
    if (inspection.danglingIntent) maintenanceBuildId = inspection.danglingIntent.buildId;
  }
  const candidateKeyHash = hashCanonicalJsonV1({ kind: "writer_prepare", buildId: maintenanceBuildId, rotationControllerSource });
  const lock = acquireMaintenanceLock(setfarm, "writer_prepare", candidateKeyHash);
  try {
    return runWriterRotationUnderLock(input);
  } finally {
    if (optionalLstat(lock.file)) releaseMaintenanceLock(setfarm, lock);
  }
}
`;

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "setfarm-oa18-retention-"));
  const retentionSource = readFileSync(join(sourceRoot, "scripts/build-generation-retention.mjs"), "utf8");
  fixtureFile(
    root,
    "scripts/build-generation-retention.mjs",
    `${retentionSource}\n${FIXTURE_WRITER_ROTATION_HELPER_V1}\nexport { runBuildGenerationWriterRotationV1 };\n`,
    0o755,
  );
  fixtureFile(root, ".gitignore", ".setfarm/\ndist/\n");
  fixtureFile(root, "package.json", '{"name":"setfarm-oa18-fixture","version":"1.0.0","type":"module"}\n');
  fixtureFile(root, "scripts/stitch-to-jsx.mjs", "export const stitchFixture = true;\n");
  fixtureFile(root, "src/service.ts", "export const fixtureRuntime: boolean = true;\n");
  fixtureFile(root, "tracked.txt", "tracked\n");
  fixtureFile(root, "dist/nested/artifact.txt", "artifact\n");
  chmodSync(join(root, "dist"), 0o755);
  chmodSync(join(root, "dist/nested"), 0o755);
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.name", "Setfarm Test"]);
  git(root, ["config", "user.email", "setfarm-test@example.invalid"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "fixture"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  return root;
}

function runModule(root, expression) {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", expression], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
  });
}

function writerExpression(input) {
  return [
    'import { runBuildGenerationWriterRotationV1 } from "./scripts/build-generation-retention.mjs";',
    `const value = runBuildGenerationWriterRotationV1(${JSON.stringify(input)});`,
    "process.stdout.write(`${JSON.stringify(value)}\\n`);",
  ].join("\n");
}

function rotationInput(root, buildId, digit) {
  const sourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
  return {
    buildId,
    rotationControllerSource: {
      branch: "main",
      clean: true,
      sourceSha,
      sourceTreeHash: git(root, ["rev-parse", "HEAD^{tree}"]),
      originMainSha: sourceSha,
      buildInputSetHash: digit.repeat(64),
    },
  };
}

function rotateFixtureGeneration(root, buildId, digit) {
  const result = runModule(root, writerExpression(rotationInput(root, buildId, digit)));
  assert.equal(result.status, 0, result.stderr);
  writeFinalizedRuntimeDist(root);
  return JSON.parse(result.stdout);
}

function installPrivateRetentionObservers(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  if (!git(root, ["remote"]).split("\n").includes("origin")) {
    git(root, ["remote", "add", "origin", "https://github.com/hikmetgulsesli/setfarm.git"]);
  }
  for (const label of ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard", "com.setrox.mission-control"]) {
    fixtureFile(root, `Library/LaunchAgents/${label}.plist`, `fixture plist for ${label}\n`, 0o644);
  }
  fixtureFile(root, "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js", "// fixed source-CLI boundary fixture\n", 0o644);
  fixtureFile(root, ".fixture-hostile-node", "#!/bin/sh\n/bin/cat > .fixture-hostile-secret-received\nexit 97\n", 0o755);
  source = source.replace(
    'const RETENTION_STORE_ROOT_V1 = path.join(CODE_OWNED_WORKSPACE_ROOT_V1, "data", "internal-production-baseline", "build-generation-retention-v1");',
    'const RETENTION_STORE_ROOT_V1 = path.join(repositoryRootV1(), ".fixture-retention-v1");',
  );
  source = source.replace(
    "const CODE_OWNER_HOME_V1 = path.dirname(path.dirname(CODE_OWNED_WORKSPACE_ROOT_V1));",
    "const CODE_OWNER_HOME_V1 = repositoryRootV1();",
  );
  source = source.replace(
    'const MISSION_CONTROL_ROOT_V1 = path.join(CODE_OWNED_WORKSPACE_ROOT_V1, "mission-control");',
    "const MISSION_CONTROL_ROOT_V1 = repositoryRootV1();",
  );
  source = source.replace(
    "function observeProcessIdentityV1(pid, expected) {",
    "let fixtureProcessIdentityCallsV1 = 0;\nfunction observeProcessIdentityV1(pid, expected) {",
  );
  source = source.replace(
    "    const identity = parseProcessIdentityRow(stdout);\n    if (identity) {",
    `    const identity = parseProcessIdentityRow(stdout);
    fixtureProcessIdentityCallsV1 += 1;
    if (identity && optionalLstat(path.join(repositoryRootV1(), ".fixture-process-drift")) && fixtureProcessIdentityCallsV1 === 8) {
      return Object.freeze({ state: "live_pid_reused", processLstart: identity.processLstart, processGroupId: identity.processGroupId + 1 });
    }
    if (identity && optionalLstat(path.join(repositoryRootV1(), ".fixture-process-initial-error")) && fixtureProcessIdentityCallsV1 === 7) {
      return Object.freeze({ state: "ambiguous" });
    }
    if (identity && optionalLstat(path.join(repositoryRootV1(), ".fixture-process-bytes-drift")) && fixtureProcessIdentityCallsV1 === 8) {
      return Object.freeze({ state: "live_match", ...identity, observationHash: "f".repeat(64) });
    }
    if (identity) {`,
  );
  source = source.replace(
    "function observeOperationAuthoritiesV1(root) {",
    `function fixtureControllerBuildHashV1(root, sourceSha, treeHash) {
  const provisional = { branch: "main", clean: true, sha: sourceSha, treeHash, buildHash: "0".repeat(64), originMainSha: sourceSha };
  const historical = historicalBuildInputsV1(root, provisional);
  const buildInfo = JSON.parse(readFileSync(path.join(root, "dist", "BUILD_INFO.json"), "utf8"));
  const outputTree = JSON.parse(readFileSync(path.join(root, "dist", "PLATFORM_BUILD_OUTPUT_TREE.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(path.join(root, "dist", "PLATFORM_RELEASE_MANIFEST.json"), "utf8"));
  const stableBuildInfo = {
    schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
    sha: buildInfo.sha, shortSha: buildInfo.shortSha, branch: buildInfo.branch, dirty: buildInfo.dirty,
    packageVersion: buildInfo.packageVersion, displayVersion: buildInfo.displayVersion,
  };
  return hashCanonicalJsonV1({
    schema: "setfarm.internal-production-controller-build.v1", stableBuildInfo,
    buildInputSetHash: historical.buildInputSetHash, outputTreeHash: outputTree.outputTreeHash,
    releaseManifestHash: hashCanonicalJsonV1(manifest),
  });
}

function observeOperationAuthoritiesV1(root) {`,
  );
  source = source.replace(
    /function fixedChildResult\(executable, argv, options = \{\}\) \{[\s\S]*?\n\}\n\nfunction requireSuccessfulChild/,
    `const fixtureLoadedServicePidV1 = ${process.pid};
let fixtureMissionControlLaunchctlCallsV1 = 0;
let fixtureMissionControlListenerCallsV1 = 0;
function fixedChildResult(executable, argv, options = {}) {
  const success = (stdout) => ({ error: null, signal: null, status: 0, stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout), stderr: Buffer.alloc(0) });
  const serviceEntrypoint = path.join(repositoryRootV1(), "dist", "service.js");
  const loadedExecutable = optionalLstat(path.join(repositoryRootV1(), ".fixture-hostile-loaded-executable"))
    ? path.join(repositoryRootV1(), ".fixture-hostile-node") : process.execPath;
  const environmentValue = (name) => ({
    PATH: "/usr/bin:/bin",
    SETFARM_PG_URL: "postgresql://localhost/fixture",
    SETFARM_OPERATIONAL_WRITE_TOKEN: "fixture-operational-token-00000001",
    CLI_PATH: serviceEntrypoint,
    MC_HOST: "localhost",
    MC_INTERNAL_URL: "http://127.0.0.1:3080",
    MC_PORT: "3080",
    PROJECTS_DIR: repositoryRootV1(),
    PROJECTS_JSON: path.join(repositoryRootV1(), "package.json"),
    SETFARM_DIR: repositoryRootV1(),
    SETFARM_REPO_DIR: repositoryRootV1(),
    SETFARM_URL: "http://127.0.0.1:3333",
  })[name];
  if (executable === LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1 && canonicalJsonV1(argv) === canonicalJsonV1(["-nP", "-iTCP:3080", "-sTCP:LISTEN", "-F0pcfn"])) {
    fixtureMissionControlListenerCallsV1 += 1;
    const listenerPid = optionalLstat(path.join(repositoryRootV1(), ".fixture-listener-pid-mismatch")) ? fixtureLoadedServicePidV1 + 1 : fixtureLoadedServicePidV1;
    const command = optionalLstat(path.join(repositoryRootV1(), ".fixture-listener-drift")) && fixtureMissionControlListenerCallsV1 > 1 ? "node-drift" : "node";
    const record = \`p\${listenerPid}\\0c\${command}\\0\\nf20\\0n127.0.0.1:3080\\0\\n\`;
    const extra = optionalLstat(path.join(repositoryRootV1(), ".fixture-listener-extra-record")) ? \`p\${listenerPid}\\0cnode\\0\\nf21\\0n127.0.0.1:3080\\0\\n\` : "";
    return success(Buffer.from(record + extra, "utf8"));
  }
  if (executable === LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1 && argv[0] === "-nP") {
    return { error: null, signal: null, status: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
  }
  if (executable === LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1 && argv[0] === "-a") {
    return success(Buffer.from(\`p\${argv[2]}\\0\\nftxt\\0n\${loadedExecutable}\\0\\n\`, "utf8"));
  }
  if (executable === PLUTIL_EXECUTABLE_V1) {
    const config = LAUNCH_AGENT_CONFIGS_V1.find((entry) => entry.locator === argv[4]);
    if (!config) return { error: null, signal: null, status: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    const plist = {
      Label: config.label,
      ProgramArguments: [loadedExecutable, serviceEntrypoint],
      ...(config.workingDirectory === null ? {} : { WorkingDirectory: config.workingDirectory }),
      EnvironmentVariables: Object.fromEntries(config.environmentNames.map((name) => [name, environmentValue(name)])),
    };
    if (config.label === "com.setrox.mission-control" && optionalLstat(path.join(repositoryRootV1(), ".fixture-plist-token-mismatch"))) {
      plist.EnvironmentVariables.SETFARM_OPERATIONAL_WRITE_TOKEN = "fixture-operational-token-00000002";
    }
    return success(Buffer.from(JSON.stringify(plist), "utf8"));
  }
  if (executable === LAUNCHCTL_EXECUTABLE_V1) {
    const label = argv[1].slice(argv[1].lastIndexOf("/") + 1);
    const config = LAUNCH_AGENT_CONFIGS_V1.find((entry) => entry.label === label);
    if (label === "com.setrox.mission-control") fixtureMissionControlLaunchctlCallsV1 += 1;
    if (label === "com.setrox.mission-control" && optionalLstat(path.join(repositoryRootV1(), ".fixture-launchctl-initial-error")) && fixtureMissionControlLaunchctlCallsV1 === 1) {
      return { error: null, signal: null, status: 97, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
    const uid = process.getuid();
    const lines = [\`gui/\${uid}/\${label} = {\`, \`\\tpath = \${config.locator}\`];
    if (config.workingDirectory !== null) lines.push(\`\\tworking directory = \${config.workingDirectory}\`);
    lines.push("\\targuments = {", \`\\t\\t\${loadedExecutable}\`, \`\\t\\t\${serviceEntrypoint}\`, "\\t}", "\\tenvironment = {");
    for (const name of config.environmentNames) {
      const driftToken = label === "com.setrox.mission-control" && name === "SETFARM_OPERATIONAL_WRITE_TOKEN"
        && optionalLstat(path.join(repositoryRootV1(), ".fixture-loaded-token-drift")) && fixtureMissionControlLaunchctlCallsV1 > 1;
      lines.push(\`\\t\\t\${name} => \${driftToken ? "fixture-operational-token-00000002" : environmentValue(name)}\`);
    }
    const loadedPid = label === "com.setrox.mission-control" && optionalLstat(path.join(repositoryRootV1(), ".fixture-launchctl-drift")) && fixtureMissionControlLaunchctlCallsV1 > 1
      ? fixtureLoadedServicePidV1 + 1 : fixtureLoadedServicePidV1;
    lines.push("\\t\\tOSLogRateLimit => 64", \`\\t\\tXPC_SERVICE_NAME => \${label}\`, "\\t}", \`\\tpid = \${loadedPid}\`, "}", "");
    return success(Buffer.from(lines.join("\\n"), "utf8"));
  }
  if (executable === PROCESS_IDENTITY_EXECUTABLE_V1 && argv.at(-1) === "comm=") return success(Buffer.from(\`\${loadedExecutable}\\n\`, "utf8"));
  if (executable === PROCESS_IDENTITY_EXECUTABLE_V1 && argv.at(-1) === "command=") return success(Buffer.from(\`\${loadedExecutable} \${serviceEntrypoint}\\n\`, "utf8"));
  if (executable === process.execPath && argv[0] === "--input-type=module" && argv[1] === "--eval") {
    if (argv.length !== 3 || argv[2] !== MISSION_CONTROL_LOADED_BUILD_OBSERVER_PROGRAM_V1
      || options.timeout !== undefined || options.maxBuffer !== undefined || options.cwd !== undefined) {
      return { error: null, signal: null, status: 96, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
    if (!Buffer.isBuffer(options.input) || options.input.toString("utf8") !== environmentValue("SETFARM_OPERATIONAL_WRITE_TOKEN")) {
      return { error: null, signal: null, status: 97, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
    const callFile = path.join(repositoryRootV1(), ".fixture-loaded-endpoint-call-count");
    const priorCalls = optionalLstat(callFile) ? Number(readFileSync(callFile, "utf8").trim()) : 0;
    writeFileSync(callFile, \`\${priorCalls + 1}\\n\`);
    if (optionalLstat(path.join(repositoryRootV1(), ".fixture-endpoint-missing"))) {
      return { error: null, signal: null, status: 97, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
    const response = JSON.parse(readFileSync(path.join(repositoryRootV1(), ".fixture-loaded-response.json"), "utf8"));
    response.startupInstance.pid = fixtureLoadedServicePidV1;
    if (optionalLstat(path.join(repositoryRootV1(), ".fixture-startup-stale"))) response.startupInstance.pid = fixtureLoadedServicePidV1 + 1;
    if (optionalLstat(path.join(repositoryRootV1(), ".fixture-crossed-loaded-source"))) {
      response.loadedBuild.buildIdentity.sourceSha = "f".repeat(40);
      response.loadedBuild.buildIdentity.treeHash = "e".repeat(40);
      response.loadedBuild.buildIdentity.buildHash = "d".repeat(64);
      response.loadedBuild.buildIdentityHash = hashCanonicalJsonV1(response.loadedBuild.buildIdentity);
      response.loadedBuildHash = hashCanonicalJsonV1(response.loadedBuild);
      response.loadedBuildRef = \`mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/\${response.loadedBuildHash}\`;
    }
    return success(Buffer.from(JSON.stringify(response), "utf8"));
  }
  if (executable === process.execPath && argv[0]?.endsWith("product-build-authority-v2-delivery-evidence-v1.js")) {
    if (optionalLstat(path.join(repositoryRootV1(), ".fixture-source-cli-hard-fail"))) {
      writeFileSync(path.join(repositoryRootV1(), ".fixture-source-cli-called"), "called\\n");
      return { error: null, signal: null, status: 98, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
    return success(readFileSync(path.join(repositoryRootV1(), ".fixture-pba-response.json")));
  }
  return spawnSync(executable, argv, {
    shell: false, cwd: options.cwd, env: PROCESS_ENV_V1,
    timeout: options.timeout ?? RUNTIME_OBSERVER_TIMEOUT_MS_V1,
    maxBuffer: options.maxBuffer ?? RUNTIME_OBSERVER_MAX_BUFFER_BYTES_V1,
    input: options.input, stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
}

function requireSuccessfulChild`,
  );
  source = source.replace(
    /  \/\/ OA18_PRIVATE_FIXTURE_AUTHORITIES_START\n[\s\S]*?  \/\/ OA18_PRIVATE_FIXTURE_AUTHORITIES_END/,
    `  // OA18_PRIVATE_FIXTURE_AUTHORITIES_START
  const sourceSha = requireSuccessfulChild(fixedChildResult("/usr/bin/git", ["rev-parse", "HEAD^{commit}"], { cwd: root }), "fixture source").toString("utf8").trim();
  const treeHash = requireSuccessfulChild(fixedChildResult("/usr/bin/git", ["rev-parse", "HEAD^{tree}"], { cwd: root }), "fixture tree").toString("utf8").trim();
  const fixtureSourceBuild = { branch: "main", clean: true, sha: sourceSha, treeHash, buildHash: fixtureControllerBuildHashV1(root, sourceSha, treeHash), originMainSha: sourceSha };
  const deliveredPaths = [
    "server/routes/setfarm-operational.test.ts", "server/routes/setfarm-operational.ts",
    "server/services/setfarm-product-build-authority.ts", "server/services/setfarm-product-build-authority.test.ts",
    "src/lib/product-build-authority.ts", "src/components/run-detail/ProductBuildAuthority.tsx",
    "tests/product-build-authority-render.test.tsx", "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
  ];
  const deliveredPathBlobs = deliveredPaths.map((path, ordinal) => ({ path, blobHash: String(ordinal + 1).repeat(64) }));
  const focusedArgv = ["node", "--import", "tsx", "--test", "server/routes/setfarm-operational.test.ts", "server/services/setfarm-product-build-authority.test.ts", "tests/product-build-authority-render.test.tsx"];
  const focusedCore = {
    schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1", argv: focusedArgv,
    commandContractHash: hashCanonicalJsonV1({ argv: focusedArgv }),
    testPathBlobs: [deliveredPathBlobs[0], deliveredPathBlobs[3], deliveredPathBlobs[6]], exitCode: 0, passed: true,
  };
  const focusedTestReceiptHash = hashCanonicalJsonV1(focusedCore);
  const focusedTests = { ...focusedCore, focusedTestReceiptRef: \`mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/\${focusedTestReceiptHash}\`, focusedTestReceiptHash };
  const vendorPaths = [
    ["contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v1.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v2.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v3.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json"],
    ["contracts/generated/mission-control/deployment-observation.v1.compatibility.json", "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json"],
    ["contracts/generated/mission-control/deployment-observation.v1.schema.json", "contracts/vendor/setfarm/deployment-observation.v1.schema.json"],
    ["contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json", "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json"],
    ["contracts/generated/mission-control/project-transfer-ack.v1.schema.json", "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json"],
    ["contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json", "contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json"],
    ["contracts/generated/mission-control/operational-active-run-status.v1.schema.json", "contracts/vendor/setfarm/operational-active-run-status.v1.schema.json"],
  ];
  const artifacts = vendorPaths.map(([producerPath, vendoredPath], ordinal) => ({ producerPath, vendoredPath, sha256: ("abcdef"[ordinal % 6]).repeat(64) }));
  const vendorCore = {
    schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1",
    lockPath: deliveredPaths[7], producerRepository: "https://github.com/hikmetgulsesli/setfarm.git", producerCommit: sourceSha,
    lockContentHash: deliveredPathBlobs[7].blobHash, artifacts,
    compatibilitySetHash: hashCanonicalJsonV1({ schema: "mission-control.setfarm-contract-compatibility-set.v1", artifacts }),
  };
  const vendorLock = { ...vendorCore, vendorLockProjectionHash: hashCanonicalJsonV1(vendorCore) };
  const evidenceCore = {
    schema: "mission-control.product-build-authority-v2-delivery-evidence.v1", currentStatus: "current", deliveryPrNumber: 19,
    deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a", deliveryMergeAncestorOfCurrentSource: true,
    currentSource: { branch: "main", clean: true, sha: sourceSha, treeHash, buildHash: "c".repeat(64), originMainSha: sourceSha },
    deliveredPathBlobs, focusedTests, vendorLock,
  };
  const deliveryEvidenceHash = hashCanonicalJsonV1(evidenceCore);
  const deliveryEvidenceRef = \`mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/\${deliveryEvidenceHash}\`;
  const evidence = { ...evidenceCore, deliveryEvidenceRef, deliveryEvidenceHash };
  const productBuildAuthorityV2Observation = {
    schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
    observationTransport: "source-cli",
    response: {
      schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
      currentStatus: "current",
      deliveryEvidenceRef,
      deliveryEvidenceHash,
      evidence,
    },
  };
  writeFileSync(path.join(root, ".fixture-pba-response.json"), \`\${JSON.stringify(productBuildAuthorityV2Observation.response)}\\n\`);
  const buildIdentity = {
    schema: "mission-control.internal-production-build-identity.v1",
    sourceSha,
    treeHash,
    buildHash: evidenceCore.currentSource.buildHash,
  };
  const loadedBuild = {
    schema: "mission-control.product-build-authority-v2-loaded-build.v1",
    entryModulePath: "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js",
    entryModuleHash: "b".repeat(64),
    buildIdentity,
    buildIdentityHash: sha256(Buffer.from(JSON.stringify(buildIdentity) + "\\n", "utf8")),
  };
  const loadedBuildHash = hashCanonicalJsonV1(loadedBuild);
  writeFileSync(path.join(root, ".fixture-loaded-response.json"), \`\${JSON.stringify({
    schema: "mission-control.product-build-authority-v2-loaded-build-response.v1",
    loadedBuildRef: \`mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/\${loadedBuildHash}\`,
    loadedBuildHash,
    startupInstance: { schema: "mission-control.product-build-authority-v2-startup-instance.v1", pid: process.pid, instanceId: "10000000-0000-4000-8000-000000000001" },
    loadedBuild,
  })}\`);
  const observed = { sourceBuild: fixtureSourceBuild, productBuildAuthorityV2Observation };
  // OA18_PRIVATE_FIXTURE_AUTHORITIES_END`,
  );
  source = source.replace(
    /  \/\/ OA18_PRIVATE_FIXTURE_PBA_V2_START\n[\s\S]*?  \/\/ OA18_PRIVATE_FIXTURE_PBA_V2_END/,
    `  // OA18_PRIVATE_FIXTURE_PBA_V2_START
  const pba = observeOperationAuthoritiesV1(root).productBuildAuthorityV2Observation;
  // OA18_PRIVATE_FIXTURE_PBA_V2_END`,
  );
  assert.equal(source.includes(".fixture-retention-v1"), true);
  assert.equal(source.includes("const pba = observeOperationAuthoritiesV1(root).productBuildAuthorityV2Observation;"), true);
  writeFileSync(modulePath, source);
  fixtureFile(root, ".gitignore", ".setfarm/\ndist/\n.fixture*\nLibrary/\ndist-server/\n");
  git(root, ["add", ".gitignore", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "--no-edit", "-q"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function advanceFixtureMissionControlDiskAuthority(root) {
  const file = join(root, ".fixture-pba-response.json");
  const response = JSON.parse(readFileSync(file, "utf8"));
  const evidenceCore = {
    ...response.evidence,
    currentSource: {
      ...response.evidence.currentSource,
      sha: "f".repeat(40),
      treeHash: "e".repeat(40),
      buildHash: "d".repeat(64),
      originMainSha: "f".repeat(40),
    },
  };
  delete evidenceCore.deliveryEvidenceRef;
  delete evidenceCore.deliveryEvidenceHash;
  const deliveryEvidenceHash = hashCanonicalFixture(evidenceCore);
  const deliveryEvidenceRef = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`;
  const evidence = { ...evidenceCore, deliveryEvidenceRef, deliveryEvidenceHash };
  writeFileSync(file, `${JSON.stringify({
    schema: response.schema,
    currentStatus: response.currentStatus,
    deliveryEvidenceRef,
    deliveryEvidenceHash,
    evidence,
  })}\n`);
}

function prepareThreeGenerationFixture(root) {
  installPrivateRetentionObservers(root);
  rotateFixtureGeneration(root, BUILD_ID, "1");
  fixtureFile(root, "dist/artifact.txt", "second\n");
  rotateFixtureGeneration(root, BUILD_ID_2, "2");
  fixtureFile(root, "dist/artifact.txt", "third\n");
  rotateFixtureGeneration(root, BUILD_ID_3, "3");
}

function prepareRetentionOperation(root) {
  return spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
  });
}

function resumeRetentionOperation(root, pair) {
  return spawnSync(process.execPath, [
    "scripts/build-generation-retention.mjs", "resume", "--operation-ref", pair.operationRef,
    "--operation-hash", pair.operationHash, "--json",
  ], { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
}

function installTerminalCrashSequence(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  const eraseBoundary = "        executeEraseStepV1(quarantine, step, intent);";
  const receiptBoundary = "    const receipt = publishOrAdoptOnlyReceiptV1(stores, receiptProjection);";
  const dispositionBoundary = "    if (canonicalJsonV1(disposition.retentionReceipt)";
  assert.equal(source.includes(eraseBoundary), true);
  assert.equal(source.includes(receiptBoundary), true);
  assert.equal(source.includes(dispositionBoundary), true);
  source = source.replace(eraseBoundary, `${eraseBoundary}
        if (step.kind === "root" && !optionalLstat(path.join(root, ".fixture-root-crash"))) {
          writeFileSync(path.join(root, ".fixture-root-crash"), "crashed\\n");
          process.exit(91);
        }`);
  source = source.replace(receiptBoundary, `${receiptBoundary}
    if (!optionalLstat(path.join(root, ".fixture-receipt-crash"))) {
      writeFileSync(path.join(root, ".fixture-receipt-crash"), "crashed\\n");
      process.exit(92);
    }`);
  source = source.replace(dispositionBoundary, `    if (!optionalLstat(path.join(root, ".fixture-disposition-crash"))) {
      writeFileSync(path.join(root, ".fixture-disposition-crash"), "crashed\\n");
      process.exit(93);
    }
${dispositionBoundary}`);
  writeFileSync(modulePath, source);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "--no-edit", "-q"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function installWriterLockHold(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  const boundary = '  const lock = acquireMaintenanceLock(setfarm, "writer_prepare", candidateKeyHash);';
  assert.equal(source.includes(boundary), true);
  source = source.replace(boundary, `${boundary}
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);`);
  writeFileSync(modulePath, source);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "--no-edit", "-q"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function runModuleAsync(root, expression, extraArguments = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", expression, ...extraArguments], {
      cwd: root,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

function installMaintenanceRaceProbe(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  const recovered = "  recoverMaintenanceLock(setfarm);";
  const selected = `    selected = Object.freeze({
      name,
      path: tempPath,
      observed: readStableRegular(tempPath, { device, mode: expectedMode, linkCounts: [1] }),
    });`;
  assert.equal(source.includes(recovered), true);
  assert.equal(source.includes(selected), true);
  source = source.replace(recovered, `${recovered}
  const fixtureRole = process.argv.find((value) => value === "fixture-first" || value === "fixture-second");
  if (fixtureRole) {
    writeFileSync(path.join(setfarm, ".fixture-ready-" + fixtureRole), "ready\\n");
    while (readdirSync(setfarm).filter((name) => name.startsWith(".fixture-ready-")).length < 2) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
    if (fixtureRole === "fixture-second") Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }`);
  source = source.replace(selected, `${selected}
    if (basename === MAINTENANCE_LOCK_FILE && process.argv.includes("fixture-first")) {
      writeFileSync(path.join(directory, ".fixture-first-temp-ready"), "ready\\n");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
      if (!optionalLstat(selected.path)) writeFileSync(path.join(directory, ".fixture-foreign-temp-unlinked"), "unsafe\\n");
    }`);
  writeFileSync(modulePath, source);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "--no-edit", "-q"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function installEveryNonRootEraseCrash(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  const boundary = "        executeEraseStepV1(quarantine, step, intent);";
  assert.equal(source.includes(boundary), true);
  source = source.replace(boundary, `${boundary}
        if (step.locator !== ".") {
          const marker = path.join(root, ".fixture-erase-crash-" + chain.nextOrdinal);
          if (!optionalLstat(marker)) {
            writeFileSync(marker, "crashed\\n");
            process.exit(91);
          }
        }`);
  writeFileSync(modulePath, source);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "--no-edit", "-q"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function installQuarantineRenameCrash(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  const boundary = "        renameSync(archive, quarantine);";
  assert.equal(source.includes(boundary), true);
  source = source.replace(boundary, `${boundary}
        if (!optionalLstat(path.join(root, ".fixture-quarantine-rename-crash"))) {
          writeFileSync(path.join(root, ".fixture-quarantine-rename-crash"), "crashed\\n");
          process.exit(91);
        }`);
  writeFileSync(modulePath, source);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "--no-edit", "-q"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function installExtraLoadedLsofRecord(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  const source = readFileSync(modulePath, "utf8");
  const boundary = "function fixedChildResult(executable, argv, options = {}) {";
  assert.equal(source.includes(boundary), true);
  writeFileSync(modulePath, source.replace(boundary, `${boundary}
  if (executable === LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1 && argv[0] === "-a") {
    const bytes = Buffer.from("p" + argv[2] + "\\0\\nftxt\\0n" + process.execPath + "\\0\\nftxt\\0n" + process.execPath + "\\0\\n", "utf8");
    return { error: null, signal: null, status: 0, stdout: bytes, stderr: Buffer.alloc(0) };
  }`));
}

function installSingleLoadedLsofRecord(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  const source = readFileSync(modulePath, "utf8");
  const boundary = "function fixedChildResult(executable, argv, options = {}) {";
  assert.equal(source.includes(boundary), true);
  writeFileSync(modulePath, source.replace(boundary, `${boundary}
  if (executable === LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1 && argv[0] === "-a") {
    const bytes = Buffer.from("p" + argv[2] + "\\0\\nftxt\\0n" + process.execPath + "\\0\\n", "utf8");
    return { error: null, signal: null, status: 0, stdout: bytes, stderr: Buffer.alloc(0) };
  }`));
}

async function importFixtureInternals(root, names) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  const source = readFileSync(modulePath, "utf8");
  writeFileSync(modulePath, `${source}\nexport { ${names.join(", ")} };\n`);
  return import(`${pathToFileURL(modulePath).href}?fixture=${Date.now()}-${Math.random()}`);
}

function installStaleBuildAuthorityProbe(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  const source = readFileSync(modulePath, "utf8");
  writeFileSync(modulePath, `${source}\nexport { observeCurrentRetentionControllerSourceV2, observeRetainedCurrentBuildV1 };\n`);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "--no-edit", "-q"]);
  git(root, ["remote", "add", "origin", "https://github.com/hikmetgulsesli/setfarm.git"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function prepareStaleBuildAuthorityFixture() {
  const root = createFixture();
  installStaleBuildAuthorityProbe(root);
  const retainedSourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
  const retainedSourceTreeHash = git(root, ["rev-parse", "HEAD^{tree}"]);
  const retainedPinned = fixturePinnedInputSet(root, retainedSourceSha);
  const retainedBuildHash = writeFinalizedRuntimeDist(root);
  const buildInfoBytes = readFileSync(join(root, "dist/BUILD_INFO.json"));
  const outputTree = JSON.parse(readFileSync(join(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), "utf8"));
  const releaseManifest = JSON.parse(readFileSync(join(root, "dist/PLATFORM_RELEASE_MANIFEST.json"), "utf8"));
  fixtureFile(root, "tracked.txt", "current controller source\n");
  git(root, ["add", "tracked.txt"]);
  git(root, ["commit", "-qm", "advance controller source"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  const controllerSourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
  const controllerSourceTreeHash = git(root, ["rev-parse", "HEAD^{tree}"]);
  const controllerPinned = fixturePinnedInputSet(root, controllerSourceSha);
  return {
    root,
    retainedSourceSha,
    retainedSourceTreeHash,
    retainedPinned,
    retainedBuildHash,
    buildInfoBytes,
    outputTree,
    releaseManifest,
    controllerSourceSha,
    controllerSourceTreeHash,
    controllerPinned,
  };
}

async function importStaleBuildAuthorityFixture(root) {
  return import(`${pathToFileURL(join(root, "scripts/build-generation-retention.mjs")).href}?stale-build-authority=${Date.now()}-${Math.random()}`);
}

function task1AuthorityStoreSnapshot(root) {
  return {
    setfarm: existsSync(join(root, ".setfarm")),
    retention: existsSync(join(root, ".fixture-retention-v1")),
  };
}

function rewriteFinalizedFixtureJson(root, locator, transform, pretty = false) {
  const target = join(root, "dist", locator);
  const value = transform(JSON.parse(readFileSync(target, "utf8")));
  chmodSync(target, 0o644);
  writeFileSync(target, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`);
  chmodSync(target, 0o444);
}

function prepareGenerationBoundFixture(count, { advance = true, writerCap = 8 } = {}) {
  const root = createFixture();
  if (writerCap !== 8) {
    const modulePath = join(root, "scripts/build-generation-retention.mjs");
    const source = readFileSync(modulePath, "utf8");
    const boundary = "if (inspection.generations.filter((generation) => generation.disposition === null).length >= 8)";
    assert.equal(source.includes(boundary), true);
    writeFileSync(modulePath, source.replace(boundary, `if (inspection.generations.filter((generation) => generation.disposition === null).length >= ${writerCap})`));
    git(root, ["add", "scripts/build-generation-retention.mjs"]);
    git(root, ["commit", "--amend", "--no-edit", "-q"]);
    git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  }
  installPrivateRetentionObservers(root);
  for (let ordinal = 1; ordinal <= count; ordinal += 1) {
    rotateFixtureGeneration(root, fixtureBuildId(ordinal), String(ordinal));
  }
  const retainedSourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
  const retainedBuildHash = writeFinalizedRuntimeDist(root);
  if (advance) {
    fixtureFile(root, "tracked.txt", "post-build controller source\n");
    git(root, ["add", "tracked.txt"]);
    git(root, ["commit", "-qm", "advance after retained build"]);
    git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  }
  return { root, retainedSourceSha, retainedBuildHash, controllerSourceSha: git(root, ["rev-parse", "HEAD^{commit}"]) };
}

function assertNoGenerationDisposition(root, expectedArchives) {
  assert.equal(readdirSync(join(root, ".setfarm/build-generations-v1")).filter((name) => name.endsWith(".dist")).length, expectedArchives);
  assert.equal(existsSync(join(root, ".setfarm/build-generation-quarantine-v1")), false);
  assert.equal(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/dispositions")).length, 0);
}

function installV2PrepareCrash(root, phase) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  const boundary = phase === "operation"
    ? '    publishNoReplaceFileV1(stores.operations, `${operation.operationHash}.json`, canonicalRecordBytes(operation), 0o600);'
    : "    publishNoReplaceFileV1(stores.operationCandidates, candidateIndexNameV1(candidateCompletion), canonicalRecordBytes(index), 0o600);";
  assert.equal(source.includes(boundary), true);
  source = source.replace(boundary, `${boundary}
    if (!optionalLstat(path.join(root, ".fixture-v2-${phase}-crash"))) {
      writeFileSync(path.join(root, ".fixture-v2-${phase}-crash"), "crashed\\n");
      process.exit(${phase === "operation" ? 91 : 92});
    }`);
  writeFileSync(modulePath, source);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "-qm", `inject ${phase} response loss`]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function installV1OnlyPrepareRegression(root) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  let source = readFileSync(modulePath, "utf8");
  const v2Branch = `      operationVersion = 2;
      authorities = observeOperationAuthoritiesV2(root, inspectionBefore);`;
  assert.equal(source.includes(v2Branch), true);
  source = source.replace(v2Branch, "      authorities = observeOperationAuthoritiesV1(root);");
  writeFileSync(modulePath, source);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "-qm", "restore v1-only prepare"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

describe("OA18 build-generation retention authority", () => {
  it("imports the operator module without executing its CLI", async () => {
    const authority = await import("../build-generation-retention.mjs");

    assert.deepEqual(Object.keys(authority).sort(), [
      "canonicalJsonV1",
      "classifyBuildGenerationRetentionPublisherRecordV1",
      "hashCanonicalJsonV1",
      "inspectBuildGenerationRetentionV1",
      "inspectBuildGenerationRotationLedgerV1",
      "planNoReplacePublisherRecoveryV1",
    ]);
    assert.equal(typeof authority.inspectBuildGenerationRotationLedgerV1, "function");
    assert.equal(typeof authority.inspectBuildGenerationRetentionV1, "function");
    assert.equal(authority.runBuildGenerationWriterPrepareV1, undefined);
    assert.equal(authority.runBuildGenerationWriterRotationV1, undefined);
    assert.equal(authority.withBuildGenerationWriterMaintenanceLockV1, undefined);
    assert.equal(typeof authority.planNoReplacePublisherRecoveryV1, "function");
    assert.equal(authority.inspectBuildGenerationRotationLedgerV1.length, 0);
    assert.equal(authority.inspectBuildGenerationRetentionV1.length, 0);
  });

  it("OA18 v2 freezes the private schema dispatcher and source boundary", () => {
    const source = readFileSync(join(sourceRoot, "scripts/build-generation-retention.mjs"), "utf8");
    assert.deepEqual([...new Set(source.match(/setfarm\.platform-build-generation-retention-operation\.v[0-9]+/g))].sort(), [
      "setfarm.platform-build-generation-retention-operation.v1",
      "setfarm.platform-build-generation-retention-operation.v2",
    ]);
    for (const name of [
      "observeCurrentRetentionControllerSourceV2",
      "observeRetainedCurrentBuildV1",
      "observeOperationAuthoritiesV2",
      "parseRetentionOperationV1",
      "parseRetentionOperationV2",
      "parseRetentionOperationV1OrV2",
      "validateHistoricalClosureV1",
      "validateHistoricalClosureV2",
    ]) {
      assert.equal((source.match(new RegExp(`function ${name}\\(`, "g")) ?? []).length, 1, name);
      assert.equal(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\(`).test(source), false, name);
    }
    assert.equal((source.match(/\["merge-base", "--is-ancestor", buildInfo\.sha, controllerSource\.sourceSha\]/g) ?? []).length, 1);
    assert.equal((source.match(/operation_retained_current_setfarm_build/g) ?? []).length >= 4, true);
    assert.equal(source.includes("process.env"), false);
    assert.equal(source.includes("rmSync("), false);
    assert.equal(source.includes('from "./write-build-info.mjs"'), false);
  });

  it("OA18 v2 separates current controller source from the retained finalized build", async () => {
    const fixture = prepareStaleBuildAuthorityFixture();
    const { root } = fixture;
    try {
      const authority = await importStaleBuildAuthorityFixture(root);
      const repositoryRoot = realpathSync(root);
      const controllerSource = authority.observeCurrentRetentionControllerSourceV2(repositoryRoot);
      const retainedCurrentBuild = authority.observeRetainedCurrentBuildV1(repositoryRoot, controllerSource);

      assert.deepEqual(controllerSource, {
        branch: "main",
        clean: true,
        sourceSha: fixture.controllerSourceSha,
        sourceTreeHash: fixture.controllerSourceTreeHash,
        originMainSha: fixture.controllerSourceSha,
        buildInputSetHash: fixture.controllerPinned.buildInputSetHash,
      });
      assert.deepEqual(retainedCurrentBuild, {
        schema: "setfarm.platform-build-generation-retained-current-build.v1",
        sourceSha: fixture.retainedSourceSha,
        sourceTreeHash: fixture.retainedSourceTreeHash,
        buildHash: fixture.retainedBuildHash,
        buildInputSetHash: fixture.retainedPinned.buildInputSetHash,
        buildInfoHash: createHash("sha256").update(fixture.buildInfoBytes).digest("hex"),
        outputTreeHash: fixture.outputTree.outputTreeHash,
        releaseManifestHash: hashCanonicalFixture(fixture.releaseManifest),
      });
      assert.notEqual(retainedCurrentBuild.sourceSha, controllerSource.sourceSha);
      assert.deepEqual(task1AuthorityStoreSnapshot(root), { setfarm: false, retention: false });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("OA18 v2 refuses crossed controller and retained-build authorities before store mutation", async (context) => {
    const controllerRows = [
      ["dirty worktree", (fixture) => fixtureFile(fixture.root, "tracked.txt", "dirty\n")],
      ["wrong branch", (fixture) => git(fixture.root, ["checkout", "-qb", "not-main"])],
      ["stale origin", (fixture) => git(fixture.root, ["update-ref", "refs/remotes/origin/main", fixture.retainedSourceSha])],
    ];
    for (const [name, mutate] of controllerRows) {
      await context.test(name, async () => {
        const fixture = prepareStaleBuildAuthorityFixture();
        try {
          const authority = await importStaleBuildAuthorityFixture(fixture.root);
          mutate(fixture);
          const before = task1AuthorityStoreSnapshot(fixture.root);
          assert.throws(
            () => authority.observeCurrentRetentionControllerSourceV2(realpathSync(fixture.root)),
            /controller|clean|branch|origin|source/i,
          );
          assert.deepEqual(task1AuthorityStoreSnapshot(fixture.root), before);
        } finally {
          rmSync(fixture.root, { recursive: true, force: true });
        }
      });
    }

    const retainedRows = [
      ["equal source", (fixture) => { writeFinalizedRuntimeDist(fixture.root); }],
      ["nonancestor source", (fixture) => {
        const tree = git(fixture.root, ["rev-parse", "HEAD^{tree}"]);
        const result = spawnSync("/usr/bin/git", ["commit-tree", tree], {
          cwd: fixture.root,
          encoding: "utf8",
          input: "divergent controller\n",
          env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
        });
        assert.equal(result.status, 0, result.stderr);
        const divergent = result.stdout.trim();
        git(fixture.root, ["update-ref", "refs/heads/main", divergent]);
        git(fixture.root, ["update-ref", "refs/remotes/origin/main", divergent]);
      }],
      ["missing historical object", (fixture) => {
        const objectPath = join(fixture.root, ".git", "objects", fixture.retainedSourceSha.slice(0, 2), fixture.retainedSourceSha.slice(2));
        rmSync(objectPath);
      }],
      ["malformed terminal JSON", (fixture) => {
        const target = join(fixture.root, "dist/BUILD_INFO.json");
        chmodSync(target, 0o644);
        writeFileSync(target, "{\n");
        chmodSync(target, 0o444);
      }],
      ["wrong terminal mode", (fixture) => chmodSync(join(fixture.root, "dist/BUILD_INFO.json"), 0o644)],
      ["hardlinked terminal authority", (fixture) => linkSync(join(fixture.root, "dist/BUILD_INFO.json"), join(fixture.root, "dist/BUILD_INFO.link"))],
      ["crossed output source", (fixture) => rewriteFinalizedFixtureJson(fixture.root, "PLATFORM_BUILD_OUTPUT_TREE.json", (value) => ({ ...value, sourceSha: fixture.controllerSourceSha }))],
      ["ordinary output drift", (fixture) => fixtureFile(fixture.root, "dist/service.js", "export const fixtureRuntime = false;\n")],
      ["build-info byte drift", (fixture) => rewriteFinalizedFixtureJson(fixture.root, "BUILD_INFO.json", (value) => value, false)],
      ["manifest drift", (fixture) => rewriteFinalizedFixtureJson(fixture.root, "PLATFORM_RELEASE_MANIFEST.json", (value) => ({
        ...value,
        stitchConverter: { ...value.stitchConverter, converterId: "crossed.converter" },
      }))],
      ["controller-build hash drift", (fixture) => rewriteFinalizedFixtureJson(fixture.root, "PLATFORM_BUILD_OUTPUT_TREE.json", (value) => ({ ...value, outputTreeHash: "f".repeat(64) }))],
    ];
    for (const [name, mutate] of retainedRows) {
      await context.test(name, async () => {
        const fixture = prepareStaleBuildAuthorityFixture();
        try {
          const authority = await importStaleBuildAuthorityFixture(fixture.root);
          const repositoryRoot = realpathSync(fixture.root);
          if (name === "nonancestor source") mutate(fixture);
          const controller = authority.observeCurrentRetentionControllerSourceV2(repositoryRoot);
          if (name !== "nonancestor source") mutate(fixture);
          const before = task1AuthorityStoreSnapshot(fixture.root);
          assert.throws(
            () => authority.observeRetainedCurrentBuildV1(repositoryRoot, controller),
            /retained|loaded Setfarm|historical|finalized|authority|ancestor|build|mode|link|Git/i,
          );
          assert.deepEqual(task1AuthorityStoreSnapshot(fixture.root), before);
        } finally {
          rmSync(fixture.root, { recursive: true, force: true });
        }
      });
    }
  });

  it("OA18 v2 prepares the lowest generation under the exact eight-generation stale-build deadlock", () => {
    const fixture = prepareGenerationBoundFixture(8);
    const { root } = fixture;
    try {
      const prepared = prepareRetentionOperation(root);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const operation = JSON.parse(readFileSync(join(root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
      assert.equal(operation.operationCore.schema, "setfarm.platform-build-generation-retention-operation.v2");
      assert.equal(operation.operationCore.candidateOrdinal, 1);
      assert.equal(operation.operationCore.controllerSource.sourceSha, fixture.controllerSourceSha);
      assert.equal(operation.operationCore.retainedCurrentBuild.sourceSha, fixture.retainedSourceSha);
      assert.equal(operation.operationCore.retainedCurrentBuild.buildHash, fixture.retainedBuildHash);
      for (const expected of operation.operationCore.expectedRuntimeSources.slice(0, 2)) {
        assert.equal(expected.provenance, "operation_retained_current_setfarm_build");
        assert.deepEqual(expected.sourcePair, {
          sourceSha: operation.operationCore.retainedCurrentBuild.sourceSha,
          sourceTreeHash: operation.operationCore.retainedCurrentBuild.sourceTreeHash,
          controllerBuildHash: operation.operationCore.retainedCurrentBuild.buildHash,
        });
        assert.deepEqual(expected.sourceBody, operation.operationCore.retainedCurrentBuild);
      }
      assertNoGenerationDisposition(root, 8);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("OA18 v2 refuses ineligible or crossed prepare prefixes without disposition", async (context) => {
    for (const [name, create, mutate] of [
      ["seven active stale generations", () => prepareGenerationBoundFixture(7), () => {}],
      ["nine active stale generations", () => prepareGenerationBoundFixture(9, { writerCap: 9 }), () => {}],
      ["missing finalized dist", () => prepareGenerationBoundFixture(8), ({ root }) => rmSync(join(root, "dist"), { recursive: true })],
      ["nonancestor retained build", () => prepareGenerationBoundFixture(8), ({ root }) => {
        const tree = git(root, ["rev-parse", "HEAD^{tree}"]);
        const result = spawnSync("/usr/bin/git", ["commit-tree", tree], { cwd: root, encoding: "utf8", input: "divergent\n" });
        assert.equal(result.status, 0, result.stderr);
        const divergent = result.stdout.trim();
        git(root, ["update-ref", "refs/heads/main", divergent]);
        git(root, ["update-ref", "refs/remotes/origin/main", divergent]);
      }],
      ["crossed current PBA", () => prepareGenerationBoundFixture(8), ({ root }) => fixtureFile(root, ".fixture-crossed-loaded-source", "crossed\n")],
    ]) {
      await context.test(name, () => {
        const fixture = create();
        try {
          mutate(fixture);
          const result = prepareRetentionOperation(fixture.root);
          assert.notEqual(result.status, 0);
          assertNoGenerationDisposition(fixture.root, name.startsWith("nine") ? 9 : name.startsWith("seven") ? 7 : 8);
          const store = join(fixture.root, ".fixture-retention-v1");
          if (existsSync(store)) {
            assert.equal(readdirSync(join(store, "operations/sha256")).length, 0);
            assert.equal(readdirSync(join(store, "operation-candidates/sha256")).length, 0);
          }
        } finally {
          rmSync(fixture.root, { recursive: true, force: true });
        }
      });
    }

    await context.test("equal source remains the v1 operation", () => {
      const fixture = prepareGenerationBoundFixture(8, { advance: false });
      try {
        const result = prepareRetentionOperation(fixture.root);
        assert.equal(result.status, 0, result.stderr);
        const pair = JSON.parse(result.stdout);
        const operation = JSON.parse(readFileSync(join(fixture.root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
        assert.equal(operation.operationCore.schema, "setfarm.platform-build-generation-retention-operation.v1");
        assertNoGenerationDisposition(fixture.root, 8);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });

    await context.test("pre-existing v1 candidate index cannot be relabelled v2", () => {
      const fixture = prepareGenerationBoundFixture(8, { advance: false });
      try {
        const first = prepareRetentionOperation(fixture.root);
        assert.equal(first.status, 0, first.stderr);
        fixtureFile(fixture.root, "tracked.txt", "post-v1 controller\n");
        git(fixture.root, ["add", "tracked.txt"]);
        git(fixture.root, ["commit", "-qm", "advance after v1 operation"]);
        git(fixture.root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
        const second = prepareRetentionOperation(fixture.root);
        assert.notEqual(second.status, 0);
        assertNoGenerationDisposition(fixture.root, 8);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  });

  it("OA18 v2 adopts operation and index publication response loss", async (context) => {
    for (const phase of ["operation", "index"]) {
      await context.test(phase, () => {
        const fixture = prepareGenerationBoundFixture(8);
        try {
          installV2PrepareCrash(fixture.root, phase);
          const first = prepareRetentionOperation(fixture.root);
          assert.equal(first.status, phase === "operation" ? 91 : 92, first.stderr);
          const second = prepareRetentionOperation(fixture.root);
          assert.equal(second.status, 0, second.stderr);
          const pair = JSON.parse(second.stdout);
          const operationNames = readdirSync(join(fixture.root, ".fixture-retention-v1/operations/sha256")).filter((name) => /^[0-9a-f]{64}\.json$/.test(name));
          const indexNames = readdirSync(join(fixture.root, ".fixture-retention-v1/operation-candidates/sha256")).filter((name) => /^[0-9a-f]{64}\.json$/.test(name));
          assert.deepEqual(operationNames, [`${pair.operationHash}.json`]);
          assert.equal(indexNames.length, 1);
          assertNoGenerationDisposition(fixture.root, 8);
        } finally {
          rmSync(fixture.root, { recursive: true, force: true });
        }
      });
    }
  });

  it("OA18 v2 resumes pair-only and permanently disposes only the selected retained generation", () => {
    const fixture = prepareGenerationBoundFixture(8);
    try {
      const prepared = prepareRetentionOperation(fixture.root);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const resumed = resumeRetentionOperation(fixture.root, pair);
      assert.equal(resumed.status, 0, resumed.stderr);
      const receiptPair = JSON.parse(resumed.stdout);
      assert.match(receiptPair.receiptRef, /^setfarm:\/\/internal-production\/build-generation-retention-receipt\/sha256\/[0-9a-f]{64}$/);
      assert.match(receiptPair.receiptHash, /^[0-9a-f]{64}$/);
      assert.equal(existsSync(join(fixture.root, `.setfarm/build-generations-v1/${fixtureBuildId(1)}.dist`)), false);
      assert.equal(existsSync(join(fixture.root, `.setfarm/build-generation-quarantine-v1/${pair.operationHash}.dist`)), false);
      assert.equal(readdirSync(join(fixture.root, ".setfarm/build-generations-v1")).filter((name) => name.endsWith(".dist")).length, 7);
      assert.equal(readdirSync(join(fixture.root, ".setfarm/build-generation-rotation-ledger-v1/dispositions")).length, 1);
      const replay = resumeRetentionOperation(fixture.root, pair);
      assert.equal(replay.status, 0, replay.stderr);
      assert.equal(replay.stdout, resumed.stdout);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("OA18 historical v1 records remain terminally resolvable after the controller source advances", () => {
    const root = createFixture();
    try {
      prepareThreeGenerationFixture(root);
      const prepared = prepareRetentionOperation(root);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const resumed = resumeRetentionOperation(root, pair);
      assert.equal(resumed.status, 0, resumed.stderr);
      const receiptPair = JSON.parse(resumed.stdout);
      const modulePath = join(root, "scripts/build-generation-retention.mjs");
      writeFileSync(modulePath, `${readFileSync(modulePath, "utf8")}\n// later controller source\n`);
      git(root, ["add", "scripts/build-generation-retention.mjs"]);
      git(root, ["commit", "-qm", "advance retention controller"]);
      git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      const inspected = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "inspect"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(inspected.status, 0, inspected.stderr);
      const body = JSON.parse(inspected.stdout);
      assert.deepEqual(body.receipts, [receiptPair]);
      assert.equal(body.rotation.generations.filter((generation) => generation.disposition === null).length, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("OA18 post-v2 v1 resume adopts a quarantine-rename crash under equal source", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      for (let ordinal = 1; ordinal <= 8; ordinal += 1) rotateFixtureGeneration(root, fixtureBuildId(ordinal), String(ordinal));
      installQuarantineRenameCrash(root);
      writeFinalizedRuntimeDist(root);
      const prepared = prepareRetentionOperation(root);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const operation = JSON.parse(readFileSync(join(root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
      assert.equal(operation.operationCore.schema, "setfarm.platform-build-generation-retention-operation.v1");
      const crashed = resumeRetentionOperation(root, pair);
      assert.equal(crashed.status, 91, crashed.stderr);
      const resumed = resumeRetentionOperation(root, pair);
      assert.equal(resumed.status, 0, resumed.stderr);
      const replay = resumeRetentionOperation(root, pair);
      assert.equal(replay.status, 0, replay.stderr);
      assert.equal(replay.stdout, resumed.stdout);
      assert.equal(readdirSync(join(root, ".setfarm/build-generations-v1")).filter((entry) => entry.endsWith(".dist")).length, 7);
      assert.equal(existsSync(join(root, ".setfarm/build-generation-quarantine-v1", `${pair.operationHash}.dist`)), false);
      assert.equal(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/dispositions")).length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("OA18 v2 resume recovers quarantine, terminal receipt, and disposition response loss", async (context) => {
    for (const [name, install, expectedCrashes] of [
      ["quarantine rename", installQuarantineRenameCrash, [91]],
      ["root receipt disposition", installTerminalCrashSequence, [91, 92, 93]],
    ]) {
      await context.test(name, () => {
        const fixture = prepareGenerationBoundFixture(8);
        try {
          install(fixture.root);
          const prepared = prepareRetentionOperation(fixture.root);
          assert.equal(prepared.status, 0, prepared.stderr);
          const pair = JSON.parse(prepared.stdout);
          for (const expected of expectedCrashes) {
            const crashed = resumeRetentionOperation(fixture.root, pair);
            assert.equal(crashed.status, expected, crashed.stderr);
          }
          const resumed = resumeRetentionOperation(fixture.root, pair);
          assert.equal(resumed.status, 0, resumed.stderr);
          const replay = resumeRetentionOperation(fixture.root, pair);
          assert.equal(replay.status, 0, replay.stderr);
          assert.equal(replay.stdout, resumed.stdout);
          assert.equal(readdirSync(join(fixture.root, ".fixture-retention-v1/receipts/sha256")).filter((name) => /^[0-9a-f]{64}\.json$/.test(name)).length, 1);
          assert.equal(readdirSync(join(fixture.root, ".setfarm/build-generation-rotation-ledger-v1/dispositions")).length, 1);
          assert.equal(readdirSync(join(fixture.root, ".setfarm/build-generations-v1")).filter((entry) => entry.endsWith(".dist")).length, 7);
        } finally {
          rmSync(fixture.root, { recursive: true, force: true });
        }
      });
    }
  });

  it("OA18 v2 resume adopts an unchanged controller closure and refuses changed controller bytes", async (context) => {
    await context.test("HEAD-only advance", () => {
      const fixture = prepareGenerationBoundFixture(8);
      try {
        const prepared = prepareRetentionOperation(fixture.root);
        assert.equal(prepared.status, 0, prepared.stderr);
        const pair = JSON.parse(prepared.stdout);
        fixtureFile(fixture.root, "tracked.txt", "later unrelated controller commit\n");
        git(fixture.root, ["add", "tracked.txt"]);
        git(fixture.root, ["commit", "-qm", "advance unrelated controller input"]);
        git(fixture.root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
        const resumed = resumeRetentionOperation(fixture.root, pair);
        assert.equal(resumed.status, 0, resumed.stderr);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
    await context.test("changed executing byte", () => {
      const fixture = prepareGenerationBoundFixture(8);
      try {
        const prepared = prepareRetentionOperation(fixture.root);
        assert.equal(prepared.status, 0, prepared.stderr);
        const pair = JSON.parse(prepared.stdout);
        const modulePath = join(fixture.root, "scripts/build-generation-retention.mjs");
        writeFileSync(modulePath, `${readFileSync(modulePath, "utf8")}\n// crossed executing byte\n`);
        const resumed = resumeRetentionOperation(fixture.root, pair);
        assert.notEqual(resumed.status, 0);
        assert.match(resumed.stderr, /executing (?:closure changed|bytes differ from Git)/i);
        assertNoGenerationDisposition(fixture.root, 8);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  });

  it("OA18 post-v2 v1 resume refuses a nonterminal operation from changed executing bytes", () => {
    const fixture = prepareGenerationBoundFixture(8, { advance: false });
    try {
      const prepared = prepareRetentionOperation(fixture.root);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const modulePath = join(fixture.root, "scripts/build-generation-retention.mjs");
      writeFileSync(modulePath, `${readFileSync(modulePath, "utf8")}\n// incompatible later controller\n`);
      git(fixture.root, ["add", "scripts/build-generation-retention.mjs"]);
      git(fixture.root, ["commit", "-qm", "install incompatible controller"]);
      git(fixture.root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      const beforeOperations = readdirSync(join(fixture.root, ".fixture-retention-v1/operations/sha256"));
      const resumed = resumeRetentionOperation(fixture.root, pair);
      assert.notEqual(resumed.status, 0);
      assert.match(resumed.stderr, /executing (?:closure changed|bytes differ from Git)/i);
      assert.deepEqual(readdirSync(join(fixture.root, ".fixture-retention-v1/operations/sha256")), beforeOperations);
      assert.equal(readdirSync(join(fixture.root, ".fixture-retention-v1/receipts/sha256")).length, 0);
      assertNoGenerationDisposition(fixture.root, 8);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("OA18 v2 parser rejects crossed controller, retained build, runtime, closure, and candidate bodies", async () => {
    const fixture = prepareGenerationBoundFixture(8);
    try {
      const prepared = prepareRetentionOperation(fixture.root);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const stored = JSON.parse(readFileSync(join(fixture.root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
      const { parseRetentionOperationV2, hashCanonicalJsonV1 } = await importFixtureInternals(fixture.root, ["parseRetentionOperationV2"]);
      const crossedOperation = (mutate, { preservePair = true } = {}) => {
        const value = structuredClone(stored);
        mutate(value);
        if (!preservePair) {
          const digest = hashCanonicalJsonV1(value.operationCore);
          value.operationHash = digest;
          value.operationRef = `setfarm://internal-production/build-generation-retention-operation/sha256/${digest}`;
          value.expectedQuarantineLocator = `.setfarm/build-generation-quarantine-v1/${digest}.dist`;
        }
        return value;
      };
      const rows = [
        ["controller", (value) => { value.operationCore.controllerSource.buildInputSetHash = "f".repeat(64); }],
        ["retained build", (value) => { value.operationCore.retainedCurrentBuild.buildInfoHash = "f".repeat(64); }],
        ["retained output", (value) => { value.operationCore.retainedCurrentBuild.outputTreeHash = "f".repeat(64); }],
        ["retained manifest", (value) => { value.operationCore.retainedCurrentBuild.releaseManifestHash = "f".repeat(64); }],
        ["runtime provenance", (value) => { value.operationCore.expectedRuntimeSources[0].provenance = "operation_current_oa17_setfarm_source_build"; }],
        ["runtime pair", (value) => { value.operationCore.expectedRuntimeSources[0].sourcePair.sourceSha = value.operationCore.controllerSource.sourceSha; }],
        ["runtime body", (value) => { value.operationCore.expectedRuntimeSources[1].sourceBody.buildHash = "f".repeat(64); }],
        ["closure entry", (value) => { value.operationCore.executingImplementationClosure.entries[0].sha256 = "f".repeat(64); }],
        ["closure builtin", (value) => { value.operationCore.executingImplementationClosure.nodeBuiltinSpecifiers.push("node:fs"); }],
        ["candidate identity", (value) => { value.operationCore.candidateArchiveIdentity.inoDecimal = "999"; }],
        ["operation pair", (value) => { value.operationRef = `${value.operationRef}-crossed`; }, { preservePair: true }],
      ];
      for (const [name, mutate, options] of rows) {
        assert.throws(() => parseRetentionOperationV2(crossedOperation(mutate, options)), /retention|runtime|closure|candidate|operation|crossed|invalid/i, name);
      }
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("OA18 v2 stale eight-generation success is impossible with the v1-only prepare branch", () => {
    const fixture = prepareGenerationBoundFixture(8);
    try {
      installV1OnlyPrepareRegression(fixture.root);
      const prepared = prepareRetentionOperation(fixture.root);
      assert.notEqual(prepared.status, 0);
      assert.match(prepared.stderr, /loaded Setfarm|source\/build|BUILD_INFO|finalized/i);
      const store = join(fixture.root, ".fixture-retention-v1");
      if (existsSync(store)) {
        assert.equal(readdirSync(join(store, "operations/sha256")).length, 0);
        assert.equal(readdirSync(join(store, "operation-candidates/sha256")).length, 0);
      }
      assertNoGenerationDisposition(fixture.root, 8);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("classifies semantic-invalid publisher bytes for every retention store family", async () => {
    const { classifyBuildGenerationRetentionPublisherRecordV1 } = await import("../build-generation-retention.mjs");
    assert.equal(typeof classifyBuildGenerationRetentionPublisherRecordV1, "function");
    for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
      assert.deepEqual(classifyBuildGenerationRetentionPublisherRecordV1({
        store,
        basename: `${"a".repeat(64)}.json`,
        bytes: Buffer.from("{}\n", "utf8"),
      }), { state: "invalid" }, store);
    }
  });

  it("purely plans bounded no-replace publisher recovery without an IO seam", async () => {
    const { planNoReplacePublisherRecoveryV1 } = await import("../build-generation-retention.mjs");
    const basename = "current-entry.json";
    const candidateBytes = Buffer.from('{"schema":"example.v1","value":1}\n');
    const temp = (suffix, inoDecimal, bytes = candidateBytes, linkCount = 1) => ({
      name: `.current-entry.json.${suffix}.tmp`,
      bytes,
      mode: 0o600,
      linkCount,
      devDecimal: "1",
      inoDecimal,
    });
    const fixed = (inoDecimal, linkCount = 1) => ({
      name: basename,
      bytes: candidateBytes,
      mode: 0o600,
      linkCount,
      devDecimal: "1",
      inoDecimal,
    });
    const first = "10000000-0000-4000-8000-000000000001";
    const second = "20000000-0000-4000-8000-000000000002";

    assert.deepEqual(planNoReplacePublisherRecoveryV1({ basename, candidateBytes, entries: [] }), {
      state: "resume",
      fixedName: basename,
      selectedTempName: null,
      cleanupTempNames: [],
    });
    assert.deepEqual(planNoReplacePublisherRecoveryV1({ basename, candidateBytes, entries: [fixed("11")] }), {
      state: "adopt",
      fixedName: basename,
      selectedTempName: null,
      cleanupTempNames: [],
    });
    assert.deepEqual(planNoReplacePublisherRecoveryV1({
      basename,
      candidateBytes,
      entries: [fixed("11"), temp(second, "13"), temp(first, "12")],
    }), {
      state: "cleanup",
      fixedName: basename,
      selectedTempName: null,
      cleanupTempNames: [`.current-entry.json.${first}.tmp`, `.current-entry.json.${second}.tmp`],
      terminalState: "adopt",
    });
    assert.deepEqual(planNoReplacePublisherRecoveryV1({
      basename,
      candidateBytes,
      entries: [temp(second, "12"), temp(first, "11")],
    }), {
      state: "cleanup",
      fixedName: basename,
      selectedTempName: `.current-entry.json.${first}.tmp`,
      cleanupTempNames: [`.current-entry.json.${second}.tmp`],
      terminalState: "resume",
    });
    assert.deepEqual(planNoReplacePublisherRecoveryV1({
      basename,
      candidateBytes,
      entries: [fixed("11", 2), temp(first, "11", candidateBytes, 2)],
    }), {
      state: "cleanup",
      fixedName: basename,
      selectedTempName: null,
      cleanupTempNames: [`.current-entry.json.${first}.tmp`],
      terminalState: "adopt",
    });
    assert.equal(planNoReplacePublisherRecoveryV1({
      basename,
      candidateBytes,
      entries: [temp(first, "11", Buffer.from('{"schema":"other.v1"}\n'))],
    }).state, "block");
  });

  it("rejects non-JSON authority members recursively before hashing", async () => {
    const { hashCanonicalJsonV1 } = await import("../build-generation-retention.mjs");
    const hidden = { schema: "fixture.v1", nested: { value: 1 } };
    Object.defineProperty(hidden.nested, "concealed", { value: true, enumerable: false });
    assert.throws(() => hashCanonicalJsonV1(hidden), /unsupported|hidden|enumerable|authority|canonical/i);

    const symbolic = { schema: "fixture.v1", nested: { value: 1 } };
    symbolic.nested[Symbol("concealed")] = true;
    assert.throws(() => hashCanonicalJsonV1(symbolic), /unsupported|symbol|authority|canonical/i);

    const arrayWithProperty = [1];
    arrayWithProperty.concealed = true;
    assert.throws(() => hashCanonicalJsonV1({ arrayWithProperty }), /unsupported|extra|authority|canonical/i);

    const sparse = [];
    sparse.length = 1;
    assert.throws(() => hashCanonicalJsonV1({ sparse }), /unsupported|sparse|authority|canonical/i);
  });

  it("rejects authority pairs from the wrong reference domain", async () => {
    const root = createFixture();
    try {
      const { assertRecordPairV1 } = await importFixtureInternals(root, ["assertRecordPairV1"]);
      const digest = "a".repeat(64);
      assert.throws(() => assertRecordPairV1({
        completionRef: `setfarm://wrong-domain/sha256/${digest}`,
        completionHash: digest,
      }, "completion"), /pair|domain|reference|prefix|invalid/i);
      assert.throws(() => assertRecordPairV1({
        operationRef: `setfarm://internal-production/build-generation-retention-receipt/sha256/${digest}`,
        operationHash: digest,
      }, "operation"), /pair|domain|reference|prefix|invalid/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("revalidates recursive zero-reference proof hashes and equality commitments", async () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const operation = JSON.parse(readFileSync(join(root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
      const { assertZeroReferenceProofV1, hashCanonicalJsonV1 } = await importFixtureInternals(root, ["assertZeroReferenceProofV1"]);
      const proof = operation.operationCore.prepareZeroReferenceProof;
      const expected = operation.operationCore.expectedRuntimeSources;
      assert.doesNotThrow(() => assertZeroReferenceProofV1(proof, "prepare", null, operation.operationCore.candidateCompletion, expected));

      const crossed = structuredClone(proof);
      const config = crossed.launchAgentConfigs[0];
      const loadedProcess = config.loadedJobProjection.loadedProcess;
      loadedProcess.processGroupId += 1;
      const equalityBody = { ...loadedProcess };
      delete equalityBody.expectedObservedFieldEqualityHash;
      loadedProcess.expectedObservedFieldEqualityHash = hashCanonicalJsonV1({
        schema: "setfarm.platform-build-generation-expected-observed-field-equality.v1",
        label: config.label,
        expectedRuntimeSource: expected[0],
        loadedProcessObservation: equalityBody,
      });
      const configProjection = { ...config };
      delete configProjection.projectionHash;
      config.projectionHash = hashCanonicalJsonV1(configProjection);
      const proofProjection = { ...crossed };
      delete proofProjection.proofHash;
      crossed.proofHash = hashCanonicalJsonV1(proofProjection);
      assert.throws(
        () => assertZeroReferenceProofV1(crossed, "prepare", null, operation.operationCore.candidateCompletion, expected),
        /loaded process proof/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("cross-binds stored nonsecret commitments to their projected raw fields", async () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const operation = JSON.parse(readFileSync(join(root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
      const { assertZeroReferenceProofV1, hashCanonicalJsonV1 } = await importFixtureInternals(root, ["assertZeroReferenceProofV1"]);
      const crossed = structuredClone(operation.operationCore.prepareZeroReferenceProof);
      const expected = operation.operationCore.expectedRuntimeSources;
      const config = crossed.launchAgentConfigs[0];
      const crossedEffectiveProgram = {
        ...structuredClone(config.plistProjection.pathResolutionCommitments[0]),
        rawValue: config.plistProjection.programArguments[1],
        rawValueHash: config.plistProjection.pathResolutionCommitments[2].rawValueHash,
        tokenCommitments: structuredClone(config.plistProjection.pathResolutionCommitments[2].tokenCommitments),
      };
      config.plistProjection.pathResolutionCommitments[0] = crossedEffectiveProgram;
      config.loadedJobProjection.pathResolutionCommitments[0] = structuredClone(crossedEffectiveProgram);
      const configProjection = { ...config };
      delete configProjection.projectionHash;
      config.projectionHash = hashCanonicalJsonV1(configProjection);
      const proofProjection = { ...crossed };
      delete proofProjection.proofHash;
      crossed.proofHash = hashCanonicalJsonV1(proofProjection);
      assert.throws(
        () => assertZeroReferenceProofV1(crossed, "prepare", null, operation.operationCore.candidateCompletion, expected),
        /commitment|coverage|cross|raw/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("cross-binds loaded process source identity and recomputes its service generation hash", async () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const operation = JSON.parse(readFileSync(join(root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
      const { assertZeroReferenceProofV1, hashCanonicalJsonV1 } = await importFixtureInternals(root, ["assertZeroReferenceProofV1"]);
      const crossed = structuredClone(operation.operationCore.prepareZeroReferenceProof);
      const expected = operation.operationCore.expectedRuntimeSources;
      const config = crossed.launchAgentConfigs[0];
      const processBody = config.loadedJobProjection.loadedProcess;
      processBody.sourceSha = "f".repeat(40);
      processBody.serviceGenerationHash = hashCanonicalJsonV1({
        schema: "setfarm.platform-build-generation-loaded-service-generation.v1",
        label: config.label,
        pid: processBody.pid,
        processLstart: processBody.processLstart,
        processGroupId: processBody.processGroupId,
        executableRealpathHash: processBody.executableRealpathHash,
        loadedArgumentsHash: hashCanonicalJsonV1(config.loadedJobProjection.programArguments),
        entrypointRealpathHash: processBody.entrypointRealpathHash,
        commHash: processBody.commHash,
        commandHash: processBody.commandHash,
        lsofHash: processBody.lsofHash,
        sourceSha: processBody.sourceSha,
        sourceTreeHash: processBody.sourceTreeHash,
        controllerBuildHash: processBody.controllerBuildHash,
      });
      const equalityBody = { ...processBody };
      delete equalityBody.expectedObservedFieldEqualityHash;
      processBody.expectedObservedFieldEqualityHash = hashCanonicalJsonV1({
        schema: "setfarm.platform-build-generation-expected-observed-field-equality.v1",
        label: config.label,
        expectedRuntimeSource: expected[0],
        loadedProcessObservation: equalityBody,
      });
      const configProjection = { ...config };
      delete configProjection.projectionHash;
      config.projectionHash = hashCanonicalJsonV1(configProjection);
      const proofProjection = { ...crossed };
      delete proofProjection.proofHash;
      crossed.proofHash = hashCanonicalJsonV1(proofProjection);
      assert.throws(
        () => assertZeroReferenceProofV1(crossed, "prepare", null, operation.operationCore.candidateCompletion, expected),
        /source|generation|expected|cross/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes one intent and completion before and after a whole-generation rename", () => {
    const root = createFixture();
    try {
      const sourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
      const sourceTreeHash = git(root, ["rev-parse", "HEAD^{tree}"]);
      const input = {
        buildId: BUILD_ID,
        rotationControllerSource: {
          branch: "main",
          clean: true,
          sourceSha,
          sourceTreeHash,
          originMainSha: sourceSha,
          buildInputSetHash: "1".repeat(64),
        },
      };
      const result = runModule(root, writerExpression(input));
      assert.equal(result.status, 0, result.stderr);
      const value = JSON.parse(result.stdout);
      assert.equal(value.rotated, true);
      assert.equal(value.intent.ordinal, 1);
      assert.equal(value.completion.ordinal, 1);
      assert.equal(value.completion.intent.intentRef, value.intent.intentRef);
      assert.equal(value.completion.intent.intentHash, value.intent.intentHash);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/intents")), [
        `00000000000000000001-${BUILD_ID}.json`,
      ]);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/completions")), [
        `00000000000000000001-${BUILD_ID}.json`,
      ]);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generations-v1")), [`${BUILD_ID}.dist`]);
      assert.equal(readFileSync(join(root, `.setfarm/build-generations-v1/${BUILD_ID}.dist/nested/artifact.txt`), "utf8"), "artifact\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a hash-consistent completion crossed from its intent identities", async () => {
    const root = createFixture();
    try {
      const result = runModule(root, writerExpression(rotationInput(root, BUILD_ID, "1")));
      assert.equal(result.status, 0, result.stderr);
      const completionFile = join(root, `.setfarm/build-generation-rotation-ledger-v1/completions/00000000000000000001-${BUILD_ID}.json`);
      const completion = JSON.parse(readFileSync(completionFile, "utf8"));
      const crossedProjection = {
        ...completion,
        sourceParentIdentity: structuredClone(completion.destinationParentIdentity),
      };
      delete crossedProjection.completionRef;
      delete crossedProjection.completionHash;
      const authority = await import(`${pathToFileURL(join(root, "scripts/build-generation-retention.mjs")).href}?completion-cross=${Date.now()}`);
      const completionHash = authority.hashCanonicalJsonV1(crossedProjection);
      const crossed = {
        ...crossedProjection,
        completionRef: `setfarm://internal-production/build-generation-rotation-completion/00000000000000000001/${BUILD_ID}/sha256/${completionHash}`,
        completionHash,
      };
      writeFileSync(completionFile, `${authority.canonicalJsonV1(crossed)}\n`);
      assert.throws(() => authority.inspectBuildGenerationRotationLedgerV1(), /completion|intent|cross|mismatch/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("holds the durable maintenance lock across an intent crash and resumes that intent", () => {
    const root = createFixture();
    try {
      const sourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
      const input = {
        buildId: BUILD_ID,
        rotationControllerSource: {
          branch: "main",
          clean: true,
          sourceSha,
          sourceTreeHash: git(root, ["rev-parse", "HEAD^{tree}"]),
          originMainSha: sourceSha,
          buildInputSetHash: "2".repeat(64),
        },
      };
      const modulePath = join(root, "scripts/build-generation-retention.mjs");
      const original = readFileSync(modulePath, "utf8");
      const boundary = "  renameSync(dist, destination);";
      assert.equal(original.includes(boundary), true);
      writeFileSync(modulePath, original.replace(boundary, "  process.exit(91);\n" + boundary));
      const crashed = runModule(root, writerExpression(input));
      assert.equal(crashed.status, 91, crashed.stderr);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/intents")), [
        `00000000000000000001-${BUILD_ID}.json`,
      ]);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/completions")), []);
      assert.equal(readFileSync(join(root, ".setfarm/build-generation-maintenance-lock-v1.json"), "utf8").includes('"kind":"writer_prepare"'), true);

      writeFileSync(modulePath, original);
      const resumed = runModule(root, writerExpression(input));
      assert.equal(resumed.status, 0, resumed.stderr);
      const value = JSON.parse(resumed.stdout);
      assert.equal(value.intent.intentHash, JSON.parse(readFileSync(
        join(root, `.setfarm/build-generation-rotation-ledger-v1/intents/00000000000000000001-${BUILD_ID}.json`),
        "utf8",
      )).intentHash);
      assert.equal(value.completion.ordinal, 1);
      assert.equal(existsSync(join(root, ".setfarm/build-generation-maintenance-lock-v1.json")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("normalizes a fixed-link crash before scanning the rotation ledger", () => {
    const root = createFixture();
    try {
      const input = rotationInput(root, BUILD_ID, "4");
      const modulePath = join(root, "scripts/build-generation-retention.mjs");
      const original = readFileSync(modulePath, "utf8");
      const boundary = "    fsyncDirectory(directory);\n  } catch (error) {";
      assert.equal(original.includes(boundary), true);
      writeFileSync(modulePath, original.replace(boundary, `    fsyncDirectory(directory);
    if (basename.endsWith("-${BUILD_ID}.json") && !optionalLstat(path.join(repositoryRootV1(), ".fixture-fixed-link-crash"))) {
      writeFileSync(path.join(repositoryRootV1(), ".fixture-fixed-link-crash"), "crashed\\n");
      process.exit(91);
    }
  } catch (error) {`));

      const crashed = runModule(root, writerExpression(input));
      assert.equal(crashed.status, 91, crashed.stderr);
      const intentDirectory = join(root, ".setfarm/build-generation-rotation-ledger-v1/intents");
      assert.equal(readdirSync(intentDirectory).filter((name) => name.endsWith(".tmp")).length, 1);
      assert.equal(readdirSync(intentDirectory).filter((name) => name.endsWith(`${BUILD_ID}.json`)).length, 1);

      writeFileSync(modulePath, original);
      const resumed = runModule(root, writerExpression(input));
      assert.equal(resumed.status, 0, resumed.stderr);
      assert.equal(readdirSync(intentDirectory).filter((name) => name.endsWith(".tmp")).length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prepares only the lowest archive and returns its candidate-keyed operation pair", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");

      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      assert.match(pair.operationRef, /^setfarm:\/\/internal-production\/build-generation-retention-operation\/sha256\/[0-9a-f]{64}$/);
      assert.match(pair.operationHash, /^[0-9a-f]{64}$/);
      const operation = JSON.parse(readFileSync(join(root, `.fixture-retention-v1/operations/sha256/${pair.operationHash}.json`), "utf8"));
      const proof = operation.operationCore.prepareZeroReferenceProof;
      assert.equal(proof.launchAgentConfigs.length, 3);
      for (const config of proof.launchAgentConfigs) {
        assert.notEqual(config.plistBytesHash, config.launchctlBytesHash);
        assert.match(config.loadedJobProjection.loadedProcess.commHash, /^[0-9a-f]{64}$/);
        assert.match(config.loadedJobProjection.loadedProcess.commandHash, /^[0-9a-f]{64}$/);
        assert.match(config.loadedJobProjection.loadedProcess.lsofHash, /^[0-9a-f]{64}$/);
        assert.equal(config.loadedJobProjection.loadedProcess.actualGenerationAuthenticated, true);
      }
      const missionControlProcess = proof.launchAgentConfigs.find((config) => config.label === "com.setrox.mission-control").loadedJobProjection.loadedProcess;
      assert.equal(missionControlProcess.missionControlLoadedBuildProof.schema, "setfarm.platform-build-generation-mission-control-loaded-build-proof.v1");
      assert.equal(missionControlProcess.missionControlLoadedBuildProof.endpoint, "http://127.0.0.1:3080/api/internal-production/product-build-authority-v2-loaded-build");
      assert.equal(missionControlProcess.missionControlLoadedBuildProof.response.startupInstance.pid, missionControlProcess.pid);
      assert.match(missionControlProcess.missionControlLoadedBuildProof.processFence.initialLaunchctlBytesHash, /^[0-9a-f]{64}$/);
      assert.equal(missionControlProcess.missionControlLoadedBuildProof.processFence.finalLaunchctlBytesHash, missionControlProcess.missionControlLoadedBuildProof.processFence.initialLaunchctlBytesHash);
      assert.match(missionControlProcess.missionControlLoadedBuildProof.processFence.initialPsBytesHash, /^[0-9a-f]{64}$/);
      assert.equal(missionControlProcess.missionControlLoadedBuildProof.processFence.finalPsBytesHash, missionControlProcess.missionControlLoadedBuildProof.processFence.initialPsBytesHash);
      assert.match(missionControlProcess.missionControlLoadedBuildProof.listenerFence.initialLsofBytesHash, /^[0-9a-f]{64}$/);
      assert.equal(missionControlProcess.missionControlLoadedBuildProof.listenerFence.finalLsofBytesHash, missionControlProcess.missionControlLoadedBuildProof.listenerFence.initialLsofBytesHash);
      const serialized = JSON.stringify(proof);
      assert.equal(serialized.includes("fixture-operational-token-00000001"), false);
      assert.equal(serialized.includes("postgresql://localhost/fixture"), false);
      assert.equal(readFileSync(join(root, ".fixture-loaded-endpoint-call-count"), "utf8"), "1\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts loaded Mission Control generation A after its current disk authority advances to B", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      advanceFixtureMissionControlDiskAuthority(root);

      const resumed = spawnSync(process.execPath, [
        "scripts/build-generation-retention.mjs", "resume",
        "--operation-ref", pair.operationRef,
        "--operation-hash", pair.operationHash,
        "--json",
      ], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(resumed.status, 0, resumed.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a Mission Control listener whose PID differs from launchctl", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      fixtureFile(root, ".fixture-listener-pid-mismatch", "mismatch\n");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.notEqual(prepared.status, 0);
      assert.match(prepared.stderr, /BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  for (const [name, marker] of [
    ["rejects launchctl identity drift across the Mission Control endpoint fence", ".fixture-launchctl-drift"],
    ["rejects process identity drift across the Mission Control endpoint fence", ".fixture-process-drift"],
    ["rejects listener identity drift across the Mission Control endpoint fence", ".fixture-listener-drift"],
    ["rejects a missing Mission Control startup endpoint", ".fixture-endpoint-missing"],
    ["rejects a stale Mission Control startup instance", ".fixture-startup-stale"],
    ["rejects a self-consistent loaded response crossed to a sibling source", ".fixture-crossed-loaded-source"],
    ["rejects a configured operational token crossed from the loaded job", ".fixture-plist-token-mismatch"],
    ["rejects a loaded operational token that changes across the endpoint fence", ".fixture-loaded-token-drift"],
    ["rejects extra NUL/LF listener records instead of selecting the first", ".fixture-listener-extra-record"],
  ]) {
    it(name, () => {
      const root = createFixture();
      try {
        prepareThreeGenerationFixture(root);
        fixtureFile(root, marker, "reject\n");
        const prepared = prepareRetentionOperation(root);
        assert.notEqual(prepared.status, 0);
        if (marker.includes("token")) {
          assert.match(prepared.stderr, /BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED/);
          assert.doesNotMatch(prepared.stderr, /BUILD_GENERATION_AUTHORITY_CORRUPTION/);
        } else assert.match(prepared.stderr, /BUILD_GENERATION_(?:LOADED_MISSION_CONTROL_PROOF_REQUIRED|AUTHORITY_CORRUPTION)/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("historical resume never invokes the sibling current-source CLI", () => {
    const root = createFixture();
    try {
      prepareThreeGenerationFixture(root);
      const prepared = prepareRetentionOperation(root);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      fixtureFile(root, ".fixture-source-cli-hard-fail", "forbid\n");
      const resumed = spawnSync(process.execPath, [
        "scripts/build-generation-retention.mjs", "resume", "--operation-ref", pair.operationRef,
        "--operation-hash", pair.operationHash, "--json",
      ], { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
      assert.equal(resumed.status, 0, resumed.stderr);
      assert.equal(existsSync(join(root, ".fixture-source-cli-called")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects raw ps byte drift with the finite loaded-proof code", () => {
    const root = createFixture();
    try {
      prepareThreeGenerationFixture(root);
      fixtureFile(root, ".fixture-process-bytes-drift", "drift\n");
      const prepared = prepareRetentionOperation(root);
      assert.notEqual(prepared.status, 0);
      assert.match(prepared.stderr, /BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED/);
      assert.doesNotMatch(prepared.stderr, /BUILD_GENERATION_AUTHORITY_CORRUPTION/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never executes the observed Mission Control executable or sends it the operational token", () => {
    const root = createFixture();
    try {
      prepareThreeGenerationFixture(root);
      fixtureFile(root, ".fixture-hostile-loaded-executable", "hostile\n");
      const prepared = prepareRetentionOperation(root);
      assert.equal(prepared.status, 0, prepared.stderr);
      assert.equal(existsSync(join(root, ".fixture-hostile-secret-received")), false);
      assert.equal(readFileSync(join(root, ".fixture-loaded-endpoint-call-count"), "utf8"), "1\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  for (const [name, marker] of [
    ["maps an initial Mission Control launchctl failure to the finite loaded-proof code", ".fixture-launchctl-initial-error"],
    ["maps an initial Mission Control process failure to the finite loaded-proof code", ".fixture-process-initial-error"],
  ]) {
    it(name, () => {
      const root = createFixture();
      try {
        prepareThreeGenerationFixture(root);
        fixtureFile(root, marker, "fail\n");
        const prepared = prepareRetentionOperation(root);
        assert.notEqual(prepared.status, 0);
        assert.match(prepared.stderr, /BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED/);
        assert.doesNotMatch(prepared.stderr, /BUILD_GENERATION_AUTHORITY_CORRUPTION/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("pair-only resume quarantines and permanently erases the authorized generation", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);

      const resumed = spawnSync(process.execPath, [
        "scripts/build-generation-retention.mjs",
        "resume",
        "--operation-ref",
        pair.operationRef,
        "--operation-hash",
        pair.operationHash,
        "--json",
      ], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(resumed.status, 0, resumed.stderr);
      const receiptPair = JSON.parse(resumed.stdout);
      assert.match(receiptPair.receiptRef, /^setfarm:\/\/internal-production\/build-generation-retention-receipt\/sha256\/[0-9a-f]{64}$/);
      assert.match(receiptPair.receiptHash, /^[0-9a-f]{64}$/);
      assert.equal(existsSync(join(root, `.setfarm/build-generations-v1/${BUILD_ID}.dist`)), false);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generations-v1")), [`${BUILD_ID_2}.dist`, `${BUILD_ID_3}.dist`]);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-quarantine-v1")), []);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/dispositions")), [
        `00000000000000000001-${BUILD_ID}.json`,
      ]);
      assert.equal(readdirSync(join(root, ".fixture-retention-v1/receipts/sha256")).length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("recovers an empty generation after root rmdir and before root completion", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      installTerminalCrashSequence(root);
      rmSync(join(root, "dist"), { recursive: true, force: true });
      mkdirSync(join(root, "dist"), { mode: 0o755 });
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const argv = [
        "scripts/build-generation-retention.mjs", "resume",
        "--operation-ref", pair.operationRef,
        "--operation-hash", pair.operationHash,
        "--json",
      ];
      for (const expectedStatus of [91, 92, 93, 0]) {
        const result = spawnSync(process.execPath, argv, {
          cwd: root,
          encoding: "utf8",
          env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
        });
        assert.equal(result.status, expectedStatus, result.stderr);
      }
      assert.equal(existsSync(join(root, ".setfarm/build-generation-maintenance-lock-v1.json")), false);
      assert.equal(existsSync(join(root, `.setfarm/build-generations-v1/${BUILD_ID}.dist`)), false);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-quarantine-v1")), []);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/dispositions")), [
        `00000000000000000001-${BUILD_ID}.json`,
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("serializes two and three live writer contenders without a fork or leaked lock temp", async () => {
    for (const contenderCount of [2, 3]) {
      const root = createFixture();
      try {
        installWriterLockHold(root);
        const input = rotationInput(root, BUILD_ID, "1");
        const results = await Promise.all(Array.from({ length: contenderCount }, () => runModuleAsync(root, writerExpression(input))));
        assert.equal(results.filter((result) => result.status === 0).length, 1, JSON.stringify(results));
        assert.equal(results.filter((result) => result.status !== 0).length, contenderCount - 1, JSON.stringify(results));
        assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/intents")), [
          `00000000000000000001-${BUILD_ID}.json`,
        ]);
        assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/completions")), [
          `00000000000000000001-${BUILD_ID}.json`,
        ]);
        assert.deepEqual(
          readdirSync(join(root, ".setfarm")).filter((name) => name.includes("build-generation-maintenance-lock-v1.json")),
          [],
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("never identity-unlinks another live maintenance-lock contender temporary", async () => {
    const root = createFixture();
    try {
      installMaintenanceRaceProbe(root);
      installWriterLockHold(root);
      const input = rotationInput(root, BUILD_ID, "5");
      const [first, second] = await Promise.all([
        runModuleAsync(root, writerExpression(input), ["fixture-first"]),
        runModuleAsync(root, writerExpression(input), ["fixture-second"]),
      ]);
      assert.equal([first, second].filter((result) => result.status === 0).length, 1, JSON.stringify([first, second]));
      assert.equal(existsSync(join(root, ".setfarm/.fixture-foreign-temp-unlinked")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("adopts a quarantine rename response loss without relabelling a destination proof as pre-disposition", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      installQuarantineRenameCrash(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const argv = ["scripts/build-generation-retention.mjs", "resume", "--operation-ref", pair.operationRef, "--operation-hash", pair.operationHash, "--json"];
      const crashed = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
      assert.equal(crashed.status, 91, crashed.stderr);
      const resumed = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
      assert.equal(resumed.status, 0, resumed.stderr);
      const [receiptName] = readdirSync(join(root, ".fixture-retention-v1/receipts/sha256"));
      const receipt = JSON.parse(readFileSync(join(root, ".fixture-retention-v1/receipts/sha256", receiptName), "utf8"));
      assert.equal(receipt.preDispositionZeroReferenceProof.candidate.locator, join(realpathSync(root), `.setfarm/build-generations-v1/${BUILD_ID}.dist`));
      assert.equal(receipt.postQuarantineZeroReferenceProof.candidate.locator, join(realpathSync(root), `.setfarm/build-generation-quarantine-v1/${pair.operationHash}.dist`));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resumes after every authenticated non-root erase response loss", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      installEveryNonRootEraseCrash(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const argv = ["scripts/build-generation-retention.mjs", "resume", "--operation-ref", pair.operationRef, "--operation-hash", pair.operationHash, "--json"];
      for (const expectedStatus of [91, 91, 0]) {
        const resumed = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
        assert.equal(resumed.status, expectedStatus, resumed.stderr);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("strictly parses loaded launchctl argv and configured environment independently", async () => {
    const root = createFixture();
    try {
      const { parseLaunchctlPrintV1 } = await importFixtureInternals(root, ["parseLaunchctlPrintV1"]);
      const label = "com.setrox.setfarm-dashboard";
      const expectedPath = `/tmp/${label}.plist`;
      const text = `gui/501/${label} = {\n\tpath = /tmp/${label}.plist\n\tprogram = /usr/bin/node\n\targuments = {\n\t\t/usr/bin/node\n\t\t/tmp/dashboard.js\n\t}\n\tenvironment = {\n\t\tPATH => /usr/bin:/bin\n\t\tSETFARM_OPERATIONAL_WRITE_TOKEN => redacted-value\n\t\tSETFARM_PG_URL => postgresql://localhost/test\n\t\tOSLogRateLimit => 64\n\t\tXPC_SERVICE_NAME => ${label}\n\t}\n\tpid = 123\n}\n`;
      const parsed = parseLaunchctlPrintV1(Buffer.from(text), {
        uid: 501,
        label,
        expectedPath,
        environmentNames: ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"],
      });
      assert.deepEqual(parsed.programArguments, ["/usr/bin/node", "/tmp/dashboard.js"]);
      assert.deepEqual(parsed.environment.map(([name]) => name), ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"]);
      assert.throws(() => parseLaunchctlPrintV1(Buffer.from(text.replace("\t\tXPC_SERVICE_NAME", "\t\tUNKNOWN")), {
        uid: 501, label, expectedPath, environmentNames: ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"],
      }), /environment/);
      assert.throws(() => parseLaunchctlPrintV1(Buffer.from(text.replace("\t\tSETFARM_PG_URL =>", "\t\tPATH =>")), {
        uid: 501, label, expectedPath, environmentNames: ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"],
      }), /environment/);
      assert.throws(() => parseLaunchctlPrintV1(Buffer.from(text.replace("\tpid = 123", "\tstate = running\n\tpid = 123")), {
        uid: 501, label, expectedPath, environmentNames: ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"],
      }), /top-level|selected|field|state|launchctl/i);
      assert.throws(() => parseLaunchctlPrintV1(Buffer.from(text.replace(expectedPath, `${expectedPath}.crossed`)), {
        uid: 501, label, expectedPath, environmentNames: ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"],
      }), /path|launchctl/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("strictly parses the complete Mission Control listener NUL/LF grammar", async () => {
    const root = createFixture();
    try {
      const { parseMissionControlListenerV1 } = await importFixtureInternals(root, ["parseMissionControlListenerV1"]);
      for (const endpoint of ["127.0.0.1:3080", "[::1]:3080", "*:3080"]) {
        const parsed = parseMissionControlListenerV1(Buffer.from(`p123\0cnode helper\0\nf20\0n${endpoint}\0\n`), 123);
        assert.deepEqual({ pid: parsed.pid, command: parsed.command, fileDescriptor: parsed.fileDescriptor, endpoint: parsed.endpoint }, {
          pid: 123, command: "node helper", fileDescriptor: 20, endpoint,
        });
      }
      for (const bytes of [
        "p123\0cnode\0\nf20\0n[::]:3080\0\n",
        "p123\0cnode\0\nf20\0n0.0.0.0:3080\0\n",
        "p123\0cnode\0\nf20\0n127.0.0.1:3080\0",
        "p123\0cnode\0\nn127.0.0.1:3080\0f20\0\n",
        "p123\0cnode\0\nf01\0n127.0.0.1:3080\0\n",
        "p123\0cnode\0\nf20u\0n127.0.0.1:3080\0\n",
        "p123\0cnode\0\nf20\0n127.0.0.1:3080\0\nf21\0n127.0.0.1:3080\0\n",
        "p123\0cnode\0\nf20\0n127.0.0.1:3080\0\np123\0cnode\0\nf20\0n127.0.0.1:3080\0\n",
      ]) assert.throws(() => parseMissionControlListenerV1(Buffer.from(bytes), 123), /listener/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("strictly parses the fixed plutil JSON byte shape without requiring JSON reserialization", async () => {
    const root = createFixture();
    try {
      const { parsePlutilJsonV1 } = await importFixtureInternals(root, ["parsePlutilJsonV1"]);
      const parsed = parsePlutilJsonV1(Buffer.from('{"ProgramArguments":["\\/usr\\/bin\\/node"]}', "utf8"), "fixture plist");
      assert.deepEqual(parsed.ProgramArguments, ["/usr/bin/node"]);
      assert.throws(() => parsePlutilJsonV1(Buffer.from('{"ProgramArguments":[]}\n', "utf8"), "fixture plist"), /bytes|output/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("freezes URL and conservative environment scans without retaining raw secrets", async () => {
    const root = createFixture();
    try {
      const { redactedEnvironmentEntryV1 } = await importFixtureInternals(root, ["redactedEnvironmentEntryV1"]);
      const candidate = join(realpathSync(root), "candidate");
      const quarantine = join(realpathSync(root), "quarantine");
      mkdirSync(candidate, { mode: 0o755 });
      mkdirSync(quarantine, { mode: 0o755 });
      const url = redactedEnvironmentEntryV1("MC_INTERNAL_URL", "http://127.0.0.1:3080/api?q=1#x", 0, realpathSync(root), candidate, quarantine);
      assert.equal(url.classificationCommitment.tokenization, "url-components-v1");
      assert.equal(url.classificationCommitment.tokenCommitments.length, 8);
      assert.equal(JSON.stringify(url).includes("127.0.0.1"), false);
      const encodedCandidate = encodeURIComponent(`${candidate}/secret`);
      assert.throws(() => redactedEnvironmentEntryV1("SETFARM_OPERATIONAL_WRITE_TOKEN", encodedCandidate, 0, realpathSync(root), candidate, quarantine), /candidate|path/i);
      const twiceEncodedCandidate = encodeURIComponent(encodedCandidate);
      assert.throws(() => redactedEnvironmentEntryV1("SETFARM_OPERATIONAL_WRITE_TOKEN", twiceEncodedCandidate, 0, realpathSync(root), candidate, quarantine), /candidate|path/i);
      const alias = join(realpathSync(root), "indirect-runtime-path");
      symlinkSync(candidate, alias);
      assert.throws(() => redactedEnvironmentEntryV1("SETFARM_OPERATIONAL_WRITE_TOKEN", `prefix ${alias} suffix`, 0, realpathSync(root), candidate, quarantine), /candidate|path/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed percent encoding before conservative secret scanning", async () => {
    const root = createFixture();
    try {
      const { redactedEnvironmentEntryV1 } = await importFixtureInternals(root, ["redactedEnvironmentEntryV1"]);
      const candidate = join(realpathSync(root), "candidate");
      const quarantine = join(realpathSync(root), "quarantine");
      mkdirSync(candidate, { mode: 0o755 });
      mkdirSync(quarantine, { mode: 0o755 });
      assert.throws(
        () => redactedEnvironmentEntryV1("SETFARM_OPERATIONAL_WRITE_TOKEN", "opaque%ZZvalue", 0, realpathSync(root), candidate, quarantine),
        /percent encoding is invalid/i,
      );
      assert.throws(
        () => redactedEnvironmentEntryV1("SETFARM_OPERATIONAL_WRITE_TOKEN", "opaque%25ZZvalue", 0, realpathSync(root), candidate, quarantine),
        /percent encoding is invalid/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires exact none-v1 and single-v1 token cardinality", async () => {
    const root = createFixture();
    try {
      const { assertPathCommitmentV1 } = await importFixtureInternals(root, ["assertPathCommitmentV1"]);
      const digest = (value) => createHash("sha256").update(value).digest("hex");
      const token = (tokenOrdinal) => ({
        tokenOrdinal,
        tokenHash: digest(`token-${tokenOrdinal}`),
        tokenKind: "nonpath",
        emptyPathListSegment: false,
        resolutionKind: "not_applicable",
        symlinkHops: [],
        finalRealpathHash: null,
        outsideCandidateAndQuarantine: true,
      });
      const commitment = (tokenization, tokenCommitments) => ({
        source: "argument",
        sourceName: null,
        fieldOrdinal: 0,
        rawValueHash: digest("node"),
        classification: "not_path_bearing",
        tokenization,
        tokenCommitments,
        exposure: "nonsecret",
        rawValue: "node",
        rawValueRedacted: false,
      });
      assert.doesNotThrow(() => assertPathCommitmentV1(commitment("none-v1", [])));
      assert.throws(() => assertPathCommitmentV1(commitment("none-v1", [token(0)])), /cardinality/i);
      assert.throws(() => assertPathCommitmentV1(commitment("single-v1", [token(0), token(1)])), /cardinality/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("binds loaded PID identity to its real executable, exact argv, and entrypoint", async () => {
    const root = createFixture();
    let child;
    try {
      installSingleLoadedLsofRecord(root);
      const worker = join(root, "worker.mjs");
      writeFileSync(worker, 'process.stdout.write("ready\\n"); setInterval(() => {}, 1000);\n');
      const workerRealpath = realpathSync(worker);
      const { observeLoadedProcessV1 } = await importFixtureInternals(root, ["observeLoadedProcessV1"]);
      child = spawn(process.execPath, [workerRealpath], { stdio: ["ignore", "pipe", "pipe"] });
      await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.stdout.once("data", resolve);
      });
      const observed = observeLoadedProcessV1(child.pid, [process.execPath, workerRealpath]);
      assert.equal(observed.executableRealpath, realpathSync(process.execPath));
      assert.equal(observed.entrypointRealpath, workerRealpath);
      assert.match(observed.commHash, /^[0-9a-f]{64}$/);
      assert.match(observed.commandHash, /^[0-9a-f]{64}$/);
      assert.match(observed.lsofHash, /^[0-9a-f]{64}$/);
      assert.throws(() => observeLoadedProcessV1(child.pid, [process.execPath, workerRealpath, "é"]), /visible|represent|lossless/i);
      assert.throws(() => observeLoadedProcessV1(child.pid, [process.execPath, `${workerRealpath}.wrong`]), /argv|entrypoint/);
    } finally {
      if (child) child.kill("SIGTERM");
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects extra lsof txt records after the loaded executable", async () => {
    const root = createFixture();
    let child;
    try {
      installExtraLoadedLsofRecord(root);
      const worker = join(root, "worker.mjs");
      writeFileSync(worker, 'process.stdout.write("ready\\n"); setInterval(() => {}, 1000);\n');
      const workerRealpath = realpathSync(worker);
      const { observeLoadedProcessV1 } = await importFixtureInternals(root, ["observeLoadedProcessV1"]);
      child = spawn(process.execPath, [workerRealpath], { stdio: ["ignore", "pipe", "pipe"] });
      await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.stdout.once("data", resolve);
      });
      assert.throws(
        () => observeLoadedProcessV1(child.pid, [process.execPath, workerRealpath]),
        /lsof|executable|ambiguous|record/i,
      );
    } finally {
      if (child) child.kill("SIGTERM");
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("records intermediate symlink components during bounded path resolution", async () => {
    const root = createFixture();
    try {
      const { pathTokenCommitmentV1 } = await importFixtureInternals(root, ["pathTokenCommitmentV1"]);
      fixtureFile(root, "real/child.txt", "child\n");
      symlinkSync(join(realpathSync(root), "real"), join(root, "linked"));
      mkdirSync(join(root, "candidate"), { mode: 0o755 });
      mkdirSync(join(root, "quarantine"), { mode: 0o755 });
      const commitment = pathTokenCommitmentV1(
        join(realpathSync(root), "linked/child.txt"),
        0,
        realpathSync(root),
        join(realpathSync(root), "candidate"),
        join(realpathSync(root), "quarantine"),
      );
      const lexicalComponentCount = join(realpathSync(root), "linked/child.txt").split("/").filter(Boolean).length;
      assert.equal(commitment.symlinkHops.length >= lexicalComponentCount, true);
      assert.equal(commitment.finalRealpathHash !== null, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("authenticates a finalized Setfarm generation without its deleted prepare receipt", async () => {
    const root = createFixture();
    try {
      rmSync(join(root, "dist"), { recursive: true, force: true });
      rmSync(join(root, "src/service.ts"));
      fixtureFile(root, "src/cli/cli.ts", 'console.log("fixture");\n');
      fixtureFile(root, "scripts/stitch-to-jsx.mjs", 'process.stdout.write("fixture");\n');
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      pkg.version = "1.2.3";
      writeFileSync(join(root, "package.json"), `${JSON.stringify(pkg)}\n`);
      git(root, ["add", "."]);
      git(root, ["commit", "--amend", "--no-edit", "-q"]);
      git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const { observeActualSetfarmRuntimeSourceV1, hashCanonicalJsonV1 } = await importFixtureInternals(root, [
        "observeActualSetfarmRuntimeSourceV1",
      ]);
      const sourceSha = git(root, ["rev-parse", "HEAD^{commit}"]);
      const sourceTreeHash = git(root, ["rev-parse", "HEAD^{tree}"]);
      const treeBytes = execFileSync("/usr/bin/git", ["ls-tree", "-r", "-z", "--full-tree", sourceSha], { cwd: root });
      const entries = treeBytes.toString("utf8").split("\0").filter(Boolean).map((record) => {
        const match = /^(100644|100755) blob ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/.exec(record);
        assert.ok(match, record);
        return { locator: match[3], gitMode: match[1], gitBlobHash: match[2] };
      }).sort((left, right) => Buffer.compare(Buffer.from(left.locator), Buffer.from(right.locator)));
      const buildInputSetHash = hashCanonicalJsonV1({
        schema: "setfarm.internal-production-pinned-build-input-set.v1",
        sourceSha,
        sourceTreeHash,
        entries,
      });
      const entrypoint = join(root, "dist/cli/cli.js");
      fixtureFile(root, "dist/cli/cli.js", 'console.log("fixture");\n', 0o755);
      chmodSync(join(root, "dist"), 0o755);
      chmodSync(join(root, "dist/cli"), 0o755);
      const ordinaryBytes = readFileSync(entrypoint);
      const outputEntries = [{
        locator: "dist/cli/cli.js",
        mode: 0o755,
        byteLength: ordinaryBytes.length,
        sha256: createHash("sha256").update(ordinaryBytes).digest("hex"),
      }];
      const outputProjection = {
        schema: "setfarm.platform-build-output-tree.v1",
        sourceSha,
        sourceTreeHash,
        entries: outputEntries,
      };
      const outputTree = { ...outputProjection, outputTreeHash: hashCanonicalJsonV1(outputProjection) };
      const stitchBytes = readFileSync(join(root, "scripts/stitch-to-jsx.mjs"));
      const releaseManifest = {
        schema: "setfarm.platform-release-manifest.v1",
        releaseSha: sourceSha,
        branch: "main",
        dirty: false,
        stitchConverter: {
          converterId: "setfarm.stitch-to-jsx",
          source: {
            schema: "setfarm.source-artifact-ref.v1",
            hash: createHash("sha256").update(stitchBytes).digest("hex"),
            mediaType: "text/javascript",
            locator: "scripts/stitch-to-jsx.mjs",
            byteLength: stitchBytes.length,
          },
        },
      };
      const buildInfo = {
        sha: sourceSha,
        shortSha: sourceSha.slice(0, 8),
        branch: "main",
        dirty: false,
        packageVersion: "1.2.3",
        displayVersion: `1.2.3+${sourceSha.slice(0, 8)}`,
        builtAt: "2026-08-20T00:00:00.000Z",
      };
      fixtureFile(root, "dist/BUILD_INFO.json", `${JSON.stringify(buildInfo, null, 2)}\n`, 0o444);
      fixtureFile(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json", `${JSON.stringify(outputTree)}\n`, 0o444);
      fixtureFile(root, "dist/PLATFORM_RELEASE_MANIFEST.json", `${JSON.stringify(releaseManifest)}\n`, 0o444);
      const stableBuildInfo = {
        schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
        sha: sourceSha,
        shortSha: sourceSha.slice(0, 8),
        branch: "main",
        dirty: false,
        packageVersion: "1.2.3",
        displayVersion: `1.2.3+${sourceSha.slice(0, 8)}`,
      };
      const expected = {
        branch: "main",
        clean: true,
        sha: sourceSha,
        treeHash: sourceTreeHash,
        buildHash: hashCanonicalJsonV1({
          schema: "setfarm.internal-production-controller-build.v1",
          stableBuildInfo,
          buildInputSetHash,
          outputTreeHash: outputTree.outputTreeHash,
          releaseManifestHash: hashCanonicalJsonV1(releaseManifest),
        }),
        originMainSha: sourceSha,
      };
      assert.deepEqual(observeActualSetfarmRuntimeSourceV1(realpathSync(entrypoint), expected), {
        sha: expected.sha,
        treeHash: expected.treeHash,
        buildHash: expected.buildHash,
      });
      assert.equal(existsSync(join(root, "dist/PLATFORM_BUILD_PREPARE.json")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects hash-consistent but structurally incomplete historical PBA observations", async () => {
    const root = createFixture();
    try {
      const { assertProductBuildAuthorityV2ObservationV1 } = await importFixtureInternals(root, ["assertProductBuildAuthorityV2ObservationV1"]);
      const deliveryEvidenceHash = "b".repeat(64);
      const deliveryEvidenceRef = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`;
      assert.throws(() => assertProductBuildAuthorityV2ObservationV1({
        schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
        observationTransport: "source-cli",
        response: {
          schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
          currentStatus: "current",
          deliveryEvidenceRef,
          deliveryEvidenceHash,
          evidence: { deliveryEvidenceRef, deliveryEvidenceHash, currentSource: { sha: "a".repeat(40), treeHash: "a".repeat(40), buildHash: "a".repeat(64) } },
        },
      }), /PBA|evidence/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("normalizes fixed-link crash siblings for every retention record store before the next mutation", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const prepare = () => spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
        cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      const firstPrepared = prepare();
      assert.equal(firstPrepared.status, 0, firstPrepared.stderr);
      const firstPair = JSON.parse(firstPrepared.stdout);
      const firstResume = spawnSync(process.execPath, [
        "scripts/build-generation-retention.mjs", "resume", "--operation-ref", firstPair.operationRef,
        "--operation-hash", firstPair.operationHash, "--json",
      ], { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
      assert.equal(firstResume.status, 0, firstResume.stderr);
      const stores = ["operations", "operation-candidates", "erase-steps", "receipts"];
      for (const store of stores) {
        const directory = join(root, `.fixture-retention-v1/${store}/sha256`);
        const fixed = readdirSync(directory).sort()[0];
        linkSync(join(directory, fixed), join(directory, `.${fixed}.90000000-0000-4000-8000-000000000009.tmp`));
      }
      fixtureFile(root, "dist/artifact.txt", "fourth\n");
      rotateFixtureGeneration(root, "40000000-0000-4000-8000-000000000004", "4");
      const secondPrepared = prepare();
      assert.equal(secondPrepared.status, 0, secondPrepared.stderr);
      for (const store of stores) {
        const directory = join(root, `.fixture-retention-v1/${store}/sha256`);
        assert.equal(readdirSync(directory).some((name) => name.endsWith(".tmp")), false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("recovers fixed-absent complete temps store-wide before disposed-ledger closure", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      fixtureFile(root, "dist/artifact.txt", "fourth\n");
      rotateFixtureGeneration(root, "40000000-0000-4000-8000-000000000004", "4");
      const command = (argv) => spawnSync(process.execPath, argv, {
        cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      const firstPrepared = command(["scripts/build-generation-retention.mjs", "prepare"]);
      assert.equal(firstPrepared.status, 0, firstPrepared.stderr);
      const firstPair = JSON.parse(firstPrepared.stdout);
      const firstResume = command([
        "scripts/build-generation-retention.mjs", "resume", "--operation-ref", firstPair.operationRef,
        "--operation-hash", firstPair.operationHash, "--json",
      ]);
      assert.equal(firstResume.status, 0, firstResume.stderr);
      for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
        const directory = join(root, `.fixture-retention-v1/${store}/sha256`);
        const fixed = readdirSync(directory).sort()[0];
        renameSync(join(directory, fixed), join(directory, `.${fixed}.90000000-0000-4000-8000-000000000009.tmp`));
      }
      const secondPrepared = command(["scripts/build-generation-retention.mjs", "prepare"]);
      assert.equal(secondPrepared.status, 0, secondPrepared.stderr);
      for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
        const names = readdirSync(join(root, `.fixture-retention-v1/${store}/sha256`));
        assert.equal(names.some((name) => name.endsWith(".tmp")), false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a disposed receipt crossed to a nonterminal erase completion", async () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      rotateFixtureGeneration(root, BUILD_ID, "1");
      fixtureFile(root, "dist/artifact.txt", "second\n");
      rotateFixtureGeneration(root, BUILD_ID_2, "2");
      fixtureFile(root, "dist/artifact.txt", "third\n");
      rotateFixtureGeneration(root, BUILD_ID_3, "3");
      const command = (argv) => spawnSync(process.execPath, argv, {
        cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      const prepared = command(["scripts/build-generation-retention.mjs", "prepare"]);
      assert.equal(prepared.status, 0, prepared.stderr);
      const pair = JSON.parse(prepared.stdout);
      const resumed = command([
        "scripts/build-generation-retention.mjs", "resume", "--operation-ref", pair.operationRef,
        "--operation-hash", pair.operationHash, "--json",
      ]);
      assert.equal(resumed.status, 0, resumed.stderr);

      const modulePath = join(root, "scripts/build-generation-retention.mjs");
      const authority = await import(`${pathToFileURL(modulePath).href}?crossed=${Date.now()}`);
      const eraseDirectory = join(root, ".fixture-retention-v1/erase-steps/sha256");
      const completions = readdirSync(eraseDirectory)
        .map((name) => JSON.parse(readFileSync(join(eraseDirectory, name), "utf8")))
        .filter((record) => record.recordKind === "completion")
        .sort((left, right) => left.ordinal - right.ordinal);
      assert.equal(completions.length >= 2, true);
      const crossedCompletion = completions[0];

      const receiptDirectory = join(root, ".fixture-retention-v1/receipts/sha256");
      const oldReceiptName = readdirSync(receiptDirectory)[0];
      const oldReceiptFile = join(receiptDirectory, oldReceiptName);
      const receipt = JSON.parse(readFileSync(oldReceiptFile, "utf8"));
      const receiptProjection = {
        ...receipt,
        finalEraseStepRef: crossedCompletion.eraseStepCompletionRef,
        finalEraseStepHash: crossedCompletion.eraseStepCompletionHash,
      };
      delete receiptProjection.receiptRef;
      delete receiptProjection.receiptHash;
      const receiptHash = authority.hashCanonicalJsonV1(receiptProjection);
      const crossedReceipt = {
        ...receiptProjection,
        receiptRef: `setfarm://internal-production/build-generation-retention-receipt/sha256/${receiptHash}`,
        receiptHash,
      };
      rmSync(oldReceiptFile);
      fixtureFile(receiptDirectory, `${receiptHash}.json`, `${authority.canonicalJsonV1(crossedReceipt)}\n`, 0o600);

      const dispositionFile = join(root, `.setfarm/build-generation-rotation-ledger-v1/dispositions/00000000000000000001-${BUILD_ID}.json`);
      const disposition = JSON.parse(readFileSync(dispositionFile, "utf8"));
      const dispositionProjection = {
        ...disposition,
        retentionReceipt: { receiptRef: crossedReceipt.receiptRef, receiptHash },
      };
      delete dispositionProjection.dispositionRef;
      delete dispositionProjection.dispositionHash;
      const dispositionHash = authority.hashCanonicalJsonV1(dispositionProjection);
      const crossedDisposition = {
        ...dispositionProjection,
        dispositionRef: `setfarm://internal-production/build-generation-rotation-disposition/00000000000000000001/${BUILD_ID}/sha256/${dispositionHash}`,
        dispositionHash,
      };
      writeFileSync(dispositionFile, `${authority.canonicalJsonV1(crossedDisposition)}\n`);
      chmodSync(dispositionFile, 0o600);

      assert.throws(() => authority.inspectBuildGenerationRotationLedgerV1(), /erase|receipt|terminal|cross|completion/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("repeats retention then writer rotation twice at the eight-active-generation bound", () => {
    const root = createFixture();
    try {
      installPrivateRetentionObservers(root);
      const buildId = (ordinal) => `${ordinal.toString(16).padStart(8, "0")}-0000-4000-8000-${ordinal.toString(16).padStart(12, "0")}`;
      for (let ordinal = 1; ordinal <= 8; ordinal += 1) {
        if (ordinal > 1) fixtureFile(root, "dist/artifact.txt", `generation-${ordinal}\n`);
        rotateFixtureGeneration(root, buildId(ordinal), (ordinal % 10).toString());
      }
      for (let cycle = 1; cycle <= 2; cycle += 1) {
        const prepared = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "prepare"], {
          cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
        });
        assert.equal(prepared.status, 0, prepared.stderr);
        const pair = JSON.parse(prepared.stdout);
        const resumed = spawnSync(process.execPath, [
          "scripts/build-generation-retention.mjs", "resume", "--operation-ref", pair.operationRef,
          "--operation-hash", pair.operationHash, "--json",
        ], { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
        assert.equal(resumed.status, 0, resumed.stderr);
        const nextOrdinal = 8 + cycle;
        fixtureFile(root, "dist/artifact.txt", `generation-${nextOrdinal}\n`);
        const rotated = runModule(root, writerExpression(rotationInput(root, buildId(nextOrdinal), (nextOrdinal % 10).toString())));
        assert.equal(rotated.status, 0, rotated.stderr);
        writeFinalizedRuntimeDist(root);
      }
      assert.equal(readdirSync(join(root, ".setfarm/build-generations-v1")).length, 8);
      assert.equal(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/completions")).length, 10);
      assert.equal(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/dispositions")).length, 2);
      assert.equal(readdirSync(join(root, ".fixture-retention-v1/operation-candidates/sha256")).length, 2);
      assert.equal(readdirSync(join(root, ".fixture-retention-v1/receipts/sha256")).length, 2);
      assert.deepEqual(readdirSync(join(root, ".setfarm/build-generation-quarantine-v1")), []);
      const inspected = spawnSync(process.execPath, ["scripts/build-generation-retention.mjs", "inspect"], {
        cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      });
      assert.equal(inspected.status, 0, inspected.stderr);
      const inspection = JSON.parse(inspected.stdout);
      assert.equal(inspection.schema, "setfarm.platform-build-generation-retention-inspection.v1");
      assert.equal(inspection.operations.length, 2);
      assert.equal(inspection.receipts.length, 2);
      assert.deepEqual(inspection.quarantine, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
