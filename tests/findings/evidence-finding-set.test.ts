import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createCanonicalEvidenceBundleV2 } from "../../src/evidence/canonical-evidence-runner.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { createFindingSetFromEvidenceBundleV2 } from "../../src/findings/evidence-finding-set.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

describe("evidence finding set adapter", () => {
  it("derives exact typed findings and current source hashes without prose paths", () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-evidence-findings-"));
    try {
      const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
      const source = path.join(workdir, "src", "App.tsx");
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.writeFileSync(source, "export const app = 'candidate';\n");
      const plan = compileEvidencePlanV1({ slice, sliceHash: "f".repeat(64) });
      const bundle = createCanonicalEvidenceBundleV2({
        runId: "run-finding-adapter-1",
        storyId: slice.storyId,
        workdir,
        attemptId: "ATT_finding-adapter-0001",
        sourceRevision: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
        slice,
        plan,
        execution: {
          commands: plan.commands.map((command) => ({
            commandRef: command.commandRef,
            exitCode: command.kind === "build" ? 1 : 0,
            stdout: "",
            stderr: command.kind === "build" ? "compile failed" : "",
            startedAt: "2026-07-13T00:00:00.000Z",
            completedAt: "2026-07-13T00:00:01.000Z",
          })),
          interactions: [],
          runtimeError: "Runtime was not started after command failure.",
        },
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:02.000Z",
      }).bundle;
      const findingSet = createFindingSetFromEvidenceBundleV2({
        workdir,
        slice,
        sliceHash: plan.sliceHash,
        bundle,
      });
      assert.ok(findingSet);
      assert.deepEqual(
        findingSet.findings.map((finding) => finding.expectedPredicateRef).sort(),
        bundle.predicates.filter((predicate) => predicate.verdict !== "pass").map((predicate) => predicate.predicateRef).sort(),
      );
      const buildFinding = findingSet.findings.find((finding) => finding.invariantRef === "INV_COMMAND_BUILD");
      assert.equal(buildFinding?.origin, "build");
      assert.deepEqual(buildFinding?.sourceLocators, [{
        path: "src/App.tsx",
        contentHash: createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
      }]);
      assert.equal(findingSet.sourceRevision.sha, bundle.sourceRevision.sha);
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });
});
