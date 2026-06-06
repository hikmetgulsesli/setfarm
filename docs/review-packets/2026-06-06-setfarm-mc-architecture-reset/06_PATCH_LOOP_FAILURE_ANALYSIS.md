# Patch Loop Failure Analysis

## Symptom

Son run'larda ana story'ler "done" veya "verified" olabiliyor, ancak daha sonra QA/smoke/supervisor yeni bir problem buluyor. Sistem QA-FIX story açıyor, agent düzeltmeye çalışıyor, supervisor tekrar başka checklist blocker yakalıyor. Kullanıcı açısından bu "bitmeyen yama döngüsü" gibi görünüyor.

## Recent Failure Classes

### Design Import Gap

Unknown Material icon veya Stitch CSS sorunları setup-build'de patlamalı. Daha önce fallback icon/CSS sızıntısı downstream'e taşındı.

Doğru layer: `stitch-to-jsx` + setup-build hard gate.

### Generated Screen Coverage Mismatch

SCREEN_MAP iki ekran isterken generated screen tek dosya olabiliyor. Run completed görünse bile design/code mismatch kalabiliyor.

Doğru layer: setup-build certificate + generated-screen-validator hard gate.

### Runtime State Not Reflected In UI

Game state ilerliyor olabilir ama ekranda hareket yoktur. Build/test/action handler pass bunu yakalamaz.

Doğru layer: runtime evidence/test bridge/smoke gate. Fakat bu implement sonrasında erken yakalanmalı, QA-FIX'e geç kalmamalı.

### Agent Self-Review Weakness

Agent "build/test geçiyor, runtime hazır" diyebilir ama orchestrator-owned screenshot/DOM/state yoksa bu iddia zayıftır.

Doğru layer: implement evidence runner, not agent prose.

### QA-FIX Loop

QA veya verify smoke failure sonrası QA-FIX story açılır. QA-FIX mevcut screen'i düzeltirken supervisor eski checklist ile yeni layout/runtime fix'i çarpıştırabilir.

Doğru layer: failure routing policy. Bazı smoke failures QA-FIX değil, previous story implement retry veya platform bug olmalı.

### Stale MC Observation

PR state OPEN veya actionable comment blocked observation daha sonra resolved/verified olsa bile ham activity'de açık sorun gibi görünebilir.

Doğru layer: MC projection/read-model, not event deletion.

### PR/Verify Ambiguity

Reviewer PR comments çözüldü der, PR state hala OPEN görünebilir, sonra auto-merge/verified observation gelir. Bu lifecycle açık FSM değilse kullanıcı ne olduğunu anlayamaz.

Doğru layer: PR comment/PR state FSM.

## Why More Patches Are Not Enough

Her yeni bug için yeni guard eklemek kısa vadede doğru görünür. Ama toplamda:

- agent prompt şişer
- spawner guard sayısı artar
- MC activity gürültülü olur
- failure routing anlaşılmaz hale gelir
- QA-FIX yeni story olarak sistemi tekrar kirletir
- stack-agnostic hedef zayıflar

Bu yüzden dış modelden istenen ana analiz: Hangi kontroller platform invariant olarak kalmalı, hangileri kaldırılmalı veya stack evidence contract'a taşınmalı?

## Architectural Smell

Şu dosyalar/katmanlar çok fazla sorumluluk taşıyor olabilir:

- `src/installer/step-ops.ts`: lifecycle, PR, QA-FIX, verification, routing, side effects.
- `src/spawner.ts`: process manager, runtime guard, supervisor signal, gateway health, claim recovery.
- `src/server/index.html`: UI projection, activity rendering, evidence filmstrip.
- supervisor layer: product PM + static analyzer + fixer + QA sinyalleri.

## Core Reset Question

Setfarm bir "agent orchestration platform" mu, yoksa "LLM destekli compiler/evidence pipeline" mı?

Eğer ikincisiyse:

- completion sadece machine evidence ile olur
- agent output advisory kalır
- failure routing table küçük ve mekanik olur
- QA-FIX sınırlı ve nadir olur
- MC projection event log'dan türetilir
- self-heal plan-only veya approval-only başlar

