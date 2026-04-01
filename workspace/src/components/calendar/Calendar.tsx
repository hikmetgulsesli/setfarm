import React from "react";
import { useCalendarStore, CalendarView } from "@/store/calendarStore";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function Calendar() {
  const { view, setView } = useCalendarStore();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-zinc-100">
      {/* View selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setView(option.value)}
              className={`
                px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                ${
                  view === option.value
                    ? "bg-zinc-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }
              `}
              data-testid={`view-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex-1 p-4 overflow-hidden">
        {view === "month" && <MonthView />}
        {view === "week" && <WeekView />}
        {view === "day" && <DayView />}
      </div>

      {/* Drag styles */}
      <style jsx global>{`
        .draggable-event {
          transition: all 0.2s ease;
        }
        
        .draggable-event.dragging {
          opacity: 0.5;
          transform: scale(1.05);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }
        
        .droppable-cell.drag-over {
          background-color: rgba(59, 130, 246, 0.1) !important;
          border-color: rgba(59, 130, 246, 0.5) !important;
          box-shadow: inset 0 0 20px rgba(59, 130, 246, 0.1);
        }
        
        /* Custom scrollbar for dark theme */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #18181b;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>
    </div>
  );
}
