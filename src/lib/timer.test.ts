import { describe, it } from "node:test";
import assert from "node:assert";
import { TimerStore, TimerStatus } from "./timer-store.js";
import { TimerLogic } from "./timer-logic.js";

describe("TimerStore", () => {
  describe("create", () => {
    it("should create a timer with correct defaults", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test Timer", durationMs: 60000 });

      assert.strictEqual(timer.name, "Test Timer");
      assert.strictEqual(timer.durationMs, 60000);
      assert.strictEqual(timer.remainingMs, 60000);
      assert.strictEqual(timer.status, "idle");
      assert.strictEqual(timer.startedAt, null);
      assert.strictEqual(timer.pausedAt, null);
      assert.ok(timer.id.startsWith("timer_"));
      assert.ok(timer.createdAt > 0);
      assert.ok(timer.updatedAt > 0);
    });

    it("should generate unique IDs for each timer", () => {
      const store = new TimerStore();
      const timer1 = store.create({ name: "Timer 1", durationMs: 1000 });
      const timer2 = store.create({ name: "Timer 2", durationMs: 2000 });

      assert.notStrictEqual(timer1.id, timer2.id);
    });
  });

  describe("get", () => {
    it("should return timer by ID", () => {
      const store = new TimerStore();
      const created = store.create({ name: "Test", durationMs: 1000 });
      const retrieved = store.get(created.id);

      assert.ok(retrieved);
      assert.strictEqual(retrieved!.id, created.id);
    });

    it("should return undefined for non-existent ID", () => {
      const store = new TimerStore();
      const retrieved = store.get("non-existent");

      assert.strictEqual(retrieved, undefined);
    });
  });

  describe("getAll", () => {
    it("should return all timers", () => {
      const store = new TimerStore();
      store.create({ name: "Timer 1", durationMs: 1000 });
      store.create({ name: "Timer 2", durationMs: 2000 });

      const all = store.getAll();

      assert.strictEqual(all.length, 2);
    });

    it("should return empty array when no timers", () => {
      const store = new TimerStore();
      const all = store.getAll();

      assert.deepStrictEqual(all, []);
    });
  });

  describe("getByStatus", () => {
    it("should filter timers by status", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 1000 });
      store.start(timer.id);

      const running = store.getByStatus("running");

      assert.strictEqual(running.length, 1);
      assert.strictEqual(running[0]!.id, timer.id);
    });
  });

  describe("update", () => {
    it("should update timer fields", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 1000 });

      const updated = store.update(timer.id, { name: "Updated" });

      assert.ok(updated);
      assert.strictEqual(updated!.name, "Updated");
      assert.strictEqual(updated!.durationMs, 1000); // Unchanged
    });

    it("should return undefined for non-existent timer", () => {
      const store = new TimerStore();
      const updated = store.update("non-existent", { name: "Updated" });

      assert.strictEqual(updated, undefined);
    });
  });

  describe("delete", () => {
    it("should delete timer and return true", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 1000 });

      const deleted = store.delete(timer.id);

      assert.strictEqual(deleted, true);
      assert.strictEqual(store.get(timer.id), undefined);
    });

    it("should return false for non-existent timer", () => {
      const store = new TimerStore();
      const deleted = store.delete("non-existent");

      assert.strictEqual(deleted, false);
    });
  });

  describe("clear", () => {
    it("should remove all timers", () => {
      const store = new TimerStore();
      store.create({ name: "Timer 1", durationMs: 1000 });
      store.create({ name: "Timer 2", durationMs: 2000 });

      store.clear();

      assert.strictEqual(store.count(), 0);
    });
  });

  describe("start", () => {
    it("should start an idle timer", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });

      const started = store.start(timer.id);

      assert.ok(started);
      assert.strictEqual(started!.status, "running");
      assert.ok(started!.startedAt !== null);
    });

    it("should return undefined for non-existent timer", () => {
      const store = new TimerStore();
      const started = store.start("non-existent");

      assert.strictEqual(started, undefined);
    });
  });

  describe("pause", () => {
    it("should pause a running timer", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });
      store.start(timer.id);

      const paused = store.pause(timer.id);

      assert.ok(paused);
      assert.strictEqual(paused!.status, "paused");
      assert.ok(paused!.pausedAt !== null);
    });

    it("should return undefined for non-running timer", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });

      const paused = store.pause(timer.id);

      assert.strictEqual(paused, undefined);
    });
  });

  describe("resume", () => {
    it("should resume a paused timer", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });
      store.start(timer.id);
      store.pause(timer.id);

      const resumed = store.resume(timer.id);

      assert.ok(resumed);
      assert.strictEqual(resumed!.status, "running");
    });

    it("should return undefined for non-paused timer", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });

      const resumed = store.resume(timer.id);

      assert.strictEqual(resumed, undefined);
    });
  });

  describe("stop", () => {
    it("should reset timer to idle", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });
      store.start(timer.id);

      const stopped = store.stop(timer.id);

      assert.ok(stopped);
      assert.strictEqual(stopped!.status, "idle");
      assert.strictEqual(stopped!.remainingMs, 60000);
      assert.strictEqual(stopped!.startedAt, null);
    });
  });

  describe("complete", () => {
    it("should mark timer as completed", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });
      store.start(timer.id);

      const completed = store.complete(timer.id);

      assert.ok(completed);
      assert.strictEqual(completed!.status, "completed");
      assert.strictEqual(completed!.remainingMs, 0);
    });
  });

  describe("getRemainingMs", () => {
    it("should return remaining time for running timer", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });
      store.start(timer.id);

      const remaining = store.getRemainingMs(timer.id);

      assert.ok(remaining !== undefined);
      assert.ok(remaining! <= 60000);
      assert.ok(remaining! > 0);
    });

    it("should return stored remaining for paused timer", () => {
      const store = new TimerStore();
      const timer = store.create({ name: "Test", durationMs: 60000 });
      store.start(timer.id);
      store.pause(timer.id);

      const remaining = store.getRemainingMs(timer.id);

      assert.ok(remaining !== undefined);
      assert.ok(remaining! <= 60000);
    });
  });
});

describe("TimerLogic", () => {
  describe("createAndStart", () => {
    it("should create and immediately start a timer", () => {
      const store = new TimerStore();
      const logic = new TimerLogic(store);
      const timer = logic.createAndStart("Test", 60000);

      assert.strictEqual(timer.status, "running");
      assert.ok(timer.startedAt !== null);
    });
  });

  describe("start", () => {
    it("should start a timer and begin ticking", () => {
      const store = new TimerStore();
      const logic = new TimerLogic(store);
      const timer = store.create({ name: "Test", durationMs: 60000 });

      const started = logic.start(timer.id);

      assert.ok(started);
      assert.strictEqual(logic.hasRunningTimers(), true);

      logic.destroy();
    });
  });

  describe("pause", () => {
    it("should pause a running timer", () => {
      const store = new TimerStore();
      const logic = new TimerLogic(store);
      const timer = logic.createAndStart("Test", 60000);

      const paused = logic.pause(timer.id);

      assert.ok(paused);
      assert.strictEqual(paused!.status, "paused");
      assert.strictEqual(logic.hasRunningTimers(), false);

      logic.destroy();
    });
  });

  describe("resume", () => {
    it("should resume a paused timer", () => {
      const store = new TimerStore();
      const logic = new TimerLogic(store);
      const timer = logic.createAndStart("Test", 60000);
      logic.pause(timer.id);

      const resumed = logic.resume(timer.id);

      assert.ok(resumed);
      assert.strictEqual(resumed!.status, "running");
      assert.strictEqual(logic.hasRunningTimers(), true);

      logic.destroy();
    });
  });

  describe("stop", () => {
    it("should stop and reset a timer", () => {
      const store = new TimerStore();
      const logic = new TimerLogic(store);
      const timer = logic.createAndStart("Test", 60000);

      const stopped = logic.stop(timer.id);

      assert.ok(stopped);
      assert.strictEqual(stopped!.status, "idle");
      assert.strictEqual(logic.hasRunningTimers(), false);

      logic.destroy();
    });
  });

  describe("delete", () => {
    it("should delete timer and clean up", () => {
      const store = new TimerStore();
      const logic = new TimerLogic(store);
      const timer = logic.createAndStart("Test", 60000);

      const deleted = logic.delete(timer.id);

      assert.strictEqual(deleted, true);
      assert.strictEqual(logic.hasRunningTimers(), false);
      assert.strictEqual(store.has(timer.id), false);

      logic.destroy();
    });
  });

  describe("getTick", () => {
    it("should return tick data for running timer", () => {
      const store = new TimerStore();
      const logic = new TimerLogic(store);
      const timer = logic.createAndStart("Test", 60000);

      const tick = logic.getTick(timer.id);

      assert.ok(tick);
      assert.strictEqual(tick!.timerId, timer.id);
      assert.ok(tick!.remainingMs <= 60000);
      assert.ok(tick!.progress >= 0 && tick!.progress <= 1);
      assert.strictEqual(tick!.isComplete, false);

      logic.destroy();
    });
  });

  describe("formatMs", () => {
    it("should format milliseconds to MM:SS", () => {
      assert.strictEqual(TimerLogic.formatMs(65000), "01:05");
      assert.strictEqual(TimerLogic.formatMs(60000), "01:00");
      assert.strictEqual(TimerLogic.formatMs(5000), "00:05");
    });

    it("should format with hours when requested", () => {
      assert.strictEqual(TimerLogic.formatMs(3665000, true), "01:01:05");
    });

    it("should auto-include hours when present", () => {
      assert.strictEqual(TimerLogic.formatMs(3665000), "01:01:05");
    });
  });

  describe("formatMsTurkish", () => {
    it("should format in Turkish", () => {
      assert.strictEqual(TimerLogic.formatMsTurkish(65000), "1 dakika 5 saniye");
      assert.strictEqual(TimerLogic.formatMsTurkish(60000), "1 dakika");
      assert.strictEqual(TimerLogic.formatMsTurkish(5000), "5 saniye");
    });

    it("should include hours when present", () => {
      assert.strictEqual(TimerLogic.formatMsTurkish(3665000), "1 saat 1 dakika 5 saniye");
    });
  });

  describe("parseDuration", () => {
    it("should parse HH:MM:SS format", () => {
      assert.strictEqual(TimerLogic.parseDuration("01:30:00"), 5400000);
      assert.strictEqual(TimerLogic.parseDuration("30:00"), 1800000);
    });

    it("should parse duration format", () => {
      assert.strictEqual(TimerLogic.parseDuration("1h30m"), 5400000);
      assert.strictEqual(TimerLogic.parseDuration("90m"), 5400000);
      assert.strictEqual(TimerLogic.parseDuration("30s"), 30000);
    });

    it("should parse plain number as seconds", () => {
      assert.strictEqual(TimerLogic.parseDuration("30"), 30000);
    });

    it("should return null for invalid input", () => {
      assert.strictEqual(TimerLogic.parseDuration("invalid"), null);
      assert.strictEqual(TimerLogic.parseDuration(""), null);
    });
  });

  describe("callbacks", () => {
    it("should call onTick during countdown", async () => {
      const store = new TimerStore();
      const ticks: number[] = [];
      const logic = new TimerLogic(store, {
        tickIntervalMs: 50,
        onTick: (tick) => ticks.push(tick.remainingMs),
      });

      const timer = logic.createAndStart("Test", 200);
      
      // Wait for a few ticks
      await new Promise((resolve) => setTimeout(resolve, 150));

      assert.ok(ticks.length > 0);

      logic.destroy();
    });

    it("should call onComplete when timer finishes", async () => {
      const store = new TimerStore();
      let completedId: string | null = null;
      const logic = new TimerLogic(store, {
        tickIntervalMs: 50,
        onComplete: (id) => { completedId = id; },
      });

      const timer = logic.createAndStart("Test", 100);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 300));

      assert.strictEqual(completedId, timer.id);

      logic.destroy();
    });
  });
});
