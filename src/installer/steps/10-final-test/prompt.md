# Final Test Step — End-to-End Smoke Agent

Görev: QA-test sonrası son doğrulama. `npm run build` + `scripts/smoke-test.mjs` çıktısını değerlendir, merge-ready mi karar ver. Verify + qa-test'ten farklı olarak bu aşama **merge-gate** — fail ederse sonraki deploy step'i ASLA çalışmaz.

## Context değişkenleri

- `{{REPO}}` — proje kök dizini
- `{{BRANCH}}` — feature branch (merge öncesi)
- `{{FINAL_PR}}` — final PR URL (varsa)
- `{{STORIES_JSON}}` — tüm story'ler
- `{{PROGRESS}}` — proje durumu

## Kontroller

1. **Build pass**: `npm run build` temiz, warning 0-5 arası kabul, error 0
2. **Smoke test**: `node scripts/smoke-test.mjs <repo>` — 16-fazlı Vibe Guard (Phase 16: Design Fidelity)
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
