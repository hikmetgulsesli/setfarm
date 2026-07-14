import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createMissionControlContractArtifacts } from "../src/contracts/mission-control-contract-artifacts.js";
import { V3DeploymentObservationV1Schema } from "../src/execution/schemas/v3-deployment-observation-v1.js";
import { V3ProjectTransferAckV1Schema } from "../src/execution/schemas/v3-project-transfer-ack-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../src/product-compiler/canonical-json.js";
import { RunOperationalSnapshotV1Schema } from "../src/server/schemas/run-operational-snapshot-v1.js";

const expectedPaths = [
  "contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json",
  "contracts/generated/mission-control/run-operational-snapshot.v1.schema.json",
  "contracts/generated/mission-control/deployment-observation.v1.compatibility.json",
  "contracts/generated/mission-control/deployment-observation.v1.schema.json",
  "contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json",
  "contracts/generated/mission-control/project-transfer-ack.v1.schema.json",
];

test("publishes six deterministic Setfarm-owned Mission Control contract artifacts", async () => {
  const artifacts = createMissionControlContractArtifacts();
  assert.deepEqual(artifacts.map((artifact) => artifact.relativePath), expectedPaths);
  assert.equal(new Set(artifacts.map((artifact) => artifact.relativePath)).size, 6);
  for (const artifact of artifacts) {
    const expected = `${canonicalJsonStringify(artifact.value)}\n`;
    assert.equal(await readFile(path.resolve(artifact.relativePath), "utf8"), expected);
    assert.deepEqual(JSON.parse(expected), artifact.value);
  }
});

test("compatibility envelopes bind exact JSON schemas and schema-valid positive fixtures", () => {
  const artifacts = createMissionControlContractArtifacts();
  const byPath = new Map(artifacts.map((artifact) => [artifact.relativePath, artifact.value]));
  const cases = [
    {
      stem: "run-operational-snapshot.v1",
      parse: (value: unknown) => RunOperationalSnapshotV1Schema.parse(value),
    },
    {
      stem: "deployment-observation.v1",
      parse: (value: unknown) => V3DeploymentObservationV1Schema.parse(value),
    },
    {
      stem: "project-transfer-ack.v1",
      parse: (value: unknown) => V3ProjectTransferAckV1Schema.parse(value),
    },
  ];
  for (const contract of cases) {
    const compatibility = byPath.get(
      `contracts/generated/mission-control/${contract.stem}.compatibility.json`,
    ) as Record<string, unknown>;
    const jsonSchema = byPath.get(
      `contracts/generated/mission-control/${contract.stem}.schema.json`,
    );
    assert.equal(compatibility.schema, "setfarm.mission-control-contract-compatibility.v1");
    assert.equal(compatibility.jsonSchemaHash, hashCanonicalJson(jsonSchema));
    assert.equal(compatibility.fixtureHash, hashCanonicalJson(compatibility.fixture));
    contract.parse(compatibility.fixture);
  }
});
