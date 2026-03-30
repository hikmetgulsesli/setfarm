import { describe, it, expect } from 'vitest'
import type { GameState, TileState, Statistics, GuessResult } from '../types'

describe('useGame types', () => {
  it('should have correct GameState values', () => {
    const states: GameState[] = ['IDLE', 'PLAYING', 'WIN', 'LOSE']
    expect(states).toContain('IDLE')
    expect(states).toContain('PLAYING')
    expect(states).toContain('WIN')
    expect(states).toContain('LOSE')
  })

  it('should have correct TileState values', () => {
    const states: TileState[] = ['empty', 'filled', 'correct', 'present', 'absent']
    expect(states).toContain('empty')
    expect(states).toContain('filled')
    expect(states).toContain('correct')
    expect(states).toContain('present')
    expect(states).toContain('absent')
  })

  it('should have valid Statistics interface', () => {
    const stats: Statistics = {
      gamesPlayed: 10,
      gamesWon: 8,
      currentStreak: 3,
      maxStreak: 5,
      guessDistribution: [0, 1, 2, 3, 2, 0]
    }
    expect(stats.gamesPlayed).toBe(10)
    expect(stats.guessDistribution).toHaveLength(6)
  })

  it('should have valid GuessResult interface', () => {
    const result: GuessResult = {
      letter: 'A',
      state: 'correct'
    }
    expect(result.letter).toBe('A')
    expect(result.state).toBe('correct')
  })
})
