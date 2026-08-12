import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CandidateRuntimeBundleAuthorityV2,
  CandidateRuntimeBundleErrorV2,
  destroyCandidateRuntimeBundleV2,
  materializeCandidateRuntimeBundleV2ForTest,
  verifyCandidateRuntimeBundleV2ForTest,
} from "../../src/execution/candidate-runtime-bundle-v2.js";

test("candidate runtime operational boundary rejects forged and hostile input", async () => {
  assert.throws(
    () => new CandidateRuntimeBundleAuthorityV2({}, {} as never),
    (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
      && error.code
        === "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
  );

  await assert.rejects(
    materializeCandidateRuntimeBundleV2ForTest({
      buildAuthority: {},
      callerReceipt: {},
    }),
    (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
      && error.code === "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID",
  );

  await assert.rejects(
    materializeCandidateRuntimeBundleV2ForTest({ buildAuthority: {} }),
    (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
      && error.code === "CANDIDATE_RUNTIME_BUNDLE_V2_BUILD_REJECTED",
  );

  let accessorInvoked = false;
  const accessor = Object.defineProperty({}, "buildAuthority", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      throw new Error("runtime input accessor must not run");
    },
  });
  await assert.rejects(
    materializeCandidateRuntimeBundleV2ForTest(accessor),
    (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
      && error.code === "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID",
  );
  assert.equal(accessorInvoked, false);

  let proxyInvoked = false;
  const proxy = new Proxy({}, {
    get() {
      proxyInvoked = true;
      throw new Error("runtime input proxy must not run");
    },
  });
  await assert.rejects(
    materializeCandidateRuntimeBundleV2ForTest(proxy),
    (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
      && error.code === "CANDIDATE_RUNTIME_BUNDLE_V2_INPUT_INVALID",
  );
  assert.equal(proxyInvoked, false);

  const forged = Object.create(
    CandidateRuntimeBundleAuthorityV2.prototype,
  ) as CandidateRuntimeBundleAuthorityV2;
  await assert.rejects(
    verifyCandidateRuntimeBundleV2ForTest({
      runtimeAuthority: forged,
      expectedBundleHash: "f".repeat(64),
    }),
    (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
      && error.code
        === "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
  );
  assert.throws(
    () => destroyCandidateRuntimeBundleV2(forged),
    (error: unknown) => error instanceof CandidateRuntimeBundleErrorV2
      && error.code
        === "CANDIDATE_RUNTIME_BUNDLE_V2_AUTHORITY_UNAUTHENTICATED",
  );
});
