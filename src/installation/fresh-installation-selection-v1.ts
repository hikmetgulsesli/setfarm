import path from "node:path";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { readFreshInstallationPreparedStateV1 } from "./fresh-installation-records-v1.js";

// A locator snapshot is configuration data. Only actual owned-client verification
// may prepare database access; this module never grants service or claim readiness.
const selectedLocator = process.env.SETFARM_INSTALLATION_DIR;
let refused = false;
function fail(): never { refused = true; throw new Error("FRESH_INSTALLATION_SELECTION_REFUSED"); }

function capture() {
  if (selectedLocator === undefined) return null;
  try {
    if (!selectedLocator || selectedLocator !== selectedLocator.trim() || !path.isAbsolute(selectedLocator)
      || selectedLocator.includes("\0") || path.normalize(selectedLocator) !== selectedLocator) fail();
    const state = readFreshInstallationPreparedStateV1(selectedLocator, true);
    const directory = realpathSync(selectedLocator);
    const repository = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
    const root = path.join(directory, "runtime");
    const paths = Object.freeze({ root, projects: path.join(root, "projects"), repository,
      scripts: path.join(repository, "scripts"), cli: path.join(repository, "dist", "cli"),
      databaseMarker: path.join(root, "setfarm.db"), artifacts: path.join(root, "product-compiler", "artifacts", "sha256"),
      evals: path.join(root, "evals", "results"), openclaw: path.join(homedir(), ".openclaw") });
    const endpoint = new URL(state.runtimeUrl);
    const expected: Readonly<Record<string, string>> = Object.freeze({
      SETFARM_PG_URL: state.runtimeUrl, DATABASE_URL: state.runtimeUrl,
      SETFARM_DIR: root, SETFARM_ENV_DIR: root, SETFARM_DB_PATH: paths.databaseMarker,
      PROJECTS_DIR: paths.projects, SETFARM_REPO_DIR: repository, SCRIPTS_DIR: paths.scripts, CLI_PATH: paths.cli,
      SETFARM_PROJECTS_ROOT: paths.projects, SETFARM_WORKSPACE_PROJECTS_ROOT: paths.projects, OPENCLAW_PROJECTS_ROOT: paths.projects,
      PGHOST: endpoint.hostname === "[::1]" ? "::1" : endpoint.hostname,
      PGPORT: endpoint.port || "5432", PGUSER: endpoint.username, PGPASSWORD: endpoint.password,
      PGDATABASE: state.origin.databaseName,
      SETFARM_PLATFORM_ROOT: repository, SETFARM_PRODUCT_ARTIFACT_DIR: paths.artifacts, SETFARM_CONVERGENCE_RESULT_DIR: paths.evals,
      OPENCLAW_STATE_DIR: paths.openclaw, OPENCLAW_CONFIG_PATH: path.join(paths.openclaw, "openclaw.json"),
    });
    function assertUnchanged(): void {
      if (refused || process.env.SETFARM_INSTALLATION_DIR !== selectedLocator) fail();
      if (Object.keys(process.env).some(key => key.startsWith("SETFARM_INTERNAL_PRODUCTION_"))) fail();
      for (const [key, value] of Object.entries(expected)) {
        const actual = process.env[key];
        if (actual !== undefined && actual !== value) fail();
      }
      try { state.assertUnchanged(); } catch { fail(); }
    }
    assertUnchanged();
    return Object.freeze({ directory, paths, state, assertUnchanged });
  } catch { return fail(); }
}

/** Internal credential-bearing configuration; never serialize or publish it. */
export const freshInstallationSelectionV1 = capture();

/** Absence is captured too: late selection cannot retarget an ordinary process. */
export function assertFreshInstallationSelectionUnchangedV1(): void {
  if (refused || process.env.SETFARM_INSTALLATION_DIR !== selectedLocator) fail();
  freshInstallationSelectionV1?.assertUnchanged();
}

export function selectedFreshInstallationRootV1(): string | null {
  assertFreshInstallationSelectionUnchangedV1();
  return freshInstallationSelectionV1?.paths.root ?? null;
}
