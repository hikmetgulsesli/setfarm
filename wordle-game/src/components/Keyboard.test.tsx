import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Keyboard } from './Keyboard';
import type { Guess } from '../types';

describe('Keyboard', () => {
  const emptyGuesses: Guess[] = [];
  
  it('renders all three rows of keys', () => {
    render(
      <Keyboard
        guesses={emptyGuesses}
        onEnter={() => {}}
        onBackspace={() => {}}
        onLetter={() => {}}
      />
    );
    
    // Check first row (QWERTYUIOPĞÜ)
    expect(screen.getByText('Q')).toBeTruthy();
    expect(screen.getByText('W')).toBeTruthy();
    expect(screen.getByText('E')).toBeTruthy();
    expect(screen.getByText('R')).toBeTruthy();
    expect(screen.getByText('T')).toBeTruthy();
    expect(screen.getByText('Y')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();
    expect(screen.getByText('I')).toBeTruthy();
    expect(screen.getByText('O')).toBeTruthy();
    expect(screen.getByText('P')).toBeTruthy();
    expect(screen.getByText('Ğ')).toBeTruthy();
    expect(screen.getByText('Ü')).toBeTruthy();
    
    // Check second row (ASDFGHJKLŞİ)
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByText('D')).toBeTruthy();
    expect(screen.getByText('F')).toBeTruthy();
    expect(screen.getByText('G')).toBeTruthy();
    expect(screen.getByText('H')).toBeTruthy();
    expect(screen.getByText('J')).toBeTruthy();
    expect(screen.getByText('K')).toBeTruthy();
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('Ş')).toBeTruthy();
    expect(screen.getByText('İ')).toBeTruthy();
    
    // Check third row (ENTER, Z, X, C, V, B, N, M, Ö, Ç, BACKSPACE)
    expect(screen.getByText('ENTER')).toBeTruthy();
    expect(screen.getByText('Z')).toBeTruthy();
    expect(screen.getByText('X')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.getByText('V')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('N')).toBeTruthy();
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByText('Ö')).toBeTruthy();
    expect(screen.getByText('Ç')).toBeTruthy();
    expect(screen.getByText('⌫')).toBeTruthy();
  });

  it('calls onEnter when ENTER key is clicked', () => {
    const handleEnter = vi.fn();
    render(
      <Keyboard
        guesses={emptyGuesses}
        onEnter={handleEnter}
        onBackspace={() => {}}
        onLetter={() => {}}
      />
    );
    
    fireEvent.click(screen.getByText('ENTER'));
    expect(handleEnter).toHaveBeenCalledTimes(1);
  });

  it('calls onBackspace when BACKSPACE key is clicked', () => {
    const handleBackspace = vi.fn();
    render(
      <Keyboard
        guesses={emptyGuesses}
        onEnter={() => {}}
        onBackspace={handleBackspace}
        onLetter={() => {}}
      />
    );
    
    fireEvent.click(screen.getByText('⌫'));
    expect(handleBackspace).toHaveBeenCalledTimes(1);
  });

  it('calls onLetter when letter key is clicked', () => {
    const handleLetter = vi.fn();
    render(
      <Keyboard
        guesses={emptyGuesses}
        onEnter={() => {}}
        onBackspace={() => {}}
        onLetter={handleLetter}
      />
    );
    
    fireEvent.click(screen.getByText('A'));
    expect(handleLetter).toHaveBeenCalledWith('A');
  });

  it('updates key colors based on guesses', () => {
    const guessesWithStatus: Guess[] = [
      {
        word: 'KALEM',
        tiles: [
          { letter: 'K', status: 'correct' },
          { letter: 'A', status: 'present' },
          { letter: 'L', status: 'absent' },
          { letter: 'E', status: 'empty' },
          { letter: 'M', status: 'empty' },
        ],
      },
    ];
    
    render(
      <Keyboard
        guesses={guessesWithStatus}
        onEnter={() => {}}
        onBackspace={() => {}}
        onLetter={() => {}}
      />
    );
    
    // K should be green (correct)
    expect(screen.getByText('K').className).toContain('bg-correct');
    
    // A should be yellow (present)
    expect(screen.getByText('A').className).toContain('bg-present');
    
    // L should be gray (absent)
    expect(screen.getByText('L').className).toContain('bg-absent');
    
    // Unplayed letters should be empty
    expect(screen.getByText('Q').className).toContain('bg-tile-empty');
  });

  it('prioritizes correct over present over absent', () => {
    const guessesWithPriority: Guess[] = [
      {
        word: 'KALEM',
        tiles: [
          { letter: 'A', status: 'present' },
          { letter: 'A', status: 'present' },
          { letter: 'A', status: 'present' },
          { letter: 'A', status: 'present' },
          { letter: 'A', status: 'present' },
        ],
      },
      {
        word: 'AKLEM',
        tiles: [
          { letter: 'A', status: 'correct' },
          { letter: 'A', status: 'correct' },
          { letter: 'A', status: 'correct' },
          { letter: 'A', status: 'correct' },
          { letter: 'A', status: 'correct' },
        ],
      },
    ];
    
    render(
      <Keyboard
        guesses={guessesWithPriority}
        onEnter={() => {}}
        onBackspace={() => {}}
        onLetter={() => {}}
      />
    );
    
    // A should be green (correct takes priority)
    expect(screen.getByText('A').className).toContain('bg-correct');
  });

  it('renders Turkish characters correctly', () => {
    render(
      <Keyboard
        guesses={emptyGuesses}
        onEnter={() => {}}
        onBackspace={() => {}}
        onLetter={() => {}}
      />
    );
    
    // Turkish specific characters
    expect(screen.getByText('Ç')).toBeTruthy();
    expect(screen.getByText('Ş')).toBeTruthy();
    expect(screen.getByText('Ğ')).toBeTruthy();
    expect(screen.getByText('Ü')).toBeTruthy();
    expect(screen.getByText('Ö')).toBeTruthy();
    expect(screen.getByText('İ')).toBeTruthy();
  });

  it('handles empty guesses array', () => {
    render(
      <Keyboard
        guesses={[]}
        onEnter={() => {}}
        onBackspace={() => {}}
        onLetter={() => {}}
      />
    );
    
    // All keys should render with empty status
    expect(screen.getByText('A').className).toContain('bg-tile-empty');
    expect(screen.getByText('Z').className).toContain('bg-tile-empty');
  });

  it('handles guesses without tiles', () => {
    const incompleteGuesses: Guess[] = [
      { word: 'KALEM', tiles: [] },
    ];
    
    render(
      <Keyboard
        guesses={incompleteGuesses}
        onEnter={() => {}}
        onBackspace={() => {}}
        onLetter={() => {}}
      />
    );
    
    // All keys should still render
    expect(screen.getByText('K')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
  });
});
