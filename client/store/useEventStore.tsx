import { create } from "zustand";
import io from "socket.io-client";
import { Event, EventState } from "@/types";

const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  error: null,
  joinedEventId: null,
  socket: null,

  initializeSocket: () => {
    const socket = io("http://localhost:5000");

    socket.on("eventUpdated", ({ eventId, attendees }) => {
      get().updateEventAttendees(eventId, attendees);
    });

    socket.on("newEvent", (event) => {
      set((state) => ({
        events: [...state.events, event],
      }));
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  fetchEvents: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      if (filters.category) queryParams.append("category", filters.category);
      if (filters.startDate) queryParams.append("startDate", filters.startDate);
      if (filters.endDate) queryParams.append("endDate", filters.endDate);

      const response = await fetch(
        `http://localhost:5000/api/events?${queryParams}`
      );
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      set({ events: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createEvent: async (eventData) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");

    const response = await fetch("http://localhost:5000/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create event");
    }

    const newEvent = await response.json();
    set((state) => ({ events: [...state.events, newEvent] }));
    return newEvent;
  },

  joinEvent: async (eventId) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");

    const response = await fetch(
      `http://localhost:5000/api/events/${eventId}/join`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to join event");
    }

    const updatedEvent = await response.json();
    set((state) => ({
      events: state.events.map((event) =>
        event._id === eventId ? updatedEvent : event
      ),
      joinedEventId: eventId,
    }));
  },

  leaveEvent: async (eventId) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");

    const response = await fetch(
      `http://localhost:5000/api/events/${eventId}/leave`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to leave event");
    }

    const updatedEvent = await response.json();
    set((state) => ({
      events: state.events.map((event) =>
        event._id === eventId ? updatedEvent : event
      ),
      joinedEventId: null,
    }));
  },

  updateEventAttendees: (eventId, attendees) => {
    set((state) => ({
      events: state.events.map((event) =>
        event._id === eventId ? { ...event, attendees } : event
      ),
    }));
  },

  setJoinedEventId: (eventId) => {
    set({ joinedEventId: eventId });
  },
}));

export default useEventStore;
