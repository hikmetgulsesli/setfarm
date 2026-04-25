# Verify Step — Story PR Gate

Görev: Tek bir story PR'ını kontrol et, review/CI yorumlarını düzelt, PR'ı `main`e merge et, sonra local `main`i güncelle.

## Context

- `{{REPO}}` — proje kök dizini
- `{{BRANCH}}` — run/setup branch; story merge hedefi değil
- `{{CURRENT_STORY}}` — doğrulanacak story
- `{{PR_URL}}` — doğrulanacak story PR'ı
- `{{PREFLIGHT_ANALYSIS}}` — static analysis raporu
- `{{PR_COMMENTS}}` — Copilot/human review yorumları
- `{{PR_CHECK_STATE}}` — passing/failing/pending
- `{{PR_MERGEABLE}}` — MERGEABLE/CONFLICTING/UNKNOWN
- `{{PLAYWRIGHT_REPORT}}` — runtime/visual smoke raporu

## Zorunlu Akış

1. `cd "{{REPO}}"`.
2. `git fetch origin --prune`.
3. PR bilgilerini oku:
   - `gh pr view "{{PR_URL}}" --json state,headRefName,baseRefName,mergeable,reviews,comments,statusCheckRollup`
   - Inline yorumlar için: `gh pr diff "{{PR_URL}}"` ve `gh api repos/<owner>/<repo>/pulls/<num>/comments`.
4. PR açık değilse:
   - `MERGED` ise `git checkout main && git pull --ff-only origin main`, sonra `STATUS: done`.
   - Diğer durumlarda `STATUS: retry` ve sebebi yaz.
5. PR branch'ine geç:
   - `HEAD_BRANCH=$(gh pr view "{{PR_URL}}" --json headRefName --jq .headRefName)`
   - `git checkout "$HEAD_BRANCH" && git pull --ff-only origin "$HEAD_BRANCH"`.
6. `{{PR_COMMENTS}}`, review body'leri, inline comments, failing checks, `{{PREFLIGHT_ANALYSIS}}`, `{{PLAYWRIGHT_REPORT}}` içindeki gerçek sorunları düzelt.
7. Düzeltme yaptıysan:
   - `git add <changed-files>`
   - `git commit -m "fix(review): address {{CURRENT_STORY_ID}} feedback"`
   - `git push origin "$HEAD_BRANCH"`.
8. Lint/build/test çalıştır:
   - `{{LINT_CMD}}`
   - `{{BUILD_CMD}}`
   - `{{TEST_CMD}}`
   Hata varsa düzelt, commit/push et. Altyapı komutu boşsa atla.
9. PR'a kısa comment at: `gh pr comment "{{PR_URL}}" --body "Verified: review feedback addressed, checks run."`
10. PR'ı merge et:
    - önce `gh pr merge "{{PR_URL}}" --squash --delete-branch`
    - olmazsa sebebi oku; conflict/check/review blocker varsa `STATUS: retry`.
11. Merge doğrula:
    - `gh pr view "{{PR_URL}}" --json state --jq .state` sonucu `MERGED` olmalı.
12. Local main'i kesin güncelle:
    - `git fetch origin main`
    - `git checkout main`
    - `git pull --ff-only origin main`
    - `git status --short` temiz olmalı.

## Output

```
STATUS: done|retry|skip|fail
FEEDBACK: <retry/fail ise kısa sebep>
```

`STATUS: done` sadece PR gerçekten `MERGED` olduktan ve local `main` güncellendikten sonra yazılır.
