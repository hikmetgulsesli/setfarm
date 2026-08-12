import type postgres from "postgres";

import type { ArtifactCapacityLimits } from "./artifact-capacity.js";
import { ContentAddressedArtifactStore } from "./artifact-store.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "./artifact-store-authority.js";
import {
  resolveArtifactStorePublicationAuthorityMode,
  type ArtifactStorePublicationAuthorityMode,
} from "../runtime-config.js";

export type ArtifactInventoryStorePurposeV1 =
  | "inventory-verify"
  | "inventory-adoption";

/**
 * The only production factory for complete-root inventory capabilities.
 * Runtime point readers and publishers intentionally use different factories.
 */
export function createArtifactInventoryStoreV1(input: Readonly<{
  sql: postgres.Sql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
  purpose: ArtifactInventoryStorePurposeV1;
  publicationAuthorityMode?: ArtifactStorePublicationAuthorityMode;
}>): Readonly<{
  store: ContentAddressedArtifactStore;
  publicationAuthority: ArtifactStorePublicationAuthorityMode;
  purpose: ArtifactInventoryStorePurposeV1;
}> {
  const publicationAuthority = input.publicationAuthorityMode
    ?? resolveArtifactStorePublicationAuthorityMode();
  const capacityLeaseProvider = publicationAuthority === "hybrid-required"
    ? createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: input.sql,
        artifactRoot: input.artifactRoot,
        purpose: input.purpose,
      })
    : undefined;
  const store = new ContentAddressedArtifactStore(input.artifactRoot, {
    limits: input.artifactLimits,
    ...(capacityLeaseProvider ? { capacityLeaseProvider } : {}),
  });
  return Object.freeze({
    store,
    publicationAuthority,
    purpose: input.purpose,
  });
}
