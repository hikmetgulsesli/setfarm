import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  ContractReplayFixtureV1Schema,
  ExpectedAttemptResultV1Schema,
  ExpectedCompilationResultV1Schema,
} from "../../src/evals/contract-fixture-schema.js";

const FIXTURE_ROOT = path.resolve("evals/fixtures");
const REQUIRED_CASES = [
  "1887-action-state",
  "1893-persistence",
  "1894-branch-continuity",
  "1925-task-chip",
  "847-required-evidence",
  "vibe-control-id",
];

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

describe("historical Product Compiler replay fixtures", () => {
  it("contains every required audited case", async () => {
    const entries = await readdir(FIXTURE_ROOT, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    assert.deepEqual(directories, REQUIRED_CASES);
  });

  it("strictly validates manifests, source hashes, redaction, and expected results", async () => {
    for (const caseId of REQUIRED_CASES) {
      const root = path.join(FIXTURE_ROOT, caseId);
      const fixture = ContractReplayFixtureV1Schema.parse(await readJson(path.join(root, "fixture.json")));
      assert.equal(fixture.caseId, caseId);
      assert.equal(fixture.redaction.containsCredentials, false);
      assert.equal(fixture.redaction.containsPrivateTranscripts, false);

      const declared = fixture.sources.map((source) => source.locator).sort();
      const sourceFiles = (await readdir(path.join(root, "sources"), { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => `sources/${entry.name}`)
        .sort();
      assert.deepEqual(sourceFiles, declared, `${caseId} must declare every copied source exactly once`);

      for (const source of fixture.sources) {
        const bytes = await readFile(path.join(root, source.locator));
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          source.sha256,
          `${caseId}/${source.locator} hash drift`,
        );
        const text = bytes.toString("utf8");
        assert.doesNotMatch(
          text,
          /\/Users\/setrox|\.openclaw|DATABASE_URL=|OPENAI_API_KEY=|ghp_[A-Za-z0-9]{20,}|(?:^|[^A-Za-z])sk-[A-Za-z0-9]{20,}/,
        );
      }

      const compilation = ExpectedCompilationResultV1Schema.parse(
        await readJson(path.join(root, fixture.expected.compilationResult)),
      );
      assert.equal(compilation.status, fixture.expected.packetStatus);
      if (fixture.expected.attemptResult) {
        ExpectedAttemptResultV1Schema.parse(
          await readJson(path.join(root, fixture.expected.attemptResult)),
        );
      }
    }
  });

  it("preserves #1925 exact source binding while guessed ID sets remain disjoint", async () => {
    const root = path.join(FIXTURE_ROOT, "1925-task-chip");
    const context = await readJson(path.join(root, "sources", "implement-context-excerpt.json")) as {
      ownedAction: { generatedActionIds: string[] };
    };
    const index = await readJson(path.join(root, "sources", "screen-index-excerpt.json")) as {
      actions: Array<{ id: string }>;
    };
    const source = await readFile(path.join(root, "sources", "generated-control.tsx"), "utf8");
    const review = await readJson(path.join(root, "sources", "review-thread-excerpt.json")) as {
      proseTokenCandidates: string[];
    };

    const actualIds = new Set(index.actions.map((action) => action.id));
    assert.deepEqual(
      context.ownedAction.generatedActionIds.filter((id) => actualIds.has(id)),
      [],
    );
    assert.match(source, /data-action="ACT_SAVE_RECORD"/);
    assert.match(source, /data-action-id="save-changes-7"/);
    assert.deepEqual(review.proseTokenCandidates, ["Description", "actSaveRecord", "task-title", "task-desc"]);
  });

  it("preserves #1894 distinct correct-head and later-base revisions", async () => {
    const value = await readJson(
      path.join(FIXTURE_ROOT, "1894-branch-continuity", "sources", "revisions.json"),
    ) as { correctHead: { sha: string; treeHash: string }; laterBase: { sha: string; treeHash: string } };
    assert.equal(value.correctHead.sha, "42ec4ebff979bda4519e56965cd60e5d19af8039");
    assert.equal(value.laterBase.sha, "e7c9f31b51b58dd85c6b089fb1383af9fcc3fc51");
    assert.notEqual(value.correctHead.sha, value.laterBase.sha);
    assert.notEqual(value.correctHead.treeHash, value.laterBase.treeHash);
  });

  it("preserves #847 required child failure followed by advisory and supervisor pass", async () => {
    const observations = await readJson(
      path.join(FIXTURE_ROOT, "847-required-evidence", "sources", "observations.json"),
    ) as Array<{ checkId: string; status: string }>;
    assert.deepEqual(
      observations.map((item) => [item.checkId, item.status]),
      [
        ["implement.runtime.interaction.2", "fail"],
        ["implement.evidence.artifact", "fail"],
        ["implement.evidence_runner", "fail"],
        ["implement.evidence", "pass"],
        ["implement.product_supervisor", "pass"],
      ],
    );
  });

  it("preserves Vibe's unspecified design identity and post-completion ID change", async () => {
    const patch = await readFile(
      path.join(FIXTURE_ROOT, "vibe-control-id", "sources", "control-id-fix.patch"),
      "utf8",
    );
    const design = await readFile(
      path.join(FIXTURE_ROOT, "vibe-control-id", "sources", "design-control-excerpt.html"),
      "utf8",
    );
    assert.match(design, /Return to Main Menu/);
    assert.doesNotMatch(design, /\sid=/);
    assert.match(patch, /-const menuBtn = document\.getElementById\('menu-btn'\)/);
    assert.match(patch, /\+const mainMenuBtn = document\.getElementById\('main-menu-btn'\)/);
    assert.match(patch, /integration-complete commit: 1e14342be3743702d29ceeb181576d742b413e42/);
  });

  it("preserves generic action/state and action/persistence gaps", async () => {
    const actionState = await readFile(
      path.join(FIXTURE_ROOT, "1887-action-state", "sources", "unbound-controls.tsx"),
      "utf8",
    );
    assert.match(actionState, /data-action="ACT_SEARCH_RECORDS"/);
    assert.doesNotMatch(actionState.split("\n").find((line) => line.includes("ACT_SEARCH_RECORDS")) ?? "", /onChange|data-action-id/);

    const persistence = await readJson(
      path.join(FIXTURE_ROOT, "1893-persistence", "sources", "integration-gap.json"),
    ) as { generatedScreenReceivesActions: boolean; persistenceExists: boolean; savePayloadBindingExists: boolean };
    const persistenceSource = await readFile(
      path.join(FIXTURE_ROOT, "1893-persistence", "sources", "persistence-repo-excerpt.ts"),
      "utf8",
    );
    assert.deepEqual(persistence, {
      generatedScreenReceivesActions: false,
      persistenceExists: true,
      savePayloadBindingExists: false,
    });
    assert.match(persistenceSource, /storage\.setItem\(key, value\)/);
    assert.match(persistenceSource, /saveTasks/);
  });
});
