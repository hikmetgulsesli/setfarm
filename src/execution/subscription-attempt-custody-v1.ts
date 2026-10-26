import type { SubscriptionAttemptBrokerV1, SubscriptionAttemptBrokerStopV1 } from './subscription-attempt-broker-v1.js';
import type { SubscriptionAttemptIdentityV1 } from './subscription-attempt-launch-material-v1.js';

export const SUBSCRIPTION_CUSTODY_LIFETIME_MS_V1 = 20_000;
export const SUBSCRIPTION_CUSTODY_DRAIN_MS_V1 = 2_500;
export const SUBSCRIPTION_CUSTODY_PUBLICATION_MS_V1 = 1_000;
export type SubscriptionWorkerClosureV1 = Readonly<{ status: 'closed' | 'custody-uncertain' }>;
export type SubscriptionOwnedWorkerV1 = Readonly<{
  identity: SubscriptionAttemptIdentityV1; closed: Promise<SubscriptionWorkerClosureV1>;
  stop(reason: SubscriptionAttemptBrokerStopV1): Promise<void>;
}>;
export type SubscriptionJointResourceStateV1 = 'pending' | 'closed' | 'custody-uncertain' | 'invalid';
export type SubscriptionJointFaultV1 = 'none' | 'broker-stop' | 'worker-stop' | 'broker-closure' | 'worker-closure' | 'drain-timeout';
export type SubscriptionAttemptClosureObservationV1 = Readonly<{
  schema: 'setfarm.subscription-attempt-closure-observation.v1'; runtimeSessionId: string;
  identity: SubscriptionAttemptIdentityV1; reason: SubscriptionAttemptBrokerStopV1;
  broker: SubscriptionJointResourceStateV1; worker: SubscriptionJointResourceStateV1; fault: SubscriptionJointFaultV1;
}>;
export type SubscriptionAttemptCustodyResultV1 = Readonly<{
  schema: 'setfarm.subscription-attempt-custody-result.v1'; observation: SubscriptionAttemptClosureObservationV1;
  publication: 'published' | 'failed' | 'timed-out'; fault: SubscriptionJointFaultV1; status: 'closed' | 'custody-uncertain';
}>;
export type SubscriptionAttemptCustodyInputV1 = Readonly<{
  runtimeSessionId: string; identity: SubscriptionAttemptIdentityV1; broker: SubscriptionAttemptBrokerV1;
  worker: SubscriptionOwnedWorkerV1; signal: AbortSignal;
  publish(observation: SubscriptionAttemptClosureObservationV1): Promise<void>;
}>;
export type SubscriptionAttemptCustodyV1 = Readonly<{
  close(reason: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionAttemptCustodyResultV1>;
  closed: Promise<SubscriptionAttemptCustodyResultV1>;
}>;
function invalid(): never { throw new Error('SUBSCRIPTION_CUSTODY_INPUT_INVALID'); }
function data(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object') invalid();
  const proto = Object.getPrototypeOf(value); if (proto !== Object.prototype && proto !== null) invalid();
  const ds = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(ds);
  if (actual.length !== keys.length || actual.some(k => typeof k !== 'string' || !keys.includes(k))) invalid();
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const d = ds[key]; if (!d || !Object.hasOwn(d, 'value')) invalid(); copy[key] = d.value; }
  return copy;
}
function safeId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function identityData(value: unknown): SubscriptionAttemptIdentityV1 {
  const i = data(value, ['attemptId', 'generationId', 'modelRef']);
  if (!safeId(i.attemptId) || !safeId(i.generationId) || (i.modelRef !== 'kimi/k3.1-pro' && i.modelRef !== 'minimax/MiniMax-M3.1-Flash')) invalid();
  return Object.freeze({ attemptId: i.attemptId, generationId: i.generationId, modelRef: i.modelRef });
}
function matches(a: SubscriptionAttemptIdentityV1, b: Record<string, unknown> | SubscriptionAttemptIdentityV1): boolean {
  return a.attemptId === b.attemptId && a.generationId === b.generationId && a.modelRef === b.modelRef;
}
function validReason(value: unknown): value is SubscriptionAttemptBrokerStopV1 {
  return value === 'completed' || value === 'owner-abort' || value === 'deadline' || value === 'refused';
}
function status(value: unknown): value is SubscriptionWorkerClosureV1['status'] { return value === 'closed' || value === 'custody-uncertain'; }
function nativePromise(value: unknown): value is Promise<unknown> { return value instanceof Promise; }

/** Cooperative in-memory parent custody only; no launch or durable absence authority. */
export function ownSubscriptionAttemptCustodyV1(input: SubscriptionAttemptCustodyInputV1): SubscriptionAttemptCustodyV1 {
  let rollback: (() => void) | undefined;
  try {
    const v = data(input, ['runtimeSessionId', 'identity', 'broker', 'worker', 'signal', 'publish']);
    if (!safeId(v.runtimeSessionId)) invalid();
    const runtimeSessionId = v.runtimeSessionId, identity = identityData(v.identity);
    const brokerObject = v.broker, workerObject = v.worker;
    const b = data(brokerObject, ['worker', 'stop', 'closed']), w = data(workerObject, ['identity', 'stop', 'closed']);
    if (!matches(identity, identityData(w.identity))) invalid();
    const binding = data(b.worker, ['attemptId', 'generationId', 'modelRef', 'providerId', 'modelId', 'baseUrl', 'api', 'apiKey', 'auth', 'authHeader']);
    const kimi = identity.modelRef === 'kimi/k3.1-pro';
    if (!matches(identity, binding) || binding.providerId !== (kimi ? 'kimi' : 'minimax')
      || binding.modelId !== (kimi ? 'k3.1-pro' : 'MiniMax-M3.1-Flash') || binding.api !== 'anthropic-messages'
      || binding.auth !== 'api-key' || binding.authHeader !== true || typeof binding.apiKey !== 'string'
      || !/^[A-Za-z0-9_-]{43}$/.test(binding.apiKey) || typeof binding.baseUrl !== 'string') invalid();
    const port = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/v1$/.exec(binding.baseUrl)?.[1];
    if (!port || Number(port) > 65535 || [3080, 3333, 18789].includes(Number(port)) || new URL(binding.baseUrl).href !== binding.baseUrl) invalid();
    if (typeof b.stop !== 'function' || typeof w.stop !== 'function' || typeof v.publish !== 'function'
      || !nativePromise(b.closed) || !nativePromise(w.closed) || !(v.signal instanceof AbortSignal)) invalid();
    const brokerClosed = b.closed, workerClosed = w.closed, brokerStop = b.stop, workerStop = w.stop, publish = v.publish;
    const signal = v.signal;
    const aborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!;
    aborted.call(signal); // Native brand check before any ownership side effect.
    const addAbort = signal.addEventListener, removeAbort = signal.removeEventListener;
    if (typeof addAbort !== 'function' || typeof removeAbort !== 'function') invalid();
    const then = Promise.prototype.then;
    let acquisition: 'pending' | 'committed' | 'abandoned' = 'pending';
    let shutdown = false, finalizing = false, finished = false, readyQueued = false, listener = false;
    let reason: SubscriptionAttemptBrokerStopV1 = 'refused', fault: SubscriptionJointFaultV1 = 'none';
    let broker: SubscriptionJointResourceStateV1 = 'pending', worker: SubscriptionJointResourceStateV1 = 'pending';
    let lifetimeTimer: ReturnType<typeof setTimeout> | undefined, drainTimer: ReturnType<typeof setTimeout> | undefined;
    let publicationTimer: ReturnType<typeof setTimeout> | undefined;
    let resolveResult!: (result: SubscriptionAttemptCustodyResultV1) => void;
    const closed = new Promise<SubscriptionAttemptCustodyResultV1>(resolve => { resolveResult = resolve; });
    const latch = (next: SubscriptionJointFaultV1) => { if (!finished && fault === 'none') fault = next; };
    const detach = () => {
      if (lifetimeTimer !== undefined) clearTimeout(lifetimeTimer);
      lifetimeTimer = undefined;
      if (listener) { listener = false; try { removeAbort.call(signal, 'abort', ownerAbort); } catch { /* no new ownership is claimed */ } }
    };
    const consume = (promise: unknown, yes: (value: unknown) => void, no: () => void) => {
      if (!nativePromise(promise)) throw new Error('INVALID_PROMISE');
      const chain = then.call(promise, yes, no);
      then.call(chain, undefined, () => {});
    };
    function finish(observation: SubscriptionAttemptClosureObservationV1, publication: SubscriptionAttemptCustodyResultV1['publication']): void {
      if (finished) return;
      finished = true; detach();
      if (drainTimer !== undefined) clearTimeout(drainTimer);
      if (publicationTimer !== undefined) clearTimeout(publicationTimer);
      resolveResult(Object.freeze({ schema: 'setfarm.subscription-attempt-custody-result.v1', observation, publication, fault,
        status: observation.broker === 'closed' && observation.worker === 'closed' && fault === 'none' && publication === 'published' ? 'closed' : 'custody-uncertain' }));
    }
    function observe(): void {
      if (finalizing || finished || acquisition !== 'committed') return;
      finalizing = true;
      if (drainTimer !== undefined) clearTimeout(drainTimer);
      const observation: SubscriptionAttemptClosureObservationV1 = Object.freeze({ schema: 'setfarm.subscription-attempt-closure-observation.v1',
        runtimeSessionId, identity, reason, broker, worker, fault });
      publicationTimer = setTimeout(() => finish(observation, 'timed-out'), SUBSCRIPTION_CUSTODY_PUBLICATION_MS_V1);
      try { consume(Reflect.apply(publish, input, [observation]), () => finish(observation, 'published'), () => finish(observation, 'failed')); }
      catch { finish(observation, 'failed'); }
    }
    function ready(): void {
      if (!shutdown || finalizing || finished || readyQueued || broker === 'pending' || worker === 'pending') return;
      readyQueued = true;
      // Stop requests have already run; let settled acknowledgment rejections latch first.
      void Promise.resolve().then(() => { readyQueued = false; observe(); });
    }
    function request(stop: Function, original: unknown, stopFault: SubscriptionJointFaultV1): void {
      try { consume(Reflect.apply(stop, original, [reason]), () => {}, () => latch(stopFault)); }
      catch { latch(stopFault); }
    }
    function close(why: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionAttemptCustodyResultV1> {
      if (acquisition !== 'committed' || shutdown) return closed;
      shutdown = true; reason = validReason(why) ? why : 'refused'; detach();
      drainTimer = setTimeout(() => { if (broker === 'pending' || worker === 'pending') latch('drain-timeout'); observe(); }, SUBSCRIPTION_CUSTODY_DRAIN_MS_V1);
      request(brokerStop, brokerObject, 'broker-stop');
      request(workerStop, workerObject, 'worker-stop');
      ready(); return closed;
    }
    function ownerAbort(): void { if (acquisition === 'committed') close('owner-abort'); }
    function brokerOutcome(value: unknown, rejected = false): void {
      if (acquisition !== 'committed' || finalizing || finished) return;
      let trigger: SubscriptionAttemptBrokerStopV1 = 'refused';
      try {
        if (rejected) invalid();
        const r = data(value, ['status', 'reason', 'acceptedRequests', 'responseBytes', 'redactions', 'terminalCode']);
        if (!status(r.status) || !validReason(r.reason)
          || [r.acceptedRequests, r.responseBytes, r.redactions].some(n => typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0)
          || !(r.terminalCode === null || (typeof r.terminalCode === 'string' && r.terminalCode.length <= 128))) invalid();
        broker = r.status; if (broker === 'closed') trigger = r.reason;
      } catch { broker = 'invalid'; latch('broker-closure'); }
      close(trigger); ready();
    }
    function workerOutcome(value: unknown, rejected = false): void {
      if (acquisition !== 'committed' || finalizing || finished) return;
      try { if (rejected) invalid(); const r = data(value, ['status']); if (!status(r.status)) invalid(); worker = r.status; }
      catch { worker = 'invalid'; latch('worker-closure'); }
      close(worker === 'closed' ? 'completed' : 'refused'); ready();
    }
    rollback = () => { acquisition = 'abandoned'; detach(); if (drainTimer !== undefined) clearTimeout(drainTimer); };
    consume(brokerClosed, value => brokerOutcome(value), () => brokerOutcome(undefined, true));
    consume(workerClosed, value => workerOutcome(value), () => workerOutcome(undefined, true));
    // Set the rollback marker before registration, including callbacks that throw after registration.
    listener = true; addAbort.call(signal, 'abort', ownerAbort, { once: true });
    lifetimeTimer = setTimeout(() => { if (acquisition === 'committed') close('deadline'); }, SUBSCRIPTION_CUSTODY_LIFETIME_MS_V1);
    acquisition = 'committed';
    if (aborted.call(signal)) close('owner-abort');
    return Object.freeze({ close, closed });
  } catch { rollback?.(); invalid(); }
}
