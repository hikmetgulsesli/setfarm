"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type LetterStatus } from "@/store/gameStore";

interface KeyProps {
  letter: string;
  status?: LetterStatus;
  isSpecial?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const statusStyles: Record<LetterStatus, string> = {
  correct: "bg-emerald-500 text-white border-emerald-500",
  present: "bg-amber-500 text-white border-amber-500",
  absent: "bg-zinc-700 text-zinc-400 border-zinc-700",
  unused: "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600",
};

export function Key({
  letter,
  status = "unused",
  isSpecial = false,
  onClick,
  disabled = false,
}: KeyProps) {
  const isBackspace = letter === "BACKSPACE";
  const isEnter = letter === "ENTER";

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center justify-center rounded-md font-semibold text-sm select-none transition-colors duration-150 border",
        "h-12 sm:h-14",
        isSpecial ? "px-2 sm:px-4 flex-1 min-w-[3rem]" : "w-8 sm:w-10",
        statusStyles[status],
        disabled && "opacity-50 cursor-not-allowed",
        "active:scale-95"
      )}
      aria-label={isBackspace ? "Backspace" : isEnter ? "Enter" : letter}
    >
      {isBackspace ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sm:w-6 sm:h-6"
        >
          <path d="M21 5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.828a2 2 0 0 1-1.414-.586l-2.414-2.414A2 2 0 0 1 1 14.172V9.828a2 2 0 0 1 .586-1.414l2.414-2.414A2 2 0 0 1 5.828 5H21z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ) : isEnter ? (
        <span className="text-xs sm:text-sm">ENTER</span>
      ) : (
        <span className="text-base sm:text-lg">{letter}</span>
      )}
    </motion.button>
  );
}
