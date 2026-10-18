import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessArtifactCapacity,
  assessArtifactBatchCapacity,
  DEFAULT_ARTIFACT_CAPACITY_LIMITS,
} from "../../src/product-compiler/artifact-capacity.js";
import { FRESH_INSTALLATION_ARTIFACT_CAPACITY_LIMITS_V1 as limits } from "../../src/installation/fresh-installation-artifact-policy-v1.js";

test("fresh artifact publication preserves the8GiB projected host floor", () => {
  const floor = 8 * 1024 ** 3;
  assert.equal(assessArtifactCapacity({ limits, payloadBytes: 1, rootBytes: 0, freeBytes: floor }).code,
    "ARTIFACT_FREE_SPACE_LOW");
  assert.equal(assessArtifactCapacity({ limits, payloadBytes: 1, rootBytes: 0, freeBytes: floor + 1 }).status,
    "pass");
  assert.equal(assessArtifactBatchCapacity({ limits, missingPayloadByteLengths: [2, 3], rootBytes: 0, freeBytes: floor + 4 }).code,
    "ARTIFACT_FREE_SPACE_LOW");
  assert.equal(assessArtifactBatchCapacity({ limits, missingPayloadByteLengths: [2, 3], rootBytes: 0, freeBytes: floor + 5 }).status,
    "pass");
});

test("fresh policy retains payload and root quotas while ordinary default behavior stays separate", () => {
  const request = { payloadBytes: 1, rootBytes: 0, freeBytes: 2 * 1024 ** 3 };
  assert.equal(assessArtifactCapacity({ ...request, limits: DEFAULT_ARTIFACT_CAPACITY_LIMITS }).status, "pass");
  assert.equal(assessArtifactCapacity({ ...request, limits }).code, "ARTIFACT_FREE_SPACE_LOW");
  assert.equal(assessArtifactCapacity({ limits, payloadBytes: 4 * 1024 ** 2 + 1,
    rootBytes: 0, freeBytes: 16 * 1024 ** 3 }).code, "ARTIFACT_PAYLOAD_TOO_LARGE");
  assert.equal(assessArtifactCapacity({ limits, payloadBytes: 1,
    rootBytes: 512 * 1024 ** 2, freeBytes: 16 * 1024 ** 3 }).code, "ARTIFACT_ROOT_QUOTA_EXCEEDED");
});
