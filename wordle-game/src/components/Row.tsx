import { Tile } from './Tile';
import type { Guess } from '../types';

export interface RowProps {
  guess?: Guess;
  isCurrentRow?: boolean;
  currentWord?: string;
  isRevealed?: boolean;
  isShaking?: boolean;
  isBouncing?: boolean;
  rowIndex?: number;
}

/**
 * Row component containing 5 tiles
 * 
 * Handles:
 * - Rendering completed guesses with status colors
 * - Rendering current row being typed
 * - Rendering empty rows
 * - Passing animation states to tiles
 */
export function Row({ 
  guess, 
  isCurrentRow = false, 
  currentWord = '',
  isRevealed = false,
  isShaking = false,
  isBouncing = false,
  rowIndex = 0
}: RowProps) {
  // Generate tiles for this row
  const renderTiles = () => {
    const tiles = [];
    
    for (let i = 0; i < 5; i++) {
      let letter = '';
      let status: 'empty' | 'correct' | 'present' | 'absent' = 'empty';
      
      if (guess) {
        // Completed guess row
        letter = guess.word[i] || '';
        status = guess.tiles[i]?.status || 'absent';
      } else if (isCurrentRow) {
        // Current row being typed
        letter = currentWord[i] || '';
      }
      
      // Calculate delay for sequential animations (250ms per tile)
      const delay = i * 250;
      
      tiles.push(
        <Tile
          key={i}
          letter={letter}
          status={status}
          isRevealed={isRevealed && !!guess}
          isShaking={isShaking}
          isBouncing={isBouncing}
          delay={delay}
        />
      );
    }
    
    return tiles;
  };

  return (
    <div 
      className="grid grid-cols-5 gap-2"
      data-row-index={rowIndex}
    >
      {renderTiles()}
    </div>
  );
}
