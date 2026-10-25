import http, { type ClientRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import https from 'node:https';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Socket, AddressInfo } from 'node:net';
import { createSubscriptionCredentialRedactorV1 } from './subscription-credential-redactor-v1.js';

type Model = 'minimax/MiniMax-M3.1-Flash' | 'kimi/k3.1-pro';
export type SubscriptionAttemptBrokerLimitsV1 = Readonly<{
  maxRequests: number; maxOutputTokens: number; maxTotalOutputTokens: number;
  maxRequestBytes: number; maxResponseBytes: number; maxTotalResponseBytes: number;
  maxSseEventBytes: number; attemptMs: number; requestMs: number; idleMs: number;
}>;
export type SubscriptionAttemptBrokerInputV1 = Readonly<{
  attemptId: string; generationId: string; modelRef: Model; credential: string;
  limits: SubscriptionAttemptBrokerLimitsV1; signal: AbortSignal;
}>;
export type SubscriptionAttemptBrokerWorkerV1 = Readonly<{
  attemptId: string; generationId: string; modelRef: Model; providerId: 'minimax' | 'kimi';
  modelId: 'MiniMax-M3.1-Flash' | 'k3.1-pro'; baseUrl: string; api: 'anthropic-messages';
  apiKey: string; auth: 'api-key'; authHeader: true;
}>;
export type SubscriptionAttemptBrokerStopV1 = 'completed' | 'owner-abort' | 'deadline' | 'refused';
export type SubscriptionAttemptBrokerReceiptV1 = Readonly<{
  status: 'closed' | 'custody-uncertain'; reason: SubscriptionAttemptBrokerStopV1;
  acceptedRequests: number; responseBytes: number; redactions: number; terminalCode: string | null;
}>;
export type SubscriptionAttemptBrokerV1 = Readonly<{
  worker: SubscriptionAttemptBrokerWorkerV1;
  stop(reason: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionAttemptBrokerReceiptV1>;
  closed: Promise<SubscriptionAttemptBrokerReceiptV1>;
}>;
export type BrokerTestTransportRequestV1 = Readonly<{
  url: string; path: '/anthropic/v1/messages' | '/coding/v1/messages'; method: 'POST';
  headers: Readonly<Record<string, string>>; body: Buffer; signal: AbortSignal;
}>;
export type BrokerTestTransportV1 = Readonly<{
  open(input: BrokerTestTransportRequestV1): {
    request: ClientRequest; response: Promise<IncomingMessage>; closed: Promise<void>; abort(): void;
  };
}>;

type PublicInput = Omit<SubscriptionAttemptBrokerInputV1, 'credential'>;
const models = {
  'minimax/MiniMax-M3.1-Flash': { providerId: 'minimax', modelId: 'MiniMax-M3.1-Flash',
    url: 'https://api.minimax.io/anthropic/v1/messages', path: '/anthropic/v1/messages' },
  'kimi/k3.1-pro': { providerId: 'kimi', modelId: 'k3.1-pro',
    url: 'https://api.kimi.com/coding/v1/messages', path: '/coding/v1/messages' },
} as const;
const limitKeys = ['maxRequests', 'maxOutputTokens', 'maxTotalOutputTokens', 'maxRequestBytes',
  'maxResponseBytes', 'maxTotalResponseBytes', 'maxSseEventBytes', 'attemptMs', 'requestMs', 'idleMs'] as const;
const rootKeys = new Set(['model', 'messages', 'system', 'max_tokens', 'stream', 'tools', 'tool_choice',
  'thinking', 'temperature', 'top_p', 'top_k', 'stop_sequences', 'metadata']);
const betaNames = new Set(['fine-grained-tool-streaming-2025-05-14', 'interleaved-thinking-2025-05-14']);
const criticalHeaders = new Set(['host', 'authorization', 'x-api-key', 'content-type', 'content-length',
  'transfer-encoding', 'anthropic-beta', 'anthropic-version', 'origin', 'expect', 'trailer']);
const decoder = new TextDecoder('utf-8', { fatal: true });

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function exactKeys(value: unknown, keys: readonly string[]): boolean {
  return record(value) && Reflect.ownKeys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key) && 'value' in Object.getOwnPropertyDescriptor(value, key)!);
}
function invalid(): never { throw new Error('BROKER_INPUT_INVALID'); }
function validate(input: PublicInput | SubscriptionAttemptBrokerInputV1, synthetic: boolean): void {
  if (!exactKeys(input, ['attemptId', 'generationId', 'modelRef', 'limits', 'signal', ...(synthetic ? [] : ['credential'])])) invalid();
  if (typeof input.attemptId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.attemptId)
    || typeof input.generationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.generationId)
    || typeof input.modelRef !== 'string' || !Object.hasOwn(models, input.modelRef)
    || !(input.signal instanceof AbortSignal)) invalid();
  const l = input.limits;
  if (!exactKeys(l, limitKeys) || limitKeys.some(key => !Number.isSafeInteger(l[key]) || l[key] <= 0)
    || l.maxOutputTokens > l.maxTotalOutputTokens || l.maxResponseBytes > l.maxTotalResponseBytes
    || l.idleMs > l.requestMs || l.requestMs > l.attemptMs || l.attemptMs > 2147483647) invalid();
  if (!synthetic) {
    const key = (input as SubscriptionAttemptBrokerInputV1).credential;
    if (typeof key !== 'string' || (input.modelRef.startsWith('minimax/') && !key.startsWith('sk-cp'))) invalid();
    try { createSubscriptionCredentialRedactorV1(key).discard(); } catch { invalid(); }
  }
  if (input.signal.aborted) throw new Error('BROKER_OWNER_ABORT');
}

/** Inert until explicitly called. Caller owns subscription provenance and later runtime admission. */
export async function startSubscriptionAttemptBrokerV1(input: SubscriptionAttemptBrokerInputV1): Promise<SubscriptionAttemptBrokerV1> {
  validate(input, false);
  const agent = new https.Agent({ keepAlive: false, maxSockets: 1, maxTotalSockets: 1, rejectUnauthorized: true });
  const transport: BrokerTestTransportV1 = { open(request) {
    let resolveResponse!: (response: IncomingMessage) => void;
    let rejectResponse!: (error: unknown) => void;
    const response = new Promise<IncomingMessage>((resolve, reject) => { resolveResponse = resolve; rejectResponse = reject; });
    const original = https.request(request.url, { method: 'POST', headers: request.headers, agent,
      rejectUnauthorized: true, signal: request.signal, maxHeaderSize: 16384 }, resolveResponse);
    original.on('error', rejectResponse);
    original.on('upgrade', (response, socket) => {
      response.destroy(); socket.destroy(); rejectResponse(new Error('UPSTREAM_REJECTED'));
    });
    // Core also tracks the original response and socket, independently of this adapter's promise.
    const closed = new Promise<void>(resolve => original.once('close', resolve));
    original.end(request.body);
    return { request: original, response, closed, abort() { original.destroy(); } };
  } };
  return startCore(input, input.credential, transport, () => agent.destroy());
}

export async function startSubscriptionAttemptBrokerForTestV1(input: PublicInput, transport: BrokerTestTransportV1):
Promise<{ broker: SubscriptionAttemptBrokerV1; fakeCredential: string }> {
  validate(input, true);
  if (!exactKeys(transport, ['open']) || typeof transport.open !== 'function') invalid();
  const fakeCredential = `sk-cp-synthetic-${randomBytes(24).toString('base64url')}`;
  return { broker: await startCore(input, fakeCredential, transport, () => {}), fakeCredential };
}

/** Only duplicate decoded keys/depth are lexical policy; JSON.parse remains the grammar authority. */
function parseJson(bytes: Buffer): unknown {
  const text = decoder.decode(bytes);
  const stack: { object: boolean; keys: Set<string>; key: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i++;
      for (; i < text.length; i++) { if (text[i] === '\\') i++; else if (text[i] === '"') break; }
      const top = stack.at(-1);
      if (top?.object && top.key) {
        const key: string = JSON.parse(text.slice(start, i + 1));
        if (top.keys.has(key)) throw new Error('MALFORMED');
        top.keys.add(key); top.key = false;
      }
    } else if (c === '{' || c === '[') {
      stack.push({ object: c === '{', keys: new Set(), key: c === '{' });
      if (stack.length > 64) throw new Error('MALFORMED');
    } else if (c === '}' || c === ']') stack.pop();
    else if (c === ',' && stack.at(-1)?.object) stack.at(-1)!.key = true;
  }
  return JSON.parse(text);
}

function requestSchema(value: unknown): value is Record<string, unknown> & { max_tokens: number; stream?: boolean } {
  if (!record(value) || Object.keys(value).some(key => !rootKeys.has(key))
    || typeof value.model !== 'string' || !Number.isSafeInteger(value.max_tokens) || (value.max_tokens as number) <= 0
    || !Array.isArray(value.messages) || value.messages.length === 0
    || !value.messages.every(message => record(message) && ['user', 'assistant'].includes(message.role as string)
      && (typeof message.content === 'string' || Array.isArray(message.content)))
    || (value.stream !== undefined && typeof value.stream !== 'boolean')) return false;
  for (const key of ['thinking', 'tool_choice', 'metadata']) if (value[key] !== undefined && !record(value[key])) return false;
  if (value.system !== undefined && typeof value.system !== 'string' && !Array.isArray(value.system)) return false;
  if (value.tools !== undefined && (!Array.isArray(value.tools) || !value.tools.every(record))) return false;
  if (value.stop_sequences !== undefined && (!Array.isArray(value.stop_sequences) || !value.stop_sequences.every(v => typeof v === 'string'))) return false;
  for (const key of ['temperature', 'top_p', 'top_k']) if (value[key] !== undefined
    && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return false;
  return true;
}
function messageSchema(value: unknown, model: string): boolean {
  return record(value) && value.type === 'message' && typeof value.id === 'string' && value.id.length > 0
    && value.role === 'assistant' && value.model === model && Array.isArray(value.content)
    && value.content.every(v => record(v) && typeof v.type === 'string')
    && (value.stop_reason === null || typeof value.stop_reason === 'string')
    && record(value.usage) && Number.isSafeInteger(value.usage.input_tokens) && (value.usage.input_tokens as number) >= 0
    && Number.isSafeInteger(value.usage.output_tokens) && (value.usage.output_tokens as number) >= 0;
}
const envelope = (code: string): string => JSON.stringify({ type: 'error', error: { type: 'broker_error', message: code } });
const errorEvent = (code: string): string => `event: error\ndata: ${envelope(code)}\n\n`;

async function startCore(
  { attemptId, generationId, modelRef, limits: suppliedLimits, signal: ownerSignal }: PublicInput,
  credential: string | undefined, transport: BrokerTestTransportV1, destroyAgent: () => void,
): Promise<SubscriptionAttemptBrokerV1> {
  const limits = Object.freeze({ ...suppliedLimits });
  const selected = models[modelRef];
  let capability = randomBytes(32).toString('base64url');
  const started = Date.now();
  let admitting = false;
  let stopping = false;
  let serverClosed = false;
  let reason: SubscriptionAttemptBrokerStopV1 = 'completed';
  let terminalCode: string | null = null;
  let acceptedRequests = 0;
  let reservedTokens = 0;
  let responseBytes = 0;
  let redactions = 0;
  let resolveClosed!: (receipt: SubscriptionAttemptBrokerReceiptV1) => void;
  let receiptResolved = false;
  let drainTimer: NodeJS.Timeout | undefined;
  let attemptTimer: NodeJS.Timeout | undefined;
  const closed = new Promise<SubscriptionAttemptBrokerReceiptV1>(resolve => { resolveClosed = resolve; });
  const sockets = new Set<Socket>();
  const custody = new Set<object>();
  const upstreamAborts = new Set<() => void>();
  let active: { controller: AbortController; response: ServerResponse; timer: NodeJS.Timeout; idle: NodeJS.Timeout } | undefined;
  const server = http.createServer({ maxHeaderSize: 16384, requestTimeout: 0, headersTimeout: 0 });
  server.maxConnections = 4;
  server.maxRequestsPerSocket = 1;

  function receipt(status: SubscriptionAttemptBrokerReceiptV1['status']): void {
    if (receiptResolved) return;
    receiptResolved = true;
    resolveClosed(Object.freeze({ status, reason, acceptedRequests, responseBytes, redactions, terminalCode }));
  }
  function checkCustody(): void {
    if (!stopping || !serverClosed || sockets.size || custody.size) return;
    if (drainTimer) clearTimeout(drainTimer);
    credential = undefined;
    receipt('closed');
  }
  function trackClose(emitter: ClientRequest | IncomingMessage | Socket): void {
    if (emitter.closed) return;
    custody.add(emitter);
    emitter.once('close', () => { custody.delete(emitter); checkCustody(); });
    // All owned error paths are consumed; none become uncaught events or worker-visible text.
    emitter.on('error', () => {});
  }
  function stop(why: SubscriptionAttemptBrokerStopV1): Promise<SubscriptionAttemptBrokerReceiptV1> {
    if (stopping) return closed;
    stopping = true; admitting = false; capability = '';
    reason = ['completed', 'owner-abort', 'deadline', 'refused'].includes(why) ? why : 'refused';
    if (why === 'owner-abort') terminalCode ??= 'OWNER_ABORT';
    if (why === 'deadline') terminalCode ??= 'DEADLINE';
    if (attemptTimer) clearTimeout(attemptTimer);
    ownerSignal.removeEventListener('abort', ownerAbort);
    if (active) { clearTimeout(active.timer); clearTimeout(active.idle); active.controller.abort(); }
    for (const abort of upstreamAborts) { try { abort(); } catch { /* custody remains outstanding */ } }
    server.close(() => { serverClosed = true; checkCustody(); });
    for (const socket of sockets) socket.destroy();
    destroyAgent();
    drainTimer = setTimeout(() => receipt('custody-uncertain'), 2000);
    checkCustody();
    return closed;
  }
  function ownerAbort(): void { void stop('owner-abort'); }
  function fixed(res: ServerResponse, status: number, code: string): void {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', connection: 'close' });
    res.end(envelope(code));
  }
  function fail(res: ServerResponse, status: number, code: string): void {
    if (stopping) return;
    admitting = false; terminalCode ??= code;
    if (active) { clearTimeout(active.idle); clearTimeout(active.timer); active.controller.abort(); }
    const done = () => { void stop('refused'); };
    res.once('finish', done); res.once('close', done);
    if (res.destroyed) { done(); return; }
    if (res.headersSent) res.end(errorEvent(code));
    else fixed(res, status, code);
  }
  function capabilityMatches(header: unknown): boolean {
    if (typeof header !== 'string') return false;
    const expected = Buffer.from(capability); const actual = Buffer.from(header);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  function checkHeaders(req: IncomingMessage, host: string): boolean {
    const seen = new Set<string>();
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i].toLowerCase();
      if ((criticalHeaders.has(name) && seen.has(name)) || name === 'forwarded' || name.startsWith('x-forwarded-')
        || name.startsWith('proxy-') || name === 'x-original-url' || name === 'x-rewrite-url') return false;
      seen.add(name);
    }
    const h = req.headers;
    if (h.host !== host || h.origin !== undefined || h.expect !== undefined || h.trailer !== undefined
      || h['content-encoding'] !== undefined || h.upgrade !== undefined
      || (h['content-length'] !== undefined && h['transfer-encoding'] !== undefined)
      || (h['transfer-encoding'] !== undefined && h['transfer-encoding'] !== 'chunked')
      || typeof h['content-type'] !== 'string' || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(h['content-type'])
      || (h['anthropic-version'] !== undefined && h['anthropic-version'] !== '2023-06-01')) return false;
    if (h['anthropic-beta'] !== undefined && (typeof h['anthropic-beta'] !== 'string'
      || !h['anthropic-beta'].split(',').every(name => betaNames.has(name.trim())))) return false;
    return true;
  }
  function redact(bytes: Buffer): Buffer {
    const filter = createSubscriptionCredentialRedactorV1(credential!);
    try { const result = Buffer.concat([filter.push(bytes), filter.finish()]); redactions += filter.redactions; return result; }
    finally { filter.discard(); }
  }
  async function write(res: ServerResponse, bytes: Buffer): Promise<void> {
    if (res.destroyed || stopping) throw new Error('DISCONNECTED');
    if (res.write(bytes)) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { res.off('drain', drained); res.off('close', disconnected); res.off('error', disconnected); };
      const drained = () => { cleanup(); resolve(); };
      const disconnected = () => { cleanup(); reject(new Error('DISCONNECTED')); };
      res.once('drain', drained); res.once('close', disconnected); res.once('error', disconnected);
    });
  }

  let host = '';
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.on('error', () => {});
    if (!admitting) { fixed(res, 410, 'CLOSING'); return; }
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')
      || !capabilityMatches(authorization.slice(7))
      || (req.headers['x-api-key'] !== undefined && !capabilityMatches(req.headers['x-api-key']))) {
      fixed(res, 401, 'CAP_REJECTED'); return;
    }
    if (!checkHeaders(req, host)) { fail(res, 400, 'MALFORMED'); return; }
    if (req.url !== '/v1/messages') { fail(res, 404, 'PATH_REJECTED'); return; }
    if (req.method !== 'POST') { fail(res, 405, 'METHOD_REJECTED'); return; }
    if (active || custody.size) { fail(res, 409, 'CONCURRENT'); return; }
    const controller = new AbortController();
    const operation = { controller, response: res,
      timer: setTimeout(() => fail(res, 504, 'REQUEST_TIMEOUT'), limits.requestMs),
      idle: setTimeout(() => fail(res, 504, 'IDLE_TIMEOUT'), limits.idleMs) };
    active = operation;
    const refreshIdle = () => operation.idle.refresh();
    const disconnected = () => { if (!res.writableFinished && !stopping) { terminalCode ??= 'DISCONNECTED'; void stop('refused'); } };
    res.once('close', disconnected);
    req.once('aborted', disconnected);
    try {
      const chunks: Buffer[] = []; let count = 0;
      const declared = req.headers['content-length'];
      if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > limits.maxRequestBytes)) {
        fail(res, 413, 'BYTES'); return;
      }
      for await (const chunk of req) {
        if (controller.signal.aborted || stopping) return;
        if (chunk.length > limits.maxRequestBytes - count) { fail(res, 413, 'BYTES'); return; }
        count += chunk.length; chunks.push(chunk); refreshIdle();
      }
      if (controller.signal.aborted || stopping) return;
      if (Object.keys(req.trailers).length) { fail(res, 400, 'MALFORMED'); return; }
      const bytes = Buffer.concat(chunks, count);
      let value: unknown;
      try { value = parseJson(bytes); } catch { fail(res, 400, 'MALFORMED'); return; }
      if (!requestSchema(value)) { fail(res, 400, 'MALFORMED'); return; }
      if (value.model !== selected.modelId) { fail(res, 403, 'MODEL_REJECTED'); return; }
      if (acceptedRequests >= limits.maxRequests || value.max_tokens > limits.maxOutputTokens
        || value.max_tokens > limits.maxTotalOutputTokens - reservedTokens) { fail(res, 429, 'BUDGET'); return; }
      acceptedRequests++; reservedTokens += value.max_tokens;
      const upstream = transport.open({ url: selected.url, path: selected.path, method: 'POST', body: bytes,
        signal: controller.signal, headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json',
          'content-length': String(bytes.length), accept: value.stream ? 'text/event-stream' : 'application/json',
          'anthropic-version': '2023-06-01', 'user-agent': 'setfarm-subscription-attempt-broker-v1' } });
      const abort = () => upstream.abort();
      upstreamAborts.add(abort);
      trackClose(upstream.request);
      upstream.request.on('information', () => fail(res, 502, 'UPSTREAM_REJECTED'));
      upstream.request.on('upgrade', (response, socket) => {
        trackClose(response); trackClose(socket);
        response.destroy(); socket.destroy(); fail(res, 502, 'UPSTREAM_REJECTED');
      });
      upstream.request.on('socket', trackClose);
      if (upstream.request.socket) trackClose(upstream.request.socket);
      const transportToken = {}; custody.add(transportToken);
      // A rejection is not evidence of physical closure. Retain custody until a fulfilled close.
      void upstream.closed.then(() => { custody.delete(transportToken); upstreamAborts.delete(abort); checkCustody(); }, () => {});
      const responseToken = {}; custody.add(responseToken);
      let response: IncomingMessage;
      try {
        response = await upstream.response;
        trackClose(response);
        if (response.socket) trackClose(response.socket);
      } finally { custody.delete(responseToken); checkCustody(); }
      if (stopping || controller.signal.aborted) { response.destroy(); return; }
      refreshIdle();
      const status = response.statusCode ?? 0;
      if (status !== 200) {
        response.destroy();
        fail(res, status === 429 ? 429 : 502, status === 401 || status === 403 ? 'AUTH_REJECTED' : status === 429 ? 'QUOTA' : 'UPSTREAM_REJECTED'); return;
      }
      const mime = response.headers['content-type'];
      const sse = typeof mime === 'string' && /^text\/event-stream(?:\s*;\s*charset=utf-8)?$/i.test(mime);
      const json = typeof mime === 'string' && /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(mime);
      if (response.headers['content-encoding'] !== undefined || (!sse && !json) || sse !== Boolean(value.stream)) {
        response.destroy(); fail(res, 502, 'UPSTREAM_INVALID'); return;
      }
      let rawBytes = 0;
      function account(chunk: Buffer): void {
        if (chunk.length > limits.maxResponseBytes - rawBytes || chunk.length > limits.maxTotalResponseBytes - responseBytes) {
          throw new Error('UPSTREAM_LIMIT');
        }
        rawBytes += chunk.length; responseBytes += chunk.length; refreshIdle();
      }
      if (json) {
        const responseChunks: Buffer[] = [];
        for await (const chunk of response) { account(chunk); responseChunks.push(chunk); }
        const complete = Buffer.concat(responseChunks, rawBytes);
        let parsed: unknown;
        try { parsed = parseJson(complete); } catch { fail(res, 502, 'UPSTREAM_INVALID'); return; }
        if (!response.complete || !messageSchema(parsed, selected.modelId)) { fail(res, 502, 'UPSTREAM_INVALID'); return; }
        const filtered = redact(complete);
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', connection: 'close' });
        await write(res, filtered); res.end();
      } else {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'close' });
        let pending = Buffer.alloc(0);
        let heldStop: Buffer | undefined;
        const trailingComments: Buffer[] = [];
        let sawStart = false;
        async function frame(bytes: Buffer): Promise<void> {
          let text: string;
          try { text = decoder.decode(bytes); } catch { throw new Error('UPSTREAM_INVALID'); }
          const data: string[] = []; let name = '';
          for (const line of text.split(/\r?\n/)) {
            if (line.startsWith(':') || line === '') continue;
            const colon = line.indexOf(':');
            const field = colon < 0 ? line : line.slice(0, colon);
            const fieldValue = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
            if (field === 'data') data.push(fieldValue);
            if (field === 'event') name = fieldValue;
          }
          if (name === 'error') throw new Error('UPSTREAM_REJECTED');
          if (name === 'message_stop' && !data.length) throw new Error('UPSTREAM_INVALID');
          let parsed: unknown;
          if (data.length) {
            try { parsed = JSON.parse(data.join('\n')); } catch { throw new Error('UPSTREAM_INVALID'); }
            if (!record(parsed) || typeof parsed.type !== 'string') throw new Error('UPSTREAM_INVALID');
            if (parsed.type === 'error') throw new Error('UPSTREAM_REJECTED');
            if (name && name !== parsed.type) throw new Error('UPSTREAM_INVALID');
            if (heldStop) throw new Error('UPSTREAM_INVALID');
            if (parsed.type === 'message_start') {
              if (sawStart || !messageSchema(parsed.message, selected.modelId)) throw new Error('UPSTREAM_INVALID');
              sawStart = true;
            }
            if (parsed.type === 'message_stop') {
              if (!sawStart) throw new Error('UPSTREAM_INVALID');
              heldStop = bytes; return;
            }
          }
          // Preserve complete comments after stop in wire order. Their total retained
          // bytes remain charged to the response/aggregate caps; data after stop fails above.
          if (heldStop) { trailingComments.push(bytes); return; }
          await write(res, redact(bytes));
        }
        for await (const chunk of response) {
          account(chunk);
          // Slice incrementally so neither chunk coalescing nor a malicious unframed event can grow the queue.
          for (let offset = 0; offset < chunk.length;) {
            const take = Math.min(chunk.length - offset, limits.maxSseEventBytes - pending.length);
            if (take <= 0) throw new Error('UPSTREAM_LIMIT');
            pending = Buffer.concat([pending, chunk.subarray(offset, offset + take)]); offset += take;
            for (;;) {
              // Blank lines delimit events with either LF or CRLF (including mixed line endings).
              const match = /\r?\n\r?\n/.exec(pending.toString('latin1'));
              if (!match) break;
              const end = match.index + match[0].length;
              const complete = pending.subarray(0, end); pending = Buffer.from(pending.subarray(end));
              await frame(complete);
            }
          }
        }
        if (!response.complete || pending.length || !heldStop) throw new Error('UPSTREAM_INVALID');
        await write(res, redact(heldStop));
        for (const comment of trailingComments) await write(res, redact(comment));
        res.end();
      }
    } catch (error) {
      if (!stopping && admitting) {
        const code = error instanceof Error && ['UPSTREAM_LIMIT', 'UPSTREAM_INVALID', 'UPSTREAM_REJECTED'].includes(error.message)
          ? error.message : 'UPSTREAM_REJECTED';
        fail(res, 502, code);
      }
    } finally {
      clearTimeout(operation.timer); clearTimeout(operation.idle);
      if (active === operation) active = undefined;
    }
  }
  server.on('connection', socket => {
    sockets.add(socket);
    const headerTimer = setTimeout(() => socket.destroy(), Math.max(1, Math.min(5000, limits.attemptMs - (Date.now() - started))));
    socket.once('close', () => { clearTimeout(headerTimer); sockets.delete(socket); checkCustody(); });
    socket.on('error', () => {});
    // This server uses one request per connection, so a socket-local header deadline has no reset ambiguity.
    const onRequest = (req: IncomingMessage) => { if (req.socket === socket) { clearTimeout(headerTimer); server.off('request', onRequest); } };
    server.on('request', onRequest);
    socket.once('close', () => server.off('request', onRequest));
    if (!admitting) socket.destroy();
  });
  server.on('request', (req, res) => { void handle(req, res); });
  server.on('checkContinue', (req, res) => { void handle(req, res); });
  server.on('checkExpectation', (req, res) => { void handle(req, res); });
  const rejectSwitch = () => { terminalCode ??= 'MALFORMED'; void stop('refused'); };
  server.on('upgrade', rejectSwitch);
  server.on('connect', rejectSwitch);
  server.on('clientError', (_error, socket) => {
    // Parser ambiguity cannot establish a trustworthy authentication boundary. Burn the
    // attempt conservatively; this primitive makes no hostile same-UID availability claim.
    admitting = false; terminalCode ??= 'MALFORMED';
    // A peer may keep its write half open after our FIN. Start owned draining once
    // the fixed response is flushed, without waiting for the peer to close its half.
    socket.once('finish', () => { void stop('refused'); });
    socket.once('close', () => { void stop('refused'); });
    if (socket.writable && !socket.writableEnded) socket.end(`HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(envelope('MALFORMED'))}\r\n\r\n${envelope('MALFORMED')}`);
    else socket.destroy();
  });
  ownerSignal.addEventListener('abort', ownerAbort, { once: true });
  attemptTimer = setTimeout(() => { void stop('deadline'); }, limits.attemptMs);
  try {
    if (ownerSignal.aborted) throw new Error('BROKER_OWNER_ABORT');
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { server.off('error', error); ownerSignal.removeEventListener('abort', aborted); };
      const error = () => { cleanup(); reject(new Error('BROKER_BIND_FAILED')); };
      const aborted = () => { cleanup(); reject(new Error('BROKER_OWNER_ABORT')); };
      server.once('error', error);
      ownerSignal.addEventListener('abort', aborted, { once: true });
      server.listen(0, '127.0.0.1', () => { cleanup(); resolve(); });
    });
    server.on('error', () => { terminalCode ??= 'LISTENER_FAILED'; void stop('refused'); });
    if (stopping || ownerSignal.aborted) throw new Error('BROKER_OWNER_ABORT');
    host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    admitting = true;
    const worker: SubscriptionAttemptBrokerWorkerV1 = Object.freeze({ attemptId, generationId, modelRef,
      providerId: selected.providerId, modelId: selected.modelId, baseUrl: `http://${host}/v1`,
      api: 'anthropic-messages', apiKey: capability, auth: 'api-key', authHeader: true });
    return Object.freeze({ worker, stop, closed });
  } catch {
    await stop(ownerSignal.aborted ? 'owner-abort' : 'refused');
    throw new Error(ownerSignal.aborted ? 'BROKER_OWNER_ABORT' : 'BROKER_BIND_FAILED');
  }
}
