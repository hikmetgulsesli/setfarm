import { useState, useCallback, useEffect } from 'react';
import type { GameState, Guess, Tile, GameStats, GameStateData } from '../types';
import {
  getRandomTargetWord,
  isValidGuess,
  normalizeTurkishWord,
  STORAGE_KEYS,
} from '../utils/wordUtils';

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

export interface UseGameReturn {
  gameState: GameState;
  currentRow: number;
  currentTile: number;
  guesses: Guess[];
  addLetter: (letter: string) => void;
  removeLetter: () => void;
  submitGuess: () => boolean;
  resetGame: () => void;
  getStatistics: () => GameStats;
}

/**
 * Evaluates a guess against the target word
 * Returns tiles with correct/present/absent status
 * Handles duplicate letters correctly (standard Wordle algorithm)
 */
function evaluateGuess(guess: string, target: string): Tile[] {
  const tiles: Tile[] = Array(WORD_LENGTH).fill(null).map((_, i) => ({
    letter: guess[i],
    status: 'absent',
  }));

  const targetLetters = target.split('');
  const guessLetters = guess.split('');

  // First pass: mark correct positions
  const targetLetterCounts: Record<string, number> = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      tiles[i].status = 'correct';
    } else {
      targetLetterCounts[targetLetters[i]] = (targetLetterCounts[targetLetters[i]] || 0) + 1;
    }
  }

  // Second pass: mark present letters (handling duplicates)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (tiles[i].status === 'correct') continue;

    const letter = guessLetters[i];
    if (targetLetterCounts[letter] && targetLetterCounts[letter] > 0) {
      tiles[i].status = 'present';
      targetLetterCounts[letter]--;
    }
  }

  return tiles;
}

/**
 * Loads statistics from localStorage
 */
function loadStatistics(): Partial<GameStats> {
  if (typeof window === 'undefined') return {};
  
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STATISTICS);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore localStorage errors
  }
  
  return {};
}

/**
 * Saves statistics to localStorage
 */
function saveStatistics(stats: GameStats): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(stats));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Loads game state from localStorage
 */
function loadGameState(): Partial<GameStateData> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (saved) {
      const state = JSON.parse(saved) as GameStateData;
      // Check if it's from today
      const today = new Date().toISOString().split('T')[0];
      if (state.lastPlayedDate === today) {
        return state;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  
  return null;
}

/**
 * Saves game state to localStorage
 */
function saveGameState(state: GameStateData): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Main game hook with state machine
 * IDLE → PLAYING → (WIN|LOSE) → IDLE
 */
export function useGame(): UseGameReturn {
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [currentRow, setCurrentRow] = useState(0);
  const [currentTile, setCurrentTile] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [targetWord, setTargetWord] = useState('');

  // Initialize game
  useEffect(() => {
    const savedState = loadGameState();
    
    if (savedState?.targetWord) {
      setTargetWord(savedState.targetWord);
      setGameState(savedState.gameState ?? 'IDLE');
      setCurrentRow(savedState.currentRow ?? 0);
      setCurrentTile(savedState.currentTile ?? 0);
      setGuesses(savedState.guesses ?? []);
    } else {
      const newTarget = getRandomTargetWord();
      setTargetWord(newTarget);
    }
  }, []);

  // Save game state when it changes
  useEffect(() => {
    if (targetWord) {
      const state: GameStateData = {
        gameState,
        currentRow,
        currentTile,
        guesses,
        targetWord,
        lastPlayedDate: new Date().toISOString().split('T')[0],
      };
      saveGameState(state);
    }
  }, [gameState, currentRow, currentTile, guesses, targetWord]);

  const addLetter = useCallback((letter: string) => {
    if (gameState === 'WIN' || gameState === 'LOSE') return;
    if (currentTile >= WORD_LENGTH) return;

    const normalized = normalizeTurkishWord(letter);
    if (normalized.length !== 1) return;

    // Transition from IDLE to PLAYING on first keypress
    if (gameState === 'IDLE') {
      setGameState('PLAYING');
    }

    setGuesses(prev => {
      const newGuesses = [...prev];
      if (!newGuesses[currentRow]) {
        newGuesses[currentRow] = { word: '', tiles: [] };
      }
      // Check if we've already reached WORD_LENGTH
      if (newGuesses[currentRow].word.length >= WORD_LENGTH) {
        return newGuesses;
      }
      const currentWord = newGuesses[currentRow].word;
      newGuesses[currentRow] = {
        ...newGuesses[currentRow],
        word: currentWord + normalized,
      };
      return newGuesses;
    });

    setCurrentTile(prev => Math.min(prev + 1, WORD_LENGTH));
  }, [currentTile, currentRow, gameState]);

  const removeLetter = useCallback(() => {
    if (gameState === 'WIN' || gameState === 'LOSE') return;
    if (currentTile <= 0) return;

    setGuesses(prev => {
      const newGuesses = [...prev];
      if (newGuesses[currentRow]) {
        const currentWord = newGuesses[currentRow].word;
        newGuesses[currentRow] = {
          ...newGuesses[currentRow],
          word: currentWord.slice(0, -1),
        };
      }
      return newGuesses;
    });

    setCurrentTile(prev => prev - 1);
  }, [currentTile, currentRow, gameState]);

  const submitGuess = useCallback((): boolean => {
    if (gameState === 'WIN' || gameState === 'LOSE') return false;
    if (currentTile !== WORD_LENGTH) return false;

    const guessWord = guesses[currentRow]?.word || '';
    
    // Validate word length
    if (guessWord.length !== WORD_LENGTH) return false;
    
    // Validate word is in valid guesses list
    if (!isValidGuess(guessWord)) return false;

    const tiles = evaluateGuess(guessWord, targetWord);

    setGuesses(prev => {
      const newGuesses = [...prev];
      newGuesses[currentRow] = { word: guessWord, tiles };
      return newGuesses;
    });

    const isWin = guessWord === targetWord;
    const isLastGuess = currentRow === MAX_GUESSES - 1;

    if (isWin) {
      setGameState('WIN');
      updateStatistics(true, currentRow + 1);
    } else if (isLastGuess) {
      setGameState('LOSE');
      updateStatistics(false, 0);
    } else {
      setCurrentRow(prev => prev + 1);
      setCurrentTile(0);
    }

    return true;
  }, [currentTile, currentRow, guesses, targetWord, gameState]);

  const resetGame = useCallback(() => {
    const newTarget = getRandomTargetWord();
    setTargetWord(newTarget);
    setGameState('IDLE');
    setCurrentRow(0);
    setCurrentTile(0);
    setGuesses([]);
    
    // Clear saved game state
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, []);

  const getStatistics = useCallback((): GameStats => {
    const saved = loadStatistics();
    return {
      gamesPlayed: saved.gamesPlayed || 0,
      gamesWon: saved.gamesWon || 0,
      winPercentage: saved.gamesPlayed ? Math.round((saved.gamesWon || 0) / saved.gamesPlayed * 100) : 0,
      currentStreak: saved.currentStreak || 0,
      maxStreak: saved.maxStreak || 0,
      guessDistribution: saved.guessDistribution || [0, 0, 0, 0, 0, 0],
    };
  }, []);

  function updateStatistics(won: boolean, guessCount: number): void {
    const current = getStatistics();
    
    const newStats: GameStats = {
      gamesPlayed: current.gamesPlayed + 1,
      gamesWon: current.gamesWon + (won ? 1 : 0),
      winPercentage: Math.round(((current.gamesWon + (won ? 1 : 0)) / (current.gamesPlayed + 1)) * 100),
      currentStreak: won ? current.currentStreak + 1 : 0,
      maxStreak: won ? Math.max(current.maxStreak, current.currentStreak + 1) : current.maxStreak,
      guessDistribution: [...current.guessDistribution] as [number, number, number, number, number, number],
    };

    if (won && guessCount > 0 && guessCount <= 6) {
      newStats.guessDistribution[guessCount - 1]++;
    }

    saveStatistics(newStats);
  }

  return {
    gameState,
    currentRow,
    currentTile,
    guesses,
    addLetter,
    removeLetter,
    submitGuess,
    resetGame,
    getStatistics,
  };
}