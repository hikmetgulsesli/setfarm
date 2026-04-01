import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  color?: string;
}

export type CalendarView = "month" | "week" | "day";

interface CalendarState {
  events: CalendarEvent[];
  currentDate: Date;
  view: CalendarView;
  draggedEventId: string | null;
  
  // Actions
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  moveEvent: (id: string, newStartTime: Date, newEndTime: Date) => void;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  setDraggedEventId: (id: string | null) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsForDateRange: (start: Date, end: Date) => CalendarEvent[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Sample events for demo
const sampleEvents: CalendarEvent[] = [
  {
    id: generateId(),
    title: "Team Meeting",
    startTime: new Date(new Date().setHours(9, 0, 0, 0)),
    endTime: new Date(new Date().setHours(10, 0, 0, 0)),
    description: "Weekly team sync",
    color: "#3b82f6",
  },
  {
    id: generateId(),
    title: "Lunch Break",
    startTime: new Date(new Date().setHours(12, 0, 0, 0)),
    endTime: new Date(new Date().setHours(13, 0, 0, 0)),
    description: "Lunch with colleagues",
    color: "#10b981",
  },
  {
    id: generateId(),
    title: "Project Review",
    startTime: new Date(new Date().setHours(14, 0, 0, 0)),
    endTime: new Date(new Date().setHours(15, 30, 0, 0)),
    description: "Review Q1 progress",
    color: "#f59e0b",
  },
];

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: sampleEvents,
      currentDate: new Date(),
      view: "month",
      draggedEventId: null,

      addEvent: (event) => {
        const newEvent: CalendarEvent = {
          ...event,
          id: generateId(),
        };
        set((state) => ({
          events: [...state.events, newEvent],
        }));
      },

      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id ? { ...event, ...updates } : event
          ),
        }));
      },

      deleteEvent: (id) => {
        set((state) => ({
          events: state.events.filter((event) => event.id !== id),
        }));
      },

      moveEvent: (id, newStartTime, newEndTime) => {
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id
              ? { ...event, startTime: newStartTime, endTime: newEndTime }
              : event
          ),
        }));
      },

      setCurrentDate: (date) => {
        set({ currentDate: date });
      },

      setView: (view) => {
        set({ view });
      },

      setDraggedEventId: (id) => {
        set({ draggedEventId: id });
      },

      getEventsForDate: (date) => {
        const state = get();
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return state.events.filter((event) => {
          const eventStart = new Date(event.startTime);
          return eventStart >= startOfDay && eventStart <= endOfDay;
        });
      },

      getEventsForDateRange: (start, end) => {
        const state = get();
        return state.events.filter((event) => {
          const eventStart = new Date(event.startTime);
          return eventStart >= start && eventStart <= end;
        });
      },
    }),
    {
      name: "calendar-storage",
      partialize: (state) => ({
        events: state.events.map((event) => ({
          ...event,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
        })),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.events = (state.events as any[]).map((event) => ({
            ...event,
            startTime: new Date(event.startTime as string),
            endTime: new Date(event.endTime as string),
          }));
        }
      },
    }
  )
);
