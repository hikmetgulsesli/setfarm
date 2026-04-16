# Verify Agent Kuralları

## Önce oku

1. `PREFLIGHT_ANALYSIS` içinde ESLint/tsc hataları varsa: blocking issue. STATUS: retry + FEEDBACK: hataları listele.
2. `CURRENT_STORY.acceptanceCriteria` içindeki her maddeyi kod üzerinden doğrula — pasif kabul etme.
3. `DESIGN_DOM.json` varsa screen tasarımıyla karşılaştır (semantic element check).

## Retry tetikleri (STATUS: retry)

- Story'nin `scope_files` içinde olup worktree'de bulunmayan dosyalar
- Acceptance criteria'dan sapma (örn. "3 öncelik seviyesi" isteniyor, kodda 2 var)
- Bozuk import, bilinmeyen sembol, TypeScript compile fail
- Test dosyası eksik (proje test gerektiriyorsa) veya testler çalışmıyor
- Design token kullanım oranı düşük (inline hex/rgb/px fazla)
- Erişilebilirlik: focus ring, ARIA, keyboard nav eksikliği

## Pass (STATUS: done) için zorunlu

- Bütün acceptance criteria kanıtlanmış
- `npm run build` hatasız (preflight_errors boş)
- TypeScript strict mode'da tsc temiz
- Story branch ile main arasında sadece kendi scope_files'ında değişiklik (SCOPE_BLEED yok)

## Fail (STATUS: fail) sınırlı

Sadece onarılamaz durumlarda: corrupt worktree, PR merge conflict'i auto-rebase sonrası çözülmedi, dev server crash loop. Normal bug'lar için retry kullan — developer yeni deneme yapar.

## FEEDBACK formatı

retry/fail için 1-3 madde halinde, developer'ın doğrudan aksiyon alacağı netlikte:

```
FEEDBACK:
- src/App.tsx:42 — useEffect dependency array eksik (exhaustive-deps ESLint ihlali)
- CounterDisplay component'i tests/CounterDisplay.test.tsx olmadan submit edildi — story AC-3 test coverage istiyor
- Design token --color-primary yerine #3B82F6 hardcoded (index.css:12)
```

Uzun analiz, önyüklü metin, "iyi iş çıkardın ama..." girişleri yazma. Sadece aksiyon edilebilir kusurlar.
