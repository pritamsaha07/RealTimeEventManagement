// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-r from-blue-500 to-purple-600">
      <div className="text-center text-white p-8 rounded-lg">
        <h1 className="text-5xl font-bold mb-4">Event Management Platform</h1>
        <p className="text-xl mb-8">Create, Manage, and Discover Events</p>
        <div className="flex justify-center space-x-4">
          <Link
            href="/auth/login"
            className="bg-white text-blue-600 px-6 py-3 rounded-md hover:bg-gray-100 transition"
          >
            Login
          </Link>
          <Link
            href="/auth/register"
            className="bg-transparent border-2 border-white text-white px-6 py-3 rounded-md hover:bg-white hover:text-blue-600 transition"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
