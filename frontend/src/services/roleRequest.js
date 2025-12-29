// frontend/src/services/roleRequest.js
export async function sendRoleRequest() {
    const token = localStorage.getItem("token");
  
    if (!token) {
      throw new Error("Not authenticated");
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
      throw new Error(error.error || "Failed to send request");
    }
  
    return response.json();
  }