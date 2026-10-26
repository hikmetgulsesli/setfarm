# Subscription attempt broker — source design, 2026-10-26

## Decision and scope

Per-attempt parent broker keeps key outside public CLI; worker gets loopback URL/fresh capability only. SDK fallback can persist capability, never key. Responses filtered before SDK persistence.

Design only; sole write this0600 report. No source/runtime/network/credential/service/git effects or tests. Root owns implementation.

Read AGENTS, accepted `subscription-gateway-free-auth-design-20261026-v1.md`, newer `subscription-private-fd-auth-original-diagnosis-20261026-v1.md` and current source. Original pins/FAILs stand: actual SDK persisted fake; reflection untested. No real exposure. Clean writer11128333fcf1451ad64915c07505604438185202.

## Alternatives

1. **Recommended: parent broker + public CLI.** Native protocol, key outside SDK cfg/heap/env/argv/disk. Separate capability/OS concerns.
2. **Repair SDK provenance.** More snapshot/writer/error work; still key in worker. Reject after actual persistence RED.
3. **Standalone service/FD transport.** Adds transfer/custody or changes SDK. Defer; no shared gateway18789.

## Five-file map

Relative paths; ESM `.js`, Node builtins/node:test. No dependency/operational edits. `S=src/execution/`, `T=tests/execution-attempts/`.

| File | Responsibility |
| --- | --- |
| S/subscription-attempt-broker-v1.ts | Fixed endpoints, real listener/transport, request/HTTP/SSE policy, limits, lifecycle, synthetic seam. |
| S/subscription-credential-redactor-v1.ts | Pure exact-variant bounded byte matcher. |
| T/subscription-attempt-broker-v1.test.ts | Real loopback requests/streaming/refusals/lifecycle. |
| T/subscription-credential-redactor-v1.test.ts | Split/overlap/EOF/preservation tests. |
| T/subscription-attempt-broker-worker-boundary-v1.test.ts | Dummy-only persistence, reflected response capture, nonactivation. |

## Exact internal API

```ts
type Model = "minimax/MiniMax-M3.1-Flash" | "kimi/k3.1-pro";
type Limits = Readonly<{
  maxRequests: number; maxOutputTokens: number; maxTotalOutputTokens: number;
  maxRequestBytes: number; maxResponseBytes: number; maxTotalResponseBytes: number;
  maxSseEventBytes: number;
  attemptMs: number; requestMs: number; idleMs: number;
}>;
type Input = Readonly<{
  attemptId: string; generationId: string; modelRef: Model;
  credential: string; limits: Limits; signal: AbortSignal;
}>;
type Binding = Readonly<{
  attemptId: string; generationId: string; modelRef: Model;
  providerId: "minimax" | "kimi";
  modelId: "MiniMax-M3.1-Flash" | "k3.1-pro";
  baseUrl: string; api: "anthropic-messages";
  apiKey: string; auth: "api-key"; authHeader: true;
}>;
type Stop = "completed" | "owner-abort" | "deadline" | "refused";
type Receipt = Readonly<{
  status: "closed" | "custody-uncertain"; reason: Stop;
  acceptedRequests: number; responseBytes: number; redactions: number;
  terminalCode: string | null;
}>;
type Broker = Readonly<{
  worker: Binding; stop(reason: Stop): Promise<Receipt>;
  closed: Promise<Receipt>;
}>;
startSubscriptionAttemptBrokerV1(input: Input): Promise<Broker>;
```

REQUIRED caller-owned finite positive safe-integer caps, no provider maxima/defaults. Require per-response<=aggregate, output-per-request<=total, idle<=request<=attempt; overflow-safe counters. Defaults:127.0.0.1 port0, one upstream in flight,4 sockets,16KiB headers,5s header deadline capped by remaining attempt,2s drain,32 random capability bytes. IDs1–128 safe ASCII identifier characters; credential16–4096 visible ASCII, no whitespace/control. Reject extra keys/bad shapes before bind without serialization.

Owner writes ONLY returned binding into private CLI cfg: selected model/empty fallbacks, private home/state/env and existing child/egress guards. No worker key/credential FD/handle/ambient store. Broker verifies capability, replaces worker auth with provider Bearer auth upstream. Capability remains spending authority: fresh each attempt/generation; listener closure revokes it. HTTP caller cannot change attempt identity.

Production accepts no URL/port/transport/proxy/headers/locator/fallback/test flag. Fixed mapping:

| Model ref | Raw model | Sole upstream URL |
| --- | --- | --- |
| minimax/MiniMax-M3.1-Flash | MiniMax-M3.1-Flash | https://api.minimax.io/anthropic/v1/messages |
| kimi/k3.1-pro | k3.1-pro | https://api.kimi.com/coding/v1/messages |

Use node:https.request/private agent, normal TLS verification, exact443/path/POST. No redirects/retry/proxy-env/global-agent/fallback/PAYG/purchase; fixed-host DNS is not OS egress proof.

## Non-JSON test seam

`startSubscriptionAttemptBrokerForTestV1(input: Omit<Input,"credential">, transport: BrokerTestTransportV1): Promise<{broker:Broker; fakeCredential:string}>` generates fake internally and shares core. Transport is source function, never JSON/env:

```ts
type TransportRequest = Readonly<{
  path: "/anthropic/v1/messages" | "/coding/v1/messages";
  method: "POST"; headers: Readonly<Record<string,string>>;
  body: Buffer; signal: AbortSignal;
}>;
type BrokerTestTransportV1 = Readonly<{
  open(input: TransportRequest): {
    request: import("node:http").ClientRequest;
    response: Promise<import("node:http").IncomingMessage>;
    closed: Promise<void>; abort(): void;
  };
}>;
```

Production adapter implements same private contract. Test adapter connects only owned127.0.0.1 ephemeral mock port, excluding18789/3080/3333. `open` installs handlers and sends the exact body once; `closed` tracks original request/response/socket settlement. Core calls once, never retries; raw rejection text never escapes. Only synthetic constructor accepts transport. Fake SDK fixture can call it; fake key is for mock/scans only. No productionAllowed stub or hostile-module boundary claim.

## Request/response semantics

Require POST origin-form `/v1/messages`, no query/alternate/upgrade; owned numeric Host, constant-time Bearer cap, JSON/UTF-8, no Origin/compression/Expect/trailers. Reject duplicate critical headers/CL+TE; count bytes for length or chunked upload. Refuse unsupported auth/beta/forwarding; ignore informational SDK headers. Upstream headers only Authorization/Content-Type/Length/Accept/anthropic-version2023-06-01/fixed user-agent.

Bound complete UTF-8 JSON; reject duplicate object names including escaped equivalents using bounded lexical check before JSON.parse, depth>64 and unknown top-level fields. Exact model, boolean stream, integer max_tokens within per/total caps, nonempty messages. Allow model/messages/system/max_tokens/stream/tools/tool_choice/thinking/temperature/top_p/top_k/stop_sequences/metadata with basic type/finite-number checks. Tool payload opaque within bounds. Forward original validated bytes; never rewrite/clamp model/tokens/thinking/signature. Reserve request count/max_tokens before upstream, no refund after failure.

Fixed Anthropic envelopes:401 cap;404 path;405 method;400 malformed;403 model;413 bytes;409 concurrent;429 budget;410 closing. No echoes. Authenticated protocol failure burns attempt; bad cap closes socket. No hostile same-UID availability claim.

Only normalized content-type/own framing/no-store; drop other upstream headers. Reject compression/unsupported MIME/1xx/3xx. Non2xx body NEVER forwarded: discard/destroy;401/403->502 AUTH_REJECTED,429->429 QUOTA, others->502 UPSTREAM_REJECTED. Terminal, no retry/fallback; arbitrary HTTP error reflections removed.

200 JSON: bounded buffer, complete basic message envelope validation, exact filtering before any worker write.200 SSE: incremental LF/CRLF event framing, event-byte cap, combine data lines for JSON inspection. `event:error` or JSON `type:error` becomes one fixed error event then termination; never forward upstream error data. Preserve normal events/comments/delimiters/thinking/signature/tool fragments except exact matches. Invalid UTF-8/data JSON, oversize/incomplete event or truncation yields fixed terminal SSE error; never append error into unfinished event or manufacture success. All normal body bytes also cross matcher. Honor backpressure and all byte/time caps; disconnect aborts upstream.

## Redaction algorithm and limits

`createSubscriptionCredentialRedactorV1(credential)` returns `push(Buffer):Buffer`, `finish():Buffer`, `discard():void`, count accessor. Variants: raw UTF-8; JSON.stringify interior; encodeURIComponent upper/lower percent spelling and form spelling; UTF-8 base64/base64url padded/unpadded; all-character ASCII JSON unicode escaping upper/lower hex. Deduplicate; replace exact matches with `[REDACTED_SUBSCRIPTION_CREDENTIAL]`. No regex guessing or key/hash/variant logging.

At cursor, leftmost-longest match; defer decision until L bytes lookahead or EOF (L=max variant length). Emit decided bytes/matches, retain<=L-1 undecided bytes across calls; process incoming chunks in bounded slices. Normal EOF inspects every remaining start before flush. Abort discards undecided tail; fixed errors contain no upstream data. SSE event buffer and matcher tail independently bounded. Small events can wait for lookahead.

Error suppression handles arbitrary escapes there. Matcher covers listed complete variants, not arbitrary transformations/slicing/mixed escapes or reconstruction across JSON deltas. Known variant collisions in thinking/signatures redact even if protocol validity suffers; other bytes unchanged. No malicious-exfiltration prevention claim.

## Lifecycle and admission

Creating->open->closing->closed; custody-uncertain if settlement unproven. Register listeners before exposing binding; track original server/sockets/request/response/agent. Stop synchronously revokes admission/cap, aborts upstream, closes sockets/server/agent and waits actual settlement. Idempotent stop shares receipt promise;2s expiry retains outstanding custody, never clean Promise.race success. Owner stops in finally; deadline backstop. Receipts/errors use fixed enums/codes/counts only. Drop key references/zero mutable buffers where practical; no JS/TLS/swap/core/debugger erasure claim. Worker descendants need separate custody.

No operational call site/env switch/API/fallback. Unit callable by fake SDK fixture. Later production composition must verify current Task6A OS/material/generation/admission BEFORE key acquisition/start through code-owned records/opaque membership, not caller booleans/types. I5 Codex guard untouched; primitive importability is not admission.

0600/localhost do not isolate same UID. Bundled discovery may ignore plugins-disabled/mode-replace; broker cannot stop worker egress/store reads. Preserve child/egress guards, never patch installed library/relax guards. OS/material/admission/native compatibility/full8 remain open; no role/credential/service effect or PAYG/Claude/Codex expansion.

## Tests and delivery boundary

- Real loopback both models: exact path/model/provider fake auth, not worker cap; two-call tool continuation preserves tool ID/thinking/signature bytes.
- Every variant at every split, byte-at-a-time/deterministic partitions, overlap/adjacent/near-match/EOF/abort; independent whole-buffer oracle; nonmatches unchanged, pending<=L-1.
- HTTP401/429 and SSE event:error/type:error reflect fake with arbitrary escaping: fixed worker errors only. Normal200 finite variants sanitized before capture.
- Synthetic loadedRaw fallback persists all worker cfg: models.json contains dummy cap, no fake variants in cfg/models/session/stdout/stderr. Proves input boundary, NOT actual SDK compatibility.
- Wrong model/cap/path/verb/schema/duplicate names/framing, token/body/count/aggregate/concurrency/stale generation: zero disallowed upstream calls. Redirect target mock sees zero. No retry after failure.
- Abort before bind/during upload/headers/stream, disconnect/backpressure/deadline/stop races: actual sockets/listener close, one receipt; unsettled transport -> custody-uncertain.
- Import inert; production rejects URL/transport/test fields; exact two endpoints; synthetic constructor rejects credential; guard unchanged/no operational calls.

Root: spec/plan, five-file implementation, focused tests/review, clean-source build without bypass. Fake CLI fixture retains metadata/discovery refusals and artifact scans. Synthetic fallback is not SDK qualification; retain original RED.


## Binding Source implementation constraints

- This is the functional broker primitive for the approved new-model objective.
  The causal root defect is the observed fake credential persistence after an
  SDK source reread failure; keeping the provider credential out of the SDK
  addresses that defect without changing the installed library.
- No real credentials, provider calls, shared configuration, role/ACL changes,
  service rollout, selected-runtime guard change, or DB effects in this work.
  Both models use existing subscriptions only; no PAYG or implicit fallback.
- Only the five Source/test files in the File Map plus this spec/plan are in
  scope. No dependencies, spawner, installation records or CLI changes.
- Root alone stages, commits, pushes and delivers. Workers never do delivery,
  builds or subagent dispatch. Preserve the sole writer and all existing data.
- Production construction accepts no transport/URL/port override. The separate
  non-JSON synthetic constructor always creates its own fake credential and
  rejects a caller-supplied credential. Caller-owned admission and verified
  subscription provenance precede later production use; this primitive grants
  no installation or claim admission.
- The MiniMax production credential must start with the existing Coding Plan
  prefix sk-cp. Kimi provenance remains the admitted caller's responsibility;
  the component never reads environment/profile stores or selects another key.
- TLS validation is explicit; use a private non-proxy HTTPS agent, fixed URLs
  and POST paths, no redirects/retries/global agent/environment proxy behavior.
- Incoming optional x-api-key must equal the same worker capability if present;
  strip it and all client auth upstream. Accept only the two existing native
  beta names (fine-grained-tool-streaming-2025-05-14 and
  interleaved-thinking-2025-05-14), never arbitrary auth/forwarding overrides.
  Provider auth is one owner-injected Bearer value; no client key is reused.
- Preserve request bytes after bounded lexical duplicate-name rejection and
  JSON semantic validation. The lexical check need only detect decoded object
  property duplicates/depth; JSON.parse remains the grammar validator.
- Credential variants contain no CR/LF because credentials are visible ASCII
  and encodings are whitespace-free. For SSE, buffer complete bounded events,
  filter error events first, then redact and finish the matcher per whole
  event before emission. Thus an error cannot follow an unfinished forwarded
  event. Never discard a prior normal event tail and append an error into it.
  Keep message_stop pending until complete upstream EOF and reject trailing
  partial/data frames; do not manufacture successful completion on truncation.
- Redaction replacement must not itself contain a credential variant; refuse
  such a credential before use with a fixed code. The matcher is exact finite
  variants, not a universal DLP or malicious-provider exfiltration guarantee.
- All resource limits are mandatory caller-owned finite safe integers. Timers
  must also fit Node's supported positive timeout range. These are resource
  reservations, never provider maxima, actual billing or usage estimates.
- Import is inert. Receipt closed requires actual listener/socket/upstream
  settlement; a drain timeout yields custody-uncertain, never clean closure.
- Full Setfarm build requires clean main == origin/main. Pre-merge validation
  is focused tests plus no-emit TypeScript. The full guarded build is performed
  only after reviewed normal merge in a new exact-main release clone.
- Same-UID OS isolation, actual exec-tool inheritance, Source/Task6A material
  admission, full8 and live model activation remain separate open boundaries.
