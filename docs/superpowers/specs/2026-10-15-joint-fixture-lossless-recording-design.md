# Lossless joint-fixture recording

## Cause and authorized scope

Original11088 on clean165c3a4a was cancelled when free disk crossed the8GiB floor. Its158-frame journal ends refused/PRIVATE_TEST_CLUSTER_CANCELLED with incomplete=true and serverClosed=false. It grants no whole-alias PASS or cleanup/family-closure credit. The next four aliases are UNRUN. User explicitly authorized scoped disk cleanup followed by remaining tests and project closure.

The joint adapter test writes its complete verbose trace twice: once as originals JSON and again inside result.stdout. Retained raw siblings across temporary cases occupy about5.25GiB. The39 independently verified closed cases from11088 had2.49GiB of additional raw original/result files. Lossless gzip, streamed SHA256/size roundtrip checks, stable source identities and durable archival mappings recovered2.437GiB from those76 files, in addition to137MiB from the first pair. Logs/2026-10-15-disk-recovery-v1 holds the exact custody receipts. No private PostgreSQL root, source worktree, unknown fixture or original evidence content was deleted.

## Design

Keep the correction local to scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js. Write the child originals and parent result JSON to .json.gz using Node's builtin gzipSync. Read the originals through gunzipSync before the existing assertions. Keep the intent JSON, original child stdout/stderr, program body other than recording, fixture identity, exit/signal/error, EOF/close evidence, every resource oracle and source-only boundary unchanged. Use compression level3 to keep repeated traces small without substantial compression work. No new dependency, production behavior, lifecycle cleanup, test selector, guard, port or authority is introduced.

One-time deletion alone would repeat accumulation. Truncating traces would discard evidence. Lossless recording fixes the measured duplicate-storage cause while preserving all observations. Compressed artifacts remain retained, so later long-term retention policy is separate work; no blanket temporary-directory deletion follows.

## Verification

Before implementation, add artifact assertions to the real recorder after its owned child closes: both raw duplicate files must be absent and both compressed files must exist. Select the first existing qualifier callback only. It should fail on the raw original artifact despite the child completing normally; retain that actual RED. Then implement gzip writes/read and rerun the same exact callback. Decode the persisted result and compare the actual captured stdout/stderr and terminal fields; keep all existing original assertions.

Review the final three-path change and actual RED/GREEN, commit/push the scoped branch, and verify PR280 exact HEAD. Only then run one fresh maintained after-local-custody campaign on clean delivered source. The cancelled five-alias invocation has no aggregate PASS and is not used to skip its incomplete first alias. Do not replay earlier successful aliases or owner-closed UNRUN PM2. Resource floor remains8GiB, monitored during the campaign. A test failure remains a failure and must be classified before completion.

## Limits

The held XS five-file correction, privileged descriptor opt-in, clean-main build/cutover, native/Root admission, live3333 and wider actual product/recovery/fleet acceptance remain independently gated. This test-local storage correction qualifies none of them and is not project completion.
