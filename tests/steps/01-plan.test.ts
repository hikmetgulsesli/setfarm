import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planModule } from "../../dist/installer/steps/01-plan/module.js";
import { runModule, validPlanOutput } from "./harness.js";

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
    assert.ok(result.onCompleteCalled);
  });

  it("short PRD (<500 chars) is rejected", async () => {
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
    assert.equal(planModule.maxPromptSize, 8192);
    assert.deepEqual(planModule.requiredOutputFields, [
      "STATUS", "REPO", "BRANCH", "TECH_STACK", "PRD", "PRD_SCREEN_COUNT", "DB_REQUIRED"
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
});
