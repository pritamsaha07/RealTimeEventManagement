"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import useEventStore from "@/store/useEventStore";
import { EventFormData } from "@/types";

const initialFormData: EventFormData = {
  title: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  category: "Conference",
};

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const {
    events,
    fetchEvents,
    createEvent,
    loading,
    error: eventError,
    joinEvent,
    leaveEvent,
    joinedEventId,
    initializeSocket,
    disconnectSocket,
  } = useEventStore();

  const router = useRouter();

  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    initializeSocket();
    fetchEvents({ category: filter });

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      await createEvent({
        ...formData,
        date: new Date(formData.date).toISOString(),
      });

      setFormData(initialFormData);
      setShowForm(false);
      await fetchEvents({ category: filter });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    try {
      await joinEvent(eventId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveEvent = async (eventId: string) => {
    try {
      await leaveEvent(eventId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
          >
            Create Event
          </button>
        </div>

        {(error || eventError) && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error || eventError}</span>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Create New Event</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Conference">Conference</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Meetup">Meetup</option>
                  <option value="Seminar">Seminar</option>
                  <option value="Social">Social</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
                >
                  {creating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4 mt-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">All Events</option>
          <option value="Conference">Conference</option>
          <option value="Workshop">Workshop</option>
          <option value="Meetup">Meetup</option>
          <option value="Seminar">Seminar</option>
          <option value="Social">Social</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading events...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <div
              key={event._id}
              className="border p-4 rounded shadow hover:shadow-lg transition"
            >
              <h2 className="text-xl font-semibold mb-2">{event.title}</h2>
              <p className="text-gray-600 mb-3">{event.description}</p>
              <div className="flex justify-between items-center text-sm mb-3">
                <span className="text-gray-500">
                  {new Date(event.date).toLocaleDateString()}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {event.category}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                <strong>Attendees:</strong> {event.attendees.length}
              </div>
              {event.creator && (
                <div className="text-sm text-gray-500 mb-3">
                  Created by: {event.creator.name}
                </div>
              )}
              {joinedEventId === event._id ? (
                <button
                  onClick={() => handleLeaveEvent(event._id)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Leave Event
                </button>
              ) : (
                <button
                  onClick={() => handleJoinEvent(event._id)}
                  disabled={!!joinedEventId}
                  className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {joinedEventId
                    ? "Already Joined Another Event"
                    : "Join Event"}
                </button>
              )}
              {event.attendees.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Attendee List:
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {event.attendees.map((attendee) => (
                      <div
                        key={attendee._id}
                        className="text-sm text-gray-600 py-1 border-b last:border-b-0"
                      >
                        {attendee.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
