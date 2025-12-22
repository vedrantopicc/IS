const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
export async function getAdminDashboard() {
  const res = await fetch(`${BASE}/admin/dashboard`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch admin dashboard");
  return data;
}

export async function getAllUsers() {
  const res = await fetch(`${BASE}/admin/users`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch users");
  return data;
}

export async function getUserStats(userId) {
  const res = await fetch(`${BASE}/admin/users/${userId}/stats`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch user stats");
  return data;
}

export async function deleteUser(userId) {
  const res = await fetch(`${BASE}/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to delete user");
  return data;
}
export async function getAllAdminEvents() {
  const res = await fetch(`${BASE}/admin/events`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch events");
  return data;
}

export async function deleteEvent(eventId) {
  const res = await fetch(`${BASE}/events/${eventId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to delete event");
  return data;
}
