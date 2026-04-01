import { create } from "zustand";

export type LetterStatus = "correct" | "present" | "absent" | "unused";

interface GameState {
  // Letter status map for keyboard coloring
  letterStatus: Record<string, LetterStatus>;
  // Current guess being typed
  currentGuess: string;
  // All submitted guesses
  guesses: string[];
  // Target word (for demo purposes)
  targetWord: string;
  // Actions
  addLetter: (letter: string) => void;
  deleteLetter: () => void;
  submitGuess: () => boolean;
  updateLetterStatus: (letter: string, status: LetterStatus) => void;
  resetGame: () => void;
  getLetterStatus: (letter: string) => LetterStatus;
}

// Turkish QWERTY keyboard layout
export const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "Ö", "Ç", "BACKSPACE"],
];

// All valid Turkish letters for the game
export const TURKISH_LETTERS = [
  "A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H", "I", "İ", "J", "K", "L", "M",
  "N", "O", "Ö", "P", "R", "S", "Ş", "T", "U", "Ü", "V", "Y", "Z",
];

export const useGameStore = create<GameState>((set, get) => ({
  letterStatus: {},
  currentGuess: "",
  guesses: [],
  targetWord: "KİTAP", // Default target word for demo

  addLetter: (letter: string) => {
    set((state) => {
      if (state.currentGuess.length >= 5) return state;
      return { currentGuess: state.currentGuess + letter };
    });
  },

  deleteLetter: () => {
    set((state) => ({
      currentGuess: state.currentGuess.slice(0, -1),
    }));
  },

  submitGuess: () => {
    const state = get();
    if (state.currentGuess.length !== 5) return false;

    const guess = state.currentGuess.toUpperCase();
    const target = state.targetWord.toUpperCase();
    const newLetterStatus = { ...state.letterStatus };

    // Update letter statuses based on the guess
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const targetLetter = target[i];

      if (letter === targetLetter) {
        newLetterStatus[letter] = "correct";
      } else if (target.includes(letter)) {
        // Only update if not already marked as correct
        if (newLetterStatus[letter] !== "correct") {
          newLetterStatus[letter] = "present";
        }
      } else {
        // Only update if not already marked
        if (!newLetterStatus[letter]) {
          newLetterStatus[letter] = "absent";
        }
      }
    }

    set({
      guesses: [...state.guesses, guess],
      currentGuess: "",
      letterStatus: newLetterStatus,
    });

    return guess === target;
  },

  updateLetterStatus: (letter: string, status: LetterStatus) => {
    set((state) => ({
      letterStatus: { ...state.letterStatus, [letter.toUpperCase()]: status },
    }));
  },

  resetGame: () => {
    set({
      letterStatus: {},
      currentGuess: "",
      guesses: [],
    });
  },

  getLetterStatus: (letter: string) => {
    return get().letterStatus[letter.toUpperCase()] || "unused";
  },
}));
