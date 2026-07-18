# Invocation Interface Authority V1 Design

Date: 2026-07-18

Status: approved shadow architecture; production activation is NO-GO

## Decision

Setfarm will not derive CLI argv, HTTP routes, request placement, response
capture, or persistence readback from action names, handler paths, stack
topology, generated source, runtime-evidence prose, or adapter fixtures.

The planner must declare one strict, versioned invocation interface for every
action before ProductSpecV2 is compiled. The Product Compiler resolves only
semantic keys to canonical ProductSpec refs and validates every-and-only
closure. It does not choose product ABI. InvocationInputTransportV2 is a later
release compiler that lowers the already-declared interface to code-owned
codecs, stack/profile identity, executable adapter signatures, and bounded
publication leaves.

This changes the dependency chain to:

```text
TaskRequirementLedgerV1
  -> PlanSemanticProposalV2 + ActionInvocationInterfaceIntentV1
  -> ProductSpecV2 + EvidencePredicateV2(action_invocation)
  -> ProductEvidenceCapabilityPolicyV2
  -> ProductDeliveryProfileV2 shadow selection
  -> PlatformReleaseManifestV2 + code-owned adapter catalog
  -> EvidenceAdapterRegistryV1 fresh authority
  -> InvocationInputTransportV2 action leaves
  -> SemanticSourceRuleSetActivationReceiptV1
  -> SemanticSourceIntentSetV1
```

The existing direct
`ProductSpecV2 logical input -> InvocationInputTransportV2` edge is rejected.

## Evidence For The Boundary

Before this slice, ProductSpecV2 inherited V1 trigger/input semantics. A logical
input contained only name, value type, requiredness, and optional entity-field
identity; an action trigger contained only `user`, `system`, `timer`, or
`route` and an optional source ref. It had no subcommand, flag, argv position,
stdin channel, HTTP method/path/query/body channel, typed result source, or
failure ABI. PlanSemanticProposalV2 had the same gap because its action schema
reused the V1 stable shape. The new nested schema closes that product-design
boundary without changing immutable ProductSpecV1
(`src/product-compiler/schemas/action-invocation-interface-intent-v1.ts`,
`src/product-compiler/schemas/plan-semantic-proposal-v2.ts`,
`src/product-compiler/schemas/product-spec-v2.ts`).

RuntimeEvidenceContractV1 has CLI/HTTP-shaped values, but production generation
supports browser stacks only. Its CLI/HTTP values are scenario literals already
embedded in argv/body rather than reusable input transport contracts
(`src/evidence/runtime-evidence-contract-producer-v1.ts:15-55`,
`src/evidence/runtime-evidence-contract-v1.ts:36-101`). Existing CLI/HTTP driver
tests manually inject those literals
(`tests/evidence/stack-runtime-evidence-driver.test.ts:206-417`).

BuildTopologyV1 is not product-interface authority. It can carry caller-supplied
command argv and an entrypoint path, but has no action-to-command or
action-to-endpoint join (`src/product-compiler/schemas/build-topology-v1.ts:133-178,220-237`,
`src/product-compiler/producers/build-topology.ts:308-329,388-427`).

The current capability policy is browser-specific: user/route triggers and
observable outcomes require browser interaction. The current delivery catalog
activates only Vite React and browser-game profiles
(`src/product-compiler/product-evidence-capability-policy.ts:88-118`,
`src/product-compiler/product-delivery-profile-catalog.ts:43-81,153-194`).

Therefore any transport compiler written before this boundary would have to
invent ABI. That would reproduce the exact upstream-specification failure that
later becomes regex classifiers, retry prose, and project-specific guards.

## Authority Ownership

### Planner-owned facts

The planner owns product-interface choices that can legitimately vary between
two products with the same logical action:

- whether the action is invoked by a rendered control, CLI command, HTTP
  request, or route entry;
- CLI subcommand tokens and the channel of every logical input;
- HTTP method, exact ProductSpec route, and the channel of every logical input;
- exact JSON result channel/pointer and success exit/status set;
- input-validation, precondition, and action-failure ABI, including disjoint
  exit/status codes and stable error shapes; and
- exact observable-to-result pointer bindings plus their expected semantic
  source.

These facts carry source requirement refs through their owning action. They are
not accepted later from implementation, setup, generated source, test code, or
review comments.

### Product Compiler-owned facts

The compiler owns:

- stable ProductSpec IDs and semantic-key resolution;
- every-and-only action/input/route/observable closure;
- invocation-interface and trigger/control compatibility;
- exact `action_invocation` evidence identity and traceability;
- canonical ordering and content hashes; and
- rejection diagnostics.

It never selects a missing flag, endpoint, field channel, output pointer, or
readback action.

### Release-owned facts

The release owns executable facts that are not product design:

- stack/profile identity and exact selected launcher;
- value and wire codec implementations;
- runner and parser bytes;
- adapter support signatures;
- environment/runtime-data mounts; and
- platform bundle and toolchain identities.

These facts enter only through a fresh-verified PlatformReleaseManifestV2 and
code-owned adapter catalog. Caller-authored hashes are not release authority.

## Nested Action Contract

Every PlanActionV2 and ProductActionV2 carries exactly one
`invocationInterface` whose nested schema identity is
`setfarm.action-invocation-interface-intent.v1`.

The variants are:

```ts
type ActionInvocationInterfaceIntentV1 =
  | RenderedControlInvocationIntentV1
  | CliInvocationIntentV1
  | HttpInvocationIntentV1
  | RouteEntryInvocationIntentV1;
```

### Rendered control

```ts
{
  schema: "setfarm.action-invocation-interface-intent.v1";
  kind: "rendered_control";
}
```

It is valid only for a user-triggered action with one or more explicit control
placements, one selected evidence control, and no legacy `trigger.sourceRef`.
The exact control placement is the sole rendered invocation identity. Control
refs remain in the existing control-placement/evidence-scenario authority and
are not duplicated inside this object.

Active rendered V1 accepts only required inputs. Optional/default/absence
semantics have no evidence contract yet. `date` and `datetime` rendered inputs
also remain rejected because the active browser release has no owned DOM codec
for them. These incompatibilities fail at Plan/ProductSpec authority, not later
in DesignTargets or ActionInputTransportV2.

### CLI command

```ts
{
  schema: "setfarm.action-invocation-interface-intent.v1";
  kind: "cli_command";
  subcommandTokens: string[];
  fieldBindings: Array<{
    fieldName: string;
    optionalPresence: "not_applicable";
    channel:
      | { kind: "argv_position"; position: number }
      | { kind: "argv_flag"; flag: `--${string}`; style: "separate" | "equals" }
      | {
          kind: "stdin_json_pointer";
          pointer: string;
          containerPolicy: "object_intermediates";
        };
  }>;
  result: {
    kind: "stdout_json";
    successExitCodes: number[];
    valuePointer: string;
    failureCases: Array<{
      kind: "input_validation" | "precondition" | "action_failure";
      exitCodes: number[];
      channel: "stderr_json";
      errorCode: string;
      codePointer: string;
      messagePointer: string;
    }>;
  };
}
```

The launcher is deliberately absent. ProductDeliveryProfileV2 and
PlatformReleaseManifestV2 own the executable command. Every V1 logical input is
required and bound exactly once. Optional omission, null, and default semantics
remain unsupported until a versioned absence contract plus absence evidence
exists. Subcommand sequences are product-wide prefix-free, including the empty
root sequence, so a dispatcher never invents longest-prefix precedence.

The compiler rejects missing/extra fields, duplicate positions/flags,
non-contiguous argv positions, overlapping JSON pointers, non-canonical CLI
tokens, incomplete or overlapping failure cases, and non-JSON result proposals.
Planner arrays may arrive in any order; the compiler sorts field bindings,
numeric code sets, and failure cases before ProductSpec canonical validation.
V1 subcommand tokens are canonical lowercase ASCII.

For `stdin_json_pointer`, an empty pointer means the field value is the complete
stdin JSON document. For a non-empty pointer, the document root and every
intermediate container are JSON objects; pointer tokens never imply arrays.
This rule is machine-readable through `containerPolicy`, and duplicate,
ancestor/descendant, and root/child pointer pairs are rejected.
Environment input is deliberately unsupported until a later schema has typed
sensitivity and release-owned credential-source authority; it is not filtered
by a growing credential-name classifier.

### HTTP request

```ts
{
  schema: "setfarm.action-invocation-interface-intent.v1";
  kind: "http_request";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  routeKey: PlanSemanticKeyV2; // ProductSpec form carries routeRef
  fieldBindings: Array<{
    fieldName: string;
    optionalPresence: "not_applicable";
    channel:
      | { kind: "path_parameter"; name: string }
      | { kind: "query_parameter"; name: string }
      | {
          kind: "json_body_pointer";
          pointer: string;
          containerPolicy: "object_intermediates";
        };
  }>;
  result: {
    kind: "response_json";
    successStatusCodes: number[];
    valuePointer: string;
    failureCases: Array<{
      kind: "input_validation" | "precondition" | "action_failure";
      statusCodes: number[];
      channel: "response_json";
      errorCode: string;
      codePointer: string;
      messagePointer: string;
    }>;
  };
}
```

The ProductSpec route path is the endpoint-template authority. Every template
placeholder is bound exactly once and every path binding names a placeholder.
V1 path-parameter names use the portable ASCII identifier grammar
`[A-Za-z][A-Za-z0-9_]*`; dot and hyphen remain legal in static path segments or
query parameter names, never inside one placeholder identity. This is also the
exact grammar required by the selected Node Express stack.
GET body fields, non-origin-relative/ambiguous paths, duplicate channels,
overlapping JSON pointers, no-content JSON success statuses, incomplete or
overlapping failure cases, and non-JSON results are rejected. Header input is
deliberately unsupported until typed sensitivity and credential-source
authority exists; V1 does not attempt header-name classification.

The stdin object-construction rule applies identically to HTTP JSON bodies.
Within one HTTP method, route-template languages must be disjoint: for example,
`/items/:id` overlaps both `/items/new` and `/items/:name`. Different methods may
share one path. Overlap proof is capped at 100,000 route comparisons; exceeding
that global work authority is a typed rejection, never unbounded schema work.

### Route entry and runtime event exclusion

Route entry is valid only for `trigger.kind=route` and resolves an exact
Plan route key to ProductSpec route ref. It is restricted to web, mobile,
desktop, and game delivery; CLI/API semantic routes do not imply a navigation
entry runtime.

`runtime_event` was removed from V1. A patterned string plus a matching legacy
`trigger.sourceRef` does not specify timer schedule/timezone/start behavior or
one exact system lifecycle producer. Timer/system invocation remains NO-GO
until a versioned RuntimeEventSource artifact owns those facts.

## Observable And Evidence Semantics

ProductSpecV2 defines EvidencePredicateV2. It adds the generic
`action_invocation` predicate; V1 remains unchanged. Each action receives one
compiler-owned required predicate whose subject is the exact action ref. Its
ID is stable from the action semantic key and its requirement binding is the
action's exact requirement-ref set.

`control_action` remains a browser adapter check and is not reused for CLI/API.
`observable_outcome` proves a declared result after an invocation; it does not
prove that the correct interface was invoked.

Every CLI/HTTP observable uses an `invocation_output` selector with
`coordinate: "result_value"`. Its RFC 6901 pointer is relative to the decoded
value selected by `invocationInterface.result.valuePointer`; it is not a
document-relative response pointer. In V1, `valueContract.expectedFrom` binds
the claim only to one exact logical input or literal. Assertions must be typed
`property=value`, `operator=equals` claims and must match scenario/literal
sources. State paths have no typed value schema and entity fields have no
scenario-bound instance authority yet, so both remain rejected until a later
versioned value-source artifact can prove them end to end. Existing rendered
control/surface/accessibility selectors remain browser semantics.

One `targetInputValues` scenario does not prove that an input-derived output is
dynamic: an implementation hardcoded to that one sample can still pass. This
slice therefore records an activation blocker rather than overclaiming proof.
EvidencePlanV2 must require at least two planner-declared valid, distinct
input/output cases per input-derived output (or a stronger property-domain
artifact), and the eval must include a hardcode-killer differential case.
ProductEvidenceCapabilityPolicyV2 maps evidence by delivery and invocation
kind:

- rendered control -> browser interaction;
- CLI command -> CLI interaction;
- HTTP request -> network/service interaction;
- route entry -> delivery-specific route capability.

The current V1 browser capability policy is never used to activate CLI/API.

## V1 Compatibility

ProductSpecV1 and historical artifacts are immutable.

The V2 compiler may continue to use the V1 compiler as a validation helper only
for currently activated browser profiles. Its compatibility projection must
strip `invocationInterface`, V2-only invocation predicates, and their action
evidence refs before V1 validation. The authoritative V2 object is reconstructed
from the validated V2 proposal; no invocation fact is inferred from that lossy
projection.

CLI/API remain shadow-only until a standalone V2 delivery/compiler path exists.
A no-design CLI/API product may be stateless. Its required route/surface records
are semantic interface scopes, not a claim that DOM is rendered; ProfileV2 must
either formalize that interpretation or version the surface model before
activation.
A mutated browser/game fixture whose delivery string is changed to CLI is not a
valid CLI eval fixture.

## InvocationInputTransportV2

After upstream authority exists, one transport leaf is compiled per executable
CLI/HTTP action. A product-wide leaf is forbidden because ProductSpec permits
2,000 actions and 500 fields per action while the artifact store permits four
MiB per payload.

Each action leaf binds:

- exact ProductSpec payload/action/interface hashes;
- exact stack pack, ProductDeliveryProfileV2, semantic rule set, and release
  manifest hashes;
- every-and-only input field with code-owned value/wire codec, channel, and
  per-field binding hash;
- exact output and persistence lifecycle/readback operation;
- exact fresh-verified registry adapter/signature resolutions; and
- a full transport-set commitment repeated by every leaf.

Scenario literal values are not embedded in the transport. EvidencePlanV2
encodes ProductSpec scenario values through the verified leaf codecs.

The public compiler accepts no adapter refs, support-signature hashes, raw
platform hashes, caller registry compiler input, or deserialized authority
claims. It fresh-verifies upstream authority and publishes individually bounded
prepared leaves. The fresh verifier reproduces the expected action set and
canonical bytes, then rejects missing, extra, duplicate, reordered, forged, or
self-consistent candidate leaves.

## Persistence Readback Boundary

ProductSpec persistence rehydration remains the product-level readback owner.
If rehydration names an action, transport compilation must bind the exact
readback action leaf. If it names initialization, a later typed release
initialization/readback operation must exist. The compiler may not invent a GET
endpoint, read subcommand, database query, or file inspection command.

Durable evidence requires an exact lifecycle mode and adapter signature:

- memory/session: same-process observation;
- reload: exact readback in the same service/process;
- restart: restart, readiness, then readback; and
- durable: fresh process/service plus exact durable readback.

Missing lifecycle authority is a blocker, not a prompt instruction.

## Bounded And Adversarial Rules

The implemented planner boundary uses the existing operational four-MiB
authority instead of introducing a larger private allowance:

- raw PLAN PRD: four MiB UTF-8 before regex or JSON parsing;
- public PlanSemanticProposalV2 input: four MiB bounded canonical snapshot;
- task: 50,000 UTF-16 code units;
- compiler-returned ProductSpecV2: three-MiB compiler-local output/DoS budget;
- global observables: 2,000; predicted/exact traceability bindings: 20,000;
- HTTP route-language overlap proof: 100,000 pair comparisons maximum;
- returned compiler authority: reconstructed from canonical bytes and
  recursively frozen; and
- proxies, accessors, cycles, sparse arrays, excessive depth/nodes/work, and
post-compile mutation are rejected before authority is returned.

The three-MiB output cap is not publication proof. The historical common
producer schema permits a large `toolVersions` record, while the artifact store
caps the whole semantic envelope at four MiB. PacketCompilerV3 still writes
children serially through a `put`-only writer, so a child can be accepted by the
semantic compiler and rejected later when producer plus envelope bytes are
measured. Exact publishability must move to the prepared batch boundary, whose
publication identity already caps one producer at 128 KiB and measures canonical
whole-envelope bytes. Packet publication remains production NO-GO until every
dependent child/packet/report envelope is prepared and capacity-validated before
the first write.

The later InvocationInputTransportV2 boundary additionally targets:

- action leaf: four MiB maximum and one prepared publication per leaf;
- candidate count: at most ProductSpec action count, capped at 2,000;
- CLI rendered argv: 64 KiB maximum;
- stdin/request body: one MiB maximum;
- HTTP path: two KiB maximum;
- response/stdout capture: four MiB contract-bound maximum;
- diagnostics: 200 canonical entries including overflow sentinel; and
- unsafe Unicode, NUL, CRLF injection, and cross-realm mutable backing are
  rejected before transport authority is returned.

## Dependency-Order Implementation Program

1. Add the nested invocation-interface schemas to PlanActionV2/ProductActionV2,
   generic EvidencePredicateV2, exact compiler projection, and compatibility
   tests. Keep current web/game behavior active and CLI/API shadow-only.
2. Add true Node CLI and Node Express proposal/ProductSpec fixtures; remove the
   mutated-game-as-CLI fixture from invocation eval authority.
3. Implement ProductEvidenceCapabilityPolicyV2 with delivery-discriminated
   invocation rules and resolve the Node API database-capability contradiction.
4. Implement shadow ProductDeliveryProfileV2 for Node CLI/API with explicit
   readiness blockers.
5. Implement PlatformReleaseManifestV2 and code-owned adapter catalog.
6. Extend EvidenceAdapterRegistryV1 pre-first-write with the invocation
   transport literal and runner/transport/profile/lifecycle cross-field rules.
7. Implement InvocationInputTransportV2 action leaves, per-field hashes,
   prepared publication, and fresh set verifier.
8. Extend semantic-source subject resolution to nested field binding hashes;
   version the catalog if any preflight target has become durable.
9. Implement parser/release/activation receipts. Only then activate semantic
   source intents and continue FileTreeManifestV2/BuildTopologyV2.

## Verification Matrix

Unit tests cover every-and-only action/input/route/observable closure, trigger
compatibility, required-input/profile compatibility, field-channel collisions,
method/body rules, placeholder closure, CLI prefix identity, HTTP route-language
overlap and bounded work, unsupported environment/header/runtime-event channels,
object-intermediate JSON construction, duplicate/ancestor/root pointer overlap,
enum domains, Gregorian dates, failure-kind/code/error-shape closure,
result-source contracts, generic invocation evidence, V1 projection,
deterministic code-unit ordering, IDs/hashes, and tamper rejection.

Current verification is TypeScript clean, the final invocation-focused
adversarial matrix is 80/80, and the full Product Compiler partition is 654/654.
The consuming partitions also pass: ExecutionAttempts 583/583, Findings
126/126, Evidence 54/54, Recovery 4/4, and Evals 48/48. `git diff --check`
passes. The independent adversarial review found no blocker in this isolated
shadow slice; these results do not authorize activation or cutover.

Adversarial tests cover proxy/accessor/cycle/sparse/oversize/depth/work inputs,
non-canonical CLI tokens, excluded headers/environment input, unsafe routes,
duplicate/overlapping pointers, forged authority, mutation,
manifest/registry drift, and leaf-set redistribution.

Integration fixtures cover a real Node CLI using flags plus stdin JSON and
durable file readback, a real Node Express API using path/query/body plus
restart readback, and a browser control regression proving DOM transport cannot
be accepted as CLI/HTTP transport.

System eval remains three clean product classes: browser utility/operations,
browser game, and one no-design CLI/API class. Zero new project-specific guard
or prose-classifier additions are allowed during the eval.

CLI/API activation additionally requires a two-case differential evidence eval
that fails an implementation hardcoded to the first declared input/output
sample.

## GO / NO-GO

GO for the isolated PlanActionV2/ProductActionV2 invocation-interface and
EvidencePredicateV2 authority slice.

NO-GO for direct InvocationInputTransportV2, CLI/API profile activation,
packet cutover, model dispatch, runtime evidence execution, live migrations,
new runs, retry/supervisor cutover, Mission Control cutover, or deploy until the
dependency stages above pass independently.
