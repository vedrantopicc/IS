// organizer-api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getOrganizerEvents() {
  const response = await fetch(`${API_BASE_URL}/events/organizer/my-events`, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Kreira događaj sa višestrukim tipovima ulaznica
 * @param {Object} eventData - mora sadržati `ticketTypes` niz
 */
export async function createEvent(eventData) {
  // Provera: da li postoji ticketTypes niz?
  if (!Array.isArray(eventData.ticketTypes) || eventData.ticketTypes.length === 0) {
    throw new Error("At least one ticket type is required");
  }

  const response = await fetch(`${API_BASE_URL}/events/organizer/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function updateEvent(eventId, eventData) {
  // ⚠️ Ako ažuriraš i ticketTypes, backend trenutno NE podržava to!
  // Za sada ažuriraš samo osnovne podatke (naslov, opis...)
  const response = await fetch(`${API_BASE_URL}/events/organiganizer/${eventId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(eventData),
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