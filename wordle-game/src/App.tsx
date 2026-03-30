import { useGame } from './hooks/useGame';

function App() {
  const { gameState, currentRow, guesses, addLetter, removeLetter, submitGuess, resetGame, getStatistics } = useGame();

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
        {/* Game Grid */}
        <div className="grid grid-rows-6 gap-2 mb-8">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, colIndex) => {
                const guess = guesses[rowIndex];
                const tile = guess?.tiles[colIndex];
                const letter = guess?.word[colIndex] || '';
                const isCurrentRow = rowIndex === currentRow;
                const isFilled = colIndex < (guess?.word.length || 0);

                let bgClass = 'bg-tile-empty border-tile-empty';
                if (tile?.status === 'correct') bgClass = 'bg-green-600 border-green-600';
                else if (tile?.status === 'present') bgClass = 'bg-yellow-600 border-yellow-600';
                else if (tile?.status === 'absent') bgClass = 'bg-gray-600 border-gray-600';
                else if (isCurrentRow && isFilled) bgClass = 'bg-tile-filled border-tile-filled';

                return (
                  <div
                    key={colIndex}
                    className={`w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold uppercase transition-all ${bgClass}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

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
        <div className="w-full max-w-lg">
          {[
            ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
            ['ENTER', 'Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'BACKSPACE'],
          ].map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1 mb-2">
              {row.map((key) => {
                const isSpecial = key === 'ENTER' || key === 'BACKSPACE';
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === 'ENTER') submitGuess();
                      else if (key === 'BACKSPACE') removeLetter();
                      else addLetter(key);
                    }}
                    className={`${
                      isSpecial ? 'px-4' : 'w-8'
                    } h-12 bg-tile-empty hover:bg-tile-filled rounded font-bold text-sm transition-colors`}
                  >
                    {key === 'BACKSPACE' ? '←' : key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

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