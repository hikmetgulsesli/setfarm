import {
  assertFreshInstallationSelectionUnchangedV1,
  freshInstallationSelectionV1,
} from '../installation/fresh-installation-selection-v1.js';
import { assertFreshInstallationOperationalEntryV1 } from '../installation/fresh-installation-entry-v1.js';
import { readSubscriptionCredentialRecordV1 } from './subscription-credential-record-v1.js';
import type { SubscriptionModelRefV1 } from './subscription-coding-policy-v1.js';

/** Only genuine selected operational entry can supply the parent callback. */
export async function withSelectedSubscriptionCredentialV1<T>(
  modelRef: SubscriptionModelRefV1,
  use: (credential: string) => Promise<T>,
): Promise<T> {
  let credential: string | undefined;
  try {
    assertFreshInstallationSelectionUnchangedV1();
    const selected = freshInstallationSelectionV1;
    if (!selected || typeof process.getuid !== 'function' || typeof use !== 'function') {
      throw new Error('SUBSCRIPTION_CREDENTIAL_REFUSED');
    }
    assertFreshInstallationOperationalEntryV1();
    selected.assertUnchanged();
    credential = readSubscriptionCredentialRecordV1({ installationDirectory: selected.directory,
      expectedUid: process.getuid(), modelRef });
    // The DATA reader has already closed every descriptor. Finish all selected
    // checks before the callback may acquire a broker or other owned resource.
    assertFreshInstallationSelectionUnchangedV1();
    assertFreshInstallationOperationalEntryV1();
    selected.assertUnchanged();
    return await use(credential);
  } catch {
    // Callback effects belong to its caller. A callback error does not imply
    // broker closure, and no post-callback guard may discard its returned owner.
    throw new Error('SUBSCRIPTION_CREDENTIAL_REFUSED');
  } finally {
    credential = undefined; // Drop the reference; no JavaScript string erasure claim.
  }
}
