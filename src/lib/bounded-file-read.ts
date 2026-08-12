import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  type Stats,
} from "node:fs";
import { TextDecoder } from "node:util";

export type BoundedFileReadErrorCode =
  | "FILE_NOT_REGULAR"
  | "FILE_TOO_LARGE"
  | "FILE_INVALID_UTF8"
  | "FILE_CHANGED_DURING_READ";

export class BoundedFileReadError extends Error {
  constructor(
    readonly code: BoundedFileReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BoundedFileReadError";
  }
}

export type BoundedUtf8FileRead = Readonly<{
  text: string;
  byteLength: number;
  stat: Stats;
}>;

export type BoundedFileRead = Readonly<{
  bytes: Buffer;
  byteLength: number;
  stat: Stats;
}>;

/**
 * Reads an agent-owned regular file without following a replaceable symlink or
 * allocating beyond the declared protocol boundary. The before/after metadata
 * comparison rejects an inode that was modified while it was being consumed.
 */
export function readRegularFileAtMostSync(
  filePath: string,
  maxBytes: number,
): BoundedFileRead {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!before.isFile()) {
      throw new BoundedFileReadError("FILE_NOT_REGULAR", `${filePath} is not a regular file`);
    }
    if (before.size > maxBytes) {
      throw new BoundedFileReadError(
        "FILE_TOO_LARGE",
        `${filePath} exceeds ${maxBytes} bytes`,
      );
    }

    const buffer = Buffer.allocUnsafe(Math.min(maxBytes + 1, before.size + 1));
    let byteLength = 0;
    while (byteLength < buffer.length) {
      const bytesRead = readSync(
        descriptor,
        buffer,
        byteLength,
        buffer.length - byteLength,
        null,
      );
      if (bytesRead === 0) break;
      byteLength += bytesRead;
    }
    if (byteLength > maxBytes) {
      throw new BoundedFileReadError(
        "FILE_TOO_LARGE",
        `${filePath} exceeds ${maxBytes} bytes`,
      );
    }

    const after = fstatSync(descriptor);
    if (
      !after.isFile()
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || after.size !== byteLength
    ) {
      throw new BoundedFileReadError(
        "FILE_CHANGED_DURING_READ",
        `${filePath} changed while it was being read`,
      );
    }

    return {
      bytes: Buffer.from(buffer.subarray(0, byteLength)),
      byteLength,
      stat: after,
    };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function readUtf8RegularFileAtMostSync(
  filePath: string,
  maxBytes: number,
): BoundedUtf8FileRead {
  const exact = readRegularFileAtMostSync(filePath, maxBytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(exact.bytes);
  } catch {
    throw new BoundedFileReadError(
      "FILE_INVALID_UTF8",
      `${filePath} is not valid UTF-8`,
    );
  }
  return {
    text,
    byteLength: exact.byteLength,
    stat: exact.stat,
  };
}
