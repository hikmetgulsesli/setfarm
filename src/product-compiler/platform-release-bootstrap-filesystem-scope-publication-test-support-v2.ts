import {
  ensureCooperativeBootstrapFilesystemScopeInternalV2,
  type PlatformReleaseBootstrapScopePublicationCheckpointHookV2,
  type PlatformReleaseBootstrapScopePublicationV2,
} from
  "./platform-release-bootstrap-filesystem-scope-publication-core-v2.js";

export async function ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2(
  input: Readonly<{
    parentPath: string;
    nonceHex: string;
    checkpoint?:
      PlatformReleaseBootstrapScopePublicationCheckpointHookV2;
  }>,
): Promise<PlatformReleaseBootstrapScopePublicationV2> {
  if (!/^[a-f0-9]{64}$/.test(input.nonceHex)) {
    throw new TypeError(
      "Test filesystem scope nonce must be 256-bit lowercase hex",
    );
  }
  return ensureCooperativeBootstrapFilesystemScopeInternalV2({
    parentPath: input.parentPath,
    nonceBytes: () => Buffer.from(input.nonceHex, "hex"),
    checkpoint: input.checkpoint,
  });
}

export {
  PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_BASENAME_V2,
  PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_STAGE_BASENAME_V2,
  PlatformReleaseBootstrapScopePublicationCheckpointV2,
} from
  "./platform-release-bootstrap-filesystem-scope-publication-core-v2.js";

export type {
  PlatformReleaseBootstrapScopePublicationCheckpointHookV2,
  PlatformReleaseBootstrapScopePublicationV2,
} from
  "./platform-release-bootstrap-filesystem-scope-publication-core-v2.js";
