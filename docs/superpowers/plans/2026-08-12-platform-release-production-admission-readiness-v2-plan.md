# Platform Release Production Admission Readiness V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-input, read-only `setfarm platform-release preflight --json` command that emits one current, bounded, canonical blocked-readiness receipt without fabricating or widening production authority.

**Architecture:** A strict schema module owns the finite policy, receipt union, blocker order, structural hashes, semantic validation, and canonical serialization. A separate zero-input observer executes only code-owned bounded Darwin probes and maps every absence, uncertainty, and failure into that schema; the CLI recognizes only the exact argv before the normal runtime guard and dynamically loads the observer. A separately named internal test-support module exposes only finite fault modes and cannot accept executables, paths, callbacks, receipts, or trust anchors.

**Tech Stack:** TypeScript, Node.js 26, Zod, canonical JSON/SHA-256 helpers, bounded `child_process.spawn`, `node:test`, `tsx`, macOS Security/Installer/Gatekeeper/SIP/launchd command-line tools

**Spec:** `docs/superpowers/specs/2026-08-12-platform-release-production-admission-readiness-v2-design.md`

## Global Constraints

- All source, tests, diagnostics, CLI copy, and documentation added by this plan must be English-only.
- The production entry point is exactly `observePlatformReleaseProductionAdmissionReadinessV2(): Promise<PlatformReleaseProductionAdmissionReadinessV2>` and accepts zero arguments.
- The only argv recognized before the runtime guard is exactly `platform-release preflight --json`; every other command and every near miss executes `assertRuntimeIntegrityOrExit()` before normal routing or usage handling.
- The receipt always says `authorityState:"diagnostic_observation_only"`, `credentialUse:"none"`, `mutationAuthority:false`, `productionAuthority:false`, `productionAdmission:"blocked"`, and `trustConclusion:"characterization_only"`.
- The receipt is self-consistent diagnostic data, never authenticated evidence, a freshness lease, or an input to an authority-bearing API.
- Do not add signing, notarization submission, installation, receipt mutation, helper execution, database work, Mission Control changes, service restarts, production opener changes, caller-selected paths, executable overrides, package identifiers, environment-derived trust anchors, or dirty-build/runtime-guard bypasses.
- Use `/usr/bin/security`, `/usr/sbin/spctl`, `/usr/bin/csrutil`, `/bin/launchctl`, and `/usr/bin/xcrun` with `shell:false`, stdin ignored, `LC_ALL=C`, `LANG=C`, `HOME=/var/empty`, and `PATH=/usr/bin:/usr/sbin:/bin:/sbin`.
- Use `5_000` ms per command, `32 * 1024` bytes per stdout or stderr channel, at most `16` command observations, at most `32` blocker codes, at most `128` identities per class, at most `4_096` bytes per redacted projection, and at most `64 * 1024` canonical receipt bytes.
- The finite notary metadata service names are exactly `com.apple.gke.notary.tool`, `com.apple.notarytool`, and `notarytool`; existence probes never use `-g` or `-w` and never publish returned metadata.
- The Installer package identifier remains `unconfigured`; do not execute a `pkgutil` receipt query and always retain both `INSTALLER_PACKAGE_ID_UNCONFIGURED` and `INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE`.
- Read the fixed installed roots and helper paths from `platform-release-bootstrap-contract-v2.ts`; do not duplicate or infer alternate paths.
- Read the production native-distribution trust state from its existing code-owned schema; do not introduce another environment or file configuration channel.
- The observer privately zeroizes every command buffer and publishes neither raw output, raw-output hashes, raw byte lengths, identity labels, subjects, serials, Team identifiers, keychain paths, usernames, home paths, environment values, arbitrary locators, nor secrets.
- `ENOENT` may prove a fixed path absent; symlinks, special files, hard-linked helpers, unexpected ownership/mode, identity replacement, overflow, timeout, spawn failure, malformed output, and inconsistent before/after observations are failures or unproven states, never absence.
- Agent implementers and reviewers must not stage, commit, push, merge, open a PR, or use a dirty-build/runtime-guard override. Each task ends with a Setfarm-owned handoff checkpoint: record `git status --short`, `git diff --check`, and test evidence while leaving Git mutation to the canonical Setfarm handoff.
- Stop and report without weakening a gate if the same systemic failure repeats three times after a fix attempt.
- Clean-main build, compiled CLI validation, reviewed PR delivery, and final worktree cleanliness happen only through the authorized Setfarm-owned handoff after all source and review gates pass.

---

## File Map

- Create `src/execution/schemas/platform-release-production-admission-readiness-v2.ts`: finite public policy, strict receipt schemas and types, hash payloads, semantic validation, canonical serialization, and an explicitly internal candidate parser imported only by the observer and test support.
- Create `src/execution/private-platform-release-production-admission-readiness-v2.ts`: finite internal observation core shared by the zero-input wrapper and test support; accepts only a closed production/test mode and never accepts paths, executables, callbacks, receipts, policy, or trust material.
- Create `src/execution/platform-release-production-admission-readiness-v2.ts`: zero-input production observer, fixed Darwin command and path observation, bounded process containment, private parsers, build-provenance classification, buffer zeroization, and unsupported-platform construction.
- Create `src/product-compiler/platform-release-production-admission-readiness-test-support-v2.ts`: finite, non-production observer fixture modes with no caller-supplied executable, path, callback, receipt, or trust material.
- Create `tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts`: schema, policy, hostile-input, observer-fault, live-host, false-authority, allocation-bound, and source-boundary tests.
- Create `tests/platform-release-production-admission-readiness-cli-v2.test.ts`: source CLI exact-argv, exit-code, stream, runtime-guard, and sensitive-output tests run by ordinary `npm test`.
- Modify `src/cli/cli.ts`: exact pre-guard route, stable error contract, and read-only usage text.
- Modify `src/cli/cli.test.ts`: compiled-dist preflight contract exercised only after a clean build.
- Modify `docs/superpowers/plans/2026-07-26-platform-release-build-and-verifier-plan.md`: prepend a concise dated checkpoint with the current live blocker classifications and this diagnostic slice's non-authority boundary.

---

### Task 1: Lock the strict policy, receipt schema, hashes, and false-authority semantics

**Files:**
- Create: `src/execution/schemas/platform-release-production-admission-readiness-v2.ts`
- Create: `tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts`

**Interfaces:**
- Consumes: `boundedPlatformReleaseJsonSnapshotV2(value, maxBytes)`, `platformReleaseCandidateFitsCanonicalCapV2(value, maxBytes)`, `deepFreezePlatformReleaseJsonV2(value)`, `hashCanonicalJson(value)`, `canonicalJsonStringify(value)`, and `Sha256Schema`.
- Produces: `PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA`, `PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2`, `PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2`, `PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2`, `PlatformReleaseProductionAdmissionReadinessV2`, `canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt)`, and the `@internal` function `parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(candidate)`.
- Import boundary: the internal parser may be imported only by `src/execution/private-platform-release-production-admission-readiness-v2.ts` and its focused test; the zero-input wrapper and test-support module receive already parsed/frozen receipts from that core. No CLI, opener, store, verifier, registry, or database module may import it.

- [ ] **Step 1: Write the failing policy and canonical receipt tests**

Add a `node:test` suite whose fixture creates a Darwin candidate with independent zero identity observations, enabled host enforcement, absent fixed distribution objects, unavailable trust configuration, V1-only build provenance, redacted command observations, and the exact blocker sequence. Lock the policy decisions in assertions:

```typescript
assert.equal(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.commandTimeoutMs, 5_000);
assert.equal(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.channelByteCap, 32 * 1024);
assert.equal(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2, 64 * 1024);
assert.deepEqual(
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.environment,
  Object.freeze({
    LC_ALL: "C",
    LANG: "C",
    HOME: "/var/empty",
    PATH: "/usr/bin:/usr/sbin:/bin:/sbin",
  }),
);
assert.deepEqual(receipt.blockerCodes, expectedBlockers);
assert.equal(receipt.productionAuthority, false);
assert.equal(receipt.productionAdmission, "blocked");
assert.equal(receipt.mutationAuthority, false);
assert.equal(Object.isFrozen(receipt), true);
assert.equal(Object.isFrozen(receipt.codeSigning), true);
assert.ok(Buffer.byteLength(canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt), "utf8") <= 64 * 1024);
```

The canonical Darwin fixture must retain these unconditional blockers even when all observable host checks are favorable:

```typescript
assert.deepEqual(
  receipt.blockerCodes.slice(-3),
  [
    "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
    "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
    "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
  ],
);
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run:

```bash
node --import tsx --test tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts
```

Expected: FAIL because `platform-release-production-admission-readiness-v2.ts` does not exist.

- [ ] **Step 3: Implement the finite policy and strict schemas**

Define the exact code-owned blocker tuple in the spec order and derive the Zod enum from that tuple. Define the fixed command kinds and references without accepting raw argv or paths in receipt candidates:

```typescript
export const PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2 = Object.freeze([
  "PLATFORM_UNSUPPORTED",
  "DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED",
  "DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED",
  "CODE_SIGNING_IDENTITY_OBSERVATION_FAILED",
  "DEVELOPER_ID_TEAM_UNCONFIGURED",
  "DESIGNATED_REQUIREMENT_UNCONFIGURED",
  "INSTALLER_PACKAGE_ID_UNCONFIGURED",
  "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
  "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
  "NOTARYTOOL_UNAVAILABLE",
  "NOTARYTOOL_OBSERVATION_FAILED",
  "NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE",
  "NOTARIZED_DISTRIBUTION_UNPROVEN",
  "GATEKEEPER_DISABLED",
  "GATEKEEPER_OBSERVATION_FAILED",
  "SIP_DISABLED",
  "SIP_OBSERVATION_FAILED",
  "AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE",
  "AMFI_SERVICE_UNAVAILABLE",
  "AUTHENTICATED_RUNNING_HELPER_ABSENT",
  "AMFI_RUNTIME_ADMISSION_UNPROVEN",
  "INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE",
  "INSTALLED_SETFARM_ROOT_ABSENT",
  "INSTALLED_HELPER_ABSENT",
  "EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN",
  "PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE",
  "V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE",
  "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
  "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
  "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
  "HOST_OBSERVATION_INCOMPLETE",
] as const);

export const PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2 = Object.freeze({
  commandTimeoutMs: 5_000,
  channelByteCap: 32 * 1024,
  canonicalReceiptByteCap: 64 * 1024,
  redactedProjectionByteCap: 4_096,
  maxCommandObservations: 16,
  maxBlockerCodes: 32,
  maxIdentityCountPerClass: 128,
  environment: Object.freeze({
    LC_ALL: "C",
    LANG: "C",
    HOME: "/var/empty",
    PATH: "/usr/bin:/usr/sbin:/bin:/sbin",
  }),
  knownNotaryProfileServices: Object.freeze([
    "com.apple.gke.notary.tool",
    "com.apple.notarytool",
    "notarytool",
  ] as const),
});
```

Use strict unions for identity, fixed-path, redacted command, Darwin, and unsupported receipts. A fixed path observation is exactly `{ ref, state, observationHash }`, where `ref` is a finite enum and `state` is `absent | present_unjoined | unproven | observation_failed`; it exposes no raw path or physical identity. `ENOENT` alone maps to `absent`; symlink, special type, hard-linked helper, ownership/mode drift, and identity replacement map to `unproven`; I/O inability maps to `observation_failed`. A command observation is exactly `{ kind, executableRef, argvRef, status, exitCode, signal, projectionByteLength, result, observationHash }`; `result` is a strict discriminated redacted union and contains no raw channel information.

The internal parse order is fixed:

```typescript
export function parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
  candidate: unknown,
): PlatformReleaseProductionAdmissionReadinessV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    candidate,
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2,
  );
  const parsed = PlatformReleaseProductionAdmissionReadinessV2Schema.parse(snapshot);
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    parsed,
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2,
  )) {
    throw new Error("PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_CANONICAL_LIMIT_EXCEEDED");
  }
  return deepFreezePlatformReleaseJsonV2(parsed);
}
```

Before returning, `superRefine` must recompute every command/path observation hash, `policyHash`, filtered blocker order, and `readinessHash`; require blockers to be unique and in tuple order; reject any candidate with no blockers or without the three unconditional future-authority blockers. Derive blockers solely from typed observations plus the five hard-coded unavailable production trust facts. Require `observedAt` to be an exact millisecond UTC timestamp but never use it as freshness authority.

- [ ] **Step 4: Add hostile candidate and semantic-tamper tests**

Add tests that reject unknown fields, accessors, proxies, cycles, sparse arrays, non-enumerable properties, symbols, oversized candidates, reordered or duplicate blockers, nested hash drift, policy hash drift, and a fully rehashed candidate that changes an authority literal. Assert hostile accessors and proxy traps remain uninvoked because bounded snapshotting occurs before freezing.

```typescript
let getterCalled = false;
const hostile = Object.defineProperty({}, "schema", {
  enumerable: true,
  get() {
    getterCalled = true;
    return PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA;
  },
});
assert.throws(
  () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(hostile),
  /CANONICAL_JSON_/u,
);
assert.equal(getterCalled, false);
```

Clone a valid receipt through canonical JSON and prove that the clone can be structurally checked only by the internal test boundary and cannot be passed to any production authority opener. Add a source census assertion that no production authority/store/verifier/registry function imports or accepts this receipt type.

- [ ] **Step 5: Run the focused schema suite and static contracts**

Run:

```bash
node --import tsx --test tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
git diff --check
```

Expected: all commands exit `0`; the receipt remains recursively frozen and within `64 * 1024` canonical bytes.

- [ ] **Step 6: Record the Setfarm-owned handoff checkpoint**

Run `git status --short` and verify only the plan plus Task 1 source/test files changed. Do not stage or commit.

---

### Task 2: Implement the zero-input bounded production observer and finite fault harness

**Files:**
- Create: `src/execution/private-platform-release-production-admission-readiness-v2.ts`
- Create: `src/execution/platform-release-production-admission-readiness-v2.ts`
- Create: `src/product-compiler/platform-release-production-admission-readiness-test-support-v2.ts`
- Modify: `tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts`

**Interfaces:**
- Consumes: Task 1 policy/types/internal parser; fixed production paths from `platform-release-bootstrap-contract-v2.ts`; production trust state from `platform-release-bootstrap-darwin-native-distribution-v2.ts`; `PlatformReleaseManifestV1Schema`; bounded file/canonical helpers.
- Produces: private `observePlatformReleaseProductionAdmissionReadinessWithFiniteModeForInternalUseV2(mode)`, public `observePlatformReleaseProductionAdmissionReadinessV2(): Promise<PlatformReleaseProductionAdmissionReadinessV2>`, and test-only `observePlatformReleaseProductionAdmissionReadinessForTestV2(mode): Promise<PlatformReleaseProductionAdmissionReadinessV2>`.
- The production module must not export its process runner, command plan, path probe, parser, policy override, clock override, platform override, or candidate builder.
- The private core accepts only `{ purpose:"production" }` or the finite test mode from this task. It owns the real subprocess/path implementation; the production wrapper and test support must not duplicate observer logic.

- [ ] **Step 1: Write failing unsupported-platform and fixed-command contract tests**

Use the finite test-support API below; it accepts only a frozen mode and finite fault names:

```typescript
type PlatformReleaseReadinessTestModeV2 = Readonly<{
  platform: "darwin" | "unsupported";
  faults: readonly (
    | "application_identity_spawn_failure"
    | "installer_identity_timeout"
    | "gatekeeper_output_overflow"
    | "sip_malformed_output"
    | "authenticated_root_spawn_failure"
    | "amfi_malformed_output"
    | "notarytool_unavailable"
    | "notary_profile_probe_failure"
    | "fixed_path_symlink"
    | "fixed_path_replacement"
    | "build_manifest_invalid"
  )[];
}>;
```

Assert unsupported mode emits the literal five `not_observed_platform_unsupported` sections, an empty command list, and only policy/invariant blockers in canonical order. Assert the Darwin fixture records exact command references for:

```typescript
[
  ["developer_id_application", "SECURITY_FIND_IDENTITY_CODESIGNING_V2"],
  ["developer_id_installer", "SECURITY_FIND_IDENTITY_BASIC_V2"],
  ["gatekeeper_status", "SPCTL_STATUS_V2"],
  ["sip_status", "CSRUTIL_STATUS_V2"],
  ["authenticated_root_status", "CSRUTIL_AUTHENTICATED_ROOT_STATUS_V2"],
  ["amfi_service", "LAUNCHCTL_AMFI_SERVICE_V2"],
  ["notarytool_resolution", "XCRUN_FIND_NOTARYTOOL_V2"],
  ["stapler_resolution", "XCRUN_FIND_STAPLER_V2"],
  ["notary_profile_service_1", "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_1_V2"],
  ["notary_profile_service_2", "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_2_V2"],
  ["notary_profile_service_3", "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_3_V2"],
]
```

- [ ] **Step 2: Run the focused test and confirm the missing observer failure**

Run:

```bash
node --import tsx --test tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts
```

Expected: FAIL because the observer and test-support modules do not exist.

- [ ] **Step 3: Implement bounded subprocess containment and private byte parsers**

Implement a private detached process runner modeled on the existing Darwin host self-observation fixture. It must use `spawn(executable, argv, { detached:true, shell:false, stdio:["ignore","pipe","pipe"], env:fixedEnvironment })`, latch the first terminal cause, stop accepting bytes when either channel exceeds `32 * 1024`, kill the process group and direct child, wait through a bounded settlement watchdog, and zeroize all aggregate and chunk buffers in `finally`.

Use these exact argv values:

```typescript
const commandPlan = Object.freeze([
  ["/usr/bin/security", ["find-identity", "-v", "-p", "codesigning"]],
  ["/usr/bin/security", ["find-identity", "-v", "-p", "basic"]],
  ["/usr/sbin/spctl", ["--status"]],
  ["/usr/bin/csrutil", ["status"]],
  ["/usr/bin/csrutil", ["authenticated-root", "status"]],
  ["/bin/launchctl", ["print", "system/com.apple.MobileFileIntegrity"]],
  ["/usr/bin/xcrun", ["--find", "notarytool"]],
  ["/usr/bin/xcrun", ["--find", "stapler"]],
  ["/usr/bin/security", ["find-generic-password", "-s", "com.apple.gke.notary.tool"]],
  ["/usr/bin/security", ["find-generic-password", "-s", "com.apple.notarytool"]],
  ["/usr/bin/security", ["find-generic-password", "-s", "notarytool"]],
] as const);
```

Parse identity output as bounded bytes. Count only ASCII line markers for `Developer ID Application:` in the codesigning result and `Developer ID Installer:` in the basic result, cap each at `128`, discard labels, and zeroize bytes. For each independent query, use count `0` only after a syntactically valid Security result, a positive safe integer only when the exact class is present, and `null` on failure.

With the fixed `C` locale, accept only exact success forms for Gatekeeper, SIP, authenticated root, and launchd. AMFI is `running` only when the result contains both `state = running` and `program = /usr/libexec/amfid`. Resolve notarytool and stapler only when `xcrun --find` returns `/Applications/Xcode.app/Contents/Developer/usr/bin/notarytool` and `/Applications/Xcode.app/Contents/Developer/usr/bin/stapler` respectively, and those fixed paths pass a non-following root-owned executable-file observation. Metadata probes treat exit `0` as `present_unjoined`, Security exit `44` as not observed, and every other result as `observation_failed`; if any of the three probes fails, the aggregate state is failure.

Availability of executed tools is represented by each command's typed status/result. Availability of fixed but non-executed `/usr/bin/codesign` and `/usr/sbin/pkgutil` is privately checked; any absent or unproven result adds `HOST_OBSERVATION_INCOMPLETE` without adding a public locator field.

- [ ] **Step 4: Implement fixed path, trust, and build-provenance observation**

Derive the repository root from `import.meta.url`; never read `SETFARM_REPO_DIR`. Bounded-read `dist/BUILD_INFO.json` and `dist/PLATFORM_RELEASE_MANIFEST.json` after before/open/after `lstat`/`fstat` identity checks and `O_NOFOLLOW`. Classify:

```typescript
type BuildProvenanceStateV2 =
  | "v1_build_provenance_only"
  | "missing"
  | "invalid"
  | "observation_failed";
```

Return `v1_build_provenance_only` only when both documents are strict, clean-main, and bind the same full release SHA. It always carries `platformReleaseAuthority:false`. `ENOENT` is `missing`; oversize, invalid UTF-8/JSON/Zod, or mismatch is `invalid`; symlink, replacement, special type, or I/O failure is `observation_failed`.

Probe only the fixed Setfarm installed roots/helpers and fixed tool files using non-following before/after metadata. Root directories must be root-owned directories without group/world write. Helper/tool files must be root-owned ordinary executable files with link count `1`, without group/world write. Public path observations contain finite refs and redacted hashes only. The package identifier stays unconfigured, so execute no receipt command.

Read the existing production trust state directly and require its current unavailable/forbidden configuration. Any unexpected drift becomes `HOST_OBSERVATION_INCOMPLETE`; it never opens admission.

- [ ] **Step 5: Construct the strict receipt and finite test adapter**

The production function has no defaulted or optional parameters:

```typescript
export async function observePlatformReleaseProductionAdmissionReadinessV2(): Promise<
  PlatformReleaseProductionAdmissionReadinessV2
> {
  return observePlatformReleaseProductionAdmissionReadinessWithFiniteModeForInternalUseV2(
    Object.freeze({ purpose: "production" }),
  );
}
```

Assert `observePlatformReleaseProductionAdmissionReadinessV2.length === 0`. The internal implementation records `observedAt` only after all observations, derives redacted projections and blockers, recomputes all hashes, and passes the result through Task 1's internal parser. On unsupported platforms it returns before any Darwin spawn/path probe.

The test-support module validates its finite mode and calls the same private core used by production. Faults are injected only at named branches inside that core; no duplicate subprocess/path implementation is permitted. It must reject duplicate fault modes and impossible fault/platform combinations and must not export any generic runner. Add static tests proving no production module imports the `test-support-v2` module and only the zero-input wrapper plus test support import the private core.

- [ ] **Step 6: Add fault, allocation, replacement, and live Darwin tests**

For every finite fault, assert the related observation becomes failed/unproven and retains the proper blocker; it must never become absent. Verify one failed Security query leaves the other exact count intact. Verify timeout/spawn/overflow preserve the first cause and produce no raw exception or command output in canonical JSON. Verify symlink and same-path replacement fail closed.

On Darwin, call the real zero-input observer and assert:

```typescript
const live = await observePlatformReleaseProductionAdmissionReadinessV2();
assert.equal(live.observedPlatform, "darwin");
assert.equal(live.productionAuthority, false);
assert.equal(live.productionAdmission, "blocked");
assert.equal(live.credentialUse, "none");
assert.ok(live.blockerCodes.includes("NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE"));
assert.ok(live.blockerCodes.includes("AMFI_RUNTIME_ADMISSION_UNPROVEN"));
assert.doesNotMatch(canonicalPlatformReleaseProductionAdmissionReadinessV2(live), /setrox|Users\//iu);
```

Assert all command, blocker, path, and canonical receipt maxima. Prove non-mutation through the exact production command allowlist, a source census forbidding write/install/sign/submit/restart APIs in the observer dependency slice, fixture-owned child-process cleanup assertions, and before/after checks limited to the fixed code-owned installed roots/helper files. Do not enumerate ambient keychains, receipts, processes, services, or user files.

- [ ] **Step 7: Run focused and adjacent observer suites**

Run:

```bash
node --import tsx --test tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts
node --import tsx --test \
  tests/execution-attempts/platform-release-bootstrap-darwin-local-package-trust-audit-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-host-self-observation-native-fixture-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-native-distribution-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-filesystem-backend-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-filesystem-native-fixture-v2.test.ts
node --import tsx --test tests/product-compiler/platform-release-bootstrap-darwin-native-package-member-capture-test-v2.test.ts
npx tsc -p tsconfig.json --noEmit
git diff --check
```

Expected: all commands exit `0`; production openers remain inert and no fixture authority enters the live receipt.

- [ ] **Step 8: Record the Setfarm-owned handoff checkpoint**

Run `git status --short` and verify Task 2 changed only the observer, test-support, and focused test files in addition to Task 1/plan changes. Do not stage or commit.

---

### Task 3: Add the exact pre-guard CLI route and stable process contract

**Files:**
- Modify: `src/cli/cli.ts:267-317`
- Create: `tests/platform-release-production-admission-readiness-cli-v2.test.ts`
- Modify: `src/cli/cli.test.ts`

**Interfaces:**
- Consumes: `observePlatformReleaseProductionAdmissionReadinessV2()` and `canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt)`.
- Produces: exact source and compiled CLI behavior; stable codes `PLATFORM_RELEASE_PREFLIGHT_USAGE_INVALID` and `PLATFORM_RELEASE_PREFLIGHT_OBSERVATION_FAILED`.
- The route must dynamically import the observer only after exact argv equality and before `assertRuntimeIntegrityOrExit()`.

- [ ] **Step 1: Write failing source CLI process tests**

Spawn the source CLI with `node --import tsx src/cli/cli.ts`. For exact argv assert exit `2`, exactly one newline-terminated JSON object on stdout, and empty stderr. Parse stdout in the test and assert the strict authority literals and canonical reserialization.

For `platform-release preflight`, `platform-release preflight --json --json`, `platform-release preflight --json extra`, and `platform-release preflight --unknown`, assert exit `1`, empty stdout, and exactly:

```text
PLATFORM_RELEASE_PREFLIGHT_USAGE_INVALID
```

Create two temporary Git checkouts. The valid guard fixture is a clean `main` checkout with `dist/BUILD_INFO.json` bound to its exact HEAD; use it to prove preflight near misses reach usage handling after the guard and exit `1`. The invalid fixture has a non-main branch or mismatched build stamp; exact preflight must still emit the diagnostic receipt, while each near miss and an unrelated command must take the normal guard path and exit `2` with `RUNTIME_GUARD_FAIL`. Do not set `SETFARM_SKIP_RUNTIME_GUARD` and do not pass `--skip-runtime-guard`.

- [ ] **Step 2: Run the CLI test and confirm normal runtime guard prevents the new route**

Run:

```bash
node --import tsx --test tests/platform-release-production-admission-readiness-cli-v2.test.ts
```

Expected: FAIL because `cli.ts` invokes the runtime guard before inspecting exact preflight argv.

- [ ] **Step 3: Implement exact argv recognition before the runtime guard**

At the start of `main`, use exact positional comparison with no permissive flag parser. Only exact argv returns before the guard; prefix usage handling remains after it:

```typescript
async function main() {
  const args = process.argv.slice(2);
  const isExactPlatformReleasePreflight =
    args.length === 3 &&
    args[0] === "platform-release" &&
    args[1] === "preflight" &&
    args[2] === "--json";

  if (isExactPlatformReleasePreflight) {
    try {
      const [{ observePlatformReleaseProductionAdmissionReadinessV2 }, { canonicalPlatformReleaseProductionAdmissionReadinessV2 }] =
        await Promise.all([
          import("../execution/platform-release-production-admission-readiness-v2.js"),
          import("../execution/schemas/platform-release-production-admission-readiness-v2.js"),
        ]);
      const receipt = await observePlatformReleaseProductionAdmissionReadinessV2();
      process.stdout.write(`${canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt)}\n`);
      process.exitCode = 2;
    } catch {
      process.stderr.write("PLATFORM_RELEASE_PREFLIGHT_OBSERVATION_FAILED\n");
      process.exitCode = 1;
    }
    return;
  }

  assertRuntimeIntegrityOrExit();
  if (args[0] === "platform-release" && args[1] === "preflight") {
    process.stderr.write("PLATFORM_RELEASE_PREFLIGHT_USAGE_INVALID\n");
    process.exitCode = 1;
    return;
  }
  const [group, action, target] = args;
```

In a guard-valid runtime, every preflight near miss becomes the stable usage error. In a guard-invalid runtime, every near miss fails at the unchanged guard just like any other command. Do not print the caught error.

- [ ] **Step 4: Add read-only usage copy and stream-leak assertions**

Add this line to `printUsage()`:

```text
setfarm platform-release preflight --json  Read-only production readiness diagnostics (always non-authoritative)
```

Assert no CLI output contains identity labels, raw tool output, usernames, home paths, keychain paths, environment values, or internal error text. Assert exact preflight cannot exit `0`.

- [ ] **Step 5: Add compiled-dist test coverage without dirty building**

Extend `src/cli/cli.test.ts` with the same exact argv, exit `2`, one-line stdout, empty stderr, and authority-literal assertions against `dist/cli/cli.js`. Do not run this file against stale `dist`; record it for Task 5's clean-main build.

- [ ] **Step 6: Run source CLI and static verification**

Run:

```bash
node --import tsx --test tests/platform-release-production-admission-readiness-cli-v2.test.ts
node --import tsx --test tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
node --import tsx --test tests/source-suite-imports.test.ts
git diff --check
```

Expected: all commands exit `0`; the child invocation asserted by the CLI suite exits `2` by contract.

- [ ] **Step 7: Record the Setfarm-owned handoff checkpoint**

Run `git status --short`; verify no runtime guard, database, migration, Mission Control, or production opener file changed. Do not stage or commit.

---

### Task 4: Update current live evidence and run focused plus adjacent regression gates

**Files:**
- Modify: `docs/superpowers/plans/2026-07-26-platform-release-build-and-verifier-plan.md:1-40`
- Test: all Task 1-3 files and the adjacent platform-release suites listed below

**Interfaces:**
- Consumes: the source CLI receipt and current read-only host evidence.
- Produces: a dated checkpoint that distinguishes diagnostic completion from production admission and identifies externally credentialed remaining work.

- [ ] **Step 1: Add the dated implementation checkpoint**

Prepend a `## Autonomous loop checkpoint — 2026-08-12` section. State only machine-verified facts:

```markdown
The credential-free production-admission readiness slice now exposes the
zero-input `setfarm platform-release preflight --json` diagnostic. Its strict
receipt is bounded, canonical, mutation-free, and permanently states
`productionAuthority:false` and `productionAdmission:"blocked"`. It reports
the current host enforcement baseline separately from missing Developer ID
Application/Installer identities, unverifiable external notarization
credentials, absent installed Setfarm distribution/helper evidence,
unconfigured production trust material, and unavailable store/verifier/
activation authorities.

This checkpoint does not sign, notarize, install, query an invented package
identifier, execute a helper, restart a service, or open production authority.
The next production-admission slice remains externally credentialed and must
join an exact signed distribution, stapled ticket, Installer receipt/payload,
authenticated running helper/AMFI observation, prepared store, fresh verifier,
and registry activation authority under a separate approved design.
```

Append exact test counts only after the commands below finish; never copy historical counts.

- [ ] **Step 2: Run the focused and adjacent platform-release matrix**

Run:

```bash
node --import tsx --test \
  tests/execution-attempts/platform-release-production-admission-readiness-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-local-package-trust-audit-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-host-self-observation-native-fixture-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-native-distribution-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-filesystem-backend-v2.test.ts \
  tests/execution-attempts/platform-release-bootstrap-darwin-filesystem-native-fixture-v2.test.ts
node --import tsx --test tests/product-compiler/platform-release-bootstrap-darwin-native-package-member-capture-test-v2.test.ts
node --test \
  scripts/__tests__/build-info-version.test.js \
  scripts/__tests__/build-platform-release-v2.test.js \
  scripts/__tests__/platform-release-bootstrap-darwin-host-self-observation-fixture-v2.test.js \
  scripts/__tests__/platform-release-bootstrap-darwin-filesystem-fixture-v2.test.js \
  scripts/__tests__/platform-release-bootstrap-suspended-exec-controller-fixture-v2.test.js \
  scripts/__tests__/platform-release-content-store-filesystem-fixture-v2.test.js
```

Expected: all processes exit `0`; negative tests assert rejection internally; current production openers remain unavailable.

- [ ] **Step 3: Run all static contracts**

Run:

```bash
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
node --import tsx --test tests/source-suite-imports.test.ts
npm run check:migration-digests
git diff --check
```

Expected: all commands exit `0`. Do not regenerate migration digests because this slice owns no migration.

- [ ] **Step 4: Run an independent adversarial source review**

Give a fresh read-only reviewer the spec and full diff. Require explicit findings for: exported-input authority leaks; command/path/credential injection; raw-output retention; allocation bounds; process containment; path replacement/symlink handling; blocker semantics; self-hash false authority; runtime-guard exception scope; production opener drift; and test-support reachability. Fix every high or medium finding through a new focused failing test, then rerun Steps 2-3 and the reviewer until the verdict is clear.

- [ ] **Step 5: Record the Setfarm-owned handoff checkpoint**

Record exact command counts and the clear reviewer verdict in the checkpoint document, run `git status --short`, and do not stage or commit.

---

### Task 5: Complete broad, full, clean-main, and reviewed-delivery verification

**Files:**
- Verify: all source, tests, docs, generated `dist` output in the clean-main handoff checkout, and GitHub PR state
- Do not modify migration source/digests, runtime guard behavior, production openers, services, database state, signing identities, keychains, Installer receipts, or notarization state

**Interfaces:**
- Consumes: the reviewed Task 1-4 diff and Setfarm-owned Git handoff.
- Produces: broad/full test evidence, a reviewed PR, a clean merged `main`, a clean-main build, source/dist receipt equivalence evidence, and a clean worktree.

- [ ] **Step 1: Run broad source suites**

Run one suite at a time and record exact pass/fail/skip counts:

```bash
npm run test:execution-attempts
npm run test:product-compiler
npm run test:scripts
```

Expected: every command exits `0`. If the same systemic failure recurs three times after a fix, stop and report the exact evidence instead of changing a gate or fixture authority.

- [ ] **Step 2: Run the full source suite**

Run:

```bash
npm test
```

Expected: exit `0`. The preflight CLI child process's exit `2` is captured and asserted by its test harness, not propagated as a suite failure.

- [ ] **Step 3: Perform final independent diff and security review**

Give a fresh read-only reviewer the approved spec, this plan, full diff, focused/adjacent/broad/full evidence, and live receipt. Require a `CLEAR` verdict with no unresolved high or medium finding. Reopen the relevant task and rerun its gates for any actionable finding.

- [ ] **Step 4: Hand the reviewed diff to the authorized Setfarm Git owner**

The authorized Setfarm owner, not an implementation/review agent, must inspect every dirty path, run `git diff --check`, stage the intentional scope, create the feature commit, push `feat/platform-release-production-admission-readiness-v2`, and open a reviewed PR to `main`. The owner must prove the branch and PR contain no secrets, generated binary artifacts, unrelated files, dirty-build bypasses, or runtime-guard bypasses.

- [ ] **Step 5: Merge through review and prepare a clean main checkout**

After required review is satisfied, the authorized owner merges the PR and prepares a clean checkout where:

```bash
git branch --show-current
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD
git rev-parse origin/main
```

Expected: branch is `main`; status output is empty; the two SHAs are identical. Do not synthesize or locally rename a branch to imitate reviewed `main`.

- [ ] **Step 6: Run the guarded clean-main build and compiled CLI tests**

In that exact clean `main` checkout run:

```bash
npm ci
npm run build
node --test dist/cli/cli.test.js
node dist/cli/cli.js platform-release preflight --json
git status --porcelain=v1 --untracked-files=all
```

Expected: install/build/tests exit `0`; the direct compiled preflight exits `2`, emits exactly one JSON line to stdout, and emits nothing to stderr; final Git status is empty. Do not use `SETFARM_ALLOW_DIRTY_BUILD`, `SETFARM_SKIP_RUNTIME_GUARD`, or `--skip-runtime-guard`.

- [ ] **Step 7: Compare source and compiled live receipts without treating occurrence hashes as stable**

Capture source and compiled receipts in separate read-only invocations. Strictly validate both, then compare only `policyHash`, authority literals, blocker order/set, and public classifications. Do not require `observedAt`, `readinessHash`, or per-occurrence observation hashes to match because each invocation is a distinct current observation.

- [ ] **Step 8: Verify final live state and close the goal only with complete evidence**

Verify the worktree is clean, the PR is merged/reviewed, all required gates passed, existing production openers remain unavailable, and the live receipt remains blocked with the correct external-credential blockers. Report explicitly that this slice completes the current diagnostic goal but does not claim production admission, signing, notarization, installation, AMFI runtime admission, prepared-store authority, fresh-verifier authority, or activation authority.
