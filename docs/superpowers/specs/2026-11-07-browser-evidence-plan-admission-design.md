# Browser evidence plan admission

The real run `a3558554-2b6d-4b7c-ad72-2c6528df04eb` exposed two compiler defects: rendered score expectations were numeric `0` although the supported DOM value channel is string/null, and persistence evidence required a change from an initial value of zero to the same zero. Its immutable failures remain valid evidence; editing the generated product cannot satisfy these sealed contracts.

Reject these incompatible declarations during ProductSpecV2 admission and return the existing compiler diagnostics to the model's normal PLAN retry. Preserve runtime equality, persistence/change gates and typed invocation JSON. This is preferable to coercing observations or accepting an unchanged value as proof of storage.

The persistence check is deliberately bounded: browser local storage with initialization rehydration and reload durability, no inputs/preconditions/prerequisites, one exact persisted set target, and a present initial target equal to its literal or initial-state source. Skip unknown sources and overlapping or multiple persisted targets. The model must declare a task-consistent changing witness; no new scenario engine or runtime adapter is introduced.

File Map: `src/product-compiler/schemas/product-spec-v2.ts`; focused regressions in `tests/product-compiler/product-semantics-v2-schemas.test.ts` and `tests/product-compiler/plan-semantic-proposal-v2.test.ts`; this spec and its plan. The existing generated migration-digest file may change only if the normal source-closure generator requires it. Root is the sole writer on base `ef142de841d388452253a9e0af21765f39d7241c`.

Verify both production failures first, then rejection paths, valid DOM strings/null, numeric invocation output, and a changing persistence witness. Run the focused schema/compiler tests and noEmit; build the final reviewed clean-main source together with the preceding owner fix, then return to an actual production run. No isolated database, generated-project edit or old-run reset.
