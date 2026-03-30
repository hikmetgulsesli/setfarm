import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Keyboard } from '../Keyboard';

describe('Keyboard', () => {
  const defaultProps = {
    letterStatuses: {},
    onKeyPress: vi.fn(),
    onEnter: vi.fn(),
    onBackspace: vi.fn(),
  };

  it('renders all three rows of keys', () => {
    render(<Keyboard {...defaultProps} />);
    
    // First row: Q W E R T Y U I O P Ğ Ü
    expect(screen.getByText('Q')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('Ğ')).toBeInTheDocument();
    expect(screen.getByText('Ü')).toBeInTheDocument();

    // Second row: A S D F G H J K L Ş İ
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('Ş')).toBeInTheDocument();
    expect(screen.getByText('İ')).toBeInTheDocument();

    // Third row: ENTER, Z X C V B N M Ö Ç, BACKSPACE (⌫)
    expect(screen.getByText('ENTER')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('V')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('Ö')).toBeInTheDocument();
    expect(screen.getByText('Ç')).toBeInTheDocument();
    expect(screen.getByText('⌫')).toBeInTheDocument();
  });

  it('calls onKeyPress when a letter key is clicked', () => {
    const onKeyPress = vi.fn();
    render(<Keyboard {...defaultProps} onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('A'));
    expect(onKeyPress).toHaveBeenCalledWith('A');

    fireEvent.click(screen.getByText('Ç'));
    expect(onKeyPress).toHaveBeenCalledWith('Ç');

    fireEvent.click(screen.getByText('Ğ'));
    expect(onKeyPress).toHaveBeenCalledWith('Ğ');
  });

  it('calls onEnter when ENTER key is clicked', () => {
    const onEnter = vi.fn();
    render(<Keyboard {...defaultProps} onEnter={onEnter} />);

    fireEvent.click(screen.getByText('ENTER'));
    expect(onEnter).toHaveBeenCalled();
  });

  it('calls onBackspace when BACKSPACE key is clicked', () => {
    const onBackspace = vi.fn();
    render(<Keyboard {...defaultProps} onBackspace={onBackspace} />);

    fireEvent.click(screen.getByText('⌫'));
    expect(onBackspace).toHaveBeenCalled();
  });

  it('displays correct status colors for letters', () => {
    const letterStatuses = {
      a: 'correct' as const,
      b: 'present' as const,
      c: 'absent' as const,
    };

    render(<Keyboard {...defaultProps} letterStatuses={letterStatuses} />);

    const keyA = screen.getByText('A');
    const keyB = screen.getByText('B');
    const keyC = screen.getByText('C');

    expect(keyA).toHaveAttribute('data-status', 'correct');
    expect(keyB).toHaveAttribute('data-status', 'present');
    expect(keyC).toHaveAttribute('data-status', 'absent');
  });
});
