# Self-Heal Supervisor Decision

## Current Idea

In the long term, the user wants Codex/the supervisor to inspect Setfarm or Mission Control code automatically and add systemic fixes. The goal is not a project-specific patch, but a durable, general fix in the Setfarm/MC platform for problems discovered during runs.

## Why This Is Attractive

- The same bug does not need to be fixed again for every project.
- The platform can learn its own failure taxonomy.
- MC can display the patch plan, diff, tests, and rollback.
- The supervisor can act like "the company's platform team."

## Why This Is Dangerous

If the self-heal agent changes platform code, it creates a reward-hacking risk:

- it can relax the smoke test
- it can remove a guard
- it can misinterpret the failure classifier
- it can hide blockers while claiming to improve MC visibility
- hot patch + resume within the same run can create module-cache/state problems

## Current Components

- `config.ts`: env controls.
- `classifier.ts`: failure classification.
- `known-patterns.ts/json`: deterministic known failure signatures.
- `ownership-map.ts`: which failure class can patch which files.
- `patch-contract.ts`: patch plan schema/validation.
- `runner.ts`: self-heal execution.
- `rollback.ts`: patch rollback.
- `patch-registry.ts`: applied patch registry.
- `strictness-delta.ts`: assertion/strictness relaxation detection.
- `write-interceptor.ts`: target file write safety.

## Safe Rollout Policy

Recommended default:

- `off`: completely disabled.
- `plan_only`: classify + patch plan + MC visibility, no file writes.
- `patch_only`: write patch in bounded files, run mandatory tests, no resume.
- `patch_and_resume`: defer until empirical safety is proven.

Initial production posture should be `plan_only`.

## Required Safety Invariants

- Self-heal cannot modify immutable platform tests.
- Self-heal cannot modify files outside ownership map.
- Write interception must happen at write time, not only post-hoc diff.
- Rollback restores pre-patch file hashes, not just git HEAD.
- Full category test suite runs, not only patch-selected tests.
- Strictness delta flags removed throws, relaxed thresholds, deleted assertions.
- MC shows classification evidence, patch plan, diff, tests, rollback handle.

## Question For Gemini/Sonnet

Should supervisor be allowed to edit Setfarm/MC?

If yes:

- Which classes are safe?
- Which files must be immutable?
- Which tests are mandatory?
- Should same-run resume ever be allowed?
- How should MC expose trust, patch lineage, rollback?

If no:

- Should it only produce patch plans?
- Should human/Codex apply patches manually after review?

## Recommended Initial Answer To Challenge

Do not enable autonomous `patch_and_resume` yet. Use self-heal as a plan-only platform diagnostician until failure classification accuracy and immutable tests are strong.
