import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import {
  BoundedFileReadError,
  readUtf8RegularFileAtMostSync,
} from "../../src/lib/bounded-file-read.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-bounded-file-read-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("bounded agent-owned file reads", () => {
  it("reads an exact-boundary regular file from one descriptor", () => {
    const filePath = path.join(temporaryDirectory(), "proposal.json");
    fs.writeFileSync(filePath, "x".repeat(128));

    const result = readUtf8RegularFileAtMostSync(filePath, 128);

    assert.equal(result.byteLength, 128);
    assert.equal(result.text, "x".repeat(128));
    assert.equal(result.stat.size, 128);
  });

  it("rejects raw bytes beyond the boundary, including whitespace", () => {
    const filePath = path.join(temporaryDirectory(), "proposal.json");
    fs.writeFileSync(filePath, `${" ".repeat(128)}{}`);

    assert.throws(
      () => readUtf8RegularFileAtMostSync(filePath, 128),
      (error: unknown) => error instanceof BoundedFileReadError
        && error.code === "FILE_TOO_LARGE",
    );
  });

  it("does not follow a replaceable symbolic link", () => {
    const directory = temporaryDirectory();
    const targetPath = path.join(directory, "target.json");
    const linkPath = path.join(directory, "proposal.json");
    fs.writeFileSync(targetPath, "{}");
    fs.symlinkSync(targetPath, linkPath);

    assert.throws(() => readUtf8RegularFileAtMostSync(linkPath, 128));
  });

  it("rejects malformed UTF-8 instead of hashing repaired text", () => {
    const filePath = path.join(temporaryDirectory(), "proposal.json");
    fs.writeFileSync(filePath, Buffer.from([
      0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d,
    ]));

    assert.throws(
      () => readUtf8RegularFileAtMostSync(filePath, 128),
      (error: unknown) => error instanceof BoundedFileReadError
        && error.code === "FILE_INVALID_UTF8",
    );
  });

  it("rejects a FIFO without blocking on an absent writer", {
    skip: process.platform === "win32",
  }, () => {
    const fifoPath = path.join(temporaryDirectory(), "proposal.fifo");
    execFileSync("mkfifo", [fifoPath]);
    const moduleUrl = pathToFileURL(path.resolve("src/lib/bounded-file-read.ts")).href;
    const program = [
      `import { readUtf8RegularFileAtMostSync } from ${JSON.stringify(moduleUrl)};`,
      `try { readUtf8RegularFileAtMostSync(${JSON.stringify(fifoPath)}, 128); process.exit(2); }`,
      `catch (error) { process.exit(error?.code === "FILE_NOT_REGULAR" ? 0 : 3); }`,
    ].join("\n");

    const child = spawnSync(process.execPath, [
      "--import", "tsx", "--input-type=module", "--eval", program,
    ], {
      cwd: path.resolve("."),
      encoding: "utf8",
      timeout: 2_000,
    });

    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.signal, null, `FIFO reader timed out: ${child.stderr}`);
    assert.equal(child.status, 0, child.stderr);
  });
});
