# Design Source Semantic Retry Closure Design

Date: 2026-08-16

Status: implemented and source-verified; pending Setfarm-owned PR and live rollout

## Problem and evidence

The internal-production golden matrix reached the Product Compiler v3 design
source boundary on clean release `f571001a17297b503e9e533d036c2d9a7f85a8ab`,
but converged on zero accepted products. The bounded runner stopped after the
same root repeated three times. Owner counts returned to zero after every run,
so the remaining problem is design-source convergence rather than leaked
runtime ownership.

The stored candidate-selection evidence shows two systemic gaps.

First, strict candidate evaluation already records exact semantic checks, but
the failure artifact currently projects only candidate rejection codes. Retry
planning therefore sees that a stage failed without receiving the exact
missing, duplicate, mismatched, or unexpected semantic references that the
compiler proved. Only `CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL` has dedicated
correction text. Surface, control-slot, action-input, observable, undeclared
action, and rendered-source failures all fall back to generic prose. Repeated
candidate failures across different generated products demonstrate that this
is a platform feedback defect rather than a project-specific defect.

Second, one retry reached `exact_target_semantics`: every required surface,
control, action input, observable, and target identity was exact. The selected
HTML was nevertheless rejected because it contained one literal U+00A9
COPYRIGHT SIGN. The generic English contract correctly rejects arbitrary
non-ASCII text, but applying it byte-for-byte to selected HTML falsely treats a
language-neutral symbol as non-English. The stored HTML bytes and their hash
were otherwise valid and must not be rewritten.

A separate run received a structured Stitch MCP `isError` response before an
accepted local screen/result existed. The code-owned child converted that
structured rejection into an ordinary process error, so the runner classified
it as `DESIGN_SOURCE_DISPATCH_AMBIGUOUS`. True dispatch ambiguity must remain
quarantined, but a strictly proven pre-acceptance provider rejection should use
the existing single retry ordinal instead of being mislabeled as an unknown
side effect.

## Goals

- Give the one existing retry attempt exact, compiler-owned semantic correction
  evidence without relaxing candidate selection.
- Admit literal U+00A9 in selected HTML while preserving the original UTF-8
  bytes, content hash, and English-only product semantics.
- Distinguish a structured, locally pre-acceptance provider rejection from a
  genuinely ambiguous dispatch.
- Preserve the exact two-attempt authority, replay/idempotency behavior,
  failure evidence, and owner cleanup invariants.
- Produce enough authoritative evidence to rerun the controlled canary and
  golden matrix, then continue Mission Control and fleet closure from clean
  main.

## Non-goals

- Do not add a third design-source attempt or widen any retry budget.
- Do not infer missing product semantics, synthesize a semantic overlay, or
  modify generated HTML after selection.
- Do not weaken target, control, observable, source-safety, English, or
  dispatch-ambiguity gates.
- Do not trust provider prose as authority or hardcode any generated project,
  screen, action, or DOM identifier.
- Do not change ProductSpec English admission globally.
- Do not include external signed distribution. It remains a separately gated,
  explicitly deferred scope.

## Decision

Keep `setfarm.design-source-generation-retry-delta.v1` unchanged. It already
binds the exact parent attempt, failure artifact, failure fingerprint, previous
request, and changed prompt hashes. Instead, add a strict, bounded semantic
retry projection to the existing canonical failure artifact. Retry planning
must parse that code-owned projection and compile deterministic correction
lines into the failed stage prompt. The resulting prompt hashes remain the
durable retry delta.

Add a selected-HTML-only admission rule for literal U+00A9. Inspection may
substitute that one code point with an ASCII space in an ephemeral inspection
copy, but it must store and project the original bytes unchanged. All other
non-ASCII characters continue through the existing English contract and fail
closed.

Add one strict child-to-runtime provider-rejection envelope. It is accepted
only when the code-owned Stitch adapter received an explicit MCP `isError`,
produced no accepted transport result, and produced no local screen/download
artifacts. The runtime converts that envelope into an
`infrastructure_failure` dispatch result with the exact failed stage. The
existing ordinal-two attempt is the only retry. Timeouts, signals, malformed
output, non-typed process failures, partial accepted results, or local artifact
presence remain `dispatch_ambiguous` and are never retried.

## Semantic retry evidence

### Canonical projection

On candidate-selection rejection, the materializer writes a strict nested
projection with schema
`setfarm.design-source-semantic-retry-evidence.v1` into the failure artifact.
It contains only code-owned facts already present in candidate selection and
rendered semantics:

- canonical failed stage IDs and target refs;
- per-target candidate rejection codes;
- canonical non-exact semantic checks, bounded by at most 200 stages, 100
  targets per stage, 200 requirements per target, and 8 distinct observations
  per requirement;
- for each check: `kind`, `semanticRef`, `disposition`, expected and observed
  counts, an optional contract-owned expected value, and only the SHA-256 of an
  optional observed value;
- rendered-source failure codes for source-rejected candidates;
- the candidate-selection artifact ref/hash from which the projection was
  derived.

The entire canonical projection is capped at 512 KiB. A corrected stage prompt
may add at most 400 canonical correction records and 64 KiB of correction text.
Capacity overflow produces generic bounded retry guidance or no retry; it never
truncates a semantic requirement while claiming the projection is complete.

The projection is canonicalized by stage, target, check kind, and semantic ref.
Duplicate observations for the same target/kind/ref are accepted only when
their expected contract fields agree. Observed element refs are not copied into
prompts. Unknown, over-capacity, contradictory, or structurally invalid
projections do not create targeted instructions; retry planning either uses the
existing generic correction or returns no retry.

The parent failure artifact hash authenticates the projection. The existing
retry delta then authenticates that parent hash and the exact corrected prompt
hashes. A second independently mutable retry-evidence store or caller-supplied
JSON is forbidden.

### Correction compiler

The correction compiler is a pure deterministic mapping from the strict
projection to prompt lines. It may name only canonical contract refs and exact
expected values/counts. It must never interpolate provider diagnostics,
candidate prose, DOM text, arbitrary element refs, or generated project names.
Each machine-readable semantic requirement is serialized as canonical JSON on
one prompt line, so even contract-owned titles cannot inject prompt structure.

Known corrections cover:

- `surface_wrapper` and undeclared surfaces: render every and only declared
  surface refs once using the existing prompt contract;
- `control_slot` and `control_contract`: render every and only declared physical
  control slot with its exact `data-action` and `data-control-slot` on one
  actionable element;
- `action_input` and `action_input_contract`: render only the declared action
  input contract and exact expected binding;
- `observable` and undeclared observables: expose every and only declared
  observable selector/receipt with the exact expected value;
- undeclared interactive/action/control/input evidence: remove or make the
  element non-actionable unless the exact contract declares it;
- target/title mismatch: preserve the exact target identity and expected screen
  title;
- rendered-source failure codes: regenerate source without the exact forbidden
  source pattern while preserving the typed target contract.

The prompt retains the existing parent failure fingerprint, failure artifact
hash, stage ID, and nested rejection codes. Stage prompts without proven
failure evidence are carried forward unchanged. The compiler does not create a
retry when no stage prompt hash changes.

## Selected HTML English admission

`requireSelectedHtmlEnglishV2` remains responsible for byte capacity, fatal
UTF-8 decoding, and the English contract. Its policy becomes explicit:

- inspect the original byte length and decode the original bytes with fatal
  UTF-8;
- create an inspection-only string in which each literal U+00A9 is replaced by
  one ASCII space;
- run `inspectEnglishTextV1` on that inspection string;
- write, hash, render, select, and project the original bytes, never the
  inspection copy;
- reject every other disallowed code point exactly as before.

This is deliberately not a general Unicode-symbol allowlist. U+00A9 is the
only evidence-backed exception. Literal accented letters, Cyrillic, CJK,
right-to-left text, hidden format controls, and malformed UTF-8 remain rejected.
The selected-HTML admission policy hash changes so an authority produced under
the previous policy cannot be replayed as if it used the new one.

## Structured provider rejection

The code-owned Stitch child emits a canonical, redacted failure envelope only
for an explicit MCP `isError` result. The envelope records:

- schema and code-owned classification;
- tool and stage identity;
- `acceptedResult: false`;
- empty accepted screen/result and local artifact sets;
- a bounded diagnostic code and diagnostic hash;
- a redacted raw-evidence payload suitable for the existing raw evidence
  store.

The parent validates the exact envelope and verifies the temporary output root
contains no screen HTML, screenshot, or accepted transport output before
returning a typed `infrastructure_failure`. That failure evidence includes the
exact failed stage ID, allowing the existing retry planner to change only that
stage. The retry prompt states that the prior provider call returned no
accepted result and must regenerate the unchanged typed target; it does not
claim a semantic defect.

This proof is local: it proves that no provider result became Setfarm
authority. It does not claim that a remote provider performed no internal work.
The bounded retry is safe because only one accepted, hash-bound local result can
enter the compiler chain. Any evidence of a partial accepted result, any local
artifact, an untyped exception, timeout, abort, malformed envelope, or unknown
process exit preserves the existing ambiguous terminal disposition.

The semantic retry policy, selected-HTML admission policy, and structured
provider-rejection policy are all included in the prompt-contract hash. A
replay under different policy bytes therefore fails authority validation even
when its ProductSpec and provider settings are unchanged.

## Lifecycle and data flow

1. Attempt one dispatches under the existing durable dispatch intent and
   per-stage external operation ID.
2. An accepted provider result is stored as raw evidence and materialized.
3. If selection rejects the result, the materializer stores candidate
   selection plus the strict semantic retry projection in the failure artifact.
4. If the child returns a proven provider rejection, the runtime stores the
   typed provider failure and failed stage instead.
5. The runner seals attempt one before planning any retry.
6. The retry planner reopens the canonical failure artifact, parses only the
   strict projection, and deterministically compiles changed stage prompts.
7. The unchanged `retry-delta.v1` binds the parent failure and new prompt
   hashes. Attempt two is reserved with the existing retry authority.
8. Successful materialization applies selected-HTML admission, preserving exact
   raw bytes and hashes.
9. Attempt two success projects the existing authority chain. Attempt two
   failure terminates as repeated/maximum-attempts; no third dispatch exists.

## Crash, replay, and idempotency

- The parent attempt and failure artifact are terminal before the retry delta is
  constructed.
- Reopening a retry validates the parent artifact hash, fingerprint, request,
  and corrected prompt hashes before dispatch.
- A replayed accepted attempt returns the existing projection and never
  redispatches.
- A replayed terminal provider rejection reconstructs the same retry plan from
  stored evidence; it cannot create a second ordinal-two attempt.
- Response loss after dispatch intent remains governed by the existing
  ambiguous-dispatch rule unless a complete typed rejection or accepted result
  was durably returned.
- Stage carry-forward remains permitted only for unchanged stages bound to the
  exact parent attempt.
- Every completion path must leave attempt, claim, dispatch, runtime,
  compilation, process, listener, outbox, and worktree ownership at zero.

## Error handling

- Invalid semantic retry evidence: ignore targeted detail and remain generic or
  terminal; never trust a partial projection.
- Known rejection code with no matching semantic check: emit only the bounded
  code-class correction.
- Unknown rejection or rendered-source code: preserve it as evidence but do not
  invent instructions.
- Explicit provider rejection on attempt two: terminal infrastructure failure.
- Typed provider envelope plus any accepted result/local artifact: dispatch
  ambiguous.
- Timeout, signal, malformed child output, or ordinary nonzero exit: dispatch
  ambiguous.
- U+00A9 plus another English violation: reject for the other violation.
- Selected HTML mutation or hash drift at any later fence: reject through the
  existing artifact authority chain.

## Compatibility, migration, and rollback

No database migration is required. Historical product compilation attempts,
`retry-delta.v1` records, failure artifacts, and accepted authority artifacts
retain their schemas and bytes. New failure artifacts may contain the strict
nested semantic retry projection, which old code treats as opaque evidence.

Rollback is a code rollback. Attempts created under the new selected-HTML
policy have a different prompt-contract authority hash and cannot be replayed
under the old policy. A pending ordinal-two attempt remains self-bound to its
exact parent artifact and prompt hashes; rollback may fail it closed but cannot
reinterpret it.

## Verification strategy

Implementation follows red-green-refactor. Production code is not changed
until each focused regression fails for the expected reason.

Required focused tests:

- selection rejection persists canonical bounded semantic retry evidence;
- every known mismatch class produces deterministic targeted correction lines;
- contradictory, oversized, unknown, and caller-forged evidence fails closed;
- the retry delta remains `v1` and binds exact parent/prompt hashes;
- literal U+00A9 is admitted only for selected HTML and original bytes/hash are
  unchanged;
- accented Latin text, Cyrillic, hidden format controls, invalid UTF-8, and
  byte-limit violations remain rejected;
- explicit MCP `isError` with no accepted result/artifact becomes a typed
  infrastructure failure and consumes at most ordinal two;
- typed rejection plus local output, timeout, abort, malformed envelope, and
  generic process failure remain dispatch ambiguous;
- replay and response-loss tests prove no duplicate attempt, dispatch,
  projection, or owner;
- attempt-two repeat failure terminates with no third dispatch.

Required integration evidence:

- focused Product Compiler, design runtime, child-script, repository, and
  recovery suites;
- clean feature-branch build and full Setfarm test suite;
- independent review of schema, prompt-injection, dispatch ambiguity, replay,
  and English-admission boundaries;
- clean-main build/test after merge;
- service restart only through the existing zero-owner guarded procedure;
- one clean canary followed by the controlled golden product matrix;
- matrix acceptance with no repeated systemic root and zero final owners;
- fresh Mission Control DB/API/UI snapshot equality for the controlled fleet.

## Rollout and completion gates

1. Implement on one isolated Setfarm PR branch with no concurrent Setfarm code
   writer.
2. Run focused red-green tests, clean build, full tests, and independent review.
3. Deliver a clean PR; do not commit directly to `main`.
4. Merge through the normal reviewed path and verify the exact clean-main SHA.
5. Restart Setfarm services only after the existing global-zero/guard checks.
6. Run one clean canary. If the same root repeats three times after the fix,
   stop and classify it instead of extending retry budgets.
7. Run the full golden matrix and reconcile its DB rows, events, artifacts,
   claims, GitHub state, HTTP state, and Mission Control presentation.
8. Continue recovery/idempotency and controlled-fleet closure only from the
   verified release.

The internal-production goal is complete only when clean-main verification,
the golden matrix, recovery/idempotency scenarios, Mission Control DB/API/UI
reconciliation, controlled fleet evidence, independent review, and clean PR
delivery are all proven. External signed distribution remains a separate,
deferred deliverable and is not silently folded into this change.
