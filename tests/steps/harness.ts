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
    prd: "# Test App PRD\n\n## Genel Bakış\nBu bir test projesidir. " +
      "Kullanıcılar görev oluşturabilir, düzenleyebilir, silebilir ve tamamlandı olarak işaretleyebilir. " +
      "Görevler listelenir, filtrelenebilir (tümü/aktif/tamamlanmış) ve arama yapılabilir. " +
      "Tüm veriler local storage'da kalıcı olarak tutulur. Arayüz tamamen Türkçe.\n\n" +
      "## Ekranlar\n\n| Ekran | Amaç | Ana Etkileşim |\n|---|---|---|\n" +
      "| Ana Sayfa | Görevlerin listesini göster | Filtrele, ara, tamamlandı işaretle |\n" +
      "| Yeni Görev | Yeni görev ekleme formu | Başlık, açıklama, öncelik, son tarih gir |\n" +
      "| Ayarlar | Tema ve dil tercihi | Açık/koyu tema, dil seçimi, veri sıfırla |\n\n" +
      "## Özellikler\n- Görev CRUD\n- Filtreleme (aktif, tamamlanmış, tümü)\n" +
      "- Arama (başlık ve açıklamada)\n- Tamamlanma durumu\n- Öncelik seviyesi (düşük/orta/yüksek)\n" +
      "- Son tarih ve hatırlatıcı\n- Local storage ile kalıcılık\n- Responsive tasarım (mobil + masaüstü)\n" +
      "- Açık ve koyu tema\n- Türkçe arayüz\n\n## Teknik\nVite + React 18 + TypeScript + Tailwind CSS.",
    prd_screen_count: "3",
    db_required: "none",
    ...overrides,
  };
}
