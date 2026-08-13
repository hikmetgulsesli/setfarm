# Platform Release Production Admission Readiness V2

Date: 2026-08-12
Status: Approved design

## Purpose

Setfarm needs a code-owned, current, read-only answer to a narrow operational
question: why is this Darwin host not ready to admit a platform release into
production?

Today that answer is assembled manually from shell commands and historical
plan notes. The production authority openers remain correctly unavailable, but
operators cannot obtain one bounded, typed receipt that distinguishes missing
credentials, absent installed artifacts, an unverifiable notarization profile,
and host enforcement state. This design adds that diagnostic surface without
creating, approximating, or widening production authority.

The first public surface is:

```text
setfarm platform-release preflight --json
```

The command is zero-input apart from the exact `--json` presentation flag. It
observes code-owned paths, identifiers, tools, and host settings. It never
accepts a path, package identifier, receipt identifier, command override,
callback, environment-derived trust anchor, or serialized evidence object.

## Current Live Truth

The design is based on the 2026-08-12 read-only host audit:

- Gatekeeper assessments, SIP, authenticated root, and the AMFI service are
  enabled. These facts establish only a host enforcement baseline.
- The active login and System keychains contain zero valid code-signing
  identities and zero Developer ID Application or Installer identities.
- No discoverable notarytool profile, conventional API key, or notary
  credential environment is present. Unlisted or externally synchronized
  credentials remain unverifiable rather than absent.
- No Setfarm application, package, disk image, installed bootstrap root, or
  authenticated helper was observed. The production Installer package
  identifier is unconfigured, so no authoritative receipt census was
  attempted.
- The running Setfarm CLI is clean-main JavaScript. Its Homebrew Node runtime
  is ad-hoc signed and has no Developer Team identity. Operational health is not
  platform-release authority.
- Production native-distribution trust configuration is unavailable, and the
  authenticated Darwin filesystem backend opener remains intentionally inert.

The receipt must preserve these distinctions. In particular, a healthy
runtime, an enabled AMFI service, a present certificate, a package receipt, or
a successful Gatekeeper assessment is never sufficient production admission.

## Goals

1. Produce one strict, bounded, canonical receipt from current Darwin host
   observations.
2. Report every remaining production-admission prerequisite with stable typed
   blocker codes.
3. Keep raw command output, certificate identities, keychain contents, and
   credential material out of the public receipt.
4. Make the CLI useful to operators and automation while returning a
   non-success exit status whenever production admission remains blocked.
5. Preserve every existing false-authority boundary and leave all production
   openers, stores, registries, installers, and activation paths unchanged.

## Non-Goals

This slice does not:

- sign code or packages;
- enumerate private keys or return certificate names, fingerprints, subjects,
  serial numbers, Team identifiers, or keychain paths;
- call notarytool submission, history, log, or credential-storage operations;
- build, install, remove, repair, or mutate a package or Installer receipt;
- execute an installed helper or claim AMFI runtime admission;
- accept caller-provided evidence or convert fixture observations into live
  authority;
- issue `PreparedPlatformReleaseV2`, `VerifiedPlatformReleaseV2`, registry,
  release-store, restart, or activation capabilities;
- change the production trust configuration or make the Darwin filesystem
  backend opener available;
- make a clean-main V1 build manifest equivalent to V2 platform-release
  authority.

## Architecture

The slice has three units with one-way data flow:

```text
fixed policy -> bounded Darwin observer -> strict receipt -> CLI renderer
```

### Code-Owned Policy

The policy contains only public, non-secret constants:

- supported platform: `darwin`;
- exact absolute executables and argv used for read-only observation;
- exact installed Setfarm roots and authenticated helper paths;
- required production trust configuration state;
- per-command timeout and stdout/stderr byte caps;
- canonical receipt byte cap; and
- the stable blocker-code ordering.

Policy is not accepted from the environment or CLI. Test fault injection uses a
separate internal test-only adapter that cannot be passed to the production
entry point.

The current production configuration does not define an Installer package
identifier. This version does not invent one and does not run a receipt lookup
with a test or inferred identifier. It reports both
`INSTALLER_PACKAGE_ID_UNCONFIGURED` and
`INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE`. A later version may
observe one exact receipt only after a public, code-owned production package
identifier is configured. Fixture identifiers such as
`com.setfarm.bootstrap.native-v2` remain test-only and are never production
policy.

### Bounded Darwin Observer

The production observer has no arguments. It runs fixed commands with
`shell:false`, a minimal fixed locale, bounded output, bounded duration, and no
stdin. It privately retains bounded stdout and stderr only long enough to parse
the code-owned result and then zeroizes both buffers. The public command
observation records only command kind, executable identity reference, exit
status, signal, the canonical redacted-projection byte length, and a SHA-256
hash of that projection. Raw stdout/stderr byte lengths remain private and are
not serialized for identity or keychain commands because even coarse lengths
could become a stable certificate-set fingerprint. The receipt never publishes
a hash of raw identity or keychain output for the same reason.

The first implementation observes:

- valid identity counts from two separate fixed Security queries: the
  `codesigning` policy for Developer ID Application identities and the `basic`
  policy for Developer ID Installer identities. Public identity labels are read
  ephemerally from bounded output only to classify and count the exact label
  classes, then discarded and zeroized;
- Gatekeeper assessment enablement;
- SIP status and authenticated-root status;
- availability of `codesign`, `spctl`, `pkgutil`, `security`, `notarytool`, and
  `stapler` at exact policy paths;
- metadata-only presence of the finite code-owned notarytool generic-password
  service names, without requesting their passwords, account names, or values;
- presence and stable metadata of the fixed installed Setfarm roots and helper
  paths;
- Installer receipt state only when an exact public production package
  identifier is configured;
- the code-owned native-distribution production trust configuration state;
- the current clean-main build provenance state; and
- whether an independently authenticated installed helper exists from which a
  future AMFI observation could be obtained.

The observer does not use `security dump-keychain`, retrieve a generic
password, inspect a private key, search arbitrary user paths, inspect arbitrary
environment variables, or contact Apple services. It may run a finite set of
exact service-name `security find-generic-password` existence probes without
`-g` or `-w`; any returned metadata is privately discarded. Notary credential
readiness remains `unverifiable_without_external_credential_configuration`
even when known service metadata is present, because metadata does not prove
credential validity, possession, account binding, or Apple acceptance.

`credentialUse:"none"` means the observer does not authenticate, sign, submit,
or unlock anything with a credential. Reading the public classification counts
returned by the fixed `security find-identity` query is a diagnostic
observation, not credential use or proof of possession.

Identity absence conclusions are scoped to the active Security search list
queried by the fixed commands. They do not claim that no identity exists in an
unlisted, locked, externally synchronized, or otherwise inaccessible keychain.

Unsupported platforms return a separate valid blocked receipt with a platform
blocker and literal `not_observed_platform_unsupported` sections. They do not
populate or simulate Darwin evidence.

### Strict Receipt

The receipt is a discriminated union. Its common diagnostic envelope is:

```typescript
type PlatformReleaseProductionAdmissionReadinessV2Common = Readonly<{
  schema: "setfarm.platform-release-production-admission-readiness.v2";
  version: "2.0.0";
  authorityState: "diagnostic_observation_only";
  admissionScope: "production_host_readiness_observation";
  credentialUse: "none";
  mutationAuthority: false;
  productionAuthority: false;
  productionAdmission: "blocked";
  trustConclusion: "characterization_only";
  policyHash: Sha256;
  observedAt: CanonicalUtcTimestamp;
  blockerCodes: readonly PlatformReleaseReadinessBlockerCodeV2[];
  readinessHash: Sha256;
}>;

type CodeSigningIdentityObservationV2 =
  | Readonly<{
      validIdentityCount: 0;
      state: "not_observed_in_active_search_list";
    }>
  | Readonly<{
      validIdentityCount: PositiveSafeInteger;
      state: "present_unjoined";
    }>
  | Readonly<{
      validIdentityCount: null;
      state: "observation_failed";
    }>;

type DarwinPlatformReleaseProductionAdmissionReadinessV2 =
  PlatformReleaseProductionAdmissionReadinessV2Common & Readonly<{
  observedPlatform: "darwin";
  codeSigning: {
    developerIdApplication: CodeSigningIdentityObservationV2;
    developerIdInstaller: CodeSigningIdentityObservationV2;
  };
  notarization: {
    toolAvailability: "available" | "unavailable" | "observation_failed";
    knownProfileMetadata:
      "not_observed_at_known_service_names"
      | "present_unjoined"
      | "observation_failed";
    credentialReadiness:
      "unverifiable_without_external_credential_configuration";
    ticketEvidence:
      "not_observed_without_exact_distribution"
      | "unproven"
      | "observation_failed";
  };
  hostEnforcement: {
    gatekeeper: "enabled" | "disabled" | "observation_failed";
    sip: "enabled" | "disabled" | "observation_failed";
    authenticatedRoot:
      "enabled" | "disabled" | "unsupported" | "observation_failed";
    amfiService: "running" | "not_running" | "observation_failed";
    amfiRuntimeAdmission:
      "unavailable_requires_authenticated_running_helper";
  };
  installedDistribution: {
    expectedRoots: readonly FixedPathPresence[];
    expectedHelpers: readonly FixedPathPresence[];
    installerPackageIdentifier:
      "unconfigured" | "configured_public_value_unjoined";
    installerReceipt:
      "not_observed_configuration_unavailable"
      | "not_observed"
      | "present_unjoined"
      | "observation_failed";
    exactPayloadBinding: "absent" | "unproven";
  };
  productionTrustConfiguration: {
    state: "unavailable" | "configured_public_material_unjoined";
    productionAdmission: "forbidden";
  };
  buildProvenance: {
    state:
      "v1_build_provenance_only"
      | "missing"
      | "invalid"
      | "observation_failed";
    platformReleaseAuthority: false;
  };
  commandObservations: readonly RedactedCommandObservation[];
}>;

type UnsupportedPlatformReleaseProductionAdmissionReadinessV2 =
  PlatformReleaseProductionAdmissionReadinessV2Common & Readonly<{
  observedPlatform: "unsupported";
  codeSigning: { state: "not_observed_platform_unsupported" };
  notarization: { state: "not_observed_platform_unsupported" };
  hostEnforcement: { state: "not_observed_platform_unsupported" };
  installedDistribution: { state: "not_observed_platform_unsupported" };
  productionTrustConfiguration: {
    state: "not_observed_platform_unsupported";
    productionAdmission: "forbidden";
  };
  buildProvenance: { state: "not_observed_platform_unsupported" };
  commandObservations: readonly [];
}>;

type PlatformReleaseProductionAdmissionReadinessV2 =
  | DarwinPlatformReleaseProductionAdmissionReadinessV2
  | UnsupportedPlatformReleaseProductionAdmissionReadinessV2;
```

`RedactedCommandObservation` contains no raw channel hash. Its terminal hash is
computed from the command kind, code-owned executable reference, status,
signal, canonical redacted-projection byte length, and the strict
command-specific redacted result such as identity counts or one enablement
state. Raw channel lengths, identity names, and all other unrecognized text are
discarded before hashing and are never serialized.

The Application and Installer identity observations are independent. Their
discriminated union requires count `0` exactly when nothing was observed in the
active search list, a positive safe integer exactly when identities are present
but unjoined, and `null` exactly when observation failed. Failure of one query
neither erases nor fabricates the other query's result.

All objects are strict and recursively frozen. Counts and collections have
small fixed maxima. The schema recomputes every nested observation hash, the
policy hash, canonical blocker ordering, and the terminal `readinessHash`.
Unknown fields, accessors, proxies, cycles, oversized candidates, reordered
blockers, and fully rehashed values that violate a code-owned semantic
invariant are rejected.

The serialized receipt is not authenticated evidence. Any process can create a
self-consistent diagnostic object and recompute its hashes. Hashes provide
structural and semantic consistency only; they do not prove origin, freshness,
or host occurrence. Current-origin characterization exists only while the
zero-input production observer returns its in-process result directly to the
CLI. There is no public parser, file loader, database loader, or caller-supplied
receipt path that can recreate an observation occurrence or satisfy any
production authority gate.

`observedAt` labels the observation occurrence only. It is not a trusted clock,
freshness lease, monotonic epoch, or production-admission discriminator.

The public receipt contains no raw stdout/stderr, certificate data, usernames,
home paths, keychain locators, package payload paths outside fixed public
policy, process identifiers, environment values, or secrets.

## Blocker Taxonomy

The initial finite blocker set is:

- `PLATFORM_UNSUPPORTED`
- `DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED`
- `DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED`
- `CODE_SIGNING_IDENTITY_OBSERVATION_FAILED`
- `DEVELOPER_ID_TEAM_UNCONFIGURED`
- `DESIGNATED_REQUIREMENT_UNCONFIGURED`
- `INSTALLER_PACKAGE_ID_UNCONFIGURED`
- `OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED`
- `SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY`
- `NOTARYTOOL_UNAVAILABLE`
- `NOTARYTOOL_OBSERVATION_FAILED`
- `NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE`
- `NOTARIZED_DISTRIBUTION_UNPROVEN`
- `GATEKEEPER_DISABLED`
- `GATEKEEPER_OBSERVATION_FAILED`
- `SIP_DISABLED`
- `SIP_OBSERVATION_FAILED`
- `AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE`
- `AMFI_SERVICE_UNAVAILABLE`
- `AUTHENTICATED_RUNNING_HELPER_ABSENT`
- `AMFI_RUNTIME_ADMISSION_UNPROVEN`
- `INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE`
- `INSTALLED_SETFARM_ROOT_ABSENT`
- `INSTALLED_HELPER_ABSENT`
- `EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN`
- `PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE`
- `V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE`
- `PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE`
- `FRESH_VERIFIER_AUTHORITY_UNAVAILABLE`
- `REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE`
- `HOST_OBSERVATION_INCOMPLETE`

Blockers are emitted once in code-owned order. Successful observation removes
only the blocker directly proven by that observation. For example, a present
Installer receipt does not remove exact payload, notarization, Developer ID,
or AMFI blockers.

This version cannot produce an empty blocker list. The strict schema requires
`productionAuthority:false`, `productionAdmission:"blocked"`, and at least the
unimplemented store, verifier, and activation blockers. A later production
admission design must define a new authority-bearing schema and opener rather
than widening this diagnostic receipt.

## CLI Contract

The command accepts exactly:

```text
setfarm platform-release preflight --json
```

Unknown flags, positional values, repeated flags, and missing `--json` are
usage errors.

The exact preflight argv is recognized before the normal runtime release guard
and dispatched only to this zero-input, read-only observer. This narrow routing
exception does not change the guard used by any other command and grants no
runtime, migration, build, or release capability. It is required so a missing
or invalid build-provenance state can be reported instead of terminating before
the diagnostic receipt is constructed.

Behavior:

- exit `2`: observation completed and emitted one canonical blocked receipt;
- exit `1`: an internal failure prevented construction of a complete,
  schema-valid diagnostic receipt;
- exit `0`: reserved for a future, distinct authority-bearing command and not
  reachable in this version.

Stdout contains exactly one canonical JSON line on exit `2`. Stderr is empty.
On exit `1`, stdout is empty and stderr contains one bounded stable error code,
not command output or localized diagnostic text.

The CLI usage text explicitly labels the command as read-only readiness
diagnostics. It must not say that clean main, a healthy runtime, or a blocked
receipt is a verified release.

## Error Handling

Every command has a fixed timeout, an output cap enforced while reading, and a
bounded kill/reap path. The observer preserves the first terminal cause. A
spawn failure, timeout, malformed output, excessive output, inconsistent
before/after fixed-path observation, or policy drift becomes a typed
observation failure and a blocker. It is never converted into evidence that a
credential or artifact is absent.

Stable path presence uses non-following metadata inspection. Symlinks, special
files, hard-linked helpers, identity replacement between captures, and
unexpected ownership or mode are `unproven`, never accepted. This diagnostic
slice performs no destructive cleanup.

## Security And False-Authority Invariants

1. No public or exported input can name an executable, path, receipt, package,
   keychain, identity, trust anchor, or helper.
2. The production observer is zero-input and reads only code-owned constants.
3. Test adapters and fixture receipts cannot be supplied to the production
   observer or CLI.
4. Command success is an observation, not authority. Raw localized prose is
   never interpreted as a positive trust statement.
5. Gatekeeper is not AMFI. AMFI service presence is not authenticated runtime
   admission.
6. Certificate presence is not possession, validity for the intended package,
   notarization, installation, or payload identity.
7. Installer receipt presence is metadata and cannot authenticate current
   payload bytes.
8. Clean-main V1 build provenance is not V2 platform-release authority.
9. The existing production host-composition, filesystem backend, store,
   verifier, and activation openers remain inert.
10. No receipt field, exit status, or CLI label implies production readiness.

## Testing

### Unit And Schema

- canonical happy-path blocked receipt;
- exact blocker ordering and uniqueness;
- recursive freeze and canonical-size cap;
- unknown field, proxy, accessor, cycle, and oversized input rejection;
- tampered nested hashes and fully rehashed code-owned invariant violations;
- explicit proof that a fully rehashed serialized receipt remains
  unauthenticated and cannot enter an authority-bearing API;
- impossible positive combinations rejected;
- one failed Security query preserves the other query's exact observation and
  uses `null` only for the failed count;
- raw credential, certificate, user path, environment, and command-output
  fields absent from public data; and
- production-authority literals cannot be changed.

### Darwin Integration

- the current host produces a blocked receipt without credential access or
  mutation;
- zero signing identities are classified as not observed in the active
  Security search list;
- enabled Gatekeeper/SIP/AMFI service do not remove AMFI runtime blockers;
- absent fixed roots and helpers, an unconfigured production package
  identifier, unobserved receipt state, and unavailable V2 trust configuration
  produce their independent blockers;
- every executed command uses exact argv, environment, timeout, and output cap;
- command timeout, spawn failure, output overflow, and malformed output remain
  observation failures rather than absence claims; and
- fixed-object replacement and symlink cases fail closed in the test adapter.

### CLI

- exact JSON output and exit `2` for a complete blocked observation;
- stdout/stderr separation;
- missing, repeated, or unknown arguments fail usage;
- no ambient CLI arguments reach the observer; and
- CLI source and compiled-dist behavior agree after a clean build.

### Adjacent And Broad Verification

The required matrix is:

1. focused readiness schema, observer, and CLI tests;
2. local package trust audit, host self-observation, native distribution,
   filesystem backend, native package member capture, and builder-script tests;
3. TypeScript no-emit, English, path, source-import, and migration-digest
   contracts;
4. full execution-attempt, product-compiler, and script suites;
5. full `npm test`;
6. independent adversarial review of false-authority and allocation bounds; and
7. clean-main `npm run build`, compiled CLI invocation, and live read-only
   receipt comparison.

The same systemic failure repeating three times after a fix attempt stops the
loop and is reported without weakening the gate.

## Delivery

Implementation should remain a small root slice:

- one strict schema and policy module;
- one zero-input Darwin observer module;
- one CLI routing addition;
- focused tests and the required adjacent regressions; and
- a short update to the existing platform-release implementation plan with
  current live evidence.

No database migration, Mission Control change, installer mutation, signing,
notarization, service restart, or production opener change belongs in this
slice.

## Completion Criteria

This slice is complete only when:

1. the CLI emits a current, bounded, canonical blocked receipt on the real
   host;
2. the receipt accurately distinguishes absent, unproven, and unverifiable
   evidence;
3. no secret or raw identity data is retained or emitted; bounded public
   identity labels may be read ephemerally only to derive counts and are then
   zeroized;
4. all existing production authority openers remain unavailable;
5. focused, adjacent, broad, full, and clean-main verification pass;
6. independent review reports no unresolved high or medium finding; and
7. the implementation is delivered through a reviewed PR with a clean
   worktree.

This slice does not complete platform-release production admission. It replaces
manual and stale readiness claims with a code-owned in-process current
diagnostic observation, so the next externally credentialed slice can start
from explicit, machine-verifiable blockers without fabricating authority.
