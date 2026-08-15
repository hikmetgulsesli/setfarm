import assert from "node:assert/strict";
import { access, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureStitchProjectIdentityV2 } from "../../src/installer/steps/02-design/runtime-v2.js";
import { resolvePlatformScript } from "../../src/installer/paths.js";

test("bootstraps Stitch identity from an existing cwd when the generated repo is absent", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "setfarm-design-bootstrap-"));
  const repo = path.join(root, "missing", "generated-repo");
  try {
    await assert.rejects(access(repo));

    const projectId = await ensureStitchProjectIdentityV2({
      repo,
      projectName: "Status Utility",
    }, {
      executeStitch: async (input) => {
        assert.equal(input.cwd, path.dirname(resolvePlatformScript("stitch-api.mjs")));
        assert.equal((await stat(input.cwd)).isDirectory(), true);
        await assert.rejects(access(repo));
        assert.deepEqual(input.args, ["ensure-project-identity", "Status Utility", repo]);
        return JSON.stringify({
          schema: "setfarm.stitch-project-identity.v1",
          projectId: "project-123",
          name: "Status Utility",
          source: "created",
        });
      },
    });

    assert.equal(projectId, "project-123");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
