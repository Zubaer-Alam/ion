"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Session } from "next-auth";
import { Task, User, TasksResponse, ErrorResponse } from "./types";

interface CustomSession extends Session {
  accessToken?: string;
  error?: string;
}

export default function Home() {
  const { data: session } = useSession() as { data: CustomSession | null };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      setError("Session expired, please sign in again");
      return;
    }

    if (session?.accessToken && session.user?.email) {
      setError(null);
      setLoading(true);
      console.log("Fetching tasks for user:", session.user.email);
      fetch(`/api/tasks?userId=${encodeURIComponent(session.user.email)}`)
        .then((res) => res.json())
        .then((data: TasksResponse | ErrorResponse) => {
          if ('error' in data) {
            setError(data.error);
          } else {
            setTasks(data.tasks);
            setUserData(data.user);
          }
        })
        .catch((err) => {
          console.error("Error fetching tasks:", err);
          setError("Failed to fetch tasks");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [session]);

  const userDisplayName = userData?.displayName || session?.user?.name || "User";

  if (!session) {
    return (
      <main className="p-10">
        <button 
          onClick={() => signIn("azure-ad")}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Login with Microsoft
        </button>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-10">
        <button onClick={() => signOut()} className="mb-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
          Logout
        </button>
        <div className="text-red-500 font-semibold">{error}</div>
      </main>
    );
  }
  // Add this function before the return statement
  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 9:
        return "bg-red-100 text-red-800";
      case 5:
        return "bg-yellow-100 text-yellow-800";
      case 1:
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (percentComplete: number) => {
    if (percentComplete === 100) {
      return "bg-green-100 text-green-800";
    }
    if (percentComplete > 0) {
      return "bg-yellow-100 text-yellow-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(dateString));
  };
  return (
    <main className="p-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tasks for {userDisplayName}</h1>
        <button 
          onClick={() => signOut()} 
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Logout
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">Loading tasks...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 bg-red-50 rounded border border-red-200">
          <p className="text-red-600">{error}</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded border">
          <p className="text-gray-500">No assigned tasks found</p>
        </div>
      ) : (
        <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border p-2">Title</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Due Date</th>
            <th className="border p-2">Priority</th>
            <th className="border p-2">Assigned To</th>
            <th className="border p-2">Created By</th>
            <th className="border p-2">Created Date</th>
            <th className="border p-2">Completed Date</th>
            <th className="border p-2">Active</th>
            <th className="border p-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="border p-2">{task.title}</td>
              <td className={`border p-2 ${getStatusColor(task.percentComplete)}`}>
                {task.percentComplete}%
              </td>
              <td className="border p-2">{formatDate(task.dueDateTime)}</td>
              <td className={`border p-2 ${getPriorityColor(task.priority)}`}>
                {task.priority === 9 ? "High" : task.priority === 5 ? "Medium" : task.priority === 1 ? "Low" : "None"}
              </td>
              <td className="border p-2">
                {task.assignedTo.map(user => user.displayName).join(", ") || "Unassigned"}
              </td>
              <td className="border p-2">
                {task.createdBy?.user?.displayName || "Unknown"}
              </td>
              <td className="border p-2">{formatDate(task.createdDateTime)}</td>
              <td className="border p-2">
                {formatDate(task.completedDateTime)}
              </td>
              <td className="border p-2">{task.activeChecklistItemCount}</td>
              <td className="border p-2">{task.checklistItemCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </main>
  );
}
