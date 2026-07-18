# Capability Binding and No-Design Profile V2 Design

Date: 2026-07-18

Status: approved shadow architecture; production activation is NO-GO

## Decision

ProductSpecV2 remains product-semantic authority. Physical topology capability
IDs are not written into, inferred from, or trusted from ProductSpecV2 for the
new CLI/API path. ProductEvidenceCapabilityPolicyV2 compiles a separate,
versioned `ProductEvidenceCapabilityBindingSetV2` from:

- one exact canonical ProductSpecV2;
- one fresh-reproduced ProductDeliverySelectionV2;
- the code-owned ProductEvidenceCapabilityPolicyV2; and
- the code-owned StackTopologyCatalogV1 descriptor bound by that selection.

The first ProductDeliveryProfileV2 catalog contains exactly two no-design
shadow profiles. Browser and game remain on ProductDeliveryProfileV1 until a
separate packet migration moves their evidence capability authority; V1 is not
copied into V2.

```text
ProductSpecV2 + ProductDeliverySelectionV2
  -> ProductEvidenceCapabilityPolicyV2
  -> ProductEvidenceCapabilityBindingSetV2
  -> future Packet/Story/Slice capability witness
```

The binding set is shadow-only in this slice. It is not added to Product Build
Packet V3, StoryPlanV2, ImplementationSliceV2, runtime evidence, or Mission
Control until those consumers can replace embedded legacy capability refs in
one atomic compatibility migration.

## Why Capability Bindings Are Separate

ProductSpec describes behavior. `CAP_CLI_INTERACTION`,
`CAP_NETWORK_ACCESS`, and other physical capability IDs describe the selected
platform topology. Embedding those IDs in ProductSpec would make the product
hash change when a release/profile/topology changes, would make a forged
superset indistinguishable at the ProductSpec schema boundary, and would create
two owners for release capability selection.

The existing V1 policy mutates ProductSpecV1 capability refs. That behavior is
historical compatibility, not the V2 target. For a V2 CLI/API binding compile,
all caller-supplied ProductSpec capability refs must be empty. The compiler
never merges or preserves them.

## ProductEvidenceCapabilityPolicyV2

The policy is code-owned, canonical, hash-bound, and complete over every
ProductSpec evidence kind. It replaces trigger-based browser assumptions with
the action's typed invocation interface:

- `rendered_control` and `route_entry` -> `browser_interaction`;
- `cli_command` -> `cli_interaction`;
- `http_request` -> `network`.

Evidence rules can additionally require runtime state, test, visual, download,
or persistence capability kinds. Persistence rules remain semantic-kind based:
none requires nothing, memory requires runtime state, local storage requires
local persistence, database requires database, file requires filesystem, and
remote API requires network.

`persistence_round_trip` has one exact V2 subject rule: `subjectRef` names a
single ProductSpec persistence policy, never an action, state, entity, or
surface. Exactly one action must own the predicate through `evidenceRefs`, and
that action must contain an exact persistence effect for the subject policy.
The owning action's success outcome must claim the predicate and its failure
outcome must not claim a successful round trip. The same closure applies to the
subject policy in `success.persistenceRefs` and `failure.persistenceRefs`.
The PlanV2 compatibility compiler does not preserve or reinterpret a model-owned
legacy predicate. After the V1 base compiler has produced exact action effects,
PlanV2 emits one compiler-owned predicate per unique action/policy pair, derives
its ID from that exact pair in a domain-separated V2 namespace, sets its subject
to the policy ref, and attaches it to the exact action, success outcome, and
traceability binding. The public ProductSpecV2 schema never infers this relation
from arbitrary JSON or from an ID suffix.

Observable outcomes bind their exact invocation capability only. They do not
copy every persistence policy used by their action. Persistence capability is
owned solely by the separate round-trip predicate for that exact policy. This
keeps predicate-to-policy identity one-to-one and prevents an action with many
observables and persistence effects from producing a repeated Cartesian
capability closure.

An observable subject resolves to its exact owning action. A generic
`action_invocation` predicate therefore binds to the invocation capability,
and an invocation-output `observable_outcome` binds to the same capability.
Missing or ambiguous enabled topology capabilities reject compilation. No
capability ID is accepted from the caller.

## ProductEvidenceCapabilityBindingSetV2

The binding set carries:

- ProductSpec payload hash;
- exact policy schema/version/hash;
- exact delivery selection/catalog/profile hashes;
- exact stack pack version/content hash;
- every-and-only evidence predicate binding;
- exact action and invocation kind when the subject resolves to an action;
- sorted capability ref/kind/reason tuples;
- a domain-separated hash for every binding and the complete set;
- shadow readiness and canonical blocker codes.

The compiler snapshots public input with bounded canonical JSON before Zod,
loads topology and policy from code, and returns recursively frozen output. A
fresh verifier recompiles from ProductSpec plus requested stack authority and
requires canonical equality. Missing, extra, duplicate, reordered, mutated, or
self-consistently rehashed bindings reject.

Compilation preflights a fixed 100,000 policy-reason-edge work budget before
allocating binding output. ProductSpec schema limits plus bounded canonical input
own aggregate structural work; the binding compiler does not impose a second,
semantically unrelated aggregate-edge threshold. Its ownership index admits
only evidence refs whose predicate kind is `persistence_round_trip`, so unrelated
action evidence cannot change exact persistence resolution. Reason identity uses
keyed maps rather than repeated linear canonical scans, and output capacity
remains a final byte bound rather than the first time excessive work is detected.

## ProductDeliveryProfileV2

The catalog contains exactly:

1. `PROFILE_NODE_CLI_STATELESS_EXACT_V2`
   - product class `developer_tool`;
   - explicit requested stack `node-cli`;
   - delivery `cli/node-cli`, database `none`, no design;
   - persistence kind `none` only;
   - invocation kind `cli_process`;
   - exact future manifest launcher ref `LAUNCH_NODE_CLI_V2`;
   - semantic rule set `RULESET_NODE_CLI_V1`.
2. `PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2`
   - product class `service`;
   - explicit requested stack `node-express-api`;
   - delivery `api/node-express`, database `none`, no design;
   - persistence kinds `none|memory` only;
   - invocation kind `http_service`;
   - exact future manifest launcher ref `LAUNCH_NODE_EXPRESS_API_V2`;
   - semantic rule set `RULESET_NODE_EXPRESS_API_STATELESS_V1`.

The word stateless in the profile ID means no durable external/file/database
authority. Product actions may still own canonical runtime state; the API
profile may use explicitly non-durable memory persistence.

Selection requires both typed ProductSpec semantics and the exact explicit
stack prefix. It never infers Node CLI from a generic developer-tool class,
never substitutes Python CLI, and returns `shadow_selected`, never an active
selection.

CLI/API routes and surfaces are non-rendered interface scopes. The profile
binds that interpretation explicitly so no downstream consumer may infer DOM
or navigation runtime from them.

## Node API Persistence Contradiction

The previous Node Express semantic rule set claimed database and file
persistence adapters, while the topology has no database capability, provider,
migration command, or provisioned runtime authority. Adding a generic database
capability label would hide the missing provider contract.

The initial API profile therefore rejects every non-`none` delivery database
and every persistence kind except `none|memory`. It binds a new stateless API
rule set with no persistence-adapter rule. Database/file support requires a new
provider-qualified profile and release/runtime-data authority; this profile is
never widened in place.

## Readiness

Both profiles and every binding set remain shadow with canonical blockers for:

- standalone V2 product compiler;
- semantic-source activation;
- release manifest;
- evidence registry;
- invocation input transport;
- runtime evidence compiler;
- differential hardcode-killer EvidencePlanV2;
- prepared packet publication; and
- delivery completion.

The API profile additionally blocks on network runtime activation. Inner
semantic-source rule-set blockers remain separately visible. No environment
flag or fallback can convert shadow authority into production selection.

## Compatibility and Migration

ProductDeliveryProfileV1 and its current browser/game consumers are unchanged.
ProductEvidenceCapabilityPolicyV1 remains historical compatibility. The V2
catalog and binding set are not packet refs yet, so they cannot affect live
selection, model dispatch, retry, evidence execution, deploy, or Mission
Control.

The later atomic cutover must:

1. require empty ProductSpecV2 capability refs for every predicate;
2. add the binding-set hash to the packet;
3. make StoryPlan/Slice/EvidencePlan consume exact binding witnesses;
4. fresh-verify policy/profile/topology authority before packet seal; and
5. remove embedded capability refs as operational authority, without dual
   read or dual write.

## Verification

Required tests cover deterministic policy/profile/catalog/binding hashes,
exact CLI and API mappings, every-and-only binding coverage, wrong delivery or
stack, implicit selection, Python substitution, non-empty caller refs,
unsupported evidence, missing/ambiguous topology capabilities, database/file
rejection, old API rule-set rejection, candidate forgery, mutation, proxy,
accessor, cycle, sparse input, and size/work bounds.

Adversarial tests additionally require rejection of a persistence round trip
whose subject is a state/action/entity, exact separation of two policies owned
by one action, no persistence amplification across many observables, and a
sub-megabyte high-cardinality input that completes within bounded canonical
input work without late multi-second output expansion. Unrelated action
evidence ownership must not change a compiled binding or introduce a second,
lower aggregate graph limit than the ProductSpec and output schemas declare.

Fixtures are genuine Node CLI and Node Express products. Mutating a browser or
game fixture's delivery strings is not acceptable evidence. Differential
runtime evidence remains a later blocker and must use at least two distinct
valid input/output cases.

## GO / NO-GO

GO for the isolated code-owned PolicyV2, two-profile shadow catalog, stateless
API semantic rule set, genuine no-design fixtures, and fresh-verifiable binding
set.

NO-GO for standalone CLI/API ProductSpec compilation, packet integration,
ProfileV2 activation, registry/transport activation, runtime evidence, live
migration, new run, retry/supervisor/MC cutover, and deploy.
