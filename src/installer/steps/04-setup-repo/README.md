# 04-setup-repo — Setup Repo Step Modülü

Plan+Design+Stories sonrası. Git repo hazırlar, scaffold yapar, DB provision eder, design contract'larını yazar.

## Input (context)

- `repo`, `branch`, `tech_stack`, `db_required` — plan'dan
- `screen_map` — design'dan (contract building için)
- stitch/* — design preClaim'den

## Side Effects (preClaim — heavy)

1. `setup-repo.sh` çağırır (git init + branch + scaffold by tech_stack)
2. Missing BRANCH'ı main'den oluşturur
3. `processSetupCompletion` — DB_REQUIRED=postgres ise DB provision
4. `processSetupDesignContracts` — stitch HTML'lerinden table/route/component contract'ları üretir
5. updated_at refresh

## Output (parsed)

- STATUS: done
- EXISTING_CODE: false|true

## Side Effects (onComplete)

- context'e existing_code stamp

## Prompt Budget

`maxPromptSize: 6144` (6 KB) — kısa iş.

## Files

README + rules + prompt + context + guards + preclaim + module
