/** @jsxImportSource react */
import { Tile } from './Tile';
import type { Guess } from '../types/game';

interface GameBoardProps {
  guesses: (Guess | null)[];
  currentRow: number;
  currentWord: string;
  shakingRow: number | null;
  isWin: boolean;
}

export function GameBoard({
  guesses,
  currentRow,
  currentWord,
  shakingRow,
  isWin,
}: GameBoardProps) {
  const renderRow = (rowIndex: number) => {
    const guess = guesses[rowIndex];
    const isCurrentRow = rowIndex === currentRow;
    const isRevealed = rowIndex < currentRow || (guess?.tiles.length === 5);
    const isShaking = shakingRow === rowIndex;
    const isBouncing = isWin && rowIndex === currentRow - 1;

    const tiles = [];
    for (let i = 0; i < 5; i++) {
      let letter = '';
      let status: 'empty' | 'correct' | 'present' | 'absent' = 'empty';

      if (guess) {
        letter = guess.word[i] || '';
        status = guess.tiles[i]?.status || 'absent';
      } else if (isCurrentRow) {
        letter = currentWord[i] || '';
      }

      tiles.push(
        <Tile
          key={i}
          letter={letter}
          status={status}
          isRevealed={isRevealed && !!guess}
          isShaking={isShaking}
          isBouncing={isBouncing}
          delay={i * 250}
        />
      );
    }

    return (
      <div
        key={rowIndex}
        className="grid grid-cols-5 gap-2"
        data-row-index={rowIndex}
      >
        {tiles}
      </div>
    );
  };

  return (
    <div className="grid grid-rows-6 gap-2 mb-8">
      {Array.from({ length: 6 }, (_, i) => renderRow(i))}
    </div>
  );
}
