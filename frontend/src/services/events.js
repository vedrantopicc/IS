const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  const { from, to, sort } = params;
  if (from) q.set("from", from);  
  if (to)   q.set("to", to);      
  if (sort) q.set("sort", sort);  
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getEvents(params = {}) {
  const url = `${BASE}/events${buildQuery(params)}`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch events");
  return data;
}

export async function getEvent(id) {
  const res = await fetch(`${BASE}/events/${id}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch event");
  return data;
}