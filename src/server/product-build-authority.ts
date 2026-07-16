import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  RuntimeArtifactReaderError,
  type SealedRuntimePacket,
} from "../product-compiler/runtime-artifact-reader.js";
import {
  ProductBuildAuthorityV1Schema,
  type ProductBuildAuthorityV1,
} from "./schemas/product-build-authority-v1.js";

type ProductBuildAuthorityReader = Readonly<{
  readSealedPacket(runId: string): Promise<SealedRuntimePacket>;
  auditTerminalPacket(runId: string): Promise<SealedRuntimePacket>;
}>;

export function produceProductBuildAuthorityV1(packet: SealedRuntimePacket): ProductBuildAuthorityV1 {
  const identity = {
    schema: "setfarm.product-build-authority.v1" as const,
    ...packet,
  };
  return ProductBuildAuthorityV1Schema.parse({
    ...identity,
    authorityHash: hashCanonicalJson(identity),
  });
}

export async function readProductBuildAuthorityV1(
  reader: ProductBuildAuthorityReader,
  runId: string,
): Promise<ProductBuildAuthorityV1> {
  try {
    return produceProductBuildAuthorityV1(await reader.readSealedPacket(runId));
  } catch (error) {
    if (
      error instanceof RuntimeArtifactReaderError
      && error.code === "RUNTIME_PACKET_NOT_ACTIVE"
    ) {
      return produceProductBuildAuthorityV1(await reader.auditTerminalPacket(runId));
    }
    throw error;
  }
}
