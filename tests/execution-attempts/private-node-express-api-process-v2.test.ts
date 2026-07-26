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
  executePrivateNodeExpressApiProcessV2,
} from "../../src/execution/private-node-express-api-process-v2.js";
import {
  NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
  NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
} from "../../src/execution/schemas/node-express-api-launcher-v2.js";
import {
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  ExclusiveSocketLeaseReceiptV2Schema,
  ServiceReadinessReceiptV2Schema,
  SocketCleanupReceiptV2Schema,
  SocketHandoffAcknowledgementV2Schema,
} from "../../src/execution/schemas/exclusive-socket-lease-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "../../src/execution/schemas/network-isolation-negative-probe-v2.js";

function sha(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const SYNTHETIC_EXPRESS_TRANSPORT_FIXTURE_V2 = String.raw`
"use strict";
function express() {
  const stack = [];
  const application = (request, response) => {
    request.originalUrl = request.url;
    response.status = function status(code) {
      this.statusCode = code;
      return this;
    };
    response.json = function json(value) {
      const bytes = Buffer.from(JSON.stringify(value), "utf8");
      this.setHeader("content-type", "application/json; charset=utf-8");
      this.setHeader("content-length", String(bytes.byteLength));
      this.end(bytes);
      return this;
    };
    let index = 0;
    const next = (error) => {
      const layer = stack[index++];
      if (!layer) {
        if (error && !response.headersSent) {
          response.status(500).json({ error: { code: "FIXTURE_UNHANDLED" } });
        }
        return;
      }
      const errorLayer = layer.length === 4;
      if (error && errorLayer) return layer(error, request, response, next);
      if (error || errorLayer) return next(error);
      return layer(request, response, next);
    };
    next();
  };
  application.disable = () => application;
  application.use = (layer) => {
    stack.push(layer);
    return application;
  };
  return application;
}
express.json = (options) => (request, response, next) => {
  void response;
  const contentType = String(request.headers["content-type"] || "");
  if (!contentType.toLowerCase().startsWith(String(options.type))) {
    next();
    return;
  }
  const chunks = [];
  let bytes = 0;
  request.on("data", (chunk) => {
    bytes += chunk.byteLength;
    if (bytes > options.limit) {
      request.destroy(new Error("FIXTURE_BODY_LIMIT"));
      return;
    }
    chunks.push(Buffer.from(chunk));
  });
  request.on("end", () => {
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        options.strict
        && (value === null || typeof value !== "object" || Array.isArray(value))
      ) {
        throw new Error("FIXTURE_STRICT_JSON");
      }
      request.body = value;
      next();
    } catch (error) {
      next(error);
    }
  });
  request.on("error", next);
};
module.exports = express;
`;

const CANDIDATE_APPLICATION_FIXTURE_V2 = String.raw`
export const setfarmHttpHandlerV2 = (request, response, next) => {
  void next;
  if (
    request.method !== "POST"
    || request.originalUrl !== "/tasks/setfarm"
    || request.url !== "/tasks/setfarm"
    || !request.body
    || Object.keys(request.body).sort().join(",") !== "title"
    || typeof request.body.title !== "string"
  ) {
    response.status(400).json({
      error: {
        code: "INPUT_VALIDATION_FAILED",
        message: "Expected one exact task title",
      },
    });
    return;
  }
  response.status(201).json({ task: { title: request.body.title } });
};
`;

const CANDIDATE_LISTEN_FIXTURE_V2 = String.raw`
import { createServer } from "node:net";

createServer().listen(0);

export const setfarmHttpHandlerV2 = (request, response) => {
  void request;
  response.status(200).json({ forbidden: "candidate listener started" });
};
`;

type PrivateApiFixtureV2 = Readonly<{
  scratch: string;
  bundleRoot: string;
  applicationRoot: string;
  nodeModulesRoot: string;
  expressRoot: string;
  modulePath: string;
}>;

async function materializePrivateApiFixtureV2(
  applicationSource: string,
): Promise<PrivateApiFixtureV2> {
  const scratch = await realpath(await mkdtemp(path.join(
    tmpdir(),
    "setfarm-node-express-api-process-v2-",
  )));
  const bundleRoot = path.join(scratch, "candidate-bundle");
  const applicationRoot = path.join(bundleRoot, "application");
  const nodeModulesRoot = path.join(bundleRoot, "node_modules");
  const expressRoot = path.join(nodeModulesRoot, "express");
  const modulePath = path.join(applicationRoot, "app.js");
  await Promise.all([
    mkdir(applicationRoot, { recursive: true, mode: 0o700 }),
    mkdir(expressRoot, { recursive: true, mode: 0o700 }),
  ]);
  await Promise.all([
    writeFile(
      path.join(bundleRoot, "package.json"),
      "{\"name\":\"candidate-api-fixture\",\"private\":true,\"type\":\"module\"}\n",
      { mode: 0o600 },
    ),
    writeFile(modulePath, applicationSource, { mode: 0o600 }),
    writeFile(
      path.join(expressRoot, "package.json"),
      "{\"name\":\"express\",\"version\":\"5.2.1\",\"main\":\"index.cjs\"}\n",
      { mode: 0o600 },
    ),
    writeFile(
      path.join(expressRoot, "index.cjs"),
      SYNTHETIC_EXPRESS_TRANSPORT_FIXTURE_V2,
      { mode: 0o600 },
    ),
  ]);
  await Promise.all([
    chmod(bundleRoot, 0o555),
    chmod(applicationRoot, 0o555),
    chmod(nodeModulesRoot, 0o555),
    chmod(expressRoot, 0o555),
    chmod(path.join(bundleRoot, "package.json"), 0o444),
    chmod(modulePath, 0o444),
    chmod(path.join(expressRoot, "package.json"), 0o444),
    chmod(path.join(expressRoot, "index.cjs"), 0o444),
  ]);
  return Object.freeze({
    scratch,
    bundleRoot,
    applicationRoot,
    nodeModulesRoot,
    expressRoot,
    modulePath,
  });
}

async function destroyPrivateApiFixtureV2(
  fixture: PrivateApiFixtureV2,
): Promise<void> {
  for (const directory of [
    fixture.bundleRoot,
    fixture.applicationRoot,
    fixture.nodeModulesRoot,
    fixture.expressRoot,
  ]) {
    await chmod(directory, 0o700).catch(() => undefined);
  }
  await rm(fixture.scratch, { recursive: true, force: true });
}

test(
  "private API process owns one sandboxed held-socket request and proves cleanup",
  { skip: process.platform !== "darwin" },
  async () => {
    const fixture = await materializePrivateApiFixtureV2(
      CANDIDATE_APPLICATION_FIXTURE_V2,
    );
    let responseBody: Buffer | undefined;
    try {
      const bodyBytes = "{\"title\":\"Ship Setfarm API\"}";
      const result = await executePrivateNodeExpressApiProcessV2({
        bundleRoot: fixture.bundleRoot,
        modulePath: fixture.modulePath,
        moduleContentHash: sha(CANDIDATE_APPLICATION_FIXTURE_V2),
        nodeExecutablePath: await realpath(process.execPath),
        request: {
          method: "POST",
          pathAndQuery: "/tasks/setfarm",
          fixedHeaders: [
            { name: "accept", value: "application/json" },
            { name: "content-type", value: "application/json" },
          ],
          bodyBytes,
          redirectPolicy: "error",
        },
      });
      responseBody = result.responseBody;

      assert.equal(
        ExclusiveSocketLeaseReceiptV2Schema.safeParse(result.lease).success,
        true,
      );
      assert.equal(
        SocketHandoffAcknowledgementV2Schema.safeParse(
          result.acknowledgement,
        ).success,
        true,
      );
      assert.equal(
        ServiceReadinessReceiptV2Schema.safeParse(result.readiness).success,
        true,
      );
      assert.equal(
        SocketCleanupReceiptV2Schema.safeParse(result.cleanup).success,
        true,
      );
      assert.equal(
        result.launchBinding.launcherRef,
        NODE_EXPRESS_API_LAUNCHER_REF_V2,
      );
      assert.equal(
        result.launchBinding.launcherModuleHash,
        NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
      );
      assert.equal(
        result.launchBinding.applicationModuleLocator,
        NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
      );
      assert.equal(
        result.launchBinding.applicationExport,
        NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
      );
      assert.equal(
        result.launchBinding.handlerAbiHash,
        NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
      );
      assert.equal(
        result.lease.lifecycleAbiHash,
        EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
      );
      assert.equal(
        result.normalizedEnvironmentHash,
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
      );
      assert.equal(
        result.acknowledgement.leaseHash,
        result.lease.leaseHash,
      );
      assert.equal(
        result.readiness.acknowledgementHash,
        result.acknowledgement.acknowledgementHash,
      );
      assert.equal(
        result.cleanup.readinessHash,
        result.readiness.readinessHash,
      );
      assert.equal(
        result.request.childProcessIdentityHash,
        result.acknowledgement.childProcessIdentityHash,
      );
      assert.equal(result.request.requestCount, 1);
      assert.equal(result.request.childCommittedRequestCount, 1);
      assert.equal(result.request.redirectCount, 0);
      assert.equal(result.request.statusCode, 201);
      assert.equal(
        result.request.contentType,
        "application/json; charset=utf-8",
      );
      assert.equal(result.request.responseContentHash, sha(result.responseBody));
      assert.deepEqual(JSON.parse(result.responseBody.toString("utf8")), {
        task: { title: "Ship Setfarm API" },
      });
      assert.deepEqual(
        [
          result.lease.stateTransition,
          ...result.acknowledgement.stateTransitions,
          result.readiness.stateTransition,
          result.cleanup.stateTransition,
        ],
        [
          "unbound_to_bound",
          "bound_to_sent",
          "sent_to_acknowledged",
          "acknowledged_to_ready",
          "ready_to_closed",
        ],
      );
    } finally {
      responseBody?.fill(0);
      await destroyPrivateApiFixtureV2(fixture);
    }
  },
);

test(
  "private API process disables candidate listener authority before import",
  { skip: process.platform !== "darwin" },
  async () => {
    const fixture = await materializePrivateApiFixtureV2(
      CANDIDATE_LISTEN_FIXTURE_V2,
    );
    try {
      await assert.rejects(
        executePrivateNodeExpressApiProcessV2({
          bundleRoot: fixture.bundleRoot,
          modulePath: fixture.modulePath,
          moduleContentHash: sha(CANDIDATE_LISTEN_FIXTURE_V2),
          nodeExecutablePath: await realpath(process.execPath),
          request: {
            method: "GET",
            pathAndQuery: "/",
            fixedHeaders: [
              { name: "accept", value: "application/json" },
            ],
            bodyBytes: null,
            redirectPolicy: "error",
          },
        }),
        (error: unknown) =>
          error !== null
          && typeof error === "object"
          && "code" in error
          && error.code === "EXCLUSIVE_SOCKET_V2_HANDOFF_FAILED"
          && "message" in error
          && typeof error.message === "string"
          && error.message.includes(
            "NODE_EXPRESS_API_CHILD_CANDIDATE_LISTEN_FORBIDDEN",
          ),
      );
    } finally {
      await destroyPrivateApiFixtureV2(fixture);
    }
  },
);
