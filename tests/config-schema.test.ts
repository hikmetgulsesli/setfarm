import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateConfig } from "../src/installer/config-schema.js";

describe("OpenClaw workflow model validation", () => {
  it("rejects default as a scalar, primary, or fallback model", () => {
    const failures = validateConfig({
      agents: {
        list: [
          { id: "scalar", model: "default" },
          { id: "primary", model: { primary: "default", fallbacks: [] } },
          {
            id: "fallback",
            model: {
              primary: "minimax/MiniMax-M3",
              fallbacks: ["kimi/kimi-for-coding", "default"],
            },
          },
        ],
      },
    });
    assert.deepEqual(
      failures.map((failure) => failure.path),
      [
        "agents.list[scalar].model",
        "agents.list[primary].model.primary",
        "agents.list[fallback].model.fallbacks[1]",
      ],
    );
    assert.equal(failures.every((failure) => failure.severity === "error"), true);
  });

  it("accepts MiniMax M3 with one explicit Kimi fallback", () => {
    assert.deepEqual(validateConfig({
      agents: {
        list: [{
          id: "feature-dev_developer",
          model: {
            primary: "minimax/MiniMax-M3",
            fallbacks: ["kimi/kimi-for-coding"],
          },
        }],
      },
    }), []);
  });
});
