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
8. **Icon-only controls**: metinsiz veya ikon-only butonları da tıkla. Tıklama görünür state, dialog/panel, URL, localStorage/app state veya DOM değişimi üretmüyorsa `STATUS: retry`.

## Zorunlu dev-server lifecycle

Dev server'i kontrolsuz `npm run dev & ...` seklinde baslatma. Asagidaki kalibi kullan; `trap` ayni shell icinde tanimlanmali, her komut `;` veya yeni satirla ayrilmali, en sonda server kapanmali:

```bash
cd {{REPO}}
git fetch origin main
git checkout main
git pull --ff-only origin main
npm run build
PORT=5173
LOG=/tmp/setfarm-qa-devserver-{{BRANCH}}.log
( npm run dev -- --host 127.0.0.1 --port "$PORT" >"$LOG" 2>&1 ) &
DEV_PID=$!
trap 'kill "$DEV_PID" 2>/dev/null || true; wait "$DEV_PID" 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break
  sleep 1
done
curl -sf "http://127.0.0.1:$PORT/" >/dev/null || { echo "SERVER_FAIL"; tail -80 "$LOG"; exit 1; }
# Browser/DOM checks here. Finish within 10 minutes.
```

Yasak: `sleep` sonrasi satir ayirmadan `curl ... echo ...` yazmak; bu shell'i bozar ve QA step'i sessizce asili birakir. QA agent testten sonra acik `vite`/`serve` prosesi birakmamali.

## Output formatı

```
STATUS: done|retry|skip|fail
TEST_FAILURES: <retry ise liste>
ISSUES: <opsiyonel observations>
```
