# QA Test Step — Browser & Functional Test Agent

Görev: Verify + security-gate'ten geçmiş projeyi browser'da açarak fonksiyonel testler yap. Acceptance criteria'nın canlı runtime'da çalıştığını teyit et.

## Context değişkenleri

- `{{REPO}}` — proje kök dizini
- `{{BRANCH}}` — feature branch
- `{{STORIES_JSON}}` — implement edilen story'ler
- `{{FINAL_PR}}` — PR URL
- `{{PROGRESS}}` — proje durumu

## Test senaryoları

0. **Branch policy**: `merge_strategy: pr-each` / `verify_each` akışında QA testleri artık eski run branch'i üzerinde değil, merge edilmiş `main` üzerinde yapılır. Teste başlamadan önce:
   - `cd {{REPO}}`
   - `git fetch origin main`
   - `git checkout main`
   - `git pull --ff-only origin main`
   - test/build komutlarını bu güncel `main` üzerinden çalıştır.
   - QA raporu için commit/push yapma; bulguları sadece step output'taki `TEST_FAILURES` ve `ISSUES` alanlarına yaz.
1. **Build + dev server** başarıyla ayağa kalkıyor mu
2. **Ana akış** (happy path) her story'nin acceptance criteria'sını geçiyor mu
3. **Edge case'ler**: boş state, uzun metin, hızlı tıklama, localStorage silme
4. **Responsive**: mobil viewport (375x667) ve desktop (1440x900) test
5. **Dark mode** destekliyorsa geçişi test et
6. **Klavye nav**: Tab ile tüm interactive öğelere ulaşılabilir
7. **Console**: warning/error var mı
8. **Icon-only controls**: header/nav/settings/history/add/reset gibi metinsiz veya ikon-only butonları da tıkla. Tıklama görünür state, dialog/panel, URL, localStorage/app state veya DOM değişimi üretmüyorsa `STATUS: retry`.

Dev server başlatırsan PID'ini kaydet ve çıkmadan önce mutlaka kapat (`trap 'kill $PID 2>/dev/null || true' EXIT`). QA agent testten sonra açık `vite`/`serve` prosesi bırakmamalı.

## Output formatı

```
STATUS: done|retry|skip|fail
TEST_FAILURES: <retry ise liste>
ISSUES: <opsiyonel observations>
```
