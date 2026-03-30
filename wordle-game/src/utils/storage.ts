import type { GameStateData, GameStatistics } from '../types/game';

const STORAGE_KEYS = {
  GAME_STATE: 'wordle-game-state',
  STATISTICS: 'wordle-statistics',
};

const DEFAULT_STATISTICS: GameStatistics = {
  gamesPlayed: 0,
  gamesWon: 0,
  winPercentage: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
};

export function loadGameState(): GameStateData | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (saved) {
      const parsed = JSON.parse(saved);
      const today = new Date().toISOString().split('T')[0];
      
      // Only load if it's from today
      if (parsed.lastPlayedDate === today) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function saveGameState(state: GameStateData): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function loadStatistics(): GameStatistics {
  if (typeof window === 'undefined') return DEFAULT_STATISTICS;

  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STATISTICS);
    if (saved) {
      return { ...DEFAULT_STATISTICS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_STATISTICS;
}

export function saveStatistics(stats: GameStatistics): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

export function clearGameState(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
  } catch {
    // Ignore storage errors
  }
}
