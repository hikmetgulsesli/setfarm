# 03-stories — Stories Step Modülü

Pipeline'ın üçüncü step'i. PRD + SCREEN_MAP'i alıp user story dekompozisyonu üretir.

## Input (context)

- `prd`, `repo` — plan'dan
- `screen_map`, `design_system`, `device_type` — design'dan
- `predicted_screen_files` — modülün injectContext'inde Stitch DESIGN_MANIFEST'ten hesaplanır

## Output (parsed)

- STATUS: done
- STORIES_JSON: array (her story zorunlu 9 alan)
- SCREEN_MAP: array with `stories` field

## Side Effects (onComplete)

1. `parseAndInsertStories` ile DB'ye kaydet
2. 0-story → fail
3. Eksik scope_files → fail
4. scope_files overlap → auto-fix (ilki sahiplenir, sonrakileri shared_files'a)
5. Hallucinated screen path → fail (predicted yollardan kullan)
6. Multi-owner screen → auto-fix
7. SCREEN_MAP auto-generate fallback (UI projects için)

## Files

- `rules.md` — kurallar
- `prompt.md` — agent template
- `context.ts` — predicted_screen_files inject + reminder
- `guards.ts` — validate + onComplete (tüm guardrail logic)
- `module.ts` — StepModule export

## Prompt Budget

`maxPromptSize: 12288` (12 KB). Stories rules en kapsamlı.
