import {
  captureCooperativeBootstrapNamespaceEntryInternalV2,
  type PlatformReleaseBootstrapCooperativeCaptureInputV2,
  type PlatformReleaseBootstrapCooperativeCaptureV2,
} from
  "./platform-release-bootstrap-filesystem-capture-core-v2.js";

/**
 * Process-crash fixture capability for cooperative writers.
 *
 * Node exposes path-based link/rename and leaf-only O_NOFOLLOW, so this
 * observer is deliberately not production authority against a hostile
 * ancestor or a power-loss durability boundary. The production registry
 * activator remains inert until an authenticated Darwin descriptor-relative
 * backend provides the stronger contract.
 */
export async function captureCooperativeBootstrapNamespaceEntryV2(
  input: PlatformReleaseBootstrapCooperativeCaptureInputV2,
): Promise<PlatformReleaseBootstrapCooperativeCaptureV2> {
  return captureCooperativeBootstrapNamespaceEntryInternalV2(input);
}

export type {
  PlatformReleaseBootstrapCooperativeCaptureInputV2,
  PlatformReleaseBootstrapCooperativeCaptureV2,
} from
  "./platform-release-bootstrap-filesystem-capture-core-v2.js";
