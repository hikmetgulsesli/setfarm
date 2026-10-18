# Stitch live model compatibility

## Objective and authorization

Restore supported Stitch generation for the already authorized working Setfarm system. The user approved all audited fixes on 2026-10-19 (original text: `hepsini yapalm`). This is a causally necessary platform fix for unchanged full-eight product convergence, not a generated-project rescue. Mission Control's sibling caller is delivered separately in its sole writer.

## Evidence

Release `74454254a0503bade158a83dc57c9f9b8138baa2`, fresh installation `d10a964b-6053-4400-bfea-1fc79ff07a7f`, actual run `26ec7f1e-6b77-44fe-88ce-26fbbd4e4e3e`: planner accepted, design rejected before acceptance with MCP INVALID_ARGUMENT. Its sealed model is `GEMINI_3_1_PRO`.

Actual authenticated read-only MCP tools/list at 2026-10-18T22:23:51Z returned HTTP 200, 15 tools, response SHA256 `0c1eaccb8ab18e8fb1ed610af3e7daf0034a8615416eb02da72c5b3551864c3e`. The generation tool accepts exactly `MODEL_ID_UNSPECIFIED`, `GEMINI_3_8_FLASH`, `GEMINI_3_5_FLASH_LITE`; the dispatched model is absent. DESKTOP and bare project ID match the schema. Same owned project's get_project also succeeded. This dated live schema is stronger evidence than the stale published SDK enum, and does not promise future provider compatibility or model quality.

## Design

Use explicit `GEMINI_3_8_FLASH` for every production-owned generation default and explicit legacy default pin. Resolve it before generation authority hashing and pass precisely the same value to the transport. Retain an explicitly supplied model byte-for-byte: no silent remap, automatic fallback, hidden generation retry or credential rotation in the attempt-owned path. Existing invalid/rejected/ambiguous/partial-output behavior remains unchanged.

Update four Setfarm production files: runtime-v2.ts, stitch-api.mjs, preclaim.ts, step-ops.ts. Do not bulk rewrite historical attempts, negative test fixtures, receipts or generated projects. No schema, migration or access-control change belongs to this fix.

## Validation and delivery

Offline tests execute actual CLI commands with a fake external transport accepting the dated live enum and capture actual JSON arguments. They prove omitted-default generation succeeds, explicit supported overrides remain unchanged, and rejection/ambiguous/no-replay behavior is retained. Exercise the actual preclaim boundary to prove authority and dispatched stage bind identical default/override bytes; use existing bounded fixtures/seams, no production test-only methods. Source-text grep alone is not new test evidence.

Root alone stages/commits/pushes/delivers, after task spec-and-quality review and a whole-branch review. Builds require clean committed worktree. Keep old failure artifacts; later use reviewed build/new installation and unchanged full8 for actual qualification. Do not claim full8 or GO from offline tests.
