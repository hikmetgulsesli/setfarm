import assert from "node:assert/strict";
import test from "node:test";

const marker = Symbol.for("setfarm.pba.sf-inert-import-guard.v1");
test("PBA SF isolation: exact inert modules and any-call rejection before real evaluation", async (t) => {
  const state = Reflect.get(globalThis, marker);
  assert.equal(state?.active, true, "Required SF pre-import guard must be active");
  assert.equal(state.schema, "setfarm.pba.sf-inert-import-guard.v1");
  assert.deepEqual(state.calls, { resolveArtifactStorePublicationAuthorityMode: 0, selectedFreshInstallationRootV1: 0 }, "Deliberate probes begin in their own test process");
  assert.deepEqual(state.loads, { "runtime-config": 0, "fresh-installation-selection-v1": 0 });
  const boundaries = [
    { path: "../src/runtime-config", key: "runtime-config", exportName: "resolveArtifactStorePublicationAuthorityMode" },
    { path: "../src/installation/fresh-installation-selection-v1", key: "fresh-installation-selection-v1", exportName: "selectedFreshInstallationRootV1" },
  ];
  for (const boundary of boundaries) {
    for (const extension of ["ts", "js"]) {
      await t.test(`${boundary.path}.${extension} resolves only to the exact throwing virtual export`, async () => {
        const target = new URL(`${boundary.path}.${extension}`, import.meta.url).href;
        const namespace = await import(target);
        assert.deepEqual(Object.keys(namespace), [boundary.exportName], "No extra configuration/guard exports may be fabricated");
        assert.equal(typeof namespace[boundary.exportName], "function");
        assert.equal(state.loads[boundary.key], 1, "Both source aliases resolve to one loaded inert module");
        const prior = state.calls[boundary.exportName];
        for (const args of [[], ["unexpected"], [{ unexpected: true }]]) {
          assert.throws(() => Reflect.apply(namespace[boundary.exportName], undefined, args), (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.equal(Reflect.get(error, "code"), "PBA_SF_TEST_UNUSED_CONFIGURATION_BOUNDARY");
            assert.equal(error.message, "PBA_SF_TEST_UNUSED_CONFIGURATION_BOUNDARY");
            assert.equal(Reflect.get(error, "boundary"), boundary.exportName);
            assert.equal(Reflect.get(error, "moduleURL"), state.virtualURLs[boundary.key], "Real source URL must never evaluate");
            return true;
          });
        }
        assert.equal(state.calls[boundary.exportName], prior + 3, "Every deliberate call is counted and rejected");
      });
    }
  }
  assert.deepEqual(state.calls, { resolveArtifactStorePublicationAuthorityMode: 6, selectedFreshInstallationRootV1: 6 }, "Only this separate isolation process makes deliberate calls");
});
