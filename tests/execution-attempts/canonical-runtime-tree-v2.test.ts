import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  CanonicalRuntimeTreeV2Error,
  captureCanonicalRuntimeTreeV2,
  captureCanonicalRuntimeTreeV2ForTest,
  verifyCanonicalRuntimeTreeV2,
  type CanonicalRuntimeMetadataProbeV2,
  type CanonicalRuntimeTreeV2ErrorCode,
} from "../../src/execution/canonical-runtime-tree-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  CanonicalRuntimeTreeV2Schema,
  createCanonicalRuntimeTreeV2,
} from "../../src/execution/schemas/canonical-runtime-tree-v2.js";

const cleanupPaths: string[] = [];
const clearMetadata: CanonicalRuntimeMetadataProbeV2 = () => ({ status: "clear" });

type FileFixture = string | Readonly<{ content: string; executable: true }>;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function makeWritable(root: string): void {
  if (!existsSync(root)) return;
  const stat = lstatSync(root);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    chmodSync(root, 0o755);
    for (const name of readdirSync(root)) makeWritable(path.join(root, name));
  } else if (stat.isFile()) {
    chmodSync(root, 0o644);
  }
}

function normalizeTree(root: string, executablePaths: ReadonlySet<string>): void {
  function visit(directory: string): void {
    for (const name of readdirSync(directory)) {
      const absolutePath = path.join(directory, name);
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(absolutePath);
      else if (stat.isFile()) {
        const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
        chmodSync(absolutePath, executablePaths.has(relativePath) ? 0o555 : 0o444);
      }
    }
    chmodSync(directory, 0o555);
  }
  visit(root);
}

function fixture(input: Readonly<{
  directories?: readonly string[];
  files?: Readonly<Record<string, FileFixture>>;
  setup?: (root: string) => void;
}> = {}): string {
  const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), "setfarm-runtime-tree-v2-"));
  cleanupPaths.push(root);
  for (const directory of input.directories ?? []) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  const executablePaths = new Set<string>();
  for (const [relativePath, value] of Object.entries(input.files ?? {})) {
    mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    if (typeof value === "string") writeFileSync(path.join(root, relativePath), value);
    else {
      writeFileSync(path.join(root, relativePath), value.content);
      executablePaths.add(relativePath);
    }
  }
  input.setup?.(root);
  normalizeTree(root, executablePaths);
  return root;
}

function capture(root: string) {
  return captureCanonicalRuntimeTreeV2({ root, profile: "dist", metadataProbe: clearMetadata });
}

function expectCode(action: () => unknown, code: CanonicalRuntimeTreeV2ErrorCode): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(error.code, code);
    return true;
  });
}

afterEach(() => {
  for (const entry of cleanupPaths.splice(0)) {
    try { makeWritable(entry); } catch { /* best-effort cleanup */ }
    rmSync(entry, { recursive: true, force: true });
  }
});

describe("CanonicalRuntimeTreeV2 capture and reproduction authority", () => {
  it("uses exact bigint physical stat fences instead of lossy numeric inode/device values", () => {
    const source = readFileSync(
      new URL("../../src/execution/canonical-runtime-tree-v2.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /type Stats/);
    assert.match(source, /lstatSync\([^)]*,\s*\{\s*bigint:\s*true\s*\}\)/u);
    assert.match(source, /fstatSync\([^)]*,\s*\{\s*bigint:\s*true\s*\}\)/u);
    assert.match(source, /mtimeNs/);
    assert.match(source, /ctimeNs/);

    if (process.platform !== "darwin") return;

    // The Data volume root is a stable, read-only observation target on this
    // Darwin host and has an inode outside Number's safe integer range. The
    // production capture path must be able to compare such values exactly.
    const dataRoot = "/System/Volumes/Data";
    const observed = lstatSync(dataRoot, { bigint: true });
    if (!Number.isSafeInteger(Number(observed.ino))) {
      assert.notEqual(
        observed.ino.toString(10),
        BigInt(Number(observed.ino)).toString(10),
      );
    }
  });

  it("bounds directory snapshots before allocation and preserves primary-first close failures", () => {
    const source = readFileSync(
      new URL("../../src/execution/canonical-runtime-tree-v2.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /\breaddirSync\b/u);
    const snapshotSource = source.slice(
      source.indexOf("function directorySnapshot("),
      source.indexOf("function sameStringArray("),
    );
    const orderedSnapshotContracts = [
      "lstatSync(absolutePath, { bigint: true })",
      "stat.isSymbolicLink()",
      "stat.isDirectory()",
      "opendirSync(absolutePath, { bufferSize: 1 })",
      "directory.readSync()",
      "names.length >= maximumEntries",
      "names.push(entry.name)",
      "directory.closeSync()",
    ];
    let snapshotCursor = -1;
    for (const contract of orderedSnapshotContracts) {
      const next = snapshotSource.indexOf(contract, snapshotCursor + 1);
      assert.ok(next > snapshotCursor, `missing ordered directory snapshot contract: ${contract}`);
      snapshotCursor = next;
    }
    assert.match(
      source,
      /state\.limits\.maxFiles\s*\+\s*state\.limits\.maxDirectories\s*-\s*state\.initialMembershipNamesRetained,[\s\S]*"DIRECTORY_LIMIT_EXCEEDED",[\s\S]*before\.names\.length,[\s\S]*"DIRECTORY_CHANGED"/u,
    );
    assert.match(
      source,
      /new AggregateError\([\s\S]*\[primary, secondary\],[\s\S]*\{ cause: primary \}/u,
    );
    assert.match(
      source,
      /not a security boundary[\s\S]*same UID/u,
    );

    const pollutedRoot = fixture({
      files: Object.fromEntries(
        Array.from({ length: 64 }, (_, index) => [
          `entry-${index.toString().padStart(2, "0")}`,
          "x",
        ]),
      ),
    });
    const injectedDirectoryClose = new Error("injected directory close failure");
    let boundedFailure: unknown;
    try {
      captureCanonicalRuntimeTreeV2ForTest({
        root: pollutedRoot,
        profile: "dist",
        metadataProbe: clearMetadata,
        limits: { maxFiles: 1, maxDirectories: 1 },
        hooks: {
          afterDirectoryDescriptorClose: () => {
            throw injectedDirectoryClose;
          },
        },
      });
      assert.fail("polluted directory snapshot must fail");
    } catch (error) {
      boundedFailure = error;
    }
    assert.ok(boundedFailure instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(boundedFailure.code, "DIRECTORY_LIMIT_EXCEEDED");
    assert.ok(boundedFailure.cause instanceof AggregateError);
    const boundedAggregate = boundedFailure.cause;
    const boundedErrors = boundedAggregate.errors as unknown[];
    assert.equal(boundedErrors.length, 2);
    assert.ok(boundedErrors[0] instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(boundedErrors[0].code, "DIRECTORY_LIMIT_EXCEEDED");
    assert.ok(boundedErrors[1] instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(boundedErrors[1].code, "DIRECTORY_CHANGED");
    assert.equal(boundedErrors[1].cause, injectedDirectoryClose);
    assert.equal(boundedAggregate.cause, boundedErrors[0]);

    const emptyRoot = fixture();
    const closeOnly = new Error("injected directory close-only failure");
    assert.throws(
      () => captureCanonicalRuntimeTreeV2ForTest({
        root: emptyRoot,
        profile: "dist",
        metadataProbe: clearMetadata,
        hooks: {
          afterDirectoryDescriptorClose: () => {
            throw closeOnly;
          },
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalRuntimeTreeV2Error);
        assert.equal(error.code, "DIRECTORY_CHANGED");
        assert.equal(error.cause, closeOnly);
        return true;
      },
    );
  });

  it("shares one initial-membership budget across nested and pending sibling snapshots", () => {
    const root = fixture({
      directories: ["a/nested", "pending"],
      files: {
        "a/nested/overflow.txt": "overflow",
        "a/value.txt": "value",
      },
    });
    let initialReads = 0;
    let peakRetainedNames = 0;
    const initialDirectoriesRead = new Set<string>();
    let observed: unknown;
    try {
      captureCanonicalRuntimeTreeV2ForTest({
        root,
        profile: "dist",
        metadataProbe: clearMetadata,
        limits: { maxFiles: 2, maxDirectories: 2 },
        hooks: {
          afterDirectoryEntryRead: ({ phase, relativePath }) => {
            if (phase !== "initial") return;
            initialReads += 1;
            initialDirectoriesRead.add(relativePath);
          },
          afterDirectoryEntryRetained: ({
            phase,
            totalInitialMembershipNamesRetained,
          }) => {
            if (phase !== "initial") return;
            peakRetainedNames = Math.max(
              peakRetainedNames,
              totalInitialMembershipNamesRetained,
            );
          },
        },
      });
      assert.fail("recursive membership must share one global bound");
    } catch (error) {
      observed = error;
    }
    assert.ok(observed instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(observed.code, "DIRECTORY_LIMIT_EXCEEDED");
    assert.equal(initialReads, 5);
    assert.equal(peakRetainedNames, 4);
    assert.equal(initialDirectoriesRead.has("pending"), false);
  });

  it("preserves file-capture primary errors when descriptor close also fails", () => {
    const changedRoot = fixture({ files: { "value.txt": "before" } });
    const injectedFileClose = new Error("injected file close failure");
    let combinedFailure: unknown;
    try {
      captureCanonicalRuntimeTreeV2ForTest({
        root: changedRoot,
        profile: "dist",
        metadataProbe: clearMetadata,
        hooks: {
          afterFileRead: ({ absolutePath }) => {
            chmodSync(absolutePath, 0o644);
            writeFileSync(absolutePath, "after!");
            chmodSync(absolutePath, 0o444);
          },
          afterFileDescriptorClose: () => {
            throw injectedFileClose;
          },
        },
      });
      assert.fail("file mutation and close failure must fail");
    } catch (error) {
      combinedFailure = error;
    }
    assert.ok(combinedFailure instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(combinedFailure.code, "FILE_CHANGED");
    assert.equal(
      combinedFailure instanceof CanonicalRuntimeTreeV2Error
        ? "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID"
        : "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_NORMALIZATION_FAILED",
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
    );
    assert.ok(combinedFailure.cause instanceof AggregateError);
    const combinedAggregate = combinedFailure.cause;
    const combinedErrors = combinedAggregate.errors as unknown[];
    assert.equal(combinedErrors.length, 2);
    assert.ok(combinedErrors[0] instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(combinedErrors[0].code, "FILE_CHANGED");
    assert.ok(combinedErrors[1] instanceof CanonicalRuntimeTreeV2Error);
    assert.equal(combinedErrors[1].code, "IO_FAILURE");
    assert.equal(combinedErrors[1].cause, injectedFileClose);
    assert.equal(combinedAggregate.cause, combinedErrors[0]);

    const closeOnlyRoot = fixture({ files: { "value.txt": "stable" } });
    const closeOnly = new Error("injected file close-only failure");
    assert.throws(
      () => captureCanonicalRuntimeTreeV2ForTest({
        root: closeOnlyRoot,
        profile: "dist",
        metadataProbe: clearMetadata,
        hooks: {
          afterFileDescriptorClose: () => {
            throw closeOnly;
          },
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalRuntimeTreeV2Error);
        assert.equal(error.code, "IO_FAILURE");
        assert.equal(error.cause, closeOnly);
        return true;
      },
    );
  });

  it("produces the same frozen canonical artifact twice and binds empty directories", () => {
    const root = fixture({
      directories: ["empty", "nested/also-empty"],
      files: {
        "app.js": "console.log('stable')\n",
        "bin/start": { content: "#!/bin/sh\nexit 0\n", executable: true },
      },
    });

    const first = capture(root);
    const second = capture(root);
    assert.deepEqual(second, first);
    assert.notStrictEqual(second, first);
    assert.equal(first.schema, CANONICAL_RUNTIME_TREE_V2_SCHEMA);
    assert.equal(first.directoryCount, 4);
    assert.equal(first.fileCount, 2);
    assert.deepEqual(first.entries.map((entry) => entry.path), [
      "app.js",
      "bin",
      "bin/start",
      "empty",
      "nested",
      "nested/also-empty",
    ]);
    assert.equal(first.entries.find((entry) => entry.path === "app.js" && entry.type === "file")?.contentHash,
      sha256("console.log('stable')\n"));
    assert.equal(first.entries.find((entry) => entry.path === "bin/start" && entry.type === "file")?.mode, "0555");
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.entries));
    assert.ok(first.entries.every(Object.isFrozen));

    const verified = verifyCanonicalRuntimeTreeV2({
      root,
      candidate: first,
      metadataProbe: clearMetadata,
    });
    assert.deepEqual(verified, first);
    assert.notStrictEqual(verified, first);
  });

  it("rejects unknown fields and hash mutations before reproduction", () => {
    const root = fixture({ files: { "index.js": "ok" } });
    const artifact = capture(root);
    const unknown = { ...artifact, untrusted: true };
    assert.equal(CanonicalRuntimeTreeV2Schema.safeParse(unknown).success, false);
    expectCode(() => verifyCanonicalRuntimeTreeV2({
      root,
      candidate: unknown,
      metadataProbe: clearMetadata,
    }), "CONTRACT_INVALID");
    expectCode(() => verifyCanonicalRuntimeTreeV2({
      root,
      candidate: { ...artifact, treeHash: "f".repeat(64) },
      metadataProbe: clearMetadata,
    }), "CONTRACT_INVALID");
  });

  it("detects content, size, and executable-mode mutations", () => {
    const contentRoot = fixture({ files: { "value.txt": "alpha" } });
    const contentArtifact = capture(contentRoot);
    chmodSync(path.join(contentRoot, "value.txt"), 0o644);
    writeFileSync(path.join(contentRoot, "value.txt"), "omega");
    chmodSync(path.join(contentRoot, "value.txt"), 0o444);
    expectCode(() => verifyCanonicalRuntimeTreeV2({
      root: contentRoot,
      candidate: contentArtifact,
      metadataProbe: clearMetadata,
    }), "AUTHORITY_MISMATCH");

    const sizeRoot = fixture({ files: { "value.txt": "one" } });
    const sizeArtifact = capture(sizeRoot);
    chmodSync(path.join(sizeRoot, "value.txt"), 0o644);
    writeFileSync(path.join(sizeRoot, "value.txt"), "one-more");
    chmodSync(path.join(sizeRoot, "value.txt"), 0o444);
    expectCode(() => verifyCanonicalRuntimeTreeV2({
      root: sizeRoot,
      candidate: sizeArtifact,
      metadataProbe: clearMetadata,
    }), "AUTHORITY_MISMATCH");

    const modeRoot = fixture({ files: { "value.txt": "same" } });
    const modeArtifact = capture(modeRoot);
    chmodSync(path.join(modeRoot, "value.txt"), 0o555);
    expectCode(() => verifyCanonicalRuntimeTreeV2({
      root: modeRoot,
      candidate: modeArtifact,
      metadataProbe: clearMetadata,
    }), "AUTHORITY_MISMATCH");
  });

  it("rejects a self-consistently rehashed forgery against current bytes", () => {
    const root = fixture({ files: { "value.txt": "actual" } });
    const artifact = capture(root);
    const entries = artifact.entries.map((entry) => entry.type === "file"
      ? { ...entry, contentHash: sha256("forged") }
      : entry);
    const forged = createCanonicalRuntimeTreeV2({
      schema: artifact.schema,
      profile: artifact.profile,
      rootMode: artifact.rootMode,
      entries,
      fileCount: artifact.fileCount,
      directoryCount: artifact.directoryCount,
      totalBytes: artifact.totalBytes,
    });
    expectCode(() => verifyCanonicalRuntimeTreeV2({
      root,
      candidate: forged,
      metadataProbe: clearMetadata,
    }), "AUTHORITY_MISMATCH");
  });

  it("rejects noncanonical root, directory, and file modes", () => {
    const rootMode = fixture();
    chmodSync(rootMode, 0o755);
    expectCode(() => capture(rootMode), "MODE_INVALID");

    const directoryMode = fixture({ directories: ["mutable"] });
    chmodSync(path.join(directoryMode, "mutable"), 0o755);
    expectCode(() => capture(directoryMode), "MODE_INVALID");

    const fileMode = fixture({ files: { "mutable.txt": "x" } });
    chmodSync(path.join(fileMode, "mutable.txt"), 0o644);
    expectCode(() => capture(fileMode), "MODE_INVALID");
  });

  it("rejects symbolic-link leaves, directory links, roots, and parent traversal", () => {
    const leafRoot = fixture({
      files: { "target.txt": "x" },
      setup: (root) => symlinkSync("target.txt", path.join(root, "leaf.txt")),
    });
    expectCode(() => capture(leafRoot), "SYMLINK_REJECTED");

    const directoryRoot = fixture({
      directories: ["target"],
      setup: (root) => symlinkSync("target", path.join(root, "linked")),
    });
    expectCode(() => capture(directoryRoot), "SYMLINK_REJECTED");

    const actualRoot = fixture({ files: { "value.txt": "x" } });
    const linkContainer = mkdtempSync(path.join(realpathSync(os.tmpdir()), "setfarm-runtime-tree-link-"));
    cleanupPaths.push(linkContainer);
    const rootLink = path.join(linkContainer, "root-link");
    symlinkSync(actualRoot, rootLink);
    expectCode(() => capture(rootLink), "SYMLINK_REJECTED");

    const parentContainer = mkdtempSync(path.join(realpathSync(os.tmpdir()), "setfarm-runtime-tree-parent-"));
    cleanupPaths.push(parentContainer);
    symlinkSync(path.dirname(actualRoot), path.join(parentContainer, "parent-link"));
    const throughParent = path.join(parentContainer, "parent-link", path.basename(actualRoot));
    expectCode(() => capture(throughParent), "SYMLINK_REJECTED");
  });

  it("rejects hard links and FIFO special files", () => {
    const hardlinkRoot = fixture({
      files: { "first.txt": "same inode" },
      setup: (root) => linkSync(path.join(root, "first.txt"), path.join(root, "second.txt")),
    });
    expectCode(() => capture(hardlinkRoot), "HARDLINK_REJECTED");

    const fifoRoot = fixture({
      setup: (root) => execFileSync("mkfifo", [path.join(root, "pipe")]),
    });
    expectCode(() => capture(fifoRoot), "SPECIAL_FILE_REJECTED");
  });

  it("rejects Unix-domain sockets when the platform provides them", async () => {
    if (process.platform === "win32") return;
    const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), "setfarm-runtime-tree-socket-"));
    cleanupPaths.push(root);
    const socketPath = path.join(root, "runtime.sock");
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve);
    });
    chmodSync(root, 0o555);
    try {
      expectCode(() => capture(root), "SPECIAL_FILE_REJECTED");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("detects a concurrent file rewrite and directory rename through stability rescans", () => {
    const fileRoot = fixture({ files: { "value.txt": "before" } });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: fileRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      hooks: {
        afterFileRead: ({ absolutePath }) => {
          chmodSync(absolutePath, 0o644);
          writeFileSync(absolutePath, "after!");
          chmodSync(absolutePath, 0o444);
        },
      },
    }), "FILE_CHANGED");

    const directoryRoot = fixture({ files: { "before.txt": "value" } });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: directoryRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      hooks: {
        beforeDirectoryRescan: ({ absolutePath, relativePath }) => {
          if (relativePath !== ".") return;
          chmodSync(absolutePath, 0o755);
          renameSync(path.join(absolutePath, "before.txt"), path.join(absolutePath, "after.txt"));
          chmodSync(absolutePath, 0o555);
        },
      },
    }), "DIRECTORY_CHANGED");
  });

  it("fails closed at every verifier-owned count, byte, path, segment, and depth bound", () => {
    const fileCountRoot = fixture({ files: { "a": "", "b": "" } });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: fileCountRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      limits: { maxFiles: 1 },
    }), "FILE_LIMIT_EXCEEDED");

    const directoryCountRoot = fixture({ directories: ["a", "b"] });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: directoryCountRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      limits: { maxDirectories: 1 },
    }), "DIRECTORY_LIMIT_EXCEEDED");

    const fileBytesRoot = fixture({ files: { "value": "12" } });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: fileBytesRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      limits: { maxFileBytes: 1 },
    }), "FILE_TOO_LARGE");

    const totalBytesRoot = fixture({ files: { "a": "123", "b": "456" } });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: totalBytesRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      limits: { maxFileBytes: 3, maxTotalBytes: 5 },
    }), "TOTAL_BYTES_EXCEEDED");

    const pathBytesRoot = fixture({ files: { "abcdef": "x" } });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: pathBytesRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      limits: { maxPathBytes: 5 },
    }), "PATH_INVALID");

    const segmentBytesRoot = fixture({ files: { "abcdef": "x" } });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: segmentBytesRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      limits: { maxSegmentBytes: 5 },
    }), "PATH_INVALID");

    const depthRoot = fixture({ directories: ["a/b"] });
    expectCode(() => captureCanonicalRuntimeTreeV2ForTest({
      root: depthRoot,
      profile: "dist",
      metadataProbe: clearMetadata,
      limits: { maxDepth: 1 },
    }), "PATH_INVALID");
  });

  it("rejects portable-path violations and ASCII case-fold collisions in the schema", () => {
    const hash = "a".repeat(64);
    assert.throws(() => createCanonicalRuntimeTreeV2({
      schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      profile: "dist",
      rootMode: "0555",
      entries: [
        { path: "A", type: "file", mode: "0444", executable: false, byteLength: 0, contentHash: hash },
        { path: "a", type: "file", mode: "0444", executable: false, byteLength: 0, contentHash: hash },
      ],
      fileCount: 2,
      directoryCount: 0,
      totalBytes: 0,
    }), /case folding/);
    assert.throws(() => createCanonicalRuntimeTreeV2({
      schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      profile: "dist",
      rootMode: "0555",
      entries: [
        { path: "bad name", type: "file", mode: "0444", executable: false, byteLength: 0, contentHash: hash },
      ],
      fileCount: 1,
      directoryCount: 0,
      totalBytes: 0,
    }), /portable ASCII/);
  });

  it("requires a supported metadata authority and rejects observed ACLs or xattrs", () => {
    const unsupportedRoot = fixture();
    expectCode(() => captureCanonicalRuntimeTreeV2({
      root: unsupportedRoot,
      profile: "dist",
      metadataProbe: () => ({ status: "unsupported", detail: "no platform adapter" }),
    }), "METADATA_PROBE_UNSUPPORTED");

    const metadataRoot = fixture();
    expectCode(() => captureCanonicalRuntimeTreeV2({
      root: metadataRoot,
      profile: "dist",
      metadataProbe: () => ({ status: "present", metadata: ["xattr"] }),
    }), "METADATA_PRESENT");
  });
});
