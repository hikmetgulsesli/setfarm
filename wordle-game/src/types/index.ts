export type GameState = 'IDLE' | 'PLAYING' | 'WIN' | 'LOSE';

export type TileState = 'empty' | 'filled' | 'correct' | 'present' | 'absent';

export interface Statistics {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: number[];
}

export interface GuessResult {
  letter: string;
  state: TileState;
}

export interface GameBoard {
  guesses: string[];
  currentRow: number;
  currentGuess: string;
}
