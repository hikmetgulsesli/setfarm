import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Key } from './Key';

describe('Key', () => {
  it('renders letter key correctly', () => {
    render(<Key letter="A" status="empty" onClick={() => {}} />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('renders ENTER key correctly', () => {
    render(<Key letter="ENTER" status="empty" isWide onClick={() => {}} />);
    expect(screen.getByText('ENTER')).toBeTruthy();
  });

  it('renders BACKSPACE key with ⌫ symbol', () => {
    render(<Key letter="BACKSPACE" status="empty" isWide onClick={() => {}} />);
    expect(screen.getByText('⌫')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Key letter="A" status="empty" onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('A'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has correct data attributes', () => {
    render(<Key letter="A" status="correct" onClick={() => {}} />);
    const key = screen.getByText('A');
    
    expect(key.getAttribute('data-key')).toBe('A');
    expect(key.getAttribute('data-status')).toBe('correct');
  });

  it('applies correct CSS class for empty status', () => {
    render(<Key letter="A" status="empty" onClick={() => {}} />);
    const key = screen.getByText('A');
    
    expect(key.className).toContain('bg-tile-empty');
  });

  it('applies correct CSS class for correct status', () => {
    render(<Key letter="A" status="correct" onClick={() => {}} />);
    const key = screen.getByText('A');
    
    expect(key.className).toContain('bg-correct');
    expect(key.className).toContain('text-white');
  });

  it('applies correct CSS class for present status', () => {
    render(<Key letter="A" status="present" onClick={() => {}} />);
    const key = screen.getByText('A');
    
    expect(key.className).toContain('bg-present');
    expect(key.className).toContain('text-white');
  });

  it('applies correct CSS class for absent status', () => {
    render(<Key letter="A" status="absent" onClick={() => {}} />);
    const key = screen.getByText('A');
    
    expect(key.className).toContain('bg-absent');
    expect(key.className).toContain('text-white');
  });

  it('has wider class for special keys', () => {
    render(<Key letter="ENTER" status="empty" isWide onClick={() => {}} />);
    const key = screen.getByText('ENTER');
    
    expect(key.className).toContain('flex-1');
  });

  it('has aria-label for BACKSPACE', () => {
    render(<Key letter="BACKSPACE" status="empty" isWide onClick={() => {}} />);
    const key = screen.getByLabelText('Sil');
    
    expect(key).toBeTruthy();
  });

  it('renders Turkish characters correctly', () => {
    const { rerender } = render(<Key letter="Ç" status="empty" onClick={() => {}} />);
    expect(screen.getByText('Ç')).toBeTruthy();
    
    rerender(<Key letter="Ş" status="empty" onClick={() => {}} />);
    expect(screen.getByText('Ş')).toBeTruthy();
    
    rerender(<Key letter="Ğ" status="empty" onClick={() => {}} />);
    expect(screen.getByText('Ğ')).toBeTruthy();
    
    rerender(<Key letter="Ü" status="empty" onClick={() => {}} />);
    expect(screen.getByText('Ü')).toBeTruthy();
    
    rerender(<Key letter="Ö" status="empty" onClick={() => {}} />);
    expect(screen.getByText('Ö')).toBeTruthy();
    
    rerender(<Key letter="İ" status="empty" onClick={() => {}} />);
    expect(screen.getByText('İ')).toBeTruthy();
  });
});
