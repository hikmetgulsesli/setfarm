## 2026-04-16 — syncActiveCrons pool cap (CPU/lane spam fix)

### Kritik Bug Fix
- **Kök sorun:** `syncActiveCrons` havuzdaki tüm agent'lar için cron oluşturuyordu. 1 run aktifken designer pool `[prism, helix, zeta]` → 3 polling cron, 2'si daima NO_WORK. Gateway nested lane 180s+ bekleme, %63 CPU.
- **Fix:** `stepsPerRole` hesaplanıyor, `desired` map `min(pool_size, demand)` ile sınırlı. 1 run → 1 cron, 6 run → pool kapasitesi kadar. Havuz hâlâ concurrency tavanı, talep ise taban.
- Commit: `58a4f91`

### Doğrulama
- Idle state: sadece medic cron (✓)
- 1 test run → designer cron sayısı = 1 (eski davranışta 3 olurdu)
- 3 run paralel → designer cron = min(3, pool=3) = 3

---

# Changelog

Büyük değişiklikler ve session notları. Git commit'leri için `git log`.

---

## 2026-04-15 — Modüler Step Mimarisi (Sprint #1)

Step-ops.ts monolitinden (3880 satır) modüler yapıya geçiş. 5 modül yeşil ışık, 6 bekliyor.

### 5 Modül Tamamlandı (`src/installer/steps/`)

| # | Modül | preClaim | Agent görevi | Unit test |
|---|---|---|---|---|
| 01 | `01-plan/` | — | PRD yazımı (enrich rules, 2000+ char, 10 bölüm) | 8/8 |
| 02 | `02-design/` | **Stitch API + SCREEN_MAP auto-gen + manifest fallback** | DESIGN_SYSTEM JSON | 7/7 |
| 03 | `03-stories/` | — | STORIES_JSON (PRD+SCREEN_MAP+PREDICTED_SCREEN_FILES inject) | 4/4 |
| 04 | `04-setup-repo/` | **setup-repo.sh + DB + design contracts + EXISTING_CODE hint** | STATUS + EXISTING_CODE | — |
| 05 | `05-setup-build/` | **npm install + compat + build + tailwind + stitch-to-jsx + BUILD_CMD hint** | STATUS + BUILD_CMD | — |

Her modül `{ id, type, agentRole, preClaim?, injectContext, buildPrompt, validateOutput, onComplete?, requiredOutputFields, maxPromptSize }` kontratı.

### step-ops.ts Sadeleşmesi

- Plan guardrail (1800-1840 PRD length + SCREEN_COUNT + REPO auto-fix) → 01-plan
- Plan reminder (1041) → 01-plan/context
- Stories guardrail (2638-2786 massive — 0-stories, scope_files, overlap, hallucinated path, multi-owner) → 03-stories
- Stories predicted_screen_files (868) → 03-stories
- Design pre-claim Stitch (897-1003, 108 satır) → 02-design/preclaim
- Design post-complete processDesignCompletion call → 02-design/guards
- Setup-repo branch ensure + DB + contracts (2034-2066) → 04-setup-repo/preclaim
- Setup-build baseline + stitch-to-jsx + compat (2084-2174) → 05-setup-build/preclaim
- Auto-derive EXISTING_CODE (1793) + BUILD_CMD (1814) → modül preClaim'lerine
- REPO DEDUP (1776-1825, 50 satır) → 01-plan/normalize (stitch de WIPE ediliyor artık — cross-task contamination fix)

**Net ~900+ satır silindi**, 5 modüle dağıtıldı.

### Agent AGENTS.md Sadeleştirmesi

- `planner/AGENTS.md` 410 → 28 satır (plan+stories rules module rules.md'ye)
- `designer/AGENTS.md` 356 → 26 satır (Phase 1-6 module rules.md'ye)
- `shared/setup/AGENTS.md` 162 → 10 satır (step-specific rules module'e)

Agent'a giden prompt modülün buildPrompt'undan override ediliyor (workflow.yml input_template yerine). Prompt budget per-step: 6-32 KB.

### Kök Sebep Fix'leri (R1 storm azaltma)

- **Medic `recreate_crons`** 5dk cooldown (finding-based path cooldown eksikti, 20+ event/saat)
- `constants.ts` SLOW_ABANDONED_THRESHOLD_MS halving bug — aslında ölü kod (gerçek threshold: `checks.ts:290 STEP_STUCK_THRESHOLD_MS` per-step map)
- **Per-step threshold widening** (design 10→25dk — REAL R1 fix): Stitch preClaim 8-12dk alıyor, eski 10dk eşik hep abandon
- `preClaim` sonrası `started_at` + `updated_at` refresh — medic agent timer'ı preClaim süresini saymasın
- REPO DEDUP'ta `git clean -fdx` — stitch dahil sil, cross-task contamination fix
- `$HOME`/`~/` expansion in plan module normalize — agent literal verirse fix
- Plan rules re-enrich (500 → 2000 MIN, 10 zorunlu bölüm) — distill ederken detail kaybı düzeltildi
- Stories module `buildPrompt` PRD+SCREEN_MAP+PREDICTED_SCREEN_FILES resolve — önceden static rules idi, 0 story üretiyordu
- Design SCREEN_MAP preClaim auto-gen + manifest→HTML fallback (download-all manifest yazamazsa HTML <title>'dan türetir)
- Plan/stories threshold 6→10dk (minimax yavaş yanıtlara tolerance)

### Unit Test Altyapısı

`tests/steps/harness.ts` — mock ClaimContext + agent output runner + assertion helpers (`runModule`, `validPlanOutput`). Her modül kendi test dosyası.

`scripts/copy-step-assets.mjs` — build sırasında modül rules.md + prompt.md + README.md dosyalarını dist'e kopyalar.

`package.json`: `test:steps` script eklendi (`node --import tsx --test tests/steps/*.test.ts`).

**Toplam 19/19 unit test** yeşil.

### Blokaj — Agent Boğulma

Config inceleme: tüm agent'ların primary override'ı `minimax/MiniMax-M2.7` (config top-level'da `kimi-coding/k2p5` default olsa da). Minimax yavaş (15-40s yanıt, aralıklı 529) + agent tool-calling overhead → plan 5-10dk, design 20+dk boğulma. Canlı test'lerde yaygın R1.

Kimi K2.6 preview (2026-04-13) daha güçlü + daha ucuz, config değişikliği ile agent hızlanabilir. `minimax/` vs `minimax-coding/` duplicate temizlik de mümkün.

### Kalan 6 Modül (Sonraki Sprint)

- `06-implement` (LOOP type, worktree-ops 617 + merge-queue-ops 360 + story-ops 210 + developer AGENTS.md 869)
- `07-verify`, `08-security-gate`, `09-qa-test`, `10-final-test`, `11-deploy`

### 20+ Commit (main branch)

`ef1278d → 81abf37 → bb7815f → 33d6923 → 2625cfe → aa35735 → 682e8f3 → 5862d90 → be616db → da87d5d → eb3e085 → a5f51c8 → 59d96ee → 72b0890 → d47c276 → bba32fe → 9758324 → 03cb528 → 643d8e6 → ea4afd6 → 4c67ce3 → c366ca2`

### Memory Feedback Kural Değişikliği

7 kural silindi (daha pratik çalışma için): `no_local_mc`, `no_unsolicited_action`, `no_version_rollback`, `never_touch_runs`, `never_touch_projects`, `no_model_switch`, `no_more_patches`. Kalan 11 kural tutuldu.

Session notu: `memory/project_session_2026-04-15-modular-refactor.md`.

---

### Hotfix (2026-04-14 19:24 TR): SCOPE_BLEED Path Mismatch — Stitch-to-JSX Koordinasyon

**Sorun:** Son 15 run'ın 9'u failed. Live DB analizi 4 ayrı kök sebep çıkardı:
1. Kimi+MiniMax+Zai üçlü çakılması (#434, #420-#427 — transient)
2. Merge conflict cascade (#428, #430)
3. **SCOPE_BLEED döngüsü** (#425, #424, #433 US-002 altı kez retry)
4. Cross-project contamination (#431 — zaten fix'lendi 77c33a0)

**Kök neden (3):** `scripts/stitch-to-jsx.mjs` screen title'ını (Türkçe) `toComponentName()` ile transliterate ederek `src/screens/OyunEkrani.tsx` üretiyor. Planner ise story scope_files'a İngilizce hayali yollar koyuyor (`src/pages/GameScreen.tsx`). Developer ya Türkçe dosyayı modifiye ederek scope bleed'e düşüyor ya da İngilizce dosyayı oluşturarak routing'i kırıyor. 6 retry sonrası abandon.

**Fix (commit d714043):**
- `computePredictedScreenFiles()`: DESIGN_MANIFEST.json okur, `toComponentName` mirror'ı ile Stitch'in üreteceği tam yolları hesaplar
- Stories step context'ine `predicted_screen_files` inject edilir (planner görür)
- Post-complete guardrail: `src/pages/`, `src/views/`, `src/components/screens/` altında PREDICTED_SCREEN_FILES'ta olmayan screen-like yolları tespit eder, failStep + öneri mesajı
- Multi-owner auto-fix: her screen tam 1 story tarafından scope_files'da sahiplenilir, fazlası shared_files'a taşınır (merge conflict #428/#430'u önler)
- Planner AGENTS.md'ye Türkçe transliterasyon örnekleri ve MUTLAK kural eklendi

**Güvenlik:** Pure addition (140+, 0-). DESIGN_MANIFEST.json yoksa helper `[]` döner, guardrail no-op — backward compatible.

**Doğrulama:** Run #435 kelime-tahmin-17697 başlatıldı (çok-ekranlı test case: Ana Menü, Zorluk Seçimi, Oyun, Sonuç, Ayarlar, Bilgi). Stories step'te predicted_screen_files injection + scope_files doğrulama gözlenecek.

---

### Hotfix (2026-04-14 09:54 TR): Peek-Recovery Cross-Project Contamination

**Sorun:** Yemek-42206 (Run #431) 09:40'ta US-001 abandon limit (5/5) ile fail oldu. Log'da "CROSS-PROJECT CONTAMINATION: STORY_BRANCH 0eb0562c-us-003 does not match run prefix b1e1b32c".

**Kök neden:** `peekStep` + `claimStep` recovery blokları `/tmp/setfarm-output-*.txt` tüm dosyaları tarıyordu. Pool agent (feature-dev_developer) olarak polling yapan lux, koda'nın (artık fail olmuş renk-koru'dan kalma) stale `setfarm-output-koda.txt` dosyasını yakaladı ve yemek'in running implement step'ine auto-complete etti. Cross-project-guard yakaladı ama step 5 kez toggle olmuştu.

**Fix (commit 77c33a0):**
- `peekStep` signature'a `callerGatewayAgent?: string` eklendi
- Recovery blokları caller verildiğinde SADECE `/tmp/setfarm-output-<caller>.txt` kontrol ediyor
- CLI peek handler `--caller` flag parse ediyor
- polling-prompt.md peek komutuna `{{CALLER_FLAG}}` eklendi
- Non-pool agent'lar (planner/designer) eski davranışı korur

**Doğrulama:** `ensure-crons feature-dev` + stale tmp cleanup sonrası peek komutları artık `--caller <name>` ile çalışıyor.

---

### Hotfix (2026-04-14 08:45 TR): Claim Starvation Bug

**Sorun:** 3 paralel run implement step'te pending iken, nefes-39489 (Run #432) 28+ dakika claim edilmedi. Free developer'lar her polling'de NO_WORK aldı.

**Kök neden:** claimStep SELECT sorgusu LIMIT 1 ile tek implement step dönüyor. 3 step aynı step_index=5, hepsi pending, tiebreaker yok. Postgres rastgele satır döndü. Başka dev'e atanmış run'ın step'i geldiğinde downstream CAS fail oluyor ve caller NO_WORK dönüyor — diğer run'lara bakmadan. Assigned dev kendi run'ını bile alamıyor.

**Fix (commit f0389b0):**
- Query caller-aware: implement step'lerde diğer dev'e atanmış run'lar filtrelenir
- ORDER BY: own-run (0) > unassigned (1) > others (2)
- Non-implement step'ler etkilenmez (step_id <> implement short-circuit)

**Doğrulama:** Patch sonrası nexus ilk cron tick'te nefes'i claim etti (workflow.log 05:45:37Z).

---

## 2026-04-14 — Tek Developer Modeli + Pipeline Güvenilirliği

### Büyük Değişiklik: Tek Developer / Proje Modeli
Paralel story modeli yerine her projede TEK developer çalışıyor. Developer implement step'te otomatik atanır, proje bitene kadar kilitli kalır.

**Neden:** Paralel modelde integration wiring (US-004) neredeyse her run'da fail oluyordu. Scope bleed, merge conflict, gateway lane congestion sürekli sorun. Tek developer = sıfır merge conflict, sıfır scope sorunu, doğal entegrasyon.

### Teknik Değişiklikler

**Developer Reservation (9ba0e0c + 69146c8):**
- `runs.assigned_developer` kolonu
- Implement claim anında pool'dan boş developer otomatik atanır
- Atomic CAS pattern (TOCTOU race korumalı)
- Run bitince developer pool'a döner

**Stories Template Sadeleştirme (5ce5c71):**
- Zorunlu "integration story" kuralı kaldırıldı
- Single Developer Mode bölümü eklendi
- `scope_files` zorunlu değil — tek developer tüm dosyaları yazıyor
- Son story artık lightweight verification + cleanup

**Gateway Config Optimizasyonu:**
- `announceTimeoutMs`: 300s → 15s
- `subagents.maxConcurrent`: 20 → 8
- Sonuç: Lane wait 31dk → 27s (%98 azalma), gateway stall sıfır

**Polling Prompt Template (628d2a6):**
- 80 satırlık prompt → `src/installer/prompts/polling-prompt.md`
- Kod değişikliği olmadan prompt güncelleme mümkün

**Context Cache (628d2a6):**
- `getProjectTree`, `getInstalledPackages` 5 dakika cache
- Tek developer aynı workdir'da tekrar tekrar çağırıyordu

### Kritik Bug Fix'ler
- `file_skeletons` DB/context bağlanması (ff029d8) — implement step "Blocked: unresolved variable" hatası giderildi
- `buildPollingPrompt` 3. parametre eksikliği (step-fail.ts)
- `checkStuckWaitingSteps` medic'e eklendi
- 43 bare `catch {}` → `logger.debug()` — sessiz hatalar görünür oldu

### Performans
- PG connection pool: 20 → 50
- DB index: `steps(agent_id, status)` ve `runs(status, assigned_developer)`
- Kimi quota bitti → 6 developer MiniMax M2.7'ye çevrildi

### OpenClaw v2026.4.12 Denemesi Başarısız
- RAM patlaması (1.7GB/15dk, WS 1006 crash)
- Issue #65441 — tüm session geçmişini startup'ta yüklüyor
- Geri alındı → v2026.4.2 + config fix

### Doğrulama
- Run #425: `assigned_developer` otomatik `koda` atandı
- Run #428: Stories 4 → 3 (integration story kaldırıldı)
- Gateway lane wait: tek run'da sadece 1 event, 27s

---

## 2026-04-13 — file_skeletons + Pipeline Debug (Mac)

- `file_skeletons` özelliği — story'ler arası API kontratı
- `stitch-to-jsx` — Stitch HTML → otomatik React component
- `checkIntegrationWiring` — tüm entry dosyaları kontrol
- `dep-merge` zinciri düzeltmeleri
- Coherence check + actionable guardrails
- WORKDIR enforcement

---

## v0.2.2 — 2026-02-11

### Fixed
- Prevented mixed timestamp formats from triggering false abandoned-step cleanups
- Guarded pipeline completion when steps or stories are failed/pending

### Added
- Per-agent timeout override for cron sessions via workflow agent `timeoutSeconds`

## v0.2.1 — 2026-02-11

### Fixed
- Hardened pipeline state transitions to avoid marking runs completed on partial failure

## v0.2.0 — 2026-02-09

### Fixed
- Step output now reads from stdin instead of CLI arguments, fixing shell escaping issues that caused complex output (STORIES_JSON, multi-line text) to be silently dropped
- This was the root cause of loop steps (like security audit fixes) completing with zero work done

### Added
- `setfarm version` — show installed version
- `setfarm update` — pull latest, rebuild, and reinstall workflows in one command
- CHANGELOG.md

## v0.1.0 — Initial release

- Multi-agent workflow orchestration for OpenClaw
- Three bundled workflows: feature-dev, bug-fix, security-audit
- Story-based execution with per-story verification
- SQLite-backed run/step/story tracking
- Dashboard at localhost:3333
- CLI with workflow management, step operations, and log viewing
