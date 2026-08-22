import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  GIT_OBJECT_HASH_V1_PATTERN,
  PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1,
  PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1,
  SHA256_V1_PATTERN,
  observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1,
  parseProductBuildAuthorityV2DeliveryEvidenceResponseV1,
  resolveProductBuildAuthorityV2DeliveryEvidenceV1,
} from "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.js";

const INVALID_RESPONSE_CODE =
  "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID";
const DELIVERY_EVIDENCE_HASH =
  "f72e19755f5ab92a0053b5779d5dc2c49e6008e1426c0b32171bb409256c6424";
const DELIVERY_EVIDENCE_REF =
  `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${DELIVERY_EVIDENCE_HASH}`;
const FOCUSED_TEST_HASH =
  "d279cd2e9b2c984bbc4e290b4d7e608fad7502e92bd9f4df06a012afa0e1e667";
const FOCUSED_TEST_REF =
  `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${FOCUSED_TEST_HASH}`;
const REAL_PLUTIL_PROGRAM_ARGUMENTS_JSON =
  String.raw`["\/opt\/homebrew\/opt\/node\/bin\/node","\/Users\/setrox\/ai\/setrox\/mission-control\/dist-server\/index.js"]`;

const VALID_RESPONSE = {
  schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
  currentStatus: "current",
  deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
  deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
  evidence: {
    schema: "mission-control.product-build-authority-v2-delivery-evidence.v1",
    currentStatus: "current",
    deliveryPrNumber: 19,
    deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a",
    deliveryMergeAncestorOfCurrentSource: true,
    currentSource: {
      branch: "main",
      clean: true,
      sha: "1111111111111111111111111111111111111111",
      treeHash: "2222222222222222222222222222222222222222222222222222222222222222",
      buildHash: "3333333333333333333333333333333333333333333333333333333333333333",
      originMainSha: "1111111111111111111111111111111111111111",
    },
    deliveredPathBlobs: [
      {
        path: "server/routes/setfarm-operational.test.ts",
        blobHash: "4444444444444444444444444444444444444444444444444444444444444444",
      },
      {
        path: "server/routes/setfarm-operational.ts",
        blobHash: "5555555555555555555555555555555555555555555555555555555555555555",
      },
      {
        path: "server/services/setfarm-product-build-authority.ts",
        blobHash: "6666666666666666666666666666666666666666666666666666666666666666",
      },
      {
        path: "server/services/setfarm-product-build-authority.test.ts",
        blobHash: "7777777777777777777777777777777777777777777777777777777777777777",
      },
      {
        path: "src/lib/product-build-authority.ts",
        blobHash: "8888888888888888888888888888888888888888888888888888888888888888",
      },
      {
        path: "src/components/run-detail/ProductBuildAuthority.tsx",
        blobHash: "9999999999999999999999999999999999999999999999999999999999999999",
      },
      {
        path: "tests/product-build-authority-render.test.tsx",
        blobHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        path: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
        blobHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ],
    focusedTests: {
      schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1",
      argv: [
        "node",
        "--import",
        "tsx",
        "--test",
        "server/routes/setfarm-operational.test.ts",
        "server/services/setfarm-product-build-authority.test.ts",
        "tests/product-build-authority-render.test.tsx",
      ],
      commandContractHash:
        "0db837757920ce51b060993d379611fba899058e3ab9272888ab92d81fc5093b",
      testPathBlobs: [
        {
          path: "server/routes/setfarm-operational.test.ts",
          blobHash: "4444444444444444444444444444444444444444444444444444444444444444",
        },
        {
          path: "server/services/setfarm-product-build-authority.test.ts",
          blobHash: "7777777777777777777777777777777777777777777777777777777777777777",
        },
        {
          path: "tests/product-build-authority-render.test.tsx",
          blobHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
      exitCode: 0,
      passed: true,
      focusedTestReceiptRef: FOCUSED_TEST_REF,
      focusedTestReceiptHash: FOCUSED_TEST_HASH,
    },
    vendorLock: {
      schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1",
      lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
      producerRepository: "https://github.com/hikmetgulsesli/setfarm.git",
      producerCommit: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      lockContentHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      artifacts: [
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json",
          sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json",
          sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json",
          sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v2.schema.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json",
          sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json",
          sha256: "1111111111111111111111111111111111111111111111111111111111111111",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v3.schema.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json",
          sha256: "2222222222222222222222222222222222222222222222222222222222222222",
        },
        {
          producerPath: "contracts/generated/mission-control/deployment-observation.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json",
          sha256: "3333333333333333333333333333333333333333333333333333333333333333",
        },
        {
          producerPath: "contracts/generated/mission-control/deployment-observation.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/deployment-observation.v1.schema.json",
          sha256: "4444444444444444444444444444444444444444444444444444444444444444",
        },
        {
          producerPath: "contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json",
          sha256: "5555555555555555555555555555555555555555555555555555555555555555",
        },
        {
          producerPath: "contracts/generated/mission-control/project-transfer-ack.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json",
          sha256: "6666666666666666666666666666666666666666666666666666666666666666",
        },
        {
          producerPath: "contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json",
          sha256: "7777777777777777777777777777777777777777777777777777777777777777",
        },
        {
          producerPath: "contracts/generated/mission-control/operational-active-run-status.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/operational-active-run-status.v1.schema.json",
          sha256: "8888888888888888888888888888888888888888888888888888888888888888",
        },
      ],
      compatibilitySetHash:
        "d81f264f01999758c95d6ce30a3312f67ce1fb9309daf0dcb1a0711c665a4407",
      vendorLockProjectionHash:
        "c98a5ac68d8f6b2c9653a8f64fb6d4142f2245862c630a8b79c96a5403fd3471",
    },
    deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
    deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
  },
} as const;

const EXPECTED_EVIDENCE_CORE_CANONICAL_BYTES = `{"currentSource":{"branch":"main","buildHash":"3333333333333333333333333333333333333333333333333333333333333333","clean":true,"originMainSha":"1111111111111111111111111111111111111111","sha":"1111111111111111111111111111111111111111","treeHash":"2222222222222222222222222222222222222222222222222222222222222222"},"currentStatus":"current","deliveredPathBlobs":[{"blobHash":"4444444444444444444444444444444444444444444444444444444444444444","path":"server/routes/setfarm-operational.test.ts"},{"blobHash":"5555555555555555555555555555555555555555555555555555555555555555","path":"server/routes/setfarm-operational.ts"},{"blobHash":"6666666666666666666666666666666666666666666666666666666666666666","path":"server/services/setfarm-product-build-authority.ts"},{"blobHash":"7777777777777777777777777777777777777777777777777777777777777777","path":"server/services/setfarm-product-build-authority.test.ts"},{"blobHash":"8888888888888888888888888888888888888888888888888888888888888888","path":"src/lib/product-build-authority.ts"},{"blobHash":"9999999999999999999999999999999999999999999999999999999999999999","path":"src/components/run-detail/ProductBuildAuthority.tsx"},{"blobHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","path":"tests/product-build-authority-render.test.tsx"},{"blobHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","path":"contracts/vendor/setfarm/mission-control-contracts.v1.lock.json"}],"deliveryMergeAncestorOfCurrentSource":true,"deliveryMergeSha":"240e779d78804843a1202cbf0440fe423b806b1a","deliveryPrNumber":19,"focusedTests":{"argv":["node","--import","tsx","--test","server/routes/setfarm-operational.test.ts","server/services/setfarm-product-build-authority.test.ts","tests/product-build-authority-render.test.tsx"],"commandContractHash":"0db837757920ce51b060993d379611fba899058e3ab9272888ab92d81fc5093b","exitCode":0,"focusedTestReceiptHash":"d279cd2e9b2c984bbc4e290b4d7e608fad7502e92bd9f4df06a012afa0e1e667","focusedTestReceiptRef":"mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/d279cd2e9b2c984bbc4e290b4d7e608fad7502e92bd9f4df06a012afa0e1e667","passed":true,"schema":"mission-control.product-build-authority-v2-focused-test-receipt.v1","testPathBlobs":[{"blobHash":"4444444444444444444444444444444444444444444444444444444444444444","path":"server/routes/setfarm-operational.test.ts"},{"blobHash":"7777777777777777777777777777777777777777777777777777777777777777","path":"server/services/setfarm-product-build-authority.test.ts"},{"blobHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","path":"tests/product-build-authority-render.test.tsx"}]},"schema":"mission-control.product-build-authority-v2-delivery-evidence.v1","vendorLock":{"artifacts":[{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json","sha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v1.schema.json","sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json","sha256":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v2.schema.json","sha256":"0000000000000000000000000000000000000000000000000000000000000000","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json","sha256":"1111111111111111111111111111111111111111111111111111111111111111","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v3.schema.json","sha256":"2222222222222222222222222222222222222222222222222222222222222222","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json"},{"producerPath":"contracts/generated/mission-control/deployment-observation.v1.compatibility.json","sha256":"3333333333333333333333333333333333333333333333333333333333333333","vendoredPath":"contracts/vendor/setfarm/deployment-observation.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/deployment-observation.v1.schema.json","sha256":"4444444444444444444444444444444444444444444444444444444444444444","vendoredPath":"contracts/vendor/setfarm/deployment-observation.v1.schema.json"},{"producerPath":"contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json","sha256":"5555555555555555555555555555555555555555555555555555555555555555","vendoredPath":"contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/project-transfer-ack.v1.schema.json","sha256":"6666666666666666666666666666666666666666666666666666666666666666","vendoredPath":"contracts/vendor/setfarm/project-transfer-ack.v1.schema.json"},{"producerPath":"contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json","sha256":"7777777777777777777777777777777777777777777777777777777777777777","vendoredPath":"contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/operational-active-run-status.v1.schema.json","sha256":"8888888888888888888888888888888888888888888888888888888888888888","vendoredPath":"contracts/vendor/setfarm/operational-active-run-status.v1.schema.json"}],"compatibilitySetHash":"d81f264f01999758c95d6ce30a3312f67ce1fb9309daf0dcb1a0711c665a4407","lockContentHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","lockPath":"contracts/vendor/setfarm/mission-control-contracts.v1.lock.json","producerCommit":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","producerRepository":"https://github.com/hikmetgulsesli/setfarm.git","schema":"mission-control.product-build-authority-v2-vendor-lock-projection.v1","vendorLockProjectionHash":"c98a5ac68d8f6b2c9653a8f64fb6d4142f2245862c630a8b79c96a5403fd3471"}}`;

type MutableResponse = Record<string, any>;

function cloneFixture(): MutableResponse {
  return structuredClone(VALID_RESPONSE) as MutableResponse;
}

function assertInvalid(value: unknown): void {
  assert.throws(
    () => parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, INVALID_RESPONSE_CODE);
      assert.equal((error as Error & { code?: string }).code, INVALID_RESPONSE_CODE);
      return true;
    },
  );
}

function invalidMutation(mutator: (candidate: MutableResponse) => void): void {
  const candidate = cloneFixture();
  mutator(candidate);
  assertInvalid(candidate);
}

type ObserverHarnessScenario = Readonly<{
  action?: "observe" | "resolve";
  pairKind?:
    | "valid"
    | "mismatch"
    | "crossed"
    | "missing"
    | "hidden"
    | "symbol"
    | "accessor"
    | "proxy"
    | "custom-prototype"
    | "null-prototype";
  uid?: number | null | string;
  launchctlMode?:
    | "ok"
    | "error"
    | "timeout"
    | "oversize"
    | "malformed"
    | "duplicate-path"
    | "wrong-program"
    | "wrong-cwd"
    | "final-drift";
  plutilMode?:
    | "ok"
    | "error"
    | "timeout"
    | "oversize"
    | "duplicate-label"
    | "wrong-label"
    | "wrong-cwd"
    | "malformed-argv"
    | "non-string-argv"
    | "real-argv-json"
    | "whitespace-argv"
    | "wrong-argv";
  fileMode?:
    | "ok"
    | "plist-symlink"
    | "plist-nonregular"
    | "plist-owner"
    | "plist-mode"
    | "entry-symlink"
    | "entry-nonregular"
    | "cli-symlink"
    | "cli-nonregular";
  cliMode?:
    | "ok"
    | "error"
    | "timeout"
    | "signal"
    | "oversize"
    | "empty"
    | "stderr"
    | "malformed"
    | "multiline"
    | "trailing"
    | "second-payload"
    | "no-final-newline"
    | "invalid-response";
}>;

type ObserverHarnessResult = Readonly<{
  ok: boolean;
  code?: string;
  message?: string;
  stack?: string;
  schema?: string;
  observationTransport?: string;
  frozen?: boolean;
  pair?: Readonly<{ deliveryEvidenceRef: string; deliveryEvidenceHash: string }>;
  calls: readonly Readonly<{
    file: string;
    args: readonly string[];
    cwd?: string;
    env?: Readonly<Record<string, string>>;
    shell?: boolean;
    timeout?: number;
    maxBuffer?: number;
    encoding?: string;
  }>[];
}>;

function runObserverHarness(
  scenario: ObserverHarnessScenario,
): ObserverHarnessResult {
  const moduleUrl = new URL(
    "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts",
    import.meta.url,
  ).href;
  const script = `
    import { mock } from "node:test";

    const scenario = ${JSON.stringify(scenario)};
    const response = ${JSON.stringify(VALID_RESPONSE)};
    const realPlutilProgramArgumentsJson = ${JSON.stringify(REAL_PLUTIL_PROGRAM_ARGUMENTS_JSON)};
    const calls = [];
    const launchctlPath = "/bin/launchctl";
    const plutilPath = "/usr/bin/plutil";
    const plistPath = "/Users/setrox/Library/LaunchAgents/com.setrox.mission-control.plist";
    const cwd = "/Users/setrox/ai/setrox/mission-control";
    const nodeAlias = "/opt/homebrew/opt/node/bin/node";
    const nodeReal = "/opt/homebrew/Cellar/node/26.4.0/bin/node";
    const entrypoint = cwd + "/dist-server/index.js";
    const cli = cwd + "/dist-server/services/product-build-authority-v2-delivery-evidence-v1.js";
    const secret = "LAUNCHCTL_SECRET_SENTINEL";
    let launchctlCount = 0;

    process.env.HOME = "/hostile/home";
    process.env.NODE_OPTIONS = "--hostile-node-option";
    process.env.NODE_PATH = "/hostile/node/path";
    process.env.GIT_DIR = "/hostile/git";
    process.env.HTTPS_PROXY = "https://hostile.invalid";
    process.env.SETFARM_PG_URL = "postgres://hostile";
    process.env.INTERNAL_PRODUCTION_WRITE_TOKEN = secret;
    if (scenario.uid === null) process.getuid = undefined;
    else if (Object.prototype.hasOwnProperty.call(scenario, "uid")) {
      process.getuid = () => scenario.uid;
    } else {
      process.getuid = () => 501;
    }

    function childError(code) {
      const error = new Error(secret + ":child:" + code);
      error.code = code;
      if (code === "ETIMEDOUT") error.killed = true;
      return error;
    }

    function launchctlOutput() {
      launchctlCount += 1;
      let loadedCwd = cwd;
      let loadedProgram = nodeAlias;
      if (scenario.launchctlMode === "wrong-cwd") loadedCwd = cwd + "-wrong";
      if (scenario.launchctlMode === "wrong-program") loadedProgram = "/usr/bin/false";
      if (scenario.launchctlMode === "final-drift" && launchctlCount === 2) {
        loadedCwd = cwd + "-drift";
      }
      if (scenario.launchctlMode === "malformed") return secret + "\\nnot-a-job\\n";
      const pathLine = "\\tpath = " + plistPath + "\\n";
      const duplicatePath = scenario.launchctlMode === "duplicate-path" ? pathLine : "";
      return "gui/501/com.setrox.mission-control = {\\n"
        + pathLine + duplicatePath
        + "\\ttype = LaunchAgent\\n"
        + "\\tprogram = " + loadedProgram + "\\n"
        + "\\tworking directory = " + loadedCwd + "\\n"
        + "\\tenvironment = {\\n\\t\\tTOKEN => " + secret + "\\n\\t}\\n"
        + "}\\n";
    }

    function plutilOutput(args) {
      const selected = args[1];
      if (scenario.plutilMode === "oversize") return "x".repeat(1_048_577);
      if (selected === "Label") {
        const value = scenario.plutilMode === "wrong-label"
          ? "com.setrox.wrong" : "com.setrox.mission-control";
        return scenario.plutilMode === "duplicate-label"
          ? value + "\\n" + value + "\\n"
          : value + "\\n";
      }
      if (selected === "WorkingDirectory") {
        return (scenario.plutilMode === "wrong-cwd" ? cwd + "-wrong" : cwd) + "\\n";
      }
      if (selected === "ProgramArguments") {
        if (scenario.plutilMode === "malformed-argv") return "{not-json}";
        if (scenario.plutilMode === "non-string-argv") {
          return JSON.stringify([nodeAlias, 17]);
        }
        const argv = scenario.plutilMode === "wrong-argv"
          ? [nodeAlias, entrypoint, "--extra"] : [nodeAlias, entrypoint];
        if (scenario.plutilMode === "real-argv-json") {
          return realPlutilProgramArgumentsJson;
        }
        if (scenario.plutilMode === "whitespace-argv") return " " + JSON.stringify(argv);
        return JSON.stringify(argv);
      }
      throw new Error("unexpected plutil selector");
    }

    function cliOutput() {
      const compact = JSON.stringify(response);
      switch (scenario.cliMode) {
        case "oversize": return "x".repeat(1_048_577);
        case "empty": return "";
        case "malformed": return "{not-json}\\n";
        case "multiline": return JSON.stringify(response, null, 2) + "\\n";
        case "trailing": return compact + " \\n";
        case "second-payload": return compact + "\\n" + compact + "\\n";
        case "no-final-newline": return compact;
        case "invalid-response": return "{}\\n";
        default: return compact + "\\n";
      }
    }

    function execFile(file, args, options, callback) {
      calls.push({
        file,
        args: [...args],
        cwd: options.cwd,
        env: options.env,
        shell: options.shell,
        timeout: options.timeout,
        maxBuffer: options.maxBuffer,
        encoding: options.encoding,
      });
      queueMicrotask(() => {
        if (file === launchctlPath) {
          if (scenario.launchctlMode === "error") return callback(childError("ENOENT"), "", secret);
          if (scenario.launchctlMode === "timeout") return callback(childError("ETIMEDOUT"), "", secret);
          const stdout = scenario.launchctlMode === "oversize"
            ? "x".repeat(1_048_577) : launchctlOutput();
          return callback(null, stdout, "");
        }
        if (file === plutilPath) {
          if (scenario.plutilMode === "error") return callback(childError("ENOENT"), "", secret);
          if (scenario.plutilMode === "timeout") return callback(childError("ETIMEDOUT"), "", secret);
          return callback(null, plutilOutput(args), "");
        }
        if (file === nodeReal) {
          if (scenario.cliMode === "error") return callback(childError("EACCES"), "", secret);
          if (scenario.cliMode === "timeout") return callback(childError("ETIMEDOUT"), "", secret);
          if (scenario.cliMode === "signal") {
            const error = childError("ECHILD");
            error.signal = "SIGTERM";
            return callback(error, "", secret);
          }
          const stderr = scenario.cliMode === "stderr" ? secret : "";
          return callback(null, cliOutput(), stderr);
        }
        return callback(childError("ENOENT"), "", secret);
      });
    }

    function statFor(path) {
      let kind = "file";
      let uid = 501;
      let mode = path === plistPath ? 0o100644 : 0o100755;
      if (scenario.fileMode === "plist-symlink" && path === plistPath) kind = "symlink";
      if (scenario.fileMode === "plist-nonregular" && path === plistPath) kind = "directory";
      if (scenario.fileMode === "plist-owner" && path === plistPath) uid = 777;
      if (scenario.fileMode === "plist-mode" && path === plistPath) mode = 0o100666;
      if (scenario.fileMode === "entry-symlink" && path === entrypoint) kind = "symlink";
      if (scenario.fileMode === "entry-nonregular" && path === entrypoint) kind = "directory";
      if (scenario.fileMode === "cli-symlink" && path === cli) kind = "symlink";
      if (scenario.fileMode === "cli-nonregular" && path === cli) kind = "directory";
      return {
        uid,
        mode,
        dev: 1,
        ino: path === plistPath ? 10 : path === entrypoint ? 20 : 30,
        size: path === plistPath ? 100 : path === entrypoint ? 200 : 300,
        mtimeMs: 1_700_000_000_000,
        isFile: () => kind === "file",
        isSymbolicLink: () => kind === "symlink",
      };
    }

    await mock.module("node:child_process", { namedExports: { execFile } });
    await mock.module("node:fs/promises", { namedExports: {
      lstat: async (path) => statFor(path),
      realpath: async (path) => {
        if (path === nodeAlias) return nodeReal;
        if (path === "/usr/bin/false") return "/usr/bin/false";
        return path;
      },
    } });

    const module = await import(${JSON.stringify(moduleUrl)});
    let pair = {
      deliveryEvidenceRef: response.deliveryEvidenceRef,
      deliveryEvidenceHash: response.deliveryEvidenceHash,
    };
    switch (scenario.pairKind) {
      case "mismatch":
        pair = {
          deliveryEvidenceRef: "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/" + "0".repeat(64),
          deliveryEvidenceHash: "0".repeat(64),
        };
        break;
      case "crossed": pair = { ...pair, deliveryEvidenceHash: "0".repeat(64) }; break;
      case "missing": pair = { deliveryEvidenceRef: pair.deliveryEvidenceRef }; break;
      case "hidden": Object.defineProperty(pair, "hidden", { value: true }); break;
      case "symbol": pair[Symbol("hidden")] = true; break;
      case "accessor": {
        const ref = pair.deliveryEvidenceRef;
        Object.defineProperty(pair, "deliveryEvidenceRef", { enumerable: true, get: () => ref });
        break;
      }
      case "proxy": pair = new Proxy(pair, {
        getPrototypeOf: () => { throw new Error(secret); },
      }); break;
      case "custom-prototype": pair = Object.assign(Object.create({ inherited: true }), pair); break;
      case "null-prototype": pair = Object.assign(Object.create(null), pair); break;
    }

    function deeplyFrozen(value, seen = new Set()) {
      if (value === null || typeof value !== "object" || seen.has(value)) return true;
      seen.add(value);
      if (!Object.isFrozen(value)) return false;
      return Reflect.ownKeys(value).every((key) => deeplyFrozen(value[key], seen));
    }

    try {
      const observation = scenario.action === "resolve"
        ? await module.resolveProductBuildAuthorityV2DeliveryEvidenceV1(pair)
        : await module.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();
      process.stdout.write(JSON.stringify({
        ok: true,
        schema: observation.schema,
        observationTransport: observation.observationTransport,
        frozen: deeplyFrozen(observation),
        pair: {
          deliveryEvidenceRef: observation.response.deliveryEvidenceRef,
          deliveryEvidenceHash: observation.response.deliveryEvidenceHash,
        },
        calls,
      }));
    } catch (error) {
      process.stdout.write(JSON.stringify({
        ok: false,
        code: error?.code,
        message: error?.message,
        stack: error?.stack,
        calls,
      }));
    }
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--no-warnings",
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      script,
    ],
    {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      maxBuffer: 4 * 1_048_576,
      env: { ...process.env },
    },
  );
  assert.equal(
    result.status,
    0,
    `observer harness failed: ${result.stderr || result.stdout}`,
  );
  return JSON.parse(result.stdout) as ObserverHarnessResult;
}

function assertRedactedObserverError(result: ObserverHarnessResult): void {
  assert.equal(result.ok, false);
  assert.match(
    result.code ?? "",
    /^PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_[A-Z_]+$/u,
  );
  assert.equal(result.message, result.code);
  assert.doesNotMatch(
    `${result.code ?? ""}${result.message ?? ""}${result.stack ?? ""}`,
    /LAUNCHCTL_SECRET_SENTINEL|\/Users\/|postgres:|hostile/u,
  );
}

describe("Product Build Authority V2 delivery-evidence response v1", () => {
  it("exports only the fixed zero-input observer and pair-only resolver", () => {
    assert.equal(typeof observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1, "function");
    assert.equal(typeof resolveProductBuildAuthorityV2DeliveryEvidenceV1, "function");
  });

  it("observes the fixed source CLI with a sealed child boundary and freezes the result", () => {
    const result = runObserverHarness({ action: "observe" });
    assert.equal(result.ok, true);
    assert.equal(
      result.schema,
      "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
    );
    assert.equal(result.observationTransport, "source-cli");
    assert.equal(result.frozen, true);
    assert.deepEqual(result.pair, {
      deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
      deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
    });
    assert.equal(result.calls.length, 9);
    assert.deepEqual(result.calls[0], {
      file: "/bin/launchctl",
      args: ["print", "gui/501/com.setrox.mission-control"],
      env: { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      shell: false,
      timeout: 5_000,
      maxBuffer: 1_048_576,
      encoding: "utf8",
    });
    assert.deepEqual(
      result.calls.slice(1, 4).map((call) => [call.file, call.args]),
      [
        [
          "/usr/bin/plutil",
          ["-extract", "Label", "raw", "-o", "-", "/Users/setrox/Library/LaunchAgents/com.setrox.mission-control.plist"],
        ],
        [
          "/usr/bin/plutil",
          ["-extract", "WorkingDirectory", "raw", "-o", "-", "/Users/setrox/Library/LaunchAgents/com.setrox.mission-control.plist"],
        ],
        [
          "/usr/bin/plutil",
          ["-extract", "ProgramArguments", "json", "-o", "-", "/Users/setrox/Library/LaunchAgents/com.setrox.mission-control.plist"],
        ],
      ],
    );
    assert.deepEqual(result.calls[4], {
      file: "/opt/homebrew/Cellar/node/26.4.0/bin/node",
      args: [
        "/Users/setrox/ai/setrox/mission-control/dist-server/services/product-build-authority-v2-delivery-evidence-v1.js",
        "--json",
      ],
      cwd: "/Users/setrox/ai/setrox/mission-control",
      env: { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      shell: false,
      timeout: 120_000,
      maxBuffer: 1_048_576,
      encoding: "utf8",
    });
    assert.deepEqual(result.calls.slice(5), result.calls.slice(0, 4));
    assert.equal(
      Object.keys(result.calls[4]?.env ?? {}).some((key) =>
        /HOME|NODE|GIT|PROXY|SETFARM|DATABASE|TOKEN/u.test(key)),
      false,
    );
  });

  it("accepts real plutil ProgramArguments JSON without a final newline and with escaped slashes", () => {
    const result = runObserverHarness({ plutilMode: "real-argv-json" });
    assert.equal(result.ok, true);
    assert.equal(result.calls.length, 9);
    assert.deepEqual(result.pair, {
      deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
      deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
    });
  });

  it("freshly reobserves for pair resolution and refuses mismatches", () => {
    const exact = runObserverHarness({ action: "resolve", pairKind: "valid" });
    assert.equal(exact.ok, true);
    assert.equal(exact.calls.length, 9);
    assert.deepEqual(exact.pair, {
      deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
      deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
    });

    const mismatch = runObserverHarness({ action: "resolve", pairKind: "mismatch" });
    assertRedactedObserverError(mismatch);
    assert.equal(
      mismatch.code,
      "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_MISMATCH",
    );
    assert.equal(mismatch.calls.length, 9);
  });

  it("rejects malformed exact pairs before any OS call", () => {
    for (const pairKind of [
      "crossed",
      "missing",
      "hidden",
      "symbol",
      "accessor",
      "proxy",
      "custom-prototype",
      "null-prototype",
    ] as const) {
      const result = runObserverHarness({ action: "resolve", pairKind });
      assertRedactedObserverError(result);
      assert.equal(
        result.code,
        "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID",
        pairKind,
      );
      assert.equal(result.calls.length, 0, pairKind);
    }
  });

  it("fails closed on UID, launchctl, plist, and file locator drift", () => {
    const scenarios: readonly ObserverHarnessScenario[] = [
      { uid: null },
      { uid: -1 },
      { uid: 1.5 },
      { uid: Number.MAX_SAFE_INTEGER + 1 },
      { launchctlMode: "error" },
      { launchctlMode: "timeout" },
      { launchctlMode: "oversize" },
      { launchctlMode: "malformed" },
      { launchctlMode: "duplicate-path" },
      { launchctlMode: "wrong-program" },
      { launchctlMode: "wrong-cwd" },
      { launchctlMode: "final-drift" },
      { plutilMode: "error" },
      { plutilMode: "timeout" },
      { plutilMode: "oversize" },
      { plutilMode: "duplicate-label" },
      { plutilMode: "wrong-label" },
      { plutilMode: "wrong-cwd" },
      { plutilMode: "malformed-argv" },
      { plutilMode: "non-string-argv" },
      { plutilMode: "whitespace-argv" },
      { plutilMode: "wrong-argv" },
      { fileMode: "plist-symlink" },
      { fileMode: "plist-nonregular" },
      { fileMode: "plist-owner" },
      { fileMode: "plist-mode" },
      { fileMode: "entry-symlink" },
      { fileMode: "entry-nonregular" },
      { fileMode: "cli-symlink" },
      { fileMode: "cli-nonregular" },
    ];
    for (const scenario of scenarios) {
      assertRedactedObserverError(runObserverHarness(scenario));
    }
  });

  it("accepts only one compact bounded JSON payload with empty stderr", () => {
    for (const cliMode of [
      "error",
      "timeout",
      "signal",
      "oversize",
      "empty",
      "stderr",
      "malformed",
      "multiline",
      "trailing",
      "second-payload",
      "no-final-newline",
      "invalid-response",
    ] as const) {
      const result = runObserverHarness({ cliMode });
      assertRedactedObserverError(result);
      assert.equal(result.calls.some((call) => call.file === "/opt/homebrew/Cellar/node/26.4.0/bin/node"), true);
    }
  });

  it("accepts the exact canonical current response and literal hash projections", () => {
    assert.equal(
      PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1,
      "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    );
    assert.equal(
      PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1,
      "current",
    );
    assert.deepEqual(
      parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(cloneFixture()),
      VALID_RESPONSE,
    );

    const focusedCore = structuredClone(VALID_RESPONSE.evidence.focusedTests) as MutableResponse;
    delete focusedCore.focusedTestReceiptRef;
    delete focusedCore.focusedTestReceiptHash;
    assert.equal(
      hashCanonicalJson({ argv: VALID_RESPONSE.evidence.focusedTests.argv }),
      "0db837757920ce51b060993d379611fba899058e3ab9272888ab92d81fc5093b",
    );
    assert.equal(hashCanonicalJson(focusedCore), FOCUSED_TEST_HASH);

    assert.equal(
      hashCanonicalJson({
        schema: "mission-control.setfarm-contract-compatibility-set.v1",
        artifacts: VALID_RESPONSE.evidence.vendorLock.artifacts,
      }),
      "d81f264f01999758c95d6ce30a3312f67ce1fb9309daf0dcb1a0711c665a4407",
    );
    const vendorCore = structuredClone(VALID_RESPONSE.evidence.vendorLock) as MutableResponse;
    delete vendorCore.vendorLockProjectionHash;
    assert.equal(
      hashCanonicalJson(vendorCore),
      "c98a5ac68d8f6b2c9653a8f64fb6d4142f2245862c630a8b79c96a5403fd3471",
    );

    const evidenceCore = structuredClone(VALID_RESPONSE.evidence) as MutableResponse;
    delete evidenceCore.deliveryEvidenceRef;
    delete evidenceCore.deliveryEvidenceHash;
    assert.equal(
      canonicalJsonStringify(evidenceCore),
      EXPECTED_EVIDENCE_CORE_CANONICAL_BYTES,
    );
    assert.equal(hashCanonicalJson(evidenceCore), DELIVERY_EVIDENCE_HASH);
  });

  it("rejects absent, half-null, null, mixed, and extra success members", () => {
    for (const value of [undefined, null, true, [], {}, { currentStatus: "current" }]) {
      assertInvalid(value);
    }
    for (const key of [
      "schema",
      "currentStatus",
      "deliveryEvidenceRef",
      "deliveryEvidenceHash",
      "evidence",
    ]) {
      invalidMutation((candidate) => {
        delete candidate[key];
      });
      invalidMutation((candidate) => {
        candidate[key] = null;
      });
    }
    invalidMutation((candidate) => {
      candidate.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.currentSource.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.focusedTests.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.vendorLock.extra = true;
    });
  });

  it("rejects response, evidence, delivery, and clean-main identity drift", () => {
    const mutations: Array<(candidate: MutableResponse) => void> = [
      (candidate) => { candidate.schema = "mission-control.product-build-authority-v2-delivery-evidence-response.v2"; },
      (candidate) => { candidate.currentStatus = "stale"; },
      (candidate) => { candidate.evidence.schema = "mission-control.product-build-authority-v2-delivery-evidence.v2"; },
      (candidate) => { candidate.evidence.currentStatus = "stale"; },
      (candidate) => { candidate.evidence.deliveryPrNumber = 20; },
      (candidate) => { candidate.evidence.deliveryMergeSha = "0".repeat(40); },
      (candidate) => { candidate.evidence.deliveryMergeAncestorOfCurrentSource = false; },
      (candidate) => { candidate.evidence.currentSource.branch = "feature"; },
      (candidate) => { candidate.evidence.currentSource.clean = false; },
      (candidate) => { candidate.evidence.currentSource.originMainSha = "0".repeat(40); },
      (candidate) => { candidate.evidence.currentSource.buildHash = "0".repeat(64); },
    ];
    for (const mutate of mutations) invalidMutation(mutate);
  });

  it("rejects delivered path/blob reorder, duplicate, count, and identity drift", () => {
    invalidMutation((candidate) => {
      [candidate.evidence.deliveredPathBlobs[0], candidate.evidence.deliveredPathBlobs[1]] =
        [candidate.evidence.deliveredPathBlobs[1], candidate.evidence.deliveredPathBlobs[0]];
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs[1] = candidate.evidence.deliveredPathBlobs[0];
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs.pop();
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs.push(candidate.evidence.deliveredPathBlobs[0]);
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs[4].path = "src/lib/other.ts";
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs[4].blobHash = "0".repeat(64);
    });
  });

  it("rejects focused-test command, path/blob, result, and receipt drift", () => {
    const mutations: Array<(candidate: MutableResponse) => void> = [
      (candidate) => { candidate.evidence.focusedTests.schema = "wrong"; },
      (candidate) => { candidate.evidence.focusedTests.argv.reverse(); },
      (candidate) => { candidate.evidence.focusedTests.commandContractHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.focusedTests.testPathBlobs.reverse(); },
      (candidate) => { candidate.evidence.focusedTests.testPathBlobs[0].blobHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.focusedTests.exitCode = 1; },
      (candidate) => { candidate.evidence.focusedTests.passed = false; },
      (candidate) => { candidate.evidence.focusedTests.focusedTestReceiptHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.focusedTests.focusedTestReceiptRef = `${FOCUSED_TEST_REF}x`; },
    ];
    for (const mutate of mutations) invalidMutation(mutate);
  });

  it("rejects vendor-lock identity reorder, duplicate, count, projection, and cross-field drift", () => {
    const mutations: Array<(candidate: MutableResponse) => void> = [
      (candidate) => { candidate.evidence.vendorLock.schema = "wrong"; },
      (candidate) => { candidate.evidence.vendorLock.lockPath = "contracts/vendor/setfarm/other.lock.json"; },
      (candidate) => { candidate.evidence.vendorLock.producerRepository = "https://example.invalid/setfarm.git"; },
      (candidate) => { candidate.evidence.vendorLock.lockContentHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.vendorLock.compatibilitySetHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.vendorLock.vendorLockProjectionHash = "0".repeat(64); },
      (candidate) => {
        [candidate.evidence.vendorLock.artifacts[0], candidate.evidence.vendorLock.artifacts[1]] =
          [candidate.evidence.vendorLock.artifacts[1], candidate.evidence.vendorLock.artifacts[0]];
      },
      (candidate) => {
        candidate.evidence.vendorLock.artifacts[1] = candidate.evidence.vendorLock.artifacts[0];
      },
      (candidate) => { candidate.evidence.vendorLock.artifacts.pop(); },
      (candidate) => {
        candidate.evidence.vendorLock.artifacts.push(candidate.evidence.vendorLock.artifacts[0]);
      },
      (candidate) => { candidate.evidence.vendorLock.artifacts[6].producerPath = "wrong"; },
      (candidate) => { candidate.evidence.vendorLock.artifacts[6].vendoredPath = "wrong"; },
      (candidate) => { candidate.evidence.vendorLock.artifacts[6].sha256 = "0".repeat(64); },
    ];
    for (const mutate of mutations) invalidMutation(mutate);
  });

  it("rejects malformed hashes at every Git-object and SHA-256 boundary", () => {
    assert.equal(GIT_OBJECT_HASH_V1_PATTERN.test("a".repeat(40)), true);
    assert.equal(GIT_OBJECT_HASH_V1_PATTERN.test("b".repeat(64)), true);
    assert.equal(SHA256_V1_PATTERN.test("c".repeat(64)), true);

    const gitSetters = [
      (candidate: MutableResponse, value: string) => { candidate.evidence.deliveryMergeSha = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.sha = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.treeHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.originMainSha = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.producerCommit = value; },
    ];
    for (const setHash of gitSetters) {
      for (const value of [
        "a".repeat(39),
        "a".repeat(41),
        "a".repeat(63),
        "a".repeat(65),
        "A".repeat(40),
        `${"a".repeat(39)}g`,
      ]) {
        invalidMutation((candidate) => setHash(candidate, value));
      }
    }

    const shaSetters = [
      (candidate: MutableResponse, value: string) => { candidate.deliveryEvidenceHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.deliveryEvidenceHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.buildHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.deliveredPathBlobs[0].blobHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.focusedTests.commandContractHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.focusedTests.testPathBlobs[0].blobHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.focusedTests.focusedTestReceiptHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.lockContentHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.artifacts[0].sha256 = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.compatibilitySetHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.vendorLockProjectionHash = value; },
    ];
    for (const setHash of shaSetters) {
      for (const value of [
        "a".repeat(40),
        "a".repeat(63),
        "a".repeat(65),
        "A".repeat(64),
        `${"a".repeat(63)}g`,
      ]) {
        invalidMutation((candidate) => setHash(candidate, value));
      }
    }
  });

  it("rejects crossed refs, hashes, and bodies even when each scalar is well formed", () => {
    invalidMutation((candidate) => {
      candidate.deliveryEvidenceHash = "0".repeat(64);
      candidate.deliveryEvidenceRef =
        `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${"0".repeat(64)}`;
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveryEvidenceHash = "0".repeat(64);
      candidate.evidence.deliveryEvidenceRef =
        `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${"0".repeat(64)}`;
    });
    invalidMutation((candidate) => {
      candidate.evidence.focusedTests.focusedTestReceiptHash = "0".repeat(64);
      candidate.evidence.focusedTests.focusedTestReceiptRef =
        `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${"0".repeat(64)}`;
    });
    invalidMutation((candidate) => {
      candidate.evidence.currentSource.treeHash = "0".repeat(64);
    });
  });

  it("has a Setfarm-local source-CLI-only boundary and no private exported seam", async () => {
    const source = await readFile(
      new URL(
        "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const imports = [...source.matchAll(
      /^\s*import(?:\s+type)?(?:[^;]*?\sfrom\s*)?["']([^"']+)["'];/gmu,
    )].map((match) => match[1]);
    assert.deepEqual(imports, [
      "node:child_process",
      "node:fs/promises",
      "node:path",
      "zod",
      "../product-compiler/canonical-json.js",
    ]);
    assert.equal(source.includes("import type"), false);
    assert.equal(source.includes("import("), false);
    assert.equal(source.includes("require("), false);
    assert.equal(imports.some((specifier) => specifier?.includes("mission-control")), false);
    assert.equal(imports.some((specifier) => specifier?.includes("baseline-post-handoff")), false);
    assert.equal(imports.some((specifier) => specifier?.includes("runtime-source")), false);
    assert.equal(imports.some((specifier) => specifier?.startsWith("../../")), false);
    assert.deepEqual(
      [...source.matchAll(/export (?:async )?function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]),
      [
        "parseProductBuildAuthorityV2DeliveryEvidenceResponseV1",
        "observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1",
        "resolveProductBuildAuthorityV2DeliveryEvidenceV1",
      ],
    );
    assert.deepEqual(
      [...source.matchAll(/export type\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]),
      [
        "GitObjectHashV1",
        "Sha256V1",
        "CanonicalRef",
        "ProductBuildAuthorityV2FocusedTestReceiptV1",
        "ProductBuildAuthorityV2VendorLockProjectionV1",
        "ProductBuildAuthorityV2DeliveryEvidenceV1",
        "ProductBuildAuthorityV2DeliveryEvidenceResponseV1",
        "ProductBuildAuthorityV2DeliveryEvidencePairV1",
        "ProductBuildAuthorityV2DeliveryEvidenceObservationV1",
      ],
    );
    assert.match(
      source,
      /parseProductBuildAuthorityV2DeliveryEvidenceResponseV1\(value: unknown\)/u,
    );
    assert.match(
      source,
      /observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1\(\)/u,
    );
    assert.match(
      source,
      /resolveProductBuildAuthorityV2DeliveryEvidenceV1\(\s*input: ProductBuildAuthorityV2DeliveryEvidencePairV1/u,
    );
    assert.doesNotMatch(
      source,
      /\bfetch\b|https?:\/\/127\.0\.0\.1|observationTransport:\s*"http"|fallback/iu,
    );
    assert.doesNotMatch(
      source,
      /export\s+(?:const|class|function|type|interface)\s+(?:[A-Za-z0-9_]*(?:Locator|Launchctl|Plutil|Environment|Options|Factory)[A-Za-z0-9_]*)/u,
    );
    assert.doesNotMatch(source, /(?:sourceRoot|missionControlRoot|transportOverride)\s*[?:]/u);
  });
});
