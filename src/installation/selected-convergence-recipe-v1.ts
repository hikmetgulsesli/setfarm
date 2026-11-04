import { types } from 'node:util';
import type { ModelExecutionProfileV1 } from '../execution/operational-retry-directive.js';

export const FIXED_CONVERGENCE_SUITE_PATHS_V1 = Object.freeze([
  'evals/suites/product-convergence-codex-v1.json',
  'evals/suites/product-convergence-minimax-m31-flash-v1.json',
] as const);
export type FixedConvergenceSuitePathV1 = typeof FIXED_CONVERGENCE_SUITE_PATHS_V1[number];
export type SelectedConvergenceRecipeDataV1 = Readonly<{
  fixedSuiteRelativePath: FixedConvergenceSuitePathV1;
  executionProfile: ModelExecutionProfileV1;
  workerEnv: Readonly<{ SETFARM_AGENT_RUNTIME: 'codex' | 'subscription'; SETFARM_CODEX_MODEL?: string }>;
}>;
export type SelectedConvergenceRecipeV1 = SelectedConvergenceRecipeDataV1 & Readonly<{ assertUnchanged(): void }>;
function refuse(): never { throw new Error('SELECTED_CONVERGENCE_RECIPE_REFUSED'); }
function own(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) refuse();
  const out: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key]; if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse();
    out[key] = descriptor.value;
  }
  return out;
}
/** Pure fixed projection. No installation, environment, credential or startup authority. */
export function projectSelectedConvergenceRecipeV1(input: unknown): SelectedConvergenceRecipeDataV1 {
  const profile = own(input, ['schema', 'providerId', 'modelId', 'selection']);
  if (profile.schema !== 'setfarm.model-execution-profile.v1' || profile.selection !== 'primary') refuse();
  let fixedSuiteRelativePath: FixedConvergenceSuitePathV1;
  let workerEnv: SelectedConvergenceRecipeDataV1['workerEnv'];
  if (profile.providerId === 'minimax' && profile.modelId === 'minimax/MiniMax-M3.1-Flash') {
    fixedSuiteRelativePath = FIXED_CONVERGENCE_SUITE_PATHS_V1[1];
    workerEnv = Object.freeze({ SETFARM_AGENT_RUNTIME: 'subscription' });
  } else if (profile.providerId === 'codex' && typeof profile.modelId === 'string'
    && profile.modelId.startsWith('codex/') && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,193}$/.test(profile.modelId.slice(6))) {
    fixedSuiteRelativePath = FIXED_CONVERGENCE_SUITE_PATHS_V1[0];
    workerEnv = Object.freeze({ SETFARM_AGENT_RUNTIME: 'codex', SETFARM_CODEX_MODEL: profile.modelId.slice(6) });
  } else return refuse();
  return Object.freeze({ fixedSuiteRelativePath, executionProfile: Object.freeze({
    schema: 'setfarm.model-execution-profile.v1', providerId: profile.providerId as string,
    modelId: profile.modelId as string, selection: 'primary',
  }), workerEnv });
}
/** Resolve persisted suite identity from at most the two fixed pinned candidates.
 * A missing nonmatching historical recipe need not replace an old Codex release. */
export function resolveFixedConvergenceSuitePathV1(suiteHash: unknown, input: unknown): FixedConvergenceSuitePathV1 {
  if (typeof suiteHash !== 'string' || !/^[a-f0-9]{64}$/.test(suiteHash)
    || !Array.isArray(input) || types.isProxy(input) || input.length < 1 || input.length > 2) refuse();
  const ds = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(ds).length !== input.length + 1) refuse();
  const paths = new Set<unknown>(), matches: FixedConvergenceSuitePathV1[] = [];
  for (let index = 0; index < input.length; index++) {
    const descriptor = ds[String(index)]; if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse();
    const candidate = own(descriptor.value, ['fixedSuiteRelativePath', 'suiteHash']);
    if (!FIXED_CONVERGENCE_SUITE_PATHS_V1.includes(candidate.fixedSuiteRelativePath as FixedConvergenceSuitePathV1)
      || paths.has(candidate.fixedSuiteRelativePath) || typeof candidate.suiteHash !== 'string'
      || !/^[a-f0-9]{64}$/.test(candidate.suiteHash)) refuse();
    paths.add(candidate.fixedSuiteRelativePath);
    if (candidate.suiteHash === suiteHash) matches.push(candidate.fixedSuiteRelativePath as FixedConvergenceSuitePathV1);
  }
  if (matches.length !== 1) refuse();
  return matches[0];
}
/** Genuine selected capture is lazy: importing the pure module performs no
 * selected installation/profile read. The returned synchronous guard never
 * adopts a later environment, selected profile, Source or installation. */
export async function captureSelectedConvergenceRecipeV1(): Promise<SelectedConvergenceRecipeV1> {
  if (arguments.length) refuse();
  const selected = await import('./fresh-installation-v3-profile-v1.js');
  const recipe = projectSelectedConvergenceRecipeV1(selected.readSelectedFreshExecutionProfileV1('primary'));
  const assertUnchanged = () => {
    selected.assertSelectedFreshExecutionProfileUnchangedV1();
    const current = projectSelectedConvergenceRecipeV1(selected.readSelectedFreshExecutionProfileV1('primary'));
    if (JSON.stringify(current) !== JSON.stringify(recipe)) refuse();
  };
  assertUnchanged(); return Object.freeze({ ...recipe, assertUnchanged });
}
