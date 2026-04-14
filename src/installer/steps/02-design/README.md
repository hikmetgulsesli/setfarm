# 02-design — Design Step Modülü

Pipeline'ın ikinci step'i. Stitch API ile ekranları otomatik üretir, agent doğrular ve SCREEN_MAP + DESIGN_SYSTEM çıkarır.

## Input (context)

- `prd` (string) — plan step'ten gelen PRD
- `repo` (string) — proje dizini
- `device_type` (opsiyonel) — DESKTOP varsayılan

## Side Effect (preClaim)

Agent claim'i ÖNCE pipeline:
- Stitch project ensure
- PRD'den all screens generate
- HTML download (3 retry + tracking fallback)
- `stitch/DESIGN_MANIFEST.json` ve `stitch/*.html` üretir

Agent sadece doğrular — Stitch API'yi tekrar çağırmaz.

## Output (parsed)

- STATUS: done
- DEVICE_TYPE: DESKTOP | TABLET | MOBILE
- DESIGN_SYSTEM: JSON (aesthetic, palette, fonts)
- SCREEN_MAP: JSON array (screenId, name, type, description)

## Side Effects (onComplete)

- Context'e DESIGN_SYSTEM, SCREEN_MAP, device_type kaydeder
- design-contract'ları inşa eder
- screenshot'ları cache dizinine persist eder

## Files

- `rules.md` — design step kuralları
- `prompt.md` — agent template (`{{REPO}}`, `{{PRD_SCREEN_COUNT}}` template var)
- `preclaim.ts` — Stitch API entegrasyonu (heavy lifting)
- `context.ts` — claim-side context inject
- `guards.ts` — validate + onComplete
- `module.ts` — StepModule export

## Prompt Budget

`maxPromptSize: 10240` (10 KB). Design rules detaylı, plan'dan biraz büyük budget.
