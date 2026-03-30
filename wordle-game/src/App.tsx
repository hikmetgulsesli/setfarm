import { useState, useCallback, useEffect } from 'react';
import { Board, Keyboard } from './components';
import { useGame } from './hooks/useGame';

function App() {
  const { 
    gameState, 
    currentRow, 
    currentTile,
    guesses, 
    addLetter, 
    removeLetter, 
    submitGuess, 
    resetGame, 
    getStatistics 
  } = useGame();
  
  const [shakingRow, setShakingRow] = useState<number | null>(null);

  // Handle submit with shake animation on invalid word
  const handleSubmit = useCallback(() => {
    const result = submitGuess();
    if (!result && currentTile === 5) {
      // Invalid word - trigger shake animation
      setShakingRow(currentRow);
      setTimeout(() => setShakingRow(null), 600);
    }
  }, [submitGuess, currentTile, currentRow]);

  // Get current word being typed
  const currentWord = guesses[currentRow]?.word || '';

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'WIN' || gameState === 'LOSE') return;

      const key = e.key.toUpperCase();

      if (key === 'ENTER') {
        e.preventDefault();
        handleSubmit();
      } else if (key === 'BACKSPACE') {
        e.preventDefault();
        removeLetter();
      } else if (key.length === 1 && /^[A-ZÇĞİÖŞÜ]$/.test(key)) {
        e.preventDefault();
        addLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addLetter, removeLetter, handleSubmit, gameState]);

  return (
    <div className="min-h-screen bg-game-bg text-game-text flex flex-col">
      <header className="border-b border-tile-empty px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider">Kelime Oyunu</h1>
        <div className="flex gap-2">
          <button
            onClick={resetGame}
            className="w-10 h-10 rounded-full bg-tile-empty hover:bg-tile-filled transition-colors flex items-center justify-center text-lg"
            aria-label="Yeniden Başla"
          >
            ↻
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Game Board */}
        <Board 
          guesses={guesses}
          currentRow={currentRow}
          currentWord={currentWord}
          shakingRow={shakingRow}
          isWin={gameState === 'WIN'}
        />

        {/* Game Status */}
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
              Bir sonraki denemede şansınız yaver gider
            </p>
          </div>
        )}

        {/* Keyboard */}
        <Keyboard
          guesses={guesses}
          onEnter={handleSubmit}
          onBackspace={removeLetter}
          onLetter={addLetter}
        />

        {/* Statistics */}
        <div className="mt-8 text-center">
          <h3 className="text-lg font-bold mb-2">İstatistikler</h3>
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-2xl font-bold">{getStatistics().gamesPlayed}</div>
              <div className="text-tile-filled">Oyun</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{getStatistics().winPercentage}%</div>
              <div className="text-tile-filled">Kazanma</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{getStatistics().currentStreak}</div>
              <div className="text-tile-filled">Seri</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{getStatistics().maxStreak}</div>
              <div className="text-tile-filled">Max Seri</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{getStatistics().gamesWon}</div>
              <div className="text-tile-filled">Galibiyet</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
