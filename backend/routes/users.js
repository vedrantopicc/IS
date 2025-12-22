import { Router } from "express";
import { getAllUsers, getUserById, updateUserById, deleteUserById } from "../controllers/users-controller.js";
import { requireAdmin, requireSelfOrAdmin } from "../middleware/auth-middleware.js";

const router = Router();

router.get("/", requireAdmin, getAllUsers);
router.get("/:id", requireAdmin, getUserById);   
router.put("/:id", requireSelfOrAdmin, updateUserById);
router.delete("/:id", requireAdmin, deleteUserById);

export default router;
