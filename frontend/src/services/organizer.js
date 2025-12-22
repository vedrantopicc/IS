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

export async function createEvent(eventData) {
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
  const response = await fetch(`${API_BASE_URL}/events/organizer/${eventId}`, {
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
  console.log("Making API call to:", `${API_BASE_URL}/events/organizer/${eventId}/reservations`);
  console.log("Auth header:", getAuthHeader());
  
  const response = await fetch(`${API_BASE_URL}/events/organizer/${eventId}/reservations`, {
    method: "GET",
    headers: getAuthHeader(),
  });

  console.log("Response status:", response.status);
  console.log("Response ok:", response.ok);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.log("Error response:", error);
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  console.log("Received reservations data:", data);
  return data;
}
