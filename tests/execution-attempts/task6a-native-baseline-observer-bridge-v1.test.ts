import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

// Executes actual bridge source against explicitly MODELED producer/dispatcher
// ports. Promise/receiver/argument fidelity is real; no PG/native authority.
const bridge = fileURLToPath(new URL("./task6a-native-baseline-observer-bridge-v1.ts", import.meta.url));
const routes = [
  ["ACCESS", "contract-spine-runtime-access-readonly-verifier-v1", "verifyContractSpineRuntimeAccessInTransactionReadOnlyV1"],
  ["BASE", "base-schema-readonly-verifier-v1", "verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1"],
  ["OWNER", "public-object-owner-readonly-verifier-v1", "verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1"],
] as const;
const fixtureKey = "task6a-baseline-bridge-modeled-unit-ports-v1";
const fixtureExpression = `globalThis[Symbol.for(${JSON.stringify(fixtureKey)})]`;
const prior = routes.map(([, owner, name]) => `export { ${name} } from "../../src/db/${owner}.js";`).join("\n");
const compiled = await esbuild.build({
  stdin: { contents: fs.existsSync(bridge) ? fs.readFileSync(bridge, "utf8") : prior,
    sourcefile: bridge, resolveDir: fileURLToPath(new URL("./", import.meta.url)), loader: "ts" },
  bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent",
  plugins: [{ name: "explicit-modeled-unit-ports", setup(build) {
    build.onResolve({ filter: /./ }, args => {
      if (routes.some(([, owner]) => args.path === `../../src/db/${owner}.js`)
        || args.path === "./task6a-native-closed-probe-entry.js") return { path: args.path, namespace: "modeled-unit" };
      throw Error("UNNOMINATED_UNIT_BRIDGE_IMPORT");
    });
    build.onLoad({ filter: /./, namespace: "modeled-unit" }, args => {
      const route = routes.find(([, owner]) => args.path === `../../src/db/${owner}.js`);
      return { contents: route
        ? `export function ${route[2]}(...args) { return Reflect.apply(${fixtureExpression}.producer, this, args); }`
        : `export function observeTask6aNativeBaselineOriginalV1(...args) { ${fixtureExpression}.observe(...args); }`, loader: "js" };
    });
  } }],
});
type Wrapper = (this: unknown, ...args: unknown[]) => Promise<void>;
const module: Record<string, Wrapper> = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles![0]!.contents).toString("base64")}`);
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };

for (const [role, , name] of routes) {
  for (const outcome of ["fulfilled", "rejected"] as const) {
    test(`modeled ${role} ${outcome} producer keeps SAME Promise/receiver/full arguments`, async () => {
      const receiver = {}, transaction = {}, extra = {};
      const args = role === "OWNER" ? [transaction, "setfarm_owner", extra] : [transaction, extra];
      const original = outcome === "fulfilled" ? Promise.resolve() : Promise.reject<void>(undefined);
      const settled = original.then(() => "fulfilled", error => { assert.equal(error, undefined); return "rejected"; });
      const observations: unknown[][] = [], calls: unknown[][] = [];
      globals[Symbol.for(fixtureKey)] = {
        producer(this: unknown, ...actual: unknown[]) { calls.push([this, ...actual]); return original; },
        observe(...actual: unknown[]) { observations.push(actual); },
      };
      try {
        assert.equal(Reflect.apply(module[name]!, receiver, args), original);
        assert.deepEqual(calls, [[receiver, ...args]]);
        assert.equal(calls[0]![0], receiver); assert.equal(calls[0]![1], transaction);
        assert.equal(calls[0]!.at(-1), extra);
        assert.equal(observations.length, 1, "same original must be enrolled, not silent no-op");
        assert.equal(observations[0]![0], role); assert.equal(observations[0]![1], original);
        assert.equal(observations[0]![2], transaction);
        assert.equal(observations[0]![3], role === "OWNER" ? "setfarm_owner" : undefined);
        assert.equal(await settled, outcome);
      } finally { await settled; delete globals[Symbol.for(fixtureKey)]; }
    });
  }
  test(`modeled ${role} synchronous producer throw is propagated without false enrollment`, () => {
    let observed = 0;
    globals[Symbol.for(fixtureKey)] = { producer() { throw undefined; }, observe() { observed++; } };
    let threw = false;
    try {
      try { Reflect.apply(module[name]!, {}, [{}]); } catch (error) { threw = true; assert.equal(error, undefined); }
      assert.equal(threw, true); assert.equal(observed, 0);
    } finally { delete globals[Symbol.for(fixtureKey)]; }
  });
}
