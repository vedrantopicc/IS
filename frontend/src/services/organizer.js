// src/services/organizer-api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


export async function getOrganizerEvents({ page = 1, limit = 9, q = "" } = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (q.trim()) qs.set("q", q.trim());

  const response = await fetch(`${API_BASE_URL}/events/organizer/my-events?${qs}`, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}



export async function createEvent(bodyData) {
  const isForm = bodyData instanceof FormData;

  const response = await fetch(`${API_BASE_URL}/events/organizer/create`, {
    method: "POST",
    headers: {
      ...getAuthHeader(),
      ...(isForm ? {} : { "Content-Type": "application/json" }),
    },
    body: isForm ? bodyData : JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function updateEvent(eventId, bodyData) {
  const isForm = bodyData instanceof FormData;

  const response = await fetch(`${API_BASE_URL}/events/organizer/${eventId}`, {
    method: "PUT",
    headers: {
      ...getAuthHeader(),
      ...(isForm ? {} : { "Content-Type": "application/json" }),
    },
    body: isForm ? bodyData : JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function deleteEvent(eventId) {
  const response = await fetch(`${API_BASE_URL}/events/organizer/${eventId}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getEventReservations(eventId) {
  const response = await fetch(`${API_BASE_URL}/events/organizer/${eventId}/reservations`, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}


export async function getEventSalesProgress(eventId) {
  const response = await fetch(`${API_BASE_URL}/events/organizer/${eventId}/sales-progress`, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}: Failed to load sales progress`);
  }

  return response.json(); // ovo je dovoljno – nema potrebe za dodatnom obradom
}