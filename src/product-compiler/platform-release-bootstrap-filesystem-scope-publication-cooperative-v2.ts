import {
  ensureCooperativeBootstrapFilesystemScopeInternalV2,
  type PlatformReleaseBootstrapScopePublicationV2,
} from
  "./platform-release-bootstrap-filesystem-scope-publication-core-v2.js";

/**
 * Installs or reproduces the non-promotable cooperative process-crash fixture
 * scope. Production activation cannot consume this result: Node lacks the
 * descriptor-relative Darwin mutation and F_FULLFSYNC capabilities required
 * by the production contract.
 */
export async function ensureCooperativeBootstrapFilesystemScopeV2(
  parentPath: string,
): Promise<PlatformReleaseBootstrapScopePublicationV2> {
  return ensureCooperativeBootstrapFilesystemScopeInternalV2({
    parentPath,
  });
}

export type {
  PlatformReleaseBootstrapScopePublicationV2,
} from
  "./platform-release-bootstrap-filesystem-scope-publication-core-v2.js";
