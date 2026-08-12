import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const prototypeScript = fileURLToPath(new URL("../plan-prd-prototype.mjs", import.meta.url));

function runPrototype(args) {
  return spawnSync(process.execPath, [prototypeScript, ...args], {
    encoding: "utf-8",
    timeout: 5_000,
  });
}

describe("PLAN PRD prototype English authority", () => {
  it("always emits English when the task requests another UI language", () => {
    const result = runPrototype([
      "--task",
      "Build a compact preference tool and use Spanish for the product interface.",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^UI_LANGUAGE: English$/m);
    assert.match(result.stdout, /^- UI Language: English$/m);
  });

  it("preserves compatible English option aliases and canonicalizes their output", () => {
    for (const alias of ["English", "english", "en", "en_US", "en-GB"]) {
      const result = runPrototype(["--ui-language", alias]);
      assert.equal(result.status, 0, `${alias}: ${result.stderr}`);
      assert.match(result.stdout, /^UI_LANGUAGE: English$/m);
    }
  });

  it("rejects an explicit non-English option with bounded output", () => {
    const result = runPrototype(["--ui-language", "Klingon"]);

    assert.equal(result.status, 64);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "PLAN_PRD_PROTOTYPE_UI_LANGUAGE_MUST_BE_ENGLISH\n");
  });

  it("rejects non-English task text before embedding it with default or English language options", () => {
    const task = `Build a compact preference tool ${String.fromCodePoint(0x0416)}`;
    for (const args of [
      ["--task", task],
      ["--task", task, "--ui-language", "English"],
    ]) {
      const result = runPrototype(args);
      assert.equal(result.status, 64);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "PLAN_PRD_PROTOTYPE_ENGLISH_TEXT_REQUIRED: task: ENGLISH_TEXT_NON_ENGLISH_CODE_POINT\n");
      assert.equal(result.stderr.includes(task), false);
    }
  });

  it("rejects non-English project names before publication", () => {
    const projectName = `Preference ${String.fromCodePoint(0x03a9)}`;
    const result = runPrototype(["--project-name", projectName]);

    assert.equal(result.status, 64);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "PLAN_PRD_PROTOTYPE_ENGLISH_TEXT_REQUIRED: project-name: ENGLISH_TEXT_NON_ENGLISH_CODE_POINT\n");
  });

  it("rejects high-signal ASCII localized text and accepts English typography", () => {
    const localizedTask = String.fromCharCode(
      71, 117, 97, 114, 100, 97, 114, 32, 99, 97, 109, 98, 105, 111, 115,
    );
    const rejected = runPrototype(["--task", localizedTask]);
    assert.equal(rejected.status, 64);
    assert.equal(rejected.stdout, "");
    assert.equal(
      rejected.stderr,
      "PLAN_PRD_PROTOTYPE_ENGLISH_TEXT_REQUIRED: task: ENGLISH_TEXT_UNSUPPORTED_LEXEME\n",
    );

    const englishTask = `Build the planner${String.fromCodePoint(0x2019)}s compact status view.`;
    const accepted = runPrototype(["--task", englishTask]);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stdout, /^UI_LANGUAGE: English$/m);
  });
});
