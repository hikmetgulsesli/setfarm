import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  executePrivateNodeTestCommandV2,
} from "../../src/execution/private-node-test-command-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "../../src/execution/schemas/network-isolation-negative-probe-v2.js";

function sha(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

type PrivateNodeTestFixtureV2 = Readonly<{
  scratch: string;
  bundleRoot: string;
  applicationRoot: string;
  testPath: string;
  source: string;
}>;

const ADMITTED_NODE_V22_EXECUTABLE =
  "/opt/homebrew/opt/node@22/bin/node" as const;

async function materializeNodeTestFixtureV2(
  source: string,
): Promise<PrivateNodeTestFixtureV2> {
  const scratch = await realpath(await mkdtemp(path.join(
    tmpdir(),
    "setfarm-private-node-test-command-v2-",
  )));
  const bundleRoot = path.join(scratch, "candidate-bundle");
  const applicationRoot = path.join(bundleRoot, "application");
  const testPath = path.join(applicationRoot, "cli.setfarm.test.js");
  await mkdir(applicationRoot, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(bundleRoot, "package.json"),
    "{\"name\":\"private-node-test-fixture\",\"private\":true,\"type\":\"module\"}\n",
    { mode: 0o600 },
  );
  await writeFile(testPath, source, { mode: 0o600 });
  await Promise.all([
    chmod(bundleRoot, 0o555),
    chmod(applicationRoot, 0o555),
    chmod(path.join(bundleRoot, "package.json"), 0o444),
    chmod(testPath, 0o444),
  ]);
  return Object.freeze({
    scratch,
    bundleRoot,
    applicationRoot,
    testPath,
    source,
  });
}

async function destroyNodeTestFixtureV2(
  fixture: PrivateNodeTestFixtureV2,
): Promise<void> {
  await chmod(fixture.bundleRoot, 0o700).catch(() => undefined);
  await chmod(fixture.applicationRoot, 0o700).catch(() => undefined);
  await rm(fixture.scratch, { recursive: true, force: true });
}

async function executeFixtureV2(source: string) {
  const fixture = await materializeNodeTestFixtureV2(source);
  try {
    return await executePrivateNodeTestCommandV2({
      bundleRoot: fixture.bundleRoot,
      testPath: fixture.testPath,
      testContentHash: sha(fixture.source),
      nodeExecutablePath: await realpath(ADMITTED_NODE_V22_EXECUTABLE),
    });
  } finally {
    await destroyNodeTestFixtureV2(fixture);
  }
}

test(
  "private Node test command authenticates one passing TAP summary",
  { skip: process.platform !== "darwin" },
  async () => {
    const result = await executeFixtureV2(String.raw`
import assert from "node:assert/strict";
import test from "node:test";
test("sealed pass", () => assert.equal(2 + 2, 4));
`);
    try {
      assert.deepEqual(result.termination, {
        status: "exited",
        exitCode: 0,
        signal: null,
      });
      assert.equal(
        result.tapSummary.status,
        "valid_terminal_summary",
        result.stdout.toString("utf8"),
      );
      if (result.tapSummary.status === "valid_terminal_summary") {
        assert.equal(result.tapSummary.testCount, 1);
        assert.equal(result.tapSummary.passCount, 1);
        assert.equal(result.tapSummary.failCount, 0);
      }
      assert.equal(
        result.runtimeTestMemberLocator,
        "candidate-bundle/application/cli.setfarm.test.js",
      );
      assert.equal(
        result.normalizedEnvironmentHash,
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
      );
      assert.match(result.stdout.toString("utf8"), /^TAP version 13\n/u);
      assert.equal(result.stderr.byteLength, 0);
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
  },
);

test(
  "private Node test command preserves a generated-product TAP failure",
  { skip: process.platform !== "darwin" },
  async () => {
    const result = await executeFixtureV2(String.raw`
import assert from "node:assert/strict";
import test from "node:test";
test("sealed failure", () => assert.equal("actual", "expected"));
`);
    try {
      assert.deepEqual(result.termination, {
        status: "exited",
        exitCode: 1,
        signal: null,
      });
      assert.equal(
        result.tapSummary.status,
        "valid_terminal_summary",
        result.stdout.toString("utf8"),
      );
      if (result.tapSummary.status === "valid_terminal_summary") {
        assert.equal(result.tapSummary.testCount, 1);
        assert.equal(result.tapSummary.passCount, 0);
        assert.equal(result.tapSummary.failCount, 1);
      }
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
  },
);

test(
  "private Node test command denies outbound network inside a passing test",
  { skip: process.platform !== "darwin" },
  async () => {
    const result = await executeFixtureV2(String.raw`
import assert from "node:assert/strict";
import test from "node:test";
test("outbound denied", async () => {
  await assert.rejects(
    fetch("http://1.1.1.1", { signal: AbortSignal.timeout(2_000) }),
  );
});
`);
    try {
      assert.deepEqual(result.termination, {
        status: "exited",
        exitCode: 0,
        signal: null,
      });
      assert.equal(
        result.tapSummary.status,
        "valid_terminal_summary",
        result.stdout.toString("utf8"),
      );
      if (result.tapSummary.status === "valid_terminal_summary") {
        assert.equal(result.tapSummary.testCount, 1);
        assert.equal(result.tapSummary.passCount, 1);
        assert.equal(result.tapSummary.failCount, 0);
      }
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
  },
);
