# Setfarm + Mission Control Architecture Reset Review Packet

Bu paket Gemini, Sonnet veya başka bir kıdemli platform mimarı modeline verilmek üzere hazırlanmıştır. Amaç mevcut Setfarm + Mission Control yapısını savunmak değil; sistemi adversarial şekilde inceletip reaktif yama döngüsünden çıkaracak mimari reset kararını netleştirmektir.

## Ana Soru

Setfarm şu anda çok sayıda guard, supervisor, QA-FIX, smoke, PR, runtime ve self-heal davranışıyla çalışıyor. Buna rağmen her yeni generated project run'ında yeni bir davranış hatası çıkıyor ve sistem sürekli yama eklemeye zorluyor.

Bu sistem:

- mevcut haliyle sadeleştirilerek devam etmeli mi?
- compiler/evidence factory olarak yeniden mi tasarlanmalı?
- self-healing supervisor ile kendi kendini düzeltmeli mi?
- yoksa agent yetkileri azaltılıp Setfarm orchestrator daha mekanik hale mi gelmeli?

## Okuma Sırası

1. `01_SYSTEM_ARCHITECTURE_MAP.md`
2. `02_FILE_INVENTORY_SETFARM_MC.md`
3. `03_RULES_GUARDS_LOOPS_INVENTORY.md`
4. `04_PIPELINE_BEHAVIOR_BY_STEP.md`
5. `05_COMPANY_MODEL_AND_AGENT_ROLES.md`
6. `06_PATCH_LOOP_FAILURE_ANALYSIS.md`
7. `07_SELF_HEAL_SUPERVISOR_DECISION.md`
8. `08_GEMINI_SONNET_QA_PROMPT.md`
9. `09_SOURCE_ATTACHMENT_MANIFEST.md`

## Kullanım

Gemini/Sonnet'e önce bu klasördeki Markdown dosyalarını verin. Model daha fazla kanıt isterse `09_SOURCE_ATTACHMENT_MANIFEST.md` içindeki "öncelikli ekle" kaynak dosyalarını da ekleyin.

## Güvenlik Notu

Bu pakete `.env`, API key, local transcript, generated project `node_modules`, token veya credential eklenmemelidir. Kod path'leri ve hata isimleri korunmuştur; secret değerler bilinçli olarak dahil edilmemiştir.

## Beklenen Çıktı

Dış modelden istenen çıktı:

- kök teşhis
- gereksiz veya zararlı katmanlar
- korunması gereken katmanlar
- hedef mimari
- self-heal kararı
- Mission Control görünürlük modeli
- implement edilebilir refactor planı
- riskler ve test stratejisi

