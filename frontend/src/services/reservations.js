// reservations-api.js
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function authHeaders() {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Kreira rezervaciju za određeni TIP ulaznice
 * @param {number} eventId
 * @param {number} ticketTypeId  ← OVO JE NOVO!
 * @param {number} numberOfTickets
 */
export async function createReservation(eventId, ticketTypeId, numberOfTickets = 1) {
  const res = await fetch(`${BASE}/reservations/events/${eventId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ticketTypeId, numberOfTickets }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create reservation");
  return data;
}

export async function getUserReservations() {
  const res = await fetch(`${BASE}/reservations`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch reservations");
  return data;
}

export async function deleteReservation(reservationId) {
  const res = await fetch(`${BASE}/reservations/${reservationId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to delete reservation");
  return data;
}

export async function getReservationById(reservationId) {
  const res = await fetch(`${BASE}/reservations/${reservationId}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch reservation");
  return data;
}