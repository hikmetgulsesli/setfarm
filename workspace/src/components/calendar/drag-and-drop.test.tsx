import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock Zustand persist middleware
vi.mock("zustand/middleware", () => ({
  persist: (fn: unknown) => fn,
  createJSONStorage: () => ({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }),
}));

import { useCalendarStore, CalendarEvent } from "@/store/calendarStore";
import { DraggableEvent } from "@/components/calendar/DraggableEvent";
import { DroppableCell } from "@/components/calendar/DroppableCell";

// Helper to format date for testid
const formatDateForTestId = (date: Date) => {
  return date.toISOString().split("T")[0];
};

describe("Drag and Drop Event Rescheduling", () => {
  beforeEach(() => {
    // Reset store state
    const store = useCalendarStore.getState();
    store.events = [];
    store.draggedEventId = null;
    store.currentDate = new Date(Date.UTC(2024, 0, 15)); // Jan 15, 2024 UTC
  });

  describe("DraggableEvent", () => {
    it("renders event with correct styling", () => {
      const event: CalendarEvent = {
        id: "test-1",
        title: "Test Event",
        startTime: new Date(Date.UTC(2024, 0, 15, 10, 0)),
        endTime: new Date(Date.UTC(2024, 0, 15, 11, 0)),
        color: "#3b82f6",
      };

      render(<DraggableEvent event={event} />);

      expect(screen.getByText("Test Event")).toBeInTheDocument();
      expect(screen.getByTestId("event-test-1")).toHaveClass("draggable-event");
    });

    it("sets draggedEventId on drag start", () => {
      const event: CalendarEvent = {
        id: "test-1",
        title: "Test Event",
        startTime: new Date(Date.UTC(2024, 0, 15, 10, 0)),
        endTime: new Date(Date.UTC(2024, 0, 15, 11, 0)),
      };

      render(<DraggableEvent event={event} />);

      const eventElement = screen.getByTestId("event-test-1");
      fireEvent.dragStart(eventElement, {
        dataTransfer: {
          setData: vi.fn(),
          effectAllowed: "",
        },
      });

      expect(useCalendarStore.getState().draggedEventId).toBe("test-1");
    });

    it("clears draggedEventId on drag end", () => {
      const event: CalendarEvent = {
        id: "test-1",
        title: "Test Event",
        startTime: new Date(Date.UTC(2024, 0, 15, 10, 0)),
        endTime: new Date(Date.UTC(2024, 0, 15, 11, 0)),
      };

      useCalendarStore.setState({ draggedEventId: "test-1" });

      render(<DraggableEvent event={event} />);

      const eventElement = screen.getByTestId("event-test-1");
      fireEvent.dragEnd(eventElement);

      expect(useCalendarStore.getState().draggedEventId).toBeNull();
    });
  });

  describe("DroppableCell", () => {
    it("renders cell with correct date", () => {
      const date = new Date(Date.UTC(2024, 0, 15));

      render(<DroppableCell date={date} isCurrentMonth />);

      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("shows drag-over state on drag over", () => {
      const date = new Date(Date.UTC(2024, 0, 15));

      render(<DroppableCell date={date} isCurrentMonth />);

      const cell = screen.getByTestId(`cell-${formatDateForTestId(date)}`);
      fireEvent.dragOver(cell, {
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: "" },
      });

      expect(cell).toHaveClass("drag-over");
    });

    it("moves event on drop to different day", () => {
      const originalDate = new Date(Date.UTC(2024, 0, 15, 10, 0));
      const newDate = new Date(Date.UTC(2024, 0, 20));

      useCalendarStore.setState({
        events: [
          {
            id: "event-1",
            title: "Meeting",
            startTime: originalDate,
            endTime: new Date(Date.UTC(2024, 0, 15, 11, 0)),
          },
        ],
        draggedEventId: "event-1",
      });

      render(<DroppableCell date={newDate} isCurrentMonth />);

      const cell = screen.getByTestId(`cell-${formatDateForTestId(newDate)}`);
      fireEvent.drop(cell, {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => "event-1",
        },
      });

      const updatedEvent = useCalendarStore
        .getState()
        .events.find((e) => e.id === "event-1");

      expect(updatedEvent?.startTime.getUTCDate()).toBe(20);
      expect(updatedEvent?.startTime.getUTCHours()).toBe(10); // Preserves original time
    });

    it("preserves event duration when moving", () => {
      const originalDate = new Date(Date.UTC(2024, 0, 15, 10, 0));
      const originalEnd = new Date(Date.UTC(2024, 0, 15, 12, 30)); // 2.5 hour duration
      const newDate = new Date(Date.UTC(2024, 0, 20));

      useCalendarStore.setState({
        events: [
          {
            id: "event-1",
            title: "Long Meeting",
            startTime: originalDate,
            endTime: originalEnd,
          },
        ],
        draggedEventId: "event-1",
      });

      render(<DroppableCell date={newDate} isCurrentMonth />);

      const cell = screen.getByTestId(`cell-${formatDateForTestId(newDate)}`);
      fireEvent.drop(cell, {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => "event-1",
        },
      });

      const updatedEvent = useCalendarStore
        .getState()
        .events.find((e) => e.id === "event-1");

      const duration =
        (updatedEvent!.endTime.getTime() - updatedEvent!.startTime.getTime()) /
        (1000 * 60);

      expect(duration).toBe(150); // 2.5 hours in minutes
    });
  });

  describe("Calendar Store", () => {
    it("moves event to new date and time", () => {
      const store = useCalendarStore.getState();
      
      // Create a test event directly in the store - use setState to ensure reactivity
      const testEvent: CalendarEvent = {
        id: "test-move-event",
        title: "Test Event",
        startTime: new Date(Date.UTC(2024, 0, 15, 10, 0)),
        endTime: new Date(Date.UTC(2024, 0, 15, 11, 0)),
      };
      
      // Add to existing events using setState
      useCalendarStore.setState({ events: [...store.events, testEvent] });

      store.moveEvent(
        testEvent.id,
        new Date(Date.UTC(2024, 0, 20, 14, 0)),
        new Date(Date.UTC(2024, 0, 20, 15, 0))
      );

      const updatedEvent = useCalendarStore.getState().events.find((e) => e.id === testEvent.id);
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent?.startTime.getUTCDate()).toBe(20);
      expect(updatedEvent?.startTime.getUTCHours()).toBe(14);
    });

    it("gets events for specific date", () => {
      const store = useCalendarStore.getState();

      store.addEvent({
        title: "Event 1",
        startTime: new Date(Date.UTC(2024, 0, 15, 10, 0)),
        endTime: new Date(Date.UTC(2024, 0, 15, 11, 0)),
      });

      store.addEvent({
        title: "Event 2",
        startTime: new Date(Date.UTC(2024, 0, 16, 10, 0)),
        endTime: new Date(Date.UTC(2024, 0, 16, 11, 0)),
      });

      const jan15Events = store.getEventsForDate(new Date(Date.UTC(2024, 0, 15)));
      expect(jan15Events).toHaveLength(1);
      expect(jan15Events[0].title).toBe("Event 1");
    });
  });
});
