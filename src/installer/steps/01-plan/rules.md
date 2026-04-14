# PLAN Step — Kurallar

PLAN step görevin ürünü: bir PRD (ürün gereksinimleri dokümanı) + teknik kararlar.

## Zorunlu Çıktı Alanları

Output KEY: VALUE formatında (JSON DEĞİL):

```
STATUS: done
REPO: $HOME/projects/<slug>
BRANCH: <kebab-case-branch-name>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
PRD:
<PRD gövdesi — en az 500 karakter, Türkçe>
PRD_SCREEN_COUNT: <Ekranlar tablosundaki satır sayısı, min 3>
DB_REQUIRED: <none|postgres|sqlite>
```

## PRD Gereksinimleri

- Türkçe yazılır. Teknik terimler (API, CSS, HTML, TypeScript) İngilizce kalır
- En az 500 karakter
- **Ekranlar** başlıklı bir tablo içermeli — her satır bir ekran. Minimum 3 ekran
- Her özellik açık (belirsiz "kullanıcı deneyimi" yok, "form validasyonu: email, telefon" gibi somut)
- Her ekran için: isim, amaç, ana etkileşimler

## TECH_STACK Seçimi

- `vite-react`: SPA, oyun, dashboard, utility, portfolio — varsayılan React
- `nextjs`: SSR/SEO, blog, e-ticaret, çok sayfalı içerik
- `vanilla-ts`: CLI, minimal web utility
- `node-express`: Sadece API, UI yok
- `react-native`: Mobil uygulama

Belirsizse vite-react seç. Görev açıkça framework belirtirse onu kullan.

## DB_REQUIRED Seçimi

- `none`: Static site, portfolio, landing, oyun, local-storage uygulama
- `postgres`: Kullanıcı data, CRUD, auth gerektiren uygulama
- `sqlite`: Nadir, sadece açıkça istenirse

Belirsizse `none` seç.

## REPO ve BRANCH

- REPO: `$HOME/projects/<slug>` — slug görev başlığından türetilir (kebab-case, Türkçe karakterler transliterasyonlu)
- BRANCH: `feature-<name>` veya proje adı — kebab-case

## PRD Stil Kuralları

- Türkçe UI metinleri: "Hesapla", "Kaydet", "Sil", "Düzenle", "Ana Sayfa", "Ayarlar"
- Hata mesajları: "Lütfen zorunlu alanları doldurun"
- Placeholder: "Ara...", "E-posta adresiniz"

## Yapılmayacaklar

- Stories, user stories YAZMA — bu başka bir step'in işi
- Kod yazma — sen planlayıcısın
- Belirsiz ifadeler ("modern tasarım", "kullanıcı dostu") kullanma — somut gereksinim yaz
- Ekran tablosunda 2'den az satır bırakma
