import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

import {
  AdmittedPlatformReleaseSourceStageV2,
  PlatformReleaseSourceAdmissionErrorV2,
  admitPlatformReleaseSourceV2,
  admitPlatformReleaseSourceV2ForTest,
  disposePlatformReleaseSourceStageV2,
  inspectPlatformReleaseSourceAdmissionCandidateV2,
  withPlatformReleaseSourceStageForTestV2,
} from
  "../../src/execution/platform-release-source-admission-v2.js";

const GIT = "/usr/bin/git";

type RepositoryFixture = Readonly<{
  root: string;
  repository: string;
  origin: string;
  headSha: string;
  previousSha: string;
}>;

function runGit(
  repository: string,
  args: readonly string[],
): string {
  const result = spawnSync(GIT, ["-C", repository, ...args], {
    encoding: "utf8",
    env: {
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      TZ: "UTC",
      GIT_AUTHOR_DATE: "2026-07-24T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-07-24T00:00:00Z",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(
    result.status,
    0,
    `${args.join(" ")} failed: ${result.stderr}`,
  );
  return result.stdout.replace(/\n$/, "");
}

function writeRepositoryFiles(repository: string): void {
  mkdirSync(path.join(repository, "src", "nested"), {
    recursive: true,
  });
  mkdirSync(path.join(repository, "scripts"), {
    recursive: true,
  });
  writeFileSync(
    path.join(repository, "package.json"),
    `${JSON.stringify({
      name: "setfarm",
      type: "module",
      version: "9.9.9",
    })}\n`,
  );
  writeFileSync(
    path.join(repository, "package-lock.json"),
    `${JSON.stringify({
      name: "setfarm",
      lockfileVersion: 3,
      packages: {
        "": {
          name: "setfarm",
          version: "9.9.9",
        },
      },
    })}\n`,
  );
  writeFileSync(
    path.join(repository, "tsconfig.json"),
    `${JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        target: "ES2022",
      },
    })}\n`,
  );
  writeFileSync(
    path.join(repository, "src", "index.ts"),
    "export const exactSource = 1;\n",
  );
  writeFileSync(path.join(repository, "src", "empty.ts"), "");
  writeFileSync(
    path.join(repository, "src", "nested", "value.ts"),
    "export const nestedValue = 1;\n",
  );
  writeFileSync(
    path.join(repository, "scripts", "tool.sh"),
    "#!/bin/sh\nexit 0\n",
  );
  chmodSync(path.join(repository, "scripts", "tool.sh"), 0o755);
}

function createRepositoryFixture(): RepositoryFixture {
  const root = realpathSync(mkdtempSync(path.join(
    tmpdir(),
    "setfarm-source-admission-v2-test-",
  )));
  const origin = path.join(root, "origin.git");
  const repository = path.join(root, "repository");
  mkdirSync(origin);
  mkdirSync(repository);
  runGit(origin, ["init", "--bare"]);
  runGit(repository, ["init", "-b", "main"]);
  runGit(repository, ["config", "user.name", "Setfarm Test"]);
  runGit(repository, ["config", "user.email", "setfarm@example.invalid"]);
  runGit(repository, ["remote", "add", "origin", origin]);
  writeRepositoryFiles(repository);
  runGit(repository, ["add", "--all"]);
  runGit(repository, ["commit", "-m", "fixture one"]);
  const previousSha = runGit(repository, ["rev-parse", "HEAD"]);
  writeFileSync(
    path.join(repository, "src", "nested", "value.ts"),
    "export const nestedValue = 2;\n",
  );
  runGit(repository, ["add", "--all"]);
  runGit(repository, ["commit", "-m", "fixture two"]);
  runGit(repository, ["push", "-u", "origin", "main"]);
  return Object.freeze({
    root,
    repository: realpathSync(repository),
    origin: realpathSync(origin),
    headSha: runGit(repository, ["rev-parse", "HEAD"]),
    previousSha,
  });
}

function removeFixture(fixture: RepositoryFixture): void {
  const makeWritable = (absolute: string): void => {
    if (!existsSync(absolute)) return;
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      chmodSync(absolute, 0o700);
      for (const name of readdirSync(absolute)) {
        makeWritable(path.join(absolute, name));
      }
    } else {
      chmodSync(absolute, 0o600);
    }
  };
  makeWritable(fixture.root);
  rmSync(fixture.root, { recursive: true, force: true });
}

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof PlatformReleaseSourceAdmissionErrorV2
      ? error.code
      : undefined;
  }
}

function snapshotStage(root: string): readonly string[] {
  const entries: string[] = [];
  const visit = (absolute: string, relative: string): void => {
    for (const name of readdirSync(absolute).sort()) {
      const child = path.join(absolute, name);
      const childRelative = relative
        ? `${relative}/${name}`
        : name;
      const stat = lstatSync(child);
      if (stat.isDirectory()) {
        entries.push(
          `${childRelative}|directory|${(stat.mode & 0o7777)
            .toString(8)
            .padStart(4, "0")}`,
        );
        visit(child, childRelative);
      } else {
        const bytes = readFileSync(child);
        entries.push(
          `${childRelative}|file|${(stat.mode & 0o7777)
            .toString(8)
            .padStart(4, "0")}|${bytes.byteLength}|${createHash("sha256")
            .update(bytes)
            .digest("hex")}`,
        );
      }
    }
  };
  visit(root, "");
  return Object.freeze(entries);
}

describe("Platform release source admission V2", () => {
  it("exports one clean remote-main Git tree without checkout-byte authority", () => {
    const fixture = createRepositoryFixture();
    let handle:
      | AdmittedPlatformReleaseSourceStageV2
      | undefined;
    let disclosedStage = "";
    try {
      runGit(fixture.repository, ["config", "core.fileMode", "false"]);
      chmodSync(
        path.join(fixture.repository, "scripts", "tool.sh"),
        0o644,
      );
      assert.equal(
        runGit(fixture.repository, [
          "status",
          "--porcelain=v2",
          "--untracked-files=all",
        ]),
        "",
      );

      handle = admitPlatformReleaseSourceV2ForTest({
        repositoryRoot: fixture.repository,
      });
      const inspected =
        inspectPlatformReleaseSourceAdmissionCandidateV2(handle);
      assert.equal(inspected.admissionScope, "test_fixture");
      assert.equal(inspected.receipt, null);
      assert.equal(
        inspected.testEvidence?.admittedSource.sha,
        fixture.headSha,
      );
      assert.equal(
        inspected.testEvidence?.productionUse,
        "forbidden",
      );
      assert.equal(
        JSON.stringify(inspected).includes(fixture.root),
        false,
      );
      assert.equal(
        inspected.testEvidence?.exportedSource.source
          .exportedFileCount,
        7,
      );
      assert.equal(
        inspected.testEvidence?.exportedSource.source
          .exportedDirectoryCount,
        3,
      );

      const stageSnapshot =
        withPlatformReleaseSourceStageForTestV2(
          handle,
          (stageRoot) => {
            disclosedStage = stageRoot;
            assert.equal(
              (lstatSync(stageRoot).mode & 0o7777),
              0o555,
            );
            assert.equal(
              (lstatSync(path.join(
                stageRoot,
                "scripts",
                "tool.sh",
              )).mode & 0o7777),
              0o555,
            );
            assert.equal(
              readFileSync(
                path.join(stageRoot, "src", "nested", "value.ts"),
                "utf8",
              ),
              "export const nestedValue = 2;\n",
            );
            return snapshotStage(stageRoot);
          },
        );
      assert.equal(stageSnapshot.length, 10);
      assert.equal(existsSync(disclosedStage), true);
      disposePlatformReleaseSourceStageV2(handle);
      assert.equal(existsSync(disclosedStage), false);
      assert.equal(
        errorCode(() =>
          inspectPlatformReleaseSourceAdmissionCandidateV2(handle!)),
        "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      );
      handle = undefined;
    } finally {
      if (handle) disposePlatformReleaseSourceStageV2(handle);
      removeFixture(fixture);
    }
  });

  it("reproduces identical content evidence in independent physical stages", () => {
    const fixture = createRepositoryFixture();
    const handles: AdmittedPlatformReleaseSourceStageV2[] = [];
    try {
      handles.push(
        admitPlatformReleaseSourceV2ForTest({
          repositoryRoot: fixture.repository,
        }),
        admitPlatformReleaseSourceV2ForTest({
          repositoryRoot: fixture.repository,
        }),
      );
      const [first, second] = handles.map((handle) =>
        inspectPlatformReleaseSourceAdmissionCandidateV2(handle));
      assert.deepEqual(
        first.testEvidence?.exportedSource.source,
        second.testEvidence?.exportedSource.source,
      );
      assert.deepEqual(
        first.testEvidence?.admittedSource,
        second.testEvidence?.admittedSource,
      );
      assert.notEqual(
        first.testEvidence?.exportedSource.stageAfter.identityHash,
        second.testEvidence?.exportedSource.stageAfter.identityHash,
      );
      const snapshots = handles.map((handle) =>
        withPlatformReleaseSourceStageForTestV2(
          handle,
          snapshotStage,
        ));
      assert.deepEqual(snapshots[0], snapshots[1]);
    } finally {
      for (const handle of handles) {
        disposePlatformReleaseSourceStageV2(handle);
      }
      removeFixture(fixture);
    }
  });

  it("produces the exact source fingerprint consumed by the build command", () => {
    const fixture = createRepositoryFixture();
    let handle:
      | AdmittedPlatformReleaseSourceStageV2
      | undefined;
    try {
      const requiredFiles = new Map([
        [
          "src/server/index.html",
          "<!doctype html><title>Setfarm fixture</title>\n",
        ],
        [
          "src/installer/compat-rules.json",
          "{\"rules\":[]}\n",
        ],
        [
          "src/installer/prompts/fixture.md",
          "# Fixture prompt\n",
        ],
        [
          "src/installer/steps/fixture.md",
          "# Fixture step\n",
        ],
        [
          "scripts/stitch-to-jsx.mjs",
          "export const convert = () => null;\n",
        ],
      ]);
      for (const [locator, bytes] of requiredFiles) {
        const absolute = path.join(fixture.repository, locator);
        mkdirSync(path.dirname(absolute), { recursive: true });
        writeFileSync(absolute, bytes);
      }
      runGit(fixture.repository, ["add", "--all"]);
      runGit(
        fixture.repository,
        ["commit", "-m", "add build assets"],
      );
      runGit(fixture.repository, ["push", "origin", "main"]);

      const compiler = path.join(fixture.root, "fixture-compiler.mjs");
      writeFileSync(
        compiler,
        [
          "import { mkdirSync, writeFileSync } from \"node:fs\";",
          "import path from \"node:path\";",
          "const args = process.argv.slice(2);",
          "const outIndex = args.indexOf(\"--outDir\");",
          "if (outIndex < 0) process.exit(2);",
          "const out = args[outIndex + 1];",
          "mkdirSync(path.join(out, \"cli\"), { recursive: true });",
          "writeFileSync(path.join(out, \"cli\", \"cli.js\"), \"#!/usr/bin/env node\\n\");",
          "",
        ].join("\n"),
      );
      chmodSync(compiler, 0o444);
      const output = path.join(fixture.root, "build-output");
      mkdirSync(output, { mode: 0o700 });

      handle = admitPlatformReleaseSourceV2ForTest({
        repositoryRoot: fixture.repository,
      });
      const evidence =
        inspectPlatformReleaseSourceAdmissionCandidateV2(handle)
          .testEvidence!;
      const buildResult = withPlatformReleaseSourceStageForTestV2(
        handle,
        (sourceRoot) => {
          const result = spawnSync(process.execPath, [
            realpathSync(path.resolve(
              "scripts/build-platform-release-v2.mjs",
            )),
            "--source-root",
            sourceRoot,
            "--output-root",
            realpathSync(output),
            "--typescript-entry",
            realpathSync(compiler),
            "--source-sha",
            evidence.admittedSource.sha,
            "--source-date-epoch",
            evidence.admittedSource.commitEpochSeconds,
          ], {
            encoding: "utf8",
            env: {},
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
          });
          assert.equal(result.status, 0, result.stderr);
          assert.equal(result.stderr, "");
          return JSON.parse(result.stdout);
        },
      );
      assert.deepEqual(
        {
          hash: buildResult.sourceFingerprintHash,
          files: buildResult.sourceFileCount,
          directories: buildResult.sourceDirectoryCount,
          bytes: buildResult.sourceTotalBytes,
        },
        {
          hash:
            evidence.exportedSource.source.exportedFileTreeHash,
          files:
            evidence.exportedSource.source.exportedFileCount,
          directories:
            evidence.exportedSource.source.exportedDirectoryCount,
          bytes:
            evidence.exportedSource.source.exportedTotalBytes,
        },
      );
    } finally {
      if (handle) disposePlatformReleaseSourceStageV2(handle);
      removeFixture(fixture);
    }
  });

  it("rejects dirty source and a remote ref that moves after the first fence", () => {
    const dirty = createRepositoryFixture();
    try {
      writeFileSync(
        path.join(dirty.repository, "untracked.txt"),
        "untracked\n",
      );
      assert.equal(
        errorCode(() => admitPlatformReleaseSourceV2ForTest({
          repositoryRoot: dirty.repository,
        })),
        "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      );
    } finally {
      removeFixture(dirty);
    }

    const moved = createRepositoryFixture();
    try {
      assert.equal(
        errorCode(() => admitPlatformReleaseSourceV2ForTest({
          repositoryRoot: moved.repository,
          afterInitialFenceForTest: () => {
            runGit(moved.repository, [
              "update-ref",
              "refs/remotes/origin/main",
              moved.previousSha,
            ]);
          },
        })),
        "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      );
    } finally {
      removeFixture(moved);
    }
  });

  it("rejects post-capture stage mutation and committed symbolic links", () => {
    const changedStage = createRepositoryFixture();
    try {
      assert.equal(
        errorCode(() => admitPlatformReleaseSourceV2ForTest({
          repositoryRoot: changedStage.repository,
          afterFirstStageCaptureForTest: (stageRoot) => {
            const target = path.join(stageRoot, "src", "index.ts");
            chmodSync(target, 0o600);
            writeFileSync(target, "export const changed = true;\n");
            chmodSync(target, 0o444);
          },
        })),
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
      );
    } finally {
      removeFixture(changedStage);
    }

    const linked = createRepositoryFixture();
    try {
      symlinkSync(
        "src/index.ts",
        path.join(linked.repository, "linked-source.ts"),
      );
      runGit(linked.repository, ["add", "--all"]);
      runGit(linked.repository, ["commit", "-m", "add source link"]);
      runGit(linked.repository, ["push", "origin", "main"]);
      assert.equal(
        errorCode(() => admitPlatformReleaseSourceV2ForTest({
          repositoryRoot: linked.repository,
        })),
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
      );
    } finally {
      removeFixture(linked);
    }
  });

  it("rejects a Git transport that adds bytes outside the requested object set", () => {
    const fixture = createRepositoryFixture();
    const wrapper = path.join(fixture.root, "corrupt-git");
    try {
      writeFileSync(
        wrapper,
        [
          "#!/bin/sh",
          "case \" $* \" in",
          "  *\" cat-file --batch \"*)",
          "    /usr/bin/git \"$@\"",
          "    status=$?",
          "    if [ \"$status\" -eq 0 ]; then printf x; fi",
          "    exit \"$status\"",
          "    ;;",
          "  *) exec /usr/bin/git \"$@\" ;;",
          "esac",
          "",
        ].join("\n"),
      );
      chmodSync(wrapper, 0o555);
      assert.equal(
        errorCode(() => admitPlatformReleaseSourceV2ForTest({
          repositoryRoot: fixture.repository,
          gitExecutable: wrapper,
        })),
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      );
    } finally {
      removeFixture(fixture);
    }
  });

  it("keeps production authority closed and rejects forged or hostile handles", () => {
    const fixture = createRepositoryFixture();
    let trapCount = 0;
    const hostile = new Proxy({}, {
      ownKeys() {
        trapCount += 1;
        throw new Error("hostile ownKeys trap");
      },
    });
    try {
      assert.equal(
        errorCode(() =>
          admitPlatformReleaseSourceV2ForTest(hostile as never)),
        "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      );
      assert.equal(trapCount, 0);
      assert.equal(
        errorCode(() => admitPlatformReleaseSourceV2({
          repositoryRoot: fixture.repository,
          implementation: {},
          gitTool: {},
        })),
        "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      );
      const forged = Object.create(
        AdmittedPlatformReleaseSourceStageV2.prototype,
      );
      assert.equal(
        errorCode(() =>
          inspectPlatformReleaseSourceAdmissionCandidateV2(forged)),
        "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
      );
      assert.throws(
        () => new AdmittedPlatformReleaseSourceStageV2(
          {},
          {} as never,
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseSourceAdmissionErrorV2
          && error.code
            === "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
      );
    } finally {
      removeFixture(fixture);
    }
  });
});
