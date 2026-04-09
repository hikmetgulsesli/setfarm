/**
 * Timer Store - Manages timer state and persistence
 * 
 * Provides a centralized store for timer data with support for:
 * - Creating, updating, and deleting timers
 * - Persisting timers to storage (memory or localStorage)
 * - Querying timers by various criteria
 */

export interface Timer {
  id: string;
  name: string;
  durationMs: number;
  remainingMs: number;
  startedAt: number | null;
  pausedAt: number | null;
  status: TimerStatus;
  createdAt: number;
  updatedAt: number;
}

export type TimerStatus = "idle" | "running" | "paused" | "completed";

export interface TimerCreateInput {
  name: string;
  durationMs: number;
}

export interface TimerUpdateInput {
  name?: string;
  durationMs?: number;
  remainingMs?: number;
  status?: TimerStatus;
}

export type TimerStorage = "memory" | "localStorage";

const STORAGE_KEY = "setfarm:timers";

export class TimerStore {
  private timers: Map<string, Timer> = new Map();
  private storage: TimerStorage;

  constructor(storage: TimerStorage = "memory") {
    this.storage = storage;
    if (storage === "localStorage") {
      this.loadFromStorage();
    }
  }

  /**
   * Create a new timer
   */
  create(input: TimerCreateInput): Timer {
    const now = Date.now();
    const timer: Timer = {
      id: this.generateId(),
      name: input.name,
      durationMs: input.durationMs,
      remainingMs: input.durationMs,
      startedAt: null,
      pausedAt: null,
      status: "idle",
      createdAt: now,
      updatedAt: now,
    };

    this.timers.set(timer.id, timer);
    this.persist();
    return timer;
  }

  /**
   * Get a timer by ID
   */
  get(id: string): Timer | undefined {
    return this.timers.get(id);
  }

  /**
   * Get all timers
   */
  getAll(): Timer[] {
    return Array.from(this.timers.values());
  }

  /**
   * Get timers by status
   */
  getByStatus(status: TimerStatus): Timer[] {
    return this.getAll().filter((t) => t.status === status);
  }

  /**
   * Get running timers (convenience method)
   */
  getRunning(): Timer[] {
    return this.getByStatus("running");
  }

  /**
   * Update a timer
   */
  update(id: string, input: TimerUpdateInput): Timer | undefined {
    const timer = this.timers.get(id);
    if (!timer) return undefined;

    const updated: Timer = {
      ...timer,
      ...input,
      updatedAt: Date.now(),
    };

    this.timers.set(id, updated);
    this.persist();
    return updated;
  }

  /**
   * Delete a timer
   */
  delete(id: string): boolean {
    const deleted = this.timers.delete(id);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  /**
   * Delete all timers
   */
  clear(): void {
    this.timers.clear();
    this.persist();
  }

  /**
   * Check if a timer exists
   */
  has(id: string): boolean {
    return this.timers.has(id);
  }

  /**
   * Get the count of timers
   */
  count(): number {
    return this.timers.size;
  }

  /**
   * Start a timer
   */
  start(id: string): Timer | undefined {
    const timer = this.timers.get(id);
    if (!timer) return undefined;

    const now = Date.now();
    const updated: Timer = {
      ...timer,
      status: "running",
      startedAt: timer.startedAt ?? now,
      pausedAt: null,
      updatedAt: now,
    };

    this.timers.set(id, updated);
    this.persist();
    return updated;
  }

  /**
   * Pause a running timer
   */
  pause(id: string): Timer | undefined {
    const timer = this.timers.get(id);
    if (!timer || timer.status !== "running") return undefined;

    const now = Date.now();
    const elapsed = now - (timer.startedAt ?? now);
    const remaining = Math.max(0, timer.remainingMs - elapsed);

    const updated: Timer = {
      ...timer,
      status: "paused",
      remainingMs: remaining,
      pausedAt: now,
      updatedAt: now,
    };

    this.timers.set(id, updated);
    this.persist();
    return updated;
  }

  /**
   * Resume a paused timer
   */
  resume(id: string): Timer | undefined {
    const timer = this.timers.get(id);
    if (!timer || timer.status !== "paused") return undefined;

    const now = Date.now();
    const updated: Timer = {
      ...timer,
      status: "running",
      startedAt: now,
      pausedAt: null,
      updatedAt: now,
    };

    this.timers.set(id, updated);
    this.persist();
    return updated;
  }

  /**
   * Stop a timer (reset to idle)
   */
  stop(id: string): Timer | undefined {
    const timer = this.timers.get(id);
    if (!timer) return undefined;

    const updated: Timer = {
      ...timer,
      status: "idle",
      remainingMs: timer.durationMs,
      startedAt: null,
      pausedAt: null,
      updatedAt: Date.now(),
    };

    this.timers.set(id, updated);
    this.persist();
    return updated;
  }

  /**
   * Mark a timer as completed
   */
  complete(id: string): Timer | undefined {
    const timer = this.timers.get(id);
    if (!timer) return undefined;

    const updated: Timer = {
      ...timer,
      status: "completed",
      remainingMs: 0,
      pausedAt: null,
      updatedAt: Date.now(),
    };

    this.timers.set(id, updated);
    this.persist();
    return updated;
  }

  /**
   * Get the current remaining time for a timer
   */
  getRemainingMs(id: string): number | undefined {
    const timer = this.timers.get(id);
    if (!timer) return undefined;

    if (timer.status === "running" && timer.startedAt) {
      const elapsed = Date.now() - timer.startedAt;
      return Math.max(0, timer.remainingMs - elapsed);
    }

    return timer.remainingMs;
  }

  /**
   * Persist timers to storage
   */
  private persist(): void {
    if (this.storage === "localStorage") {
      this.saveToStorage();
    }
  }

  /**
   * Save timers to localStorage
   */
  private saveToStorage(): void {
    if (typeof localStorage === "undefined") return;
    
    const data = JSON.stringify(this.getAll());
    localStorage.setItem(STORAGE_KEY, data);
  }

  /**
   * Load timers from localStorage
   */
  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;

    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;

    try {
      const timers: Timer[] = JSON.parse(data);
      for (const timer of timers) {
        this.timers.set(timer.id, timer);
      }
    } catch {
      // Invalid storage data, start fresh
      this.timers.clear();
    }
  }

  /**
   * Generate a unique timer ID
   */
  private generateId(): string {
    return `timer_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// Export singleton instance for convenience
export const timerStore = new TimerStore();
