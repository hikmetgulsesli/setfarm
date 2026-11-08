import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { SubscriptionAttemptBrokerV1, SubscriptionAttemptBrokerStopV1,
  SubscriptionAttemptBrokerReceiptV1 } from './subscription-attempt-broker-v1.js';
import type { SubscriptionAttemptIdentityV1 } from './subscription-attempt-launch-material-v1.js';
import { SubscriptionCodingWorkerStartupErrorV1, type SubscriptionCodingOwnedWorkerV1, type SubscriptionCodingPartialOwnedWorkerV1,
  type SubscriptionCodingWorkerOutputV1 } from './subscription-coding-worker-v1.js';
import { buildSubscriptionCodingMaterialV1, SUBSCRIPTION_CODING_LIMITS_V1,
  type SubscriptionCodingMaterialV1 } from './subscription-coding-policy-v1.js';
import { narrowSubscriptionCodingWorkerMaterialV1, type SubscriptionCodingWriteGrantV1 } from './subscription-coding-worker-policy-v1.js';
import { createSubscriptionRuntimeAttachmentV1, isSubscriptionRuntimeCanonicalPathV1,
  parseSubscriptionRuntimeAuthorityV1, parseSubscriptionRuntimeBindingV1, parseSubscriptionRuntimeWorkerBindingV1,
  readSubscriptionRuntimeAttachmentV1, type SubscriptionRuntimeAttachmentV1,
  type SubscriptionRuntimeAuthorityV1, type SubscriptionRuntimeBindingV1, type SubscriptionRuntimeClosureV1,
  type SubscriptionRuntimeWorkerBindingV1 } from './subscription-runtime-attachment-v1.js';
export type { SubscriptionRuntimeBindingV1, SubscriptionRuntimeClosureV1 } from './subscription-runtime-attachment-v1.js';

const LIFETIME_MS = 1_800_000;
const OBSERVATION_MS = 2_500;
const PUBLICATION_MS = 1_000;
export type SubscriptionCodingRuntimeInputV1 = Readonly<{
  binding: SubscriptionRuntimeBindingV1; root: string; runtimePath: string; prompt: string;
  requestProfile?: 'plan-report-v1';
  transcriptPath: string; signal: AbortSignal; authorityRoots: readonly string[];
  writeGrants: readonly SubscriptionCodingWriteGrantV1[]; readOnlyControlPaths: readonly string[];
}>;
/** An owned acquisition boundary, not a selected-entry/startup admission API.
 * The genuine production caller supplies its fixed operations after real claim,
 * selected-entry and Source guards. Direct mechanics tests cannot create entry. */
export type SubscriptionCodingRuntimeAcquisitionV1 = Readonly<{
  deriveAuthority(input: SubscriptionCodingRuntimeInputV1): Promise<SubscriptionRuntimeAuthorityV1>;
  acquireBroker(input: Readonly<{
    identity: SubscriptionAttemptIdentityV1; limits: typeof SUBSCRIPTION_CODING_LIMITS_V1; signal: AbortSignal;
  }>): Promise<SubscriptionAttemptBrokerV1>;
  launchWorker(input: Readonly<{
    material: SubscriptionCodingMaterialV1; transcriptPath: string; authorityRoots: readonly string[];
    writeGrants: readonly SubscriptionCodingWriteGrantV1[]; readOnlyControlPaths: readonly string[];
  }>): Promise<SubscriptionCodingOwnedWorkerV1>;
}>;
export type SubscriptionCodingRuntimeOwnershipV1 = Readonly<{
  readonly broker: SubscriptionAttemptBrokerV1 | undefined;
  readonly worker: SubscriptionCodingPartialOwnedWorkerV1 | undefined;
  closed: Promise<SubscriptionRuntimeClosureV1>;
  close(reason: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionRuntimeClosureV1>;
}>;
export type SubscriptionCodingRuntimeV1 = Readonly<{
  worker: SubscriptionCodingOwnedWorkerV1; attachmentHash: string;
  /** Called by the real spawner only after its fenced markRunning succeeds. */
  openGate(): void;
  closed: Promise<SubscriptionRuntimeClosureV1>;
  close(reason: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionRuntimeClosureV1>;
}>;
export class SubscriptionCodingRuntimeStartupErrorV1 extends Error {
  declare readonly ownership: SubscriptionCodingRuntimeOwnershipV1;
  constructor(ownership: SubscriptionCodingRuntimeOwnershipV1) {
    super('SUBSCRIPTION_CODING_RUNTIME_REFUSED');
    Object.defineProperty(this, 'ownership', { value: ownership, enumerable: false, writable: false, configurable: false });
  }
}
function refuse(): never { throw new Error('SUBSCRIPTION_CODING_RUNTIME_REFUSED'); }
function record(value: unknown, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length < keys.length || actual.length > keys.length + optional.length
    || actual.some(key => typeof key !== 'string' || (!keys.includes(key) && !optional.includes(key)))) refuse();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of [...keys, ...optional]) { const d = descriptors[key]; if (!d && optional.includes(key)) continue;
    if (!d || !Object.hasOwn(d, 'value')) refuse(); result[key] = d.value; }
  return result;
}
function paths(value: unknown): readonly string[] {
  if (!Array.isArray(value) || types.isProxy(value) || value.length > 256) refuse();
  const ds = Object.getOwnPropertyDescriptors(value), output: string[] = [];
  for (let index = 0; index < value.length; index++) {
    const d = ds[String(index)]; if (!d || !Object.hasOwn(d, 'value') || !isSubscriptionRuntimeCanonicalPathV1(d.value)) refuse();
    output.push(d.value);
  }
  if (new Set(output).size !== output.length) refuse(); return Object.freeze(output);
}
function validReason(value: unknown): value is SubscriptionAttemptBrokerStopV1 {
  return value === 'completed' || value === 'owner-abort' || value === 'deadline' || value === 'refused';
}
function nativePromise(value: unknown): value is Promise<unknown> { return value instanceof Promise && !types.isProxy(value); }
function reason(value: unknown): SubscriptionAttemptBrokerStopV1 { return validReason(value) ? value : 'refused'; }
function identityFor(binding: SubscriptionRuntimeBindingV1): SubscriptionAttemptIdentityV1 {
  // Stage transport labels identify actual claim/runtime. They assert neither
  // execution_attempt existence nor execution generation/fence authority.
  return Object.freeze(binding.kind === 'execution-attempt'
    ? { attemptId: binding.attemptId, generationId: `generation-${binding.generation}`, modelRef: binding.modelRef }
    : { attemptId: `stage-claim-${binding.claimId}`, generationId: 'stage-runtime-' + createHash('sha256').update(binding.runtimeSessionId).digest('hex'), modelRef: binding.modelRef });
}
function sameIdentity(a: SubscriptionAttemptIdentityV1, b: SubscriptionAttemptIdentityV1): boolean {
  const v = record(b, ['attemptId', 'generationId', 'modelRef']);
  return a.attemptId === v.attemptId && a.generationId === v.generationId && a.modelRef === v.modelRef;
}
function inputData(value: SubscriptionCodingRuntimeInputV1): SubscriptionCodingRuntimeInputV1 {
  const v = record(value, ['binding', 'root', 'runtimePath', 'prompt', 'transcriptPath', 'signal', 'authorityRoots', 'writeGrants', 'readOnlyControlPaths'], ['requestProfile']);
  if (Object.hasOwn(v, 'requestProfile') && v.requestProfile !== 'plan-report-v1') refuse();
  const binding = parseSubscriptionRuntimeBindingV1(v.binding);
  if (![v.root, v.runtimePath, v.transcriptPath].every(isSubscriptionRuntimeCanonicalPathV1)
    || typeof v.prompt !== 'string' || v.prompt.includes('\0') || !Buffer.byteLength(v.prompt)
    || Buffer.byteLength(v.prompt) > 65536 || !(v.signal instanceof AbortSignal) || types.isProxy(v.signal)) refuse();
  Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!.call(v.signal);
  const root = v.root as string, runtimePath = v.runtimePath as string, transcriptPath = v.transcriptPath as string;
  const overlaps = (a: string, b: string) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
  if (overlaps(root, binding.worktree) || overlaps(root, runtimePath) || overlaps(root, transcriptPath)
    || overlaps(runtimePath, binding.worktree) || overlaps(runtimePath, transcriptPath)) refuse();
  // Scope is validated again by the actual deterministic worker projection.
  // Capture detached data now so later caller mutation cannot widen authority.
  const scope = structuredScope(v.writeGrants, v.readOnlyControlPaths);
  return Object.freeze({ binding, root, runtimePath, transcriptPath, prompt: v.prompt, signal: v.signal as AbortSignal,
    ...(v.requestProfile === 'plan-report-v1' ? { requestProfile: 'plan-report-v1' as const } : {}),
    authorityRoots: paths(v.authorityRoots), ...scope });
}
function structuredScope(grants: unknown, controls: unknown): Readonly<{
  writeGrants: readonly SubscriptionCodingWriteGrantV1[]; readOnlyControlPaths: readonly string[];
}> {
  if (!Array.isArray(grants) || types.isProxy(grants) || grants.length > 256) refuse();
  const ds = Object.getOwnPropertyDescriptors(grants), copy: SubscriptionCodingWriteGrantV1[] = [];
  for (let index = 0; index < grants.length; index++) {
    const d = ds[String(index)]; if (!d || !Object.hasOwn(d, 'value')) refuse();
    const grant = record(d.value, ['path', 'kind']);
    if (!isSubscriptionRuntimeCanonicalPathV1(grant.path) || (grant.kind !== 'file' && grant.kind !== 'directory')) refuse();
    copy.push(Object.freeze({ path: grant.path, kind: grant.kind }));
  }
  return Object.freeze({ writeGrants: Object.freeze(copy), readOnlyControlPaths: paths(controls) });
}
function receipt(value: unknown): SubscriptionAttemptBrokerReceiptV1 {
  const v = record(value, ['status', 'reason', 'acceptedRequests', 'responseBytes', 'redactions', 'terminalCode']);
  if ((v.status !== 'closed' && v.status !== 'custody-uncertain') || !validReason(v.reason)
    || ![v.acceptedRequests, v.responseBytes, v.redactions].every(n => Number.isSafeInteger(n) && (n as number) >= 0)
    || !(v.terminalCode === null || (typeof v.terminalCode === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v.terminalCode)))) refuse();
  return v as SubscriptionAttemptBrokerReceiptV1;
}
function originalWorkerStatus(value: unknown): 'closed' | 'custody-uncertain' {
  const v = record(value, ['status']); if (v.status !== 'closed' && v.status !== 'custody-uncertain') refuse(); return v.status;
}
function outputClosed(value: SubscriptionCodingWorkerOutputV1, bound: SubscriptionRuntimeWorkerBindingV1): boolean {
  const v = record(value, ['stdout', 'stderr', 'stdoutBytes', 'stderrBytes', 'stdoutTruncated', 'stderrTruncated',
    'exitCode', 'signal', 'processClosed', 'stdoutEnded', 'stderrEnded', 'stdoutClosed', 'stderrClosed', 'streamError', 'proofHash', 'isolationHash', 'materialHash']);
  return ['processClosed', 'stdoutEnded', 'stderrEnded', 'stdoutClosed', 'stderrClosed'].every(key => v[key] === true)
    && v.streamError === false && v.proofHash === bound.isolation.proofHash
    && v.materialHash === bound.isolation.materialHash && v.isolationHash === bound.isolation.isolationHash;
}

/** Pure custody mechanics plus owned journal writes. The physical module is
 * import-inert: only its real startup-error class is consumed here, never its
 * launcher. No selected/credential/database module is imported or provider/SDK/OS
 * operation invoked. Only a genuine facade may connect this port to startup. */
export async function acquireSubscriptionCodingRuntimeV1(
  rawInput: SubscriptionCodingRuntimeInputV1, acquisition: SubscriptionCodingRuntimeAcquisitionV1,
): Promise<SubscriptionCodingRuntimeV1> {
  let input: SubscriptionCodingRuntimeInputV1, authority: SubscriptionRuntimeAuthorityV1, journal: SubscriptionRuntimeAttachmentV1;
  try {
    input = inputData(rawInput);
    const ports = record(acquisition, ['deriveAuthority', 'acquireBroker', 'launchWorker']);
    if (!Object.values(ports).every(fn => typeof fn === 'function') || input.signal.aborted) refuse();
    authority = parseSubscriptionRuntimeAuthorityV1(await acquisition.deriveAuthority(input), input.binding);
    if (input.signal.aborted) refuse();
    journal = createSubscriptionRuntimeAttachmentV1({ runtimePath: input.runtimePath, binding: input.binding, authority });
    const replay = readSubscriptionRuntimeAttachmentV1({ runtimePath: input.runtimePath, binding: input.binding });
    if (replay.phase !== 'prepared') refuse();
  } catch { refuse(); }
  const identity = identityFor(input.binding);
  let broker: SubscriptionAttemptBrokerV1 | undefined, worker: SubscriptionCodingPartialOwnedWorkerV1 | undefined;
  let bound: SubscriptionRuntimeWorkerBindingV1 | undefined;
  let brokerState: 'pending' | 'closed' | 'custody-uncertain' = 'pending';
  let originalState: 'pending' | 'closed' | 'custody-uncertain' = 'pending';
  let outputState: 'pending' | 'closed' | 'custody-uncertain' = 'pending';
  let brokerStopped = false, workerStopped = false, stopping = false, fault = false, publishing = false, finished = false;
  let startupComplete = false, gateOpened = false, workerValidated = false;
  let stopReason: SubscriptionAttemptBrokerStopV1 = 'refused';
  let lifetime: ReturnType<typeof setTimeout> | undefined, observation: ReturnType<typeof setTimeout> | undefined;
  let publication: ReturnType<typeof setTimeout> | undefined;
  let resolveClosed!: (value: SubscriptionRuntimeClosureV1) => void;
  const closed = new Promise<SubscriptionRuntimeClosureV1>(yes => { resolveClosed = yes; });
  const consume = <T>(promise: Promise<T>, yes: (v: T) => void, no: () => void) => {
    if (!nativePromise(promise)) { no(); return; }
    void Promise.prototype.then.call(promise, (value: T) => { try { yes(value); } catch { no(); } }, no).catch(() => { fault = true; });
  };
  const latch = () => { fault = true; };
  const detach = () => {
    if (lifetime !== undefined) clearTimeout(lifetime);
    input.signal.removeEventListener('abort', abort);
  };
  function finish(value: SubscriptionRuntimeClosureV1): void {
    if (finished) return; finished = true; detach();
    if (observation !== undefined) clearTimeout(observation);
    if (publication !== undefined) clearTimeout(publication);
    resolveClosed(value);
  }
  function result(): SubscriptionRuntimeClosureV1 {
    const workerClosed = workerValidated && originalState === 'closed' && outputState === 'closed';
    const brokerClosed = brokerState === 'closed';
    return Object.freeze({ binding: input.binding, attachmentHash: journal.attachmentHash,
      status: !fault && brokerClosed && workerClosed ? 'closed' : 'custody-uncertain',
      broker: brokerClosed ? 'closed' : 'custody-uncertain', worker: workerClosed ? 'closed' : 'custody-uncertain',
      evidenceRefs: Object.freeze([...(brokerClosed ? ['original-broker'] : []), ...(workerClosed ? ['original-process-and-streams'] : [])]),
    });
  }
  function publish(): void {
    if (publishing || finished) return; publishing = true;
    if (observation !== undefined) clearTimeout(observation);
    const value = result();
    const uncertain = () => finish(Object.freeze({ ...value, status: 'custody-uncertain' }));
    publication = setTimeout(uncertain, PUBLICATION_MS);
    try {
      consume(journal.publishClosed(value), () => finish(fault ? Object.freeze({ ...value, status: 'custody-uncertain' }) : value), uncertain);
    } catch { uncertain(); }
  }
  function ready(): void {
    if (!stopping || publishing || finished || brokerState === 'pending' || originalState === 'pending' || outputState === 'pending') return;
    // Stop rejections already queued on native promises latch before publication.
    void Promise.resolve().then(() => { if (!finished) publish(); });
  }
  function stopKnown(): void {
    // Revocation is synchronous at invocation in the real broker. Never await
    // stop acknowledgement before requesting the worker stop or originals.
    if (broker && !brokerStopped) {
      brokerStopped = true;
      try { consume(broker.stop(stopReason), () => {}, latch); } catch { latch(); }
    }
    if (worker && !workerStopped) {
      workerStopped = true;
      try { consume(worker.stop(stopReason), () => {}, latch); } catch { latch(); }
    }
  }
  function close(why: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionRuntimeClosureV1> {
    if (!stopping) {
      stopping = true; stopReason = reason(why); detach();
      observation = setTimeout(() => { latch(); publish(); }, OBSERVATION_MS);
    }
    stopKnown(); ready(); return closed;
  }
  function abort(): void { close('owner-abort'); }
  const ownership: SubscriptionCodingRuntimeOwnershipV1 = Object.freeze({
    get broker() { return broker; }, get worker() { return worker; }, closed, close,
  });
  input.signal.addEventListener('abort', abort, { once: true });
  lifetime = setTimeout(() => close('deadline'), LIFETIME_MS);
  if (input.signal.aborted) close('owner-abort');
  function retainBroker(value: SubscriptionAttemptBrokerV1): void {
    broker = value; // Before inspecting a fallible member or starting another await.
    if (stopping) stopKnown();
    try {
      if (!value || typeof value.stop !== 'function' || !nativePromise(value.closed)) refuse();
      consume(value.closed, outcome => {
        try {
          const r = receipt(outcome);
          if (r.terminalCode !== null) {
            // Retain only validated scalar mechanics; a diagnostic sink cannot
            // interfere with the original broker/worker closure path.
            try { console.warn('[subscription-runtime] SUBSCRIPTION_BROKER_TERMINAL ' + JSON.stringify({
              runtimeSessionId: input.binding.runtimeSessionId, claimId: input.binding.claimId,
              modelRef: input.binding.modelRef, reason: r.reason, terminalCode: r.terminalCode,
              acceptedRequests: r.acceptedRequests, responseBytes: r.responseBytes, redactions: r.redactions,
            })); } catch { /* Diagnostics are not closure authority. */ }
          }
          brokerState = r.status; if (r.status !== 'closed') latch(); close(r.reason);
        }
        catch { brokerState = 'custody-uncertain'; latch(); close('refused'); }
        ready();
      }, () => { brokerState = 'custody-uncertain'; latch(); close('refused'); ready(); });
    } catch { brokerState = 'custody-uncertain'; latch(); close('refused'); }
  }
  function retainWorker(value: SubscriptionCodingPartialOwnedWorkerV1): void {
    worker = value; // Preserve partial and even malformed returned ownership.
    if (stopping) stopKnown();
    try {
      if (!value || typeof value.stop !== 'function') refuse();
      if (value.originalClosed) consume(value.originalClosed, outcome => {
        try { originalState = originalWorkerStatus(outcome); if (originalState !== 'closed') latch(); }
        catch { originalState = 'custody-uncertain'; latch(); }
        close(originalState === 'closed' ? 'completed' : 'refused'); ready();
      }, () => { originalState = 'custody-uncertain'; latch(); close('refused'); ready(); });
      else { originalState = 'custody-uncertain'; latch(); }
      consume(value.output, outcome => {
        outputState = bound && outputClosed(outcome, bound) ? 'closed' : 'custody-uncertain';
        if (outputState !== 'closed') latch(); close(outputState === 'closed' ? 'completed' : 'refused'); ready();
      }, () => { outputState = 'custody-uncertain'; latch(); close('refused'); ready(); });
      // Summary uncertain is a real fault, but summary closed never releases the
      // pending original child/process/stream promises.
      consume(value.closed, outcome => {
        try { if (originalWorkerStatus(outcome) !== 'closed') { latch(); close('refused'); } }
        catch { latch(); close('refused'); }
      }, () => { latch(); close('refused'); });
    } catch { originalState = 'custody-uncertain'; outputState = 'custody-uncertain'; latch(); close('refused'); }
    ready();
  }
  function retainRejectedWorker(error: unknown): void {
    if (worker || types.isProxy(error) || !(error instanceof SubscriptionCodingWorkerStartupErrorV1)) return;
    // This is connected only to the worker acquisition boundary. Broker or
    // arbitrary upstream errors can never be interpreted as child ownership.
    const d = Object.getOwnPropertyDescriptor(error, 'ownership');
    if (d && Object.hasOwn(d, 'value') && d.enumerable === false && d.writable === false
      && d.configurable === false && d.value) retainWorker(d.value as SubscriptionCodingPartialOwnedWorkerV1);
  }
  async function duringAcquisition<T>(pending: Promise<T>, retain: (value: T) => void,
    retainRejection?: (error: unknown) => void): Promise<T> {
    // Both retention continuations attach before racing any shutdown promise.
    // They survive timeout/refusal and own a later successful OR partial result.
    const acquired = Promise.resolve(pending).then(value => { retain(value); return value; }, error => {
      retainRejection?.(error); throw error;
    });
    return Promise.race([acquired, closed.then(() => { throw new SubscriptionCodingRuntimeStartupErrorV1(ownership); })]);
  }
  try {
    if (stopping) refuse();
    const acquiredBroker = await duringAcquisition(acquisition.acquireBroker({ identity, limits: SUBSCRIPTION_CODING_LIMITS_V1, signal: input.signal }), retainBroker);
    // The launch builder immediately below validates all ten broker-worker
    // fields, including the exact three-field identity projection.
    if (stopping) refuse();
    const material = buildSubscriptionCodingMaterialV1({ identity, worker: acquiredBroker.worker,
      root: input.root, prompt: input.prompt, worktree: input.binding.worktree,
      ...(input.requestProfile ? { requestProfile: input.requestProfile } : {}) });
    const effective = narrowSubscriptionCodingWorkerMaterialV1({ material, writeGrants: input.writeGrants, readOnlyControlPaths: input.readOnlyControlPaths });
    const authorityRoots = Object.freeze([...new Set([...input.authorityRoots, input.runtimePath])]);
    let acquiredWorker: SubscriptionCodingOwnedWorkerV1;
    try {
      acquiredWorker = await duringAcquisition(acquisition.launchWorker({ material, transcriptPath: input.transcriptPath,
        authorityRoots, writeGrants: effective.writeGrants, readOnlyControlPaths: effective.readOnlyControlPaths }), retainWorker, retainRejectedWorker);
    } catch (error) {
      // Also covers a synchronous launch throw before a promise was returned.
      retainRejectedWorker(error);
      throw error;
    }
    if (stopping || !sameIdentity(identity, acquiredWorker.identity)) refuse();
    bound = parseSubscriptionRuntimeWorkerBindingV1({ processIdentity: acquiredWorker.processIdentity,
      brokerPort: effective.brokerPort, isolation: acquiredWorker.isolation }, authority);
    if (bound.isolation.materialHash !== effective.materialHash || acquiredWorker.isolationHash !== bound.isolation.isolationHash
      || !nativePromise(acquiredWorker.originalClosed) || typeof acquiredWorker.openGate !== 'function') refuse();
    workerValidated = true;
    await journal.bindWorker(bound);
    if (stopping || typeof acquiredWorker.waitForOwnerAdmission !== 'function') refuse();
    const pendingWait = acquiredWorker.waitForOwnerAdmission();
    if (!nativePromise(pendingWait)) refuse();
    await Promise.race([pendingWait, closed.then(() => { throw new SubscriptionCodingRuntimeStartupErrorV1(ownership); })]);
    if (stopping) refuse();
    startupComplete = true;
    return Object.freeze({ worker: acquiredWorker, attachmentHash: journal.attachmentHash, close, closed,
      openGate() {
        // A safely refused late/duplicate call creates no new custody fault.
        if (!startupComplete || stopping || finished || gateOpened) refuse();
        try {
          const persisted = readSubscriptionRuntimeAttachmentV1({ runtimePath: input.runtimePath, binding: input.binding });
          if (persisted.phase !== 'worker-bound' || persisted.attachmentHash !== journal.attachmentHash
            || JSON.stringify(persisted.worker) !== JSON.stringify(bound)) refuse();
          acquiredWorker.openGate(); gateOpened = true;
        } catch { latch(); close('refused'); refuse(); }
      },
    });
  } catch {
    latch(); close('refused');
    // Failure returns retained ownership promptly; cleanup remains independently
    // bounded and its original handles remain accessible even after uncertainty.
    throw new SubscriptionCodingRuntimeStartupErrorV1(ownership);
  }
}
