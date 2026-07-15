import { z } from "zod";

// ProductSpec permits at most 2,000 actions with 500 persistence effects each.
const MAX_PRODUCT_SPEC_PERSISTENCE_EFFECTS = 2_000 * 500;

const DerivedPersistencePayloadV1Schema = z.object({
  actionIndex: z.number().int().nonnegative(),
  effectIndex: z.number().int().nonnegative(),
  payloadFields: z.array(z.string().min(1).max(160)).max(500),
  statePaths: z.array(z.object({
    stateRef: z.string().min(1).max(160),
    path: z.string().max(500),
  }).strict()).min(1).max(500),
}).strict();

export const CompilerOwnedPersistenceProjectionEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.compiler-owned-persistence-projection-evidence.v1"),
  derivedEffects: z.array(DerivedPersistencePayloadV1Schema).max(MAX_PRODUCT_SPEC_PERSISTENCE_EFFECTS),
}).strict();

export type CompilerOwnedPersistenceProjectionEvidenceV1 = z.infer<
  typeof CompilerOwnedPersistenceProjectionEvidenceV1Schema
>;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deltaPayloadFields(delta: JsonObject): string[] {
  const valueFrom = delta["valueFrom"];
  if (!isObject(valueFrom)) return [];
  if (valueFrom["kind"] === "input" && typeof valueFrom["field"] === "string") {
    return [valueFrom["field"]];
  }
  if (valueFrom["kind"] === "inputs" && Array.isArray(valueFrom["fields"])) {
    return valueFrom["fields"].filter((field): field is string => typeof field === "string");
  }
  return [];
}

function emptyEvidence(): CompilerOwnedPersistenceProjectionEvidenceV1 {
  return CompilerOwnedPersistenceProjectionEvidenceV1Schema.parse({
    schema: "setfarm.compiler-owned-persistence-projection-evidence.v1",
    derivedEffects: [],
  });
}

/**
 * Remove planner authority over persistence payload fields without guessing
 * primary product semantics. A write payload is the exact set of action input
 * fields consumed by state deltas for the persisted state paths. Literal,
 * state, and entity-field value sources therefore produce no payload field.
 *
 * Malformed or unmatched state paths are left untouched so the strict
 * ProductSpec validator reports the primary semantic error. This projection
 * never makes an unresolved persistence relation appear valid.
 */
export function projectCompilerOwnedPersistencePayloadsV1(
  rawProposal: unknown,
): Readonly<{
  proposal: unknown;
  evidence: CompilerOwnedPersistenceProjectionEvidenceV1;
}> {
  let proposal: unknown;
  try {
    proposal = structuredClone(rawProposal);
  } catch {
    return { proposal: rawProposal, evidence: emptyEvidence() };
  }
  const derivedEffects: z.infer<typeof DerivedPersistencePayloadV1Schema>[] = [];
  if (!isObject(proposal) || !Array.isArray(proposal["actions"])) {
    return { proposal, evidence: emptyEvidence() };
  }

  proposal["actions"].forEach((actionValue, actionIndex) => {
    if (!isObject(actionValue)) return;
    const deltas = Array.isArray(actionValue["stateDeltas"])
      ? actionValue["stateDeltas"].filter(isObject)
      : [];
    const effects = actionValue["persistenceEffects"];
    if (!Array.isArray(effects)) return;

    effects.forEach((effectValue, effectIndex) => {
      if (!isObject(effectValue) || !Array.isArray(effectValue["statePaths"])) return;
      const statePaths = effectValue["statePaths"];
      if (
        statePaths.length === 0
        || !statePaths.every((statePath) =>
          isObject(statePath)
          && typeof statePath["stateRef"] === "string"
          && typeof statePath["path"] === "string")
      ) return;

      const matchedDeltas: JsonObject[] = [];
      const operation = effectValue["operation"];
      if (operation !== "read") {
        for (const statePath of statePaths) {
          const matches = deltas.filter((delta) =>
            delta["stateRef"] === statePath["stateRef"]
            && delta["path"] === statePath["path"]);
          if (matches.length === 0) return;
          matchedDeltas.push(...matches);
        }
      }

      const payloadFields = [...new Set(matchedDeltas.flatMap(deltaPayloadFields))]
        .sort(compareUtf16);
      const derivedEffect = DerivedPersistencePayloadV1Schema.safeParse({
        actionIndex,
        effectIndex,
        payloadFields,
        statePaths: statePaths.map((statePath) => ({
          stateRef: String(statePath["stateRef"] ?? ""),
          path: String(statePath["path"] ?? ""),
        })),
      });
      if (!derivedEffect.success) return;
      effectValue["payloadFields"] = payloadFields;
      derivedEffects.push(derivedEffect.data);
    });
  });

  const evidence = CompilerOwnedPersistenceProjectionEvidenceV1Schema.safeParse({
    schema: "setfarm.compiler-owned-persistence-projection-evidence.v1",
    derivedEffects,
  });
  if (!evidence.success) return { proposal: rawProposal, evidence: emptyEvidence() };
  return {
    proposal,
    evidence: evidence.data,
  };
}
