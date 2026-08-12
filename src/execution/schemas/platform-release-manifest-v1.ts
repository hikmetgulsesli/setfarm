import { z } from "zod";

import {
  GitObjectHashSchema,
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";

export const PLATFORM_RELEASE_MANIFEST_RELATIVE_PATH = "dist/PLATFORM_RELEASE_MANIFEST.json";
export const PLATFORM_RELEASE_STITCH_CONVERTER_ID = "setfarm.stitch-to-jsx";
export const PLATFORM_RELEASE_STITCH_CONVERTER_LOCATOR = "scripts/stitch-to-jsx.mjs";
export const PLATFORM_RELEASE_STITCH_CONVERTER_MAX_BYTES = 16 * 1024 * 1024;

export const PlatformReleaseConverterSourceV1Schema = z
  .object({
    schema: z.literal("setfarm.source-artifact-ref.v1"),
    hash: Sha256Schema,
    mediaType: z.literal("text/javascript"),
    locator: z.literal(PLATFORM_RELEASE_STITCH_CONVERTER_LOCATOR),
    byteLength: z.number().int().positive().max(PLATFORM_RELEASE_STITCH_CONVERTER_MAX_BYTES),
  })
  .strict();

export const PlatformReleaseManifestV1Schema = z
  .object({
    schema: z.literal("setfarm.platform-release-manifest.v1"),
    releaseSha: GitObjectHashSchema,
    branch: z.literal("main"),
    dirty: z.literal(false),
    stitchConverter: z
      .object({
        converterId: z.literal(PLATFORM_RELEASE_STITCH_CONVERTER_ID),
        source: PlatformReleaseConverterSourceV1Schema,
      })
      .strict(),
  })
  .strict();

export type PlatformReleaseConverterSourceV1 = z.infer<
  typeof PlatformReleaseConverterSourceV1Schema
>;
export type PlatformReleaseManifestV1 = z.infer<typeof PlatformReleaseManifestV1Schema>;
