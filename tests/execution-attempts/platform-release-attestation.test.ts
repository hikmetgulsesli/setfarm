import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  PlatformReleaseAttestationError,
  type PlatformReleaseAttestationErrorCode,
  verifyPlatformReleaseManifestV1,
} from "../../src/execution/platform-release-attestation.js";
import {
  PLATFORM_RELEASE_STITCH_CONVERTER_MAX_BYTES,
  PlatformReleaseManifestV1Schema,
} from "../../src/execution/schemas/platform-release-manifest-v1.js";

const RELEASE_SHA = "a".repeat(40);
const CONVERTER_TEXT = 'process.stdout.write("attested converter\\n");\n';

function createReleaseRoot() {
  const root = fs.mkdtempSync(path.join(tmpdir(), "setfarm-platform-release-"));
  const converterPath = path.join(root, "scripts", "stitch-to-jsx.mjs");
  const manifestPath = path.join(root, "dist", "PLATFORM_RELEASE_MANIFEST.json");
  fs.mkdirSync(path.dirname(converterPath), { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const converterBytes = Buffer.from(CONVERTER_TEXT, "utf8");
  fs.writeFileSync(converterPath, converterBytes);
  const manifest = {
    schema: "setfarm.platform-release-manifest.v1" as const,
    releaseSha: RELEASE_SHA,
    branch: "main" as const,
    dirty: false as const,
    stitchConverter: {
      converterId: "setfarm.stitch-to-jsx" as const,
      source: {
        schema: "setfarm.source-artifact-ref.v1" as const,
        hash: createHash("sha256").update(converterBytes).digest("hex"),
        mediaType: "text/javascript" as const,
        locator: "scripts/stitch-to-jsx.mjs" as const,
        byteLength: converterBytes.byteLength,
      },
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, converterPath, manifestPath, manifest };
}

function expectAttestationCode(
  action: () => unknown,
  code: PlatformReleaseAttestationErrorCode,
): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof PlatformReleaseAttestationError);
  assert.equal(caught.code, code);
}

describe("PlatformReleaseManifestV1", () => {
  it("is strict and fixes clean-main converter identity", () => {
    const fixture = createReleaseRoot();
    try {
      assert.deepEqual(PlatformReleaseManifestV1Schema.parse(fixture.manifest), fixture.manifest);
      assert.equal(
        PlatformReleaseManifestV1Schema.safeParse({ ...fixture.manifest, unknown: true }).success,
        false,
      );
      assert.equal(
        PlatformReleaseManifestV1Schema.safeParse({ ...fixture.manifest, dirty: true }).success,
        false,
      );
      assert.equal(
        PlatformReleaseManifestV1Schema.safeParse({
          ...fixture.manifest,
          stitchConverter: {
            ...fixture.manifest.stitchConverter,
            source: {
              ...fixture.manifest.stitchConverter.source,
              locator: "scripts/other.mjs",
            },
          },
        }).success,
        false,
      );
      assert.equal(
        PlatformReleaseManifestV1Schema.safeParse({
          ...fixture.manifest,
          stitchConverter: {
            ...fixture.manifest.stitchConverter,
            source: {
              ...fixture.manifest.stitchConverter.source,
              byteLength: 0,
            },
          },
        }).success,
        false,
      );
      assert.equal(
        PlatformReleaseManifestV1Schema.safeParse({
          ...fixture.manifest,
          stitchConverter: {
            ...fixture.manifest.stitchConverter,
            source: {
              ...fixture.manifest.stitchConverter.source,
              byteLength: PLATFORM_RELEASE_STITCH_CONVERTER_MAX_BYTES + 1,
            },
          },
        }).success,
        false,
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

describe("verifyPlatformReleaseManifestV1", () => {
  it("returns one immutable exact release/converter attestation", () => {
    const fixture = createReleaseRoot();
    try {
      const attestation = verifyPlatformReleaseManifestV1({
        platformRoot: fixture.root,
        expectedReleaseSha: RELEASE_SHA,
      });
      assert.deepEqual(attestation.manifest, fixture.manifest);
      assert.deepEqual(
        attestation.converterSourceRef,
        fixture.manifest.stitchConverter.source,
      );
      assert.equal(attestation.converterSource, CONVERTER_TEXT);
      assert.equal(
        createHash("sha256").update(Buffer.from(attestation.converterSource, "utf8")).digest("hex"),
        attestation.converterSourceRef.hash,
      );
      assert.equal("converterPath" in attestation, false);
      assert.equal(Object.isFrozen(attestation), true);
      assert.equal(Object.isFrozen(attestation.manifest), true);
      assert.equal(Object.isFrozen(attestation.manifest.stitchConverter), true);
      assert.equal(Object.isFrozen(attestation.converterSourceRef), true);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("anchors a symlinked root to its real directory but rejects symlinked parents", () => {
    const fixture = createReleaseRoot();
    const aliasHome = fs.mkdtempSync(path.join(tmpdir(), "setfarm-platform-alias-"));
    const rootAlias = path.join(aliasHome, "platform");
    try {
      fs.symlinkSync(fixture.root, rootAlias);
      assert.equal(
        verifyPlatformReleaseManifestV1({
          platformRoot: rootAlias,
          expectedReleaseSha: RELEASE_SHA,
        }).converterSource,
        CONVERTER_TEXT,
      );

      const realDist = path.join(aliasHome, "outside-dist");
      fs.renameSync(path.join(fixture.root, "dist"), realDist);
      fs.symlinkSync(realDist, path.join(fixture.root, "dist"));
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      );

      fs.rmSync(path.join(fixture.root, "dist"));
      fs.renameSync(realDist, path.join(fixture.root, "dist"));
      const realScripts = path.join(aliasHome, "outside-scripts");
      fs.renameSync(path.join(fixture.root, "scripts"), realScripts);
      fs.symlinkSync(realScripts, path.join(fixture.root, "scripts"));
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
      );
    } finally {
      fs.rmSync(aliasHome, { recursive: true, force: true });
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects non-directory dist or scripts parents", () => {
    const distFixture = createReleaseRoot();
    const scriptsFixture = createReleaseRoot();
    try {
      fs.rmSync(path.join(distFixture.root, "dist"), { recursive: true });
      fs.writeFileSync(path.join(distFixture.root, "dist"), "not a directory");
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: distFixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      );

      fs.rmSync(path.join(scriptsFixture.root, "scripts"), { recursive: true });
      fs.writeFileSync(path.join(scriptsFixture.root, "scripts"), "not a directory");
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: scriptsFixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
      );
    } finally {
      fs.rmSync(distFixture.root, { recursive: true, force: true });
      fs.rmSync(scriptsFixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed on a missing, malformed, strict-invalid, or symlink manifest", () => {
    const fixture = createReleaseRoot();
    try {
      fs.rmSync(fixture.manifestPath);
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      );

      fs.writeFileSync(fixture.manifestPath, "{not-json");
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      );

      fs.writeFileSync(fixture.manifestPath, JSON.stringify({ ...fixture.manifest, extra: true }));
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      );

      const target = path.join(fixture.root, "manifest-target.json");
      fs.writeFileSync(target, JSON.stringify(fixture.manifest));
      fs.rmSync(fixture.manifestPath);
      fs.symlinkSync(target, fixture.manifestPath);
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("requires the exact expected release SHA", () => {
    const fixture = createReleaseRoot();
    try {
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: "b".repeat(40),
        }),
        "PLATFORM_RELEASE_SHA_MISMATCH",
      );
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: "short",
        }),
        "PLATFORM_RELEASE_SHA_MISMATCH",
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects a missing, non-UTF-8, or symlink converter", () => {
    const fixture = createReleaseRoot();
    try {
      fs.rmSync(fixture.converterPath);
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
      );

      fs.writeFileSync(fixture.converterPath, Buffer.from([0xc3, 0x28]));
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
      );

      const target = path.join(fixture.root, "scripts", "converter-target.mjs");
      fs.writeFileSync(target, CONVERTER_TEXT);
      fs.rmSync(fixture.converterPath);
      fs.symlinkSync(target, fixture.converterPath);
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects converter hash or byte-length drift", () => {
    const fixture = createReleaseRoot();
    try {
      fs.writeFileSync(fixture.converterPath, `${CONVERTER_TEXT}// drift\n`);
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_CONVERTER_MISMATCH",
      );

      fs.writeFileSync(fixture.converterPath, CONVERTER_TEXT);
      fs.writeFileSync(fixture.manifestPath, JSON.stringify({
        ...fixture.manifest,
        stitchConverter: {
          ...fixture.manifest.stitchConverter,
          source: {
            ...fixture.manifest.stitchConverter.source,
            byteLength: fixture.manifest.stitchConverter.source.byteLength + 1,
          },
        },
      }));
      expectAttestationCode(
        () => verifyPlatformReleaseManifestV1({
          platformRoot: fixture.root,
          expectedReleaseSha: RELEASE_SHA,
        }),
        "PLATFORM_RELEASE_CONVERTER_MISMATCH",
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
