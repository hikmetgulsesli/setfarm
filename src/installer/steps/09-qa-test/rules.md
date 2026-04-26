# QA Test Kuralları

## Retry tetikleri (STATUS: retry)

- Build fail veya dev server crash
- Ana happy path kırık (acceptance criteria karşılanmıyor)
- Runtime console.error spam
- Kritik button/form çalışmıyor
- localStorage persist kırık (reload sonrası veri kayboluyor)
- Responsive layout 1440x900'de bozuk

## Pass kriterleri (STATUS: done)

- Tüm story acceptance criteria runtime'da kanıtlanmış
- Build + dev server temiz
- Happy path + 1-2 edge case çalışıyor
- Console temiz (veya sadece dev warning)

## Skip kriterleri (STATUS: skip)

- Proje pure-library/no-UI ise
- Sadece dokümantasyon/config değişimiyse

## TEST_FAILURES formatı

Her madde: screen/component + aksiyon + beklenen vs actual.

```
TEST_FAILURES:
- Ana akış ekranında birincil buton tıklandığında beklenen state değişmiyor (beklenen: PRD aksiyonu tamamlandı, actual: unchanged). Console: "Cannot read property 'value' of null"
- Liste/form state'i reload sonrası kayboluyor (beklenen: persistence restore, actual: empty)
- Mobile viewport'ta ana bileşen %150 overflow — horizontal scroll
```
