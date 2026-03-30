import { useState, useEffect, useCallback } from 'react';
import type { GameState, Guess, GameStatistics, LetterStatus } from '../types/game';
import { getDailyWord, isValidWord, normalizeTurkishLetter } from '../utils/words';
import { loadGameState, saveGameState, loadStatistics, saveStatistics } from '../utils/storage';

const MAX_ROWS = 6;
const MAX_TILES = 5;

function evaluateGuess(guess: string, target: string): Guess['tiles'] {
  const tiles: Guess['tiles'] = Array(MAX_TILES).fill(null).map((_, i) => ({
    letter: guess[i],
    status: 'absent',
  }));

  const targetLetters = target.split('');
  const guessLetters = guess.split('');

  // First pass: mark correct positions
  const letterCounts: Record<string, number> = {};
  for (let i = 0; i < MAX_TILES; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      tiles[i] = { ...tiles[i], status: 'correct' };
    } else {
      letterCounts[targetLetters[i]] = (letterCounts[targetLetters[i]] || 0) + 1;
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < MAX_TILES; i++) {
    if (tiles[i].status !== 'correct') {
      const letter = guessLetters[i];
      if (letterCounts[letter] && letterCounts[letter] > 0) {
        tiles[i] = { ...tiles[i], status: 'present' };
        letterCounts[letter]--;
      }
    }
  }

  return tiles;
}

export function useGame() {
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [currentRow, setCurrentRow] = useState(0);
  const [currentTile, setCurrentTile] = useState(0);
  const [guesses, setGuesses] = useState<(Guess | null)[]>(Array(MAX_ROWS).fill(null) as (Guess | null)[]);
  const [targetWord, setTargetWord] = useState('');
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>({});

  // Initialize game
  useEffect(() => {
    const savedState = loadGameState();
    if (savedState && savedState.targetWord) {
      setTargetWord(savedState.targetWord);
      setGameState(savedState.gameState);
      setCurrentRow(savedState.currentRow);
      setCurrentTile(savedState.currentTile);
      setGuesses(savedState.guesses);
      
      // Rebuild letter statuses from guesses
      const statuses: Record<string, LetterStatus> = {};
      savedState.guesses.forEach((guess) => {
        if (guess) {
          guess.tiles.forEach((tile) => {
            const lowerLetter = tile.letter.toLowerCase();
            // Prioritize: correct > present > absent
            if (tile.status === 'correct') {
              statuses[lowerLetter] = 'correct';
            } else if (tile.status === 'present' && statuses[lowerLetter] !== 'correct') {
              statuses[lowerLetter] = 'present';
            } else if (!statuses[lowerLetter]) {
              statuses[lowerLetter] = 'absent';
            }
          });
        }
      });
      setLetterStatuses(statuses);
    } else {
      const word = getDailyWord();
      setTargetWord(word);
    }
  }, []);

  // Save game state
  useEffect(() => {
    if (targetWord) {
      saveGameState({
        gameState,
        currentRow,
        currentTile,
        guesses,
        targetWord,
        lastPlayedDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [gameState, currentRow, currentTile, guesses, targetWord]);

  const addLetter = useCallback((letter: string) => {
    if (gameState === 'WIN' || gameState === 'LOSE' || currentTile >= MAX_TILES) return;

    const normalizedLetter = normalizeTurkishLetter(letter);

    setGameState((prev) => (prev === 'IDLE' ? 'PLAYING' : prev));
    setGuesses((prev) => {
      const newGuesses = [...prev];
      if (!newGuesses[currentRow]) {
        newGuesses[currentRow] = { word: '', tiles: [] };
      }
      if (newGuesses[currentRow]!.word.length < MAX_TILES) {
        newGuesses[currentRow] = {
          ...newGuesses[currentRow]!,
          word: newGuesses[currentRow]!.word + normalizedLetter,
        };
      }
      return newGuesses;
    });
    setCurrentTile((prev) => Math.min(prev + 1, MAX_TILES));
  }, [currentTile, currentRow, gameState]);

  const removeLetter = useCallback(() => {
    if (gameState === 'WIN' || gameState === 'LOSE' || currentTile <= 0) return;

    setGuesses((prev) => {
      const newGuesses = [...prev];
      if (newGuesses[currentRow]) {
        const word = newGuesses[currentRow]!.word;
        newGuesses[currentRow] = {
          ...newGuesses[currentRow]!,
          word: word.slice(0, -1),
        };
      }
      return newGuesses;
    });
    setCurrentTile((prev) => prev - 1);
  }, [currentTile, currentRow, gameState]);

  const submitGuess = useCallback(() => {
    if (gameState === 'WIN' || gameState === 'LOSE' || currentTile !== MAX_TILES) return false;

    const currentGuess = guesses[currentRow]?.word || '';
    if (currentGuess.length !== MAX_TILES) return false;

    // Validate word
    if (!isValidWord(currentGuess)) {
      return false;
    }

    const tiles = evaluateGuess(currentGuess, targetWord);

    setGuesses((prev) => {
      const newGuesses = [...prev];
      newGuesses[currentRow] = { word: currentGuess, tiles };
      return newGuesses;
    });

    // Update letter statuses
    setLetterStatuses((prev) => {
      const newStatuses = { ...prev };
      tiles.forEach((tile) => {
        const lowerLetter = tile.letter.toLowerCase();
        // Prioritize: correct > present > absent
        if (tile.status === 'correct') {
          newStatuses[lowerLetter] = 'correct';
        } else if (tile.status === 'present' && newStatuses[lowerLetter] !== 'correct') {
          newStatuses[lowerLetter] = 'present';
        } else if (!newStatuses[lowerLetter]) {
          newStatuses[lowerLetter] = 'absent';
        }
      });
      return newStatuses;
    });

    const isWin = currentGuess === targetWord;
    const isLastRow = currentRow === MAX_ROWS - 1;

    if (isWin) {
      setGameState('WIN');
      updateStatistics(true, currentRow + 1);
    } else if (isLastRow) {
      setGameState('LOSE');
      updateStatistics(false, 0);
    } else {
      setCurrentRow((prev) => prev + 1);
      setCurrentTile(0);
    }

    return true;
  }, [currentTile, currentRow, guesses, targetWord, gameState]);

  const resetGame = useCallback(() => {
    const word = getDailyWord();
    setTargetWord(word);
    setGameState('IDLE');
    setCurrentRow(0);
    setCurrentTile(0);
    setGuesses(Array(MAX_ROWS).fill(null));
    setLetterStatuses({});
  }, []);

  const getStatistics = useCallback((): GameStatistics => {
    return loadStatistics();
  }, []);

  const updateStatistics = (won: boolean, guessCount: number) => {
    const stats = loadStatistics();
    const newStats: GameStatistics = {
      gamesPlayed: stats.gamesPlayed + 1,
      gamesWon: stats.gamesWon + (won ? 1 : 0),
      winPercentage: Math.round(((stats.gamesWon + (won ? 1 : 0)) / (stats.gamesPlayed + 1)) * 100),
      currentStreak: won ? stats.currentStreak + 1 : 0,
      maxStreak: won ? Math.max(stats.maxStreak, stats.currentStreak + 1) : stats.maxStreak,
      guessDistribution: [...stats.guessDistribution],
    };

    if (won && guessCount > 0 && guessCount <= 6) {
      newStats.guessDistribution[guessCount - 1]++;
    }

    saveStatistics(newStats);
  };

  return {
    gameState,
    currentRow,
    currentTile,
    guesses,
    targetWord,
    letterStatuses,
    addLetter,
    removeLetter,
    submitGuess,
    resetGame,
    getStatistics,
  };
}
