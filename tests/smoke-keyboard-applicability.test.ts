import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the entire production gate, including its browser evals and classifier.
// Only the external agent-browser/clock boundary is replaced; no gate logic is copied.
const source = fs.readFileSync(new URL("../scripts/smoke-test.mjs", import.meta.url), "utf8");
const ast = ts.createSourceFile("smoke-test.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const phase15: ts.TryStatement[] = [];
const visit = (node: ts.Node): void => {
  if (ts.isTryStatement(node) && node.catchClause?.getText(ast).includes("[INTERACT] Phase 15 error:")) {
    phase15.push(node);
  }
  ts.forEachChild(node, visit);
};
visit(ast);
assert.equal(phase15.length, 1, "locate exactly one production Phase 15 gate");
const parser = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "parseEvalJson");
assert.ok(parser, "use the production agent-browser response parser");
const gate = new vm.Script(`${parser.getText(ast)}\n(async () => { ${phase15[0].getText(ast)} })()`, {
  filename: "smoke-test-phase15.mjs",
});

type Signal = "text" | "pixels" | "state" | "url";
type Fixture = {
  text: string;
  canvas?: boolean;
  response?: Signal;
  ambient?: Signal;
};

async function runPhase15(fixture: Fixture) {
  const values = { text: 0, pixels: 0, state: 0, url: 0 };
  let keydowns = 0;
  const timers: Array<() => void> = [];
  const window = new EventTarget();
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    width: 100,
    height: 100,
    getContext: (kind: string) => {
      assert.equal(kind, "2d");
      return { getImageData: () => ({ data: [values.pixels, 0, 0, 255] }) };
    },
  });
  const score = { get textContent() { return `Score: ${values.text}`; } };
  Object.assign(document, {
    body: { get innerText() { return fixture.text; } },
    querySelector: (selector: string) => {
      if (selector === "canvas") return fixture.canvas ? canvas : null;
      assert.ok(selector.includes("[class*=score]"), `unexpected selector: ${selector}`);
      return score;
    },
  });
  Object.assign(window, { game: { get score() { return values.state; } } });
  const location = { get href() { return `http://fixture.invalid/#${values.url}`; }, hash: "" };
  class KeyboardEvent extends Event {
    readonly key: string;
    readonly code: string;
    readonly keyCode: number;
    constructor(type: string, options: { key: string; code: string; keyCode: number; bubbles: boolean }) {
      super(type, options);
      this.key = options.key;
      this.code = options.code;
      this.keyCode = options.keyCode;
    }
  }
  for (const target of [window, document, canvas]) {
    target.addEventListener("keydown", event => {
      keydowns++;
      if (fixture.response && (event as KeyboardEvent).code === "Space") values[fixture.response]++;
    });
  }
  const browser = vm.createContext({
    window, document, location, KeyboardEvent,
    setTimeout: (callback: () => void) => { timers.push(callback); },
  });
  const failures: string[] = [];
  const context = vm.createContext({
    failures,
    baseUrl: "http://fixture.invalid/",
    ab: (command: string, url: string) => {
      assert.equal(command, "open");
      assert.equal(url, "http://fixture.invalid/");
    },
    abOk: (command: string, code: string) => {
      assert.equal(command, "eval");
      return JSON.stringify(vm.runInContext(code, browser));
    },
    injectErrorCollector: () => {}, // Network/error collection is outside this gate.
    sleep: async (ms: number) => {
      assert.ok(ms === 2000 || ms === 800, `unexpected Phase 15 wait: ${ms}`);
      if (fixture.ambient) values[fixture.ambient]++;
      for (const callback of timers.splice(0)) callback();
    },
  });
  await gate.runInContext(context);
  assert.ok(!failures.some(failure => failure.includes("Phase 15 error:")), failures.join("\n"));
  return { failures, keydowns };
}

describe("Phase 15 keyboard applicability", () => {
  // Requiring a keyboard response on these pages invents a product requirement.
  for (const text of ["Click the Start button to begin. Score: 0", "Press Start to begin. Jump and duck using the buttons."]) {
    it(`does not require keyboard input for a button-only canvas: ${text}`, async () => {
      const result = await runPhase15({ text, canvas: true });
      assert.deepEqual(result.failures, []);
      assert.equal(result.keydowns, 0);
    });
  }
  it("does not infer keyboard controls from ambiguous action words without a canvas", async () => {
    const result = await runPhase15({ text: "Jump and duck. Press Start to begin." });
    assert.deepEqual(result.failures, []);
    assert.equal(result.keydowns, 0);
  });

  // Removing explicit keyboard detection must not silently turn broken controls green.
  for (const text of ["Press Space to jump", "Press Spacebar to jump", "Press Enter to begin", "Press any key to start", "Use arrow keys to move", "WASD controls", "Space to jump"]) {
    for (const canvas of [false, true]) {
      it(`rejects declared keyboard controls with no response: ${text}, canvas=${canvas}`, async () => {
        const result = await runPhase15({ text, canvas });
        assert.equal(result.failures.length, 1);
        assert.match(result.failures[0], /\[INTERACT\] interactive-no-response:/);
        assert.ok(result.keydowns > 0);
      });
    }
  }

  // Each real signal must prove input response, and each ambient-only signal must fail.
  for (const signal of ["text", "pixels", "state", "url"] as const) {
    it(`accepts keyboard response confirmed by ${signal}`, async () => {
      const result = await runPhase15({ text: "Press Space to begin", canvas: true, response: signal });
      assert.deepEqual(result.failures, []);
      assert.ok(result.keydowns > 0);
    });
    it(`rejects ambient-only ${signal} changes`, async () => {
      const result = await runPhase15({ text: "Press Space to begin", canvas: true, ambient: signal });
      assert.equal(result.failures.length, 1);
      assert.match(result.failures[0], /\[INTERACT\] interactive-ambiguous:/);
    });
    it(`accepts a non-ambient ${signal} response alongside ambient animation`, async () => {
      const ambient = signal === "pixels" ? "text" : "pixels";
      const result = await runPhase15({ text: "Press Space to begin", canvas: true, response: signal, ambient });
      assert.deepEqual(result.failures, []);
      assert.ok(result.keydowns > 0);
    });
  }
});
