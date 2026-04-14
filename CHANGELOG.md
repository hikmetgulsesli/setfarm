# Changelog

Büyük değişiklikler ve session notları. Git commit'leri için `git log`.

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
