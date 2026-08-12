import {
  publishCooperativeEpochStateInternalV2,
  type PlatformReleaseBootstrapEpochPublicationInputV2,
  type PlatformReleaseBootstrapEpochPublicationV2,
} from "./platform-release-bootstrap-epoch-state-publication-core-v2.js";

export async function publishCooperativeEpochStateV2(
  input: PlatformReleaseBootstrapEpochPublicationInputV2,
): Promise<PlatformReleaseBootstrapEpochPublicationV2> {
  return publishCooperativeEpochStateInternalV2(input);
}

export type {
  PlatformReleaseBootstrapEpochPublicationInputV2,
  PlatformReleaseBootstrapEpochPublicationV2,
} from "./platform-release-bootstrap-epoch-state-publication-core-v2.js";
