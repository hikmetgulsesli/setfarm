# Manual orphan Task2A — adopted read-only bootstrap contract v1

Root adopts this contract on2026-10-21 after independent scope review and its two concrete public-result/launch clarifications. It supersedes the parent specification/plan only for the staged read-only Task2A boundary. Task1 stays pure and unchanged; Task3/4 effect capability, collection and publication remain later work. No generic AST/callgraph framework or placeholder capability is added.

**Boundary:** deliver reviewed read-only M, verify actual clean-main bootstrap separately from unchanged T, then implement publication. No retirement/eligibility/full8/rollout credit.

## A0 — close facts

Fixed T Source `161297ffca6adf2851918a93d492e1c9a77ce59d`, I5 `fdd9fe74-ccee-4673-a727-64fe57f68ad0`, job `d756f305-338b-4613-a055-36773303628c`; M≠T. Keep adopted CLI **dist/cli/manual-control-orphan-retirement-v1.js** and adapter `dist/installation/fresh-installation-manual-control-maintenance-v1.js`.

Locator is a NEW packaging rule. Derive M root from exact physical compiled CLI suffix; cwd=M; basename=`setfarm-${verifiedM.sha.slice(0,8)}`, parent=`releases`. Grandparent W must equal existing OS-account workspace resolver (`src/internal-production/baseline-workspace-authority-path-v1.ts:6-14`), allowing only its Darwin `/var` alias. Existing observer derives code-relative root but enforces no releases layout (`baseline-post-handoff-receipt-v1.ts:466-478`). Derive only `W/releases/setfarm-161297ff` and `W/data/installations/<I5>`. No HOME/CLI/env root selector, search or fallback. Records lack release paths; full hashes authenticate.

Hold physical workspace/release/data/installation ancestors; reject aliases/owner/mode/device drift and nonregular/multilink files. Preserve existing system-ancestor rules. Fixed-root data readers authenticate expected T Source/build/package bytes before any compiled/selected T module import; actual old admission remains mandatory afterward. The permitted builtin bootstrap data reader is the unchanged T `scripts/build-generation-retention.mjs`: authenticate its exact bytes against the fixed T Git identity and its builtin-only initialization closure before importing it, then acquire its actual code-relative no-argument `holdCurrentFinalizedSetfarmSourceBuildV1()`. Retain and recheck that separate T Source/build context through every await and close it with the M context. This is the same authenticated bootstrap pattern used for M, not an arbitrary-root or selected-deployment API. Compare the later actual old full-observer identity with the held T identity; script import alone is not Source admission.

**Proposed known Node:** Root reports historical settlement-bound `/opt/homebrew/Cellar/node/26.4.0/bin/node`, SHA256 `59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553`. This is an original-child binding, NOT fresh M launch admission. Root must recheck actual binary identity/hash/protection, version/platform/arch, original argv/cwd/effective env and executable resolution before M nonbuiltin imports. M's pre-observer dependency chain needs its own reviewed evidence; T's profile cannot authenticate M's first imports. Builtin-only until qualified.

Missing A0 inputs block import.

## Actual installed T audit

Anchors here are public files under `/Users/setrox/ai/setrox/releases/setfarm-161297ff/`. A bounded text traversal of static import/export declarations from entry/DB/actual prepare dependencies found 143 dist files and three package roots. The static audit and later public package-byte points are distinguished below; actual import resolution and bootstrap remain unverified.

| Root/version | Required resolution and actual anchors |
|---|---|
| `node_modules/postgres` 3.4.8 | `dist/db-pg.js:7`, runtime verifier `:1`, factory `:5` import postgres. Exports `package.json:8-14`: ESM import → `src/index.js`; no bun/workerd/types/custom conditions. Local modules at `src/index.js:21-26`; connection `src/connection.js:1-12` uses net/tls/crypto/stream/perf_hooks builtins. |
| `node_modules/zod` 4.4.3 | Examples: `dist/execution/schemas/runtime-completion-plan-v1.js:1`, `dist/internal-production/product-build-authority-v2-delivery-evidence-v1.js:1`. Exports `package.json:52-59`: import → `index.js`; no @zod/source/types/custom conditions or CJS substitution. `index.js:1-2` → `v4/classic/external.js`, which loads core/schemas/locales by relative paths and config(en()) at initialization. |
| `node_modules/yaml` 2.9.0 | Mandatory static chain: `dist/db/contract-spine-migrations.js:2` → `installation/fresh-installation-v1.js:2` → `fresh-installation-private-assets-v1.js:5`. No provisioning. Exports `package.json:28-40`: node → `dist/index.js` (CJS), not browser. Internal relative requires; builtins process at `dist/log.js:3`, `compose/composer.js:3`, `parse/parser.js:3`, buffer at `schema/yaml-1.1/binary.js:3`. |

No optional third-party loader found here; exclude other-profile bufferutil/utf-8-validate/fsevents absences and playwright/json5/parse5 roots. Relevant absences are nearer shadow-package/metadata candidates for these three roots, plus any actual newly discovered reachable site. Absence remains unverified.

Zod's internal schema compilation uses Function (`v4/core/util.js:145-162`, `doc.js:27-33`); that is not an arbitrary module loader. Preserve stock behavior and full package bytes; no blanket eval ban, jitless flag or generic proof framework. Unknown reachable module/native loading still blocks.

Fixed path findings:

- Entry `dist/installation/fresh-installation-entry-v1.js:76-155`: compiled/acknowledged selection, fixed dynamic imports116-119 of old DB/full observer/activation verifier/runtime guard; Source equality before SQL; actual read-only transaction/session settings; real runtime/client checks. Assert56-74 fences/closes on refusal.
- DB `dist/db-pg.js:90-184`: privately owns client; imports source/runtime121 and activation verifier130. `fresh-installation-runtime-v1.js:35` imports existing contract-spine verifier. `contract-spine-migrations.js:15645` checks catalog/journal/provenance read-only; no schema initializer. Its initialization91 calls the semantic Source integrity helper, but the compiled helper returns immediately for `.js` (`dist/db/contract-spine-migration-source-integrity.js:391-395`). It does not replace independent pre-import physical T Source admission or the later actual full observer.
- Activation verifier67/151 calls owner-source verifier. `fresh-installation-owner-source-v1.js:121` imports old full observer; helper37 imports migration identities. Finite relative dist imports. Full observer `baseline-post-handoff-receipt-v1.js:766` does Source/artifact checks; this path does NOT call retention-script publication helpers1144/1522.
- DB legacy readiness import1556 is after selected return1551; Task2A never calls workflow admission. Runtime verifier's activation-controller import79 belongs to a different reopen export, not `verifyFreshInstallationRuntimeConnectionV1`. Dormant cutover/publication/provisioning functions do not expand this audit.
- `dist/runtime-config.js:98` invokes loadRuntimeEnv; selected branch35-44 avoids env-file loading but normalizes PATH using `baseline-spawner-launch-environment-v1.js:7-16`. Admit that exact normalization (Node dir, account .local/bin, Homebrew/system dirs); no old-code change or mistaken drift rejection. Actual git resolution under effective PATH remains a launch check.
- DB prepare/getSql preserve cutover guard (`dist/db-pg.js:270-296,371-385`); `baseline-deployment-cutover-v1.js:44` reads canonical account workspace independently of I. A private installation does not isolate this shared read-only guard.
- Actual pgClose `dist/db-pg.js:5051-5069` synchronously fences private epoch/client and awaits owner.end; unconfirmed close throws. No raw epoch export; use assertions, client identity and close semantics.

## Existing inventory/resolution method

Create compact reviewed `src/installation/manual-orphan-target-dependencies-v1.json`: fixed Source/build identity; for each of three packages exact locator/name/version/lock integrity/full member inventory hash/count/bytes, including metadata; finite `[mode,parent,specifier,target]` resolution rows and relevant absence candidates. No expression spans/AST schema. Byte provenance must be trusted retained-release evidence or verified lock-integrity archive members. A lockfile plus freshly hashed installation is not independent authentication.

Reuse methods in `scripts/deployment-cutover-dependencies.mjs:75-145` (archive/lock), `deployment-cutover-retained-profile.mjs:101-170` (complete package inventory), `:180-256` (finite actual Node resolution). Do not reuse the other profile's hashes/Source or selected-deployment root. Existing Source/build covers dist/relative imports.

Enumerate every actual bare-import parent for the three packages in the bounded path; grouped descriptions above do not waive nearer-shadow checks. At admitted test/admission time compare rows with actual known Node in clean resolution-only context, never target imports/hooks. Standard Node/import conditions and YAML node branch must yield exact targets. Check nearer nested node_modules, package metadata/exports/imports and relevant precedence candidates. YAML local CJS requires stay inside its inventoried tree. No custom conditions/NODE_PATH/out-of-root fallback.

Retain existing helper caps:16 roots,2048 members/package,8192 entries,depth32,64MiB total,16MiB/file. Overflow blocks. The earlier static text list of762 files was an audit aid, not the full installed inventory. Later bounded public inventory contains988 regular package members; point provenance below does not admit future pathname imports. Stable nofollow open/read/fstat/lstat, regular single-link identity/hash, held directory listings and absence rechecks remain required around awaits. Preserve immutable-release/single-writer conditions; held FDs do not make Node pathname imports atomic.

## A1 — minimal fixed bootstrap

Only export `observeSelectedManualOrphanBootstrapV1(): Promise<ManualOrphanBootstrapObservationV1>`, arguments.length=0. Exact CLI verb `observe-bootstrap`; `retire` and all other/effect verbs always refuse before T/DB. No WeakSet/effect capability, callbacks, arbitrary root/SQL/module/test-profile inputs, client/handle exports or publication code.

Strict result: `{schema:"setfarm.manual-orphan-bootstrap-observation.v1",state:"verified",maintenance:{sourceSha,sourceTreeHash,buildHash},target:{sourceSha,sourceTreeHash,buildHash,dependencyProfileHash},installationId:<I5>,jobId:<job>,readOnly:true}`. Map sourceSha=observer.sha, sourceTreeHash=observer.treeHash. Fixed error codes only; no private paths/URL/records/original exception. Read-only permits existing verification connections/session-local settings, not durable control/application publication.

Order: known launch/M dependencies → actual independent M observer → fixed locator/T inventory/resolution → internal exact T selection/env BEFORE selected import → actual old entry+DB → prepare/assertions/captured client identity → reobserve M/T/selection/client → actual old pgClose/held-pin closure → success. Refusal latches; unknown cleanup prevents success. No rebind, retry or replaced/weakened old guard.

## A2 — proportional evidence and staged delivery

File Map: adopted CLI/adapter; `src/installation/manual-orphan-bootstrap-pins-v1.ts`; compact profile above; planned `tests/execution-attempts/manual-control-orphan-maintenance-v1.test.ts`, `manual-control-orphan-bootstrap-v1.integration.test.ts`, `helpers/manual-control-orphan-bootstrap-fixture-v1.ts`. Keep the existing Task1 fixture purely data-only and unchanged. The separate bootstrap helper owns explicit fixture setup/lifecycle functions and performs no module-time IO. Change execution-attempt routing/isolated runner only for one exact owned genuine-bootstrap route; no raw or generic command/env/module lane.

Current runner injects projection/preload/clone PG (`scripts/run-isolated-postgres-tests.ts:398-430,551-569,690-743`); genuine child receives none. Preserve actual setup/private-cluster/parent-child/Node/path/DB-role ownership and exit+close+streams/client closure. Setup uses stock M/T and generated I via existing create/initialize/verify/activate APIs under separate isolated authority; no I5 copy/retarget or live credential/schema authority. Shared canonical cutover guard remains actual and must pass; no HOME/mock/account/OS expansion. Missing fixture conditions stay unrun.

Negatives cover selectors/argv/profile, wrong identities/layout/hash/resolution/env, role/catalog/client drift and uncertain cleanup. Genuine matrix: old entry+old DB succeeds; new ordinary entry+old activation refuses; M/T remain distinct; crossed identities refuse; closed client cannot reopen. Generated I cannot pass production I5; synthetic fixture main/origin-main never establishes upstream review.

Deliver read-only M through normal review/actual clean-main stock build/known launch checks. Then separately admitted fixed-I5 observation establishes production positive. Keep component/mechanical/reviewed-main/fixed-I5 evidence distinct. Publication implementation waits for actual verification. Unrun gates: fresh M known-Node/original-launch admission and effective resolution, freshly authenticated complete package/resolution profile, owned genuine fixture, actual old preparation/closure. Historical public archive equality below is useful provenance, not current bootstrap admission. No old Source/activation/journal/reservation/role/credential/ACL/guard changes.


## Root closure of independent review A/B

These definitions supersede shorthand above; the independent v2 review accepted the reduced architecture subject to these two clarifications. They establish no execution or effect credit.

Public refusal codes are exactly BOOTSTRAP_CONTEXT_REFUSED (original launch/argv/environment/locator preconditions), BOOTSTRAP_M_REFUSED (actual independent M Source/build), BOOTSTRAP_TARGET_REFUSED (fixed T/installation/activation identity), BOOTSTRAP_DEPENDENCY_REFUSED (M/T package-byte provenance or resolution), BOOTSTRAP_ENTRY_REFUSED (actual old prepare/assert/client verification), and BOOTSTRAP_CLEANUP_UNKNOWN (any unconfirmed pgClose or owned-pin cleanup). Cleanup uncertainty takes precedence over every earlier failure. API rejection creates a fresh Error whose message is exactly one code, without original error/cause/data. CLI refusal has empty stdout, stderr exactly code plus newline, exit1; original exception messages/stacks are never printed. Verified CLI stdout is JSON.stringify(strict observation) plus newline, stderr empty, exit0 only after confirmed cleanup. Rejection of retire or any unrecognized invocation uses BOOTSTRAP_CONTEXT_REFUSED before T/DB.

Success fields map sourceSha=observer.sha, sourceTreeHash=observer.treeHash, buildHash=observer.buildHash. dependencyProfileHash is SHA256 of the exact authenticated tracked JSON profile file bytes, including its actual whitespace/newline; the file contains no self hash field. Package inventoryHash retains existing helper semantics: sort members by UTF-8 locator bytes, each member object inserted in exact key order {locator,byteLength,sha256}, hash UTF-8 JSON.stringify(members) without newline. Profile/member hashes are separately authenticated by the already defined Source/lock/archive evidence, never trusted merely because supplied.

Production original launch has zero execArgv flags and exactly the known physical Node, fixed physical compiled CLI and observe-bootstrap verb, with cwd=M and fixed argv0. Reject defined NODE_OPTIONS or NODE_PATH, tsx/preload/loader/custom-condition inputs, all GIT_ environment redirections, inherited PG connection/service/options variables, SETFARM_PG_URL/SETFARM_TEST_PG_ADMIN_URL, selected installation/path overrides, and SETFARM_INTERNAL_PRODUCTION_* before M nonbuiltin imports. Do not accept ambient overrides merely because they happen to equal the expected value. Actual original launch provenance must establish this; checking entry-time values cannot undo a preload. Only the internally derived exact T selection/environment is introduced at its specified phase, before the first T selected import; no caller-selected path/URL/profile is added. The fixed Source selection override map remains the authoritative list of selected-path names. Preserve and verify actual stock PATH normalization, including its admitted configured PATH tail and effective executable resolution. If M's initial chain is demonstrably builtin-only, record that fact rather than inventing a nonbuiltin dependency.

Root adopted these definitions as the binding Task2A contract. Original M launch, complete current inventory/resolution admission, genuine fixture and fixed-I5 positive remain unrun gates. No publication or eligibility authority follows from document adoption.

## Public dependency provenance points, not runtime admission

Root's bounded read-only2026-10-21T13:31:40Z inventory matched the unchanged T package-lock Git object and988 installed regular members (5543945 bytes), with stable file/directory rechecks. The Node binary bytes matched the historical executable hash; this is not fresh M launch proof. The inventory receipt SHA256 is8fc7961c767c849bafe1a38d067e5667e3e335264dd64f5249bd78e552b733ed.

| Package | Members | Decoded bytes | Full member inventory SHA256 |
|---|---:|---:|---|
| postgres3.4.8 |37|299870|f637c4e26b60d71692542661d95f246faacaa84c5271aaba48935eda9e1f4f47|
| zod4.4.3 |718|4558122|b13968adc50fe78bf25afcd6deee94b95eb9a10facaed4467b3036764451e921|
| yaml2.9.0 |233|685953|686aded00ccb77b2796c1202375689811360e8b838ce5980cb39f187d82f68a7|

The first point authenticated the cached postgres archive. At13:33:13Z, two public official-NPM archives independently passed the Git-pinned lock SHA512 integrity and every member matched the prior zod/yaml inventory. Separate equality receipt SHA256 isb69b87d869068416b2ec7d31c15a474e69c10eb92a4831801c2dd510446f4065. No archive was installed/extracted into either release and no target module was imported. Earlier unavailable-cache flags are historical, not overwritten. These point observations support the reviewed profile constants; actual M/T Source/build, relevant resolution/shadow absences, protected pathname stability and cleanup remain mandatory runtime gates.

## Fixed parent-directory resolution groups

A subsequent Source-only enumeration found82 actual nonbuiltin parent sites in143 emitted dist files:78 zod,3 postgres,1 yaml. They occupy14 distinct `(mode, exact parent directory, specifier, target)` contexts in13 parent directories. The raw82-file membership list must remain complete in the reviewed profile; it is not truncated to64 or treated as dormant.

For this fixed Source and ordinary loader-free ESM bare-root imports only, admit one real parent-file representative per exact-directory context, retaining and authenticating every group member against the finalized Source/build. Each member must be a physical regular `.js` file in that same held physical directory, with identical mode/specifier/target and Node/conditions/environment. Package scope/self-reference metadata and nearer node_modules search candidates are shared by those exact-directory members and must all be pinned/rechecked; no aliases, query/fragment, hooks, per-file override or cross-directory equivalence is admitted. A crossed/missing/duplicate/extra membership, metadata or directory drift refuses the complete group. This is context equivalence, not permission to omit actual import sites or code-byte provenance.

The existing64-row resolver cap continues to bound contexts; current14 fit. Do not raise it or split a too-large context set into batches. The16 nearer package roots and13 intermediate scope-metadata candidates from the complete enumeration are all required absence/topology checks, in addition to the3 authenticated package inventories and T root package.json. M's own reachable dependency contexts must be authenticated independently; T's list does not silently admit M. Actual known-Node resolution-only checks, original M launch, genuine old entry/DB preparation and cleanup remain unrun gates.
