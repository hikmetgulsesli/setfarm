import React from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { DraggableEvent } from "./DraggableEvent";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView() {
  const { currentDate, events, moveEvent, draggedEventId, setCurrentDate } = useCalendarStore();

  const today = new Date();
  const isToday =
    currentDate.getDate() === today.getDate() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getFullYear() === today.getFullYear();

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const getEventsForHour = (hour: number) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startTime);
      return (
        eventStart.getDate() === currentDate.getDate() &&
        eventStart.getMonth() === currentDate.getMonth() &&
        eventStart.getFullYear() === currentDate.getFullYear() &&
        eventStart.getHours() === hour
      );
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, hour: number) => {
    e.preventDefault();

    const eventId = e.dataTransfer.getData("text/plain") || draggedEventId;
    if (!eventId) return;

    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    // Calculate new times preserving duration
    const duration =
      new Date(event.endTime).getTime() - new Date(event.startTime).getTime();

    const newStartTime = new Date(currentDate);
    newStartTime.setHours(hour, 0, 0, 0);

    const newEndTime = new Date(newStartTime.getTime() + duration);

    moveEvent(eventId, newStartTime, newEndTime);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-100">
          {currentDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrevDay}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-300 transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-md text-white transition-colors"
          >
            Today
          </button>
          <button
            onClick={handleNextDay}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-300 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Day header */}
      <div
        className={`
          text-center py-3 rounded-lg mb-4
          ${isToday ? "bg-emerald-500/20 ring-1 ring-emerald-500/50" : "bg-zinc-900/50"}
        `}
      >
        <div className="text-3xl font-bold text-zinc-100">{currentDate.getDate()}</div>
        <div className="text-sm text-zinc-400">
          {currentDate.toLocaleDateString("en-US", { weekday: "long" })}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const hourEvents = getEventsForHour(hour);

          return (
            <div key={hour} className="flex gap-4 min-h-[80px] border-t border-zinc-800">
              <div className="w-16 text-xs text-zinc-500 text-right pr-2 pt-2 shrink-0">
                {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
              </div>
              <div
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e, hour)}
                className={`
                  flex-1 p-2 min-h-[80px]
                  transition-all duration-200
                  hover:bg-zinc-800/50
                  ${isToday ? "bg-emerald-500/5" : "bg-zinc-900/30"}
                `}
                data-testid={`day-cell-${hour}`}
              >
                <div className="space-y-1">
                  {hourEvents.map((event) => (
                    <DraggableEvent key={event.id} event={event} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
