import React from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { DraggableEvent } from "./DraggableEvent";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekView() {
  const { currentDate, events, moveEvent, draggedEventId, setCurrentDate } = useCalendarStore();

  // Get start of week (Sunday)
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

  const today = new Date();

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const getEventsForHour = (day: Date, hour: number) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startTime);
      return (
        eventStart.getDate() === day.getDate() &&
        eventStart.getMonth() === day.getMonth() &&
        eventStart.getFullYear() === day.getFullYear() &&
        eventStart.getHours() === hour
      );
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();

    const eventId = e.dataTransfer.getData("text/plain") || draggedEventId;
    if (!eventId) return;

    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    // Calculate new times preserving duration
    const duration =
      new Date(event.endTime).getTime() - new Date(event.startTime).getTime();

    const newStartTime = new Date(day);
    newStartTime.setHours(hour, 0, 0, 0);

    const newEndTime = new Date(newStartTime.getTime() + duration);

    moveEvent(eventId, newStartTime, newEndTime);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-100">
          Week of {startOfWeek.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrevWeek}
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
            onClick={handleNextWeek}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-300 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-8 gap-1 mb-2">
        <div className="text-center text-sm font-semibold text-zinc-500 py-2">Time</div>
        {weekDays.map((day, i) => {
          const isToday =
            day.getDate() === today.getDate() &&
            day.getMonth() === today.getMonth() &&
            day.getFullYear() === today.getFullYear();

          return (
            <div
              key={i}
              className={`
                text-center py-2 rounded-md
                ${isToday ? "bg-emerald-500/20" : ""}
              `}
            >
              <div className="text-sm font-semibold text-zinc-400">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={`
                  text-lg font-bold
                  ${isToday ? "text-emerald-400" : "text-zinc-200"}
                `}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-8 gap-1 min-h-[80px]">
            <div className="text-xs text-zinc-500 text-right pr-2 pt-1">
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            {weekDays.map((day, dayIndex) => {
              const isToday =
                day.getDate() === today.getDate() &&
                day.getMonth() === today.getMonth() &&
                day.getFullYear() === today.getFullYear();
              const hourEvents = getEventsForHour(day, hour);

              return (
                <div
                  key={dayIndex}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={(e) => handleDrop(e, day, hour)}
                  className={`
                    border-t border-zinc-800 p-1 min-h-[80px]
                    transition-all duration-200
                    hover:bg-zinc-800/50
                    ${isToday ? "bg-emerald-500/5" : "bg-zinc-900/30"}
                  `}
                  data-testid={`week-cell-${day.toISOString().split("T")[0]}-${hour}`}
                >
                  <div className="space-y-1">
                    {hourEvents.map((event) => (
                      <DraggableEvent key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
