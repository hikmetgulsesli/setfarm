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
bounded fix support input type=text (including the HTML default) and textarea;
other native input kinds/selects and custom interactive roles remain subject to
their existing action/input contracts. A readonly numeric or other display can
be supported separately when its actual semantics are specified and tested.

Alternatives rejected: a blanket observable-marker exemption admits undeclared
mutable inputs; inventing actions/input transports changes the product contract;
removing the topology or literal role/name gate hides producer corruption.
Changing the public screen schema is unnecessary for this bounded case: the
converter already possesses validated browser nativeInputState and element
hashes; the source validator separately proves exact indexed observable identity
and literal readonly text-display semantics in the final source.

## Converter contract

- Require browser_rendered_v2 authority, an exact required observable bound to
  this single element, matching validated native tag/type/readOnly proof and a
  genuinely readonly source value tag. Keep all current hash/receipt checks.
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
input type=text/default or textarea with literal readOnly=true, no duplicate or
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
receipt claim. Positive input and textarea paths and an undeclared adjacent input
must prove preservation and continued neutralization. Validator negatives cover
mutable/false/dynamic readonly, type drift, source-ref spoofing, duplicate refs,
unindexed/partial refs, event handlers, spreads, semantic or rejected overlap,
and canonical role/name tampering. Existing validator tests must continue to pass.

Also author a real native-v2 converter round-trip regression in the existing
converter test using actual browser capture and strict final source validation.
The builder must not execute it: Root separately reviews/admit its exact native
execution after inert tests, resource and ownership conditions. Unrun browser
coverage stays UNRUN. No baseline guard/test weakening is permitted.

After task review, run final combined branch review and Root no-emit typecompile.
Normal reviewed PR merge precedes the genuine stock build, whose maintained
clean-main/HEAD==origin/main guard remains intact. New runtime qualification
waits current full8 settlement and fresh rollout guards. Existing failed runs
stay failed evidence. No full8 GO or overall completion follows from unit tests.
