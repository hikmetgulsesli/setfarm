import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { ActiveOwnerRowSnapshotV2 } from "./baseline-positive-worktree-active-row-snapshot-v2.js";
import type { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";

// This pair is diagnostic evidence only. Neither producer's empty output grants cutover authority.
const SCHEMA = "setfarm.internal-production-positive-worktree-host-pair.v2";

type PhysicalCatalogV2 = Awaited<ReturnType<typeof observeHeldPositiveWorktreePhysicalCatalogV2>>;
type PhysicalObserverV2 = (betweenPasses: () => Promise<void>) => Promise<PhysicalCatalogV2>;
type DatabaseObserverV2 = () => Promise<ActiveOwnerRowSnapshotV2>;

export async function observePositiveWorktreeHostPairWithPortsV2(
  observePhysical: PhysicalObserverV2,
  observeDatabase: DatabaseObserverV2,
) {
  let databaseSnapshot: ActiveOwnerRowSnapshotV2 | null = null;
  const physicalCatalog = await observePhysical(async () => {
    databaseSnapshot = await observeDatabase();
  });
  if (databaseSnapshot === null) throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID");
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, physicalCatalog,
    databaseSnapshot } as const;
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}
