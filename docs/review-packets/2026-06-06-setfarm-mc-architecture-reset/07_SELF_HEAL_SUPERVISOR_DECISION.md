# Self-Heal Supervisor Decision

## Current Idea

Kullanıcı uzun vadede Codex/supervisor'ın Setfarm veya Mission Control kodlarını otomatik inceleyip sistemsel fix ekleyebilmesini istiyor. Hedef proje özel yama değil; run'lar sırasında bulunan platform sorunlarının Setfarm/MC altyapısına kalıcı ve genel fix olarak eklenmesi.

## Why This Is Attractive

- Her proje için aynı bug'ı tekrar düzeltmek gerekmez.
- Platform kendi failure taxonomy'sini öğrenebilir.
- MC'de patch plan, diff, test, rollback görünür olabilir.
- Supervisor "şirketin platform ekibi" gibi davranabilir.

## Why This Is Dangerous

Self-heal agent platform kodunu değiştirirse reward hacking riski doğar:

- smoke test'i gevşetebilir
- guard'ı kaldırabilir
- failure classifier'ı yanlış yorumlayabilir
- MC görünürlüğünü düzeltiyorum derken blocker'ları saklayabilir
- aynı run içinde hot patch + resume module cache/state problemleri yaratabilir

## Current Components

- `config.ts`: env controls.
- `classifier.ts`: failure classification.
- `known-patterns.ts/json`: deterministic known failure signatures.
- `ownership-map.ts`: hangi failure class hangi dosyaları patch'leyebilir.
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

