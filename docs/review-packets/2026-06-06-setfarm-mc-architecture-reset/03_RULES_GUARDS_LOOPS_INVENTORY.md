# Rules, Guards, Gates, And Loops Inventory

Bu envanter dış modelin "hangi kurallar var, nerede fazla karmaşa var, hangileri korunmalı/silinmeli" sorusunu cevaplayabilmesi için hazırlanmıştır.

## Phase Boundary Rules

- PLAN sadece Product Contract üretmeli; repo path, branch, package name, physical screen list, runtime identity üretmemeli.
- DESIGN Product Surfaces'i Stitch artifact'larına bağlamalı; out-of-scope screen veya unmapped surface hard failure olmalı.
- STORIES PRD + SCREEN_MAP üzerinden story/scope üretmeli; hallucinated file path veya missing scope file fail olmalı.
- SETUP-BUILD design import, dependency install, baseline build ve generated screen setup certificate üretmeli.
- IMPLEMENT sadece story scope ve granted shared files içinde çalışmalı.
- VERIFY PR/comment/merge/post-merge state'i mekanik doğrulamalı.
- QA/FINAL-TEST agent prose değil, JSON/evidence/smoke sonucu ile tamamlanmalı.

## Design And Stitch Guards

- Unknown Material Symbols fallback yapmamalı; `stitch-to-jsx` fail etmeli.
- Material Symbols/icon font CSS generated runtime'a sızmamalı.
- `transition: all` gibi blanket CSS kuralları sanitize edilmeli veya fail edilmeli.
- `SCREEN_MAP`, `UI_CONTRACT`, `DESIGN_DOM`, `SCREEN_INDEX` birbirini tutmalı.
- SCREEN_MAP'teki her generated screen için dosya ve component olmalı.
- Generated screen'ler required props, action IDs, shell chrome ve regression gate'lerden geçmeli.
- Stitch raw HTML implement agent için primary context olmamalı; agent UI_CONTRACT/SCREEN_INDEX/claim summary üzerinden çalışmalı.

## Scope And Ownership Guards

- Her story için `.story-scope-files` veya resolved scope listesi olmalı.
- Story dışı dosya değişikliği fail veya hard block olmalı.
- Shared files sadece explicit grant ile düzenlenmeli.
- Implement agent staging/commit/push yapmamalı; Setfarm scoped commit/PR açmalı.
- Retry patch daha önce reddedilmiş deletion/change'i tekrar uygularsa runtime guard kill etmeli.
- Agent raw claim JSON parse loop'a girmemeli; `CLAIM_SUMMARY_FILE` kullanmalı.

## Runtime/Spawner Guards

`src/spawner.ts` içinde çok sayıda runtime discipline guard bulunur:

- gateway readiness wait/restart/backoff
- runtime usage limit cooldown
- stale OpenClaw task cleanup
- orphaned loop claim recovery
- untracked running single step retry
- process startup silent timeout
- model turn stalled watchdog
- hard stuck watchdog
- repeated tool/self-loop detection
- repeated write/edit no-op detection
- broad process cleanup ban (`pkill`, `killall` gibi)
- git discipline violation detection
- pre-delta context sprawl detection
- irrelevant reference context read detection
- generated screen shared read detection
- raw Stitch context read detection
- runtime guard repeat limit

Risk: Bu guard'lar gerçek sorunları yakalıyor, fakat fazla runtime discipline kuralı agent davranışını "kod yazma" yerine "guard kaçınma" oyununa çevirebilir.

## Build/Test/Smoke Gates

- `npm run build` baseline ve story sonrası gate olarak kullanılır.
- Step-specific tests ve project tests çalıştırılır.
- `scripts/smoke-test.mjs` runtime semantic issues yakalar: routes, buttons, generated screens, browser game static issues, weak interactions.
- Smoke failure QA-FIX story yaratabilir.
- QA-FIX loop guard gerekli; yoksa kalite aşaması yeni story üretip sonsuz döngü yaratır.

Risk: Smoke gate semantic bug yakalıyor ama geç yakalarsa story verified olduktan sonra QA-FIX açılıyor. Bu kullanıcıda "bitti sandık, tekrar bozuldu" algısı yaratıyor.

## PR/Review/Merge Guards

- Implement story sonunda Setfarm scoped commit oluşturur.
- Story PR açılır veya reuse edilir.
- Verify PR review comments okur.
- Actionable comment varsa implement'e geri route eder.
- PR state `MERGED` değilse verified olmamalı.
- Post-merge build/smoke gate çalışabilir.
- Review comment lifecycle şu anda event/observation olarak görünür ama açık FSM olarak yeterince birinci sınıf değildir.

Risk: Stale "PR state OPEN" observation daha sonra story verified olsa bile MC activity'de açık blocker gibi görünebilir. Event sourcing doğru, projection/read-model eksiktir.

## Supervisor Guards

- Product supervisor story ve final coherence denetler.
- Deterministic checklist static button, missing handler, missing generated screen, scope drift gibi sorunları yakalar.
- Supervisor memory ilerleyen story'lere geçmiş blocker context'i taşır.
- Visual QA katmanı ile design/code mismatch yakalanmaya çalışılır.

Risk: Supervisor hem PM hem QA hem static analyzer hem fixer gibi davranırsa yetki sınırı bulanıklaşır. Özellikle QA-FIX story'de supervisor checklist eski design beklentisiyle yeni runtime fix'i çarpıştırabilir.

## Evidence Rules

- Agent runtime correctness'i prose ile self-certify etmemeli.
- Agent `IMPLEMENT_INTENT.json` ve `IMPLEMENT_VERIFICATION_REQUEST.json` isteyebilir.
- Setfarm runtime'ı başlatmalı, interaction çalıştırmalı, screenshot/DOM/state capture almalı, `IMPLEMENT_EVIDENCE.json` yazmalı.
- Evidence gate `off|advisory|blocking` olabilir.
- Visual evidence ayrıca `off|advisory|blocking` olabilir.

Risk: Advisory modda missing request pass sayılırsa evidence sistemi görünür ama bağlayıcı değildir. Blocking moda erken geçilirse mevcut agent'lar çok fazla takılır.

## Platform Self-Heal Rules

- Default güvenli mod `plan_only` olmalı.
- Platform patch için classification, ownership map, write interceptor, rollback, patch registry, strictness delta gerekir.
- LLM kendi patch başarısını self-certify etmemeli.
- Immutable platform tests self-heal tarafından değiştirilememeli.
- `mc_visibility_bug` gibi geniş kategoriler daraltılmalı.

Risk: Self-heal smoke test'i gevşetirse veya guard'ı kaldırırsa başarı oranı artar ama platform bozulur.

## Mission Control Rules

- MC run/step/story status, observations, evidence filmstrip, PR status, runtime URL göstermeli.
- Cancelled/failed/stale cards kullanıcıyı yanıltmamalı.
- Activity ham event stream değil, projection/read-model olmalı.
- Evidence screenshot, DOM, runtime URL, port lifecycle görünür olmalı.

Risk: MC stale blocker veya old event'i açık sorun gibi gösterirse kullanıcı sisteme güvenmez.

