import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planModule } from "../../dist/installer/steps/01-plan/module.js";
import { buildAutoPlanOutput, inferUiLanguage, slugify } from "../../dist/installer/steps/01-plan/preclaim.js";
import { runModule, validPlanOutput } from "./harness.js";

function parsePlanOutput(output: string) {
  const field = (key: string) => output.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim() || "";
  return {
    status: field("STATUS"),
    repo: field("REPO"),
    branch: field("BRANCH"),
    tech_stack: field("TECH_STACK"),
    ui_language: field("UI_LANGUAGE"),
    prd: output.match(/^PRD:\n([\s\S]*?)\nPRD_SCREEN_COUNT:/m)?.[1] || "",
    prd_screen_count: field("PRD_SCREEN_COUNT"),
    db_required: field("DB_REQUIRED"),
  };
}

describe("01-plan step module", () => {
  it("happy path: prompt under budget + validation ok + context populated", async () => {
    const result = await runModule(
      planModule,
      "Basit not tutma uygulaması",
      validPlanOutput()
    );
    assert.ok(result.validation.ok, `validation failed: ${result.validation.errors.join("; ")}`);
    assert.ok(result.promptBytes < planModule.maxPromptSize, `prompt ${result.promptBytes} >= budget ${planModule.maxPromptSize}`);
    assert.equal(result.contextAfterComplete["repo"], "$HOME/projects/test-app-12345");
    assert.equal(result.contextAfterComplete["tech_stack"], "vite-react");
    assert.equal(result.contextAfterComplete["ui_language"], "English");
    assert.ok(result.onCompleteCalled);
  });

  it("short PRD is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ prd: "Çok kısa PRD." })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("PRD must be")));
    assert.equal(result.onCompleteCalled, false);
  });

  it("PRD_SCREEN_COUNT missing/invalid is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ prd_screen_count: "" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("PRD_SCREEN_COUNT")));
  });

  it("invalid TECH_STACK (angular) is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ tech_stack: "angular" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("TECH_STACK")));
  });

  it("prompt budget holds with typical task (~1KB)", async () => {
    const typicalTask = "Türkçe kelime tahmin oyunu: 3 zorluk seviyesi (kolay 4 harf, orta 6 harf, zor 8 harf), 6 deneme hakkı, harf feedback'i (doğru yer, yanlış yer, yok), skor takibi. Ekranlar: Ana Menü, Zorluk Seçimi, Oyun Ekranı, Sonuç Ekranı, Ayarlar, Bilgi.";
    const result = await runModule(
      planModule,
      typicalTask,
      validPlanOutput()
    );
    assert.ok(result.promptBytes < planModule.maxPromptSize,
      `typical-task prompt ${result.promptBytes} >= budget ${planModule.maxPromptSize}`);
  });

  it("module metadata is correct", () => {
    assert.equal(planModule.id, "plan");
    assert.equal(planModule.type, "single");
    assert.equal(planModule.agentRole, "planner");
    assert.equal(typeof planModule.preClaim, "function");
    assert.equal(planModule.maxPromptSize, 8192);
    assert.deepEqual(planModule.requiredOutputFields, [
      "STATUS", "REPO", "BRANCH", "TECH_STACK", "UI_LANGUAGE", "PRD", "PRD_SCREEN_COUNT", "DB_REQUIRED"
    ]);
  });

  it("invalid REPO (relative path) is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ repo: "projects/test" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("REPO")));
  });

  it("invalid DB_REQUIRED is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ db_required: "mongodb" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("DB_REQUIRED")));
  });

  it("auto-plan output is valid, bounded, and derives repo from Proje line", () => {
    const output = buildAutoPlanOutput([
      "Proje: lead-triage-0430",
      "Platform: web React 18 Vite TypeScript.",
      "Lead ekleme, pipeline, insights, settings ve profil paneli olan localStorage uygulamasi yap.",
    ].join("\n"));
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.repo.endsWith("/projects/lead-triage-0430"), true);
    assert.equal(parsed.tech_stack, "vite-react");
    assert.equal(parsed.ui_language, "Turkish");
    assert.equal(parsed.db_required, "none");
    assert.ok(parsed.prd.length >= 2000, `PRD too short: ${parsed.prd.length}`);
    assert.ok(output.length < 7000, `auto-plan output should stay compact, got ${output.length}`);
    assert.match(parsed.prd, /## Overview/);
    assert.doesNotMatch(parsed.prd, /Arayuz Turkce|Ekranlar|Ayarlar/);
  });

  it("slugify transliterates Turkish project names", () => {
    assert.equal(slugify("Çağrı İzleme Ürün Şeması"), "cagri-izleme-urun-semasi");
  });

  it("auto-plan defaults English projects to English UI and English screen metadata", () => {
    const output = buildAutoPlanOutput([
      "Project: deep-sea-signal-desk",
      "Build a browser app for an ocean research crew to triage hydrophone anomaly reports.",
      "Include dashboard, anomaly queue, signal detail, create/edit report, equipment health, settings, profile, empty and error states.",
    ].join("\n"));
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.ui_language, "English");
    assert.match(parsed.prd, /User-facing copy language: English/);
    assert.match(parsed.prd, /\| 1 \| Dashboard \| dashboard \|/);
    assert.doesNotMatch(output, /Arayuz Turkce|Ekran Adi|Hata Durumu|Bos Durum|Ayarlar/);
  });

  it("infers UI language without letting English tasks become Turkish by default", () => {
    assert.equal(inferUiLanguage("Project: signal desk\nBuild an English app."), "English");
    assert.equal(inferUiLanguage("Proje: not panosu\nBasit not tutma uygulaması yap."), "Turkish");
  });
});
