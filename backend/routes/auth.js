import { Router } from "express";
import {
  register,
  login,
  changePassword,
  logout,
  forgotPassword,
  resetPassword
} from "../controllers/auth-controller.js";
import { requireAuth } from "../middleware/auth-middleware.js";

const router = Router();

// Javne rute
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);      // ← nova ruta
router.post("/reset-password", resetPassword);        // ← nova ruta

// Zaštićene rute
router.post("/change-password", requireAuth, changePassword);
router.post("/logout", requireAuth, logout);

export default router;