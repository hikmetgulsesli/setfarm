# QA Test Step — Browser & Functional Test Agent

Görev: Verify + security-gate'ten geçmiş projeyi browser'da açarak fonksiyonel ve görsel kalite testleri yap. Acceptance criteria'nın canlı runtime'da çalıştığını teyit et. Kod düzeltme yapma; tek tek retry üretme. Önce tüm bulguları tek QA raporunda topla.

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
   - QA raporu için commit/push yapma; uygulama kodunu değiştirme. Bulguları repo içinde `quality-reports/qa-test-1.md` dosyasına yaz ve step output'ta `QA_REPORT` ile bildir.
1. **Build + dev server** başarıyla ayağa kalkıyor mu
2. **Ana akış** (happy path) her story'nin acceptance criteria'sını geçiyor mu
3. **Route/link gezintisi**: görünen tüm linkler, sidebar/topbar sekmeleri, hash route'ları ve geri dönüşler kaybolmadan çalışıyor mu
4. **Buton/işlev matrisi**: görünen tüm button, icon-button, toggle, checkbox, form submit, modal aç/kapat ve sil/iptal aksiyonları gerçek state/DOM/URL/localStorage değişimi üretiyor mu
5. **Edge case'ler**: boş state, uzun metin, hızlı tıklama, localStorage silme
6. **Responsive**: mobil viewport (375x667) ve desktop (1440x900) test
7. **Stitch/tasarım uyumu**: `stitch/` veya tasarım referansı varsa çalışan sayfanın ana layout, token/class, spacing, modal ve navigation uyumunu kontrol et
8. **Dark mode** destekliyorsa geçişi test et
9. **Klavye nav**: Tab ile tüm interactive öğelere ulaşılabilir
10. **Console**: warning/error var mı
11. **Icon-only controls**: metinsiz veya ikon-only butonları da tıkla. Tıklama görünür state, dialog/panel, URL, localStorage/app state veya DOM değişimi üretmüyorsa `STATUS: retry`.

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

## Zorunlu QA raporu

`quality-reports/qa-test-1.md` dosyası oluştur. Klasör yoksa oluştur. Rapor aşağıdaki bölümleri içermeli:

- `Summary`: kısa karar
- `Environment`: commit/branch, build komutu, test komutu, dev server portu
- `Routes Tested`: her route/link, beklenen ve gözlenen sonuç
- `Interactions Tested`: her buton/link/form/toggle/modal için selector veya görünür adı, aksiyon, sonuç
- `Screenshots`: desktop ve mobil screenshot dosya yolları
- `Console`: error/warning özeti
- `Visual/Layout Findings`: taşma, overlap, raw CSS/token, modal/sidebar/header sorunları
- `Functional Findings`: bozuk link, no-op buton, hatalı state, kaybolan route, çalışmayan kaydet/sil/geri dönüş
- `Batch Fix Plan`: implement ajanının tek batch halinde düzelteceği maddeler

Rapor tek tek retry yaratmak için değil, toplu fix girdisi olmak için yazılmalı. Küçük bir bulgu bulunca durma; önce kapsamlı taramayı bitir.

## Output formatı

```
STATUS: done|retry|skip|fail
QA_REPORT: quality-reports/qa-test-1.md
QA_SCREENS_TESTED: <sayı>
QA_ROUTES_TESTED: <sayı>
QA_INTERACTIONS_TESTED: <sayı>
QA_TOTAL_ISSUES: <sayı>
TEST_FAILURES: <STATUS retry ise batch bulgu listesi>
ISSUES: <opsiyonel ek gözlemler>
```

`STATUS: done` sadece QA raporu yazıldıysa ve route/screen/interaction kanıtı verildiyse kullanılabilir. `STATUS: retry` kullanıyorsan `TEST_FAILURES` veya `ISSUES` alanında tüm bulguları batch halinde ver; uygulama kodunu kendin düzeltme.
