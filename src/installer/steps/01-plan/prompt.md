PLAN step — {{TASK}}

Görevinden bir PRD (ürün gereksinimleri) üret ve teknik kararları ver. Kurallar bu promptun altındaki `Kurallar` bölümünde gömülü olarak verilir; `rules.md` dosyasını okumaya çalışma.

## Görev

{{TASK}}

## Yapılacaklar

1. Görevi oku, ürünü anla
2. PRD yaz (Türkçe, >=500 karakter, Ekranlar tablosu min 3 satır)
3. TECH_STACK ve DB_REQUIRED seç
4. REPO path ve BRANCH adı belirle
5. Aşağıdaki formatta çıktı ver

## Çıktı Formatı

```
STATUS: done
REPO: $HOME/projects/<slug>
BRANCH: <branch-name>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
PRD:
<PRD gövdesi>
PRD_SCREEN_COUNT: <sayı>
DB_REQUIRED: <none|postgres|sqlite>
```

Her alan zorunlu. JSON değil, KEY: VALUE satırları. PRD çok satır olabilir, diğer alanlar tek satır.
