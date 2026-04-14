// Test harness for step modules. Mocks the minimal contract each module
// touches (context, parsed output) so unit tests don't need a real DB or
// running gateway. onComplete side effects that hit the DB are caught
// and returned as an "error" status — tests can opt in to verifying
// the call shape without actually writing.

import type { StepModule, ClaimContext, ParsedOutput, CompleteContext } from "../../dist/installer/steps/types.js";

export interface HarnessResult {
  prompt: string;
  promptBytes: number;
  validation: { ok: boolean; errors: string[] };
  contextAfterComplete: Record<string, string>;
  onCompleteCalled: boolean;
  onCompleteError?: string;
}

export async function runModule(
  m: StepModule,
  task: string,
  mockAgentOutput: ParsedOutput
): Promise<HarnessResult> {
  const context: Record<string, string> = {};
  const claimCtx: ClaimContext = {
    runId: "test-run-" + Math.random().toString(36).slice(2, 10),
    stepId: m.id,
    task,
    context,
  };

  await m.injectContext(claimCtx);
  const prompt = m.buildPrompt({ runId: claimCtx.runId, task, context });
  const validation = m.validateOutput(mockAgentOutput);

  let onCompleteCalled = false;
  let onCompleteError: string | undefined;
  if (validation.ok && m.onComplete) {
    onCompleteCalled = true;
    try {
      const completeCtx: CompleteContext = {
        runId: claimCtx.runId,
        stepId: m.id,
        parsed: mockAgentOutput,
        context,
      };
      await m.onComplete(completeCtx);
    } catch (e) {
      onCompleteError = String(e).slice(0, 300);
    }
  }

  return {
    prompt,
    promptBytes: Buffer.byteLength(prompt, "utf-8"),
    validation,
    contextAfterComplete: context,
    onCompleteCalled,
    onCompleteError,
  };
}

export function validPlanOutput(overrides: Partial<ParsedOutput> = {}): ParsedOutput {
  return {
    status: "done",
    repo: "$HOME/projects/test-app-12345",
    branch: "feature-test-app",
    tech_stack: "vite-react",
    prd: "# Test App PRD\n\n" +
      "## 1. Genel Bakış\nBu bir test not tutma uygulamasıdır. " +
      "Bireysel kullanıcılar için Türkçe, basit not yönetimi.\n\n" +
      "## 2. Hedefler\n- Hızlı not ekleme\n- Kolay arama\n- Mobil uyumlu\n- Erişilebilir tasarım\n- Local-first depolama\n\n" +
      "## 3. Tech Stack\nFramework: React 18, Build: Vite, Styling: Tailwind, State: useState, Storage: localStorage, Routing: React Router.\n\n" +
      "## 4. Fonksiyonel Gereksinimler\n### 4.1 Not Ekleme\n- Başlık (zorunlu, max 100 char), Açıklama (opsiyonel, max 1000 char), Öncelik, Son Tarih.\n- Hata: Lütfen başlığı girin.\n### 4.2 Filtreleme\n- Tümü, Aktif, Tamamlanmış.\n### 4.3 Arama\n- Başlık ve açıklamada arama.\n\n" +
      "## 5. Veri Modeli\nNot { id, title, description, priority, dueDate, completed, createdAt }\n\n" +
      "## 6. UI/UX\n### 6.1 Design System\nAesthetic: minimal. Palette: Primary #3B82F6, Bg #F8FAFC, Text #1E293B, Success #22C55E, Error #EF4444. Tipografi: Space Grotesk + Inter. Icons: Lucide.\n### 6.2 Spacing\n4/8/16/24/32/48/64 px scale.\n\n" +
      "## 7. Non-Functional\nPerformans: İlk yükleme <2s. Erişilebilirlik: WCAG 2.1 AA, klavye nav, ARIA. Tarayıcı: Chrome 90+, Firefox 88+, Safari 14+, mobil iOS/Android.\n\n" +
      "## 8. Proje Yapısı\nsrc/components, src/screens, src/hooks, src/utils, App.tsx, main.tsx\n\n" +
      "## 9. Ekranlar\n| # | Ekran | Tür | Açıklama |\n|---|---|---|---|\n| 1 | Ana Sayfa | list | Notlar listesi, filtre, ara |\n| 2 | Yeni Not | form | Başlık + açıklama + öncelik + tarih |\n| 3 | Ayarlar | settings | Tema, dil, veri sıfırla |",
    prd_screen_count: "3",
    db_required: "none",
    ...overrides,
  };
}
