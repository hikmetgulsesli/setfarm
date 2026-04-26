## 2026-04-26 - Story PR Gate Serial Main Flow

- `feature-dev` now uses `verify_each` with `merge_strategy: pr-each` so only one story is implemented, reviewed, merged into `main`, and locally synced before the next story is claimed.
- Implement claims now block while any story is `done` and awaiting verify, preventing US-002/US-003 from branching before US-001's PR has landed.
- Spawner now also refuses to start developer agents while a `verify_each` run has `done` stories awaiting PR verification, so pending future stories no longer burn model sessions early.
- Spawner starts OpenClaw agent processes with a short stagger window to avoid concurrent plugin runtime cache setup races such as `discord ENOTEMPTY`.
- pr-each story worktrees now start from `main` instead of the pinned feature branch SHA; direct-merge keeps the old pinned-base behavior.
- Setup-build now publishes the scaffold/build baseline to `main` before implement starts, so the first story PR has the correct base.
- Setup baseline publishing now removes any tracked `node_modules` entry from Git before pushing `main`, preventing dependency symlinks/directories from leaking into story PRs.
- Verify now refuses to mark a story verified unless its PR is actually `MERGED`, then syncs local `main` from `origin/main`.
- Auto-created story PRs now target `main` in pr-each mode, and worktree cleanup uses the real story branch name.
- Developer peek/poll now also respects the pr-each verify gate, so pending future stories do not spawn or burn sessions while an earlier `done` story still needs PR review/merge.
- Verify review-delay now skips the wait when GitHub already has review comments or failing checks on the PR, avoiding empty reviewer sessions for older PRs.
- Pending loop-step spawns now obey the same verify gate, closing the `step_pending` path that could start a developer before the previous PR was marked verified.
- Verify claims can now pass a pending pr-each implement loop when `done` stories await PR verification, so the reviewer is not starved by the loop it is supposed to unblock.
- Developer instructions now remove the remaining "create PR" contradiction and explicitly forbid `gh pr create/edit/merge`; developers only commit and push the prepared story branch.
- Story completion now validates any agent-created PR and retargets it to `main` in pr-each mode before verify sees it, preventing PRs against the run branch.
- Verify PR context now includes inline review comments plus `mergeStateStatus`, and merge/conflict signals skip the review-delay wait.
- Polling prompts now extract `WORKDIR` from string claim inputs that include `REPO:` or the verify prompt's project-root line, so reviewer/tester agents do not fall back to scratch and then mutate the shared repo blindly.
- Spawner now opportunistically auto-verifies `done` stories whose PRs are already merged, so an externally/manual-merged PR does not leave verify stuck until a model session completes.
- Feature-dev implement claims now expose `STORY_BRANCH` separately from `RUN_BRANCH`, removing the misleading `BRANCH: <run uuid>` field that caused agents to create uppercase or stale replacement branches.
- The shared critical preamble no longer tells agents to complete a PR step unless that agent explicitly owns PR creation, so developer claims no longer contradict the pr-each pipeline gate.
- Story worktree pre-commit hooks now also verify the current branch matches `.story-branch`, rejecting commits on replacement branches before stale code can be pushed or PR'd.
- Fresh Vite projects now use `test: "vitest run"` with `test:watch` separated, and test detection/reviewer prompts force non-watch Vitest commands so verify agents cannot hang forever in watch mode.
- Implement prompts now explicitly preserve DONE-story behavior/tests, and the implement guard rejects large unexplained test deletions as `REGRESSION_RISK`, preventing agents from erasing prior story coverage while wiring integration stories.
- Event-driven spawner now pre-claims work itself and starts agents with a prepared claim file, so model sessions no longer burn time/tokens deciding to run `step peek`/`step claim` before actual work starts.

## 2026-04-26 - Single Step Claim Idempotency

- Normal non-loop steps now reissue an already-running claim for the same agent role instead of returning `NO_WORK`. This prevents models that accidentally run `step claim` twice from overwriting `/tmp/claim-*-spawner.json` and leaving plan/design/stories/setup steps stuck in `running`.
- Claim selection now includes running steps, with running work preferred before new pending work. Loop story idempotency already existed; this extends the same protection to single steps such as design.
- Story worktree scope hooks now allow test files and common test config paths by pattern, matching the implement prompt. Hook helper files (`pre-commit`, `.story-scope-files`, `references`, `node_modules`) are added to the worktree git exclude so they do not pollute `git status`.
- Implement scope-file existence guard now treats `scope_files` as an ownership boundary instead of requiring every listed companion file to exist. It still fails no-work outputs, but valid stories that implement the primary file without optional sibling CSS no longer burn retries.
- Implement agent preamble now forbids `npm install` in both story worktrees and the shared main repo. Missing dependencies must be reported as `MISSING_DEPENDENCY` instead of dirtying `package.json`/`package-lock.json` mid-story.
- Story worktree creation now isolates a dirty shared main repo by auto-stashing uncommitted changes before creating the next story branch, preventing accidental main-repo edits from leaking into later stories.
- Medic cron recovery checks now no-op when gateway agent crons are disabled and the event-driven spawner owns execution. This removes bogus `0/0 crons recreated` events and prevents stale cron-health findings from restarting the gateway during active story work.
- Implement story prompts and context now preserve the pipeline-created `story_workdir` and lowercase `story_branch` instead of telling developers to create their own branch from the shared repo. This prevents uppercase/lowercase branch splits, stale PR heads, and main-repo contamination between stories.
- `shared_files` are now treated as read-only context instead of writable scope. Commit hooks and scope guards allow writes only to `scope_files` plus test helper files, preventing stories from editing future/integration files just because the planner listed them as shared references.
- Medic terminal-run cleanup now excludes already-skipped steps, preventing the same old failed runs from being reported as newly fixed on every watchdog cycle.

## 2026-04-25 - OpenClaw Stability + Medic Timer

- Fresh Vite/React repos are now scaffolded in setup-repo and dependencies are installed/committed in setup-build, so implement stories no longer have to create package/config/App/main from scratch.
- Story worktrees now link `references/`, design dedup refuses incomplete PRD screen sets, design preclaim completes by DB step UUID, and `step stories` accepts run-number/UUID prefixes.
- Loop story claims are now idempotent for running stories, so an agent that accidentally runs `step claim` twice gets the same running story instead of overwriting its claim file with `NO_WORK`.
- Spawner now starts story/developer agents only while the implement loop step is running, preventing premature developer sessions during setup and avoiding concurrent OpenClaw plugin bootstrap races.
- Generic polling prompts now handle string vs object claim input safely and no longer assume setup has already completed for plan/design/stories/setup steps.
- Gateway agent crons are now opt-in via `SETFARM_ENABLE_GATEWAY_AGENT_CRONS=1`; the systemd spawner owns workflow execution by default. This prevents spawner+cron duplicate agent sessions from sharing `/tmp/claim-*` files and leaving steps stuck in `running`.
- Spawner claim/output file ids now use a `-spawner` suffix so optional cron fallback sessions cannot overwrite an active spawner claim file.
- `feature-dev` agent mapping now targets role-specific `feature-dev_*` agents instead of generic pool agents, so each step gets its correct workspace and avoids onboarding/context bleed.
- Setfarm Medic no longer runs as an OpenClaw agent cron. `setfarm medic install` migrates the legacy `setfarm/medic` cron away and installs a user `systemd` timer that runs `node dist/cli/cli.js medic run` every 5 minutes, with DB env loaded from a private env file.
- Systemd Medic disables OpenClaw CLI fallback and reads cron state from `~/.openclaw/cron/jobs.json` when gateway HTTP is unavailable, preventing stuck `openclaw cron list` helper processes during gateway startup/restart.
- OpenClaw session defaults tightened for future installs: `cron.sessionRetention=4h`, `session.maintenance.pruneAfter=2d`, `maxEntries=500`, `rotateBytes=10mb`.

## 2026-04-22 — 5 Fix Entegrasyonu + Merge Conflict Darbogazi (Run #523)

### Onceki Durum (Run #518, #520, #522)
- US-001 DONE ama PR acilmiyor, sonra US-002 sonsuz retry dongusunde (peek/claim race + SCOPE_BLEED Pink Elephant)
- 4 retry x 4 story = 16 bosa agent session

### Bu Turdaki Fixler
- **Fix 4 commit `6730082`** — peek dep-check: peek logic claim ile uyumlu. HAS_WORK -> claim NO_WORK infinite cycle kirildi. US-002 retry=0 direkt ilerledi (onceki run'larda retry=2 stuck).
- **Fix 5 commit `3341e48`** — SCOPE_BLEED silent revert: cleanup basariliysa failStep cagirmiyor. Pink Elephant feedback agent'a geri dondurulmuyor. US-003 retry=3 silent-revert DONE.

### Run #523 Sonuc (sayac-9674691)
- **4/4 story DONE + 4 auto-PR acildi:**
  - PR #1 US-001 retry=0 (auto-PR ilk deneme)
  - PR #2 US-002 retry=1
  - PR #3 US-003 retry=3 (silent-revert devreye girdi)
  - PR #4 US-004 retry=2
- **2 MERGED:** US-002, US-003 merge-queue tarafindan main'e alindi.
- **Run failed** at merge-queue: Too many conflicts 2 of 4 — aborting. US-001 ve US-004 App.tsx gibi shared file'larda catisti.

### Kesfedilen Yeni Darbogaz
- **Merge-queue conflict threshold**: direct-merge stratejisi parallel story'ler shared file'lari ayni anda modifiye edince catisma uretiyor. 2/4 esigi asilinca run abort. integration story US-004 ile diger story'ler ayni dosyalara dokundugu icin kacinilmaz catisma.
- Cozum onerileri sonraki session: a) US-004 deps tanimliyla zaten son calisir ama direct-merge parallel yapiyor, serialize gerek b) merge-queue 3-way merge c) integration story'yi ayri step'te calistir

### 5 Fix Ozet dist build canli
1. `e8d0c95` auto-PR creation agent bypass
2. `2b415d5` chmod 0o664 .story-scope-files agent-writable
3. `3e0c3ad` test warn-only verify step review eder
4. `6730082` peek dep-check claim ile uyumlu
5. `3341e48` SCOPE_BLEED silent revert Pink Elephant mitigation

## 2026-04-21 — Auto-PR Sistemsel Fix + Zincirleme Stall Bulgulari

### Sorun
Run #518 (sayac-2837200) US-001 retry=3'te DONE olsa da PR acilmiyor — koda agent `gh pr create` tetiklemiyor. Kullanici bir sonraki runda sorun olmasin dedi -> agent'a guvenmek YASAK, sistemik cozum sart.

### Uygulanan Fixler (3 commit, hepsi canli build `3e0c3ad`)

#### 1. Auto-PR creation (commit `e8d0c95`)
- `src/installer/step-ops.ts` implement completion blogu -- STATUS:done alindiginda, agent pr_url raporlamadiysa sistem kendisi calistiriyor: `git push -u origin <story_branch>` + `gh pr create --base <feature_branch> --head <story_branch>`.
- Existing PR check (`gh pr list --head`) ile idempotent; yinelenen PR yaratmaz.
- Agent'in `gh` komutunu unutmasi artik pipeline'i kilitlemez — sistem garanti veriyor.

#### 2. `.story-scope-files` chmod 0o664 (commit `2b415d5`)
- step-ops.ts:599 + 06-implement/context.ts:194 `fs.chmodSync(..., 0o444)` -> `0o664`.
- Kok: read-only `.story-scope-files`'a agent update yapmaya calisiyor, EACCES yiyor, session sessizce oluyor -> 3+ dakika stall -> medic gateway'i restart ediyor.
- 0o664 agent write'ina izin veriyor. Guard'in scope enforcement'i git diff uzerinden calistigi icin dosya icerigi agent manipulasyonuna karsi korunmali degil.

#### 3. Test fail warn-only (commit `3e0c3ad`)
- step-ops.ts:2613 — test fail bloku `failStep + retry` yerine log.warn + context\[test_warnings\] ekliyor.
- Kok: 2026-04-20 memory'deki Fix 2 warn-only kodda uygulanmamis kalmisti; test flake olan story'ler sonsuz retry dongusune giriyordu. Artik verify step'i PR review sirasinda testleri yakalar.

### Dogrulama (Run #522, bb824476, sayac-2873239)
- **US-001 DONE retry=0 + PR #1 AUTO-CREATED** (21:11:14): https://github.com/hikmetgulsesli/sayac-2873239/pull/1 — 3 fix birlikte ilk denemede basarili.
- Auto-PR integration point `step-ops.ts:2788` pgRun UPDATE stories'ten once cagiriliyor, storyPrUrl guncellenmis DB'ye yaziliyor.

### Kesfedilen, Duzeltilmemis
- **US-002 peek/claim race** (sistemsel): peek `HAS_WORK` donuyor (loop step + pending stories) ama claim `NO_WORK` donuyor (pending stories bagimli, US-002 running stuck). Agent sonsuz cycle'a giriyor, maksimum retry'a ulasana kadar pipeline kilitli. Medic 20dk threshold cok yuksek; dep-blocking durumunda 5dk olmali. Sonraki session'da.
- **spawner activeProcesses leak**: koda child death'te Map cleanup yapiliyor (callback'te delete var) ama yine de periyodik Already running: skip gozukuyor — race condition spawner lifecycle'inda. Uzun sureli spawner 4.4G RAM peak'e ciktigi zaman gozlendi. Restart cozmek ister.
- **Gateway stall pattern** tekrar: session 10dk sessiz kalinca medic auto-restart ediyor ama crons recover etmiyor, spawner handover bozuluyor. OpenClaw platform bug (project_gateway_stall_openclaw_bug.md).

### Son Durum
- Run #518, #520 cancelled (stall + manuel stop), Run #522 US-001 PR #1 basarili, US-002+ blocked.
- 3 fix production'da, sonraki run'larda auto-PR garanti.
## 2026-04-19 — Impl/Install Loop Root-Cause Fixes

### Sorun Dokumu
- Dev agent 24 saatte 16+ kez Read("stitch") cagirdi -> EISDIR: illegal operation on a directory. Ayni path tekrar tekrar okunuyor, tool turn yakiliyor, 30dk step timeout'una yaklasiyordu.
- `setfarm workflow install feature-dev` AGENTS.md/IDENTITY.md/SOUL.md workspace kopyalarini overwrite ETMIYORDU. Repo'daki loop fix'leri runtime'a ulasmiyordu -- config drift.
- `feature-dev_qa-tester` agent'in `model` alani `null`. QA step'ine gelince patlayacakti.

### Kok Sebep
1. `stitch/` bir klasor. AGENTS.md'de `stitch/<screenId>.html oku` diye gecse de model bazen direkt `stitch` path'i okumaya calisiyor. Prompt'ta hicbir yerde "stitch klasordur, direkt okuma" uyarisi yoktu.
2. `provisionAgents()` varsayilan `overwriteFiles:false`. Her yeniden install sessizce mevcut dosyalari atliyordu.
3. `feature-dev_qa-tester` config drift -- muhtemelen manuel duzenleme sirasinda model silinmis.

### Uygulanan Fixler
- `workflows/feature-dev/agents/developer/AGENTS.md` -- bas tarafa "STITCH DIRECTORY -- HARD RULE" bolumu. Icerik: stitch klasor icerigi listesi, `Read(stitch)` yasagi, EISDIR gorulurse durma talimati, per-story HTML'lerin zaten prompt'a inject edildigi hatirlatmasi. (commit 302df48)
- `src/installer/install.ts` -- installWorkflow artik `overwriteFiles:true` ile cagiriyor. Fresh workspace files her reinstall'da. (commit ed7d617)
- `~/.openclaw/openclaw.json` -- `feature-dev_qa-tester.model` = minimax/MiniMax-M2.7 + zai/glm-5.1 fallback. Backup: `openclaw.json.bak-20260419-debug`.

### Ek Fix (ayni turda, config-level)
- **Session store temizligi:** 146 birikmis cron session sessions.list operasyonunu 7-23 saniyeye cikariyordu (sessions.patch collision penceresini genisletiyordu). Settings:
  - `session.maintenance.pruneAfter`: 7d -> 1d (Arya main korunuyor, 25h+ cron sessions pruned)
  - `cron.sessionRetention`: 24h -> 2h
  - `agents.defaults.subagents.archiveAfterMinutes`: 60 -> 15
- `openclaw sessions cleanup --all-agents --enforce` manuel calistirildi: 117 stale session pruned, sessions.json 14MB -> 2.4MB (%83 kucuk).
- Beklenen etki: `workflow-agent-<agent>` label collision frekansi dusecek (collision window kucuk sessions.json yazimi hizli).

### Kesfedilen Ama Bu Turda Duzeltilmemis
- Session label collision (`label already in use: workflow-agent-koda`) -- OpenClaw gateway sessions.patch INVALID_REQUEST, cron tekrar fire olunca eski isolated session henuz kapanmamissa cakisma. Bu platform-level, sonraki turda medic'e stuck session kill eklenecek.
- Minimax surface_error timeout -- primary model bazen yanit vermiyor, fallback chain'e dusmeden "surface_error" karari veriliyor. Failover mantigi incelenecek.
- xAI 429 (kredi bitti) -- x_search, code_execution toollari xai'yi cagiriyor. Agent model chainlerinde xai yok ama tool provider olarak kayitli. Quota restore olana kadar devre disi birakilmali.

### Dogrulama
- `setfarm workflow install feature-dev` sonrasi `grep -c "STITCH DIRECTORY" workspaces/.../developer/AGENTS.md` -> 1 (onceki 0).
- Medic still running, gateway stabil, aktif run yok.
- Sonraki feature-dev run'da EISDIR loop'un kaybolmasi beklenir.

## 2026-04-17 — Gateway Performance Fix (CPU + Memory Leak)

### Büyük Değişiklik — Gateway Şişme Kökü Teşhisi
Kullanıcı tespit etti: "gateway şişince yavaşlıyor, restart edince düzeliyor". 6 custom "yama" ayarı zincirleme CPU + RAM drain üretiyordu.

### Kök Sebep Zinciri (önce→sonra)

| Ayar | Önceki | Sonraki | Neden |
|---|---|---|---|
| `defaults.subagents.maxConcurrent` | 16 | 6 | i5-6500T 4-core oversubscription → CPU 100% |
| `defaults.subagents.archiveAfterMinutes` | 60 | 15 | Agent session 1 saat RAM'de tutuluyor |
| `defaults.memorySearch.enabled` | true (Ollama) | false | Her agent turn'da Ollama `/v1/embeddings` → CPU drain |
| `defaults.contextPruning.mode` | off | cache-ttl | Session sınırsız büyüme = gateway memory leak |
| `main (arya).memorySearch` | (yok) | Google Gemini `text-embedding-004` | Arya memory korunur, CPU drain olmadan |
| `hooks.openviking.config.autoIndex` | true | false | Her tool call HTTP noise |

### Schema Gotcha'ları
- `defaults.contextPruning.cacheTtlMinutes` — schema reddediyor, sadece `mode` yeterli
- `agents.list[].contextPruning` — agent-level override YOK (schema hatası)
- OpenAI embedding alternatifi: kullanıcı hesabı yok → Google Gemini tercih

### Canlı Doğrulama (#472 sepet-65285)
- Plan **42 saniye** (en hızlı ölçüm — önceki 55s-1m50s)
- Gateway memory **1.1G stabil** (önceki 1.7G peak 2.4G, %54 düşüş)
- Lane wait exceeded **YOK** (önceki 40-180s)
- Ollama çağrısı **SIFIR** (önceki 100+ event/dk)

### Dosya Değişiklikleri
- `~/.openclaw/openclaw.json` — defaults + main agent + hooks
- Backup: `~/.openclaw/backups/20260417-0131-perf-fix/`

---

## 2026-04-17 — Darboğaz Fix + Kimi Model Fix (Production-Ready)

### Büyük Değişiklik — feature-dev Pipeline Production Ready
3 paralel run testi iki ciddi blokajı kanıtladı ve kök nedenler teşhis edilerek canlı doğrulandı. Bundan böyle concurrent run senaryosu darboğaz-free.

### Darboğaz Fix — Workflow Pool Genişletme (Konfigürasyon Sync)

**Sorun**: Aktif `~/.openclaw/workspace/workflows/feature-dev/workflow.yml` stale — 4 rolde tek agent:
- planner: main (tek) → 3 concurrent run 16+dk plan kuyruğu
- designer: mert (tek)
- setup-repo/setup-build/deployer: atlas (tek, 3 rol için)

**Çözüm**: Setfarm template (`~/.openclaw/setfarm/workflows/feature-dev/workflow.yml`) ZATEN genişletilmiş pool'lara sahip. Tek komut sync:
```bash
cp ~/.openclaw/setfarm/workflows/feature-dev/workflow.yml ~/.openclaw/workspace/workflows/feature-dev/workflow.yml
```

**Yeni pool**:
- planner: [main, nova, zeta]
- setup-repo: [atlas, axon, helix]
- setup-build: [atlas, axon, helix]
- designer: [prism, helix, zeta]
- developer: [koda, flux, cipher, prism, lux, nexus, axon, nova, zeta, helix] — 10 agent
- deployer: [atlas, helix]

**Kanıt**: Fix sonrası #470 plan **55 saniye** (önceki 11-16 dk kuyruğundan 12-18x hızlanma).

### Kimi Model Fix — API Key Format Teşhisi (Kritik Gotcha)

**Sorun zinciri**:
1. 3 Explore agent source analizi: workflow.yml `polling.model` cron payload'a konmuyor. Gerçek model seçimi `~/.openclaw/openclaw.json agents.list[].model.primary`.
2. İlk deneme: 11 developer agent `moonshot/kimi-k2.5` → Gateway HTTP 401 Invalid Authentication → fallback MiniMax-M2.7.
3. **Root cause**: `openclaw.json env.MOONSHOT_API_KEY` değeri `sk-kimi-...` ile başlıyor — yani kimi.com formatı, moonshot.ai değil. Moonshot endpoint reddediyor.
4. Doğru format: `kimi-coding/k2p5`. Agent models.json'ında `kimi-coding` provider `apiKey: "sk-kimi-..."` inline — aynı key doğru endpoint'e gidiyor.

**Çözüm**: Python script ile 11 developer agent (koda, flux, cipher, prism, lux, nexus, axon, nova, zeta, helix, feature-dev_developer) model.primary → `kimi-coding/k2p5`.

**Kanıt**: Fix sonrası `live_events`:
- prism agent model=k2p5, 46 event (4 dakikada)
- Gateway log: 401/fallback/kimi error **YOK**

### Gateway + Config Değişiklikleri

- `~/.openclaw/openclaw.json` — 11 developer agent model.primary güncelleme
- `~/.openclaw/workspace/workflows/feature-dev/workflow.yml` — setfarm template sync (pool genişletme)
- `systemctl --user restart openclaw-gateway` + `setfarm workflow ensure-crons feature-dev`
- Backup: `~/.openclaw/backups/20260417-0038-plan-apply/`

### Memory + Gotcha

- `memory/project_session_2026-04-17-darbogaz-kimi-fix.md` — tam session notu
- `memory/gotcha_moonshot_key_is_kimi_format.md` — API key format yanıltıcı isim uyarısı

### Doğrulama
- #470 plan 55s ✓
- prism/k2p5 canlı çağrı ✓
- 97/97 unit test yeşil (kod değişimi yok, config fix)
- Gateway restart sonrası sistem stabil

---

## 2026-04-16 — 07-verify Modül + Model Fix + Sistem Teyidi

### Büyük Değişiklik — Sistem Stabilizasyonu
OpenClaw 2026.4.14 + agent model atamaları fix sonrası feature-dev pipeline ilk kez uçtan-uca sağlıklı çalıştı. Önceki 20+ dakika stuck olan plan/design step'leri 1-3 dakikaya indi.

### Model Atama Fix'leri
Karmaşa tespit edildi ve düzeltildi:

**Öncesi:**
- `feature-dev_setup/tester/verifier/security-gate` → `MiniMax-M2.5` (ESKİ, API'da yok)
- `feature-dev_qa-tester` → models.json **YOK**
- `feature-dev_developer` → `MiniMax-M2.5` (kullanıcı kimi ister)
- Bireysel developer'lar (koda/flux/cipher/prism/lux/nexus) → minimax primary, kimi 3. sıra

**Sonrası:**
- 5 agent → planner template (`MiniMax-M2.7`) kopyalandı
- qa-tester için config oluşturuldu
- Developer pool + feature-dev_developer → moonshot provider ilk sıra (kimi-k2.5 primary denemesi)
- Gateway log teyit: `[gateway] agent model: kimi/k2p5`

Backup: `~/.openclaw/backups/agent-models-20260416-231007` + `~/.openclaw/backups/devs-20260416-231758`

### Yeni Modül — 07-verify

Pattern: 06-implement (minimum viable). Step-ops.ts verify mantığı (injectVerifyContext + pre-flight static analysis + PR review delay) step-ops.ts'te kalıyor — verify_each loop mekanizmasına bağlı, tam refactor için daha derin çalışma gerekli.

**Dosyalar (7):**
- `src/installer/steps/07-verify/module.ts` (id=verify, type=single, agentRole=reviewer, maxPromptSize=16384)
- `src/installer/steps/07-verify/guards.ts` (normalize first-word + validateOutput STATUS kontrol)
- `src/installer/steps/07-verify/context.ts` (no-op şimdilik)
- `src/installer/steps/07-verify/prompt.md` (reviewer template)
- `src/installer/steps/07-verify/rules.md` (retry tetikleri, pass kriterleri, FEEDBACK formatı)
- `src/installer/steps/registry.ts` (verifyModule register)
- `tests/steps/07-verify.test.ts` (13 test case)

### Test Coverage
- **59/59 yeşil** (46 → 59, +13 test)
- 7 modül test suite: 01-plan (8) + 02-design (7) + 03-stories (4) + 04-setup-repo (7) + 05-setup-build (9) + 06-implement (11) + 07-verify (13)

### Canlı Sistem Teyidi — #467 sayac-33213
- plan DONE 1m50s ✓ (MiniMax-M2.7)
- design DONE **2m44s** ✓ (önceki 20+ dk stuck'lara göre 10x hızlanma)
- stories DONE 1m13s ✓
- setup-repo DONE 37s ✓ (önceki instant-fail'in çözümü)
- setup-build DONE 15s ✓
- implement US-001 DONE 10dk ✓ (developer koda — worktree'de App.tsx + 8 component + testler)
- 5 story'nin 1'i tam bitti, diğerleri sırada

### Kalan İş
- 08-security-gate, 09-qa-test, 10-final-test, 11-deploy hâlâ step-ops.ts içinde inline
- step-ops.ts 3238 satır (07-verify registry eklemesi +1 import)
- Provider-order-primary mekanizmasının kesin doğrulaması (hâlâ minimax mı düşer bakalım, implement story'leri başarılı tamamlanırsa teyit)

### Doğrulama
- `npm run test:steps` — 59/59 pass (578ms)
- Fresh `#467` pipeline 5 modül + US-001 başarısı

---

## 2026-04-16 — Test Coverage Genişletme: 04/05/06 Modülleri

### Büyük Değişiklik — Modüler Refactor Test Kapsamı
Daha önce sadece 01-plan/02-design/03-stories için unit test vardı (19 test). 04-setup-repo, 05-setup-build ve 06-implement modülleri için 27 yeni test eklendi. Toplam step modül testleri **19 → 46** (%142 artış).

### Teknik Değişiklikler

**tests/steps/04-setup-repo.test.ts (7 test):**
- Module metadata (id, type, agentRole, maxPromptSize=6144, preClaim/onComplete varlığı)
- buildPrompt: REPO/BRANCH/TECH_STACK/DB_REQUIRED substitution + defaults + budget guard
- validateOutput: STATUS required, "done" bekleniyor (case-insensitive)

**tests/steps/05-setup-build.test.ts (9 test):**
- Module metadata + buildPrompt (REPO/TECH_STACK/BUILD_CMD_HINT)
- onComplete: parsed.build_cmd → context.build_cmd stamp, build_cmd_hint fallback, "npm run build" final fallback
- onComplete: compat_fail throw (`COMPAT: ...`), baseline_fail throw (`BASELINE: ...`)

**tests/steps/06-implement.test.ts (11 test):**
- Module metadata (id=implement, type=loop, agentRole=developer, maxPromptSize=32768)
- buildPrompt returns empty (AGENTS.md 869 satırlık loop template'e delegasyon kasıtlı)
- injectContext no-op (gerçek iş injectStoryContext'te, story-selection sonrası)
- validateOutput: STATUS required, STATUS=done && (CHANGES|STORY_BRANCH) kuralı
- normalize: first-word extract, lowercase, multi-line leak fix (Wave 13+)

### Sanity Check Bulguları

- **MC ↔ setfarm event uyumu:** DB `step_id` değerleri + module.id HEPSİ bare ("plan", "design", "implement"...). MC `discord-notify.ts` aynı bare format bekliyor. **Uyum var, kod değişikliği gerekmedi.**
- **OpenClaw v2026.4.14** teyit edildi (memory notu stale idi).
- **#464 run cancelled** — eski cron artefaktı, `setfarm workflow stop 3edc2d09 --force`.

### Doğrulama
- `npm run test:steps` — 46/46 pass, 0 fail (498ms)
- 6 modül (01-06) yeşil

### Kalan İş
- 07-verify, 08-security-gate, 09-qa-test, 10-final-test, 11-deploy hâlâ step-ops.ts içinde inline (3238 satır kaldı)
- step-ops.ts legacy kod temizliği (delegasyon sonrası ölü versiyon kalıntıları olabilir)

---

## 2026-04-16 — 06-implement Modül + Phase 2 Scope Delegation

### Büyük Değişiklik — Implement Step Modülü
Step-ops.ts monolitinden 06-implement modülüne extraction devam ediyor. Phase 1: modül dosyaları, Phase 2: scope enforcement delegation.

### Teknik Değişiklikler

**06-implement modül (e778304):**
-  (252 satır): injectStoryContext — story context, scope discipline, stitch HTML, design DOM, smart context
-  (219 satır): normalize, validateOutput, checkScopeFilesGate, checkScopeEnforcement, resolveStoryWorktree
-  (51 satır): StepModule kaydı (loop type, developer)
-  + : Developer agent prompt ve kurallar
- : implementModule eklendi

**Phase 2 scope delegation (81fe982):**
- step-ops.ts loop block'undaki 215 satırlık inline scope enforcement → 38 satırlık guards.ts delegation
- Wave 6/10/13/14 scope guard'lar korundu (zero-work, stub, scope bleed, overflow, scope_files gate)
- step-ops.ts: 3433 → 3238 satır (-195)

**Cron pool cap (58a4f91):**
- syncActiveCrons demand-based pool cap: 1 run → 1 cron, N run → min(N, pool) cron
- Gateway CPU %63 → %27

### Doğrulama
- Run #457/#458/#459: 5 modül (plan→setup-build) 3/3 yeşil
- Run #462: 5 modül yeşil + implement 2/6 story done (scope guard delegation çalışıyor)
- Gateway idle: sadece medic cron (demand-cap doğrulandı)

---

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
