import { Router } from "express";
import { register, login, changePassword, logout  } from "../controllers/auth-controller.js";
import { requireAuth } from "../middleware/auth-middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/change-password", requireAuth, changePassword);
router.post("/logout", requireAuth, logout);

export default router;
