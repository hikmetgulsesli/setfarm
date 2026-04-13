# Setfarm — Claude Session Talimatları

Bu dosya, Setfarm repo'sunda çalışan her Claude session tarafından otomatik okunur.

## CHANGELOG.md Güncellemesi (ZORUNLU)

Önemli değişiklik yaptığında `CHANGELOG.md` dosyasını GÜNCELLE. En tepeye yeni entry ekle.

### Önemli Değişiklik Kriterleri
- Yeni feature
- Kritik bug fix
- Architectural değişiklik
- Performance iyileştirme
- Security fix
- Template/prompt değişikliği (workflow.yml, polling-prompt.md)
- DB migration
- Config değişikliği (openclaw.json, agents)

### Önemsiz (Changelog'a eklenmez)
- Typo fix
- Tek satır log değişikliği
- Comment güncellemesi
- Format/whitespace

### Format

```markdown
## YYYY-MM-DD — Kısa Başlık

### Büyük Değişiklik (varsa — architectural shift)
Açıklama — ne yapıldı, **neden**

### Teknik Değişiklikler

**Modül Adı (commit hash):**
- Detay 1
- Detay 2

**Başka Modül (commit hash):**
- Detay

### Kritik Bug Fix'ler
- Sorun + fix özeti (commit hash)

### Performans
- Metrik + sonuç

### Doğrulama
- Test run numarası + sonuç
- Hangi senaryo test edildi

---
```

### Kurallar
1. **Türkçe yaz** (teknik terimler hariç)
2. **Commit hash'leri ekle** — referans için
3. **En tepeye ekle** — kronolojik sıra (yeni üstte)
4. **Git commit** ayrı yap: `docs: changelog update for <tarih>`
5. **Push et** — sunucudaki `/changelog` sayfası push'tan sonra güncellenir

### Otomatik Tetikleme

Kullanıcı "bitti", "session'ı kapat", "deploy et" dediğinde veya büyük bir commit serisi tamamlandığında otomatik güncelle. Sor değil, YAP.

## MC CHANGELOG

MC'de değişiklik varsa `~/projects/mission-control/CHANGELOG.md` dosyasını da güncelle. Aynı format.

## /changelog Sayfası

Sunucuda `https://ai.setrox.com.tr/changelog` sayfası CHANGELOG.md'yi render ediyor. MC ve Setfarm changelog ayrı sekmelerde değil, üst üste gösteriliyor. Push + MC restart → sayfa güncellenir (30s cache TTL).

## Diğer Talimatlar

- **Sunucu asıl kaynak**: Her değişiklik öncesi `ssh setrox@192.168.1.198` ile sunucudaki dosyayı kontrol et
- **Proje isimlerinde random numara**: Test run başlatırken `sayac-app-XXXXX` formatı
- **Model config değiştirme**: Kullanıcı onayı olmadan ASLA
- **Çalışan run'lara dokunma**: Sadece raporla, müdahale etme
