import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeRunContextForUpdate } from "../dist/installer/repo.js";

describe("run context merge", () => {
  it("does not let blank optional defaults erase existing command context", () => {
    const merged = mergeRunContextForUpdate(
      { build_cmd: "npm run build", test_cmd: "npm run test:run", repo: "/tmp/app" },
      { build_cmd: "", test_cmd: "", lint_cmd: "", repo: "/tmp/app2" },
    );

    assert.equal(merged.build_cmd, "npm run build");
    assert.equal(merged.test_cmd, "npm run test:run");
    assert.equal(merged.lint_cmd, "");
    assert.equal(merged.repo, "/tmp/app2");
  });
});
