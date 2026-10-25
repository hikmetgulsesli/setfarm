# Subscription Attempt Broker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the subscription credential outside the model worker while supplying a bounded native Anthropic protocol connection for the approved MiniMax and Kimi models.

**Architecture:** A fresh parent-owned loopback broker replaces worker capability authentication with the provider credential at a fixed HTTPS endpoint. A pure bounded byte matcher filters known credential representations before worker persistence. The component has no operational call site; current Codex admission and all existing material/runtime guards remain authoritative.

**Tech Stack:** TypeScript ESM, Node HTTP/HTTPS/crypto/streams, node:test, existing tsx/TypeScript; no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-subscription-attempt-broker-design.md`, including its binding Source implementation constraints. Read the spec for complete wire/lifecycle semantics; workers receive only their task brief and that spec, never another task's whole plan.

## Global Constraints

- Only the five Source/test files in the File Map plus this spec/plan are in scope. No dependencies, spawner, installation records or CLI changes.
- No real credentials, provider calls, shared configuration, role/ACL changes, service rollout, selected-runtime guard change, or DB effects in this work. Both models use existing subscriptions only; no PAYG or implicit fallback.
- Root alone stages, commits, pushes and delivers. Workers never do delivery, builds or subagent dispatch. Preserve the sole writer and all existing data.
- Production construction accepts no transport/URL/port override. The separate non-JSON synthetic constructor always creates its own fake credential and rejects a caller-supplied credential.
- Full Setfarm build requires clean main == origin/main. Pre-merge validation is focused tests plus no-emit TypeScript. The full guarded build is performed only after reviewed normal merge in a new exact-main release clone.
- Import is inert. Receipt closed requires actual listener/socket/upstream settlement; a drain timeout yields custody-uncertain, never clean closure.
- Same-UID OS isolation, actual exec-tool inheritance, Source/Task6A material admission, full8 and live model activation remain separate open boundaries.

## File Map and causal scope

The actual fake-credential SDK experiment persisted a credential after source reread failure. This component fixes that systemic input boundary by supplying only an expiring per-attempt capability to the SDK; no installed-library patch or guard relaxation. The prior actual SDK test remains failed and is not reclassified by synthetic component tests.

| File | Responsibility |
| --- | --- |
| `src/execution/subscription-credential-redactor-v1.ts` | Pure exact-variant bounded byte matcher. |
| `tests/execution-attempts/subscription-credential-redactor-v1.test.ts` | Independent oracle, all splits, preservation, EOF/abort. |
| `src/execution/subscription-attempt-broker-v1.ts` | Fixed endpoints, listener/transport, validation, JSON/SSE, lifecycle and synthetic seam. |
| `tests/execution-attempts/subscription-attempt-broker-v1.test.ts` | Real owned loopback protocol/refusal/budget/lifecycle tests. |
| `tests/execution-attempts/subscription-attempt-broker-worker-boundary-v1.test.ts` | Dummy worker persistence/reflection and nonactivation boundary. |

### Task 1: Pure bounded credential redactor

**Files:** Create the redactor Source and matching test from the File Map only.

**Context and constraints:** Read the Spec's redaction algorithm and binding constraints. Follow all Global Constraints above. No IO, config, environment, runtime or DB imports. Visible ASCII credential length 16–4096; reject whitespace/control or replacement collision with a fixed error code, never interpolate the input.

**Interfaces:** Export `createSubscriptionCredentialRedactorV1(credential: string)` and `SubscriptionCredentialRedactorV1` with `push(chunk: Buffer): Buffer`, `finish(): Buffer`, `discard(): void`, readonly `redactions: number`, readonly `pendingBytes: number`. `finish` is idempotent with empty later returns; `push` after finish/discard rejects with fixed error. `discard` clears pending bytes and closes without flushing. Each match increments redactions once. No public raw variants or credential hashes.

- [ ] **Step 1: Write causal RED tests with independent oracle.**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSubscriptionCredentialRedactorV1 } from '../../src/execution/subscription-credential-redactor-v1.js';
const key = 'fake-subscription-A+/09';
const marker = '[REDACTED_SUBSCRIPTION_CREDENTIAL]';
test('raw key across every split is filtered before completion', () => {
  const source = Buffer.from(`before:${key}:after`);
  for (let split = 0; split <= source.length; split++) {
    const r = createSubscriptionCredentialRedactorV1(key);
    const output = Buffer.concat([r.push(source.subarray(0, split)), r.push(source.subarray(split)), r.finish()]);
    assert.equal(output.toString(), `before:${marker}:after`);
    assert.equal(r.redactions, 1);
    assert.equal(r.pendingBytes, 0);
  }
});
```

Add an independent whole-buffer reference matcher (not importing production helpers): derive expected variants separately, scan leftmost-longest and compare outputs. Cover raw, JSON.stringify interior, percent upper/lower/form, base64/base64url padded/unpadded, all-character JSON unicode escapes upper/lower hex, deduplication, every split of every spelling, byte-at-a-time and deterministic mixed partitions, adjacent/overlap/near matches, all tails at EOF, abort discarding withheld prefix, empty chunks, repeated finish, invalid type/length/control, marker collision, and large input preservation. Assert pending <= longestVariantLength - 1 after every push. The fixture literal is synthetic only.

- [ ] **Step 2: Run the focused test and retain missing-module RED output.**

Run with Node's existing `--import tsx --test` on this one file in a Python subprocess whose environment removes all `SETFARM_*` and `PG*` variables. Capture command/output/exit; no blanket npm test.

- [ ] **Step 3: Implement the bounded streaming matcher.**

Use deduplicated Buffer variants and leftmost-longest search, at most L-1 undecided bytes across calls. Process incoming buffers in bounded slices rather than concatenating whole upstream responses. At each cursor only decide with L bytes available, except EOF. Emit the fixed marker for a match; retain the undecided suffix. Zero/discard mutable pending buffers when practical. This algorithm's control structure is:

```ts
// In a bounded working buffer, EOF decides every remaining position.
while (cursor < data.length && (eof || data.length - cursor >= longest)) {
  const match = variants.find(v => data.subarray(cursor, cursor + v.length).equals(v));
  if (match) { emitMarker(); cursor += match.length; count++; }
  else { emitByte(data[cursor]); cursor++; }
}
// Copy at most longest - 1 bytes into owned pending storage.
```

Sort variants longest first once. Never log inputs/variants; errors are fixed codes. Exact finite spelling coverage only, not arbitrary transformations, delta reconstruction, OS isolation or cryptographic erasure.

- [ ] **Step 4: Run focused GREEN plus `./node_modules/.bin/tsc --noEmit`; inspect both exits.** Retain the actual results in the task report. Self-review for memory growth, encoding correctness and false-positive corruption.
- [ ] **Step 5: Report to Root without delivery.** Report changed files, causal RED/GREEN command/results, self-review and limits; Root commits, creates review package and obtains independent spec+quality review before Task 2.

### Task 2: Functional per-attempt broker and worker boundary tests

**Files:** Create the broker Source and both broker tests from File Map only. Consume reviewed Task 1 redactor unchanged; any necessary redactor change must be proposed to Root for serialized author fix/review.

**Context and constraints:** Read the complete Spec, including binding Source constraints. Follow all Global Constraints above. No operational imports/call site, environment/profile/key lookup, private gateway use, config edits or installed patches. The worker receives only the returned binding. Preserve actual failed SDK results as failed.

**Interfaces:** Consume `createSubscriptionCredentialRedactorV1` API from Task 1. Export the Spec's exact production/synthetic factory signatures, assigning names `SubscriptionAttemptBrokerInputV1`, `SubscriptionAttemptBrokerLimitsV1`, `SubscriptionAttemptBrokerV1`, `SubscriptionAttemptBrokerReceiptV1`, `SubscriptionAttemptBrokerWorkerV1`, `SubscriptionAttemptBrokerStopV1`, `BrokerTestTransportV1`, and `BrokerTestTransportRequestV1`. Types match Spec field-for-field. The transport request also includes readonly `url: string`, computed exclusively from the fixed model table, so tests can verify the actual mapping; production accepts no URL override.

- [ ] **Step 1: Write real owned-loopback causal RED tests.**

Use `http.createServer` on 127.0.0.1:0, never ports3080/3333/18789. An injected synthetic transport returns original ClientRequest, response promise, explicit closed promise and abort method; it sends the exact body once to the owned mock only. The synthetic constructor generates its fake internally and refuses an input credential. A representative request is:

```ts
const body = JSON.stringify({ model: broker.worker.modelId, max_tokens: 128,
  stream: false, messages: [{ role: 'user', content: 'synthetic protocol check' }] });
const response = await fetch(`${broker.worker.baseUrl}/messages`, {
  method: 'POST', headers: { authorization: `Bearer ${broker.worker.apiKey}`,
  'content-type': 'application/json' }, body });
assert.equal(response.status, 200);
```

The binding baseUrl ends `/v1`. Use explicit mandatory test limits: maxRequests4, maxOutputTokens2048, maxTotalOutputTokens8192, maxRequestBytes65536, maxResponseBytes131072, maxTotalResponseBytes524288, maxSseEventBytes32768, attemptMs10000, requestMs5000, idleMs2000. Override to smaller values for causal caps; no inferred provider maxima.

Both fixed models: assert transport fixed URL/path, raw model, fake upstream Bearer, never worker capability upstream; preserve two-call tool IDs/thinking/signatures/request bytes. SSE native events include message_start, thinking/signature/tool deltas, content closes, message_delta and message_stop. Validate LF/CRLF, multiline data, comments, chunks splitting delimiters, exact byte preservation outside finite matches.

- [ ] **Step 2: Run RED for the two new test files with the same scrubbed environment; retain evidence.**
- [ ] **Step 3: Implement strict validation, production HTTPS transport and request accounting.**

Reject extra input/limit keys, wrong types/IDs, credential invalidity and abort-before-bind. MiniMax production key must start sk-cp. All caps finite positive safe integers; per<=total, idle<=request<=attempt; Node timers <=2147483647. Fixed URLs only with explicit TLS verification and private non-proxy agent, no proxy/env/global-agent/redirect/retry/fallback. Fresh random32byte cap, numeric127.0.0.1:0 URL, one upstream, four sockets,16KiB header limit, header deadline min5000/remainingAttempt. Cap auth constant-time, optionalx-api-key samecap; discard client auth upstream. Only two beta names from Spec. Reject Origin/Expect/compression/trailers/forwarding, duplicate critical headers, CL+TE, badhost/path/method. Use exact fixed status/envelope codes from Spec, no raw errors.

Bounded UTF-8 body -> lexical duplicate decoded-object-key/depth64 check -> JSON.parse grammar -> root key/basic schema validation. Reject exactwrongmodel, token caps, nonbooleanstream, empty messages. Forward original Buffer. Reserve requests/output tokens before transport, no refund. Reject concurrent/stale/closed calls. Unknownrootfields forbidden, nestedtoolcontentopaque withinlimits.

- [ ] **Step 4: Implement response policy and complete framed SSE redaction.**

Non2xx body never forwarded;401/403->502AUTH_REJECTED,429->429QUOTA,others502UPSTREAM_REJECTED,3xx terminal nofollow. Drop upstream response headers except own normalizedMIME/framing/no-store. Validate complete bounded200JSON message envelope/exactmodel before any write; run redactor and finish. Buffer SSE completeboundedframes; detect event:error/JSONtype:error before forwarding, fixed terminal error only. Preserve normal complete frames, redraw no protocol values, use fresh redactor/finish per frame (variants have no CR/LF). Hold message_stop until validEOF with no trailingpartial/data; truncation cannot report success. Bound raw/per/aggregate bytes, idle/request/attempt timers and eventbytes. Implement response backpressure with drain/disconnect handling and no unbounded queue.

- [ ] **Step 5: Implement honest lifecycle custody.**

Track original listener, sockets, request/response and privateagent. Expose binding after handlers installed and bind complete. `stop` synchronously revokes admission, returns same promise for all calls, aborts upstream and closes owned sockets/listener/agent. Complete receipt requires actual allclosed;2s drain timeout returns custody-uncertain while retaining actual outstanding custody tracking. Counters and fixed terminalCode only, no messages/stacks/secrets. Ownerabort/deadline terminal, drop credential references when safe. Worker descendants separateowner responsibility.

- [ ] **Step 6: Complete causal negative and persistence tests.**

Tests must assert disallowed calls count0: badmodel/cap/path/method/schema/duplicate escapedkeys/depth/body/framing/count/token/aggregate/concurrency/stalegeneration; productionrejectsURL/transport/test fields; syntheticrejectscredential; fixedmapping;redirecttargetcount0/noretry. HTTP401/429/SSEerror reflection arbitrary escapedfake neverescapes; normal200 knownvariants are redacted. Abort beforebind/upload/headers/stream, workerdisconnect/backpressure/deadline/repeatedstop, actualsocketclosure and unsettledtransport=>custody-uncertain. Avoid tests that assert only implementation text.

Worker boundary test: create owned temp dir, write returned binding only as dummycfg/models/session/stdout, simulate loadedRaw fallback persistence, assert dummycap present and real fakeCredential/variants absent. Capture reflected responses too. This tests the component's input/output boundary, not installedSDK compatibility, realthinkingcrypto, execinheritance orOSisolation. Preserve fixture outputs until Root verification; cleanup only owned test temps with after hooks, never workspace/runtime data. Import-inert and nooperationalactivation assertion must use actual behavior/process state where feasible.

- [ ] **Step 7: Run all three focused test files and no-emit TypeScript; inspect exits and self-review.**

Same scrubbed env. Retain commands, exits and bounded output in report. No whole DB suite, provider traffic, build, delivery or service change.
- [ ] **Step 8: Report to Root without delivery.** Root reads full diff and actual tests, commits source/test files, obtains independent task spec+quality review, then broad whole-branch review on most capable model. Root alone pushes reviewed branch, reads current GitHub review/checks, performs normal exact-head merge and builds fresh clean-main release without guard bypass. New release remains unstarted pending separate runtime/material admission.
