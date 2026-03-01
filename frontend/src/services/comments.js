const API_BASE_URL = "http://localhost:3000";

const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getEventComments = async (eventId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/comments/event/${eventId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Neuspješno preuzimanje recenzija");
        }

        return await response.json();
    } catch (error) {
        console.error("Greška pri preuzimanju recenzija:", error);
        throw error;
    }
};

export const createComment = async (eventId, commentText, rating) => {
    try {
        const response = await fetch(`${API_BASE_URL}/comments/event/${eventId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
            },
            body: JSON.stringify({
                comment_text: commentText,
                rating: rating
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Neuspješno kreiranje recenzije");
        }

        return await response.json();
    } catch (error) {
        console.error("Greška pri kreiranju recenzije:", error);
        throw error;
    }
};

export const updateComment = async (commentId, commentText, rating) => {
    try {
        const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
            },
            body: JSON.stringify({
                comment_text: commentText,
                rating: rating
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Neuspješno ažuriranje recenzije");
        }

        return await response.json();
    } catch (error) {
        console.error("Greška pri ažuriranju recenzije:", error);
        throw error;
    }
};

export const deleteComment = async (commentId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Neuspješno brisanje recenzije");
        }

        return await response.json();
    } catch (error) {
        console.error("Greška pri brisanju recenzije:", error);
        throw error;
    }
};