import assert from 'node:assert/strict';
import test from 'node:test';
import { ownSubscriptionAttemptCustodyV1 as own } from '../../src/execution/subscription-attempt-custody-v1.js';
import type { SubscriptionWorkerClosureV1, SubscriptionAttemptClosureObservationV1 } from '../../src/execution/subscription-attempt-custody-v1.js';
import { startSubscriptionAttemptBrokerForTestV1 } from '../../src/execution/subscription-attempt-broker-v1.js';
import type { SubscriptionAttemptBrokerReceiptV1, SubscriptionAttemptBrokerV1, SubscriptionAttemptBrokerWorkerV1 } from '../../src/execution/subscription-attempt-broker-v1.js';
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes,no) => { resolve=yes; reject=no; }); return { promise,resolve,reject };
}
const receipt = (): SubscriptionAttemptBrokerReceiptV1 => ({ status:'closed', reason:'completed', acceptedRequests:0,
  responseBytes:0, redactions:0, terminalCode:null });
function fixture() {
  const identity = { attemptId:'ATT_fixture_1', generationId:'generation_1', modelRef:'kimi/k3.1-pro' as const };
  const binding: SubscriptionAttemptBrokerWorkerV1 = { ...identity, providerId:'kimi', modelId:'k3.1-pro',
    baseUrl:'http://127.0.0.1:49157/v1', api:'anthropic-messages', apiKey:'A'.repeat(43), auth:'api-key', authHeader:true };
  const brokerDone=deferred<SubscriptionAttemptBrokerReceiptV1>(), workerDone=deferred<SubscriptionWorkerClosureV1>();
  const events:string[]=[], observations:SubscriptionAttemptClosureObservationV1[]=[];
  const broker:SubscriptionAttemptBrokerV1 = { worker:binding,closed:brokerDone.promise,
    stop() { events.push('broker-stop'); return Promise.resolve(receipt()); } };
  const worker = { identity,closed:workerDone.promise,stop() { events.push('worker-stop'); return Promise.resolve(); } };
  const controller=new AbortController();
  const input={ runtimeSessionId:'session_1',identity,broker,worker,signal:controller.signal,
    publish(value:SubscriptionAttemptClosureObservationV1):Promise<void> { observations.push(value); events.push('publish'); return Promise.resolve(); } };
  const settle=()=> { brokerDone.resolve(receipt()); workerDone.resolve({ status:'closed' }); };
  return { input,events,observations,brokerDone,workerDone,controller,settle };
}
const flush=async()=>{ for(let i=0;i<12;i++) await Promise.resolve(); };
function frozen(value:unknown):void { if(value && typeof value==='object') {
  assert.ok(Object.isFrozen(value)); for(const child of Object.values(value)) frozen(child);
} }
test('stop acknowledgments cannot replace original custody and every close joins the original result',async()=>{
  const f=fixture(), owned=own(f.input), first=owned.close('completed');
  assert.equal(first,owned.closed); assert.equal(owned.close('owner-abort'),first);
  assert.deepEqual(f.events,['broker-stop','worker-stop']); let settled=false;
  void first.then(()=>{settled=true;}); await flush(); assert.equal(settled,false); assert.equal(f.observations.length,0);
  f.workerDone.resolve({ status:'closed' }); await flush(); assert.equal(settled,false);
  f.brokerDone.resolve(receipt()); const result=await first;
  assert.equal(result.status,'closed'); assert.equal(result.fault,'none'); assert.equal(result.publication,'published');
  assert.equal(result.observation.reason,'completed'); assert.equal(f.observations.length,1); frozen(result);
});
for(const source of ['worker','broker','abort','pre-abort'] as const) test(`original ${source} initiates shutdown with first reason`,async()=>{
  const f=fixture(); if(source==='pre-abort') f.controller.abort('synthetic-secret');
  const owned=own(f.input);
  if(source==='worker') f.workerDone.resolve({status:'closed'});
  if(source==='broker') f.brokerDone.resolve({...receipt(),reason:'deadline'});
  if(source==='abort') f.controller.abort('synthetic-secret');
  await flush(); assert.deepEqual(f.events,['broker-stop','worker-stop']);
  assert.equal(owned.close('refused'),owned.closed); f.settle(); const r=await owned.closed;
  assert.equal(r.observation.reason,source.includes('abort')?'owner-abort':source==='broker'?'deadline':'completed');
  assert.equal(r.status,'closed');
});
test('captured functions, original promises, this and identity survive caller mutation',async()=>{
  const f=fixture(); let brokerThis:unknown,workerThis:unknown;
  f.input.broker.stop=function(){brokerThis=this;return Promise.resolve(receipt());};
  f.input.worker.stop=function(){workerThis=this;return Promise.resolve();};
  Object.defineProperty(f.brokerDone.promise,'then',{value(){throw Error('must use intrinsic');}});
  Object.defineProperty(f.workerDone.promise,'then',{value(){throw Error('must use intrinsic');}});
  const owned=own(f.input);
  f.input.identity.attemptId='changed'; f.input.worker.identity.generationId='changed';
  f.input.broker.stop=()=>{throw Error('late lookup');}; f.input.worker.stop=()=>{throw Error('late lookup');};
  f.input.broker.closed=Promise.resolve({...receipt(),status:'custody-uncertain'});
  owned.close('completed'); f.settle(); const r=await owned.closed;
  assert.equal(brokerThis,f.input.broker); assert.equal(workerThis,f.input.worker);
  assert.deepEqual(r.observation.identity,{attemptId:'ATT_fixture_1',generationId:'generation_1',modelRef:'kimi/k3.1-pro'});
  assert.equal(r.status,'closed');
});
test('captured callbacks ignore later own call accessors and preserve original this and order',async()=>{
  const f=fixture(); let lookups=0;
  f.input.broker.stop=function(){assert.equal(this,f.input.broker);f.events.push('broker-stop');return Promise.resolve(receipt());};
  f.input.worker.stop=function(){assert.equal(this,f.input.worker);f.events.push('worker-stop');return Promise.resolve();};
  f.input.publish=function(value){assert.equal(this,f.input);f.observations.push(value);f.events.push('publish');return Promise.resolve();};
  const callbacks=[f.input.broker.stop,f.input.worker.stop,f.input.publish], o=own(f.input);
  for(const callback of callbacks) Object.defineProperty(callback,'call',{get(){lookups++;throw Error('SYNTHETIC_CALL_ACCESSOR');}});
  const resultPromise=o.close('completed'); f.settle(); const result=await resultPromise;
  assert.deepEqual(f.events,['broker-stop','worker-stop','publish']); assert.equal(lookups,0);
  assert.equal(result.status,'closed'); assert.equal(result.fault,'none');
});
test('constructor rejects exact-shape violations with no stop or publication effects',async()=>{
  let getterCalls=0;
  const cases:((f:ReturnType<typeof fixture>)=>unknown)[]=[
    ()=>null, f=>({...f.input,extra:true}), f=>({...f.input,runtimeSessionId:'bad/id'}),
    f=>({...f.input,identity:{...f.input.identity,modelRef:'other'}}), f=>({...f.input,identity:{...f.input.identity,extra:1}}),
    f=>({...f.input,worker:{...f.input.worker,identity:{...f.input.identity,generationId:'other'}}}),
    f=>({...f.input,broker:{...f.input.broker,worker:{...f.input.broker.worker,apiKey:'bad'}}}),
    f=>({...f.input,broker:{...f.input.broker,worker:{...f.input.broker.worker,baseUrl:'http://localhost:49157/v1'}}}),
    f=>({...f.input,broker:{...f.input.broker,extra:1}}), f=>({...f.input,worker:{...f.input.worker,stop:1}}),
    f=>({...f.input,broker:{...f.input.broker,closed:{then(){}}}}), f=>({...f.input,worker:{...f.input.worker,closed:Promise.prototype}}),
    f=>({...f.input,signal:{aborted:false,addEventListener(){}}}), f=>({...f.input,publish:1}),
    f=>Object.assign({...f.input},{[Symbol('extra')]:true}),
    f=>Object.defineProperty({...f.input},'publish',{get(){getterCalls++;throw Error('secret');}}),
    ()=>new Proxy({},{getPrototypeOf(){throw Error('secret');}}),
  ];
  const revoked=Proxy.revocable({},{}); revoked.revoke(); cases.push(()=>revoked.proxy);
  for(const bad of cases) { const f=fixture(); assert.throws(()=>own(bad(f) as never),{message:'SUBSCRIPTION_CUSTODY_INPUT_INVALID'});
    await flush(); assert.deepEqual(f.events,[]); f.settle(); }
  assert.equal(getterCalls,0);
});
test('partial acquisition consumes queued first original without cleanup when second intrinsic subscription fails',async()=>{
  const f=fixture(); f.brokerDone.resolve(receipt());
  class BrokenPromise extends Promise<SubscriptionWorkerClosureV1> {
    static get [Symbol.species]():PromiseConstructor { throw Error('synthetic-secret'); }
  }
  f.input.worker.closed=new BrokenPromise(resolve=>resolve({status:'closed'}));
  assert.throws(()=>own(f.input),{message:'SUBSCRIPTION_CUSTODY_INPUT_INVALID'});
  await flush(); assert.deepEqual(f.events,[]); assert.equal(f.observations.length,0);
});
test('abort during registration is rechecked after acquisition commits',async()=>{
  const f=fixture(), add=f.input.signal.addEventListener;
  f.input.signal.addEventListener=function(...args:Parameters<AbortSignal['addEventListener']>) {
    add.apply(this,args); f.controller.abort('synthetic-secret');
  };
  const o=own(f.input); assert.deepEqual(f.events,['broker-stop','worker-stop']);
  f.settle(); assert.equal((await o.closed).observation.reason,'owner-abort');
});
test('registration failure abandons queued outcomes and removes its lifetime effects',async t=>{
  t.mock.timers.enable({apis:['setTimeout']}); const f=fixture(),add=f.input.signal.addEventListener;
  f.brokerDone.resolve(receipt());
  f.input.signal.addEventListener=function(...args:Parameters<AbortSignal['addEventListener']>) {
    add.apply(this,args); throw Error('synthetic-registration-secret');
  };
  assert.throws(()=>own(f.input),{message:'SUBSCRIPTION_CUSTODY_INPUT_INVALID'});
  await flush(); f.controller.abort(); f.workerDone.resolve({status:'closed'});
  t.mock.timers.tick(23500); await flush(); assert.deepEqual(f.events,[]);
});
function controlledAbortRegistrations(signal: AbortSignal, failRegistration = false) {
  const registrations = new Set<unknown>();
  let additions = 0, removals = 0, callLookups = 0;
  function add(this: AbortSignal, type: string, callback: unknown, options?: unknown) {
    assert.equal(this, signal); assert.equal(type, 'abort'); assert.deepEqual(options, { once: true });
    additions++; registrations.add(callback);
    if (failRegistration) throw Error('SYNTHETIC_REGISTRATION_FAILURE');
  }
  function remove(this: AbortSignal, type: string, callback: unknown) {
    assert.equal(this, signal); assert.equal(type, 'abort');
    removals++; assert.equal(registrations.delete(callback), true);
  }
  signal.addEventListener = add; signal.removeEventListener = remove;
  const poisonCall = (callback: Function) => Object.defineProperty(callback, 'call', {
    get() { callLookups++; throw Error('SYNTHETIC_SIGNAL_CALL_ACCESSOR'); },
  });
  return { registrations, add, remove, poisonCall,
    counts: () => ({ additions, removals, callLookups }) };
}
test('shutdown actually removes the captured abort registration despite later own call accessor', async t => {
  const f = fixture(), ports = controlledAbortRegistrations(f.input.signal);
  t.after(() => { ports.registrations.clear(); f.settle(); });
  const o = own(f.input);
  assert.equal(ports.registrations.size, 1);
  ports.poisonCall(ports.remove);
  const resultPromise = o.close('completed'); f.settle(); const result = await resultPromise;
  assert.equal(ports.registrations.size, 0, 'shutdown must remove its actual registration');
  assert.deepEqual(ports.counts(), { additions: 1, removals: 1, callLookups: 0 });
  assert.deepEqual(f.events, ['broker-stop', 'worker-stop', 'publish']);
  assert.equal(result.status, 'closed'); assert.equal(result.fault, 'none');
});
test('captured abort callbacks register and remove using the original signal despite own call accessors', async t => {
  const f = fixture(), ports = controlledAbortRegistrations(f.input.signal);
  t.after(() => { ports.registrations.clear(); f.settle(); });
  ports.poisonCall(ports.add); ports.poisonCall(ports.remove);
  const o = own(f.input);
  assert.equal(ports.registrations.size, 1, 'acquisition must register its actual callback');
  const resultPromise = o.close('completed'); f.settle(); const result = await resultPromise;
  assert.equal(ports.registrations.size, 0);
  assert.deepEqual(ports.counts(), { additions: 1, removals: 1, callLookups: 0 });
  assert.equal(result.status, 'closed');
});
test('failed registration rollback actually removes its callback despite own removal call accessor', async t => {
  const f = fixture(), ports = controlledAbortRegistrations(f.input.signal, true);
  t.after(() => { ports.registrations.clear(); f.settle(); });
  f.brokerDone.resolve(receipt()); ports.poisonCall(ports.remove);
  assert.throws(() => own(f.input), { message: 'SUBSCRIPTION_CUSTODY_INPUT_INVALID' });
  f.workerDone.resolve({ status: 'closed' }); await flush();
  assert.equal(ports.registrations.size, 0, 'rollback must remove its actual registration');
  assert.deepEqual(ports.counts(), { additions: 1, removals: 1, callLookups: 0 });
  assert.deepEqual(f.events, []);
});
test('null-prototype custody records are detached shape data',async()=>{
  const f=fixture();
  const o=own(Object.assign(Object.create(null),f.input,{
    identity:Object.assign(Object.create(null),f.input.identity),broker:Object.assign(Object.create(null),f.input.broker),
    worker:Object.assign(Object.create(null),f.input.worker,{identity:Object.assign(Object.create(null),f.input.identity)})}));
  f.settle(); assert.equal((await o.closed).status,'closed');
});
for(const which of ['broker','worker'] as const) for(const mode of ['throw','reject','invalid'] as const) {
  test(`${which} ${mode} stop is consumed, ordered and forces uncertainty`,async()=>{
    const f=fixture();
    const stop=()=>{f.events.push(which+'-stop');if(mode==='throw')throw Error('SYNTHETIC_EXCEPTION_SECRET');
      return mode==='reject'?Promise.reject(Error('SYNTHETIC_EXCEPTION_SECRET')):undefined;};
    if(which==='broker') f.input.broker.stop=stop as never; else f.input.worker.stop=stop as never;
    const o=own(f.input), p=o.close('completed'); assert.deepEqual(f.events,['broker-stop','worker-stop']); f.settle();
    const r=await p; assert.equal(r.status,'custody-uncertain'); assert.equal(r.fault,which+'-stop');
    assert.ok(!JSON.stringify(r).includes('SYNTHETIC_EXCEPTION_SECRET'));
  });
}
test('pending stop acknowledgment does not block actual original closure',async()=>{
  const f=fixture(); f.input.broker.stop=()=>new Promise(()=>{}); f.input.worker.stop=()=>new Promise(()=>{});
  const o=own(f.input); o.close('completed'); f.settle(); assert.equal((await o.closed).status,'closed');
});
for(const which of ['broker','worker'] as const) for(const mode of ['reject','uncertain','malformed','getter','symbol','proxy'] as const) {
  test(`${which} original ${mode} is sanitized and cannot certify closed`,async()=>{
    const f=fixture(), o=own(f.input); let getters=0;
    if(mode==='reject') (which==='broker'?f.brokerDone:f.workerDone).reject(Error('SYNTHETIC_EXCEPTION_SECRET'));
    else {
      let value:unknown=which==='broker'?receipt():{status:'closed'};
      if(mode==='uncertain') value={...(value as object),status:'custody-uncertain'};
      if(mode==='malformed') value=which==='broker'?{...receipt(),acceptedRequests:-1}:{status:'other'};
      if(mode==='getter') value=Object.defineProperty(value,'status',{get(){getters++;throw Error('secret');}});
      if(mode==='symbol') value=Object.assign(value as object,{[Symbol('extra')]:1});
      if(mode==='proxy') value=new Proxy({},{ownKeys(){throw Error('secret');}});
      if(which==='broker') f.brokerDone.resolve(value as never); else f.workerDone.resolve(value as never);
    }
    await flush(); f.settle(); const r=await o.closed;
    assert.equal(r.status,'custody-uncertain'); assert.equal(r.observation.reason,'refused');
    assert.equal(r.observation[which],mode==='uncertain'?'custody-uncertain':'invalid');
    assert.equal(r.fault,mode==='uncertain'?'none':which+'-closure'); assert.equal(getters,0);
    assert.ok(!JSON.stringify(r).includes('SYNTHETIC_EXCEPTION_SECRET'));
  });
}
test('broker counts and terminal code are validated but never copied into lifecycle output',async()=>{
  for(const patch of [{responseBytes:NaN},{redactions:Number.MAX_SAFE_INTEGER+1},{terminalCode:'x'.repeat(129)},
    {reason:'other'},{extra:1}]) {
    const f=fixture(),o=own(f.input); f.brokerDone.resolve({...receipt(),...patch} as never); f.workerDone.resolve({status:'closed'});
    assert.equal((await o.closed).fault,'broker-closure');
  }
  const f=fixture(),o=own(f.input); o.close('completed');
  f.brokerDone.resolve({...receipt(),acceptedRequests:12,responseBytes:345,redactions:6,terminalCode:'SYNTHETIC_TERMINAL_SECRET'});
  f.workerDone.resolve({status:'closed'}); const r=await o.closed;
  assert.deepEqual(Object.keys(r),['schema','observation','publication','fault','status']);
  assert.deepEqual(Object.keys(r.observation),['schema','runtimeSessionId','identity','reason','broker','worker','fault']);
  const s=JSON.stringify(r); for(const forbidden of ['SYNTHETIC_TERMINAL_SECRET','terminalCode','acceptedRequests','apiKey','argv','env','A'.repeat(43)]) assert.ok(!s.includes(forbidden));
});
for(const mode of ['throw','reject','invalid'] as const) test(`publication ${mode} yields failed once without recursive reporting`,async()=>{
  const f=fixture(); let calls=0;
  f.input.publish=()=>{calls++;if(mode==='throw')throw Error('SYNTHETIC_PUBLISH_SECRET');
    return mode==='reject'?Promise.reject(Error('SYNTHETIC_PUBLISH_SECRET')):undefined as never;};
  const o=own(f.input); f.settle(); const r=await o.closed;
  assert.equal(r.publication,'failed'); assert.equal(r.status,'custody-uncertain'); assert.equal(calls,1);
  assert.ok(!JSON.stringify(r).includes('SYNTHETIC_PUBLISH_SECRET'));
});
test('stop rejection during publication is sticky in final result without mutating observation',async()=>{
  const f=fixture(),ack=deferred<SubscriptionAttemptBrokerReceiptV1>(),publication=deferred<void>();
  f.input.broker.stop=()=>ack.promise;
  f.input.publish=value=>{f.observations.push(value);return publication.promise;};
  const o=own(f.input); o.close('completed'); f.settle(); await flush();
  assert.equal(f.observations.length,1); const snapshot=JSON.stringify(f.observations[0]); frozen(f.observations[0]);
  ack.reject(Error('SYNTHETIC_LATE_SECRET')); await flush(); publication.resolve(); const r=await o.closed;
  assert.equal(r.observation.fault,'none'); assert.equal(r.fault,'broker-stop'); assert.equal(r.status,'custody-uncertain');
  assert.equal(JSON.stringify(r.observation),snapshot);
});
test('invalid close reason is sanitized to refused and reentrant close preserves first reason',async()=>{
  const f=fixture(); let o:ReturnType<typeof own>;
  f.input.broker.stop=()=>{assert.equal(o.close('deadline'),o.closed);return Promise.resolve(receipt());};
  o=own(f.input); o.close('secret' as never); f.settle(); assert.equal((await o.closed).observation.reason,'refused');
});
test('drain deadline publishes pending states and late originals cannot upgrade immutable result',async t=>{
  t.mock.timers.enable({apis:['setTimeout']}); const f=fixture(),o=own(f.input),p=o.close('completed');
  t.mock.timers.tick(2500); await flush(); const r=await p;
  assert.equal(r.status,'custody-uncertain'); assert.equal(r.fault,'drain-timeout');
  assert.equal(r.observation.broker,'pending'); assert.equal(r.observation.worker,'pending');
  const snapshot=JSON.stringify(r); f.settle(); await flush(); assert.equal(JSON.stringify(r),snapshot); assert.equal(f.observations.length,1);
});
test('fixed lifetime initiates deadline and publication timeout bounds hanging parent port',async t=>{
  t.mock.timers.enable({apis:['setTimeout']}); const f=fixture(),pub=deferred<void>();
  f.input.publish=value=>{f.observations.push(value);return pub.promise;}; const o=own(f.input);
  t.mock.timers.tick(19999); assert.deepEqual(f.events,[]); t.mock.timers.tick(1);
  assert.deepEqual(f.events,['broker-stop','worker-stop']); t.mock.timers.tick(2500); await flush();
  t.mock.timers.tick(999); let settled=false; void o.closed.then(()=>{settled=true;}); await flush(); assert.equal(settled,false);
  t.mock.timers.tick(1); const r=await o.closed; assert.equal(r.publication,'timed-out'); assert.equal(r.observation.reason,'deadline');
  const snapshot=JSON.stringify(r); pub.reject(Error('late-secret')); f.settle(); await flush();
  assert.equal(JSON.stringify(r),snapshot); assert.equal(f.observations.length,1);
});
test('existing synthetic broker closure joins controlled worker without upstream traffic',async t=>{
  let opens=0; const controller=new AbortController();
  const identity={attemptId:'ATT_composition_1',generationId:'generation_1',modelRef:'kimi/k3.1-pro' as const};
  const {broker}=await startSubscriptionAttemptBrokerForTestV1({...identity,signal:controller.signal,
    limits:{maxRequests:1,maxOutputTokens:2048,maxTotalOutputTokens:2048,maxRequestBytes:65536,maxResponseBytes:131072,
      maxTotalResponseBytes:131072,maxSseEventBytes:32768,attemptMs:10000,requestMs:5000,idleMs:2000}},
    {open(){opens++;throw Error('SYNTHETIC_UPSTREAM_FORBIDDEN');}});
  t.after(async()=>{await broker.stop('owner-abort');}); const workerDone=deferred<SubscriptionWorkerClosureV1>();
  const o=own({runtimeSessionId:'session_composition',identity,broker,signal:controller.signal,
    worker:{identity,closed:workerDone.promise,stop(){workerDone.resolve({status:'closed'});return Promise.resolve();}},
    publish(){return Promise.resolve();}});
  assert.equal((await o.close('completed')).status,'closed'); assert.equal((await broker.closed).status,'closed'); assert.equal(opens,0);
});
