# Internal Production Golden Product Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the current Setfarm build with an ordered seven-profile product matrix whose products run, satisfy Setfarm-owned behavioral assertions, settle all authority, and retain bounded review evidence.

**Architecture:** Build profile-specific assertion adapters behind one typed `GoldenProductAssertionPort`, then drive them from the golden-run harness delivered by Subproject B. Profiles 1–5 create new V3 feature-development runs; Profiles 6–7 provision a fresh intent-, attempt-, and epoch-bound private repository from an immutable checked-in template, execute its canonical workflow, and require Setfarm-owned exact-head reviewed integration before acceptance. The matrix runner starts one case at a time, freezes on every non-accepted result, and never edits a generated repository outside Setfarm's canonical recovery path.

**Tech Stack:** TypeScript ESM, Node.js 22+, Zod, PostgreSQL, Playwright, Node child processes, Git, GitHub CLI, Setfarm runtime artifact readers, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-13-setfarm-mission-control-internal-production-closure-design.md`

## Global Constraints

- External Developer ID, notarization, signed PKG, installer receipt, and helper authority remain out of scope and blocked.
- Profiles 1–5 use `feature-dev` with protocol `v3`; Profiles 6–7 use `bug-fix` and `security-audit` and report the protocol actually selected by those workflows.
- Node CLI, Node Express API, and Vite/React must each produce two accepted clean runs; the remaining four profiles must each produce one accepted run.
- Start exactly one matrix case at a time and start no successor until the preceding receipt is `accepted`.
- Matrix/standard fresh stage requires the complete platform and phase ownership census to total zero. The reusable one-case gateway may support B's exact fleet-threshold campaign: fleet fresh stage requires unrelated, prior-epoch, and unattributed ownership all observed zero and permits only authenticated same-campaign/same-epoch ownership with `activeSameCampaignCount < eligibleMaximum`. Continuing an already authenticated prepared reservation does not reacquire a slot. Matrix acceptance, settlement, source build, and finalization always require total ownership zero.
- A non-accepted case freezes starts until the evidence is classified and reviewed; the same systemic cause seen three times after attempted fixes stops the program.
- Product success comes from Setfarm-owned command, HTTP, DOM, state, accessibility, visual, source, GitHub, and lifecycle evidence, never agent prose.
- Do not manually patch a generated repository, bypass quota/runtime/dirty-build guards, force a protocol label, or revive a run polluted by pre-fix platform behavior.
- Every accepted run ends with zero open claim, runtime, completion, effect, process, port, lease, or worktree ownership.
- A bug-fix or security-audit attempt never resets, deletes, or reuses a prior local repository or remote. Every launch intent receives one new path-private repository and one new private GitHub remote, and every retry or release epoch receives another attempt identity.
- Worker code never fetches, pulls, switches, merges, or integrates canonical branches. Only Setfarm's authenticated completion/integration owner may synchronize the exact reviewed head to remote `main`, and collection requires that authority.
- Every documented shell block that can start a workflow, write a tracked/private receipt, recover/advance a run, reconcile a timeout, or record finalization begins with `set -euo pipefail`. Every read-only guard is in that same shell control flow before the mutation; a failed guard terminates the block, and no later command, redirect, temporary publication, CLI mutation, or Git/GitHub action runs. Plan/source-transcript tests reject `$(` anywhere in a `test`, `[`, or `[[` predicate, a `readonly`, `export`, `local`, or `declare` invocation, another outer command's argv, or a redirection; command substitution is allowed only in a standalone simple assignment or the enumerated status-aware `if VAR="$(negative scan)"` captures. Fixtures independently inject nonzero into every inner producer, exercise both producers formerly embedded in every dual-substitution equality as separate failures, and make each cleanliness producer return nonempty tracked or untracked dirt, proving no later predicate, outer command, mutation, or evidence publication executes.
- Commit no credentials, absolute host paths, raw agent output, live database dump, screenshot cache, or generated runtime artifact.

## File Map

- Create `src/internal-production/golden-product-matrix-owner-producer-manifest-activation-controller-v1.ts` — C-only, import-inert, path-free controller that wraps the exact A+B21-to-A+B+C27 activation in a durable predecessor/successor receipt and status.
- Create `tests/internal-production/golden-product-matrix-owner-producer-manifest-activation-controller-v1.test.ts` — C controller receipt/status, CLI, interruption/replay, import-inertness, and no-C-producer-before-activation tests.
- Modify `src/internal-production/golden-run-cli.ts` — route only C's two zero-input matrix activation verbs to the C controller.
- Modify `tests/internal-production/golden-run-cli.test.ts` — exact matrix activation argv, output, and no-unknown-argument boundary tests.
- Modify `package.json` — retain `internal:golden-matrix` and route its exact `activate-owner-producer-manifest --json` and read-only `owner-producer-manifest-status --json` forms.

---

### Task 1: Define the Product Assertion Contract

**Files:**
- Create: `src/internal-production/golden-product-assertion-registry.ts`
- Test: `tests/internal-production/golden-product-assertion-registry.test.ts`

**Interfaces:**
- Consumes: Subproject B's exact `GoldenLaunchOperationMigrationCurrentVerificationV1`, zero-input read-only `verifyCurrentGoldenLaunchOperationMigrationV1()`, `GoldenProductAssertionPort`, `GoldenAssertionSubjectV1`, `authenticateGoldenAssertionSubjectV1`, `GoldenProductAssertionContractV1Schema`, `GoldenProductAssertionSetV1Schema`, `GoldenCaseV1`, `GoldenRunPollV1`, `GoldenCanonicalCollectionV1`, and `GoldenProjectInspectionV1` contracts. The authenticated assertion subject and its case-bound contract are the only sources of repository paths, accepted source identity, invocation authority, runtime origin, finite API route/payload/response identity, finite browser route/selector/state identity, and optional fixture authority.
- Produces:

```ts
export interface InternalProductionArtifactWriter {
  put(input: Readonly<{
    assertionId: string;
    payload: unknown;
    maximumBytes: number;
  }>): Promise<Readonly<{ evidenceRef: CanonicalRef; evidenceHash: string }>>;
}

export interface GoldenBrowserSession {
  visitPath(path: "/" | "/queue" | "/shifts" | "/settings" | "/tickets" | "/tickets/1" | "/missing"): Promise<void>;
  clickRole(role: "button" | "link", name: string): Promise<void>;
  fillLabel(label: string, value: string): Promise<void>;
  press(key: "Enter" | "Escape" | "Space" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"): Promise<void>;
  reload(): Promise<void>;
  readRoleText(role: "alert" | "heading" | "listitem" | "status", name?: string): Promise<string>;
  readState(keys: readonly string[]): Promise<Readonly<Record<string, string | null>>>;
  gameAction(action: "start" | "pause" | "resume" | "move-left" | "move-right" | "finish"): Promise<Readonly<{ state: string; score: number; highScore: number }>>;
  captureSupplementalScreenshot(assertionId: string): Promise<Readonly<{ evidenceRef: CanonicalRef; evidenceHash: string }>>;
  readConsoleErrorHashes(): Promise<readonly string[]>;
  assertBoundOrigin(): Promise<void>;
  close(): Promise<void>;
}

export interface GoldenBrowserDependencies {
  openSession(subject: GoldenAssertionSubjectV1): Promise<GoldenBrowserSession>;
  artifactWriter: InternalProductionArtifactWriter;
  navigationTimeoutMs: number;
  assertionTimeoutMs: number;
}

export function createInternalProductionArtifactWriter(): InternalProductionArtifactWriter;

export function createPlaywrightGoldenBrowserDependencies(input: Readonly<{
  artifactWriter: InternalProductionArtifactWriter;
}>): GoldenBrowserDependencies;

export function createProfileDispatchedGoldenAssertionPort(input: Readonly<{
  nodeCli: GoldenProductAssertionPort;
  nodeApi: GoldenProductAssertionPort;
  browser: GoldenProductAssertionPort;
  game: GoldenProductAssertionPort;
  repositoryWorkflow: GoldenProductAssertionPort;
}>): GoldenProductAssertionPort;

export const GoldenProfileAssertionIdsV1: Readonly<Record<
  GoldenProfileIdV1,
  readonly string[]
>>;
```

- [ ] **Step 0: Start the serialized Subproject C Setfarm-owned source run from clean current main**

```bash
set -euo pipefail
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_001="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_001" = "main"
C_SHELL_TEST_VALUE_002="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_003="$(git rev-parse origin/main)"
test "$C_SHELL_TEST_VALUE_002" = "$C_SHELL_TEST_VALUE_003"
C_SOURCE_ROOT="$(git rev-parse --show-toplevel)"
export C_SOURCE_ROOT
C_SHELL_TEST_VALUE_004="$(basename "$C_SOURCE_ROOT")"
test "$C_SHELL_TEST_VALUE_004" = "setfarm"
C_LAUNCH_MIGRATION_VERIFICATION="$(node dist/internal-production/golden-run-cli.js \
  verify-launch-operation-migration --json)"
printf '%s\n' "$C_LAUNCH_MIGRATION_VERIFICATION" | jq -e \
  --arg currentSha "$C_SHELL_TEST_VALUE_002" '
  .schema == "setfarm.internal-production-golden-launch-operation-migration-current-verification.v1" and
  .currentSourceSha == $currentSha and
  (.applicationSourceSha | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.receiptRef | type == "string") and
  (.receiptHash | test("^[0-9a-f]{64}$")) and
  (.migrationModuleBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
  (.migrationStatementsHash | test("^[0-9a-f]{64}$")) and
  (.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
  (.schemaProjectionHash | test("^[0-9a-f]{64}$")) and
  (.verificationHash | test("^[0-9a-f]{64}$"))
' >/dev/null
node dist/cli/cli.js workflow run feature-dev \
  "Implement docs/superpowers/plans/2026-08-13-internal-production-golden-product-matrix-plan.md exactly --repo $C_SOURCE_ROOT --branch main" \
  --protocol v3
```

Expected: the Setfarm owner has already synchronized clean canonical `main` to `origin/main`, B is merged, no other Setfarm writer/run owns this repository, and B's exact zero-input verifier has freshly reopened the terminal application receipt and proven this clean current SHA descends from it while the dedicated B migration module, ordered statements, named digest entry, digest, and schema projection remain exact. Only then may the canonical V3 source run mutate workflow state. A fixture with a strict descendant C SHA passes; an equal-only check, nonancestor, changed B module/statements/named entry/schema, corrupt terminal pair, or absent verifier blocks with a zero workflow-start counter. Appending an unrelated migration/digest registry entry remains valid. The worker performs only the read-only assertions above; it never fetches, switches, or pulls a branch. Setfarm creates and owns every scoped story worktree/branch, immutable claim, commit, push, review transition, merge, cleanup, and later canonical-main synchronization for Tasks 1–8. Developer, reviewer, supervisor, QA, and final-test agents never run `git add`, `git commit`, `git push`, `gh pr create`, or `gh pr merge`. They submit only the exact claim output through `setfarm step complete`; Setfarm's completion owner performs the Git handoff after gates pass. Do not write campaign receipts/reports in this source run. Task 9 privately finalizes the matrix after all A-E source merges on the final operational epoch; Subproject E's one final Setfarm-owned docs claim later materializes the reviewed C, D, and E bytes together.

- [ ] **Step 1: Write the failing schema test**

Test the exact Subproject B assertion shape, duplicate assertion IDs, absolute-path refs, secret-like refs, unknown evidence kinds, and a `verdict:"pass"` assertion without an evidence ref. Import B's exact assertion-contract schema and build all four closed variants: inventory `/items`, appointments `/appointments`, reading queue `/queue`, and volunteer shifts `/shifts`. Prove the registry dispatches each only to its matching API/browser adapter and rejects a swapped profile, case, route, selector, payload, expected-response/state ID, or structural clone before artifact, socket, or browser activity.

```ts
const assertionPayload = {
  schema: "setfarm.internal-production-product-assertion-set.v1",
  adapterId: "node-cli",
  adapterHash: "a".repeat(64),
  assertionContractHash: "b".repeat(64),
  assertions: [{
    assertionId: "cli-add-canonical-jsonl",
    evidenceKind: "cli",
    verdict: "pass",
    evidenceRefs: ["setfarm://internal-production/artifacts/cli-add-canonical-jsonl"],
  }],
} as const;
assert.equal(GoldenProductAssertionSetV1Schema.safeParse({
  ...assertionPayload,
  assertionSetHash: hashCanonicalJson(assertionPayload),
}).success, true);
```

- [ ] **Step 2: Run the test and observe RED**

Run: `node --import tsx --test tests/internal-production/golden-product-assertion-registry.test.ts`

Expected: FAIL because the schema does not exist.

- [ ] **Step 3: Implement the strict schema and port**

Import and reuse Subproject B's exact schemas, exported `CanonicalRefSchema`, `resolveInternalProductionDataRootV1()`, and `GoldenProductAssertionPort.evaluate(...)` signature; do not create another assertion schema, reference grammar, or port. Implement the artifact writer and browser session behind fixed-root factories with no caller-chosen filesystem root, executable, repository, environment, or runtime origin. `createInternalProductionArtifactWriter()` writes canonical JSON only below the resolver's fixed `golden-results/assertion-artifacts/sha256` child, clamps the caller cap to `256 KiB`, uses content-addressed exclusive mode-`0600` writes below real mode-`0700` directories, returns a B-parsed canonical `setfarm://internal-production/artifacts/assertions/sha256/...` ref, and rejects symlink, collision, secret-like key, absolute path, non-finite value, oversized payload, or any second URI family. The dispatcher passes the complete B input unchanged. Every concrete adapter first calls B's `authenticateGoldenAssertionSubjectV1(input.subject)` and performs no side effect when it rejects a structurally forged/copy-constructed subject. It then derives all executable/path/origin inputs only from that authenticated reference and rejects any run, source, repository, runtime, fixture, or assertion-contract disagreement with `input.run`, `input.canonical`, or `input.goldenCase`. `openSession(subject)` authenticates the capability again, binds one browser context to the exact loopback origin, blocks cross-origin requests/navigation, exposes only the finite route union above, bounds label/value/state text, and has no raw selector/evaluate/script/arbitrary-URL method. The adapter maps B's finite selector IDs internally to code-owned role/label/test-ID operations. Dispatch by the exact assertion-contract kind and nested contract ID, require returned adapter identity and complete contract hash to match, and reconstruct/validate `assertionSetHash` before returning. No C factory or Subproject E caller accepts a route, selector, payload, expected response, or state override.

Define the exact required assertion IDs once and reuse them in the matrix catalog and adapters:

- `node-cli`: `cli-add-canonical-jsonl`, `cli-list-canonical-jsonl`, `cli-state-persists`, `cli-title-required`;
- `node-express-api`: `api-health-json`, `api-crud-roundtrip`, `api-validation-json`, `api-state-persists`;
- `vite-react-web`: `web-route-navigation`, `web-form-validation`, `web-keyboard-accessible`, `web-state-persists`, `web-console-clean`;
- `stateful-multipage-web`: `service-desk-list-detail`, `service-desk-edit-validation`, `service-desk-empty-not-found`, `service-desk-shared-state`, `service-desk-console-clean`;
- `interactive-browser-game`: `game-state-machine`, `game-keyboard-control`, `game-high-score-persists`, `game-console-clean`;
- `existing-repository-bug-fix`: `bug-before-failure`, `bug-scoped-source-delta`, `bug-verification-passes`, `bug-review-retry-settled`, `bug-worktree-clean`;
- `existing-repository-security-audit`: `security-traversal-finding`, `security-html-escaping-finding`, `security-scoped-remediation`, `security-verification-passes`, `security-residual-advisory-preserved`, `security-worktree-clean`.

- [ ] **Step 4: Run the test and observe GREEN**

Run: `node --import tsx --test tests/internal-production/golden-product-assertion-registry.test.ts`

Expected: PASS; malformed, duplicate, secret-like, absolute-path, and body-bearing inputs are rejected.

- [ ] **Step 5: Submit the scoped story to Setfarm's completion owner**

Use the immutable claim's `setfarm step complete` command and output file after the focused test is green. The completion owner must accept only the two listed files, rerun the claim-bound checks, commit/push them on the managed story branch, and publish its durable handoff receipt. The developer agent performs no direct Git mutation.

### Task 2: Implement the Node CLI Assertion Adapter

**Files:**
- Create: `src/internal-production/assertions/node-cli-golden-assertions.ts`
- Test: `tests/internal-production/node-cli-golden-assertions.test.ts`

**Interfaces:**
- Consumes: `GoldenProductAssertionPort.evaluate(input)` and only `input.subject.invocation.kind === "node-cli"` for the executable, argv prefix, working directory, state directory, accepted SHA/tree, and timeout authority.
- Produces:

```ts
export function createNodeCliGoldenAssertionPort(input: Readonly<{
  commandTimeoutMs: number;
  artifactWriter: InternalProductionArtifactWriter;
}>): GoldenProductAssertionPort;
```

- [ ] **Step 1: Write failing behavior tests against a temporary CLI fixture**

The fixture exposes `add --title <value>` and `list`. Invoke it through a schema-valid `GoldenAssertionSubjectV1` assembled by B, not a caller-supplied executable/path. Assert exact results:

```ts
assert.deepEqual(valid, {
  exitCode: 0,
  stdout: '{"id":1,"title":"First task"}\n',
  stderr: "",
});
assert.deepEqual(invalid, { exitCode: 2, stdout: "", stderr: "TITLE_REQUIRED\n" });
assert.equal(list.stdout, '{"id":1,"title":"First task"}\n');
assert.equal(readbackAfterSecondProcess, '{"id":1,"title":"First task"}\n');
```

Also reject dirty source, HEAD/tree mismatch, invocation outside the admitted package ABI, output over 64 KiB, timeout, and a descendant process left alive.

- [ ] **Step 2: Run the test and observe RED**

Run: `node --import tsx --test tests/internal-production/node-cli-golden-assertions.test.ts`

Expected: FAIL because the factory is absent.

- [ ] **Step 3: Implement bounded command execution**

Resolve invocation only from `input.subject.invocation`; require `kind:"node-cli"`, exact accepted source/repository equality, a clean source tree, and no argument outside the admitted `argvPrefix` plus the four fixed contract operations. Spawn without a shell, cap stdout/stderr independently at 64 KiB, apply the smaller of the admitted timeout and 30 seconds, terminate the process group on timeout, run each command in a fresh process, hash exact `{argv,exitCode,stdout,stderr}`, and store bounded structured evidence. A schema-valid subject with a swapped executable, working directory, state directory, source SHA/tree, run, or binding hash returns fail-closed assertions and performs no spawn.

- [ ] **Step 4: Run the focused test and observe GREEN**

Run: `node --import tsx --test tests/internal-production/node-cli-golden-assertions.test.ts`

Expected: PASS for add/list/readback, invalid-title exit 2, and every fail-closed negative.

- [ ] **Step 5: Submit the scoped story to Setfarm's completion owner**

Use only the immutable claim's completion command and output file after GREEN. Require the durable handoff receipt to name exactly the adapter and test file; Setfarm alone commits and pushes the managed story branch.

### Task 3: Implement the Node Express API Assertion Adapter

**Files:**
- Create: `src/internal-production/assertions/node-api-golden-assertions.ts`
- Test: `tests/internal-production/node-api-golden-assertions.test.ts`

**Interfaces:**
- Consumes: B's `GoldenProductAssertionPort.evaluate(input)` and only `input.subject.runtime.kind === "live-verifier-runtime" && input.subject.runtime.adapter === "http"` for the admitted loopback origin plus deployment/process/listener authority hashes.
- Produces:

```ts
export function createNodeApiGoldenAssertionPort(input: Readonly<{
  artifactWriter: InternalProductionArtifactWriter;
  restartDurability: typeof restartGoldenVerifierRuntimeForDurabilityV1;
}>): GoldenProductAssertionPort;
```

- [ ] **Step 1: Write failing API lifecycle tests**

Assert exact `/health`, create, read, update, list, and validation-error responses through the subject's admitted loopback origin for both B-authenticated contracts. `inventory-items-v1` uses only `/items` and its finite inventory payload/response IDs; `appointments-v1` uses only `/appointments` and its finite appointment payload/response IDs. After the write/update evidence is durably captured, call B's finite authenticated `restartGoldenVerifierRuntimeForDurabilityV1()` exactly once with the subject and expected state hash. Require its receipt to prove old-process absence, release of the original listener/lease, a fresh B-owned process and loopback listener under the same sealed runtime/source/run authority, and a reminted authenticated subject. Use that subject for a fresh HTTP client read and prove the updated SQLite record survived. This is required independently for both accepted API results; Subproject D later exercises an additional recovery scenario but cannot substitute for this product assertion.

```ts
assert.deepEqual(await json("GET", "/health"), { status: 200, body: { ok: true } });
assert.deepEqual(await json("POST", "/items", { title: "" }), {
  status: 400,
  body: { code: "VALIDATION_ERROR", field: "title" },
});
```

- [ ] **Step 2: Run the test and observe RED**

Run: `node --import tsx --test tests/internal-production/node-api-golden-assertions.test.ts`

Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement lifecycle-safe HTTP evidence**

Parse the subject origin and require `http:` plus hostname `127.0.0.1`, a valid nonzero port, exact deployment/process/listener authority, and repository/source/run equality before opening a socket. Authenticate the complete case/subject contract hash, dispatch its exact nested contract ID, and map only the code-owned valid/invalid payload and expected-response IDs to fixed request/response bodies; append only that contract's literal collection path to the bound origin. Use 10-second request deadlines and 128 KiB response limits and capture status/content-type/body hashes. The adapter has no arbitrary path, request-body, expected-response, method, or query input and never probes both resource families for one case. The adapter has no general process-control authority: its only lifecycle action is the B-owned finite restart helper, which authenticates the WeakMap subject and owns stop/start/rejoin. A swapped contract/path/payload/response ID, origin, missing runtime/restart authority, wrong profile, reused restart receipt, non-loopback host, source drift, listener mismatch, state-hash mismatch, or second restart returns fail-closed assertions before a socket. Crash/retry tests prove B reattaches to or completes the same restart operation and never starts a second replacement.

- [ ] **Step 4: Run the test and observe GREEN**

Run: `node --import tsx --test tests/internal-production/node-api-golden-assertions.test.ts`

Expected: PASS for both inventory and appointment contracts, including cross-contract swaps, wrong-listener, leak, oversized-body, and non-loopback refusal cases.

- [ ] **Step 5: Submit the scoped story to Setfarm's completion owner**

Use only the immutable claim's completion command and output file after GREEN. Require the durable handoff receipt to name exactly the API adapter and test file; Setfarm alone commits and pushes the managed story branch.

### Task 4: Implement Browser, Accessibility, and Game Assertion Adapters

**Files:**
- Create: `src/internal-production/assertions/browser-golden-assertions.ts`
- Create: `src/internal-production/assertions/game-golden-assertions.ts`
- Test: `tests/internal-production/browser-golden-assertions.test.ts`
- Test: `tests/internal-production/game-golden-assertions.test.ts`

**Interfaces:**
- Consumes: B's complete `GoldenProductAssertionPort.evaluate(input)` and `input.subject.runtime.kind === "live-verifier-runtime" && input.subject.runtime.adapter === "browser"`; uses the admitted loopback origin and exact deployment/process/listener hashes without constructing or restarting a runtime.
- Produces:

```ts
export function createBrowserGoldenAssertionPort(
  dependencies: GoldenBrowserDependencies,
): GoldenProductAssertionPort;

export function createGameGoldenAssertionPort(
  dependencies: GoldenBrowserDependencies,
): GoldenProductAssertionPort;
```

- [ ] **Step 1: Write failing Vite and stateful-web tests**

Use deterministic local fixtures reached through schema-valid B assertion subjects. Exercise both exact Vite contracts: reading queue navigates only to `/queue` and resolves only the three reading-queue selector IDs; volunteer shifts navigates only to `/shifts` and resolves only the three volunteer-shift selector IDs. Prove route navigation, form validation, keyboard activation, contract-specific payload/state identity, persistent state after reload, list/detail/edit/empty/not-found behavior, no uncaught page error, no severe console message, and exact final route/state. Reject a swapped contract/route/selector/payload/state ID, a fixture whose only evidence is a screenshot, whose runtime origin is not the subject origin, or whose repository/source/run binding has drifted.

- [ ] **Step 2: Write failing game-state tests**

Drive an admitted deterministic state bridge through `ready -> active -> paused -> active -> terminal`; assert exact score/state values and a supplemental screenshot ref while B's verifier-runtime lease is active. The adapter closes its browser context and proves no page/worker remains in that context. It does not assert process/listener settlement while the admitted product runtime is deliberately live; B stops the verifier runtime after assertions and owns the authoritative post-release zero-process/listener observation.

- [ ] **Step 3: Run both tests and observe RED**

```bash
node --import tsx --test \
  tests/internal-production/browser-golden-assertions.test.ts \
  tests/internal-production/game-golden-assertions.test.ts
```

Expected: FAIL because both factories are absent.

- [ ] **Step 4: Implement deterministic Playwright-backed adapters**

Open Playwright through `createPlaywrightGoldenBrowserDependencies()` and navigate only to the exact subject loopback origin plus the route literal selected by B's authenticated nested contract. Resolve its finite selector IDs through a code-owned role/label/test-ID table and its payload/state IDs through code-owned values; expose none as caller text. Use stable roles, labels, or compiled test IDs; a 30-second navigation deadline; a 10-second assertion deadline; a closed list of console severity failures; content-addressed screenshots; and final browser-session cleanup proof. Process/listener ownership remains canonical B evidence; the adapter verifies its hashes but never controls that process. Add negative tests for a swapped contract, `/queue`/`/shifts` route, selector/payload/state ID, subject origin, source SHA/tree, repository path/ref, fixture identity, runtime hashes, and binding hash, proving no browser session opens.

- [ ] **Step 5: Run focused and adjacent browser tests**

```bash
node --import tsx --test \
  tests/internal-production/browser-golden-assertions.test.ts \
  tests/internal-production/game-golden-assertions.test.ts
npm run test:evidence
```

Expected: PASS for both reading-queue and volunteer-shift contracts, with DOM/state evidence authoritative, swapped contracts rejected before navigation, and screenshot-only fixtures rejected.

- [ ] **Step 6: Submit the scoped story to Setfarm's completion owner**

Use only the immutable claim's completion command and output file after GREEN. Require the handoff receipt to bind the four listed files and browser cleanup evidence; Setfarm alone commits and pushes the managed story branch.

### Task 5: Build Controlled Bug-Fix and Security-Audit Fixtures

**Files:**
- Create: `tests/fixtures/internal-production/bug-fix/package.json`
- Create: `tests/fixtures/internal-production/bug-fix/.gitignore`
- Create: `tests/fixtures/internal-production/bug-fix/src/slug.ts`
- Create: `tests/fixtures/internal-production/bug-fix/tests/slug.test.ts`
- Create: `tests/fixtures/internal-production/bug-fix/golden/verify-baseline-failure.mjs`
- Create: `tests/fixtures/internal-production/bug-fix/golden/verify-final-behavior.mjs`
- Create: `tests/fixtures/internal-production/security-audit/package.json`
- Create: `tests/fixtures/internal-production/security-audit/.gitignore`
- Create: `tests/fixtures/internal-production/security-audit/src/path-policy.ts`
- Create: `tests/fixtures/internal-production/security-audit/src/render-comment.ts`
- Create: `tests/fixtures/internal-production/security-audit/tests/security.test.ts`
- Create: `tests/fixtures/internal-production/security-audit/golden/verify-baseline-findings.mjs`
- Create: `tests/fixtures/internal-production/security-audit/golden/verify-final-behavior.mjs`
- Create: `src/internal-production/existing-repository-fixture-catalog.ts`
- Create: `src/internal-production/assertions/repository-workflow-golden-assertions.ts`
- Create: `src/internal-production/repository-workflow-integration-authority-v1.ts`
- Create: `src/internal-production/golden-post-pr-review-checkpoint.ts`
- Create: `src/execution/post-pr-review-authority-v1.ts`
- Create: `src/installer/steps/13-post-pr-review/module.ts`
- Create: `src/installer/steps/13-post-pr-review/preclaim.ts`
- Create: `src/installer/steps/13-post-pr-review/context.ts`
- Create: `src/installer/steps/13-post-pr-review/guards.ts`
- Create: `src/installer/steps/13-post-pr-review/prompt.md`
- Modify: `src/installer/steps/registry.ts`
- Modify: `src/installer/step-ops.ts`
- Modify: `src/execution/v3-stage-execution-context.ts`
- Modify: `src/internal-production/golden-run-repository.ts`
- Modify: `src/internal-production/golden-run-harness.ts`
- Modify: `workflows/bug-fix/workflow.yml`
- Test: `tests/internal-production/existing-repository-fixture-catalog.test.ts`
- Test: `tests/internal-production/repository-workflow-golden-assertions.test.ts`
- Test: `tests/internal-production/repository-workflow-integration-authority-v1.test.ts`
- Test: `tests/internal-production/post-pr-review-authority-v1.test.ts`
- Test: `tests/internal-production/golden-post-pr-review-checkpoint.test.ts`
- Test: `tests/internal-production/golden-run-repository.test.ts`
- Test: `tests/internal-production/golden-run-harness.test.ts`
- Test: `tests/bug-fix-post-pr-review.test.ts`
- Test: `tests/claim-log-lifecycle.test.ts`
- Test: `tests/execution-attempts/v3-stage-execution-context.test.ts`

**Interfaces:**
- Consumes: B's exact `GoldenExistingRepositoryFixtureTemplateV1Schema`, `GoldenAuthenticatedFixtureTemplateV1`, `inspectGoldenFixtureTemplateV1`, `authenticateGoldenFixtureTemplateV1`, `GoldenExistingRepositoryFixtureIdentityV1Schema`, `GoldenExistingRepositoryFixtureAttemptV1Schema`, `GoldenFinalReleaseEpochV1Schema`, `GoldenExistingRepositoryAttemptProvisioningPortV1`, `authenticateGoldenFixtureWorkflowV1`, `executeAuthenticatedGoldenFixtureVerificationV1`, persisted `GoldenLaunchIntentV1`, fixed ignored fixture root, a checked-in seed kind, authenticated GitHub CLI identity, and canonical workflow evidence. The existing-repository launch intent's preparation contains only `preparation.kind:"existing-repository-fixture-attempt"`, `templateHash`, `templateRef`, `attemptOrdinal`, and `attemptKeyHash`; the enclosing authenticated intent also carries the complete final epoch and release relation, and C provisioning occurs only after B has fsynced it.
- Produces:

```ts
export type GoldenExistingRepositorySeedKindV1 = "bug-fix" | "security-audit";

export type GoldenExistingRepositoryCampaignIdV1 =
  | "setfarm-mc-internal-production-v1"
  | "internal-production-2026-08-13"
  | "internal-production-fleet-2026-08-14";

export const GoldenPostPrReviewApprovedIdentityV1 = [
  ["setfarm-mc-internal-production-v1", "existing-repository-bug-fix"],
  ["internal-production-2026-08-13", "recovery-06-bugfix-review"],
  ["internal-production-fleet-2026-08-14", "fleet-repository-bug-fix"],
] as const;

export type PreparedGoldenExistingRepositoryTemplatesV1 = Readonly<{
  templates: readonly GoldenExistingRepositoryFixtureTemplateV1[];
  templateSetHash: string;
}>;

export function prepareGoldenExistingRepositoryTemplatesV1(input: Readonly<{
  campaignId: GoldenExistingRepositoryCampaignIdV1;
}>): Promise<PreparedGoldenExistingRepositoryTemplatesV1>;

export function createGoldenExistingRepositoryAttemptProvisioningPortV1():
  GoldenExistingRepositoryAttemptProvisioningPortV1;

export function createRepositoryWorkflowGoldenAssertionPort(input: Readonly<{
  artifactWriter: InternalProductionArtifactWriter;
}>): GoldenProductAssertionPort;

export type RepositoryWorkflowIntegrationAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-repository-workflow-integration-authority.v1";
  campaignHash: string;
  caseId: string;
  workflowId: "bug-fix" | "security-audit";
  runId: string;
  runNumber: number;
  fixtureAttemptHash: string;
  pullRequestUrl: string;
  pullRequestBaseBranch: "main";
  reviewedHeadSha: string;
  reviewedHeadTreeHash: string;
  acceptedSha: string;
  acceptedTreeHash: string;
  remoteMainSha: string;
  remoteMainTreeHash: string;
  independentReviewReceiptHash: string;
  integrationDisposition: "setfarm-owned-exact-reviewed-head";
  evidenceRefs: readonly CanonicalRef[];
  authorityHash: string;
}>;

export type GoldenRepositoryWorkflowEvidenceV1 = Readonly<{
  integration: RepositoryWorkflowIntegrationAuthorityV1;
  postPrReview: GoldenPostPrReviewEvidenceV1 | null;
  evidenceHash: string;
}>;

export function authenticateGoldenRepositoryWorkflowEvidenceV1(
  value: unknown,
): GoldenRepositoryWorkflowEvidenceV1;

export interface GoldenRepositoryWorkflowEvidenceResolverV1 {
  resolve(input: Readonly<{
    workflowEvidenceHash: string;
  }>): Promise<GoldenRepositoryWorkflowEvidenceV1>;
}

export function createGoldenRepositoryWorkflowEvidenceResolverV1():
  GoldenRepositoryWorkflowEvidenceResolverV1;

export function createGoldenRepositoryWorkflowEvidenceCollectorV1():
  GoldenWorkflowEvidenceCollectorPort;

// Import and re-export B's symbols by identity; C declares no structural lookalike.
import type {
  GoldenExistingRepositoryFixtureAttemptV1,
  GoldenExistingRepositoryFixtureTemplateV1,
  GoldenPersistedLaunchIntentV1,
} from "./golden-run-contract-v1.js";
import type {
  GoldenExistingRepositoryAttemptProvisioningPortV1,
} from "./golden-run-phase-store.js";

export type {
  GoldenExistingRepositoryFixtureAttemptV1,
  GoldenExistingRepositoryFixtureTemplateV1,
  GoldenPersistedLaunchIntentV1,
} from "./golden-run-contract-v1.js";
export type {
  GoldenExistingRepositoryAttemptProvisioningPortV1,
} from "./golden-run-phase-store.js";

const GoldenExistingRepositoryAttemptOperationV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-existing-repository-attempt-operation.v1"),
  intentHash: Sha256Schema,
  persistedEnvelopeHash: Sha256Schema,
  campaignHash: Sha256Schema,
  caseId: SlugSchema,
  repetition: z.union([z.literal(1), z.literal(2)]),
  finalReleaseEpoch: GoldenFinalReleaseEpochV1Schema,
  finalReleaseEpochHash: Sha256Schema,
  attemptOrdinal: z.number().int().min(1).max(64),
  attemptKeyHash: Sha256Schema,
  templateHash: Sha256Schema,
  repositoryOwner: z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+$/u),
  repositoryName: z.string().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/u),
  repositoryUrl: z.string().regex(
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
  ),
  visibility: z.literal("private"),
  destinationIdentityHash: Sha256Schema,
  operationHash: Sha256Schema,
}).strict();

type GoldenExistingRepositoryAttemptOperationV1 = z.infer<
  typeof GoldenExistingRepositoryAttemptOperationV1Schema
>;

const GoldenExistingRepositoryAttemptOperationPhaseV1Schema = z.enum([
  "issued",
  "local-baseline-prepared",
  "private-remote-created",
  "baseline-pushed",
  "sidecar-written",
  "attempt-sealed",
]);

// Both operation schemas use superRefine to recompute their hash from every
// member except the hash field and to equality-bind every derived URL/identity.

export type PostPrReviewAuthorityV1 = Readonly<{
  schema: "setfarm.post-pr-review-authority.v1";
  runId: string;
  stepDbId: string;
  workflowStepId: "post-pr-review";
  stepIndex: number;
  claimId: number;
  runtimeSessionId: string;
  claimGeneration: number;
  pullRequestUrl: string;
  preReviewHeadSha: string;
  postReviewHeadSha: string;
  pullRequestBaseSha: string;
  actionId: "publish-golden-actionable-post-pr-review";
  actionOperationHash: string;
  actionReceiptHash: string;
  actionEvidenceRefs: readonly CanonicalRef[];
  actionableCommentBodyHash: string;
  actionableCommentId: string;
  actionableThreadId: string;
  currentThreadIds: readonly string[];
  actionableThreadHashes: readonly string[];
  completionOutputHash: string;
  gateOpenedAt: string;
  gateDeadline: string;
  settledAt: string;
  authorityHash: string;
}>;

export type GoldenPostPrReviewEvidenceV1 = Readonly<{
  authority: PostPrReviewAuthorityV1;
  artifactHash: string;
  runRefKey: string;
  evidenceHash: string;
}>;

export function authenticateGoldenPostPrReviewEvidenceV1(
  value: unknown,
): GoldenPostPrReviewEvidenceV1;

export function mintGoldenPostPrReviewEvidenceV1(input: Readonly<{
  authority: PostPrReviewAuthorityV1;
  artifactHash: string;
  runRefKey: string;
  lifecycleReceipt: GoldenLifecycleCheckpointReceiptV1;
}>): GoldenPostPrReviewEvidenceV1;

export interface GoldenPostPrReviewActionPortV1 {
  postActionableInlineComment(input: Readonly<{
    campaignHash: string;
    caseId: string;
    runId: string;
    generation: Extract<GoldenLifecycleGenerationV1, {
      kind: "workflow-step-claim-generation";
    }>;
  }>): Promise<GoldenPostPrReviewActionReceiptV1>;
}

export const GoldenPostPrReviewActionOperationV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-post-pr-review-action-operation.v1"),
  campaignHash: Sha256Schema,
  caseId: SlugSchema,
  runId: z.string().min(1).max(160),
  runNumber: z.number().int().positive(),
  generationHash: Sha256Schema,
  predicateHash: Sha256Schema,
  repositoryUrl: z.string().regex(
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
  ),
  pullRequestUrl: z.string().regex(
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/u,
  ),
  pullRequestBaseSha: GitObjectHashSchema,
  pullRequestHeadSha: GitObjectHashSchema,
  path: z.literal("src/slug.ts"),
  line: z.number().int().min(1).max(100_000),
  blobSha: GitObjectHashSchema,
  diffHash: Sha256Schema,
  semanticAnchorHash: Sha256Schema,
  bodyHash: Sha256Schema,
  commentAuthorLogin: z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+$/u),
  actionId: z.literal("publish-golden-actionable-post-pr-review"),
  actionOperationHash: Sha256Schema,
}).strict();

export type GoldenPostPrReviewActionOperationV1 = z.infer<
  typeof GoldenPostPrReviewActionOperationV1Schema
>;

export const GoldenPostPrReviewActionOperationPhaseV1Schema = z.enum([
  "issued",
  "post-attempted",
  "comment-adopted",
  "receipt-sealed",
]);

export const GoldenPostPrReviewActionOperationPhaseRecordV1Schema = z.object({
  schema: z.literal(
    "setfarm.internal-production-post-pr-review-action-operation-phase.v1",
  ),
  actionOperationHash: Sha256Schema,
  generationHash: Sha256Schema,
  ordinal: z.number().int().min(1).max(4),
  phase: GoldenPostPrReviewActionOperationPhaseV1Schema,
  predecessorPhaseHash: Sha256Schema.nullable(),
  phaseHash: Sha256Schema,
}).strict();

export type GoldenPostPrReviewActionOperationPhaseRecordV1 = z.infer<
  typeof GoldenPostPrReviewActionOperationPhaseRecordV1Schema
>;

export type GoldenPostPrReviewActionReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-post-pr-review-action-receipt.v1";
  campaignHash: string;
  caseId: string;
  runId: string;
  runNumber: number;
  generationHash: string;
  predicateHash: string;
  repositoryUrl: string;
  pullRequestUrl: string;
  pullRequestBaseSha: string;
  pullRequestHeadSha: string;
  path: "src/slug.ts";
  line: number;
  blobSha: string;
  diffHash: string;
  semanticAnchorHash: string;
  bodyHash: string;
  commentAuthorLogin: string;
  commentId: string;
  threadId: string;
  actionId: "publish-golden-actionable-post-pr-review";
  actionOperationHash: string;
  evidenceRefs: readonly CanonicalRef[];
  actionReceiptHash: string;
}>;

export function createGoldenPostPrReviewActionPortV1(): GoldenPostPrReviewActionPortV1;

export interface GoldenPostPrReviewActionReceiptResolverV1 {
  resolve(input: Readonly<{
    campaignHash: string;
    caseId: string;
    runId: string;
    generationHash: string;
    actionReceiptHash: string;
  }>): Promise<GoldenPostPrReviewActionReceiptV1 | null>;
}

export function createGoldenPostPrReviewActionReceiptResolverV1():
  GoldenPostPrReviewActionReceiptResolverV1;

export function createGoldenPostPrReviewLifecycleCheckpointV1(input: Readonly<{
  actions: GoldenPostPrReviewActionPortV1;
}>): GoldenLifecycleCheckpointPort;

export type RepositoryWorkflowInspectionV1 = Readonly<{
  workflowId: "bug-fix" | "security-audit";
  protocol: "legacy" | "shadow" | "v3";
  beforeRevision: { sha: string; treeHash: string };
  afterRevision: { sha: string; treeHash: string };
  changedFiles: readonly string[];
  failingCommandBefore: string;
  passingCommandsAfter: readonly string[];
  findingRefs: readonly CanonicalRef[];
  unresolvedRiskRefs: readonly CanonicalRef[];
  integrationAuthorityHash: string;
  inspectionHash: string;
}>;
```

- [ ] **Step 1: Add immutable template tests that prove the initial defects**

The bug template's `slug("Crème Brûlée")` initially fails an expected `creme-brulee` assertion. The security template initially fails traversal containment and HTML-comment escaping checks; a declared external dependency advisory remains represented as an unresolved out-of-scope risk. Keep the failing commands separate from the ordinary Setfarm test suite; they run only in fresh attempt repositories copied from these checked-in template bytes. Each template contains immutable `golden/` verifier programs excluded from `allowedMutablePaths`: the baseline verifier exits `0` only when it independently executes the defective behavior and observes the exact expected failure/finding class; the post verifier exits `0` only when independently executing the corrected behavioral contract and, for security, confirming the residual advisory is still present. The template's pre/post command definitions invoke only these immutable verifiers and retain B's `expectedExitCode:0` ABI. Hash the complete normalized regular-file/mode/byte set into one `seedHash`; reject symlinks, hardlinks, special files, unexpected executable bits, `.git`, a remote, a sidecar, or any mutable generated byte in the checked-in template. A generated agent may change only the declared source/test files in its one attempt repository; it cannot weaken, delete, rename, or replace a golden verifier, manifest, command, or template.

- [ ] **Step 2: Write failing template, attempt, integration, and inspection tests**

With a real temporary Git repository and a fake exact GitHub integration port, first prove `prepareGoldenExistingRepositoryTemplatesV1()` accepts only `setfarm-mc-internal-production-v1 | internal-production-2026-08-13 | internal-production-fleet-2026-08-14`, reads both immutable checked-in templates, hashes and validates them, calls B fixture inspection/authentication only inside `existing-repository-fixture-catalog.ts`, immediately discards each private capability, and returns only the deeply frozen path-free `PreparedGoldenExistingRepositoryTemplatesV1` template values/set hash. It creates no local repository, Git state, sidecar, remote, operation, or attempt; the sole per-intent `createGoldenExistingRepositoryAttemptProvisioningPortV1()` remains the only repository creator. Reject every other campaign ID and prove equal seed bytes produce campaign-bound distinct template hashes/refs. Task 6 extends this same module to build the public catalog result; its CLI has no import of B's inspector/authenticator or any local-path/private-capability type.

Add a compile-time and source-boundary identity test that imports `GoldenExistingRepositoryFixtureTemplateV1`, `GoldenExistingRepositoryFixtureAttemptV1`, and `GoldenPersistedLaunchIntentV1` from both B's contract module and C's catalog re-export and proves bidirectional assignment through `satisfies`/`Assert<Equal<...>>`. Do the same for `GoldenExistingRepositoryAttemptProvisioningPortV1` against B's phase-store export. Read every C source file and reject a local `type`, `interface`, schema, or declaration with any of those four names; C may contain only the exact type-only imports/re-exports above. B's Task 3 observer source likewise contains no `GoldenRunStartReceiptV1` declaration, and its lookup return resolves to the exact Task 1 import.

Then require `createGoldenExistingRepositoryAttemptProvisioningPortV1()` to accept only B's WeakMap-authenticated `GoldenPersistedLaunchIntentV1`, minted after the exact launch envelope is fsynced, and reject a structural intent/capability clone before any filesystem or GitHub side effect. From that authenticated intent and authenticated GitHub owner it derives the only attempt key, fixed private destination identity, unique private repository name/URL, and strict `GoldenExistingRepositoryAttemptOperationV1`. The operation copies the complete `finalReleaseEpoch` from `persistedIntent.intent`, requires `finalReleaseEpochHash === finalReleaseEpoch.epochHash` and `persistedIntent.intent.releaseSha === finalReleaseEpoch.setfarmSha`, and hashes the full epoch; it never queries current services, current Git heads, a release observer, or a mutable epoch registry to reconstruct those bytes. Before `gh repo create` or any other remote mutation it exclusively writes/fsyncs that immutable operation and its initial `issued` phase below a fixed mode-`0700` operation-hash directory with mode `0600`; an operation not durably reopened cannot create or adopt a repository. It copies the selected immutable template into a new sibling mode-`0700` staging directory, initializes branch `main`, includes the exact tracked `/fixture-manifest.json` ignore entry, makes a deterministic baseline commit with fixed test identity/time, computes the root tree and seed hash, creates or exactly adopts the operation-bound private remote, publishes that exact commit, requires `remoteMainSha === baselineSha`, writes the mode-`0600` ignored sidecar without changing tracked bytes, and atomically seals one schema-valid imported B `GoldenExistingRepositoryFixtureAttemptV1` carrying the byte-identical full epoch. Its public receipt contains only finite hashes, canonical refs, the canonical HTTPS repository URL, and the B fixture identity; the operation and absolute repository path remain private producer authorities.

Provisioning is idempotent only for the same persisted `intentHash + attemptKeyHash`: a crash or manual-cleanup continuation must reopen and finish that exact operation/attempt and must never allocate another repository or remote for that persisted intent. Recovery validates the hash-chained finite phase journal and continues only `issued -> local-baseline-prepared -> private-remote-created -> baseline-pushed -> sidecar-written -> attempt-sealed`. At `issued` it queries the exact derived owner/name: absence permits the one create; one private repository with the exact canonical URL, authenticated owner, no unexpected refs, and operation identity permits adoption; public visibility, another owner/URL, any unexpected ref/content, or multiple candidates is ambiguous and blocks. Later phases re-observe exact local commit/tree, explicit remote `main`, ignored sidecar, imported B receipt, and byte-identical full epoch before appending the next fsynced phase. Mutating either epoch SHA, its recomputed hash, the redundant `finalReleaseEpochHash`, or the `releaseSha === finalReleaseEpoch.setfarmSha` relation fails before local or remote mutation; fake current-service/Git values cannot alter the operation or sealed attempt. Simulate interruption before/after operation file fsync, local baseline preparation, `gh repo create` request/response, remote adoption, origin binding, push request/response, sidecar write/fsync, attempt receipt seal, and B return; every continuation reuses the same name/remote and appends each phase once. Only after B has moved the old intent through its explicit terminal/closed transition may a separately authorized new launch intent with a new attempt ordinal, repetition, or `finalReleaseEpoch.epochHash` derive a different local destination, fixture ID/hash, repository URL, and provision hash. Reject a pre-existing destination/remote not owned by that exact operation, a dirty or mismatched destination, a tracked/non-ignored sidecar, remote URL outside canonical GitHub HTTPS form, remote-main drift, template/campaign/case mismatch, wrong seed kind, non-private/ambiguous remote state, and any reset/delete/force-push/reuse path. Never clean up a remote automatically; a partial creation returns only `GOLDEN_MATRIX_EXISTING_REPOSITORY_ATTEMPT_RECOVERY_REQUIRED` with the public repository URL and operation hash, and continuation after that typed blocker may only recover the same attempt operation.

For the workflow inspector and assertion adapter, reject a missing before-failure, mutation outside manifest `allowedMutablePaths`, absent exact finding refs, silently removed residual risk, dirty final worktree, wrong attempt identity, wrong origin/PR head, or unreported protocol. Feed complete schema-valid B assertion input into `createRepositoryWorkflowGoldenAssertionPort()`, require `subject.repository.kind === "campaign-existing-repository"`, exact `fixtureAttempt` equality, and exact accepted source. B's collector has already called `fixtures.inspectWorkflow(attempt.fixture, workflowId)`, authenticated that capability, and embedded the exact frozen reference only in the in-memory subject. Immediately pass `subject.fixtureWorkflow` through `authenticateGoldenFixtureWorkflowV1` and derive the internal repository path, allowed mutable paths, exact pre/post argv, origin, template, baseline/remote SHA, and manifest hash only from that authenticated reference. The C adapter has no fixture resolver/inspector dependency and performs no second manifest/path read. Prove the adapter emits every profile-specific ID from `GoldenProfileAssertionIdsV1` exactly once and no adapter reads a caller path or mutable run context.

For both `bug-fix` and `security-audit`, test the Setfarm-owned integration observer against real temporary Git history and a fake GitHub authority. It accepts only the canonical PR created for the exact attempt, one independent non-author approval on its current head, a settled check/review set, and Setfarm's exact-head integration receipt. It requires `reviewedHeadSha === acceptedSha === remoteMainSha`, `reviewedHeadTreeHash === acceptedTreeHash === remoteMainTreeHash`, remote branch `main`, and a clean Setfarm-owned synchronization of the private local attempt to that same SHA/tree. It writes one content-addressed `RepositoryWorkflowIntegrationAuthorityV1` with sorted unique B-`CanonicalRefSchema` refs. A squash/merge commit with different SHA, tree-only equality, stale approval, changed head, unresolved actionable thread, different attempt/PR, caller-supplied path/remote/head, or worker `fetch`/`pull` fails closed. B collection must require this authority before assembling the subject; C authenticates the corresponding opaque workflow evidence and refuses either profile when remote `main` is not exactly the accepted SHA/tree.

For the real review retry, test the canonical bug-fix workflow order `triage -> investigate -> setup -> fix -> verify -> pr -> post-pr-review`. `post-pr-review` is a registered single step using the fixer role. The ordinary single-step publication path first commits the exact claim and reserved runtime; only then does its module `preClaim` execute. `preClaim` loads that claim, its database `claimed_at`, the exact step and stable one-based claim ordinal for `(run_id, step_id)`, and the PR created by `pr`; `claimGeneration` equals B's `workflow-step-claim-generation.claimGeneration`. It derives one durable gate generation bound to run/step/index/claim/runtime/ordinal/PR URL/head/base and polls current GitHub GraphQL thread state for at most 120 seconds in bounded intervals. There is no new mutable run-context authority or campaign-only flag. C's `createGoldenPostPrReviewLifecycleCheckpointV1()` recognizes the finite approved campaign/case identities declared below plus B's `actionable-post-pr-review-generation`; it calls the C-owned action port for only that exact generation and emits B's lifecycle receipt with `externalCapabilityHash:null`, never wrapping itself as an external recovery capability. The production action port resolves the campaign-bound private fixture, exact open claim/runtime, canonical PR/current head, and authenticated current GitHub login from durable authority. It resolves the inline location before mutation: exactly one added right-side line in `src/slug.ts` must match the code-owned semantic anchor hash for the seeded slug-normalization function. It constructs `GoldenPostPrReviewActionOperationV1` binding author, PR/head/base, path/right-side line/blob/diff/anchor, predicate/generation, action ID, and the hash of the fixed English inline body `Please add a regression that preserves non-ASCII word separation before slug normalization, then update src/slug.ts so the regression passes.` Before POST it content-addresses the operation below `golden-results/post-pr-review-action-operations/sha256`, publishes the generation index, and publishes one immutable whole-file `issued` phase record. Each phase is a separate strict `GoldenPostPrReviewActionOperationPhaseRecordV1`, never an append to a shared journal: derive its ordinal/predecessor/hash, create an unpredictable same-directory temporary, write/fsync bounded canonical bytes, publish with atomic link-no-replace, fsync the parent, prove exact inode/content identity, remove only the owned temporary, fsync again, then reopen the regular one-link mode-`0600` final with `O_NOFOLLOW`. Recovery reads at most four records and requires the unique exact `issued -> post-attempted -> comment-adopted -> receipt-sealed` hash chain; fork, gap, duplicate ordinal, mutable/append-open file, unsafe inode/mode, or unknown temporary fails closed. Recovery queries GitHub GraphQL by the exact PR plus authenticated author, operation-bound head, path, right-side line, and exact body/body hash. With only `issued`, zero exact/conflicting matches permits publishing/reopening `post-attempted` before the sole POST. Once `post-attempted` exists, every continuation is reconciliation-only: one exact match publishes/reopens `comment-adopted`; zero after the bounded GitHub visibility window, more than one exact match, a partial author/head/path/line/body conflict, changed head/blob/diff, or an uncertain query is ambiguous and performs no POST. This deliberately fails closed rather than duplicate when interruption occurs after the durable attempted boundary but before a remote comment is provable.

The action receipt equality-binds `actionOperationHash`, comment author/ID/thread, current blob SHA, path, line, body hash, and diff hash and fails closed on zero, multiple, or stale anchors. The expected correction remains behavior-level (`Crème Brûlée` must become `creme-brulee`); no implementation text is prescribed. The port accepts no caller repository, PR, author, body, path, line, token, command, or operation hash. It stores the canonical receipt content-addressed below the B resolver's fixed mode-`0700` `golden-results/post-pr-review-actions/sha256` child with mode-`0600`, no-follow collision checks and the same generation-operation index, publishes/reopens the immutable `receipt-sealed` phase record, and returns B's lifecycle receipt with identical literal `actionId`, non-null `actionOperationHash`, `actionReceiptHash`, `generationHash`, `predicateHash`, `runId/runNumber`, and evidence refs. Simulate interruption before and after every operation/index/phase temporary write, file fsync, no-replace link, parent fsync, inode proof, owned-temporary cleanup, final no-follow reopen, before POST, after request acceptance before response, after exact remote adoption, before/after receipt seal, and before B's `lifecycle-action-recorded` append. Every recovery reopens the same operation and unique phase chain and either adopts the one exact comment or blocks on ambiguity, never creating a second phase/operation/comment; response loss after any phase publication is byte-idempotent. The allowlist test accepts exact E `fleet-repository-bug-fix` and proves the old fleet `existing-repository-bug-fix` value performs no store/GitHub mutation. A no-op lifecycle port is forbidden for an approved actionable case and tests prove the gate receives the comment before its deadline.

If the actionable thread appears, `preClaim` injects its exact bounded feedback and the already claimed `post-pr-review` fixer handles the same PR branch directly; it does not route to or reopen the earlier `fix` step. The write authority is discriminated: campaign fixtures require B's authenticated manifest capability and its `allowedMutablePaths`; ordinary bug-fix runs may modify only regular files already present in the exact current PR diff and named by an actionable thread, with repository containment and no newly introduced path. A comment requiring another path becomes a typed manual-review blocker instead of widening scope. If the window expires without actionable feedback, the already claimed step receives the typed `no_actionable_review` disposition and completes without a source edit. Completion re-reads the exact PR/head/base/thread set, requires the declared verification commands, and for an actionable generation succeeds only when the head changed and every originally actionable thread is resolved or outdated. Wrong PR/head/base/generation/path/line/thread, new unresolved actionable feedback, dirty/out-of-scope changes, duplicate PR, or unchanged head fails closed; bounded retries remain new claim generations of `post-pr-review` and never create another PR.

`GoldenPostPrReviewApprovedIdentityV1` is the sole code-owned allowlist for this mutation: matrix uses only `setfarm-mc-internal-production-v1/existing-repository-bug-fix`, D recovery uses only `internal-production-2026-08-13/recovery-06-bugfix-review`, and E fleet uses only `internal-production-fleet-2026-08-14/fleet-repository-bug-fix`. The checkpoint resolves `campaignHash` through the authenticated loaded campaign, requires exact campaign ID/case ID/template seed/workflow equality with one tuple, and rejects the old fleet `existing-repository-bug-fix` alias plus all other matrix, recovery, fleet, security-audit, or caller-supplied identities before opening the action store or GitHub. This generalizes the same C implementation for D/E without adding a second action factory/body/store.

`createGoldenPostPrReviewActionReceiptResolverV1()` is the sole read-only production resolver for the content-addressed action store. It accepts only campaign/case/run/generation/action hashes, reopens and rehashes the strict operation plus receipt, and returns no mutation port, token, private root, path, or GitHub client. Subproject D injects this resolver into its asynchronous evidence authority verifier and must match the resolved receipt and `actionOperationHash` to B's lifecycle receipt plus the accepted bug-review assertion; a bare ref/hash never proves the action.

Every C operation/receipt/evidence shape in this task is a strict recursively frozen schema rather than an open TypeScript bag. All `*Refs` arrays are B-`CanonicalRefSchema` values, sorted bytewise, unique, and capped at `64`; all changed-file/thread/command-receipt/hash arrays have explicit finite bounds and deterministic order. Recompute attempt `operationHash`, `actionOperationHash`, `actionReceiptHash`, integration `authorityHash`, workflow `evidenceHash`, and inspection hash from the complete payload without its hash field. Require the action receipt, B lifecycle receipt, post-review authority, and resolver to carry one equal operation hash. Reject extra fields, unbounded strings, absolute paths, raw output/comment prose in receipts, non-finite values, a null post-review member for bug-fix, a non-null post-review member for security-audit, and any disposition/membership mismatch before storing or crossing the B boundary.

Before generic claim completion, the module canonicalizes `PostPrReviewAuthorityV1`, writes its payload through the existing hybrid-required `ContentAddressedArtifactStore`, reserves/publishes the matching semantic-artifact identity through `createArtifactIndex`, and seals the immutable run ref `POST_PR_REVIEW_<claimId>`. A retry uses a different claim-bound ref and cannot overwrite an earlier generation. The authority binds pre-review head, changed post-review head, literal action/comment/body/thread identity, action receipt/evidence, completion output, and settled thread set. C's code-owned `createGoldenRepositoryWorkflowEvidenceCollectorV1()` is the sole non-null implementation of B's generic `GoldenWorkflowEvidenceCollectorPort`; the production matrix factory injects it into `createPostgresGoldenRunRepository(...)`, and no caller or CLI may replace it. For both existing-repository workflows the collector resolves and rehashes the Setfarm-owned integration authority, requires exact attempt/run/PR/reviewed-head/accepted-source/remote-main identity, and mints the opaque common evidence. For bug-fix it additionally resolves the exact post-review ref, persisted lifecycle/action receipt, completed claim, released runtime, step output, and settled thread generation; for security-audit that member is exactly null. It returns B's exact `{ kind:"authenticated-opaque-workflow-evidence", workflowEvidenceHash:evidenceHash, capability }` wrapper. B carries that wrapper and inner capability by exact reference into `GoldenCollectedAssertionAuthorityV1.workflowEvidence` and `GoldenAssertionSubjectV1.workflowEvidence`; B knows only the hash, includes only that hash in `bindingHash`, and never imports, traverses, authenticates, clones, stores, or serializes C's capability. Neither public schema accepts a caller-constructed object. An orphan artifact/ref from a failed attempt is never accepted. Missing, conflicting, forged, stale-generation, wrong-attempt, wrong-run, wrong-claim/runtime, wrong integration/remote SHA/tree, wrong action/comment/pre/post head, or oversized evidence fails collection; the repository adapter cannot synthesize it. Source-boundary tests allow this collector only at the B repository injection point and the C adapter only at the authentication point. `gateOpenedAt` is the exact database `claimed_at`, never a process clock, and every authority hash is the canonical payload hash without its hash field.

Add `bug-fix/post-pr-review/fixer` to the strict V3 stage-context map as `source-scoped`, and reject every other workflow/step/role combination. Add `post-pr-review` to `HARD_PRECLAIM_STEPS` and make its preclaim failure fail closed for `legacy`, `shadow`, and `v3`; the generic legacy/shadow catch-and-continue path must not bypass this gate. Actual-PG tests cover every protocol and prove a failed preclaim creates no executable handoff or successful claim completion. This exact open-claim generation is the authority consumed by B, C, and D's lifecycle checkpoint.

- [ ] **Step 3: Run the test and observe RED**

Run:

```bash
node --import tsx --test \
  tests/internal-production/existing-repository-fixture-catalog.test.ts \
  tests/internal-production/repository-workflow-golden-assertions.test.ts \
  tests/internal-production/repository-workflow-integration-authority-v1.test.ts \
  tests/internal-production/post-pr-review-authority-v1.test.ts \
  tests/internal-production/golden-post-pr-review-checkpoint.test.ts \
  tests/internal-production/golden-run-repository.test.ts \
  tests/internal-production/golden-run-harness.test.ts \
  tests/bug-fix-post-pr-review.test.ts \
  tests/execution-attempts/v3-stage-execution-context.test.ts \
  tests/claim-log-lifecycle.test.ts
```

Expected: FAIL because the template catalog, attempt provisioner, exact-head integration authority, and repository-workflow adapter inspection are absent.

- [ ] **Step 4: Implement the single allowlisted template/catalog/attempt module**

`existing-repository-fixture-catalog.ts` is the sole lexical owner of template discovery, seed hashing, B template inspection/authentication, public catalog construction, attempt provisioning, B attempt-workflow inspection/authentication, private remote creation, and attempt-receipt reopening. No helper module, CLI, runner, or schema builder imports `inspectGoldenFixtureTemplateV1`, `authenticateGoldenFixtureTemplateV1`, `inspectWorkflow`, or `authenticateGoldenFixtureWorkflowV1`. The only other B fixture-workflow capability consumer in C is the repository assertion adapter. C's source-boundary test extends B's closed audit, allows those exact two C source files, verifies the catalog module authenticates then discards template/preflight capabilities before returning, and rejects any fifth B-global consumer, capability field, serialization, callback, or path accessor. This downstream assertion lives only in C; B's own delivery test permits zero C consumers and never imports or requires a C file before C exists.

Fold repository diff/finding inspection into `repository-workflow-golden-assertions.ts` after that adapter has authenticated the B subject/workflow capability; do not pass the capability or repository path to a helper module. `repository-workflow-integration-authority-v1.ts` consumes only the content-addressed attempt identity, Setfarm completion/integration receipts, path-free accepted source, GitHub observer, and B fixed attempt resolver internally; it never imports or receives a fixture/template capability and exposes no path.

The immutable catalog templates live only in the checked-in fixture directories and produce B `GoldenExistingRepositoryFixtureTemplateV1` values. A template has no repository URL, local path, Git directory, remote, baseline commit, or mutable sidecar. The single module derives its `templateHash`/`templateRef` from campaign/template/seed/allowed-scope/verifier-command hashes and embeds those public template identities—not a reusable fixture repository—in the two existing-repository `GoldenCaseV1` strategies.

Parse `templateRef` as the exact B-canonical value ``setfarm://internal-production/fixture-templates/${campaignId}/${templateId}/${templateHash}`` and the provision receipt ref as ``setfarm://internal-production/fixture-attempts/${campaignHash}/${attemptKeyHash}/${provisionHash}``. These are identity refs only; neither maps a caller-controlled segment to a filesystem path.

The production attempt port first authenticates the B-owned fsynced intent and requires its template, attempt ordinal/key, campaign/case/repetition, complete final epoch, epoch hash, Setfarm release relation, and historical-baseline-bound intent hash to match. Derive the only destination as ``${resolveInternalProductionDataRootV1()}/fixtures/${campaignId}/${caseId}/${epochHash}/${attemptOrdinal}-${attemptKeyHash}`` and derive a unique repository owner/name/URL from the same finite identity plus a hash suffix; no caller chooses either. Before remote mutation, compute and strictly parse the operation with the byte-identical full epoch from the intent, write it exclusively to ``golden-results/fixture-attempt-operations/sha256/${operationHash.slice(0,2)}/${operationHash}.json``, fsync file and parent, and append the fsynced `issued` phase. Copy only template bytes into a new sibling mode-`0700` directory, use lstat/realpath/regular-file/one-link checks, initialize `main`, add the exact tracked `/fixture-manifest.json` ignore rule, use fixed in-process author/committer identity and timestamp for deterministic baseline bytes, compute `HEAD`, `HEAD^{tree}`, and the seed hash, and append `local-baseline-prepared`. Create or adopt only the exact private remote, append `private-remote-created`, push explicit `refs/heads/main:refs/heads/main`, and append `baseline-pushed`. Require the returned URL/SHA to match before writing B's exact mode-`0600`, regular, non-symlink, Git-ignored sidecar and appending `sidecar-written`; compute the attempt fixture identity/ref and content-addressed provision receipt with that same full epoch, prove clean status and ignored sidecar, fsync, atomically seal, and append `attempt-sealed`. No provisioning/recovery phase performs a mutable release lookup. The manifest is never tracked, so its embedded baseline/remote SHA does not create a self-referential Git commit.

The internal GitHub adapter derives the authenticated owner through `gh api user --jq .login`; invokes `gh repo create OWNER/DERIVED_NAME --private` without `--source`, `--remote`, or `--push`; adds the exact canonical HTTPS origin; pushes the one baseline ref; and rejects any already-existing remote unless the pre-create fsynced attempt operation proves an interrupted identical creation. Recovery queries the exact owner/name with bounded `gh api`, requires `visibility:"private"`, exact canonical URL/owner/name, and either no refs before the first push or the one exact baseline `main` afterward; it never adopts by name prefix, timestamp, nearest repository, local origin alone, or caller assertion. An uncertain create/push response is reconciled by that exact query before another mutation; ambiguity returns the typed blocker and never allocates a second name. It accepts no caller repository slug, organization, branch, visibility, command, environment, token, Git protocol preference, or force/delete/reset/reuse option. Use `shell:false`, bounded output/time, and redacted failures. A different intent always creates a different repository even when the template bytes are identical.

There is no fixture or provisioning CLI. Task 6 extends this same file with the full catalog builder, and its catalog CLI is the only command consumer of the resulting public `PreparedGoldenMatrixCatalogV1`; attempt provisioning is implicit only inside B execute after intent persistence through the fixed production port. Add source-boundary tests proving the catalog CLI does not import B's inspector/authenticator, there is no arbitrary root/remote/command/environment/provision option, and no `rm`, reset, checkout, worker fetch/pull, force push, public-repository flag, extra consumer, serializer, or public capability/path field.

- [ ] **Step 5: Implement the review checkpoint, durable authority, inspector, and assertion adapter**

Implement the exact action/checkpoint/store contracts above with one fixed bug-fixture comment, one pre-POST operation store, and an idempotent generation-operation index; return B's exact lifecycle receipt including non-null `actionOperationHash` rather than a C lookalike. Resolve only the three `GoldenPostPrReviewApprovedIdentityV1` tuples and reject every other campaign/case before mutation. Implement `post-pr-review` publication/settlement and B collection as one producer-to-consumer chain, including the hard-preclaim rule across all protocols. Separately implement the common Setfarm-owned integration observer for both bug-fix and security-audit: the completion owner settles the exact PR head, applies the reviewed exact-head integration policy, synchronizes the attempt repository internally, and publishes the strict authority only after local `HEAD`, `HEAD^{tree}`, `refs/remotes/origin/main`, remote `main`, accepted source, and approved head are byte-equal as required. Source-boundary tests prohibit a caller repository, PR, author, comment, path, line, head/tree, remote, token, lifecycle override, operation hash, Git command, raw SQL insert, direct run-context evidence, or alternate artifact ref.

The collector serializes only the strict path-free `GoldenRepositoryWorkflowEvidenceV1` payload below the fixed real mode-`0700` child ``golden-results/repository-workflow-evidence/sha256/${workflowEvidenceHash.slice(0, 2)}/${workflowEvidenceHash}.json`` through the shared content-addressed no-replace publication protocol before returning B's opaque wrapper; the private WeakMap capability is never serialized. `createGoldenRepositoryWorkflowEvidenceResolverV1()` accepts only `{workflowEvidenceHash}`, parses that value as SHA-256, derives that fixed path, reopens bounded canonical bytes with `O_NOFOLLOW`, and re-resolves/re-hashes the exact fixture attempt, run subject, Setfarm-owned integration authority, accepted SHA/tree/remote-main equality, and nullable workflow-specific post-review authority. It then recursively freezes the strict evidence and remints its authenticated WeakMap capability. Its return is exactly `Promise<GoldenRepositoryWorkflowEvidenceV1>`; it accepts no repository path, URL, ref, run/case identity, expected body, or mutation port. A structural clone does not authenticate, while a fresh-process resolver result does. Wrong result subject, attempt, run, integration, accepted source/tree, post-review relation, evidence hash, noncanonical bytes, unsafe inode/mode, or extra field fails before an assertion or external read. C uses this resolver only after narrowing a terminal existing-repository result to B's strict `kind:"run"` branch with non-null `workflowEvidenceHash`, requires the resolved evidence's result/subject/hash identity to match, and remints the B wrapper for subject authentication; a pre-run result never reaches this resolver, while V3 and timeout run results require the field to be exactly null.

Use `git diff --name-only <before>..<after>`, the authenticated B fixture-workflow capability, B's path-free immutable-verifier receipt, the exact attempt identity, GitHub review thread/head state, canonical Setfarm findings, and a closed protocol union. Require origin URL and baseline commit/tree to match the capability, changed files to be a subset of its `allowedMutablePaths`, and every `golden/` verifier byte/hash unchanged from the manifest. `createRepositoryWorkflowGoldenAssertionPort()` takes the B subject only, authenticates the subject's existing `fixtureWorkflow` reference and `GoldenRepositoryWorkflowEvidenceV1`, and delegates command execution exclusively to `executeAuthenticatedGoldenFixtureVerificationV1({ capability, phase:"post", expectedSource })`; C never executes or reconstructs manifest argv. Both profiles require the common integration member to match the exact campaign/case/run/attempt/PR and to prove `reviewedHeadSha === acceptedSha === remoteMainSha` plus equal tree hashes. Bug-fix additionally requires non-null collector-authenticated `postPrReview` matching the exact accepted claim/runtime/generation/PR/head/thread settlement. Security-audit requires `postPrReview === null` and exact canonical finding/residual-risk authorities; a post-review member is invalid. It validates that B's returned receipt binds the accepted SHA/tree/repository ref, immutable verifier hashes, exact allowed changed paths, and fresh attempt provision hash, then validates workflow-specific findings/review/residual risk and writes bounded artifacts. Never infer a security finding from prose or mark residual risk fixed because source tests pass.

- [ ] **Step 6: Run fixture and inspector checks**

```bash
node --import tsx --test \
  tests/internal-production/existing-repository-fixture-catalog.test.ts \
  tests/internal-production/repository-workflow-golden-assertions.test.ts \
  tests/internal-production/repository-workflow-integration-authority-v1.test.ts \
  tests/internal-production/post-pr-review-authority-v1.test.ts \
  tests/internal-production/golden-post-pr-review-checkpoint.test.ts \
  tests/internal-production/golden-run-repository.test.ts \
  tests/internal-production/golden-run-harness.test.ts \
  tests/bug-fix-post-pr-review.test.ts \
  tests/execution-attempts/v3-stage-execution-context.test.ts \
  tests/claim-log-lifecycle.test.ts
npm run check:english
```

Expected: PASS, with each initial defect reproducible and each repaired copy clean and scoped.

- [ ] **Step 7: Submit the scoped story to Setfarm's completion owner**

Use only the immutable claim's completion command and output after every focused/adjacent check passes. The completion owner validates the exact Files list above, including workflow hashes and source-boundary tests, and alone commits/pushes the managed story branch. It must not include fixture repositories, ignored manifests, action receipts, tokens, or runtime evidence.

### Task 6: Define the Exact Ordered Matrix and Prompts

**Files:**
- Create: `evals/suites/internal-production-golden-campaign-v1.json`
- Create: `evals/suites/internal-production-golden-matrix-v1.json`
- Create: `src/internal-production/schemas/golden-matrix-v1.ts`
- Modify: `src/internal-production/existing-repository-fixture-catalog.ts`
- Create: `src/internal-production/golden-matrix-catalog-cli.ts`
- Modify: `tests/internal-production/existing-repository-fixture-catalog.test.ts`
- Test: `tests/internal-production/golden-matrix-v1.test.ts`
- Test: `tests/internal-production/golden-matrix-catalog-cli.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Subproject B's `GoldenCampaignV1`/`GoldenCaseV1`, `GoldenExistingRepositoryFixtureTemplateV1`, assertion adapter IDs from Tasks 2–5, and Task 5's capability-free `prepareGoldenExistingRepositoryTemplatesV1({ campaignId })` plus its public `PreparedGoldenExistingRepositoryTemplatesV1` result. Only `existing-repository-fixture-catalog.ts` authenticates and discards the private template inspection capabilities; Task 6 combines those already prepared immutable public templates with the seven exact cases.
- Produces: the schemas/loader below and Task 6's new capability-free `prepareGoldenMatrixCatalogV1()`; no Task 5 source or test may import that future symbol before Task 6 creates it.

```ts
export interface GoldenMatrixCaseV1 {
  ordinal: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  caseId: string;
  requiredAcceptedRuns: 1 | 2;
  assertionAdapter: "node-cli" | "node-api" | "browser" | "game" | "repository-workflow";
}

export interface GoldenMatrixV1 {
  schema: "setfarm.internal-production-golden-matrix.v1";
  matrixId: string;
  campaignFile: "internal-production-golden-campaign-v1.json";
  campaignHash: string;
  maximumConcurrency: 1;
  rootCauseRepeatLimit: 3;
  cases: readonly GoldenMatrixCaseV1[];
}

export interface LoadedGoldenMatrixV1 {
  matrix: GoldenMatrixV1;
  matrixHash: string;
  campaign: LoadedGoldenCampaignV1;
}

export function loadGoldenMatrixV1(file: string): Promise<LoadedGoldenMatrixV1>;

export type PreparedGoldenMatrixCatalogV1 = Readonly<{
  campaign: GoldenCampaignV1;
  matrix: GoldenMatrixV1;
  templates: readonly GoldenExistingRepositoryFixtureTemplateV1[];
  catalogHash: string;
}>;

export function prepareGoldenMatrixCatalogV1(input: Readonly<{
  campaignId: "setfarm-mc-internal-production-v1";
  campaignDate: "2026-08-14";
}>): Promise<PreparedGoldenMatrixCatalogV1>;

```

- [ ] **Step 1: Write failing exact-order tests**

Require ordinals 1–7, unique `caseId` references, accepted counts `[2,2,2,1,1,1,1]`, exact workflows, exact `GoldenProfileAssertionIdsV1`, a repeat limit of three, and no host paths, credentials, `--repo`, `--branch`, or `--port` in generated-product prompts. `internal-production-golden-campaign-v1.json` is the one raw B `GoldenCampaignV1` artifact and owns every complete `GoldenCaseV1`, task, start strategy, immutable template identity, and assertion contract. The matrix wrapper owns only ordinal/count/adapter references plus the exact raw-campaign basename/hash. The loader resolves only that sibling basename with no symlink, loads it through B, requires `campaignHash`, maps every referenced case exactly once, and defines no second case contract. Task 5's `prepareGoldenExistingRepositoryTemplatesV1()` has already authenticated and discarded both private template capabilities. Task 6's new `prepareGoldenMatrixCatalogV1()` consumes only that deeply frozen public result, matches both templates to the exact identity/campaign/seed/scope/verifier hashes, and rejects campaign mismatch, swapped seed kinds, duplicate identity/hash/ref, changed public template bytes, or a result without both exact templates. It never receives a capability and never creates or embeds an attempt repository, baseline commit, remote, or path. Exercise interruption before and after unpredictable temporary generation, operation/index temporary write/fsync/no-replace publication/parent fsync/no-follow adoption, and each campaign/wrapper temporary prefix write/fsync, no-replace publication, parent fsync, temporary removal, final reopen, and response. Every deterministic final target is absent or exact; every retry resumes only the indexed authenticated operation and its exact-prefix temporary, adopts only an exact first-only prefix or exact complete pair, never deletes a final target, and rejects an absent-first/present-second suffix, unknown temporary, unsafe final, or changed operation/index/first/second bytes without further mutation.

- [ ] **Step 2: Add the seven exact product intents**

1. `cli:` task tracker with `add --title`, `list`, JSON persistence, one canonical JSON object per stdout line, and exact UTF-8 stderr bytes `TITLE_REQUIRED\n` with invalid-title exit 2.
2. `api:` inventory API with health, CRUD, validation JSON, injected loopback port, SQLite persistence across restart, and exact B `node-api-resource-crud-v1`/`inventory-items-v1` assertion contract.
3. `vite:` reading queue with three routes, add form, validation, keyboard flow, local-storage persistence, empty state, and exact B `vite-react-workflow-v1`/`reading-queue-v1` assertion contract.
4. `web:` service desk with list/detail/edit/not-found pages, four stories, an explicit detail-after-list dependency, and shared persisted ticket state.
5. `game:` keyboard-controlled checkpoint game with ready/active/paused/terminal states, deterministic input bridge, and persistent high score.
6. `bug-fix` task naming the campaign fixture, failing command, permitted source/test scope, and required GitHub review retry.
7. `security-audit` task naming the campaign fixture, traversal and HTML-escaping evidence classes, permitted scope, verification command, and required residual advisory.

Use these literal task strings in the catalog:

```json
{
  "node-cli": "cli: Build an English local task register with add --title and list commands. Reject a missing or blank title with exit code 2, empty stdout, and exact stderr bytes TITLE_REQUIRED\n. Print each successful record as one canonical JSON object per stdout line. Persist records in the stack-contract-provided state location so a second process can read the added task. Include deterministic tests and no browser UI, network listener, fixed port, authentication, or external service.",
  "node-express-api": "api: Build an English inventory REST API with GET /health and create, read, update, and list item routes. Return exact JSON validation errors for a missing or blank title. Bind only to the runtime-injected loopback host and port. Persist data in SQLite so a controlled stop and fresh process start can read an updated item. Include deterministic API tests and release every process and listener after verification.",
  "vite-react-web": "vite: Build an English reading queue with Home, Queue, and Settings routes. Add a queue form with required-title validation, keyboard-operable primary controls, an empty state, and local-storage persistence across reload. Expose stable accessible labels for Setfarm-owned browser assertions, keep the browser console free of uncaught errors, and include deterministic tests.",
  "stateful-multipage-web": "web: Build an English service desk with list, detail, edit, empty, and not-found behavior. Use at least four canonical stories with an explicit dependency from detail behavior to the shared ticket list/entity foundation. Persist one ticket entity used across list and detail pages, validate edits, and expose stable accessible controls and state for Setfarm-owned browser verification.",
  "interactive-browser-game": "game: Build an English keyboard-controlled canvas checkpoint game with explicit ready, active, paused, resumed, and terminal states. Expose an admitted deterministic input/state bridge for Setfarm verification, persist the high score across reload, avoid a fixed port, keep screenshots supplemental to state assertions, and release the runtime after verification.",
  "existing-repository-bug-fix": "Repair the seeded Unicode slug defect in campaign fixture internal-production-bug-fix. First preserve evidence that the fixture test fails because Crème Brûlée does not become creme-brulee. Change only the declared slug source and its regression test, run the exact fixture test and adjacent tests, create the canonical pull request, then respond through Setfarm's post-pr-review gate when the campaign injects one actionable inline comment, and leave the repository clean.",
  "existing-repository-security-audit": "Audit campaign fixture internal-production-security-audit for path traversal containment and unsafe HTML comment rendering. Cite exact source evidence for both finding classes, repair only the declared path-policy, comment-renderer, and security-test scope, run the exact security verification, preserve the declared external dependency advisory as unresolved out-of-scope risk, and never mark that advisory resolved."
}
```

- [ ] **Step 3: Run the test and observe RED**

Run:

```bash
node --import tsx --test \
  tests/internal-production/existing-repository-fixture-catalog.test.ts \
  tests/internal-production/golden-matrix-v1.test.ts \
  tests/internal-production/golden-matrix-catalog-cli.test.ts
```

Expected: FAIL because the loader/catalog are absent.

- [ ] **Step 4: Implement the strict loader and catalog**

Hash normalized tasks and complete cases, reject duplicate hashes, bind every adapter and its exact `GoldenProfileAssertionIdsV1` to its allowed profile, and reject a claimed V3 protocol for bug-fix/security-audit unless canonical workflow selection returns V3. The single Task 5 module embeds the two matching public immutable template identities in the raw campaign, sets the exact B policy `{kind:"all-cases-required-accepted-v1"}`, computes that campaign hash, and constructs only reference metadata in the wrapper; neither the CLI nor schema module can synthesize template/fixture/attempt hashes or refs. Tests reject an omitted or fleet policy and assert `sum(requiredAcceptedRuns) === 10` because this matrix requires exactly ten accepted results.

The catalog embeds the complete exact inventory and reading-queue assertion-contract objects above, not only adapter IDs. It rejects `profile-owned-v1` for either profile, the appointments or volunteer-shifts variant in this matrix, and any route/selector/payload/expected-response/state drift. C's closed adapters nevertheless support and test all four B variants so E can select appointments and volunteer shifts in its own strict fleet cases without adding a route, selector, payload, or expected-value input.

Implement `golden-matrix-catalog-cli.ts` with one production command only:

```text
prepare --campaign setfarm-mc-internal-production-v1 --campaign-date 2026-08-14 --json
```

It calls Task 6's capability-free `prepareGoldenMatrixCatalogV1({ campaignId:"setfarm-mc-internal-production-v1", campaignDate:"2026-08-14" })` once. That function calls Task 5's already existing `prepareGoldenExistingRepositoryTemplatesV1({ campaignId })`, receives only its frozen public templates/set hash, and constructs the complete public catalog; the one C catalog module keeps both layers lexical and returns only `PreparedGoldenMatrixCatalogV1`. Before opening either target, the CLI validates the public result, computes the complete canonical bytes and hashes for both fixed source files, generates two unpredictable same-directory temporary basenames from separate fresh 32-byte random values, and fsyncs one strict immutable catalog-materialization operation binding the catalog hash, both exact repository-relative targets/byte hashes/order, and those private temporary identities. Hash that body as `operationHash`, store it through the same temporary/fsync/atomic-link-no-replace/parent-fsync/inode-proof/no-follow-reopen protocol below B's fixed real mode-`0700` child ``golden-results/matrix-catalog-materializations/sha256/${operationHash.slice(0, 2)}/${operationHash}.json``, and bind the one catalog hash to that operation hash in a fixed mode-`0600` index through that identical publication/reopen protocol before tracked mutation. Equal operation/index bytes reopen idempotently and a collision fails closed. For each source file, reopen or exclusively create only its operation-bound unpredictable sibling temporary, accept an existing temporary only when its bytes are an exact prefix of the intended bounded canonical bytes, append only the missing suffix, and fsync. Publish only with `link(temp,final)`, fsync the parent, prove both names are the same exact regular inode/content, unlink only that operation-owned temporary, fsync the parent again, then `O_NOFOLLOW` reopen/rehash the regular one-link final. A crash-left two-link publication is cleaned only by the indexed operation after identical inode/content proof. The deterministic final target is always absent or complete. It materializes the only legal final-target prefix in this order: `evals/suites/internal-production-golden-campaign-v1.json`, then `evals/suites/internal-production-golden-matrix-v1.json`. Every created final-target prefix is retained permanently. On recovery, `(absent,absent)` may resume the indexed operation, `(exact campaign,absent matrix)` may adopt only the byte-identical first-file prefix and finish the wrapper, and `(exact campaign,exact matrix)` reopens it idempotently. An unknown/mismatched temporary is never adopted or removed. `(absent,present)`, a nonregular/symlink/hardlinked target, or any operation/index/byte/hash mismatch rejects before another final-target write; no other partial state is adoptable. The CLI accepts no capability, output path, remote URL, owner, organization, repository name, seed path, branch, protocol, task, assertion ID, command, fixture-provision, attempt, operation, or temporary-path override. Tests use test-only template readers/writers and never contact GitHub because neither template nor catalog preparation creates a remote.

Add the exact package command:

```json
{
  "internal:golden-matrix-catalog": "node --import tsx src/internal-production/golden-matrix-catalog-cli.ts"
}
```

- [ ] **Step 5: Run the test and observe GREEN**

Run:

```bash
node --import tsx --test \
  tests/internal-production/existing-repository-fixture-catalog.test.ts \
  tests/internal-production/golden-matrix-v1.test.ts \
  tests/internal-production/golden-matrix-catalog-cli.test.ts
```

Expected: PASS for the exact catalog and wrong-order/count/workflow/protocol negatives.

- [ ] **Step 6: Let the Setfarm completion owner materialize the reviewed immutable-template catalog**

Only after Tasks 1–5 focused/adjacent tests and independent review are green, submit the catalog-preparation action through the exact active Setfarm claim. The completion owner invokes the fixed tracked-catalog command inside the managed worktree; this command creates no GitHub repository or remote. The developer agent does not run this tracked-write command directly:

```bash
set -euo pipefail
npm run internal:golden-matrix-catalog -- prepare \
  --campaign setfarm-mc-internal-production-v1 \
  --campaign-date 2026-08-14 \
  --json
node --import tsx --test tests/internal-production/golden-matrix-v1.test.ts
git status --short -- \
  evals/suites/internal-production-golden-campaign-v1.json \
  evals/suites/internal-production-golden-matrix-v1.json
```

Expected: the Setfarm completion owner records its exact action receipt; the raw B campaign and hash-only matrix wrapper are the only new tracked catalog paths; they contain immutable template identities and no attempt repository/remote; and a rerun is byte-idempotent. Freeze those template bytes. If review later requires a template-byte change, retire this campaign before any live run and choose a new versioned campaign ID/template hash. Never rewrite an existing attempt remote.

- [ ] **Step 7: Submit the scoped story to Setfarm's completion owner**

Use only the immutable claim's completion command and output after catalog idempotence passes. The completion owner accepts the two canonical source catalog files plus the listed schema/CLI/tests/package change, rejects every private fixture path or sidecar, and alone commits/pushes the managed branch.

### Task 7: Implement Sequential Matrix Coordination

**Files:**
- Create: `src/internal-production/golden-matrix-runner.ts`
- Create: `src/internal-production/golden-product-matrix-owner-producer-manifest-activation-controller-v1.ts`
- Test: `tests/internal-production/golden-matrix-runner.test.ts`
- Test: `tests/internal-production/golden-product-matrix-owner-producer-manifest-activation-controller-v1.test.ts`
- Modify: `src/internal-production/golden-run-cli.ts`
- Create: `src/internal-production/golden-repair-review-receipt-v1.ts`
- Create: `src/internal-production/golden-repair-review-observer-v1.ts`
- Create: `src/internal-production/golden-nonaccepted-result-review-acknowledgement-v1.ts`
- Create: `src/internal-production/golden-repair-review-cli.ts`
- Create: `src/internal-production/golden-retry-verification-observers-v1.ts`
- Create: `src/internal-production/golden-matrix-inflight-status-v1.ts`
- Create: `src/internal-production/golden-stage-coordination-v1.ts`
- Create: `src/internal-production/golden-matrix-finalization-pointer-v1.ts`
- Modify: `package.json`
- Test: `tests/internal-production/golden-repair-review-receipt-v1.test.ts`
- Test: `tests/internal-production/golden-repair-review-observer-v1.test.ts`
- Test: `tests/internal-production/golden-nonaccepted-result-review-acknowledgement-v1.test.ts`
- Test: `tests/internal-production/golden-repair-review-cli.test.ts`
- Test: `tests/internal-production/golden-retry-verification-observers-v1.test.ts`
- Test: `tests/internal-production/golden-matrix-inflight-status-v1.test.ts`
- Test: `tests/internal-production/golden-stage-coordination-v1.test.ts`
- Test: `tests/internal-production/golden-matrix-finalization-pointer-v1.test.ts`

**Interfaces:**
- Consumes: Subproject B's exact `GoldenPreflightPorts`, `GoldenCollectionPorts`, `GoldenPreparedExecutionPorts`, `GoldenBlockedPreflightResultV1`, `GoldenPreRunResultV1`, `GoldenStartedRunStartV1`, `GoldenStartedRunResultV1`, `GoldenStageLaunchOutcomeV1`, outer `GoldenCaseExecutionOutcomeV1`, `GoldenPreparedExecutionOutcomeV1`, authenticated `GoldenPreparedRecoveryContextV1` and `GoldenPreparedLaunchStateV1`, finite `GoldenReasonCodeV1Schema`/`GoldenReasonCodeV1`, opaque `GoldenExternalLifecycleCheckpointCapabilityV1` plus `authenticateGoldenExternalLifecycleCheckpointCapabilityV1(value)`, `collectGoldenCaseV1(..., ports: GoldenCollectionPorts)`, `stageGoldenCaseLaunchV1(...)`, `executePreparedGoldenCaseV1({prepared,loaded?,ports})`, `recoverPreparedGoldenCaseV1({prepared,loaded?,ports})`, `deriveGoldenCampaignExecutionCapacityV1(...)`, `reconcileTimedOutGoldenRunV1(...)`, `deriveEffectiveGoldenRunResultsV1(...)`, nominal `GoldenCommittedTimeoutReconciliationPairAuthorityV1`/authenticator plus the result store's bounded list/locator/resolver, exact reminting `resolveGoldenFinalizedCampaignReportV1(finalizationHash)`, `createGoldenRepairCasPreStartAuthorizationPortV1(...)`, `authenticateLoadedGoldenCampaignV1(...)`, `GoldenRunRepositoryOptionsV1`, `GoldenRunResultV1`, `GoldenRunResultStore`, and sole campaign finalizer; plus repository workflow inspection and the matrix loader. C imports the exact narrow B port/result/start/reason/committed-pair types and defines no local lookalike, bare-result execution outcome, bare supersession selector, recovery-context remint, external lifecycle wrapper, or legacy harness-shaped collection boundary.
- Produces: the exact module `src/internal-production/golden-matrix-runner.ts` exports `GoldenMatrixPorts`, `GoldenAssertionEnabledStagedCaseV1`, `GoldenAssertionEnabledStageOutcomeV1`, `GoldenAssertionEnabledCaseExecutorV1`, `GoldenMatrixBlockerCodeV1Schema`, `GoldenMatrixBlockerCodeV1`, `createGoldenMatrixPortsV1`, `createGoldenAssertionEnabledCaseExecutorV1`, and exact recovery factory `createGoldenRecoveryAssertionEnabledCaseExecutorV1({ports,lifecycleCheckpointCapability}): GoldenAssertionEnabledCaseExecutorV1` directly; downstream code imports those identities from that module and C defines no facade, executor alias, or duplicate declaration. `golden-stage-coordination-v1.ts` exports the exact content-addressed `GoldenStageCoordinationV1`, `GoldenStageCoordinationV1Schema`, `prepareGoldenStageCoordinationV1(...)`, and `resolveGoldenStageCoordinationV1(...)`. `golden-matrix-inflight-status-v1.ts` owns the strict durable status schema/store/resolver and `recoverGoldenMatrixInflightV1`, while the runner imports those exact identities. `golden-repair-review-observer-v1.ts` exports `GoldenRepairReviewScenarioV1`, `GoldenRepairReviewObserverV1`, and `createGoldenRepairReviewObserverV1()` for D. `golden-nonaccepted-result-review-acknowledgement-v1.ts` exports `GoldenNonacceptedResultReviewAcknowledgementV1`, its strict schema, `GoldenNonacceptedResultReviewAcknowledgementResolverV1`, and `createGoldenNonacceptedResultReviewAcknowledgementResolverV1()` for E. `golden-product-matrix-owner-producer-manifest-activation-controller-v1.ts` exports `GoldenProductMatrixOwnerProducerManifestActivationReceiptV1`, `GoldenProductMatrixOwnerProducerManifestActivationStatusV1`, zero-input `activateGoldenProductMatrixOwnerProducerManifestV1()`, and zero-input read-only `observeGoldenProductMatrixOwnerProducerManifestActivationStatusV1()`. It also produces:

```ts
import type {
  GoldenStartedRunStartV1,
} from "./golden-run-contract-v1.js";
import type {
  GoldenLaunchOperationMigrationCurrentVerificationV1,
} from "./golden-launch-operation-migration-release-v1.js";
import {
  verifyCurrentGoldenLaunchOperationMigrationV1,
} from "./golden-launch-operation-migration-release-v1.js";

export type GoldenMatrixMigrationVerificationBindingV1 = Readonly<{
  receiptRef: CanonicalRef;
  receiptHash: string;
  applicationSourceSha: string;
  currentSourceSha: string;
  migrationModuleBlobHash: string;
  migrationStatementsHash: string;
  namedMigrationDigestEntryHash: string;
  migrationDigest: string;
  schemaProjectionHash: string;
  verificationHash: string;
}>;

function consumeGoldenStartedRunStartV1(
  start: GoldenStartedRunStartV1,
): void {
  switch (start.strategyKind) {
    case "v3-feature-dev-canary":
      if (
        start.templateHash !== null
        || start.fixtureAttempt !== null
        || start.fixtureAttemptHash !== null
      ) throw new TypeError("invalid authenticated V3 start identity");
      return;
    case "canonical-existing-repository-workflow":
      if (start.admissionBindingHash !== null) {
        throw new TypeError("invalid authenticated existing-repository start identity");
      }
      return;
    default: {
      const unreachable: never = start;
      return unreachable;
    }
  }
}

export type GoldenMatrixOperationV1 =
  | Readonly<{ kind: "preflight" }>
  | Readonly<{ kind: "execute-next" }>
  | Readonly<{ kind: "collect"; caseId: string; runId: string }>
  | Readonly<{ kind: "reconcile-timeouts" }>
  | Readonly<{ kind: "status" }>;

export function runGoldenMatrix(input: Readonly<{
  loaded: LoadedGoldenMatrixV1;
  releaseSha: string;
  missionControlSha: string;
  operation: GoldenMatrixOperationV1;
  ports: GoldenMatrixPorts;
}>): Promise<GoldenMatrixReceiptV1>;

export interface GoldenMatrixPorts {
  harness: Omit<GoldenHarnessPorts,
    "productAssertions" | "history" | "clock" | "lifecycleCheckpoint" |
    "preStartAuthorization" | "existingRepositoryAttempts">;
  resultStore: GoldenRunResultStore;
  clock: GoldenClock;
  assertions: Readonly<{
    nodeCli: GoldenProductAssertionPort;
    nodeApi: GoldenProductAssertionPort;
    browser: GoldenProductAssertionPort;
    game: GoldenProductAssertionPort;
    repositoryWorkflow: GoldenProductAssertionPort;
  }>;
  postPrReviewActions: GoldenPostPrReviewActionPortV1;
  existingRepositoryAttempts: GoldenExistingRepositoryAttemptProvisioningPortV1;
  preStartAuthorization: GoldenPreStartAuthorizationPort;
  repairReviews: GoldenRepairReviewReceiptResolverV1;
  repairConsumptions: GoldenRepairReviewConsumptionPortV1;
}

export function createGoldenMatrixPortsV1(): GoldenMatrixPorts;

export type GoldenMatrixInflightStatusV1 = Readonly<{
  schema: "setfarm.internal-production-golden-matrix-inflight-status.v1";
  matrixHash: string;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  migrationVerification: GoldenMatrixMigrationVerificationBindingV1;
  historicalBaselineReceiptHash: string;
  caseId: string;
  repetition: 1 | 2;
  coordinationHash: string;
  recoveryContextRef: CanonicalRef;
  recoveryContextHash: string;
  capacityReservationHash: string;
  intentHash: string;
  persistedEnvelopeHash: string;
  starterOperationHash: string | null;
  runId: string | null;
  runNumber: number | null;
  resultHash: string | null;
  externalLifecycleCheckpointCapabilityHash: string | null;
  state:
    | "launch-intent-persisted"
    | "starter-operation-issued"
    | "run-bound"
    | "result-stored";
  predecessorStatusHash: string | null;
  inflightKeyHash: string;
  statusRef: CanonicalRef;
  statusHash: string;
}>;

export const GoldenMatrixInflightStatusV1Schema:
  z.ZodType<GoldenMatrixInflightStatusV1>;

export function resolveGoldenMatrixInflightStatusV1(input: Readonly<{
  statusRef: CanonicalRef;
  statusHash: string;
}>): Promise<GoldenMatrixInflightStatusV1>;

export function recoverGoldenMatrixInflightV1(input: Readonly<{
  statusRef: CanonicalRef;
  statusHash: string;
  ports: GoldenMatrixPorts;
}>): Promise<GoldenMatrixReceiptV1>;

export const GoldenMatrixLocalBlockerCodeV1Schema = z.enum([
  "GOLDEN_MATRIX_EXISTING_REPOSITORY_ATTEMPT_RECOVERY_REQUIRED",
  "GOLDEN_MATRIX_NONACCEPTED_REVIEW_REQUIRED",
  "GOLDEN_MATRIX_POST_PR_REVIEW_ACTION_REQUIRED",
]);

export type GoldenMatrixLocalBlockerCodeV1 = z.infer<
  typeof GoldenMatrixLocalBlockerCodeV1Schema
>;

export const GoldenMatrixBlockerCodeV1Schema:
  z.ZodType<GoldenReasonCodeV1 | GoldenMatrixLocalBlockerCodeV1> = z.union([
    GoldenReasonCodeV1Schema,
    GoldenMatrixLocalBlockerCodeV1Schema,
  ]);

export type GoldenMatrixBlockerCodeV1 = z.infer<
  typeof GoldenMatrixBlockerCodeV1Schema
>;

export type GoldenMatrixCommittedTimeoutReconciliationV1 = Readonly<{
  authorityHash: string;
  pairRef: CanonicalRef;
  pairHash: string;
  supersessionHash: string;
  originalTimeoutResultHash: string;
  terminalResultHash: string;
}>;

export type GoldenMatrixReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-golden-matrix-receipt.v1";
  matrixHash: string;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  migrationVerification: GoldenMatrixMigrationVerificationBindingV1;
  orderedResultHashes: readonly string[];
  orderedTimeoutReconciliations:
    readonly GoldenMatrixCommittedTimeoutReconciliationV1[];
  decision: "ready" | "running" | "accepted" | "blocked";
  nextOrdinal: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  blockerCodes: readonly GoldenMatrixBlockerCodeV1[];
  finalizationIdentity: null;
  inflightStatus: Readonly<{
    statusRef: CanonicalRef;
    statusHash: string;
    inflightKeyHash: string;
    state: GoldenMatrixInflightStatusV1["state"];
  }> | null;
  matrixReceiptRef: CanonicalRef;
  matrixReceiptHash: string;
}>;

export const GoldenMatrixReceiptV1Schema: z.ZodType<GoldenMatrixReceiptV1>;

export function resolveGoldenMatrixReceiptV1(input: Readonly<{
  matrixReceiptRef: CanonicalRef;
  matrixReceiptHash: string;
}>): Promise<GoldenMatrixReceiptV1>;

export type GoldenMatrixFinalizationPointerV1 = Readonly<{
  schema: "setfarm.internal-production-golden-matrix-finalization-pointer.v1";
  matrixHash: string;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  migrationVerification: GoldenMatrixMigrationVerificationBindingV1;
  inflightStatus: GoldenMatrixReceiptV1["inflightStatus"];
  matrixReceiptRef: CanonicalRef;
  matrixReceiptHash: string;
  sourceBuildAuthorityHash: string;
  sourceBuildAuthorityRef: CanonicalRef;
  effectiveProjectionHash: string;
  finalizationHash: string;
  finalizerOutputRef: CanonicalRef;
  finalizerOutputHash: string;
  reportPath: string;
  reportHash: string;
  pointerHash: string;
}>;

export const GoldenMatrixFinalizationPointerV1Schema:
  z.ZodType<GoldenMatrixFinalizationPointerV1>;

export function recordGoldenMatrixFinalizationPointerV1(input: Readonly<{
  loaded: LoadedGoldenMatrixV1;
  matrixReceipt: GoldenMatrixReceiptV1;
  finalization: GoldenFinalizedCampaignReportV1;
}>): Promise<GoldenMatrixFinalizationPointerV1>;

export function resolveGoldenMatrixFinalizationPointerV1(
  loaded: LoadedGoldenMatrixV1,
): Promise<GoldenMatrixFinalizationPointerV1>;

export type GoldenStageCoordinationV1 = Readonly<{
  schema: "setfarm.internal-production-golden-stage-coordination.v1";
  campaignHash: string;
  caseId: string;
  repetition: 1 | 2;
  launchAttemptOrdinal: number;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  migrationVerification: GoldenMatrixMigrationVerificationBindingV1;
  coordinationRef: CanonicalRef;
  coordinationHash: string;
}>;

export const GoldenStageCoordinationV1Schema:
  z.ZodType<GoldenStageCoordinationV1>;

export function prepareGoldenStageCoordinationV1(input: Readonly<{
  loaded: LoadedGoldenCampaignV1;
  caseId: string;
  setfarmSha: string;
  missionControlSha: string;
}>): Promise<GoldenStageCoordinationV1>;

export function resolveGoldenStageCoordinationV1(input: Readonly<{
  coordinationRef: CanonicalRef;
  coordinationHash: string;
}>): Promise<GoldenStageCoordinationV1>;

export type GoldenAssertionEnabledStagedCaseV1 = Readonly<{
  schema: "setfarm.internal-production-golden-assertion-enabled-staged-case.v1";
  campaignHash: string;
  caseId: string;
  repetition: 1 | 2;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  migrationVerification: GoldenMatrixMigrationVerificationBindingV1;
  coordinationHash: string;
  recoveryContextRef: CanonicalRef;
  recoveryContextHash: string;
  externalLifecycleCheckpointCapabilityHash: string | null;
  inflightRef: CanonicalRef;
  inflightHash: string;
}>;

export type GoldenAssertionEnabledStageOutcomeV1 =
  | Readonly<{
      kind: "staged";
      staged: GoldenAssertionEnabledStagedCaseV1;
    }>
  | Readonly<{
      kind: "pre_run";
      resultRef: CanonicalRef;
      resultHash: string;
    }>
  | Readonly<{
      kind: "blocked";
      preflight: GoldenBlockedPreflightResultV1;
    }>;

export interface GoldenAssertionEnabledCaseExecutorV1 {
  stage(input: Readonly<{
    loaded: LoadedGoldenCampaignV1;
    caseId: string;
    setfarmSha: string;
    missionControlSha: string;
    coordinationRef: CanonicalRef;
    coordinationHash: string;
  }>): Promise<GoldenAssertionEnabledStageOutcomeV1>;
  executeStaged(input: Readonly<{
    staged: GoldenAssertionEnabledStagedCaseV1;
  }>): Promise<Readonly<{ resultHash: string; resultRef: CanonicalRef }>>;
  recoverStaged(input: Readonly<{
    staged: GoldenAssertionEnabledStagedCaseV1;
  }>): Promise<Readonly<{ resultHash: string; resultRef: CanonicalRef }>>;
  collect(input: Readonly<{
    loaded: LoadedGoldenCampaignV1;
    caseId: string;
    runId: string;
    setfarmSha: string;
    missionControlSha: string;
  }>): Promise<Readonly<{ resultHash: string; resultRef: CanonicalRef }>>;
}

export function createGoldenAssertionEnabledCaseExecutorV1(input: Readonly<{
  ports: GoldenMatrixPorts;
}>): GoldenAssertionEnabledCaseExecutorV1;

export function createGoldenRecoveryAssertionEnabledCaseExecutorV1(input: Readonly<{
  ports: GoldenMatrixPorts;
  lifecycleCheckpointCapability: GoldenExternalLifecycleCheckpointCapabilityV1;
}>): GoldenAssertionEnabledCaseExecutorV1;

export type GoldenRepairReviewReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-golden-repair-review-receipt.v1";
  coordinationScope:
    | Readonly<{ kind: "matrix"; matrixHash: string }>
    | Readonly<{ kind: "campaign"; campaignHash: string }>;
  caseId: string;
  failedResultHash: string;
  trustedRootCauseHash: string;
  disposition:
    | "setfarm-repair"
    | "mission-control-repair"
    | "external-resolution"
    | "clean-generated-retry";
  owningRepository: "setfarm" | "mission-control" | "external" | "generated-product";
  repairPullRequestUrl: string | null;
  repairMergeSha: string | null;
  externalResolutionEvidenceRef: CanonicalRef | null;
  setfarmMainSha: string;
  missionControlMainSha: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  verification:
    | Readonly<{
        kind: "repository-repair";
        bundleHash: string;
        independentReviewHash: string;
        focusedVerificationHash: string;
        broadVerificationHash: string;
        cleanBuildHash: string;
      }>
    | Readonly<{
        kind: "external-resolution";
        observationHash: string;
        independentReviewHash: string;
        focusedVerificationHash: string;
        broadVerificationHash: string;
        cleanBuildHash: string;
      }>
    | Readonly<{
        kind: "generated-retry";
        eligibilityHash: string;
      }>;
  evidenceRefs: readonly CanonicalRef[];
  reviewedAt: string;
  receiptHash: string;
}>;

export const GoldenRepairReviewReceiptV1Schema:
  z.ZodType<GoldenRepairReviewReceiptV1>;

export type GoldenRepairReviewScenarioV1 =
  | Readonly<{
      kind: "repository-repair";
      owningRepository: "setfarm" | "mission-control";
      repairPullRequestUrl: string;
      repairMergeSha: string;
    }>
  | Readonly<{
      kind: "external-resolution";
      externalResolutionEvidenceRef: CanonicalRef;
    }>
  | Readonly<{ kind: "clean-generated-retry" }>;

export interface GoldenRepairReviewObserverV1 {
  observeAndRecord(input: Readonly<{
    loaded: LoadedGoldenCampaignV1;
    failedResultHash: string;
    scenario: GoldenRepairReviewScenarioV1;
  }>): Promise<GoldenRepairReviewReceiptV1>;
}

export function createGoldenRepairReviewObserverV1():
  GoldenRepairReviewObserverV1;

export type GoldenNonacceptedResultReviewAcknowledgementV1 = Readonly<{
  schema:
    "setfarm.internal-production-golden-nonaccepted-result-review-acknowledgement.v1";
  campaignHash: string;
  caseId: string;
  failedResultHash: string;
  classification:
    | "provider_or_quota_failure"
    | "infrastructure_failure"
    | "generated_product_failure";
  trustedRootCauseHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  sourceObservation:
    | Readonly<{
        kind: "external-resolution";
        observationRef: CanonicalRef;
        observationHash: string;
      }>
    | Readonly<{
        kind: "clean-generated-retry";
        observationRef: CanonicalRef;
        observationHash: string;
      }>;
  repairReceiptHash: string;
  evidenceRefs: readonly CanonicalRef[];
  acknowledgementRef: CanonicalRef;
  acknowledgementHash: string;
}>;

export const GoldenNonacceptedResultReviewAcknowledgementV1Schema:
  z.ZodType<GoldenNonacceptedResultReviewAcknowledgementV1>;

export interface GoldenNonacceptedResultReviewAcknowledgementResolverV1 {
  locateForRepairReceipt(input: Readonly<{
    repairReceiptHash: string;
  }>): Promise<Readonly<{
    acknowledgementRef: CanonicalRef;
    acknowledgementHash: string;
  }>>;
  resolve(input: Readonly<{
    acknowledgementRef: CanonicalRef;
    acknowledgementHash: string;
  }>): Promise<GoldenNonacceptedResultReviewAcknowledgementV1>;
}

export function createGoldenNonacceptedResultReviewAcknowledgementResolverV1():
  GoldenNonacceptedResultReviewAcknowledgementResolverV1;

export type GoldenVerificationAuthorityReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-golden-verification-authority.v1";
  kind: "independent-review" | "focused-verification" | "broad-verification" | "clean-build";
  owningRepository: "setfarm" | "mission-control" | "external";
  sourceSha: string;
  commandSetHash: string;
  verdict: "pass";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  evidenceRefs: readonly CanonicalRef[];
  authorityHash: string;
}>;

export type GoldenRepairVerificationAuthorityBundleV1 = Readonly<{
  schema: "setfarm.internal-production-golden-repair-verification-bundle.v1";
  coordinationScope: GoldenRepairReviewReceiptV1["coordinationScope"];
  caseId: string;
  failedResultHash: string;
  owningRepository: "setfarm" | "mission-control";
  repairPullRequestUrl: string;
  repairMergeSha: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  independentReviewHash: string;
  focusedVerificationHash: string;
  broadVerificationHash: string;
  cleanBuildHash: string;
  evidenceRefs: readonly CanonicalRef[];
  bundleHash: string;
}>;

export type GoldenExternalResolutionObservationV1 = Readonly<{
  schema: "setfarm.internal-production-golden-external-resolution-observation.v1";
  coordinationScope: GoldenRepairReviewReceiptV1["coordinationScope"];
  caseId: string;
  failedResultHash: string;
  trustedRootCauseHash: string;
  externalResolutionEvidenceRef: CanonicalRef;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  independentReviewHash: string;
  focusedVerificationHash: string;
  broadVerificationHash: string;
  cleanBuildHash: string;
  evidenceRefs: readonly CanonicalRef[];
  observationHash: string;
}>;

export type GoldenGeneratedRetryEligibilityV1 = Readonly<{
  schema: "setfarm.internal-production-golden-generated-retry-eligibility.v1";
  coordinationScope: GoldenRepairReviewReceiptV1["coordinationScope"];
  caseId: string;
  failedResultHash: string;
  trustedRootCauseHash: string;
  classification: "generated_product_failure";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  zeroActiveOwnership: true;
  evidenceRefs: readonly CanonicalRef[];
  eligibilityHash: string;
}>;

export function createGoldenExternalResolutionObserverV1():
  GoldenExternalResolutionObserverV1;

export function createGoldenGeneratedRetryEligibilityObserverV1():
  GoldenGeneratedRetryEligibilityObserverV1;

export interface GoldenExternalResolutionObserverV1 {
  observe(input: Readonly<{
    coordinationScope: GoldenRepairReviewReceiptV1["coordinationScope"];
    caseId: string;
    failedResultHash: string;
    externalResolutionEvidenceRef: CanonicalRef;
  }>): Promise<GoldenExternalResolutionObservationV1>;
}

export interface GoldenGeneratedRetryEligibilityObserverV1 {
  observe(input: Readonly<{
    coordinationScope: GoldenRepairReviewReceiptV1["coordinationScope"];
    caseId: string;
    failedResultHash: string;
  }>): Promise<GoldenGeneratedRetryEligibilityV1>;
}

export interface GoldenRepairReviewReceiptResolverV1 {
  resolve(input: Readonly<{
    coordinationScope: GoldenRepairReviewReceiptV1["coordinationScope"];
    caseId: string;
    failedResultHash: string;
  }>): Promise<GoldenRepairReviewReceiptV1 | null>;
}

export interface GoldenRepairReviewConsumptionPortV1 {
  consume(input: Readonly<{
    receiptHash: string;
    coordinationScope: GoldenRepairReviewReceiptV1["coordinationScope"];
    caseId: string;
    failedResultHash: string;
    nextLaunchIntentHash: string;
  }>): Promise<Readonly<{
    receiptHash: string;
    nextLaunchIntentHash: string;
    state: "consumed";
    consumptionHash: string;
  }>>;
}

export function createGoldenRepairReviewReceiptResolverV1():
  GoldenRepairReviewReceiptResolverV1;
```

- [ ] **Step 1: Write failing coordination tests**

Prove the discriminated operation parser rejects missing/extra flags and that preflight/status start zero runs, execute-next starts at most one, collect requires an exact started-run identity and cannot start a replacement, acceptance advances, non-acceptance freezes with `GOLDEN_MATRIX_NONACCEPTED_REVIEW_REQUIRED` until its exact review authority exists, ordinals 1–3 require two accepted run receipts, ordinals 4–7 require one, a repeated systemic cause blocks at three distinct effective subjects, and release drift blocks. An unknown/malformed catalog case is a `GOLDEN_ARGUMENT_CASE_UNKNOWN` operation error before B preflight, returns no matrix/preflight/result authority, and calls no B/C observation or mutation port. A B outer `pre_run` stage outcome is stored once as immutable policy history, returns no staged/inflight/run identity, freezes the slot with `GOLDEN_PRE_RUN_CONFIGURATION_FAILURE_RECORDED`, keeps campaign settlement `in_progress` unless the same systemic root reaches three distinct stable subjects, and advances no acceptance, terminal, cleanup, repetition, or fleet-capacity count. A B outer `blocked` outcome stores no result and returns its nested before/after-authority preflight. Define deterministic history order as matrix ordinal, target repetition, launch-attempt ordinal, then run number only for `kind:"run"`, followed by result hash; reconstructing after process restart must produce byte-identical receipt order. Every returned receipt has the exact content-derived `matrixReceiptRef` and `matrixReceiptHash`; the fixed store uses real mode-`0700` ancestors, an unpredictable same-directory temporary, fsync plus atomic no-replace publication and parent fsync, and a final mode-`0600` regular one-link no-follow reopen. Interruption never exposes a partial deterministic final and equal final bytes are idempotently adopted. In a new process, `resolveGoldenMatrixReceiptV1({matrixReceiptRef,matrixReceiptHash})` returns byte-identical frozen content without an index or caller path. Wrong/ref-only/hash-only pairs, corrupt/noncanonical/oversized bytes, collision, symlink/hardlink, wrong mode, extra member, and changed result/supersession/epoch/decision relation fail closed. Preflight/status receipt sealing changes no run, result, repository, GitHub, lifecycle, or tracked state. Prove only `kind:"run"` results whose B release identity equals the selected `GoldenFinalReleaseEpochV1` Setfarm/MC pair satisfy accepted slots. For every started result, `consumeGoldenStartedRunStartV1(result.start)` exhaustively switches on the imported discriminant before C uses the result: V3 accepts only null template/attempt plus the feature-dev/V3/admission identities, and existing-repository accepts only the complete fresh attempt/template/default-protocol/null-admission identity with equal requested/actual workflow. `golden-matrix-runner.ts` must contain exactly the unaliased type-only named import `GoldenStartedRunStartV1` from the literal `./golden-run-contract-v1.js`. An AST/source-boundary test rejects a local declaration, import alias, namespace/default/dynamic import, `import()`, re-export facade, second source, structural projection, or cast for that symbol; the compile consumer references the imported name directly. Terminal reconciliation must preserve that imported nested value byte-for-byte. After a repair changes either SHA, prior results remain stored, cleanup-checked when run-shaped, reported, and cumulative for the three-repeat stop but no longer count toward acceptance; execute-next starts fresh attempts for every now-unsatisfied slot until the same campaign has ten accepted current-epoch run results.

Exercise fresh-process recovery after each B boundary: recovery-context publication, capacity reservation plus persisted launch intent, attempt/admission binding, starter-operation issue before invocation, run transaction commit before response, run-bound promotion, and result-store commit. The C phase-store decorator must seal the next `GoldenMatrixInflightStatusV1` after B's durable transition and before B may perform the next side effect. Every state carries the exact non-null recovery-context pair and `capacityReservationHash` plus one `externalLifecycleCheckpointCapabilityHash` that is null for ordinary matrix/E or non-null only for the recovery factory; its remaining strict state/null relations are: `launch-intent-persisted` has null operation/run/result; `starter-operation-issued` has one operation and null run/result; `run-bound` has that same operation plus jointly non-null run ID/number and null result; `result-stored` adds the exact stored result hash. Every successor binds `predecessorStatusHash`; `inflightKeyHash` is the canonical hash of exact `caseId + coordinationHash + recoveryContextRef + recoveryContextHash + capacityReservationHash + intentHash + persistedEnvelopeHash + starterOperationHash + externalLifecycleCheckpointCapabilityHash`, and the run pair becomes non-null only from B's atomically context/reservation/operation-bound `GoldenRunStartReceiptV1`. Wrong case, coordination, context pair, capability hash, reservation, intent, envelope, operation, predecessor, run pair, result, matrix/campaign/epoch, state relation, or structural clone fails before a B call.

Exercise every response-loss boundary around `prepareGoldenStageCoordinationV1(...)` and `stage(...)`: coordination operation issue, temp write/fsync/link/parent-fsync/reopen, caller operation receipt before stage, stage-operation issue, a pre-run result-store commit or outer blocked outcome, B capacity-reservation/intent/outbox durability, inflight and staged sealing, stage-index publication, and final response. A retry with the same canonical pair must resolve or adopt the byte-identical discriminated stage outcome. The `pre_run` outcome reopens exactly one result ref/hash and has no B reservation, intent, authorization, admission/attempt, outbox, inflight, or run; the `blocked` outcome reopens the exact nested preflight and has neither a result nor those launch authorities; the `staged` outcome reuses exactly one B capacity reservation, intent, authorization, admission-or-attempt, provision receipt, and outbox. Race two callers with one pair and require convergence; a second outcome, structural clone, mismatched case/repetition/epoch, or ambiguous partial operation fails closed. Prove the matrix persists the coordination pair before its first stage call and can recover after losing the stage response without holding any outcome in process memory. With distinct coordination pairs, a fleet campaign permits two fresh staged reservations only after B returns eligible capacity two; while both reservations fill capacity, `executeStaged` and `recoverStaged` continue them successfully through B's prepared APIs without preflight or another reservation, whereas a third fresh stage, an unrelated/prior-epoch/unattributed owner, and every matrix/standard second launch fail before a second B side effect. Counters prove exactly two reservations and never three.

In a fresh shell, the exact `recover-inflight --status-ref REF --status-hash HASH --json` form accepts no matrix path, case ID, repetition, run ID/number, reservation, intent, operation, release SHA, root, or port override. It reopens the one strict status by content address, resolves and authenticates the status-bound `coordinationHash`, reloads only the fixed catalog and requires its matrix/campaign hash, authenticates B's one exact capacity-reservation/persisted-intent/envelope/operation chain, and invokes only B's prepared recovery mode: pre-issue reopens that same prepared chain, post-issue resolves/resumes/adopts only that same outbox operation, and run-bound calls collect only for the status-bound run. It never reruns fresh preflight/capacity. The recovery-only phase wrapper rejects any attempt to mint a second reservation, intent, operation, admission, fixture attempt, or run. A `result-stored` replay reopens the exact result and performs no launch call. Tests prove the command succeeds without shell-provided case/run identity even when fleet capacity is currently full, a fresh-process structural reconstruction cannot authenticate, zero/multiple/mismatched B chains are ambiguous, and response loss returns the byte-identical new matrix receipt/status rather than starting again.

Seed one or more immutable B `kind:"run"`/`nonterminal-timeout` results alongside optional `kind:"pre_run"` history. `status`, `preflight`, and `execute-next` must list `GOLDEN_TIMEOUT_RECONCILIATION_REQUIRED` and start nothing while B's effective mapping reports `timeoutReconciliation.kind:"reconciliation_required"`. The explicit `reconcile-timeouts` operation filters strictly to those started-run timeout originals and calls B `reconcileTimedOutGoldenRunV1(...)` serially for each sorted outstanding original using a ports object structurally omitting `admissions | starter | existingRepositoryAttempts | preStartAuthorization | lifecycleCheckpoint`. It passes the returned terminal run result and run-only supersession together to exactly one B `putTimeoutReconciliationPair()` call and repeats until every now-terminal original is committed or one remains active. Passing a pre-run hash or calling generic `put()` for the terminal fails before mutation. It never invokes C lifecycle/action/provisioning/authorization code and never rewrites the timeout. Crash recovery at every compound boundary invokes the same pair call: before B's final per-supersession locator commit the pair receipt, terminal, supersession, and private index successors remain non-selectable and the original remains `reconciliation_required`; after locator durability B returns one authenticated committed-pair authority and the mapping becomes `terminal_replacement_selected`. Response loss returns that same authority. A third/conflicting result, pair, locator, or supersession fails closed. After every runner operation call `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`, authenticate each result, and call B `deriveEffectiveGoldenRunResultsV1({...,timeoutReconciliations})` exactly once. Use only its pre-run/current/historical partitions and mappings: current effective runs alone drive slot readiness/capacity/acceptance, while pre-run history drives only blockers and the distinct-subject systemic threshold. Reject bare/forged/duplicate/cross-run authorities before any policy decision; C defines no timeout/effective-result mapper and never calls a bare-supersession list.

For each existing-repository execution, assert the exact order `B prepareLaunch/fsync -> C provision fresh attempt -> B persist provision receipt -> B repair pre-start authorization -> starter`. A first attempt receives B's code-owned `not_required`; a repaired retry uses only the C callback wrapped by `createGoldenRepairCasPreStartAuthorizationPortV1`. Simulate interruption before remote creation, after private remote creation, after baseline push, after sidecar write, after provision receipt persistence, and after authorization CAS. Recovery may finish/reuse only the same persisted intent/attempt operation and never creates a second repo or consumes a second repair receipt. A subsequent retry or new epoch must create a new repository identity even if prior bytes are clean.

Prove a frozen slot cannot retry without an exact validated repair-review receipt and atomic consumption bound to B's next persisted launch intent; wrong result/root/case/scope/disposition/owner/PR/merge/main SHA/review/test/build/epoch hash is rejected. Repository/platform repair and external resolution require four schema-validated `GoldenVerificationAuthorityReceiptV1` values from the fixed content-addressed store. For a Setfarm or Mission Control repair, `observe-repair` is the sole producer of those four authorities: it resolves the exact failed result/root and merged GitHub PR, requires one independent non-author approval on the repaired head, requires the owning repository at clean Setfarm-owner-synchronized `main === repairMergeSha`, executes the code-owned focused command set for that owner and the fixed broad `npm test` plus clean `npm run build`, and content-addresses normalized exit/source/command/evidence observations. It accepts no command, cwd, environment, output, authority hash, reviewer identity, check conclusion, or build identity from the caller. Wrong PR/base/head/merge/reviewer, dirty source, source drift between commands, nonzero command, or a Setfarm runtime guard failure writes no authority bundle.

`record-external` invokes `createGoldenExternalResolutionObserverV1()` itself. That observer resolves and authenticates the canonical evidence ref through the artifact index, requires an independent non-author review of the exact external resolution, executes the code-owned current provider/infrastructure health and release checks, constructs all verification receipts internally, and returns one `GoldenExternalResolutionObservationV1`; no verification hash is accepted from CLI input. `record-generated` similarly invokes `createGoldenGeneratedRetryEligibilityObserverV1()` itself, reopens B's exact result, requires `generated_product_failure`, exact canonical product evidence/root, unchanged Setfarm/MC epoch, zero active ownership, and a fresh-run-only disposition, then returns one receipt; it accepts no review/evidence/verification hash and never mutates or resumes the generated repository. A valid matrix- or campaign-scoped repair receipt may be consumed exactly once for one new clean launch intent. The runner cannot prepare or pass an intent: it supplies only the callback to B's `createGoldenRepairCasPreStartAuthorizationPortV1(...)`; B persists the intent first and invokes that callback with its authenticated exact object. The callback resolves and CAS-consumes the reviewed receipt against `input.intentHash`, and returns B's exact authorization receipt. Concurrent execute-next, crash after CAS, and replay return the same consumption or block, while result/root occurrence counts remain cumulative.

Test `createGoldenRepairReviewObserverV1()` as the only programmatic repair entry used by Subproject D. `observeAndRecord({loaded,failedResultHash,scenario})` first authenticates the exact frozen `LoadedGoldenCampaignV1` object returned by B's loader and rejects a structural clone before store/GitHub/command activity. It strictly parses `failedResultHash`, reopens the B result, and rejects `kind:"pre_run"` before any scenario, store, GitHub, command, or repair mutation because configuration authority is not a repository/generated/external repair receipt. For a strict nonaccepted `kind:"run"` result it parses the discriminated `GoldenRepairReviewScenarioV1`, derives the campaign coordination scope, case, classification, trusted root, current full epoch, and allowed scenario relation, then delegates to the same fixed C observers, verification-authority bundle producer, and content-addressed repair-receipt writer used by `observe-repair`, `record-external`, and `record-generated`. Repository repair accepts only owner plus canonical PR/merge identity and runs the existing code-owned review/focused/broad/build checks; external/generated use their existing observers. No caller supplies a scope, case, root hash, epoch, path, command, cwd, environment, output, verification/observation/eligibility/receipt hash, evidence array, or store. It returns the exact strict frozen stored `GoldenRepairReviewReceiptV1`; repeated identical input reopens it, while a pre-run/scenario/result/classification/owner/epoch mismatch fails before a write. Source-boundary tests require D to import this exact interface/factory from `golden-repair-review-observer-v1.ts` and prohibit a second programmatic repair implementation.

For `external-resolution` and `clean-generated-retry`, successful record creation from a strict nonaccepted `kind:"run"` result must also seal one `GoldenNonacceptedResultReviewAcknowledgementV1` before returning. The producer rejects pre-run history, reopens the just-stored external observation or generated eligibility and repair receipt, and derives `campaignHash`, case/result, exact nonaccepted classification, trusted root, full epoch, sorted unique canonical evidence, and the source observation ref/hash solely from those strict bytes. External permits only `provider_or_quota_failure | infrastructure_failure`; generated permits only `generated_product_failure`. Its canonical source refs are respectively ``setfarm://internal-production/golden-external-resolution-observations/sha256/${observationHash}`` and ``setfarm://internal-production/golden-generated-retry-eligibilities/sha256/${eligibilityHash}``. Hash every acknowledgement member except its derived pair as `acknowledgementHash`, require `acknowledgementRef === setfarm://internal-production/golden-nonaccepted-review-acknowledgements/sha256/${acknowledgementHash}`, and publish/reopen it through the fixed content-addressed no-replace protocol. Only after that final exists does the recorder publish one immutable index keyed by `repairReceiptHash` containing the exact acknowledgement pair; recovery from a receipt-without-index finishes the same acknowledgement from the already durable observation/eligibility and never repeats external work.

`createGoldenNonacceptedResultReviewAcknowledgementResolverV1()` is read-only. `locateForRepairReceipt({repairReceiptHash})` parses only that SHA-256, reopens the exact repair receipt and its one immutable index, and returns only `{acknowledgementRef,acknowledgementHash}`. `resolve({acknowledgementRef,acknowledgementHash})` validates the canonical relation, derives the fixed private path, performs a bounded `O_NOFOLLOW` regular one-link mode-`0600` reopen, strictly parses/re-hashes/freeze the acknowledgement, then reopens its repair receipt and source observation/eligibility and equality-checks campaign/case/result/classification/root/epoch/ref/hash/evidence. It creates no directory/file/index, calls no observer, GitHub, command, repair CAS, or launch API, and accepts no alternate path or expected identity. Missing, duplicate, corrupt, wrong-kind, mixed external/generated, stale-epoch, cross-result, wrong classification/root, ref/hash mismatch, or repository-repair receipt fails closed. E must locate then resolve this exact acknowledgement before advancing past a reviewed nonaccepted external/generated case; receipt prose or a hash without the resolver authority is insufficient.

Parse every `GoldenStageCoordinationV1`, `GoldenMatrixReceiptV1`, `GoldenMatrixInflightStatusV1`, repair receipt, verification authority, external/generated observation, acknowledgement, and finalization pointer through a `.strict()` schema, recursively freeze it, and recompute its content hash. Bound all IDs/URLs/paths/codes/timestamps and the coordination launch-attempt ordinal to `1..64`, require every inflight status to carry one SHA-256 `capacityReservationHash`, cap result hashes, committed timeout-reconciliation projections, and evidence refs at `64`, require all arrays sorted and unique by their declared hash key, parse every evidence/pair ref with B's `CanonicalRefSchema`, and prohibit absolute paths, raw commands/output, tokens, prose, unknown members, or a second URI family. Each `orderedTimeoutReconciliations` member must equality-copy one currently authenticated B committed-pair authority, and the strict receipt rejects a bare supersession hash/body, missing/forged authority hash, pair ref/hash mismatch, duplicate original/terminal/supersession use, or authority not visible through B's exact committed index. `GoldenMatrixBlockerCodeV1Schema` is exactly B's finite `GoldenReasonCodeV1Schema` unioned with C's three literals `GOLDEN_MATRIX_EXISTING_REPOSITORY_ATTEMPT_RECOVERY_REQUIRED`, `GOLDEN_MATRIX_NONACCEPTED_REVIEW_REQUIRED`, and `GOLDEN_MATRIX_POST_PR_REVIEW_ACTION_REQUIRED`; `GoldenMatrixReceiptV1.blockerCodes` accepts no arbitrary string, and compile-time tests reject a fourth C literal. `GoldenMatrixReceiptV1.finalReleaseEpoch` must equal the selected B epoch. Exactly `ready|running` require a non-null `nextOrdinal` and empty `blockerCodes`; exactly `blocked` requires `nextOrdinal:null` and one or more sorted unique `GoldenMatrixBlockerCodeV1` values with at most `64` entries; `accepted` requires both `nextOrdinal:null` and empty `blockerCodes`, every current-epoch matrix slot accepted, and B's settlement `complete` after its all-current-plus-historical effective cleanup validation. A non-null `inflightStatus` must resolve by its exact ref/hash, match its copied key/state, matrix/campaign/final epoch and B reservation hash, and name one result hash in `orderedResultHashes` when state is `result-stored`; accepted/finalizable status requires `result-stored`, while an unresolved state or any historical cleanup blocker prevents acceptance. `finalizationIdentity` is always null because the immutable finalization authority lives only in `GoldenMatrixFinalizationPointerV1`. Compute `matrixReceiptHash` over every matrix-receipt member except the derived `matrixReceiptRef` and `matrixReceiptHash`; require `matrixReceiptRef === setfarm://internal-production/golden-matrix-receipts/sha256/${matrixReceiptHash}`. The pointer must copy and equality-bind the accepted receipt's exact `inflightStatus`, `matrixReceiptRef`, and `matrixReceiptHash`, campaign/matrix hashes, exact same final epoch, B source-build authority hash/ref, `effectiveProjectionHash`, finalizer ref/hash, report path/hash, and its own hash; no field may be caller-inferred.

Every `runGoldenMatrix()` operation seals its returned canonical matrix receipt below B's fixed real mode-`0700` child ``golden-results/matrix-receipts/sha256/${matrixReceiptHash.slice(0, 2)}/${matrixReceiptHash}.json``. The inflight-status owner hashes every status member except derived `statusRef/statusHash`, requires `statusRef === setfarm://internal-production/golden-matrix-inflight-statuses/sha256/${statusHash}`, and uses the identical protocol below ``golden-results/matrix-inflight-statuses/sha256/${statusHash.slice(0, 2)}/${statusHash}.json``. After sealing, it appends one immutable transition below the coordinate child derived only from `hashCanonicalJson({matrixHash,caseId,repetition,intentHash})`; the transition binds exact `inflightKeyHash`, status ref/hash, and predecessor hash. One intent coordinate permits at most four status transitions and one unique linear predecessor chain. Status derives the exact intent only from B's authenticated unresolved envelope or the latest matrix result's equality-bound launch identity, reads that one bounded coordinate, validates the chain, and chooses its unique head by hashes rather than time; a fork, gap, extra fifth entry, or another key is ambiguity. For each immutable store/transition, create an unpredictable same-directory ``.${hash}.${randomBytes(32).toString("hex")}.tmp`` with exclusive no-follow mode `0600`, write bounded canonical bytes, and fsync it. Publish only with atomic `link(temp,final)`, fsync the parent, prove both names are the same regular inode and exact content, unlink only that owned temp, fsync the parent again, and reopen the final with `O_NOFOLLOW` to require one link, mode `0600`, strict schema, canonical bytes, and exact hash/ref relation before returning. Recovery caps hash-prefixed temporaries at eight and may clean a crash-left two-link publication only after exact inode/content proof; partial, mismatched, or extra candidates fail closed. A deterministic final is therefore absent or complete, never partially written. If the final already exists with one link, do not publish or replace: reopen/adopt only exact content. Equal canonical bytes are idempotent; a different/partial final, unsafe temporary/final, or publication ambiguity fails closed. Tests interrupt before/after every temporary write/fsync, link publication, each parent fsync, inode proof, cleanup, final reopen/coordinate append, and response, and prove retry returns one exact receipt/status without a second platform action. `resolveGoldenMatrixReceiptV1({matrixReceiptRef,matrixReceiptHash})` and `resolveGoldenMatrixInflightStatusV1({statusRef,statusHash})` accept no matrix file, campaign, epoch, root, path, body, or mutable index; each validates its canonical-ref relation, derives its fixed content address, and reopens/rehashes it in a fresh process. Missing, corrupt, oversized, noncanonical, mode-invalid, symlinked, hardlinked, cross-hash, or wrong-ref bytes fail closed. The matrix `status` operation may read only the exact bounded coordinate for its authenticated current intent and must resolve its head ref/hash before copying `inflightStatus`; no global directory scan or caller identity is allowed. `status` and `preflight` remain observationally read-only for run, repository, GitHub, lifecycle, and result state; their sole permitted private writes are sealing the immutable receipt and any exact current inflight status they return.

Matrix-receipt publication additionally fsyncs one immutable private publication operation before opening its temporary; that operation binds the expected `matrixReceiptRef`, `matrixReceiptHash`, exact final canonical byte hash/length, and one unpredictable temporary basename. Therefore a fresh process with final absent can distinguish owned state without process memory. Zero owned temporaries recreates the operation-bound temporary; exactly one safe regular mode-`0600` one-link temporary is reopened. Complete exact canonical bytes are adopted by link/fsync/inode-proof/cleanup/final-reopen, while an exact prefix is unlinked only after operation/basename/inode/prefix proof, the parent is fsynced, and the same operation retries from zero. A final plus its exact two-link temporary completes verified cleanup. More than one owned candidate, any unknown hash-prefixed candidate, non-prefix bytes, unsafe inode/mode, operation mismatch, or final collision fails closed without removing unknown state. Tests interrupt at every operation/temp/publication/cleanup boundary and prove no authenticated matrix-receipt temporary remains stranded after successful retry. This matrix-receipt specialization replaces the generic partial-temporary rejection above only for its one operation-authenticated prefix; inflight and coordinate stores never adopt an unauthenticated partial.

Enforce repair null/disposition relations exactly: `setfarm-repair` pairs only with owner `setfarm`, non-null PR/merge, null external ref, `verification.kind:"repository-repair"`, and `repairMergeSha === finalReleaseEpoch.setfarmSha`; `mission-control-repair` is identical for owner `mission-control` and the Mission Control SHA; `external-resolution` pairs only with owner `external`, null PR/merge, one non-null B-canonical external ref, `verification.kind:"external-resolution"`, and an unchanged epoch; `clean-generated-retry` pairs only with owner `generated-product`, null PR/merge/external ref, `verification.kind:"generated-retry"`, classification `generated_product_failure`, and unchanged epoch. Reject mixed owners/members, empty or unsorted evidence, duplicate refs, stale epochs, and a generated or external record carrying caller verification hashes.

For the ordinary exported one-case executor, prove it accepts no admission/assertion/classifier/lifecycle/provisioning/authorization override or external lifecycle capability, requires exact clean Setfarm and Mission Control SHAs through the same harness release observer, reaches the profile-dispatched C adapter before B classification, automatically installs the authenticated C post-PR checkpoint only when the loaded campaign/case equals one exact `GoldenPostPrReviewApprovedIdentityV1` tuple, stores the byte-identical B result, and returns only its content hash/ref. The separate recovery factory is tested below and is the only capability-taking composition. Before `stage`, the caller invokes `prepareGoldenStageCoordinationV1({loaded,caseId,setfarmSha,missionControlSha})`, authenticates the exact loaded campaign, derives the code-owned repetition, next bounded `launchAttemptOrdinal`, and full epoch, seals a strict content-addressed record, and durably records its canonical pair in the caller's own operation state. The ordinal comes from a fixed authenticated per-subject coordination/result index and distinguishes a separately authorized retry in the same case/repetition/epoch. Lookup-or-create under that index returns the same unconsumed coordination for the same next B logical launch, so response loss before caller persistence does not skip an ordinal or mint another record; only an exact B classified/closed transition advances to the next ordinal. The allocator never accepts a caller ordinal, and an unconsumed record performs no context/intent/outbox/run action. The record hash covers every member except its derived ref/hash; the ref is exactly ``setfarm://internal-production/golden-stage-coordinations/sha256/${coordinationHash}``. Its fixed mode-`0700`/`0600`, bounded canonical, unpredictable-temp, fsync, atomic no-replace, parent-fsync, no-follow reopen protocol accepts no caller path/body/hash and performs no B context, intent, outbox, repository, or run side effect. `resolveGoldenStageCoordinationV1({coordinationRef,coordinationHash})` is the only reader and rehashes/freeze-validates the record in a fresh process.

`stage({loaded,caseId,setfarmSha,missionControlSha,coordinationRef,coordinationHash})` first resolves that exact pair and resolves its case against the authenticated loaded campaign; an unknown case fails as an argument before B preflight or any stage-operation write. It equality-checks campaign/case/repetition/full epoch, code-owned launch-attempt ordinal, and requested clean SHAs, and lookup-or-creates one immutable stage operation/index keyed only by `coordinationHash`. The operation also binds `externalLifecycleCheckpointCapabilityHash:null` for the ordinary factory or the recovery factory's one authenticated capability hash; a retry with the other mode/hash is a collision. It fsyncs the operation before calling B's exact `stageGoldenCaseLaunchV1(...)` and exhaustively consumes its imported `GoldenStageLaunchOutcomeV1`. A B `pre_run` member is persisted once through `GoldenRunResultStore`, sealed as the operation's `kind:"pre_run"` ref/hash outcome, and returned without an inflight status or any context/reservation/intent/start authority. A B `blocked` member is sealed as the operation's `kind:"blocked"` exact nested preflight outcome and returned without a result-store write. Only B `prepared` continues: the phase-store wrapper requires the next authenticated launch transition for this case/repetition/epoch to equal the coordination ordinal before context/intent publication; for existing-repository strategy the B preparation's `attemptOrdinal` must equal it, while V3 requires exactly that many closed-or-current logical intents and a fresh preparation only at the next ordinal. The B call creates/reopens one recovery context, reserves capacity once, and does not return that prepared member until its context pair, reservation, intent, execution binding, authorization, strategy-matching admission-or-attempt, launch-operation outbox, and `starterInvocationIssued` authority are all fsynced, authenticated, and reopened while no starter/run side effect has occurred. C then seals the equality-bound `starter-operation-issued` `GoldenMatrixInflightStatusV1`, including the same `coordinationHash`, exact recovery-context pair, and null-or-exact external capability hash, seals the strict frozen `GoldenAssertionEnabledStagedCaseV1` with those same members, and atomically publishes `kind:"staged"` plus that staged value before responding. An existing operation reopens its one discriminated outcome; an issued prepared operation without an outcome reopens B's same authenticated context/prepared/reservation chain and may never prepare another logical launch, while a pre-run/blocked operation may never enter prepared recovery or allocate launch authority. A coordination record cannot bind another campaign, case, repetition, launch-attempt ordinal, epoch, result, preflight, context, reservation, intent, capability hash, outbox, or staged value. More than one candidate or any mismatch is ambiguity, never a retry allocation. The staged value contains exactly its schema, campaign/case/repetition/full epoch, `coordinationHash`, canonical recovery-context pair, null-or-exact external capability hash, and canonical `inflightRef/inflightHash`; no prepared/context capability body, operation, raw ports, private path, selector, task, run ID, lifecycle port, or mutable capability escapes.

`executeStaged({staged})` and `recoverStaged({staged})` accept no additional identity and can be reached only from `kind:"staged"`: they strictly parse/freeze the staged object, resolve its pair as the same status (`inflightRef === statusRef`, `inflightHash === statusHash`), require staged/status coordination, recovery-context pair, and external-capability-hash equality, authenticate the exact coordination, and ask B's phase store to reopen/remint exactly one `GoldenPreparedLaunchStateV1` with the same context/reservation/intent/envelope/issued chain. C constructs the exact narrow `GoldenPreparedExecutionPorts`; it has no baseline/history/capacity/preflight or `prepareLaunch`, while its provision/admission/authorization members can finish only missing transitions for that authenticated context-bound persisted intent. Ordinary C construction passes no `loaded` and lets B reopen the stored context. `executeStaged` calls only `executePreparedGoldenCaseV1({prepared,ports})`. `recoverStaged` follows the bounded immutable status-coordinate chain and calls only `recoverPreparedGoldenCaseV1({prepared,ports})`; it either finishes the same context-derived pre-issue chain, resolves/resumes/adopts that exact issued operation, collects its exact run, or reopens the stored started-run result. Both exhaustively parse `GoldenPreparedExecutionOutcomeV1`, require the staged path to yield outer `kind:"run"`, store `outcome.result` byte-identically, and return only `{resultHash,resultRef}`. A pre-run or blocked stage outcome cannot be supplied as a staged object, and an impossible prepared `pre_run` outcome fails the staged-state relation rather than being relabeled. Neither method may invoke `executeGoldenCaseV1`, reload/fabricate campaign/case/task/prior-result context, rerun fresh preflight/capacity, reserve a second slot, or mint a second context, intent, attempt identity, admission identity, authorization scope, outbox, operation, or run. Full eligible fleet capacity does not block these already reserved continuations. For either existing-repository case, B must first fsync its context/attempt-bearing intent, then call the fixed C attempt port exactly once, persist the returned receipt, call the repair-CAS pre-start callback with the context-bound projection, and only then stage the launch operation; every separately authorized retry/new epoch has a distinct coordination, context, provision receipt, and remote.

Test response loss and process death before and after coordination-operation persistence, coordination temp write/fsync/publication/reopen, caller operation-state persistence, stage-operation issue, B recovery-context temp/fsync/publication/intent binding, pre-run result persistence, capacity-reservation/intent/outbox durability, inflight/staged sealing, stage-index publication, and response. Every retry must resolve the same coordination record and return the same discriminated outcome: identical stored pre-run pair with zero launch authorities, identical outer blocked nested preflight with zero result/launch authorities, or identical staged value/context/reservation/intent/authorization/admission-or-attempt/provision receipt/outbox/eventual run. Kill/restart with no caller `loaded` object in every prepared window and prove B reopens the byte-identical campaign/case/task/prompt/admission/release/ordinal/prior-result context; corrupt/missing/swapped context blocks without reconstructing it. Counters prove no second result, context, reservation, intent, or outbox at every boundary. Reusing a pair with a different case/epoch/repetition/capability hash, passing a structural clone of the loaded campaign or external capability, losing caller durability before `stage`, or racing two calls with one pair fails closed or converges on that one outcome. Two distinct coordination records for a fleet campaign may fresh-stage concurrently only when B's authenticated run-only capacity projection permits two same-campaign/same-epoch owners; at count two, both exact prepared continuations still execute/recover without another capacity check, while a third fresh stage and every unrelated/prior-epoch/unattributed owner fail before mutation. Pre-run results do not unlock capacity. Standard and matrix campaigns require total zero before fresh stage and remain serial; settlement/finalization requires total zero for all campaigns.

`collect` remains byte-for-byte the established public input signature but calls B with the exact `GoldenCollectionPorts`, not a harness-shaped omission. It cannot start a replacement: C constructs only the nested read resolvers and mutation actions named by that type, and type/source tests reject admission, starter, lifecycle, attempt-provisioning, pre-start-authorization, and every unused member at the boundary. It may only resolve and validate previously stored attempt/integration/post-review receipts; if no durable action exists, an approved bug-review case freezes only with `GOLDEN_MATRIX_POST_PR_REVIEW_ACTION_REQUIRED` and posts nothing. A missing/no-op post-PR action port for approved stage must fail before launch staging with that exact blocker.

- [ ] **Step 2: Run the test and observe RED**

Run: `node --import tsx --test tests/internal-production/golden-matrix-runner.test.ts`

Expected: FAIL because the matrix runner is absent.

- [ ] **Step 3: Implement the smallest state coordinator**

Persist ordinary strict `GoldenPreRunResultV1 | GoldenStartedRunResultV1` objects through `GoldenRunResultStore.put()` and keep deterministically ordered atomically visible raw result hashes plus `GoldenMatrixCommittedTimeoutReconciliationV1` projections in the matrix receipt. Each projection copies only an authenticated B authority's `authorityHash`, `pairRef`, `pairHash`, `supersessionHash`, `originalTimeoutResultHash`, and `terminalResultHash`; it contains no bare supersession body or caller-created selection. A timeout terminal replacement never uses generic `put()`: only `putTimeoutReconciliationPair()` plus its final committed-pair locator may make the pair visible. After every read/write operation, list the immutable visible raw results and `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`, authenticate the authorities, then invoke B's `deriveEffectiveGoldenRunResultsV1(...)`; never locally choose a replacement, subject, reconciliation disposition, epoch partition, or trust a structural pair. Re-read platform ownership and both release SHAs before every start; create the exact B final-release epoch and mark every mismatched previously accepted run slot unsatisfied without deleting history. Parse exactly one `GoldenMatrixOperationV1`; status/preflight perform no operational mutation and may only seal their returned content-addressed matrix receipt, execute-next is the only start path, collect requires exact case/run identity and returns only a started-run result, and reconcile-timeouts is the only timeout-reconciliation mutation path. Execute-next refuses any `reconciliation_required` run timeout. Reconcile-timeouts sorts only those started-run originals by case/repetition/run number/result hash, calls B's reconciler one at a time with the exact reduced port object, commits its terminal result and supersession through the one compound store call, and stops on a still-active/typed failure without starting or replaying anything. A pre-run result remains visible in ordered raw history and blockers but is absent from run slot/capacity/terminal/acceptance calculations. Before returning any operation, construct the strict receipt, compute its `matrixReceiptHash`, derive its exact `matrixReceiptRef`, seal/reopen it through the fixed content-addressed store, and return only that authenticated object.

C passes the complete immutable raw result and timeout-supersession history to B's evaluator/finalizer without filtering the projection by the selected epoch. It uses only B's `currentEpochEffectiveResults` for matrix slot/accepted/classification counts, but acceptance/finalization remains blocked unless B proves exact cleanup for every selected effective started-run result in both `currentEpochEffectiveResults` and `historicalEffectiveResults`. C and E may display the two partitions but cannot reimplement, omit, or weaken this all-history cleanup projection. Tests keep ten accepted current-epoch slots fixed while injecting one historical leak, unavailable cleanup field, dirty worktree, or unreconciled timeout and prove the matrix/finalization cannot become accepted; repairing only that historical authority changes the B settlement hash and permits the unchanged current-epoch aggregates to settle.

`createGoldenMatrixPortsV1()` is the sole production factory: it imports B's exact `GoldenRunRepositoryOptionsV1`, `GoldenPreflightPorts`, `GoldenCollectionPorts`, and `GoldenPreparedExecutionPorts`, constructs a value of the repository options type with `workflowEvidence:createGoldenRepositoryWorkflowEvidenceCollectorV1()`, and passes that value unchanged to the B PostgreSQL repository factory; it defines no local or inline lookalike. It creates one C profile dispatcher, creates the fixed C existing-repository attempt port, and wraps its private repair-consumption callback only through B's `createGoldenRepairCasPreStartAuthorizationPortV1(...)`. It uses `resultStore` as B `history`, installs the one supplied clock, and accepts neither an unavailable assertion port nor caller history/clock/workflow-evidence/lifecycle/provisioning/pre-start override. At each B boundary C constructs a fresh exact object literal: preflight receives only the read-only repository inspection, release, health, history, and phase-ownership readers in `GoldenPreflightPorts`; collection receives only `GoldenCollectionPorts.read` resolvers and `GoldenCollectionPorts.actions` mutations; ordinary prepared continuation receives only exact same-intent missing-transition, starter/operation lookup, nested collection, and the code-owned post-review lifecycle member in `GoldenPreparedExecutionPorts`, with `externalLifecycleCheckpointCapability` absent. It never spreads the full harness or retains a mutation solely to assert zero calls. Source/type tests prove the recovery context/prepared object is authenticated, continuation ports expose no A/history/preflight/capacity/active-slot/`prepareLaunch` operation, their provision/admission/authorization calls reject another context/intent, and `executeStaged`/`recoverStaged` call the respective B prepared symbol rather than `executeGoldenCaseV1`. C's remaining type-identity tests reject excess properties and prove these imports; B's source-boundary test permits later D/E consumption without requiring either to exist during B/C implementation.

The production root imports `GoldenLaunchOperationMigrationCurrentVerificationV1` and `verifyCurrentGoldenLaunchOperationMigrationV1` exactly and unaliased from `./golden-launch-operation-migration-release-v1.js`; the verifier is not a port, injectable dependency, callback, cached startup value, or shell-only precondition. Before the first coordination, stage, launch-intent/inflight, result, matrix-receipt, repair-observation/acknowledgement, timeout-reconciliation, or finalization-pointer store call on **every** public operation branch, the owning function directly awaits that zero-input verifier. This applies independently to `prepareGoldenStageCoordinationV1`, all four executor methods, `runGoldenMatrix`'s five operation variants, `recoverGoldenMatrixInflightV1`, both repair/review recorders, `recordGoldenMatrixFinalizationPointerV1`, `record-finalization`, and every response-loss/recovery re-entry. The returned `currentSourceSha` must equal the requested `releaseSha` and `finalReleaseEpoch.setfarmSha`; its terminal receipt pair, application SHA, dedicated module blob, ordered statements, named digest entry, digest, and schema projection must equal B's immutable terminal authority. The strict `GoldenMatrixMigrationVerificationBindingV1` copies those fields plus `verificationHash` into every coordination, staged value, inflight status, matrix receipt, and finalization pointer, and every resolver freshly reruns B's verifier and equality-checks that binding before returning an authority usable for another write. A later clean descendant is valid only when it is the release/final-epoch SHA and the named migration projection is byte-identical; a nonancestor, stale release, changed named entry/module/statements/schema, structural verification, or previous-process object fails before mutation.

Task 7 imports A's exact row/manifest schema, durable manifest-set activation/resolver ABI, reservation APIs, category/census schema, and canonical hash helper, plus B's exact manifest constant. It exports these literal C-owned values; prose, generated data, category-only rows, and partial rows are not registry authority:

```typescript
export const INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_C_V1 = [
  { plan: "C", module: "src/internal-production/golden-matrix-runner.ts", function: "reserveGoldenStagedCaseOwnerV1", implementationId: "c-staged-case-v1", category: "staged-case", ownerKeyDerivationId: "golden-stage-coordination-case-repetition-v1", censusKeys: ["stagedCaseCount"] },
  { plan: "C", module: "src/internal-production/golden-matrix-inflight-status-v1.ts", function: "reserveGoldenMatrixInflightOwnerV1", implementationId: "c-matrix-inflight-v1", category: "matrix-inflight", ownerKeyDerivationId: "golden-matrix-inflight-key-v1", censusKeys: ["matrixInflightCount"] },
  { plan: "C", module: "src/internal-production/existing-repository-fixture-catalog.ts", function: "reserveGoldenExistingRepositoryFixtureAttemptOwnerV1", implementationId: "c-fixture-attempt-v1", category: "fixture-attempt", ownerKeyDerivationId: "golden-existing-repository-attempt-key-v1", censusKeys: ["fixtureAttemptCount"] },
  { plan: "C", module: "src/internal-production/golden-repair-review-receipt-v1.ts", function: "reserveGoldenRepairReviewPublicationOwnerV1", implementationId: "c-repair-review-publication-v1", category: "artifact-publication", ownerKeyDerivationId: "golden-repair-review-scope-publication-v1", censusKeys: ["publicationBatchCount", "artifactPublicationCount"] },
  { plan: "C", module: "src/internal-production/golden-matrix-runner.ts", function: "reserveGoldenMatrixReceiptPublicationOwnerV1", implementationId: "c-matrix-receipt-publication-v1", category: "artifact-publication", ownerKeyDerivationId: "golden-matrix-receipt-campaign-epoch-v1", censusKeys: ["publicationBatchCount", "artifactPublicationCount"] },
  { plan: "C", module: "src/internal-production/golden-matrix-finalization-pointer-v1.ts", function: "reserveGoldenMatrixFinalizationDeliveryOwnerV1", implementationId: "c-matrix-finalization-delivery-v1", category: "operational-delivery", ownerKeyDerivationId: "golden-matrix-finalization-pointer-v1", censusKeys: ["operationalDeliveryCount"] },
] as const satisfies readonly InternalProductionOwnerProducerRowV1[];

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_C_V1 = {
  schema: "setfarm.internal-production-owner-producer-manifest.v1",
  plan: "C",
  rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_C_V1,
  manifestHash: hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan: "C",
    rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_C_V1,
  }),
} as const satisfies InternalProductionOwnerProducerManifestV1;
```

The literal C manifest module is import-inert: it performs no `void` activation, constructor-time registration, mutable global insertion, or import-order-dependent trust. `golden-product-matrix-owner-producer-manifest-activation-controller-v1.ts` is C's sole executable A+B21-to-A+B+C27 wrapper. Its zero-input mutator code-owns exactly the A, B, and C literal manifests, phase `A+B+C`, and C's freshly resolved clean source/build authority; no caller supplies plan/manifest/row, predecessor, receipt/head pair, root/path, source/build body, environment, or test port. It first publishes/reopens one fixed-private content-addressed operation binding that authority and the freshly re-hashed current A+B `{head,receipt}` quartet. The controller requires phase `A+B`, ordered plans `["A","B"]`, exactly 21 rows, A/B manifest/source-build hashes, and head-to-receipt equality before it calls `activateInternalProductionOwnerProducerManifestSetV1({expectedPredecessor:{activationRef:receipt.activationRef,activationHash:receipt.activationHash,headRef:head.headRef,headHash:head.headHash},manifests:[INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_B_V1,INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_C_V1]})`. It freshly resolves the returned activation pair and zero-input current tuple, requires the re-hashed head to name that receipt and phase `A+B+C`, ordered plans `["A","B","C"]`, exactly 27 rows across A's 11, B's 10, and C's 6, all three manifest/source-build hashes, A's registry/map hashes, and the exact predecessor activation-and-head quartet, then content-addresses the strict path-free wrapper receipt and updates its fixed status locator last. `GoldenProductMatrixOwnerProducerManifestActivationReceiptV1` binds the predecessor activation/head quartet, successor activation/head quartet, all three manifest hashes, and C source/build authority, omitting only its own receipt ref/hash; the active status repeats those pairs and is read-only. Crash recovery reopens only the fixed operation/receipt/status locators: before generic activation it resumes the exact operation, after generic activation it adopts only the exact A+B+C successor, and after wrapper publication it completes only the matching status locator. A stale, head/receipt-mixed, missing/changed source/build, wrong 27-row, forked, duplicate, or future-plan result is `blocked` and never invokes another activation. C neither trusts import order nor scans or activates future plans.

`golden-product-matrix-owner-producer-manifest-activation-controller-v1.test.ts` parses the C File Map and package command table, requires the two exact zero-input `internal:golden-matrix` verbs, and proves both the C manifest and controller import with zero store/CLI effect. It tests strict receipt/status schemas, canonical hashes/refs, exact A+B predecessor and A+B+C successor rows/manifests/source-build pairs, all predecessor/successor quartet relations, no caller-shaped controller input, and a status read with zero mutations. It injects a crash before/after operation publication, generic activation, receipt publication, status-locator CAS, and response; races two controller calls; and restarts in a fresh process. Recovery may return only one byte-identical wrapper receipt/status after re-hashing both successor records. A changed predecessor/head, stale or foreign current tuple, changed C build, partial receipt, wrong/missing status locator, source import side effect, or response loss may not reach a C producer. Source/transcript tests put this controller immediately after C's reviewed clean merge/build and before every C coordination, stage, B intent/outbox, inflight, result, matrix receipt, repair/review, timeout, finalization, or owner byte.

C no longer claims that its fixture, repair, receipt, or finalization owner adopts a B/A producer's reservation; a delegated B write retains B's reservation, while a C-owned durable owner begins its own C row. Each begins before its first C byte, embeds the pair, and closes only against its terminal C/B authority; prepared continuation adopts only its same producer/key reservation. C tests AST-parse only C's literal six-row table, prove every object has exactly the seven `InternalProductionOwnerProducerRowV1` fields and its manifest hash is the canonical `{schema,plan,rows}` projection, resolve every listed module/function against C's own File Map, and allow repeated `artifact-publication` only across distinct implementation/module-function/owner-key tuples. They import no D/E file, assert no future source exists, perform no aggregate A–E scan, and reject a prose/generated/partial row, duplicate implementation/module-function/owner-key, wrong category/census mapping, nonliteral spread, computed key, cast, or activation side effect. Runtime tests race every C producer against B migration apply and A cutover and prove a pending reservation blocks both fences and a held fence yields zero C writes.

AST tests enumerate every exported production entry point and reject a write-capable path whose dominating first awaited production call is not the exact imported verifier. Runtime tests inject missing terminal authority, nonancestor source, release/current mismatch, and drift in each named projection field at every operation branch and assert coordination, stage, B intent/outbox, inflight, result, matrix receipt, repair/review, timeout, and finalization mutation counters all remain exactly zero. Response-loss tests restart in a fresh process and prove verification repeats before the first recovered write rather than trusting a stored binding. Success tests prove each sealed object carries one byte-identical binding and that no C factory can substitute a verifier or preverified value.

`createGoldenRecoveryAssertionEnabledCaseExecutorV1({ports,lifecycleCheckpointCapability})` is the only exported recovery-action composition and returns the existing exact `GoldenAssertionEnabledCaseExecutorV1`; C exports no second executor interface or alias. At factory creation and before every method it calls B's `authenticateGoldenExternalLifecycleCheckpointCapabilityV1()` and requires namespace exactly `recovery-active-run`, `epochHash === finalReleaseEpoch.epochHash`, and one of B's two finite code-owned checkpoint implementation IDs. Before `stage` it authenticates `loaded`, resolves `caseId` and the coordination, and requires its campaign hash, case ID, complete final-release epoch, and epoch hash to equal the capability before delegating or writing the stage operation. It binds the capability hash into the stage operation, inflight status, and staged value. For `executeStaged`/`recoverStaged`, it resolves those records plus B's recovery context, rechecks the same campaign/case/full epoch/capability hash and B-authenticated implementation/predicate identities, and supplies only `externalLifecycleCheckpointCapability` through the exact `GoldenPreparedExecutionPorts`; C never dereferences or accepts the hidden checkpoint. Its `collect` delegates without an action because collection cannot invoke lifecycle checkpoints. A structural clone, reminted capability for a different epoch, registry implementation/source digest, checkpoint predicate, campaign/case/namespace, preexisting ordinary stage operation with null hash, simultaneous fixed post-review checkpoint, raw `GoldenLifecycleCheckpointPort`, or direct `GoldenServiceRestartActionPortV1` fails before B starter/action. A valid cold-process remint for the same semantic implementation, predicate, and byte-identical epoch is accepted only after B authenticates its new object identity. The ordinary `createGoldenAssertionEnabledCaseExecutorV1()` and matrix factory always bind null external capability; Subproject E consumes only that ordinary factory. D passes its narrow action adapter to B's exact `createGoldenRegisteredExternalLifecycleCheckpointV1({implementationId,actions})`, asks B to wrap that branded result with the full current epoch, and passes only the opaque capability to this recovery factory; C imports no D source and its tests use a B-created registered checkpoint fixture.

For a selected case matching one exact `GoldenPostPrReviewApprovedIdentityV1` tuple, add the single B `lifecycleCheckpoint` returned by `createGoldenPostPrReviewLifecycleCheckpointV1({ actions: ports.postPrReviewActions })` with null external capability; for every other case omit both checkpoint members. The matrix has `maximumConcurrency:1`, requires total active ownership zero before its fresh stage, and its scheduler never has more than one execute-next operation. Before calling the closed executor, that operation calls `prepareGoldenStageCoordinationV1(...)`, persists and reopens the exact coordination pair in its immutable operation receipt, then calls ordinary `stage(...)` with the pair and durably records the returned discriminated outcome with external capability hash null. Only `kind:"staged"` invokes `executeStaged({staged})`; a retry before outcome persistence resolves the pair and calls `stage` again, while retry after staged persistence invokes `recoverStaged({staged})`, which reopens the one prepared recovery context/reservation and does not rerun preflight/capacity. A `kind:"pre_run"` outcome reopens its stored result pair, recomputes B's effective projection/settlement, records no inflight status, freezes with the configuration blocker, and never calls `executeStaged`; a `kind:"blocked"` outcome records its exact nested preflight blocker set without a result or inflight identity and likewise never executes. No response-loss window relies on an in-memory stage outcome. The generic one-case gateway does not clamp B's campaign capacity or accept a caller concurrency override: standard and matrix campaigns remain at one/total-zero, while the exact fleet threshold campaign can hold two distinct same-campaign/same-epoch coordination reservations only after B's run-only `deriveGoldenCampaignExecutionCapacityV1(...)` returns `eligibleMaximum:2` and unrelated/prior-epoch/unattributed ownership is zero; B rejects a third fresh launch. Already prepared continuations remain valid at count two. Only the staged path makes B persist the recovery context, capacity reservation, launch intent, fresh attempt when applicable, exact retry authorization, and starter operation before the run side effect, then assembles `GoldenAssertionSubjectV1`, lets C prove the one actionable review during the open generation, and evaluates the exact accepted source plus settled durable integration/post-review authority before classification.

Wrap only the production `GoldenCollectionPhaseStore` inside `createGoldenMatrixPortsV1()` with a C-owned durable continuation; do not change or redeclare B's port. After delegated `prepareLaunch()` returns an authenticated recovery-context-bound persisted intent, seal `launch-intent-persisted` with its exact context ref/hash and null-or-exact external capability hash before returning control to B, so provisioning/admission cannot follow an uncheckpointed context/intent. After delegated `recordStarterInvocationIssued()` returns, seal `starter-operation-issued` with the same members before returning, so the compiled starter cannot run without a recoverable operation-bound status. After delegated `promoteLaunchToRunBound()` returns, seal `run-bound` from the exact imported context-bound start receipt before polling. After B's result store put is durable, seal `result-stored` and then include that exact status identity in the matrix receipt. On reopen, the decorator first resolves the predecessor, B context, and launch chain and emits the missing identical status before allowing the next transition. A crash between B durability and the C callback therefore permits only checkpoint reconciliation, never context reconstruction or the next external side effect.

`recoverGoldenMatrixInflightV1({statusRef,statusHash,ports})` first resolves/authenticates the strict ordinary-matrix status and its exact stage coordination, requires `externalLifecycleCheckpointCapabilityHash:null`, then loads the one fixed source matrix/campaign and requires their hashes and clean current epoch to equal it. It calls B's `readPreparedLaunches()` using only status-bound campaign/case/repetition/epoch/historical authority, requires exactly one authenticated `GoldenPreparedLaunchStateV1` whose recovery-context pair, reservation, persisted envelope, intent, and issued operation equal the status chain, and installs a recovery-only phase wrapper that rejects another context, reservation, intent, capability, or operation. It resolves B's exact recovery context and equality-checks the freshly loaded campaign when available; it never uses the fresh load to fill or alter persisted task/prompt/admission/prior-result bytes. For `launch-intent-persisted | starter-operation-issued`, call only `recoverPreparedGoldenCaseV1({prepared,loaded,ports:preparedExecutionPorts})`; never call `executeGoldenCaseV1`, preflight, capacity derivation, or `prepareLaunch`. B may resolve/resume only the identical authenticated context/outbox or adopt its exact operation row. For `run-bound`, invoke `collectGoldenCaseV1(...)` with the internally resolved status run ID and a freshly constructed exact `GoldenCollectionPorts`; no shell value selects it. For `result-stored`, reopen the exact result and perform no B execute/collect call. Recompute/store the resulting matrix receipt and its newest status before returning. Zero/multiple prepared states, contexts, or rows; context/reservation/capacity identity drift; a non-null external capability on the ordinary matrix path; live release drift; predecessor/key/state/coordination drift; any fresh-slot call; or any second attempt/admission/outbox/start fails closed. Recovery remains valid when other authenticated same-campaign fleet reservations fill current capacity because it consumes no new slot.

For an existing-repository `kind:"run"` result, require B's stored started-run branch to carry the complete path-free `GoldenExistingRepositoryFixtureAttemptV1` identity or its exact equality-bound projection: template/provision/fixture/intent/attempt-key hashes, attempt ordinal, repository/ref/remote identity, and final epoch. The workflow evidence hash must resolve to C's integration authority for that same attempt. A run result with only a template/fixture hash, an unbound repository URL, a prior attempt, or a prior epoch is schema-invalid and cannot enter matrix history. A `kind:"pre_run"` result has no fixture attempt or workflow evidence and enters only the separate immutable policy-history partition.

Before a repaired retry start, the coordinator only verifies that an unconsumed receipt exists for the frozen slot; it does not prepare, mint, reconstruct, or persist an intent. B execute owns intent preparation and invokes the authenticated repair-CAS callback only after its exact intent is durable; the callback atomically `consume()`s the receipt against that hash, and a consumed receipt can authorize only recovery of that same unresolved intent. Use `collectGoldenCaseV1(...)` only for interruption recovery with the exact `GoldenCollectionPorts`; resolve already persisted C attempt/integration/action receipts read-only, expose only the required mutation actions, and stop on every non-accepted result.

Implement `createGoldenAssertionEnabledCaseExecutorV1()` and `createGoldenRecoveryAssertionEnabledCaseExecutorV1()` in this same module as the two closed C-owned compositions over the one existing `GoldenAssertionEnabledCaseExecutorV1`. The ordinary gateway is consumed by the matrix and Subproject E, accepts no external capability, and always seals its null hash. The recovery factory accepts only B's opaque capability, authenticates/matches it as specified above, and seals its exact hash; neither accepts a raw checkpoint port. `stage` requires the exact coordination pair, resolves/authenticates it, and lookup-or-creates one immutable `GoldenAssertionEnabledStageOutcomeV1`: `pre_run` stores and returns B's exact outer pre-run result pair, `blocked` returns B's exact nested preflight without a store write, and only `staged` seals the issued inflight status plus exact context/capability-bound `GoldenAssertionEnabledStagedCaseV1`. `executeStaged` and `recoverStaged` take only `{staged}`, resolve/authenticate that content-addressed boundary, coordination, recovery context, and capability relation, remint the exact B prepared capability, call respectively `executePreparedGoldenCaseV1` and `recoverPreparedGoldenCaseV1` with `GoldenPreparedExecutionPorts`, store only the unchanged B outer `run.result`, and return only `{resultHash,resultRef}`. Neither may call `executeGoldenCaseV1`, reload/fabricate context, or rerun a fresh-slot check. `collect` retains its established public input and passes only the exact B `GoldenCollectionPorts`, returning a started-run pair without lifecycle action. The gateway exposes no ports, assertion input, task, context body, run row, private path, raw checkpoint, cleanup row, or classification constructor. The matrix and E must consume the ordinary exports from `golden-matrix-runner.ts`; D consumes only the exact recovery factory with a B-created capability. No downstream consumer modifies or re-declares the gateway, and each exhaustively handles every stage outcome before calling a staged method.

Store repair receipts content-addressed below the B resolver's fixed `golden-results/repair-reviews/sha256` child with `0700`/`0600`, no-follow, canonical hash, a scope-hash index, and an append-only consumption CAS indexed by receipt hash. Store each `GoldenVerificationAuthorityReceiptV1` in a fixed `golden-results/verification-authorities/sha256` child; the repair writer resolves and rehashes all referenced authorities and enforces kind/source/owner/command/evidence identity rather than trusting a string. `GoldenRepairReviewReceiptResolverV1` is the only scheduler-facing reader; `GoldenRepairReviewConsumptionPortV1` is the only writer after receipt creation.

`golden-repair-review-cli.ts` exact forms are:

```text
observe-repair --matrix FILE|--campaign FILE --case CASE --failed-result-hash HASH --owning-repository setfarm|mission-control --pull-request HTTPS_GITHUB_PR --merge-sha SHA --json
record --matrix FILE|--campaign FILE --case CASE --failed-result-hash HASH --owning-repository setfarm|mission-control --pull-request HTTPS_GITHUB_PR --merge-sha SHA --independent-review HASH --focused-verification HASH --broad-verification HASH --clean-build HASH --json
record-external --matrix FILE|--campaign FILE --case CASE --failed-result-hash HASH --external-resolution-evidence REF --json
record-generated --matrix FILE|--campaign FILE --case CASE --failed-result-hash HASH --json
```

Exactly one scope flag is required. `observe-repair` derives the same scope/case/result identity, writes four authority receipts plus `GoldenRepairVerificationAuthorityBundleV1`, and returns only their hashes and bundle hash. Its Setfarm focused set is the fixed internal-production suite plus every changed subsystem's package-owned focused suite enumerated from the merged PR diff; its Mission Control focused set is the fixed operational-projection/render/route suite plus every changed subsystem's package-owned focused suite. Unknown changed subsystem mapping fails closed instead of silently omitting a check. Both owners then run the fixed full test and clean build, with unchanged clean SHA before and after. Repository-owned `record` requires the four hashes from that exact bundle and forbids external refs. `record-external` accepts only one B-canonical evidence ref and invokes the authenticated external observer, which produces and stores every hash before the repair writer consumes its exact in-memory result. `record-generated` accepts no evidence/hash flag and invokes the generated eligibility observer in the same process. The CLI resolves the failed result from B store, derives the trusted root hash, reads exact merged PR/base/head state via `gh` for repository-owned repairs, validates every authority receipt/bundle/observation, and writes the typed record. Provider/quota/infrastructure retry requires the observer-authenticated external reviewed receipt. Every profile test asserts the dispatcher reached its expected adapter once before classification; no path constructs an unavailable B adapter.

The JSON success output for `record-external` and `record-generated` contains the strict repair receipt plus only `acknowledgementRef` and `acknowledgementHash` returned by `locateForRepairReceipt`; `observe-repair`/repository `record` carry no acknowledgement pair. A crash after repair-receipt seal but before acknowledgement/index/response is resumed from those exact durable authorities and returns the same pair. No CLI accepts an acknowledgement ref/hash, observation/eligibility hash, or acknowledgement body from the caller.

`golden-run-cli.ts matrix` exposes the established `preflight`, `execute-next`, `collect`, and `status` forms plus this exact explicit timeout form; it accepts no run ID, result hash, supersession hash, lifecycle, or mutation-port override because the runner discovers sorted outstanding timeout originals from B's store:

```text
reconcile-timeouts --matrix FILE --release-sha SHA --mission-control-sha SHA --json
```

It also exposes exactly one fresh-shell launch-recovery form. This form constructs `createGoldenMatrixPortsV1()` internally and accepts only the two path-free content addresses; case, repetition, intent, operation, run, matrix path, release, and port values come only from the resolved status and fixed owners:

```text
recover-inflight --status-ref REF --status-hash HASH --json
```

It also adds exactly these private-finalization operations outside `runGoldenMatrix`'s execution/reconciliation union:

```text
record-finalization --matrix FILE --finalization-hash HASH --json
finalization-status --matrix FILE --json
```

`record-finalization` parses the sole hash and calls B's exact `resolveGoldenFinalizedCampaignReportV1(finalizationHash)`, which strict-parses persisted timeout identity snapshots, freshly lists/locates/resolves every same-position full authority, authenticates only those fresh nominal objects, and returns the reminted `GoldenFinalizedCampaignReportV1`; C never authenticates a JSON-parsed snapshot. It then loads the named strict matrix, constructs the fixed production ports, and makes exactly one internal `runGoldenMatrix({loaded,releaseSha:finalization.finalReleaseEpoch.setfarmSha,missionControlSha:finalization.finalReleaseEpoch.missionControlSha,operation:{kind:"status"},ports})` call. Require that returned status to be `decision:"accepted"` with only a `result-stored` inflight status, then immediately call `resolveGoldenMatrixReceiptV1({matrixReceiptRef:status.matrixReceiptRef,matrixReceiptHash:status.matrixReceiptHash})` and require byte identity. This returned pair is the sole accepted-matrix authority: the command does not read a matrix-hash index, scan the receipt directory, reconstruct a receipt from results, accept a pair from argv, or reuse a previously cached status. Reload raw results and list B's ordered committed timeout-pair authorities, authenticate each exact nominal object, locate and resolve each through its exact campaign/supersession key, and require `finalization.timeoutReconciliationAuthorities` to be the byte-identical sorted `readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[]` including schema, campaign, pair ref/hash, result/supersession/committed-index hashes, and authority hash. Reject any six-field summary, structural reconstruction, dropped index binding, extra authority, or order/identity mismatch before recomputing B's exact effective projection and calling `recordGoldenMatrixFinalizationPointerV1`; it accepts no epoch, source SHA, build authority, report path/body/hash, root, output, receipt pair, replacement selection, bare supersession, or override. The pointer copies and equality-binds that exact status's inflight identity and matrix receipt ref/hash pair. The pointer module writes canonical bytes content-addressed below B's fixed `golden-results/matrix-finalizations/sha256` child with real mode-`0700` ancestors, mode-`0600`, `O_NOFOLLOW`, exclusive collision checks, fsync, and one atomic matrix-hash index. `finalization-status` takes only the matrix, reopens that index/pointer, resolves the matrix receipt by the pointer's exact ref/hash, calls the same B finalization resolver, reopens raw results and every freshly reminted committed-pair authority/pair/index/terminal/supersession member in a fresh process, invokes B's derivation, recomputes every hash and same-epoch/effective relation, and returns the recursively frozen strict pointer. Neither command starts a run, performs a build, writes tracked content, or constructs an admission/starter/assertion/repair mutation path.

- [ ] **Step 4: Add the package command**

```json
{
  "internal:golden-matrix": "node --import tsx src/internal-production/golden-run-cli.ts matrix",
  "internal:golden-repair-review": "node --import tsx src/internal-production/golden-repair-review-cli.ts"
}
```

The `internal:golden-matrix` command table additionally routes exactly these C controller forms, both with no option other than `--json`:

```text
activate-owner-producer-manifest --json
owner-producer-manifest-status --json
```

The first delegates only to `activateGoldenProductMatrixOwnerProducerManifestV1()` and returns its strict wrapper receipt; the second delegates only to `observeGoldenProductMatrixOwnerProducerManifestActivationStatusV1()` and returns its strict status. Unknown argv, a plan/manifest/predecessor/pair/root/path/source/build override, or a second command after `--json` fails before any controller read or mutation.

- [ ] **Step 5: Run focused tests and observe GREEN**

```bash
node --import tsx --test \
  tests/internal-production/golden-stage-coordination-v1.test.ts \
  tests/internal-production/golden-matrix-runner.test.ts \
  tests/internal-production/golden-run-cli.test.ts \
  tests/internal-production/golden-repair-review-receipt-v1.test.ts \
  tests/internal-production/golden-repair-review-observer-v1.test.ts \
  tests/internal-production/golden-nonaccepted-result-review-acknowledgement-v1.test.ts \
  tests/internal-production/golden-repair-review-cli.test.ts \
  tests/internal-production/golden-retry-verification-observers-v1.test.ts \
  tests/internal-production/golden-matrix-inflight-status-v1.test.ts \
  tests/internal-production/golden-matrix-finalization-pointer-v1.test.ts
```

Expected: PASS with matrix/standard maximum observed start concurrency one, the fleet gateway reaching two only after B's authenticated threshold projection, and no path ever reaching three.

- [ ] **Step 6: Submit the scoped story to Setfarm's completion owner**

Use only the immutable claim's completion command and output after GREEN. The completion owner binds the runner, CLI, attempt provisioner, repair receipt/resolver/observers, programmatic repair observer, nonaccepted-review acknowledgement store/resolver, finalization-pointer schema/store/resolver, tests, and package command to one managed handoff and alone commits/pushes the story branch.

### Task 8: Verify and Deliver the Matrix Implementation

**Files:**
- Modify only a module whose failing regression proves a systemic defect.

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: reviewed clean-main Setfarm code capable of executing the matrix, followed only after its merge/build and before any C producer by C's durable path-free `A+B+C` controller wrapper receipt/status binding the A+B predecessor and A+B+C successor activation/head pairs.

- [ ] **Step 1: Run focused internal-production tests**

Run: `npm run test:internal-production`

Expected: all assertion, fixture, catalog, and coordinator tests pass with zero skipped tests. Include source/transcript regressions for every mutating Task 0/6/9 shell block: remove or fail each cleanliness, branch, SHA, root, temporary-mode, status-ref/hash, report, epoch, or finalization guard in turn and prove the block exits before its first workflow/CLI mutation or redirect publication. A later mutation command must never run after any failed guard, including failure on the left side of a pipeline.

- [ ] **Step 2: Run adjacent suites**

```bash
set -euo pipefail
npm run test:evals
npm run test:evidence
npm run test:execution-attempts
npm run test:product-compiler
npm run test:steps
```

Expected: every command exits 0.

- [ ] **Step 3: Run static and broad checks**

```bash
set -euo pipefail
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
npm run check:migration-digests
npm run check:mission-control-contracts
npm test
git diff --check
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
```

Expected: every command exits `0` and the final full porcelain, including untracked files, is empty. A Task 8 source/transcript regression requires literal `set -euo pipefail` as the first nonblank command of each multi-command Bash fence, fails each command and substitution in turn, and proves no later check or final evidence publication runs. It injects both tracked and untracked dirt before the final status assertion and proves each blocks final evidence and handoff; `git diff --check` success alone never establishes cleanliness.

- [ ] **Step 4: Request independent review**

Use `requesting-code-review` on the Subproject C diff. Resolve each actionable Critical, High, and Medium finding by first adding a regression that fails for the finding.

- [ ] **Step 5: Submit verified adjustments through the active Setfarm claim**

If review required a source change, submit its exact claim output only after the new regression and all affected gates pass. Setfarm's completion owner alone creates the follow-up commit/push and updates the canonical handoff receipt. Agents never stage or commit the review fix directly.

- [ ] **Step 6: Let Setfarm deliver the reviewed PR, then verify clean main**

Allow the canonical feature-development run to finish its review/supervision/PR continuation. Setfarm alone commits, pushes, opens/updates the PR, applies its reviewed merge policy, and records the PR/merge receipts. Agents may inspect GitHub state read-only and respond through claimed Setfarm steps, but may not invoke Git mutation or PR creation/merge commands. After the run is terminal and the handoff receipt proves the reviewed merge, request Setfarm's code-owned canonical-main synchronization operation; no worker runs `git fetch`, `git pull`, branch switching, reset, or integration. Require its receipt to prove the canonical source is clean with `HEAD === refs/remotes/origin/main === reviewed merge SHA`, then run `npm ci` and `npm run build` from that Setfarm-owner-synchronized clean `main`.

- [ ] **Step 7: Durably activate the exact A+B+C producer-manifest phase**

Only after Step 6 proves C's reviewed merge/source and clean build exist, run C's zero-input A+B21-to-A+B+C27 controller—not the generic store directly. This gate is first after the reviewed merge's clean build and before every C coordination, stage, B intent/outbox, inflight, result, matrix receipt, repair/review, timeout, finalization, or owner producer. The controller accepts only its code-owned A/B/C literal manifests, current clean source/build authority, and freshly re-hashed A+B predecessor tuple; it returns a strict C wrapper receipt and read-only status proves the same predecessor activation/head quartet and successor activation/head quartet. Response-loss replay may adopt only the same content-addressed wrapper receipt. A stale/forked or receipt/head-mixed current tuple, missing C source/function, changed row/projection/source/build hash, wrong cardinality, reorder, downgrade, skipped phase, import-side-effect registration, or D/E/future-source scan fails closed with zero C owner or matrix mutation.

```bash
set -euo pipefail
cd /Users/setrox/ai/setrox/setfarm
C_MANIFEST_ACTIVATION_JSON="$(npm run --silent internal:golden-matrix -- \
  activate-owner-producer-manifest --json)"
C_MANIFEST_RECEIPT_REF="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.receiptRef')"
C_MANIFEST_RECEIPT_HASH="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.receiptHash')"
C_MANIFEST_PREDECESSOR_ACTIVATION_REF="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.predecessorActivationRef')"
C_MANIFEST_PREDECESSOR_ACTIVATION_HASH="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.predecessorActivationHash')"
C_MANIFEST_PREDECESSOR_HEAD_REF="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.predecessorHeadRef')"
C_MANIFEST_PREDECESSOR_HEAD_HASH="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.predecessorHeadHash')"
C_MANIFEST_SUCCESSOR_ACTIVATION_REF="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.successorActivationRef')"
C_MANIFEST_SUCCESSOR_ACTIVATION_HASH="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.successorActivationHash')"
C_MANIFEST_SUCCESSOR_HEAD_REF="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.successorHeadRef')"
C_MANIFEST_SUCCESSOR_HEAD_HASH="$(printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -er '.successorHeadHash')"
printf '%s\n' "$C_MANIFEST_ACTIVATION_JSON" | jq -e '
  .schema == "setfarm.internal-production-golden-product-matrix-owner-producer-manifest-activation.v1" and
  .plan == "C" and
  (.manifestHashes | type == "array" and length == 3) and
  (.sourceBuildAuthorityRef | type == "string") and
  (.sourceBuildAuthorityHash | test("^[0-9a-f]{64}$"))
' >/dev/null
C_MANIFEST_STATUS_JSON="$(npm run --silent internal:golden-matrix -- \
  owner-producer-manifest-status --json)"
C_MANIFEST_STATUS_RECEIPT_REF="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.receiptRef')"
C_MANIFEST_STATUS_RECEIPT_HASH="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.receiptHash')"
C_MANIFEST_STATUS_PREDECESSOR_ACTIVATION_REF="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.predecessorActivationRef')"
C_MANIFEST_STATUS_PREDECESSOR_ACTIVATION_HASH="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.predecessorActivationHash')"
C_MANIFEST_STATUS_PREDECESSOR_HEAD_REF="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.predecessorHeadRef')"
C_MANIFEST_STATUS_PREDECESSOR_HEAD_HASH="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.predecessorHeadHash')"
C_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_REF="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.successorActivationRef')"
C_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_HASH="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.successorActivationHash')"
C_MANIFEST_STATUS_SUCCESSOR_HEAD_REF="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.successorHeadRef')"
C_MANIFEST_STATUS_SUCCESSOR_HEAD_HASH="$(printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -er '.successorHeadHash')"
test "$C_MANIFEST_STATUS_RECEIPT_REF" = "$C_MANIFEST_RECEIPT_REF"
test "$C_MANIFEST_STATUS_RECEIPT_HASH" = "$C_MANIFEST_RECEIPT_HASH"
test "$C_MANIFEST_STATUS_PREDECESSOR_ACTIVATION_REF" = "$C_MANIFEST_PREDECESSOR_ACTIVATION_REF"
test "$C_MANIFEST_STATUS_PREDECESSOR_ACTIVATION_HASH" = "$C_MANIFEST_PREDECESSOR_ACTIVATION_HASH"
test "$C_MANIFEST_STATUS_PREDECESSOR_HEAD_REF" = "$C_MANIFEST_PREDECESSOR_HEAD_REF"
test "$C_MANIFEST_STATUS_PREDECESSOR_HEAD_HASH" = "$C_MANIFEST_PREDECESSOR_HEAD_HASH"
test "$C_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_REF" = "$C_MANIFEST_SUCCESSOR_ACTIVATION_REF"
test "$C_MANIFEST_STATUS_SUCCESSOR_ACTIVATION_HASH" = "$C_MANIFEST_SUCCESSOR_ACTIVATION_HASH"
test "$C_MANIFEST_STATUS_SUCCESSOR_HEAD_REF" = "$C_MANIFEST_SUCCESSOR_HEAD_REF"
test "$C_MANIFEST_STATUS_SUCCESSOR_HEAD_HASH" = "$C_MANIFEST_SUCCESSOR_HEAD_HASH"
printf '%s\n' "$C_MANIFEST_STATUS_JSON" | jq -e '
  .schema == "setfarm.internal-production-golden-product-matrix-owner-producer-manifest-activation-status.v1" and
  .state == "active" and
  (.statusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
```

Expected: the C controller freshly re-hashes the exact A+B predecessor and A+B+C successor before returning one matching wrapper receipt/status. Any unequal extracted pair, unavailable/blocked status, source/build or manifest drift, or stale/forked head exits before any Task 9 production call.

### Task 9: Execute the Ordered Golden Matrix

**Files:**
- Generate private finalized bytes after settlement through B's sole finalizer. The receipt derives the future tracked target `docs/review-packets/${campaignDate}-${campaignId}-golden-run-report.md`, but this task does not materialize it.

**Interfaces:**
- Consumes: the clean final operational Setfarm/MC SHAs after all A-E source PRs merge, Subproject A baseline receipt, and Subproject B/C CLI.
- Produces: ten effective accepted B `GoldenRunResultV1` receipts—two each for Profiles 1–3 and one each for Profiles 4–7—plus any immutable raw timeout/replacement/supersession history, one canonical B `GoldenEffectiveRunResultProjectionV1`, and one private B finalization receipt. C creates no tracked report, timeout replacement mapper, report-local manifest, Markdown renderer, or second final packet in this task.

- [ ] **Step 1: Run read-only preflight**

```bash
set -euo pipefail
C_SETFARM_ROOT="$(git rev-parse --show-toplevel)"
C_MC_ROOT="$(git -C "$C_SETFARM_ROOT/../mission-control" rev-parse --show-toplevel)"
C_SHELL_TEST_VALUE_005="$(basename "$C_SETFARM_ROOT")"
test "$C_SHELL_TEST_VALUE_005" = "setfarm"
C_SHELL_TEST_VALUE_006="$(basename "$C_MC_ROOT")"
test "$C_SHELL_TEST_VALUE_006" = "mission-control"
C_MATRIX_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-matrix-v1.json"
cd "$C_SETFARM_ROOT"
C_SHELL_TEST_VALUE_007="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_007" = "main"
C_SHELL_TEST_VALUE_008="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_008" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_009="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_010="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_009" = "$C_SHELL_TEST_VALUE_010"
C_SHELL_TEST_VALUE_011="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_012="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_011" = "$C_SHELL_TEST_VALUE_012"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- preflight \
  --matrix "$C_MATRIX_FILE" \
  --release-sha "$C_SETFARM_SHA" \
  --mission-control-sha "$C_MC_SHA" \
  --json
```

Expected: clean releases, current migrations/audits, healthy services, zero active ownership, exact contract compatibility, and zero new runs.

- [ ] **Step 2: Execute one allowed successor at a time**

```bash
set -euo pipefail
C_SETFARM_ROOT="$(git rev-parse --show-toplevel)"
C_MC_ROOT="$(git -C "$C_SETFARM_ROOT/../mission-control" rev-parse --show-toplevel)"
C_SHELL_TEST_VALUE_013="$(basename "$C_SETFARM_ROOT")"
test "$C_SHELL_TEST_VALUE_013" = "setfarm"
C_SHELL_TEST_VALUE_014="$(basename "$C_MC_ROOT")"
test "$C_SHELL_TEST_VALUE_014" = "mission-control"
C_MATRIX_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-matrix-v1.json"
cd "$C_SETFARM_ROOT"
C_SHELL_TEST_VALUE_015="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_015" = "main"
C_SHELL_TEST_VALUE_016="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_016" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_017="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_018="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_017" = "$C_SHELL_TEST_VALUE_018"
C_SHELL_TEST_VALUE_019="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_020="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_019" = "$C_SHELL_TEST_VALUE_020"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- execute-next \
  --matrix "$C_MATRIX_FILE" \
  --release-sha "$C_SETFARM_SHA" \
  --mission-control-sha "$C_MC_SHA" \
  --json
```

Expected: at most one new run, one durable receipt, and either `accepted` or a frozen matrix requiring classification.

If the process is interrupted in any `launch-intent-persisted`, `starter-operation-issued`, `run-bound`, or `result-stored` window, do not call `execute-next` or `collect` from the dead shell. In a fresh shell, first ask the fixed status operation to reopen its content-addressed matrix receipt and exact inflight-status receipt, then pass only the copied canonical pair to the recovery command:

```bash
set -euo pipefail
umask 077
C_SETFARM_ROOT="$(git rev-parse --show-toplevel)"
C_MC_ROOT="$(git -C "$C_SETFARM_ROOT/../mission-control" rev-parse --show-toplevel)"
C_SHELL_TEST_VALUE_021="$(basename "$C_SETFARM_ROOT")"
test "$C_SHELL_TEST_VALUE_021" = "setfarm"
C_SHELL_TEST_VALUE_022="$(basename "$C_MC_ROOT")"
test "$C_SHELL_TEST_VALUE_022" = "mission-control"
C_MATRIX_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-matrix-v1.json"
C_RECOVERY_TMP="$(mktemp -d "${TMPDIR:-/tmp}/setfarm-golden-recovery.XXXXXX")"
test -d "$C_RECOVERY_TMP" && test ! -L "$C_RECOVERY_TMP"
C_SHELL_TEST_VALUE_023="$(stat -f '%Lp' "$C_RECOVERY_TMP")"
test "$C_SHELL_TEST_VALUE_023" = "700"
C_MATRIX_STATUS_RECEIPT="$C_RECOVERY_TMP/matrix-status.json"
C_RECOVERY_RECEIPT="$C_RECOVERY_TMP/recovery.json"
trap 'rm -f "$C_MATRIX_STATUS_RECEIPT" "$C_RECOVERY_RECEIPT"; rmdir "$C_RECOVERY_TMP" 2>/dev/null || true' EXIT
cd "$C_SETFARM_ROOT"
C_SHELL_TEST_VALUE_024="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_024" = "main"
C_SHELL_TEST_VALUE_025="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_025" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_026="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_027="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_026" = "$C_SHELL_TEST_VALUE_027"
C_SHELL_TEST_VALUE_028="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_029="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_028" = "$C_SHELL_TEST_VALUE_029"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- status \
  --matrix "$C_MATRIX_FILE" \
  --release-sha "$C_SETFARM_SHA" \
  --mission-control-sha "$C_MC_SHA" \
  --json > "$C_MATRIX_STATUS_RECEIPT"
test -f "$C_MATRIX_STATUS_RECEIPT" && test ! -L "$C_MATRIX_STATUS_RECEIPT"
C_SHELL_TEST_VALUE_030="$(stat -f '%Lp' "$C_MATRIX_STATUS_RECEIPT")"
test "$C_SHELL_TEST_VALUE_030" = "600"
C_INFLIGHT_STATUS_REF="$(jq -er '
  .inflightStatus.statusRef |
  select(type == "string" and startswith("setfarm://internal-production/golden-matrix-inflight-statuses/sha256/"))
' "$C_MATRIX_STATUS_RECEIPT")"
C_INFLIGHT_STATUS_HASH="$(jq -er '
  .inflightStatus.statusHash |
  select(type == "string" and test("^[0-9a-f]{64}$"))
' "$C_MATRIX_STATUS_RECEIPT")"
C_SHELL_TEST_VALUE_031="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_031" = "main"
C_SHELL_TEST_VALUE_032="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_032" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_033="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_034="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_033" = "$C_SHELL_TEST_VALUE_034"
C_SHELL_TEST_VALUE_035="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_036="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_035" = "$C_SHELL_TEST_VALUE_036"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- recover-inflight \
  --status-ref "$C_INFLIGHT_STATUS_REF" \
  --status-hash "$C_INFLIGHT_STATUS_HASH" \
  --json > "$C_RECOVERY_RECEIPT"
jq -e '
  .schema == "setfarm.internal-production-golden-matrix-receipt.v1" and
  (.matrixReceiptRef | type == "string") and
  (.matrixReceiptHash | test("^[0-9a-f]{64}$"))
' "$C_RECOVERY_RECEIPT" >/dev/null
rm -f "$C_MATRIX_STATUS_RECEIPT" "$C_RECOVERY_RECEIPT"
rmdir "$C_RECOVERY_TMP"
trap - EXIT
```

Expected: the `status` operation internally calls `resolveGoldenMatrixReceiptV1({matrixReceiptRef,matrixReceiptHash})`, resolves the receipt's exact `inflightStatus.statusRef/statusHash`, and returns only the byte-identical reopened authority. The fresh shell neither reconstructs nor supplies case, repetition, reservation, intent, operation, run, or result identity. `recover-inflight` invokes only B's `recoverPreparedGoldenCaseV1` for the status-bound prepared reservation: it resolves/resumes/adopts the exact issued operation, collects only the status-bound run, or reopens a `result-stored` result without mutation. It reruns no preflight/capacity and starts no second reservation/run/admission/attempt or duplicate review action, including when another same-campaign fleet launch fills capacity. If status returns `inflightStatus:null`, recovery fails closed; `execute-next` remains forbidden until the fixed status reconciliation proves there is no durable reservation, intent, issued operation, bound run, or stored-result transition to recover.

Add a Task 9 shell/CLI regression for all four interruption states. It must lose all process-local values, reopen status/receipt in a new process, extract only the two nested fields, and invoke exactly `recover-inflight --status-ref ... --status-hash ... --json`. Assert the recovery snippet has no case/run selector, legacy collection command, or dead-shell identity variable; response loss at each boundary returns the same authenticated chain, and `result-stored` performs zero launch/collect/result-write side effects. A source-boundary test also rejects any npm JSON producer piped to `jq`, captured, or redirected without `npm run --silent`, including simulated npm-banner contamination. Extract every Task 9 operational Bash fence independently, start it under `env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" bash -n`, and source-inspect it: every fence must begin with `set -euo pipefail`, resolve both roots itself, require both branch names to be `main`, require both full porcelain statuses empty, require both `HEAD` values equal `refs/remotes/origin/main`, and derive both SHAs immediately before each CLI call. No fence may read a `C_*` variable before assigning it in that fence or rely on a previous fence's export. Inject each branch/dirty/remote-head failure and prove the guarded CLI counter remains zero.

If status reports an immutable nonterminal timeout, do not execute a successor or hand-select a replacement. Run the explicit reconciliation loop until it reports no outstanding now-terminal subject or one still-active blocker:

```bash
set -euo pipefail
C_SETFARM_ROOT="$(git rev-parse --show-toplevel)"
C_MC_ROOT="$(git -C "$C_SETFARM_ROOT/../mission-control" rev-parse --show-toplevel)"
C_SHELL_TEST_VALUE_037="$(basename "$C_SETFARM_ROOT")"
test "$C_SHELL_TEST_VALUE_037" = "setfarm"
C_SHELL_TEST_VALUE_038="$(basename "$C_MC_ROOT")"
test "$C_SHELL_TEST_VALUE_038" = "mission-control"
C_MATRIX_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-matrix-v1.json"
cd "$C_SETFARM_ROOT"
C_SHELL_TEST_VALUE_039="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_039" = "main"
C_SHELL_TEST_VALUE_040="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_040" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_041="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_042="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_041" = "$C_SHELL_TEST_VALUE_042"
C_SHELL_TEST_VALUE_043="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_044="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_043" = "$C_SHELL_TEST_VALUE_044"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- reconcile-timeouts \
  --matrix "$C_MATRIX_FILE" \
  --release-sha "$C_SETFARM_SHA" \
  --mission-control-sha "$C_MC_SHA" \
  --json
```

Expected: C calls only B's exact timeout reconciler for sorted stored timeout originals, commits each returned terminal result/supersession through one `putTimeoutReconciliationPair()` call, lists the atomically visible supersessions, and obtains B's canonical effective projection. A crash before pair commit keeps only `reconciliation_required` visible; a crash after commit reopens the same `terminal_replacement_selected` pair. It starts no run/admission, posts no review action, provisions no attempt, consumes no repair authorization, and never rewrites the timeout. Repeat only while a previously active exact run has become terminal; an unchanged active run remains a blocker.

- [ ] **Step 3: Apply the bounded repair loop when a case is not accepted**

Freeze starts; capture DB, operational snapshot, GitHub, process, port, and service refs; classify ownership. For a systemic Setfarm defect, launch one focused canonical Setfarm-owned fix run against a runtime-derived repository path from `git rev-parse --show-toplevel`; for Mission Control, use its serialized PR workflow. Add a failing regression, apply the smallest fix, run focused/adjacent/broad checks, complete independent review, let the owning repository deliver/merge, and build clean main. Start the next Task 9 command in a fresh shell and let that block resolve both roots, prove both clean exact `main` heads, and derive new local `C_SETFARM_SHA`/`C_MC_SHA` values; no exported value from the repair shell is authority. The new B final-release epoch invalidates all prior accepted slots for acceptance counting while retaining their cleanup/root history. Record the exact repair disposition with the complete CLI form defined above, confirm the resolver returns that unconsumed matrix-scoped receipt, and allow execute-next to CAS-consume it against one launch intent. For a generated-product failure use only `record-generated` with unchanged source SHAs and start a fresh generated run. Preserve every prior result and receipt. Stop if one systemic cause reaches three post-fix occurrences.

- [ ] **Step 4: Prove final matrix acceptance**

Run:

```bash
set -euo pipefail
C_SETFARM_ROOT="$(git rev-parse --show-toplevel)"
C_MC_ROOT="$(git -C "$C_SETFARM_ROOT/../mission-control" rev-parse --show-toplevel)"
C_SHELL_TEST_VALUE_045="$(basename "$C_SETFARM_ROOT")"
test "$C_SHELL_TEST_VALUE_045" = "setfarm"
C_SHELL_TEST_VALUE_046="$(basename "$C_MC_ROOT")"
test "$C_SHELL_TEST_VALUE_046" = "mission-control"
C_MATRIX_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-matrix-v1.json"
cd "$C_SETFARM_ROOT"
C_SHELL_TEST_VALUE_047="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_047" = "main"
C_SHELL_TEST_VALUE_048="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_048" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_049="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_050="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_049" = "$C_SHELL_TEST_VALUE_050"
C_SHELL_TEST_VALUE_051="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_052="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_051" = "$C_SHELL_TEST_VALUE_052"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- status \
  --matrix "$C_MATRIX_FILE" \
  --release-sha "$C_SETFARM_SHA" \
  --mission-control-sha "$C_MC_SHA" \
  --json
```

Expected accepted counts from B's `GoldenEffectiveRunResultProjectionV1`: `node-cli=2`, `node-express-api=2`, `vite-react-web=2`, `stateful-multipage-web=1`, `interactive-browser-game=1`, `existing-repository-bug-fix=1`, `existing-repository-security-audit=1`; every raw timeout/replacement/supersession remains listed, zero unresolved Setfarm/MC failures, and zero leaks.

For both existing-repository results, reopen the attempt provision receipt and require distinct current-epoch intent/attempt/provision/repository identities, exact template hashes, private remote visibility, Setfarm-owned integration authority, and `reviewedHeadSha === acceptedSha === remoteMainSha` with equal trees. Historical attempts from a prior epoch or failed retry remain immutable evidence but are never reset, deleted, reused, or counted toward current acceptance.

- [ ] **Step 5: Invoke B's sole settled private finalizer**

```bash
set -euo pipefail
umask 077
C_SETFARM_ROOT="$(git rev-parse --show-toplevel)"
C_MC_ROOT="$(git -C "$C_SETFARM_ROOT/../mission-control" rev-parse --show-toplevel)"
C_SHELL_TEST_VALUE_053="$(basename "$C_SETFARM_ROOT")"
test "$C_SHELL_TEST_VALUE_053" = "setfarm"
C_SHELL_TEST_VALUE_054="$(basename "$C_MC_ROOT")"
test "$C_SHELL_TEST_VALUE_054" = "mission-control"
C_RAW_CAMPAIGN_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-campaign-v1.json"
C_PRIVATE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/setfarm-golden-finalizer.XXXXXX")"
test -d "$C_PRIVATE_TMP" && test ! -L "$C_PRIVATE_TMP"
C_SHELL_TEST_VALUE_055="$(stat -f '%Lp' "$C_PRIVATE_TMP")"
test "$C_SHELL_TEST_VALUE_055" = "700"
C_FINALIZER_RECEIPT="$C_PRIVATE_TMP/finalizer.json"
trap 'rm -f "$C_FINALIZER_RECEIPT"; rmdir "$C_PRIVATE_TMP" 2>/dev/null || true' EXIT
cd "$C_SETFARM_ROOT"
C_SHELL_TEST_VALUE_056="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_056" = "main"
C_SHELL_TEST_VALUE_057="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_057" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_058="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_059="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_058" = "$C_SHELL_TEST_VALUE_059"
C_SHELL_TEST_VALUE_060="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_061="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_060" = "$C_SHELL_TEST_VALUE_061"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden -- finalize-report \
  --campaign "$C_RAW_CAMPAIGN_FILE" \
  --json >"$C_FINALIZER_RECEIPT"
test -f "$C_FINALIZER_RECEIPT" && test ! -L "$C_FINALIZER_RECEIPT"
C_SHELL_TEST_VALUE_062="$(stat -f '%Lp' "$C_FINALIZER_RECEIPT")"
test "$C_SHELL_TEST_VALUE_062" = "600"
C_REPORT_PATH="$(jq -er '.targetPath | select(type == "string" and startswith("docs/review-packets/") and endswith("-golden-run-report.md"))' "$C_FINALIZER_RECEIPT")"
C_FINAL_EPOCH_HASH="$(jq -er '.finalReleaseEpoch.epochHash | select(type == "string" and test("^[0-9a-f]{64}$"))' "$C_FINALIZER_RECEIPT")"
C_REPORT_HASH="$(jq -er '.reportHash | select(type == "string" and test("^[0-9a-f]{64}$"))' "$C_FINALIZER_RECEIPT")"
C_FINALIZATION_HASH="$(jq -er '.finalizationHash | select(type == "string" and test("^[0-9a-f]{64}$"))' "$C_FINALIZER_RECEIPT")"
test -n "$C_REPORT_PATH"
test -n "$C_REPORT_HASH"
test -n "$C_FINALIZATION_HASH"
test -n "$C_FINAL_EPOCH_HASH"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
case "$C_REPORT_PATH" in
  docs/review-packets/*-golden-run-report.md) ;;
  *) exit 1 ;;
esac
rm -f "$C_FINALIZER_RECEIPT"
rmdir "$C_PRIVATE_TMP"
trap - EXIT
```

Expected: C first lists, authenticates, and passes every complete `GoldenCommittedTimeoutReconciliationPairAuthorityV1` plus B-derived effective mapping to B's sole finalizer; settlement and zero-owner checks are complete. B observes the same clean Setfarm/MC SHAs, runs its exact `buildSource()` sequence (`npm run build` in Setfarm and Mission Control), validates `GoldenFinalizationSourceBuildV1`, and reobserves the same clean SHAs/build identities. It then writes one immutable content-addressed `GoldenFinalizedCampaignReportV1` containing the raw result hashes, exact full timeout-reconciliation authorities including every pair/result/supersession/committed-index binding, canonical effective mapping, bounded Markdown bytes/hash, and derived tracked path under B's fixed private root. The Setfarm worktree remains clean; no tracked report, JSON manifest, C-owned replacement mapper, authority subset, or renderer is created.

- [ ] **Step 6: Export the immutable finalization authority and defer tracked materialization**

In a fresh process, rerun B's idempotent finalizer into a private temporary receipt, reopen all of its authority, and derive `C_FINALIZATION_HASH` only from that receipt in the same shell block. Require the same content-addressed target path, report hash, final epoch, source-build authority hash/ref, and clean Setfarm/Mission Control identities already retained by B; do not import a variable from Step 5. Publish only those bounded hashes/refs through C's private matrix status/finalization pointer below B's fixed internal-production data root. Do not start a documentation workflow and do not create a tracked file here:

```bash
set -euo pipefail
umask 077
C_SETFARM_ROOT="$(git rev-parse --show-toplevel)"
C_MC_ROOT="$(git -C "$C_SETFARM_ROOT/../mission-control" rev-parse --show-toplevel)"
C_SHELL_TEST_VALUE_063="$(basename "$C_SETFARM_ROOT")"
test "$C_SHELL_TEST_VALUE_063" = "setfarm"
C_SHELL_TEST_VALUE_064="$(basename "$C_MC_ROOT")"
test "$C_SHELL_TEST_VALUE_064" = "mission-control"
C_MATRIX_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-matrix-v1.json"
C_RAW_CAMPAIGN_FILE="$C_SETFARM_ROOT/evals/suites/internal-production-golden-campaign-v1.json"
C_FINALIZATION_TMP="$(mktemp -d "${TMPDIR:-/tmp}/setfarm-golden-finalization-status.XXXXXX")"
test -d "$C_FINALIZATION_TMP" && test ! -L "$C_FINALIZATION_TMP"
C_SHELL_TEST_VALUE_065="$(stat -f '%Lp' "$C_FINALIZATION_TMP")"
test "$C_SHELL_TEST_VALUE_065" = "700"
C_FINALIZER_RECEIPT="$C_FINALIZATION_TMP/finalizer.json"
trap 'rm -f "$C_FINALIZER_RECEIPT"; rmdir "$C_FINALIZATION_TMP" 2>/dev/null || true' EXIT
cd "$C_SETFARM_ROOT"
C_SHELL_TEST_VALUE_066="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_066" = "main"
C_SHELL_TEST_VALUE_067="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_067" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_068="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_069="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_068" = "$C_SHELL_TEST_VALUE_069"
C_SHELL_TEST_VALUE_070="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_071="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_070" = "$C_SHELL_TEST_VALUE_071"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden -- finalize-report \
  --campaign "$C_RAW_CAMPAIGN_FILE" \
  --json >"$C_FINALIZER_RECEIPT"
C_FINALIZATION_HASH="$(jq -er '.finalizationHash | select(type == "string" and test("^[0-9a-f]{64}$"))' "$C_FINALIZER_RECEIPT")"
C_SHELL_TEST_VALUE_072="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_072" = "main"
C_SHELL_TEST_VALUE_073="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_073" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_074="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_075="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_074" = "$C_SHELL_TEST_VALUE_075"
C_SHELL_TEST_VALUE_076="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_077="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_076" = "$C_SHELL_TEST_VALUE_077"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- record-finalization \
  --matrix "$C_MATRIX_FILE" \
  --finalization-hash "$C_FINALIZATION_HASH" \
  --json
C_SHELL_TEST_VALUE_078="$(git branch --show-current)"
test "$C_SHELL_TEST_VALUE_078" = "main"
C_SHELL_TEST_VALUE_079="$(git -C "$C_MC_ROOT" branch --show-current)"
test "$C_SHELL_TEST_VALUE_079" = "main"
C_SHELL_GUARD_OUTPUT="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_GUARD_OUTPUT="$(git -C "$C_MC_ROOT" status --porcelain=v1 --untracked-files=all)"
test -z "$C_SHELL_GUARD_OUTPUT"
C_SHELL_TEST_VALUE_080="$(git rev-parse HEAD)"
C_SHELL_TEST_VALUE_081="$(git rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_080" = "$C_SHELL_TEST_VALUE_081"
C_SHELL_TEST_VALUE_082="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
C_SHELL_TEST_VALUE_083="$(git -C "$C_MC_ROOT" rev-parse refs/remotes/origin/main)"
test "$C_SHELL_TEST_VALUE_082" = "$C_SHELL_TEST_VALUE_083"
C_SETFARM_SHA="$(git rev-parse HEAD)"
C_MC_SHA="$(git -C "$C_MC_ROOT" rev-parse HEAD)"
npm run --silent internal:golden-matrix -- finalization-status \
  --matrix "$C_MATRIX_FILE" \
  --json
rm -f "$C_FINALIZER_RECEIPT"
rmdir "$C_FINALIZATION_TMP"
trap - EXIT
```

`record-finalization` obtains its accepted pair only from the one internal `runGoldenMatrix(... operation:{kind:"status"})` call described in Task 7 and immediately resolves that exact pair; tests fail if it scans a directory/index, reconstructs from results, accepts a caller pair, or makes a second status call. `recordGoldenMatrixFinalizationPointerV1` writes the strict pointer content-addressed below B's fixed `golden-results/matrix-finalizations/sha256` child and advances one matrix-hash index only when that resolved receipt is byte-identical, has `decision:"accepted"`, carries an exact `result-stored` inflight status whose result belongs to its ordered results, all ten current-epoch accepted slots validate, and B's strict finalization object carries the same raw campaign, exact epoch, source-build authority, report bytes/hash, and complete settlement. The pointer persists the same `inflightStatus`, `matrixReceiptRef`, and `matrixReceiptHash`; none can be inferred from the matrix-hash index. `finalization-status --matrix FILE --json` resolves/reopens/rehashes that fixed pointer, its exact matrix receipt/inflight pairs, and B receipt in a fresh process and returns only `GoldenMatrixFinalizationPointerV1`; it accepts no finalization hash, report path, source SHA, epoch, root, output, or receipt body. Missing, stale, cross-matrix/campaign/epoch, cross-status/receipt-ref/hash, corrupt, mode-invalid, or prior-source pointer fails closed. Add focused CLI/store tests and source-boundary tests proving only Task 9 records it and Subproject E resolves it read-only. E's status projection must set `statusRef` to the returned status object's exact `matrixReceiptRef`; it may not synthesize a ref from `matrixHash`, `matrixReceiptHash`, a private path, or the finalization-pointer index.

Subproject E's final pre-packet review resolves this exact C status and B finalization output alongside D recovery and E fleet evidence. Only after all three are accepted on the same final operational epoch may E's single final Setfarm-owned documentation claim call `beginGoldenDocsMaterializationSessionV1({operationalSetfarmSha,closureFinalizationHash,finalReleaseEpoch,sourceBuildAuthorityRef,sourceBuildAuthorityHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash,closureGenerationHash,orderedExpectedContentHashes})`, after equality-checking `closureFinalizationHash` to E's strict private closure finalization and supplying the six hashes in this fixed semantic order: C `golden-matrix-report`, D `recovery-matrix`, D `recovery-reconciliation`, E `golden-fleet-report`, E `final-closure-json`, E `final-closure-markdown`. B recomputes the generation hash from exactly the epoch hash plus the role-bound C matrix/D recovery/E fleet finalization hashes; the later closure-finalization hash is bound independently and is not a generation input. Before minting the sole claim/worktree/generation-leased live session, B reopens the sealed source-build authority pair and freshly requires both repositories' local and remote main heads to equal the complete epoch. B derives every exact entry kind, single combined `epoch-${finalReleaseEpoch.epochHash}-closure-${closureGenerationHash}` directory segment, safe path, and basename; E cannot supply or inspect a session/lease controller, owner token, or target path. The E composition factory passes C's already revalidated finalization hash to `materializeFinalizedGoldenCampaignReportInSessionV1({ expectedKind:"golden-matrix-report", session, finalizationHash })`; no worker or shell invokes the standalone `materialize-finalized-report` CLI, and C is never materialized in an earlier claim.

The in-session narrow materializer reloads and revalidates the immutable finalization receipt, source/build identities, report hash, and canonical Markdown bytes from B's global private root, then authorizes generation from the live session capability's exact next `golden-matrix-report` entry. It writes those bytes only to that entry's validated target and advances the capability; the legacy private finalizer `targetPath` is not compared, copied, or treated as tracked authority, and the writer accepts no caller path or body. D and E then write only their registered entries, and `completeGoldenDocsMaterializationSessionV1(session)` returns B's exact content-addressed completion receipt tuple only after all six exact hashes exist and no seventh change is present. Setfarm alone owns the resulting commit/PR handoff. A wrong next kind/path/content hash, missing, prior-epoch, already-different, independently materialized, reordered, or partially written C report blocks the claim; on a crash Setfarm discards that isolated docs claim and retries the whole six-file session from the unchanged operational base. The report contains identities, hashes, counts, classifications, and canonical refs only; it excludes raw runtime payloads, screenshots, host paths, selector tokens, credentials, and generated repository contents.
