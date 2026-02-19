# Lessons Learned — Feature-Dev Pipeline

Bu dosya geçmiş pipeline hatalarından çıkarılan derslerdir. Tüm agent'lar bu kuralları takip etmelidir.

## Son Günceleme: 2026-02-18

---

## 1. Story'leri Gerçekten Implement Et
**Sorun:** AgentViz v2 Run #4'te agent'lar story'leri "done" olarak işaretledi ama gerçek kodu yazmadı. 16 story'den 13'ü "done" idi ama repo'da sadece scaffolding vardı — componentler, hook'lar, server kodu yoktu.

**Kural:** Her story bittiğinde:
- Oluşturulan dosyaları listele
- `npm run build` ve `npm test` geçtiğini doğrula
- Sadece "STATUS: done" yazma — gerçekten çalışan kod ürettiğinden emin ol
- Component story ise: component dosyası + CSS + test dosyası olmalı

---

## 2. SSL Sertifika Sorunu
**Sorun:** US-013 (Nginx reverse proxy) story'sinde agent `certbot` ile Let's Encrypt sertifika almaya çalıştı. Ancak:
- certbot kurulu değildi
- Cloudflare Access ACME challenge'ı engelledi
- Agent 5 kez timeout yedi, aynı döngüye girdi

**Kural:** Bu sunucuda (moltclaw):
- Tüm domain'ler Cloudflare proxy arkasında
- Let's Encrypt KULLANMA
- Self-signed origin cert kullan: `/etc/nginx/ssl/origin.crt` ve `/etc/nginx/ssl/origin.key`
- Cloudflare "Full" SSL mode'da, origin cert yeterli

---

## 3. sudo Gerektiren İşlemler
**Sorun:** Agent'lar sudo gerektiren komutları çalıştıramıyor, timeout'a giriyor.

**Kural:**
- `sudo` gerektiren bir adım varsa, story output'unda bunu belirt
- Alternatif yol ara (user-level service, user dizinine yazma vs.)
- Çözülemiyorsa story'yi "blocked: sudo required" olarak işaretle, sonsuz döngüye girme

---

## 4. Stuck Recovery
**Sorun:** Step'ler stuck olunca sadece retry ediliyordu, aynı hataya tekrar düşüyordu.

**Çözüm:** Mission Control'de Smart Stuck Recovery v2 devrede:
- Stuck step'in log'u analiz edilir
- Bilinen hata pattern'leri tespit edilir (SSL, permission, rate limit, network, dependency, missing tool)
- Fixable hatalar otomatik düzeltilir
- 3+ retry'den sonra story otomatik skip edilir

---

## 5. Pipeline Pratik Kurallar
- `npm install` başarısız olursa → dependency_error, tekrar dene
- Rate limit (429) alırsan → story'yi skip et, sonrakine geç
- Network hatası varsa → kısa süre bekle, tekrar dene
- Build başarısız olursa → hata mesajını oku, düzelt, tekrar dene
- Test başarısız olursa → testi geç, ileride fixle

---

## 6. Sunucu Bilgileri
- **OS:** Ubuntu (moltclaw)
- **User:** setrox
- **Projeler:** ~/.openclaw/ altında
- **Nginx:** Self-signed cert /etc/nginx/ssl/origin.{crt,key}
- **Cloudflare:** Tüm *.setrox.com.tr domain'leri CF proxy arkasında
- **Node:** Sistem node'u kullan
- **certbot:** Kurulu ama Cloudflare Access yüzünden çalışmıyor, KULLANMA
