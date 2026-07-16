import { z } from "zod";

import {
  CompilerIdentityV1Schema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const ProductBuildPacketV3Schema = z
  .object({
    schema: z.literal("setfarm.product-build-packet.v3"),
    packetVersion: z.literal(3),
    parentPacketHashes: z.array(Sha256Schema).max(100).refine(hasUniqueStrings, {
      message: "Parent packet hashes must be unique",
    }),
    designSourceKind: z.enum(["none", "stitch"]),
    productSpecV2Hash: Sha256Schema,
    designGraphV2Hash: Sha256Schema.nullable(),
    buildTopologyV1Hash: Sha256Schema,
    storyPlanV2Hash: Sha256Schema,
    runtimeDataContractHash: Sha256Schema.optional(),
    runtimeEvidenceContractHash: Sha256Schema.optional(),
    designSourceClosureV2Hash: Sha256Schema,
    compiler: CompilerIdentityV1Schema,
    validationIds: z.array(StableReferenceSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Packet validation IDs must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    const graphRequired = value.designSourceKind === "stitch";
    if (graphRequired !== (value.designGraphV2Hash !== null)) {
      context.addIssue({
        code: "custom",
        path: ["designGraphV2Hash"],
        message: "DesignInteractionGraphV2 must be present exactly when the design source is Stitch",
      });
    }

    const hasRuntimeData = value.runtimeDataContractHash !== undefined;
    const hasRuntimeEvidence = value.runtimeEvidenceContractHash !== undefined;
    if (hasRuntimeData !== hasRuntimeEvidence) {
      context.addIssue({
        code: "custom",
        path: [hasRuntimeData ? "runtimeEvidenceContractHash" : "runtimeDataContractHash"],
        message: "Runtime data and evidence contract hashes must be present together",
      });
    }
  });

export type ProductBuildPacketV3 = z.infer<typeof ProductBuildPacketV3Schema>;
