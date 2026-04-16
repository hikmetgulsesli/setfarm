# Final Test Kuralları

## Pass kriterleri (STATUS: done)

- `npm run build` exit 0, error 0
- `smoke-test.mjs` 16-faz geçti (veya step-ops auto-run onayı)
- Design fidelity structural gap yok (step-ops gate'i otomatik kontrol)
- Import consistency check pass (duplicate import dir yok)
- SMOKE_TEST_RESULT alanında son satır özeti

## Retry tetikleri (STATUS: retry)

- Build fail (tsc/eslint/vite hata)
- Smoke test Phase 1-15 fail (build, lint, test, visual, a11y, etc.)
- Design fidelity Phase 16 fail (semantic element missing)
- Smoke output'ta "FAIL" string'i

## Fail kriterleri (STATUS: fail)

Sadece onarılamaz durumlar: corrupt node_modules, disk full, smoke-test.mjs script'i bulunamıyor. Normal bug → retry.

## Skip kriterleri (STATUS: skip)

- Repo salt-dokümantasyon ise
- Agent manuel skip isteğinde (feedback ile açıkla)

## TEST_FAILURES formatı

```
TEST_FAILURES:
- Phase 3 (build): tsc error at src/App.tsx:42 "Property 'notes' does not exist on type"
- Phase 8 (a11y): CounterDisplay element'inde aria-live="polite" eksik
- Phase 16 (design fidelity): SCREEN_MAP'teki "Geçmiş Boş Durumu" ekranı render edilmemiş
```

## SMOKE_TEST_RESULT

`smoke-test.mjs` çıktısının son satırı veya kısa özet. Örnek:
- `pass (16/16 phases, 0 warnings)`
- `fail: Phase 3 build — tsc 2 errors`
- `auto-derived: pass (step-ops ran smoke-test.mjs on agent's behalf)`
