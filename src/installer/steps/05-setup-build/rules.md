# SETUP-BUILD Step — Kurallar

Pipeline preClaim tüm heavy işi yaptı:
- `npm install` (package.json'daki tüm deps)
- `npm run build` (baseline doğrulama — başarılı olmalı)
- Compat engine (React 19 + testing-library vb uyumsuzluk varsa fail)
- Tailwind install (stitch/ HTML'lerinde tailwind class'ı varsa)
- `stitch-to-jsx.mjs` (stitch/*.html → src/screens/*.tsx auto-gen)
- Auto-commit (generated screens)

Build hatası varsa preClaim fail olurdu — buraya geldiğin an build yeşil.

## Senin işin — TEK ADIM

1. BUILD_CMD'i belirt (context'te hint var: `{{BUILD_CMD_HINT}}`)
2. Output yaz, `step complete` çağır

## Output

```
STATUS: done
BUILD_CMD: npm run build
```

- `BUILD_CMD`: Çoğunlukla `npm run build`. package.json scripts.build yoksa `tsc -p tsconfig.json`. Vanilla-ts ise `tsc`. Backend-only ise boş olabilir.

## Yapma

- `npm install` veya `npm run build` çalıştırma (preClaim yaptı)
- package.json değiştirme (compat engine baktı)
- src/ altında dosya oluşturma (implement step'in işi)
- Stitch generation (design step'in işi)

BUILD_CMD emin değilsen `npm run build` yaz — default doğru.
