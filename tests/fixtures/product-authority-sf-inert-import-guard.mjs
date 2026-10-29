import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

// Only these two otherwise-unused configuration exports may be represented.
// Both throw on EVERY call. No configuration or authority value is fabricated.
const marker = Symbol.for("setfarm.pba.sf-inert-import-guard.v1");
const definitions = [
  {
    key: "runtime-config",
    source: "../../src/runtime-config",
    exportName: "resolveArtifactStorePublicationAuthorityMode",
  },
  {
    key: "fresh-installation-selection-v1",
    source: "../../src/installation/fresh-installation-selection-v1",
    exportName: "selectedFreshInstallationRootV1",
  },
];
const virtualPrefix = "setfarm-pba-sf-inert:";
const exactPaths = new Map();
const virtualModules = new Map();
const calls = Object.seal({ resolveArtifactStorePublicationAuthorityMode: 0, selectedFreshInstallationRootV1: 0 });
const loads = Object.seal({ "runtime-config": 0, "fresh-installation-selection-v1": 0 });
for (const definition of definitions) {
  const virtualURL = `${virtualPrefix}${definition.key}`;
  for (const extension of ["ts", "js"]) {
    const realURL = new URL(`${definition.source}.${extension}`, import.meta.url);
    exactPaths.set(fileURLToPath(realURL), virtualURL);
  }
  // Fixed source generated only from the two literal definitions above.
  const source = `export function ${definition.exportName}() {
    const state = globalThis[Symbol.for("setfarm.pba.sf-inert-import-guard.v1")];
    state.calls[${JSON.stringify(definition.exportName)}] += 1;
    const error = new Error("PBA_SF_TEST_UNUSED_CONFIGURATION_BOUNDARY");
    error.code = "PBA_SF_TEST_UNUSED_CONFIGURATION_BOUNDARY";
    error.boundary = ${JSON.stringify(definition.exportName)};
    error.moduleURL = import.meta.url;
    throw error;
  }`;
  virtualModules.set(virtualURL, Object.freeze({ key: definition.key, exportName: definition.exportName, source }));
}
function inertURL(url) {
  return url.startsWith("file:") ? exactPaths.get(fileURLToPath(url)) : undefined;
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (virtualModules.has(specifier)) return { url: specifier, shortCircuit: true };
    // Intercept exact .js and .ts requests before real resolution/tsx can load
    // an eager body. No source/env/installation record is opened by this hook.
    let requested;
    if (specifier.startsWith("file:")) requested = specifier;
    else if (context.parentURL?.startsWith("file:") && (specifier.startsWith(".") || specifier.startsWith("/"))) {
      requested = new URL(specifier, context.parentURL).href;
    }
    const direct = requested && inertURL(requested);
    if (direct) return { url: direct, shortCircuit: true };
    const result = nextResolve(specifier, context);
    const resolved = inertURL(result.url);
    return resolved ? { url: resolved, shortCircuit: true } : result;
  },
  load(url, context, nextLoad) {
    const definition = virtualModules.get(url);
    if (definition) {
      loads[definition.key] += 1;
      return { format: "module", source: definition.source, shortCircuit: true };
    }
    if (inertURL(url) || url.startsWith(virtualPrefix)) {
      const error = new Error("PBA_SF_TEST_CONFIGURATION_RESOLUTION_ESCAPE");
      error.code = "PBA_SF_TEST_CONFIGURATION_RESOLUTION_ESCAPE";
      throw error;
    }
    return nextLoad(url, context);
  },
});
globalThis[marker] = Object.freeze({
  active: true,
  schema: "setfarm.pba.sf-inert-import-guard.v1",
  calls,
  loads,
  virtualURLs: Object.freeze({
    "runtime-config": `${virtualPrefix}runtime-config`,
    "fresh-installation-selection-v1": `${virtualPrefix}fresh-installation-selection-v1`,
  }),
});
