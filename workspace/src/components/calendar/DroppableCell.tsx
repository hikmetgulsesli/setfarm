import React from "react";
import { useCalendarStore } from "@/store/calendarStore";
import { DraggableEvent } from "./DraggableEvent";

interface DroppableCellProps {
  date: Date;
  isCurrentMonth?: boolean;
  isToday?: boolean;
  children?: React.ReactNode;
}

export function DroppableCell({
  date,
  isCurrentMonth = true,
  isToday = false,
  children,
}: DroppableCellProps) {
  const { events, moveEvent, draggedEventId, getEventsForDate } = useCalendarStore();
  const [isDragOver, setIsDragOver] = React.useState(false);

  const dayEvents = getEventsForDate(date);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const eventId = e.dataTransfer.getData("text/plain") || draggedEventId;
    if (!eventId) return;

    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    // Calculate new times preserving duration
    const duration =
      new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
    const originalStart = new Date(event.startTime);
    
    const newStartTime = new Date(date);
    newStartTime.setHours(originalStart.getHours(), originalStart.getMinutes());
    
    const newEndTime = new Date(newStartTime.getTime() + duration);

    moveEvent(eventId, newStartTime, newEndTime);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        droppable-cell
        min-h-[100px] p-2 rounded-lg border transition-all duration-200
        ${isCurrentMonth ? "bg-zinc-900/50" : "bg-zinc-950/30"}
        ${isToday ? "ring-2 ring-emerald-500/50" : "border-zinc-800"}
        ${isDragOver ? "drag-over ring-2 ring-blue-500 bg-blue-500/10" : ""}
        hover:border-zinc-700
      `}
      data-testid={`cell-${date.toISOString().split("T")[0]}`}
      data-date={date.toISOString()}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`
            text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
            ${isToday ? "bg-emerald-500 text-white" : ""}
            ${!isCurrentMonth ? "text-zinc-600" : "text-zinc-400"}
          `}
        >
          {date.getDate()}
        </span>
      </div>

      <div className="space-y-1">
        {dayEvents.map((event) => (
          <DraggableEvent key={event.id} event={event} compact />
        ))}
      </div>

      {children}
    </div>
  );
}
