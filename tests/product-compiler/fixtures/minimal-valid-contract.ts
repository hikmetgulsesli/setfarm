const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const GIT_SHA = "1".repeat(40);
const TREE_HASH = "2".repeat(40);

const provenance = {
  schema: "setfarm.provenance-ref.v1" as const,
  sourceHash: HASH_A,
  locator: "sources/product.md",
  confidence: "exact" as const,
};

export function buildMinimalValidContracts() {
  const productSpec = {
    schema: "setfarm.product-spec.v1" as const,
    product: {
      id: "PROD_TASK_EDITOR",
      name: "Task Editor",
      class: "utility" as const,
      goals: [{ id: "GOAL_SAVE_TASK", statement: "Persist an edited task." }],
      nonGoals: [{ id: "NONGOAL_COLLABORATION", statement: "No live collaboration." }],
    },
    entities: [
      {
        id: "ENTITY_TASK",
        name: "Task",
        fields: [
          {
            id: "FIELD_TASK_TITLE",
            name: "title",
            valueType: "string" as const,
            required: true,
          },
        ],
      },
    ],
    states: [
      {
        id: "STATE_EDITOR",
        name: "Editor state",
        kind: "domain" as const,
        initialValue: { title: "" },
        invariants: ["title is a string"],
      },
    ],
    persistencePolicies: [
      {
        id: "PERSIST_TASK_LOCAL",
        kind: "local_storage" as const,
        owner: "application" as const,
        entityRefs: ["ENTITY_TASK"],
        durability: "reload" as const,
        key: "task-editor-v1",
      },
    ],
    routes: [
      {
        id: "ROUTE_HOME",
        path: "/",
        surfaceRefs: ["SURF_EDITOR"],
        entry: true,
      },
    ],
    surfaces: [
      {
        id: "SURF_EDITOR",
        name: "Task editor",
        kind: "page" as const,
        routeRef: "ROUTE_HOME",
        required: true,
      },
    ],
    actions: [
      {
        id: "ACT_SAVE_TASK",
        name: "Save task",
        surfaceRefs: ["SURF_EDITOR"],
        trigger: { kind: "user" as const },
        input: {
          fields: [
            {
              name: "title",
              valueType: "string" as const,
              required: true,
              entityFieldRef: "FIELD_TASK_TITLE",
            },
          ],
        },
        preconditions: [],
        stateDeltas: [
          {
            stateRef: "STATE_EDITOR",
            operation: "set" as const,
            path: "/title",
            valueFrom: { kind: "input" as const, field: "title" },
          },
        ],
        navigation: { kind: "stay" as const },
        persistenceEffects: [
          {
            policyRef: "PERSIST_TASK_LOCAL",
            operation: "write" as const,
            entityRef: "ENTITY_TASK",
            payloadFields: ["title"],
          },
        ],
        success: {
          stateRefs: ["STATE_EDITOR"],
          persistenceRefs: ["PERSIST_TASK_LOCAL"],
          evidenceRefs: ["EVID_SAVE_RELOAD"],
        },
        failure: {
          stateRefs: ["STATE_EDITOR"],
          evidenceRefs: [],
          userVisible: true,
        },
        evidenceRefs: ["EVID_SAVE_RELOAD"],
      },
    ],
    evidencePredicates: [
      {
        id: "EVID_SAVE_RELOAD",
        kind: "persistence_round_trip" as const,
        required: true,
        subjectRef: "ACT_SAVE_TASK",
        capabilityRefs: ["CAP_BROWSER_INTERACTION", "CAP_LOCAL_PERSISTENCE"],
        assertion: {
          operator: "equals" as const,
          expected: { path: "/title", source: "action.input.title" },
        },
      },
    ],
    assumptions: [
      {
        id: "ASSUMPTION_SINGLE_USER",
        statement: "The task is edited by one local user.",
        provenance: [provenance],
      },
    ],
  };

  const designGraph = {
    schema: "setfarm.design-interaction-graph.v1" as const,
    rawArtifactHashes: [HASH_A],
    surfaces: [
      {
        id: "DSURF_EDITOR",
        surfaceRef: "SURF_EDITOR",
        sourceArtifactHash: HASH_A,
        sourceLocator: "sources/editor.html",
      },
    ],
    controls: [
      {
        id: "CTRL_SAVE_TASK",
        identity: { kind: "explicit" as const, provenance: [provenance] },
        generatedLocalId: "save-task-1",
        kind: "button" as const,
        label: "Save",
        accessibility: { role: "button", name: "Save task" },
        surfaceRef: "SURF_EDITOR",
        interactive: true,
        source: {
          artifactHash: HASH_A,
          locator: "sources/editor.html",
          selector: "[data-action-id=\"save-task-1\"]",
        },
      },
    ],
    bindings: [
      {
        controlRef: "CTRL_SAVE_TASK",
        disposition: "action" as const,
        actionRef: "ACT_SAVE_TASK",
        routeRef: "ROUTE_HOME",
        inputBindings: [
          {
            inputField: "title",
            valueFrom: {
              kind: "state" as const,
              stateRef: "STATE_EDITOR",
              path: "/title",
            },
          },
        ],
        stateRefs: ["STATE_EDITOR"],
        persistenceRefs: ["PERSIST_TASK_LOCAL"],
        evidenceRefs: ["EVID_SAVE_RELOAD"],
      },
    ],
    unresolvedBindings: [],
  };

  const buildTopology = {
    schema: "setfarm.build-topology.v1" as const,
    stackPack: {
      id: "vite-react-web-app",
      version: "1.0.0",
      contentHash: HASH_B,
    },
    repo: {
      id: "task-editor",
      baseSha: GIT_SHA,
      treeHash: TREE_HASH,
    },
    owners: [
      {
        id: "OWNER_US_001",
        kind: "story" as const,
        storyRef: "US-001",
      },
    ],
    pathBindings: [
      {
        id: "PATH_APP",
        path: "src/App.tsx",
        role: "source" as const,
        ownerRef: "OWNER_US_001",
      },
    ],
    sharedGrants: [],
    entrypoints: [
      {
        id: "ENTRY_WEB",
        kind: "web" as const,
        pathRef: "PATH_APP",
        mountPoint: "/",
        routeRefs: ["ROUTE_HOME"],
      },
    ],
    commands: [
      {
        id: "CMD_BUILD",
        kind: "build" as const,
        argv: ["npm", "run", "build"],
        cwd: ".",
        timeoutMs: 120_000,
        capabilityRefs: [],
      },
      {
        id: "CMD_TEST",
        kind: "test" as const,
        argv: ["npm", "test"],
        cwd: ".",
        timeoutMs: 120_000,
        capabilityRefs: [],
      },
    ],
    capabilities: [
      {
        id: "CAP_BROWSER_INTERACTION",
        kind: "browser_interaction" as const,
        enabled: true,
      },
      {
        id: "CAP_LOCAL_PERSISTENCE",
        kind: "local_persistence" as const,
        enabled: true,
      },
    ],
    policies: {
      packageManager: "npm" as const,
      allowedRoots: ["src"],
      deniedGlobs: [".env*"],
      buildOutputPaths: ["dist"],
    },
  };

  const storyPlan = {
    schema: "setfarm.story-plan.v1" as const,
    stories: [
      {
        id: "US-001",
        order: 1,
        title: "Implement task save",
        description: "Wire the editor save behavior and persistence.",
        ownerRef: "OWNER_US_001",
        dependsOn: [],
        surfaceRefs: ["SURF_EDITOR"],
        controlRefs: ["CTRL_SAVE_TASK"],
        actionRefs: ["ACT_SAVE_TASK"],
        stateRefs: ["STATE_EDITOR"],
        persistenceRefs: ["PERSIST_TASK_LOCAL"],
        evidenceRefs: ["EVID_SAVE_RELOAD"],
        ownedPathRefs: ["PATH_APP"],
        sharedGrantRefs: [],
      },
    ],
  };

  const packet = {
    schema: "setfarm.product-build-packet.v1" as const,
    packetVersion: 1 as const,
    parentPacketHashes: [],
    productSpecHash: HASH_A,
    designGraphHash: HASH_B,
    buildTopologyHash: HASH_C,
    storyPlanHash: "d".repeat(64),
    compiler: { codeSha: "5840ae3", version: "3.0.0-shadow.1" },
    validationIds: ["VALIDATE_REFERENCE_COMPLETENESS"],
  };

  const implementationSlice = {
    schema: "setfarm.implementation-slice.v1" as const,
    sliceVersion: 1 as const,
    packetHash: "e".repeat(64),
    storyId: "US-001",
    sourceRevision: { baseSha: GIT_SHA, treeHash: TREE_HASH },
    story: storyPlan.stories[0],
    files: [
      {
        pathRef: "PATH_APP",
        path: "src/App.tsx",
        role: "owned" as const,
        knownContentHash: HASH_A,
      },
    ],
    dependencySignatures: [],
    sharedGrants: [],
    contract: {
      routes: productSpec.routes,
      surfaces: productSpec.surfaces,
      controls: designGraph.controls,
      bindings: designGraph.bindings,
      actions: productSpec.actions,
      states: productSpec.states,
      persistencePolicies: productSpec.persistencePolicies,
      evidencePredicates: productSpec.evidencePredicates,
    },
    commands: buildTopology.commands,
    requiredEvidence: productSpec.evidencePredicates,
  };

  return {
    hashes: { HASH_A, HASH_B, HASH_C, GIT_SHA, TREE_HASH },
    productSpec,
    designGraph,
    buildTopology,
    storyPlan,
    packet,
    implementationSlice,
  };
}
