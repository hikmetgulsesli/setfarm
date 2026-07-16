# Stories Product Semantics v2 Compatibility Projection

## Scope

Installer step `03-stories` must produce scheduler-compatible `STORIES_JSON`
and `SCREEN_MAP` rows for Product Semantics v2 runs. These rows are a
compatibility scheduling projection only. The later `StoryPlanV2`, compiled
with `BuildTopologyV1`, remains authoritative for implementation.

The new path is selected only when the run protocol is `v3` and context
`product_semantics_version` is exactly `v2`. The existing ProductSpec v1
projection remains immutable.

## Authority and data flow

The v2 path reads exactly one canonical ProductSpecV2 projection from PLAN and
the compiler-owned Stitch projection files:

- `GENERATION_TARGETS.json` (`DesignGenerationTargetsV2`)
- `STITCH_DIRECT_RESPONSE_EVIDENCE.json`
- `STITCH_RENDERED_SEMANTICS_V2.json`
- `STITCH_TARGET_CANDIDATE_SELECTION.json`
- `STITCH_RESPONSE_BINDINGS.json` (`v3`)
- `DESIGN_INTERACTION_GRAPH_V2.json`

Each file must be canonical JSON. The generation targets are reproduced from
ProductSpecV2 and must match exactly. The direct-response, rendered-semantics,
selection, and response-binding hash chain must close. The design graph is
reproduced with `produceDesignInteractionGraphV2` and must match exactly.
Mixed-version artifacts and tampered bytes are terminal source failures.

`produceStoryDefinitionsV2` partitions only canonical semantic identities.
The compatibility renderer then maps each partition to the existing DB story
shape. Physical controls come exclusively from graph control identities and
ProductSpec control placements; affected surfaces add ownership context but
never synthesize controls. Action, state, persistence, evidence, route,
surface, observable, and screen ownership are emitted as exact IDs and hashes,
not inferred from titles or prose.

## Guard behavior

The completion guard uses the same deterministic v2 builder whenever context
selects Product Semantics v2. It recomputes the expected output from current
canonical sources and requires exact output equality. On source or output
drift it removes the inserted compatibility rows and fails with a typed v2
projection error. The legacy v3 and non-v3 guard chains are unchanged.

## Error handling and tests

The runtime distinguishes missing, invalid JSON, non-canonical JSON,
mixed-version schema, authority-chain mismatch, graph reproduction mismatch,
partition rejection, and incompatible story caps. Tests cover deterministic
replay, exact slot/control ownership versus affected surfaces, tampered and
mixed-version rejection, and explicit guard dispatch selection.
