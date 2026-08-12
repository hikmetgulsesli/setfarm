import {
  captureCooperativeBootstrapNamespaceEntryInternalV2,
  type PlatformReleaseBootstrapCaptureCheckpointHookV2,
  type PlatformReleaseBootstrapCooperativeCaptureInputV2,
  type PlatformReleaseBootstrapCooperativeCaptureV2,
} from
  "./platform-release-bootstrap-filesystem-capture-core-v2.js";

export async function captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2(
  input: PlatformReleaseBootstrapCooperativeCaptureInputV2,
  hook: PlatformReleaseBootstrapCaptureCheckpointHookV2,
): Promise<PlatformReleaseBootstrapCooperativeCaptureV2> {
  return captureCooperativeBootstrapNamespaceEntryInternalV2(
    input,
    hook,
  );
}

export {
  PlatformReleaseBootstrapCaptureCheckpointV2,
} from
  "./platform-release-bootstrap-filesystem-capture-core-v2.js";

export type {
  PlatformReleaseBootstrapCaptureCheckpointHookV2,
  PlatformReleaseBootstrapCooperativeCaptureInputV2,
  PlatformReleaseBootstrapCooperativeCaptureV2,
} from
  "./platform-release-bootstrap-filesystem-capture-core-v2.js";
