# Company Model And Agent Roles

## Desired Product Metaphor

Kullanıcı Setfarm + Mission Control'u bir şirket gibi izlemek istiyor:

- Patron/CEO en tepeden durumu görür.
- Product manager ne yapılacağını ve kabul kriterlerini bilir.
- Designer tasarımı üretir.
- Developer kodlar.
- Reviewer PR ve yorumları denetler.
- QA ürünü kullanır gibi test eder.
- Security güvenlik risklerini denetler.
- Deployer yayınlar.
- Supervisor kalite ve ürün bütünlüğünü takip eder.
- Mission Control tüm bu işi canlı gösterir.

Bu UI sadece "pipeline step done" göstermemeli; hangi agent hangi story'de, hangi dosyada, hangi PR comment'i, hangi gate, hangi runtime evidence üzerinde çalışıyor göstermeli.

## Existing Agents

`workflows/feature-dev/workflow.yml` içinde roller:

- planner
- designer
- setup-repo
- setup-build
- developer
- reviewer
- supervisor
- security-gate
- qa-tester
- tester/final-test
- deployer

Bu rol seti kağıt üzerinde yeterlidir. Sorun sadece agent sayısı değildir; yetki sınırları net değildir.

## Core Role Boundary Question

Agent ne yapmalı?

- intent'i anlamalı
- scoped kod değişikliği yapmalı
- eksik gördüğü şeyi raporlamalı
- verification request önermeli

Setfarm ne yapmalı?

- scope enforcement
- build/test/smoke/evidence execution
- PR creation/merge state verification
- runtime port lifecycle
- completion decision
- MC observations

Supervisor ne yapmalı?

- product coherence ve policy denetimi
- repeated failure pattern'lerini sınıflandırma
- safe/bounded intervention önerme

Supervisor ne yapmamalı?

- rastgele platform kodu patch'lemek
- kendi fix'ini kendi onaylamak
- smoke test'i gevşetmek
- developer/QA/PM rollerini tek başına yutmak

## Do We Need More Agents?

Muhtemel cevap daha fazla agent değil, daha net authority modelidir.

Gerekebilecek yeni logical role'ler:

- Evidence Runner: agent değil, Setfarm-owned runtime executor.
- Platform Architect Reviewer: self-heal patch planını insan/onay öncesi analiz eden rol.
- MC Projection Owner: event/read-model doğruluğunu denetleyen sistem rolü.

Ama yeni LLM agent eklemek tek başına çözüm değildir. Fazla agent, daha fazla yorum ve daha fazla çelişkili claim üretebilir.

## Recommended Question For Gemini/Sonnet

Mevcut roller korunmalı mı? Yoksa sistemi şu şekilde yeniden mi kurmalıyız:

- fewer LLM agents
- stronger deterministic orchestrator
- explicit evidence runner
- explicit review FSM
- MC as event-sourced operations board

Hangi görevler kesinlikle LLM'e verilmemeli?

