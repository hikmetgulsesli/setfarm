import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Tile } from './Tile';

describe('Tile', () => {
  it('renders empty tile correctly', () => {
    render(<Tile letter="" status="empty" />);
    const tile = document.querySelector('[data-status="empty"]');
    expect(tile).toBeDefined();
  });

  it('renders letter correctly', () => {
    render(<Tile letter="A" status="empty" />);
    expect(document.querySelector('[data-letter="A"]')).toBeDefined();
  });

  it('renders Turkish characters correctly', () => {
    const turkishChars = ['Ç', 'Ş', 'Ğ', 'Ü', 'Ö', 'İ', 'ı'];
    turkishChars.forEach(char => {
      const { container } = render(<Tile letter={char} status="empty" />);
      expect(container.textContent).toContain(char);
    });
  });

  it('applies correct status class for correct state', () => {
    render(<Tile letter="A" status="correct" isRevealed={true} />);
    const tile = document.querySelector('.bg-correct');
    expect(tile).toBeDefined();
  });

  it('applies correct status class for present state', () => {
    render(<Tile letter="A" status="present" isRevealed={true} />);
    const tile = document.querySelector('.bg-present');
    expect(tile).toBeDefined();
  });

  it('applies correct status class for absent state', () => {
    render(<Tile letter="A" status="absent" isRevealed={true} />);
    const tile = document.querySelector('.bg-absent');
    expect(tile).toBeDefined();
  });

  it('applies filled class when letter is present but not revealed', () => {
    render(<Tile letter="A" status="empty" isRevealed={false} />);
    const tile = document.querySelector('.bg-tile-filled');
    expect(tile).toBeDefined();
  });

  it('applies empty class when no letter and not revealed', () => {
    render(<Tile letter="" status="empty" isRevealed={false} />);
    const tile = document.querySelector('.bg-transparent');
    expect(tile).toBeDefined();
  });
});
