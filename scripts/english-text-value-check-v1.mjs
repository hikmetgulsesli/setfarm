#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const ENGLISH_SCRIPT_TEXT_MAX_CODE_UNITS_V1 = 200_000;

const ALLOWED_ENGLISH_TYPOGRAPHY_V1 = new Set([
  0x2013,
  0x2014,
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2026,
]);

function decodeAsciiHexV1(value) {
  let decoded = "";
  for (let index = 0; index < value.length; index += 2) {
    decoded += String.fromCharCode(Number.parseInt(value.slice(index, index + 2), 16));
  }
  return decoded;
}

const UNSUPPORTED_LOCALIZED_LEXEMES_V1 = new Set([
  "67756172646172", "63616d62696f73", "6d6f7374726172", "6d656e73616a6573",
  "636f6e66696775726163696f6e", "656c696d696e6172", "7573756172696f73",
  "656469746172", "6372656172", "676f7265766c657269", "6b6179646574",
  "6b756c6c616e6963696c617269", "6c697374656c65", "676f73746572",
  "6d6573616a6c617269", "6f6c7573747572", "64757a656e6c65",
  "656e726567697374726572", "706172616d6574726573", "7375707072696d6572",
  "7574696c6973617465757273", "73706569636865726e",
  "65696e7374656c6c756e67656e", "61626272656368656e", "62656e75747a6572",
  "73616c76617265", "6d6f64696669636865", "696d706f7374617a696f6e69",
  "656c696d696e617265", "73616c766172", "616c74657261636f6573",
  "636f6e666967757261636f6573", "6578636c756972", "6f70736c61616e",
  "696e7374656c6c696e67656e", "76657277696a646572656e",
  "6765627275696b657273", "73696d70616e", "70657275626168616e",
  "70656e6761747572616e", "70656e6767756e61",
].map(decodeAsciiHexV1));

const ASCII_LEXEME_PATTERN_V1 = /[A-Z]+(?=[A-Z][a-z]|[^A-Za-z]|$)|[A-Z]?[a-z]+/g;

export function inspectEnglishScriptTextV1(value, options = {}) {
  if (typeof value !== "string") return "ENGLISH_TEXT_TYPE_INVALID";
  if (value.length > ENGLISH_SCRIPT_TEXT_MAX_CODE_UNITS_V1) {
    return "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED";
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x09 || codeUnit === 0x0a || codeUnit === 0x0d) {
      if (options.singleLine === true) return "ENGLISH_TEXT_SINGLE_LINE_REQUIRED";
      continue;
    }
    if (codeUnit >= 0x20 && codeUnit <= 0x7e) continue;
    if (ALLOWED_ENGLISH_TYPOGRAPHY_V1.has(codeUnit)) continue;
    return codeUnit < 0x20 || codeUnit === 0x7f
      ? "ENGLISH_TEXT_CONTROL_CHARACTER"
      : "ENGLISH_TEXT_NON_ENGLISH_CODE_POINT";
  }
  for (const match of value.matchAll(ASCII_LEXEME_PATTERN_V1)) {
    if (UNSUPPORTED_LOCALIZED_LEXEMES_V1.has(match[0].toLowerCase())) {
      return "ENGLISH_TEXT_UNSUPPORTED_LEXEME";
    }
  }
  return undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const singleLine = process.argv[2] === "--single-line";
  const value = process.argv[singleLine ? 3 : 2];
  const issue = inspectEnglishScriptTextV1(value, { singleLine });
  if (issue) {
    process.stderr.write(`${issue}\n`);
    process.exitCode = 64;
  }
}
