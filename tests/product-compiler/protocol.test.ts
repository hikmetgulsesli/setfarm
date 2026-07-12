import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ProtocolConfigurationError,
  parseSetfarmProtocol,
} from "../../src/product-compiler/protocol.js";

describe("Setfarm product compiler protocol", () => {
  it("defaults an unset value to legacy", () => {
    assert.deepEqual(parseSetfarmProtocol(undefined), { mode: "legacy" });
  });

  it("accepts only the exact legacy and shadow modes", () => {
    assert.deepEqual(parseSetfarmProtocol("legacy"), { mode: "legacy" });
    assert.deepEqual(parseSetfarmProtocol("shadow"), { mode: "shadow" });
  });

  it("rejects unknown, case-shifted, and whitespace-only values", () => {
    for (const value of ["", " ", "LEGACY", "shadow ", "observe"]) {
      assert.throws(
        () => parseSetfarmProtocol(value),
        (error: unknown) =>
          error instanceof ProtocolConfigurationError
          && error.code === "PROTOCOL_INVALID_MODE"
          && error.value === value,
      );
    }
  });

  it("fails closed for the not-yet-authorized v3 mode", () => {
    assert.throws(
      () => parseSetfarmProtocol("v3"),
      (error: unknown) =>
        error instanceof ProtocolConfigurationError
        && error.code === "PROTOCOL_NOT_IMPLEMENTED"
        && error.value === "v3",
    );
  });
});
