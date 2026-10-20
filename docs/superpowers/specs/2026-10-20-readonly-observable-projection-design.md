# Preserve exact readonly observable displays in generated screens

The actual I5 full8 operations baseline failed at compiler-owned setup-build,
before generated implementation. Its accepted browser element was a visible
readonly text input with implicit textbox role, the exact name Work item status,
and value Open. Target, response binding, graph, browser role receipt and element
hashes all bind that same observable. The converter first seals its canonical
role/name, then treats the value tag without action/input bindings as undeclared
and strips its role while disabling and hiding it. The strict source validator
correctly rejects this corrupted output. Original evidence and raw-byte pins are
in logs/2026-10-20-reviewed-source-release-v1/i5-generated-accessibility-source-investigation-v1.md.
The concrete names explain the failure; none may become a production allowlist.

This is a second systemic root fix necessary for the same approved working
Setfarm/full8 objective, independently of the pending-claim ownership fix. Root
uses the existing standing authorization and sole Source writer. No generated
project repair, test waiver, live evaluator interruption or new credentials.

## Decision and alternatives

Preserve only exact browser-authorized, readonly, observable-only native text
value displays. Carry the validated rendered element's native readonly/tag/type
proof into private converter projection metadata, keyed by exact element identity.
Do not trust a data-observable marker, label, role or comment by itself. For this
bounded fix support input type=text (including the HTML default) only;
textarea lacks native readonly proof in the current capture schema; it, other native input kinds/selects and custom interactive roles remain subject to
their existing action/input contracts. A readonly numeric or other display can
be supported separately when its actual semantics are specified and tested.

Alternatives rejected: a blanket observable-marker exemption admits undeclared
mutable inputs; inventing actions/input transports changes the product contract;
removing the topology or literal role/name gate hides producer corruption.
Root follow-up inspection found the raw-count invariant requires every native input to be accounted for. Add only an optional strict readonlyDisplay field on an indexed accessibility textbox observable: { kind: "input", inputType: "text", readOnly: true }. Existing artifacts without it retain their interpretation. The converter populates it only from validated nativeInputState and exact element hashes. The schema counts distinct readonly-display source elements once, disjoint from accepted/rejected controls, while preserving exact original raw counts. Multiple observables on one display must agree on the same metadata/source locators. The source validator requires this indexed metadata plus literal readonly text semantics; a marker alone never authorizes an exemption.

## Converter contract

- Require browser_rendered_v2 authority, an exact required observable bound to
  this single element, matching validated native tag/type/readOnly proof and a
  genuinely readonly source value tag. Keep all current hash/receipt checks.
- Check eligibility against original attributes before observable annotation can canonicalize role/name/markers; do not launder malformed/duplicate identities, type/readonly attrs, event handlers or semantic attrs into eligibility.
- Require observable-only semantics: no action, action-input, action/control ID,
  control-slot or event handler; no manufactured state or callbacks. Authorize
  the display before the no-input-binding rejection, without recording it as an
  action, input transport or rejected control.
- Preserve the exact element, literal canonical role/name, value, readOnly and
  original visibility. A visible display must stay visible. Existing genuinely
  hidden observables retain their visibility. Do not make unindexed readonly
  controls or non-readonly observable controls active through this exception.

## Source validation contract

A narrow display exemption from interactive completeness requires exactly one
literal source element ref and nonempty, unique, entirely indexed observable
refs all bound to that element. Existing observable cardinality, source-locator,
canonical role/name and source identity validation remain authoritative. Require
input type=text/default with literal readOnly=true, no duplicate or
dynamic readonly/type attributes, no event handlers, spreads, action/control/
input/control-slot semantics, or rejected-control overlap. Do not exempt by
role alone. Malformed/spoofed/duplicated observable markers, mutable inputs,
readOnly=false/expression, handlers and spreads remain rejected. All other
interactive and extra-handler checks remain active.

## Verification and delivery

First retain a genuine converter-pipeline and source-validator RED on current
production bodies using inert fixtures. Exercise complete actual observable and
interactive annotation functions, not a copied decision rule. A private projection
fixture is explicitly synthetic validated-input unit authority, never a browser
receipt claim. Positive input text/default paths and an undeclared adjacent input
must prove preservation and continued neutralization. Validator negatives cover
mutable/false/dynamic readonly, unsupported textarea, type drift, source-ref spoofing, duplicate refs,
unindexed/partial refs, event handlers, spreads, semantic or rejected overlap,
and canonical role/name tampering. Existing validator tests must continue to pass.

Also author a real native-v2 converter round-trip regression in the existing
converter test using actual browser capture and strict final source validation.
The builder must not execute it: Root separately reviews/admit its exact native
execution after inert tests, resource and ownership conditions. Unrun browser
coverage stays UNRUN. No baseline guard/test weakening is permitted. Schema regressions also prove exact raw counts, optional-field backward compatibility, unique-element counting for multiple observables, mismatched metadata, overlap and uncovered-input rejection. The currently retained inert RED predates this schema amendment and remains genuine evidence of converter neutralization and validator unindexed rejection; add schema RED before changing schema production.

After task review, run final combined branch review and Root no-emit typecompile.
Normal reviewed PR merge precedes the genuine stock build, whose maintained
clean-main/HEAD==origin/main guard remains intact. New runtime qualification
waits current full8 settlement and fresh rollout guards. Existing failed runs
stay failed evidence. No full8 GO or overall completion follows from unit tests.

## Final review W1: downstream source-map cardinality

Whole-branch review traced the required setup-build consumer after local source
validation. The implementation-source-map producer copies exact raw counts but
counts only controls as accepted and rejectedControls as rejected. A readonly
display leaves a deficit and its existing output schema correctly rejects it.
The retained native fixture has2raw inputs,0accepted input controls,1rejected
input and1readonly display. This must not be delivered as a complete root fix.

Count distinct strict indexed readonlyDisplay source elements in the producer's
aggregate accepted.inputs in addition to accepted input controls. Here accepted
describes admitted native elements; it creates no control, action, transport or
component-API entry. The existing source-map schema and exact raw=accepted+rejected
guard remain unchanged. Strict input index parsing, actual generated-source
validation and screenIndexV2PayloadHash already bind this classification. Never
infer a display from a raw-count deficit or reduce raw counts.

Add only the direct producer and its existing focused regression file to the
File Map. Exercise genuine produceImplementationSourceMapV1 through output
schema parsing, with one readonly display plus rejected input, multiple
observables sharing that display, old artifacts and invalid/missing/overlapping
metadata. Its existing fixture uses actual browser capture: the builder authors
test-only changes and freezes them; Root alone admits a single focused native
RED before any producer edit, then GREEN afterward. Existing unrelated native
cases are excluded unless Root explicitly selects the one baseline. Retain new
fixture input/output evidence on all outcomes. This is the single final-review
fix dispatch and scoped re-review, not an unrelated new feature.

## PR300 P1 — explicit literal readonly display value

Actual external review discussion4326984905 identifies missing literal value requirements. Root accepts this causally necessary bounded correction before merge. The accepted native sidecar is serialized outerHTML and records no actual input.value witness; arbitrary inline application scripts are already rejected before capture. Do not claim a native script-only reproduction or property/attribute equality.

Narrow the supported readonly display category to exactly one parsed string-valued value attribute in the original preannotation semantic-DOM attributes, including an explicitly empty string. Absent/bare/duplicate/ambiguous/expression values are ineligible and follow normal unknown-input neutralization without readonly metadata. A quoted string containing braces is literal text; an unquoted JSX expression is not. Reject any defaultValue attribute, even alongside an identical literal value; do not delete it to manufacture eligibility. Keep all original native/role/ref/shared/visibility/semantic/handler/raw-count guards.

Final JSX must have exactly one direct quoted string value initializer, including empty string; no expression forms, including static string/template expressions, and no case aliases, duplicates or defaultValue. This is a narrow supported representation, not a claim that every static expression is unsafe. The strict source validator must reject forged readonly indexes around nonliteral values. Native input/capture/index/source-map schemas and completed W1 cardinality logic remain unchanged. No value reconstruction from after-assertions, synthetic native field or provider/runtime behavior.

This correction proves represented literal source values survive the supported conversion and rejects missing/dynamic/default-conflicted representations. It does not establish actual browser property equals literal attribute, equality to after/reload expectations, or reject another final literal without a value witness. Those stronger guarantees require a separate explicitly sized capture/index authority design and are outside this correction.

Exact File Map: scripts/stitch-to-jsx.mjs; src/product-compiler/stitch-screen-source-validator-v2.ts; tests/product-compiler/readonly-observable-projection.test.ts; tests/product-compiler/stitch-screen-source-validator-v2.test.ts. Genuine inert RED/GREEN must invoke the actual extracted converter functions and actual validator. Cover absent/bare/dynamic/duplicate/casing/default conflicts, direct explicit empty/nonempty/encoded literal positives, shared-observable negative/positive and all retained guards. A script-only string is inert unit data, never native evidence. Root reruns the existing real native literal-value converter positive after freeze and refreshes production type evidence; independent scoped P1 review and actual GitHub comment reconciliation are required before delivery.
