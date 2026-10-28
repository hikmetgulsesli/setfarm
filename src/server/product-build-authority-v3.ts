import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  RuntimeArtifactReaderError,
  type ExactSealedRuntimePacket,
  type SealedRuntimePacketV3,
} from "../product-compiler/runtime-artifact-reader.js";
import {
  produceProductBuildAuthorityV1,
  readVerifiedDesignCandidateRefusal,
  type VerifiedDesignCandidateRefusalReadOptions,
} from "./product-build-authority.js";
import type { ProductBuildRefusalV2 } from "./schemas/product-build-authority-v2.js";
import {
  ProductBuildAuthorityV3Schema,
  ProductBuildPacketAuthorityV3Schema,
  type ProductBuildAuthorityV3,
} from "./schemas/product-build-authority-v3.js";

export type ExactProductBuildAuthorityReader = Readonly<{
  readExactSealedPacket(runId: string): Promise<ExactSealedRuntimePacket>;
  auditExactTerminalPacket(runId: string): Promise<ExactSealedRuntimePacket>;
}>;

function isNativePacket(packet: ExactSealedRuntimePacket): packet is SealedRuntimePacketV3 {
  return packet.packet.schema === "setfarm.product-build-packet.v3";
}

export function produceSealedProductBuildAuthorityV3(packet: ExactSealedRuntimePacket): ProductBuildAuthorityV3 {
  let packetAuthority;
  if (isNativePacket(packet)) {
    const identity = { schema: "setfarm.product-build-packet-authority.v3" as const, ...packet };
    packetAuthority = ProductBuildPacketAuthorityV3Schema.parse({ ...identity, authorityHash: hashCanonicalJson(identity) });
  } else {
    packetAuthority = produceProductBuildAuthorityV1(packet);
  }
  const identity = { schema: "setfarm.product-build-authority.v3" as const, runId: packet.runId, disposition: "sealed_packet" as const, packetAuthority, refusal: null };
  return ProductBuildAuthorityV3Schema.parse({ ...identity, authorityHash: hashCanonicalJson(identity) });
}

export function produceRefusedProductBuildAuthorityV3(runId: string, refusal: ProductBuildRefusalV2): ProductBuildAuthorityV3 {
  const identity = { schema: "setfarm.product-build-authority.v3" as const, runId, disposition: "refused_before_packet" as const, packetAuthority: null, refusal };
  return ProductBuildAuthorityV3Schema.parse({ ...identity, authorityHash: hashCanonicalJson(identity) });
}

async function readOwnedExactPacket(reader: ExactProductBuildAuthorityReader, runId: string): Promise<ExactSealedRuntimePacket> {
  try { return await reader.readExactSealedPacket(runId); }
  catch (error) {
    if (error instanceof RuntimeArtifactReaderError && error.code === "RUNTIME_PACKET_NOT_ACTIVE") return reader.auditExactTerminalPacket(runId);
    throw error;
  }
}

export async function readProductBuildAuthorityV3(reader: ExactProductBuildAuthorityReader, runId: string, options: VerifiedDesignCandidateRefusalReadOptions): Promise<ProductBuildAuthorityV3> {
  try { return produceSealedProductBuildAuthorityV3(await readOwnedExactPacket(reader, runId)); }
  catch (error) {
    if (!(error instanceof RuntimeArtifactReaderError) || error.code !== "RUNTIME_PACKET_NOT_SEALED") throw error;
    const refusal = await readVerifiedDesignCandidateRefusal(runId, options);
    if (!refusal) throw error;
    return produceRefusedProductBuildAuthorityV3(runId, refusal);
  }
}
