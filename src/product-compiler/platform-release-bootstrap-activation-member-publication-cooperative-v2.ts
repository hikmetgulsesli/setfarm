import {
  publishCooperativeActivationMemberInternalV2,
  type PlatformReleaseBootstrapActivationPublicationInputV2,
  type PlatformReleaseBootstrapActivationPublicationV2,
} from
  "./platform-release-bootstrap-activation-member-publication-core-v2.js";

export async function publishCooperativeActivationMemberV2(
  input: PlatformReleaseBootstrapActivationPublicationInputV2,
): Promise<PlatformReleaseBootstrapActivationPublicationV2> {
  return publishCooperativeActivationMemberInternalV2(input);
}

export type {
  PlatformReleaseBootstrapActivationPublicationInputV2,
  PlatformReleaseBootstrapActivationPublicationV2,
} from
  "./platform-release-bootstrap-activation-member-publication-core-v2.js";
