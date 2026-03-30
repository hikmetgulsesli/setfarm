/** @jsxImportSource react */
import { Key } from './Key';
import type { LetterStatus } from '../types/game';

interface KeyboardProps {
  letterStatuses: Record<string, LetterStatus>;
  onKeyPress: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}

// Turkish QWERTY keyboard layout
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'BACKSPACE'],
];

export function Keyboard({
  letterStatuses,
  onKeyPress,
  onEnter,
  onBackspace,
}: KeyboardProps) {
  const handleKeyClick = (key: string) => {
    if (key === 'ENTER') {
      onEnter();
    } else if (key === 'BACKSPACE') {
      onBackspace();
    } else {
      onKeyPress(key);
    }
  };

  return (
    <div className="w-full max-w-lg">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 mb-2">
          {row.map((key) => {
            const isSpecialKey = key === 'ENTER' || key === 'BACKSPACE';
            const status = letterStatuses[key.toLowerCase()];

            return (
              <Key
                key={key}
                letter={key}
                status={status}
                isWide={isSpecialKey}
                onClick={() => handleKeyClick(key)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
