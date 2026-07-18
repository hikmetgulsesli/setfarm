import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  InvocationInputTransportV2Schema,
  type InvocationInputTransportV2,
} from "./invocation-input-transport-v2.js";
import { Sha256Schema, hasUniqueStrings } from "./common-v1.js";

export const INVOCATION_INPUT_TRANSPORT_SET_ARTIFACT_TYPE_V2 =
  "setfarm.invocation-input-transport-set.v2" as const;
export const INVOCATION_INPUT_TRANSPORT_SET_VERSION_V2 = 2 as const;
export const INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2 =
  3 * 1024 * 1024;
export const INVOCATION_INPUT_TRANSPORT_SET_BOUNDED_WORK_LIMITS_V2 =
  Object.freeze({
    maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
    maxNodes: INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2 + 16,
    maxContainerEntries:
      DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
    maxWorkUnits:
      (INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2 * 8)
      + (1024 * 1024),
  });

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

const InvocationInputTransportSetCandidateV2Schema = z.object({
  schema: z.literal(INVOCATION_INPUT_TRANSPORT_SET_ARTIFACT_TYPE_V2),
  contractSetVersion: z.literal(INVOCATION_INPUT_TRANSPORT_SET_VERSION_V2),
  readiness: z.literal("shadow"),
  productionUse: z.literal("forbidden"),
  productSpecHash: Sha256Schema,
  deliverySelectionHash: Sha256Schema,
  contractCount: z.number().int().positive().max(2_000),
  contracts: z.array(InvocationInputTransportV2Schema).min(1).max(2_000),
  membershipHash: Sha256Schema,
  contractSetHash: Sha256Schema,
}).strict();

export type InvocationInputTransportSetV2 = z.infer<
  typeof InvocationInputTransportSetCandidateV2Schema
>;

export function hashInvocationInputTransportMembershipV2(
  contracts: readonly Readonly<{ actionRef: string; contractHash: string }>[],
): string {
  return hashCanonicalJson({
    // Frozen by the committed SemanticSourceIntentSetV1 wire contract.
    schema: "setfarm.invocation-input-transport-set-hash.v2",
    contracts: contracts.map((contract) => ({
      actionRef: contract.actionRef,
      contractHash: contract.contractHash,
    })),
  });
}

export function hashInvocationInputTransportSetV2(
  value:
    | Omit<InvocationInputTransportSetV2, "contractSetHash">
    | InvocationInputTransportSetV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.contractSetHash;
  return hashCanonicalJson({
    schema: "setfarm.invocation-input-transport-set-artifact-hash.v2",
    contractSet: payload,
  });
}

const InvocationInputTransportSetContentV2Schema =
  InvocationInputTransportSetCandidateV2Schema.superRefine((value, context) => {
    const actionRefs = value.contracts.map((contract) => contract.actionRef);
    if (
      value.contractCount !== value.contracts.length
      || !hasUniqueStrings(actionRefs)
      || actionRefs.some((actionRef, index) =>
        index > 0 && compareUtf16(actionRefs[index - 1]!, actionRef) >= 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["contracts"],
        message: "Invocation transport set must contain every contract once in canonical action order",
      });
    }
    value.contracts.forEach((contract, index) => {
      if (contract.productSpecHash !== value.productSpecHash) {
        context.addIssue({
          code: "custom",
          path: ["contracts", index, "productSpecHash"],
          message: "Invocation transport must bind the set's exact ProductSpec",
        });
      }
      if (contract.deliverySelectionHash !== value.deliverySelectionHash) {
        context.addIssue({
          code: "custom",
          path: ["contracts", index, "deliverySelectionHash"],
          message: "Invocation transport must bind the set's exact delivery selection",
        });
      }
    });
    if (
      value.membershipHash
      !== hashInvocationInputTransportMembershipV2(value.contracts)
    ) {
      context.addIssue({
        code: "custom",
        path: ["membershipHash"],
        message: "Invocation transport membership hash must bind the exact ordered action/contract membership",
      });
    }
    if (value.contractSetHash !== hashInvocationInputTransportSetV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["contractSetHash"],
        message: "Invocation transport set hash must bind the complete canonical artifact",
      });
    }
  });

const BoundedInvocationInputTransportSetV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2,
        ...INVOCATION_INPUT_TRANSPORT_SET_BOUNDED_WORK_LIMITS_V2,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: `Invocation transport set must fit ${INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2} canonical bytes and bounded work`,
      });
    }
  });

export const InvocationInputTransportSetV2Schema =
  BoundedInvocationInputTransportSetV2Schema.pipe(
    InvocationInputTransportSetContentV2Schema,
  );

export function recursivelyFreezeInvocationInputTransportSetV2<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
