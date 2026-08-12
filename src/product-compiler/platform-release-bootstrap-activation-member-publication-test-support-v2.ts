import {
  publishCooperativeActivationMemberInternalV2,
  type PlatformReleaseBootstrapActivationPublicationCheckpointHookV2,
  type PlatformReleaseBootstrapActivationPublicationInputV2,
  type PlatformReleaseBootstrapActivationPublicationV2,
} from
  "./platform-release-bootstrap-activation-member-publication-core-v2.js";

export async function publishCooperativeActivationMemberWithTestFaultsV2(
  input: PlatformReleaseBootstrapActivationPublicationInputV2,
  checkpoint:
    PlatformReleaseBootstrapActivationPublicationCheckpointHookV2,
): Promise<PlatformReleaseBootstrapActivationPublicationV2> {
  return publishCooperativeActivationMemberInternalV2(
    input,
    checkpoint,
  );
}

export {
  PlatformReleaseBootstrapActivationPublicationCheckpointV2,
  PlatformReleaseBootstrapActivationPublicationMemberKindV2,
} from
  "./platform-release-bootstrap-activation-member-publication-core-v2.js";
