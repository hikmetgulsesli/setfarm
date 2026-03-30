import { useMemo } from 'react';
import { Key } from './Key';
import type { Guess, LetterStatus } from '../types';

export interface KeyboardProps {
  guesses: Guess[];
  onEnter: () => void;
  onBackspace: () => void;
  onLetter: (letter: string) => void;
}

/**
 * Virtual QWERTY Turkish keyboard component
 * 
 * Layout:
 * Row 1: Q W E R T Y U I O P Ğ Ü
 * Row 2: A S D F G H J K L Ş İ
 * Row 3: ENTER Z X C V B N M Ö Ç BACKSPACE
 * 
 * Features:
 * - Turkish characters: Ç, Ş, Ğ, Ü, Ö, İ, I
 * - Real-time color updates based on game progress
 * - ENTER submits guess, BACKSPACE deletes letter
 * - Active state animation on key press
 * 
 * Color state logic:
 * - correct (green): Letter is in correct position in any guess
 * - present (yellow): Letter is in word but wrong position in any guess
 * - absent (gray): Letter is not in target word
 * - Priority: correct > present > absent > empty
 */
export function Keyboard({ 
  guesses, 
  onEnter, 
  onBackspace, 
  onLetter 
}: KeyboardProps) {
  // Turkish QWERTY keyboard layout
  const keyboardLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'BACKSPACE'],
  ];

  // Compute letter statuses from all submitted guesses
  const letterStatuses = useMemo(() => {
    const statuses: Record<string, LetterStatus> = {};
    
    for (const guess of guesses) {
      if (!guess.tiles || guess.tiles.length === 0) continue;
      
      for (const tile of guess.tiles) {
        const letter = tile.letter.toUpperCase();
        const currentStatus = statuses[letter];
        
        // Priority: correct > present > absent > empty
        if (tile.status === 'correct') {
          statuses[letter] = 'correct';
        } else if (tile.status === 'present' && currentStatus !== 'correct') {
          statuses[letter] = 'present';
        } else if (tile.status === 'absent' && currentStatus !== 'correct' && currentStatus !== 'present') {
          statuses[letter] = 'absent';
        }
      }
    }
    
    return statuses;
  }, [guesses]);

  // Handle key click
  const handleKeyClick = (key: string) => {
    if (key === 'ENTER') {
      onEnter();
    } else if (key === 'BACKSPACE') {
      onBackspace();
    } else {
      onLetter(key);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {keyboardLayout.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1.5 mb-2">
          {row.map((key) => {
            const isSpecial = key === 'ENTER' || key === 'BACKSPACE';
            const status = letterStatuses[key] || 'empty';
            
            return (
              <Key
                key={key}
                letter={key}
                status={status}
                isWide={isSpecial}
                onClick={() => handleKeyClick(key)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
