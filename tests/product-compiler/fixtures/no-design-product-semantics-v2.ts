import { extractTaskRequirementLedgerV1 } from "../../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
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
