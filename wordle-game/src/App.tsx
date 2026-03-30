/** @jsxImportSource react */
import { useState, useEffect, useCallback } from 'react';
import { GameBoard } from './components/GameBoard';
import { Keyboard } from './components/Keyboard';
import { useGame } from './hooks/useGame';

function App() {
  const {
    gameState,
    currentRow,
    guesses,
    targetWord,
    letterStatuses,
    addLetter,
    removeLetter,
    submitGuess,
    resetGame,
  } = useGame();

  const [shakingRow, setShakingRow] = useState<number | null>(null);

  const handleEnter = useCallback(() => {
    if (!submitGuess()) {
      setShakingRow(currentRow);
      setTimeout(() => setShakingRow(null), 600);
    }
  }, [submitGuess, currentRow]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'WIN' || gameState === 'LOSE') return;

      const key = e.key.toUpperCase();

      if (key === 'ENTER') {
        e.preventDefault();
        handleEnter();
      } else if (key === 'BACKSPACE') {
        e.preventDefault();
        removeLetter();
      } else if (key.length === 1 && /^[A-ZÇĞİÖŞÜ]$/i.test(key)) {
        e.preventDefault();
        addLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addLetter, removeLetter, handleEnter, gameState]);

  const currentWord = guesses[currentRow]?.word || '';

  return (
    <div className="min-h-screen bg-game-bg text-game-text flex flex-col">
      <header className="border-b border-tile-empty px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider">Kelime Oyunu</h1>
        <button
          onClick={resetGame}
          className="w-10 h-10 rounded-full bg-tile-empty hover:bg-tile-filled transition-colors flex items-center justify-center text-lg"
          aria-label="Yeniden Başla"
        >
          ↻
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <GameBoard
          guesses={guesses}
          currentRow={currentRow}
          currentWord={currentWord}
          shakingRow={shakingRow}
          isWin={gameState === 'WIN'}
        />

        {gameState === 'WIN' && (
          <div className="text-center mb-4">
            <p className="text-2xl font-bold text-green-500">Tebrikler! Kazandınız!</p>
            <p className="text-sm text-tile-filled mt-2">
              {currentRow + 1}. denemede buldunuz
            </p>
          </div>
        )}

        {gameState === 'LOSE' && (
          <div className="text-center mb-4">
            <p className="text-2xl font-bold text-red-500">Oyun Bitti!</p>
            <p className="text-sm text-tile-filled mt-2">
              Doğru kelime: {targetWord}
            </p>
          </div>
        )}

        <Keyboard
          letterStatuses={letterStatuses}
          onKeyPress={addLetter}
          onEnter={handleEnter}
          onBackspace={removeLetter}
        />
      </main>
    </div>
  );
}

export default App;
