import { Router } from "express";
import { 
  getAllUsers, 
  getUserById, 
  updateUserById, 
  deleteUserById,
  getAdminActivityStats,
  getUserRoleStats, // ← Dodata nova funkcija za brojanje organizatora
  getDeletedUsers,
  restoreUserById
} from "../controllers/users-controller.js";
import { requireAdmin, requireSelfOrAdmin } from "../middleware/auth-middleware.js";

const router = Router();

// --- RUTE ZA STATISTIKU (Admin Dashboard) ---
// Ove rute su specifične i moraju ići prve
router.get("/stats/activity", requireAdmin, getAdminActivityStats);
router.get("/stats/roles", requireAdmin, getUserRoleStats); // ← Ova ruta puni "Role Share" na frontendu

// --- RUTE ZA UPRAVLJANJE KORISNICIMA ---
router.get("/", requireAdmin, getAllUsers);
router.get("/deleted", requireAdmin, getDeletedUsers); // Ruta za pregled obrisanih

// --- RUTE SA PARAMETRIMA (ID) ---
router.get("/:id", requireAdmin, getUserById);   
router.put("/:id", requireSelfOrAdmin, updateUserById);
router.patch("/:id/restore", requireAdmin, restoreUserById); // Ruta za vraćanje obrisanih
router.delete("/:id", requireAdmin, deleteUserById);

export default router;