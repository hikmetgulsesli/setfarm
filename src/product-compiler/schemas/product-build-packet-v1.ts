import { z } from "zod";

import {
  CompilerIdentityV1Schema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const ProductBuildPacketV1Schema = z
  .object({
    schema: z.literal("setfarm.product-build-packet.v1"),
    packetVersion: z.literal(1),
    parentPacketHashes: z.array(Sha256Schema).max(100).refine(hasUniqueStrings, {
      message: "Parent packet hashes must be unique",
    }),
    productSpecHash: Sha256Schema,
    designGraphHash: Sha256Schema,
    buildTopologyHash: Sha256Schema,
    storyPlanHash: Sha256Schema,
    runtimeDataContractHash: Sha256Schema.optional(),
    runtimeEvidenceContractHash: Sha256Schema.optional(),
    compiler: CompilerIdentityV1Schema,
    validationIds: z.array(StableReferenceSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Packet validation IDs must be unique",
    }),
  })
  .strict();

export type ProductBuildPacketV1 = z.infer<typeof ProductBuildPacketV1Schema>;
