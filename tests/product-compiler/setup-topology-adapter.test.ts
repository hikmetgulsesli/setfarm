import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adaptExactSetupTopologyV1 } from "../../src/product-compiler/adapters/setup-topology.js";
import { topologyPathAbsenceHash } from "../../src/product-compiler/schemas/build-topology-v1.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function source(locator: string, hash: string) {
  return {
    schema: "setfarm.source-artifact-ref.v1" as const,
    hash,
    mediaType: "application/json",
    locator,
    byteLength: 1_000,
  };
}

function dependencyEvidence() {
  return { requested: [], approved: [], installed: [], rejected: [] };
}

function target(storyId: string, path: string, overrides: Record<string, unknown> = {}) {
  return {
    storyId,
    role: "action_handler",
    domainSlug: "tasks",
    targetSlug: "save-task",
    path,
    resolvedPath: path,
    ruleId: "vite.action_handler",
    collisionStatus: "unique",
    source: "scope_target",
    ...overrides,
  };
}

function baseSnapshot(): any {
  const sourcePath = "src/features/tasks/save-task.ts";
  return {
    schema: "setfarm.setup-topology-snapshot.v1",
    certificate: {
      source: source(".setfarm/setup/SETUP_CERTIFICATE.json", HASH_A),
      value: {
        schema: "setfarm.setup-certificate.v1",
        runId: "run-topology-1",
        projectName: "Task App",
        projectSlug: "task-app",
        platform: "web",
        techStack: "vite-react",
        stackPackId: "vite-react-web-app",
        commands: { build: "this legacy prose is deliberately ignored" },
        entrypoints: ["src/main.tsx", "src/App.tsx"],
        setupOwnedFiles: ["package.json"],
        forbiddenDuringImplement: ["package.json"],
        sharedFiles: ["src/App.tsx"],
        scaffoldSnapshot: ["package.json", "src/main.tsx"],
        generatedDesignFiles: [],
        designAuthority: {
          required: true,
          source: "stitch",
          screenMap: "stitch/SCREEN_MAP.json",
          rules: ["Use exact generated bindings."],
          conversionPolicy: "wrap_jsx",
          conversionNote: "Use generated JSX.",
        },
        fileTreeManifestPath: ".setfarm/setup/FILE_TREE_MANIFEST.json",
        sharedGrantsPath: ".setfarm/setup/SHARED_GRANTS.json",
        targetResolutionRules: {},
        routerParadigm: "single_entry",
        slugRules: {},
        slugRuleTests: [],
        sharedEditValidationPolicy: "ast_required",
        patchWindowMarkers: [],
        utilityFilePolicy: {},
        buildStrippingPolicy: {},
        sandboxPrewarm: {},
        prewarmEvidencePath: ".setfarm/setup/PREWARM_EVIDENCE.json",
        mockInjectionContract: {},
        designImportValidate: {},
        designVisualSmoke: {},
        dependencyEvidence: dependencyEvidence(),
        dependencyResolutionPolicy: {},
        buildEvidence: { buildCommand: "npm run build", artifactPath: "dist/index.html", stdoutPath: "", stderrPath: "" },
        createdAt: "2026-07-13T00:00:00.000Z",
      },
    },
    manifest: {
      source: source(".setfarm/setup/FILE_TREE_MANIFEST.json", HASH_B),
      value: {
        schema: "setfarm.file-tree-manifest.v1",
        runId: "run-topology-1",
        stackPackId: "vite-react-web-app",
        resolvedTargets: [target("US-001", sourcePath)],
        dependencyPlan: dependencyEvidence(),
        mockInjectionPoints: [],
        routeRegistrationPlan: [],
      },
    },
    sharedGrants: {
      source: source(".setfarm/setup/SHARED_GRANTS.json", HASH_C),
      value: {
        schema: "setfarm.shared-grants.v1",
        version: 1,
        runId: "run-topology-1",
        grants: [],
      },
    },
    repo: {
      id: "task-app",
      baseSha: "1".repeat(40),
      treeHash: "2".repeat(40),
    },
    owners: [
      { id: "OWNER_SETUP", kind: "setup" },
      { id: "OWNER_US_001", kind: "story", storyRef: "US-001" },
    ],
    pathBindings: [
      {
        id: "PATH_MAIN",
        path: "src/main.tsx",
        role: "entrypoint",
        ownerRef: "OWNER_SETUP",
        presence: "present",
        knownContentHash: HASH_A,
      },
      {
        id: "PATH_SAVE_TASK",
        path: sourcePath,
        role: "source",
        ownerRef: "OWNER_US_001",
        presence: "absent",
        knownContentHash: topologyPathAbsenceHash(sourcePath),
      },
    ],
    entrypoints: [
      {
        id: "ENTRY_WEB",
        kind: "web",
        pathRef: "PATH_MAIN",
        mountPoint: "/",
        routeRefs: ["ROUTE_HOME"],
      },
    ],
  };
}

describe("exact setup-to-BuildTopology adapter", () => {
  it("locks the canonical path-specific absence hash domain", () => {
    assert.equal(
      topologyPathAbsenceHash("src/features/tasks/save-task.ts"),
      "2cbf2873d07b7e23770dc8cf4a1218effd4e0a335ee958251fc163d827fe06d9",
    );
    assert.notEqual(topologyPathAbsenceHash("src/a.ts"), topologyPathAbsenceHash("src/b.ts"));
  });

  it("produces a versioned topology without parsing legacy command prose", () => {
    const result = adaptExactSetupTopologyV1(baseSnapshot());
    assert.deepEqual(result.diagnostics, []);
    assert.ok(result.candidate);
    assert.equal(result.candidate?.stackPack.id, "vite-react-web-app");
    assert.equal(result.candidate?.stackPack.version, "1.5.0");
    assert.match(result.candidate?.stackPack.contentHash ?? "", /^[a-f0-9]{64}$/);
    assert.deepEqual(
      result.candidate?.commands.find((command) => command.kind === "build")?.argv,
      ["npm", "run", "build"],
    );
    assert.equal(result.candidate?.commands.some((command) => command.argv.includes("this legacy prose is deliberately ignored")), false);
    assert.equal(result.candidate?.pathBindings.find((binding) => binding.id === "PATH_SAVE_TASK")?.presence, "absent");
    assert.equal(result.provenance.length, 3);
  });

  it("maps only an exact granted shared edit across explicit owners", () => {
    const snapshot = baseSnapshot();
    snapshot.owners.push({ id: "OWNER_US_002", kind: "story", storyRef: "US-002" });
    snapshot.pathBindings.push({
      id: "PATH_SECOND",
      path: "src/features/tasks/second.ts",
      role: "source",
      ownerRef: "OWNER_US_002",
      presence: "present",
      knownContentHash: HASH_B,
    });
    snapshot.pathBindings.push({
      id: "PATH_APP",
      path: "src/App.tsx",
      role: "source",
      ownerRef: "OWNER_US_001",
      presence: "present",
      knownContentHash: HASH_C,
    });
    snapshot.manifest.value.resolvedTargets.push(
      target("US-001", "src/App.tsx", { role: "app_shell", targetSlug: "app", ruleId: "vite.app_shell" }),
      target("US-002", "src/features/tasks/second.ts", { targetSlug: "second" }),
      target("US-002", "src/App.tsx", {
        role: "route_registration",
        targetSlug: "app-route",
        ruleId: "vite.route_registration",
        source: "shared_edit_request",
        sharedEdit: true,
        editScope: "route_registration_only",
        collisionStatus: "pending_shared_grant",
        sharedGrantRequestId: "GRANT_US_002_ROUTE",
      }),
    );
    snapshot.manifest.value.routeRegistrationPlan.push(snapshot.manifest.value.resolvedTargets.at(-1));
    snapshot.sharedGrants.value.grants.push({
      grantId: "GRANT_US_002_ROUTE",
      runId: "run-topology-1",
      storyId: "US-002",
      path: "src/App.tsx",
      role: "route_registration",
      editScope: "route_registration_only",
      status: "granted",
      reason: "validated shared edit",
      source: "shared_edit_request",
    });

    const result = adaptExactSetupTopologyV1(snapshot);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.candidate?.sharedGrants, [{
      id: "GRANT_US_002_ROUTE",
      fromOwnerRef: "OWNER_US_001",
      toOwnerRef: "OWNER_US_002",
      pathRefs: ["PATH_APP"],
      permissions: ["read", "write"],
    }]);
  });

  it("rejects absent paths without the canonical path-specific sentinel", () => {
    const snapshot = baseSnapshot();
    snapshot.pathBindings[1].knownContentHash = HASH_A;
    const result = adaptExactSetupTopologyV1(snapshot);
    assert.equal(result.candidate, undefined);
    assert.equal(result.diagnostics.some((item) => item.code === "ADAPTER_SETUP_SNAPSHOT_INPUT_INVALID"), true);
  });

  it("rejects unknown packs, ungranted ownership, and contradictory run IDs", () => {
    const snapshot = baseSnapshot();
    snapshot.certificate.value.stackPackId = "unknown-stack";
    snapshot.manifest.value.stackPackId = "unknown-stack";
    snapshot.manifest.value.runId = "different-run";
    snapshot.pathBindings[1].ownerRef = "OWNER_SETUP";
    const result = adaptExactSetupTopologyV1(snapshot);
    assert.equal(result.candidate, undefined);
    const codes = new Set(result.diagnostics.map((item) => item.code));
    assert.equal(codes.has("ADAPTER_SETUP_STACK_PACK_UNKNOWN"), true);
    assert.equal(codes.has("ADAPTER_SETUP_RUN_ID_MISMATCH"), true);
    assert.equal(codes.has("ADAPTER_SETUP_TARGET_OWNER_UNGRANTED"), true);
  });

  it("rejects absent or catalog-unauthorized entrypoint selections", () => {
    const absent = baseSnapshot();
    absent.pathBindings[0].presence = "absent";
    absent.pathBindings[0].knownContentHash = topologyPathAbsenceHash("src/main.tsx");
    const absentResult = adaptExactSetupTopologyV1(absent);
    assert.equal(absentResult.diagnostics.some((item) => item.code === "ADAPTER_SETUP_ENTRYPOINT_ABSENT"), true);

    const unauthorized = baseSnapshot();
    unauthorized.pathBindings[0].path = "src/bootstrap.ts";
    unauthorized.certificate.value.scaffoldSnapshot.push("src/bootstrap.ts");
    const unauthorizedResult = adaptExactSetupTopologyV1(unauthorized);
    assert.equal(
      unauthorizedResult.diagnostics.some((item) => item.code === "ADAPTER_SETUP_ENTRYPOINT_UNAUTHORIZED"),
      true,
    );
  });

  it("rejects unknown snapshot fields instead of silently accepting a new contract", () => {
    const snapshot = baseSnapshot();
    snapshot.inferredCommands = ["npm run build"];
    const result = adaptExactSetupTopologyV1(snapshot);
    assert.equal(result.candidate, undefined);
    assert.equal(result.diagnostics.some((item) => item.code === "ADAPTER_SETUP_SNAPSHOT_INPUT_INVALID"), true);
  });

  it("rejects an orphan grant that has no exact manifest target", () => {
    const snapshot = baseSnapshot();
    snapshot.sharedGrants.value.grants.push({
      grantId: "GRANT_ORPHAN",
      runId: "run-topology-1",
      storyId: "US-001",
      path: "src/App.tsx",
      role: "route_registration",
      editScope: "route_registration_only",
      status: "granted",
      reason: "invalid orphan fixture",
      source: "shared_edit_request",
    });
    const result = adaptExactSetupTopologyV1(snapshot);
    assert.equal(result.candidate, undefined);
    assert.equal(result.diagnostics.some((item) => item.code === "ADAPTER_SETUP_GRANT_TARGET_MISSING"), true);
  });
});
