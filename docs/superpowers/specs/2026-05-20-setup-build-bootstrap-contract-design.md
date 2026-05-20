# Setup And Build Bootstrap Contract Refactor

Date: 2026-05-20

## Status

Approved design. Implementation has not started.

## Goal

Refactor Setfarm `setup-repo` and `setup-build` into deterministic, platform-aware bootstrap steps that fully match the contract-led PLAN, DESIGN, and STORIES architecture.

The setup/build phase must stop behaving like a loose script plus agent confirmation flow. It must resolve a stack contract, scaffold or verify the repository, build and verify the baseline, produce structured evidence, and hand a precise implementation contract to the implement step.

No stack behavior is deferred. Unsupported or ambiguous stack choices fail with explicit reconciliation errors instead of falling back to Vite, React, or any project-specific default.

## Scope

This refactor covers:

- `04-setup-repo`
- `05-setup-build`
- stack contract resolution and stack packs
- scaffold scripts and script wrappers
- Stitch design handoff and generated component conversion
- setup/build evidence files
- contract ledger setup checks
- implement context handoff and setup-owned file boundaries

This refactor does not implement the `06-implement` behavioral worker redesign itself. It only produces the handoff that implement must consume.

## Architecture

`PLAN`, `DESIGN`, and `STORIES` produce product and implementation intent. `SETUP-REPO` and `SETUP-BUILD` apply that intent as a deterministic Stack Bootstrap Contract.

The normal setup/build path is automated and gate-driven. Agents do not choose frameworks, commands, package names, or repository paths. Agents only intervene after a structured failure, and their fixes are limited to the setup/build scope.

The architecture has four primary responsibilities:

- Stack contract resolution from PLAN metadata, PRD text, design requirement, and repository evidence.
- Repository preparation from runtime context, not from PLAN-generated paths.
- Build preparation and verification through stack-specific commands and artifact gates.
- Implementation handoff with explicit file ownership, design authority, commands, and forbidden files.

## Module Layout

### `src/installer/setup-contract/`

- `types.ts`: shared setup contract, stack pack, evidence, and failure types.
- `resolver.ts`: resolves PLAN metadata, PRD, and repo evidence into a `SetupContract`.
- `packs.ts`: contains all supported stack pack definitions.
- `ledger.ts`: reads and writes setup evidence files under `.setfarm/setup/`.
- `validate.ts`: validates consistency before setup/build can pass.

### `src/installer/setup-orchestrator/`

- `repo-orchestrator.ts`: repo init, branch handling, GitHub remote handling, ignore rules, references, runtime identity.
- `build-orchestrator.ts`: install, build, test, smoke, artifact checks.
- `git-baseline.ts`: baseline commits and main/run branch sync.
- `process.ts`: command execution, timeout, stdout/stderr normalization.
- `evidence.ts`: structured evidence and failure generation.

### `src/installer/setup-scaffold/`

Each scaffold module implements the same interface: `detect`, `create`, `verify`, `commands`, `entrypoints`.

Required scaffold modules:

- `vite-react.ts`
- `nextjs.ts`
- `static-html.ts`
- `browser-game.ts`
- `node-express.ts`
- `python-cli.ts`
- `python-web.ts`
- `react-native-expo.ts`
- `android.ts`
- `ios.ts`
- `desktop-electron.ts`

### `src/installer/design-handoff/`

- `stitch-assets.ts`: validates `DESIGN_MANIFEST`, HTML, PNG, CSS, and `DESIGN.md`.
- `stitch-to-component.ts`: owns Stitch HTML to framework component conversion or wraps the current script during migration.
- `screen-contract.ts`: validates generated screen files against manifest and surface/screen mapping.

Non-UI stacks must bypass this module with a verified `DESIGN_REQUIRED=false` policy.

## Step Integration

`04-setup-repo/preclaim.ts` becomes a thin orchestration entrypoint:

- resolve setup contract
- run repo orchestrator
- write repo evidence
- run gates
- auto-complete when ready

`05-setup-build/preclaim.ts` becomes a thin orchestration entrypoint:

- read setup contract
- run install/build/test/smoke contract
- apply design handoff for UI stacks
- write implementation handoff
- run gates
- auto-complete when ready

`scripts/setup-repo.sh` remains only as a compatibility wrapper. Main setup logic moves to TypeScript modules. `scripts/stitch-to-jsx.mjs` is either migrated behind `design-handoff` or called only through a typed wrapper. Scripts must not choose stacks or hard-code legacy paths.

## Stack Pack Contract

Each stack pack has this shape:

```ts
{
  id,
  platform,
  techStackAliases,
  designPolicy,
  scaffoldPolicy,
  commands,
  requiredFiles,
  artifactChecks,
  implementationBoundaries,
  verificationPolicy
}
```

Supported stack packs:

- `vite-react-web-app`
- `nextjs-web-app`
- `static-html-site`
- `browser-game`
- `node-express-api`
- `python-web-api`
- `node-cli`
- `python-cli`
- `react-native-expo`
- `android-native`
- `ios-native`
- `desktop-electron`

Design policies:

- `stitch-required`: UI stack must have Stitch outputs.
- `stitch-brief-only`: stack may use design intent but not raw Stitch HTML as implementation authority.
- `optional-stitch`: stack can use Stitch when available, but product runtime is verified separately.
- `none`: no Stitch/design step is applicable.

API, CLI, Android native, and iOS native stacks must not force Stitch. Web, static, Next.js, Vite React, and Electron renderer stacks require design handoff when `DESIGN_REQUIRED=true`.

## Gates

Setup/build pass only when every applicable gate passes:

- `SETUP_CONTRACT_UNRESOLVED`: platform or tech stack cannot be resolved.
- `UNSUPPORTED_STACK`: stack is not in the supported pack list.
- `STACK_POLICY_MISMATCH`: PLAN platform/design policy conflicts with stack policy.
- `SCAFFOLD_REQUIRED_FILE_MISSING`: required scaffold file is absent.
- `BUILD_COMMAND_MISSING`: build is required but no command exists.
- `BUILD_FAILED`: build command failed with captured stdout/stderr.
- `DESIGN_HANDOFF_MISSING`: UI stack lacks required Stitch outputs.
- `GENERATED_SCREEN_MISMATCH`: manifest, screen map, and generated components disagree.
- `IMPLEMENTATION_HANDOFF_MISSING`: implement handoff was not written.
- `SETUP_OWNED_FILE_DIRTY`: setup-owned files drift before implement starts.

Success requires:

- resolved setup contract
- required files present
- build command captured
- build artifact present when required
- design handoff present for UI stacks
- generated screen handoff present when applicable
- implementation handoff written
- context keys persisted for downstream steps

## Implementation Handoff

`setup-build` writes `.setfarm/setup/IMPLEMENTATION_HANDOFF.json`.

Required fields:

```json
{
  "schema": "setfarm.implementation-handoff.v1",
  "runId": "",
  "projectName": "",
  "projectSlug": "",
  "platform": "",
  "techStack": "",
  "stackPackId": "",
  "commands": {
    "install": "",
    "dev": "",
    "build": "",
    "test": "",
    "smoke": ""
  },
  "entrypoints": [],
  "setupOwnedFiles": [],
  "sharedEditableFiles": [],
  "generatedDesignFiles": [],
  "storyOwnership": {
    "source": "stories.implementation_contract",
    "rule": "Story may edit only its scope_files plus explicitly listed sharedEditableFiles when ownership requires app integration."
  },
  "forbiddenDuringImplement": [],
  "designAuthority": {
    "required": false,
    "source": "",
    "screenMap": "",
    "rules": []
  },
  "verification": {
    "buildArtifact": "",
    "testHandlePolicy": "",
    "runtimeBridge": ""
  }
}
```

Implement receives these context keys:

- `implementation_handoff_path`
- `implementation_handoff_excerpt`
- `setup_owned_files`
- `forbidden_during_implement`
- `stack_pack_id`
- `build_cmd`
- `test_cmd`
- `design_handoff_path`

## File Ownership Rules

Setup-owned files are locked after `setup-build`.

Implement can edit setup-owned files only when:

- the story contract explicitly owns the file
- supervisor or reviewer requests a targeted fix
- build cannot pass without a framework configuration correction

Package dependency changes are not ad hoc during implement. A dependency must be declared by story contract or escalated as a setup/build contract gap.

`src/App.tsx` is shared but controlled:

- setup creates a neutral baseline
- `US-001` owns app shell and integration
- other stories prefer screen/component files and exported integration hooks
- non-owner story edits to app shell require explicit story scope

Generated Stitch screens are design source material, not final product behavior. Stitch is visual authority, PRD actions are behavioral authority.

## Failure Model

Structured failures are written to `.setfarm/setup/FAILURE.json`.

```json
{
  "phase": "setup-build",
  "code": "BUILD_FAILED",
  "stackPackId": "vite-react-web-app",
  "command": "npm run build",
  "summary": "",
  "stdout": "",
  "stderr": "",
  "recoverable": true,
  "nextAction": ""
}
```

Retry policy:

- `SETUP_CONTRACT_UNRESOLVED`: no agent retry; requires contract reconciliation.
- `SCAFFOLD_REQUIRED_FILE_MISSING`: orchestrator retries scaffold once, then fails.
- `BUILD_FAILED`: setup/build agent may fix only setup/build-owned scope.
- `DESIGN_HANDOFF_MISSING`: UI stack fails; no local fallback design.
- `GENERATED_SCREEN_MISMATCH`: fix Stitch asset or component mapping before implement.
- `IMPLEMENTATION_HANDOFF_MISSING`: setup-build fails.
- `SETUP_OWNED_FILE_DIRTY`: fail with exact drift file list.

## Testing Plan

Unit tests:

- resolver maps PRD `PLATFORM` and `TECH_STACK` to the correct pack
- unsupported stacks fail clearly
- API and CLI stacks have `designPolicy=none`
- every scaffold pack creates or verifies required files
- no hardcoded local paths in scripts or orchestrators
- build orchestrator captures stdout/stderr
- design handoff is mandatory for UI stacks
- design handoff is bypassed for API/CLI stacks
- generated screen mismatch fails
- implementation handoff includes forbidden files and generated design files

Integration tests:

- Vite React sample passes with `dist/index.html` and handoff
- Next.js sample passes with `.next` and handoff
- API sample passes without Stitch
- CLI sample passes with help/smoke command
- UI sample without design output fails
- broken build writes `FAILURE.json` with real stderr
- existing repo verification does not overwrite existing source

Regression tests:

- migrate existing `04-setup-repo.test.ts`
- migrate existing `05-setup-build.test.ts`
- contract ledger setup checks read evidence files
- implement context tests require handoff path and forbidden files

## Acceptance Criteria

- Setup/build no longer depends on broad script-side framework choice.
- Stack support is complete through explicit pack contracts.
- UI stacks cannot reach implement without design handoff.
- Non-UI stacks do not call Stitch.
- Implement receives a deterministic handoff contract.
- Setup-owned files are protected before story implementation starts.
- Failures are structured, actionable, and include command output where relevant.
- Current PLAN, DESIGN, and STORIES contracts remain source of truth for product and behavior.

## Self Review

- No placeholder fields remain in the design.
- The scope is large but bounded to setup/build, stack contract, design handoff, and implement handoff.
- The design does not defer stack support.
- The design separates product behavior from runtime/bootstrap responsibilities.
- Failure and test behavior is explicit enough for an implementation plan.
