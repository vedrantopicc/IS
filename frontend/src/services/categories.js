// src/services/categories.js

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function getCategories() {
  const res = await fetch(`${API_URL}/categories`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load categories");
  }
  return res.json();
}
