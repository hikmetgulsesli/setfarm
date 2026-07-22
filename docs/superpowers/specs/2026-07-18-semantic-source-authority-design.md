# Semantic Source Authority Design

Date: 2026-07-18
Status: Approved for shadow implementation; realization boundary corrected 2026-07-22
Scope: Release-bound semantic obligations, explicit realization choices, source receipts, and projectable story proofs

## Context

The current semantic chain knows what the product must do and which story owns
each semantic subject. It does not know, before implementation, which exact
source responsibility, file, and structural slot must implement that subject.

`BuildTopologyV1` owns paths, roles, grants, entrypoints, commands, and coarse
capabilities. It cannot prove that an action belongs to one handler, a state to
one store, a persistence policy to one adapter, or a route to one registration
slot. `ImplementationSourceMapV1` closes exact Stitch-generated screen source,
but it does not cover no-design products or the complete action/state/
persistence/platform source closure. `ImplementationStorySourceMapV1` also
embeds the full global V1 witness in every slice.

Deriving SourceMapV2 directly from those artifacts would reintroduce the root
failure in a typed-looking form: Setfarm would still guess semantic ownership
from filenames, broad writable paths, generated titles, or whichever file was
already present.

## Decision

Use one release-owned source-authority chain:

```text
StackSemanticSourceRulesCatalogV1
  + ProductDeliveryProfileV2
  + ProductSpecV2 partition
    -> SemanticSourceIntentSetV1             # obligations, not targets
    -> SemanticRealizationPlanV2             # every-only realization choice
    -> FileTreeManifestV3 / BuildTopologyV3  # realization-driven topology
    -> Generated or model-authored producer  # selected by realization
    -> SemanticRealizationSourceReceiptV2    # every-only materialized proof
    -> StoryPlanV3                            # semantic + source ownership
    -> ImplementationSourceMapV2 root/leaves
    -> ImplementationSourceMapStoryProofV2   # least-privilege projection
```

An implement agent receives a verified story proof only for realizations whose
versioned ProductSpec behavior contract explicitly selects model authorship.
Generated realizations produce no model write grant. No agent receives the
global source map, caller-authored path maps, catalog rules, unrelated story
leaves, or inferred filenames.

The current PacketV3 and SliceV2 shapes are branch-only and have not been
persisted or activated in the live artifact store. The realization-driven chain
uses ProductBuildPacketV4 instead of reinterpreting PacketV3. Optional dual
authority fields are forbidden. The live cutover preflight must reproduce that
the count of persisted/activated PacketV3/V4 plus V1-source-map authority is
still zero; any nonzero unexpected count stops cutover and requires an explicit
migration decision.

## Considered Approaches

### Treat every story-owned path as a source slot

Rejected. Path ownership answers where a story may write, not which behavior a
path implements. Recovery would still target a broad file set and could resend
the same defect without identifying the expected semantic delta.

### Let planning/setup or the implement agent author a semantic path map

Rejected. A caller-authored map is another claim. It can omit hard behavior,
reuse a path without a safe structural slot, select a convenient filename, or
assign two stories to the same source responsibility.

### Infer paths from stack templates, titles, or source discovery

Rejected. Titles, slugs, regex-discovered filenames, existing imports, and the
first matching entrypoint are mutable observations, not release authority.
They are exactly the mechanisms that made new product classes create new guard
classes.

### Release obligations -> realization plan -> materialization

Selected. Rules define the complete obligations for a stack/profile. The
compiler derives intents only from sealed product authority, then a separately
versioned policy chooses generated, platform, exempt, evidence-only, or
explicitly model-authored realization before setup creates a path. Setup and
source production consume that plan. No stage accepts a replacement mapping
from the caller, and a legacy intent target is compatibility evidence only.

## Core Invariants

- Catalog rules are code-owned, versioned, content-hashed, and bound to one
  exact stack-pack identity. ProductDeliveryProfileV2 binds one exact rule set
  in the forward direction; the rule set does not bind back to the profile.
- Product delivery selects rules by exact catalog identity. The caller cannot
  provide rule bodies, path templates, cardinality, or locator contracts.
- Every required semantic responsibility produces exactly one intent unless a
  rule explicitly declares bounded aggregation or a typed exemption.
- Every intent has exactly one realization. FileTree and BuildTopology consume
  that realization; they never treat a legacy intent target as implementation
  authority.
- Model write authority is forbidden unless ProductSpec carries an explicit,
  versioned opaque-behavior contract and the realization policy selects it.
- Titles, descriptions, labels, entity names, route prose, story prose,
  `domain_slug`, `target_slug`, regexes, glob discovery, and arbitrary caller
  fragments never participate in path or slot identity.
- Writable intents never contain future content hashes. They bind only the
  current base presence/hash after physical materialization.
- A generated immutable source may bind a known output hash only through its
  verified generation receipt.
- Every model-writable path, when such a realization is explicitly admitted,
  has one declaration. Setup/config/asset/generated/dependency paths have an
  explicit non-writable classification.
- Multiple declarations may share one file only through a catalog-declared
  aggregation policy and unique structural locator slots.
- SourceMapV2 roots and story proofs are freshly reproducible. A serialized
  `verified` marker or self-consistent hash is not authority.
- Public inputs are bounded canonical snapshots before schema traversal. Proxy,
  accessor, cycle, sparse-container, excessive-depth/work/byte, unsafe Unicode,
  and publication failures become typed rejection.

## StackSemanticSourceRulesCatalogV1

The catalog is an immutable release artifact.

```ts
type StackSemanticSourceRulesCatalogV1 = {
  schema: "setfarm.stack-semantic-source-rules-catalog.v1";
  catalogVersion: string;
  producer: SemanticArtifactProducerV1;
  releaseAuthority: {
    codeSha: GitCodeSha;
    platformBundleHash: Sha256;
  };
  ruleSets: StackSemanticSourceRuleSetV1[];
  catalogPayloadHash: Sha256;
};

type StackSemanticSourceRuleSetV1 = {
  schema: "setfarm.stack-semantic-source-rule-set.v1";
  ruleSetRef: StableReference;
  ruleSetVersion: string;
  readiness: {
    status: "shadow";
    blockerCodes: SemanticSourceRuleSetShadowBlockerCodeV1[];
  };
  stackPackBinding: {
    stackPackId: string;
    stackPackVersion: string;
    stackPackContentHash: Sha256;
  };
  rules: StackSemanticSourceRuleV1[];
  ruleSetHash: Sha256;
};
```

The rule catalog deliberately has no ProductDeliveryProfileV2 hash or profile
catalog hash. Rules are produced first. The profile catalog then selects an
exact `(ruleSetRef, ruleSetVersion, ruleSetHash)`. This one-way identity removes
the otherwise impossible profile-hash/rule-set-hash cycle.

Every rule contains:

- a stable rule ref and domain-separated rule hash;
- one exact semantic subject kind;
- one exact source responsibility;
- a typed activation predicate and cardinality; and
- one discriminated target: project/generated source slot, platform contract,
  typed exemption, or predicate relation.

A source-slot target additionally carries one owner policy, path-resolution
contract, structural locator contract, access/output policy, and bounded
aggregation authority when sharing is allowed. Its mandatory
`subjectContractResolution` is `none` except for action-input source: web/game
bind exact `ActionInputTransportV2`, CLI binds the future CLI invocation ABI,
and API binds the future HTTP invocation ABI. Platform, exemption, and
predicate-relation rules cannot smuggle placeholder source paths or ownership
claims.

Supported subject kinds are `entrypoint`, `command`, `route`, `surface`, `control_slot`,
`physical_control`, `action`, `action_input`, `state`, `persistence_policy`,
`entity`, `observable`, `evidence_predicate`, and `runtime_data_contract`.

Supported source responsibilities are:

- `route_registration`;
- `command_registration` or `platform_command`;
- `surface_primary`;
- `control_binding`;
- `action_handler`;
- `action_input_transport`;
- `state_store`;
- `persistence_adapter` or `persistence_exemption`;
- `entity_model`;
- `observable_projection`;
- `entrypoint_registration`;
- `api_response_adapter`;
- `cli_output_adapter`;
- `runtime_data_fixture`;
- `runtime_registration` or `platform_registration`.

Generated source is a discriminated target of `surface_primary` or
`physical_control_binding`, not a second overlapping semantic responsibility.

Activation is a strict discriminated union over facts already in ProductSpecV2
and the selected profile: always, action trigger kind, persistence
kind/durability, entrypoint kind, command kind, design/no-design kind, or an
exact conjunction of those predicates. Subject existence is the compiler's
iteration domain, not a caller-authored activation fact. Activation never
executes code or accepts a free-form expression.

Cardinality is one of `exactly_one_per_subject`,
`exactly_one_per_entrypoint`, `typed_exemption_per_subject`, or
`catalog_bounded_aggregate`. Aggregate rules include a maximum member count and
one parser-owned unique slot-key domain. There is no story-wide singleton that
could collapse multiple semantic subjects into one untraceable obligation.

Path resolution is one of:

- `compiler_semantic_token_path`: a fixed release-owned prefix/suffix plus the
  full SHA-256 of `(ruleSetHash, storyId, subjectKind, subjectRef,
  responsibility)`, bound to the code-owned
  `SEMANTIC_SOURCE_PATH_TOKEN_V1` contract and contract hash;
- `selected_entrypoint_path`: the exact topology-selected entrypoint path;
- `generated_receipt_path`: one exact verified
  `setfarm.generated-source-receipt.v2` identity;
- `fixed_release_path`: an exact catalog path; or
- `shared_structural_slot_path`: an exact catalog path or selected entrypoint
  plus a required structural locator.

There is no title token, slug token, basename scan, regex path, glob path,
allowed-root fallback, or first-existing candidate.

Structural locators are strict unions: whole-file exclusive, versioned export,
versioned AST slot, or generated element receipt. AST slot kinds cover exact
entrypoint/route/action/control/state/persistence/observable/CLI/API/runtime
registrations. Each structural locator binds the code-owned parser ref and
parser-contract hash except whole-file exclusive and generated-receipt
locators.

The first code-owned catalog slice contains exact stack-specific rule sets:

- Vite React and browser-game use Stitch receipt-owned surface/physical-control
  source, browser-local persistence, and project-owned action/state wiring;
- Node CLI uses typed no-design surface source, none/memory persistence
  exemptions, and an exact CLI output adapter, with no invented rendered-control
  or durable persistence rule; and
- Node Express API uses typed no-design surface source, the current stateless
  none/memory persistence boundary, and an API response adapter. File/database
  persistence remains unsupported until a profile, rule and evidence runner own
  that exact contract.

All shared entrypoint/route/runtime slots bind the exact code-owned TypeScript
parser contract hash. Writable rules bind one responsibility-specific
structural-postcondition ref and exact slot-domain refs. Predicate rules resolve
each predicate through one exact support signature in the verified
`EvidenceAdapterRegistryV1`; a broad stack capability is not sufficient.

Catalog V1 is intentionally shadow-only. It has no `active` state and no public
resolver that can turn a catalog row into production authority. Its exact
blockers are:

- web/game: `SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED`,
  `SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED`, parser implementation, and
  release manifest;
- CLI/API: `SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED`, parser
  implementation, and release manifest.

The descriptor hash proves only the code-owned contract description. It does
not prove that a parser, generator, transport, or release manifest exists. A
future separately verified `SemanticSourceRuleSetActivationReceiptV1` must bind
the exact catalog/rule-set hashes and evidence that discharges every blocker;
the catalog itself is never rewritten or relabeled active.

### GeneratedSourceReceiptV2 prerequisite

The existing Stitch screen index is an input, not a source receipt.
`GeneratedSourceReceiptV2` must bind the design-source closure and exact
`StitchScreenIndexV2` payload hashes, generator implementation and platform
bundle hashes, generated-source CAS identity, byte length/content hash, and the
exact index-entry, component-API, and semantic-identity-closure hashes for its
target, surfaces, physical controls, actions, action inputs, and observables.
Every graph surface binding must also resolve inside the exact generated TSX to
one element carrying the same literal surface and element refs; graph membership
alone cannot mint generated-source authority. Candidate verification is bounded
per target by the fresh expected publication size, and the compiler performs
the same capacity preflight so compiled output is intrinsically verifiable.
The rule contract fixes this required authority set under
`GENERATOR_STITCH_GENERATED_SOURCE_V2`; no title, path scan, or mutable screen
prose can substitute for the receipt.

Binding generator implementation bytes does not prove that those bytes produced
the generated outputs. Until a hermetic invocation receipt or deterministic
fresh-run adapter proves exact inputs, outputs, release identity, exit status,
and execution policy, the separate generator-execution blocker remains.

### InvocationInputTransportV2 prerequisite

CLI/API action-input authority cannot be derived from an action handler path.
The current transport artifact binds every ProductSpec input field to the exact
implemented ABI: CLI argv position/flag/stdin encoding plus exit/stdout readback,
or HTTP method/path parameter/query/body encoding plus response/readback. Env
and caller-authored HTTP header channels are not implemented and cannot be
claimed. The artifact binds the selected evidence capability policy but not a
future executable evidence-adapter support signature; that join remains a
separate Registry/release blocker. Until the transport fresh-verifies and the
operational join exists, CLI/API production selection remains blocked.

Every action-level transport is published through one strict
`InvocationInputTransportSetV2` artifact. The set carries every full contract in
canonical action order, binds the exact ProductSpec and delivery-selection
hashes, is limited to 3 MiB canonical payload so a semantic-artifact envelope
still fits the 4 MiB store boundary, and remains `productionUse: forbidden`.
It exposes two non-interchangeable identities: `membershipHash` binds the
canonical ordered `{actionRef, contractHash}` projection used by semantic
consumers, while `contractSetHash` binds the complete wire artifact except its
own hash field. The membership projection retains the previously committed
`setfarm.invocation-input-transport-set-hash.v2` domain and
`SemanticSourceIntentSetV1.authority.invocationTransportSet.setHash` wire field;
renaming either requires a new semantic artifact version. The verifier's byte,
node, depth, and work budgets compose the
compiler-input budget with the maximum artifact budget, so compiler-admitted
authority cannot become unverifiable merely because the candidate is added to
the verification envelope.
Its verifier accepts no caller contracts or set membership; it freshly
recompiles the every-action set and requires canonical equality. Consumers may
bind the set membership hash but cannot reconstruct a missing contract from that
projection.

## ProductDeliveryProfileV2

V2 preserves the exact V1 delivery/topology/evidence bindings and adds:

```ts
semanticSourceRules: {
  catalogVersion: string;
  ruleSetRef: StableReference;
  ruleSetVersion: string;
  ruleSetHash: Sha256;
  readiness: SemanticSourceRuleSetReadinessV1;
};
```

Selection and verification fresh-reproduce both the delivery catalog and the
semantic-rule catalog. A V1 selection is historical input only and cannot be
promoted to V2 by attaching hashes.

The rule catalog contains Vite React, browser-game, Node CLI and Node Express
descriptors. The currently implemented ProductDeliveryProfileV2 catalog selects
only the exact Node CLI and stateless Node Express API descriptors. Web/game
profile selection is not claimed merely because shadow rule descriptions exist.
All descriptors remain shadow. Web/game additionally require exact generated-
source receipts; CLI/API require exact invocation-input transports; all require
the parser implementation and typed release manifest. A future production
profile may select a rule set only with a separate activation receipt proving
that its exact blocker set is discharged. Unsupported or shadow-only stacks fail
production selection with a typed source-rules blocker; they never fall back to
coarse topology.

## NodeExecutionLayoutCatalogV2

The code-owned Node layout catalog is a separate versioned artifact; changing a
ProductDeliveryProfileV2 or a historical V1 topology row does not silently
change executable layout authority. It contains exactly the two currently
selected no-design profiles in canonical profile order and binds each current
profile/catalog hash plus its exact stack-pack version/content hash.

Each layout fixes one source-to-runtime chain and no alternatives:

- Node CLI: `src/cli.ts` -> `dist/cli.js` ->
  `candidate-bundle/application/cli.js`, Node ESM,
  `NODE_ESM_CLI_ENTRYPOINT_ABI_V2`;
- Node Express API: `src/app.ts` -> `dist/app.js` ->
  `candidate-bundle/application/app.js`, Node ESM, named export
  `setfarmHttpHandlerV2`, `EXPRESS_REQUEST_HANDLER_ABI_V2`, platform-owned
  server/listener/socket and candidate `listen()` forbidden.

The layout also binds the exact current `CMD_BUILD` direct argv and the Node
compiler/scaffold contract: ESM package type, build script name, structured
`tsc` arguments whose config argument is a path-slot ref, `ES2022`/`NodeNext`,
source/output root refs, and `noEmitOnError: true`. Historical `src/index.ts`,
`src/server.ts`, and root
`server.ts` locators are retained only as the V2 rejection set; the V2 resolver
never selects them.

Every planned or rejected locator lives once in a hashed `pathSlots` closure.
Each slot has a stable ref, repository/candidate namespace, planned or
`reject_only` disposition, file kind, exact locator, and containing root ref.
`locator` is always the full logical locator relative to its declared physical
space; `underRootRef` is a containment boundary, never a join base. A consumer
must therefore validate `src/cli.ts` under the `src` root by segment-prefix and
must not construct `src/src/cli.ts`.
The compiler, topology, source-to-runtime, build-cwd, and launcher contracts
carry only slot/root refs; they do not repeat raw paths. This catalog is the
code-owned producer of path plans, while PathTokenV2 remains the downstream
portable path-identity verifier. `PATH_TOKEN_CONTRACT_UNVERIFIED` therefore
remains an exact production blocker.

PathTokenV2 binds its origin to `(pathTokenContractVersion,
pathTokenContractHash, slotSetHash, slotRef)`, not the whole layout hash, so an
unrelated compatibility observation cannot churn a stable path identity. Its
closure verifier must prove root existence and parent acyclicity,
segment-boundary containment, slot/ref uniqueness, physical-space exact and
ASCII-casefold collision freedom, and consumer-ref role/disposition closure.
`LegacyInstallerExecutionObservationV1` raw locators are compatibility evidence
only and are never PathToken compiler input.

The first PathTokenV2 implementation is deliberately scoped to
`originKind: node_execution_path_slot`; it does not launder the ordinal
`SEMANTIC_SOURCE_PATH_TOKEN_V1` into V2 authority. Its public compiler accepts
only `{productSpec, deliverySelection}`, fresh-resolves the code-owned layout,
and derives all roots, locators, namespaces, dispositions, and consumer
bindings. Caller-provided layout, slot set, root, locator, namespace, or token
definitions are excess fields and are rejected.

The versioned lexical contract admits only raw relative locators with `/`
separators and segment grammar `[A-Za-z0-9._@+-]+`. It performs no host-OS path
normalization, URL decoding, Unicode normalization, filesystem lookup, or
realpath operation. The limits are 1,024 ASCII bytes per locator, 255 bytes per
segment, and 64 segments. Empty, absolute POSIX, drive-qualified/drive-relative,
UNC/device, backslash, colon, percent, NUL/control/DEL, empty/dot/traversal,
trailing slash/dot/space, non-ASCII, and Windows device-basename locators are
rejected before token production. ASCII folding is used only for collision
proof; it never changes the exact locator identity. PathToken proves lexical
identity only. A later physical materializer must separately reject symlink,
junction, reparse-point, file-as-parent, and TOCTOU escape conditions.

`NodeExecutionPathTokenSetV2` publishes canonical root bindings, every planned
and reject-only slot token, and every typed consumer binding. Roots are ordered
by `rootRef`, tokens by `slotRef`, and consumers by stable JSON pointer. The
closure requires one empty anchor per physical space, same-space acyclic nearest
parents, nearest segment-containing roots, unique refs, exact and ASCII-casefold
collision freedom, and no file/root or file/file ancestor conflict. Compiler,
canonical topology, source/output/candidate, and runtime consumers may bind only
their exact planned namespace/disposition. Only historical entrypoint consumers
may bind `reject_only`; no slot may be orphaned. Any new `PATH_ROOT_*` or
`PATH_SLOT_*` consumer outside the classified field set fails closed. The
legacy observation subtree is excluded from this machine walk.

The set carries separate domain hashes for roots, tokens, consumers, and the
complete artifact. Individual `pathToken` identity remains exactly
`(contractVersion, contractHash, slotSetHash, slotRef)`, so consumer wiring can
change the set artifact without creating an identity cycle or admitting
`layoutHash`/legacy observation churn into a path token. A schema-valid,
self-rehashed token set is still only a candidate; the authoritative verifier
fresh-recompiles from ProductSpec and delivery selection and requires canonical
byte equality. The artifact remains `shadow`/`productionUse: forbidden` with
source-layout, FileTreeV2, BuildTopologyV2, physical materializer, and release
activation blockers. The existing layout blocker is not removed in place.

`layoutHash` binds a complete layout; `catalogHash` binds the exact ordered
layout set. A bounded fresh verifier reproduces the catalog from code-owned
ProfileV2 and stack-topology identities, and the selection resolver first
fresh-verifies ProductSpecV2 + ProductDeliverySelectionV2. The catalog is
`shadow`/`productionUse: forbidden` with exact file-tree, declaration, scaffold
materialization, and candidate-byte blockers. It supplies planned paths and ABI,
never future source/output content hashes or execution authority.

The compiler pins the admitted upstream profile catalog hash, each profile
hash, and both topology content hashes. Upstream drift therefore fails as typed
code-authority drift until this catalog is intentionally revised and its
goldens change; importing the newest upstream row is not an implicit layout
version transition.

The historical setup resolver still prefers `src/server.ts` when that file is
present, and the historical Node CLI topology still publishes no `dist` output
root. Those are explicit
`LEGACY_ENTRYPOINT_RESOLVER_UNMIGRATED` and
`LEGACY_BUILD_OUTPUT_AUTHORITY_UNMIGRATED` blockers. The unversioned installer
stack-pack file entrypoints, app-shell target rule, shared entrypoints, and V1
topology build-output roots are copied into a hashed
`LegacyInstallerExecutionObservationV1` whose authority kind is
`compatibility_unmigrated` and whose production use is forbidden. The API
observation states explicitly that `src/server.ts` conflicts with the V2
`src/app.ts` handler; the CLI observation states explicitly that its empty V1
output-root set conflicts with `dist/cli.js`. Production admission cannot
consume this catalog until BuildTopologyV2 makes the exact layout source/output
authoritative, rejects every historical locator if present, and the
topology/profile identities are intentionally version-bumped. Historical V1
reads remain compatibility-only until that cutover.

### Node layout 2.1 and scaffold/toolchain prerequisite

The first layout artifact was never published or referenced by the live
artifact database: a read-only query on 2026-07-18 found zero matching rows in
`semantic_artifacts`, `run_artifact_refs`, `product_packets`, `runs`, and
`live_events`, and a workspace/Projects search found only source, test, and
audit occurrences. The shadow catalog is therefore intentionally revised from
`2.0.0` to `2.1.0`; it is not silently reinterpreted after activation.

Revision 2.1 adds exactly one shared repository-config slot,
`PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2` at `package-lock.json`, so the package
manifest, lock manifest, and TypeScript config all have portable path-token
authority before scaffold compilation. CLI slot cardinality becomes seven and
API cardinality eight. A separate dependency contract binds the lock slot with
the typed `dependency_lock_manifest` consumer role and npm tool ref; the
compiler contract separately names `TOOL_NODE_TYPESCRIPT_TSC_V2`. The literal
`tsc`/`npm` argv tokens remain compatibility observations and are not host
executable authority. Exact executable paths, bytes, versions, environment,
and package trees require later host-toolchain and dependency-materialization
receipts. The layout remains shadow and adds exact scaffold-catalog and
toolchain-executable blockers.

The lexical PathToken contract remains 2.0 because its origin/hash algorithm
did not change. The Node execution path-slot contract and path-token set both
advance to 2.1: the former added a slot and the latter added a consumer role and
changed its accepted artifact shape. Their versions are separate code-owned
constants, so a later catalog-only change cannot churn stable slot/token
identity accidentally.

`NodeScaffoldToolchainCatalogV2` is now a required stage between the portable
path-token set and FileTreeV2. It contains exactly two profile entries and
exactly three setup-owned UTF-8 JSON byte artifacts per entry:

- `package.json`;
- `package-lock.json` with lockfile version 3 and an every-and-only exact build
  dependency graph; and
- `tsconfig.json`.

Each JSON file is canonical JSON followed by one LF, with no BOM. Package names
are fixed private code-owned names and never derive from product title, run,
repository, or story identity. Direct dependency versions are exact, never
ranges or registry tags. The static catalog separately binds the complete build
graph, Node/npm/TypeScript requirements, install/build/test command artifacts,
the three path-slot refs, and an exact readiness blocker set. Path tokens and
semantic requirements are product-specific resolution authority, not static
catalog fields. Its public resolver accepts only ProductSpec plus delivery
selection, fresh-reproduces layout, Node PathToken, and semantic-path
authorities, joins all three scaffold files to their exact current tokens, and
maps every current selected-entrypoint requirement to the one canonical source
token. Requirement cardinality is not profile-fixed: one current API fixture
has three while its two-route form has four. A self-rehashed caller catalog or
resolution is never authority.

The catalog produces no `src/**`, test, `.gitignore`, README, `dist`,
`node_modules`, or candidate-bundle bytes. It grants no acceptance authority
until a verified canonical test receipt exists, requires at least one executed
test, and forbids a zero-test receipt. `requiredBaseState: absent` is a future
FileTree/materializer precondition, not evidence that the current repository is
already absent. Pre-source `npm run build` is a typed precondition rejection,
not a setup failure and not product evidence. Scaffold admission may later run
only exact `npm ci --include=dev --ignore-scripts --no-audit --no-fund`
build-dependency materialization plus a toolchain probe inside a private stage.
The shared install/build/test environment contract is deliberately
`planned_isolated_exact`, not current execution authority. It constructs the
child environment from deny-all, strips every case-insensitive
`npm_config_*` variable before exact settings, binds distinct private blank-LF
user/global npmrc paths, requires project `.npmrc` absence from FileTreeV2, and
binds `PATH` to an exact ordered host-toolchain receipt (candidate
`node_modules/.bin`, exact Node bin, then admitted platform bins). `HOME`,
temporary paths, and npm cache are attempt-private. Builtin npmrc, effective
npm config, proxy/CA absence and the resulting environment require dedicated
receipts; until then execution remains blocked. Every recipe references the
same environment hash rather than install alone carrying an unverified prose
claim.

Install, build, and test each carry an exact ordered precondition set with
typed missing-authority rejection. Install requires deep scaffold bundles,
effective npm config, environment, host toolchain, base FileTree and private
materializer authority. Build additionally requires dependency materialization,
source receipt and BuildTopology. Test requires those authorities plus a
canonical build receipt and test-input FileTree. These future schema refs do
not publish an execute API; they prevent a blocker list from being mistaken for
an executable join.

Lock closure proves exact root joins, canonical npm lock-v3 package-path
grammar, target package-name equality, recomputed nearest-node_modules
resolution, reachability, exact profile dependency tuples, and their joins to
the toolchain contract. Its explicitly bounded version-spec grammar uses
canonical numeric identifiers and arbitrary-precision comparison; leading-zero,
unsafe-number and over-limit inputs fail closed. It proves `hasInstallScript` is
absent from the lock and adds `--ignore-scripts` as the execution barrier. It
does not claim that all packages lack `prepare`/`prepublish` metadata, nor that
lock metadata proves tarball contents. Registry lifecycle metadata observed in
an unversioned audit is not production authority; deep tarball/CAS verification
and transitive Node-engine compatibility each retain their own exact blocker
code.

The current Node V1 rules cannot be activated under this lifecycle. They encode
implementation choices inside an obligation artifact: entrypoint/route/runtime
are model-writable shared AST slots, action/state/adapter/runtime-data are
model-writable source files, and their parser/locator contracts do not provide
the executable completeness needed to make those choices safe. The later V2
path layer compounds this by aggregating multiple per-story runtime-data
obligations into one physical path while the V1 rule still says
`exclusive_file`. No declaration layer can repair that contradiction after
physical topology has already granted writes.

The corrected version-forward boundary is
`SemanticRealizationPlanV2`. It fresh-reproduces all current Node semantic
intents and treats their V1 targets only as compatibility evidence. Each intent
is assigned exactly once to a generated runtime member, platform binding, typed
exemption, or evidence relation. For the supported CLI/API ProductSpec V2
language, action state deltas, invocation transports, output projections,
runtime state/data and registration are declarative; therefore every former
model-writable source obligation is generated and model writes are zero. This
claim applies only to the machine-executable subset. ProductSpec V2 still
inherits prose-only `states[].invariants` and admits an `entity_field` value
source that identifies a schema field but no entity instance or snapshot.
Those forms are not executable semantics and must fail before source generation.
They are closed by the versioned ProductRuntimeBehaviorContractV1 described
below; the generator must never interpret their prose or guess a snapshot.

`NodeSemanticRuleGeneratorTransitionV2`, FileTreeV2 and BuildTopologyV2 remain
immutable compatibility experiments. They prove stable logical/operational
identity separation and preserve legacy ABI evidence, but they are not promoted
or consumed as the production topology. FileTreeV3 and BuildTopologyV3 must be
compiled from the realization plan. `NodeProductRuntimeGeneratorV2` then emits
one canonical `src/cli.ts` or `src/app.ts` and a
`NodeProductRuntimeSourceReceiptV2` mapping every generated member back to its
realization and ProductSpec authority. There are no model-owned handler imports
to declare for the current profiles.

The implemented shadow generator API is
`generateNodeProductRuntimeSourceV2(handle, input)` and its fresh verifier is
`verifyNodeProductRuntimeSourceV2(handle, input)`. The separately supplied
private-stage capability is not serializable input authority. The generator
freshly verifies ProductSpec selection, SemanticRealizationPlanV2, FileTreeV3,
BuildTopologyV3 and every-action InvocationInputTransportSetV2 before returning
bytes. One code-owned runtime program implements strict inverse transport
decoding, transactional state transitions, preconditions, state deltas and
declared CLI/API result ABIs. Its receipt separates byte-stable source identity,
logical semantic/build identity and attempt-specific operational topology
identity. Fresh verification regenerates the full source and receipt rather
than accepting a self-rehashed candidate.

ProductRuntimeBehaviorContractV1 is a companion semantic authority, not a
post-review patch. It binds one exact ProductSpec V2 payload and inventories
every opaque invariant occurrence by a compiler-derived ref over state ref,
ordinal and text hash. Every occurrence receives exactly one disposition:

- bounded executable state assertions over explicit JSON-pointer subjects and
  code-owned operators/phases;
- exact coverage by already-structured ProductSpec action/delta/observable
  semantics; or
- a non-runtime requirement disposition bound to exact constraint/non-goal
  requirement and required evidence refs.

Functional requirements cannot be laundered into the non-runtime disposition.
Every `entity_field` delta occurrence additionally requires one exact runtime
snapshot binding that names the state snapshot, entity selection rule and field
projection; a schema field alone never authorizes a read. The compiler checks
every-and-only coverage, type compatibility, requirement traceability, canonical
ordering and bounded work, then publishes an immutable contract hash. The
original prose remains provenance only after this contract exists; it is never
an evaluator input. Runtime/test generators consume the exact behavior-contract
hash, so there is one execution authority and no prose classifier fallback.

The isolated shadow implementation landed in `26852450`. Its proposal and
contract schemas are strict and bounded; its evaluator contract hash is
`b067de2365e0ea413f632073c082a077c67de2e091fccddd7cb29e653eee990f`.
The compiler checks canonical initial state, exact traceability and each of the
three dispositions. The evaluator fresh-verifies authority and owns
checkpoint/pointer/predicate/cardinality semantics. The entity resolver reads
only state-before-action snapshots, validates every declared action input
including enum domains, validates every collection member and requires exactly
one canonical match. Candidate self-rehashing cannot create authority.

This implementation deliberately retains the PLAN integration blocker. The
current planner emits one `PlanSemanticProposalV2` and does not emit the
behavior proposal; accepting an ad hoc caller proposal in production would
recreate the split-authority failure this design is intended to remove. The
next boundary is therefore one atomic `PlanProductBuildProposalV1` envelope
whose semantic and local-key behavior halves compile together. The compiler,
not the planner, maps local keys to ProductSpec global refs and seals both
hashes. Natural-language equivalence is not claimed by the V1 compiler; the
structured behavior becomes primary PLAN authority and prose remains
provenance, with cross-product evals required before activation.

`SemanticSourceDeclarationsV1` is consequently not a prerequisite for current
Node generation. If retained for a future explicitly model-authored realization,
it is downstream of realization-driven topology and covers only that admitted
source. The realization plan is the pre-source declaration for generated Node
behavior; the source receipt is its post-generation proof. Neither filenames,
filesystem discovery nor prose can create a missing member.

The first scaffold catalog remains shadow schema/compiler/verifier authority.
Deep ByteBundle CAS reassembly and host Node/npm identity now have independently
authenticated shadow authorities described below. Exact toolchain distribution
provisioning, build-dependency materialization receipt, private no-replace staged filesystem materializer,
FileTree/BuildTopology, entrypoint generator, candidate build/runtime ABI,
activation, and setup-flow cutover remain independently blocking. In
particular, deep-verifying exact byte refs does not make the current ambient
`npm install`/`npm run build` setup path a valid consumer.

### Deep scaffold ByteBundle authority (implemented 2026-07-21)

The first dependency-order part of step 8 is implemented in `43af7921` without
changing the catalog's shadow readiness or removing any install/build blocker.
The code-owned scaffold producer now fresh-reproduces all six exact file
bundles and returns two profile-scoped DB-first batch plans. A single aggregate
was deliberately rejected: six one-chunk files require twelve occurrences,
while the artifact batch protocol permits at most nine. The atomic setup unit
is one profile's three files, so each canonical batch has six occurrences and
deduplicates only exact same-tier identities inside that profile.

`DeepByteBundleVerificationReceiptV2` binds the fresh catalog/file subject,
expected ByteBundle root, exact ordered chunk references, closure registry,
closure evidence hash, and a deterministic receipt hash. It contains no
filesystem path, mutable buffer, absolute attempt root, or timestamp. The
receipt is canonical operational data, not byte authority by itself. A
self-rehashed receipt remains incapable of materialization.

The verifier accepts only a process-local `DeepByteBundleCasAuthorityV2`
created from the PostgreSQL connection, semantic artifact root and exact
capacity limits. That private authority constructs its own purpose-`reader`
hybrid store and artifact index; callers cannot inject or replace either
reader. Verification performs this sequence:

1. read and exact-identity check the expected ByteBundle root;
2. start and settle every declared chunk CAS read before closure
   classification;
3. start and settle every root/chunk `semantic_artifacts` lookup and require
   exact type, length and producer equality;
4. run the registered ByteBundle dependency closure;
5. reassemble bytes in declared ordinal order and recheck total raw length and
   SHA-256; and
6. issue an authenticated `VerifiedDeepByteBundleV2` handle whose raw bytes
   exist only in module-private memory.

Copies returned from that handle cannot mutate the retained verified bytes.
The Node scaffold adapter does not accept a caller-selected bundle binding: it
fresh-reproduces the code-owned catalog from `profileId + file role`, then asks
the generic verifier for that exact root. Consequently a valid API bundle
cannot satisfy a CLI file and a filesystem-complete but unindexed closure
cannot satisfy DB-first authority.

This closes deep scaffold source-byte consumption only. Host Node/npm
provisioning, builtin/effective npm config, execution environment, private stage,
dependency tree and materialization receipts are still absent; catalog
`productionUse` remains forbidden. The receipt is process-local and is not yet
persisted as the later durable materialization/operational receipt.

### Host Node/npm identity authority (F2A implemented 2026-07-21)

Commit `e22f04be` adds a fresh, authenticated host identity consumer without
promoting an ambient executable or a self-rehashed receipt. The public factory
accepts exactly one code-owned Node scaffold `profileId`; it accepts no path,
executable, expected version, process adapter, npm package root or PATH value.
Production resolution names only an architecture-specific, exact-versioned
Setfarm root below `/Library/Application Support/Setfarm/toolchains`. Ambient
PATH and Homebrew opt roots are not fallback candidates.

`HostNodeToolchainReceiptV2` joins the fresh scaffold catalog/entry requirement,
exact macOS build and architecture, Node version/ABI/N-API plus executable
identity, recursive non-system Mach-O closure, npm package version and every-
and-only tree, exact CLI/package JSON identities plus explicit builtin `npmrc`
absence, bounded probe
contract and ordered logical command-path projection. It contains no host path,
probe scratch path or byte buffer. Production receipts require root-owned Node,
npm and non-system library identities. Test receipts are permanently marked
`test_fixture_only` and cannot cross the production pre-spawn gate.

The npm closure rejects symlink, hard link, special file, writable file, owner
split, non-portable/case-colliding path, bound overflow and concurrent directory
drift. Node is executed by exact realpath with direct argv and a deny-all then
exact environment. npm is never executed through its `/usr/bin/env` shebang;
the admitted Node executable receives the exact npm CLI module as argv. Timeout,
output overflow, signal, nonzero exit and malformed output are distinct typed
failures. Before a later spawn, the authority fresh-recaptures root target,
device/inode/mode/owner/length/timestamps, bytes, complete npm topology and the
recursive dylib closure; drift invalidates the handle rather than creating
implementation retry prose.

F2A alone did not prove supply-chain provenance. F2B1, F2B2a and F2B2b bind
the code-owned official Node archive SHA-256/length, a private authenticated
archive handle, every-addressable-member inventory, exact selected Node/npm
closure, explicit builtin `npmrc` absence and a second every-and-only normalized
`0444/0555` private tree. Official arm64 and x64 archives both prove the
2,469-member selected topology and identical npm tree hash; the arm64 archive
contains 5,866 inventoried members and three discarded unselected symlinks. No
production root is currently installed. Commit `c090d816` adds the missing
F2B2c authority core: strict provisioning intent/claim/receipt schemas, real
parent-scoped kernel serialization, claim-before-root, deterministic no-replace
hard-link publication, file/directory fsync, read-only sealing, receipt-last
publication, exact-claim crash recovery, durable receipt rehydration, and the
final F2A filesystem join. The host receipt now binds the provisioning receipt,
physical root identity, exact Node bytes and the same normalized npm tree.
Production host authority cannot exist without this join.

Commits `569767df`, `3cc8bb99`, and `dd2dc9de` now add the pathless operational
authority core: canonical inspection, immutable apply/rollback plans, fresh
precondition reproduction, apply/verify receipts, exact-generation rollback
claim, private quarantine, restartable every-only deletion, durable
content-addressed rollback tombstone, and canonical execution-start evidence.
Receipt-link and destructive rollback crash tails converge only under their
exact claim; old plans cannot remove a later physical generation.

Commit `354cdcec` adds the separate command protocol library. Its exact argv
grammar cannot accept an architecture, target root, expected hash, shell
fragment, or option reordering. Apply and rollback consume only a normalized
absolute plan-file locator whose descriptor is no-follow, bounded to 16 MiB,
single-link, regular, physically unchanged across the read, strict-schema valid,
and byte-for-byte canonical. Every success is exactly one canonical inspection,
plan, or operation receipt on stdout; every failure is a canonical
`setfarm.node-toolchain-provisioner-cli-failure.v2` binding the inferred command,
ordered typed causes, failure class, exit code, and its own hash. The production
adapter closes archive verification, inventory, private-tree materialization,
disposal, and the existing command functions, but deliberately exports no
process entrypoint and is not wired into the ambient `setfarm` CLI.

F2 nevertheless remains production NO-GO. The publisher and operational core
have only run against isolated process-owned test roots; no `/Library/Application
Support/Setfarm` state was created or changed. A separately installed root-owned
startup/bootstrap package, a real official-archive-to-production-root
apply/verify/rollback rehearsal, and an OS-update transition are still absent.
The process-owned private materialization remains evidence for that installer
boundary, not permission for product-attempt code to provision.

The live host supports the design but is not production authority. Default PATH
selects Node 26/npm 11. An alternate Homebrew Node 22.23.1/npm 10.9.8 exists,
but its small launcher has a mutable Homebrew dylib graph and its npm tree has
post-install writable Python bytecode. Local deletion would only hide the
shared same-UID mutation channel. The production factory now refuses earlier:
the code-owned durable provisioning receipt/root must be present and freshly
verified; it never falls back to Homebrew.

## SemanticSourceIntentSetV1

The intent compiler consumes exact ProductSpecV2, deterministic semantic story
partition, verified ProductDeliveryProfileV2, design-source receipts when the
profile requires design and an exact typed absence when it does not, and the
semantic-rule catalog verification input. It does not consume
BuildTopology, setup output, DB story rows, or caller path proposals.

Each intent has one stable obligation identity and one complete content hash:

```ts
type SemanticSourceIntentCommonV1 = {
  intentRef: StableReference;
  semanticScope:
    | { kind: "story"; productRef: ProductId; storyId: StoryId; componentHash: Sha256; scopeRef: StableReference }
    | { kind: "product"; productRef: ProductId; productSpecHash: Sha256; scopeRef: StableReference }
    | { kind: "setup"; stackPackId: string; scopeRef: StableReference }
    | { kind: "platform"; platformAuthorityRef: StableReference; scopeRef: StableReference };
  subjectKind: SemanticSourceSubjectKindV1;
  subjectRef: StableReference;
  subjectHash: Sha256;
  subjectOrigin: TypedSemanticSubjectOriginV1;
  responsibility: SemanticSourceResponsibilityV1;
  ruleSetHash: Sha256;
  ruleRef: StableReference;
  ruleHash: Sha256;
  activationWitness: SemanticSourceActivationWitnessV1;
  cardinality: SemanticSourceCardinalityV1;
  intentHash: Sha256;
};

type SemanticSourceIntentV1 = SemanticSourceIntentCommonV1 & (
  | {
      target: SourceSlotIntentTargetV1;
    }
  | {
      target: PlatformContractIntentTargetV1;
    }
  | {
      target: TypedExemptionIntentTargetV1;
    }
  | {
      target: UnresolvedPredicateRequirementV1;
    }
);
```

`intentRef` is derived only from the stable obligation tuple `(ruleSetHash,
scopeRef, subjectKind, subjectRef, responsibility, ruleRef)`. `intentHash` binds
the complete content including subject and target projections. A prose/title
change can therefore update exact subject/content authority without inventing a
new retry key or source obligation. Setup and platform responsibilities are not
falsely assigned to the first ordinal story. Story scope uses the product-
namespaced stable component hash in addition to the compatibility `US-*` ID, so
two products that reuse common semantic IDs cannot collide in retry/declaration
identity.

The complete set is canonical and must equal the every-and-only obligations
re-derived from ProductSpec and rules.
Every story-contract evidence predicate, including action-referenced optional
predicates, has exactly one canonical predicate requirement. The intent stage
marks that requirement `unresolved_shadow`; it cannot claim declaration refs or
an executable adapter because both authorities are produced later. The
declaration compiler and RegistryV2 join later replace that requirement with an
exact relation and binding hash. Predicates do not create invented
instrumentation files. Requiredness controls verdict policy later; it does not
control SourceMap completeness. The predicate origin also preserves every exact
action reference independent of requiredness. Until StoryPartitionV3 can carry
cross-story evidence dependencies, a predicate whose subject owner and
referencing-action owner differ is a typed rejection, never a silently reassigned
intent.

An entity-model intent carries the exact entity field-ID set and field-contract
hash. It does not require one file per field unless a release rule explicitly
chooses a bounded per-field layout. Every action input field always has its own
exact action-input source obligation and contract hash.

The first implemented shadow slice supports the exact no-design Node CLI/API
profiles. It emits one synthetic persistence-none and runtime-data subject per
stable story component that has no persistence policy, even when another story
in the same product has memory persistence. It compiles the every-action
invocation transport set from one bounded ProductSpec snapshot, and rejects non-empty entity sets because
StoryPartitionV2 does not carry entity ownership. Consumer inference is not
promoted to authority. Entity support waits for StoryPartitionV3 `entityRefs`.

The existing `SEMANTIC_SOURCE_PATH_TOKEN_V1` still includes ordinal `storyId`.
That can churn a path when an unrelated earlier component changes story order,
so the intent artifact remains blocked by
`SEMANTIC_SOURCE_INTENT_PATH_IDENTITY_V2_UNVERIFIED`. FileTreeManifestV2 may not
activate until a V2 token contract uses a stable scope projection and the rule
catalog/profile hashes are versioned forward. That projection must carry only
story/product/setup/platform namespace authority; it cannot reuse component
membership hashes that churn when the same story grows. Current V1 intent refs
remain exact binding authority outside path identity; this blocker prevents the
physical materializer from reusing the unsafe V1 token as production authority.

## SemanticSourcePathTokenSetV2

FileTree compilation first consumes a separate semantic-source path authority;
the Node execution `PathTokenV2` is not widened in place. The first Node token
contract deliberately covers only `originKind: node_execution_path_slot`, while
semantic source paths have a different source identity and lifecycle.

`SemanticSourcePathTokenSetV2` fresh-reproduces the exact no-design semantic
intent set. Every `source_slot` intent is accounted for exactly once as either:

- a portable V2 token derived for a compiler semantic-token path; or
- an external resolution requirement for selected-entrypoint, generated-receipt,
  fixed-release, or shared-structural path authority.

The semantic token origin binds the V2 path-identity contract version/hash, a
V2 scope projection (`story|product + productRef`, `setup + stackPackId`, or
`platform + platformAuthorityRef`), a typed stable subject projection,
responsibility, stable rule ref, and a V2 path-projection hash. Direct subjects
project exact semantic refs from their typed origins rather than copying an
opaque V1 `subjectRef`. Per-story runtime-data subjects instead project one
product-level catalog aggregation identity, so component membership changes do
not remove and recreate their source file. The exact V1 subject ref remains in
the token binding. The origin never binds ordinal `storyId`, story component
membership, V1 `scopeRef`, full rule-set hash, V1 `intentRef`, or `intentHash`.
The token binding separately carries the current exact V1
rule-set/scope/subject/intent refs and `intentHash`; semantic changes therefore
invalidate authority without causing stable source locators to churn when the
path obligation itself is unchanged.
The V2 path projection contains only code-owned root, extension, namespace,
physical-space, and containing-root authority. The legacy V1 token algorithm,
token ref, and V1 token hash are not token input and are never copied into the
V2 artifact.

External requirements do not manufacture a raw locator. A selected-entrypoint
requirement must later resolve to the exact `NodeExecutionPathTokenSetV2`
source-entrypoint token; generated and fixed-release requirements must resolve
to their own versioned receipt/catalog authority. FileTreeManifestV2 performs
that join. A requirement is therefore complete accounting, not path authority.

There is one token binding per exact source-slot intent, but token binding count
is not falsely equated with physical file count. Only a code-owned catalog
aggregate may share one exact origin/path across multiple intent bindings. The
first such case is product-level runtime-data fixture aggregation; all exclusive
subjects remain path-unique. The set publishes exact `uniquePathCount`, and
FileTreeV2 historically materialized the aggregate once. That result is now
compatibility evidence, not production authority: the V1 runtime-data rule says
`exclusive_file` and supplies no shared structural locator capable of making
multiple write grants safe. SemanticRealizationPlanV2 instead keeps every
contributing runtime-data obligation separately traceable and realizes each as
a member of one code-owned runtime generator. FileTreeV3 therefore grants no
story a write to an aggregate runtime-data file.

The path-identity contract is separate from a code-owned set compiler contract.
The latter versions the token/external partition, supported semantic projection,
external expectation kinds, hash domains, ordering, and completeness rules.
Changing set compilation alone must not force a path-token contract bump and
relocate every source file. Token-origin, token-binding, portable exact/folded,
projection, legacy-path, external-requirement, membership, and set hash domains
and payload shapes are themselves fields of those contracts; the compiler does
not hide behavior-changing hash literals outside version identity. The set
publishes both contract hashes, separate
token and external-requirement membership hashes, and one complete set hash. A
schema-valid self-rehashed set remains a local candidate. The authoritative
verifier fresh-recompiles ProductSpec, delivery selection, no-design closure,
semantic intents, and the V2 token/requirement partition, then requires
canonical equality. The artifact remains shadow and production-forbidden until
FileTree, declarations, release activation, and all external path requirements
are verified.

## FileTreeManifestV2 And BuildTopologyV2 (Compatibility Evidence)

Setup materializes only compiler intents and release-owned setup paths.
`FileTreeManifestV2` records each intent-to-path resolution and its source:
semantic token, selected entrypoint, generated receipt, or fixed release path.
It cannot accept legacy `scope_targets` as native authority.

`BuildTopologyV2` preserves physical path, owner, grant, entrypoint, command,
capability, current base and authenticated dependency authority. It is the
pre-declaration planned-executable artifact and therefore does not contain
future declaration refs. The historical design expected
`SemanticSourceDeclarationsV1` to consume this topology and
`ExecutableSourceContractV2` to join them. That path is superseded by the
realization boundary below. Its local invariant remains useful evidence: shared
writable paths would require parser-owned unique locator slots, and paths
without semantic declarations are explicitly classified as setup, config,
test, asset, generated-readonly, dependency-readonly, raw build input,
candidate target, or build output.

These V2 artifacts were compiled before the realization decision existed and
must not be activated. `FileTreeManifestV3` fresh-verifies
SemanticRealizationPlanV2 and materializes only its selected targets. For the
current Node profiles this means scaffold/config paths plus one code-owned
generated runtime source target and one generated test target, with zero semantic
story write grants. `BuildTopologyV3` binds that V3 tree to the existing exact
dependency, command and runtime ABI authorities. Neither V3 artifact may adapt,
reinterpret, or copy V2 semantic writable paths.

## FileTreeManifestV3

FileTreeManifestV3 is the realization-to-physical-target boundary, not a copy
of historical topology. Its native authorities are ProductSpecV2, the exact
delivery selection, SemanticRealizationPlanV2, NodeExecutionLayoutV2 and
NodeExecutionPathTokenSetV2. FileTreeManifestV2,
SemanticSourcePathTokenSetV2 and story write grants are forbidden native
inputs. The F4 scaffold catalog and private base receipt remain compatibility
evidence only for three exact config byte identities and proven absences.

The Node profile closure has exactly six repository paths and three owners:

- setup owns readonly `package.json`, `package-lock.json`, `tsconfig.json` and
  the forbidden `.npmrc` absence;
- NodeProductRuntimeGeneratorV2 owns one absent whole-file runtime source
  target and binds every generator-member realization; and
- NodeProductTestGeneratorV2 owns one absent whole-file test source target and
  binds every action plus every required evidence relation.

All `writeGrantOwnerRefs` are empty. Story-owner and model-write counts are
zero. Generator profile hashes bind the complete code-owned profile, including
runtime ABI or exact test source/output/import/runner/process policy. The
manifest does not materialize build outputs, test outputs, candidate modules,
commands, dependency receipts or capsules; BuildTopologyV3 owns those joins.

Logical manifest identity excludes admission scope, private/physical identity
and attempt receipt hashes. Present config entries still bind exact deep-CAS
verification and consumer hashes, while absent source targets bind canonical
path-specific absence hashes. A verifier must revalidate the authenticated
private base, freshly reproduce every native authority and require canonical
candidate equality. A separate dependency-stage verifier must additionally
prove that dependency materialization preserved that same base before
BuildTopologyV3 consumes it.

The artifact stays `shadow_blocked` on exactly seven downstream facts:
BuildTopologyV3, evidence registry, runtime and test generators, both source
receipts and release manifest. A locally schema-valid self-rehash is never
sufficient authority.

## BuildTopologyV3

BuildTopologyV3 is the executable-plan boundary after dependency
materialization. Its only physical-topology input is a FileTreeV3 candidate
accepted by the dependency-stage fresh verifier. It separately revalidates the
private dependency receipt, base receipt, current layout/path-token authority,
scaffold catalog entry, and runtime/test generator profiles. FileTreeV2,
BuildTopologyV2, the entrypoint-only transition/receipt, story grants, package
script discovery, and caller-supplied paths are forbidden native authority.

The topology contains exactly 11 collision-checked paths in three physical
spaces:

- six exact repository projections from FileTreeV3;
- repository `node_modules` as disposable compile-only input;
- a separate readonly dependency-capsule `node_modules` identity;
- the runtime and generated-test JavaScript outputs; and
- the candidate runtime module.

All write-grant lists are empty. Runtime and test outputs belong to the build
executor, and the candidate belongs to its future materializer. Their current
states are absent or not materialized and name the exact future receipt schema;
the topology never treats a planned path as evidence that bytes exist.

Build command authority is direct Node execution of the exact TypeScript target
proved by the authenticated installed-bin receipt:
`node node_modules/typescript/bin/tsc -p tsconfig.json`. The generated npm link
is verified dependency evidence but never execution authority. Test command
authority is direct Node test execution of exactly one profile-selected
compiled test file. CLI permits only the exact same-runtime CLI module
subprocess required by its product ABI; API subprocesses are forbidden.
Neither `npm run build`, `npm test`, shell strings, PATH/default test discovery,
ambient environment, nor a zero-test receipt can satisfy this contract.

The compilation graph joins FileTreeV3 runtime realization membership and test
coverage membership to their exact TypeScript sources, JavaScript outputs,
runtime import, candidate, generator profiles, and CLI/API runtime ABI. Runtime
and test source receipts are typed absent preconditions. Build, candidate,
test-execution, evidence-registry, and release evidence remain typed blockers;
BuildTopologyV3 performs no command execution.

`logicalBuildHash` contains the semantic/file-tree/layout/path/dependency,
command, compilation, and runtime contracts. It excludes admission scope,
attempt-specific receipt identity, project scope, host/environment receipts,
and stdout/stderr hashes. `manifestHash` binds that operational evidence. This
lets unchanged source keep one retry identity across physical attempts without
discarding the evidence needed to authorize a particular execution.

The implemented shadow contract is `setfarm.build-topology.v3` version `3.0.0`
with contract hash
`85c5d6ab2546862383a3b1622a8f9360eed79af0bd5205e2cd1dea6bd911407f`.
Its producer and verifier are bounded, strict, scope-separated, recursively
immutable, and require canonical equality to fresh reproduction. This artifact
is not eligible for production until the downstream source/build/test/
candidate/evidence/release receipts exist and are independently verified.

## NodeSemanticRuleGeneratorTransitionV2 (Compatibility Evidence)

The transition compiler fresh-reproduces the V1 rule, intent and path-token
authorities and fresh-verifies FileTreeV2 plus BuildTopologyV2. It emits exactly
one transition per FileTree entrypoint requirement, retaining V1 rule-set/rule,
subject, scope, story, owner, parser, locator, cardinality, output policy and
postcondition identity. Missing, extra or duplicated requirements fail closed.
The inherited bound is one entrypoint registration, one to 500 route
registrations and one runtime registration, for at most 502 transitions.

Every target points to the same profile-selected entrypoint and changes
authority from setup-owned/model-writable AST slots to a code-owned,
deterministic whole-file generator with model writes forbidden. CLI is a Node
ESM process module with no named export. API exposes exactly
`setfarmHttpHandlerV2`; listener/server/socket ownership stays in the platform
and candidate `listen()` remains forbidden. The V1 artifact stays historical
and production-ineligible.

The transition hash binds stable semantic authority and `logicalBuildHash`.
Operational manifest, admission scope, dependency receipt and private paths are
fresh-verified but excluded from that identity. A new private attempt therefore
cannot appear to be a new semantic delta. Five exact blockers remain:
declarations, generator implementation, generator release manifest, rule
activation and the generated source receipt.

## SemanticRealizationPlanV2

`setfarm.semantic-realization-plan.v2` is the only native implementation-choice
authority for the current Node profiles. Its producer fresh-recompiles
ProductSpecV2, ProductDeliverySelectionV2 and SemanticSourceIntentSetV1; callers
cannot provide intents, policies, paths or realizations. The code-owned policy
pins exact delivery-profile, stack-pack version/content and V1 rule-set hashes.
Same-name upstream drift therefore rejects until the policy is intentionally
versioned.

Every semantic intent is realized exactly once as:

- `node_product_runtime_generator_member`;
- `platform_contract_binding`;
- `typed_exemption`; or
- `evidence_relation`.

Legacy target kind/hash remains `compatibility_evidence_only`. Current Node
action handlers, input/output codecs, state runtime, runtime-data seeds,
observable projection, non-rendered surface and route/runtime/entrypoint
registration all become members of one code-owned whole-file runtime generator.
The plan has `modelWriteGrantCount: 0`. CLI and API ABI remain distinct and
exact; generated output is forbidden from owning the API listener or calling
`listen()`.

The plan also pins `setfarm.node-product-test-generator-contract.v2` and the
exact selected test profile. The code-owned contract binds CLI test source/
output to `src/cli.setfarm.test.ts` / `dist/cli.setfarm.test.js` and API to
`src/app.setfarm.test.ts` / `dist/app.setfarm.test.js`. Both use a direct
`node --test <compiled-file>` ABI. CLI may spawn only its exact same-runtime
module; API subprocesses and all network-based test execution are forbidden.
The test source is a code-owned whole file, model writes and zero-test receipts
are forbidden, and coverage must include every action plus every required
evidence relation.

The schema closes counts, uniqueness, canonical order, policy/member equality,
membership hash and complete plan hash. The verifier still fresh-reproduces the
entire artifact, because a locally self-rehashed omission can be structurally
valid. Stable identity excludes private roots, mutable paths and attempt
receipts. Production remains blocked on FileTreeV3, BuildTopologyV3, runtime and
test generator implementations, evidence registry, runtime/test source receipts
and release manifest.

## SemanticSourceDeclarationsV1 (Future Model-Authored Realizations Only)

This artifact is not part of current Node CLI/API generation. If ProductSpec is
later versioned with an explicit opaque-behavior contract and realization policy
selects model authorship, a declaration compiler may fresh-reproduce only those
admitted realizations and join them to FileTreeV3. Such a declaration binds:

- realization/intent/rule/subject/responsibility identity;
- story, owner, path ref, normalized path, and access mode;
- current base presence and current base content/absence hash;
- exact structural locator and parser contract; and
- structural postcondition without a future writable content hash.

Every admitted model-writable realization resolves to one owned or explicitly
granted path, and every such path is declaration-closed. Missing, extra,
duplicate, ambiguous, overlapping structural slots, unowned paths, and
undeclared writable paths are compile blockers. Shared files require a
versioned aggregation rule, exact grants, unique slot keys and parser-proven
non-overlap. The V1 declaration design cannot be applied to V2 paths or used to
manufacture model ownership absent the ProductSpec behavior contract.

## StoryPlanV3

StoryPlanV3 is produced after generated source receipts and any explicitly
admitted model-authored declarations. Each story retains its V2 semantic sets
and adds exact realization, intent, receipt and optional declaration refs.
Dependency edges include source ownership as well as physical shared grants. A
story cannot consume a realization owned by a later or unrelated story.

V2 story plans remain historical. V3 is not obtained by adding declaration
refs to an already sealed V2 object.

## ImplementationSourceMapV2

SourceMapV2 is a root artifact plus one artifact per story leaf.

The root manifest binds exact ProductSpecV2, ProductDeliveryProfileV2,
SemanticSourceIntentSetV1, SemanticRealizationPlanV2, BuildTopologyV3,
realization source receipts, any admitted declarations, StoryPlanV3, and
verified design-source hashes.
It contains canonical leaf refs with `(index, storyId, storyHash,
leafEnvelopeHash, byteLength)` and one Merkle commitment, not every leaf
payload. The manifest does not bind its future packet hash; PacketV4 binds the
manifest envelope hash, root, leaf count, and story-ID-set hash in the forward
direction so no identity cycle exists.

Each story leaf contains every and only:

- the story's semantic subject sets;
- exact realization refs and source-receipt bindings;
- optional declarations only for explicitly admitted model-authored behavior;
- generated design source bindings;
- entrypoint and command refs required by that story;
- evidence-predicate-to-realization evidence bindings; and
- exact source coverage/cardinality hashes.

Leaf, pair-node, and unary-node hashes use separate canonical domains. Leaves
are ordered by UTF-16 story ID. Each level pairs left-to-right; an odd child is
wrapped in one explicit unary node and is never duplicated or padded. A proof
records leaf index/count and exact `left`, `right`, or `unary` steps. A verifier
derives the only legal orientation and proof length from index/count and rejects
non-canonical steps, wrong direction, duplicate/unnecessary unary steps, wrong
leaf index/count, root mismatch, or a leaf that does not freshly reproduce from
compiler input.

`ImplementationSourceMapStoryProofV2` carries only root artifact/authority
hashes, one leaf envelope/hash/index, leaf count, story-ID-set hash, and its
audit path. It contains no other story leaf, global V1 witness, catalog body, or
unrelated topology.

## Compiler And Verifier APIs

Every public compiler/verifier accepts `unknown`, snapshots it with bounded
canonical JSON, validates strict schemas, loads code-owned catalogs by exact
identity, and returns typed diagnostics.

The public stages are:

```ts
compileStackSemanticSourceRulesCatalogV1(releaseInput)
verifyStackSemanticSourceRulesCatalogV1(verificationInput)
resolveProductDeliverySelectionV2(selectionInput)
verifyProductDeliverySelectionV2(verificationInput)
compileSemanticSourceIntentSetV1(authorityInput)
verifySemanticSourceIntentSetV1(verificationInput)
compileSemanticRealizationPlanV2(authorityInput)
verifySemanticRealizationPlanV2(verificationInput)
compileFileTreeManifestV3(authorityInput)
verifyFileTreeManifestV3(verificationInput)
compileBuildTopologyV3(authorityInput)
verifyBuildTopologyV3(verificationInput)
compileProductRuntimeBehaviorContractV1(authorityInput)
verifyProductRuntimeBehaviorContractV1(verificationInput)
generateNodeProductRuntimeSourceV2(privateStageHandle, authorityInput)
verifyNodeProductRuntimeSourceV2(privateStageHandle, verificationInput)
compileImplementationSourceMapV2(authorityInput)
verifyImplementationSourceMapStoryProofV2(verificationInput)
```

Successful results are recursively immutable and expose distinct payload hashes
and full-envelope CAS hashes. Full envelopes pass bounded artifact-store batch
preparation before they can be returned as publishable.

The first shadow compiler may receive release identity as bounded input, as the
current adapter registry does. Production admission remains blocked until code
SHA, platform bundle, semantic-rule catalog, parser contracts, and external
resolution are derived from typed verified release manifests rather than
caller-supplied hashes.

Diagnostics are canonical, bounded to 100 entries including an overflow
sentinel, and never use thrown caller values as text.

Manifest and leaf envelopes are individually bounded by the four-MiB CAS
limit. A manifest has at most 5,000 leaves; one leaf has at most 20,000 planned
slots and 100,000 semantic bindings. Proof depth and step orientation must equal
the deterministic tree for the declared leaf count. Root activation occurs
only after every referenced leaf CAS identity is proven in one DB authority
transaction.

## Compatibility And Cutover

Historical branch:

```text
ProductBuildPacketV1/V2 + StoryPlanV1 + ImplementationSliceV1
```

New-write branch after activation:

```text
ProductBuildPacketV4 + StoryPlanV3 + ImplementationSourceMapV2 proof
  + ImplementationSliceV2 + EvidencePlanV2 + HandoffV2 + ContextV2
```

PacketV3 is not promoted into the realization-driven branch. PacketV4 binds the
exact realization plan, V3 topology, source receipts and SourceMap proof before
its first live write. Historical V1/V2/V3 packet and SliceV1 read/replay remains
discriminated. No historical artifact is rewritten, promoted, or silently
projected into the new branch.

Rollback before cutover removes only shadow artifact refs and profile-selection
enablement.
Rollback after cutover drains new claims first and restores the previous whole
new-write release; it does not translate V3 attempts into historical attempts.

## Dependency-Order Implementation Program

1. Add this design and keep production NO-GO.
2. Implement strict StackSemanticSourceRulesCatalogV1 schema/compiler/verifier
   with four cross-class shadow rule sets and exact unresolved blockers.
3. Implement GeneratedSourceReceiptV2 for Stitch source and
   InvocationInputTransportV2 for CLI/API ABIs.
4. Implement required structural parser implementation for the rule sets that
   retain parser-owned shared slots, typed release manifest, activation receipt,
   and negative fixtures. Do not activate a catalog label. Node V1 shared
   entrypoint rules remain compatibility-only and version forward to the
   generator-owned lifecycle described above.
5. Implement ProductDeliveryProfileV2 exact rules/activation-receipt binding and
   selection tests.
6. Implement pure SemanticSourceIntentSetV1 derivation and every-and-only
   coverage tests across utility, operations/data, game, CLI, and API fixtures.
7. Implement NodeExecutionLayoutCatalogV2 2.1 and PathTokenV2, then
   NodeScaffoldToolchainCatalogV2 exact bytes/build graph and its fresh resolver.
8. Implement ByteBundle deep CAS verification, host-toolchain admission, exact
   build-dependency receipt, and private staged scaffold materializer.
9. Preserve FileTreeManifestV2, BuildTopologyV2 and the Node entrypoint
   transition as compatibility evidence; do not activate them.
10. Implement SemanticRealizationPlanV2 and prove zero implicit model-write
    authority across CLI, one-route API and two-route API fixtures.
11. Implement realization-driven FileTreeManifestV3 without adapting V2
    semantic writable paths, then implement BuildTopologyV3 from its
    dependency-stage fresh verifier.
12. Preserve NodeProductRuntimeGeneratorV2 as executable-subset shadow proof.
    ProductRuntimeBehaviorContractV1 now binds every opaque invariant and
    entity-field snapshot occurrence in isolation. Implement the atomic
    PlanProductBuildProposalV1 producer/integration, then version-forward the
    realization, FileTree, BuildTopology and runtime generator authority to
    consume its exact hash. No prose parser or compatibility adapter is
    permitted.
13. Implement NodeProductTestGeneratorV2 from the same runtime program and
    behavior authority, then every-member test source receipt,
    evidence-registry join and release manifest.
14. Implement StoryPlanV3, SourceMapV2 root/leaves/proofs and least-privilege
    story proof verification; declarations remain conditional on a future
    explicitly model-authored realization and never carry opaque behavior.
15. Seal ProductBuildPacketV4 and ImplementationSliceV2 before their first live
    write, then resume EvidencePlanV2 -> HandoffV2 -> ContextV2.
16. Only after DB provenance, typed retry deltas, bounded supervisor recovery and
    three-class clean evals may the new-write branch cut over.

## Test Matrix

Catalog unit tests cover strict parsing, exact stack/profile reproduction,
domain hashes, canonical order, duplicate rule ownership, invalid activation/
cardinality/path/locator combinations, unknown refs, hostile inputs, immutable
outputs, 4 MiB publication bounds, release drift, self-consistent blocker/domain/
topology forgeries, and rejection of an invented active label.

Layout tests additionally pin the exact CLI/API source-output-module/export ABI,
legacy installer observation hashes, and the catalog's own version-to-hash
identity. They reject reversed rehashed catalogs, cross-domain hashes, stale
same-profile selections, process-local stack-pack drift, both historical API
fallbacks, CLI output-root disagreement, and every rehashed source/output/
module/export override while production blockers remain exact. Revision 2.1
also pins the package-lock slot, dependency-lock consumer, npm/tsc tool refs,
updated slot/token/consumer cardinalities, and the intentional 2.0-to-2.1 hash
transition.

Scaffold catalog tests require two entries, exactly three canonical-LF JSON
artifacts per profile, title/run/repository independence, exact package/lock/
tsconfig semantic joins, every-and-only derived lock graph closure, absence of
source, test, `.gitignore`, README and output artifacts, no root lifecycle,
start or listen scripts, zero-test non-evidence, and typed rejection of build
before a generated entrypoint receipt. Adversarial cases include
cross-profile substitution, self-rehashing, unsupported version-spec/tag/git/
file/workspace injection, lock-root or registry/integrity drift,
missing/extra/reordered artifacts, trailing/noncanonical lock paths, wrong-name
and non-nearest target swaps, unsafe-number/leading-zero/oversized version
inputs, dependency-to-toolchain drift, contradictory or duplicate resolved file
tokens, hostile bounded inputs, three-versus-four semantic requirement closure,
missing PATH authority, ambient npm config drift, precondition omission/reorder,
and orphaned blocker codes. Fake PATH execution and source mutation during
dependency materialization remain future integration tests until those private
consumers exist; this catalog slice tests their fail-closed environment,
precondition, command and blocker contracts.

Intent tests cover exact semantic obligation closure, title/slug independence,
determinism, missing/extra/duplicate subjects, persistence exemptions, generated
source receipts, shared structural slots, and unsupported stack blockers.

Realization tests cover every-and-only policy matching, exact upstream hash
pins, zero implicit model writes, CLI/API ABI separation, multi-story runtime
data, memory-state backing, stale authority, self-rehashed omissions, policy
forgeries and bounded hostile inputs. FileTreeV3 tests prove V2 writable paths
and grants cannot be adapted into the new artifact, every runtime/test
obligation has one target, physical attempts preserve stable logical identity,
and base/dependency-stage fresh verification rejects self-rehashed omissions
and cross-profile substitutions.

BuildTopologyV3 tests cover all 11 path roles, direct authenticated compiler
execution, exact direct CLI/API test files, source/output/candidate closure,
runtime and test membership, empty grants, scope separation, stable logical
identity across physical attempts, and fresh canonical verification. They reject
npm test discovery, V2/entrypoint/story leakage, private-path leakage, strict
input extras, accessors, proxies, schema-valid logical and operational
self-rehashes, and cross-profile topology substitution.

Runtime-source tests cover CLI, one-route API and two-route API generation,
every-member marker spans, strict TypeScript semantic checking, real CLI process
execution, direct API-handler execution, typed invalid-input failure, source
tampering, logical self-rehash forgery and sibling-attempt identity separation.
Positive tests intentionally clear prose invariants and therefore prove only the
machine-executable ProductSpec V2 subset. Non-empty prose invariants and unbound
entity-field reads fail with typed pre-source diagnostics. Behavior-contract
tests now prove every-and-only opaque occurrence coverage, functional
disposition anti-laundering, bounded evaluator work, state/path/type compatibility,
snapshot selection determinism, enum-domain and malformed-member rejection,
fresh-verifier rejection and hostile input. PLAN integration tests must next
prove atomic semantic/behavior cardinality, local-key mapping and cross-proposal
substitution rejection.

Conditional declaration tests cover only explicitly model-authored realizations:
every-and-only topology joins, ownership/grants, current base hashes, absent
paths, overlapping locators, undeclared writable paths and no future writable
hash.

Proof tests cover one/two/non-power-of-two story sets, reordered leaves, forged
root/leaf/sibling/index/count, global witness leakage, bounded proof work, and
fresh reproduction.

Integration fixtures cover:

- Vite utility with action input, state, and reload persistence;
- operations/data product with create/select/delete and shared registration;
- browser game with system/timer actions and durable high score;
- no-design Node CLI; and
- no-design Node API.

Production release still requires clean utility, operations/data, and browser-
game runs with zero new project-specific guards and canonical Mission Control
evidence.

## GO / NO-GO

GO for the isolated shadow authority chain through BuildTopologyV3,
NodeProductRuntimeGeneratorV2's machine-executable subset and the standalone
ProductRuntimeBehaviorContractV1 compiler/evaluator, including their fixture,
adversarial and real-process proof.

NO-GO for source intent activation, setup topology replacement, packet/slice
version cutover, model dispatch, runtime evidence, retry, supervisor, Mission
Control, deploy, or live runs until the atomic PLAN producer, behavior-hash
version forwarding, generated test/source materialization, authenticated
build/test/candidate evidence and their later dependency stages pass
independently.
