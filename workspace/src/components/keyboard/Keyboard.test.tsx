import { render, screen, fireEvent } from "@testing-library/react";
import { Keyboard } from "./Keyboard";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGameStore } from "@/store/gameStore";

describe("Keyboard", () => {
  beforeEach(() => {
    // Reset the store before each test
    useGameStore.setState({
      letterStatus: {},
      currentGuess: "",
      guesses: [],
      targetWord: "KİTAP",
    });
  });

  it("renders all keyboard rows", () => {
    render(<Keyboard />);
    
    // Check for some letters from each row
    expect(screen.getByText("Q")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Z")).toBeInTheDocument();
  });

  it("renders Turkish characters", () => {
    render(<Keyboard />);
    
    expect(screen.getByText("Ç")).toBeInTheDocument();
    expect(screen.getByText("Ğ")).toBeInTheDocument();
    expect(screen.getByText("İ")).toBeInTheDocument();
    expect(screen.getByText("Ş")).toBeInTheDocument();
    expect(screen.getByText("Ü")).toBeInTheDocument();
    expect(screen.getByText("Ö")).toBeInTheDocument();
  });

  it("renders ENTER and BACKSPACE keys", () => {
    render(<Keyboard />);
    
    expect(screen.getByText("ENTER")).toBeInTheDocument();
    expect(screen.getByLabelText("Backspace")).toBeInTheDocument();
  });

  it("calls onKeyPress when letter key is clicked", () => {
    const handleKeyPress = vi.fn();
    render(<Keyboard onKeyPress={handleKeyPress} />);
    
    fireEvent.click(screen.getByText("A"));
    expect(handleKeyPress).toHaveBeenCalledWith("A");
  });

  it("calls onEnter when ENTER key is clicked", () => {
    const handleEnter = vi.fn();
    render(<Keyboard onEnter={handleEnter} />);
    
    // Add 5 letters first
    fireEvent.click(screen.getByText("K"));
    fireEvent.click(screen.getByText("İ"));
    fireEvent.click(screen.getByText("T"));
    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByText("P"));
    
    fireEvent.click(screen.getByText("ENTER"));
    expect(handleEnter).toHaveBeenCalled();
  });

  it("calls onBackspace when BACKSPACE key is clicked", () => {
    const handleBackspace = vi.fn();
    render(<Keyboard onBackspace={handleBackspace} />);
    
    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByLabelText("Backspace"));
    expect(handleBackspace).toHaveBeenCalled();
  });

  it("has correct aria-label for keyboard", () => {
    render(<Keyboard />);
    expect(screen.getByLabelText("Virtual keyboard")).toBeInTheDocument();
  });

  it("updates key colors based on letter status", () => {
    useGameStore.setState({
      letterStatus: { A: "correct", B: "present", C: "absent" },
    });
    
    render(<Keyboard />);
    
    const keyA = screen.getByText("A").closest("button");
    const keyB = screen.getByText("B").closest("button");
    const keyC = screen.getByText("C").closest("button");
    
    expect(keyA).toHaveClass("bg-emerald-500");
    expect(keyB).toHaveClass("bg-amber-500");
    expect(keyC).toHaveClass("bg-zinc-700");
  });
});
