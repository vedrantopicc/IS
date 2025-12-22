const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function authHeaders() {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function getUserById(id) {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch user");
  return data; 
}

export async function updateUserById(id, payload) {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to update user");
  return data; 
}

export async function changePasswordApi({ currentPassword, newPassword }) {
  const res = await fetch(`${BASE}/auth/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to change password");
  return data; 
}