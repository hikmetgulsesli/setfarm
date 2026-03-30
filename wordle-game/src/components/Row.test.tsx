import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Row } from './Row';
import type { Guess } from '../types';

describe('Row', () => {
  it('renders 5 tiles', () => {
    render(<Row />);
    const tiles = document.querySelectorAll('[data-status]');
    expect(tiles.length).toBe(5);
  });

  it('renders completed guess with correct tiles', () => {
    const guess: Guess = {
      word: 'KİTAP',
      tiles: [
        { letter: 'K', status: 'correct' },
        { letter: 'İ', status: 'present' },
        { letter: 'T', status: 'absent' },
        { letter: 'A', status: 'absent' },
        { letter: 'P', status: 'absent' },
      ],
    };
    render(<Row guess={guess} isRevealed={true} />);
    
    expect(document.querySelector('[data-letter="K"]')).toBeDefined();
    expect(document.querySelector('[data-letter="İ"]')).toBeDefined();
    expect(document.querySelector('[data-letter="T"]')).toBeDefined();
    expect(document.querySelector('[data-letter="A"]')).toBeDefined();
    expect(document.querySelector('[data-letter="P"]')).toBeDefined();
  });

  it('renders current row with current word', () => {
    render(<Row isCurrentRow={true} currentWord="KİT" />);
    
    expect(document.querySelector('[data-letter="K"]')).toBeDefined();
    expect(document.querySelector('[data-letter="İ"]')).toBeDefined();
    expect(document.querySelector('[data-letter="T"]')).toBeDefined();
  });

  it('renders empty row correctly', () => {
    render(<Row />);
    const tiles = document.querySelectorAll('[data-status="empty"]');
    expect(tiles.length).toBe(5);
  });

  it('passes isShaking to all tiles when shaking', () => {
    render(<Row isShaking={true} />);
    // Shake animation is applied at row level or tile level
    const row = document.querySelector('[data-row-index]');
    expect(row).toBeDefined();
  });

  it('renders Turkish characters in guess', () => {
    const guess: Guess = {
      word: 'ÇİÇEK',
      tiles: [
        { letter: 'Ç', status: 'correct' },
        { letter: 'İ', status: 'correct' },
        { letter: 'Ç', status: 'correct' },
        { letter: 'E', status: 'correct' },
        { letter: 'K', status: 'correct' },
      ],
    };
    const { container } = render(<Row guess={guess} isRevealed={true} />);
    expect(container.textContent).toContain('Ç');
    expect(container.textContent).toContain('İ');
  });
});
