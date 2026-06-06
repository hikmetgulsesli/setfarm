# System Architecture Map

## Current Intent

Setfarm'in hedefi bir "agent chat runner" olmak değil; LLM agent'ları bounded compiler pass gibi kullanan, kanıta dayalı bir software factory olmaktır. Mission Control ise bu fabrikanın canlı operasyon panosu olmalıdır: hangi agent ne yapıyor, hangi dosya değişti, hangi gate geçti, hangi PR yorumu çözüldü, hangi runtime evidence üretildi, hepsi görülebilmelidir.

## Main Runtime Components

- `src/cli/cli.ts`: CLI entrypoint. Workflow başlatma, status, daemon/spawner komutları buradan akar.
- `src/db-pg.ts`: PostgreSQL schema ve migration benzeri startup DDL. Runs, steps, stories, claim log, observations gibi state tabloları burada.
- `src/installer/run.ts`: workflow run oluşturma ve ilk step state hazırlığı.
- `src/installer/step-ops.ts`: claim, preclaim, completion, story loop, PR, QA-FIX routing ve step lifecycle davranışlarının büyük kısmı. Kritik ama aşırı yoğun dosya.
- `src/spawner.ts`: agent process manager. Claim alır, OpenClaw/gateway readiness bekler, agent process başlatır, runtime guard/watchdog uygular, stuck/self-loop/orphan claim temizler.
- `src/spawner-prompt.ts`: agent claim özetini ve prompt context'ini üretir. Agent'ın ne bilip ne bilmeyeceği burada ciddi ölçüde şekillenir.
- `workflows/feature-dev/workflow.yml`: ana pipeline tanımı ve role mapping. Plan -> design -> stories -> setup -> implement -> verify -> supervise -> quality -> deploy akışı burada tarif edilir.

## Pipeline Step Modules

`src/installer/steps/*` altındaki her step teoride kendi contract'ını taşır:

- `preclaim.ts`: agent doğmadan önce Setfarm-owned mekanik iş.
- `context.ts`: agent'a verilecek context.
- `prompt.md`: agent prompt template.
- `rules.md`: step kuralları.
- `guards.ts`: output ve completion guard'ları.
- `module.ts`: `StepModule` export.

Pratikte birçok kritik davranış hala `step-ops.ts` içinde merkezileşmiştir. Bu mimari borçtur: step contract'ları ile global lifecycle logic iç içe geçmiştir.

## Mission Control Components

- `src/server/daemon.ts`: local MC server/daemon.
- `src/server/dashboard.ts`: API endpoints, runs/projects/observations data provider.
- `src/server/index.html`: current single-file UI. Projects, run detail, activity, evidence filmstrip gibi görünüm burada.
- `src/server/spawnerctl.ts`: spawner control integration.
- `src/server/supervisor-summary.ts`: supervisor state summary helpers.

MC şu anda observation stream'i kullanmaya başlamış olsa da eski event yapılarıyla birlikte yaşar. Bu dual-truth riski yaratır: özellikle retry, QA-FIX, stale blocker ve "verified ama old blocked görünür" durumlarında kullanıcı yanlış algı alabilir.

## Evidence And Runtime Components

- `src/installer/runtime-driver.ts`: stack-agnostic runtime driver interface.
- `src/installer/web-runtime-driver.ts`: Vite/browser preview runtime start/interact/capture/stop.
- `src/installer/runtime-ports.ts`: MC/Setfarm-owned deterministic runtime port allocation.
- `src/installer/implement-evidence.ts`: intent/request/evidence artifact path ve validation.
- `src/installer/implement-evidence-runner.ts`: runtime build, preview, interaction, screenshot/DOM/state capture.
- `src/installer/implement-evidence-writer.ts`: `IMPLEMENT_EVIDENCE.json` writer.
- `src/installer/stack-evidence.ts`: stack capability/evidence metadata.

Hedef doğru: agent test ettiğini iddia etmez; Setfarm runtime'ı çalıştırır ve evidence üretir. Mevcut uygulamada bu henüz parçalıdır; request artifact eksikse evidence çoğu zaman advisory kalabilir.

## Supervisor And Self-Heal

- `src/installer/supervisor/*`: product supervisor scanner, checklist, visual QA, intervention, state, ledger.
- `src/installer/product-supervisor.ts`: supervisor memory and product-level checks.
- `src/installer/platform-self-heal/*`: platform failure classifier, ownership map, patch plan, rollback, patch registry, strictness delta, write interceptor.

Supervisor şu anda hem product correctness hem deterministic checklist hem runtime discipline sinyallerine yaklaşır. Bu rol sınırları bulanıklaşırsa "patron", "QA", "compiler", "developer" yetkileri karışır.

## Script Layer

- `scripts/stitch-to-jsx.mjs`: Stitch HTML -> generated React screens compiler.
- `scripts/generated-screen-validator.mjs`: generated screen/design/code consistency.
- `scripts/smoke-test.mjs`: app runtime smoke and semantic browser checks.
- `scripts/setup-repo.sh`: generated project scaffold/setup.
- `scripts/check-*.mjs`: repo build contracts.

Bu script'ler "mechanical compiler/gate" katmanıdır. LLM agent'lara bırakılmaması gereken doğrulamalar burada olmalıdır.

## Observed System Shape

Mevcut sistem doğru niyete sahip ama çok fazla yerde aynı soruya cevap vermeye çalışır:

- Stitch/design converter doğru mu?
- generated screen app'e bağlandı mı?
- action handler var mı?
- runtime state gerçekten ekrana yansıyor mu?
- PR merge oldu mu?
- QA-FIX story açılmalı mı?
- supervisor kendi kendine düzeltmeli mi?
- MC stale blocker'ı nasıl göstermeli?

Bu soruların çoğu tek tek guard olarak eklendiği için sistem reaktif contract accumulation eğilimine girmiştir.

