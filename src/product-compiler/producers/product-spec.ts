import { z } from "zod";

import {
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "../schemas/product-spec-v1.js";

const SupportedProductClassSchema = z.enum(["utility", "operations", "game"]);
const RequestedProductClassSchema = z.enum([
  "utility",
  "operations",
  "game",
  "content",
  "commerce",
  "developer_tool",
  "service",
  "other",
]);

const ProductSpecProducerInputSchema = z
  .object({
    task: z.string().min(1).max(50_000),
    productClass: RequestedProductClassSchema.optional(),
    productName: z.string().min(1).max(200).optional(),
  })
  .strict();

export type SupportedProductClass = z.infer<typeof SupportedProductClassSchema>;
export type ProductSpecProducerInput = z.input<typeof ProductSpecProducerInputSchema>;

export type ProductSpecProducerDiagnostic = Readonly<{
  code: string;
  severity: "error";
  message: string;
  reference?: string;
}>;

export type ProductSpecProducerResult =
  | Readonly<{
      status: "produced";
      productClass: SupportedProductClass;
      productSpec: ProductSpecV1;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      productClass?: SupportedProductClass;
      diagnostics: readonly ProductSpecProducerDiagnostic[];
    }>;

type PersistencePolicy = ProductSpecV1["persistencePolicies"][number];
type EvidencePredicate = ProductSpecV1["evidencePredicates"][number];
type ProductEntity = ProductSpecV1["entities"][number];
type ProductState = ProductSpecV1["states"][number];
type ProductRoute = ProductSpecV1["routes"][number];
type ProductSurface = ProductSpecV1["surfaces"][number];

type ProfileContract = Readonly<{
  entities: ProductEntity[];
  states: ProductState[];
  persistencePolicies: PersistencePolicy[];
  routes: ProductRoute[];
  surfaces: ProductSurface[];
  actions: ProductActionV1[];
  evidencePredicates: EvidencePredicate[];
}>;

type ActionEffect = Readonly<{
  policy: PersistencePolicy;
  operation: ProductActionV1["persistenceEffects"][number]["operation"];
  entityRef: string;
  payloadFields?: string[];
  statePaths?: ProductActionV1["persistenceEffects"][number]["statePaths"];
}>;

type ActionDefinition = Readonly<{
  id: string;
  name: string;
  surfaceRefs: string[];
  trigger: ProductActionV1["trigger"];
  input?: ProductActionV1["input"]["fields"];
  preconditions?: ProductActionV1["preconditions"];
  evidenceInputValues?: ProductActionV1["evidenceScenario"]["targetInputValues"];
  evidencePrerequisiteSteps?: ProductActionV1["evidenceScenario"]["prerequisiteSteps"];
  stateDeltas: ProductActionV1["stateDeltas"];
  navigation?: ProductActionV1["navigation"];
  effects: ActionEffect[];
  stateRefs: string[];
}>;

const CLASS_UNSUPPORTED_RE = /\b(?:api\s+only|rest\s+api|graphql|command[- ]line|\bcli\b|mobile\s+app|react\s+native|android|ios\s+app|desktop\s+app|electron|e[- ]?commerce|checkout|blog|cms)\b/i;
const FEATURE_UNSUPPORTED_RE = /\b(?:auth(?:entication)?|log[- ]?in|sign[- ]?in|role[- ]based|payment|stripe|multiplayer|real[- ]?time|websocket|external\s+api|ai[- ]powered|\bllm\b|file\s+upload|data\s+import|data\s+export)\b/i;

function diagnostic(
  code: string,
  message: string,
  reference?: string,
): ProductSpecProducerDiagnostic {
  return {
    code,
    severity: "error",
    message,
    ...(reference ? { reference } : {}),
  };
}

function reject(
  diagnostics: readonly ProductSpecProducerDiagnostic[],
  productClass?: SupportedProductClass,
): ProductSpecProducerResult {
  return {
    status: "rejected",
    ...(productClass ? { productClass } : {}),
    diagnostics: [...diagnostics].sort((left, right) => {
      const leftKey = `${left.code}\0${left.reference ?? ""}\0${left.message}`;
      const rightKey = `${right.code}\0${right.reference ?? ""}\0${right.message}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    }),
  };
}

function normalizeTask(task: string): string {
  return task
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stableToken(value: string, fallback: string): string {
  const transliterated = value
    .normalize("NFKD")
    // NFKD handles composed Latin diacritics. Dotless i has no compatible
    // decomposition, so map its Unicode code point explicitly without placing
    // locale-specific source text in the English-only production tree.
    .replace(/\u0131/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return transliterated || fallback;
}

function sentenceFragments(task: string): string[] {
  return task
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((value) => value.replace(/^[-*]\s*/, "").trim())
    .filter((value) => value.length > 0)
    .filter((value) => !/^(?:project|platform|tech(?:nology)?[_ ]stack)\s*:/i.test(value));
}

function taskGoals(task: string): ProductSpecV1["product"]["goals"] {
  const positive = sentenceFragments(task)
    .filter((value) => !/^(?:do\s+not|don't|without|exclude|no\s+)/i.test(value))
    .slice(0, 50);
  const statements = positive.length > 0 ? positive : [task];
  return statements.map((statement, index) => ({
    id: `GOAL_REQUEST_${String(index + 1).padStart(3, "0")}`,
    statement: statement.slice(0, 2_000),
  }));
}

function taskNonGoals(task: string): ProductSpecV1["product"]["nonGoals"] {
  const exclusions = [...task.matchAll(/\b(?:without|do\s+not|don't|must\s+not|no\s+(?:backend|database|auth(?:entication)?|login|navigation|analytics|settings))\b[^.;\n]*/gi)]
    .map((match) => match[0]!.trim())
    .filter(Boolean)
    .slice(0, 50);
  return exclusions.map((statement, index) => ({
    id: `NONGOAL_REQUEST_${String(index + 1).padStart(3, "0")}`,
    statement: statement.slice(0, 2_000),
  }));
}

function explicitName(task: string): string | undefined {
  const projectLine = task.match(/(?:^|\n)\s*Project\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (projectLine) return projectLine.slice(0, 200);
  const named = task.match(/\b(?:called|named|titled)\s+["'“”]?([\p{L}\p{N}][\p{L}\p{N}&'’ -]{1,100}?)(?=["'“”]?(?:[.;,]|\s+with\b|\s+that\b|\s+which\b|$))/iu)?.[1]?.trim();
  return named?.slice(0, 200);
}

function classSignals(task: string): Set<SupportedProductClass> {
  const signals = new Set<SupportedProductClass>();
  if (/\b(?:browser\s+game|video\s+game|gameplay|player\s+(?:moves?|starts?)|high\s+score)\b/i.test(task)) {
    signals.add("game");
  }
  if (
    /\b(?:operations?|crud|inventory|tickets?|tasks?|records?|patients?|customers?)\b/i.test(task)
    && /\b(?:list|create|edit|save|delete|manage|track|triage|update)\b/i.test(task)
  ) {
    signals.add("operations");
  }
  if (
    /\b(?:utility|widget|status\s+tool|status\s+utility|single[- ]page|one[- ]page)\b/i.test(task)
    || (/\b(?:simple|small|compact|minimal)\b/i.test(task) && /\b(?:refresh|toggle|ready|paused|counter)\b/i.test(task))
  ) {
    signals.add("utility");
  }
  return signals;
}

function resolveProductClass(
  task: string,
  requested: z.infer<typeof RequestedProductClassSchema> | undefined,
): ProductSpecProducerResult | SupportedProductClass {
  if (requested && !SupportedProductClassSchema.safeParse(requested).success) {
    return reject([
      diagnostic(
        "PRODUCT_SPEC_CLASS_UNSUPPORTED",
        `Product class ${requested} has no deterministic v1 producer profile`,
        requested,
      ),
    ]);
  }

  const signals = classSignals(task);
  if (signals.size > 1) {
    return reject([
      diagnostic(
        "PRODUCT_SPEC_CLASS_AMBIGUOUS",
        "Task contains conflicting utility, operations, or game semantics",
        [...signals].sort().join(","),
      ),
    ]);
  }

  const inferred = [...signals][0];
  const explicit = requested as SupportedProductClass | undefined;
  if (explicit && inferred && explicit !== inferred) {
    return reject([
      diagnostic(
        "PRODUCT_SPEC_CLASS_CONFLICT",
        `Explicit class ${explicit} conflicts with task-derived class ${inferred}`,
        `${explicit}->${inferred}`,
      ),
    ]);
  }
  if (explicit) return explicit;
  if (inferred) return inferred;
  return reject([
    diagnostic(
      "PRODUCT_SPEC_CLASS_MISSING",
      "Task does not contain enough semantics to select one deterministic product producer",
    ),
  ]);
}

function capabilityForPolicy(policy: PersistencePolicy): string {
  if (policy.kind === "local_storage") return "CAP_LOCAL_PERSISTENCE";
  if (policy.kind === "database") return "CAP_DATABASE_PERSISTENCE";
  if (policy.kind === "file") return "CAP_FILE_PERSISTENCE";
  if (policy.kind === "remote_api") return "CAP_REMOTE_API";
  return "CAP_RUNTIME_STATE";
}

function buildAction(definition: ActionDefinition): {
  action: ProductActionV1;
  evidence: EvidencePredicate[];
} {
  const token = definition.id.replace(/^ACT_/, "");
  const interactionEvidenceId = `EVID_${token}_${definition.trigger.kind === "user" ? "CONTROL" : "RUNTIME"}`;
  const stateEvidenceId = `EVID_${token}_STATE`;
  const uniqueEffects = [...new Map(
    definition.effects
      .filter((effect) => effect.operation !== "read")
      .map((effect) => [effect.policy.id, effect]),
  ).values()];
  const persistenceEvidence = uniqueEffects.map((effect, index): EvidencePredicate => ({
    id: `EVID_${token}_PERSIST_${String(index + 1).padStart(3, "0")}`,
    kind: "persistence_round_trip",
    required: true,
    subjectRef: definition.id,
    capabilityRefs: [capabilityForPolicy(effect.policy)],
    assertion: {
      operator: "passes",
      expected: {
        policyRef: effect.policy.id,
        durability: effect.policy.durability,
        operation: effect.operation,
        statePaths: effect.statePaths ?? definition.stateDeltas.map((delta) => ({
          stateRef: delta.stateRef,
          path: delta.path,
        })),
      },
    },
  }));
  const evidence: EvidencePredicate[] = [
    {
      id: interactionEvidenceId,
      kind: definition.trigger.kind === "user" ? "control_action" : "runtime",
      required: true,
      subjectRef: definition.id,
      capabilityRefs: [definition.trigger.kind === "timer" ? "CAP_GAME_TIMING" : definition.trigger.kind === "user" ? "CAP_BROWSER_INTERACTION" : "CAP_RUNTIME_STATE"],
      assertion: { operator: "passes", expected: { actionRef: definition.id } },
    },
    {
      id: stateEvidenceId,
      kind: "state_transition",
      required: true,
      subjectRef: definition.id,
      capabilityRefs: ["CAP_RUNTIME_STATE"],
      assertion: { operator: "passes", expected: { stateRefs: definition.stateRefs } },
    },
    ...persistenceEvidence,
  ];
  const evidenceRefs = evidence.map((predicate) => predicate.id);
  const persistenceRefs = [...new Set(definition.effects.map((effect) => effect.policy.id))];

  const action = ProductSpecV1Schema.shape.actions.element.parse({
    id: definition.id,
    name: definition.name,
    surfaceRefs: definition.surfaceRefs,
    trigger: definition.trigger,
    input: { fields: definition.input ?? [] },
    preconditions: definition.preconditions ?? [],
    evidenceScenario: {
      targetInputValues: definition.evidenceInputValues ?? {},
      prerequisiteSteps: definition.evidencePrerequisiteSteps ?? [],
    },
    stateDeltas: definition.stateDeltas,
    navigation: definition.navigation ?? { kind: "stay" },
    persistenceEffects: definition.effects.map((effect) => ({
      policyRef: effect.policy.id,
      operation: effect.operation,
      entityRef: effect.entityRef,
      payloadFields: effect.payloadFields ?? [],
      statePaths: effect.statePaths ?? definition.stateDeltas.map((delta) => ({
        stateRef: delta.stateRef,
        path: delta.path,
      })),
    })),
    success: {
      stateRefs: definition.stateRefs,
      persistenceRefs,
      evidenceRefs,
      userVisible: definition.trigger.kind === "user",
    },
    failure: {
      stateRefs: definition.stateRefs,
      persistenceRefs,
      evidenceRefs: [interactionEvidenceId],
      userVisible: definition.trigger.kind === "user",
    },
    evidenceRefs,
  });
  return { action, evidence };
}

function compileActions(definitions: ActionDefinition[]): Pick<ProfileContract, "actions" | "evidencePredicates"> {
  const compiled = definitions.map(buildAction);
  return {
    actions: compiled.map((item) => item.action),
    evidencePredicates: compiled.flatMap((item) => item.evidence),
  };
}

function utilityProfile(task: string): ProfileContract | ProductSpecProducerDiagnostic[] {
  const diagnostics: ProductSpecProducerDiagnostic[] = [];
  if (!/\brefresh(?:ed|es|ing)?\b/i.test(task)) {
    diagnostics.push(diagnostic("PRODUCT_SPEC_UTILITY_REFRESH_MISSING", "Status utility profile requires an explicit refresh behavior", "refresh"));
  }
  if (!(/\b(?:toggle|switch)\b/i.test(task) && /\bready\b/i.test(task) && /\bpaused?\b/i.test(task))) {
    diagnostics.push(diagnostic("PRODUCT_SPEC_UTILITY_STATUS_TRANSITION_MISSING", "Status utility profile requires an explicit ready/paused toggle", "ready<->paused"));
  }
  if (/\b(?:create|edit|delete|crud|manage|inventory|tickets?|records?)\b/i.test(task)) {
    diagnostics.push(diagnostic("PRODUCT_SPEC_UTILITY_SCOPE_AMBIGUOUS", "Utility task also asks for record-management semantics", "record-management"));
  }
  if (diagnostics.length > 0) return diagnostics;

  const entity: ProductEntity = {
    id: "ENTITY_UTILITY_STATUS",
    name: "UtilityStatus",
    fields: [
      { id: "FIELD_UTILITY_PAUSED", name: "paused", valueType: "boolean", required: true, defaultValue: false },
      { id: "FIELD_UTILITY_REFRESHED_AT", name: "refreshedAt", valueType: "datetime", required: false },
    ],
  };
  const persistent = /\b(?:local\s*storage|localstorage|persist(?:ed|ence)?)\b/i.test(task);
  const policy: PersistencePolicy = persistent
    ? {
        id: "PERSIST_UTILITY_LOCAL",
        kind: "local_storage",
        owner: "application",
        entityRefs: [entity.id],
        durability: "reload",
        key: "setfarm-utility-status-v1",
        rehydration: { kind: "initialization" },
      }
    : {
        id: "PERSIST_UTILITY_SESSION",
        kind: "memory",
        owner: "application",
        entityRefs: [entity.id],
        durability: "session",
        rehydration: { kind: "none" },
      };
  const state: ProductState = {
    id: "STATE_UTILITY_STATUS",
    name: "Utility status state",
    kind: "application",
    initialValue: { paused: false, refreshRequested: false, refreshedAt: null },
    invariants: [
      "paused=false is the ready state and paused=true is the paused state.",
      "ACT_REFRESH_STATUS sets refreshRequested; the runtime updates refreshedAt from its clock and then clears the request.",
    ],
  };
  const routes: ProductRoute[] = [{ id: "ROUTE_HOME", path: "/", surfaceRefs: ["SURF_UTILITY"], entry: true }];
  const surfaces: ProductSurface[] = [{ id: "SURF_UTILITY", name: "Status utility", kind: "page", routeRef: "ROUTE_HOME", required: true }];
  const compiled = compileActions([
    {
      id: "ACT_REFRESH_STATUS",
      name: "Refresh visible status",
      surfaceRefs: ["SURF_UTILITY"],
      trigger: { kind: "user", sourceRef: "CTRL_REFRESH_STATUS" },
      stateDeltas: [{
        stateRef: state.id,
        operation: "set",
        path: "/refreshRequested",
        valueFrom: { kind: "literal", value: true },
      }],
      effects: [],
      stateRefs: [state.id],
    },
    {
      id: "ACT_SET_PAUSED",
      name: "Toggle ready or paused state",
      surfaceRefs: ["SURF_UTILITY"],
      trigger: { kind: "user", sourceRef: "CTRL_READY_PAUSED" },
      input: [{ name: "paused", valueType: "boolean", required: true, entityFieldRef: "FIELD_UTILITY_PAUSED" }],
      evidenceInputValues: { paused: true },
      stateDeltas: [{
        stateRef: state.id,
        operation: "set",
        path: "/paused",
        valueFrom: { kind: "input", field: "paused" },
      }],
      effects: [{ policy, operation: "update", entityRef: entity.id, payloadFields: ["paused"] }],
      stateRefs: [state.id],
    },
  ]);
  return {
    entities: [entity],
    states: [state],
    persistencePolicies: [policy],
    routes,
    surfaces,
    ...compiled,
  };
}

function inferOperationsEntity(task: string): { name: string; token: string } | undefined {
  const domain = [
    [/\binventory\b|\bitems?\b/i, "Item"],
    [/\btickets?\b|\bservice\s+desk\b/i, "Ticket"],
    [/\btasks?\b/i, "Task"],
    [/\bpatients?\b/i, "Patient"],
    [/\bcustomers?|contacts?|leads?\b/i, "Customer"],
    [/\brecords?\b/i, "Record"],
  ] as const;
  const match = domain.find(([pattern]) => pattern.test(task));
  return match ? { name: match[1], token: stableToken(match[1], "RECORD") } : undefined;
}

function operationsProfile(task: string): ProfileContract | ProductSpecProducerDiagnostic[] {
  const diagnostics: ProductSpecProducerDiagnostic[] = [];
  const entityIdentity = inferOperationsEntity(task);
  const crud = /\bcrud\b/i.test(task);
  const hasList = crud || /\b(?:list|browse|view|show)\b/i.test(task);
  const hasCreate = crud || /\bcreate\b/i.test(task);
  const hasEdit = crud || /\b(?:edit|update|save)\b/i.test(task);
  const hasDelete = crud || /\b(?:delete|remove)\b/i.test(task);
  const databaseRequested = /\b(?:database|postgres(?:ql)?|sqlite)\b/i.test(task);
  const hasPersistence = /\b(?:local\s*storage|localstorage|persist(?:ed|ence)?|database|postgres(?:ql)?|sqlite)\b/i.test(task);
  if (!entityIdentity) diagnostics.push(diagnostic("PRODUCT_SPEC_OPERATIONS_ENTITY_MISSING", "Operations producer requires one explicit supported domain entity", "item|ticket|task|patient|customer|record"));
  if (!hasList) diagnostics.push(diagnostic("PRODUCT_SPEC_OPERATIONS_LIST_MISSING", "Operations producer requires explicit list or browse behavior", "list"));
  if (!hasCreate) diagnostics.push(diagnostic("PRODUCT_SPEC_OPERATIONS_CREATE_MISSING", "Operations producer requires explicit create behavior", "create"));
  if (!hasEdit) diagnostics.push(diagnostic("PRODUCT_SPEC_OPERATIONS_EDIT_MISSING", "Operations producer requires explicit edit/save behavior", "edit"));
  if (!hasPersistence) diagnostics.push(diagnostic("PRODUCT_SPEC_OPERATIONS_PERSISTENCE_MISSING", "Operations producer cannot choose durable ownership without explicit persistence intent", "localStorage"));
  if (databaseRequested) diagnostics.push(diagnostic(
    "PRODUCT_SPEC_OPERATIONS_DATABASE_PROFILE_UNSUPPORTED",
    "Operations v1 has no production server-runtime evidence adapter for database durability; use explicit localStorage or wait for the database profile",
    "database",
  ));
  const unsupported = task.match(/\b(?:assign|approve|filter|search|analytics|reporting|kanban|calendar|attachment)\b/i)?.[0];
  if (unsupported) diagnostics.push(diagnostic("PRODUCT_SPEC_OPERATIONS_FEATURE_UNSUPPORTED", `Operations v1 profile cannot compile requested ${unsupported} semantics`, unsupported.toLowerCase()));
  if (diagnostics.length > 0 || !entityIdentity) return diagnostics;

  const token = entityIdentity.token;
  const entityId = `ENTITY_${token}`;
  const fieldId = `FIELD_${token}_ID`;
  const fieldTitle = `FIELD_${token}_TITLE`;
  const fieldStatus = `FIELD_${token}_STATUS`;
  const entity: ProductEntity = {
    id: entityId,
    name: entityIdentity.name,
    fields: [
      { id: fieldId, name: "id", valueType: "string", required: true },
      { id: fieldTitle, name: "title", valueType: "string", required: true },
      { id: fieldStatus, name: "status", valueType: "enum", required: true, enumValues: ["active", "completed"], defaultValue: "active" },
    ],
  };
  const sessionPolicy: PersistencePolicy = {
    id: `PERSIST_${token}_SESSION`,
    kind: "memory",
    owner: "application",
    entityRefs: [entityId],
    durability: "session",
    rehydration: { kind: "none" },
  };
  const durablePolicy: PersistencePolicy = {
    id: `PERSIST_${token}_LOCAL`,
    kind: "local_storage",
    owner: "application",
    entityRefs: [entityId],
    durability: "reload",
    key: `setfarm-${token.toLowerCase()}-records-v1`,
    rehydration: { kind: "action", actionRef: `ACT_LOAD_${token}S` },
  };
  const state: ProductState = {
    id: `STATE_${token}_OPERATIONS`,
    name: `${entityIdentity.name} operations state`,
    kind: "domain",
    initialValue: { records: [], selectedId: null, draft: null, loading: false, loaded: false, lastError: null },
    invariants: [
      `Every persisted ${entityIdentity.name} has a unique non-empty id and title.`,
      "A failed durable mutation preserves the current draft and last good record collection.",
      "ACT_LOAD records a stable loaded=true completion state after reading durable records.",
    ],
  };
  const routes: ProductRoute[] = [{
    id: "ROUTE_HOME",
    path: "/",
    surfaceRefs: [`SURF_${token}_LIST`, `SURF_${token}_EDITOR`],
    entry: true,
  }];
  const surfaces: ProductSurface[] = [
    { id: `SURF_${token}_LIST`, name: `${entityIdentity.name} list`, kind: "page", routeRef: "ROUTE_HOME", required: true },
    { id: `SURF_${token}_EDITOR`, name: `${entityIdentity.name} editor`, kind: "dialog", routeRef: "ROUTE_HOME", required: true },
  ];
  const evidenceRecord = {
    id: `setfarm-evidence-${token.toLowerCase()}-001`,
    title: `Setfarm evidence ${entityIdentity.name.toLowerCase()}`,
    status: "active",
  };
  const createEvidenceStep = { actionRef: `ACT_CREATE_${token}`, inputValues: {} };
  const saveEvidenceStep = {
    actionRef: `ACT_SAVE_${token}`,
    inputValues: evidenceRecord,
  };
  const selectEvidenceStep = {
    actionRef: `ACT_SELECT_${token}`,
    inputValues: { id: evidenceRecord.id },
  };
  const definitions: ActionDefinition[] = [
    {
      id: `ACT_LOAD_${token}S`,
      name: `Load ${entityIdentity.name.toLowerCase()} records`,
      surfaceRefs: [`SURF_${token}_LIST`],
      trigger: { kind: "system" },
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/loaded", valueFrom: { kind: "literal", value: true } }],
      effects: [{
        policy: durablePolicy,
        operation: "read",
        entityRef: entityId,
        statePaths: [{ stateRef: state.id, path: "/records" }],
      }],
      stateRefs: [state.id],
    },
    {
      id: `ACT_CREATE_${token}`,
      name: `Create ${entityIdentity.name.toLowerCase()} draft`,
      surfaceRefs: [`SURF_${token}_LIST`],
      trigger: { kind: "user", sourceRef: `CTRL_CREATE_${token}` },
      stateDeltas: [{
        stateRef: state.id,
        operation: "set",
        path: "/draft",
        valueFrom: { kind: "literal", value: { id: null, title: "", status: "active" } },
      }],
      effects: [{ policy: sessionPolicy, operation: "write", entityRef: entityId }],
      stateRefs: [state.id],
    },
    {
      id: `ACT_SELECT_${token}`,
      name: `Select ${entityIdentity.name.toLowerCase()} for editing`,
      surfaceRefs: [`SURF_${token}_LIST`],
      trigger: { kind: "user", sourceRef: `CTRL_SELECT_${token}` },
      input: [{ name: "id", valueType: "string", required: true, entityFieldRef: fieldId }],
      evidenceInputValues: { id: evidenceRecord.id },
      preconditions: [{ stateRef: state.id, path: "/records/0", operator: "exists" }],
      evidencePrerequisiteSteps: [createEvidenceStep, saveEvidenceStep],
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/selectedId", valueFrom: { kind: "input", field: "id" } }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entityId, payloadFields: ["id"] }],
      stateRefs: [state.id],
    },
    {
      id: `ACT_SAVE_${token}`,
      name: `Save ${entityIdentity.name.toLowerCase()}`,
      surfaceRefs: [`SURF_${token}_EDITOR`],
      trigger: { kind: "user", sourceRef: `CTRL_SAVE_${token}` },
      input: [
        { name: "id", valueType: "string", required: true, entityFieldRef: fieldId },
        { name: "title", valueType: "string", required: true, entityFieldRef: fieldTitle },
        { name: "status", valueType: "enum", required: true, entityFieldRef: fieldStatus },
      ],
      evidenceInputValues: evidenceRecord,
      preconditions: [{ stateRef: state.id, path: "/draft", operator: "exists" }],
      evidencePrerequisiteSteps: [createEvidenceStep],
      stateDeltas: [
        { stateRef: state.id, operation: "set", path: "/draft/id", valueFrom: { kind: "input", field: "id" } },
        { stateRef: state.id, operation: "set", path: "/draft/title", valueFrom: { kind: "input", field: "title" } },
        { stateRef: state.id, operation: "set", path: "/draft/status", valueFrom: { kind: "input", field: "status" } },
        { stateRef: state.id, operation: "upsert", path: "/records", valueFrom: { kind: "inputs", fields: ["id", "title", "status"] }, matchField: "id" },
      ],
      effects: [{
        policy: durablePolicy,
        operation: "update",
        entityRef: entityId,
        payloadFields: ["id", "title", "status"],
        statePaths: [{ stateRef: state.id, path: "/records" }],
      }],
      stateRefs: [state.id],
    },
  ];
  if (hasDelete) {
    definitions.push({
      id: `ACT_DELETE_${token}`,
      name: `Delete ${entityIdentity.name.toLowerCase()}`,
      surfaceRefs: [`SURF_${token}_EDITOR`],
      trigger: { kind: "user", sourceRef: `CTRL_DELETE_${token}` },
      input: [{ name: "id", valueType: "string", required: true, entityFieldRef: fieldId }],
      evidenceInputValues: { id: evidenceRecord.id },
      preconditions: [{ stateRef: state.id, path: "/selectedId", operator: "exists" }],
      evidencePrerequisiteSteps: [createEvidenceStep, saveEvidenceStep, selectEvidenceStep],
      stateDeltas: [{ stateRef: state.id, operation: "remove", path: "/records", valueFrom: { kind: "input", field: "id" }, matchField: "id" }],
      effects: [{
        policy: durablePolicy,
        operation: "delete",
        entityRef: entityId,
        payloadFields: ["id"],
        statePaths: [{ stateRef: state.id, path: "/records" }],
      }],
      stateRefs: [state.id],
    });
  }
  const compiled = compileActions(definitions);
  return {
    entities: [entity],
    states: [state],
    persistencePolicies: [sessionPolicy, durablePolicy],
    routes,
    surfaces,
    ...compiled,
  };
}

function gameProfile(task: string): ProfileContract | ProductSpecProducerDiagnostic[] {
  const diagnostics: ProductSpecProducerDiagnostic[] = [];
  const hasStart = /\b(?:start|play)\b/i.test(task);
  const hasMovement = (/\bleft\b/i.test(task) && /\bright\b/i.test(task)) || /\b(?:arrow\s+keys|keyboard\s+movement)\b/i.test(task);
  const hasPause = /\bpause(?:d|s)?\b/i.test(task) && /\bresume(?:d|s)?\b/i.test(task);
  const hasRestart = /\brestart|reset\s+the\s+game\b/i.test(task);
  const hasScore = /\bscore|high\s+score\b/i.test(task);
  if (!hasStart) diagnostics.push(diagnostic("PRODUCT_SPEC_GAME_START_MISSING", "Game v1 profile requires explicit start/play behavior", "start"));
  if (!hasMovement) diagnostics.push(diagnostic("PRODUCT_SPEC_GAME_MOVEMENT_MISSING", "Game v1 profile requires explicit left/right movement", "left+right"));
  if (!hasPause) diagnostics.push(diagnostic("PRODUCT_SPEC_GAME_PAUSE_MISSING", "Game v1 profile requires explicit pause and resume behavior", "pause+resume"));
  if (!hasRestart) diagnostics.push(diagnostic("PRODUCT_SPEC_GAME_RESTART_MISSING", "Game v1 profile requires explicit restart behavior", "restart"));
  if (!hasScore) diagnostics.push(diagnostic("PRODUCT_SPEC_GAME_SCORE_MISSING", "Game v1 profile requires explicit score semantics", "score"));
  const unsupported = task.match(/\b(?:levels?|enemies|combat|shoot|collect|dodge|physics|multiplayer|inventory)\b/i)?.[0];
  if (unsupported) diagnostics.push(diagnostic("PRODUCT_SPEC_GAME_MECHANIC_UNSUPPORTED", `Game v1 profile cannot compile requested ${unsupported} mechanics`, unsupported.toLowerCase()));
  if (diagnostics.length > 0) return diagnostics;

  const entity: ProductEntity = {
    id: "ENTITY_GAME_SESSION",
    name: "GameSession",
    fields: [
      { id: "FIELD_GAME_STATUS", name: "status", valueType: "enum", required: true, enumValues: ["ready", "playing", "paused", "game_over"], defaultValue: "ready" },
      { id: "FIELD_GAME_PLAYER_X", name: "playerX", valueType: "number", required: true, defaultValue: 0 },
      { id: "FIELD_GAME_SCORE", name: "score", valueType: "number", required: true, defaultValue: 0 },
      { id: "FIELD_GAME_HIGH_SCORE", name: "highScore", valueType: "number", required: true, defaultValue: 0 },
    ],
  };
  const sessionPolicy: PersistencePolicy = {
    id: "PERSIST_GAME_SESSION",
    kind: "memory",
    owner: "application",
    entityRefs: [entity.id],
    durability: "session",
    rehydration: { kind: "none" },
  };
  const persistHighScore = /\b(?:local\s*storage|localstorage|persist|store|save)\b/i.test(task) && /\bhigh\s+score\b/i.test(task);
  const highScorePolicy: PersistencePolicy | undefined = persistHighScore
    ? {
        id: "PERSIST_GAME_HIGH_SCORE",
        kind: "local_storage",
        owner: "application",
        entityRefs: [entity.id],
        durability: "reload",
        key: "setfarm-game-high-score-v1",
        rehydration: { kind: "initialization" },
      }
    : undefined;
  const state: ProductState = {
    id: "STATE_GAME_SESSION",
    name: "Game session state",
    kind: "session",
    initialValue: { status: "ready", playerX: 0, score: 0, highScore: 0, pendingHorizontalDelta: 0, tickRequested: false },
    invariants: [
      "ACT_ADVANCE_GAME only advances while status=playing, applies pendingHorizontalDelta once, increments score, and clears both pending fields.",
      "ACT_PAUSE_GAME freezes timer progression and ACT_RESUME_GAME restores progression without resetting score.",
      "ACT_RESTART_GAME restores ready position and score while preserving highScore.",
      ...(highScorePolicy ? ["Recorded highScore equals the maximum completed score observed across reloads."] : []),
    ],
  };
  const routes: ProductRoute[] = [{ id: "ROUTE_GAME", path: "/", surfaceRefs: ["SURF_GAMEPLAY", "SURF_GAME_OVERLAY"], entry: true }];
  const surfaces: ProductSurface[] = [
    { id: "SURF_GAMEPLAY", name: "Playable game scene", kind: "canvas", routeRef: "ROUTE_GAME", required: true },
    { id: "SURF_GAME_OVERLAY", name: "Game status overlay", kind: "overlay", routeRef: "ROUTE_GAME", required: true },
  ];
  const startEvidenceStep = { actionRef: "ACT_START_GAME", inputValues: {} };
  const pauseEvidenceStep = { actionRef: "ACT_PAUSE_GAME", inputValues: {} };
  const definitions: ActionDefinition[] = [
    {
      id: "ACT_START_GAME",
      name: "Start game",
      surfaceRefs: ["SURF_GAME_OVERLAY"],
      trigger: { kind: "user", sourceRef: "CTRL_START_GAME" },
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/status", valueFrom: { kind: "literal", value: "playing" } }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entity.id }],
      stateRefs: [state.id],
    },
    {
      id: "ACT_MOVE_LEFT",
      name: "Move player left",
      surfaceRefs: ["SURF_GAMEPLAY"],
      trigger: { kind: "user", sourceRef: "CTRL_MOVE_LEFT" },
      preconditions: [{ stateRef: state.id, path: "/status", operator: "equals", expected: "playing" }],
      evidencePrerequisiteSteps: [startEvidenceStep],
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/pendingHorizontalDelta", valueFrom: { kind: "literal", value: -1 } }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entity.id }],
      stateRefs: [state.id],
    },
    {
      id: "ACT_MOVE_RIGHT",
      name: "Move player right",
      surfaceRefs: ["SURF_GAMEPLAY"],
      trigger: { kind: "user", sourceRef: "CTRL_MOVE_RIGHT" },
      preconditions: [{ stateRef: state.id, path: "/status", operator: "equals", expected: "playing" }],
      evidencePrerequisiteSteps: [startEvidenceStep],
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/pendingHorizontalDelta", valueFrom: { kind: "literal", value: 1 } }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entity.id }],
      stateRefs: [state.id],
    },
    {
      id: "ACT_PAUSE_GAME",
      name: "Pause game",
      surfaceRefs: ["SURF_GAME_OVERLAY"],
      trigger: { kind: "user", sourceRef: "CTRL_PAUSE_GAME" },
      preconditions: [{ stateRef: state.id, path: "/status", operator: "equals", expected: "playing" }],
      evidencePrerequisiteSteps: [startEvidenceStep],
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/status", valueFrom: { kind: "literal", value: "paused" } }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entity.id }],
      stateRefs: [state.id],
    },
    {
      id: "ACT_RESUME_GAME",
      name: "Resume game",
      surfaceRefs: ["SURF_GAME_OVERLAY"],
      trigger: { kind: "user", sourceRef: "CTRL_RESUME_GAME" },
      preconditions: [{ stateRef: state.id, path: "/status", operator: "equals", expected: "paused" }],
      evidencePrerequisiteSteps: [startEvidenceStep, pauseEvidenceStep],
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/status", valueFrom: { kind: "literal", value: "playing" } }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entity.id }],
      stateRefs: [state.id],
    },
    {
      id: "ACT_RESTART_GAME",
      name: "Restart game",
      surfaceRefs: ["SURF_GAME_OVERLAY"],
      trigger: { kind: "user", sourceRef: "CTRL_RESTART_GAME" },
      preconditions: [{ stateRef: state.id, path: "/status", operator: "not_equals", expected: "ready" }],
      evidencePrerequisiteSteps: [startEvidenceStep],
      stateDeltas: [{
        stateRef: state.id,
        operation: "merge",
        path: "",
        valueFrom: { kind: "literal", value: { status: "ready", playerX: 0, score: 0, pendingHorizontalDelta: 0, tickRequested: false } },
      }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entity.id }],
      stateRefs: [state.id],
    },
    {
      id: "ACT_ADVANCE_GAME",
      name: "Advance game clock",
      surfaceRefs: ["SURF_GAMEPLAY"],
      trigger: { kind: "timer", sourceRef: "GAME_RUNTIME_CLOCK" },
      preconditions: [{ stateRef: state.id, path: "/status", operator: "equals", expected: "playing" }],
      evidencePrerequisiteSteps: [startEvidenceStep],
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/tickRequested", valueFrom: { kind: "literal", value: true } }],
      effects: [{ policy: sessionPolicy, operation: "update", entityRef: entity.id }],
      stateRefs: [state.id],
    },
  ];
  if (highScorePolicy) {
    definitions.push({
      id: "ACT_RECORD_HIGH_SCORE",
      name: "Record completed high score",
      surfaceRefs: ["SURF_GAME_OVERLAY"],
      trigger: { kind: "system", sourceRef: "GAME_OVER_TRANSITION" },
      input: [{ name: "score", valueType: "number", required: true, entityFieldRef: "FIELD_GAME_SCORE" }],
      evidenceInputValues: { score: 7 },
      stateDeltas: [{ stateRef: state.id, operation: "set", path: "/highScore", valueFrom: { kind: "input", field: "score" } }],
      effects: [{ policy: highScorePolicy, operation: "update", entityRef: entity.id, payloadFields: ["score"] }],
      stateRefs: [state.id],
    });
  }
  const compiled = compileActions(definitions);
  return {
    entities: [entity],
    states: [state],
    persistencePolicies: highScorePolicy ? [sessionPolicy, highScorePolicy] : [sessionPolicy],
    routes,
    surfaces,
    ...compiled,
  };
}

function defaultProductName(
  productClass: SupportedProductClass,
  task: string,
): string {
  const named = explicitName(task);
  if (named) return named;
  if (productClass === "operations") {
    const entity = inferOperationsEntity(task)?.name ?? "Record";
    return `${entity} Operations`;
  }
  if (productClass === "game") return "Browser Score Game";
  return "Status Utility";
}

/**
 * Deterministically compiles a deliberately bounded natural-language task into
 * a strict ProductSpec v1. A task outside the three complete profiles is
 * rejected instead of receiving guessed actions, state, or persistence.
 */
export function produceProductSpecV1(input: unknown): ProductSpecProducerResult {
  const parsedInput = ProductSpecProducerInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return reject(parsedInput.error.issues.slice(0, 100).map((issue) => diagnostic(
      "PRODUCT_SPEC_PRODUCER_INPUT_INVALID",
      `Producer input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  const task = normalizeTask(parsedInput.data.task);
  if (!task) {
    return reject([diagnostic("PRODUCT_SPEC_TASK_EMPTY", "Task has no semantic content after normalization")]);
  }
  if (task.includes("```")) {
    return reject([diagnostic("PRODUCT_SPEC_TASK_FENCE_UNSUPPORTED", "Task contains a Markdown fence that cannot be embedded in the compatibility projection", "```")]);
  }
  const unsupportedClass = task.match(CLASS_UNSUPPORTED_RE)?.[0];
  if (unsupportedClass) {
    return reject([diagnostic("PRODUCT_SPEC_TASK_CLASS_UNSUPPORTED", `No typed v1 producer is available for requested ${unsupportedClass} semantics`, unsupportedClass.toLowerCase())]);
  }
  const unsupportedFeature = task.match(FEATURE_UNSUPPORTED_RE)?.[0];
  if (unsupportedFeature) {
    return reject([diagnostic("PRODUCT_SPEC_TASK_FEATURE_UNSUPPORTED", `Typed v1 producer cannot prove completeness for requested ${unsupportedFeature} semantics`, unsupportedFeature.toLowerCase())]);
  }

  const resolvedClass = resolveProductClass(task, parsedInput.data.productClass);
  if (typeof resolvedClass !== "string") return resolvedClass;

  const profile = resolvedClass === "utility"
    ? utilityProfile(task)
    : resolvedClass === "operations"
      ? operationsProfile(task)
      : gameProfile(task);
  if (Array.isArray(profile)) return reject(profile, resolvedClass);

  const productName = parsedInput.data.productName?.trim() || defaultProductName(resolvedClass, task);
  const candidate = {
    schema: "setfarm.product-spec.v1" as const,
    product: {
      id: `PROD_${stableToken(productName, resolvedClass.toUpperCase())}`,
      name: productName,
      class: resolvedClass,
      goals: taskGoals(task),
      nonGoals: taskNonGoals(task),
    },
    ...profile,
    assumptions: [],
  };
  const parsedCandidate = ProductSpecV1Schema.safeParse(candidate);
  if (!parsedCandidate.success) {
    return reject(parsedCandidate.error.issues.slice(0, 100).map((issue) => diagnostic(
      "PRODUCT_SPEC_PRODUCER_OUTPUT_INVALID",
      `Generated ProductSpec failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )), resolvedClass);
  }
  return {
    status: "produced",
    productClass: resolvedClass,
    productSpec: parsedCandidate.data,
    diagnostics: [],
  };
}
