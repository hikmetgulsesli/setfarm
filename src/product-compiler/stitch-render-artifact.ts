import fs from "node:fs";

export const MIN_STITCH_HTML_BYTES = 1_000;

/** Platform-wide validity contract for a downloaded Stitch HTML source. */
export function isValidStitchHtmlBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < MIN_STITCH_HTML_BYTES) return false;
  const head = Buffer.from(bytes).toString("utf8").slice(0, 4_000).toLowerCase();
  if (!head.includes("<html") && !head.includes("<!doctype")) return false;
  if (head.includes("empty html") || head.includes("design not generated")) return false;
  return true;
}

export function isValidStitchHtmlFile(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    return isValidStitchHtmlBytes(fs.readFileSync(filePath));
  } catch {
    return false;
  }
}

export function isValidStitchScreenshotBytes(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 45 || !signature.every((value, index) => bytes[index] === value)) return false;
  const readU32 = (offset: number) => (
    ((bytes[offset]! << 24) >>> 0)
    + (bytes[offset + 1]! << 16)
    + (bytes[offset + 2]! << 8)
    + bytes[offset + 3]!
  ) >>> 0;
  const crc32 = (start: number, end: number) => {
    let crc = 0xffffffff;
    for (let index = start; index < end; index += 1) {
      crc ^= bytes[index]!;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  let offset = 8;
  let chunkCount = 0;
  let sawHeader = false;
  let sawImageData = false;
  while (offset + 12 <= bytes.byteLength && chunkCount < 10_000) {
    const length = readU32(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > bytes.byteLength) return false;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/.test(type) || readU32(dataEnd) !== crc32(offset + 4, dataEnd)) return false;
    if (chunkCount === 0) {
      if (type !== "IHDR" || length !== 13 || readU32(dataStart) === 0 || readU32(dataStart + 4) === 0) return false;
      sawHeader = true;
    } else if (type === "IHDR") {
      return false;
    }
    if (type === "IDAT" && length > 0) sawImageData = true;
    if (type === "IEND") return length === 0 && sawHeader && sawImageData && chunkEnd === bytes.byteLength;
    offset = chunkEnd;
    chunkCount += 1;
  }
  return false;
}
