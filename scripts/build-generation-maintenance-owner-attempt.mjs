import { randomUUID } from "node:crypto";
import { encodeMaintenanceJournalRecordV1, createMaintenanceOwnerClaimV1, parseMaintenanceOwnerHistoryV1 } from "./build-generation-maintenance-journal.mjs";
import { openMaintenanceOwnerJournalV1 } from "./build-generation-maintenance-journal-store.mjs";
import { observeCurrentMaintenanceOwnerV1, observeMaintenanceOwnerProcessV1 } from "./build-generation-maintenance-owner-observer.mjs";

// Internal historical preparation only. No reservation adoption, file reclaim,
// launcher action, candidate authentication or current exclusion is implied.
const identityKeys = ["uid", "pid", "processLstart", "processGroupId", "bootSessionHash"];
const fail = () => { throw Error("MAINTENANCE_OWNER_ATTEMPT_REFUSED"); };

export function prepareMaintenanceOwnerAttemptV1(directory, intent) {
  const bytes = encodeMaintenanceJournalRecordV1(intent);
  const validatedIntent = parseMaintenanceOwnerHistoryV1(bytes, []).intent;
  const store = openMaintenanceOwnerJournalV1(directory), before = store.read();
  if (before.intent !== null && !encodeMaintenanceJournalRecordV1(before.intent).equals(bytes)) fail();
  const current = observeCurrentMaintenanceOwnerV1(randomUUID());
  const previous = before.claims.at(-1);
  let claim;
  if (previous && identityKeys.every(key => previous.owner[key] === current.owner[key])) {
    claim = previous;
  } else {
    let deathHash = null;
    if (previous) {
      const death = observeMaintenanceOwnerProcessV1(previous.owner);
      if (death.state !== "definitely_dead") fail();
      deathHash = death.observationHash;
    }
    claim = createMaintenanceOwnerClaimV1(validatedIntent, current.owner, previous ?? null, deathHash);
  }
  store.publishIntent(validatedIntent);
  store.publishOwnerClaim(claim);
  if (observeMaintenanceOwnerProcessV1(claim.owner).state !== "live_match") fail();
  const after = store.read();
  if (after.claims.at(-1)?.ownerClaimHash !== claim.ownerClaimHash) fail();
  return Object.freeze({ intent: after.intent, claim: after.claims.at(-1), requiresFreshExclusion: true });
}
