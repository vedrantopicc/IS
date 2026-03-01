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
    if (!res.ok) throw new Error(data.error || "Neuspješno preuzimanje administratorskog panela");
    return data;
}

export async function getAllUsers() {
    const res = await fetch(`${BASE}/admin/users`, {
        method: "GET",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno preuzimanje korisnika");
    return data;
}

export async function getUserStats(userId) {
    const res = await fetch(`${BASE}/admin/users/${userId}/stats`, {
        method: "GET",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno preuzimanje statistike korisnika");
    return data;
}

export async function deleteUser(userId) {
    const res = await fetch(`${BASE}/admin/users/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno brisanje korisnika");
    return data;
}

export async function getAllAdminEvents() {
    const res = await fetch(`${BASE}/admin/events`, {
        method: "GET",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno preuzimanje događaja");
    return data;
}

export async function deleteEvent(eventId) {
    const res = await fetch(`${BASE}/admin/events/${eventId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno brisanje događaja");
    return data;
}

// ✅ Dohvati obrisane korisnike — sa fetch, bez axios
export async function getDeletedUsers() {
    const res = await fetch(`${BASE}/admin/deleted-users`, {
        method: "GET",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno preuzimanje obrisanih korisnika");
    return data;
}

// ✅ Vrati korisnika — sa fetch
export async function restoreUser(userId) {
    const res = await fetch(`${BASE}/admin/users/${userId}/restore`, {
        method: "POST",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno vraćanje korisnika");
    return data;
}

export async function getUserCount() {
    const response = await fetch(`${BASE}/admin/user-count`, {
        method: "GET",
        headers: authHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Neuspješno preuzimanje broja korisnika");
    return data;
}

// ✅ Odobri zahtjev za organizatora
export async function approveRoleRequest(requestId) {
    const res = await fetch(`${BASE}/admin/role-requests/${requestId}/approve`, {
        method: "PUT",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno odobravanje zahtjeva");
    return data;
}

// ✅ Odbij zahtjev za organizatora
export async function rejectRoleRequest(requestId) {
    const res = await fetch(`${BASE}/admin/role-requests/${requestId}/reject`, {
        method: "PUT",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno odbijanje zahtjeva");
    return data;
}

// ✅ Dohvati pending zahteve
export async function getRoleRequests() {
    const res = await fetch(`${BASE}/admin/role-requests`, {
        method: "GET",
        headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Neuspješno preuzimanje zahtjeva za uloge");
    return data;
}