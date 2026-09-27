import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8");

test("runtime-run producer reads authenticated Manifest A without a row-write lock", () => {
  const runtimeStart = source.indexOf("async function resolveActiveOwnerProducerV1(");
  const runtimeEnd = source.indexOf("async function requireWorkflowRunAdmissionReadyV1(", runtimeStart);
  assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart);
  assert.match(source.slice(runtimeStart, runtimeEnd),
    /resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1\(sql,\s*implementationId !== "a-runtime-run-v1"\)/);

  const activationStart = source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1(");
  const activationEnd = source.indexOf("function validateOwnerProducerActivationInputV1(", activationStart);
  assert.ok(activationStart >= 0 && activationEnd > activationStart);
  assert.match(source.slice(activationStart, activationEnd),
    /resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1\(sql, true, sourceCache\)/);
  assert.match(source.slice(activationStart, activationEnd),
    /UPDATE internal_production_owner_producer_manifest_set_current_v1 SET current_revision=current_revision\+1/);
});
