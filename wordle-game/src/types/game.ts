export type LetterStatus = 'correct' | 'present' | 'absent' | undefined;

export interface Tile {
  letter: string;
  status: 'correct' | 'present' | 'absent';
}

export interface Guess {
  word: string;
  tiles: Tile[];
}

export type GameState = 'IDLE' | 'PLAYING' | 'WIN' | 'LOSE';

export interface GameStatistics {
  gamesPlayed: number;
  gamesWon: number;
  winPercentage: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: number[];
}

export interface GameStateData {
  gameState: GameState;
  currentRow: number;
  currentTile: number;
  guesses: (Guess | null)[];
  targetWord: string;
  lastPlayedDate: string;
}
