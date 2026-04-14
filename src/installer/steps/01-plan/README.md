# 01-plan — Plan Step Modülü

Pipeline'ın ilk step'i. Görev metninden PRD ve teknik kararlar üretir.

## Input

- `task` (string) — run.task (kullanıcının verdiği görev açıklaması)

## Output (parsed)

- STATUS: done
- REPO: string (absolute path)
- BRANCH: string (kebab-case)
- TECH_STACK: enum (vite-react | nextjs | vanilla-ts | node-express | react-native)
- PRD: string (min 500 char, Turkish, includes Ekranlar table)
- PRD_SCREEN_COUNT: int (min 3)
- DB_REQUIRED: enum (none | postgres | sqlite)

## Side Effects

`onComplete` çağrıldığında:
- PRD DB'nin `prds` tablosuna yazılır
- REPO path ve TECH_STACK context'e kaydedilir (sonraki step'ler için)

## Files

- `rules.md` — agent'ın uyacağı kurallar (prompt'a resolved)
- `prompt.md` — agent template (`{{TASK}}` var'ı içerir)
- `module.ts` — StepModule export (`planModule`)
- `guards.ts` — validateOutput + onComplete
- `context.ts` — injectContext (sadece TASK inject)

## Prompt Budget

`maxPromptSize: 8192` bytes. Agent'a giden toplam prompt (prompt.md + rules.md + inject'lenmiş TASK) bu sınırı aşamaz.

## Test

```
node --import tsx --test tests/steps/01-plan.test.ts
```

5 senaryo: happy path, short PRD, missing screen count, invalid tech stack, prompt size.
