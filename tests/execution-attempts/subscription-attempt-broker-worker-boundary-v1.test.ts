import assert from 'node:assert/strict';
import test from 'node:test';
import http, { type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { spawnSync } from 'node:child_process';
import { startSubscriptionAttemptBrokerForTestV1 } from '../../src/execution/subscription-attempt-broker-v1.js';

test('synthetic loadedRaw fallback only persists worker binding and filtered reflected output', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'setfarm-broker-boundary-'));
  // Retain these tiny worker-only records for owner verification. They never contain
  // the synthetic provider credential; ordinary transport resources still close below.
  t.diagnostic(`retained worker-boundary records: ${directory}`);
  let fake = '';
  const server = http.createServer((_req, res) => { res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'k3.1-pro',
      content: [{ type: 'text', text: fake }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } })); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  assert.ok(![18789, 3080, 3333].includes(port));
  const { broker, fakeCredential } = await startSubscriptionAttemptBrokerForTestV1({
    attemptId: 'boundary', generationId: 'generation-1', modelRef: 'kimi/k3.1-pro',
    limits: { maxRequests: 4, maxOutputTokens: 2048, maxTotalOutputTokens: 8192, maxRequestBytes: 65536,
      maxResponseBytes: 131072, maxTotalResponseBytes: 524288, maxSseEventBytes: 32768, attemptMs: 10000, requestMs: 5000, idleMs: 2000 },
    signal: new AbortController().signal,
  }, { open(input) {
    let resolve!: (response: IncomingMessage) => void; let reject!: (error: unknown) => void;
    const response = new Promise<IncomingMessage>((yes, no) => { resolve = yes; reject = no; });
    const request = http.request({ host: '127.0.0.1', port, path: input.path, method: 'POST', headers: input.headers,
      agent: false, signal: input.signal }, resolve);
    request.on('error', reject); const closed = new Promise<void>(resolve => request.once('close', resolve));
    request.end(input.body); return { request, response, closed, abort: () => request.destroy() };
  } });
  fake = fakeCredential;
  t.after(async () => { await broker.stop('completed'); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const cfg = { model: broker.worker, fallbackModels: [] };
  const loadedRaw = JSON.parse(JSON.stringify(cfg));
  const response = await fetch(`${broker.worker.baseUrl}/messages`, { method: 'POST', headers: {
    authorization: `Bearer ${broker.worker.apiKey}`, 'content-type': 'application/json',
  }, body: JSON.stringify({ model: 'k3.1-pro', max_tokens: 128, stream: false, messages: [{ role: 'user', content: 'synthetic protocol check' }] }) });
  assert.equal(response.status, 200);
  const captured = await response.text();
  const outputs = { 'cfg.json': JSON.stringify(cfg), 'models.json': JSON.stringify(loadedRaw),
    'session.json': JSON.stringify({ cfg: loadedRaw, response: captured }), 'stdout.txt': JSON.stringify(loadedRaw) + captured,
    'stderr.txt': '' };
  for (const [name, value] of Object.entries(outputs)) await writeFile(join(directory, name), value, { mode: 0o600 });
  const percent = encodeURIComponent(fake);
  const form = new URLSearchParams({ value: fake }).toString().slice(6);
  const base64 = Buffer.from(fake).toString('base64');
  const url64 = base64.replaceAll('+', '-').replaceAll('/', '_');
  const unicode = [...fake].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  const variants = [fake, JSON.stringify(fake).slice(1, -1), percent,
    percent.replace(/%[0-9A-F]{2}/g, part => part.toLowerCase()), form,
    form.replace(/%[0-9A-F]{2}/g, part => part.toLowerCase()), base64, base64.replace(/=+$/, ''),
    url64, url64.replace(/=+$/, ''), unicode, unicode.replace(/\\u[0-9a-f]{4}/g, part => `\\u${part.slice(2).toUpperCase()}`)];
  for (const name of Object.keys(outputs)) { const actual = await readFile(join(directory, name), 'utf8');
    for (const variant of variants) assert.ok(!actual.includes(variant), name);
  }
  assert.ok((await readFile(join(directory, 'models.json'), 'utf8')).includes(broker.worker.apiKey));
  assert.ok(captured.includes('[REDACTED_SUBSCRIPTION_CREDENTIAL]'));
  assert.equal((await broker.stop('completed')).status, 'closed');
});

test('import is inert: no listeners, transport, filesystem writes or environment mutation', () => {
  const script = `import http from 'node:http'; import https from 'node:https'; import net from 'node:net';
    import fs from 'node:fs'; import assert from 'node:assert/strict';
    const env = JSON.stringify(process.env); const fail = () => { throw Error('IMPORT_SIDE_EFFECT'); };
    http.createServer = fail; http.request = fail; https.request = fail; net.connect = fail;
    fs.writeFileSync = fail; fs.appendFileSync = fail;
    await import('./src/execution/subscription-attempt-broker-v1.ts'); assert.equal(JSON.stringify(process.env), env);
    console.log('INERT');`;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', env: process.env, timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout.trim(), 'INERT');
});
