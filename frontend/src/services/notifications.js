const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function authHeaders() {
    const token = localStorage.getItem("token");
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

export async function getNotifications() {
    const res = await fetch(`${BASE}/notifications`, { headers: authHeaders(), cache: "no-store", });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno preuzimanje obavještenja");
    return data; // {items, meta}
}

export async function markAllNotificationsRead() {
    const res = await fetch(`${BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: authHeaders(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Nije moguće označiti obavještenje kao pročitano");
    return data;
}

export async function markNotificationRead(id) {
    const res = await fetch(`${BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Nije moguće označiti obavještenje kao pročitano");
    return data;
}