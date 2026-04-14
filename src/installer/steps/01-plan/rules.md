# PLAN Step — Kurallar

PLAN step ÇIKTISI: detaylı PRD + teknik kararlar. PRD agent tarafından **iyi hazırlanırsa** sonraki adımlar (design, stories, implement) çok daha az retry alır. Yetersiz PRD = pipeline R1 fırtınası.

## Zorunlu Çıktı Alanları

```
STATUS: done
REPO: $HOME/projects/<slug>
BRANCH: <branch-name>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
PRD:
<PRD gövdesi — en az 2000 karakter, Türkçe, aşağıdaki TÜM bölümleri içerir>
PRD_SCREEN_COUNT: <Ekranlar tablosundaki satır sayısı, min 3>
DB_REQUIRED: <none|postgres|sqlite>
```

## PRD ZORUNLU BÖLÜMLER (her biri MUTLAKA olmalı)

### 1. Genel Bakış
- Ne olduğunu 2-3 cümlede özetle
- Hedef kitle (kim kullanacak)
- Türkçe arayüz vurgusu

### 2. Hedefler
- 4-6 madde halinde projenin ana hedefleri
- "Erişilebilir tasarım", "Mobil uyumlu", "Hızlı yükleme" gibi somut

### 3. Tech Stack Detayı
- Framework: React 18 / Next.js 14 / vb.
- Build: Vite / Webpack
- Styling: Tailwind / CSS Modules
- State: useState/useReducer / Zustand / Redux
- Storage: localStorage / IndexedDB / Postgres
- Routing: React Router / Next.js routing

### 4. Fonksiyonel Gereksinimler
Her özellik için ayrı alt bölüm. Örnek:

```
4.1 Fotoğraf Yükleme
- Desteklenen formatlar: JPG, PNG, WEBP, GIF
- Max boyut: 10 MB
- Zorunlu/opsiyonel alanlar listesi
- Hata mesajları (Türkçe, kullanıcıya gösterilen tam metin)
- Başarı durumu davranışı

4.2 Filtreleme
- Hangi alanlardan filtrelenir
- Default davranış (hepsini göster vb)
```

### 5. Veri Modeli
- Entity'ler: User, Photo, Category vb.
- Her entity'nin alanları + tipleri
- localStorage / DB schema şekli

### 6. UI/UX Gereksinimleri

#### 6.1 Design System Seçimi (MANDATORY for frontend)
- **Aesthetic:** minimal | brutalist | luxury | editorial | industrial | organic | playful | corporate
- **Renk Paleti:** Primary, Secondary, Background, Surface, Text, Border, Success, Error, Warning hex değerleri
- **Tipografi:** Heading font + Body font (Font Pair table'dan)
- **Icon Library:** Lucide React veya Heroicons (NEVER emoji)

#### 6.2 Spacing & Components
- Spacing scale: 4/8/16/24/32/48/64 px
- Border radius değerleri
- Shadow tanımları
- Buton/kart/form pattern'leri

### 7. Non-Functional Requirements

#### 7.1 Performans
- İlk yükleme < 2 saniye
- Sayfa geçişi < 100ms
- Bundle size hedefi

#### 7.2 Erişilebilirlik (WCAG 2.1 AA)
- Klavye navigasyonu tam destek
- Screen reader uyumlu (ARIA labels)
- Kontrast oranı >= 4.5:1 (text), 3:1 (large text)
- Focus state tüm interactive elementlerde
- Touch hedefleri >= 44x44 px

#### 7.3 Tarayıcı Desteği
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- iOS Safari 14+, Android Chrome 90+
- Responsive: mobile 320px+ → desktop 1920px+

### 8. Proje Yapısı

```
src/
├── components/      # Reusable bileşenler
├── screens/         # Ekran (page) bileşenleri — Türkçe isimle
├── hooks/           # Custom React hooks
├── utils/           # Helper fonksiyonlar
├── types/           # TypeScript tipleri
├── App.tsx
└── main.tsx
```

### 9. Window State (testing/dogfood için)

```
window.app = {
  state: '<idle|loading|error|...>',
  // diğer önemli state alanları
}
```

### 10. Ekranlar (zorunlu tablo)

```
| # | Ekran Adı | Tür | Açıklama |
|---|-----------|-----|----------|
| 1 | Ana Sayfa | dashboard | KPI kartları, son aktiviteler |
| 2 | ...
```

**Min 3 satır.** Her satır benzersiz screen. Modal'lar, empty state'ler, error sayfaları da DAHIL.

### Min Screen Counts
- Landing/static: 3-5
- Game (web/mobile): 5-8
- Dashboard/analytics: 8-15
- CRUD app: 10-15
- CRM/SaaS: 20-35

## TECH_STACK Seçimi

- `vite-react`: SPA, oyun, dashboard, utility, portfolio (default)
- `nextjs`: SSR/SEO, blog, e-ticaret, çok sayfalı içerik
- `vanilla-ts`: CLI, minimal web utility
- `node-express`: Sadece API, UI yok
- `react-native`: Mobil

Belirsizse `vite-react`. Görev framework belirtirse onu kullan.

## DB_REQUIRED

- `none`: Static, portfolio, oyun, local-storage uygulama
- `postgres`: User data, CRUD, auth gerektiren
- `sqlite`: Sadece açıkça istenirse

Belirsizse `none`.

## REPO ve BRANCH

- REPO: `$HOME/projects/<slug>` — slug görev başlığından (kebab-case, Türkçe transliterasyonlu)
- BRANCH: `feature-<name>` veya proje adı (kebab-case)

## Türkçe UI Stil Kuralları

- Buton: "Kaydet", "Sil", "Düzenle", "Ekle", "Yükle", "Ara"
- Menü: "Ana Sayfa", "Ayarlar", "Profil", "Çıkış"
- Hata: "Lütfen zorunlu alanları doldurun", "Bu işlem geri alınamaz"
- Placeholder: "Ara...", "E-posta adresiniz"
- Boş durum: "Henüz veri yok", "Sonuç bulunamadı"

## Yapma

- Stories yazma — bir sonraki step'in işi
- Kod yazma — sen planlayıcısın
- Belirsiz "modern tasarım" gibi ifadeler — somut ol
- Renk paleti vermeden geçme — tüm hex değerleri belirt
- Erişilebilirlik bölümünü atlama
- Min 3 ekran tablosu — boş bırakma
- PRD < 2000 karakter — yetersiz
