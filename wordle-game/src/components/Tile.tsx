/** @jsxImportSource react */
interface TileProps {
  letter: string;
  status: 'empty' | 'correct' | 'present' | 'absent';
  isRevealed: boolean;
  isShaking: boolean;
  isBouncing: boolean;
  delay: number;
}

export function Tile({
  letter,
  status,
  isRevealed,
  isShaking,
  isBouncing,
  delay,
}: TileProps) {
  const getClassName = () => {
    const base = 'w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold uppercase transition-colors duration-300';

    if (isRevealed) {
      switch (status) {
        case 'correct':
          return `${base} bg-correct border-correct text-white`;
        case 'present':
          return `${base} bg-present border-present text-white`;
        case 'absent':
          return `${base} bg-absent border-absent text-white`;
        default:
          return `${base} bg-tile-empty border-tile-empty text-game-text`;
      }
    }

    if (letter) {
      return `${base} bg-tile-filled border-tile-filled text-game-text`;
    }

    return `${base} bg-transparent border-tile-empty text-game-text`;
  };

  const getStyle = () => {
    const style: React.CSSProperties = {};

    if (isShaking) {
      style.animation = 'shake 0.6s ease-in-out';
    } else if (isBouncing) {
      style.animation = `bounce 0.4s ease-in-out ${delay}ms`;
    } else if (isRevealed) {
      style.animation = `flip 0.5s ease-in-out ${delay}ms`;
    }

    return style;
  };

  return (
    <div
      className={getClassName()}
      style={getStyle()}
      data-status={status}
      data-letter={letter}
    >
      {letter}
    </div>
  );
}
