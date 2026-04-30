import os from "node:os";
import path from "node:path";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import type { ClaimContext } from "../types.js";

const DEFAULT_STACK = "vite-react";

function transliterate(input: string): string {
  return input
    .replace(/[Ğğ]/g, "g")
    .replace(/[Üü]/g, "u")
    .replace(/[Şş]/g, "s")
    .replace(/[İIı]/g, "i")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c");
}

export function slugify(input: string): string {
  const slug = transliterate(input)
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || "setfarm-project";
}

function extractProjectName(task: string): string {
  const projectLine = task.match(/(?:^|\n)\s*Proje\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (projectLine) return projectLine;
  const firstLine = task.split(/\n+/).map(line => line.trim()).find(Boolean) || "setfarm-project";
  return firstLine.replace(/^Proje\s*:\s*/i, "").slice(0, 80);
}

function inferTechStack(task: string): string {
  const lower = task.toLowerCase();
  if (/\breact native\b|mobil uygulama|mobile app/.test(lower)) return "react-native";
  if (/\bnext(js)?\b|seo|ssr/.test(lower)) return "nextjs";
  if (/\bnode\b|\bexpress\b|api only|sadece api/.test(lower)) return "node-express";
  if (/\bvanilla\b|frameworksiz|plain ts/.test(lower)) return "vanilla-ts";
  return DEFAULT_STACK;
}

function inferDbRequired(task: string): string {
  const lower = task.toLowerCase();
  if (/\bsqlite\b/.test(lower)) return "sqlite";
  if (/\bpostgres\b|\bpostgresql\b|\bauth\b|giris|login|hesap olustur|user data|multi user/.test(lower)) return "postgres";
  return "none";
}

function taskBullets(task: string): string[] {
  const bullets = task
    .split(/\n+/)
    .map(line => line.trim().replace(/^[-*]\s*/, ""))
    .filter(line => line && !/^Proje\s*:/i.test(line) && !/^Platform\s*:/i.test(line))
    .slice(0, 12);
  return bullets.length > 0 ? bullets : ["Kullaniciya dogrudan calisan, ilk ekrani gercek uygulama olan bir deneyim sun."];
}

function screensForTask(task: string): Array<{ name: string; type: string; description: string }> {
  const lower = task.toLowerCase();
  if (/lead|crm|pipeline/.test(lower)) {
    return [
      { name: "Leads", type: "ana-ekran", description: "Lead listesi, arama, filtreleme, hizli durum aksiyonlari ve yeni lead form girisi." },
      { name: "Lead Ekle Duzenle", type: "form", description: "Ad, sirket, kaynak, tahmini deger, durum, sonraki aksiyon ve tarih alanlari." },
      { name: "Pipeline", type: "board", description: "Durum kolonlari, kolon bazli lead sayisi ve toplam tahmini degerler." },
      { name: "Insights", type: "dashboard", description: "Toplam lead, kazanilan/kaybedilen, haftalik takip ve donusum metrikleri." },
      { name: "Settings", type: "ayarlar", description: "Tema yogunlugu, para birimi ve hatirlatici tercihleri." },
      { name: "Profil Paneli", type: "panel", description: "Kullanici adi, timezone, bildirim togglelari, kapat ve cikis aksiyonlari." },
      { name: "Storage Hata Durumu", type: "banner", description: "Kayit hatasi, tekrar dene ve yerel veriyi temizle aksiyonlari." },
      { name: "Bos Durum", type: "empty", description: "Lead yokken gorunen aciklama ve yeni lead CTA." },
    ];
  }
  if (/game|oyun/.test(lower)) {
    return [
      { name: "Ana Oyun", type: "play", description: "Oynanabilir ana sahne, skor ve temel kontroller." },
      { name: "Baslangic", type: "menu", description: "Oyuna basla, zorluk ve ayarlar aksiyonlari." },
      { name: "Sonuc", type: "result", description: "Kazanma/kaybetme durumu, tekrar oyna ve menuye don." },
      { name: "Ayarlar", type: "settings", description: "Ses, zorluk ve kontrol tercihleri." },
      { name: "Yardim", type: "help", description: "Kisa kurallar ve klavye/dokunmatik aciklamalari." },
    ];
  }
  return [
    { name: "Ana Ekran", type: "dashboard", description: "Birincil veri, filtreler ve ana aksiyonlar." },
    { name: "Ekle Duzenle", type: "form", description: "Temel CRUD formu, validasyon ve iptal/kaydet aksiyonlari." },
    { name: "Detay", type: "detail", description: "Secili kaydin ozet bilgileri ve ikincil aksiyonlar." },
    { name: "Istatistik", type: "insights", description: "Kullaniciya anlamli ozet metrikler." },
    { name: "Ayarlar", type: "settings", description: "Tercihler ve gorunur state degistiren kontroller." },
    { name: "Profil", type: "panel", description: "Account bilgileri, togglelar ve kapatma davranisi." },
    { name: "Hata Durumu", type: "error", description: "Kayit veya runtime hatasinda retry/clear aksiyonlari." },
    { name: "Bos Durum", type: "empty", description: "Veri yokken ilk aksiyona yonlendiren ekran." },
  ];
}

function platformLineForStack(stack: string): string {
  if (stack === "nextjs") return "Framework: Next.js, TypeScript, client/server route ayrimi.";
  if (stack === "react-native") return "Framework: React Native, TypeScript, mobil UI patternleri.";
  if (stack === "node-express") return "Runtime: Node.js + Express, API odakli moduller.";
  if (stack === "vanilla-ts") return "Runtime: Vanilla TypeScript, minimal bundling.";
  return "Framework: React 18 + Vite + TypeScript.";
}

export function buildAutoPlanOutput(task: string): string {
  const projectName = extractProjectName(task);
  const slug = slugify(projectName);
  const stack = inferTechStack(task);
  const dbRequired = inferDbRequired(task);
  const repo = path.join(os.homedir(), "projects", slug);
  const branch = `feature-${slug}`.slice(0, 80).replace(/-+$/g, "");
  const bullets = taskBullets(task);
  const screens = screensForTask(task);
  const screenRows = screens
    .map((screen, idx) => `| ${idx + 1} | ${screen.name} | ${screen.type} | ${screen.description} |`)
    .join("\n");
  const requirementRows = bullets.map((line, idx) => `- R${idx + 1}: ${line}`).join("\n");

  return [
    "STATUS: done",
    `REPO: ${repo}`,
    `BRANCH: ${branch}`,
    `TECH_STACK: ${stack}`,
    "PRD:",
    `# ${projectName} PRD`,
    "",
    "## Genel Bakis",
    `${projectName}, verilen gorev metnindeki urun ihtiyacini dogrudan calisan bir uygulamaya donusturur. Ilk ekran landing degil, kullanicinin ana is akisini baslatabildigi gercek uygulama ekranidir. Arayuz Turkce, taranabilir ve tekrarli kullanim icin dusuk gorsel gurultulu olmalidir.`,
    "",
    "## Hedefler",
    "- Kullaniciya ilk yuklemede calisan ve bos/dolu/hata durumlari olan bir deneyim sunmak.",
    "- Tum gorunen buton ve icon buttonlarin gercek state, route, panel veya form davranisi uretmesini saglamak.",
    "- Mobil ve desktop gorunumlerde metin tasmasi, ust uste binme ve olusmayan aksiyon birakmamak.",
    "- localStorage veya secilen veri katmani ile veri kaliciligini net hata/geri alma davranislariyla kurmak.",
    "- Smoke, final test ve deploy adimlarinda dogrulanabilir, deterministic bir uygulama yuzeyi olusturmak.",
    "",
    "## Teknik Kararlar",
    `- ${platformLineForStack(stack)}`,
    "- Styling: Tailwind CSS veya sade CSS modules; domain icin kurumsal/minimal tasarim.",
    "- State: React state + reducer/context; kucuk uygulama icin ek global state kutuphanesi gerekmez.",
    `- Storage: ${dbRequired === "none" ? "localStorage, hata durumunda gorunur banner ve retry/clear aksiyonlari" : dbRequired}.`,
    "- Icons: Lucide React; emoji veya dekoratif button kullanma.",
    "- Test yuzeyi: window.app icinde state, aktif ekran, hata ve temel sayaclar gorunur tutulur.",
    "",
    "## Fonksiyonel Gereksinimler",
    requirementRows,
    "- Formlar zorunlu alan validasyonu ve gorunur hata metinleri uretir.",
    "- Filtre, arama, ekleme, duzenleme, silme, profil, ayarlar, retry ve clear aksiyonlari smoke testte gorunur state degisikligi uretir.",
    "- Product control icin data-smoke-ignore kullanilmaz; bilincli pasif kontroller disabled veya aria-disabled olur.",
    "",
    "## Veri Modeli",
    "- Entity alanlari task domainine gore TypeScript type olarak tanimlanir.",
    "- Her kayitta id, createdAt ve updatedAt bulunur.",
    "- Ayarlar ve profil gibi global tercihler uygulama state'inden ayrilir.",
    "- Storage schema versiyonlu tutulur ve bozuk JSON durumunda kullaniciya hata durumu gosterilir.",
    "",
    "## UI/UX Gereksinimleri",
    "- Aesthetic: corporate/minimal, SaaS veya operasyon araci gibi sessiz ve taranabilir.",
    "- Palette: Primary #2563EB, Secondary #475569, Background #F8FAFC, Surface #FFFFFF, Text #0F172A, Border #E2E8F0, Success #16A34A, Error #DC2626, Warning #D97706.",
    "- Typography: Inter veya sistem sans; kompakt panellerde kucuk ama okunur basliklar.",
    "- Components: 8px veya daha dusuk radius kartlar, net focus ring, 44x44px dokunma hedefi.",
    "- Profil/account ikonu mutlaka panel, drawer veya sayfa acar; close/geri davranisi vardir.",
    "",
    "## Non-Functional",
    "- Performans: ilk yukleme <2s, client state gecisleri <100ms hedeflenir.",
    "- Accessibility: WCAG 2.1 AA, klavye navigasyonu, aria-label, focus state ve yeterli kontrast.",
    "- Responsive: 320px mobil genislikten desktop'a kadar yigma, grid veya scrollable kolon duzeni.",
    "- Hata yonetimi: storage ve form hatalari kullaniciya gorunur, tekrar denenebilir ve temizlenebilir.",
    "",
    "## Proje Yapisi",
    "src/components, src/screens, src/hooks, src/utils, src/types, src/App.tsx ve src/main.tsx ayrimi kullanilir. Stitch HTML ekranlari setup/build sonrasi App akisi icine baglanir; kullanilmayan tasarim ekrani birakilmaz.",
    "",
    "## Window State",
    "window.app = { state, screen, lastError, storageStatus, itemCount, activePanel } seklinde temel dogfood alanlari saglanir.",
    "",
    "## Ekranlar",
    "| # | Ekran Adi | Tur | Aciklama |",
    "|---|-----------|-----|----------|",
    screenRows,
    `PRD_SCREEN_COUNT: ${screens.length}`,
    `DB_REQUIRED: ${dbRequired}`,
  ].join("\n");
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  if (process.env.SETFARM_DISABLE_AUTO_PLAN === "1") return;

  const output = buildAutoPlanOutput(ctx.task || ctx.context["task"] || "");
  const step = await pgGet<{ id: string }>(
    "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
    [ctx.runId, ctx.stepId],
  );
  if (!step?.id) throw new Error(`plan preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, output);
  logger.info(`[module:plan preclaim] AUTO-COMPLETED plan without planner agent (${Buffer.byteLength(output, "utf-8")} bytes)`, {
    runId: ctx.runId,
    stepId: ctx.stepId,
  });
}
