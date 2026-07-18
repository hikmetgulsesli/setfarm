# Platform Release and Evidence Adapter Authority V2

Date: 2026-07-18
Status: approved target architecture; implementation slices remain shadow until
the final clean-main release activation

## Decision

Setfarm will replace caller-authored release and adapter claims with one
filesystem-reproduced release authority:

```text
clean main source tree
  -> empty private staging directory
  -> exact build plus bundled legacy assets and production dependencies
  -> existing CanonicalRuntimeTreeV2 every-and-only byte closures
  -> exact external runtime resolution
  -> sealed environment capsule
  -> code-owned launcher, runner, profile, transport, receipt, and adapter catalogs
  -> terminal PlatformReleaseManifestV2
  -> immutable release directory
  -> fresh verifier and in-memory authority brand
  -> activation-derived EvidenceAdapterRegistryV2
  -> atomic CAS publication and append-only activation request/acknowledgement
```

`PlatformReleaseManifestV1` remains historical read-only. No new V1 manifest or
registry is production authority after V2 activation. There is no V1/V2
fallback, dual active registry, caller-supplied adapter descriptor, or mutable
`dist` authority in the V2 path.

The first V2 implementation slices are shadow-only. Production activation,
deployment, and new V2 clean runs remain forbidden until every blocker in this
document is closed on clean `main`.

## Why This Boundary Exists

The current V1 manifest binds only Git SHA and the Stitch converter
(`src/execution/schemas/platform-release-manifest-v1.ts`). The build writes into
the existing `dist`, so files emitted by an older build can survive. Runtime
attestation reads the converter from mutable repository `scripts`, not from the
release bundle (`src/execution/platform-release-attestation.ts`).

The current evidence registry accepts `producer`, `releaseAuthority`, adapter
descriptors, support signatures, runner refs, dependency refs, and toolchain
hashes from its caller. Verification recompiles the same claims rather than
discovering release truth (`src/evidence/evidence-adapter-registry-v1.ts`). The
schema names runner entrypoints that do not exist as exported modules. Runtime
drivers inherit ambient `process.env`, browser fallback can use a shell, and port
allocation releases the socket before spawn.

A hash over those claims proves only internal consistency. It does not prove
that the deployed bytes, executable, environment, runner export, or product
profile can perform the promised evidence operation.

## Authority Types

Three in-memory brands separate production stages. They are module-private
`WeakSet` capabilities and cannot be serialized or reconstructed by a caller.

```ts
type PreparedPlatformReleaseV2 = Readonly<{
  readonly releaseId: string;
}>;

type VerifiedPlatformReleaseV2 = Readonly<{
  readonly releaseId: string;
}>;

type ActivatedPlatformReleaseV2 = Readonly<{
  readonly releaseId: string;
  readonly activationAcknowledgementHash: Sha256;
}>;
```

These public objects are opaque handles. Authoritative roots, manifests,
canonical bytes and catalog state live only in module-private `WeakMap` records;
the membership brands are module-private `WeakSet`s. Inspection returns a deep-
frozen DTO and any byte getter returns a new copy. A handle never exposes a
shared `Uint8Array` or mutable nested manifest.

The prepared brand is issued only by the clean-main builder after a publication
lease owns the exact candidate and the completed stage has been durably renamed
to its immutable content-addressed root. The verified brand is issued only by a
fresh verifier after filesystem enumeration, catalog/module reproduction and
external-resolution verification. The activated brand additionally requires a
durable observed activation acknowledgement. Manifest JSON alone is never an
authority object.

After restart, brands are rehydrated only by a root-owned, separately installed
Release Bootstrap V2 whose executable/module hash is pinned by host admission,
not by the candidate release it verifies. `loadActivatedPlatformReleaseV2()`
replays the append-only activation request/acknowledgement chain, reads exact CAS
bytes, fresh-verifies the release filesystem and external authority, and only
then issues a new activated handle. Candidate bytes cannot self-authorize by
running their own verifier.

## PlatformReleaseManifestV2

The canonical manifest is strict and at most 3 MiB. The lower payload ceiling is
intentional: prepared publication must prove that the complete artifact
envelope, including producer metadata, stays within the existing 4 MiB CAS item
limit before any write:

- `PlatformRuntimePayloadCandidateV2`: at most 64 KiB canonical JSON;
- `EvidenceEnvironmentCapsuleCandidateV2`: at most 64 KiB canonical JSON;
- `ExternalRuntimeResolutionCandidateV2`: at most 2 MiB canonical JSON;
- the complete manifest, including all nested catalogs and structural overhead:
  at most 3 MiB canonical JSON.

Component parsers and their exported candidate schemas enforce the same limits;
a structurally valid but over-budget nested object is not a valid component.
The root builder additionally enforces the combined limit and the actual CAS
envelope limit, so individual component validity never implies compositional
publication success.

```ts
type PlatformReleaseManifestV2 = {
  schema: "setfarm.platform-release-manifest.v2";
  manifestVersion: 2;

  release: {
    codeSha: GitObjectHash;
    sourceTreeHash: GitObjectHash;
    branch: "main";
    dirty: false;
    sourceAdmission: {
      remoteRef: "refs/remotes/origin/main";
      admittedSha: GitObjectHash;
      policy: "exact_remote_main_sha";
      admissionEvidenceHash: Sha256;
    };
    packageName: "setfarm";
    packageVersion: string;
  };

  build: {
    contractVersion: "2.0.0";
    inputs: [
      ExactSourceRef<"package-lock.json">,
      ExactSourceRef<"package.json">,
      ExactSourceRef<"tsconfig.json">
    ];
    compiler: {
      packageName: "typescript";
      version: string;
      lockEntryHash: Sha256;
      packageJsonHash: Sha256;
      packageTreeHash: Sha256;
    };
    packageManager: {
      packageName: "npm";
      version: string;
      executable: ExactExternalExecutableRefV2;
      packageTreeHash: Sha256;
    };
    sourceStage: {
      method: "verified_git_tree_export.v2";
      exportedTreeHash: GitObjectHash;
      exportedFileTreeHash: Sha256;
      mode: "read_only";
    };
    commandRef: "BUILD_PLATFORM_RELEASE_V2";
    outputPolicy: "parameterized_empty_stage_only";
    sourceDateEpoch: string;
    reproducibility: "double_clean_build_exact_tree_match";
  };

  runtimePayload: {
    rootLocator: "payload";
    allowedRootEntries: ["dist", "node_modules", "package.json"];
    platformTree: CanonicalRuntimeTreeBindingV2<"dist", "payload/dist">;
    dependencyTree: CanonicalRuntimeTreeBindingV2<
      "dependencies",
      "payload/node_modules"
    >;
    packageJson: ExactBundledFileRefV2<"payload/package.json">;
    ownership: {
      ownerUid: number;
      ownerGid: number;
      runtimeUid: number;
      runtimeMustNotOwnRelease: true;
      rootMode: "0555";
    };
    runtimePayloadHash: Sha256;
  };
  externalResolution: ExternalRuntimeResolutionV2;
  environmentCapsule: EvidenceEnvironmentCapsuleV2;
  profileCatalogBindings: ProfileCatalogBindingV2[];
  launcherCatalog: PlatformLauncherCatalogV2;
  runnerCatalog: PlatformRunnerCatalogV2;
  transportCodecCatalog: InvocationTransportCodecCatalogV2;
  receiptSchema: EvidenceReceiptSchemaBindingV2;
  adapterDefinitionCatalog: EvidenceAdapterDefinitionCatalogV2;

  legacyAssets: {
    stitchConverter: ExactBundledFileRefV2;
  };

  manifestPayloadHash: Sha256;
};
```

`manifestPayloadHash` is a domain-separated canonical hash of every field except
itself. Nested catalogs have their own domain-separated payload hashes. Catalog
hashes are included in the manifest, so a self-consistent nested rehash changes
the release identity and cannot pass an existing activation anchor.

## Runtime Payload Closure

V2 does not create a second byte-tree format. It reuses the existing
`CanonicalRuntimeTreeV2` capture and fresh-verification authority. That
primitive already binds canonical order, complete directory topology including
empty directories, exact byte length/hash/mode, counts and total bytes; rejects
path traversal, backslash, NUL, non-portable ASCII, case-fold collision,
symlink, hardlink, socket, FIFO, device, ACL/xattr and concurrent mutation; and
requires final read-only `0444`/`0555` modes.

The release has one exact layout:

```text
<releaseRoot>/
  PLATFORM_RELEASE_MANIFEST.v2.json
  payload/
    package.json
    dist/
    node_modules/
```

The manifest is adjacent to, never inside, `payload`. Therefore the `dist` and
`node_modules` captures have no manifest exclusion and fresh verification can
require every-and-only equality without a special-case path. `payload` itself
contains exactly the three listed entries. `package.json` is the exact
committed source byte ref and is required for the Node ESM package boundary.

The manifest stores bounded `CanonicalRuntimeTreeBindingV2` summaries, not the
potentially multi-megabyte entry arrays. Each summary binds profile, exact root
locator, `treeHash`, `payloadHash`, file/directory counts and total bytes. The
builder derives it only from a fresh full capture; the verifier re-captures the
full tree and compares the summary. The existing `dist` limits are 20,000 files,
4,000 directories, 64 MiB per file and 512 MiB total. The existing
`dependencies` limits are 100,000 files, 20,000 directories, 512 MiB per file
and 2 GiB total. Schema pre-refinement remains bounded at 120,000 entries.

```ts
type CanonicalRuntimeTreeBindingV2 = {
  schema: "setfarm.canonical-runtime-tree-binding.v2";
  treeSchema: "setfarm.canonical-runtime-tree.v2";
  profile: "dist" | "dependencies";
  rootLocator: "payload/dist" | "payload/node_modules";
  treeHash: Sha256;
  treePayloadHash: Sha256;
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  bindingHash: Sha256;
};
```

`bindingHash` is the canonical hash of
`{schema:"setfarm.canonical-runtime-tree-binding-payload.v2", binding}` without
the hash field. `runtimePayloadHash` is the canonical hash of
`{schema:"setfarm.platform-runtime-payload-binding-payload.v2",
runtimePayload}` without that hash field. A public schema parser only produces a
candidate DTO. The internal builder projection accepts the direct result of its
own fresh full-tree capture; the verifier independently captures the full tree,
derives a new summary and compares canonical bytes. A caller-supplied summary is
never promoted by rehashing it.

`ReleaseLayoutV2` fresh-enumerates the release root and requires exactly
`PLATFORM_RELEASE_MANIFEST.v2.json` plus `payload`; `RuntimePayloadLayoutV2`
requires exactly `package.json`, `dist` and `node_modules`. Both snapshot/rescan
directory identity and entry names. Root/payload/tree directories are `0555`;
manifest and package JSON are stable, single-link `0444` regular files. The
manifest reader caps raw bytes before JSON parse and requires exact canonical
JSON plus one trailing newline. The canonical manifest itself remains outside
the two tree hashes but is bound by the activation/CAS hash.

Production dependencies are installed or materialized from the exact lock
resolution into the private stage, not linked to workspace `node_modules`.
Package-manager `.bin` symlinks are removed after their targets have been
verified because V2 launchers use exact absolute executable/module refs and
never `PATH`; every remaining symlink is forbidden. The dependency tree is then
made read-only before capture.

Read-only mode is not called hostile same-user immutability. Production release
roots are owned by a root-owned installer identity and runtime services use a
different unprivileged UID that cannot `chmod` or replace them. The manifest
binds expected owner/group IDs and the bootstrap checks them. Without that OS
ownership separation, CanonicalRuntimeTreeV2 proves accidental/concurrent drift
only and production activation remains blocked. Bootstrap keeps verified
root/payload directory descriptors and inode identity for the process lifetime
and fresh-verifies again on every process start.

The Stitch converter is copied to
`payload/dist/legacy-assets/stitch-to-jsx.mjs`. Runtime never reads mutable
repository `scripts` after release preparation.

Payload bytes contain no wall-clock build time, random UUID, PID or temporary
path. `sourceDateEpoch` is derived from the exact committed Git object and is
the only build-time clock input. Operational build/activation timestamps live
in the append-only activation event outside the release payload. Clean-main
activation requires two independent empty-stage builds to produce equal
runtime-tree bindings before either can be selected.

## External Runtime Resolution

The manifest binds the exact runtime outside the two canonical payload trees:

- host TCB identity: macOS product version/build, Darwin kernel release,
  platform/architecture, separately installed root-owned bootstrap executable
  and module absolute locators/hashes/byte lengths/modes, runtime UID/GID, and
  resolved non-system dynamic-library hashes; a payload-relative bootstrap
  locator is invalid; OS-provided system
  libraries are explicitly trusted only under that exact OS build identity;
- Node version, modules ABI, N-API version, platform, architecture, absolute
  executable locator, executable SHA-256, and byte length;
- every executable ref used by a launcher or runner;
- the exact production package-lock resolution graph used to materialize the
  verified `payload/node_modules` tree;
- exact npm version/executable/package tree, install flags, config hash,
  lifecycle-script policy and one actual `NpmMaterializationReceiptV2`. The
  receipt binds recipe hash, npm identity, lockfile identity,
  `payload/node_modules`, produced dependency-tree hash, resolved package count,
  forbidden lifecycle scripts and exit code zero; a receipt-schema hash alone is
  insufficient;
- `MetadataProbeAuthorityV2`: bootstrap module/export, exact xattr/ACL tool
  executable refs, canonical clear-policy hash and probe-receipt schema hash.
  Its bootstrap module uses the same `ExactHostOwnedFileRefV2` shape as the
  release bootstrap: absolute realpath, hash, byte length, root UID/GID, mode and
  host-admission evidence hash. A module under candidate `payload` is invalid;
- browser runtime as either `forbidden` or one exact Playwright Chromium
  package/revision/executable closure. The exact branch also binds the complete
  external Chromium bundle root with canonical runtime-tree schema/profile,
  tree/payload hashes, counts/bytes and executable-relative locator; hashing one
  executable without its companion resource tree is invalid;
- one domain-separated external-resolution hash.

Runtime browser installation, Chrome channel fallback, `PATH` search, and shell
fallback are forbidden. A required executable missing from the verified
resolution is a typed activation blocker, not an implementation retry.

The eventual root manifest parser performs explicit component joins, not merely
independent nested parsing: payload `runtimeUid` equals host runtime UID;
environment network `hostRuntimeIdentityHash` equals external host identity;
environment `metadataProbeAuthorityHash` equals the single full external
metadata-probe authority; payload dependency-tree hash equals the npm receipt and
package-graph materialized tree hash; and every launcher/runner/tool/browser ref
has exactly one compatible external resolution. Any mismatch is a manifest
schema failure before publication.

## Sealed Environment Capsule

```ts
type EvidenceEnvironmentCapsuleV2 = {
  schema: "setfarm.evidence-environment-capsule.v2";
  version: "2.0.0";
  childProcess: {
    inheritAmbientEnvironment: false;
    shell: "forbidden";
    executableResolution: "manifest_exact_absolute";
    baseEnvironment: {
      CI: "true";
      LANG: "C.UTF-8";
      LC_ALL: "C.UTF-8";
      NO_COLOR: "1";
      TZ: "UTC";
    };
    runtimeTokens: [
      "HOST",
      "HOME",
      "PORT",
      "RUNTIME_URL",
      "RUN_CACHE_DIR",
      "RUN_HOME",
      "RUN_TMPDIR",
      "TEMP",
      "TMP",
      "TMPDIR"
    ];
    credentialRefs: [];
    cwdPolicy: "candidate_runtime_bundle_descendant_only";
    umask: "0077";
  };
  network: {
    mode: "loopback_only";
    outboundInternet: "forbidden";
    dns: "forbidden";
    authority: {
      schema: "setfarm.network-isolation-authority.v2";
      enforcementRef: "ENV_SANDBOX_MACOS_V2";
      wrapperModuleLocator: "dist/execution/network-sandbox-v2.js";
      wrapperExport: "runNetworkIsolatedV2";
      wrapperModuleHash: Sha256;
      sandboxExecutableRef: "EXEC_MACOS_SANDBOX_EXEC_V2";
      canonicalProfileHash: Sha256;
      hostRuntimeIdentityHash: Sha256;
      negativeProbeReceiptSchemaHash: Sha256;
      authorityHash: Sha256;
    };
  };
  portLease: {
    mode: "exclusive_socket_lease";
    host: "127.0.0.1";
    bandsHash: Sha256;
  };
  filesystem: {
    releaseRoot: "immutable_read_only";
    runtimeScratch: "attempt_scoped";
    metadataProbeAuthorityHash: Sha256;
  };
  environmentCapsuleHash: Sha256;
};
```

Child environments are constructed from this allowlist plus attempt-scoped
runtime tokens. `HOME` must equal `RUN_HOME`; `TMPDIR`, `TMP`, and `TEMP` must
all equal `RUN_TMPDIR`. Both directories are private descendants of the
attempt-scoped runtime allocation. `process.env` spread, the real user home and
shared system temporary directories are forbidden. Credential references remain
empty until a separate secret authority exists.

The full `MetadataProbeAuthorityV2` occurs exactly once in external runtime
resolution. The environment capsule carries only its authority hash; the root
manifest verifier requires exact equality. Duplicating the whole caller-shaped
object in both components would create two independently hashable truths.

The network fields are promises only when the authority resolves to a real,
verified release wrapper plus exact host sandbox executable/profile/OS build and
a bounded negative outbound-network/DNS/redirect probe receipt. The first macOS
implementation must reuse or replace the existing Darwin runtime-isolation
mechanism under this exact schema; prose does not authorize it. A schema-valid
capsule without that join is shadow-blocked; environment variables alone never
prove loopback-only isolation.

Port allocation returns a held listening socket lease. For the HTTP profile the
platform launcher, not generated application prose, owns the Node HTTP server;
it passes the listening handle to the child and attaches the generated exact
handler export under a versioned ABI. The lease remains owned until that
handle/handler handoff is acknowledged or the start attempt fails.
Check-then-close allocation and a generic `app.listen(PORT)` preview command are
not evidence authority.

## Launchers and Runners

Launchers and runners are code-owned definitions materialized against exact
release bytes. The first launcher refs are:

- `LAUNCH_NODE_CLI_V2` for the exact Node CLI ProfileV2;
- `LAUNCH_NODE_EXPRESS_API_V2` for the exact Node Express API ProfileV2.

Each launcher entry binds invocation kind, module locator, export name, module
file hash, runner ref, executable ref, environment capsule hash, and launcher
ABI hash.

The first runner exports are real modules:

- `ENTRY_EVIDENCE_COMMAND_V2`;
- `ENTRY_EVIDENCE_CLI_PROCESS_V2`;
- `ENTRY_EVIDENCE_HTTP_SERVICE_V2`.

Every module exports `runEvidenceAdapterV2`. The operational runner ABI accepts
only a branded `ActivatedPlatformReleaseV2`, a branded exact candidate launch
target/runtime bundle, an executable transport binding, sealed runtime
allocation and a bounded check request. Verified-but-never-activated or rolled-
back releases cannot execute evidence. It returns one durable
`EvidenceOutcomeV2`; it cannot accept an arbitrary command string, environment
map, runner locator, adapter ref, mutable worktree path or expected product value
from generic caller prose.

`toolchainHash` binds runner entrypoint ref, module hash, runner ABI hash, both
canonical runtime-tree hashes, runtime-payload hash, exact external dependency
resolution hashes, environment capsule hash, launcher catalog hash, transport
codec catalog hash, and receipt schema hash.

## InvocationInputTransportV2

The browser-specific `ActionInputTransportV2` remains historical and cannot be
laundered into CLI or HTTP support. A separate strict transport artifact is
compiled from ProductSpecV2 invocation semantics:

```ts
type InvocationInputTransportV2 =
  | CliInvocationInputTransportV2
  | HttpInvocationInputTransportV2;
```

This is the release-neutral intent artifact. Both variants normatively bind
`productSpecHash`, `actionRef`, domain-separated `actionInvocationIntentHash`,
fresh `deliverySelectionHash`, profile catalog/version/hash, selected profile
ID/hash, exact stack-pack/topology/policy hashes, launcher ref, codec-catalog
hash and `contractHash`. A separate
`ExecutableInvocationTransportBindingV2`, produced only from a verified release,
adds manifest, launcher-module, runner-module, environment and toolchain hashes.
Operational execution requires that binding under an activated handle; the
intent artifact alone never means runnable support.

The artifact is action-level, never one artifact per field. CLI transport binds
exact subcommand tokens, every field name/type, argv/stdin channels,
result/failure ABI, codecs, and a transport hash. HTTP transport binds exact
method, route template, path/query/JSON-body channels, result/failure status ABI,
codecs, and a transport hash. ProductSpecV2 does not currently own a header
input channel, so V2 transport cannot invent one. Every logical input field
appears exactly once; transport channels are collision-free; unknown or missing
fields reject. No DOM selector or browser control appears in this artifact.

Codec definitions are code-owned compositions of value codecs and channel
codecs. They cover string, finite number, boolean, enum, canonical JSON object,
and canonical JSON array without coercion across argv token/flag/stdin JSON and
RFC3986 path/query/HTTP JSON-body channels. Date and datetime remain unsupported
until external serialization/normalization semantics are versioned. Optional,
default and absence semantics are also unsupported in the first profile. The
transport compiler accepts no caller-authored codec, command, route, or result
mapping.

“Without coercion” means the typed input must validate exactly before
serialization; it does not pretend argv/query are non-text. Number/boolean/enum
have versioned canonical text encodings, path/query use exact uppercase-hex
RFC3986 percent encoding with duplicate keys forbidden, JSON channels preserve
JSON types, and stdout/body decoders have explicit byte/depth/item caps. Optional,
date or datetime rejection is the typed
`INVOCATION_TRANSPORT_V2_PROFILE_UNSUPPORTED_INPUT_TYPE` blocker, not a generic
schema/classifier failure.

The first result ABI uses one code-owned `STRICT_JSON_RESULT_DECODER_V2` policy:
fatal round-tripping UTF-8, strict JSON grammar, duplicate decoded object keys
rejected, finite numbers only, Unicode-scalar/NUL-free strings, a 1 MiB response
limit, depth 64, 100,000 total value nodes and 10,000 entries in any one object
or array. CLI success decodes the bounded stdout body; one declared non-zero exit
code decodes the bounded stderr body. HTTP success/failure decodes the bounded
response body selected by the exact status code. Unknown exit/status codes,
missing result/error pointers, a non-string error code/message, or an observed
error code different from the declared failure case are typed protocol failures.
The pure decoder may snapshot raw `Uint8Array`/`Buffer` input but rejects proxies,
shared memory, custom subclasses and mutation during copy. Like the request
encoder, it carries no executable, environment, origin, runner or release
authority; operational use still requires the verified-release binding.

Every result JSON Pointer is itself Unicode-scalar and NUL-free. Object traversal
uses exact own decoded keys; array traversal accepts only canonical decimal
indices (`0` or a non-zero digit followed by digits) that are strictly below the
array length. Array pseudo-properties such as `length`, leading-zero aliases and
caller-added properties are never JSON values. Decoder depth counts the root as
zero, so exactly 64 nested containers are admitted and 65 are rejected.

Compilation is a pure shadow ProductSpecV2 + fresh-verified delivery selection
projection and does not require a release brand. Operational encoding/execution
does: a compiled transport becomes usable only after exact launcher/runner/
receipt modules are joined through `VerifiedPlatformReleaseV2`. The pure request
encoder returns only CLI `{subcommandTokens, argvSuffix, stdinBytes}` or HTTP
`{method, pathAndQuery, fixedHeaders, bodyBytes, redirectPolicy}`. Executable,
cwd, base command/origin, port, environment and network authority remain in the
launcher/sealed-runtime layer.

The contract binds declared failure ABI structurally, but first activation does
not claim failure-path behavioral evidence. That requires versioned negative
scenarios; a success-only sample cannot prove error behavior.

## Candidate Build and Launch Authority

Platform release authority proves the evidence engine bytes, not the generated
candidate bytes. A runner may never launch mutable worktree `dist`, workspace
`node_modules`, a preview command, or an inferred entrypoint. Three additional
artifacts close that separate authority chain:

```text
exact admitted candidate source
  -> CandidateBuildReceiptV2
  -> CandidateRuntimeBundleV2
  -> CandidateLaunchTargetV2
  -> ActivatedPlatformReleaseV2 runner
  -> EvidenceOutcomeV2 / EvidenceReceiptV2
```

`CandidateBuildReceiptV2` binds source commit/tree, Product Build Packet,
BuildTopology, exact code-owned build command/toolchain/environment, start/end
source identity and the fresh output-tree hash. `CandidateRuntimeBundleV2`
materializes build output plus exact candidate production dependencies into an
attempt-scoped private read-only root and binds a fresh canonical full-tree
identity; it does not symlink the worktree. `CandidateLaunchTargetV2` binds that
bundle, selected profile/stack/launcher, exact module/argv target, export name,
module hash, transport hash and launch ABI.

The CLI target fixes an empty Node-option tuple, the exact bundled module as the
first module argument, and transport-provided user arguments only after that
module. The duplicated module-argument locator must equal the content-addressed
module ref. Thus “argv owned by transport” cannot leave the actual Node module
position or ambient Node options implicit.

The candidate bundle does not expand the already-observed
`CanonicalRuntimeTreeV2` profile enum and never launders the `dependencies`
profile into a whole application tree. Its logical root is exactly
`candidate-bundle` with mode `0555` and exactly three entries:
`application`, `node_modules`, and `package.json`. `application` is a fresh
`dist`-profile canonical tree; `node_modules` is a fresh `dependencies`-profile
canonical tree; `package.json` is one exact read-only bundled-file ref. A
domain-separated `bundleClosureHash` binds the exact root layout, both complete
tree bindings and package file. Fresh verification enumerates the root and
reproduces both every-and-only subtrees, so two subtree summaries cannot hide a
fourth root entry. The application tree must exactly equal the build receipt's
fresh `candidate-build-output` tree identity.

Candidate dependency materialization has its own receipt because the platform
release npm receipt fixes `payload/node_modules` as its output root. The
candidate receipt instead fixes `candidate-bundle/node_modules` and binds the
candidate lockfile, code-owned install recipe, exact npm identity, resolved
package graph, produced dependency tree, package count, forbidden lifecycle
scripts and exit code zero. Reusing the platform receipt with a different root
or accepting only a caller-selected receipt-schema hash is invalid. The recipe
embeds one exact code-owned npm config hash and one code-owned candidate receipt
ABI-policy hash; both are versioned artifacts with literal hash goldens. The
lockfile, observed npm identity, graph and produced tree remain candidate claims
until the later private materializer/verifier reproduces them.

These DTOs contain logical locators and content identities, never a mutable
worktree path or an absolute attempt directory. Candidate build requires
`sourceBefore === sourceAfter`, one exact selected topology build command,
packet-envelope and topology hashes, exact environment/toolchain bindings, exit
code zero and a bounded domain-separated receipt hash. Filesystem roots and held
descriptors remain private records behind the later candidate verifier brand.

For API, the launch target contains `HttpHandlerExportV2`: exact bundled module,
export and handler ABI that the platform-owned server attaches to its handed-off
socket. Existing `npm run start`, generic `app.listen(PORT)` and mutable preview
commands are unsupported. ProfileV2 stays `shadow_blocked` until the upstream
BuildTopology/Packet/SourceMap compiler produces this exact export contract.

All three artifacts are bounded, canonical and content-addressed. The runtime
bundle is fresh-verified immediately before launch. A runner accepts a branded
candidate launch target plus an `ActivatedPlatformReleaseV2`; source revision
alone cannot authorize ignored/stale generated output or dependencies.

The schema-only slice exports strict candidate parsers and hash functions, but
no `verify`, `issue`, `materialize`, `activate`, branded handle or runnable
function. A self-consistent caller candidate is data until the later
filesystem/toolchain verifier reproduces it. This prevents an early DTO from
becoming production authority merely because its hash is internally consistent.

## EvidenceReceiptV2

Every runner returns one strict receipt that binds:

- activation acknowledgement, release manifest, runner, adapter, launcher,
  profile, topology, transport, candidate build/runtime/launch, environment,
  and toolchain hashes;
- run/attempt/story/slice/evidence predicate identity;
- exact source commit and tree before execution and exact post-execution source
  identity;
- start/end timestamps and bounded duration;
- exact invocation request hash and redacted response/capture artifact refs;
- check kind, typed observed result, pass/fail, and failure owner;
- process/service lifecycle and exclusive port lease identity when applicable;
- receipt payload hash.

Every attempted check returns a bounded `EvidenceOutcomeV2`. Pass/fail receipts
and infrastructure/source rejections are durable typed variants; none disappear
into logs or prose. Capture refs are content-addressed, media-typed and
byte-bounded, never mutable filesystem paths. HTTP fetch uses
`redirect:"error"`, a code-owned 30-second request limit, a code-owned 4 MiB
response limit and loopback origin equality. A successful response binds its
body byte length; streaming reads abort after exactly limit-plus-one observed
bytes and emit a typed `response_limit_exceeded` observation.

The first outcome statuses map exactly to verdict and failure owner:
`passed/pass/none`, `product_failed/fail/generated_product`,
`source_rejected/fail/generated_source`, and the inconclusive
`platform_rejected`, `infrastructure_failed`, `external_dependency_failed` and
`cancelled` owners. Arbitrary diagnostic or agent prose is not a receipt field;
bounded redacted capture artifacts carry diagnostics. Every completed product
check binds an observed-value hash. A preflight refusal uses a typed
`not_started` lifecycle with the same intended check kind and failure owner; it
does not invent a process or service identity.

The invocation-response hash equals the typed outcome hash, and the outcome's
capture-envelope hashes equal every-and-only canonically ordered receipt capture
refs. Each capture binds envelope hash, content hash, byte length, media type and
a code-owned redaction-policy hash while explicitly forbidding a mutable locator.
Source drift can only yield `source_rejected`; a passing HTTP outcome requires
the exact loopback/no-redirect lifecycle and a 2xx response, and a passing
process outcome requires normal exit. UTC timestamps use one millisecond format
and must exactly equal the bounded integer duration.

The receipt ABI policy binds an explicit schema revision, exact lifecycle shape
signatures, exact cross-field relation identifiers, the complete Node signal
catalog and disjoint name-only or number-only future-runtime signal fallbacks;
an unverifiable name/number pair is never stored as one claim. A timeout observation uses
the same literal 30-second value as its request policy. `start_failed` and
`readiness_failed` both retain the held private socket-lease hash; a failure
before lease allocation is `not_started`, not a fabricated service lifecycle.
The policy hash used as `receiptSchemaHash` therefore changes when these ABI
shapes or relations change instead of hashing only a coarse receipt label.

An HTTP product failure is not restricted to a returned non-2xx response. A
typed start failure, readiness failure, timeout, connection failure, rejected
redirect or response-limit observation can all belong to `generated_product`
when the code-owned runner proves that owner. The same transport symptom is not
silently relabelled infrastructure merely to satisfy the receipt schema; the
later verified adapter/runner owns attribution and the receipt preserves its
typed lifecycle evidence.

The receipt never embeds secrets, ambient environment, agent prose, or a
generated-project-specific classifier. Passing evidence is valid only when the
receipt's source revision and candidate runtime/launch hashes equal the exact
source and bytes being admitted.

## Code-Owned EvidenceAdapterCatalogV2

Zero-argument `EvidenceAdapterDefinitionCatalogV2` constants contain typed
requirements, not runnable support claims. They do not accept raw support
signatures, runner refs, toolchain hashes, profile hashes, or adapter refs from
a caller. This definition catalog is bound in the manifest because its exact
module bytes already exist in the platform tree.

The corresponding launcher/runner definition catalogs are also requirements-
only in the schema slice. They may name the fixed launcher/runner/ABI references
the platform must implement, but contain no caller-supplied module hash,
toolchain hash or support signature. Each standalone subcatalog carries explicit
`authorityKind:"requirements_only"` and `productionUse:"forbidden"` markers, so
a future persistence consumer cannot detach it from the outer blocked catalog
and mistake requirements for operational support. Until the real modules and exports exist,
the operational catalog is canonically empty and marked `shadow_blocked`; it
cannot materialize even a fixture entry. Receipt-schema binding is derived from
the code-owned EvidenceReceiptV2 ABI policy, not a caller-provided schema hash.

The runnable `EvidenceAdapterCatalogV2` is deliberately not a manifest input.
It is materialized only after a branded verified release joins the definitions
to exact verified launcher/runner/profile/transport/receipt catalogs. The
activation acknowledgement binds the derived adapter-catalog and Registry
hashes beside the manifest hash. This ordering avoids the circular claim “verify the manifest
using an adapter catalog that itself requires the verified manifest.”

The first support set is intentionally small:

- CLI process: `action_invocation` and invocation-output
  `observable_outcome` for the exact Node CLI ProfileV2;
- HTTP service: the same predicate classes for the exact stateless Node Express
  API ProfileV2;
- command: build/test only after the command runner emits ReceiptV2.

API memory persistence is not claimed until an exact state/readback runner
exists. Browser, visual, download, reload, database, file, remote API, and
durable lifecycle support remain typed `ADAPTER_MISSING` blockers. Catalog
growth requires a real runner/eval, not a new project-specific guard.

## EvidenceAdapterRegistryV2

RegistryV1 remains historical/read-only with its existing schema and compiler
semantics. DB inventory currently contains no durable RegistryV1 artifact, but
that does not authorize reusing a version identity already observed by source,
tests and in-memory consumers. The V2 release path has new artifact and API
identities:

```ts
compileEvidenceAdapterRegistryV2(
  verifiedRelease: VerifiedPlatformReleaseV2,
): EvidenceAdapterRegistryCompilationResultV2;

verifyEvidenceAdapterRegistryV2({
  verifiedRelease: VerifiedPlatformReleaseV2,
  candidateEnvelope: unknown,
}): EvidenceAdapterRegistryVerificationResultV2;
```

Public input no longer contains producer metadata, release hashes, adapters,
support signatures, runner/dependency refs, toolchain hashes, catalog/profile/
stack hashes, capability refs, transport/check/lifecycle values, launcher paths,
or environment claims. Producer and release authority are projections of the
verified manifest. Candidate verification derives a fresh registry from the
brand and compares canonical bytes.

Registry support adds ProductSpecV2 `action_invocation`,
`CHECK_ACTION_INVOCATION`, and
`setfarm.invocation-input-transport.v2`. Profile bindings include catalog
schema, profile schema, profile ID/hash, catalog version/hash, and exact stack
binding. Registry resolution still requires an in-memory compiled or
fresh-verified authority brand.

## Build and Activation

The production builder never builds from the mutable checkout and never writes
into an existing `dist`:

1. fetch/read approved source authority, require the local SHA to equal exact
   `refs/remotes/origin/main`, and snapshot SHA plus `HEAD^{tree}`;
2. export that exact Git tree into a private read-only source stage, verify every
   blob/mode and the complete tree hash, and create two independent empty output
   stages with mode `0700`;
3. run a new side-effect-free `BUILD_PLATFORM_RELEASE_V2` command from the
   verified source stage with an explicit output root; it may write only each
   stage's `payload/dist`, and copies exact committed `package.json` without
   invoking source-mutating V1 version injection;
4. materialize exact production dependencies independently into each
   `payload/node_modules` using the code-owned npm recipe (`ci --omit=dev
   --ignore-scripts --no-audit --no-fund` plus an exact config hash), remove
   verified `.bin` symlinks, and copy the committed Stitch converter into each
   staged legacy-assets path;
5. derive exact external resolution and only definition/launcher/runner/codec/
   receipt catalogs whose module/export bytes already exist; do not materialize
   runnable adapter support or Registry yet;
6. normalize `dist` and `node_modules` to read-only modes, prove metadata clear,
   capture both full canonical trees in both stages, derive their bounded
   bindings, and require the two independent stage bindings to be equal;
7. write and fsync `PLATFORM_RELEASE_MANIFEST.v2.json` adjacent to `payload` as
   the terminal content write, then make the release root read-only;
8. prepare/acquire the existing publication batch lease for the exact manifest
   identity, then atomically rename to `releases/<manifestPayloadHash>/`; a
   concurrent identical winner is adopted only after full verification and a
   conflicting target is never replaced;
9. issue the prepared brand and run a fresh independent verifier to issue the
   verified brand;
10. derive the runnable adapter catalog and Registry only from that verified
    brand, then publish exactly three envelopes--the manifest (with its nested
    pre-verification catalogs), derived adapter catalog and Registry--as one
    prepared CAS batch after exact envelope-byte preflight;
11. append an activation-request event binding every published hash and ask the
    root-owned listener broker to start the new service on a private, unique Unix
    socket while the previous acknowledged release continues to own public
    traffic;
12. after the new process independently verifies the chain/CAS/filesystem,
    reports exact process/release identity and passes bounded health directly on
    that private socket, acquire the activation predecessor lease and prepare a
    durable listener-cutover record;
13. close the broker's public-dispatch gate under the same cutover lease, queue
    new public requests within a strict time/count bound, switch the pending
    backend pointer and run a root-authenticated cutover probe through the fixed
    listener while ordinary traffic remains gated;
14. if that probe succeeds, append an activation-acknowledgement event containing
    the exact cutover receipt, reopen the gate on the acknowledged backend, issue
    the activated handle and only then drain the old backend. On any pre-ack
    failure, restore the old pointer before reopening the gate.

An acknowledged activation, not the manifest or desired request itself, is the
durable operational trust anchor. A restart failure leaves the request
unacknowledged and the previous acknowledged release active. Rollback appends a
new request selecting a previous fully verified release and a new observed
acknowledgement; it never edits an old artifact or event.

### Fixed-port listener cutover authority

`ReleaseBootstrapV2`, installed and pinned independently from the candidate
release, owns the Setfarm dashboard's fixed `127.0.0.1:3333` listening socket for
its process lifetime. Release processes never bind that public port. Each starts
behind a private bootstrap-owned Unix socket whose path token, inode, process
identity, verified release ID, activation request hash and health nonce are bound
by `ListenerCutoverReceiptV2`. The broker performs direct private health first,
then swaps one mutex-protected pending pointer behind a closed public-dispatch
gate; it never uses `SO_REUSEPORT` to let old and new releases race for requests.

Before the pointer swap the broker fsyncs a root-owned prepared cutover record
containing both the previous acknowledged backend and the requested backend. It
then closes ordinary public dispatch; already-routed old requests may drain and
new connections are queued only within a bounded gate budget. A root-authenticated
health nonce may traverse the fixed listener to the pending backend while no
ordinary request can do so. The database acknowledgement is appended only after
that probe observes the exact release/process identity. The gate is opened on the
new pointer only after acknowledgement durability.

If the bootstrap crashes with a prepared record but no matching acknowledgement,
restart recovery must restore, route to and health-check the previous
acknowledged backend before accepting public traffic; it may complete the new
cutover only by re-running both health probes and the predecessor-lease check. If
it crashes after acknowledgement but before gate-open, recovery re-verifies the
acknowledged backend and opens that backend. The old backend is drained only after
acknowledgement durability. Thus no ordinary public request is served by an
unacknowledged backend, and a failed candidate cannot evict the previous
operational authority.

This PlatformReleaseV2 contains Setfarm bytes only. Mission Control's existing
`127.0.0.1:3080` listener is not restarted or authorized by a Setfarm release;
Mission Control requires its own content-addressed build/release authority before
an equivalent broker cutover can be enabled. OpenClaw remains an external
dependency and is likewise outside this activation identity.

## Database Migration

Migrations 22-25 must first pass isolated 21-to-25 upgrade and rollback tests.
Migration 26 is additive and introduces immutable `platform_releases_v2` plus
append-only `platform_release_activation_events_v2`. Typed request and
acknowledgement events form a predecessor hash chain; one predecessor can have
only one successor, an acknowledgement references one exact request, and an
unacknowledged request never changes current operational authority. Rows bind
manifest, V2 catalog/registry, release SHA, runtime/external/environment hashes,
bootstrap/process identity, startup-health receipt, listener-cutover receipt and
CAS foreign keys.
Update/delete/truncate are forbidden.

Existing `v3_release_admissions` remain unchanged. Later admission V2 references
the exact activation-acknowledgement hash. Live migration and cutover remain forbidden
until the release builder/verifier and migration matrix are green on clean
`main`.

## Dependency Order

1. strict runtime-tree binding, external-resolution and environment component
   schemas plus hash vectors; strict InvocationInputTransportV2 schema,
   code-owned codec catalog, pure compiler and differential CLI/HTTP fixtures;
2. CandidateBuildReceiptV2, CandidateRuntimeBundleV2,
   CandidateLaunchTargetV2/HttpHandlerExportV2, EvidenceOutcomeV2/ReceiptV2,
   launcher, runner, adapter-definition and operational-catalog schemas plus
   zero-input definitions that cannot materialize unsupported entries;
3. upstream Packet/BuildTopology/SourceMap production of exact launch targets,
   real command/CLI/HTTP launcher/runner exports, sealed child environment,
   network enforcer and exclusive socket-handle handoff;
4. only after every nested schema, launch contract and real claimed export
   exists, the root
   manifest schema/hash vectors, empty-staging materializer and terminal writer;
5. fresh installed/prepared verifier and private authority brands;
6. new AdapterCatalogV2 and RegistryV2 derived only from verified release;
   RegistryV1 remains
   historical/read-only;
7. atomic prepared CAS publication, the independently installed fixed-port
   listener broker, `ListenerCutoverReceiptV2`, crash reconciliation and migration
   26 activation ledger;
8. Story/Slice/EvidencePlan/retry/supervisor consumers and Mission Control
   canonical projection;
9. clean-main double build, restart and three-class clean-run convergence eval.

No later item may be activated by stubbing an earlier authority. Schemas may be
implemented shadow-first, but the root manifest cannot hide a nested catalog
behind `unknown`, opaque hash-only fields or fake fixtures, and a catalog cannot
claim a runner until the exact runner module/export and toolchain are present in
the verified byte closure. If a component needs to land before that join, it is
an explicitly `shadow_blocked` artifact whose schema forbids production
selection; it is not a materialized release manifest.

## Verification Matrix

Required tests include:

- schema strictness, canonical ordering, caps, and domain-separated golden
  hashes;
- extra/missing/reordered file, stale prior dist, symlink, hardlink, FIFO,
  socket, device, traversal, case collision, unsafe Unicode, and mutation during
  read;
- dirty/non-main source, source-tree drift, lockfile/compiler drift, crash before
  manifest, and crash after fsync;
- wall-clock/UUID/PID/temporary-path leakage into payload and unequal double
  clean builds;
- missing/wrong runner export, ABI drift, toolchain tamper, package/executable/
  browser drift, ambient environment leak, shell/fallback/install attempt, and
  a sandbox that claims loopback-only while an outbound probe succeeds;
- caller forgery of producer, release, catalog, adapter, runner, profile,
  capability, transport, or lifecycle fields;
- duplicate signature ownership and unsupported API-memory false support;
- two simultaneous builders, verifier during activation, CAS idempotency, two
  exclusive attempt port leases, old/new private service sockets, fixed-listener
  pointer swap, crash before/after pointer swap and before/after acknowledgement,
  and proof that an unacknowledged backend never remains public authority;
- genuine CLI and API fixtures executed through real subprocess/HTTP runners;
- differential hardcode killers with two valid value/subcommand/route variants;
- receipt replay against unchanged and changed source revisions;
- rollback to a prior verified release without artifact/event mutation.

## GO / NO-GO

Implementation of the shadow schema/catalog/runner/release slices is **GO** in
the dependency order above.

Production activation, live migration, deployment, new V2 generated run, and
registry-backed evidence admission are **NO-GO** until all of these are true:

- real runner exports and EvidenceReceiptV2 exist;
- InvocationInputTransportV2 is differential-tested;
- ambient environment, shell fallback, runtime browser install, and
  check-then-close ports are absent from the V2 path;
- loopback-only network isolation has a verified enforcement module/profile and
  a negative outbound-network receipt;
- empty-staging every-and-only release materialization and fresh verification
  pass adversarial filesystem tests;
- RegistryV2 has no caller-authored authority fields and no V1 fallback;
- migration 22-26 upgrade/rollback/concurrency tests pass;
- clean-main manifest/catalog/registry CAS publication, private-socket startup,
  fixed-listener cutover, crash recovery and observed activation acknowledgement
  succeed;
- three distinct clean product-class eval runs converge without new
  project-specific guards.
