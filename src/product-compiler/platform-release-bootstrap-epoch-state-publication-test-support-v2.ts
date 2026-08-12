import {
  publishCooperativeEpochStateInternalV2,
  type PlatformReleaseBootstrapEpochPublicationCheckpointHookV2,
  type PlatformReleaseBootstrapEpochPublicationInputV2,
  type PlatformReleaseBootstrapEpochPublicationV2,
} from "./platform-release-bootstrap-epoch-state-publication-core-v2.js";

export async function publishCooperativeEpochStateWithTestFaultsV2(
  input: PlatformReleaseBootstrapEpochPublicationInputV2,
  checkpoint: PlatformReleaseBootstrapEpochPublicationCheckpointHookV2,
): Promise<PlatformReleaseBootstrapEpochPublicationV2> {
  return publishCooperativeEpochStateInternalV2(input, checkpoint);
}

export {
  PLATFORM_RELEASE_BOOTSTRAP_EPOCH_TARGET_STAGE_BASENAME_V2,
  PlatformReleaseBootstrapEpochPublicationCheckpointV2,
} from "./platform-release-bootstrap-epoch-state-publication-core-v2.js";
