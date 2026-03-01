// frontend/src/services/roleRequest.js
export async function sendRoleRequest() {
    const token = localStorage.getItem("token");

    if (!token) {
        throw new Error("Neuspješna autentifikacija");
    }

    const response = await fetch("http://localhost:3000/role-requests", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Neuspješno slanje zahtjeva");
    }

    return response.json();
}