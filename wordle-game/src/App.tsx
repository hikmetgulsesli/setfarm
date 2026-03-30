import { useState } from 'react'
import './App.css'

function App() {
  const [showHelp, setShowHelp] = useState(false)
  const [showStats, setShowStats] = useState(false)

  return (
    <div className="min-h-screen bg-game-bg text-game-text flex flex-col">
      {/* Header */}
      <header className="border-b border-tile-empty px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider">Kelime Oyunu</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="w-10 h-10 rounded-full bg-tile-empty hover:bg-tile-filled transition-colors flex items-center justify-center text-lg"
            aria-label="Yardım"
          >
            ?
          </button>
          <button
            onClick={() => setShowStats(true)}
            className="w-10 h-10 rounded-full bg-tile-empty hover:bg-tile-filled transition-colors flex items-center justify-center text-lg"
            aria-label="İstatistikler"
          >
            📊
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <p className="text-tile-filled mb-8">Oyun alanı yakında hazır olacak...</p>
      </main>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-game-bg border border-tile-empty rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Nasıl Oynanır?</h2>
            <p className="text-sm text-tile-filled mb-4">
              5 harfli kelimeyi 6 denemede bulun.
            </p>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2 bg-tile-empty hover:bg-tile-filled rounded transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-game-bg border border-tile-empty rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">İstatistikler</h2>
            <p className="text-tile-filled">Henüz oynanmış oyun yok.</p>
            <button
              onClick={() => setShowStats(false)}
              className="w-full py-2 mt-4 bg-tile-empty hover:bg-tile-filled rounded transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
