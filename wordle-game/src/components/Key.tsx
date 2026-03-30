import type { LetterStatus } from '../types';

export interface KeyProps {
  letter: string;
  status: LetterStatus;
  isWide?: boolean;
  onClick: () => void;
}

/**
 * Individual key component for the virtual keyboard
 * 
 * Features:
 * - Displays a single letter or special key (ENTER, BACKSPACE)
 * - Updates color based on letter status from game progress
 * - Shows active state animation on press
 * - Supports wide keys for ENTER and BACKSPACE
 * 
 * Color states:
 * - empty: Default dark background
 * - correct: Green (letter is in correct position)
 * - present: Yellow (letter is in word but wrong position)
 * - absent: Gray (letter is not in word)
 */
export function Key({ 
  letter, 
  status, 
  isWide = false,
  onClick 
}: KeyProps) {
  // Determine background color based on status
  const getKeyClasses = () => {
    const baseClasses = 'h-14 rounded font-bold text-sm transition-all duration-200 flex items-center justify-center select-none';
    const sizeClasses = isWide ? 'px-4 flex-1' : 'w-8';
    
    // Status-based colors (highest priority wins)
    switch (status) {
      case 'correct':
        return `${baseClasses} ${sizeClasses} bg-correct border-correct text-white`;
      case 'present':
        return `${baseClasses} ${sizeClasses} bg-present border-present text-white`;
      case 'absent':
        return `${baseClasses} ${sizeClasses} bg-absent border-absent text-white`;
      default:
        return `${baseClasses} ${sizeClasses} bg-tile-empty hover:bg-tile-filled text-game-text`;
    }
  };

  // Display text for special keys
  const displayText = letter === 'BACKSPACE' ? '⌫' : letter;

  return (
    <button
      type="button"
      onClick={onClick}
      className={getKeyClasses()}
      aria-label={letter === 'BACKSPACE' ? 'Sil' : letter}
      data-key={letter}
      data-status={status}
    >
      {displayText}
    </button>
  );
}
