import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  produceRuntimeDataContractV1,
  validateRuntimeDataContractClosureV1,
} from "../../src/product-compiler/producers/runtime-data-contract.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  RuntimeDataContractV1Schema,
  RuntimeDataProvisioningV1Schema,
} from "../../src/product-compiler/schemas/runtime-data-contract-v1.js";
import {
  ProductSpecV1Schema,
  ProductSpecV3ProposalSchema,
  validatePersistenceDeliveryCompatibilityV1,
  type PersistencePolicyV1,
  type ProductDeliveryV1,
} from "../../src/product-compiler/schemas/product-spec-v1.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";
import { buildContainedGameProductSpecV2 } from "./fixtures/product-semantics-v2.js";

type RuntimeProfile = "browser" | "stateless" | "sqlite" | "postgres";

const TASK = "Let a user save one task and verify the resulting state.";

const PLATFORM_STACKS: Readonly<Record<ProductDeliveryV1["platform"], ProductDeliveryV1["techStack"]>> = {
  web: "vite-react",
  mobile: "react-native-expo",
  desktop: "desktop-electron",
  api: "node-express",
  cli: "node-cli",
  game: "browser-game",
};

function deliveryFor(platform: ProductDeliveryV1["platform"]): ProductDeliveryV1 {
  return {
    platform,
    techStack: PLATFORM_STACKS[platform],
    uiLanguage: "English",
    database: "none",
    designRequired: platform !== "api" && platform !== "cli",
    uiVisionSummary: "Compatibility matrix fixture.",
  };
}

function v3ProductSpec(profile: RuntimeProfile): any {
  const value: any = structuredClone(buildMinimalValidContracts().productSpec);
  const policy = value.persistencePolicies[0];
  if (profile === "stateless") {
    policy.kind = "memory";
    policy.owner = "server";
    policy.durability = "session";
    policy.rehydration = { kind: "none" };
    delete policy.key;
  } else if (profile === "sqlite" || profile === "postgres") {
    policy.kind = "database";
    policy.owner = profile === "sqlite" ? "server" : "external";
    policy.durability = "durable";
    policy.rehydration = { kind: "initialization" };
    delete policy.key;
  }

  const action = value.actions[0];
  action.observableEffects = [{
    id: "OBS_SAVE_CONFIRMATION",
    selector: { kind: "control", actionRef: action.id },
    assertions: [
      { phase: "after", property: "visible_text", operator: "equals", expected: "Saved" },
      ...(policy.durability === "session" ? [] : [
        { phase: "reload", property: "visible_text", operator: "equals", expected: "Saved" },
      ]),
    ],
    evidenceRef: "EVID_SAVE_CONFIRMATION",
  }];
  action.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
  action.success.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
  value.evidencePredicates.push({
    id: "EVID_SAVE_CONFIRMATION",
    kind: "observable_outcome",
    required: true,
    subjectRef: "OBS_SAVE_CONFIRMATION",
    capabilityRefs: [],
    assertion: { operator: "passes" },
  });
  value.delivery = profile === "browser" ? {
    platform: "web",
    techStack: "vite-react",
    uiLanguage: "English",
    database: "none",
    designRequired: true,
    uiVisionSummary: "A focused browser editor with one exact persistence owner.",
  } : {
    platform: "api",
    techStack: "node-express",
    uiLanguage: "English",
    database: profile === "sqlite" ? "sqlite" : profile === "postgres" ? "postgres" : "none",
    designRequired: false,
    uiVisionSummary: "A focused service with one exact runtime data authority.",
  };

  const ledger = extractTaskRequirementLedgerV1(TASK);
  value.requirements = ledger.requirements.map((requirement) => ({
    ...requirement,
    classification: "functional",
    expectedSemanticKinds: ["action"],
  }));
  const requirementRefs = ledger.requirements.map((requirement) => requirement.id);
  const semanticRefs = [
    ...value.product.goals.map((item: any) => ["goal", item.id]),
    ...value.product.nonGoals.map((item: any) => ["non_goal", item.id]),
    ...value.entities.map((item: any) => ["entity", item.id]),
    ...value.states.map((item: any) => ["state", item.id]),
    ...value.persistencePolicies.map((item: any) => ["persistence", item.id]),
    ...value.routes.map((item: any) => ["route", item.id]),
    ...value.surfaces.map((item: any) => ["surface", item.id]),
    ...value.actions.map((item: any) => ["action", item.id]),
    ...value.evidencePredicates.map((item: any) => ["evidence", item.id]),
    ...value.actions.flatMap((candidate: any) =>
      candidate.observableEffects.map((item: any) => ["observable", item.id])),
  ];
  value.traceability = {
    schema: "setfarm.product-requirement-traceability.v1",
    sourceTaskHash: ledger.sourceHash,
    bindings: semanticRefs.map(([semanticKind, semanticRef]) => ({
      semanticKind,
      semanticRef,
      requirementRefs,
    })),
  };
  return ProductSpecV1Schema.parse(value);
}

function commands() {
  return [
    {
      id: "CMD_BUILD",
      kind: "build",
      argv: ["npm", "run", "build"],
      cwd: ".",
      timeoutMs: 120_000,
      capabilityRefs: [],
    },
    {
      id: "CMD_MIGRATE",
      kind: "migrate",
      argv: ["npm", "run", "db:migrate"],
      cwd: ".",
      timeoutMs: 120_000,
      capabilityRefs: [],
      envRefs: ["DATABASE_URL", "SETFARM_DATA_DIR"],
    },
  ];
}

function sqliteProvisioning(): any {
  return {
    schema: "setfarm.runtime-data-provisioning.v1",
    writableVolumes: [{
      volumeId: "VOLUME_PRIMARY_DATA",
      authorityId: "AUTH_DATA_SQLITE",
      persistenceClass: "project",
      purpose: "database",
      mountEnvRef: "SETFARM_DATA_DIR",
      durability: "durable",
      dataPaths: [{ persistenceRef: "PERSIST_TASK_LOCAL", relativePath: "task/task.sqlite" }],
      quota: { maxBytes: 268_435_456, maxFiles: 32 },
      migrationCommandRef: "CMD_MIGRATE",
    }],
    externalDatabases: [],
    scratch: {
      kind: "platform-managed",
      quota: { maxBytes: 67_108_864, maxFiles: 2_000 },
    },
  };
}

function postgresProvisioning(): any {
  return {
    schema: "setfarm.runtime-data-provisioning.v1",
    writableVolumes: [],
    externalDatabases: [{
      authorityId: "AUTH_DATA_PRIMARY_DATABASE",
      databaseKind: "postgres",
      persistenceRefs: ["PERSIST_TASK_LOCAL"],
      credentialEnvRefs: ["DATABASE_URL"],
      migrationCommandRef: "CMD_MIGRATE",
    }],
    scratch: { kind: "none" },
  };
}

describe("Product Build Packet runtime-data contract", () => {
  it("accepts exactly the supported 14 of 360 stateless/browser compatibility tuples", () => {
    const platforms: ProductDeliveryV1["platform"][] = ["web", "mobile", "desktop", "api", "cli", "game"];
    const kinds: PersistencePolicyV1["kind"][] = ["none", "memory", "local_storage"];
    const owners: PersistencePolicyV1["owner"][] = ["application", "user", "server", "external"];
    const durabilities: PersistencePolicyV1["durability"][] = ["none", "session", "reload", "restart", "durable"];
    let accepted = 0;
    let rejected = 0;

    platforms.forEach((platform) => kinds.forEach((kind) => owners.forEach((owner) => durabilities.forEach((durability) => {
      const policy: PersistencePolicyV1 = {
        id: "PERSIST_MATRIX",
        kind,
        owner,
        entityRefs: [],
        durability,
        ...(kind === "local_storage" ? { key: "matrix-v1" } : {}),
        rehydration: kind === "local_storage" ? { kind: "initialization" } : { kind: "none" },
      };
      const issues = validatePersistenceDeliveryCompatibilityV1({
        delivery: deliveryFor(platform),
        policies: [policy],
      });
      const expected = kind === "none"
        ? owner === (platform === "api" ? "server" : "application") && durability === "none"
        : kind === "memory"
          ? owner === (platform === "api" ? "server" : "application") && durability === "session"
          : (platform === "web" || platform === "game") && owner === "application" && durability === "reload";
      assert.equal(
        issues.length === 0,
        expected,
        JSON.stringify({ platform, kind, owner, durability, issues }),
      );
      if (issues.length === 0) accepted += 1;
      else rejected += 1;
    }))));

    assert.deepEqual({ accepted, rejected }, { accepted: 14, rejected: 346 });
  });

  it("uses the same compatibility authority in the v3 ProductSpec and runtime producer", () => {
    const invalid = structuredClone(v3ProductSpec("browser"));
    invalid.persistencePolicies[0].kind = "memory";
    invalid.persistencePolicies[0].owner = "application";
    invalid.persistencePolicies[0].durability = "session";
    invalid.persistencePolicies[0].rehydration = { kind: "none" };
    const proposal = ProductSpecV3ProposalSchema.safeParse(invalid);
    assert.equal(proposal.success, false);
    if (!proposal.success) {
      assert.equal(
        proposal.error.issues.some((issue) => issue.message.includes("PERSISTENCE_V1_KEY_FORBIDDEN")),
        true,
      );
    }

    const produced = produceRuntimeDataContractV1({ productSpec: invalid, commands: commands() });
    assert.equal(produced.status, "rejected");
    if (produced.status === "rejected") {
      assert.equal(produced.rejectionCodes.includes("PERSISTENCE_V1_KEY_FORBIDDEN"), true);
    }
  });

  it("rejects browser-key aliasing before two policies can share one origin key", () => {
    const policies = ["PERSIST_FIRST", "PERSIST_SECOND"].map((id): PersistencePolicyV1 => ({
      id,
      kind: "local_storage",
      owner: "application",
      entityRefs: [],
      durability: "reload",
      key: "shared-key-v1",
      rehydration: { kind: "initialization" },
    }));
    const issues = validatePersistenceDeliveryCompatibilityV1({
      delivery: deliveryFor("web"),
      policies,
    });
    assert.equal(issues.filter((issue) => issue.code === "PERSISTENCE_V1_BROWSER_KEY_COLLISION").length, 2);
  });

  it("derives browser localStorage authority without a host volume", () => {
    const result = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("browser"),
      commands: commands(),
    });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.deepEqual(result.contract.writableVolumes, []);
    assert.deepEqual(result.contract.authorities.map((authority) => authority.kind), ["browser-origin"]);
    const browser = result.contract.authorities[0];
    assert.equal(browser?.kind, "browser-origin");
    if (browser?.kind === "browser-origin") {
      assert.deepEqual(browser.keyBindings, [{
        persistenceRef: "PERSIST_TASK_LOCAL",
        key: "task-editor-v1",
        durability: "reload",
      }]);
    }
    assert.deepEqual(RuntimeDataContractV1Schema.parse(result.contract), result.contract);
  });

  it("derives a stateless service authority with no durable volume", () => {
    const result = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("stateless"),
      commands: commands(),
    });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.deepEqual(result.contract.writableVolumes, []);
    assert.deepEqual(result.contract.authorities, [{
      id: "AUTH_DATA_STATELESS_SESSION",
      kind: "stateless",
      durability: "session",
      persistenceRefs: ["PERSIST_TASK_LOCAL"],
    }]);
  });

  it("reproduces the exact runtime-data closure from native ProductSpecV2", () => {
    const productSpec = buildContainedGameProductSpecV2();
    const result = produceRuntimeDataContractV1({ productSpec, commands: commands() });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.equal(result.contract.sourceProductSpecHash, hashCanonicalJson(productSpec));
    assert.deepEqual(validateRuntimeDataContractClosureV1({
      productSpec,
      commands: commands(),
      contract: result.contract,
      contractHash: result.contractHash,
    }), []);
  });

  it("preserves none and session durability as separate exact authorities", () => {
    const productSpec = structuredClone(v3ProductSpec("stateless"));
    productSpec.persistencePolicies.push({
      id: "PERSIST_REQUEST_EPHEMERAL",
      kind: "none",
      owner: "server",
      entityRefs: [],
      durability: "none",
      rehydration: { kind: "none" },
    });
    productSpec.traceability.bindings.push({
      semanticKind: "persistence",
      semanticRef: "PERSIST_REQUEST_EPHEMERAL",
      requirementRefs: productSpec.requirements.map((requirement: any) => requirement.id),
    });
    const result = produceRuntimeDataContractV1({ productSpec, commands: commands() });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.deepEqual(result.contract.authorities, [
      {
        id: "AUTH_DATA_STATELESS_NONE",
        kind: "stateless",
        durability: "none",
        persistenceRefs: ["PERSIST_REQUEST_EPHEMERAL"],
      },
      {
        id: "AUTH_DATA_STATELESS_SESSION",
        kind: "stateless",
        durability: "session",
        persistenceRefs: ["PERSIST_TASK_LOCAL"],
      },
    ]);
  });

  it("binds SQLite to an exact durable volume, path, quotas, mount, migration, and scratch ABI", () => {
    const first = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("sqlite"),
      commands: commands(),
      provisioning: sqliteProvisioning(),
    });
    const second = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("sqlite"),
      commands: commands().reverse(),
      provisioning: sqliteProvisioning(),
    });
    assert.equal(first.status, "produced", JSON.stringify(first));
    assert.equal(second.status, "produced", JSON.stringify(second));
    if (first.status !== "produced" || second.status !== "produced") return;
    assert.equal(second.contractHash, first.contractHash);
    assert.deepEqual(first.contract.writableVolumes, [{
      volumeId: "VOLUME_PRIMARY_DATA",
      authorityId: "AUTH_DATA_SQLITE",
      persistenceClass: "project",
      purpose: "database",
      mountEnvRef: "SETFARM_DATA_DIR",
      durability: "durable",
      dataPaths: [{ persistenceRef: "PERSIST_TASK_LOCAL", relativePath: "task/task.sqlite" }],
      quota: { maxBytes: 268_435_456, maxFiles: 32 },
      migrationCommandRef: "CMD_MIGRATE",
    }]);
    assert.equal(first.contract.authorities[0]?.kind, "server-filesystem");
    assert.deepEqual(first.contract.scratch, {
      kind: "platform-managed",
      lifecycle: "attempt",
      persistenceAllowed: false,
      envBindings: [
        { envRef: "HOME", purpose: "home" },
        { envRef: "TMPDIR", purpose: "temporary" },
        { envRef: "XDG_CACHE_HOME", purpose: "cache" },
      ],
      quota: { maxBytes: 67_108_864, maxFiles: 2_000 },
    });
  });

  it("binds PostgreSQL only through named credential refs and an exact migration command", () => {
    const result = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("postgres"),
      commands: commands(),
      provisioning: postgresProvisioning(),
    });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.deepEqual(result.contract.writableVolumes, []);
    assert.deepEqual(result.contract.authorities, [{
      id: "AUTH_DATA_PRIMARY_DATABASE",
      kind: "external-database",
      databaseKind: "postgres",
      durability: "durable",
      persistenceRefs: ["PERSIST_TASK_LOCAL"],
      credentialEnvRefs: ["DATABASE_URL"],
      migrationCommandRef: "CMD_MIGRATE",
    }]);

    const withSecretValue = postgresProvisioning();
    withSecretValue.externalDatabases[0].credentialValues = { DATABASE_URL: "secret" };
    const rejected = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("postgres"),
      commands: commands(),
      provisioning: withSecretValue,
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status === "rejected") {
      assert.deepEqual(rejected.rejectionCodes, ["RUNTIME_DATA_INPUT_INVALID"]);
    }
  });

  it("rejects the unversioned generic external database delivery ABI", () => {
    const productSpec = structuredClone(v3ProductSpec("postgres"));
    productSpec.delivery.database = "external";
    const result = produceRuntimeDataContractV1({
      productSpec,
      commands: commands(),
      provisioning: postgresProvisioning(),
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("PERSISTENCE_V1_DELIVERY_DATABASE_UNSUPPORTED"), true);
    assert.equal(result.rejectionCodes.includes("PERSISTENCE_V1_DATABASE_MISMATCH"), true);
  });

  it("rejects reserved/cross-purpose environment refs and ancestor-overlapping volume paths", () => {
    const reserved = sqliteProvisioning();
    reserved.writableVolumes[0].mountEnvRef = "HOME";
    assert.equal(RuntimeDataProvisioningV1Schema.safeParse(reserved).success, false);

    const crossPurpose = sqliteProvisioning();
    crossPurpose.externalDatabases.push({
      authorityId: "AUTH_DATA_SECONDARY_DATABASE",
      databaseKind: "postgres",
      persistenceRefs: ["PERSIST_SECONDARY"],
      credentialEnvRefs: ["SETFARM_DATA_DIR"],
      migrationCommandRef: "CMD_MIGRATE",
    });
    assert.equal(RuntimeDataProvisioningV1Schema.safeParse(crossPurpose).success, false);

    const overlap = sqliteProvisioning();
    overlap.writableVolumes[0].dataPaths = [
      { persistenceRef: "PERSIST_TASK_LOCAL", relativePath: "task" },
      { persistenceRef: "PERSIST_TASK_EXPORT", relativePath: "task/export.json" },
    ];
    assert.equal(RuntimeDataProvisioningV1Schema.safeParse(overlap).success, false);
  });

  it("rejects one filesystem authority that ambiguously mixes files and SQLite", () => {
    const productSpec = structuredClone(v3ProductSpec("sqlite"));
    productSpec.persistencePolicies.push({
      id: "PERSIST_TASK_EXPORT",
      kind: "file",
      owner: "server",
      entityRefs: ["ENTITY_TASK"],
      durability: "durable",
      rehydration: { kind: "initialization" },
    });
    productSpec.traceability.bindings.push({
      semanticKind: "persistence",
      semanticRef: "PERSIST_TASK_EXPORT",
      requirementRefs: productSpec.requirements.map((requirement: any) => requirement.id),
    });
    const provisioning = sqliteProvisioning();
    provisioning.writableVolumes[0].dataPaths.push({
      persistenceRef: "PERSIST_TASK_EXPORT",
      relativePath: "exports/task.json",
    });

    const result = produceRuntimeDataContractV1({
      productSpec,
      commands: commands(),
      provisioning,
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(result.rejectionCodes.includes("RUNTIME_DATA_AUTHORITY_ENGINE_MIXED"), true);
    }
  });

  it("fails closed on missing/invalid migrations and missing quotas", () => {
    const missingMigration = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("sqlite"),
      commands: commands().filter((command) => command.id !== "CMD_MIGRATE"),
      provisioning: sqliteProvisioning(),
    });
    assert.equal(missingMigration.status, "rejected");
    if (missingMigration.status === "rejected") {
      assert.equal(missingMigration.rejectionCodes.includes("RUNTIME_DATA_MIGRATION_COMMAND_MISSING"), true);
    }

    const wrongKind = commands();
    wrongKind[1]!.kind = "build";
    const invalidMigration = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("sqlite"),
      commands: wrongKind,
      provisioning: sqliteProvisioning(),
    });
    assert.equal(invalidMigration.status, "rejected");
    if (invalidMigration.status === "rejected") {
      assert.equal(invalidMigration.rejectionCodes.includes("RUNTIME_DATA_MIGRATION_COMMAND_KIND_INVALID"), true);
    }

    const missingQuota = sqliteProvisioning();
    delete missingQuota.writableVolumes[0].quota;
    const invalidQuota = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("sqlite"),
      commands: commands(),
      provisioning: missingQuota,
    });
    assert.equal(invalidQuota.status, "rejected");
    if (invalidQuota.status === "rejected") {
      assert.deepEqual(invalidQuota.rejectionCodes, ["RUNTIME_DATA_INPUT_INVALID"]);
    }
  });

  it("rejects an extra/unowned volume instead of turning it into implementation advice", () => {
    const result = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("browser"),
      commands: commands(),
      provisioning: sqliteProvisioning(),
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("RUNTIME_DATA_VOLUME_EXTRA"), true);
    assert.equal(result.rejectionCodes.includes("RUNTIME_DATA_VOLUME_POLICY_UNSUPPORTED"), true);
  });

  it("rejects an extra authority with no ProductSpec ownership", () => {
    const result = produceRuntimeDataContractV1({
      productSpec: v3ProductSpec("browser"),
      commands: commands(),
    });
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    const extra: any = structuredClone(result.contract);
    extra.authorities.push({
      id: "AUTH_DATA_UNUSED",
      kind: "stateless",
      durability: "none",
      persistenceRefs: [],
    });
    extra.authorities.sort((left: any, right: any) => left.id.localeCompare(right.id));
    assert.equal(RuntimeDataContractV1Schema.safeParse(extra).success, false);
  });
});
