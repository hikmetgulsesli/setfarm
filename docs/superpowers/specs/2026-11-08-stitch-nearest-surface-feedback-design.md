# Preserve nearest-surface failures in design retry feedback

Run `ccd426b8-8fb2-41ab-8a2c-2b303155c778` reached DESIGN after a genuine Kimi LOW PLAN completion. Both sealed design candidates put the declared Start control inside `SURF_GAME_CANVAS`; its sealed placement requires `SURF_PLAY_PAGE`. Original HTML ancestors and browser receipts agree. Titles, target identities and artifact hashes match. The selector correctly rejects both candidates.

The retry request carries the slot/action failures but loses the precise nearest-surface requirement. Its current `invalid_same_element_contract` observation contains counts only. The existing retry evidence and correction pipeline can already transport an expected string value, so no new schema, policy or authority is needed.

For a unique declared slot element with the wrong nearest surface, add a diagnostic using the existing `control_contract` kind and `<slot>@nearest_surface` reference. Expected count is one; expected value is the sealed placement surface; observed value is the rendered nearest surface. Omit observedValue when it is null. Duplicate slot elements retain their existing ambiguous diagnosis. Keep existing checks and acceptance criteria intact. The new diagnostic is emitted only for an already invalid placement.

Extend the existing control-slot correction to explain that the closest `[data-surface-id]` element must equal `owning_surface_ref`. Existing semantic retry projection then supplies the exact required surface literal. Observed text remains hashed by the established projector.

Validate through a genuine local render, selector, semantic retry projection and correction compilation: the wrong nested control stays rejected and emits the required surface; a correct control remains selected; duplicates receive no false single-element diagnosis; a missing surface never serializes null into the optional string. Keep retry budgets, byte limits, model settings, historical artifacts and runtime guards unchanged.

This is a causal retry-feedback fix for the existing software-generation objective. It adds no application-specific rule and does not repair or relabel the rejected historical candidates. Evidence: `root-kimi-thinking-design-selection-diagnosis-v2-feedback-ancestor-proof.json`, SHA256 `e615a1ac022f6de33c5f1a845bb0829541b76077e075312522c3b96067c09cba` in the operational integration workspace.
