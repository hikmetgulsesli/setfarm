import React from "react";
import { CalendarEvent, useCalendarStore } from "@/store/calendarStore";

interface DraggableEventProps {
  event: CalendarEvent;
  compact?: boolean;
}

export function DraggableEvent({ event, compact = false }: DraggableEventProps) {
  const { setDraggedEventId } = useCalendarStore();

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedEventId(event.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", event.id);
    
    // Add custom drag image styling via CSS class
    const target = e.currentTarget as HTMLElement;
    target.classList.add("dragging");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedEventId(null);
    const target = e.currentTarget as HTMLElement;
    target.classList.remove("dragging");
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const duration =
    (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) /
    (1000 * 60);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        draggable-event
        rounded-md px-2 py-1 text-xs font-medium cursor-move
        transition-all duration-200
        hover:shadow-lg hover:scale-[1.02]
        active:scale-[0.98]
        ${compact ? "truncate" : ""}
      `}
      style={{
        backgroundColor: `${event.color || "#3b82f6"}20`,
        borderLeft: `3px solid ${event.color || "#3b82f6"}`,
        color: "#e4e4e7",
      }}
      data-testid={`event-${event.id}`}
      data-event-id={event.id}
    >
      <div className="font-semibold truncate">{event.title}</div>
      {!compact && (
        <div className="text-zinc-400 text-[10px]">
          {formatTime(event.startTime)} • {duration}min
        </div>
      )}
    </div>
  );
}
