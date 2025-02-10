export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Event {
  _id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  creator: {
    _id: string;
    name: string;
    email: string;
  };
  attendees: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  createdAt: string;
}

export interface EventFormData {
  title: string;
  description: string;
  date: string;
  category: string;
}

export interface EventState {
  events: Event[];
  loading: boolean;
  error: string | null;
  joinedEventId: string | null;
  socket: any;
  fetchEvents: (filters?: {
    category?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<void>;
  createEvent: (
    eventData: Omit<Event, "_id" | "creator" | "attendees" | "createdAt">
  ) => Promise<Event>;
  joinEvent: (eventId: string) => Promise<void>;
  leaveEvent: (eventId: string) => Promise<void>;
  updateEventAttendees: (
    eventId: string,
    attendees: Event["attendees"]
  ) => void;
  setJoinedEventId: (eventId: string | null) => void;
  initializeSocket: () => void;
  disconnectSocket: () => void;
}
