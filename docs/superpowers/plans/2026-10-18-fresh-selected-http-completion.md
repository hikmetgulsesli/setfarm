# Fresh selected project-transfer completion

Status: implemented and independently reviewed. Root captured the original RED before applying production; focused GREEN, no-emit types and maintained contracts passed. Existing ACK repository PostgreSQL regression and clean-main build/runtime qualification remain pending. Outside V1 artifacts are retained as historical preparation.

## Causal scope and File Map

The full eight-case evaluator reads MC operational snapshots and calls exact run-scoped MC sync. MC's existing V3 transfer coordinator persists the canonical project record, publishes the immutable ACK to Setfarm, then requires its canonical readback. The selected dashboard currently refuses that POST before its existing authenticated handler; the evaluator also omits MC authentication when MC AUTH_TOKEN is configured. Fix those two concrete edges. Preserve suite/schema/projection/canary/GO requirements.

- `src/server/dashboard.ts`: rename the interim classifier to `isFreshInstallationDashboardRequestV1`, adding only POST `/api/runs/:id/project-transfer-ack`. Preserve ordinary GET/HEAD/OPTIONS and the existing all-method live-observation refusal. Entry checks, handler bodies, repositories and CORS remain exact. ACK is server-to-server; no blanket writes or new grants.
- `src/evals/convergence-runner.ts`: capture explicit `MC_AUTH_TOKEN` at HTTP-port construction. Send `x-mc-token` only to MC operational-snapshot GET and sync-projects POST, never Setfarm or health. No generic AUTH_TOKEN fallback, token CLI option, URL/body/evidence token or MC .env reader. Root privately supplies intended MC AUTH_TOKEN as evaluator MC_AUTH_TOKEN. Authenticated reads and all sync POSTs reject redirects so a custom credential cannot follow another origin. Preserve 10s snapshot/health and 30s sync response deadlines.
- `tests/installation/fresh-installation-entry.test.ts`: exact production classifier DATA component, ACK positive plus other mutation/method/path/live-observation negatives and pre-handler ordering. No positive installation authority.
- `tests/evals/convergence-http-auth.test.ts`: exact extracted production endpoint/fetch/factory bodies with only external fetch replaced: header confinement, explicit input/no fallback, per-port capture, 401 refusal and no redirect retry. No module initialization, DB, provider or real network.
- This plan at `docs/superpowers/plans/2026-10-18-fresh-selected-http-completion.md`.

## Preserved completion authority

The unchanged ACK handler requires the existing >=32-character operational token and timing-safe header comparison, <=256KiB JSON body and exact URL/body run equality. The unchanged repository requires canonical settled source identity, row lock/CAS, exact immutable ACK and operational outbox. MC still requires matching canonical ACK readback. Existing fresh grants already cover the narrow runs ACK pointer, ACK insert and outbox operations. General MC authentication remains enforced. No receipts or success flags are synthesized.

## Live observation remains closed

Working MC live service status still needs a separately reviewed fresh-compatible observer. Existing GET is an active probe, not passive readiness: canonical receipt/token/capacity checks precede ps/lsof/HTTP, sealed-tree/build hashing and the existing sandbox control challenge. Runtime/log/state defaults use captured selected root, but `src/execution/v3-darwin-runtime-isolation.ts:389-395` uses real homedir()/Library/LaunchAgents as a denied-read target. Config probe roots at `src/execution/v3-deploy-executor.ts:1782-1792` come from SETFARM_SOURCE_ROOT and MISSION_CONTROL_CONFIG_ROOT, not captured private-installation targets. A token/canonical receipt alone does not close fresh confinement. No observation GET allowance is included.

The unchanged observer can create/fsync state-root ancestors and starts an owned sentinel. The existing sandbox challenge attempts denied chmod/read/network/launchctl/signal probes and configured allowed-volume write/read/delete. It retains four active-operation slots; ps2s, lsof3s+1MB, HTTP3s, control3s+64KiB response and existing sealed/build manifest limits are unchanged. The 12s route race bounds a response rather than cancelling all ongoing hashing/probing. Sentinel disposal sends SIGKILL without an explicit terminal wait. This patch does not claim a whole-operation bound, NativeH/ABI proof or live ACTIVE status, and does not use legacy Native/Task6A fixtures as fresh authority.

## Root TDD and remaining qualification

1. Apply test-only patch; preserve actual RED for missing exact ACK allowance and MC token/redirect behavior. No test was run during preparation.
2. Apply independently reviewed Source/plan; run the same tests plus existing deployment-observation-route real HTTP auth/receipt-drift/four-slot tests, focused convergence tests, no-emit types and maintained contracts. Existing actual ACK repository transaction/readback tests remain relevant. Root selects the appropriate existing harness.
3. Independently review actual final composition, deliver normally and use stock clean-main build for genuine selected service/full-eight-case qualification. ACK/projection success, canary/GO, deployment and observation remain unproven until their actual guarded execution. The observer design may be a later separate source-only unit using captured-installation canary targets, without changing receipt/token/policy denials; no observer code is included now.

## Actual verification checkpoint

- Original old-source RED: 26 cases, 22 passed and 4 failed. Failures include the actual old classifier refusing the ACK POST and missing explicit MC token/redirect behavior. Original capture: `fresh-selected-http-completion-red.original.log`, SHA256 `b066e5218d99bbe3a2e89e5c69aa108f908e5bb56ff046b5bf8190840d86ffe9`.
- Applied-source GREEN: 48/48 focused cases passed. Original capture: `fresh-selected-http-completion-green.original.log`, SHA256 `806f09549885891827ac8a76360ce9c16459d5e8170aa73ee981ea39847d3d02`.
- Adjacent ordinary HTTP observer/runner regressions: 11/11 passed. Original capture: `fresh-selected-http-adjacent.original.log`, SHA256 `8b194eac7c5a712c40f8c041d4b2abd4dc74c83f8ef2162b646723d22c74baa6`. Their explicit test ports do not qualify selected operational entry or Native authority.
- TypeScript no-emit and version, English (2157 files), paths (1043 files), migration-digest and Mission Control contract checks passed.
- Independent Resource review found C0/I0/M0; the unchanged ACK and observer handler span was checked byte-for-byte. The final classifier test selects the actual old or new production function so the original POST refusal remains a causal regression, rather than only reporting a missing new name.
- Delivery, the real isolated ACK transaction/readback regression, clean-main stock build, persistent selected services and full eight-case evaluation remain distinct pending outcomes. No legacy protected transition, observation ACTIVE status or overall completion is claimed.
