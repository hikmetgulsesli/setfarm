# QA Test Step — Browser & Functional Test Agent

Görev: Verify + security-gate'ten geçmiş projeyi browser'da açarak fonksiyonel testler yap. Acceptance criteria'nın canlı runtime'da çalıştığını teyit et.

## Context değişkenleri

- `{{REPO}}` — proje kök dizini
- `{{BRANCH}}` — feature branch
- `{{STORIES_JSON}}` — implement edilen story'ler
- `{{FINAL_PR}}` — PR URL
- `{{PROGRESS}}` — proje durumu

## Test senaryoları

1. **Build + dev server** başarıyla ayağa kalkıyor mu
2. **Ana akış** (happy path) her story'nin acceptance criteria'sını geçiyor mu
3. **Edge case'ler**: boş state, uzun metin, hızlı tıklama, localStorage silme
4. **Responsive**: mobil viewport (375x667) ve desktop (1440x900) test
5. **Dark mode** destekliyorsa geçişi test et
6. **Klavye nav**: Tab ile tüm interactive öğelere ulaşılabilir
7. **Console**: warning/error var mı

## Output formatı

```
STATUS: done|retry|skip|fail
TEST_FAILURES: <retry ise liste>
ISSUES: <opsiyonel observations>
```
