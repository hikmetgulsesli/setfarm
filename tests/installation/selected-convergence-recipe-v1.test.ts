/** Pure recipe DATA only. Import must not load a genuine selected facade. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
let api: typeof import('../../src/installation/selected-convergence-recipe-v1.js') | undefined;
let selectedImports = 0;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('selected-convergence-recipe-v1') && /fresh-installation-(?:v3-profile|selection|entry)-v1\.[jt]s$/.test(specifier)) {
    selectedImports++; throw new Error('PURE_RECIPE_SELECTED_IMPORT_FORBIDDEN');
  }
  return next(specifier, context);
} });
try { api = await import('../../src/installation/selected-convergence-recipe-v1.js'); }
catch (error) {
  const missing = error as { code?: unknown; url?: unknown };
  const urls = ['.js', '.ts'].map(ext => new URL('../../src/installation/selected-convergence-recipe-v1' + ext, import.meta.url).href);
  if (missing.code !== 'ERR_MODULE_NOT_FOUND' || !urls.includes(missing.url as string)) throw error;
} finally { hooks.deregister(); }
const codexPath = 'evals/suites/product-convergence-codex-v1.json';
const annualPath = 'evals/suites/product-convergence-minimax-m31-flash-v1.json';
const kimiPath = 'evals/suites/product-convergence-kimi-k31-pro-v1.json';
const codex = { schema: 'setfarm.model-execution-profile.v1', providerId: 'codex', modelId: 'codex/gpt-6.1-sol', selection: 'primary' };
const annual = { ...codex, providerId: 'minimax', modelId: 'minimax/MiniMax-M3.1-Flash' };
const catalogue = [{ fixedSuiteRelativePath: codexPath, suiteHash: 'a'.repeat(64) },
  { fixedSuiteRelativePath: annualPath, suiteHash: 'b'.repeat(64) }];

test('pure selected convergence recipe capability is import-inert and genuine capture takes no arguments', () => {
  assert.equal(typeof api?.projectSelectedConvergenceRecipeV1, 'function', 'shared selected convergence recipe capability missing');
  assert.equal(typeof api!.resolveFixedConvergenceSuitePathV1, 'function');
  assert.equal(typeof api!.captureSelectedConvergenceRecipeV1, 'function');
  assert.equal(api!.captureSelectedConvergenceRecipeV1.length, 0);
  assert.deepEqual(api!.FIXED_CONVERGENCE_SUITE_PATHS_V1, [codexPath, annualPath, kimiPath]);
  assert.equal(selectedImports, 0);
});

test('pure selected convergence recipe retains Codex and maps exact annual primary without a Codex model or key', () => {
  assert.ok(api);
  const regular = api.projectSelectedConvergenceRecipeV1(codex);
  assert.deepEqual(regular, { fixedSuiteRelativePath: codexPath, executionProfile: codex,
    workerEnv: { SETFARM_AGENT_RUNTIME: 'codex', SETFARM_CODEX_MODEL: 'gpt-6.1-sol' } });
  const subscription = api.projectSelectedConvergenceRecipeV1(annual);
  assert.deepEqual(subscription, { fixedSuiteRelativePath: annualPath, executionProfile: annual,
    workerEnv: { SETFARM_AGENT_RUNTIME: 'subscription' } });
  assert.notEqual(subscription.executionProfile, annual);
  assert.ok(Object.isFrozen(subscription)); assert.ok(Object.isFrozen(subscription.executionProfile)); assert.ok(Object.isFrozen(subscription.workerEnv));
});

test('pure selected convergence recipe refuses fallback, foreign models and extra profile authority', () => {
  assert.ok(api);
  for (const profile of [null, [], { ...annual, selection: 'fallback' }, { ...annual, providerId: 'kimi', modelId: 'kimi/other' },
    { ...annual, modelId: 'minimax/other' }, { ...annual, modelId: 'codex/gpt-6.1-sol' }, { ...codex, modelId: 'codex/invalid model' },
    { ...codex, providerId: 'gateway' }, { ...annual, approved: true }, { ...annual, credential: 'inert-test-value' }]) {
    assert.throws(() => api!.projectSelectedConvergenceRecipeV1(profile));
  }
});

test('pure selected convergence recipe refuses getters and proxies without invoking caller code', () => {
  assert.ok(api); let calls = 0;
  const trap = () => { calls++; throw new Error('INERT_PROFILE_TRAP'); };
  for (const profile of [Object.defineProperty({ ...annual }, 'providerId', { get: trap }),
    new Proxy({ ...annual }, { get: trap, ownKeys: trap, getPrototypeOf: trap })]) {
    assert.throws(() => api!.projectSelectedConvergenceRecipeV1(profile));
  }
  assert.equal(calls, 0);
});

test('historical fixed recipe resolution follows persisted suite hash including old Codex-only catalogues', () => {
  assert.ok(api);
  assert.equal(api.resolveFixedConvergenceSuitePathV1('a'.repeat(64), catalogue), codexPath);
  assert.equal(api.resolveFixedConvergenceSuitePathV1('b'.repeat(64), catalogue), annualPath);
  assert.equal(api.resolveFixedConvergenceSuitePathV1('a'.repeat(64), [catalogue[0]]), codexPath);
  assert.equal(api.resolveFixedConvergenceSuitePathV1('b'.repeat(64), [catalogue[1]]), annualPath);
});

test('historical fixed recipe resolution refuses unknown hashes, ambiguous material and caller-selected paths', () => {
  assert.ok(api);
  for (const [hash, entries] of [
    ['c'.repeat(64), catalogue], ['not-a-hash', catalogue], ['a'.repeat(64), []],
    ['a'.repeat(64), [catalogue[0], catalogue[0]]],
    ['a'.repeat(64), [catalogue[0], { ...catalogue[1], suiteHash: 'a'.repeat(64) }]],
    ['a'.repeat(64), [{ ...catalogue[0], fixedSuiteRelativePath: '../suite.json' }]],
    ['a'.repeat(64), [{ ...catalogue[0], fixedSuiteRelativePath: 'evals/suites/custom.json' }]],
    ['a'.repeat(64), [{ ...catalogue[0], approved: true }]],
  ] as const) assert.throws(() => api!.resolveFixedConvergenceSuitePathV1(hash, entries));
});

test('Kimi primary fixed recipe carries exact selector env and resolves among three pinned historical suites', () => {
  assert.ok(api);
  const profile = { ...annual, providerId: 'kimi', modelId: 'kimi/k3.1-pro' };
  assert.deepEqual(api.projectSelectedConvergenceRecipeV1(profile), {
    fixedSuiteRelativePath: kimiPath, executionProfile: profile,
    workerEnv: { SETFARM_AGENT_RUNTIME: 'subscription', SETFARM_SUBSCRIPTION_PRIMARY_MODEL: 'kimi/k3.1-pro' },
  });
  const all = [...catalogue, { fixedSuiteRelativePath: kimiPath, suiteHash: 'c'.repeat(64) }];
  assert.equal(api.resolveFixedConvergenceSuitePathV1('c'.repeat(64), all), kimiPath);
  assert.equal(api.resolveFixedConvergenceSuitePathV1('a'.repeat(64), all), codexPath);
  assert.equal(api.resolveFixedConvergenceSuitePathV1('b'.repeat(64), all), annualPath);
  assert.throws(() => api!.resolveFixedConvergenceSuitePathV1('c'.repeat(64), [...all, all[2]]));
  assert.throws(() => api!.resolveFixedConvergenceSuitePathV1('c'.repeat(64), [all[0], { ...all[1], suiteHash: 'c'.repeat(64) }, all[2]]));
});
