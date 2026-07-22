import { extractTaskRequirementLedgerV1 } from "../../../src/product-compiler/requirements/task-requirements-v1.js";
import { hashCanonicalJson } from
  "../../../src/product-compiler/canonical-json.js";
import { compileProductRuntimeBehaviorContractV1 } from
  "../../../src/product-compiler/product-runtime-behavior-contract-v1.js";
import type { ProductRuntimeBehaviorProposalV1 } from
  "../../../src/product-compiler/schemas/product-runtime-behavior-contract-v1.js";
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
  derivePersistenceRoundTripEvidenceIdV2,
  type ProductSpecV2,
} from "../../../src/product-compiler/schemas/product-spec-v2.js";

export const NODE_CLI_TASK = "Build a Node CLI with an add command that accepts a required task title, records it in runtime state, and prints the added task as JSON.";

export const NODE_EXPRESS_API_TASK = "Build a Node Express API whose POST /tasks/:project endpoint accepts a required JSON task title, records the task in runtime state, and returns the created task as JSON.";

function sourceAuthority(task: string) {
  const ledger = extractTaskRequirementLedgerV1(task);
  return {
    ledger,
    requirementRefs: ledger.requirements.map((requirement) => requirement.id),
  };
}

function requirementClassifications(task: string) {
  const { ledger } = sourceAuthority(task);
  return ledger.requirements.map((requirement) => ({
    id: requirement.id,
    classification: "functional" as const,
    expectedSemanticKinds: ["state", "route", "surface", "action", "evidence", "observable"] as const,
  }));
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stateRequirementRefs(
  productSpec: ProductSpecV2,
  stateRef: string,
): string[] {
  const binding = productSpec.traceability.bindings.find((candidate) =>
    candidate.semanticKind === "state" && candidate.semanticRef === stateRef);
  if (!binding) throw new Error(`Missing state traceability for ${stateRef}`);
  return [...binding.requirementRefs];
}

function nonEmptyStringAssertions(
  stateRef: string,
  itemPath: string,
) {
  const subject = {
    kind: "state_each" as const,
    stateRef,
    collectionPath: "",
    itemPath,
  };
  return [
    { subject, predicate: { operator: "type_is" as const, expected: "string" as const } },
    { subject, predicate: { operator: "min_length" as const, expected: 1 } },
  ];
}

export function nodeRuntimeBehaviorProposalV1(
  productSpec: ProductSpecV2,
): ProductRuntimeBehaviorProposalV1 {
  return {
    schema: "setfarm.product-runtime-behavior-proposal.v1",
    productSpecHash: hashCanonicalJson(productSpec),
    invariantBindings: productSpec.states.flatMap((state) =>
      state.invariants.map((_invariant, invariantOrdinal) => ({
        stateRef: state.id,
        invariantOrdinal,
        requirementRefs: stateRequirementRefs(productSpec, state.id),
        disposition: {
          kind: "runtime_assertions" as const,
          assertions: productSpec.delivery.platform === "cli"
            ? nonEmptyStringAssertions(state.id, "")
            : state.id === "STATE_NOTES"
              ? nonEmptyStringAssertions(state.id, "/title")
              : [
                  ...nonEmptyStringAssertions(state.id, "/project"),
                  ...nonEmptyStringAssertions(state.id, "/title"),
                ],
        },
      }))),
    entityFieldBindings: [],
  };
}

export function nodeRuntimeBehaviorAuthorityV1(productSpec: ProductSpecV2) {
  const runtimeBehaviorProposal = nodeRuntimeBehaviorProposalV1(productSpec);
  const compiled = compileProductRuntimeBehaviorContractV1({
    productSpec,
    proposal: runtimeBehaviorProposal,
  });
  if (compiled.status !== "shadow_compiled") {
    throw new Error(JSON.stringify(compiled.diagnostics));
  }
  return {
    runtimeBehaviorProposal,
    runtimeBehaviorContract: compiled.contract,
  };
}

export function nodeCliPlanProposalV2(): any {
  const { ledger, requirementRefs } = sourceAuthority(NODE_CLI_TASK);
  return {
    schema: "setfarm.plan-semantic-proposal.v2",
    sourceTaskHash: ledger.sourceHash,
    product: {
      key: "task_cli",
      name: "Task CLI",
      class: "developer_tool",
      uiLanguage: "English",
      database: "none",
      uiVisionSummary: "A no-design command-line product with one exact add subcommand, one required title flag, deterministic JSON output, and an explicit runtime-state result contract.",
      goals: [{
        key: "add_task",
        statement: "Add one typed task through the public CLI interface.",
        requirementRefs,
      }],
      nonGoals: [],
    },
    requirements: requirementClassifications(NODE_CLI_TASK),
    entities: [],
    states: [{
      key: "tasks",
      name: "Tasks",
      kind: "application",
      initialValue: [],
      invariants: ["Every recorded task title is a non-empty string."],
      requirementRefs,
    }],
    persistencePolicies: [],
    routes: [{
      key: "cli",
      path: "/cli",
      entry: true,
      requirementRefs,
    }],
    surfaces: [{
      key: "terminal",
      name: "CLI Terminal",
      kind: "terminal",
      routeKey: "cli",
      required: true,
      composition: { kind: "route_root" },
      requirementRefs,
    }],
    actions: [{
      key: "add_task",
      name: "Add Task",
      controlPlacements: [],
      affectedSurfaceKeys: ["terminal"],
      trigger: { kind: "user" },
      invocationInterface: {
        schema: "setfarm.action-invocation-interface-intent.v1",
        kind: "cli_command",
        subcommandTokens: ["add"],
        fieldBindings: [{
          fieldName: "title",
          optionalPresence: "not_applicable",
          channel: { kind: "argv_flag", flag: "--title", style: "separate" },
        }],
        result: {
          kind: "stdout_json",
          successExitCodes: [0],
          valuePointer: "/task",
          failureCases: [
            {
              kind: "input_validation",
              exitCodes: [2],
              channel: "stderr_json",
              errorCode: "INPUT_VALIDATION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
            {
              kind: "action_failure",
              exitCodes: [1],
              channel: "stderr_json",
              errorCode: "ACTION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
          ],
        },
      },
      inputs: [{ name: "title", valueType: "string", required: true }],
      preconditions: [],
      evidenceScenario: {
        targetInputValues: { title: "Ship Setfarm" },
        prerequisiteSteps: [],
      },
      stateDeltas: [{
        key: "append_task",
        stateKey: "tasks",
        operation: "append",
        path: "",
        valueFrom: { kind: "input", field: "title" },
      }],
      navigation: { kind: "stay" },
      persistenceIntents: [],
      observables: [{
        key: "task_added",
        selector: {
          kind: "invocation_output",
          coordinate: "result_value",
          pointer: "/title",
          valueContract: {
            valueType: "string",
            expectedFrom: { kind: "input", fieldName: "title" },
          },
        },
        assertions: [{
          phase: "after",
          property: "value",
          operator: "equals",
          expected: "Ship Setfarm",
        }],
        requirementRefs,
      }],
      requirementRefs,
    }],
    assumptions: [],
  };
}

export function nodeExpressApiPlanProposalV2(): any {
  const { ledger, requirementRefs } = sourceAuthority(NODE_EXPRESS_API_TASK);
  return {
    schema: "setfarm.plan-semantic-proposal.v2",
    sourceTaskHash: ledger.sourceHash,
    product: {
      key: "task_api",
      name: "Task API",
      class: "service",
      uiLanguage: "English",
      database: "none",
      uiVisionSummary: "A no-design HTTP service with one exact task-creation endpoint, typed path and JSON-body inputs, deterministic JSON responses, and explicit runtime state.",
      goals: [{
        key: "create_task",
        statement: "Create one typed task through the public HTTP interface.",
        requirementRefs,
      }],
      nonGoals: [],
    },
    requirements: requirementClassifications(NODE_EXPRESS_API_TASK),
    entities: [],
    states: [{
      key: "tasks",
      name: "Tasks",
      kind: "application",
      initialValue: [],
      invariants: ["Every task has a non-empty project and title."],
      requirementRefs,
    }],
    persistencePolicies: [],
    routes: [{
      key: "tasks",
      path: "/tasks/:project",
      entry: true,
      requirementRefs,
    }],
    surfaces: [{
      key: "task_api",
      name: "Task API",
      kind: "api",
      routeKey: "tasks",
      required: true,
      composition: { kind: "route_root" },
      requirementRefs,
    }],
    actions: [{
      key: "create_task",
      name: "Create Task",
      controlPlacements: [],
      affectedSurfaceKeys: ["task_api"],
      trigger: { kind: "user" },
      invocationInterface: {
        schema: "setfarm.action-invocation-interface-intent.v1",
        kind: "http_request",
        method: "POST",
        routeKey: "tasks",
        fieldBindings: [
          {
            fieldName: "project",
            optionalPresence: "not_applicable",
            channel: { kind: "path_parameter", name: "project" },
          },
          {
            fieldName: "title",
            optionalPresence: "not_applicable",
            channel: {
              kind: "json_body_pointer",
              pointer: "/title",
              containerPolicy: "object_intermediates",
            },
          },
        ],
        result: {
          kind: "response_json",
          successStatusCodes: [201],
          valuePointer: "/task",
          failureCases: [
            {
              kind: "input_validation",
              statusCodes: [400],
              channel: "response_json",
              errorCode: "INPUT_VALIDATION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
            {
              kind: "action_failure",
              statusCodes: [500],
              channel: "response_json",
              errorCode: "ACTION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
          ],
        },
      },
      inputs: [
        { name: "project", valueType: "string", required: true },
        { name: "title", valueType: "string", required: true },
      ],
      preconditions: [],
      evidenceScenario: {
        targetInputValues: { project: "setfarm", title: "Bind contracts" },
        prerequisiteSteps: [],
      },
      stateDeltas: [{
        key: "append_task",
        stateKey: "tasks",
        operation: "append",
        path: "",
        valueFrom: { kind: "inputs", fields: ["project", "title"] },
      }],
      navigation: { kind: "stay" },
      persistenceIntents: [],
      observables: [{
        key: "task_created",
        selector: {
          kind: "invocation_output",
          coordinate: "result_value",
          pointer: "/title",
          valueContract: {
            valueType: "string",
            expectedFrom: { kind: "input", fieldName: "title" },
          },
        },
        assertions: [{
          phase: "after",
          property: "value",
          operator: "equals",
          expected: "Bind contracts",
        }],
        requirementRefs,
      }],
      requirementRefs,
    }],
    assumptions: [],
  };
}

function traceabilityBindings(
  requirementRefs: readonly string[],
  semantics: ReadonlyArray<readonly [string, string]>,
) {
  return semantics.map(([semanticKind, semanticRef]) => ({
    semanticKind,
    semanticRef,
    requirementRefs: [...requirementRefs],
  }));
}

export function genuineNodeCliProductSpecV2(): ProductSpecV2 {
  const { ledger, requirementRefs } = sourceAuthority(NODE_CLI_TASK);
  const invocationEvidenceRef = deriveActionInvocationEvidenceIdV2("ACT_ADD_TASK");
  const value: any = {
    schema: "setfarm.product-spec.v2",
    product: {
      id: "PROD_TASK_CLI",
      name: "Task CLI",
      class: "developer_tool",
      goals: [{ id: "GOAL_ADD_TASK", statement: "Add one typed task through the public CLI interface." }],
      nonGoals: [],
    },
    entities: [],
    states: [{
      id: "STATE_TASKS",
      name: "Tasks",
      kind: "application",
      initialValue: [],
      invariants: ["Every recorded task title is a non-empty string."],
    }],
    persistencePolicies: [],
    routes: [{
      id: "ROUTE_CLI",
      path: "/cli",
      rootSurfaceRef: "SURF_TERMINAL",
      surfaceRefs: ["SURF_TERMINAL"],
      entry: true,
    }],
    surfaces: [{
      id: "SURF_TERMINAL",
      name: "CLI Terminal",
      kind: "terminal",
      routeRef: "ROUTE_CLI",
      required: true,
      composition: { kind: "route_root" },
    }],
    actions: [{
      id: "ACT_ADD_TASK",
      name: "Add Task",
      controlPlacements: [],
      affectedSurfaceRefs: ["SURF_TERMINAL"],
      trigger: { kind: "user" },
      invocationInterface: {
        schema: "setfarm.action-invocation-interface-intent.v1",
        kind: "cli_command",
        subcommandTokens: ["add"],
        fieldBindings: [{
          fieldName: "title",
          optionalPresence: "not_applicable",
          channel: { kind: "argv_flag", flag: "--title", style: "separate" },
        }],
        result: {
          kind: "stdout_json",
          successExitCodes: [0],
          valuePointer: "/task",
          failureCases: [
            {
              kind: "input_validation",
              exitCodes: [2],
              channel: "stderr_json",
              errorCode: "INPUT_VALIDATION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
            {
              kind: "action_failure",
              exitCodes: [1],
              channel: "stderr_json",
              errorCode: "ACTION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
          ],
        },
      },
      input: { fields: [{ name: "title", valueType: "string", required: true }] },
      preconditions: [],
      evidenceScenario: { targetInputValues: { title: "Ship Setfarm" }, prerequisiteSteps: [] },
      stateDeltas: [{
        stateRef: "STATE_TASKS",
        operation: "append",
        path: "",
        valueFrom: { kind: "input", field: "title" },
      }],
      navigation: { kind: "stay" },
      persistenceEffects: [],
      success: {
        stateRefs: ["STATE_TASKS"],
        persistenceRefs: [],
        evidenceRefs: ["EVID_TASK_ADDED", invocationEvidenceRef],
        userVisible: true,
      },
      failure: { stateRefs: [], persistenceRefs: [], evidenceRefs: [], userVisible: true },
      evidenceRefs: ["EVID_TASK_ADDED", invocationEvidenceRef],
      observableEffects: [{
        id: "OBS_TASK_ADDED",
        selector: {
          kind: "invocation_output",
          coordinate: "result_value",
          pointer: "/title",
          valueContract: { valueType: "string", expectedFrom: { kind: "input", fieldName: "title" } },
        },
        assertions: [{ phase: "after", property: "value", operator: "equals", expected: "Ship Setfarm" }],
        evidenceRef: "EVID_TASK_ADDED",
      }],
    }],
    evidencePredicates: [
      {
        id: "EVID_TASK_ADDED",
        kind: "observable_outcome",
        required: true,
        subjectRef: "OBS_TASK_ADDED",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
      {
        id: invocationEvidenceRef,
        kind: "action_invocation",
        required: true,
        subjectRef: "ACT_ADD_TASK",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
    ],
    assumptions: [],
    delivery: {
      platform: "cli",
      techStack: "node-cli",
      uiLanguage: "English",
      database: "none",
      designRequired: false,
      uiVisionSummary: "A no-design command-line product with one exact add subcommand, one required title flag, deterministic JSON output, and no rendered browser surface.",
    },
    requirements: ledger.requirements.map((requirement) => ({
      ...requirement,
      classification: "functional",
      expectedSemanticKinds: ["state", "route", "surface", "action", "evidence", "observable"],
    })),
    traceability: {
      schema: "setfarm.product-requirement-traceability.v2",
      sourceTaskHash: ledger.sourceHash,
      bindings: traceabilityBindings(requirementRefs, [
        ["goal", "GOAL_ADD_TASK"],
        ["state", "STATE_TASKS"],
        ["route", "ROUTE_CLI"],
        ["surface", "SURF_TERMINAL"],
        ["action", "ACT_ADD_TASK"],
        ["evidence", "EVID_TASK_ADDED"],
        ["evidence", invocationEvidenceRef],
        ["observable", "OBS_TASK_ADDED"],
      ]),
    },
  };
  return ProductSpecV2Schema.parse(value);
}

export function genuineNodeExpressApiProductSpecV2(): ProductSpecV2 {
  const { ledger, requirementRefs } = sourceAuthority(NODE_EXPRESS_API_TASK);
  const invocationEvidenceRef = deriveActionInvocationEvidenceIdV2("ACT_CREATE_TASK");
  const value: any = {
    schema: "setfarm.product-spec.v2",
    product: {
      id: "PROD_TASK_API",
      name: "Task API",
      class: "service",
      goals: [{ id: "GOAL_CREATE_TASK", statement: "Create one typed task through the public HTTP interface." }],
      nonGoals: [],
    },
    entities: [],
    states: [{
      id: "STATE_TASKS",
      name: "Tasks",
      kind: "application",
      initialValue: [],
      invariants: ["Every task has a non-empty project and title."],
    }],
    persistencePolicies: [],
    routes: [{
      id: "ROUTE_TASKS",
      path: "/tasks/:project",
      rootSurfaceRef: "SURF_TASK_API",
      surfaceRefs: ["SURF_TASK_API"],
      entry: true,
    }],
    surfaces: [{
      id: "SURF_TASK_API",
      name: "Task API",
      kind: "api",
      routeRef: "ROUTE_TASKS",
      required: true,
      composition: { kind: "route_root" },
    }],
    actions: [{
      id: "ACT_CREATE_TASK",
      name: "Create Task",
      controlPlacements: [],
      affectedSurfaceRefs: ["SURF_TASK_API"],
      trigger: { kind: "user" },
      invocationInterface: {
        schema: "setfarm.action-invocation-interface-intent.v1",
        kind: "http_request",
        method: "POST",
        routeRef: "ROUTE_TASKS",
        fieldBindings: [
          {
            fieldName: "project",
            optionalPresence: "not_applicable",
            channel: { kind: "path_parameter", name: "project" },
          },
          {
            fieldName: "title",
            optionalPresence: "not_applicable",
            channel: {
              kind: "json_body_pointer",
              pointer: "/title",
              containerPolicy: "object_intermediates",
            },
          },
        ],
        result: {
          kind: "response_json",
          successStatusCodes: [201],
          valuePointer: "/task",
          failureCases: [
            {
              kind: "input_validation",
              statusCodes: [400],
              channel: "response_json",
              errorCode: "INPUT_VALIDATION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
            {
              kind: "action_failure",
              statusCodes: [500],
              channel: "response_json",
              errorCode: "ACTION_FAILED",
              codePointer: "/error/code",
              messagePointer: "/error/message",
            },
          ],
        },
      },
      input: { fields: [
        { name: "project", valueType: "string", required: true },
        { name: "title", valueType: "string", required: true },
      ] },
      preconditions: [],
      evidenceScenario: {
        targetInputValues: { project: "setfarm", title: "Bind contracts" },
        prerequisiteSteps: [],
      },
      stateDeltas: [{
        stateRef: "STATE_TASKS",
        operation: "append",
        path: "",
        valueFrom: { kind: "inputs", fields: ["project", "title"] },
      }],
      navigation: { kind: "stay" },
      persistenceEffects: [],
      success: {
        stateRefs: ["STATE_TASKS"],
        persistenceRefs: [],
        evidenceRefs: ["EVID_TASK_CREATED", invocationEvidenceRef],
        userVisible: true,
      },
      failure: { stateRefs: [], persistenceRefs: [], evidenceRefs: [], userVisible: true },
      evidenceRefs: ["EVID_TASK_CREATED", invocationEvidenceRef],
      observableEffects: [{
        id: "OBS_TASK_CREATED",
        selector: {
          kind: "invocation_output",
          coordinate: "result_value",
          pointer: "/title",
          valueContract: { valueType: "string", expectedFrom: { kind: "input", fieldName: "title" } },
        },
        assertions: [{ phase: "after", property: "value", operator: "equals", expected: "Bind contracts" }],
        evidenceRef: "EVID_TASK_CREATED",
      }],
    }],
    evidencePredicates: [
      {
        id: "EVID_TASK_CREATED",
        kind: "observable_outcome",
        required: true,
        subjectRef: "OBS_TASK_CREATED",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
      {
        id: invocationEvidenceRef,
        kind: "action_invocation",
        required: true,
        subjectRef: "ACT_CREATE_TASK",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
    ],
    assumptions: [],
    delivery: {
      platform: "api",
      techStack: "node-express",
      uiLanguage: "English",
      database: "none",
      designRequired: false,
      uiVisionSummary: "A no-design HTTP service with one exact task-creation endpoint, typed path and JSON-body inputs, deterministic JSON responses, and no rendered browser surface.",
    },
    requirements: ledger.requirements.map((requirement) => ({
      ...requirement,
      classification: "functional",
      expectedSemanticKinds: ["state", "route", "surface", "action", "evidence", "observable"],
    })),
    traceability: {
      schema: "setfarm.product-requirement-traceability.v2",
      sourceTaskHash: ledger.sourceHash,
      bindings: traceabilityBindings(requirementRefs, [
        ["goal", "GOAL_CREATE_TASK"],
        ["state", "STATE_TASKS"],
        ["route", "ROUTE_TASKS"],
        ["surface", "SURF_TASK_API"],
        ["action", "ACT_CREATE_TASK"],
        ["evidence", "EVID_TASK_CREATED"],
        ["evidence", invocationEvidenceRef],
        ["observable", "OBS_TASK_CREATED"],
      ]),
    },
  };
  return ProductSpecV2Schema.parse(value);
}

export function entityFieldNodeExpressApiProductSpecV2(): ProductSpecV2 {
  const value: any = structuredClone(genuineNodeExpressApiProductSpecV2());
  value.entities = [{
    id: "ENTITY_TASK_CATALOG_ENTRY",
    name: "Task catalog entry",
    fields: [
      {
        id: "FIELD_TASK_CATALOG_PROJECT",
        name: "project",
        valueType: "string",
        required: true,
      },
      {
        id: "FIELD_TASK_CATALOG_TASK",
        name: "task",
        valueType: "object",
        required: true,
      },
    ],
  }];
  value.states.push({
    id: "STATE_TASK_CATALOG",
    name: "Task catalog",
    kind: "domain",
    initialValue: [{
      project: "setfarm",
      task: { project: "setfarm", title: "Stored title" },
    }],
    invariants: [],
  });
  value.actions[0].stateDeltas[0].valueFrom = {
    kind: "entity_field",
    entityRef: "ENTITY_TASK_CATALOG_ENTRY",
    fieldRef: "FIELD_TASK_CATALOG_TASK",
  };
  const requirementRefs = stateRequirementRefs(value, "STATE_TASKS");
  value.traceability.bindings.push(
    {
      semanticKind: "entity",
      semanticRef: "ENTITY_TASK_CATALOG_ENTRY",
      requirementRefs,
    },
    {
      semanticKind: "state",
      semanticRef: "STATE_TASK_CATALOG",
      requirementRefs,
    },
  );
  return ProductSpecV2Schema.parse(value);
}

export function entityFieldNodeRuntimeBehaviorAuthorityV1(
  productSpec: ProductSpecV2,
) {
  const base = nodeRuntimeBehaviorProposalV1(productSpec);
  const runtimeBehaviorProposal: ProductRuntimeBehaviorProposalV1 = {
    ...base,
    entityFieldBindings: [{
      actionRef: "ACT_CREATE_TASK",
      deltaOrdinal: 0,
      snapshot: {
        stateRef: "STATE_TASK_CATALOG",
        collectionPath: "",
        selection: {
          kind: "match_input",
          matchFieldRef: "FIELD_TASK_CATALOG_PROJECT",
          inputField: "project",
        },
      },
    }],
  };
  const compiled = compileProductRuntimeBehaviorContractV1({
    productSpec,
    proposal: runtimeBehaviorProposal,
  });
  if (compiled.status !== "shadow_compiled") {
    throw new Error(JSON.stringify(compiled.diagnostics));
  }
  return {
    runtimeBehaviorProposal,
    runtimeBehaviorContract: compiled.contract,
  };
}

/**
 * Genuine two-story API authority used by every-only and ownership regressions.
 * Options deliberately exercise mixed persistence and cross-story evidence
 * without weakening the base ProductSpecV2 contract.
 */
export function twoStoryNodeExpressApiProductSpecV2(options: Readonly<{
  memoryOnOriginalStory?: boolean;
  crossStoryOptionalEvidence?: boolean;
}> = {}): ProductSpecV2 {
  const value: any = structuredClone(genuineNodeExpressApiProductSpecV2());
  const requirementRefs = [...value.traceability.bindings[0].requirementRefs];
  const noteAction = structuredClone(value.actions[0]);
  noteAction.id = "ACT_CREATE_NOTE";
  noteAction.name = "Create Note";
  noteAction.affectedSurfaceRefs = ["SURF_NOTE_API"];
  noteAction.invocationInterface.routeRef = "ROUTE_NOTES";
  noteAction.stateDeltas[0].stateRef = "STATE_NOTES";
  noteAction.observableEffects[0].id = "OBS_NOTE_CREATED";
  noteAction.observableEffects[0].evidenceRef = "EVID_NOTE_CREATED";
  const noteInvocationEvidence = deriveActionInvocationEvidenceIdV2(noteAction.id);
  noteAction.evidenceRefs = ["EVID_NOTE_CREATED", noteInvocationEvidence]
    .sort(compareUtf16);
  noteAction.success.stateRefs = ["STATE_NOTES"];
  noteAction.success.evidenceRefs = ["EVID_NOTE_CREATED", noteInvocationEvidence]
    .sort(compareUtf16);

  value.states.push({
    id: "STATE_NOTES",
    name: "Notes",
    kind: "application",
    initialValue: [],
    invariants: ["Every note has text."],
  });
  value.routes.push({
    id: "ROUTE_NOTES",
    path: "/notes/:project",
    rootSurfaceRef: "SURF_NOTE_API",
    surfaceRefs: ["SURF_NOTE_API"],
    entry: false,
  });
  value.surfaces.push({
    id: "SURF_NOTE_API",
    name: "Note API",
    kind: "api",
    routeRef: "ROUTE_NOTES",
    required: true,
    composition: { kind: "route_root" },
  });
  value.actions.push(noteAction);
  value.evidencePredicates.push(
    {
      id: "EVID_NOTE_CREATED",
      kind: "observable_outcome",
      required: true,
      subjectRef: "OBS_NOTE_CREATED",
      capabilityRefs: [],
      assertion: { operator: "passes" },
    },
    {
      id: noteInvocationEvidence,
      kind: "action_invocation",
      required: true,
      subjectRef: noteAction.id,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    },
  );

  const addedBindings: any[] = [
    ["state", "STATE_NOTES"],
    ["route", "ROUTE_NOTES"],
    ["surface", "SURF_NOTE_API"],
    ["action", noteAction.id],
    ["evidence", "EVID_NOTE_CREATED"],
    ["evidence", noteInvocationEvidence],
    ["observable", "OBS_NOTE_CREATED"],
  ].map(([semanticKind, semanticRef]) => ({
    semanticKind,
    semanticRef,
    requirementRefs,
  }));

  if (options.memoryOnOriginalStory) {
    const policyRef = "PERSIST_TASKS_MEMORY";
    const originalAction = value.actions.find(
      (action: any) => action.id === "ACT_CREATE_TASK",
    )!;
    const roundTripEvidence = derivePersistenceRoundTripEvidenceIdV2(
      originalAction.id,
      policyRef,
    );
    value.persistencePolicies.push({
      id: policyRef,
      kind: "memory",
      owner: "server",
      entityRefs: [],
      durability: "session",
      rehydration: { kind: "none" },
    });
    originalAction.persistenceEffects.push({
      policyRef,
      operation: "write",
      payloadFields: [],
      statePaths: [{ stateRef: "STATE_TASKS", path: "" }],
    });
    originalAction.success.persistenceRefs = [policyRef];
    originalAction.evidenceRefs.push(roundTripEvidence);
    originalAction.evidenceRefs.sort(compareUtf16);
    originalAction.success.evidenceRefs.push(roundTripEvidence);
    originalAction.success.evidenceRefs.sort(compareUtf16);
    value.evidencePredicates.push({
      id: roundTripEvidence,
      kind: "persistence_round_trip",
      required: true,
      subjectRef: policyRef,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    });
    addedBindings.push(
      { semanticKind: "persistence", semanticRef: policyRef, requirementRefs },
      { semanticKind: "evidence", semanticRef: roundTripEvidence, requirementRefs },
    );
  }

  if (options.crossStoryOptionalEvidence) {
    const optionalEvidenceRef = "EVID_OPTIONAL_CROSS";
    noteAction.evidenceRefs.push(optionalEvidenceRef);
    noteAction.evidenceRefs.sort(compareUtf16);
    value.evidencePredicates.push({
      id: optionalEvidenceRef,
      kind: "runtime",
      required: false,
      subjectRef: "OBS_TASK_CREATED",
      capabilityRefs: [],
      assertion: { operator: "passes" },
    });
    addedBindings.push({
      semanticKind: "evidence",
      semanticRef: optionalEvidenceRef,
      requirementRefs,
    });
  }

  value.traceability.bindings.push(...addedBindings);
  value.traceability.bindings.sort((left: any, right: any) =>
    compareUtf16(left.semanticKind, right.semanticKind)
    || compareUtf16(left.semanticRef, right.semanticRef));
  return ProductSpecV2Schema.parse(value);
}
