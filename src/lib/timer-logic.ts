/**
 * Timer Logic - Core timer operations and utilities
 * 
 * Provides timer functionality including:
 * - Countdown calculations
 * - Timer tick management
 * - Timer formatting utilities
 * - Timer event handling
 */

import { Timer, TimerStatus, TimerStore } from "./timer-store.js";

export interface TimerTick {
  timerId: string;
  remainingMs: number;
  progress: number; // 0 to 1
  isComplete: boolean;
}

export interface TimerOptions {
  onTick?: (tick: TimerTick) => void;
  onComplete?: (timerId: string) => void;
  tickIntervalMs?: number;
}

export class TimerLogic {
  private store: TimerStore;
  private tickIntervals: Map<string, number> = new Map();
  private globalInterval: number | null = null;
  private options: TimerOptions;

  constructor(store: TimerStore, options: TimerOptions = {}) {
    this.store = store;
    this.options = {
      tickIntervalMs: 100,
      ...options,
    };
  }

  /**
   * Create and start a new timer
   */
  createAndStart(name: string, durationMs: number): Timer {
    const timer = this.store.create({ name, durationMs });
    const started = this.start(timer.id);
    return started ?? timer;
  }

  /**
   * Start a timer and begin ticking
   */
  start(timerId: string): Timer | undefined {
    const timer = this.store.start(timerId);
    if (!timer) return undefined;

    this.beginTick(timerId);
    return timer;
  }

  /**
   * Pause a timer
   */
  pause(timerId: string): Timer | undefined {
    const timer = this.store.pause(timerId);
    if (!timer) return undefined;

    this.stopTick(timerId);
    return timer;
  }

  /**
   * Resume a paused timer
   */
  resume(timerId: string): Timer | undefined {
    const timer = this.store.resume(timerId);
    if (!timer) return undefined;

    this.beginTick(timerId);
    return timer;
  }

  /**
   * Stop a timer (reset to idle)
   */
  stop(timerId: string): Timer | undefined {
    const timer = this.store.stop(timerId);
    if (!timer) return undefined;

    this.stopTick(timerId);
    return timer;
  }

  /**
   * Delete a timer and clean up
   */
  delete(timerId: string): boolean {
    this.stopTick(timerId);
    return this.store.delete(timerId);
  }

  /**
   * Get the current tick data for a timer
   */
  getTick(timerId: string): TimerTick | undefined {
    const timer = this.store.get(timerId);
    if (!timer) return undefined;

    const remainingMs = this.store.getRemainingMs(timerId) ?? 0;
    const progress = timer.durationMs > 0 
      ? 1 - (remainingMs / timer.durationMs) 
      : 1;

    return {
      timerId,
      remainingMs,
      progress: Math.min(1, Math.max(0, progress)),
      isComplete: remainingMs <= 0 && timer.status !== "idle",
    };
  }

  /**
   * Format milliseconds to human-readable string
   * e.g., 65000 -> "01:05"
   */
  static formatMs(ms: number, includeHours = false): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    if (includeHours || hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Format milliseconds to Turkish locale string
   * e.g., 65000 -> "1 dakika 5 saniye"
   */
  static formatMsTurkish(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours} saat`);
    }
    if (minutes > 0) {
      parts.push(`${minutes} dakika`);
    }
    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds} saniye`);
    }

    return parts.join(" ");
  }

  /**
   * Parse a duration string to milliseconds
   * Supports: "1h30m", "90m", "1:30:00", "90"
   */
  static parseDuration(input: string): number | null {
    // Try HH:MM:SS or MM:SS format
    const timeMatch = input.match(/^(?:(\d+):)?(\d+):(\d+)$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1] ?? "0", 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseInt(timeMatch[3], 10);
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    // Try duration format like "1h30m15s"
    const durationMatch = input.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1] ?? "0", 10);
      const minutes = parseInt(durationMatch[2] ?? "0", 10);
      const seconds = parseInt(durationMatch[3] ?? "0", 10);
      if (hours > 0 || minutes > 0 || seconds > 0) {
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
      }
    }

    // Try plain number (assume minutes)
    const plainNumber = parseInt(input, 10);
    if (!isNaN(plainNumber) && plainNumber > 0) {
      return plainNumber * 60 * 1000;
    }

    return null;
  }

  /**
   * Check if any timers are running
   */
  hasRunningTimers(): boolean {
    return this.store.getRunning().length > 0;
  }

  /**
   * Get all running timer IDs
   */
  getRunningTimerIds(): string[] {
    return this.store.getRunning().map((t) => t.id);
  }

  /**
   * Clean up all intervals
   */
  destroy(): void {
    for (const timerId of this.tickIntervals.keys()) {
      this.stopTick(timerId);
    }
    this.tickIntervals.clear();
  }

  /**
   * Begin ticking for a timer
   */
  private beginTick(timerId: string): void {
    // Stop any existing tick for this timer
    this.stopTick(timerId);

    // Use global interval approach for efficiency
    if (this.globalInterval === null) {
      this.startGlobalInterval();
    }

    // Track that this timer should be ticking
    this.tickIntervals.set(timerId, 1);
  }

  /**
   * Stop ticking for a timer
   */
  private stopTick(timerId: string): void {
    this.tickIntervals.delete(timerId);

    // Clean up global interval if no more timers
    if (this.tickIntervals.size === 0 && this.globalInterval !== null) {
      clearInterval(this.globalInterval);
      this.globalInterval = null;
    }
  }

  /**
   * Start the global tick interval
   */
  private startGlobalInterval(): void {
    const intervalMs = this.options.tickIntervalMs ?? 100;

    const tick = () => {
      for (const timerId of this.tickIntervals.keys()) {
        this.processTick(timerId);
      }
    };

    // Use Node.js setInterval or browser setInterval
    this.globalInterval = setInterval(tick, intervalMs) as unknown as number;
  }

  /**
   * Process a single tick for a timer
   */
  private processTick(timerId: string): void {
    const timer = this.store.get(timerId);
    if (!timer || timer.status !== "running") {
      this.stopTick(timerId);
      return;
    }

    const tick = this.getTick(timerId);
    if (!tick) return;

    // Call onTick callback
    this.options.onTick?.(tick);

    // Handle completion
    if (tick.isComplete) {
      this.store.complete(timerId);
      this.stopTick(timerId);
      this.options.onComplete?.(timerId);
    }
  }
}

// Export singleton instance for convenience
export const timerLogic = new TimerLogic(new TimerStore());
