import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { startSubscriptionAttemptBrokerV1, startSubscriptionAttemptBrokerForTestV1,
  type BrokerTestTransportV1, type BrokerTestTransportRequestV1,
  type SubscriptionAttemptBrokerLimitsV1 } from '../../src/execution/subscription-attempt-broker-v1.js';

const limits: SubscriptionAttemptBrokerLimitsV1 = {
  maxRequests: 4, maxOutputTokens: 2048, maxTotalOutputTokens: 8192,
  maxRequestBytes: 65536, maxResponseBytes: 131072, maxTotalResponseBytes: 524288,
  maxSseEventBytes: 32768, attemptMs: 10000, requestMs: 5000, idleMs: 2000,
};
const input = (extra = {}) => ({ attemptId: 'attempt-1', generationId: 'generation-1',
  modelRef: 'minimax/MiniMax-M3.1-Flash' as const, limits, signal: new AbortController().signal, ...extra });
const message = (model = 'MiniMax-M3.1-Flash', text = 'ok') => JSON.stringify({
  id: 'msg_owned', type: 'message', role: 'assistant', model, content: [{ type: 'text', text }],
  stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
});
const body = (model = 'MiniMax-M3.1-Flash', extra = {}) => JSON.stringify({
  model, max_tokens: 128, stream: false, messages: [{ role: 'user', content: 'synthetic protocol check' }], ...extra,
});

async function fixture(t: TestContext, handler: (req: IncomingMessage, res: ServerResponse) => void,
  extra = {}, unsettled = false) {
  const sockets = new Set<net.Socket>();
  const server = http.createServer(handler);
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as net.AddressInfo).port;
  assert.ok(![3080, 3333, 18789].includes(port));
  const calls: BrokerTestTransportRequestV1[] = [];
  const transport: BrokerTestTransportV1 = { open(request) {
    calls.push(request);
    let resolveResponse!: (value: IncomingMessage) => void;
    let rejectResponse!: (reason: unknown) => void;
    const response = new Promise<IncomingMessage>((resolve, reject) => { resolveResponse = resolve; rejectResponse = reject; });
    const original = http.request({ host: '127.0.0.1', port, method: request.method, path: request.path,
      headers: request.headers, agent: false, signal: request.signal }, resolveResponse);
    original.on('error', rejectResponse);
    original.on('upgrade', (response, socket) => {
      response.destroy(); socket.destroy(); rejectResponse(new Error('synthetic upgrade rejected'));
    });
    const closed = unsettled ? new Promise<void>(() => {}) : new Promise<void>(resolve => original.once('close', resolve));
    original.end(request.body);
    return { request: original, response, closed, abort() { original.destroy(); } };
  } };
  const result = await startSubscriptionAttemptBrokerForTestV1(input(extra), transport);
  t.after(async () => { await result.broker.stop('completed'); for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve())); });
  return { ...result, calls, sockets, server };
}
function call(broker: Awaited<ReturnType<typeof startSubscriptionAttemptBrokerV1>>, content = body(broker.worker.modelId),
  extra: RequestInit = {}, path = '/messages') {
  return fetch(`${broker.worker.baseUrl}${path}`, { method: 'POST', headers: {
    authorization: `Bearer ${broker.worker.apiKey}`, 'content-type': 'application/json',
  }, body: content, ...extra });
}
async function fixedError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  const value = await response.json();
  assert.deepEqual(value, { type: 'error', error: { type: 'broker_error', message: code } });
}

for (const [modelRef, modelId, url, path] of [
  ['minimax/MiniMax-M3.1-Flash', 'MiniMax-M3.1-Flash', 'https://api.minimax.io/anthropic/v1/messages', '/anthropic/v1/messages'],
  ['kimi/k3.1-pro', 'k3.1-pro', 'https://api.kimi.com/coding/v1/messages', '/coding/v1/messages'],
] as const) test(`fixed mapping and two-call tool bytes: ${modelRef}`, async t => {
  const received: Buffer[] = [];
  const f = await fixture(t, async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
    received.push(Buffer.concat(chunks)); res.setHeader('content-type', 'application/json');
    res.setHeader('x-provider-secret', 'discard'); res.end(message(modelId));
  }, { modelRef });
  const content = body(modelId, { thinking: { type: 'enabled', budget_tokens: 32 },
    messages: [{ role: 'assistant', content: [{ type: 'thinking', thinking: 'reason', signature: 'sig123' },
      { type: 'tool_use', id: 'tool-1', name: 'read', input: { path: 'a' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'read result' }] }] });
  for (let i = 0; i < 2; i++) {
    const response = await call(f.broker, content);
    assert.equal(response.status, 200); assert.equal(response.headers.get('x-provider-secret'), null);
    assert.equal(await response.text(), message(modelId));
  }
  assert.equal(f.calls.length, 2);
  for (const request of f.calls) {
    assert.equal(request.url, url); assert.equal(request.path, path);
    assert.equal(request.headers.authorization, `Bearer ${f.fakeCredential}`);
    assert.ok(!JSON.stringify(request.headers).includes(f.broker.worker.apiKey));
    assert.deepEqual(request.body, Buffer.from(content));
  }
  assert.deepEqual(received, [Buffer.from(content), Buffer.from(content)]);
  const stop1 = f.broker.stop('completed'); assert.equal(stop1, f.broker.stop('owner-abort'));
  assert.equal(stop1, f.broker.closed);
  assert.deepEqual(await stop1, { status: 'closed', reason: 'completed', acceptedRequests: 2,
    responseBytes: Buffer.byteLength(message(modelId)) * 2, redactions: 0, terminalCode: null });
  await assert.rejects(call(f.broker));
});

test('strict constructors reject overrides, invalid limits/ids/credentials and pre-abort without transport', async () => {
  let opens = 0; const transport = { open() { opens++; throw Error('must not open'); } };
  for (const extra of [{ credential: 'sk-cp-synthetic-credential' }, { url: 'http://127.0.0.1' },
    { limits: { ...limits, requestMs: 2147483648 } }, { limits: { ...limits, idleMs: 6000 } },
    { limits: { ...limits, maxResponseBytes: 999999 } }, { limits: { ...limits, extra: 1 } },
    { attemptId: '../bad' }, { modelRef: 'kimi/other' }]) {
    await assert.rejects(startSubscriptionAttemptBrokerForTestV1(input(extra), transport), /BROKER_INPUT_INVALID/);
  }
  for (const extra of [{ url: 'http://127.0.0.1' }, { transport }, { test: true }, { credential: 'ordinary-not-coding-plan' }]) {
    await assert.rejects(startSubscriptionAttemptBrokerV1({ ...input(), credential: 'sk-cp-synthetic-test-credential', ...extra } as never), /BROKER_INPUT_INVALID/);
  }
  const controller = new AbortController(); controller.abort('secret');
  await assert.rejects(startSubscriptionAttemptBrokerForTestV1(input({ signal: controller.signal }), transport), /BROKER_OWNER_ABORT/);
  assert.equal(opens, 0);
});

for (const [name, content, status, code, path, method] of [
  ['wrong model', body('other'), 403, 'MODEL_REJECTED'],
  ['unknown root field', body(undefined, { secret: true }), 400, 'MALFORMED'],
  ['empty messages', body(undefined, { messages: [] }), 400, 'MALFORMED'],
  ['nonboolean stream', body(undefined, { stream: 1 }), 400, 'MALFORMED'],
  ['tokens', body(undefined, { max_tokens: 2049 }), 429, 'BUDGET'],
  ['duplicate escaped key', '{"model":"MiniMax-M3.1-Flash","mo\\u0064el":"MiniMax-M3.1-Flash","max_tokens":1,"messages":[{"role":"user","content":"hello"}]}', 400, 'MALFORMED'],
  ['nested duplicate', body(undefined, { metadata: JSON.parse('{"a":1}') }).replace('"a":1', '"a":1,"\\u0061":2'), 400, 'MALFORMED'],
  ['depth', body(undefined, { metadata: { nested: JSON.parse('['.repeat(65) + '0' + ']'.repeat(65)) } }), 400, 'MALFORMED'],
  ['wrong path', body(), 404, 'PATH_REJECTED', '/messages?x=1'],
  ['wrong method', body(), 405, 'METHOD_REJECTED', '/messages', 'PUT'],
] as const) test(`rejects ${name} before opening upstream`, async t => {
  const f = await fixture(t, (_req, res) => res.end('unexpected'));
  await fixedError(await call(f.broker, content, { method: method ?? 'POST' }, path ?? '/messages'), status, code);
  assert.equal(f.calls.length, 0); assert.equal((await f.broker.closed).status, 'closed');
});

test('capability and optional x-api-key must match; stale generation cap is refused', async t => {
  const f = await fixture(t, (_req, res) => res.end('unexpected'));
  const g = await fixture(t, (_req, res) => res.end('unexpected'), { generationId: 'generation-2' });
  assert.notEqual(f.broker.worker.apiKey, g.broker.worker.apiKey);
  for (const cap of ['bad', f.broker.worker.apiKey]) {
    const target = cap === 'bad' ? f : g;
    await fixedError(await call(target.broker, body(), { headers: { authorization: `Bearer ${cap}`,
      'content-type': 'application/json' } }), 401, 'CAP_REJECTED');
  }
  await fixedError(await call(f.broker, body(), { headers: { authorization: `Bearer ${f.broker.worker.apiKey}`,
    'x-api-key': 'different', 'content-type': 'application/json' } }), 401, 'CAP_REJECTED');
  assert.equal(f.calls.length + g.calls.length, 0);
});

for (const header of [{ origin: 'http://hostile' }, { 'content-encoding': 'gzip' },
  { forwarded: 'for=1' }, { 'x-forwarded-host': 'other' }, { 'anthropic-beta': 'arbitrary' }])
  test(`refuses unsupported headers ${Object.keys(header)[0]}`, async t => {
    const f = await fixture(t, (_req, res) => res.end());
    await fixedError(await call(f.broker, body(), { headers: { authorization: `Bearer ${f.broker.worker.apiKey}`,
      'content-type': 'application/json', ...header } }), 400, 'MALFORMED');
    assert.equal(f.calls.length, 0);
  });

for (const [status, expected, code] of [[401, 502, 'AUTH_REJECTED'], [403, 502, 'AUTH_REJECTED'],
  [429, 429, 'QUOTA'], [302, 502, 'UPSTREAM_REJECTED'], [500, 502, 'UPSTREAM_REJECTED']] as const)
  test(`suppresses reflected upstream HTTP ${status} without retry or redirect`, async t => {
    let f: Awaited<ReturnType<typeof fixture>>;
    let redirected = 0;
    f = await fixture(t, (req, res) => {
      if (req.url === '/redirect-target') redirected++;
      res.writeHead(status, { location: `http://127.0.0.1:${(f.server.address() as net.AddressInfo).port}/redirect-target` });
      res.end(JSON.stringify({ error: f.fakeCredential.split('').map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('') })); });
    await fixedError(await call(f.broker), expected, code);
    assert.equal(f.calls.length, 1); assert.equal(redirected, 0);
    assert.equal((await f.broker.closed).terminalCode, code);
  });

test('normal JSON known variants are redacted before write; invalid message never escapes', async t => {
  let fake = '';
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json');
    res.end(message(undefined, `${fake}|${Buffer.from(fake).toString('base64')}|unrelated`)); });
  fake = f.fakeCredential;
  const response = await call(f.broker); const text = await response.text();
  assert.equal(response.status, 200); assert.ok(!text.includes(fake));
  assert.ok(text.includes('[REDACTED_SUBSCRIPTION_CREDENTIAL]|[REDACTED_SUBSCRIPTION_CREDENTIAL]|unrelated'));
  assert.equal((await f.broker.stop('completed')).redactions, 2);
  const invalid = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(message('wrong')); });
  await fixedError(await call(invalid.broker), 502, 'UPSTREAM_INVALID');
});

function event(type: string, extra = {}, eol = '\n') { return `event: ${type}${eol}data: ${JSON.stringify({ type, ...extra })}${eol}${eol}`; }
const nativeFrames = () => [': comment\r\n\r\n', event('message_start', { message: JSON.parse(message()) }, '\r\n'),
  event('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } }),
  event('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'reason' } }),
  event('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'signature123' } }),
  event('content_block_stop', { index: 0 }), event('content_block_start', { index: 1, content_block: { type: 'tool_use', id: 'tool-1', name: 'read', input: {} } }),
  'event: content_block_delta\ndata: {"type":"content_block_delta",\ndata: "index":1,"delta":{"type":"input_json_delta","partial_json":"{}"}}\n\n',
  event('content_block_stop', { index: 1 }), event('message_delta', { delta: { stop_reason: 'tool_use' } }), event('message_stop')];

test('SSE preserves native frames, LF/CRLF/multiline/comments across bytewise delimiter splits', async t => {
  const frames = nativeFrames().join('');
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream');
    for (const byte of Buffer.from(frames)) res.write(Buffer.from([byte])); res.end(); });
  const response = await call(f.broker, body(undefined, { stream: true }));
  assert.equal(response.status, 200); assert.equal(await response.text(), frames);
});

for (const suffix of ['event: error\ndata: {"anything":"ESCAPED"}\n\n',
  'data: {"type":"error","message":"ESCAPED"}\n\n', 'data: {not-json}\n\n',
  'data: {"type":"message_stop"}\n', '']) test(`SSE rejects error/invalid/truncated suffix ${suffix.slice(0, 24)}`, async t => {
  let fake = '';
  const prefix = event('message_start', { message: JSON.parse(message()) });
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream');
    res.end(prefix + suffix.replace('ESCAPED', fake.split('').map((c, i) => i % 2 ? c : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join(''))); });
  fake = f.fakeCredential;
  const response = await call(f.broker, body(undefined, { stream: true })); const text = await response.text();
  assert.ok(text.startsWith(prefix)); assert.ok(text.includes('event: error\n'));
  assert.ok(!text.includes('ESCAPED')); assert.ok(!text.includes(fake)); assert.ok(!text.includes('message_stop'));
  assert.equal((await f.broker.closed).status, 'closed');
});

test('SSE holds message_stop until valid EOF and rejects trailing partial/data', async t => {
  for (const suffix of ['data: {', event('message_delta')]) {
    const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream'); res.end(nativeFrames().join('') + suffix); });
    const text = await (await call(f.broker, body(undefined, { stream: true }))).text();
    assert.ok(!text.includes('event: message_stop')); assert.ok(text.includes('event: error'));
  }
});

test('request count and total reserved tokens reject later calls without refund', async t => {
  for (const overrides of [{ maxRequests: 1 }, { maxOutputTokens: 128, maxTotalOutputTokens: 128 }]) {
    const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(message()); }, { limits: { ...limits, ...overrides } });
    assert.equal((await call(f.broker)).status, 200);
    await fixedError(await call(f.broker), 429, 'BUDGET'); assert.equal(f.calls.length, 1);
  }
});

test('request and response/event/aggregate byte caps are causal', async t => {
  const request = await fixture(t, (_req, res) => res.end(), { limits: { ...limits, maxRequestBytes: 32 } });
  await fixedError(await call(request.broker), 413, 'BYTES'); assert.equal(request.calls.length, 0);
  const response = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(message()); }, { limits: { ...limits, maxResponseBytes: 32 } });
  await fixedError(await call(response.broker), 502, 'UPSTREAM_LIMIT');
  const aggregate = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(message()); },
    { limits: { ...limits, maxResponseBytes: Buffer.byteLength(message()), maxTotalResponseBytes: Buffer.byteLength(message()) } });
  assert.equal((await call(aggregate.broker)).status, 200);
  await fixedError(await call(aggregate.broker), 502, 'UPSTREAM_LIMIT');
  const sse = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream'); res.end(nativeFrames().join('')); }, { limits: { ...limits, maxSseEventBytes: 20 } });
  assert.ok((await (await call(sse.broker, body(undefined, { stream: true }))).text()).includes('event: error'));
});

test('concurrent authenticated call terminates attempt without second upstream', async t => {
  let headers!: () => void; const arrived = new Promise<void>(resolve => { headers = resolve; });
  const f = await fixture(t, () => headers());
  const first = call(f.broker).catch(() => undefined); await arrived;
  await fixedError(await call(f.broker), 409, 'CONCURRENT'); await first;
  assert.equal(f.calls.length, 1); assert.equal((await f.broker.closed).status, 'closed');
});

test('owner abort and deadline close original sockets while waiting for upstream headers', async t => {
  for (const mode of ['abort', 'deadline'] as const) {
    const controller = new AbortController(); let arrived!: () => void;
    const seen = new Promise<void>(resolve => { arrived = resolve; });
    const f = await fixture(t, () => arrived(), { signal: controller.signal,
      limits: mode === 'deadline' ? { ...limits, idleMs: 100, requestMs: 100, attemptMs: 100 } : limits });
    const pending = call(f.broker).catch(() => undefined); await seen;
    if (mode === 'abort') controller.abort('never serialize');
    const receipt = await f.broker.closed; await pending;
    assert.equal(receipt.status, 'closed'); assert.equal(receipt.reason, mode === 'abort' ? 'owner-abort' : 'deadline');
    await new Promise(resolve => setImmediate(resolve)); assert.equal(f.sockets.size, 0);
  }
});

test('unsettled original transport produces custody-uncertain; repeated stop is identical', async t => {
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(message()); }, {}, true);
  await (await call(f.broker)).text(); const first = f.broker.stop('completed');
  assert.equal(first, f.broker.stop('refused')); assert.equal((await first).status, 'custody-uncertain');
});

async function raw(broker: Awaited<ReturnType<typeof startSubscriptionAttemptBrokerV1>>, headers: string, payload = '') {
  const url = new URL(broker.worker.baseUrl);
  const socket = net.connect({ host: '127.0.0.1', port: Number(url.port) });
  await once(socket, 'connect');
  const chunks: Buffer[] = []; socket.on('data', chunk => chunks.push(chunk));
  const ended = new Promise<void>(resolve => { socket.on('error', () => {}); socket.once('close', resolve); });
  socket.write(`POST /v1/messages HTTP/1.1\r\nHost: ${url.host}\r\nAuthorization: Bearer ${broker.worker.apiKey}\r\nContent-Type: application/json\r\n${headers}\r\n${payload}`);
  await ended; return Buffer.concat(chunks).toString();
}

for (const headers of ['Content-Length: 1\r\nTransfer-Encoding: chunked\r\n',
  'Content-Length: 1\r\nContent-Length: 1\r\n'])
  test(`ambiguous parser framing revokes admission without upstream ${headers.split('\r')[0]}`, async t => {
    const f = await fixture(t, (_req, res) => res.end());
    const result = await raw(f.broker, headers, '0\r\n\r\n');
    assert.ok(result.startsWith('HTTP/1.1 400'));
    // The malformed connection must not leave a still-spendable attempt behind.
    await assert.rejects(call(f.broker)); assert.equal(f.calls.length, 0);
  });

for (const headers of ['Authorization: Bearer duplicate\r\nContent-Length: 0\r\n',
  'Expect: 100-continue\r\nContent-Length: 0\r\n', 'Trailer: x-secret\r\nTransfer-Encoding: chunked\r\n',
  'Host: another.invalid\r\nContent-Length: 0\r\n'])
  test(`raw critical/expect/trailer header refusal ${headers.split(':')[0]}`, async t => {
    const f = await fixture(t, (_req, res) => res.end());
    const result = await raw(f.broker, headers, '0\r\n\r\n');
    assert.ok(result.startsWith('HTTP/1.1 400')); assert.ok(!result.includes('100 Continue'));
    assert.equal(f.calls.length, 0); assert.equal((await f.broker.closed).status, 'closed');
  });

test('abort during partial upload closes original worker socket without transport', async t => {
  const controller = new AbortController(); const f = await fixture(t, (_req, res) => res.end(), { signal: controller.signal });
  const url = new URL(f.broker.worker.baseUrl);
  const socket = net.connect(Number(url.port), '127.0.0.1'); await once(socket, 'connect');
  socket.on('error', () => {}); const disconnected = new Promise<void>(resolve => socket.once('close', resolve));
  socket.write(`POST /v1/messages HTTP/1.1\r\nHost: ${url.host}\r\nAuthorization: Bearer ${f.broker.worker.apiKey}\r\nContent-Type: application/json\r\nContent-Length: 900\r\n\r\n{`);
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await disconnected; const receipt = await f.broker.closed;
  assert.equal(receipt.status, 'closed'); assert.equal(receipt.reason, 'owner-abort'); assert.equal(f.calls.length, 0);
});

test('worker disconnect during stream aborts original upstream and closes custody', async t => {
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream');
    res.write(event('message_start', { message: JSON.parse(message()) })); });
  const response = await call(f.broker, body(undefined, { stream: true }));
  const reader = response.body!.getReader(); assert.ok((await reader.read()).value!.length > 0);
  await reader.cancel(); const receipt = await f.broker.closed;
  assert.equal(receipt.status, 'closed'); assert.equal(receipt.terminalCode, 'DISCONNECTED');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.sockets.size, 0);
});

test('owner abort while output is backpressured settles sockets without queued success', async t => {
  const controller = new AbortController(); let started!: () => void;
  const sawStream = new Promise<void>(resolve => { started = resolve; });
  const f = await fixture(t, (_req, res) => {
    res.setHeader('content-type', 'text/event-stream'); res.write(event('message_start', { message: JSON.parse(message()) }));
    const huge = event('content_block_delta', { delta: { type: 'text_delta', text: 'x'.repeat(24000) } });
    const pump = () => { while (!res.destroyed && res.write(huge)) {} };
    res.on('drain', pump); pump(); started();
  }, { signal: controller.signal, limits: { ...limits, maxResponseBytes: 32 * 1024 * 1024, maxTotalResponseBytes: 32 * 1024 * 1024 } });
  const url = new URL(f.broker.worker.baseUrl);
  const socket = net.connect(Number(url.port), '127.0.0.1'); await once(socket, 'connect');
  socket.pause(); socket.on('error', () => {});
  const payload = body(undefined, { stream: true });
  socket.write(`POST /v1/messages HTTP/1.1\r\nHost: ${url.host}\r\nAuthorization: Bearer ${f.broker.worker.apiKey}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
  await sawStream; await new Promise(resolve => setTimeout(resolve, 30)); controller.abort();
  const receipt = await f.broker.closed; socket.destroy();
  assert.equal(receipt.status, 'closed'); assert.equal(receipt.reason, 'owner-abort');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.sockets.size, 0);
});

test('abort immediately after construction starts cannot leave an exposed listener', () => {
  const script = `import assert from 'node:assert/strict';
    import { startSubscriptionAttemptBrokerForTestV1 } from './src/execution/subscription-attempt-broker-v1.ts';
    const listeners = () => process.getActiveResourcesInfo().filter(name => name === 'TCPServerWrap').length;
    assert.equal(listeners(), 0);
    const controller = new AbortController(); let calls = 0;
    const pending = startSubscriptionAttemptBrokerForTestV1({ attemptId: 'bind-abort', generationId: 'g1',
      modelRef: 'kimi/k3.1-pro', limits: ${JSON.stringify(limits)}, signal: controller.signal }, {
      open() { calls++; throw Error('never'); } });
    controller.abort(); await assert.rejects(pending, /BROKER_OWNER_ABORT/); assert.equal(calls, 0);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(listeners(), 0);
    console.log('ABORT_CLOSED');`;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    encoding: 'utf8', env: process.env, timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout.trim(), 'ABORT_CLOSED');
});

test('upstream informational response is terminal and final response cannot escape', async t => {
  const f = await fixture(t, (_req, res) => { res.writeEarlyHints({ link: '</private>; rel=preload' });
    res.setHeader('content-type', 'application/json'); res.end(message()); });
  await fixedError(await call(f.broker), 502, 'UPSTREAM_REJECTED'); assert.equal(f.calls.length, 1);
});

test('stream byte preservation includes complete known credential variants at event boundaries', async t => {
  let normal = ''; let expected = '';
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream');
    for (let i = 0; i < normal.length; i += 7) res.write(normal.slice(i, i + 7)); res.end(); });
  const variant = Buffer.from(f.fakeCredential).toString('base64');
  const frame = event('content_block_delta', { delta: { type: 'text_delta', text: `before${variant}after` } });
  normal = event('message_start', { message: JSON.parse(message()) }) + frame + event('message_stop');
  expected = normal.replace(variant, '[REDACTED_SUBSCRIPTION_CREDENTIAL]');
  const response = await call(f.broker, body(undefined, { stream: true }));
  assert.equal(await response.text(), expected); assert.equal((await f.broker.stop('completed')).redactions, 1);
});

test('unsettled preceding upstream custody forbids a second spend', async t => {
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(message()); }, {}, true);
  assert.equal((await call(f.broker)).status, 200);
  await fixedError(await call(f.broker), 409, 'CONCURRENT'); assert.equal(f.calls.length, 1);
  assert.equal((await f.broker.closed).status, 'custody-uncertain');
});

test('chunked upload bytes and invalid UTF-8 are refused before upstream', async t => {
  const f = await fixture(t, (_req, res) => res.end(), { limits: { ...limits, maxRequestBytes: 32 } });
  const content = body();
  const result = await raw(f.broker, 'Transfer-Encoding: chunked\r\n', `${Buffer.byteLength(content).toString(16)}\r\n${content}\r\n0\r\n\r\n`);
  assert.ok(result.startsWith('HTTP/1.1 413')); assert.equal(f.calls.length, 0);
  const g = await fixture(t, (_req, res) => res.end());
  const response = await call(g.broker, new Uint8Array([0xff, 0xfe]) as never);
  await fixedError(response, 400, 'MALFORMED'); assert.equal(g.calls.length, 0);
});

test('SSE cannot smuggle an early stop in an event name that disagrees with data', async t => {
  for (const suffix of ['event: message_stop\ndata: {"type":"content_block_delta"}\n\n', 'event: message_stop\n\n']) {
    const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream');
      res.end(event('message_start', { message: JSON.parse(message()) }) + suffix); });
    const text = await (await call(f.broker, body(undefined, { stream: true }))).text();
    assert.ok(!text.includes('event: message_stop')); assert.ok(text.includes('event: error'));
  }
});

test('SSE complete trailing comments remain ordered behind held message_stop at valid EOF', async t => {
  const expected = nativeFrames().join('') + ': final heartbeat\r\n\r\n';
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'text/event-stream'); res.end(expected); });
  const response = await call(f.broker, body(undefined, { stream: true }));
  assert.equal(await response.text(), expected);
});

test('idle and request timers terminate withheld headers and active endless streaming', async t => {
  const idle = await fixture(t, () => {}, { limits: { ...limits, idleMs: 30, requestMs: 200, attemptMs: 1000 } });
  await fixedError(await call(idle.broker), 504, 'IDLE_TIMEOUT'); assert.equal((await idle.broker.closed).status, 'closed');
  const streaming = await fixture(t, (_req, res) => {
    res.setHeader('content-type', 'text/event-stream'); res.write(event('message_start', { message: JSON.parse(message()) }));
    const timer = setInterval(() => res.write(': heartbeat\n\n'), 10); res.once('close', () => clearInterval(timer));
  }, { limits: { ...limits, idleMs: 50, requestMs: 100, attemptMs: 1000 } });
  const text = await (await call(streaming.broker, body(undefined, { stream: true }))).text();
  assert.ok(text.includes('REQUEST_TIMEOUT')); assert.ok(!text.includes('message_stop'));
  assert.equal((await streaming.broker.closed).status, 'closed');
});

test('upstream 101 upgrade is rejected with original socket settlement', async t => {
  const f = await fixture(t, (_req, res) => { res.writeHead(101, { connection: 'Upgrade', upgrade: 'websocket' }); res.end(); },
    { limits: { ...limits, idleMs: 100, requestMs: 200, attemptMs: 1000 } });
  await fixedError(await call(f.broker), 502, 'UPSTREAM_REJECTED');
  assert.equal((await f.broker.closed).status, 'closed'); assert.equal(f.calls.length, 1);
});

for (const constructor of ['production', 'synthetic']) {
  for (const [name, expression] of [
    ['array', "['kimi/k3.1-pro']"],
    ['boxed string', "new String('kimi/k3.1-pro')"],
    ['coercible object', "({ toString() { coercions++; return 'kimi/k3.1-pro'; }, startsWith() { coercions++; return false; } })"],
  ]) test(`${constructor} rejects ${name} modelRef before bind, transport or coercion`, () => {
    const script = `import assert from 'node:assert/strict'; import http from 'node:http'; import https from 'node:https';
      import { startSubscriptionAttemptBrokerV1, startSubscriptionAttemptBrokerForTestV1 } from './src/execution/subscription-attempt-broker-v1.ts';
      let binds = 0, opens = 0, coercions = 0;
      http.Server.prototype.listen = function() { binds++; throw Error('UNEXPECTED_BIND'); };
      https.request = () => { opens++; throw Error('UNEXPECTED_TRANSPORT'); };
      const input = { attemptId: 'shape', generationId: 'g1', modelRef: ${expression},
        limits: ${JSON.stringify(limits)}, signal: new AbortController().signal };
      const result = ${constructor === 'production'
        ? "startSubscriptionAttemptBrokerV1({ ...input, credential: 'sk-cp-synthetic-validation-only' })"
        : "startSubscriptionAttemptBrokerForTestV1(input, { open() { opens++; throw Error('UNEXPECTED_TRANSPORT'); } })"};
      await assert.rejects(result, error => error.message === 'BROKER_INPUT_INVALID');
      assert.equal(binds, 0); assert.equal(opens, 0); assert.equal(coercions, 0); console.log('SHAPE_REJECTED');`;
    const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      encoding: 'utf8', env: process.env, timeout: 5000,
    });
    assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout.trim(), 'SHAPE_REJECTED');
  });
}

for (const kind of ['Upgrade', 'CONNECT'] as const) test(`authenticated ${kind} burns attempt without later spend`, async t => {
  const f = await fixture(t, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(message()); });
  const url = new URL(f.broker.worker.baseUrl);
  const socket = net.connect(Number(url.port), '127.0.0.1'); await once(socket, 'connect');
  socket.on('error', () => {}); socket.resume();
  const closed = new Promise<void>(resolve => socket.once('close', resolve));
  const request = kind === 'Upgrade'
    ? `GET /v1/messages HTTP/1.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n`
    : `CONNECT ${url.host} HTTP/1.1\r\n`;
  socket.write(`${request}Host: ${url.host}\r\nAuthorization: Bearer ${f.broker.worker.apiKey}\r\n\r\n`);
  await closed;
  await assert.rejects(call(f.broker)); assert.equal(f.calls.length, 0);
  const receipt = await f.broker.closed;
  assert.equal(receipt.status, 'closed'); assert.equal(receipt.reason, 'refused');
});

test('malformed half-open peer cannot defer parser-refusal drain until attempt deadline', async t => {
  const f = await fixture(t, (_req, res) => res.end(), { limits: { ...limits, attemptMs: 10000 } });
  const url = new URL(f.broker.worker.baseUrl);
  const socket = net.connect({ host: '127.0.0.1', port: Number(url.port), allowHalfOpen: true });
  t.after(() => socket.destroy());
  await once(socket, 'connect'); socket.on('error', () => {});
  const chunks: Buffer[] = []; socket.on('data', chunk => chunks.push(chunk));
  const ended = new Promise<void>(resolve => socket.once('end', resolve));
  socket.write(`POST /v1/messages HTTP/1.1\r\nHost: ${url.host}\r\nAuthorization: Bearer ${f.broker.worker.apiKey}\r\nContent-Length: 1\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n`);
  await ended;
  assert.ok(Buffer.concat(chunks).toString().startsWith('HTTP/1.1 400'));
  assert.equal(socket.writableEnded, false); // The peer deliberately withholds its FIN.
  let observed: Awaited<typeof f.broker.closed> | undefined;
  void f.broker.closed.then(receipt => { observed = receipt; });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(observed?.status, 'closed'); assert.equal(observed?.reason, 'refused');
  assert.equal(f.calls.length, 0);
});
