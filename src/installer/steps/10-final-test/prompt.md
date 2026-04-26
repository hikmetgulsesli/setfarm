# Final Test Step — End-to-End Smoke Agent

Görev: QA-test sonrası son doğrulama. `npm run build` + `scripts/smoke-test.mjs` çıktısını değerlendir, merge-ready mi karar ver. Verify + qa-test'ten farklı olarak bu aşama **merge-gate** — fail ederse sonraki deploy step'i ASLA çalışmaz.

## Context değişkenleri

- `{{REPO}}` — proje kök dizini
- `{{BRANCH}}` — feature branch (merge öncesi)
- `{{FINAL_PR}}` — final PR URL (varsa)
- `{{STORIES_JSON}}` — tüm story'ler
- `{{PROGRESS}}` — proje durumu

## Kontroller

0. **Main sync**: `merge_strategy: pr-each` / `verify_each` akışında final-test eski run branch'i merge etmez. Önce `main`'i güncelle ve sadece merge edilmiş `main` üzerinde test et:
   - `cd {{REPO}}`
   - `git fetch origin main`
   - `git checkout main`
   - `git pull --ff-only origin main`
   - Final test raporu için commit/push yapma; sonuçları sadece `SMOKE_TEST_RESULT` ve `TEST_FAILURES` alanlarına yaz.
1. **Build pass**: `npm run build` temiz, warning 0-5 arası kabul, error 0
2. **Smoke test**: platform smoke script'iyle çalıştır:
   ```bash
   SMOKE_SCRIPT="$HOME/.openclaw/setfarm-repo/scripts/smoke-test.mjs"
   [ -f scripts/smoke-test.mjs ] && SMOKE_SCRIPT="$PWD/scripts/smoke-test.mjs"
   node "$SMOKE_SCRIPT" "$PWD"
   ```
   — 16-fazlı Vibe Guard (Phase 16: Design Fidelity)
3. **Design fidelity**: structural/wiring gap varsa blocking (step-ops otomatik düşürür)
4. **Import consistency**: duplicate dir/import yoksa (step-ops otomatik kontrol eder)
5. **Main branch clean**: implement branch merge sonrası main üzerinde bozulma yok

## Output formatı

```
STATUS: done|retry|skip|fail
SMOKE_TEST_RESULT: <summary line from smoke-test.mjs, e.g. "pass (16/16 phases)" or "fail: Phase 3 build">
TEST_FAILURES: <retry/fail ise liste>
```

STATUS: done SMOKE_TEST_RESULT zorunlu. Agent script çıktısını tail'dan kopyala.
