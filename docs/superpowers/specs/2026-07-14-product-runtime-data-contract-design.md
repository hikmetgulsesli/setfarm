# Product Runtime Data Contract Design

Date: 2026-07-14

Status: approved architecture, implementation-ready

Scope: Product Compiler schemas, producers, packet/slice compilation, setup
adapter projections, focused tests, and this document. Execution, deployment,
sealed-runtime, stack catalog, migrations, package scripts, and Mission Control
are downstream work and are not changed by this slice.

## Problem

The ProductSpec states logical persistence intent, while BuildTopology currently
states files, commands, entrypoints, and capabilities. Neither artifact tells an
implementation or deployment consumer where server data may be written, which
environment binding provides that location, how large it may grow, who owns its
durability, or which exact command owns schema migration. That gap permits a
generated product to write SQLite or files into an ephemeral source/build path,
invent a credential name, omit migrations, or treat cache as durable state.

The fix is one versioned, machine-readable runtime-data contract sealed before
implementation. It is product-neutral. It derives authority from ProductSpec
delivery and persistence policies and accepts only exact resource declarations
from setup. It never guesses host paths, credential values, quotas, or migration
commands.

## Selected design

Add `setfarm.runtime-data-contract.v1`. A canonical contract and its SHA-256
content hash are embedded together in BuildTopology. ProductBuildPacket carries
the same hash. Every v3 ImplementationSlice carries the same contract and hash,
so the implementation agent receives the complete runtime-data ABI before it
writes code.

A separate fifth content-addressed child artifact was considered. It would be a
clean isolation boundary, but it expands the artifact index, DB migrations,
runtime reader, and activation protocol beyond this dependency slice. A topology-
embedded contract still has independent canonical identity and is already sealed
by the topology artifact hash. Direct unversioned topology fields were rejected
because downstream consumers could not verify a stable contract identity.

## Canonical contract

The contract contains:

```ts
interface RuntimeDataContractV1 {
  schema: "setfarm.runtime-data-contract.v1";
  contractVersion: 1;
  sourceProductSpecHash: Sha256;
  delivery: {
    platform: ProductDeliveryV1["platform"];
    techStack: ProductDeliveryV1["techStack"];
    database: ProductDeliveryV1["database"];
  };
  policyBindings: Array<{
    persistenceRef: PersistenceId;
    authorityRef: RuntimeDataAuthorityId;
  }>;
  authorities: RuntimeDataAuthorityV1[];
  writableVolumes: RuntimeWritableVolumeV1[];
  scratch: RuntimeScratchPolicyV1;
}
```

`sourceProductSpecHash` is the SHA-256 of the exact canonical ProductSpec
payload, not its producer envelope. `runtimeDataContractHash` is the SHA-256 of
the exact canonical contract payload. No timestamp, host path, PID, secret,
credential value, or operational mount result enters either hash.

Every ProductSpec persistence policy appears in exactly one `policyBindings`
entry and exactly one authority. Duplicate, absent, or extra references reject
production. Authorities are typed as follows:

- `stateless`: owns only `none` or `memory` policies and has no writable volume;
- `browser-origin`: owns only `local_storage` policies, binds each exact policy
  key, and has no host volume;
- `server-filesystem`: owns `file` policies or SQLite-backed `database`
  policies and binds them to exact declared writable volumes;
- `external-database`: owns PostgreSQL/external `database` policies and carries
  only named credential environment references plus an exact migration command.

`remote_api` persistence is unsupported in v1 and rejects upstream. Supporting
it later requires a new versioned authority variant, not a regex or fallback.

## Writable volumes and external databases

Setup may supply `setfarm.runtime-data-provisioning.v1`. It is an exact,
host-path-free declaration, not prose. A server volume declares:

- stable `volumeId` and `authorityId`;
- `persistenceClass`: `project`, `run`, or `ephemeral`;
- typed `purpose`;
- exact mount environment reference;
- one relative data path for every bound ProductSpec policy;
- exact `maxBytes` and `maxFiles` quotas;
- declared durability;
- an exact `migrationCommandRef`.

The migration reference must resolve to a topology command with kind `migrate`.
Missing commands, wrong command kinds, missing quotas, duplicate paths, extra
volumes, and volumes that bind no ProductSpec policy all reject. Relative paths
use the repository-independent normalized-relative-path contract and cannot be
absolute or escape their mount.

An external database declaration contains its stable authority ID, database
kind, exact policy references, sorted credential environment names, and an exact
`migrate` command reference. Credential values are forbidden by strict schema.
The declared database kind must equal ProductSpec delivery.

Browser-origin and stateless authorities need no setup resource declaration and
cannot receive one. SQLite, server files, PostgreSQL, and external databases
cannot seal without the corresponding exact declaration.

## Scratch and cache

Scratch is not a data authority and never satisfies a persistence policy. It is
either:

- `none`; or
- `platform-managed`, attempt-ephemeral and quota-bound, with exact bindings for
  `HOME`, `TMPDIR`, and `XDG_CACHE_HOME` and `persistenceAllowed: false`.

This separation prevents cache/home directories from becoming an undeclared
durable store. A static or no-data product remains valid with `scratch: none`
and no invented stack-specific guard.

## Producer and sealing flow

1. `produceRuntimeDataContractV1` strictly parses ProductSpec and optional setup
   provisioning.
2. It classifies every persistence policy from its typed kind plus ProductSpec
   delivery, joins exact server/external declarations, validates commands and
   quotas, rejects unused declarations, and sorts all set-like arrays.
3. `produceBuildTopologyV1` invokes that producer when a ProductSpec with v3
   delivery is present and embeds the returned contract and canonical hash.
4. The exact setup adapter passes the canonical ProductSpec and optional setup
   provisioning into the topology producer. Browser/stateless products require
   no new setup declaration; server/external products fail closed until setup
   supplies one.
5. Packet compilation verifies ProductSpec content hash, complete policy
   coverage, embedded contract hash, and topology/packet hash equality.
6. Slice compilation verifies packet/topology equality and copies the exact
   contract and hash into every v3 slice.

No consumer reconstructs the contract from prose or from filenames.

## Explicit legacy/shadow compatibility

The currently persisted v1 schemas predate runtime-data fields. Compatibility is
explicit and lossless:

- schema fields are optional at the raw historical read boundary and receive no
  default;
- both contract and hash must be present together or absent together;
- a ProductSpec with v3 delivery must have them and fails closed if either is
  absent;
- a legacy/shadow artifact with both absent is parsed as the exact historical
  byte shape and is never upgraded, defaulted, or re-sealed as a v3 artifact;
- packet/topology/slice partial presence or hash drift always rejects.

This is compatibility parsing, not semantic reinterpretation. New v3 producers
always emit the complete fields.

## Error ownership

All failures are typed compiler diagnostics. Product-policy ambiguity belongs to
PLAN/ProductSpec. Missing volume, quota, mount binding, credential reference, or
migration command belongs to setup/topology. Hash or reference drift belongs to
packet/slice compilation. None of these failures is sent to implementation as a
warning or repaired by a retry classifier.

## Verification matrix

Focused tests must prove:

1. localStorage compiles to browser-origin with no host volume;
2. a stateless service compiles with no durable volume;
3. SQLite compiles only with an exact durable volume, relative DB path, byte and
   file quota, mount env binding, and resolving migrate command;
4. external DB compiles with named credential refs and no values;
5. missing/invalid migration commands and missing/zero quotas reject;
6. unsupported policy, missing policy coverage, extra authority, and unowned
   volume reject;
7. canonical order produces an identical hash;
8. ProductSpec, topology contract, packet hash, or slice hash drift rejects;
9. legacy/shadow absence stays absent and v3 omission fails closed.

Run the focused Product Compiler test set, TypeScript compilation, and
`git diff --check`. A clean-worktree full build is deferred to the root release
validation because Setfarm intentionally refuses dirty builds.
