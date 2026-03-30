/** @jsxImportSource react */
import { useState } from 'react';
import type { LetterStatus } from '../types/game';

interface KeyProps {
  letter: string;
  status?: LetterStatus;
  isWide: boolean;
  onClick: () => void;
}

export function Key({ letter, status, isWide, onClick }: KeyProps) {
  const [isActive, setIsActive] = useState(false);

  const getClassName = () => {
    const base = 'h-14 rounded font-bold text-sm transition-all duration-100 flex items-center justify-center select-none';
    const width = isWide ? 'px-4 flex-1 max-w-[4.5rem]' : 'w-8 sm:w-10';

    // Color based on status
    let colorClass = 'bg-tile-empty hover:bg-tile-filled';

    if (status === 'correct') {
      colorClass = 'bg-correct border-correct text-white';
    } else if (status === 'present') {
      colorClass = 'bg-present border-present text-white';
    } else if (status === 'absent') {
      colorClass = 'bg-absent border-absent text-white';
    }

    // Active state animation
    const activeClass = isActive ? 'scale-95' : 'scale-100';

    return `${base} ${width} ${colorClass} ${activeClass}`;
  };

  const handleClick = () => {
    setIsActive(true);
    setTimeout(() => setIsActive(false), 100);
    onClick();
  };

  const displayText = letter === 'BACKSPACE' ? '⌫' : letter;

  return (
    <button
      className={getClassName()}
      onClick={handleClick}
      data-key={letter}
      data-status={status || 'unused'}
      aria-label={letter === 'BACKSPACE' ? 'Sil' : letter === 'ENTER' ? 'Gönder' : letter}
    >
      {displayText}
    </button>
  );
}
