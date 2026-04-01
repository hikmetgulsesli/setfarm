import { render, screen, fireEvent } from "@testing-library/react";
import { Key } from "./Key";
import { describe, it, expect, vi } from "vitest";

describe("Key", () => {
  it("renders letter key correctly", () => {
    render(<Key letter="A" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders Turkish characters correctly", () => {
    render(<Key letter="Ç" />);
    expect(screen.getByText("Ç")).toBeInTheDocument();
  });

  it("renders ENTER key correctly", () => {
    render(<Key letter="ENTER" isSpecial />);
    expect(screen.getByText("ENTER")).toBeInTheDocument();
  });

  it("renders BACKSPACE key with icon", () => {
    render(<Key letter="BACKSPACE" isSpecial />);
    expect(screen.getByLabelText("Backspace")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Key letter="A" onClick={handleClick} />);
    
    fireEvent.click(screen.getByText("A"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies correct status for unused state", () => {
    render(<Key letter="A" status="unused" />);
    const button = screen.getByText("A").closest("button");
    expect(button).toHaveClass("bg-zinc-800");
  });

  it("applies correct status for correct state", () => {
    render(<Key letter="A" status="correct" />);
    const button = screen.getByText("A").closest("button");
    expect(button).toHaveClass("bg-emerald-500");
  });

  it("applies correct status for present state", () => {
    render(<Key letter="A" status="present" />);
    const button = screen.getByText("A").closest("button");
    expect(button).toHaveClass("bg-amber-500");
  });

  it("applies correct status for absent state", () => {
    render(<Key letter="A" status="absent" />);
    const button = screen.getByText("A").closest("button");
    expect(button).toHaveClass("bg-zinc-700");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Key letter="A" disabled />);
    const button = screen.getByText("A").closest("button");
    expect(button).toBeDisabled();
  });

  it("has correct aria-label for special keys", () => {
    render(<Key letter="ENTER" isSpecial />);
    expect(screen.getByLabelText("Enter")).toBeInTheDocument();
  });
});
