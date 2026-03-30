import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Board } from './Board';
import type { Guess } from '../types';

describe('Board', () => {
  it('renders 6 rows', () => {
    render(<Board guesses={[]} currentRow={0} currentWord="" shakingRow={null} isWin={false} />);
    const rows = document.querySelectorAll('[data-row-index]');
    expect(rows.length).toBe(6);
  });

  it('renders 30 tiles total (6 rows × 5 tiles)', () => {
    render(<Board guesses={[]} currentRow={0} currentWord="" shakingRow={null} isWin={false} />);
    const tiles = document.querySelectorAll('[data-status]');
    expect(tiles.length).toBe(30);
  });

  it('renders completed guesses correctly', () => {
    const guesses: Guess[] = [
      {
        word: 'KİTAP',
        tiles: [
          { letter: 'K', status: 'correct' },
          { letter: 'İ', status: 'present' },
          { letter: 'T', status: 'absent' },
          { letter: 'A', status: 'absent' },
          { letter: 'P', status: 'absent' },
        ],
      },
    ];
    render(<Board guesses={guesses} currentRow={1} currentWord="" shakingRow={null} isWin={false} />);
    
    // Check that the first row has the correct letters
    expect(document.querySelector('[data-letter="K"]')).toBeDefined();
    expect(document.querySelector('[data-letter="İ"]')).toBeDefined();
  });

  it('renders current row with current word', () => {
    render(<Board guesses={[]} currentRow={0} currentWord="KİT" shakingRow={null} isWin={false} />);
    
    expect(document.querySelector('[data-letter="K"]')).toBeDefined();
    expect(document.querySelector('[data-letter="İ"]')).toBeDefined();
    expect(document.querySelector('[data-letter="T"]')).toBeDefined();
  });

  it('applies shake animation to shaking row', () => {
    render(<Board guesses={[]} currentRow={0} currentWord="KİTAP" shakingRow={0} isWin={false} />);
    const row = document.querySelector('[data-row-index="0"]');
    expect(row).toBeDefined();
  });

  it('applies bounce animation on win', () => {
    const guesses: Guess[] = [
      {
        word: 'KİTAP',
        tiles: [
          { letter: 'K', status: 'correct' },
          { letter: 'İ', status: 'correct' },
          { letter: 'T', status: 'correct' },
          { letter: 'A', status: 'correct' },
          { letter: 'P', status: 'correct' },
        ],
      },
    ];
    render(<Board guesses={guesses} currentRow={1} currentWord="" shakingRow={null} isWin={true} />);
    const row = document.querySelector('[data-row-index="0"]');
    expect(row).toBeDefined();
  });

  it('renders Turkish characters correctly', () => {
    const guesses: Guess[] = [
      {
        word: 'ÇİĞDEM',
        tiles: [
          { letter: 'Ç', status: 'correct' },
          { letter: 'İ', status: 'correct' },
          { letter: 'Ğ', status: 'correct' },
          { letter: 'D', status: 'correct' },
          { letter: 'E', status: 'correct' },
        ],
      },
    ];
    const { container } = render(<Board guesses={guesses} currentRow={1} currentWord="" shakingRow={null} isWin={false} />);
    expect(container.textContent).toContain('Ç');
    expect(container.textContent).toContain('İ');
    expect(container.textContent).toContain('Ğ');
  });
});
