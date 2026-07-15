import { z } from "zod";

import { canonicalJsonStringify } from "../canonical-json.js";
import {
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  Sha256Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  BuildCommandV1Schema,
  SharedGrantV1Schema,
  topologyPathAbsenceHash,
} from "./build-topology-v1.js";
import {
  DesignControlBindingV1Schema,
  DesignControlV1Schema,
  DesignObservableBindingV1Schema,
} from "./design-interaction-graph-v1.js";
import {
  EvidencePredicateV1Schema,
  PersistencePolicyV1Schema,
  ProductActionV1Schema,
  ProductRouteV1Schema,
  ProductStateV1Schema,
  ProductSurfaceV1Schema,
} from "./product-spec-v1.js";
import { ProductStoryV1Schema } from "./story-plan-v1.js";
import { RuntimeEvidenceContractV1Schema } from "../../evidence/runtime-evidence-contract-v1.js";
import {
  RuntimeDataContractV1Schema,
  hashRuntimeDataContractV1,
} from "./runtime-data-contract-v1.js";

const SourceRevisionV1Schema = z
  .object({
    baseSha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  })
  .strict();

const RecoveryExpectedDeltaV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("source_change"),
    invariantRefs: z.array(z.string().regex(/^INV_[A-Z0-9]+(?:_[A-Z0-9]+)*$/)).min(1).max(1_000),
    requiredPaths: z.array(NormalizedRelativeLocatorSchema).min(1).max(10_000),
  }).strict(),
  z.object({
    kind: z.literal("evidence_refresh"),
    predicateRefs: z.array(z.string().regex(/^EVID_[A-Z0-9]+(?:_[A-Z0-9]+)*$/)).min(1).max(5_000),
  }).strict(),
  z.object({
    kind: z.literal("upstream_recompile"),
    artifactKinds: z.array(z.enum([
      "product_spec", "design_graph", "build_topology", "story_plan", "implementation_slice",
    ])).min(1).max(5),
  }).strict(),
  z.object({
    kind: z.literal("operator_action"),
    reasonCode: z.enum([
      "credential_required", "external_state_required", "policy_decision_required", "specification_decision_required",
    ]),
  }).strict(),
]);

export const ImplementationRecoveryDirectiveV1Schema = z.object({
  schema: z.literal("setfarm.implementation-recovery-directive.v1"),
  recoveryCaseRevisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/),
  recoveryDispatchId: z.string().regex(/^RDISP_[a-f0-9]{64}$/),
  dispatchClass: z.enum(["product_implementation", "supervisor_repair"]),
  findingSetHash: Sha256Schema,
  findingIds: z.array(z.string().regex(/^FIND_[a-f0-9]{64}$/)).min(1).max(5_000),
  contractSliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  expectedDelta: RecoveryExpectedDeltaV1Schema,
  allowedPaths: z.array(NormalizedRelativeLocatorSchema).max(20_000),
  evidencePlanArtifactHash: Sha256Schema.optional(),
}).strict().superRefine((value, context) => {
  for (const [name, values] of [
    ["findingIds", value.findingIds],
    ["allowedPaths", value.allowedPaths],
  ] as const) {
    if (!hasUniqueStrings(values) || values.some((item, index) => item !== [...values].sort()[index])) {
      context.addIssue({ code: "custom", path: [name], message: `${name} must be unique and canonically sorted` });
    }
  }
  if (value.expectedDelta.kind !== "source_change") {
    context.addIssue({
      code: "custom",
      path: ["expectedDelta", "kind"],
      message: "Model-backed implementation recovery may request only an exact source delta",
    });
  }
});

export type ImplementationRecoveryDirectiveV1 = z.infer<typeof ImplementationRecoveryDirectiveV1Schema>;

export const ImplementationFileV1Schema = z
  .object({
    pathRef: PathBindingIdSchema,
    path: NormalizedRelativeLocatorSchema,
    role: z.enum(["owned", "dependency", "shared_readonly", "shared_writable"]),
    presence: z.enum(["present", "absent"]),
    knownContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.presence === "absent" && value.knownContentHash !== topologyPathAbsenceHash(value.path)) {
      context.addIssue({
        code: "custom",
        path: ["knownContentHash"],
        message: "Absent slice files must use the canonical path-specific absence hash",
      });
    }
  });

export type ImplementationFileV1 = z.infer<typeof ImplementationFileV1Schema>;

const DependencySignatureV1Schema = z
  .object({
    storyId: StoryIdSchema,
    sliceHash: Sha256Schema,
    outputHash: Sha256Schema.optional(),
    sourceAfter: SourceRevisionV1Schema,
    fileSignatures: z.array(z.object({
      pathRef: PathBindingIdSchema,
      presence: z.enum(["present", "absent"]),
      contentHash: Sha256Schema,
    }).strict()).max(20_000),
  })
  .strict()
  .superRefine((value, context) => {
    const pathRefs = value.fileSignatures.map((item) => item.pathRef);
    if (!hasUniqueStrings(pathRefs)) {
      context.addIssue({ code: "custom", path: ["fileSignatures"], message: "Dependency file refs must be unique" });
    }
    const sorted = [...pathRefs].sort();
    if (pathRefs.some((pathRef, index) => pathRef !== sorted[index])) {
      context.addIssue({ code: "custom", path: ["fileSignatures"], message: "Dependency file refs must use canonical order" });
    }
  });

const SliceContractV1Schema = z
  .object({
    routes: z.array(ProductRouteV1Schema).max(1_000),
    surfaces: z.array(ProductSurfaceV1Schema).max(2_000),
    controls: z.array(DesignControlV1Schema).max(10_000),
    bindings: z.array(DesignControlBindingV1Schema).max(10_000),
    observableBindings: z.array(DesignObservableBindingV1Schema).max(10_000).optional(),
    actions: z.array(ProductActionV1Schema).min(1).max(5_000),
    states: z.array(ProductStateV1Schema).max(2_000),
    persistencePolicies: z.array(PersistencePolicyV1Schema).max(2_000),
    evidencePredicates: z.array(EvidencePredicateV1Schema).min(1).max(5_000),
  })
  .strict();

export const ImplementationSliceV1Schema = z
  .object({
    schema: z.literal("setfarm.implementation-slice.v1"),
    sliceVersion: z.literal(1),
    packetHash: Sha256Schema,
    storyId: StoryIdSchema,
    sourceRevision: SourceRevisionV1Schema,
    story: ProductStoryV1Schema,
    files: z.array(ImplementationFileV1Schema).min(1).max(20_000),
    dependencySignatures: z.array(DependencySignatureV1Schema).max(5_000),
    sharedGrants: z.array(SharedGrantV1Schema).max(10_000),
    contract: SliceContractV1Schema,
    commands: z.array(BuildCommandV1Schema).min(1).max(1_000),
    requiredEvidence: z.array(EvidencePredicateV1Schema).min(1).max(5_000),
    runtimeDataContract: RuntimeDataContractV1Schema.optional(),
    runtimeDataContractHash: Sha256Schema.optional(),
    runtimeEvidence: RuntimeEvidenceContractV1Schema.optional(),
    recovery: ImplementationRecoveryDirectiveV1Schema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.storyId !== value.story.id) {
      context.addIssue({
        code: "custom",
        path: ["storyId"],
        message: "Slice storyId must match the embedded story",
      });
    }
    if (!hasUniqueStrings(value.files.map((file) => file.pathRef))) {
      context.addIssue({ code: "custom", path: ["files"], message: "Slice file path refs must be unique" });
    }
    if (!hasUniqueStrings(value.files.map((file) => file.path))) {
      context.addIssue({ code: "custom", path: ["files"], message: "Slice file paths must be unique" });
    }
    if (!hasUniqueStrings(value.dependencySignatures.map((item) => item.storyId))) {
      context.addIssue({
        code: "custom",
        path: ["dependencySignatures"],
        message: "Dependency signatures must be unique by story",
      });
    }
    if (!hasUniqueStrings(value.commands.map((item) => item.id))) {
      context.addIssue({ code: "custom", path: ["commands"], message: "Slice command IDs must be unique" });
    }
    const runtimeDataPresence = [value.runtimeDataContract, value.runtimeDataContractHash]
      .filter((item) => item !== undefined).length;
    if (runtimeDataPresence === 1) {
      context.addIssue({
        code: "custom",
        path: ["runtimeDataContract"],
        message: "Slice runtime-data contract and hash must be present together or both absent",
      });
    }
    if (
      value.runtimeDataContract
      && value.runtimeDataContractHash
      && hashRuntimeDataContractV1(value.runtimeDataContract) !== value.runtimeDataContractHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["runtimeDataContractHash"],
        message: "Slice runtime-data hash must equal the exact embedded contract",
      });
    }

    const fileRefs = new Set(value.files.map((file) => file.pathRef));
    value.story.ownedPathRefs.forEach((pathRef, index) => {
      if (!fileRefs.has(pathRef)) {
        context.addIssue({
          code: "custom",
          path: ["story", "ownedPathRefs", index],
          message: `Story-owned path is absent from slice files: ${pathRef}`,
        });
      }
    });

    const requireRefs = (
      expected: readonly string[],
      actual: readonly string[],
      path: PropertyKey[],
      label: string,
    ) => {
      const available = new Set(actual);
      expected.forEach((reference, index) => {
        if (!available.has(reference)) {
          context.addIssue({
            code: "custom",
            path: [...path, index],
            message: `Slice is missing story ${label}: ${reference}`,
          });
        }
      });
    };

    requireRefs(value.story.surfaceRefs, value.contract.surfaces.map((item) => item.id), ["story", "surfaceRefs"], "surface ref");
    requireRefs(value.story.controlRefs, value.contract.controls.map((item) => item.id), ["story", "controlRefs"], "control ref");
    requireRefs(value.story.actionRefs, value.contract.actions.map((item) => item.id), ["story", "actionRefs"], "action ref");
    requireRefs(value.story.stateRefs, value.contract.states.map((item) => item.id), ["story", "stateRefs"], "state ref");
    requireRefs(
      value.story.persistenceRefs,
      value.contract.persistencePolicies.map((item) => item.id),
      ["story", "persistenceRefs"],
      "persistence ref",
    );
    requireRefs(
      value.story.evidenceRefs,
      value.contract.evidencePredicates.map((item) => item.id),
      ["story", "evidenceRefs"],
      "evidence ref",
    );

    const contractEvidenceIds = new Set(value.contract.evidencePredicates.map((item) => item.id));
    value.contract.actions.forEach((action, actionIndex) => {
      const semanticEvidenceRefs = [
        ...action.evidenceRefs,
        ...action.success.evidenceRefs,
        ...action.failure.evidenceRefs,
        ...(action.observableEffects ?? []).map((effect) => effect.evidenceRef),
      ];
      semanticEvidenceRefs.forEach((evidenceRef) => {
        if (!contractEvidenceIds.has(evidenceRef)) {
          context.addIssue({
            code: "custom",
            path: ["contract", "actions", actionIndex, "evidenceRefs"],
            message: `Slice action evidence is absent from its semantic predicate contract: ${evidenceRef}`,
          });
        }
      });
    });

    const requiredEvidenceIds = new Set(value.requiredEvidence.map((item) => item.id));
    if (requiredEvidenceIds.size !== value.requiredEvidence.length) {
      context.addIssue({
        code: "custom",
        path: ["requiredEvidence"],
        message: "Required evidence IDs must be unique",
      });
    }
    value.story.evidenceRefs.forEach((evidenceRef, index) => {
      if (!requiredEvidenceIds.has(evidenceRef)) {
        context.addIssue({
          code: "custom",
          path: ["story", "evidenceRefs", index],
          message: `Story evidence is absent from requiredEvidence: ${evidenceRef}`,
        });
      }
    });
    value.requiredEvidence.forEach((evidence, index) => {
      if (!evidence.required) {
        context.addIssue({
          code: "custom",
          path: ["requiredEvidence", index, "required"],
          message: "requiredEvidence entries must be required",
        });
      }
    });
    const sliceActionRefs = new Set(value.contract.actions.map((action) => action.id));
    if (value.contract.observableBindings !== undefined) {
      const observableBindings = value.contract.observableBindings;
      value.contract.actions.forEach((action, actionIndex) => {
        (action.observableEffects ?? []).forEach((effect, effectIndex) => {
          const matches = observableBindings.filter((binding) =>
            binding.observableRef === effect.id
            && binding.actionRef === action.id
            && binding.evidenceRef === effect.evidenceRef);
          if (matches.length !== 1) {
            context.addIssue({
              code: "custom",
              path: ["contract", "actions", actionIndex, "observableEffects", effectIndex],
              message: `Slice requires exactly one exact observable binding for ${effect.id}`,
            });
          }
        });
      });
    }
    value.contract.actions.forEach((action, actionIndex) => {
      action.evidenceScenario.prerequisiteSteps.forEach((step, stepIndex) => {
        if (!sliceActionRefs.has(step.actionRef)) {
          context.addIssue({
            code: "custom",
            path: ["contract", "actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "actionRef"],
            message: `Implementation slice is missing prerequisite action ${step.actionRef}`,
          });
        }
      });
    });
    value.contract.persistencePolicies.forEach((policy, policyIndex) => {
      if (policy.rehydration.kind === "action" && !sliceActionRefs.has(policy.rehydration.actionRef)) {
        context.addIssue({
          code: "custom",
          path: ["contract", "persistencePolicies", policyIndex, "rehydration", "actionRef"],
          message: `Implementation slice is missing rehydration action ${policy.rehydration.actionRef}`,
        });
      }
    });
    if (
      value.runtimeEvidence?.adapter === "cli-process"
      || value.runtimeEvidence?.adapter === "http-service"
    ) {
      const runtimeEvidence = value.runtimeEvidence;
      const actionById = new Map(value.contract.actions.map((action) => [action.id, action]));
      const requiredActionRefs = new Set(value.requiredEvidence.flatMap((predicate) => {
        const action = value.contract.actions.find((candidate) =>
          candidate.id === predicate.subjectRef || candidate.evidenceRefs.includes(predicate.id));
        return action ? [action.id] : [];
      }));
      const executableActionRefs = new Set([
        ...requiredActionRefs,
        ...value.contract.actions
          .filter((action) => requiredActionRefs.has(action.id))
          .flatMap((action) => action.evidenceScenario.prerequisiteSteps.map((step) => step.actionRef)),
      ]);
      const runtimeActionRefs = new Set(runtimeEvidence.actions.map((binding) => binding.actionRef));
      executableActionRefs.forEach((actionRef) => {
        if (!runtimeActionRefs.has(actionRef)) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "actions"],
            message: `Runtime evidence contract has no exact invocation for ${actionRef}`,
          });
        }
      });
      value.contract.actions
        .filter((action) => requiredActionRefs.has(action.id))
        .forEach((action) => {
          action.evidenceScenario.prerequisiteSteps.forEach((step) => {
            const binding = runtimeEvidence.actions.find((candidate) => candidate.actionRef === step.actionRef);
            if (
              binding
              && canonicalJsonStringify(binding.inputValues) !== canonicalJsonStringify(step.inputValues)
            ) {
              context.addIssue({
                code: "custom",
                path: ["runtimeEvidence", "actions"],
                message: `Runtime invocation values must equal the prerequisite scenario for ${action.id}:${step.actionRef}`,
              });
            }
          });
        });
      runtimeEvidence.actions.forEach((binding, bindingIndex) => {
        const action = actionById.get(binding.actionRef);
        if (!action || !executableActionRefs.has(binding.actionRef)) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "actions", bindingIndex, "actionRef"],
            message: `Runtime evidence action is absent from the required slice: ${binding.actionRef}`,
          });
          return;
        }
        const expectedInputs = [...action.input.fields.map((field) => field.name)].sort();
        const suppliedInputs = Object.keys(binding.inputValues).sort();
        if (
          expectedInputs.length !== suppliedInputs.length
          || expectedInputs.some((field, index) => field !== suppliedInputs[index])
        ) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "actions", bindingIndex, "inputValues"],
            message: `Runtime invocation inputs must exactly equal action inputs for ${binding.actionRef}`,
          });
        }
        if (canonicalJsonStringify(binding.inputValues) !== canonicalJsonStringify(action.evidenceScenario.targetInputValues)) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "actions", bindingIndex, "inputValues"],
            message: `Runtime invocation values must equal the canonical evidence scenario for ${binding.actionRef}`,
          });
        }
        const durabilityLevels = action.persistenceEffects.flatMap((effect) => {
          const policy = value.contract.persistencePolicies.find((candidate) => candidate.id === effect.policyRef);
          return policy ? [policy.durability] : [];
        });
        const durable = durabilityLevels.some((durability) => ["reload", "restart", "durable"].includes(durability));
        if (durable && !binding.reload) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "actions", bindingIndex, "reload"],
            message: `Durable action ${binding.actionRef} requires an exact reload/readback invocation`,
          });
        }
        if (!durable && binding.reload) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "actions", bindingIndex, "reload"],
            message: `Non-durable action ${binding.actionRef} cannot add an unrequired reload invocation`,
          });
        }
        if (runtimeEvidence.adapter === "http-service" && binding.reload) {
          const httpBinding = runtimeEvidence.actions.find((candidate) => candidate.actionRef === binding.actionRef);
          const expectedLifecycle = durabilityLevels.some((durability) => ["restart", "durable"].includes(durability))
            ? "restart"
            : "readback";
          if (httpBinding?.reloadLifecycle !== expectedLifecycle) {
            context.addIssue({
              code: "custom",
              path: ["runtimeEvidence", "actions", bindingIndex, "reloadLifecycle"],
              message: `HTTP action ${binding.actionRef} requires ${expectedLifecycle} lifecycle evidence`,
            });
          }
        }
        const stateful = value.requiredEvidence.some((predicate) =>
          (predicate.subjectRef === binding.actionRef || action.evidenceRefs.includes(predicate.id))
          && ["state_transition", "persistence_round_trip"].includes(predicate.kind));
        if (stateful && !runtimeEvidence.initial) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "initial"],
            message: `Stateful action ${binding.actionRef} requires an exact initial-state invocation`,
          });
        }
        if (
          stateful
          && (
            runtimeEvidence.initial?.capture.format !== "json"
            || binding.action.capture.format !== "json"
            || (binding.reload && binding.reload.capture.format !== "json")
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "actions", bindingIndex],
            message: `Stateful action ${binding.actionRef} requires JSON state capture for initial/action/readback`,
          });
        }
      });
    }
    if (value.runtimeEvidence?.adapter === "browser-service") {
      const capturedStateRefs = new Set(
        value.runtimeEvidence.capture.stateBindings.map((binding) => binding.stateRef),
      );
      value.contract.states.forEach((state, stateIndex) => {
        if (!capturedStateRefs.has(state.id)) {
          context.addIssue({
            code: "custom",
            path: ["runtimeEvidence", "capture", "stateBindings"],
            message: `Browser capture ABI has no exact state binding for ${value.contract.states[stateIndex]!.id}`,
          });
        }
      });
    }
    if (value.recovery) {
      if (
        value.recovery.sourceRevision.baseSha !== value.sourceRevision.baseSha
        || value.recovery.sourceRevision.treeHash !== value.sourceRevision.treeHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["recovery", "sourceRevision"],
          message: "Recovery authorization source must equal the exact slice source",
        });
      }
      const writable = new Set(value.files
        .filter((file) => file.role === "owned" || file.role === "shared_writable")
        .map((file) => file.path));
      value.recovery.allowedPaths.forEach((allowedPath, index) => {
        if (!writable.has(allowedPath)) {
          context.addIssue({
            code: "custom",
            path: ["recovery", "allowedPaths", index],
            message: `Recovery write path is not writable in the sealed topology: ${allowedPath}`,
          });
        }
      });
      if (value.recovery.expectedDelta.kind === "source_change") {
        const allowed = new Set(value.recovery.allowedPaths);
        value.recovery.expectedDelta.requiredPaths.forEach((requiredPath, index) => {
          if (!allowed.has(requiredPath)) {
            context.addIssue({
              code: "custom",
              path: ["recovery", "expectedDelta", "requiredPaths", index],
              message: `Required recovery path is outside exact write authority: ${requiredPath}`,
            });
          }
        });
      }
    }
  });

export type ImplementationSliceV1 = z.infer<typeof ImplementationSliceV1Schema>;
