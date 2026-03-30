export type GameState = 'IDLE' | 'PLAYING' | 'WIN' | 'LOSE';

export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

export interface Tile {
  letter: string;
  status: LetterStatus;
}

export interface Guess {
  word: string;
  tiles: Tile[];
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  winPercentage: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: [number, number, number, number, number, number];
}

export interface GameStateData {
  gameState: GameState;
  currentRow: number;
  currentTile: number;
  guesses: Guess[];
  targetWord: string;
  lastPlayedDate: string;
}

export const TURKISH_CHARS: Record<string, string> = {
  'i': 'ı',
  'I': 'İ',
};