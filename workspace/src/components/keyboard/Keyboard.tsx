"use client";

import { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Key } from "./Key";
import { useGameStore, KEYBOARD_ROWS } from "@/store/gameStore";

interface KeyboardProps {
  onKeyPress?: (key: string) => void;
  onEnter?: () => void;
  onBackspace?: () => void;
  disabled?: boolean;
}

export function Keyboard({
  onKeyPress,
  onEnter,
  onBackspace,
  disabled = false,
}: KeyboardProps) {
  const {
    addLetter,
    deleteLetter,
    submitGuess,
    getLetterStatus,
  } = useGameStore();

  const handleKeyClick = useCallback(
    (key: string) => {
      if (disabled) return;

      if (key === "ENTER") {
        submitGuess();
        onEnter?.();
        return;
      }

      if (key === "BACKSPACE") {
        deleteLetter();
        onBackspace?.();
        return;
      }

      addLetter(key);
      onKeyPress?.(key);
    },
    [addLetter, deleteLetter, submitGuess, onKeyPress, onEnter, onBackspace, disabled]
  );

  // Handle physical keyboard input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      const key = event.key.toUpperCase();

      if (key === "ENTER") {
        event.preventDefault();
        handleKeyClick("ENTER");
      } else if (key === "BACKSPACE") {
        event.preventDefault();
        handleKeyClick("BACKSPACE");
      } else if (/^[A-ZÇĞİŞÜÖ]$/.test(key)) {
        event.preventDefault();
        handleKeyClick(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyClick, disabled]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-1.5 sm:gap-2 p-2 sm:p-4"
      role="group"
      aria-label="Virtual keyboard"
    >
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex justify-center gap-1 sm:gap-1.5 w-full"
        >
          {row.map((key) => {
            const isSpecial = key === "ENTER" || key === "BACKSPACE";
            const status = isSpecial ? "unused" : getLetterStatus(key);

            return (
              <Key
                key={key}
                letter={key}
                status={status}
                isSpecial={isSpecial}
                onClick={() => handleKeyClick(key)}
                disabled={disabled}
              />
            );
          })}
        </div>
      ))}
    </motion.div>
  );
}
