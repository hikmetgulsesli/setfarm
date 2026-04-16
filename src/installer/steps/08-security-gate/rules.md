# Security Gate Kuralları

## Retry tetikleri (STATUS: retry)

- Hardcoded secret (API key, JWT secret, bcrypt salt)
- Unsafe HTML render (user input escape edilmeden DOM'a enjekte ediliyor)
- SQL string concat, raw `exec`/`spawn` user input
- Auth bypass: `if (user)` ama user null-check eksik
- CORS `*` wildcard + credentials
- localStorage'da plain password/token
- eval/Function constructor dinamik input

## Pass kriterleri (STATUS: done)

- Hiçbir hardcoded secret yok (env veya secret manager kullanılıyor)
- User input düzgün escape/sanitize edilmiş
- Auth flow'da client-side trust yok
- Dependencies audit temiz (veya kritik fail yok)

## Skip kriterleri (STATUS: skip)

- Proje dosya üretmediyse (zero-work)
- Sadece docs/config değişimi ise

## VULNERABILITIES formatı

Her madde: dosya:satır + kategori + kısa açıklama.

```
VULNERABILITIES:
- src/api/users.ts:42 — SQL Injection: `query(\`SELECT * FROM users WHERE id=${req.params.id}\`)` — parametrize et
- .env.example:5 — Hardcoded JWT secret "supersecret123" committed — rotate + .gitignore
- src/ui/RichText.tsx:18 — XSS via unsafe HTML sink (user.bio render edilmeden önce DOMPurify kullan)
```

Aksiyon edilebilir tek satır maddeler. Uzun explanation yazma.
