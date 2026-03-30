import type { LetterStatus } from '../types';

export interface TileProps {
  letter: string;
  status: LetterStatus;
  isRevealed?: boolean;
  isShaking?: boolean;
  isBouncing?: boolean;
  delay?: number;
}

/**
 * Individual tile component for the Wordle game board
 * 
 * States:
 * - empty: Dark border, no letter
 * - filled: Light border with letter (current row being typed)
 * - correct: Green background (letter in correct position)
 * - present: Yellow background (letter in word, wrong position)
 * - absent: Gray background (letter not in word)
 * 
 * Animations:
 * - Flip: 250ms flip animation when revealed
 * - Shake: 600ms horizontal shake for invalid words
 * - Bounce: Sequential bounce animation on win
 */
export function Tile({ 
  letter, 
  status, 
  isRevealed = false, 
  isShaking = false,
  isBouncing = false,
  delay = 0 
}: TileProps) {
  // Determine background and border colors based on status
  const getTileClasses = () => {
    const baseClasses = 'w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold uppercase transition-colors duration-300';
    
    if (isRevealed) {
      switch (status) {
        case 'correct':
          return `${baseClasses} bg-correct border-correct text-white`;
        case 'present':
          return `${baseClasses} bg-present border-present text-white`;
        case 'absent':
          return `${baseClasses} bg-absent border-absent text-white`;
        default:
          return `${baseClasses} bg-tile-empty border-tile-empty text-game-text`;
      }
    }
    
    // Not revealed yet
    if (letter) {
      return `${baseClasses} bg-tile-filled border-tile-filled text-game-text`;
    }
    
    // Empty tile
    return `${baseClasses} bg-transparent border-tile-empty text-game-text`;
  };

  // Animation styles
  const getAnimationStyles = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};
    
    if (isShaking) {
      styles.animation = 'shake 0.6s ease-in-out';
    } else if (isBouncing) {
      styles.animation = `bounce 0.4s ease-in-out ${delay}ms`;
    } else if (isRevealed) {
      styles.animation = `flip 0.5s ease-in-out ${delay}ms`;
    }
    
    return styles;
  };

  return (
    <div 
      className={getTileClasses()}
      style={getAnimationStyles()}
      data-status={status}
      data-letter={letter}
    >
      {letter}
    </div>
  );
}
