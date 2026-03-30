import { Row } from './Row';
import type { Guess } from '../types';

export interface BoardProps {
  guesses: Guess[];
  currentRow: number;
  currentWord: string;
  shakingRow: number | null;
  isWin: boolean;
}

/**
 * Game board component containing 6 rows of 5 tiles each
 * 
 * Features:
 * - 6x5 grid layout
 * - Flip animation on guess submission (250ms per tile, sequential left-to-right)
 * - Shake animation on invalid word (600ms horizontal shake)
 * - Bounce animation on win (sequential bounce)
 * - Turkish character support
 */
export function Board({ 
  guesses, 
  currentRow, 
  currentWord,
  shakingRow,
  isWin
}: BoardProps) {
  const renderRows = () => {
    const rows = [];
    
    for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
      const guess = guesses[rowIndex];
      const isCurrent = rowIndex === currentRow;
      const isRevealed = rowIndex < currentRow || (rowIndex === currentRow && guess?.tiles.length === 5);
      const isShaking = shakingRow === rowIndex;
      const isBouncing = isWin && rowIndex === currentRow - 1;
      
      rows.push(
        <Row
          key={rowIndex}
          guess={guess}
          isCurrentRow={isCurrent}
          currentWord={isCurrent ? currentWord : ''}
          isRevealed={isRevealed}
          isShaking={isShaking}
          isBouncing={isBouncing}
          rowIndex={rowIndex}
        />
      );
    }
    
    return rows;
  };

  return (
    <div className="grid grid-rows-6 gap-2 mb-8">
      {renderRows()}
    </div>
  );
}
