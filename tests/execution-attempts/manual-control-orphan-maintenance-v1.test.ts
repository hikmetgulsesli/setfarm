import { test } from "node:test";
import {
  runManualOrphanCompiledCliNegativeV1,
  runManualOrphanSourceContextNegativeV1,
} from "./helpers/manual-control-orphan-bootstrap-fixture-v1.js";

// No module-time production imports, database setup or environment selection.
// These are source-context/component negatives, never genuine or I5
// positive evidence. Missing production files are only contract-load RED; Root
// must observe each assertion's causal failure after implementing the import lane.

test("component harness calibration observes M-origin reads/imports without granting bootstrap credit", () => {
  runManualOrphanSourceContextNegativeV1({ mode: "calibration" });
});

test("bootstrap public import exports only the observer and performs no observable target IO", () => {
  runManualOrphanSourceContextNegativeV1({ mode: "api", apiArguments: "import-only" });
});

test("source bootstrap refuses before target reads, SQL, subprocesses or writes", () => {
  runManualOrphanSourceContextNegativeV1({ mode: "api", apiArguments: "none" });
});

test("bootstrap rejects caller authority without touching hostile arguments and sanitizes each error", () => {
  runManualOrphanSourceContextNegativeV1({ mode: "api", apiArguments: "hostile" });
});

test("bootstrap refuses explicitly supplied undefined in an unadmitted source context", () => {
  runManualOrphanSourceContextNegativeV1({ mode: "api", apiArguments: "undefined" });
});

for (const args of [[], ["retire"], ["observe"], ["--help"], ["observe-bootstrap", "--json"],
  ["observe-bootstrap", "--installation", "fdd9fe74-ccee-4673-a727-64fe57f68ad0"],
  ["observe-bootstrap", "--root", "/private-caller-root"], ["observe-bootstrap", "extra"]]) {
  test(`source CLI refuses ${JSON.stringify(args)} with only the public context code`, () => {
    runManualOrphanSourceContextNegativeV1({ mode: "cli", args });
  });
}

test("even the exact observe-bootstrap verb cannot qualify a source/tsx launch", () => {
  runManualOrphanSourceContextNegativeV1({ mode: "cli", args: ["observe-bootstrap"] });
});

// A compiled Source copy with a test preload is intentionally unadmitted. No
// genuine-launch, per-selector or M/T positive evidence follows from these.
for (const args of [[], ["retire"], ["observe"], ["--help"],
  ["observe-bootstrap", "--json"], ["observe-bootstrap", "extra"], ["observe-bootstrap"]]) {
  test(`compiled CLI component refuses ${JSON.stringify(args)} before imports outside the three copied modules and Node builtins`, async () => {
    await runManualOrphanCompiledCliNegativeV1(args);
  });
}

// These do not isolate each environment gate: source/tsx already refuses. They
// ensure ambient input cannot turn that context into an admitted launch or leak
// caller secrets. Causal compiled launch/environment tests need Root's admitted
// original-launch fixture and must be added separately.
for (const environment of [
  { NODE_OPTIONS: "" },
  { NODE_PATH: "/private-caller-modules" },
  { SETFARM_INSTALLATION_DIR: "/private-caller-installation" },
  { SETFARM_REPO_DIR: "/private-caller-repository" },
  { DATABASE_URL: "postgresql://private:secret@127.0.0.1:1/private" },
  { OPENCLAW_CONFIG_PATH: "/private-caller-config" },
  { SETFARM_PG_URL: "postgresql://private:secret@127.0.0.1:1/private" },
  { SETFARM_TEST_PG_ADMIN_URL: "postgresql://private:secret@127.0.0.1:1/private" },
  { PGHOST: "private-caller-host", PGOPTIONS: "-c private=value" },
  { GIT_DIR: "/private-caller-git", GIT_WORK_TREE: "/private-caller-tree" },
  { SETFARM_INTERNAL_PRODUCTION_CALLER: "private-value" },
] as const) {
  test(`source bootstrap cannot be admitted by ambient ${Object.keys(environment).join(",")}`, () => {
    runManualOrphanSourceContextNegativeV1({ mode: "api", environment });
  });
}
