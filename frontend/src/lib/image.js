// frontend/src/lib/image.js
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export function resolveImage(img) {
  if (!img) return "";

  // već je puni link ili lokalni preview
  if (
    img.startsWith("http://") ||
    img.startsWith("https://") ||
    img.startsWith("blob:") ||
    img.startsWith("data:")
  ) {
    return img;
  }

  // "/uploads/xyz.jpg" -> "http://localhost:3000/uploads/xyz.jpg"
  return `${API_BASE_URL}${img.startsWith("/") ? "" : "/"}${img}`;
}