import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { realpathSync } from "node:fs";
import postgres from "postgres";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";

async function child(directory: string | undefined, program: string, overrides: Record<string, string> = {}): Promise<void> {
  const fixture = await freshSourceCheckoutFixture();
  const environment = { ...process.env };
  for (const key of ["SETFARM_INSTALLATION_DIR", "SETFARM_PG_URL", "DATABASE_URL", "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "SETFARM_DIR", "SETFARM_DB_PATH", "SETFARM_ENV_DIR", "SETFARM_REPO_DIR", "PROJECTS_DIR", "SCRIPTS_DIR", "CLI_PATH", "OPENCLAW_STATE_DIR", "OPENCLAW_CONFIG_PATH", "SETFARM_PLATFORM_ROOT", "SETFARM_PRODUCT_ARTIFACT_DIR", "SETFARM_CONVERGENCE_RESULT_DIR", "SETFARM_PROJECTS_ROOT", "SETFARM_WORKSPACE_PROJECTS_ROOT", "OPENCLAW_PROJECTS_ROOT"]) delete environment[key];
  for (const key of Object.keys(environment)) if (key.startsWith("SETFARM_INTERNAL_PRODUCTION_")) delete environment[key];
  if (directory !== undefined) environment.SETFARM_INSTALLATION_DIR = directory;
  else environment.SETFARM_ENV_DIR = fixture.root;
  Object.assign(environment, overrides);
  const prefix = `import assert from "node:assert/strict"; const root=${JSON.stringify(fixture.root)};`;
  const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", prefix + program], {
    cwd: fixture.root, env: environment, encoding: "utf8", timeout: 30_000, maxBuffer: 65536,
  });
  assert.equal(result.error, undefined, "selected-runtime child did not complete within its bound");
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "SELECTED_RUNTIME_CHECKED\n");
}
const load = `const db=await import(root+"/src/db-pg.ts"); assert.equal(typeof db.prepareSelectedFreshInstallationDatabaseV1,"function","selected database preparation API is missing");`;
const done = `console.log("SELECTED_RUNTIME_CHECKED");`;

test("selected fresh database uses one verified client and never restores implicit DDL after close", { timeout: 120_000 }, async t => {
  const installation = await create(t); await installation.initialize();
  await child(installation.directory, load + `
    assert.throws(()=>db.getSql(), /FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
    await assert.rejects(db.pgMigrate(), /FRESH_INSTALLATION_DEFAULT_MIGRATION_FORBIDDEN/);
    assert.throws(()=>db.pgConfigureIsolatedTestDatabase("postgresql://postgres@127.0.0.1:5432/setfarm_contract_spine_test_1_123456abcdef"),/FRESH_INSTALLATION_INCOMPATIBLE_DATABASE_PROFILE/);
    await assert.rejects(db.prepareTask6aRestrictedSpawnerDatabaseV1(${JSON.stringify(installation.ownerRole)}),/FRESH_INSTALLATION_INCOMPATIBLE_DATABASE_PROFILE/);
    await assert.rejects(db.prepareDashboardCutoverCoreReaderV2(),/FRESH_INSTALLATION_INCOMPATIBLE_DATABASE_PROFILE/);
    await Promise.all([db.prepareSelectedFreshInstallationDatabaseV1(),db.prepareSelectedFreshInstallationDatabaseV1()]);
    const first=db.getSql(); assert.equal(db.getSql(),first);
    const row=await db.pgGet("SELECT current_database() AS database, current_user AS role");
    assert.equal(row.database,${JSON.stringify(installation.databaseName)});
    assert.equal(row.role,${JSON.stringify(installation.runtimeRole)});
    const journal=await db.pgGet("SELECT count(*)::integer AS count FROM public.setfarm_schema_migrations"); assert.equal(journal.count,33);
    await assert.rejects(db.pgMigrate(), /FRESH_INSTALLATION_DEFAULT_MIGRATION_FORBIDDEN/);
    await db.pgClose();
    assert.throws(()=>db.getSql(), /FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
    await assert.rejects(db.prepareSelectedFreshInstallationDatabaseV1(), /FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
    await assert.rejects(db.pgQuery("CREATE TABLE public.must_not_exist(id integer)"), /FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
  ` + done);
  await installation.verifyRuntime();
});

test("selected configuration refuses conflicting legacy targets before acquisition", { timeout: 120_000 }, async t => {
  const installation=await create(t); await installation.initialize();
  for(const overrides of [{ SETFARM_PG_URL: freshTestAdminUrl }, { SETFARM_DIR: path.join(installation.directory,"foreign") }, { SETFARM_PRODUCT_ARTIFACT_DIR: path.join(installation.directory,"foreign") }, { OPENCLAW_STATE_DIR: path.join(installation.directory,"foreign") }, { SETFARM_PROJECTS_ROOT: path.join(installation.directory,"foreign") }, { SETFARM_WORKSPACE_PROJECTS_ROOT: path.join(installation.directory,"foreign") }, { OPENCLAW_PROJECTS_ROOT: path.join(installation.directory,"foreign") }, { SETFARM_INTERNAL_PRODUCTION_COLD_HELPER: "1" }]) {
    await child(installation.directory, `await assert.rejects(import(root+"/src/db-pg.ts"),/FRESH_INSTALLATION_SELECTION_REFUSED/);`+done, overrides);
  }
  await installation.verifyRuntime();
});

test("selected verification failure and closing during preparation remain fenced", { timeout: 120_000 }, async t => {
  const installation=await create(t); await installation.initialize();
  const u=new URL(freshTestAdminUrl);u.pathname="/"+installation.databaseName;
  const control=postgres(u.href,{max:1,onnotice(){}});
  try {
    await control.unsafe(`GRANT CREATE ON DATABASE "${installation.databaseName}" TO "${installation.runtimeRole}"`);
    try {
      await child(installation.directory, load + `
        await assert.rejects(db.prepareSelectedFreshInstallationDatabaseV1(),/FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
        assert.throws(()=>db.getSql(),/FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
        await assert.rejects(db.pgMigrate(),/FRESH_INSTALLATION_DEFAULT_MIGRATION_FORBIDDEN/);
        await db.pgClose();
        await assert.rejects(db.prepareSelectedFreshInstallationDatabaseV1(),/FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
      ` + done);
    } finally { await control.unsafe(`REVOKE CREATE ON DATABASE "${installation.databaseName}" FROM "${installation.runtimeRole}"`); }
  } finally { await control.end({timeout:3}); }
  await child(installation.directory,load+`
    const pending=assert.rejects(db.prepareSelectedFreshInstallationDatabaseV1(),/FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
    await db.pgClose(); await pending;
    assert.throws(()=>db.getSql(),/FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
    await assert.rejects(db.prepareSelectedFreshInstallationDatabaseV1(),/FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
  `+done);
  await installation.verifyRuntime();
});

test("selected paths are frozen and a later retarget cannot fall back", { timeout: 120_000 }, async t => {
  const installation=await create(t);await installation.initialize();
  await child(installation.directory,load+`
    const {runtimeConfig}=await import(root+"/src/runtime-config.ts");
    const paths=await import(root+"/src/installer/paths.ts");
    assert.equal(Object.isFrozen(runtimeConfig),true);
    assert.equal(runtimeConfig.setfarmDir,${JSON.stringify(path.join(realpathSync(installation.directory),"runtime"))});
    assert.equal(paths.resolveSetfarmRoot(),runtimeConfig.setfarmDir);
    assert.equal(paths.resolveRunRoot(),runtimeConfig.setfarmDir+"/runs");
    assert.equal(paths.resolveWorkflowRoot(),runtimeConfig.setfarmDir+"/workflows");
    assert.equal(paths.resolveWorkflowWorkspaceRoot(),runtimeConfig.setfarmDir+"/workspaces/workflows");
    const config=await import(root+"/src/runtime-config.ts");
    assert.equal(config.resolveProductArtifactDir(),runtimeConfig.setfarmDir+"/product-compiler/artifacts/sha256");
    assert.equal(config.resolveConvergenceEvalResultDir(),runtimeConfig.setfarmDir+"/evals/results");
    const fs=await import("node:fs");
    fs.mkdirSync(runtimeConfig.setfarmDir+"/logs",{recursive:true,mode:0o700});
    fs.writeFileSync(runtimeConfig.setfarmDir+"/logs/workflow.log","selected log path\\n",{mode:0o600});
    fs.writeFileSync(runtimeConfig.setfarmDir+"/events.jsonl",JSON.stringify({event:"run.started",runId:"selected-path",ts:"2026-10-18T00:00:00Z"})+"\\n",{mode:0o600});
    const logs=await import(root+"/src/lib/logger.ts"),events=await import(root+"/src/installer/events.ts");
    assert.deepEqual(await logs.readRecentLogs(),["selected log path"]);
    assert.equal(events.getRecentEvents()[0].runId,"selected-path");
    await db.prepareSelectedFreshInstallationDatabaseV1();
    const selected=process.env.SETFARM_INSTALLATION_DIR;
    process.env.SETFARM_INSTALLATION_DIR=selected+"-foreign";
    assert.throws(()=>db.getSql(),/FRESH_INSTALLATION_SELECTION_REFUSED|FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
    process.env.SETFARM_INSTALLATION_DIR=selected;
    assert.throws(()=>db.getSql(),/FRESH_INSTALLATION_SELECTION_REFUSED|FRESH_INSTALLATION_DATABASE_NOT_PREPARED/);
    await db.pgClose();
  `+done);
  await installation.verifyRuntime();
});

test("unselected fallback stays unchanged and later selection is refused before acquisition", { timeout: 30_000 }, async () => {
  await child(undefined, load + `
    const {runtimeConfig,resolveProductArtifactDir}=await import(root+"/src/runtime-config.ts");
    const os=await import("node:os"),paths=await import(root+"/src/installer/paths.ts");
    assert.equal(runtimeConfig.setfarmPgUrl,"postgresql://postgres@localhost:5432/setfarm");
    const identity=await import(root+"/src/installer/runtime-identity.ts");
    assert.equal(identity.resolveProjectsRoot(),os.homedir()+"/projects");
    assert.equal(identity.resolveProjectsRoot({SETFARM_PROJECTS_ROOT:"/explicit/projects"}),"/explicit/projects");
    assert.equal(Object.isFrozen(runtimeConfig),false);
    assert.equal(paths.resolveSetfarmRoot(),os.homedir()+"/.openclaw/setfarm");
    assert.equal(resolveProductArtifactDir(),os.homedir()+"/.openclaw/setfarm/product-compiler/artifacts/sha256");
    process.env.SETFARM_INSTALLATION_DIR="/tmp/refused-late-installation";
    assert.throws(()=>db.getSql(),/FRESH_INSTALLATION_SELECTION_REFUSED/);
    delete process.env.SETFARM_INSTALLATION_DIR;
    assert.throws(()=>db.getSql(),/FRESH_INSTALLATION_SELECTION_REFUSED/);
    await db.pgClose();
  ` + done);
});

test("selected shared-gateway getters refuse retargets before returning a path", { timeout: 120_000 }, async t => {
  const installation=await create(t);await installation.initialize();
  for (const [key,getter] of [["OPENCLAW_STATE_DIR","resolveOpenClawStateDir"],["OPENCLAW_CONFIG_PATH","resolveOpenClawConfigPath"]]) {
    await child(installation.directory, `
      const paths=await import(root+"/src/installer/paths.ts");
      assert.equal(typeof paths[${JSON.stringify(getter)}](),"string");
      process.env[${JSON.stringify(key)}]="/tmp/refused-gateway-retarget";
      assert.throws(()=>paths[${JSON.stringify(getter)}](),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      delete process.env[${JSON.stringify(key)}];
      assert.throws(()=>paths[${JSON.stringify(getter)}](),/FRESH_INSTALLATION_SELECTION_REFUSED/);
    `+done);
  }
  await installation.verifyRuntime();
});

test("selected runtime identity puts default repositories inside the private projects root", { timeout: 120_000 }, async t => {
  const installation=await create(t);await installation.initialize();
  await child(installation.directory, `
    const identity=await import(root+"/src/installer/runtime-identity.ts");
    const projects=${JSON.stringify(path.join(realpathSync(installation.directory),"runtime","projects"))};
    assert.equal(identity.resolveProjectsRoot(),projects);
    assert.equal(identity.resolveProjectsRoot({SETFARM_PROJECTS_ROOT:"/foreign/request"}),projects);
    const resolved=identity.resolveRuntimeIdentity({runId:"fresh-project-1234",projectName:"Fresh project"});
    assert.equal(resolved.repo,projects+"/"+resolved.runSlug);
  `+done);
  await installation.verifyRuntime();
});

test("selected project-root aliases cannot retarget default or explicit runtime identity", { timeout: 120_000 }, async t => {
  const installation=await create(t);await installation.initialize();
  for (const key of ["SETFARM_PROJECTS_ROOT", "SETFARM_WORKSPACE_PROJECTS_ROOT", "OPENCLAW_PROJECTS_ROOT"]) {
    await child(installation.directory, `
      const identity=await import(root+"/src/installer/runtime-identity.ts");
      const projects=${JSON.stringify(path.join(realpathSync(installation.directory),"runtime","projects"))};
      process.env[${JSON.stringify(key)}]=projects;
      assert.equal(identity.resolveProjectsRoot(),projects);
      process.env[${JSON.stringify(key)}]="/tmp/refused-project-retarget";
      assert.throws(()=>identity.resolveProjectsRoot(),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      assert.throws(()=>identity.resolveRuntimeIdentity({runId:"refused",explicitRepo:"/tmp/explicit-request"}),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      delete process.env[${JSON.stringify(key)}];
      assert.throws(()=>identity.resolveProjectsRoot(),/FRESH_INSTALLATION_SELECTION_REFUSED/);
    `+done);
  }
  await installation.verifyRuntime();
});
