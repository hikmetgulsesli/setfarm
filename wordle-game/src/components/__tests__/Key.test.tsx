import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Key } from '../Key';

describe('Key', () => {
  const defaultProps = {
    letter: 'A',
    isWide: false,
    onClick: vi.fn(),
  };

  it('renders the letter', () => {
    render(<Key {...defaultProps} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders ENTER for wide key', () => {
    render(<Key {...defaultProps} letter="ENTER" isWide />);
    expect(screen.getByText('ENTER')).toBeInTheDocument();
  });

  it('renders ⌫ for BACKSPACE key', () => {
    render(<Key {...defaultProps} letter="BACKSPACE" isWide />);
    expect(screen.getByText('⌫')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Key {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByText('A'));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies correct CSS class for correct status', () => {
    render(<Key {...defaultProps} status="correct" />);
    const key = screen.getByText('A');
    expect(key).toHaveAttribute('data-status', 'correct');
    expect(key.className).toContain('bg-correct');
  });

  it('applies correct CSS class for present status', () => {
    render(<Key {...defaultProps} status="present" />);
    const key = screen.getByText('A');
    expect(key).toHaveAttribute('data-status', 'present');
    expect(key.className).toContain('bg-present');
  });

  it('applies correct CSS class for absent status', () => {
    render(<Key {...defaultProps} status="absent" />);
    const key = screen.getByText('A');
    expect(key).toHaveAttribute('data-status', 'absent');
    expect(key.className).toContain('bg-absent');
  });

  it('applies default styling for unused keys', () => {
    render(<Key {...defaultProps} />);
    const key = screen.getByText('A');
    expect(key).toHaveAttribute('data-status', 'unused');
    expect(key.className).toContain('bg-tile-empty');
  });

  it('has wider styling for special keys', () => {
    render(<Key {...defaultProps} letter="ENTER" isWide />);
    const key = screen.getByText('ENTER');
    expect(key.className).toContain('flex-1');
  });

  it('has correct aria-label for BACKSPACE', () => {
    render(<Key {...defaultProps} letter="BACKSPACE" isWide />);
    expect(screen.getByLabelText('Sil')).toBeInTheDocument();
  });

  it('has correct aria-label for ENTER', () => {
    render(<Key {...defaultProps} letter="ENTER" isWide />);
    expect(screen.getByLabelText('Gönder')).toBeInTheDocument();
  });
});
