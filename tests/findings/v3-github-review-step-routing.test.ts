import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function source(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("v3 GitHub review step routing boundary", () => {
  it("routes exact evidence before reviewer spawn and leaves prose classification legacy-only", () => {
    const stepOps = source("src/installer/step-ops.ts");
    const delayStart = stepOps.indexOf("// PR REVIEW DELAY GATE:");
    const delayEnd = stepOps.indexOf("// Default optional template vars", delayStart);
    assert.ok(delayStart >= 0 && delayEnd > delayStart);
    const delay = stepOps.slice(delayStart, delayEnd);

    const exactRoute = delay.indexOf("routeExactV3GithubReviewBeforeVerifyAgent");
    const legacyBranch = delay.indexOf("runProtocol?.protocol !== \"v3\"");
    const proseDetector = delay.indexOf("detectOpenPrReviewCommentFailure", legacyBranch);
    assert.ok(exactRoute >= 0, "v3 exact evidence router must run in verify preclaim");
    assert.ok(legacyBranch > exactRoute, "legacy review path must be selected after the v3 exact route");
    assert.ok(proseDetector > legacyBranch, "prose detector must be guarded by a non-v3 protocol branch");
    assert.match(delay, /V3_GITHUB_REVIEW_EVIDENCE_UNAVAILABLE/);
    assert.match(delay, /return \{ found: false \};/);
  });

  it("does not fast-forward v3 implementation from mechanically interpreted comment prose", () => {
    const stepOps = source("src/installer/step-ops.ts");
    const call = stepOps.indexOf("await fastForwardMechanicallySatisfiedPrReviewRetry(step, nextStory, context)");
    assert.ok(call >= 0);
    const guard = stepOps.lastIndexOf("runProtocol?.protocol !== \"v3\"", call);
    assert.ok(guard >= 0 && call - guard < 250, "mechanical review fast-forward must be legacy/shadow only");
  });

  it("re-reads exact threads before merge and defers typed recovery to the next claim", () => {
    const stepOps = source("src/installer/step-ops.ts");
    const completionStart = stepOps.indexOf("async function handleVerifyEachCompletion(");
    const completionEnd = stepOps.indexOf("// ── Auto-verify helper", completionStart);
    assert.ok(completionStart >= 0 && completionEnd > completionStart);
    const completion = stepOps.slice(completionStart, completionEnd);
    const exactRead = completion.indexOf("readDefaultGithubReview");
    const merge = completion.indexOf("tryAutoMergePR", exactRead);
    assert.ok(exactRead >= 0, "v3 completion must re-read exact GitHub thread state");
    assert.ok(merge > exactRead, "exact review read must precede merge");
    assert.match(completion, /exactReview\.actionableThreads\.length > 0[\s\S]*setStepStatus\(verifyStep\.id, \"pending\"\)/);
  });

  it("keeps formatted comment prose out of v3 verify module context", () => {
    const context = source("src/installer/steps/07-verify/context.ts");
    assert.match(
      context,
      /ctx\.claimEnvelope\?\.protocol !== \"v3\"[\s\S]*formatPrCommentsForAgent\(state\)/,
    );
    assert.match(context, /V3 PR operational state injected without comment prose/);
  });
});
