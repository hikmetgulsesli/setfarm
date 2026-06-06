# Pipeline Behavior By Step

## 01 PLAN

Amaç: Kullanıcı isteğini portable Product Contract PRD'ye çevirmek.

Beklenen çıktı: project name/slug, platform, tech stack, DB/design kararları, PRD, Product Surfaces, ACT_* actions, testability contract.

Yasak: repo path, branch, package name, physical screen list, runtime identity.

Sorun riski: PLAN çok genel kalırsa DESIGN/STORIES kötü surface/action üretir; fazla fiziksel detay verirse downstream katmanları kilitler.

## 02 DESIGN

Amaç: Product Surfaces'ten Stitch design artifacts üretmek ve her screen'i surface contract'a bağlamak.

Preclaim: Stitch project ensure, screen generation/download, DESIGN.md/HTML/PNG/DOM/tokens/manifest üretimi.

Beklenen: SCREEN_MAP, DESIGN_SYSTEM, device type, surface mapping.

Sorun riski: Stitch fiziksel ekran sayısı ile stories/scope yanlış eşleşirse generated app eksik ekranla "complete" görünebilir.

## 03 STORIES

Amaç: PRD + SCREEN_MAP üzerinden implement edilebilir user stories üretmek.

Beklenen: story scope, acceptance criteria, owned files, generated screen ownership, action mapping.

Sorun riski: scope çok dar olursa gerekli App.tsx/router/action wiring yapılamaz; çok geniş olursa story izolasyonu bozulur.

## 04 SETUP-REPO

Amaç: project repo/scaffold/git/database/design contracts hazırlığı.

Preclaim: setup script, branch, DB provisioning, Stitch contracts, route/component contracts.

Sorun riski: setup artifacts eksikse implement agent olmayan context'i tahmin eder.

## 05 SETUP-BUILD

Amaç: baseline build ve generated screen import'un mekanik olarak temiz olduğunu kanıtlamak.

Preclaim: npm install, baseline build, compatibility, Tailwind, `stitch-to-jsx`, setup certificate.

Hard gate olması gerekenler:

- unknown icons
- missing generated screen file
- token/CSS source missing
- build failure
- SCREEN_MAP/UI_CONTRACT mismatch

Sorun riski: setup-build "build geçti" diye design import failure'ı override ederse sonraki tüm pipeline zehirlenir.

## 06 IMPLEMENT

Amaç: Her story'yi scoped worktree'de uygulamak; Setfarm commit/PR açmadan önce mekanik gate'lerden geçirmek.

Beklenen:

- story scope içinde değişiklik
- build/test pass
- generated screen/action wiring pass
- runtime bridge pass
- implement evidence artifact veya en az advisory evidence
- supervisor checklist pass
- Setfarm-owned commit + PR

Sorun riski:

- agent kendi test ettiğini iddia eder ama runtime evidence yoktur
- App.tsx/shared shell değişiklikleri sonraki story'leri bozar
- QA-FIX story mevcut verified screen'i regresse eder

## 07 VERIFY

Amaç: PR review comments, merge state, CI/checks ve post-merge correctness doğrulamak.

Beklenen:

- actionable PR comments normalize edilir
- comment fix gerekirse implement'e route edilir
- PR merged olmadan story verified olmaz
- post-merge build/smoke gerekirse çalışır

Sorun riski:

- PR state OPEN observation sonra story verified olsa da MC'de stale blocker kalır
- reviewer agent "done" dese de GitHub state farklıdır
- verify failure QA-FIX'e dönüştüğünde story lifecycle karmaşıklaşır

## 12 SUPERVISE

Amaç: Product supervisor story/final coherence denetimi yapmak.

Beklenen:

- deterministic checklist pass/block
- memory update
- visual/design warnings
- safe intervention

Sorun riski: Supervisor product, QA, static analyzer ve fixer rollerini aynı anda üstlenirse yanlış layer'da fix ister.

## 08 SECURITY-GATE

Amaç: security-sensitive source scan ve repo guard.

Beklenen: secret, unsafe sink, dangerous eval, sensitive storage gibi risklerin yakalanması.

Sorun riski: Security gate app semantics ile karışmamalı; sadece security contract'a bakmalı.

## 09 QA-TEST

Amaç: user-facing runtime QA ve structured QA report.

Beklenen:

- QA JSON artifact
- smoke/browser evidence
- real route/screen/button/form coverage
- QA-FIX story yalnızca açık, bounded issue için

Sorun riski: QA agent arbitrary test yazar veya hallucinated issue üretirse pipeline tamir döngüsüne girer.

## 10 FINAL-TEST

Amaç: deploy öncesi final runtime/evidence gate.

Beklenen: QA ile uyumlu machine-readable final-test artifact.

Sorun riski: final-test prose veya raw log ile pass sayılırsa son gate zayıflar.

## 11 DEPLOY

Amaç: tamamlanan project'i local/server runtime'a kaydetmek ve MC Projects'te gösterilebilir hale getirmek.

Beklenen:

- runtime port/domain metadata
- service registration
- project visibility
- stop/start semantics

Sorun riski: local port confusion, cancelled/failed old project cards, missing runtime URL.

## Cross-Step Problem

Pipeline şu anda her step'te birçok doğru koruma içeriyor, fakat failure routing geç kaldığında aynı problem yeni story/QA-FIX/supervisor cycle olarak geri geliyor. Dış modelin özellikle şunu incelemesi istenir:

Hangi failure'lar step içinde bitmeli, hangileri downstream QA-FIX'e taşınmalı, hangileri run'ı durdurup mimari/platform patch istemeli?

