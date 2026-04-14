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
    prd: "# Test App PRD — Not Tutma Uygulaması\n\n" +
      "## 1. Genel Bakış\n" +
      "Bireysel kullanıcılar için Türkçe basit not tutma uygulaması. Notlar oluşturulabilir, düzenlenebilir, silinebilir ve tamamlandı olarak işaretlenebilir. Filtreleme ve arama özellikleri mevcut. Tüm veriler local storage'da kalıcı olarak tutulur.\n\n" +
      "## 2. Hedefler\n- Hızlı not ekleme/düzenleme akışı\n- Etkili filtreleme ve arama\n- Mobil uyumlu responsive tasarım\n- WCAG 2.1 AA seviyesinde erişilebilirlik\n- Açık ve koyu tema desteği\n- Local-first kalıcı depolama\n\n" +
      "## 3. Tech Stack\n- Framework: React 18 + TypeScript\n- Build: Vite\n- Styling: Tailwind CSS\n- State: useState/useReducer + Context API\n- Storage: localStorage\n- Routing: React Router v6\n\n" +
      "## 4. Fonksiyonel Gereksinimler\n### 4.1 Not Ekleme\n- Başlık (zorunlu, max 100 karakter), Açıklama (opsiyonel, max 1000 karakter)\n- Öncelik: düşük/orta/yüksek (default: orta)\n- Son tarih (opsiyonel, datepicker)\n- Hata: 'Lütfen başlığı girin.', 'Açıklama 1000 karakteri aşamaz.'\n### 4.2 Not Düzenleme\n- Mevcut not seçilir, form pre-fill edilir, kaydet/iptal\n### 4.3 Not Silme\n- Onay dialogu: 'Bu notu silmek istediğinizden emin misiniz?'\n- Toast: 'Not silindi.'\n### 4.4 Filtreleme\n- Tümü / Aktif / Tamamlanmış sekmeleri\n- Aktif filtre count'u sekmede gösterilir\n### 4.5 Arama\n- Başlık ve açıklama içinde case-insensitive arama\n- Min 2 karakter, debounced 300ms\n\n" +
      "## 5. Veri Modeli\n```\nNot {\n  id: string (uuid),\n  title: string,\n  description?: string,\n  priority: 'low' | 'medium' | 'high',\n  dueDate?: string (ISO),\n  completed: boolean,\n  createdAt: string (ISO),\n  updatedAt: string (ISO)\n}\n```\n\n" +
      "## 6. UI/UX\n### 6.1 Design System\n- Aesthetic: minimal\n- Palette: Primary #3B82F6, Secondary #1E40AF, Background #F8FAFC, Surface #FFFFFF, Text #1E293B, Border #E2E8F0, Success #22C55E, Error #EF4444, Warning #F59E0B\n- Tipografi: Space Grotesk (heading) + Inter (body)\n- Icon: Lucide React\n### 6.2 Spacing & Components\n- Spacing scale: 4/8/16/24/32/48/64 px\n- Border radius: 4/8/12/16 px\n- Shadow: sm/md/lg tanımlı\n\n" +
      "## 7. Non-Functional\n### 7.1 Performans\n- İlk yükleme < 2s\n- Sayfa geçişi < 100ms\n### 7.2 Erişilebilirlik (WCAG 2.1 AA)\n- Klavye tam nav, ARIA labels, focus state\n- Kontrast >= 4.5:1 metin\n### 7.3 Tarayıcı\n- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+\n- Mobile: iOS Safari 14+, Android Chrome 90+\n\n" +
      "## 8. Proje Yapısı\nsrc/components, src/screens, src/hooks, src/utils, src/types, App.tsx, main.tsx\n\n" +
      "## 9. Window State\nwindow.app = { state, notes: [], filter: 'all', searchTerm: '' }\n\n" +
      "## 10. Ekranlar\n| # | Ekran | Tür | Açıklama |\n|---|---|---|---|\n| 1 | Ana Sayfa | list | Notlar listesi, filtre sekmeleri, arama, yeni not butonu |\n| 2 | Yeni/Düzenle Not | form | Başlık, açıklama, öncelik, son tarih, kaydet/iptal |\n| 3 | Ayarlar | settings | Tema seçimi, dil, veri sıfırla |",
    prd_screen_count: "3",
    db_required: "none",
    ...overrides,
  };
}
